// Answer-to-hint dictionary for DE
// Hints follow these rules:
// - Verbs: dictionary form (infinitive)
// - "t" ending: "pronunciation" (contracted form marker)
// - Other words: word type in English (pronom, adjectif, connecteur, etc.)

export const answerHints: Record<string, string> = {
  "—": "Nullartikel (kein Artikel)",
  "das": "bestimmter Artikel",
  "der": "bestimmter Artikel",
  "die": "bestimmter Artikel",
  "Dörfer": "Pluralform von Dorf",
  "ein": "unbestimmter Artikel",
  "eine": "unbestimmter Artikel",
  "kein": "Negationsartikel",
  "keine": "Negationsartikel",
  "mein": "Possessivartikel",
  "Münder": "Pluralform von Mund",
  "Stühle": "Pluralform von Stuhl",
  "Töchter": "Pluralform von Tochter",
  "unsere": "Possessivartikel",
};

export type AnswerHintKey = keyof typeof answerHints;