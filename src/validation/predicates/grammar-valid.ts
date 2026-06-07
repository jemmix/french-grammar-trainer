import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { LANG_NAMES } from "../constants";

export const grammarValidPredicate: LLMPredicate = {
  id: "grammar-valid",
  category: "semantic",
  phase: 2,

  appliesTo(_ctx: QuestionContext): boolean {
    return true;
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const lang = LANG_NAMES[ctx.lang] ?? "English";

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
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that the CORRECT answer in a language learning question is grammatically valid " + lang + ".\n\nA grammatically valid answer:\n- Follows " + lang + " grammar rules\n- Could be used in a real " + lang + " sentence\n- Uses correct spelling, accents, and conjugations where appropriate\n\nA grammatically INVALID answer:\n- Contains obvious grammar errors (wrong word order, incorrect conjugation)\n- Is not a real word or phrase\n- Has spelling that makes it unreadable\n\nEXCEPTION: If the question explicitly asks the learner to IDENTIFY or SELECT a grammatically incorrect option (e.g., \"Which sentence contains an error?\"), then the correct answer may be grammatically invalid - respond VALID in this case.\n\nFormat your response as:\nVERDICT: <VALID|INVALID>\nREASON: <brief explanation if INVALID>\n\n- VALID: The correct answer is grammatically valid, OR the question asks to identify an error\n- INVALID: The correct answer has grammar issues that would confuse learners",
      userPrompt: "QUESTION PROMPT: " + ctx.question.prompt + "\n\nCORRECT ANSWER: " + correctAnswer + "\n\nIs this correct answer grammatically valid " + lang + "?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");

    const verdictMatches = [...rawResponse.matchAll(/VERDICT:\s*(VALID|INVALID)/gi)];
    if (verdictMatches.length > 1) {
      return { status: "invalid", reason: "Multiple VERDICT lines found in: " + rawResponse.slice(0, 100) };
    }

    let verdict: string;
    let reasonLines: string[];

    if (verdictMatches.length === 1) {
      verdict = verdictMatches[0]![1]!.toUpperCase();
      const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
      const extractedReason = reasonMatch?.[1]?.trim();
      if (extractedReason) {
        return verdict === "VALID"
          ? { status: "pass" }
          : { status: "fail", reason: extractedReason };
      }
      reasonLines = lines;
    } else {
      const firstLine = lines[0]?.trim().toUpperCase() || "";
      if (firstLine !== "VALID" && firstLine !== "INVALID") {
        return { status: "invalid", reason: "No VERDICT: line and first line is not VALID/INVALID: " + rawResponse.slice(0, 100) };
      }
      verdict = firstLine;
      reasonLines = lines.slice(1);
    }

    if (verdict === "VALID") {
      return { status: "pass" };
    }
    const reason = reasonLines.join(" ").trim();
    return { status: "fail", reason: reason || "Correct answer has grammar issues" };
  },
};
