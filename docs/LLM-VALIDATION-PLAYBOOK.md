# LLM Validation Playbook

Practical patterns and gotchas discovered while validating French grammar questions through the LLM validator (`npx tsx scripts/validate.ts --llm`). This is a living document — update it as new patterns emerge.

## Core Principles

1. **Push until the entire rule passes cleanly.** "No clear majority" is a real failure, not a warning. A rule is not done until every predicate passes on every question. Don't stop at "I improved things a lot" — keep iterating until the score is `310/310` (or whatever the per-rule total is) with zero failures.

2. **When a rule feels like a catch-22 or systemic impossibility, slow down.** "Unsatisfiable rules" are essentially never actually unsatisfiable — they're a signal that you're missing something. Effectiveness beats efficiency here:
   - **Brainstorm before editing.** Write out multiple competing hypotheses for why the LLM keeps failing (rule title, prompt wording, time-marker semantics, trigger-choice, question structure, the LLM's confusion with adjacent constructions).
   - **Review previous material.** Look at rules that already pass — what patterns do they use? Section 08's INPUT prompts and "hier"-marker strategies were discovered by studying what worked, not by theory.
   - **Test hypotheses one at a time.** If you change 5 things in one shot, you won't know which one fixed (or broke) it. Make a single targeted edit, re-validate the one question, observe, iterate.
   - **Title matters more than you'd think.** "vs" in a rule title makes the LLM reject INPUT that doesn't present both options as choices. Broaden to "emplois" or "(présent et passé)".
   - **Some LLM "rules" aren't real grammar rules — they're LLM quirks.** E.g., "pourvu que" + "hier" is consistently rejected as a temporal contradiction even though it's grammatically fine. Work around it (use futur-leaning wishes) rather than fighting it.

3. **No section is "grandfathered" once you touch it.** When you start work on a section, **remove it from `ALLOWED_FAILING_SECTIONS`** in `scripts/lib/elision-lint-all.test.ts` and fix every elision issue. Elision bugs are real bugs; the exception list is only for sections that haven't been re-validated yet.

4. **Never clear the cache.** The cache is content-addressable — cache keys are derived from question content, so editing a question auto-invalidates the old entry and writes a fresh one on the next run. Clearing the cache throws away perfectly good `cold/` entries, forcing re-runs of API calls you already paid for. Redundant `hot/` entries are cleaned up automatically by `promote-cache.ts` (hot wins on conflict, dedupes by nonce, then clears `hot/`). There are no upsides to manual cache clearing.

5. **Be proactive.** When a rule is done (validated, promoted, committed, pushed), start the next one without asking. The end goal is "section N fully done" — every rule, 310/310, cache promoted, pushed. Don't pause between rules.

## Core Commands

```bash
# Full LLM validation (1 rule, generous timeout)
npx tsx scripts/validate.ts --lang fr --rule XX-YY --llm --update-cache --model glm-5-turbo

# Single question validation (faster, for testing fixes)
npx tsx scripts/validate.ts --lang fr --rule XX-YY --question XX-YY-XXX --llm --update-cache --model glm-5-turbo

# Structural-only validation (fast, no LLM)
npx tsx scripts/validate.ts --lang fr --rule XX-YY
```

Always use a generous shell-level timeout when running full-rule validation (e.g. run the command in a separate terminal with no idle timeout). API timeouts happen — just retry the same command; the cache persists.

## Workflow

1. Write/edit the `.txt` DSL file
2. Fix answer-hints if needed (validation errors will tell you)
3. Structural validation first — fix elision, count, format issues
4. LLM validation — fix failures with targeted edits
5. Run `npx tsx scripts/promote-cache.ts` to fold fresh `hot/` responses into the gzipped `cold/` store, then `git add questions/ src/data/ llm-cache/ && git commit && git push`

**Golden rule**: Write the file ONCE, then only edit failing questions. Never rewrite the entire file when doing targeted fixes.

## The Flakiest Predicates ( ranked by false-positive rate)

1. **`mcq-wrong-is-false`** — #1 flaky predicate (~10-20% false positive rate). The LLM often accepts wrong answers as "also correct in another context." Solution: use clearly different-tense/category wrong answers.
2. **`no-ambiguous-prompts`** — The LLM finds creative ways to interpret prompts as ambiguous. Solution: be explicit about what tense/mood to use.
3. **`input-explanation-accurate`** — The LLM nitpicks explanation wording. Solution: avoid overbroad grammar claims.
4. **`grammar-valid`** — Sometimes the LLM disagrees with correct French grammar. Solution: use standard, uncontroversial constructions.
5. **`question-rule-alignment`** — Fails if wrong answers don't include the "opposite" of what's being tested (e.g., imparfait questions need PC wrong answers for imparfait-vs-PC rules).

## Safe vs Unsafe Wrong Answers

### Safe (LLM almost always rejects)
- Futur simple (je mangerai, ils iront)
- Conditionnel présent (je mangerais, ils iraient) — except for suggestion/discours-indirect rules
- Infinitif (manger, aller)
- Participe passé (mangé, allé)
- Passé simple (mangeai, allai) — literary tense, clearly wrong in modern contexts
- Wrong person/number (mangeons for je, mange for ils) — if plausible learner error

### Unsafe (LLLM often accepts as alternatives)
- **Passé composé** — LLM accepts PC for almost any past-tense sentence, especially with state/duration verbs
- **Plus-que-parfait** — LLM accepts PQP as valid alternative for anteriority, especially with "depuis", "pendant", narrative contexts
- **Imparfait** — LLM accepts imparfait as valid for PC sentences (the reverse is also true)
- **Présent** — LLM accepts présent as valid colloquial alternative in suggestion ("Si on va au cinéma ?") and some other contexts
- **Conditionnel** (for suggestion rules) — LLM claims conditionnel is "the real" suggestion tense

## Rule-Specific Patterns

### Imparfait vs Passé Composé rules (tense-choice rules)

The fundamental tension: the LLM accepts BOTH imparfait and passé composé for most past-tense sentences. Two competing requirements:
1. `mcq-wrong-is-false`: LLM accepts imparfait as valid for PC sentences
2. `question-rule-alignment`: LLM requires the opposite tense as a wrong answer option

**Winning strategy for PC-correct questions:**
- Use **"en X temps"** with accomplishment verbs (rédiger, courir, refaire, peindre, terminer, finir, remplir)
- Add explicit **past context markers**: "L'an dernier", "Hier", "En 2015"
- Use **inherently unique events**: "pour la première fois", "son premier marathon"
- Use **"soudain"** for sudden events

**Winning strategy for imparfait-correct questions:**
- Add **habitual markers**: "souvent", "toujours", "tous les jours", "chaque été"
- Add **past context markers**: "Autrefois", "À cette époque", "Quand il était jeune"
- Include **PC as wrong answer** (NOT person-agreement wrong answers) — LLM requires seeing the opposite tense
- AVOID using wrong-person conjugations as primary wrong answer — LLM says question doesn't test the rule

**Things to AVOID:**
- "pendant X ans, puis..." — LLM accepts imparfait here
- Weather sentences — ambiguous
- "depuis" as duration marker (belongs to its own rule)
- Double blanks in INPUT questions

### Imparfait + "depuis" (03-18)

The LLM considers PC and PQP as acceptable alternatives with "depuis". Use futur/conditionnel as wrong answers instead of PC/PQP. Also avoid "aller mal" (vocabulary confusion — the LLM doesn't recognize the idiom).

### Discours indirect au passé (03-19)

- Fix elision: "j'___" / "c'___" with answers starting with consonants
- Don't use "Transformez en discours indirect" for sentences already in indirect speech — use "Conjuguez le verbe à l'imparfait pour compléter cette phrase au discours indirect"
- Don't say "Le conditionnel s'utilise pour le futur" in explanations — the LLM flags this as factually inaccurate. Use "Le conditionnel remplace le futur du discours direct, pas le présent" instead
- Don't use présent as a wrong answer for MCQ — the LLM accepts it via the "still true" exception. Replace with PQP or futur

### Imparfait de suggestion (03-20)

The hardest rule to validate. The LLM often claims imparfait isn't used for suggestions (it insists conditionnel is correct).

**Critical patterns:**
- Use explicit prompts: "Conjuguez à l'imparfait pour former une suggestion : ..." — NOT just "Complétez"
- DON'T use présent as wrong answer — LLM accepts "Si on va au cinéma ?" as valid colloquial French
- Use passé composé / futur simple as wrong answers instead
- Avoid "si nous" — use "si on" instead (LLM gets confused about conjugation person)
- For INPUT questions, name the verb explicitly: "Conjuguez le verbe « prendre » à l'imparfait..."
- Avoid unidiomatic collocations: "visiter au musée" → "aller au musée", "voir un concert" → "donner/écouter un concert"
- Don't say "Le conditionnel ne s'emploie pas après si" — too broad. Use "Le conditionnel ne s'emploie pas dans la proposition « si on » + verbe pour faire une suggestion"

### Imparfait de politesse (03-10)

Use conditional as wrong answers — the LLM clearly rejects them. Avoid passé composé.

### Imparfait dans hypothèses avec si (03-11)

Must include conditionnel as wrong answers to satisfy `question-rule-alignment`. The "si + imparfait → conditionnel" structure is well-known so the LLM is more cooperative.

### -ier verbs (03-04)

LLM doesn't recognize "modifier", "vérifier", "parier" as ending in "-ier". Use obviously -ier verbs: étudier, crier, copier, confier, envier, nier, skier.

### Pronominal verbs (03-05)

Avoid "nous/vous" subjects in MCQ questions — the reflexive pronoun is identical to the subject pronoun, causing LLM confusion. Use je/tu/il/elle/ils/elles instead. For INPUT questions, add "(incluez le pronom réfléchi)" to the prompt.

## INPUT Question Patterns

### Prompt format
- **Good**: "Conjuguez le verbe à l'imparfait pour exprimer..." / "Conjuguez le verbe « X » à l'imparfait..."
- **Bad**: "Complétez" / "Remplissez" (too vague) / "Transformez en discours indirect" (misleading when sentence is already in indirect speech)
- **Bad**: "Conjuguez le verbe au temps approprié" (fails `no-ambiguous-prompts` — which tense?)
- **Bad**: "Conjuguez le verbe au passé composé" for tense-choice rules (gives away the answer)
- **OK for tense-choice**: "Conjuguez le verbe à l'imparfait ou au passé composé selon le contexte."
- **Best for mood-trigger rules** (e.g., subjonctif after "pour que"): "Indicatif ou subjonctif ? Conjuguez le verbe." — names the choice without giving away the answer; passes both `no-ambiguous-prompts` and `question-rule-alignment` reliably (3/3 first try). Works for both MCQ and INPUT questions (use "Indicatif ou subjonctif ? Choisissez la bonne forme du verbe." for MCQ).

### Wrong answers
- Minimum 4 required by compile-time validation
- Include: présent, futur/conditionnel, infinitif, participe passé — safe categories
- Each wrong answer needs its own explanation
- Explanations must be factually precise — the LLM catches overbroad claims

### Elision in INPUT
- "je ___" → all answers must start with consonant (or use "il/elle" instead)
- "j'___" → all answers must start with vowel
- "c'___" → all answers must start with vowel
- "n'___" → all answers must start with vowel
- The structural validator catches these (`elision-correct` predicate)

### hint-not-trivial
- The right answer (as consecutive words) must NOT appear in the prompt/phrase text
- E.g., "étions" can't appear in "nous étions enfants" if it's the answer

### No double blanks
- Each INPUT question should have exactly one blank
- "étais, étais" is code smell — restructure the question

## Explanation Writing Tips

1. **Be precise, not overbroad**: Don't say "Le conditionnel ne s'utilise jamais après si" — say "Le conditionnel ne s'emploie pas dans cette structure"
2. **Don't make claims about what a tense is "for"**: The LLM will find counterexamples. Describe what's correct in this specific context.
3. **Match the explanation to the actual sentence**: Leftover explanation text from editing gets caught by `input-explanation-accurate`
4. **Name the tense/mood explicitly**: "Le présent", "Le conditionnel", "Le passé composé" — not just "cette forme"

## Common Structural Validation Errors

| Error | Fix |
|-------|-----|
| `elision-correct` | Change subject to match answer vowel pattern, or rewrite answers |
| `INPUT must have at least 4 wrong answers` | Add more wrong answers |
| Missing answer-hint | Add entry to `src/data/fr/answer-hints.ts` |

## Commit Pattern

After each rule passes full validation (e.g. `310/310`):

```bash
npx tsx scripts/promote-cache.ts --lang fr && \
git add questions/fr/XX-YY.txt src/data/fr/answer-hints.ts llm-cache/ && \
git commit -m "Rewrite XX-YY (rule title) — 310/310 validated" && \
git push
```

Always include `llm-cache/` — it's content-addressable and must be committed with each rule. Run `promote-cache` first so the committed cache lives in `cold/` (compact gzipped JSONL), not `hot/` (loose JSON files).

If the rule's section was previously in `ALLOWED_FAILING_SECTIONS`, also stage the test file change (`scripts/lib/elision-lint-all.test.ts`) in the same commit and mention it in the message.
