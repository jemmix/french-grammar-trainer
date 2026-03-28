import type {
  QuestionContext,
  ValidationOptions,
  ValidationReport,
  CheckResult,
  LLMPredicate,
  CacheEntry,
  ValidPredicateResult,
} from "./types";
import { isLLMPredicate } from "./types";
import type { LLMHarness } from "./harness";
import { allPredicates } from "./predicates";
import {
  computeCacheKey,
  generateNonce,
  loadCacheEntry,
  saveCacheEntry,
  createCacheEntry,
  pruneCache,
} from "./cache";
import { createOpencodeHarness, InvalidResponseError, isRetryableError } from "./harness";

const INITIAL_RUNS = 3;
const ADDITIONAL_RUNS = 7;
const MAJORITY_THRESHOLD = 0.9;
const DEFAULT_CONCURRENCY = 10;
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number): number {
  const baseDelay = INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  const jitter = Math.random() * baseDelay * 0.3;
  return Math.min(baseDelay + jitter, MAX_DELAY_MS);
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  onWarn?: (msg: string) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === MAX_RETRIES) {
        throw lastError;
      }

      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      const delay = calculateDelay(attempt);
      const msg = operation + " failed (attempt " + (attempt + 1) + "/" + (MAX_RETRIES + 1) + "), " +
        "retrying in " + Math.round(delay) + "ms: " + lastError.message.split("\n")[0];
      if (onWarn) {
        onWarn(msg);
      } else {
        console.warn(msg);
      }
      await sleep(delay);
    }
  }

  throw lastError;
}

function createConcurrencyLimiter(maxConcurrent: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    while (running >= maxConcurrent) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

async function loadSections(lang: "fr" | "en"): Promise<Map<string, { section: any; rules: Map<string, any> }>> {
  const { loadedSections } = await import("../data/" + lang + "/index.ts");
  const result = new Map<string, { section: any; rules: Map<string, any> }>();
  
  for (const section of loadedSections) {
    const rules = new Map<string, any>();
    for (const rule of section.rules || []) {
      rules.set(rule.id, rule);
    }
    result.set(section.id, { section, rules });
  }
  
  return result;
}

function matchesFilters(q: { id: string; ruleId: string }, sectionId: string, opts: ValidationOptions): boolean {
  if (opts.questions && !opts.questions.includes(q.id)) return false;
  if (opts.rules && !opts.rules.includes(q.ruleId)) return false;
  if (opts.sections && !opts.sections.includes(sectionId)) return false;
  return true;
}

function categoryMatches(predicate: { category: string }, opts: ValidationOptions): boolean {
  if (!opts.categories) return true;
  return opts.categories.includes(predicate.category as any);
}

function formatStatus(result: { status: string; reason?: string }): string {
  if (result.status === "pass") return "\x1b[32mPASS\x1b[0m";
  return "\x1b[31m" + result.status.toUpperCase() + "\x1b[0m" + (result.reason ? ": " + result.reason : "");
}

function emitResult(
  questionId: string,
  predicateId: string,
  attemptNumber: number,
  result: { status: string; reason?: string },
  progressSuffix?: string
): string {
  const status = formatStatus(result);
  return "  " + questionId + " | " + predicateId + " | attempt " + attemptNumber + " | " + status + (progressSuffix || "");
}

interface LLMPendingTask {
  predicate: LLMPredicate;
  ctx: QuestionContext;
  entry: CacheEntry;
  fromCache: boolean;
  resolve: (result: ValidPredicateResult & { responseCount: number; attemptDetails?: string[] }) => void;
}

function formatEta(ms: number): string {
  if (ms < 1000 || !isFinite(ms)) return "...";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m + "m" + (rem > 0 ? rem + "s" : "");
}

const isInteractive = process.stdout.isTTY;

interface TaskProgress {
  completedCalls: number;
  failCount: number;
  done: boolean;
}

interface ProgressTracker {
  tasks: TaskProgress[];
  completedCalls: number;
  startTime: number;
  emaCallMs: number;
  emaAlpha: number;
  _lastTick: number;
}

class ProgressUI {
  tracker: ProgressTracker;

  constructor(taskCount: number) {
    const now = Date.now();
    const tasks: TaskProgress[] = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push({ completedCalls: 0, failCount: 0, done: false });
    }
    this.tracker = {
      tasks,
      completedCalls: 0,
      startTime: now,
      emaCallMs: 0,
      emaAlpha: 0.3,
      _lastTick: now,
    };
  }

  tick(taskIndex: number, failCount: number): void {
    const now = Date.now();
    const callMs = now - this.tracker._lastTick;
    this.tracker.emaCallMs = this.tracker.emaAlpha * callMs + (1 - this.tracker.emaAlpha) * this.tracker.emaCallMs;
    this.tracker._lastTick = now;
    this.tracker.completedCalls++;
    this.tracker.tasks[taskIndex]!.completedCalls++;
    this.tracker.tasks[taskIndex]!.failCount = failCount;
    this.render();
  }

  done(taskIndex: number): void {
    this.tracker.tasks[taskIndex]!.done = true;
  }

  write(msg: string): void {
    if (isInteractive) {
      process.stdout.write("\r\x1b[K");
    }
    console.log(msg);
    this.render();
  }

  finish(): void {
    if (isInteractive) {
      process.stdout.write("\r\x1b[K");
    }
  }

  suffix(): string {
    const total = this.estimatedTotal();
    const pct = total > 0 ? Math.round((this.tracker.completedCalls / total) * 100) : 0;
    return " [" + this.tracker.completedCalls + "/" + total + " " + pct + "%]";
  }

  private estimatedTotal(): number {
    let total = 0;
    for (const t of this.tracker.tasks) {
      if (t.done || t.failCount >= 2) {
        total += t.completedCalls;
      } else if (t.failCount === 1) {
        total += Math.max(t.completedCalls, INITIAL_RUNS + ADDITIONAL_RUNS);
      } else {
        total += Math.max(t.completedCalls, INITIAL_RUNS);
      }
    }
    return total;
  }

  private render(): void {
    if (!isInteractive) return;
    const total = this.estimatedTotal();
    const pct = total > 0 ? Math.round((this.tracker.completedCalls / total) * 100) : 0;
    const remaining = total - this.tracker.completedCalls;
    const eta = this.tracker.completedCalls === 0 ? "..." : formatEta(remaining * this.tracker.emaCallMs);
    process.stdout.write("\r  " + this.tracker.completedCalls + "/" + total + " LLM calls (" + pct + "%) | ETA " + eta + "    ");
  }
}

async function runLLMBatch(
  tasks: LLMPendingTask[],
  updateCache: boolean,
  limitConcurrency: <T>(fn: () => Promise<T>) => Promise<T>,
  verbose: boolean,
  harness: LLMHarness
): Promise<void> {
  const ui = new ProgressUI(tasks.length);

  const runTask = async (taskIndex: number) => {
    const task = tasks[taskIndex]!;
    const { predicate, ctx, entry } = task;
    const spec = { systemPrompt: entry.spec.systemPrompt, userPrompt: entry.spec.userPrompt };
    
    const getValidResults = () => {
      const all = entry.responses.map(r => predicate.interpretResponse(ctx, r.raw));
      return all.filter((r): r is ValidPredicateResult => r.status !== "invalid");
    };
    
    const needsMore = () => {
      const validResults = getValidResults();
      const failCount = validResults.filter(r => r.status === "fail").length;
      if (failCount >= 2) return false;
      if (validResults.length < INITIAL_RUNS) return true;
      return failCount > 0 && validResults.length < INITIAL_RUNS + ADDITIONAL_RUNS;
    };
    
    let attemptNumber = 0;
    
    while (updateCache && needsMore()) {
      await limitConcurrency(async () => {
        const nonce = generateNonce();
        
        const response = await runWithRetry(
          async () => {
            const res = await harness.run(spec, nonce);
            const interp = predicate.interpretResponse(ctx, res.raw);
            if (interp.status === "invalid") {
              throw new InvalidResponseError(interp.reason);
            }
            return res;
          },
          "LLM call for " + ctx.question.id + "/" + predicate.id,
          (msg) => ui.write(msg)
        );
        
        entry.responses.push(response);
        attemptNumber++;
        
        const validResults = getValidResults();
        const failCount = validResults.filter(r => r.status === "fail").length;
        
        ui.tick(taskIndex, failCount);
        
        if (verbose) {
          const interp = predicate.interpretResponse(ctx, response.raw);
          if (isInteractive) {
            ui.write("  " + ctx.question.id + " | " + predicate.id + " | attempt " + attemptNumber + " | " + formatStatus(interp));
          } else {
            console.log("  " + ctx.question.id + " | " + predicate.id + " | attempt " + attemptNumber + " | " + formatStatus(interp) + ui.suffix());
          }
        }
        
        saveCacheEntry(entry);
      });
    }
    
    ui.done(taskIndex);
    
    if (entry.responses.length === 0) {
      if (verbose) {
        ui.write("  " + ctx.question.id + " | " + predicate.id + " | attempt 0 | " + formatStatus({ status: "fail", reason: "No cached responses and cache update disabled" }));
      }
      task.resolve({ status: "fail", reason: "No cached responses and cache update disabled", responseCount: 0 });
      return;
    }
    
    const validResults = getValidResults();
    
    if (validResults.length === 0) {
      throw new Error(
        "All LLM responses were invalid for " + ctx.question.id + " / " + predicate.id + ". " +
        "Total responses: " + entry.responses.length + ". " +
        "Last response: " + (entry.responses[entry.responses.length - 1]?.raw?.slice(0, 200) || "none")
      );
    }
    
    const passCount = validResults.filter(r => r.status === "pass").length;
    const totalValid = validResults.length;
    
    if (passCount / totalValid >= MAJORITY_THRESHOLD) {
      task.resolve({ status: "pass", responseCount: totalValid });
    } else if ((totalValid - passCount) / totalValid >= MAJORITY_THRESHOLD) {
      const failedResult = validResults.find(r => r.status === "fail");
      const reason = failedResult?.reason || "Majority FALSE";
      task.resolve({ status: "fail", reason, responseCount: totalValid });
    } else {
      const reason = "No clear majority: " + passCount + "/" + totalValid + " PASS";
      const attemptDetails = validResults.map((r, i) => {
        const tag = r.status === "pass" ? "PASS" : "FAIL" + (r.reason ? ": " + r.reason : "");
        return "attempt " + (i + 1) + ": " + tag;
      });
      task.resolve({ status: "fail", reason, responseCount: totalValid, attemptDetails });
    }
  };
  
  await Promise.all(tasks.map((_, i) => runTask(i)));
  ui.finish();
}

export async function runValidation(opts: ValidationOptions): Promise<ValidationReport> {
  const startTime = Date.now();
  const results: CheckResult[] = [];
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  
  const lang = opts.lang || "en";
  const model = opts.model || "glm-5";
  const harness = createOpencodeHarness(model);
  const sections = await loadSections(lang);
  const cacheKeysUsed = new Set<string>();
  const concurrency = opts.concurrency || DEFAULT_CONCURRENCY;
  const limitConcurrency = createConcurrencyLimiter(concurrency);
  
  const llmPendingTasks: LLMPendingTask[] = [];
  const structuralResults: CheckResult[] = [];
  const verbose = opts.llm === true;
  
  for (const [sectionId, { section, rules }] of sections) {
    for (const question of section.questions || []) {
      if (!matchesFilters(question, sectionId, opts)) continue;
      
      const rule = rules.get(question.ruleId);
      if (!rule) continue;
      
      const ctx: QuestionContext = {
        question,
        rule,
        section,
        lang,
      };
      
      for (const predicate of allPredicates) {
        if (!categoryMatches(predicate, opts)) continue;
        if (isLLMPredicate(predicate) && opts.llm !== true) continue;
        
        if (isLLMPredicate(predicate)) {
          if (!predicate.appliesTo(ctx)) continue;
          
          const spec = predicate.generatePrompt(ctx);
          const cacheKey = computeCacheKey(predicate.id, question.id, spec);
          cacheKeysUsed.add(cacheKey);
          
          let entry = loadCacheEntry(cacheKey);
          const fromCache = entry !== null;
          
          if (!entry) {
            if (opts.dryRun) {
              cacheMisses++;
              console.log("");
              console.log("--- LLM command (would run " + INITIAL_RUNS + " times) ---");
              console.log("predicate:", predicate.id);
              console.log("question:", question.id);
              console.log("cache key:", cacheKey);
              console.log("system prompt:", spec.systemPrompt);
              console.log("user prompt:", spec.userPrompt);
              console.log("");
              results.push({
                questionId: question.id,
                predicateId: predicate.id,
                category: predicate.category,
                pass: false,
                reason: "CACHE MISS (dry-run)",
                fromCache: false,
              });
              continue;
            }
            
            if (!opts.updateCache) {
              cacheMisses++;
              results.push({
                questionId: question.id,
                predicateId: predicate.id,
                category: predicate.category,
                pass: false,
                reason: "No cached response",
                fromCache: false,
              });
              continue;
            }
            
            const nonce = generateNonce();
            entry = createCacheEntry(cacheKey, predicate.id, question.id, spec, nonce);
            cacheMisses++;
          } else {
            cacheHits++;
          }
          
          const taskPromise = new Promise<ValidPredicateResult & { responseCount: number }>(resolve => {
            llmPendingTasks.push({
              predicate,
              ctx,
              entry: entry!,
              fromCache,
              resolve,
            });
          });
          
          taskPromise.then(llmResult => {
            const result: CheckResult = {
              questionId: question.id,
              predicateId: predicate.id,
              category: predicate.category,
              pass: llmResult.status === "pass",
              reason: llmResult.status === "fail" ? llmResult.reason : undefined,
              fromCache,
              responseCount: llmResult.responseCount,
              attemptDetails: (llmResult as any).attemptDetails,
            };
            results.push(result);
            if (result.pass) passed++;
            else if (predicate.category === "pedagogical") { warnings++; failed++; }
            else failed++;
          });
          
        } else {
          const predicateResult = predicate.check(ctx);
          const checkResult: CheckResult = {
            questionId: question.id,
            predicateId: predicate.id,
            category: predicate.category,
            pass: predicateResult.status === "pass",
            reason: predicateResult.status !== "pass" ? predicateResult.reason : undefined,
          };
          structuralResults.push(checkResult);
          if (predicateResult.status === "pass") passed++;
          else failed++;
        }
      }
    }
  }
  
  results.unshift(...structuralResults);
  
  if (llmPendingTasks.length > 0) {
    const cachedResponseCount = llmPendingTasks.reduce((sum, t) => sum + t.entry.responses.length, 0);
    if (cachedResponseCount > 0) {
      console.log(cachedResponseCount + " results loaded from cache");
    }
    console.log("Running " + llmPendingTasks.length + " LLM tasks (max " + concurrency + " concurrent)...");
    await runLLMBatch(llmPendingTasks, !!opts.updateCache, limitConcurrency, verbose, harness);
  }
  
  if (opts.pruneCache) {
    const removed = pruneCache(cacheKeysUsed);
    console.log("Pruned " + removed.length + " orphaned cache entries");
  }
  
  return {
    results,
    passed,
    failed,
    warnings,
    cacheHits,
    cacheMisses,
    durationMs: Date.now() - startTime,
  };
}
