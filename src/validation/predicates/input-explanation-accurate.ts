import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const inputExplanationAccuratePredicate: LLMPredicate = {
  id: "input-explanation-accurate",
  category: "pedagogical",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = ctx.lang === "fr" ? "French" : "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    const wrongAnswersText = q.wrongAnswers.map((w, i) => {
      return "Wrong answer: \"" + w.text + "\"\nExplanation: \"" + w.explanation + "\"";
    }).join("\n\n");

    return {
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that the explanations for wrong answers are ACCURATE and EDUCATIONALLY SOUND.\n\nAn accurate explanation:\n- Correctly identifies WHY the answer is wrong\n- References the relevant grammar rule or concept\n- Does NOT contain factual errors about the language\n- Helps the learner understand their mistake\n\nRespond with exactly one word: ACCURATE or INACCURATE.\n\n- ACCURATE: All explanations correctly explain why each wrong answer is wrong\n- INACCURATE: At least one explanation contains a factual error or misleads the learner\n\nYour response must contain ONLY one of these two words in all caps. No explanation.",
      userPrompt: "Question context:\nRULE: " + ctx.rule.title + "\nPROMPT: " + q.prompt + "\nPHRASE: " + phrase + "\nCORRECT ANSWER: " + q.answer + "\n\nWRONG ANSWERS AND THEIR EXPLANATIONS:\n" + wrongAnswersText + "\n\nAre these explanations accurate?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim().toUpperCase();

    if (cleaned === "ACCURATE") {
      return { pass: true };
    }
    if (cleaned === "INACCURATE") {
      return { pass: false, reason: "At least one wrong answer explanation is inaccurate" };
    }
    if (cleaned.includes("ACCURATE") && !cleaned.includes("INACCURATE")) {
      return { pass: true };
    }
    if (cleaned.includes("INACCURATE")) {
      return { pass: false, reason: "At least one wrong answer explanation is inaccurate" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "At least one wrong answer explanation is inaccurate" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
