import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const mcqCorrectIsTruePredicate: LLMPredicate = {
  id: "mcq-correct-is-true",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "mcq";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const question = ctx.question as MultipleChoiceQuestion;
    const correctChoice = question.choices.find((c) => c.correct);
    if (!correctChoice) {
      throw new Error("No correct choice found");
    }

    const lang = ctx.lang === "fr" ? "French" : "English";

    return {
      systemPrompt: "You are a " + lang + " grammar verifier. Given a question and a proposed answer, respond with exactly one word: TRUE, FALSE, or UNCLEAR.\n\n- TRUE if the answer correctly answers the question\n- FALSE if the answer is incorrect\n- UNCLEAR if there is genuinely no way to determine correctness\n\nYour response must contain ONLY one of these three words in all caps. No explanation.",
      userPrompt: "Question: " + ctx.question.prompt + "\n\nProposed answer: " + correctChoice.text,
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const verdict = parseVerdict(rawResponse);

    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "LLM says correct answer is FALSE" };
    }
    if (verdict === "UNCLEAR") {
      return { pass: false, reason: "LLM says answer is UNCLEAR - may need review" };
    }
    return { pass: false, reason: `Failed to parse LLM response: ${rawResponse.slice(0, 100)}` };
  },
};
