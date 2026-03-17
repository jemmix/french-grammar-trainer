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
import { createOpencodeHarness, parseVerdict } from "./harness";

const INITIAL_RUNS = 3;
const ADDITIONAL_RUNS = 7;
const MAJORITY_THRESHOLD = 0.9;
const DEFAULT_CONCURRENCY = 10;

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
  fromCache: boolean,
  result: { status: string; reason?: string }
): void {
  const cacheTag = fromCache ? "[cached]" : "[fresh] ";
  const status = formatStatus(result);
  console.log("  " + questionId + " | " + predicateId + " | attempt " + attemptNumber + " | " + cacheTag + " " + status);
}

interface LLMPendingTask {
  predicate: LLMPredicate;
  ctx: QuestionContext;
  entry: CacheEntry;
  fromCache: boolean;
  resolve: (result: ValidPredicateResult & { responseCount: number }) => void;
}

async function runLLMBatch(
  tasks: LLMPendingTask[],
  updateCache: boolean,
  limitConcurrency: <T>(fn: () => Promise<T>) => Promise<T>,
  verbose: boolean,
  harness: LLMHarness
): Promise<void> {
  const runTask = async (task: LLMPendingTask) => {
    const { predicate, ctx, entry, fromCache } = task;
    const spec = { systemPrompt: entry.spec.systemPrompt, userPrompt: entry.spec.userPrompt };
    
    const getValidResults = () => {
      const all = entry.responses.map(r => predicate.interpretResponse(ctx, r.raw));
      return all.filter((r): r is ValidPredicateResult => r.status !== "invalid");
    };
    
    const needsMore = () => {
      const validResults = getValidResults();
      if (validResults.length < INITIAL_RUNS) return true;
      const failCount = validResults.filter(r => r.status === "fail").length;
      return failCount > 0 && validResults.length < INITIAL_RUNS + ADDITIONAL_RUNS;
    };
    
    let attemptNumber = 0;
    
    if (verbose && fromCache) {
      for (const response of entry.responses) {
        attemptNumber++;
        const interp = predicate.interpretResponse(ctx, response.raw);
        emitResult(ctx.question.id, predicate.id, attemptNumber, true, interp);
      }
    } else {
      attemptNumber = entry.responses.length;
    }
    
    while (updateCache && needsMore()) {
      await limitConcurrency(async () => {
        const nonce = generateNonce();
        const response = await harness.run(spec, nonce);
        entry.responses.push(response);
        saveCacheEntry(entry);
        
        attemptNumber++;
        if (verbose) {
          const interp = predicate.interpretResponse(ctx, response.raw);
          emitResult(ctx.question.id, predicate.id, attemptNumber, false, interp);
        }
      });
    }
    
    if (entry.responses.length === 0) {
      if (verbose) {
        emitResult(ctx.question.id, predicate.id, 0, fromCache, { status: "fail", reason: "No cached responses and cache update disabled" });
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
      task.resolve({ status: "fail", reason, responseCount: totalValid });
    }
  };
  
  await Promise.all(tasks.map(runTask));
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
