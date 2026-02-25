# Grammaire Française B1

An interactive French grammar trainer targeting B1 level. Practice conjugations, tenses, articles, pronouns, and more through multiple-choice and free-input exercises.

## Features

- 12+ grammar sections covering present indicative through relative pronouns
- Mixed question types: MCQ (80%) and user-input fill-in-the-blank (20%)
- Immediate feedback with explanations for wrong answers
- Clean French-themed UI

## Stack

- [Next.js](https://nextjs.org) (Pages Router)
- [Tailwind CSS](https://tailwindcss.com)
- TypeScript

## Development

```bash
npm install
npm run dev
```

## Content Pipeline

Grammar questions live in `questions/<rule-id>.txt` (plain text, version-controlled) and are compiled to TypeScript in `src/data/sections/`. See `CLAUDE.md` for the full generation workflow.

## Sections

| # | Section |
|---|---------|
| 1 | Présent de l'indicatif |
| 2 | Passé composé |
| 3 | Imparfait |
| 4 | Plus-que-parfait |
| 5 | Futur simple et antérieur |
| 6 | Conditionnel |
| 7 | Subjonctif présent |
| 8 | Subjonctif passé |
| 9 | Impératif |
| 10 | Les articles |
| 11 | Pronoms COD/COI |
| 12 | Pronoms relatifs |
