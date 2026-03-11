/**
 * Elision linter for French question files.
 *
 * Pure text-matching — no LLM. Checks whether the word before `___` in PROMPT
 * or PHRASE is consistent with the answer's initial sound:
 *
 *   "Je ___"  + vowel-starting answer  → should be "J'___"
 *   "J'___"   + consonant-starting answer → should be "Je ___"
 *   "me ___"  + vowel-starting answer  → should be "m'___"
 *   "m'___"   + consonant-starting answer → should be "me ___"
 *   (same for te/t', se/s', le/l', la/l', de/d', ne/n', que/qu', ce/c')
 *
 * Usage: npx tsx scripts/lint-elision.ts [--stats=none|rule|section] <file.txt> [...]
 *
 * Options:
 *   --stats=none     Don't print stats, only issues
 *   --stats=rule     Print stats grouped by rule (default)
 *   --stats=section  Print stats grouped by section
 */

import { readFileSync } from "fs";
import { basename } from "path";
import { parseTxtFile, type ParsedQuestion } from "./lib/parse-txt.js";
import { checkElision, type ElisionIssueKind } from "./lib/elision-check.js";

interface Issue {
  id: string;
  kind: ElisionIssueKind;
  message: string;
}

function checkQuestion(q: ParsedQuestion): Issue[] {
  const allAnswers = [q.right.text.trim(), ...q.wrongs.map((w: { text: string }) => w.text.trim())].filter(a => a);
  if (allAnswers.length === 0) return [];

  const texts: string[] = [q.prompt];
  if (q.type === "input" && q.phrase) {
    texts.push(q.phrase);
  }

  const issues: Issue[] = [];
  for (const text of texts) {
    const elisionIssues = checkElision(text, allAnswers);
    for (const issue of elisionIssues) {
      issues.push({
        id: q.id,
        ...issue,
      });
    }
  }
  return issues;
}

// ============================================================
// Main
// ============================================================

type StatsMode = "none" | "rule" | "section";

function parseArgs(args: string[]): { statsMode: StatsMode; files: string[] } {
  let statsMode: StatsMode = "rule";
  const files: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--stats=")) {
      const mode = arg.split("=")[1];
      if (mode === "none" || mode === "rule" || mode === "section") {
        statsMode = mode;
      } else {
        console.error(`Invalid --stats value: ${mode}. Use none, rule, or section.`);
        process.exit(1);
      }
    } else if (!arg.startsWith("--")) {
      files.push(arg);
    }
  }

  return { statsMode, files };
}

const { statsMode, files } = parseArgs(process.argv.slice(2));
if (files.length === 0) {
  console.error("Usage: npx tsx scripts/lint-elision.ts [--stats=none|rule|section] <file.txt> [...]");
  process.exit(1);
}

interface Stats {
  total: number;
  valid: number;
  invalid: number;
  issues: Issue[];
}

const statsMap = new Map<string, Stats>();

let totalQuestions = 0;
let totalIssues = 0;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const parsed = parseTxtFile(content);
  const ruleId = parsed.ruleId;
  const sectionId = ruleId.split("-")[0]!;

  const key = statsMode === "section" ? sectionId : ruleId;

  if (!statsMap.has(key)) {
    statsMap.set(key, { total: 0, valid: 0, invalid: 0, issues: [] });
  }
  const stats = statsMap.get(key)!;

  for (const q of parsed.questions) {
    const issues = checkQuestion(q);
    stats.total++;
    totalQuestions++;
    if (issues.length > 0) {
      stats.invalid++;
      totalIssues += issues.length;
      stats.issues.push(...issues);
    } else {
      stats.valid++;
    }
  }
}

// Print stats
if (statsMode !== "none") {
  const label = statsMode === "section" ? "section" : "rule";
  console.log(`Elision lint results by ${label}:`);
  console.log("─".repeat(60));

  const entries = [...statsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, stats] of entries) {
    const validPct = stats.total > 0 ? ((stats.valid / stats.total) * 100).toFixed(1) : "N/A";
    const invalidPct = stats.total > 0 ? ((stats.invalid / stats.total) * 100).toFixed(1) : "N/A";
    console.log(
      `${key}: ${stats.total} Qs | ${validPct}% valid | ${invalidPct}% invalid (${stats.invalid} Qs with issues)`,
    );
  }

  console.log("─".repeat(60));
  console.log(`Total: ${totalQuestions} Qs | ${totalIssues} issues across ${files.length} files`);
  console.log();
}

// Print detailed issues
if (totalIssues > 0) {
  console.log("Issues found:");
  const entries = [...statsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, stats] of entries) {
    for (const issue of stats.issues) {
      console.log(`  ${issue.id}: [${issue.kind}] ${issue.message}`);
    }
  }
}

process.exit(totalIssues > 0 ? 1 : 0);
