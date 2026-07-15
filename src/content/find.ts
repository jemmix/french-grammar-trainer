import type { Question, Rule, Section } from "./types";
import { sectionMap } from "./sections";

export interface QuestionContext {
  question: Question;
  section: Section;
  rule: Rule;
}

export function findQuestion(questionId: string): QuestionContext | null {
  for (const section of Object.values(sectionMap)) {
    const question = section.questions.find((q) => q.id === questionId);
    if (question) {
      const rule = section.rules.find((r) => r.id === question.ruleId);
      if (rule) return { question, section, rule };
    }
  }
  return null;
}
