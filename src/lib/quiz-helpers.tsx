import type { JSX } from "react";
import type { InputQuestion } from "~/data/types";

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

/** Replaces runs of 2+ underscores with a styled inline blank element. */
export function renderWithBlanks(text: string): (string | JSX.Element)[] {
  return text.split(/(_{2,})/).map((part, i) =>
    /^_{2,}$/.test(part) ? (
      <span
        key={i}
        className="inline-block min-w-[4.5ch] mx-0.5 px-2 py-0.5 align-baseline rounded-[3px] bg-tricolore-bleu/[.07] border-b-2 border-tricolore-bleu/40"
        aria-label="blanc"
      />
    ) : part
  );
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
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

/** Extract before/after blank from a phrase like "« Je ___ avec mes amis. »"
 *  Accepts any run of 2+ underscores as the placeholder. */
export function parsePhrase(phrase: string): { before: string; after: string } {
  const content = phrase.replace(/^«\s*/, "").replace(/\s*»$/, "");
  const match = content.match(/_{2,}/);
  if (!match || match.index === undefined) return { before: content, after: "" };
  return {
    before: content.slice(0, match.index),
    after: content.slice(match.index + match[0]!.length),
  };
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
