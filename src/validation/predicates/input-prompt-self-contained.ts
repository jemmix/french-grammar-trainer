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
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that INPUT questions are self-contained.\n\nAn INPUT question is self-contained if the prompt + phrase + hint together make it clear what the learner should type, without needing to see the answer.\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <SELF-CONTAINED|UNCLEAR|AMBIGUOUS>\nREASON: <one sentence explaining why>\n\n- SELF-CONTAINED: The question clearly identifies what to input (verb to conjugate, article to choose, etc.)\n- UNCLEAR: The learner cannot determine what to input from prompt + phrase + hint alone\n- AMBIGUOUS: Multiple valid answers exist but only one is marked correct",
      userPrompt: "PROMPT: " + q.prompt + "\n\nPHRASE: " + phrase + "\n\nHINT: " + q.hint + "\n\nEXPECTED ANSWER: " + q.answer + "\n\nIs this question self-contained? Can a learner determine what to input without seeing the answer?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const verdictMatch = rawResponse.match(/VERDICT:\s*(SELF-CONTAINED|UNCLEAR|AMBIGUOUS)/i);
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;
    
    if (verdictMatch?.[1]) {
      const verdict = verdictMatch[1].toUpperCase();
      if (verdict === "SELF-CONTAINED") {
        return { pass: true };
      } else if (verdict === "UNCLEAR") {
        return { pass: false, reason: extractedReason || "Prompt does not clearly identify what to input" };
      } else if (verdict === "AMBIGUOUS") {
        return { pass: false, reason: extractedReason || "Multiple valid answers possible" };
      }
    }
    
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
