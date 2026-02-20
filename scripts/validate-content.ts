/**
 * Validates question content for quality issues:
 * - Exact duplicate choice texts within a question
 * - Near-duplicate choices (multiple forms of the same determiner family)
 * - Questions with fewer than 2 choices
 * - Questions with no correct answer
 * - Questions with multiple correct answers
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

interface Question {
  id: string;
  ruleId: string;
  prompt: string;
  choices: Choice[];
}

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

async function validateSection(section: Section) {
  console.log(`\nSection: ${section.title} (${section.questions.length} questions)`);

  for (const q of section.questions) {
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
}

async function main() {
  const sectionsDir = join(import.meta.dirname ?? ".", "..", "src", "data", "sections");
  const files = readdirSync(sectionsDir).filter((f) => f.endsWith(".ts"));

  console.log(`Found ${files.length} section file(s) to validate`);

  for (const file of files) {
    const mod = (await import(join(sectionsDir, file))) as { default: Section };
    await validateSection(mod.default);
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
