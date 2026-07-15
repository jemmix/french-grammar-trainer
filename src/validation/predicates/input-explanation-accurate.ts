import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "~/content/types";
import { LANG_NAMES } from "../constants";

export const inputExplanationAccuratePredicate: LLMPredicate = {
  id: "input-explanation-accurate",
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
      return "Wrong answer: \"" + w.text + "\"\nExplanation: \"" + w.explanation + "\"";
    }).join("\n\n");

    return {
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that the explanations for wrong answers are ACCURATE and EDUCATIONALLY SOUND.\n\nAn accurate explanation:\n- Correctly identifies WHY the answer is wrong\n- References the relevant grammar rule or concept\n- Does NOT contain factual errors about the language\n- Helps the learner understand their mistake\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <ACCURATE|INACCURATE>\nREASON: <one sentence explaining why>\n\n- ACCURATE: All explanations correctly explain why each wrong answer is wrong\n- INACCURATE: At least one explanation contains a factual error or misleads the learner",
      userPrompt: "Question context:\nRULE: " + ctx.rule.title + "\nPROMPT: " + q.prompt + "\nPHRASE: " + phrase + "\nCORRECT ANSWER: " + q.answer + "\n\nWRONG ANSWERS AND THEIR EXPLANATIONS:\n" + wrongAnswersText + "\n\nAre these explanations accurate?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(ACCURATE|INACCURATE)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: ACCURATE|INACCURATE, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "ACCURATE") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "At least one wrong answer explanation is inaccurate" };
  },
};
