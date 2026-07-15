import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "~/content/types";
import { LANG_NAMES } from "../constants";

export const questionRuleAlignmentPredicate: LLMPredicate = {
  id: "question-rule-alignment",
  category: "semantic",
  phase: 1,

  appliesTo(_ctx: QuestionContext): boolean {
    return true;
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const lang = LANG_NAMES[ctx.lang] ?? "English";

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
      systemPrompt: "You are a " + lang + " grammar curriculum validator. Your task is to verify that a question actually tests the grammar rule it claims to test.\n\nA question is ALIGNED with a rule if:\n- Answering correctly requires knowledge of that specific grammar rule\n- The grammar concept being tested is central to the rule, not incidental\n- The question cannot be correctly answered using only knowledge of a different rule\n\nA question is MISALIGNED if:\n- The correct answer can be determined without knowing the rule\n- The question primarily tests a different grammar concept\n- The rule topic is not relevant to solving the question\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <ALIGNED|MISALIGNED>\nREASON: <one sentence explaining why>\n\n- ALIGNED: The question properly tests the stated rule\n- MISALIGNED: The question tests something other than the stated rule",
      userPrompt: "SECTION: " + ctx.section.title + "\n\nRULE BEING TESTED: " + ctx.rule.id + " - " + ctx.rule.title + "\n\nQUESTION:\n" + questionContent + "\n\nDoes this question actually test the stated rule?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(ALIGNED|MISALIGNED)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: ALIGNED|MISALIGNED, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "ALIGNED") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "Question does not test the stated grammar rule" };
  },
};
