# TODO

## Content generation

- **Nonsensical questions** — some generated questions are internally incoherent: e.g. an input question with PROMPT "Conjuguez le verbe au présent" but neither the PROMPT nor the PHRASE names which verb to conjugate, leaving the blank completely undefined. These pass all structural checks. Fix: adjust `scripts/verify-answers.ts` to also verify user-input questions using a different prompt that checks for self-consistency (e.g. the verb to conjugate must be identifiable from the prompt or phrase).

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

- **LLM verification for input questions** — `scripts/verify-answers.ts` currently only verifies MCQ questions (skips input questions). Extend it to also verify user-input questions using a different prompt that asks the model to check whether each prepared wrong answer is a plausible learner mistake and whether its explanation correctly identifies the error.

## Build / tooling

- **Automate TS codegen** — `src/data/fr/*.ts` files are currently compiled manually via `npm run convert-txt` and it's easy to forget after editing question source files. Options:
  - Pre-build script: add a `prebuild` (and `predev`) npm script that runs `convert-txt` for all sections, regenerating any `.ts` whose source `.txt` files are newer (check mtimes). Fast, no watcher needed.
  - Watch mode: add a `--watch` flag to `convert-txt` that re-emits a section's `.ts` whenever any of its source `.txt` files change. Run alongside `next dev`.
  - Git pre-commit hook: run codegen + `tsc --noEmit` in the existing pre-commit hook so a commit with stale `.ts` files fails loudly. Lightest-weight option but only catches it at commit time, not during dev.

## Content scale

- **Topic-sharded generation** — add a `topic` parameter to the generate-questions skill (e.g. work, travel, leisure, buying groceries, healthcare, education) so each generation batch stays within API response limits (25–50 questions) while covering the same grammar rule through varied real-world contexts. A rule like "présent des verbes en -er" could have one file per topic, all merged into the section. Lets the corpus grow incrementally without any single generation call getting too large.

## UX

- **Explanation panel polish** — the rule explanation sidebar/bottom-sheet works but needs another design pass: review spacing, typography, open/close animation smoothness, and how it interacts with different question types (especially long MCQ lists). Consider whether the interstitial trigger threshold (power < 0.20) feels right after real usage.

## Weird questions

- 10-11-005 [fr]: Suisse and Suisse aucun article the same thing?
- ~~02-02-011 [en]: indicate if it's about present/past events more clearly, everywhere~~ — fixed: added past-tense context clues to 13 ambiguous questions in 02-01 and 02-02

