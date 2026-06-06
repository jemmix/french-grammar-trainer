import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion } from "../../data/types";

export const mcqCorrectIsTruePredicate: LLMPredicate = {
  id: "mcq-correct-is-true",
  category: "semantic",
  phase: 2,

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "mcq";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const question = ctx.question as MultipleChoiceQuestion;
    const correctChoice = question.choices.find((c) => c.correct);
    if (!correctChoice) {
      throw new Error("No correct choice found");
    }

    const lang = ctx.lang === "fr" ? "French" : "English";
    const choicesText = question.choices.map((c, i) => {
      const marker = c.correct ? " [MARKED CORRECT]" : "";
      return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
    }).join("\n");

    return {
      systemPrompt: "You are a " + lang + " grammar verifier. Given a multiple choice question with one answer marked as correct, verify if that answer is indeed the correct choice.\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <TRUE|FALSE|UNCLEAR>\nREASON: <one sentence explaining why>\n\n- TRUE if the marked-correct answer is indeed the correct/best answer\n- FALSE if the marked-correct answer is wrong (another option is correct)\n- UNCLEAR if multiple answers could be correct or the question is ambiguous",
      userPrompt: "Question: " + ctx.question.prompt + "\n\nChoices:\n" + choicesText,
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(TRUE|FALSE|UNCLEAR)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: TRUE|FALSE|UNCLEAR, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "TRUE") {
      return { status: "pass" };
    } else if (verdict === "FALSE") {
      return { status: "fail", reason: extractedReason || "LLM says correct answer is FALSE" };
    }
    return { status: "fail", reason: extractedReason || "LLM says answer is UNCLEAR - may need review" };
  },
};
