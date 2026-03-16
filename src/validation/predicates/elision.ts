import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import { checkQuestionElision } from "../../lib/elision-check";

export const elisionPredicate: StructuralPredicate = {
  id: "elision-correct",
  category: "language",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.lang !== "fr") {
      return { pass: true, reason: "Elision check only applies to French" };
    }

    const questionLike = {
      id: ctx.question.id,
      prompt: ctx.question.prompt,
      type: ctx.question.type,
      phrase: ctx.question.type === "input" ? ctx.question.phrase.before + " ___ " + ctx.question.phrase.after : undefined,
      right: { text: ctx.question.type === "mcq" ? ctx.question.choices.find(c => c.correct)?.text ?? "" : ctx.question.answer },
      wrongs: ctx.question.type === "mcq" 
        ? ctx.question.choices.filter(c => !c.correct).map(c => ({ text: c.text }))
        : ctx.question.wrongAnswers.map(w => ({ text: w.text })),
    };

    const issues = checkQuestionElision(questionLike);
    if (issues.length === 0) {
      return { pass: true };
    }
    return {
      pass: false,
      reason: issues.map(i => i.message).join("; "),
    };
  },
};
