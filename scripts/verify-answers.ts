/**
 * Verifies MCQ question/answer pairs by asking an AI model whether
 * each answer matches the question — without any grammar-rule hints.
 *
 * For each MCQ question, tests:
 *   - The right answer (expected: TRUE)
 *   - Every wrong answer (expected: FALSE)
 *
 * One opencode invocation per question/answer combo.
 *
 * Usage:
 *   npx tsx scripts/verify-answers.ts <file.txt> [<file2.txt> ...]
 *
 * Options:
 *   --concurrency <n>    Max parallel opencode invocations (default: 10)
 *   --dry-run            Print commands instead of executing them
 *   --output-dir <dir>   Directory for reports (default: gen/verify)
 *
 * Outputs (per file):
 *   gen/verify/<rule-id>-results.txt    — full results per answer
 *   gen/verify/<rule-id>-mismatches.txt — only answers where model disagreed with expected
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFile } from "child_process";
import { basename } from "path";
import { parseTxtFile, type ParsedMcqQuestion } from "./lib/parse-txt.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

let concurrency = 10;
let dryRun = false;
let outputDir = "gen/verify";
const files: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--concurrency" && args[i + 1]) {
    concurrency = parseInt(args[++i]!, 10);
  } else if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg === "--output-dir" && args[i + 1]) {
    outputDir = args[++i]!;
  } else if (!arg.startsWith("-")) {
    files.push(arg);
  } else {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }
}

if (files.length === 0) {
  console.error("Error: at least one question file is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  `You are a grammar answer verifier. Given a question and a proposed answer, ` +
  `respond with exactly one word:\n` +
  `- TRUE if the answer correctly completes or answers the question\n` +
  `- FALSE if the answer is incorrect\n` +
  `- UNCLEAR if there is genuinely no way to determine correctness\n\n` +
  `Your response must contain ONLY one of these three words in all caps. No explanation.`;

function buildPrompt(question: string, answer: string): string {
  return `Question: ${question}\nAnswer: ${answer}`;
}

// ---------------------------------------------------------------------------
// AI invocation via opencode
// ---------------------------------------------------------------------------

function invokeAI(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "opencode",
      ["run", "-p", SYSTEM_PROMPT, prompt],
      { timeout: 60_000, maxBuffer: 10 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`opencode failed: ${err.message}\nstderr: ${stderr}`));
          return;
        }
        resolve(stdout.trim());
      },
    );
    child.stdin?.end();
  });
}

// ---------------------------------------------------------------------------
// Concurrency-limited runner
// ---------------------------------------------------------------------------

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyJob {
  questionId: string;
  prompt: string;
  answer: string;
  expectedVerdict: "TRUE" | "FALSE"; // TRUE for right answer, FALSE for wrongs
}

interface VerifyResult extends VerifyJob {
  verdict: string; // "TRUE" | "FALSE" | "UNCLEAR" | raw/error
  mismatch: boolean;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildJobs(questions: ParsedMcqQuestion[]): VerifyJob[] {
  const jobs: VerifyJob[] = [];
  for (const q of questions) {
    // Right answer — should be TRUE
    jobs.push({
      questionId: q.id,
      prompt: q.prompt,
      answer: q.right.text,
      expectedVerdict: "TRUE",
    });
    // Wrong answers — should each be FALSE
    for (const w of q.wrongs) {
      jobs.push({
        questionId: q.id,
        prompt: q.prompt,
        answer: w.text,
        expectedVerdict: "FALSE",
      });
    }
  }
  return jobs;
}

async function processFile(filePath: string): Promise<void> {
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseTxtFile(content);

  if (parsed.parseErrors.length > 0) {
    console.error(`Parse errors in ${filePath}:`);
    for (const e of parsed.parseErrors) console.error(`  ${e}`);
    process.exit(1);
  }

  const mcqs = parsed.questions.filter(
    (q): q is ParsedMcqQuestion => q.type === "mcq",
  );
  const skipped = parsed.questions.length - mcqs.length;

  const ruleId = parsed.ruleId || basename(filePath, ".txt");
  const jobs = buildJobs(mcqs);

  console.log(
    `\n=== ${ruleId}: ${parsed.ruleTitle} ===`,
  );
  console.log(
    `  ${mcqs.length} MCQ questions, ${jobs.length} answer checks` +
      (skipped > 0 ? ` (${skipped} input questions skipped)` : ""),
  );

  if (dryRun) {
    for (const job of jobs) {
      const prompt = buildPrompt(job.prompt, job.answer);
      const tag = job.expectedVerdict === "TRUE" ? "RIGHT" : "WRONG";
      console.log(
        `[${tag}] opencode run -p ${JSON.stringify(SYSTEM_PROMPT)} ${JSON.stringify(prompt)}`,
      );
    }
    return;
  }

  const results: VerifyResult[] = await mapWithConcurrency(
    jobs,
    concurrency,
    async (job) => {
      const prompt = buildPrompt(job.prompt, job.answer);
      let verdict: string;
      try {
        const raw = await invokeAI(prompt);
        const match = raw.match(/\b(TRUE|FALSE|UNCLEAR)\b/);
        verdict = match ? match[1]! : `RAW:${raw.slice(0, 80)}`;
      } catch (e: unknown) {
        verdict = `ERROR:${(e as Error).message.slice(0, 80)}`;
      }

      const mismatch = verdict !== job.expectedVerdict;
      const tag = job.expectedVerdict === "TRUE" ? "RIGHT" : "WRONG";
      const symbol = mismatch ? "✗" : "✓";
      process.stdout.write(
        `  ${symbol} ${job.questionId} [${tag}] "${job.answer}" → ${verdict}${mismatch ? ` (expected ${job.expectedVerdict})` : ""}\n`,
      );

      return { ...job, verdict, mismatch };
    },
  );

  // Summaries
  const matchCount = results.filter((r) => !r.mismatch).length;
  const mismatchCount = results.filter((r) => r.mismatch).length;
  const rightResults = results.filter((r) => r.expectedVerdict === "TRUE");
  const wrongResults = results.filter((r) => r.expectedVerdict === "FALSE");
  const rightOk = rightResults.filter((r) => !r.mismatch).length;
  const wrongOk = wrongResults.filter((r) => !r.mismatch).length;

  console.log(
    `\n  Summary: ${matchCount}/${results.length} match` +
      ` (right answers: ${rightOk}/${rightResults.length} TRUE,` +
      ` wrong answers: ${wrongOk}/${wrongResults.length} FALSE)` +
      ` — ${mismatchCount} mismatches`,
  );

  // Write reports
  mkdirSync(outputDir, { recursive: true });

  // Full results
  const resultsPath = `${outputDir}/${ruleId}-results.txt`;
  const resultsContent = [
    `Verification results for ${ruleId}: ${parsed.ruleTitle}`,
    `Total: ${results.length} checks (${rightResults.length} right + ${wrongResults.length} wrong answers)`,
    `Match: ${matchCount}  Mismatch: ${mismatchCount}`,
    "",
    ...results.map((r) => {
      const tag = r.expectedVerdict === "TRUE" ? "RIGHT" : "WRONG";
      const flag = r.mismatch ? "MISMATCH" : "OK";
      return `${flag.padEnd(9)} ${r.questionId} [${tag}] "${r.answer}" → ${r.verdict}`;
    }),
    "",
  ].join("\n");
  writeFileSync(resultsPath, resultsContent);
  console.log(`  Results written to ${resultsPath}`);

  // Mismatches only
  const mismatches = results.filter((r) => r.mismatch);
  if (mismatches.length > 0) {
    const mismatchPath = `${outputDir}/${ruleId}-mismatches.txt`;
    const mismatchContent = [
      `Mismatches for ${ruleId}: ${parsed.ruleTitle}`,
      `${mismatches.length} of ${results.length} checks flagged`,
      "",
      ...mismatches.map((r) => {
        const tag = r.expectedVerdict === "TRUE" ? "RIGHT" : "WRONG";
        return (
          `${r.questionId} [${tag}] expected ${r.expectedVerdict}, got ${r.verdict}\n` +
          `  Q: ${r.prompt}\n` +
          `  A: ${r.answer}\n`
        );
      }),
    ].join("\n");
    writeFileSync(mismatchPath, mismatchContent);
    console.log(`  Mismatches written to ${mismatchPath}`);
  } else {
    console.log(`  No mismatches — all answers verified!`);
  }
}

(async () => {
  for (const f of files) {
    await processFile(f);
  }
})();
