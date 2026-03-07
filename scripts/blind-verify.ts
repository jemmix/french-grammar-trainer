/**
 * Strips question files to user-visible content only: no correct/wrong
 * markings, no explanations, no rule/section hints. Produces two files:
 *   - <rule-id>-quiz.txt   — the stripped quiz (for feeding to an LLM)
 *   - <rule-id>-key.json   — the answer key (for comparison after)
 *
 * Usage:
 *   npx tsx scripts/blind-verify.ts <file.txt> [<file2.txt> ...]
 *
 * Options:
 *   --output-dir <dir>   Directory for output (default: gen/blind-verify)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { basename } from "path";
import {
  parseTxtFile,
  type ParsedMcqQuestion,
  type ParsedInputQuestion,
  type ParsedQuestion,
} from "./lib/parse-txt.js";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let outputDir = "gen/blind-verify";
const files: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--output-dir" && args[i + 1]) {
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
// Strip questions to user-visible content
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface KeyEntry {
  id: string;
  type: "mcq" | "input";
  correctAnswer: string;
  choices?: string[]; // MCQ only — the shuffled choices shown to the model
}

function processQuestion(q: ParsedQuestion): { text: string; key: KeyEntry } {
  if (q.type === "mcq") {
    const mcq = q as ParsedMcqQuestion;
    const allChoices = shuffleArray([
      mcq.right.text,
      ...mcq.wrongs.map((w) => w.text),
    ]);
    const text = [
      `--- ${q.id} ---`,
      mcq.prompt,
      `Choices: ${allChoices.join(" / ")}`,
      "",
    ].join("\n");
    return {
      text,
      key: { id: q.id, type: "mcq", correctAnswer: mcq.right.text, choices: allChoices },
    };
  } else {
    const inp = q as ParsedInputQuestion;
    const text = [
      `--- ${q.id} ---`,
      inp.prompt,
      inp.phrase,
      "",
    ].join("\n");
    return {
      text,
      key: { id: q.id, type: "input", correctAnswer: inp.right.text },
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

for (const filePath of files) {
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseTxtFile(content);

  if (parsed.parseErrors.length > 0) {
    console.error(`Parse errors in ${filePath}:`);
    for (const e of parsed.parseErrors) console.error(`  ${e}`);
    process.exit(1);
  }

  const ruleId = parsed.ruleId || basename(filePath, ".txt");
  mkdirSync(outputDir, { recursive: true });

  const quizLines: string[] = [];
  const keys: KeyEntry[] = [];

  for (const q of parsed.questions) {
    const { text, key } = processQuestion(q);
    quizLines.push(text);
    keys.push(key);
  }

  const quizPath = `${outputDir}/${ruleId}-quiz.txt`;
  const keyPath = `${outputDir}/${ruleId}-key.json`;

  writeFileSync(quizPath, quizLines.join("\n"));
  writeFileSync(keyPath, JSON.stringify(keys, null, 2) + "\n");

  console.log(`${ruleId}: ${parsed.questions.length} questions`);
  console.log(`  Quiz: ${quizPath}`);
  console.log(`  Key:  ${keyPath}`);
}
