import type { StructuralPredicate, QuestionContext, PredicateResult } from "../types";
import type { InputQuestion, MultipleChoiceQuestion } from "../../data/types";

export const sentenceInitialCapPredicate: StructuralPredicate = {
  id: "sentence-initial-capitalization",
  category: "structural",

  check(ctx: QuestionContext): PredicateResult {
    if (ctx.question.type === "input") {
      return checkInput(ctx as { question: InputQuestion } & QuestionContext);
    }

    if (ctx.question.type === "mcq") {
      return checkMcq(ctx as { question: MultipleChoiceQuestion } & QuestionContext);
    }

    return { status: "pass" };
  },
};

function checkInput(ctx: { question: InputQuestion } & QuestionContext): PredicateResult {
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
}

function checkMcq(ctx: { question: MultipleChoiceQuestion } & QuestionContext): PredicateResult {
  const prompt = ctx.question.prompt;
  const blankIdx = prompt.indexOf("___");
  if (blankIdx === -1) return { status: "pass" };

  const beforeBlank = prompt.substring(0, blankIdx).trimEnd();

  if (beforeBlank.length > 0) {
    const lastChar = beforeBlank[beforeBlank.length - 1]!;
    const isSentenceBoundary = /[.!?„"'«"]/.test(lastChar);
    if (!isSentenceBoundary) return { status: "pass" };
  }

  const failures: string[] = [];
  for (const choice of ctx.question.choices) {
    const firstLetter = choice.text.match(/[a-zA-ZÀ-ÿ]/);
    if (firstLetter && firstLetter[0] !== firstLetter[0].toUpperCase()) {
      failures.push(choice.text);
    }
  }

  if (failures.length > 0) {
    return {
      status: "fail",
      reason: `Choices ${failures.map((f) => `"${f}"`).join(", ")} should start with a capital letter (blank is at the start of a sentence)`,
    };
  }

  return { status: "pass" };
}
