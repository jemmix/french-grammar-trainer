import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import type { InputQuestion } from "../../data/types";

function extractWords(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  return normalized.split(/\s+/).filter((w) => w.length > 0);
}

function isConsecutiveSubsequence(answerWords: string[], sourceWords: string[]): boolean {
  if (answerWords.length === 0) return true;
  if (answerWords.length > sourceWords.length) return false;
  for (let i = 0; i <= sourceWords.length - answerWords.length; i++) {
    let match = true;
    for (let j = 0; j < answerWords.length; j++) {
      if (sourceWords[i + j] !== answerWords[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
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

    if (isConsecutiveSubsequence(answerWords, questionWords)) {
      return {
        pass: false,
        reason: 'Answer "' + q.answer + '" appears in the question text',
      };
    }

    if (isConsecutiveSubsequence(answerWords, hintWords)) {
      return {
        pass: false,
        reason: 'Answer "' + q.answer + '" appears in the hint',
      };
    }

    return { pass: true };
  },
};
