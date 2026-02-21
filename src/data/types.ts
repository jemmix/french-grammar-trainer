export interface Choice {
  text: string;
  correct: boolean;
  explanation: string;
}

export interface WrongAnswer {
  text: string;
  explanation: string;
}

interface BaseQuestion {
  id: string;
  ruleId: string;
  prompt: string;
  generatedBy: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "mcq";
  choices: Choice[];
}

export interface InputQuestion extends BaseQuestion {
  type: "input";
  answer: string;
  explanation: string;
  wrongAnswers: WrongAnswer[];
}

export type Question = MultipleChoiceQuestion | InputQuestion;

export interface Rule {
  id: string;
  sectionId: string;
  title: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  rules: Rule[];
  questions: Question[];
}

export interface SectionMeta {
  id: string;
  title: string;
  description: string;
  questionCount: number;
}
