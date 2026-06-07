import type { LLMPredicate, QuestionContext, PredicateResult, LLMRequestSpec } from "../types";
import type { MultipleChoiceQuestion, InputQuestion } from "../../data/types";

export const germanLanguagePredicate: LLMPredicate = {
  id: "german-language",
  category: "semantic",
  phase: 2,

  appliesTo(ctx: QuestionContext): boolean {
    return ctx.lang === "de";
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
      systemPrompt: `You are a German language content validator. Your task is to verify that all question content is in German.

CHECK ALL OF THESE FIELDS FOR LANGUAGE:
- Prompt text
- Choice texts (for MCQ)
- Hint text
- Answer text (the word/phrase to fill in)
- Explanations (for correct and wrong answers)
- Phrase context (the sentence with the blank)

ALLOWED EXCEPTIONS (English is acceptable ONLY in these cases):
1. When explicitly contrasting German with English for pedagogical purposes (e.g., "Attention: 'bekommen' does NOT mean 'to become', it means 'to get'")
2. When referencing English cognates to help learners understand German words
3. When clarifying false friends/common confusions with English (e.g., Gift = poison not gift, also = so not also, bekommen = get not become)
4. Proper nouns that are English (names, places) when contextually appropriate

NOT ALLOWED:
- English prompts like "Conjugate the verb..." instead of "Konjugieren Sie das Verb..."
- English explanations like "This is wrong because..." instead of "Das ist falsch, weil..."
- English hints or instructions
- Mixing English and German sentences in explanations without clear pedagogical purpose

Format your response as:
VERDICT: <GERMAN|ENGLISH_DETECTED>
REASON: <brief explanation>

Examples:
VERDICT: GERMAN
REASON: All content is in German with no English detected.

VERDICT: GERMAN
REASON: Content uses allowed English exception for false friend contrast (bekommen/become).

VERDICT: ENGLISH_DETECTED
REASON: Prompt uses English instruction "Conjugate the verb" instead of German.

VERDICT: ENGLISH_DETECTED
REASON: Explanation contains untranslated English: "This is wrong because the subject is plural."`,
      userPrompt: "RULE: " + ctx.rule.title + "\n\nQUESTION CONTENT:\n" + questionContent + "\n\nIs all content appropriately in German?",
    };
  },

  interpretResponse(_ctx: QuestionContext, rawResponse: string): PredicateResult {
    const lines = rawResponse.trim().split("\n");

    const verdictMatches = [...rawResponse.matchAll(/VERDICT:\s*(GERMAN|ENGLISH_DETECTED)/gi)];
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
        return verdict === "GERMAN"
          ? { status: "pass" }
          : { status: "fail", reason: extractedReason };
      }
      reasonLines = lines;
    } else {
      const firstLine = lines[0]?.trim().toUpperCase() || "";
      if (firstLine !== "GERMAN" && firstLine !== "ENGLISH_DETECTED") {
        return { status: "invalid", reason: "No VERDICT: line and first line is not GERMAN/ENGLISH_DETECTED: " + rawResponse.slice(0, 100) };
      }
      verdict = firstLine;
      reasonLines = lines.slice(1);
    }

    if (verdict === "GERMAN") {
      return { status: "pass" };
    }
    const reason = reasonLines.join(" ").trim();
    return { status: "fail", reason: reason || "English content detected without pedagogical justification" };
  },
};
