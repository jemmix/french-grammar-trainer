/**
 * Question validation CLI.
 *
 * Usage:
 *   npx tsx scripts/validate.ts [options]
 *
 * Options:
 *   --lang <fr|en>         Language to validate (default: en)
 *   --section <id>         Section ID filter (e.g., "01")
 *   --rule <id>            Rule ID filter (e.g., "01-01")
 *   --question <id>        Question ID filter (e.g., "01-01-001")
 *   --llm                  Enable LLM-based predicates
 *   --dry-run              Show cache status without running LLM
 *   --update-cache         Run LLM and update cache for misses
 *   --prune-cache          Remove orphaned cache entries
 *   --concurrency <n>      Max concurrent LLM calls (default: 10)
 *   --model <model>        LLM model to use (default: glm-5)
 *   --json                 Output as JSON
 */

import { runValidation } from "../src/validation/runner";
import type { ValidationOptions, ValidationReport } from "../src/validation/types";

function parseArgs(): ValidationOptions & { json?: boolean } {
  const args = process.argv.slice(2);
  const opts: ValidationOptions & { json?: boolean } = {
    llm: false,
    dryRun: false,
    updateCache: false,
    pruneCache: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--lang" && args[i + 1]) {
      opts.lang = args[++i] as "fr" | "en";
    } else if (arg === "--section" && args[i + 1]) {
      opts.sections = [args[++i]!];
    } else if (arg === "--rule" && args[i + 1]) {
      opts.rules = [args[++i]!];
    } else if (arg === "--question" && args[i + 1]) {
      opts.questions = args[++i]!.split(",");
    } else if (arg === "--llm") {
      opts.llm = true;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--update-cache") {
      opts.updateCache = true;
    } else if (arg === "--prune-cache") {
      opts.pruneCache = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--concurrency" && args[i + 1]) {
      opts.concurrency = parseInt(args[++i]!, 10);
    } else if (arg === "--model" && args[i + 1]) {
      opts.model = args[++i];
    } else if (arg && arg.startsWith("--")) {
      console.error("Unknown option:", arg);
      process.exit(1);
    }
  }
  
  return opts;
}

function extractRuleId(questionId: string): string {
  const parts = questionId.split("-");
  return parts.length >= 2 ? parts[0] + "-" + parts[1] : questionId;
}

function printReport(report: ValidationReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  
  console.log("\n=== Validation Report ===\n");
  
  const failed = report.results.filter(r => !r.pass);
  
  if (failed.length > 0) {
    console.log("FAILURES:\n");
    
    const byRule = new Map<string, Map<string, typeof failed>>();
    for (const r of failed) {
      const ruleId = extractRuleId(r.questionId);
      if (!byRule.has(ruleId)) byRule.set(ruleId, new Map());
      const ruleMap = byRule.get(ruleId)!;
      if (!ruleMap.has(r.questionId)) ruleMap.set(r.questionId, []);
      ruleMap.get(r.questionId)!.push(r);
    }
    
    for (const [ruleId, questions] of byRule) {
      console.log("  Rule " + ruleId + ":");
      for (const [questionId, results] of questions) {
        console.log("    " + questionId + ":");
        for (const r of results) {
          console.log("      [" + r.predicateId + "] " + (r.reason || "FAIL"));
          if (r.attemptDetails) {
            for (const line of r.attemptDetails) {
              console.log("        " + line);
            }
          }
        }
      }
      console.log("");
    }
  }
  
  console.log("SUMMARY:");
  console.log("  Passed:  " + report.passed);
  console.log("  Failed:  " + report.failed);
  console.log("  Warnings: " + report.warnings);
  if (report.cacheHits > 0 || report.cacheMisses > 0) {
    console.log("  Cache hits: " + report.cacheHits);
    console.log("  Cache misses: " + report.cacheMisses);
  }
  console.log("  Duration: " + report.durationMs + "ms");
  console.log("");
  
  if (report.failed > 0) {
    console.log("VALIDATION FAILED");
    process.exit(1);
  } else {
    console.log("VALIDATION PASSED");
  }
}

async function main() {
  const opts = parseArgs();
  
  console.log("Running validation...");
  if (opts.sections) console.log("  Sections: " + opts.sections.join(", "));
  if (opts.rules) console.log("  Rules: " + opts.rules.join(", "));
  if (opts.questions) console.log("  Questions: " + opts.questions.join(", "));
  if (opts.llm) console.log("  LLM: enabled (" + (opts.dryRun ? "dry-run" : opts.updateCache ? "update-cache" : "read-only") + ")");
  console.log("");
  
  const report = await runValidation(opts);
  printReport(report, opts.json || false);
}

 
main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
