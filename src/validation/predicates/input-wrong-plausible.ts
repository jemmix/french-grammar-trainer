import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const inputWrongPlausiblePredicate: LLMPredicate = {
  id: "input-wrong-plausible",
  category: "pedagogical",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = ctx.lang === "fr" ? "French" : "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    const wrongAnswersText = q.wrongAnswers.map((w, i) => {
      return (i + 1) + ". " + w.text;
    }).join("\n");

    return {
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that wrong answers provided for input questions are PLAUSIBLE MISTAKES that learners might actually make.\n\nA plausible wrong answer is one that:\n- A learner could reasonably type based on misunderstanding the grammar rule\n- Represents a common error (wrong conjugation, wrong article, wrong agreement, etc.)\n- Is NOT a random word or nonsensical input\n- Is NOT so obviously wrong that no learner would ever type it\n\nRespond with exactly one word: PLAUSIBLE or IMPLAUSIBLE.\n\n- PLAUSIBLE: All wrong answers are reasonable mistakes a learner might make\n- IMPLAUSIBLE: At least one wrong answer is not a plausible learner error (too random, too obvious, or nonsensical)\n\nYour response must contain ONLY one of these two words in all caps. No explanation.",
      userPrompt: "Question context:\nRULE: " + ctx.rule.title + "\nPROMPT: " + q.prompt + "\nPHRASE: " + phrase + "\nCORRECT ANSWER: " + q.answer + "\n\nWRONG ANSWERS to evaluate:\n" + wrongAnswersText + "\n\nAre these wrong answers plausible mistakes that learners might make?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const verdict = parseVerdict(rawResponse);

    if (verdict === "TRUE" || rawResponse.trim().toUpperCase() === "PLAUSIBLE") {
      return { status: "pass" };
    }
    if (verdict === "FALSE" || rawResponse.trim().toUpperCase() === "IMPLAUSIBLE") {
      return { status: "fail", reason: "Wrong answers contain implausible options" };
    }
    const cleaned = rawResponse.trim().toUpperCase();
    if (cleaned.includes("PLAUSIBLE") && !cleaned.includes("IMPLAUSIBLE")) {
      return { status: "pass" };
    }
    if (cleaned.includes("IMPLAUSIBLE")) {
      return { status: "fail", reason: "Wrong answers contain implausible options" };
    }
    return { status: "invalid", reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
