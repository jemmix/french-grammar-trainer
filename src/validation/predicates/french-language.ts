import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";
import { parseVerdict } from "../harness";

export const frenchLanguagePredicate: LLMPredicate = {
  id: "french-language",
  category: "semantic",

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.lang === "fr";
  },

  generatePrompt(ctx: QuestionContext): LLMRequestSpec {
    let questionContent: string;
    
    if (ctx.question.type === "mcq") {
      const q = ctx.question as MultipleChoiceQuestion;
      const choicesText = q.choices.map((c, i) => {
        const marker = c.correct ? " [correct]" : "";
        return String.fromCharCode(65 + i) + "." + marker + " " + c.text + "\n   Explanation: " + c.explanation;
      }).join("\n");
      questionContent = "Prompt: " + q.prompt + "\nChoices:\n" + choicesText;
    } else {
      const q = ctx.question as InputQuestion;
      const phrase = q.phrase.before + "___" + q.phrase.after;
      questionContent = "Prompt: " + q.prompt + "\nPhrase: " + phrase + "\nAnswer: " + q.answer + "\nHint: " + q.hint + "\nExplanation: " + q.explanation + "\nWrong answers:\n" + q.wrongAnswers.map(w => "  - " + w.text + " (" + w.explanation + ")").join("\n");
    }

    return {
      systemPrompt: `You are a French language content validator. Your task is to verify that all question content is in French.

CHECK ALL OF THESE FIELDS FOR LANGUAGE:
- Prompt text
- Choice texts (for MCQ)
- Hint text
- Answer text (the word/phrase to fill in)
- Explanations (for correct and wrong answers)
- Phrase context (the sentence with the blank)

ALLOWED EXCEPTIONS (English is acceptable ONLY in these cases):
1. When explicitly contrasting French with English for pedagogical purposes (e.g., "Attention: 'actuellement' does NOT mean 'actually'")
2. When referencing English cognates to help learners understand French words
3. When clarifying false friends/common confusions with English
4. Proper nouns that are English (names, places) when contextually appropriate

NOT ALLOWED:
- English prompts like "Conjugate the verb..." instead of "Conjuguez le verbe..."
- English explanations like "This is wrong because..." instead of "C'est incorrect parce que..."
- English hints or instructions
- Mixing English and French sentences in explanations without clear pedagogical purpose

Format your response as:
VERDICT
EXPLANATION

Where:
- VERDICT is exactly one word: FRENCH or ENGLISH_DETECTED
- EXPLANATION is a brief sentence describing what you found

Examples:
FRENCH
All content is in French with no English detected.

FRENCH
Content uses allowed English exception for false friend contrast (actuellement/actually).

ENGLISH_DETECTED
Prompt uses English instruction "Conjugate the verb" instead of French.

ENGLISH_DETECTED
Explanation contains untranslated English: "This is wrong because the subject is plural."`,
      userPrompt: "RULE: " + ctx.rule.title + "\n\nQUESTION CONTENT:\n" + questionContent + "\n\nIs all content appropriately in French?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");
    const firstLine = lines[0]?.trim().toUpperCase() || "";
    const explanation = lines.slice(1).join(" ").trim();

    const keywordLine = rawResponse.match(/(?:^|\n)\s*(FRENCH|ENGLISH_DETECTED)\s*$/im);
    if (keywordLine) {
      const kw = keywordLine[1]!.toUpperCase();
      const kwIdx = lines.findIndex(l => l.trim().toUpperCase() === kw);
      const kwExplanation = lines.slice(kwIdx + 1).join(" ").trim();
      if (kw === "FRENCH") {
        return { status: "pass" };
      }
      if (kw === "ENGLISH_DETECTED") {
        return { status: "fail", reason: kwExplanation || "English content detected without pedagogical justification" };
      }
    }

    if (firstLine === "FRENCH") {
      return { status: "pass" };
    }
    if (firstLine === "ENGLISH_DETECTED") {
      return { status: "fail", reason: explanation || "English content detected without pedagogical justification" };
    }
    if (firstLine.includes("FRENCH") && !firstLine.includes("ENGLISH")) {
      return { status: "pass" };
    }
    if (firstLine.includes("ENGLISH")) {
      return { status: "fail", reason: explanation || "English content detected without pedagogical justification" };
    }
    const verdict = parseVerdict(rawResponse);
    if (verdict === "TRUE") {
      return { status: "pass" };
    }
    if (verdict === "FALSE") {
      return { status: "fail", reason: explanation || "English content detected without pedagogical justification" };
    }
    return { status: "invalid", reason: "Unexpected response: " + rawResponse.slice(0, 100) };
  },
};
