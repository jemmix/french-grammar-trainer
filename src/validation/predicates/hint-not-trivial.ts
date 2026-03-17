import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import type { InputQuestion } from "../../data/types";

function extractWords(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  return normalized.split(/\s+/).filter((w) => w.length > 0);
}

function isWordSubsequence(answerWords: string[], sourceWords: string[]): boolean {
  return answerWords.some((aw) => sourceWords.some((sw) => sw.includes(aw)));
}

export const hintNotTrivialPredicate: StructuralPredicate = {
  id: "hint-not-trivial",
  category: "language",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.question.type !== "input") {
      return { pass: true };
    }

    const q = ctx.question as InputQuestion;

    const answerWords = extractWords(q.answer);

    if (answerWords.length === 0) {
      return { pass: true };
    }

    const questionText = [
      q.prompt,
      q.phrase.before,
      q.phrase.after,
    ].join(" ");
    const questionWords = extractWords(questionText);
    const hintWords = extractWords(q.hint);

    if (isWordSubsequence(answerWords, questionWords)) {
      return {
        pass: false,
        reason: 'Answer "' + q.answer + '" appears in the question text',
      };
    }

    if (isWordSubsequence(answerWords, hintWords)) {
      return {
        pass: false,
        reason: 'Answer "' + q.answer + '" appears in the hint',
      };
    }

    return { pass: true };
  },
};
