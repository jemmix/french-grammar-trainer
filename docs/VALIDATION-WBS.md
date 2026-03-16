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
- [ ] Migrate structural checks from `validate-content.ts`:
  - [ ] Required fields present
  - [ ] MCQ: ≥2 choices, exactly 1 correct
  - [ ] MCQ: No duplicate choices
  - [ ] MCQ: Determiner family diversity
  - [ ] INPUT: ≥4 wrong answers
  - [ ] INPUT: Wrong ≠ correct answer
  - [ ] INPUT: Phrase contains blank
  - [ ] INPUT: Answer has hint
  - [ ] 80/20 ratio

Note: "Unique question ID" removed — already enforced by DSL parser, not a predicate

### LLM (semantic, pedagogical)

- [x] `mcq-correct-is-true` — Verify correct answer is TRUE
- [ ] `mcq-wrong-is-false` — Verify wrong answers are FALSE
- [ ] `input-prompt-self-contained` — Prompt identifies what to input (provide answer as hint to LLM)
- [ ] `input-wrong-plausible` — Wrong answers are plausible mistakes
- [ ] `input-explanation-accurate` — Wrong answer explanations correct
- [ ] `question-rule-alignment` — Question tests stated rule
- [ ] `no-ambiguous-prompts` — Single valid answer for INPUT
- [ ] `grammar-valid` — Answers are grammatically valid French/English
- [ ] `hint-not-trivial` — LLM check (hint=answer valid when answer IS dictionary form; e.g., English 1sg present = infinitive)
- [ ] `not-ridiculous` — Generic sanity check: "Is this a reasonable language learning exercise?"

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
