/**
 * generate-section.ts
 *
 * Generates question files for a range of rules in parallel, using the
 * `claude` CLI with the /generate-questions skill (Haiku model).
 * Rule titles are read from TABLE_OF_CONTENTS.md — no manual input needed.
 *
 * Usage:
 *   npx tsx scripts/generate-section.ts <range> [--concurrency N]
 *
 * Range format: <sec>-<from>:<sec>-<to>   (both endpoints inclusive)
 *
 * Examples:
 *   npx tsx scripts/generate-section.ts 11-01:11-20
 *   npx tsx scripts/generate-section.ts 11-01:11-05 --concurrency 5
 *
 * Output: gen/<rule-id>.txt for each rule in the range.
 * Run `npm run split-txt` on the results when done.
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuleInfo {
  ruleId: string; // e.g. "11-01"
  title: string;  // e.g. "Identifier le COD dans une phrase"
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(): { section: number; ruleFrom: number; ruleTo: number; concurrency: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let range: string | undefined;
  let concurrency = 10;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--concurrency" || a === "-c") {
      const n = parseInt(args[++i] ?? "", 10);
      if (isNaN(n) || n < 1) die("--concurrency must be a positive integer");
      concurrency = n;
    } else if (!a.startsWith("-") && range === undefined) {
      range = a;
    } else {
      die(`Unexpected argument: ${a}\nUsage: generate-section.ts <range> [--concurrency N]`);
    }
  }

  if (!range) {
    die(
      "Missing range argument.\n" +
      "Usage: npx tsx scripts/generate-section.ts <range> [--concurrency N]\n" +
      "Example: npx tsx scripts/generate-section.ts 11-01:11-20 --concurrency 5",
    );
  }

  const m = range.match(/^(\d+)-(\d+):(\d+)-(\d+)$/);
  if (!m) die(`Invalid range "${range}" — expected format: 11-01:11-20`);

  const section  = parseInt(m[1], 10);
  const ruleFrom = parseInt(m[2], 10);
  const secTo    = parseInt(m[3], 10);
  const ruleTo   = parseInt(m[4], 10);

  if (section !== secTo) die("Range must be within a single section (e.g. 11-01:11-20, not 11-01:12-05)");
  if (ruleFrom > ruleTo)  die(`Start rule (${ruleFrom}) must be ≤ end rule (${ruleTo})`);

  return { section, ruleFrom, ruleTo, concurrency, dryRun };
}

function die(msg: string): never {
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
}

// ── TOC parsing ───────────────────────────────────────────────────────────────

function parseToC(section: number, ruleFrom: number, ruleTo: number): RuleInfo[] {
  const tocPath = join(process.cwd(), "TABLE_OF_CONTENTS.md");
  if (!existsSync(tocPath)) die(`TABLE_OF_CONTENTS.md not found at ${tocPath}`);

  const lines = readFileSync(tocPath, "utf-8").split("\n");
  const sectionHeader = new RegExp(`^### ${section}\\.`);
  let inSection = false;
  const rules: RuleInfo[] = [];

  for (const line of lines) {
    if (!inSection) {
      if (sectionHeader.test(line)) inSection = true;
      continue;
    }
    // Stop at next section or horizontal rule
    if (line.startsWith("###") || line.trimEnd() === "---") break;

    // Match "1. Title" or "10. Title"
    const m = line.match(/^(\d+)\.\s+(.+)/);
    if (!m) continue;

    const num = parseInt(m[1], 10);
    if (num < ruleFrom || num > ruleTo) continue;

    // Strip markdown bold markers (**text**)
    const title = m[2].replace(/\*\*([^*]+)\*\*/g, "$1");

    const sec2  = String(section).padStart(2, "0");
    const rule2 = String(num).padStart(2, "0");
    rules.push({ ruleId: `${sec2}-${rule2}`, title });
  }

  if (rules.length === 0) {
    die(`No rules found for section ${section}, rules ${ruleFrom}–${ruleTo} in TABLE_OF_CONTENTS.md`);
  }

  return rules;
}

// ── Worker ────────────────────────────────────────────────────────────────────

async function generateRule(rule: RuleInfo, dryRun = false): Promise<void> {
  const outFile = join("gen", `${rule.ruleId}.txt`);
  const prompt  = `/generate-questions ${rule.ruleId} "${rule.title}" ${outFile}`;

  const claudeArgs = [
    "--print",
    "--model",        "haiku",
    "--allowedTools=Write",
    prompt,
  ];

  const cmdDisplay = ["claude", ...claudeArgs]
    .map((a) => (a.includes(" ") ? `"${a}"` : a))
    .join(" ");

  if (dryRun) {
    console.log(`[${rule.ruleId}] DRY RUN:\n  ${cmdDisplay}\n`);
    return;
  }

  console.log(`[${rule.ruleId}] ▶  ${rule.title}`);
  const t0 = Date.now();

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn("claude", claudeArgs, {
      cwd:   process.cwd(),
      env:   { ...process.env },
      stdio: ["ignore", "pipe", "pipe"], // stdin closed; stdout/stderr streamed
    });

    // Prefix each output line with the rule ID so concurrent jobs are readable
    const prefix = (tag: string) => (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) console.log(`[${rule.ruleId}${tag}] ${line}`);
      }
    };
    child.stdout.on("data", prefix(""));
    child.stderr.on("data", prefix(" ERR"));

    const timer = setTimeout(() => { child.kill(); }, 5 * 60 * 1000);
    child.on("close", (code) => { clearTimeout(timer); resolve(code ?? 1); });
  });

  if (exitCode !== 0) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`[${rule.ruleId}] ✗  FAILED (${elapsed}s): exit code ${exitCode}`);
    return;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!existsSync(outFile)) {
    console.error(`[${rule.ruleId}] ✗  FAILED (${elapsed}s): file not written by claude`);
    return;
  }

  const content       = readFileSync(outFile, "utf-8");
  const questionCount = (content.match(/^BEGIN QUESTION/mg) ?? []).length;
  console.log(`[${rule.ruleId}] ✓  ${elapsed}s — ${questionCount} questions → ${outFile}`);
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runPool(
  items: RuleInfo[],
  concurrency: number,
  worker: (item: RuleInfo) => Promise<void>,
  dryRun = false,
): Promise<void> {
  const queue = [...items];
  async function drain(): Promise<void> {
    const item = queue.shift();
    if (!item) return;
    await worker(item, dryRun);
    return drain();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, drain));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { section, ruleFrom, ruleTo, concurrency, dryRun } = parseArgs();
  const rules = parseToC(section, ruleFrom, ruleTo);

  const sec2  = String(section).padStart(2, "0");
  const from2 = String(ruleFrom).padStart(2, "0");
  const to2   = String(ruleTo).padStart(2, "0");
  console.log(
    `\nGenerating ${rules.length} rule(s): ${sec2}-${from2} → ${sec2}-${to2}` +
    ` (concurrency: ${concurrency}, model: haiku)\n`,
  );

  // Ensure gen/ directory exists
  mkdirSync("gen", { recursive: true });

  const t0 = Date.now();
  await runPool(rules, concurrency, generateRule, dryRun);
  if (dryRun) return;
  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Summary
  console.log("\n─── Summary ──────────────────────────────────────────────────");
  let ok = 0;
  for (const rule of rules) {
    const outFile = join("gen", `${rule.ruleId}.txt`);
    if (existsSync(outFile)) {
      const content       = readFileSync(outFile, "utf-8");
      const questionCount = (content.match(/^BEGIN QUESTION/mg) ?? []).length;
      console.log(`  ✓ ${rule.ruleId}: ${questionCount} questions`);
      ok++;
    } else {
      console.log(`  ✗ ${rule.ruleId}: missing`);
    }
  }
  console.log(`\n${ok}/${rules.length} succeeded in ${totalElapsed}s total\n`);

  if (ok < rules.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
