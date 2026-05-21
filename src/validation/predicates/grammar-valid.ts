import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";

export const grammarValidPredicate: LLMPredicate = {
  id: "grammar-valid",
  category: "semantic",

  appliesTo(_ctx: QuestionContext): boolean {
    return true;
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const lang = ctx.lang === "fr" ? "French" : "English";

    let correctAnswer: string;
    if (ctx.question.type === "mcq") {
      const q = ctx.question as MultipleChoiceQuestion;
      const correctChoice = q.choices.find((c) => c.correct);
      correctAnswer = correctChoice?.text || "";
    } else {
      const q = ctx.question as InputQuestion;
      correctAnswer = q.answer;
    }

    return {
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that the CORRECT answer in a language learning question is grammatically valid " + lang + ".\n\nA grammatically valid answer:\n- Follows " + lang + " grammar rules\n- Could be used in a real " + lang + " sentence\n- Uses correct spelling, accents, and conjugations where appropriate\n\nA grammatically INVALID answer:\n- Contains obvious grammar errors (wrong word order, incorrect conjugation)\n- Is not a real word or phrase\n- Has spelling that makes it unreadable\n\nEXCEPTION: If the question explicitly asks the learner to IDENTIFY or SELECT a grammatically incorrect option (e.g., \"Which sentence contains an error?\"), then the correct answer may be grammatically invalid - respond VALID in this case.\n\nFirst output your verdict, then a brief explanation.\n\nFormat: VERDICT: <VALID|INVALID>\nREASON: <one sentence explaining why>\n\n- VALID: The correct answer is grammatically valid, OR the question asks to identify an error\n- INVALID: The correct answer has grammar issues that would confuse learners",
      userPrompt: "QUESTION PROMPT: " + ctx.question.prompt + "\n\nCORRECT ANSWER: " + correctAnswer + "\n\nIs this correct answer grammatically valid " + lang + "?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(VALID|INVALID)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: VALID|INVALID, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "VALID") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "Correct answer has grammar issues" };
  },
};
