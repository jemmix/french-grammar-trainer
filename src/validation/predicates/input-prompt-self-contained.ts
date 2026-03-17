import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "../../data/types";

export const inputPromptSelfContainedPredicate: LLMPredicate = {
  id: "input-prompt-self-contained",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = ctx.lang === "fr" ? "French" : "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    return {
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that INPUT questions are self-contained.\n\nAn INPUT question is self-contained if the prompt + phrase together make it clear what the learner should type, without needing to see the answer.\n\nRespond with exactly one word: SELF-CONTAINED, UNCLEAR, or AMBIGUOUS.\n\n- SELF-CONTAINED: The question clearly identifies what to input (verb to conjugate, article to choose, etc.)\n- UNCLEAR: The learner cannot determine what to input from prompt + phrase alone\n- AMBIGUOUS: Multiple valid answers exist but only one is marked correct\n\nYour response must contain ONLY one of these three words in all caps. No explanation.",
      userPrompt: "PROMPT: " + q.prompt + "\n\nPHRASE: " + phrase + "\n\nEXPECTED ANSWER: " + q.answer + "\n\nIs this question self-contained? Can a learner determine what to input without seeing the answer?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim().toUpperCase();
    if (cleaned === "SELF-CONTAINED") {
      return { pass: true };
    } else if (cleaned === "UNCLEAR") {
      return { pass: false, reason: "Prompt does not clearly identify what to input" };
    } else if (cleaned === "AMBIGUOUS") {
      return { pass: false, reason: "Multiple valid answers possible" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse };
  },
};
