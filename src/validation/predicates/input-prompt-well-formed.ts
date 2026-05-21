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
      systemPrompt: `You are a ${lang} language learning quality checker. Your task is to verify that INPUT question prompts contain a clear CALL TO ACTION.

A WELL-FORMED prompt must contain at least one clear imperative instruction telling the learner exactly what to type (e.g. "Complete...", "Fill in...", "Conjugate...", "Correct the error and write..."). The prompt MAY include context, framing, or a scenario before or alongside the instruction — that is perfectly fine. What matters is that the learner can read the prompt and know exactly what to do.

A NOT-WELL-FORMED prompt is one where the learner cannot tell what to do — e.g. pure narrative with no instruction, or vague context that doesn't specify what form/tense/word to provide.

Examples of NOT-WELL-FORMED prompts:
- "My brother works from nine to five. I do the same as my brother." (no instruction at all)
- "Running is great exercise. You perform that activity in the park." (context only, no instruction)
- "That was a beautiful song." (just context)

Examples of WELL-FORMED prompts:
- "Complete the sentence with the present simple form of the verb."
- "Fill in the blank with the correct article."
- "Conjugate the verb in parentheses."
- "A student wrote this sentence with the wrong tense. Correct the error and conjugate the verb in the present." (context + clear instruction — this is fine)
- "Corrigez l'erreur et conjuguez le verbe dans le temps qui convient." (context + clear instruction — this is fine)

First output your verdict, then a brief explanation.

Format: VERDICT: <WELL-FORMED|NOT-WELL-FORMED>
REASON: <one sentence explaining why>`,
      userPrompt: `PROMPT: ${q.prompt}

PHRASE: ${phrase}

HINT: ${q.hint}

EXPECTED ANSWER: ${q.answer}

Is this prompt well-formed? Does it give the learner a clear imperative instruction?`,
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(WELL-FORMED|NOT-WELL-FORMED)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: WELL-FORMED|NOT-WELL-FORMED, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "WELL-FORMED") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "Prompt is not a clear imperative instruction" };
  },
};
