import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { InputQuestion } from "../../data/types";

export const inputPromptWellFormedPredicate: LLMPredicate = {
  id: "input-prompt-well-formed",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "input";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as InputQuestion;
    const lang = ctx.lang === "fr" ? "French" : "English";
    const phrase = q.phrase.before + "___" + q.phrase.after;

    return {
      systemPrompt: `You are a ${lang} language learning quality checker. Your task is to verify that INPUT question prompts are WELL-FORMED.

A well-formed prompt for an INPUT question must:
1. Be IMPERATIVE - give the learner a clear instruction (e.g., "Complete the sentence...", "Fill in the blank...", "Conjugate the verb...")
2. Be SPECIFIC enough - tell the learner what kind of word/form to provide (verb, article, tense, etc.)
3. NOT be mere context or narrative - it should tell the learner WHAT TO DO, not describe a situation

Examples of BAD prompts (NOT well-formed):
- "My brother works from nine to five. I do the same as my brother." (narrative, no instruction)
- "Running is great exercise. You perform that activity in the park." (context, no instruction)
- "That was a beautiful song." (just context)

Examples of GOOD prompts (well-formed):
- "Complete the sentence with the present simple form of the verb."
- "Fill in the blank with the correct article."
- "Conjugate the verb in parentheses."

First output your verdict, then a brief explanation.

Format: VERDICT: <WELL-FORMED|NOT-WELL-FORMED>
REASON: <one sentence explaining why>

- WELL-FORMED: The prompt is a clear imperative instruction that tells the learner what to do
- NOT-WELL-FORMED: The prompt is narrative/context, or lacks a clear instruction`,
      userPrompt: `PROMPT: ${q.prompt}

PHRASE: ${phrase}

HINT: ${q.hint}

EXPECTED ANSWER: ${q.answer}

Is this prompt well-formed? Does it give the learner a clear imperative instruction?`,
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const verdictMatch = rawResponse.match(/VERDICT:\s*(WELL-FORMED|NOT-WELL-FORMED)/i);
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdictMatch?.[1]) {
      const verdict = verdictMatch[1].toUpperCase().replace(/-/g, "");
      if (verdict === "WELLFORMED") {
        return { status: "pass" };
      } else if (verdict === "NOTWELLFORMED") {
        return { status: "fail", reason: extractedReason || "Prompt is not a clear imperative instruction" };
      }
    }

    const cleaned = rawResponse.trim().toUpperCase();
    if (cleaned === "WELL-FORMED") {
      return { status: "pass" };
    } else if (cleaned === "NOT-WELL-FORMED") {
      return { status: "fail", reason: "Prompt is not a clear imperative instruction" };
    }
    if (cleaned.includes("WELL-FORMED") && !cleaned.includes("NOT")) {
      return { status: "pass" };
    }
    if (cleaned.includes("NOT") || cleaned.includes("BAD") || cleaned.includes("NARRATIVE")) {
      return { status: "fail", reason: "Prompt is not a clear imperative instruction" };
    }
    return { status: "invalid", reason: "Unexpected response: " + rawResponse };
  },
};
