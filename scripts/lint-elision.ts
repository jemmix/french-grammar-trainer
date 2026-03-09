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

// Words with aspirate h — no elision before these
const ASPIRATE_H = new Set([
  "hache", "haches", "haine", "haines", "haïr", "hais", "haïs", "haït",
  "haïssons", "haïssez", "haïssent", "halte", "hamac", "hamacs", "hameau",
  "hameaux", "hanche", "hanches", "handicap", "handicapé", "handicapée",
  "hangar", "hangars", "hanter", "hante", "hantes", "hantent", "harceler",
  "harcèle", "hardi", "hardie", "hardis", "hardies", "hareng", "harengs",
  "haricot", "haricots", "harpe", "harpes", "hasard", "hasards", "hâte",
  "hausse", "hausser", "haut", "haute", "hauts", "hautes", "hauteur",
  "hauteurs", "héros", "hêtre", "hêtres", "hibou", "hiboux", "hiérarchie",
  "hobby", "hobbies", "hockey", "hollande", "hollandais", "hollandaise",
  "homard", "homards", "hongre", "hongrois", "hongroise", "honte",
  "hooligan", "hooligans", "hoquet", "hoquets", "horde", "hordes", "hors",
  "hot-dog", "hotte", "hottes", "houblon", "housse", "housses", "hublot",
  "hublots", "huée", "huées", "huer", "hurler", "hurle", "hurles",
  "hurlent", "hutte", "huttes",
]);

// Elision pairs: [full form, elided form]
// The full form is what appears before a consonant; the elided form before a vowel.
const ELISION_PAIRS: [string, string][] = [
  ["je", "j'"],
  ["me", "m'"],
  ["te", "t'"],
  ["se", "s'"],
  ["le", "l'"],
  ["la", "l'"],
  ["de", "d'"],
  ["ne", "n'"],
  ["que", "qu'"],
  ["ce", "c'"],
];

function startsWithVowelSound(word: string): boolean {
  if (!word) return false;
  const lower = word.toLowerCase();
  // Check aspirate h
  if (lower.startsWith("h")) {
    // Check if it's an aspirate-h word
    for (const ah of ASPIRATE_H) {
      if (lower === ah || lower.startsWith(ah)) return false;
    }
    // Mute h — elision applies
    return true;
  }
  return /^[aeiouyàâäéèêëîïôùûüÿœæ]/i.test(word);
}

function startsWithConsonantSound(word: string): boolean {
  if (!word) return false;
  return !startsWithVowelSound(word);
}

interface Issue {
  id: string;
  kind: "elision-missing" | "elision-wrong";
  message: string;
}

function getTextBeforeBlank(text: string): string | null {
  // Find the word immediately before ___
  const m = text.match(/(\S+)\s+___/);
  return m ? m[1]! : null;
}

function getTextBeforeBlankElided(text: string): string | null {
  // Find word attached to ___ via apostrophe: J'___, l'___
  const m = text.match(/(\S+')\s*___/);
  return m ? m[1]! : null;
}

function checkQuestion(q: ParsedQuestion): Issue[] {
  const issues: Issue[] = [];
  
  // Collect all answers (right + wrongs)
  const allAnswers = [q.right.text.trim(), ...q.wrongs.map((w: { text: string }) => w.text.trim())].filter(a => a);
  if (allAnswers.length === 0) return issues;

  // Determine the text to check (PHRASE for input, PROMPT for mcq)
  const texts: string[] = [q.prompt];
  if (q.type === "input" && q.phrase) {
    texts.push(q.phrase);
  }

  // Check if ALL answers start with vowel/consonant (for MCQ with mixed answers, non-elided is safest)
  const allVowel = allAnswers.every(a => startsWithVowelSound(a));
  const allConsonant = allAnswers.every(a => startsWithConsonantSound(a));

  for (const text of texts) {
    // Case 1: word + space + ___ (non-elided form before blank)
    const wordBefore = getTextBeforeBlank(text);
    if (wordBefore) {
      const cleaned = wordBefore.replace(/[«»"',.:;!?()]/g, "").toLowerCase();
      // If all answers start with vowel, non-elided form is wrong
      if (allVowel) {
        for (const [full, elided] of ELISION_PAIRS) {
          if (cleaned === full) {
            issues.push({
              id: q.id,
              kind: "elision-missing",
              message: `"${wordBefore} ___" but some answers start with vowel → should be "${elided}___"`,
            });
          }
        }
      }
    }

    // Case 2: word'___ (elided form before blank)
    const elidedBefore = getTextBeforeBlankElided(text);
    if (elidedBefore) {
      const cleaned = elidedBefore.replace(/[«»"',.:;!?()]/g, "").toLowerCase();
      // If all answers start with consonant, elided form is wrong
      if (allConsonant) {
        for (const [full, elided] of ELISION_PAIRS) {
          if (cleaned === elided) {
            issues.push({
              id: q.id,
              kind: "elision-wrong",
              message: `"${elidedBefore}___" but some answers start with consonant → should be "${full} ___"`,
            });
          }
        }
      }
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
