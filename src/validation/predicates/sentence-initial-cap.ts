import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";

export const sentenceInitialCapPredicate: StructuralPredicate = {
  id: "sentence-initial-capitalization",
  category: "structural",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.question.type !== "input") {
      return { status: "pass" };
    }

    const { before } = ctx.question.phrase;
    if (/[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(before)) {
      return { status: "pass" };
    }

    const answer = ctx.question.answer;
    const firstLetter = answer.match(/[a-zA-ZÀ-ÿ]/);
    if (!firstLetter) {
      return { status: "pass" };
    }

    if (firstLetter[0] !== firstLetter[0].toUpperCase()) {
      return {
        status: "fail",
        reason: `Answer "${answer}" should start with a capital letter (blank is at the start of a sentence)`,
      };
    }

    return { status: "pass" };
  },
};
