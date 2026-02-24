/**
 * Validates question content for quality issues:
 *
 * MCQ questions:
 * - Exact duplicate choice texts within a question
 * - Near-duplicate choices (multiple forms of the same determiner family)
 * - Questions with fewer than 2 choices
 * - Questions with no correct answer
 * - Questions with multiple correct answers
 *
 * Input questions:
 * - Missing or empty answer
 * - Missing or empty explanation
 * - Fewer than 2 wrong answers
 * - Duplicate wrong answers
 * - Empty wrong answer explanations
 *
 * Run: npx tsx scripts/validate-content.ts
 * Or:  npm run validate-content
 */

import { readdirSync } from "fs";
import { join } from "path";

// Determiner families — choices from the same family are near-duplicates
// unless the question specifically tests within-family distinctions
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

function getFamilies(choiceText: string): string[] {
  const normalized = choiceText.toLowerCase().trim();
  const families: string[] = [];
  for (const [family, members] of Object.entries(DETERMINER_FAMILIES)) {
    if (members.includes(normalized)) {
      families.push(family);
    }
  }
  return families;
}

interface Choice {
  text: string;
  correct: boolean;
  explanation: string;
}

interface WrongAnswer {
  text: string;
  explanation: string;
}

interface McqQuestion {
  id: string;
  type: "mcq";
  ruleId: string;
  prompt: string;
  choices: Choice[];
}

interface InputQuestion {
  id: string;
  type: "input";
  ruleId: string;
  prompt: string;
  phrase: string;
  answer: string;
  explanation: string;
  wrongAnswers: WrongAnswer[];
}

type Question = McqQuestion | InputQuestion;

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

let errorCount = 0;
let warnCount = 0;

function error(questionId: string, msg: string) {
  console.error(`  ERROR [${questionId}]: ${msg}`);
  errorCount++;
}

function warn(questionId: string, msg: string) {
  console.warn(`  WARN  [${questionId}]: ${msg}`);
  warnCount++;
}

function validateMcq(q: McqQuestion) {
  // Check minimum choices
  if (q.choices.length < 2) {
    error(q.id, `Only ${q.choices.length} choice(s) — need at least 2`);
  }

  // Check correct answer count
  const correctCount = q.choices.filter((c) => c.correct).length;
  if (correctCount === 0) {
    error(q.id, "No correct answer marked");
  } else if (correctCount > 1) {
    error(q.id, `${correctCount} correct answers marked — should be exactly 1`);
  }

  // Check exact duplicates (case-insensitive)
  const seen = new Map<string, number>();
  for (let i = 0; i < q.choices.length; i++) {
    const normalized = q.choices[i]!.text.toLowerCase().trim();
    if (seen.has(normalized)) {
      error(q.id, `Exact duplicate choice: "${q.choices[i]!.text}" (indices ${seen.get(normalized)} and ${i})`);
    }
    seen.set(normalized, i);
  }

  // Check near-duplicates (same determiner family)
  const familyCounts = new Map<string, string[]>();
  for (const choice of q.choices) {
    const families = getFamilies(choice.text);
    for (const family of families) {
      const existing = familyCounts.get(family) ?? [];
      existing.push(choice.text);
      familyCounts.set(family, existing);
    }
  }
  for (const [family, members] of familyCounts) {
    if (members.length > 2) {
      error(q.id, `${members.length} choices from same family "${family}": ${members.join(", ")} — max 2 allowed`);
    }
  }

  // Check empty explanations
  for (const choice of q.choices) {
    if (!choice.explanation.trim()) {
      warn(q.id, `Empty explanation for choice "${choice.text}"`);
    }
  }
}

function validateInput(q: InputQuestion) {
  // Check phrase has exactly one placeholder (2+ consecutive underscores)
  if (!q.phrase || !q.phrase.trim()) {
    error(q.id, "Missing or empty phrase");
  } else {
    const placeholders = q.phrase.match(/_{2,}/g)?.length ?? 0;
    if (placeholders === 0) error(q.id, "phrase has no placeholder (need 2+ consecutive underscores)");
    else if (placeholders > 1) error(q.id, `phrase has ${placeholders} placeholders — must have exactly 1`);
  }

  // Check answer exists
  if (!q.answer || !q.answer.trim()) {
    error(q.id, "Missing or empty answer");
  }

  // Check explanation exists
  if (!q.explanation || !q.explanation.trim()) {
    error(q.id, "Missing or empty explanation");
  }

  // Check minimum wrong answers
  if (q.wrongAnswers.length < 2) {
    error(q.id, `Only ${q.wrongAnswers.length} wrong answer(s) — need at least 2`);
  }

  // Check for duplicate wrong answers (case-insensitive)
  const seen = new Map<string, number>();
  for (let i = 0; i < q.wrongAnswers.length; i++) {
    const normalized = q.wrongAnswers[i]!.text.toLowerCase().trim();
    if (seen.has(normalized)) {
      error(q.id, `Duplicate wrong answer: "${q.wrongAnswers[i]!.text}" (indices ${seen.get(normalized)} and ${i})`);
    }
    seen.set(normalized, i);
  }

  // Check wrong answer that matches the correct answer
  for (const wa of q.wrongAnswers) {
    if (wa.text.toLowerCase().trim() === q.answer.toLowerCase().trim()) {
      error(q.id, `Wrong answer "${wa.text}" matches the correct answer`);
    }
  }

  // Check empty wrong answer explanations
  for (const wa of q.wrongAnswers) {
    if (!wa.explanation.trim()) {
      warn(q.id, `Empty explanation for wrong answer "${wa.text}"`);
    }
  }
}

async function validateSection(section: Section, filename: string) {
  const expectedId = filename.replace(/\.ts$/, "");
  if (section.id !== expectedId) {
    error(section.id || "(missing id)", `Section id "${section.id}" does not match filename "${filename}" (expected id: "${expectedId}")`);
  }

  const mcqCount = section.questions.filter((q) => q.type === "mcq").length;
  const inputCount = section.questions.filter((q) => q.type === "input").length;
  console.log(`\nSection: ${section.title} (${section.questions.length} questions — ${mcqCount} MCQ, ${inputCount} input)`);

  for (const q of section.questions) {
    if (q.type === "mcq") {
      validateMcq(q);
    } else if (q.type === "input") {
      validateInput(q);
    } else {
      error((q as { id: string }).id, `Unknown question type: ${(q as { type: string }).type}`);
    }
  }
}

async function main() {
  const sectionsDir = join(import.meta.dirname ?? ".", "..", "src", "data", "sections");
  const files = readdirSync(sectionsDir).filter((f) => f.endsWith(".ts"));

  console.log(`Found ${files.length} section file(s) to validate`);

  for (const file of files) {
    const mod = (await import(join(sectionsDir, file))) as { default: Section };
    await validateSection(mod.default, file);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Errors: ${errorCount}, Warnings: ${warnCount}`);

  if (errorCount > 0) {
    console.log("VALIDATION FAILED");
    process.exit(1);
  } else {
    console.log("VALIDATION PASSED");
  }
}

main().catch(console.error);
