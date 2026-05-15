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
const MAX_RETRIES = 10;
const RETRY_DELAYS_MS = [
  1_000, 2_000, 5_000, 10_000, 30_000,
  60_000, 120_000, 300_000, 600_000, 600_000,
];

const PRIORITY_PREDICATE_IDS = new Set([
  "question-rule-alignment",
  "no-ambiguous-prompts",
  "mcq-wrong-is-false",
]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
  const jitter = Math.random() * base * 0.3;
  return base + jitter;
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

      const delay = getRetryDelay(attempt);
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
  const sectionNum = sectionId.split("-")[0]!;
  if (opts.sections && !opts.sections.includes(sectionNum)) return false;
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

interface LLMPendingTask {
  predicate: LLMPredicate;
  ctx: QuestionContext;
  entry: CacheEntry;
  fromCache: boolean;
}

function preCheckDoomedQuestions(tasks: LLMPendingTask[]): Set<string> {
  const doomed = new Set<string>();
  for (const task of tasks) {
    if (task.entry.responses.length === 0) continue;
    const validResults = task.entry.responses
      .map(r => task.predicate.interpretResponse(task.ctx, r.raw))
      .filter((r): r is ValidPredicateResult => r.status !== "invalid");
    const failCount = validResults.filter(r => r.status === "fail").length;
    if (failCount >= 2) {
      doomed.add(task.ctx.question.id);
    }
  }
  return doomed;
}

function resolveTask(task: LLMPendingTask, doomedQuestions: Set<string>): CheckResult {
  const { predicate, ctx, entry, fromCache } = task;

  if (entry.responses.length === 0) {
    const reason = doomedQuestions.has(ctx.question.id)
      ? "Skipped: question already failed another check"
      : "No cached responses and cache update disabled";
    return {
      questionId: ctx.question.id,
      predicateId: predicate.id,
      category: predicate.category,
      pass: false,
      reason,
      fromCache,
      responseCount: 0,
    };
  }

  const validResults = entry.responses
    .map(r => predicate.interpretResponse(ctx, r.raw))
    .filter((r): r is ValidPredicateResult => r.status !== "invalid");

  if (validResults.length === 0) {
    return {
      questionId: ctx.question.id,
      predicateId: predicate.id,
      category: predicate.category,
      pass: false,
      reason: "All LLM responses were invalid",
      fromCache,
      responseCount: entry.responses.length,
    };
  }

  const passCount = validResults.filter(r => r.status === "pass").length;
  const totalValid = validResults.length;

  if (passCount / totalValid >= MAJORITY_THRESHOLD) {
    return {
      questionId: ctx.question.id,
      predicateId: predicate.id,
      category: predicate.category,
      pass: true,
      fromCache,
      responseCount: totalValid,
    };
  }

  if ((totalValid - passCount) / totalValid >= MAJORITY_THRESHOLD) {
    const attemptDetails = validResults.map((r, i) => {
      const tag = r.status === "pass" ? "PASS" : "FAIL" + ("reason" in r && r.reason ? ": " + r.reason : "");
      return "attempt " + (i + 1) + ": " + tag;
    });
    return {
      questionId: ctx.question.id,
      predicateId: predicate.id,
      category: predicate.category,
      pass: false,
      reason: passCount + "/" + totalValid + " runs passed",
      fromCache,
      responseCount: totalValid,
      attemptDetails,
    };
  }

  const attemptDetails = validResults.map((r, i) => {
    const tag = r.status === "pass" ? "PASS" : "FAIL" + ("reason" in r && r.reason ? ": " + r.reason : "");
    return "attempt " + (i + 1) + ": " + tag;
  });
  return {
    questionId: ctx.question.id,
    predicateId: predicate.id,
    category: predicate.category,
    pass: false,
    reason: passCount + "/" + totalValid + " runs passed",
    fromCache,
    responseCount: totalValid,
    attemptDetails,
  };
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
  emaCallDuration: number;
  emaAlpha: number;
  concurrency: number;
}

class ProgressUI {
  tracker: ProgressTracker;

  constructor(taskCount: number, concurrency: number) {
    const tasks: TaskProgress[] = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push({ completedCalls: 0, failCount: 0, done: false });
    }
    this.tracker = {
      tasks,
      completedCalls: 0,
      emaCallDuration: 0,
      emaAlpha: 0.1,
      concurrency,
    };
  }

  tick(taskIndex: number, failCount: number, callDuration: number): void {
    this.tracker.emaCallDuration = this.tracker.emaAlpha * callDuration + (1 - this.tracker.emaAlpha) * this.tracker.emaCallDuration;
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
    const eta = this.tracker.completedCalls === 0 ? "..." : formatEta((remaining * this.tracker.emaCallDuration) / this.tracker.concurrency);
    process.stdout.write("\r  " + this.tracker.completedCalls + "/" + total + " LLM calls (" + pct + "%) | ETA " + eta + "    ");
  }
}

async function runLLMBatch(
  tasks: LLMPendingTask[],
  updateCache: boolean,
  concurrency: number,
  limitConcurrency: <T>(fn: () => Promise<T>) => Promise<T>,
  verbose: boolean,
  harness: LLMHarness,
  doomedQuestions: Set<string>
): Promise<CheckResult[]> {
  const ui = new ProgressUI(tasks.length, concurrency);
  const taskResults: CheckResult[] = new Array(tasks.length);

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
      if (doomedQuestions.has(ctx.question.id)) break;

      await limitConcurrency(async () => {
        if (doomedQuestions.has(ctx.question.id)) return;

        const nonce = generateNonce();

        const callStart = Date.now();
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
        const callDuration = Date.now() - callStart;

        entry.responses.push(response);
        attemptNumber++;

        const validResults = getValidResults();
        const failCount = validResults.filter(r => r.status === "fail").length;

        ui.tick(taskIndex, failCount, callDuration);

        if (verbose) {
          const interp = predicate.interpretResponse(ctx, response.raw);
          if (isInteractive) {
            ui.write("  " + ctx.question.id + " | " + predicate.id + " | attempt " + attemptNumber + " | " + formatStatus(interp));
          } else {
            console.log("  " + ctx.question.id + " | " + predicate.id + " | attempt " + attemptNumber + " | " + formatStatus(interp) + ui.suffix());
          }
        }

        saveCacheEntry(entry);

        if (failCount >= 2) {
          doomedQuestions.add(ctx.question.id);
        }
      });
    }

    ui.done(taskIndex);

    const result = resolveTask(task, doomedQuestions);

    if (verbose && entry.responses.length === 0) {
      ui.write("  " + ctx.question.id + " | " + predicate.id + " | attempt 0 | " + formatStatus({ status: "fail", reason: result.reason || "FAIL" }));
    }

    taskResults[taskIndex] = result;
  };

  await Promise.all(tasks.map((_, i) => runTask(i)));
  ui.finish();
  return taskResults;
}

function tallyResults(results: CheckResult[]): { passed: number; failed: number; warnings: number } {
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  for (const r of results) {
    if (r.pass) {
      passed++;
    } else {
      failed++;
      if (r.category === "pedagogical") warnings++;
    }
  }
  return { passed, failed, warnings };
}

export async function runValidation(opts: ValidationOptions): Promise<ValidationReport> {
  const startTime = Date.now();

  const lang = opts.lang || "en";
  const model = opts.model || "glm-5";
  const harness = createOpencodeHarness(model);
  const sections = await loadSections(lang);
  const cacheKeysUsed = new Set<string>();
  const concurrency = opts.concurrency || DEFAULT_CONCURRENCY;
  const limitConcurrency = createConcurrencyLimiter(concurrency);

  const priorityTasks: LLMPendingTask[] = [];
  const restTasks: LLMPendingTask[] = [];
  const structuralResults: CheckResult[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;
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
              structuralResults.push({
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
              structuralResults.push({
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

          const target = PRIORITY_PREDICATE_IDS.has(predicate.id) ? priorityTasks : restTasks;
          target.push({ predicate, ctx, entry: entry!, fromCache });

        } else {
          const predicateResult = predicate.check(ctx);
          structuralResults.push({
            questionId: question.id,
            predicateId: predicate.id,
            category: predicate.category,
            pass: predicateResult.status === "pass",
            reason: predicateResult.status !== "pass" ? predicateResult.reason : undefined,
          });
        }
      }
    }
  }

  const allLLMTasks = [...priorityTasks, ...restTasks];
  const llmResults: CheckResult[] = [];

  if (allLLMTasks.length > 0) {
    const cachedResponseCount = allLLMTasks.reduce((sum, t) => sum + t.entry.responses.length, 0);
    if (cachedResponseCount > 0) {
      console.log(cachedResponseCount + " results loaded from cache");
    }

    const doomedQuestions = preCheckDoomedQuestions(allLLMTasks);
    const structDoomed = new Set<string>();
    for (const r of structuralResults) {
      if (!r.pass) structDoomed.add(r.questionId);
    }
    for (const id of structDoomed) doomedQuestions.add(id);
    if (doomedQuestions.size > 0) {
      const parts: string[] = [];
      if (structDoomed.size > 0) parts.push(structDoomed.size + " structural");
      if (doomedQuestions.size > structDoomed.size) parts.push((doomedQuestions.size - structDoomed.size) + " from cache");
      console.log(doomedQuestions.size + " question(s) doomed before LLM checks (" + parts.join(", ") + ")");
    }

    console.log("Running " + allLLMTasks.length + " LLM tasks (max " + concurrency + " concurrent)...");

    const activePriority = priorityTasks.filter(t => !doomedQuestions.has(t.ctx.question.id));
    const skippedPriority = priorityTasks.filter(t => doomedQuestions.has(t.ctx.question.id));

    if (skippedPriority.length > 0) {
      llmResults.push(...skippedPriority.map(t => resolveTask(t, doomedQuestions)));
    }

    if (activePriority.length > 0) {
      console.log("  Phase 1: " + activePriority.length + " priority checks");
      const results = await runLLMBatch(activePriority, !!opts.updateCache, concurrency, limitConcurrency, verbose, harness, doomedQuestions);
      llmResults.push(...results);
    }

    if (restTasks.length > 0) {
      const activeRest = restTasks.filter(t => !doomedQuestions.has(t.ctx.question.id));
      const skippedRest = restTasks.filter(t => doomedQuestions.has(t.ctx.question.id));

      if (skippedRest.length > 0) {
        console.log("  " + skippedRest.length + " remaining tasks skipped (question already doomed)");
        llmResults.push(...skippedRest.map(t => resolveTask(t, doomedQuestions)));
      }

      if (activeRest.length > 0) {
        console.log("  Phase 2: " + activeRest.length + " remaining checks");
        const results = await runLLMBatch(activeRest, !!opts.updateCache, concurrency, limitConcurrency, verbose, harness, doomedQuestions);
        llmResults.push(...results);
      }
    }
  }

  if (opts.pruneCache) {
    const removed = pruneCache(cacheKeysUsed);
    console.log("Pruned " + removed.length + " orphaned cache entries");
  }

  const allResults = [...structuralResults, ...llmResults];
  const { passed, failed, warnings } = tallyResults(allResults);

  return {
    results: allResults,
    passed,
    failed,
    warnings,
    cacheHits,
    cacheMisses,
    durationMs: Date.now() - startTime,
  };
}
