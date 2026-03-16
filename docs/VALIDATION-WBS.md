# Validation Framework WBS

## Framework Core

- [x] Predicate types (`src/validation/types.ts`)
- [x] Cache layer with nonce (`src/validation/cache.ts`)
- [x] LLM harness for opencode (`src/validation/harness.ts`)
- [x] Runner with majority voting (`src/validation/runner.ts`)
- [x] CLI (`scripts/validate.ts`)
- [x] Cache directory committed (`llm-cache/`)

## Predicates

### Non-LLM (structural, language)

- [x] `elision-correct` — French elision check
- [ ] `hint-not-trivial` — Hint doesn't reveal answer
- [ ] Migrate structural checks from `validate-content.ts`:
  - [ ] Unique question ID
  - [ ] Required fields present
  - [ ] MCQ: ≥2 choices, exactly 1 correct
  - [ ] MCQ: No duplicate choices
  - [ ] MCQ: Determiner family diversity
  - [ ] INPUT: ≥4 wrong answers
  - [ ] INPUT: Wrong ≠ correct answer
  - [ ] INPUT: Phrase contains blank
  - [ ] INPUT: Answer has hint
  - [ ] 80/20 ratio

### LLM (semantic, pedagogical)

- [x] `mcq-correct-is-true` — Verify correct answer is TRUE
- [ ] `mcq-wrong-is-false` — Verify wrong answers are FALSE
- [ ] `input-prompt-self-contained` — Prompt identifies what to input
- [ ] `input-wrong-plausible` — Wrong answers are plausible mistakes
- [ ] `input-explanation-accurate` — Wrong answer explanations correct
- [ ] `question-rule-alignment` — Question tests stated rule
- [ ] `no-ambiguous-prompts` — Single valid answer for INPUT
- [ ] `grammar-valid` — Answers are grammatically valid French/English

## Infrastructure

- [x] Cache committed to git
- [ ] GitHub CI integration
- [ ] npm script: `validate` in package.json
- [ ] Progress indicators for long runs
- [ ] JSON output mode (`--json`)

## Documentation

- [x] ACCEPTANCE-CRITERIA.md updated with framework details
- [x] This WBS file

## Future Enhancements

- [ ] Multiple LLM harnesses (claude-code, etc.)
- [ ] Cache expiry strategy
- [ ] Prompt randomization for reliability
- [ ] Signature verification for cache entries
- [ ] Cost tracking / budget limits
