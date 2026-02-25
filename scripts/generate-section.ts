/**
 * generate-section.ts
 *
 * Generates question files for a range of rules in parallel, using the
 * `claude` CLI with the /generate-questions skill (Haiku model).
 * Rule titles are read from TABLE_OF_CONTENTS.md — no manual input needed.
 *
 * Usage:
 *   npx tsx scripts/generate-section.ts <range> [--concurrency N] [--dry-run]
 *
 * Range format: <sec>-<from>:<sec>-<to>   (both endpoints inclusive)
 *
 * Examples:
 *   npx tsx scripts/generate-section.ts 11-01:11-20
 *   npx tsx scripts/generate-section.ts 11-01:11-05 --concurrency 5
 *   npx tsx scripts/generate-section.ts 11-01:11-03 --dry-run
 *
 * Output files : gen/<rule-id>.txt  (one per rule)
 * Log file     : gen/generate-section-logs/<timestamp>_<range>.log
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, mkdirSync, createWriteStream, WriteStream } from "fs";
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
    const a = args[i]!; // safe: loop condition guarantees i < args.length
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--concurrency" || a === "-c") {
      const n = parseInt(args[++i] ?? "", 10);
      if (isNaN(n) || n < 1) die("--concurrency must be a positive integer");
      concurrency = n;
    } else if (!a.startsWith("-") && range === undefined) {
      range = a;
    } else {
      die(`Unexpected argument: ${a}\nUsage: generate-section.ts <range> [--concurrency N] [--dry-run]`);
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

  // m[1]–m[4] are guaranteed by the regex having exactly 4 capture groups
  const section  = parseInt(m[1]!, 10);
  const ruleFrom = parseInt(m[2]!, 10);
  const secTo    = parseInt(m[3]!, 10);
  const ruleTo   = parseInt(m[4]!, 10);

  if (section !== secTo) die("Range must be within a single section (e.g. 11-01:11-20, not 11-01:12-05)");
  if (ruleFrom > ruleTo)  die(`Start rule (${ruleFrom}) must be ≤ end rule (${ruleTo})`);

  return { section, ruleFrom, ruleTo, concurrency, dryRun };
}

function die(msg: string): never {
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
}

// ── Shell-safe command display ────────────────────────────────────────────────
// Uses single-quote wrapping so the displayed command is copy-paste safe.

function shellEscape(arg: string): string {
  if (!/[\s"'`$\\!|&;<>(){}*?#~]/.test(arg)) return arg;
  // Wrap in single quotes; escape internal single quotes as '\''
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function formatCmd(args: string[]): string {
  return args.map(shellEscape).join(" ");
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
    if (line.startsWith("###") || line.trimEnd() === "---") break;

    const m = line.match(/^(\d+)\.\s+(.+)/);
    if (!m) continue;

    const num = parseInt(m[1]!, 10); // safe: regex guarantees group 1 exists
    if (num < ruleFrom || num > ruleTo) continue;

    const title = m[2]!.replace(/\*\*([^*]+)\*\*/g, "$1"); // safe: regex guarantees group 2 exists
    const sec2  = String(section).padStart(2, "0");
    const rule2 = String(num).padStart(2, "0");
    rules.push({ ruleId: `${sec2}-${rule2}`, title });
  }

  if (rules.length === 0) {
    die(`No rules found for section ${section}, rules ${ruleFrom}–${ruleTo} in TABLE_OF_CONTENTS.md`);
  }

  return rules;
}

// ── Display (progress bar + terminal output) ──────────────────────────────────

class Display {
  private static BAR_WIDTH = 28;
  private currentBar = "";

  /** Print a message above the progress bar. Also writes to log. */
  log(msg: string, log: WriteStream) {
    process.stdout.write(`\r\x1b[2K${msg}\n`);
    log.write(`${msg}\n`);
    if (this.currentBar) process.stdout.write(`${this.currentBar}\x1b[K`);
  }

  /** Re-render the progress bar in-place. */
  progress(done: number, total: number, running: string[]) {
    const w      = Display.BAR_WIDTH;
    const filled = total > 0 ? Math.round((done / total) * w) : 0;
    const bar    = "█".repeat(filled) + "░".repeat(w - filled);
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
    const run    = running.length > 0 ? `  · ${running.join(", ")}` : "";
    this.currentBar = `[${bar}] ${done}/${total} (${pct}%)${run}`;
    process.stdout.write(`\r${this.currentBar}\x1b[K`);
  }

  /** Call once all work is done to leave the cursor on a clean line. */
  finish() {
    process.stdout.write(`\r\x1b[2K`);
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

async function generateRule(
  rule: RuleInfo,
  display: Display,
  log: WriteStream,
  progress: () => void,
  dryRun: boolean,
): Promise<boolean> {
  const outFile    = join("gen", `${rule.ruleId}.txt`);
  const prompt     = `/generate-questions ${rule.ruleId} "${rule.title}" ${outFile}`;
  const claudeArgs = ["--print", "--model", "haiku", "--allowedTools=Write", prompt];

  if (dryRun) {
    display.log(`[${rule.ruleId}] DRY RUN: ${formatCmd(["claude", ...claudeArgs])}`, log);
    return true;
  }

  const t0 = Date.now();

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn("claude", claudeArgs, {
      cwd:   process.cwd(),
      env:   { ...process.env },
      stdio: ["ignore", "pipe", "pipe"], // stdin closed; stdout/stderr to log only
    });

    // Child output goes to log file only — keeps terminal clean for progress bar
    const toLog = (tag: string) => (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) log.write(`[${rule.ruleId}${tag}] ${line}\n`);
      }
    };
    child.stdout.on("data", toLog(""));
    child.stderr.on("data", toLog(" ERR"));

    const timer = setTimeout(() => { child.kill(); }, 5 * 60 * 1000);
    child.on("close", (code) => { clearTimeout(timer); resolve(code ?? 1); });
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  if (exitCode !== 0) {
    display.log(`[${rule.ruleId}] ✗  failed in ${elapsed}s (exit ${exitCode})`, log);
    progress();
    return false;
  }

  if (!existsSync(outFile)) {
    display.log(`[${rule.ruleId}] ✗  failed in ${elapsed}s (file not written)`, log);
    progress();
    return false;
  }

  const content       = readFileSync(outFile, "utf-8");
  const questionCount = (content.match(/^BEGIN QUESTION/mg) ?? []).length;
  display.log(`[${rule.ruleId}] ✓  finished in ${elapsed}s — ${questionCount} questions`, log);
  progress();
  return true;
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runPool(
  rules: RuleInfo[],
  concurrency: number,
  display: Display,
  log: WriteStream,
  dryRun: boolean,
): Promise<boolean[]> {
  const total   = rules.length;
  let done      = 0;
  const running = new Set<string>();
  const results: boolean[] = [];

  const runningIds = () => [...running].sort();

  const progress = () => {
    display.progress(done, total, runningIds());
  };

  // Show initial empty bar (skip in dry-run to keep output clean)
  if (!dryRun) display.progress(0, total, []);

  // In dry-run the progress callback isn't invoked, so don't add to running set
  if (dryRun) {
    for (const rule of rules) {
      await generateRule(rule, display, log, () => {}, true);
    }
    return results;
  }

  const queue = [...rules];

  async function drain(): Promise<void> {
    const rule = queue.shift();
    if (!rule) return;

    running.add(rule.ruleId);
    progress();

    const ok = await generateRule(rule, display, log, () => {
      running.delete(rule.ruleId);
      done++;
      progress();
    }, dryRun);

    results.push(ok);
    return drain();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rules.length) }, drain));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { section, ruleFrom, ruleTo, concurrency, dryRun } = parseArgs();
  const rules = parseToC(section, ruleFrom, ruleTo);

  const sec2  = String(section).padStart(2, "0");
  const from2 = String(ruleFrom).padStart(2, "0");
  const to2   = String(ruleTo).padStart(2, "0");
  const range = `${sec2}-${from2}_${sec2}-${to2}`;

  // Set up log file
  mkdirSync("gen", { recursive: true });
  mkdirSync(join("gen", "generate-section-logs"), { recursive: true });
  const ts      = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = join("gen", "generate-section-logs", `${ts}_${range}.log`);
  const log     = createWriteStream(logPath, { encoding: "utf-8" });

  const display = new Display();

  const header =
    `Generating ${rules.length} rule(s): ${sec2}-${from2} → ${sec2}-${to2}` +
    ` (concurrency: ${concurrency}, model: haiku)` +
    (dryRun ? "  [DRY RUN]" : `\nLog: ${logPath}`);

  display.log(header, log);

  const t0      = Date.now();
  const results = await runPool(rules, concurrency, display, log, dryRun);

  display.finish();

  if (dryRun) { log.end(); return; }

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const ok           = results.filter(Boolean).length;

  // Summary to terminal + log
  const summaryLines = [
    "",
    "─── Summary ──────────────────────────────────────────────────",
    ...rules.map((rule, i) => {
      const outFile = join("gen", `${rule.ruleId}.txt`);
      if (existsSync(outFile)) {
        const q = (readFileSync(outFile, "utf-8").match(/^BEGIN QUESTION/mg) ?? []).length;
        return `  ✓ ${rule.ruleId}: ${q} questions`;
      }
      return `  ✗ ${rule.ruleId}: missing`;
    }),
    `\n${ok}/${rules.length} succeeded in ${totalElapsed}s total`,
  ];

  for (const line of summaryLines) {
    process.stdout.write(`${line}\n`);
    log.write(`${line}\n`);
  }

  log.end();
  if (ok < rules.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
