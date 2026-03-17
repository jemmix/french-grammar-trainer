import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const questionRuleAlignmentPredicate: LLMPredicate = {
  id: "question-rule-alignment",
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
        const marker = c.correct ? " [CORRECT]" : "";
        return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
      }).join("\n");
      questionContent = "Type: Multiple Choice\nPrompt: " + q.prompt + "\nChoices:\n" + choicesText;
    } else {
      const q = ctx.question as InputQuestion;
      const phrase = q.phrase.before + "___" + q.phrase.after;
      questionContent = "Type: Input\nPrompt: " + q.prompt + "\nPhrase: " + phrase + "\nCorrect Answer: " + q.answer;
    }

    return {
      systemPrompt: "You are a " + lang + " grammar curriculum validator. Your task is to verify that a question actually tests the grammar rule it claims to test.\n\nA question is ALIGNED with a rule if:\n- Answering correctly requires knowledge of that specific grammar rule\n- The grammar concept being tested is central to the rule, not incidental\n- The question cannot be correctly answered using only knowledge of a different rule\n\nA question is MISALIGNED if:\n- The correct answer can be determined without knowing the rule\n- The question primarily tests a different grammar concept\n- The rule topic is not relevant to solving the question\n\nRespond with exactly one word: ALIGNED or MISALIGNED.\n\n- ALIGNED: The question properly tests the stated rule\n- MISALIGNED: The question tests something other than the stated rule\n\nYour response must contain ONLY one of these two words in all caps. No explanation.",
      userPrompt: "RULE BEING TESTED: " + ctx.rule.id + " - " + ctx.rule.title + "\n\nQUESTION:\n" + questionContent + "\n\nDoes this question actually test the stated rule?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim().toUpperCase();

    if (cleaned === "ALIGNED") {
      return { pass: true };
    }
    if (cleaned === "MISALIGNED") {
      return { pass: false, reason: "Question does not test the stated grammar rule" };
    }
    if (cleaned.includes("ALIGNED") && !cleaned.includes("MISALIGNED")) {
      return { pass: true };
    }
    if (cleaned.includes("MISALIGNED")) {
      return { pass: false, reason: "Question does not test the stated grammar rule" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Question does not test the stated grammar rule" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
