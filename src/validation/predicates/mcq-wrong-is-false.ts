import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion } from "../../data/types";

export const mcqWrongIsFalsePredicate: LLMPredicate = {
  id: "mcq-wrong-is-false",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.question.type === "mcq";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const q = ctx.question as MultipleChoiceQuestion;
    const wrongChoices = q.choices.filter((c) => !c.correct);
    const lang = ctx.lang === "fr" ? "French" : "English";

    const choicesText = q.choices.map((c, i) => {
      const marker = c.correct ? " [CORRECT]" : " [WRONG]";
      return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
    }).join("\n");

    const wrongLabels = wrongChoices
      .map((c, i) => {
        const idx = q.choices.indexOf(c);
        return String.fromCharCode(65 + idx);
      })
      .join(", ");

    return {
      systemPrompt:
        "You are a " +
        lang +
        " grammar verifier. Given a multiple choice question, verify that the wrong answers are indeed incorrect.\n\n" +
        "Respond with a single line in this exact format:\n" +
        "VERDICT|letter1,letter2,...|explanation\n\n" +
        "Where:\n" +
        "- VERDICT is TRUE (all wrong answers are incorrect), FALSE (at least one wrong answer could be correct), or UNCLEAR (question is ambiguous)\n" +
        "- If FALSE, list the letters of the wrong answers that could be correct (e.g. B,C). If TRUE or UNCLEAR, leave this field empty.\n" +
        "- explanation: a brief one-sentence reason for your verdict. For FALSE, explain why each flagged answer could be correct.\n\n" +
        "Examples:\n" +
        "TRUE||All wrong answers contain clear grammar errors.\n" +
        "FALSE|B,C|B is acceptable in spoken French; C uses an alternative but valid word order.\n" +
        "UNCLEAR||The question does not specify whether it refers to formal or informal register.",
      userPrompt:
        "Question: " +
        q.prompt +
        "\n\nChoices:\n" +
        choicesText +
        "\n\nVerify these WRONG answers are incorrect (letters: " +
        wrongLabels +
        ")",
    };
  },

  interpretResponse(ctx: QuestionContext, rawResponse: string): PredicateResult {
    const cleaned = rawResponse.trim();

    const pipeParts = cleaned.split("|");
    const verdict = (pipeParts[0] ?? "").trim().toUpperCase();
    const flaggedLetters = pipeParts.length > 1 ? (pipeParts[1] ?? "").trim() : "";
    const explanation = pipeParts.length > 2 ? (pipeParts[2] ?? "").trim() : "";

    if (verdict === "TRUE") {
      return { status: "pass" };
    } else if (verdict === "FALSE") {
      const reason = flaggedLetters
        ? "Wrong answer(s) may be correct: " + flaggedLetters + (explanation ? " — " + explanation : "")
        : "At least one wrong answer may be correct" + (explanation ? " — " + explanation : "");
      return { status: "fail", reason };
    } else if (verdict === "UNCLEAR") {
      return {
        status: "fail",
        reason: "Question is ambiguous" + (explanation ? " — " + explanation : ""),
      };
    }

    const firstWord = (cleaned.split(/\s|\|/)[0] ?? "").toUpperCase();
    if (firstWord === "TRUE") {
      return { status: "pass" };
    } else if (firstWord === "FALSE") {
      const rest = cleaned.slice(cleaned.indexOf(firstWord) + firstWord.length).trim();
      return { status: "fail", reason: "At least one wrong answer may be correct — " + (rest || "no details") };
    } else if (firstWord === "UNCLEAR") {
      const rest = cleaned.slice(cleaned.indexOf(firstWord) + firstWord.length).trim();
      return { status: "fail", reason: "Question is ambiguous — " + (rest || "no details") };
    }

    return { status: "invalid", reason: "Unexpected response: " + rawResponse };
  },
};
