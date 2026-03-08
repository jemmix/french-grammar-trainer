# Blind Verification of Question Quality

## Goal

Validate that quiz questions are unambiguous and have exactly one correct
answer — without leaking any hints about which answer is "right". This
catches:

- Multiple choices that are both grammatically valid (genuine ambiguity)
- The intended correct answer that is actually wrong
- Nonexistent or misspelled word forms used as distractors
- Incoherent sentences where the prompt doesn't fit the answer

**Important scope:** blind verification only covers what a student sees —
the prompt and answer choices. Explanation text is revealed post-answer and
is invisible to the verifier, so explanation errors are out of scope here.

## Workflow

### 1. Strip

Run `scripts/blind-verify.ts` on one or more canonical question files.
It produces two files per rule in `gen/blind-verify/`:

| File | Contents |
|------|----------|
| `<rule-id>-quiz.txt` | Prompt + shuffled choices (MCQ) or prompt + blank phrase (INPUT). No right/wrong labels, no explanations, no rule title. |
| `<rule-id>-key.json` | Answer key: question ID, type, correct answer, and (MCQ) the shuffled choice order shown. |

```bash
# Single rule
npx tsx scripts/blind-verify.ts questions/fr/01-01.txt

# Batch — pass as many files as needed
npx tsx scripts/blind-verify.ts questions/fr/01-06.txt questions/fr/01-07.txt questions/fr/01-08.txt
```

### 2. Verify (sub-agents, run in parallel)

Launch one `general-purpose` sub-agent per rule. The agent:

1. Reads the stripped quiz file
2. Answers every question independently (MCQ: pick one; INPUT: fill the blank)
3. Reads the key and compares its answers
4. Reports **only discrepancies**

Agent prompt template:

```
You are a French grammar expert taking a quiz. Read <rule-id>-quiz.txt

For each MCQ: pick the correct answer from the choices.
For each INPUT: provide the correct answer for the blank.

Then read the key at <rule-id>-key.json and compare.

Report ONLY:
- Questions where your answer differs from the key
- Genuinely ambiguous questions (multiple choices could be correct)
- Nonexistent or misspelled word forms in the choices

Return "CLEAN" if no issues.
```

Up to 5 rules can be verified in parallel in a single message.

### 3. Fix and re-verify

For each flagged issue:

- **Answer mismatch**: Either the key answer is wrong (fix the source file)
  or the model is wrong (investigate and decide).
- **Ambiguous question**: Add context to the sentence so only one answer
  fits, or replace a distractor that overlaps with the correct answer.
- **Nonexistent form**: Replace the distractor with a real (but wrong)
  French form — wrong tense, wrong person, or wrong verb.

After fixing, re-strip **only the changed files** and re-run their
sub-agents. Iterate until every rule returns "CLEAN".

### 4. Commit

```bash
git add questions/fr/<rule-id>.txt ...
git commit -m "fix: blind-verify and fix fr section XX rules YY-ZZ"
```

## What to fix vs. what to leave alone

| Issue type | Action |
|------------|--------|
| Key answer is wrong | Fix the `RIGHT ANSWER` line |
| Multiple choices both valid | Tighten the sentence for context |
| Distractor is a nonexistent form | Replace with a real wrong-form |
| Distractor is a correct alternate spelling | Replace with a different wrong-form |
| Explanation has errors | Out of scope — fix separately |
| Explanation contradicts answer | Out of scope — fix separately |

## Design notes

- **No rule/section hints** in the stripped output — the model judges
  purely from the sentence and choices, like a student would.
- **Choices are shuffled** to prevent positional bias.
- **Agent reads key itself** — no separate compare script needed; the
  agent answers first, then looks at the key, so there's no contamination.
- **Parallel agents** — running 5 rules simultaneously keeps iteration
  fast; each agent has its own isolated context.

## Files

- `scripts/blind-verify.ts` — strip script
- `gen/blind-verify/` — all generated artifacts (gitignored)
