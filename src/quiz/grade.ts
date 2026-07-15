import type { InputQuestion } from "~/content/types";

export const QUESTIONS_PER_QUIZ = 20;

export type InputResultKind =
  | "exact"          // correct, exact match
  | "case-warning"   // correct but wrong case
  | "wrong-prepared" // matches a prepared wrong answer
  | "typo-correct"   // typo of the correct answer
  | "typo-wrong"     // typo of a prepared wrong answer
  | "unknown";       // no match at all

export interface InputResult {
  kind: InputResultKind;
  isCorrect: boolean;
  matchedAnswer?: string;
  explanation?: string;
  wrongExplanation?: string;
}

// Levenshtein distance — only need to check if distance is exactly 1
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2; // early exit — can't be distance 1

  const prev = Array.from({ length: lb + 1 }, (_, i) => i);
  const curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j]!;
  }
  return prev[lb]!;
}


export function evaluateInput(userInput: string, question: InputQuestion): InputResult {
  const trimmed = userInput.trim();
  const answer = question.answer;

  // 1. Exact match
  if (trimmed === answer) {
    return { kind: "exact", isCorrect: true };
  }

  // 2. Case-insensitive correct
  if (trimmed.toLowerCase() === answer.toLowerCase()) {
    return { kind: "case-warning", isCorrect: true, matchedAnswer: answer };
  }

  // 3. Exact match against prepared wrong answers (case-insensitive)
  for (const wrong of question.wrongAnswers) {
    if (trimmed.toLowerCase() === wrong.text.toLowerCase()) {
      return {
        kind: "wrong-prepared",
        isCorrect: false,
        matchedAnswer: wrong.text,
        wrongExplanation: wrong.explanation,
      };
    }
  }

  // 4. Typo of correct answer (Levenshtein distance 1, case-insensitive)
  if (levenshteinDistance(trimmed.toLowerCase(), answer.toLowerCase()) === 1) {
    return {
      kind: "typo-correct",
      isCorrect: false,
      matchedAnswer: answer,
    };
  }

  // 5. Typo of a prepared wrong answer (Levenshtein distance 1, case-insensitive)
  for (const wrong of question.wrongAnswers) {
    if (levenshteinDistance(trimmed.toLowerCase(), wrong.text.toLowerCase()) === 1) {
      return {
        kind: "typo-wrong",
        isCorrect: false,
        matchedAnswer: wrong.text,
        wrongExplanation: wrong.explanation,
      };
    }
  }

  // 6. No match
  return { kind: "unknown", isCorrect: false };
}
