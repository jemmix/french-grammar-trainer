import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "~/content/types";
import { LANG_NAMES } from "../constants";

export const inputPromptSelfContainedPredicate: LLMPredicate = {
  id: "input-prompt-self-contained",
  category: "semantic",
  phase: 2,

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = LANG_NAMES[ctx.lang] ?? "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    return {
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that INPUT questions are self-contained.\n\nAn INPUT question is self-contained if the prompt + phrase + hint together make it clear what the learner should type, without needing to see the answer.\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <SELF-CONTAINED|UNCLEAR|AMBIGUOUS>\nREASON: <one sentence explaining why>\n\n- SELF-CONTAINED: The question clearly identifies what to input (verb to conjugate, article to choose, etc.)\n- UNCLEAR: The learner cannot determine what to input from prompt + phrase + hint alone\n- AMBIGUOUS: Multiple valid answers exist but only one is marked correct",
      userPrompt: "PROMPT: " + q.prompt + "\n\nPHRASE: " + phrase + "\n\nHINT: " + q.hint + "\n\nEXPECTED ANSWER: " + q.answer + "\n\nIs this question self-contained? Can a learner determine what to input without seeing the answer?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(SELF-CONTAINED|UNCLEAR|AMBIGUOUS)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: SELF-CONTAINED|UNCLEAR|AMBIGUOUS, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "SELF-CONTAINED") {
      return { status: "pass" };
    } else if (verdict === "UNCLEAR") {
      return { status: "fail", reason: extractedReason || "Prompt does not clearly identify what to input" };
    }
    return { status: "fail", reason: extractedReason || "Multiple valid answers possible" };
  },
};
