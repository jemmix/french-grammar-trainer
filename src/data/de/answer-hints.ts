// Answer-to-hint dictionary for DE
// Hints follow these rules:
// - Verbs: dictionary form (infinitive)
// - "t" ending: "pronunciation" (contracted form marker)
// - Other words: word type in English (pronom, adjectif, connecteur, etc.)

export const answerHints: Record<string, string> = {
  "—": "Achten Sie auf die Präposition „nach\"",
  "Akkusativ": "Kasus",
  "Das": "bestimmter Artikel",
  "Den": "bestimmter Artikel",
  "Der": "bestimmter Artikel",
  "Die": "bestimmter Artikel",
  "Dörfer": "Pluralform von Dorf",
  "Ein": "unbestimmter Artikel",
  "Eine": "unbestimmter Artikel",
  "Einen": "unbestimmter Artikel",
  "Nächte": "Pluralform von Nacht",
  "Stühle": "Pluralform von Stuhl",
  "Töchter": "Pluralform von Tochter",
  "dich": "Personalpronomen Akkusativ",
  "einen": "unbestimmter Artikel",
  "kein": "Negationsartikel",
  "keine": "Negationsartikel",
  "keinen": "Negationsartikel",
  "mein": "Possessivartikel",
  "meinen": "Possessivartikel",
  "mich": "Personalpronomen Akkusativ",
  "unsere": "Possessivartikel",
  "unseren": "Possessivartikel",
  "den": "bestimmter Artikel",
  "der": "bestimmter Artikel",
  "invertiert": "Wortstellungstyp",
  "neutral": "Wortstellungstyp",
  "Den Film sieht der Lehrer im Kino.": "Akkusativobjekt – Verb – Subjekt – Ergänzung",
  "Den Kuchen backt der Bäcker am Wochenende.": "Akkusativobjekt – Verb – Subjekt – Ergänzung",
  "liest": "Verb (lesen, 3. Person Singular Präsens)",
  "sieht": "Verb (sehen, 3. Person Singular Präsens)",
};

export type AnswerHintKey = keyof typeof answerHints;