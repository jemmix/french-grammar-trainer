import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion } from "../../data/types";

export const mcqWrongIsFalsePredicate: LLMPredicate = {
  id: "mcq-wrong-is-false",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "mcq";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as MultipleChoiceQuestion;
    const wrongChoices = q.choices.filter((c) => !c.correct);
    const lang = ctx.lang === "fr" ? "French" : "English";

    const choicesText = q.choices.map((c, i) => {
      const marker = c.correct ? " [CORRECT]" : " [WRONG]";
      return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
    }).join("\n");

    const wrongList = wrongChoices.map((c) => c.text).join(", ");

    return {
      systemPrompt: "You are a " + lang + " grammar verifier. Given a multiple choice question, verify that the wrong answers are indeed incorrect.\n\nRespond with exactly one word: TRUE, FALSE, or UNCLEAR.\n\n- TRUE if all the wrong answers are actually incorrect for this question\n- FALSE if any wrong answer could be correct (or is arguably correct)\n- UNCLEAR if the question is ambiguous\n\nYour response must contain ONLY one of these three words in all caps. No explanation.",
      userPrompt: "Question: " + q.prompt + "\n\nChoices:\n" + choicesText + "\n\nVerify these WRONG answers are incorrect: " + wrongList,
    };
  },

  interpretResponse(ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim().toUpperCase();
    if (cleaned === "TRUE") {
      return { status: "pass" };
    } else if (cleaned === "FALSE") {
      return { status: "fail", reason: "At least one wrong answer may be correct" };
    } else if (cleaned === "UNCLEAR") {
      return { status: "fail", reason: "Question is ambiguous" };
    }
    return { status: "invalid", reason: "Unexpected response: " + rawResponse };
  },
};
