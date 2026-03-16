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
    const choicesText = question.choices.map((c, i) => {
      const marker = c.correct ? " [MARKED CORRECT]" : "";
      return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
    }).join("\n");

    return {
      systemPrompt: "You are a " + lang + " grammar verifier. Given a multiple choice question with one answer marked as correct, verify if that answer is indeed the correct choice.\n\nRespond with exactly one word: TRUE, FALSE, or UNCLEAR.\n\n- TRUE if the marked-correct answer is indeed the correct/best answer\n- FALSE if the marked-correct answer is wrong (another option is correct)\n- UNCLEAR if multiple answers could be correct or the question is ambiguous\n\nYour response must contain ONLY one of these three words in all caps. No explanation.",
      userPrompt: "Question: " + ctx.question.prompt + "\n\nChoices:\n" + choicesText,
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
