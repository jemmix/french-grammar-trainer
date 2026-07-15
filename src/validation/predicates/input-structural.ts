import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import type { InputQuestion } from "~/content/types";

export const inputStructuralPredicate: StructuralPredicate = {
  id: "input-structural",
  category: "structural",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.question.type !== "input") {
      return { status: "pass" };
    }

    const q = ctx.question as InputQuestion;
    const errors: string[] = [];

    if (!q.phrase || (!q.phrase.before.trim() && !q.phrase.after.trim())) {
      errors.push("Missing or empty phrase");
    }

    if (!q.answer || !q.answer.trim()) {
      errors.push("Missing or empty answer");
    }

    if (!q.explanation || !q.explanation.trim()) {
      errors.push("Missing or empty explanation");
    }

    if (q.wrongAnswers.length < 4) {
      errors.push("Only " + q.wrongAnswers.length + " wrong answer(s) — need at least 4");
    }

    const seen = new Map<string, number>();
    for (let i = 0; i < q.wrongAnswers.length; i++) {
      const normalized = q.wrongAnswers[i]!.text.toLowerCase().trim();
      if (seen.has(normalized)) {
        errors.push('Duplicate wrong answer: "' + q.wrongAnswers[i]!.text + '"');
        break;
      }
      seen.set(normalized, i);
    }

    for (const wa of q.wrongAnswers) {
      if (wa.text.toLowerCase().trim() === q.answer.toLowerCase().trim()) {
        errors.push('Wrong answer "' + wa.text + '" matches the correct answer');
        break;
      }
    }

    if (errors.length > 0) {
      return { status: "fail", reason: errors.join("; ") };
    }
    return { status: "pass" };
  },
};
