import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "~/content/types";
import { LANG_NAMES } from "../constants";

export const inputWrongPlausiblePredicate: LLMPredicate = {
  id: "input-wrong-plausible",
  category: "pedagogical",
  phase: 2,

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = LANG_NAMES[ctx.lang] ?? "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    const wrongAnswersText = q.wrongAnswers.map((w, i) => {
      return (i + 1) + ". " + w.text;
    }).join("\n");

    return {
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that wrong answers provided for input questions are PLAUSIBLE MISTAKES that learners might actually make.\n\nA plausible wrong answer is one that:\n- A learner could reasonably type based on misunderstanding the grammar rule\n- Represents a common error (wrong conjugation, wrong article, wrong agreement, etc.)\n- Is NOT a random word or nonsensical input\n- Is NOT so obviously wrong that no learner would ever type it\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <PLAUSIBLE|IMPLAUSIBLE>\nREASON: <one sentence explaining why>\n\n- PLAUSIBLE: All wrong answers are reasonable mistakes a learner might make\n- IMPLAUSIBLE: At least one wrong answer is not a plausible learner error (too random, too obvious, or nonsensical)",
      userPrompt: "Question context:\nRULE: " + ctx.rule.title + "\nPROMPT: " + q.prompt + "\nPHRASE: " + phrase + "\nCORRECT ANSWER: " + q.answer + "\n\nWRONG ANSWERS to evaluate:\n" + wrongAnswersText + "\n\nAre these wrong answers plausible mistakes that learners might make?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(PLAUSIBLE|IMPLAUSIBLE)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: PLAUSIBLE|IMPLAUSIBLE, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "PLAUSIBLE") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "Wrong answers contain implausible options" };
  },
};
