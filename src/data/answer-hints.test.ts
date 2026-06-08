import { describe, it, expect } from "vitest";
import type { Section, InputQuestion } from "../../src/data/types";

const HINT_EXCEPTIONS = new Set<string>([
  "—",
  "drink",
  "run",
  "sing",
  "swim",
  "walk",
  "work",
  "write",
]);

async function loadSections(lang: string): Promise<Section[]> {
  const { loadedSections } = await import(`../../src/data/${lang}/index.ts`);
  return loadedSections;
}

async function loadAnswerHints(lang: string): Promise<Record<string, string>> {
  const { answerHints } = await import(`../../src/data/${lang}/answer-hints.ts`);
  return answerHints;
}

for (const lang of ["fr", "en", "de"] as const) {
  describe(`Answer hints: ${lang}`, async () => {
    const sections = await loadSections(lang);
    const answerHints = await loadAnswerHints(lang);

    const inputQuestions: InputQuestion[] = sections.flatMap((s) =>
      s.questions.filter((q): q is InputQuestion => q.type === "input")
    );

    it(`all input question answers have entries in the dictionary`, () => {
      const missing: string[] = [];
      for (const q of inputQuestions) {
        if (HINT_EXCEPTIONS.has(q.answer)) {
          continue;
        }
        if (!(q.answer in answerHints)) {
          missing.push(q.answer);
        }
      }
      expect(missing, `Missing answers in dictionary: ${[...new Set(missing)].join(", ")}`).toHaveLength(0);
    });

    it(`all input question hints match the dictionary`, () => {
      const mismatches: string[] = [];
      for (const q of inputQuestions) {
        if (HINT_EXCEPTIONS.has(q.answer)) {
          continue;
        }
        const expectedHint = answerHints[q.answer];
        if (expectedHint === undefined) {
          continue;
        }
        if (expectedHint !== q.hint) {
          mismatches.push(`"${q.answer}" in ${q.id}: expected "${expectedHint}", got "${q.hint}"`);
        }
      }
      expect(mismatches, `Hint mismatches:\n${mismatches.slice(0, 10).join("\n")}${mismatches.length > 10 ? `\n... and ${mismatches.length - 10} more` : ""}`).toHaveLength(0);
    });
  });
}
