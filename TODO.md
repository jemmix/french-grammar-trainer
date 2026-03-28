# TODO

## Content generation

- **Rule explanations for all sections** — the `Section.explanations` field is currently optional and code special-cases missing explanations (`section.explanations?.find(...)`, `explanation?.title ?? fallback`). This should be required:
  1. **Audit existing sections**: identify which sections lack `RuleExplanation[]` entries for their rules
  2. **Write missing explanations**: create pedagogical explanations (title, body, examples) for every rule in every section
  3. **Make field required**: change `explanations?: RuleExplanation[]` to `explanations: RuleExplanation[]` in `src/data/types.ts`
  4. **Remove fallback code**: delete special-casing in `src/lib/explanation-helpers.ts`, `src/components/quiz/explanation-panel.tsx`, and anywhere else that handles `undefined`
  5. **Add validation**: ensure compile-time or test-time failure if a section is missing explanations for any of its rules

- **Nonsensical questions** — some generated questions are internally incoherent: e.g. an input question with PROMPT "Conjuguez le verbe au présent" but neither the PROMPT nor the PHRASE names which verb to conjugate, leaving the blank completely undefined. These pass all structural checks. Fix: adjust `scripts/verify-answers.ts` to also verify user-input questions using a different prompt that checks for self-consistency (e.g. the verb to conjugate must be identifiable from the prompt or phrase).

- **Elision linter in blind-verify** — add mechanical string checks to `scripts/blind-verify.ts` (or a standalone `scripts/lint-elision.ts`) that flag questions where the subject+blank combo mismatches the answer's initial sound: e.g. `Je ___` + vowel-starting answer (should be `J'___`), `J'___` + consonant-starting answer (should be `Je ___`), `m'___` + consonant-starting answer (should be `me ___`), and inline verb hints like `(prendre) ___` in a PHRASE field. Pure string matching, no LLM needed. — **DONE**: linter now exists at `scripts/lint-elision.ts` with 55 unit tests.

- **Fix elision errors in content** — the elision linter found 284 issues across 240 rule files (4.7% of 6,075 questions). Most common: `j'___` + consonant answer (should be `je ___`), `n'___` + consonant answer (should be `ne ___`). Worst affected: 11-15 (56%), 07-12 (44%), 06-14 (40%). Run `npx tsx scripts/lint-elision.ts questions/fr/*.txt` to see full list. Fix requires editing source `.txt` files and recompiling TS sections.

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

- **LLM verification for input questions** — `scripts/verify-answers.ts` currently only verifies MCQ questions (skips input questions). Extend it to also verify user-input questions using a different prompt that asks the model to check whether each prepared wrong answer is a plausible learner mistake and whether its explanation correctly identifies the error.

## Infrastructure

- **S3 → DynamoDB migration** — user progress is currently stored as LZ4-compressed binary blobs in S3 (via `src/lib/s3-store.ts`). Each read/write takes hundreds of ms due to S3 latency. Migrate to Amazon DynamoDB for single-digit-ms P99 latency. Key points:
  1. Replace `s3-store.ts` with `dynamo-store.ts` implementing the same `UserStore` interface
  2. Store the 1131-byte user record as a DynamoDB attribute (well within 400KB item limit)
  3. Key schema: `userId` as partition key, no sort key needed
  4. Add `@aws-sdk/client-dynamodb` dependency, remove `@aws-sdk/client-s3`
  5. Update `src/env.js` with DynamoDB env vars (`DYNAMO_TABLE_NAME`, etc.)
  6. Consider on-demand billing mode (pay-per-request) for cost efficiency at current scale
  7. Keep SQLite store as-is for local dev

## Build / tooling

- **Prevent heavy data imports in client bundles** — after moving question data to server components, need automated checks to prevent future regressions where someone accidentally imports `~/data/*` in a client component. Options:

  1. **ESLint `no-restricted-paths`** (immediate feedback):
     - Add `eslint-plugin-import`
     - Configure rule to block imports from `src/data/*` in files matching `*-client.tsx` or containing `"use client"`
     - Pros: fails in editor + CI, fast
     - Cons: requires detecting client components reliably

  2. **`package.json` `browser` field** (runtime guard):
     ```json
     {
       "browser": {
         "./src/data/sections-index.ts": false,
         "./src/data/fr/index.ts": false,
         "./src/data/en/index.ts": false
       }
     }
     ```
     - Webpack resolves these to `false` in browser bundles
     - Pros: hard runtime block
     - Cons: no type/lint error, only fails at runtime; may not work with Next.js RSC

  3. **Bundle size CI check** (safety net):
     - Add script that fails CI if any client chunk exceeds threshold (e.g., 200KB)
     - Pros: catches any regression, not just data imports
     - Cons: only catches in CI, no editor feedback

  4. **Recommended**: combine (1) + (3) — ESLint for immediate dev feedback, bundle check as CI safety net

- **Per-language hint exceptions** — `src/data/answer-hints.test.ts` has a single `HINT_EXCEPTIONS` set applied to both `fr` and `en`. Should be split into per-language sets since English and French have different common verb answers that don't need dictionary hints (e.g. English: `write`, `walk`, `run`; French: different verbs).

- **Validation against DSL files** — `scripts/validate.ts` currently reads from compiled TypeScript (`src/data/{lang}/*.ts`), requiring `npm run compile-all` after every DSL edit before validation. Fix: have validation read directly from `questions/{lang}/*.txt` DSL files so no recompilation is needed during iterative content fixes.

- **Optimize LLM validation runner** — **DONE**: early termination on failCount >= 2, cache summary one-liner, per-attempt breakdown for no-majority cases, failures grouped by rule/question in report.

- **compile-all default language** — currently requires `--lang fr` or `--lang en` flag; default should compile all available languages to avoid accidentally validating one language's DSL while the compiled TS is stale for another. Default to `--lang all` or or make this the default.

- **DSL with LSP for question validation** — transition `questions/*.txt` and `src/data/*/*.ts` to a format with LSP support to catch structural/type inconsistencies in-editor. Options:
  - **YAML + JSON Schema** (recommended): mature ecosystem, `yaml-language-server` built into VS Code/Neovim, schema validation + autocomplete. Low effort, high ROI.
  - **Keep .txt + tree-sitter + custom LSP**: preserves current format but ~2-3 days upfront work to write grammar and LSP.
  - **TypeScript source files**: write `.ts` directly (not generated), get instant TS LSP feedback. Zero new tooling but more verbose.
  - **Zod schemas + runtime validation**: keep `.txt` format, validate at build-time. No IDE support.

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

### 02-14 INPUT questions — misleading prompts

All 5 INPUT questions (02-14-021 to 02-14-025) claim to test "placing the adverb at the right position" but the blank is already positioned correctly in the PHRASE. The user just types the adverb, not the position. Examples:
- "Complétez la phrase en plaçant l'adverbe « déjà » à la bonne place." → Phrase: "Tu as ___ fini tes devoirs ?" → Answer: "déjà"
- The user isn't demonstrating they know WHERE to place the adverb; the blank is pre-placed.

**Fix options:**
1. Simplify prompts to just "Complétez avec l'adverbe « déjà »" (honest about what's being tested)
2. Redesign to present the full sentence and ask user to rewrite with adverb (harder to validate)
3. Add more varied wrong answers that test position confusion (e.g. for short adverbs: "a déjà fini" vs "déjà a fini" vs "a fini déjà")

### 11-01 INPUT questions — open-ended prompts with single "correct" answers

- **11-01-021**: "Identifiez le COD" → Phrase has blank "une belle ___" → Answer: "symphonie". Problem: many valid CODs exist (mélodie, chanson, sonate). This tests vocabulary recall, not COD grammar.
- **11-01-024**: "Complétez avec un COD approprié" → "Le professeur explique ___ aux élèves." → Answer: "la leçon". Same problem: "une règle", "un concept", "la grammaire" are all valid.
- **11-01-025**: "Identifiez et complétez avec le COD manquant" → "Nous avons ___ hier soir et cela nous a beaucoup plu." → Answer: "un film". Problem: missing verb! Is it "avons vu"? "avons regardé"? User must guess context. Also "un repas", "un concert", "une fête" would work.

**Fix options:**
1. Make prompts more constrained: specify the verb or provide disambiguating context
2. Accept multiple valid answers (requires app changes to support alt answers)
3. Redesign as MCQ questions where all options are grammatically valid CODs but only one fits the specific context
4. For 11-01-025 specifically: add the missing verb to the phrase (e.g. "Nous avons vu ___ hier soir")

### "..." hints for ambiguous words (le/la/les/l')

The answer-hints system (`src/data/{lang}/answer-hints.ts`) maps each answer to a single hint, but words like `le`, `la`, `les`, `l'` can be either:
- **Article**: "les enfants" (the children)
- **Pronom COD**: "je les vois" (I see them)

Currently these are mapped to `"..."` as a cop-out because the system can't express ambiguity. This is unhelpful for learners.

**Fix: context-aware hints**

1. **Extend the hint format** to allow per-question overrides:
   - Option A: Add optional `hintOverride` field to INPUT questions in the .txt format
   - Option B: Change hint lookup to key on `(answer, questionId)` instead of just `answer`
   - Option C: Store hints in the question itself (remove centralized dictionary for ambiguous cases)

2. **Update answer-hints.test.ts** to validate that:
   - If a question's answer is in the ambiguous set (`le`, `la`, `les`, `l'`, `en`, `y`, `leur`, etc.), the question MUST provide a context-specific hint
   - No `"..."` hints remain in the dictionary or in questions

3. **Audit existing questions** using `...` hints:
   - Search: `grep -n '"\.\.\.":' src/data/fr/answer-hints.ts`
   - For each question using these answers, determine the correct context-specific hint
   - Examples:
     - 11-01-022: "les" as COD pronoun → hint: "pronom COD"
     - Article questions: "les" → hint: "article"

4. **Framework for disambiguation**:
   - Create `src/data/fr/ambiguous-hints.ts` listing words with multiple possible hints
   - Validation script checks that questions using ambiguous words have explicit hints
   - Generation skill prompts for context-specific hint when answer is ambiguous

