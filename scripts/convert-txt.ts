/**
 * Converts .txt question files (from generate-questions skill) to a TypeScript
 * section file ready for import by the application.
 *
 * Validates before converting — exits with an error if any .txt file has issues.
 *
 * Usage:
 *   npx tsx scripts/convert-txt.ts \
 *     --section-id "01-present-indicatif" \
 *     --section-title "Le présent de l'indicatif" \
 *     --section-desc "Formation et emplois du présent de l'indicatif" \
 *     --output src/data/sections/01-present-indicatif.ts \
 *     01-01.txt 01-02.txt ...
 *
 * If --output is omitted, the TypeScript is printed to stdout.
 */

import { readFileSync, writeFileSync } from "fs";
import { parseTxtFile, type ParsedFile, type ParsedMcqQuestion, type ParsedInputQuestion } from "./lib/parse-txt.js";

// ============================================================
// Validation (fast-path: just collect errors, no console output)
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

function collectErrors(parsed: ParsedFile): string[] {
  const errors: string[] = [...parsed.parseErrors];

  if (!parsed.ruleId) errors.push("Missing RULE header");

  const mcqCount = parsed.questions.filter((q) => q.type === "mcq").length;
  const inputCount = parsed.questions.filter((q) => q.type === "input").length;
  if (mcqCount !== parsed.declaredMcq) {
    errors.push(`MCQ count mismatch: declared ${parsed.declaredMcq}, found ${mcqCount}`);
  }
  if (inputCount !== parsed.declaredInput) {
    errors.push(`INPUT count mismatch: declared ${parsed.declaredInput}, found ${inputCount}`);
  }

  const seenIds = new Set<string>();
  for (const q of parsed.questions) {
    if (seenIds.has(q.id)) errors.push(`Duplicate question ID: ${q.id}`);
    seenIds.add(q.id);

    if (q.type === "mcq") {
      if (!q.right.text.trim()) errors.push(`[${q.id}] Missing RIGHT ANSWER`);
      if (1 + q.wrongs.length < 2) errors.push(`[${q.id}] Only ${1 + q.wrongs.length} choice(s)`);

      const allTexts = [q.right.text, ...q.wrongs.map((w) => w.text)];
      const seen = new Map<string, number>();
      for (let i = 0; i < allTexts.length; i++) {
        const key = allTexts[i]!.toLowerCase().trim();
        if (seen.has(key)) errors.push(`[${q.id}] Duplicate choice "${allTexts[i]}"`);
        seen.set(key, i);
      }

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
          errors.push(`[${q.id}] ${members.length} choices from family "${family}": ${members.join(", ")}`);
        }
      }
    } else {
      if (!q.right.text.trim()) errors.push(`[${q.id}] Missing RIGHT ANSWER`);
      if (!q.phrase.trim()) errors.push(`[${q.id}] Empty PHRASE`);
      if (q.wrongs.length < 4) {
        errors.push(`[${q.id}] INPUT must have at least 4 wrong answers, found ${q.wrongs.length}`);
      }

      const seen = new Map<string, number>();
      for (let i = 0; i < q.wrongs.length; i++) {
        const key = q.wrongs[i]!.text.toLowerCase().trim();
        if (seen.has(key)) errors.push(`[${q.id}] Duplicate wrong answer "${q.wrongs[i]!.text}"`);
        seen.set(key, i);
        if (key === q.right.text.toLowerCase().trim()) {
          errors.push(`[${q.id}] Wrong answer matches correct answer: "${q.wrongs[i]!.text}"`);
        }
      }
    }
  }

  return errors;
}

// ============================================================
// TypeScript code generator
// ============================================================

function esc(s: string): string {
  // Escape for use inside double-quoted JS strings
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderMcq(q: ParsedMcqQuestion, generatedBy: string, indent = "    "): string {
  const i2 = indent + "  ";
  const choices = [
    `${i2}  { text: "${esc(q.right.text)}", correct: true, explanation: "${esc(q.right.explanation)}" }`,
    ...q.wrongs.map(
      (w) => `${i2}  { text: "${esc(w.text)}", correct: false, explanation: "${esc(w.explanation)}" }`,
    ),
  ].join(",\n");

  return [
    `${indent}{`,
    `${i2}id: "${q.id}",`,
    `${i2}type: "mcq",`,
    `${i2}ruleId: "${q.ruleId}",`,
    `${i2}generatedBy: "${esc(generatedBy)}",`,
    `${i2}prompt: "${esc(q.prompt)}",`,
    `${i2}choices: [`,
    choices + ",",
    `${i2}],`,
    `${indent}}`,
  ].join("\n");
}

function renderInput(q: ParsedInputQuestion, generatedBy: string, indent = "    "): string {
  const i2 = indent + "  ";
  // Strip a literal "Instruction : " prefix the AI may have included verbatim from the template
  const instruction = q.prompt.replace(/^Instruction\s*:\s*/i, "").trim();
  const wrongAnswers = q.wrongs
    .map((w) => `${i2}  { text: "${esc(w.text)}", explanation: "${esc(w.explanation)}" }`)
    .join(",\n");

  return [
    `${indent}{`,
    `${i2}id: "${q.id}",`,
    `${i2}type: "input",`,
    `${i2}ruleId: "${q.ruleId}",`,
    `${i2}generatedBy: "${esc(generatedBy)}",`,
    `${i2}prompt: "${esc(instruction)}",`,
    `${i2}phrase: "${esc(q.phrase)}",`,
    `${i2}answer: "${esc(q.right.text)}",`,
    `${i2}explanation: "${esc(q.right.explanation)}",`,
    `${i2}wrongAnswers: [`,
    wrongAnswers + ",",
    `${i2}],`,
    `${indent}}`,
  ].join("\n");
}

function generateSectionTs(
  sectionId: string,
  sectionTitle: string,
  sectionDesc: string,
  files: { path: string; parsed: ParsedFile }[],
): string {
  const rules = files
    .map(({ parsed: p }) => `    { id: "${p.ruleId}", sectionId: "${sectionId}", title: "${esc(p.ruleTitle)}" }`)
    .join(",\n");

  const questions = files
    .flatMap(({ parsed: p }) =>
      p.questions.map((q) =>
        q.type === "mcq"
          ? renderMcq(q, p.generatedBy)
          : renderInput(q as ParsedInputQuestion, p.generatedBy),
      ),
    )
    .join(",\n");

  const totalQ = files.reduce((n, { parsed: p }) => n + p.questions.length, 0);
  const totalMcq = files.reduce((n, { parsed: p }) => n + p.questions.filter((q) => q.type === "mcq").length, 0);
  const totalInput = totalQ - totalMcq;

  return `import type { Section } from "../types";

// Generated from: ${files.map(({ path: p }) => p).join(", ")}
// Total: ${totalMcq} MCQ + ${totalInput} INPUT = ${totalQ} questions

const section: Section = {
  id: "${sectionId}",
  title: "${esc(sectionTitle)}",
  description: "${esc(sectionDesc)}",
  rules: [
${rules},
  ],
  questions: [
${questions},
  ],
};

export default section;
`;
}

// ============================================================
// CLI argument parsing
// ============================================================

function parseArgs(argv: string[]): { flags: Record<string, string>; files: string[] } {
  const args = argv.slice(2);
  const flags: Record<string, string> = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = args[++i] ?? "";
    } else {
      files.push(arg);
    }
  }

  return { flags, files };
}

// ============================================================
// Main
// ============================================================

function main() {
  const { flags, files } = parseArgs(process.argv);

  if (files.length === 0 || !flags["section-id"] || !flags["section-title"]) {
    console.error(
      [
        "Usage: npx tsx scripts/convert-txt.ts \\",
        "  --section-id <id> \\",
        "  --section-title <title> \\",
        "  --section-desc <description> \\",
        "  [--output <path>] \\",
        "  <rule1.txt> [<rule2.txt> ...]",
        "",
        "Example:",
        "  npx tsx scripts/convert-txt.ts \\",
        '    --section-id "01-present-indicatif" \\',
        '    --section-title "Le présent de l\'indicatif" \\',
        '    --section-desc "Formation et emplois du présent de l\'indicatif" \\',
        "    --output src/data/sections/01-present-indicatif.ts \\",
        "    01-01.txt 01-02.txt",
      ].join("\n"),
    );
    process.exit(1);
  }

  const sectionId = flags["section-id"]!;
  const sectionTitle = flags["section-title"]!;
  const sectionDesc = flags["section-desc"] ?? "";
  const outputPath = flags["output"];

  // Parse all files
  const parsed = files.map((path) => {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      console.error(`ERROR: Cannot read file "${path}"`);
      process.exit(1);
    }
    return { path, parsed: parseTxtFile(content) };
  });

  // Validate — abort if any errors
  let hadErrors = false;
  for (const { path, parsed: p } of parsed) {
    const errors = collectErrors(p);
    if (errors.length > 0) {
      console.error(`\nValidation errors in ${path}:`);
      for (const e of errors) console.error(`  ${e}`);
      hadErrors = true;
    }
  }
  if (hadErrors) {
    console.error("\nFix validation errors before converting. Run validate-txt for details.");
    process.exit(1);
  }

  // Generate TypeScript
  const output = generateSectionTs(sectionId, sectionTitle, sectionDesc, parsed);

  if (outputPath) {
    writeFileSync(outputPath, output, "utf-8");
    const totalQ = parsed.reduce((n, { parsed: p }) => n + p.questions.length, 0);
    console.log(`✓ Written ${totalQ} questions to ${outputPath}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Add the section to src/data/sections-index.ts`);
    console.log(`  2. Import and register it in src/pages/quiz/[sectionId].tsx`);
  } else {
    process.stdout.write(output);
  }
}

main();
