export interface Choice {
  text: string;
  correct: boolean;
  explanation: string;
}

export interface Question {
  id: string;
  ruleId: string;
  prompt: string;
  choices: Choice[];
}

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
