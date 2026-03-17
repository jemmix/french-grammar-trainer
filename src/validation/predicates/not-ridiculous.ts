import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const notRidiculousPredicate: LLMPredicate = {
  id: "not-ridiculous",
  category: "pedagogical",

  appliesTo(_ctx: QuestionContext): boolean {
    return true;
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    const lang = ctx.lang === "fr" ? "French" : "English";

    let questionContent: string;
    if (ctx.question.type === "mcq") {
      const q = ctx.question as MultipleChoiceQuestion;
      const choicesText = q.choices.map((c, i) => {
        const marker = c.correct ? " [correct]" : "";
        return String.fromCharCode(65 + i) + "." + marker + " " + c.text;
      }).join("\n");
      questionContent = "Prompt: " + q.prompt + "\nChoices:\n" + choicesText;
    } else {
      const q = ctx.question as InputQuestion;
      const phrase = q.phrase.before + "___" + q.phrase.after;
      questionContent = "Prompt: " + q.prompt + "\nPhrase: " + phrase + "\nAnswer: " + q.answer + "\nHint: " + q.hint;
    }

    return {
      systemPrompt: "You are a " + lang + " language learning quality assurance expert. Your task is to catch questions that are RIDICULOUS or clearly inappropriate for a language learning context.\n\nA RIDICULOUS question:\n- Uses absurd, offensive, or inappropriate content\n- Has nonsensical or surreal scenarios that would never happen\n- Contains explicit, vulgar, or inappropriate language\n- Tests bizarre edge cases that no learner would encounter\n- Has choices that are obviously jokes or memes\n- Promotes stereotypes or harmful content\n- Is clearly broken or malformed\n\nA REASONABLE question:\n- Uses everyday scenarios learners might encounter\n- Tests grammar concepts in a clear, educational way\n- Uses appropriate language for a learning context\n- Has answer choices that are plausible\n- Is something you'd expect to see in a textbook\n\nRespond with exactly one word: REASONABLE or RIDICULOUS.\n\n- REASONABLE: This is a normal, appropriate language learning exercise\n- RIDICULOUS: This question has issues that make it unsuitable\n\nIf RIDICULOUS, briefly explain why on the next line.",
      userPrompt: "RULE BEING TESTED: " + ctx.rule.title + "\n\nQUESTION:\n" + questionContent + "\n\nIs this a reasonable language learning exercise, or is there something ridiculous/inappropriate about it?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");
    const firstLine = lines[0]?.trim().toUpperCase() || "";

    if (firstLine === "REASONABLE") {
      return { pass: true };
    }
    if (firstLine === "RIDICULOUS") {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Question is ridiculous or inappropriate" };
    }
    if (firstLine.includes("REASONABLE") && !firstLine.includes("RIDICULOUS")) {
      return { pass: true };
    }
    if (firstLine.includes("RIDICULOUS")) {
      const reason = lines.slice(1).join(" ").trim();
      return { pass: false, reason: reason || "Question is ridiculous or inappropriate" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { pass: true };
    }
    if (verdict === "FALSE") {
      return { pass: false, reason: "Question is ridiculous or inappropriate" };
    }
    return { pass: false, reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
