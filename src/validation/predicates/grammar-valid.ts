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

    let itemsToCheck: string[];
    if (ctx.question.type === "mcq") {
      const q = ctx.question as MultipleChoiceQuestion;
      itemsToCheck = q.choices.map((c, i) => {
        const marker = c.correct ? " [correct answer]" : " [distractor]";
        return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
      });
    } else {
      const q = ctx.question as InputQuestion;
      itemsToCheck = [
        "Correct answer: " + q.answer,
        ...q.wrongAnswers.map((w, i) => "Wrong answer " + (i + 1) + ": " + w.text),
      ];
    }

    return {
      systemPrompt: "You are a " + lang + " grammar expert. Your task is to verify that all answer options in a language learning question are grammatically valid " + lang + ".\n\nA grammatically valid answer:\n- Follows " + lang + " grammar rules\n- Could be used in a real " + lang + " sentence (even if wrong for this specific question)\n- Is not gibberish or nonsensical\n- Uses correct spelling, accents, and punctuation where appropriate\n\nA grammatically INVALID answer:\n- Contains obvious grammar errors (wrong word order, incorrect conjugation for ANY context)\n- Is not a real word or phrase\n- Has spelling that makes it unreadable\n- Uses characters or constructions that don't exist in " + lang + "\n\nNote: An answer can be WRONG for the question but still grammatically valid. We're checking grammar, not correctness.\n\nRespond with exactly one word: VALID or INVALID.\n\n- VALID: All answer options are grammatically valid " + lang + "\n- INVALID: At least one answer option has grammar issues\n\nIf INVALID, briefly explain which option(s) and why on the next line.\n\nExample response format:\nVALID\n\nor\n\nINVALID\nOption B has incorrect verb conjugation - \"je suis allé\" should be \"je suis allée\" for feminine subject.",
      userPrompt: "QUESTION PROMPT: " + ctx.question.prompt + "\n\nANSWER OPTIONS:\n" + itemsToCheck.join("\n") + "\n\nAre all these answer options grammatically valid " + lang + "?",
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
      return { pass: false, reason: reason || "Grammar issues detected in answer options" };
    }
    if (firstLine.includes("VALID") && !firstLine.includes("INVALID")) {
      return { pass: true };
    }
    if (firstLine.includes("INVALID")) {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Grammar issues detected in answer options" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Grammar issues detected in answer options" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
