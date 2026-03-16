import type {
  QuestionContext,
  ValidationOptions,
  ValidationReport,
  CheckResult,
  LLMPredicate,
  CacheEntry,
} from "./types";
import { isLLMPredicate } from "./types";
import { allPredicates } from "./predicates";
import {
  computeCacheKey,
  generateNonce,
  loadCacheEntry,
  saveCacheEntry,
  createCacheEntry,
  pruneCache,
} from "./cache";
import { opencodeHarness, parseVerdict } from "./harness";

const INITIAL_RUNS = 3;
const ADDITIONAL_RUNS = 7;
const MAJORITY_THRESHOLD = 0.9;
const MAX_CONCURRENCY = 5;

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

interface LLMPendingTask {
  predicate: LLMPredicate;
  ctx: QuestionContext;
  entry: CacheEntry;
  fromCache: boolean;
  resolve: (result: { pass: boolean; reason?: string; responseCount: number }) => void;
}

async function runLLMBatch(
  tasks: LLMPendingTask[],
  updateCache: boolean,
  limitConcurrency: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<void> {
  const runTask = async (task: LLMPendingTask) => {
    const { predicate, ctx, entry, fromCache } = task;
    const spec = { systemPrompt: entry.spec.systemPrompt, userPrompt: entry.spec.userPrompt };
    
    const neededRuns = fromCache 
      ? Math.max(0, INITIAL_RUNS - entry.responses.length)
      : INITIAL_RUNS;
    
    const needsMore = (count: number, results: { pass: boolean }[]) => {
      if (count < INITIAL_RUNS) return true;
      const falseCount = results.filter(r => !r.pass).length;
      return falseCount > 0 && count < INITIAL_RUNS + ADDITIONAL_RUNS;
    };
    
    while (updateCache && needsMore(entry.responses.length, entry.responses.map(r => predicate.interpretResponse(ctx, r.raw)))) {
      await limitConcurrency(async () => {
        const nonce = generateNonce();
        const response = await opencodeHarness.run(spec, nonce);
        entry.responses.push(response);
        saveCacheEntry(entry);
      });
    }
    
    if (entry.responses.length === 0) {
      task.resolve({ pass: false, reason: "No cached responses and cache update disabled", responseCount: 0 });
      return;
    }
    
    const allResults = entry.responses.map(r => predicate.interpretResponse(ctx, r.raw));
    const allTrueCount = allResults.filter(r => r.pass).length;
    const totalResponses = allResults.length;
    
    if (allTrueCount / totalResponses >= MAJORITY_THRESHOLD) {
      task.resolve({ pass: true, responseCount: totalResponses });
    } else if ((totalResponses - allTrueCount) / totalResponses >= MAJORITY_THRESHOLD) {
      const failedResult = allResults.find(r => !r.pass);
      task.resolve({ pass: false, reason: failedResult?.reason || "Majority FALSE", responseCount: totalResponses });
    } else {
      task.resolve({ pass: false, reason: "No clear majority: " + allTrueCount + "/" + totalResponses + " TRUE", responseCount: totalResponses });
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
  const sections = await loadSections(lang);
  const cacheKeysUsed = new Set<string>();
  const limitConcurrency = createConcurrencyLimiter(MAX_CONCURRENCY);
  
  const llmPendingTasks: LLMPendingTask[] = [];
  const structuralResults: CheckResult[] = [];
  
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
          
          const taskPromise = new Promise<{ pass: boolean; reason?: string; responseCount: number }>(resolve => {
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
              pass: llmResult.pass,
              reason: llmResult.reason,
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
            pass: predicateResult.pass,
            reason: predicateResult.reason,
          };
          structuralResults.push(checkResult);
          if (predicateResult.pass) passed++;
          else failed++;
        }
      }
    }
  }
  
  results.unshift(...structuralResults);
  
  if (llmPendingTasks.length > 0) {
    console.log("Running " + llmPendingTasks.length + " LLM tasks (max " + MAX_CONCURRENCY + " concurrent)...");
    await runLLMBatch(llmPendingTasks, !!opts.updateCache, limitConcurrency);
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
