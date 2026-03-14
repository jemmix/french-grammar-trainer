# Question Acceptance Criteria

This document defines the criteria for determining whether a question is **correctly formulated** and **pedagogically beneficial**. Each criterion includes its testing method.

---

## Summary Table

| Criterion | Category | Test Method | Script |
|-----------|----------|-------------|--------|
| Unique question ID | Structural | TS (regex) | `validate-txt.ts` |
| Required fields present | Structural | TS (parser) | `validate-txt.ts`, `validate-content.ts` |
| Declared counts match actual | Structural | TS (parser) | `validate-txt.ts` |
| MCQ: ≥2 choices, exactly 1 correct | Structural | TS | `validate-content.ts` |
| MCQ: No duplicate choices | Structural | TS | `validate-content.ts` |
| MCQ: Determiner family diversity | Structural | TS | `validate-content.ts` |
| INPUT: ≥4 wrong answers | Structural | TS | `validate-txt.ts` |
| INPUT: Wrong ≠ correct answer | Structural | TS | `validate-content.ts` |
| INPUT: PHRASE contains `___` | Structural | TS | `validate-txt.ts` |
| INPUT: Answer has hint | Structural | TS | `answer-hints.test.ts` |
| 80% MCQ / 20% INPUT ratio | Structural | TS (test) | `question-proportions.test.ts` |
| French elision correctness | Language | TS (regex) | `lint-elision.ts` |
| Non-empty explanations | Structural | TS (warn) | `validate-content.ts` |
| `generatedBy` field present | Metadata | TS | `validate-txt.ts` |
| MCQ: Correct answer is TRUE | Semantic | LLM | `verify-answers.ts` |
| MCQ: Wrong answers are FALSE | Semantic | LLM | `verify-answers.ts` |
| INPUT: Prompt is self-contained | Semantic | LLM | **TODO** |
| INPUT: Wrong answers are plausible mistakes | Pedagogical | LLM | **TODO** |
| INPUT: Wrong answer explanations accurate | Pedagogical | LLM | **TODO** |
| Choices cover topic diversity | Pedagogical | LLM | **TODO** |
| Question tests stated rule | Pedagogical | LLM | **TODO** |
| No ambiguous open-ended prompts | Pedagogical | LLM | **TODO** |
| Grammatically valid French | Language | LLM/grammar API | **TODO** |

---

## 1. Structural Criteria

These are machine-checkable properties of question format and data integrity.

### 1.1 Unique Question ID

**Criterion**: Each question must have a unique ID following the format `XX-YY-ZZZ` (section-rule-number).

**Why**: Prevents duplicate questions and enables stable references.

**Test**: TypeScript script (regex matching + Set for duplicates)

**Script**: `validate-txt.ts` (duplicate check), `validate-content.ts` (structural)

```
ID pattern: /^\d{2}-\d{2}-\d{3}$/
```

---

### 1.2 Required Fields Present

**Criterion**: All required fields must be present and non-empty.

**MCQ required fields**:
- `ID`, `TYPE: MCQ`, `PROMPT`, `RIGHT ANSWER`, at least 1 `WRONG ANSWER`

**INPUT required fields**:
- `ID`, `TYPE: INPUT`, `PROMPT`, `PHRASE`, `HINT`, `RIGHT ANSWER`, at least 4 `WRONG ANSWER`

**Why**: Incomplete questions cannot be rendered or are useless for learning.

**Test**: TypeScript parser with field validation

**Script**: `validate-txt.ts`, `validate-content.ts`

---

### 1.3 Declared Counts Match Actual

**Criterion**: The header declaration (e.g., `Total: 20 MCQ + 5 input`) must match the actual question counts.

**Why**: Prevents copy-paste errors and generation truncation.

**Test**: TypeScript script (count parsed questions, compare to header)

**Script**: `validate-txt.ts`

---

### 1.4 MCQ: Choice Count and Correctness

**Criterion**: 
- Minimum 2 choices (1 correct + 1 wrong)
- Exactly 1 correct answer marked

**Why**: Single-choice questions are not MCQ; multiple correct answers confuse learners.

**Test**: TypeScript script

**Script**: `validate-content.ts` (lines 104-115)

---

### 1.5 MCQ: No Duplicate Choices

**Criterion**: No two choices may have identical text (case-insensitive).

**Why**: Duplicate choices waste slots and confuse learners.

**Test**: TypeScript script with case-insensitive comparison

**Script**: `validate-content.ts` (lines 117-125)

---

### 1.6 MCQ: Determiner Family Diversity

**Criterion**: No more than 2 choices from the same determiner family.

**Families checked**:
- `défini`: le, la, l', les
- `indéfini`: un, une, des
- `partitif`: du, de la, de l'
- `contracté-à`: au, aux
- `possessif-*`: son/sa/ses, mon/ma/mes, etc.
- `démonstratif`: ce, cet, cette, ces

**Why**: Questions should test across grammar families, not just within one family (unless that's the specific learning objective).

**Test**: TypeScript script with family lookup table

**Script**: `validate-content.ts` (lines 127-141)

---

### 1.7 INPUT: Minimum Wrong Answers

**Criterion**: At least 4 wrong answers with explanations.

**Why**: The app provides targeted feedback for common mistakes; fewer wrong answers limit feedback quality.

**Test**: TypeScript script

**Script**: `validate-txt.ts` (line 118-119)

---

### 1.8 INPUT: Wrong Answer ≠ Correct Answer

**Criterion**: No wrong answer may match the correct answer (case-insensitive).

**Why**: Obvious error that would confuse learners.

**Test**: TypeScript script

**Script**: `validate-content.ts` (lines 183-186)

---

### 1.9 INPUT: Phrase Contains Blank

**Criterion**: PHRASE must contain exactly one `___` placeholder (2+ consecutive underscores).

**Why**: The blank is where the user input goes; missing or multiple blanks break the UI.

**Test**: TypeScript script with regex

**Script**: `validate-txt.ts` (lines 109-113)

---

### 1.10 INPUT: Answer Has Hint

**Criterion**: Every INPUT answer must have a corresponding entry in the answer-hints dictionary.

**Why**: Hints help learners (e.g., showing infinitive for conjugated verbs).

**Test**: TypeScript test

**Script**: `src/data/answer-hints.test.ts`

---

### 1.11 Question Type Ratio

**Criterion**: Each rule must have exactly 20% INPUT / 80% MCQ questions (divisible by 5).

**Why**: Consistent learning experience; input questions are harder and should be minority.

**Test**: TypeScript test

**Script**: `scripts/lib/question-proportions.test.ts`

---

## 2. Language-Specific Criteria

### 2.1 French Elision Correctness

**Criterion**: The word before `___` must match the answer's initial sound:

| Before blank | Answer starts with | Should be |
|--------------|-------------------|-----------|
| `Je ___` | vowel | `J'___` |
| `J'___` | consonant | `Je ___` |
| `me ___` | vowel | `m'___` |
| `m'___` | consonant | `me ___` |
| (same for: te/t', se/s', le/l', la/l', de/d', ne/n', que/qu', ce/c') |

**Why**: Incorrect elision is a grammatical error that teaches wrong patterns.

**Test**: TypeScript script with regex and vowel detection

**Script**: `scripts/lint-elision.ts` (55 unit tests in `scripts/lib/elision-check.test.ts`)

---

### 2.2 Grammatically Valid French (TODO)

**Criterion**: All answer choices must be grammatically valid French.

**Why**: Invalid forms like "je arrive" would pass structural checks but teach wrong grammar.

**Test**: 
- **Option A**: LLM-based grammar check
- **Option B**: Local spaCy/Lefff model
- **Option C**: Grammar API

**Script**: **TODO** — see TODO.md "Grammar-check generated answers"

---

## 3. Semantic Criteria

These require understanding the meaning of questions and answers.

### 3.1 MCQ: Correct Answer Is TRUE (LLM)

**Criterion**: When an LLM is asked "Is this answer correct for this question?", it should respond TRUE for the marked correct answer.

**Why**: Catches generation errors where the "correct" answer is actually wrong.

**Test**: LLM verification

**Script**: `scripts/verify-answers.ts`

```
Prompt: "Given a question and a proposed answer, respond TRUE/FALSE/UNCLEAR.
Question: {prompt}
Answer: {answer}"
Expected: TRUE for correct answers
```

---

### 3.2 MCQ: Wrong Answers Are FALSE (LLM)

**Criterion**: When an LLM is asked "Is this answer correct for this question?", it should respond FALSE for all marked wrong answers.

**Why**: Catches wrong answers that are actually correct.

**Test**: LLM verification

**Script**: `scripts/verify-answers.ts`

---

### 3.3 INPUT: Prompt Is Self-Contained (TODO)

**Criterion**: The prompt + phrase must uniquely identify what the learner should input.

**Counter-example**: 
```
PROMPT: Conjuguez le verbe au présent
PHRASE: « Nous ___ notre voiture. »
```
Problem: Which verb? The prompt doesn't say.

**Why**: Learners can't answer a question if they don't know what's being asked.

**Test**: LLM verification

**Script**: **TODO** — see TODO.md "Nonsensical questions"

**Prompt**:
```
You are a question quality checker. Given an INPUT question, determine if the 
prompt and phrase together make it clear what the learner should type.

PROMPT: {prompt}
PHRASE: {phrase}
ANSWER: {answer}

Respond SELF-CONTAINED if the question is unambiguous.
Respond UNCLEAR: <reason> if the learner cannot determine what to input.
```

---

### 3.4 INPUT: Wrong Answers Are Plausible Mistakes (TODO)

**Criterion**: Each wrong answer should be a mistake a learner might realistically make.

**Good examples**:
- Wrong person: "vendez" instead of "vendons"
- Wrong tense: "vendais" instead of "vendons"
- Wrong conjugation: "vendon" instead of "vendons"

**Bad examples**:
- Random word: "table" instead of "vendons"
- Nonsensical: "xyz123" instead of "vendons"

**Why**: Plausible distractors teach learners to recognize their own mistakes.

**Test**: LLM verification

**Script**: **TODO** — see TODO.md "LLM verification for input questions"

**Prompt**:
```
You are a language learning expert. Given a correct answer and a wrong answer,
rate how plausible this mistake is for a French learner on a scale of 1-5:
1 = Impossible mistake (random/noise)
2 = Unlikely mistake
3 = Possible mistake
4 = Common mistake  
5 = Very common mistake

Correct: {correct}
Wrong: {wrong}

Respond with just the number and a brief reason.
```

---

### 3.5 INPUT: Wrong Answer Explanations Accurate (TODO)

**Criterion**: Each wrong answer's explanation must correctly identify the error.

**Why**: Incorrect explanations teach wrong grammar rules.

**Test**: LLM verification

**Script**: **TODO**

**Prompt**:
```
You are a French grammar expert. Verify this wrong answer explanation:

Question: {prompt}
Phrase: {phrase}
Correct answer: {correct}
Wrong answer: {wrong}
Explanation: {explanation}

Is the explanation ACCURATE or INACCURATE? If inaccurate, explain why.
```

---

## 4. Pedagogical Criteria

These relate to teaching effectiveness.

### 4.1 Choice Diversity (MCQ)

**Criterion**: Choices should cover:

| Category | Target % | Example for "le" question |
|----------|----------|---------------------------|
| On-topic (correct + 1 wrong from same family) | ~50% | le (correct), la (wrong gender) |
| Adjacent topic | ~25% | un (indefinite instead of definite) |
| Left-field plausible | ~25% | du (partitive - different construct) |

**Why**: Diverse choices test broader understanding and catch different misconception types.

**Test**: LLM classification (hard to automate structurally)

**Script**: **TODO**

---

### 4.2 Question Tests Stated Rule (TODO)

**Criterion**: The question must actually test the grammar rule it claims to test.

**Counter-example from TODO.md**:
- Rule: "Adverb placement"
- Question: "Complétez avec l'adverbe « déjà »" → Phrase: "Tu as ___ fini tes devoirs ?"
- Problem: Blank is pre-positioned; user just types the adverb, doesn't demonstrate placement knowledge.

**Why**: Questions that don't test the stated rule are misleading and waste learner time.

**Test**: LLM verification

**Script**: **TODO**

---

### 4.3 No Ambiguous Open-Ended Prompts (TODO)

**Criterion**: INPUT questions must not have multiple valid answers where only one is marked correct.

**Counter-example from TODO.md**:
```
PROMPT: Complétez avec un COD approprié
PHRASE: « Le professeur explique ___ aux élèves. »
ANSWER: la leçon
```
Problem: "une règle", "un concept", "la grammaire" are all valid CODs.

**Why**: Penalizes learners who give valid but unexpected answers.

**Test**: LLM verification

**Script**: **TODO**

**Prompt**:
```
You are a French grammar expert. Is this INPUT question unambiguous?

PROMPT: {prompt}
PHRASE: {phrase}
CORRECT ANSWER: {answer}

Could there be other valid answers a learner might reasonably give?
- If yes, list 2-3 alternatives and mark AMBIGUOUS
- If no, mark UNAMBIGUOUS
```

---

### 4.4 Explanations Are Educational (TODO)

**Criterion**: Explanations should:
- State *why* an answer is correct/incorrect
- Reference the relevant grammar rule
- Avoid jargon when simpler terms work

**Why**: Explanations are the primary teaching moment after a mistake.

**Test**: LLM quality rating

**Script**: **TODO**

---

## 5. Metadata Criteria

### 5.1 GeneratedBy Field Present

**Criterion**: Every question file must declare which model generated it.

**Why**: Enables tracking of quality by source model.

**Test**: TypeScript script

**Script**: `validate-txt.ts` (warns if missing)

---

## Implementation Priority

### Already Implemented ✅

| Criterion | Script |
|-----------|--------|
| Unique ID | `validate-txt.ts` |
| Required fields | `validate-txt.ts`, `validate-content.ts` |
| MCQ choice count/correctness | `validate-content.ts` |
| No duplicate choices | `validate-content.ts` |
| Determiner family diversity | `validate-content.ts` |
| INPUT wrong answer count | `validate-txt.ts` |
| Wrong ≠ correct | `validate-content.ts` |
| Phrase has blank | `validate-txt.ts` |
| Answer has hint | `answer-hints.test.ts` |
| 80/20 ratio | `question-proportions.test.ts` |
| Elision correctness | `lint-elision.ts` |
| MCQ TRUE/FALSE verification | `verify-answers.ts` |

### High Priority TODO 🔴

1. **INPUT prompt self-contained check** — catches nonsensical questions
2. **INPUT wrong answer plausibility** — ensures quality distractors
3. **Ambiguous prompt detection** — prevents frustration

### Medium Priority TODO 🟡

4. **Grammar validity check** — catches invalid French
5. **Question-rule alignment** — ensures questions test what they claim
6. **Explanation accuracy** — ensures feedback is correct

### Low Priority TODO 🟢

7. **Choice diversity classification** — nice-to-have for quality metrics
8. **Explanation quality rating** — subjective, hard to automate

---

## Running Validation

```bash
# Structural validation (fast, no API calls)
npm run validate-content          # Compiled TS sections
npx tsx scripts/validate-txt.ts questions/fr/*.txt  # Source .txt files

# Language-specific validation
npx tsx scripts/lint-elision.ts questions/fr/*.txt  # French elision

# Semantic validation (slow, uses LLM)
npx tsx scripts/verify-answers.ts questions/fr/01-01.txt  # MCQ verification

# Test suite (includes ratio and hint checks)
npm test
```

---

## Future: Unified Validation Script

Consider creating a single command that runs all checks:

```bash
npm run validate-all
```

This would:
1. Run `validate-txt.ts` on all source files
2. Run `validate-content.ts` on compiled sections
3. Run `lint-elision.ts` on French files
4. Run test suite
5. Optionally run LLM verification (with `--llm` flag)
