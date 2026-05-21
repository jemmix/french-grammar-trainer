import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";

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

First output your verdict, then a brief explanation.

Format: VERDICT: <FRENCH|ENGLISH_DETECTED>
REASON: <one sentence explaining why>

- FRENCH: All content is appropriately in French
- ENGLISH_DETECTED: Unjustified English content was found`,
      userPrompt: "RULE: " + ctx.rule.title + "\n\nQUESTION CONTENT:\n" + questionContent + "\n\nIs all content appropriately in French?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const matches = [...rawResponse.matchAll(/VERDICT:\s*(FRENCH|ENGLISH_DETECTED)/gi)];

    if (matches.length !== 1) {
      return { status: "invalid", reason: "Expected exactly one VERDICT: FRENCH|ENGLISH_DETECTED, found " + matches.length + " in: " + rawResponse.slice(0, 100) };
    }

    const verdict = matches[0]![1]!.toUpperCase();
    const reasonMatch = rawResponse.match(/REASON:\s*(.+)/i);
    const extractedReason = reasonMatch?.[1]?.trim() ?? null;

    if (verdict === "FRENCH") {
      return { status: "pass" };
    }
    return { status: "fail", reason: extractedReason || "English content detected without pedagogical justification" };
  },
};
