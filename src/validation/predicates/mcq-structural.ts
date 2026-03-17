import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import type { MultipleChoiceQuestion } from "../../data/types";

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

export const mcqStructuralPredicate: StructuralPredicate = {
  id: "mcq-structural",
  category: "structural",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.question.type !== "mcq") {
      return { pass: true };
    }

    const q = ctx.question as MultipleChoiceQuestion;
    const errors: string[] = [];

    if (q.choices.length < 2) {
      errors.push("Only " + q.choices.length + " choice(s) — need at least 2");
    }

    const correctCount = q.choices.filter((c) => c.correct).length;
    if (correctCount === 0) {
      errors.push("No correct answer marked");
    } else if (correctCount > 1) {
      errors.push(correctCount + " correct answers marked — should be exactly 1");
    }

    const seen = new Map<string, number>();
    for (let i = 0; i < q.choices.length; i++) {
      const normalized = q.choices[i]!.text.toLowerCase().trim();
      if (seen.has(normalized)) {
        errors.push('Duplicate choice: "' + q.choices[i]!.text + '"');
        break;
      }
      seen.set(normalized, i);
    }

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
        errors.push(members.length + ' choices from same determiner family "' + family + '": ' + members.join(", ") + " — max 2 allowed");
      }
    }

    if (errors.length > 0) {
      return { pass: false, reason: errors.join("; ") };
    }
    return { pass: true };
  },
};
