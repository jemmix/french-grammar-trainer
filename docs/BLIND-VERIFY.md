# Blind Verification of Question Quality

## Goal

Validate that quiz questions are unambiguous and have exactly one correct
answer — without leaking any hints about which answer is "right". This
catches questions where:

- Multiple choices are grammatically valid (genuine ambiguity)
- The intended correct answer is actually wrong
- The question is unclear or under-specified

## How it works

### 1. Strip (`scripts/blind-verify.ts`)

The script reads a canonical question file (`questions/fr/<rule-id>.txt`)
and produces two files in `gen/blind-verify/`:

| File | Contents |
|------|----------|
| `<rule-id>-quiz.txt` | What the student sees: prompt + shuffled choices (MCQ) or prompt + blank sentence (INPUT). No right/wrong labels, no explanations, no rule title. |
| `<rule-id>-key.json` | Answer key for later comparison: question ID, type, correct answer, and (for MCQ) the shuffled choice order. |

```bash
npx tsx scripts/blind-verify.ts questions/fr/02-10.txt
# → gen/blind-verify/02-10-quiz.txt
# → gen/blind-verify/02-10-key.json
```

Multiple files can be passed at once.

### 2. Verify (Claude Code sub-agent)

The stripped quiz file is fed to a Sonnet sub-agent with these instructions:

- **MCQ**: list ALL choices that could be considered correct (there may be
  more than one)
- **INPUT**: provide the correct answer
- **Unclear**: respond with `UNCLEAR` if the question is genuinely
  ambiguous

The sub-agent writes structured output to
`gen/blind-verify/<rule-id>-response.txt`:

```
ID: 01-01-001
CORRECT: parle

ID: 01-01-002
CORRECT: achètes

ID: 01-01-003
UNCLEAR: multiple tenses could work without more context
```

### 3. Compare

The response is compared against the answer key. Interesting outcomes:

| Status | Meaning |
|--------|---------|
| **match** | Model picked exactly our correct answer, nothing else |
| **extra-correct** | Model found additional valid answers among the choices — question may be ambiguous |
| **missed-correct** | Model didn't pick our answer — question or answer may be wrong |
| **unclear** | Model flagged the question as ambiguous |
| **missing** | Model didn't respond for this question |

### What to do with the results

- **extra-correct**: Review whether the extra answer is genuinely valid. If
  so, the question needs rewriting to disambiguate. If the model is wrong,
  the question is fine.
- **missed-correct**: Likely a bug in the question or our answer key.
  Investigate immediately.
- **unclear**: Check if the question really is ambiguous. Rewrite if needed.
- **match on everything**: The rule is clean. Move on.

## Design choices

- **No rule/section hints** in the stripped output — the model must judge
  purely from the sentence and choices, just like a student would.
- **Shuffled choices** — prevents positional bias.
- **"Play pretend" multiple-correct** — asking the model to consider
  multiple valid answers is the key insight. A model that's told "pick the
  one right answer" will always pick one, even if two are valid. Asking for
  all valid options surfaces ambiguity.
- **Sub-agent isolation** — the verifier runs as a separate Claude Code
  agent so it has no access to the answer key or the original question
  file with markings.

## Files

- `scripts/blind-verify.ts` — strip script
- `gen/blind-verify/` — all generated artifacts (gitignored)
