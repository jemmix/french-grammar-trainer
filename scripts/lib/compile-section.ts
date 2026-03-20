/**
 * Shared compilation logic for converting DSL question files to TypeScript.
 *
 * Used by:
 * - scripts/convert-txt.ts (CLI tool for compiling individual sections)
 * - scripts/lib/compile-section.test.ts (unit test for freshness checking)
 */

import { parseTxtFile, type ParsedFile, type ParsedMcqQuestion, type ParsedInputQuestion } from "./parse-txt";

export interface CompiledSection {
  tsCode: string;
  ruleIds: string[];
  questionCount: number;
  mcqCount: number;
  inputCount: number;
}

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

export function collectValidationErrors(parsed: ParsedFile): string[] {
  const errors: string[] = [...parsed.parseErrors];

  if (!parsed.ruleId) errors.push("Missing RULE header");

  for (const q of parsed.questions) {
    const parts = q.id.split("-");
    const qRuleId = parts.length >= 3 ? `${parts[0]!}-${parts[1]!}` : q.id;
    if (qRuleId !== parsed.ruleId) {
      errors.push(
        `[${q.id}] Question ID prefix "${qRuleId}" doesn't match file's rule ID "${parsed.ruleId}". ` +
        `Pass individual rule files to convert-txt, not a merged section file.`,
      );
    }
  }

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

function esc(s: string): string {
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

function stripPhraseDelimiters(s: string): string {
  return s
    .replace(/^«\s*/, "").replace(/\s*»$/, "")
    .replace(/^[\u201c"]\s*/, "").replace(/\s*[\u201d"]$/, "");
}

function renderInput(q: ParsedInputQuestion, generatedBy: string, indent = "    "): string {
  const i2 = indent + "  ";
  const instruction = q.prompt.replace(/^Instruction\s*:\s*/i, "").trim();
  const wrongAnswers = q.wrongs
    .map((w) => `${i2}  { text: "${esc(w.text)}", explanation: "${esc(w.explanation)}" }`)
    .join(",\n");

  const stripped = stripPhraseDelimiters(q.phrase);
  const splitIdx = stripped.indexOf("___");
  const before = splitIdx === -1 ? stripped : stripped.slice(0, splitIdx);
  const after = splitIdx === -1 ? "" : stripped.slice(splitIdx + 3);

  return [
    `${indent}{`,
    `${i2}id: "${q.id}",`,
    `${i2}type: "input",`,
    `${i2}ruleId: "${q.ruleId}",`,
    `${i2}generatedBy: "${esc(generatedBy)}",`,
    `${i2}prompt: "${esc(instruction)}",`,
    `${i2}phrase: { before: "${esc(before)}", after: "${esc(after)}" },`,
    `${i2}hint: "${esc(q.hint)}",`,
    `${i2}answer: "${esc(q.right.text)}",`,
    `${i2}explanation: "${esc(q.right.explanation)}",`,
    `${i2}wrongAnswers: [`,
    wrongAnswers + ",",
    `${i2}],`,
    `${indent}}`,
  ].join("\n");
}

export interface SectionMeta {
  sectionId: string;
  sectionTitle: string;
  sectionDesc: string;
}

export interface ParsedRuleFile {
  path: string;
  parsed: ParsedFile;
}

export function compileSectionToTs(
  meta: SectionMeta,
  files: ParsedRuleFile[],
): CompiledSection {
  const rules = files
    .map(({ parsed: p }) => `    { id: "${p.ruleId}", sectionId: "${meta.sectionId}", title: "${esc(p.ruleTitle)}" }`)
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

  const tsCode = `import type { Section } from "../types";

// =============================================================================
// AUTO-GENERATED FILE — DO NOT EDIT
// This file is compiled from DSL sources. Any manual changes will be lost.
// To regenerate: npm run compile-all -- --lang <fr|en>
// =============================================================================
// Source files: ${files.map(({ path: p }) => p).join(", ")}
// Total: ${totalMcq} MCQ + ${totalInput} INPUT = ${totalQ} questions

const section: Section = {
  id: "${meta.sectionId}",
  title: "${esc(meta.sectionTitle)}",
  description: "${esc(meta.sectionDesc)}",
  rules: [
${rules},
  ],
  questions: [
${questions},
  ],
};

export default section;
`;

  return {
    tsCode,
    ruleIds: files.map(({ parsed: p }) => p.ruleId),
    questionCount: totalQ,
    mcqCount: totalMcq,
    inputCount: totalInput,
  };
}

export { parseTxtFile };
export type { ParsedFile };
