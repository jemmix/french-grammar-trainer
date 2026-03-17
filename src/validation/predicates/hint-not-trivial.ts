import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const hintNotTrivialPredicate: LLMPredicate = {
  id: "hint-not-trivial",
  category: "pedagogical",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = ctx.lang === "fr" ? "French" : "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    return {
      systemPrompt: "You are a " + lang + " language learning expert. Your task is to evaluate whether a hint in a fill-in-the-blank exercise is TOO REVEALING (trivial).\n\nA TRIVIAL hint (bad):\n- Directly gives away the answer (hint = answer or very close variation)\n- Makes the exercise too easy, removing the learning challenge\n- Contains the answer word with minor formatting changes\n\nAn ACCEPTABLE hint (good):\n- Provides grammatical context (e.g., \"infinitif\", \"3e personne du singulier\")\n- Gives semantic clues without revealing the exact word\n- Shows the dictionary form when it differs meaningfully from the answer\n- Helps the learner think through the problem\n\nSPECIAL CASE: In some languages, the answer IS the dictionary form (e.g., English \"I walk\" - the 1st person present equals the infinitive \"to walk\"). In these cases, showing the dictionary form as a hint is acceptable because it tests whether the learner knows this equivalence.\n\nRespond with exactly one word: GOOD or TRIVIAL.\n\n- GOOD: The hint is pedagogically appropriate\n- TRIVIAL: The hint gives away the answer too easily\n\nIf TRIVIAL, briefly explain why on the next line.",
      userPrompt: "RULE: " + ctx.rule.title + "\n\nPROMPT: " + q.prompt + "\nPHRASE: " + phrase + "\nHINT: " + q.hint + "\nCORRECT ANSWER: " + q.answer + "\n\nIs this hint pedagogically appropriate, or does it give away the answer too trivially?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");
    const firstLine = lines[0]?.trim().toUpperCase() || "";

    if (firstLine === "GOOD") {
      return { pass: true };
    }
    if (firstLine === "TRIVIAL") {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Hint is too revealing/trivial" };
    }
    if (firstLine.includes("GOOD") && !firstLine.includes("TRIVIAL")) {
      return { pass: true };
    }
    if (firstLine.includes("TRIVIAL")) {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Hint is too revealing/trivial" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Hint is too revealing/trivial" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
