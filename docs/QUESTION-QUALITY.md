# Question Quality Standards

This document summarizes what a good question looks like, derived from the validation predicates in `src/validation/predicates/`.

## All Questions

### Structure
- Have a clear, unambiguous prompt that can only be interpreted one way
- Use grammatically valid language in the correct answer
- Actually test the grammar rule they claim to test (not incidental to a different rule)
- Use appropriate, non-ridiculous content suitable for language learning

### Language (French course)
- All content is in French: prompts, choices, hints, answers, explanations
- Exceptions allowed for pedagogical purposes: contrasting with English false friends, referencing cognates
- Use correct elision: `l'homme` not `le homme`, `l'amie` not `la amie`

---

## Multiple Choice Questions (MCQ)

### Structure
- Have at least 2 choices
- Have exactly 1 correct answer marked
- Have no duplicate or near-duplicate choices
- Have no more than 2 choices from the same determiner family:
  - Defined: le, la, l', les
  - Indefinite: un, une, des
  - Partitive: du, de la, de l'
  - Contracted-à: au, aux
  - Demonstrative: ce, cet, cette, ces
  - Possessive families (son/sa/ses, mon/ma/mes, etc.)

### Semantic Correctness
- The marked correct answer is actually correct
- All marked wrong answers are actually incorrect

---

## Input Questions

### Structure
- Have a `phrase` with context before and after the blank
- Have a non-empty correct `answer`
- Have a non-empty `explanation` for the correct answer
- Have at least 4 prepared wrong answers
- Have no duplicate wrong answers
- Have no wrong answer that matches the correct answer

### Prompt Quality
- Prompt is **imperative**: tells the learner what to do (e.g., "Conjuguez le verbe...", "Complétez avec l'article...")
- Prompt is **not narrative**: not just context or description (e.g., avoid "Mon frère travaille...")
- Prompt is **specific**: tells the learner what kind of word/form to provide
- Question is **self-contained**: learner can determine what to input from prompt + phrase + hint alone, without seeing the answer

### Hint Quality
- Hint should not give away the answer verbatim
- The answer should not appear as consecutive words in the question text or hint

### Wrong Answers
- Are **plausible mistakes** a learner might actually make
- Represent common errors: wrong conjugation, wrong article, wrong agreement
- Are not random words or obviously nonsensical inputs
- Each has an **accurate explanation** that:
  - Correctly identifies why the answer is wrong
  - References the relevant grammar rule
  - Contains no factual errors
  - Helps the learner understand their mistake

---

## Validation Commands

Run structural and language checks (fast, no LLM):
```bash
npm run validate-content
```

Run full validation including LLM-based semantic checks:
```bash
npx tsx scripts/validate.ts --llm --update-cache
```
