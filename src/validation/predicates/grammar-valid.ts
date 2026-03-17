import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

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
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that the CORRECT answer in a language learning question is grammatically valid " + lang + ".\n\nA grammatically valid answer:\n- Follows " + lang + " grammar rules\n- Could be used in a real " + lang + " sentence\n- Uses correct spelling, accents, and conjugations where appropriate\n\nA grammatically INVALID answer:\n- Contains obvious grammar errors (wrong word order, incorrect conjugation)\n- Is not a real word or phrase\n- Has spelling that makes it unreadable\n\nEXCEPTION: If the question explicitly asks the learner to IDENTIFY or SELECT a grammatically incorrect option (e.g., \"Which sentence contains an error?\"), then the correct answer may be grammatically invalid - respond VALID in this case.\n\nRespond with exactly one word: VALID or INVALID.\n\n- VALID: The correct answer is grammatically valid, OR the question asks to identify an error\n- INVALID: The correct answer has grammar issues that would confuse learners\n\nIf INVALID, briefly explain the issue on the next line.",
      userPrompt: "QUESTION PROMPT: " + ctx.question.prompt + "\n\nCORRECT ANSWER: " + correctAnswer + "\n\nIs this correct answer grammatically valid " + lang + "?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");
    const firstLine = lines[0]?.trim().toUpperCase() || "";

    if (firstLine === "VALID") {
      return { pass: true };
    }
    if (firstLine === "INVALID") {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Correct answer has grammar issues" };
    }
    if (firstLine.includes("VALID") && !firstLine.includes("INVALID")) {
      return { pass: true };
    }
    if (firstLine.includes("INVALID")) {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Correct answer has grammar issues" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Correct answer has grammar issues" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
