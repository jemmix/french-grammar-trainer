import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Section, InputQuestion } from "../src/data/types";

function extractAnswerHints(sections: Section[]): Map<string, string> {
  const answerHints = new Map<string, string>();
  const conflicts: string[] = [];

  for (const section of sections) {
    for (const q of section.questions) {
      if (q.type === "input") {
        const inputQ = q as InputQuestion;
        const existing = answerHints.get(inputQ.answer);
        if (existing === undefined) {
          answerHints.set(inputQ.answer, inputQ.hint);
        } else if (existing !== inputQ.hint) {
          conflicts.push(`"${inputQ.answer}" in ${q.id}: "${inputQ.hint}" conflicts with "${existing}"`);
        }
      }
    }
  }

  if (conflicts.length > 0) {
    console.warn(`Hint conflicts for ${conflicts.length} answers:`);
    for (const c of conflicts.slice(0, 20)) {
      console.warn(`  ${c}`);
    }
    if (conflicts.length > 20) {
      console.warn(`  ... and ${conflicts.length - 20} more`);
    }
  }

  return answerHints;
}

function generateDictionaryFile(lang: string, answerHints: Map<string, string>): string {
  const entries = Array.from(answerHints.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  const lines = [
    `// Answer-to-hint dictionary for ${lang.toUpperCase()}`,
    `// Hints follow these rules:`,
    `// - Verbs: dictionary form (infinitive)`,
    `// - "t" ending: "pronunciation" (contracted form marker)`,
    `// - Other words: word type in ${lang === "fr" ? "French" : "English"} (pronom, adjectif, connecteur, etc.)`,
    ``,
    `export const answerHints: Record<string, string> = {`,
  ];

  for (const [answer, hint] of entries) {
    lines.push(`  "${escapeString(answer)}": "${escapeString(hint)}",`);
  }

  lines.push(`};`);
  lines.push(``);
  lines.push(`export type AnswerHintKey = keyof typeof answerHints;`);

  return lines.join("\n");
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

async function main() {
  const lang = process.argv[2];

  if (!lang || !["fr", "en", "de"].includes(lang)) {
    console.error("Usage: npx tsx scripts/extract-answer-hints.ts <fr|en|de>");
    process.exit(1);
  }

  const { loadedSections } = await import(`../src/data/${lang}/index.ts`);

  const answerHints = extractAnswerHints(loadedSections);
  console.log(`Extracted ${answerHints.size} unique answers for ${lang}`);

  const outputDir = join(process.cwd(), "src", "data", lang);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const content = generateDictionaryFile(lang, answerHints);
  const outputPath = join(outputDir, "answer-hints.ts");
  writeFileSync(outputPath, content);
  console.log(`Written to ${outputPath}`);
}

main();
