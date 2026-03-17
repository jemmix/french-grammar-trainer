import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const noAmbiguousPromptsPredicate: LLMPredicate = {
  id: "no-ambiguous-prompts",
  category: "semantic",

  appliesTo(_ctx: QuestionContext): boolean {
    return true;
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const lang = ctx.lang === "fr" ? "French" : "English";

    let questionContent: string;
    if (ctx.question.type === "mcq") {
      const q = ctx.question as MultipleChoiceQuestion;
      const choicesText = q.choices.map((c, i) => {
        return String.fromCharCode(65 + i) + ". " + c.text;
      }).join("\n");
      questionContent = "Prompt: " + q.prompt + "\nChoices:\n" + choicesText;
    } else {
      const q = ctx.question as InputQuestion;
      const phrase = q.phrase.before + "___" + q.phrase.after;
      questionContent = "Prompt: " + q.prompt + "\nPhrase: " + phrase;
    }

    return {
      systemPrompt: "You are a " + lang + " language learning quality checker. Your task is to verify that question prompts are CLEAR and UNAMBIGUOUS.\n\nAn ambiguous prompt:\n- Can be interpreted in multiple ways\n- Uses vague language (\"choose the best option\" without clear criteria)\n- Lacks necessary context to determine the correct answer\n- Contains confusing or contradictory instructions\n- Has unclear pronoun references or scope\n\nA clear prompt:\n- Has one clear interpretation\n- Provides all necessary context\n- Uses precise language\n- Makes it obvious what is being asked\n\nRespond with exactly one word: CLEAR or AMBIGUOUS.\n\n- CLEAR: The prompt is unambiguous and the task is well-defined\n- AMBIGUOUS: The prompt can be interpreted multiple ways or lacks clarity\n\nYour response must contain ONLY one of these two words in all caps. No explanation.",
      userPrompt: "RULE: " + ctx.rule.title + "\n\nQUESTION:\n" + questionContent + "\n\nIs this prompt clear and unambiguous?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim().toUpperCase();

    if (cleaned === "CLEAR") {
      return { pass: true };
    }
    if (cleaned === "AMBIGUOUS") {
      return { pass: false, reason: "Prompt is ambiguous or unclear" };
    }
    if (cleaned.includes("CLEAR") && !cleaned.includes("AMBIGUOUS") && !cleaned.includes("UNCLEAR")) {
      return { pass: true };
    }
    if (cleaned.includes("AMBIGUOUS") || cleaned.includes("UNCLEAR")) {
      return { pass: false, reason: "Prompt is ambiguous or unclear" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Prompt is ambiguous or unclear" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
