# TODO

## Content generation

- **LLM validation progress** — sections 01-02 fully validated (6200 checks each, 310/310 per rule) with `glm-5.3-flash` variant `low` (now the validate.ts default, which abends on `glm-5-turbo`). Remaining: sections 03-04 (cached failures only), and a dry-run scan of sections 10-28 for cache misses. Notable fixes: PQP/futur-antérieur distractors replaced with conditionnel/person errors (unsafe list), "depuis"/time-marker tensions resolved with habitual anchors, hint-field enrichment to answer `no-ambiguous` jargon objections without disturbing `question-rule-alignment` cache keys (hint is excluded from alignment's prompt), teach-then-apply prompts for dual-auxiliary motion verbs (02-04).

- **All 28 sections generated** — sections 25-28 (expression du temps, gérondif, gallicismes, accord du participe avancé) were completed 2026-08-27, closing out the full B1 course (560 rule files, ~14k questions). Structural validation clean throughout.

- **LLM semantic validation for sections 13-20** — new content has only passed structural validation (`npx tsx scripts/validate.ts --lang fr`), not the LLM-based semantic checks. Run `npx tsx scripts/validate.ts --lang fr --llm --update-cache` batched by section when budget allows, then promote cache. Watch for "No clear majority" failures on the comparison-type rules (cf. 08-11/08-15 history in this file).

- **Elision restructure review** — 81 mixed-vowel/consonant questions across sections 10-19 were mechanically restructured (blank moved to clause start, elision-prone word absorbed into answers, e.g. « J'___ veux » → « ___ veux » with answers "J'en/Je le/Je lui/J'y"). Hints were then normalized to dictionary categories. Pedagogical spot-review recommended — the rewritten answers are longer than typical. The elision exception list (`ALLOWED_FAILING_SECTIONS`) has been removed; `scripts/lib/elision-lint-all.test.ts` is now strict for all sections.

- **Rule explanations for all sections** — the `Section.explanations` field is currently optional and code special-cases missing explanations (`section.explanations?.find(...)`, `explanation?.title ?? fallback`). This should be required:
  1. **Audit existing sections**: identify which sections lack `RuleExplanation[]` entries for their rules
  2. **Write missing explanations**: create pedagogical explanations (title, body, examples) for every rule in every section
  3. **Make field required**: change `explanations?: RuleExplanation[]` to `explanations: RuleExplanation[]` in `src/data/types.ts`
  4. **Remove fallback code**: delete special-casing in `src/lib/explanation-helpers.ts`, `src/components/quiz/explanation-panel.tsx`, and anywhere else that handles `undefined`
  5. **Add validation**: ensure compile-time or test-time failure if a section is missing explanations for any of its rules

- **Nonsensical questions** — some generated questions are internally incoherent: e.g. an input question with PROMPT "Conjuguez le verbe au présent" but neither the PROMPT nor the PHRASE names which verb to conjugate, leaving the blank completely undefined. These pass all structural checks. Fix: adjust `scripts/verify-answers.ts` to also verify user-input questions using a different prompt that checks for self-consistency (e.g. the verb to conjugate must be identifiable from the prompt or phrase).


- ~~**Fix elision errors in content**~~ DONE 2026-08-22: all elision issues fixed (restructure + elision), `ALLOWED_FAILING_SECTIONS` removed, elision lint strict and green.

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

- **LLM verification for input questions** — `scripts/verify-answers.ts` currently only verifies MCQ questions (skips input questions). Extend it to also verify user-input questions using a different prompt that asks the model to check whether each prepared wrong answer is a plausible learner mistake and whether its explanation correctly identifies the error.

## Infrastructure

- **LLM cache re-population for FR and EN** — after the 2026-07 cache reorganization (flat → two-tier hot/cold with re-keying), coverage is uneven: DE is 100% cached (8,880 hits, 0 misses), but FR is only 52% (23,409 hits / 21,546 misses) and EN is worse (2,516 hits / 4,364 misses). The gaps are entries that were either orphaned (question content drifted) or pre-reformat (system prompts changed 2026-05-21) and couldn't be re-keyed. To close: run `npx tsx scripts/validate.ts --lang <lang> --llm --update-cache --concurrency 10` per language, then `npx tsx scripts/promote-cache.ts` before committing. This is a large LLM spend — batch by section (`--section XX`) to make it tractable and reviewable.

## Architecture

- **Reduce client-side redirects** — several flows redirect from the client (e.g. login page, my-data page redirect to `/` when unauthenticated). Each client-side redirect is a full round-trip: server renders → client hydrates → client redirects → server re-renders. Move auth/redirect logic to middleware or server components where possible to eliminate the extra round-trip.

- **Reduce non-TypeScript files** — `src/next/env.js` is the only `.js` file in `src/`. Harder to reason about (no type safety, TS assertion syntax rejected). Convert to `.ts` once t3-oss/env-nextjs supports it or replace with a custom typed env validator.

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

- **Per-language hint exceptions** — `src/data/answer-hints.test.ts` has a single `HINT_EXCEPTIONS` set applied to all languages. Should be split into per-language sets since English and French have different common verb answers that don't need dictionary hints (e.g. English: `write`, `walk`, `run`; French: different verbs). Per-language hint *aliases* are already supported via `hintAliases` exports in each language's `answer-hints.ts`.

- **DSL with LSP for question validation** — transition `questions/*.txt` to a format with LSP support to catch structural/type inconsistencies in-editor. Options:
  - **YAML + JSON Schema** (recommended): mature ecosystem, `yaml-language-server` built into VS Code/Neovim, schema validation + autocomplete. Low effort, high ROI.
  - **Keep .txt + tree-sitter + custom LSP**: preserves current format but ~2-3 days upfront work to write grammar and LSP.
  - **TypeScript source files**: write `.ts` directly (not generated), get instant TS LSP feedback. Zero new tooling but more verbose.
  - **Zod schemas + runtime validation**: keep `.txt` format, validate at build-time. No IDE support.

### 01-18 INPUT questions — error-correction format for GLM-4.7

Rule 01-18 ("Le présent de narration") INPUT questions were the hardest to validate. GLM-4.7 rejects fill-in-the-blank conjugation INPUT questions with ~50% probability on question-rule-alignment, saying "only tests conjugation, not understanding of the narrative present concept."

**Solution**: Q024 uses error-correction format — the prompt states that "vainquit" is in passé simple instead of present, and the student must correct it. This frames the task as recognizing a tense mismatch (testing the concept), not just conjugating. Key prompt: "Dans ce récit au présent de narration, « vainquit » est au passé simple au lieu du présent. Conjuguez le verbe vaincre au présent pour corriger cette erreur."

Q021-Q023 and Q025 use the standard format "Complétez le récit au présent de narration." which passes with 90%+ agreement for those sentences.

### 08-11 LLM validation — question-rule-alignment unsatisfiable for comparison rules

Rule 08-11 ("subjonctif passé vs présent: simultanéité vs antériorité") fails LLM validation on ~17/25 questions. The `question-rule-alignment` predicate is fundamentally unsatisfiable for tense-comparison questions:

- **Without tense specification**: "Both subjonctif présent and passé are valid" / "Tests mood recognition, not tense choice"
- **With tense specification** ("au subjonctif présent"): "Gives away the answer, doesn't test the distinction"
- **With parenthetical hints** ("(action accomplie)"): "Non-standard terminology confuses learners"
- **With time markers** ("hier", "maintenant"): "Too obvious, trivializes the choice"

The dooming cascade (2 failures → all other predicates skipped) turns ~5 `question-rule-alignment` failures into 100+ total failures. Structural validation passes; all grammatical content is correct. May need to restructure as two separate rules (one for présent triggers, one for passé triggers) or accept partial LLM validation for comparison rules.

This same pattern will likely affect 08-12 (passé vs PC indicatif), 08-15 (concordance des temps), and 08-17 (passé vs infinitif passé).

### 08-15 LLM validation — same comparison-rule issue

Rule 08-15 ("concordance des temps avec le subjonctif passé") has the same unsatisfiable `question-rule-alignment` issue. Tried both approaches:
- **"Complétez au subjonctif passé :"** → LLM: "gives away the tense, tests formation not concordance" (184/310 pass)
- **"Complétez au subjonctif :"** → LLM: "both présent and passé are valid, ambiguous" (167/310 pass)

Content is grammatically correct, structurally validated. Committed as WIP. Rule 08-05 ("action accomplie/antérieure") covers essentially the same content and passed 310/310 with the same prompt format — the LLM treats the word "concordance" in the rule title as requiring tense selection.

## Content scale

- **Topic-sharded generation** — add a `topic` parameter to the generate-questions skill (e.g. work, travel, leisure, buying groceries, healthcare, education) so each generation batch stays within API response limits (25–50 questions) while covering the same grammar rule through varied real-world contexts. A rule like "présent des verbes en -er" could have one file per topic, all merged into the section. Lets the corpus grow incrementally without any single generation call getting too large.

## UX

- **Explanation panel polish** — the rule explanation sidebar/bottom-sheet works but needs another design pass: review spacing, typography, open/close animation smoothness, and how it interacts with different question types (especially long MCQ lists). Consider whether the interstitial trigger threshold (power < 0.20) feels right after real usage.

### 01-12 validation — pedagogical note on nous/vous pronominal questions

Fill-in-the-blank questions with nous/vous subjects for pronominal verbs are structurally problematic: the reflexive pronoun is identical to the subject pronoun (nous nous, vous vous), so when the pronoun is pre-filled, the question reduces to a conjugation exercise. LLM validators (and arguably students) can't demonstrate pronominal verb knowledge from such questions. Q004 (nous/se lever), Q005 (vous/se promener), Q010 (nous/se souvenir), Q017 (nous/se souvenir), Q023 INPUT (nous/se souvenir) still use this format and pass validation by majority, but they're weaker pedagogically than questions where the reflexive pronoun differs from the subject (je→me, tu→te, il→se).

## Weird questions

- 10-11-005 [fr]: Suisse and Suisse aucun article the same thing?

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


