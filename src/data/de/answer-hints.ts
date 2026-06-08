// Answer-to-hint dictionary for DE
// Hints follow these rules:
// - Verbs: dictionary form (infinitive)
// - "t" ending: "pronunciation" (contracted form marker)
// - Other words: word type in English (pronom, adjectif, connecteur, etc.)

export const answerHints: Record<string, string> = {
  "—": "Achten Sie auf die Präposition „nach\"",
  "Das": "bestimmter Artikel",
  "Der": "bestimmter Artikel",
  "Die": "bestimmter Artikel",
  "Dörfer": "Pluralform von Dorf",
  "Ein": "unbestimmter Artikel",
  "Eine": "unbestimmter Artikel",
  "kein": "Negationsartikel",
  "keine": "Negationsartikel",
  "mein": "Possessivartikel",
  "Nächte": "Pluralform von Nacht",
  "Stühle": "Pluralform von Stuhl",
  "Töchter": "Pluralform von Tochter",
  "unsere": "Possessivartikel",
};

export type AnswerHintKey = keyof typeof answerHints;