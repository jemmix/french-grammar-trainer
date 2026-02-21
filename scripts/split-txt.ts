/**
 * Splits a .txt question file into two files:
 *   <basename>-passed.txt  — questions that pass all validation checks
 *   <basename>-failed.txt  — questions that failed, annotated with errors
 *
 * The failed file can be edited and re-validated/re-split until clean,
 * then merged back via: cat <basename>-passed.txt <basename>-failed-fixed.txt
 *
 * Usage: npx tsx scripts/split-txt.ts <file.txt> [<file2.txt> ...]
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, extname, dirname, join } from "path";
import { parseTxtFile, type ParsedQuestion, type ParsedMcqQuestion, type ParsedInputQuestion } from "./lib/parse-txt.js";

// ============================================================
// Per-question validation — returns list of error strings
// ============================================================

const DETERMINER_FAMILIES: Record<string, string[]> = {
  "défini": ["le", "la", "l'", "les"],
  "indéfini": ["un", "une", "des"],
  "partitif": ["du", "de la", "de l'"],
  "contracté-à": ["au", "aux"],
  "possessif-3s": ["son", "sa", "ses"],
  "possessif-1s": ["mon", "ma", "mes"],
  "possessif-2s": ["ton", "ta", "tes"],
  "possessif-3p": ["leur", "leurs"],
  "possessif-1p": ["notre", "nos"],
  "possessif-2p": ["votre", "vos"],
  "démonstratif": ["ce", "cet", "cette", "ces"],
};

function getFamilies(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  return Object.entries(DETERMINER_FAMILIES)
    .filter(([, members]) => members.includes(normalized))
    .map(([family]) => family);
}

function validateQuestion(q: ParsedQuestion): string[] {
  const errors: string[] = [];

  if (!q.id) errors.push("Missing ID");
  if (!q.prompt.trim()) errors.push("Empty PROMPT");

  if (q.type === "mcq") {
    const mcq = q as ParsedMcqQuestion;
    if (!mcq.right.text.trim()) errors.push("Missing RIGHT ANSWER");
    if (1 + mcq.wrongs.length < 2) errors.push(`Only ${1 + mcq.wrongs.length} choice(s) — need at least 2`);

    const allTexts = [mcq.right.text, ...mcq.wrongs.map((w) => w.text)];

    // Duplicate choices
    const seen = new Map<string, number>();
    for (let i = 0; i < allTexts.length; i++) {
      const key = allTexts[i]!.toLowerCase().trim();
      if (seen.has(key)) errors.push(`Duplicate choice "${allTexts[i]}" (indices ${seen.get(key)} and ${i})`);
      seen.set(key, i);
    }

    // Determiner family diversity
    const familyCounts = new Map<string, string[]>();
    for (const text of allTexts) {
      for (const family of getFamilies(text)) {
        const existing = familyCounts.get(family) ?? [];
        existing.push(text);
        familyCounts.set(family, existing);
      }
    }
    for (const [family, members] of familyCounts) {
      if (members.length > 2) {
        errors.push(`${members.length} choices from family "${family}": ${members.join(", ")} — max 2 allowed`);
      }
    }
  } else {
    const inp = q as ParsedInputQuestion;
    if (!inp.phrase.trim()) errors.push("Empty PHRASE");
    else if (!inp.phrase.includes("___")) errors.push("PHRASE does not contain ___ blank");
    if (!inp.right.text.trim()) errors.push("Missing RIGHT ANSWER");

    if (inp.wrongs.length < 4) {
      errors.push(`INPUT must have at least 4 wrong answers, found ${inp.wrongs.length}`);
    }

    const seen = new Map<string, number>();
    for (let i = 0; i < inp.wrongs.length; i++) {
      const key = inp.wrongs[i]!.text.toLowerCase().trim();
      if (seen.has(key)) errors.push(`Duplicate wrong answer "${inp.wrongs[i]!.text}" (indices ${seen.get(key)} and ${i})`);
      seen.set(key, i);
      if (key === inp.right.text.toLowerCase().trim()) {
        errors.push(`Wrong answer "${inp.wrongs[i]!.text}" matches the correct answer`);
      }
    }
  }

  return errors;
}

// ============================================================
// Raw block extraction
// Extracts BEGIN QUESTION ... END QUESTION blocks as raw strings,
// preserving original whitespace/formatting.
// ============================================================

function extractBlocks(content: string): { header: string; blocks: string[] } {
  const lines = content.split("\n");
  const headerLines: string[] = [];
  const blocks: string[] = [];
  let inQuestion = false;
  let currentBlockLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN QUESTION") {
      inQuestion = true;
      currentBlockLines = [line];
    } else if (trimmed === "END QUESTION") {
      currentBlockLines.push(line);
      blocks.push(currentBlockLines.join("\n"));
      currentBlockLines = [];
      inQuestion = false;
    } else if (inQuestion) {
      currentBlockLines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  return { header: headerLines.join("\n").trimEnd(), blocks };
}

// ============================================================
// Header builder
// ============================================================

function buildHeader(parsed: ReturnType<typeof parseTxtFile>, mcqCount: number, inputCount: number): string {
  return [
    `RULE ${parsed.ruleId}: ${parsed.ruleTitle}`,
    `Generated by: ${parsed.generatedBy}`,
    `Total: ${mcqCount} MCQ + ${inputCount} input = ${mcqCount + inputCount} questions`,
  ].join("\n");
}

// ============================================================
// Main split logic
// ============================================================

function splitFile(filePath: string) {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`ERROR: Cannot read "${filePath}"`);
    return;
  }

  const parsed = parseTxtFile(content);
  const { header, blocks } = extractBlocks(content);

  if (blocks.length !== parsed.questions.length) {
    console.error(
      `ERROR [${filePath}]: Block count (${blocks.length}) doesn't match parsed question count (${parsed.questions.length}). Check for parse errors.`,
    );
    if (parsed.parseErrors.length > 0) {
      for (const e of parsed.parseErrors) console.error(`  Parse error: ${e}`);
    }
    return;
  }

  const passedBlocks: string[] = [];
  const failedEntries: { block: string; errors: string[] }[] = [];

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i]!;
    const block = blocks[i]!;
    const errors = validateQuestion(q);

    if (errors.length === 0) {
      passedBlocks.push(block);
    } else {
      failedEntries.push({ block, errors });
    }
  }

  const passedMcq = passedBlocks.filter((b) => b.includes("TYPE: MCQ")).length;
  const passedInput = passedBlocks.filter((b) => b.includes("TYPE: INPUT")).length;
  const failedMcq = failedEntries.filter(({ block: b }) => b.includes("TYPE: MCQ")).length;
  const failedInput = failedEntries.filter(({ block: b }) => b.includes("TYPE: INPUT")).length;

  const ext = extname(filePath);
  const base = basename(filePath, ext);
  const dir = dirname(filePath);

  // Write passed file
  const passedPath = join(dir, `${base}-passed${ext}`);
  const passedHeader = buildHeader(parsed, passedMcq, passedInput);
  const passedContent = passedHeader + "\n\n" + passedBlocks.join("\n\n") + "\n";
  writeFileSync(passedPath, passedContent, "utf-8");

  // Write failed file (with error annotations)
  const failedPath = join(dir, `${base}-failed${ext}`);
  const failedHeader = buildHeader(parsed, failedMcq, failedInput);
  const failedBlocksAnnotated = failedEntries.map(({ block, errors }) => {
    const annotations = errors.map((e) => `VALIDATION ERROR: ${e}`).join("\n");
    return annotations + "\n" + block;
  });
  const failedContent =
    failedHeader +
    "\n" +
    "# Fix the questions below and run validate-txt to check them.\n" +
    "# Remove the VALIDATION ERROR lines once fixed.\n\n" +
    failedBlocksAnnotated.join("\n\n") +
    "\n";
  writeFileSync(failedPath, failedContent, "utf-8");

  // Report
  console.log(`\n${filePath}`);
  console.log(`  Passed : ${passedBlocks.length} questions (${passedMcq} MCQ, ${passedInput} INPUT) → ${passedPath}`);
  console.log(`  Failed : ${failedEntries.length} questions (${failedMcq} MCQ, ${failedInput} INPUT) → ${failedPath}`);

  if (failedEntries.length > 0) {
    console.log(`  Failures:`);
    for (const { errors, block } of failedEntries) {
      const idMatch = block.match(/^ID:\s*(.+)$/m);
      const id = idMatch ? idMatch[1]!.trim() : "?";
      for (const e of errors) console.log(`    [${id}] ${e}`);
    }
  }
}

// ============================================================
// Main
// ============================================================

function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error("Usage: npx tsx scripts/split-txt.ts <file.txt> [<file2.txt> ...]");
    process.exit(1);
  }

  for (const f of files) splitFile(f);
  console.log("\nDone.");
}

main();
