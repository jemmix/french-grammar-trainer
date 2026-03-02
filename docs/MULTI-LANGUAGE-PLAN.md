# Multi-Language Support — Build-Time Language Selection

## Goal

Make the grammar trainer deployable for any language, selected at build time.
Each deployment serves exactly one language — no runtime switching. English (B1)
is the first addition. The French/Le Monde aesthetic stays for all languages.

---

## Design Principles

1. **One env var decides everything**: `NEXT_PUBLIC_LANG` (e.g. `fr`, `en`).
   Defaults to `fr` so the existing French deployment is unaffected.
2. **No i18n library** — a single static import picks the right string bundle at
   build time. The app is never multilingual at runtime.
3. **Same structural constraints for every language**: 28 sections, 20 rules per
   section, same ID scheme (`NN-slug`, `NN-NN`, `NN-NN-NNN`).
4. **Shared infrastructure, separate content**: progress blob format, API routes,
   auth, quiz engine, and components are language-neutral. Only string bundles,
   section data files, and table-of-contents files are per-language.

---

## File Layout (target state)

```
src/
  lang/
    types.ts              # LangStrings interface (every UI string keyed)
    index.ts              # reads NEXT_PUBLIC_LANG, re-exports the right bundle
    fr.ts                 # French string bundle (extracted from current code)
    en.ts                 # English string bundle
  data/
    types.ts              # (unchanged — Section, Question, etc.)
    sections-index.ts     # now imports from the right lang dir (see below)
    fr/                   # renamed from sections/
      01-present-indicatif.ts
      ...
    en/
      01-present-simple.ts
      ...

questions/
  fr/                     # renamed from questions/
    01-01.txt ...
  en/
    01-01.txt ...

content/
  fr/
    TABLE_OF_CONTENTS.md  # current file, moved here
  en/
    TABLE_OF_CONTENTS.md  # English B1 grammar ToC (28 sections × 20 rules)
```

### Why not `src/data/sections/{lang}/`?

The `sections-index.ts` barrel already does static imports. Keeping the per-language
directories at `src/data/fr/` and `src/data/en/` means the barrel can be a thin
conditional re-export and tree-shaking eliminates the unused language entirely.

---

## Implementation Steps

### Phase 1 — Extract UI strings into a lang bundle

**Goal**: zero behavioral change; all French strings move from JSX literals into a
typed `LangStrings` object, imported via `src/lang/index.ts`.

1. **Define `LangStrings` type** in `src/lang/types.ts`.
   Every UI string currently hardcoded becomes a named key. Group by page/domain:
   - `home.*` — index page strings
   - `quiz.*` — quiz chrome (question N, next, feedback messages)
   - `score.*` — score summary
   - `login.*`, `privacy.*`, `myData.*`, `denied.*`, `goodbye.*`
   - `tier.*` — tier labels and promo strings from constants.ts
   - `meta.*` — page titles, language name, level label

2. **Create `src/lang/fr.ts`** implementing `LangStrings` with all current French
   strings extracted verbatim.

3. **Create `src/lang/index.ts`**:
   ```ts
   import type { LangStrings } from "./types";
   const lang = process.env.NEXT_PUBLIC_LANG ?? "fr";
   // Static imports + conditional re-export for tree-shaking
   import fr from "./fr";
   import en from "./en";
   const bundles: Record<string, LangStrings> = { fr, en };
   export const t: LangStrings = bundles[lang] ?? fr;
   ```
   (Exact mechanism may vary — the key constraint is that the unused bundle is
   eliminated at build time. If Next.js doesn't tree-shake the record approach,
   we fall back to a dynamic `import()` resolved at build time in
   `next.config.js` via webpack aliases.)

4. **Replace every hardcoded string** in pages and components with `t.some.key`.
   This is the bulk of the work — ~15 files, ~150+ string sites.

5. **Move tier labels/promos** from `constants.ts` into the lang bundle.

6. **Create `src/lang/en.ts`** — stub with English translations of all UI chrome.
   This is straightforward since the UI strings are short labels/messages.

7. **Add `NEXT_PUBLIC_LANG`** to `src/env.js` schema (optional enum `fr | en`,
   default `fr`) and to `next.config.js` `runtimeEnv`.

**Commit checkpoint**: app works identically with `NEXT_PUBLIC_LANG=fr` (default).
Setting `NEXT_PUBLIC_LANG=en` shows English chrome but still French questions.

### Phase 2 — Per-language section data and content directories

1. **Move section data**: `src/data/sections/` → `src/data/fr/`.

2. **Move question sources**: `questions/` → `questions/fr/`.

3. **Move ToC**: `TABLE_OF_CONTENTS.md` → `content/fr/TABLE_OF_CONTENTS.md`.

4. **Rewrite `sections-index.ts`** to import from the correct language directory.
   Since Next.js builds statically, a build-time env var can select the import
   source. Two options (pick the simpler one that tree-shakes):

   - **Option A — two barrel files**: `src/data/fr/index.ts` and
     `src/data/en/index.ts` each export `loadedSections` and `meta`. The main
     `sections-index.ts` conditionally re-exports based on `NEXT_PUBLIC_LANG`.

   - **Option B — dynamic import in `getStaticProps`**: each page that needs
     sections calls `await import(\`../data/${lang}/index\`)`. This guarantees
     tree-shaking but changes the data-loading pattern.

   Option A is simpler and preserves the current import-at-module-scope pattern.

5. **Update generation scripts** to accept a `--lang` flag:
   - `generate-section.ts` reads from `content/{lang}/TABLE_OF_CONTENTS.md`
   - `convert-txt.ts` outputs to `src/data/{lang}/` and loads
     language-specific validators (e.g. `DETERMINER_FAMILIES` becomes a
     per-language config)
   - `split-txt.ts` and `merge-txt.ts` need no changes (language-neutral)

6. **Update `CLAUDE.md`** workflow instructions with the new paths.

**Commit checkpoint**: French deployment still works. Directory structure is
language-aware. Scripts accept `--lang`.

### Phase 3 — English content: ToC and question generation

1. **Write `content/en/TABLE_OF_CONTENTS.md`** — 28 sections of English B1
   grammar, 20 rules each. Suggested topic list (aligned to CEFR B1):

   ```
   01  Present Simple & Continuous
   02  Past Simple
   03  Past Continuous
   04  Present Perfect Simple
   05  Present Perfect Continuous
   06  Past Perfect
   07  Future Forms (will, going to, present continuous)
   08  Conditionals (zero, first, second)
   09  Third Conditional & Mixed Conditionals
   10  Modal Verbs (can, could, may, might, must, should)
   11  Passive Voice
   12  Reported Speech
   13  Relative Clauses (defining & non-defining)
   14  Articles (a, an, the, zero article)
   15  Quantifiers (some, any, much, many, few, little)
   16  Comparatives & Superlatives
   17  Adjective Order & Position
   18  Adverbs (formation, position, degree)
   19  Prepositions of Time & Place
   20  Phrasal Verbs (common B1 set)
   21  Gerunds & Infinitives
   22  Question Formation & Tag Questions
   23  Conjunctions & Linking Words
   24  Countable & Uncountable Nouns
   25  Subject–Verb Agreement
   26  Pronouns (personal, reflexive, indefinite)
   27  Word Order & Sentence Structure
   28  Common Confusions (make/do, say/tell, used to/be used to)
   ```

2. **Generate English questions** using the standard pipeline:
   `npx tsx scripts/generate-section.ts --lang en 01-01:01-20` etc.
   The generation skill prompt needs a language-aware variant that produces
   English grammar exercises with English UI text.

3. **Compile and register** all 28 English sections.

4. **Update the `/generate-questions` skill** (or create a parallel
   `/generate-questions-en` skill) with English-specific prompt templates,
   including English grammar terminology and exercise patterns.

**Commit checkpoint**: `NEXT_PUBLIC_LANG=en` produces a fully functional English
grammar trainer.

### Phase 4 — Loose ends and polish

1. **HTML `lang` attribute**: set `<html lang={lang}>` in `_document.tsx` based
   on `NEXT_PUBLIC_LANG`.

2. **`<title>` and meta tags**: driven by the lang bundle (`t.meta.title`).

3. **Validation**: extend `DETERMINER_FAMILIES`-style validators per language, or
   make them optional for languages where the concept doesn't apply.

4. **CI/deployment**: add a build matrix or separate deploy configs that set
   `NEXT_PUBLIC_LANG`. Each language gets its own deployment URL.

5. **Documentation**: update README to explain multi-language builds.

---

## What Stays the Same

- Progress blob format (28 × 20 = 560 slots, uint16 EWMA) — identical for all
  languages. A user's progress is language-specific because each deployment has
  its own database.
- API routes (`/api/session`, `/api/progress`, `/api/auth/*`) — no changes.
- Quiz engine (`quiz-helpers.tsx`, `mcq-question-view.tsx`,
  `input-question-view.tsx`) — no logic changes, only string references change.
- Tailwind styles, layout, fonts — identical. The French/Le Monde aesthetic is
  the brand, not a language choice.
- Auth flow (dev login, session cookies) — unchanged.
- Question/section/rule ID format — unchanged (`NN-slug`, `NN-NN`, `NN-NN-NNN`).
  Only the slug portion of section IDs varies by language.

## What Changes

| Area | Before | After |
|------|--------|-------|
| UI strings | Hardcoded French in JSX | `t.key` from lang bundle |
| Section data | `src/data/sections/*.ts` | `src/data/{lang}/*.ts` |
| Question sources | `questions/*.txt` | `questions/{lang}/*.txt` |
| Table of contents | `TABLE_OF_CONTENTS.md` | `content/{lang}/TABLE_OF_CONTENTS.md` |
| Build config | No lang env var | `NEXT_PUBLIC_LANG=fr\|en` |
| Scripts | No `--lang` flag | `--lang` flag on generate/convert |
| `sections-index.ts` | Direct imports | Conditional per-language barrel |
| Page titles | Hardcoded | From lang bundle |
| `<html lang>` | Unset | Set from env var |

---

## Effort Estimate by Phase

| Phase | Scope | Size |
|-------|-------|------|
| 1 — Extract strings | ~15 files, ~150 string sites, 3 new files | Medium |
| 2 — Restructure dirs | Move files, update imports, update scripts | Small |
| 3 — English content | Write ToC, generate 560 rules of questions | Large (mostly generation time) |
| 4 — Polish | HTML lang, meta, CI, docs | Small |

Phases 1–2 are prerequisites. Phase 3 is the big content push. Phase 4 is
cleanup that can happen any time after phase 1.

---

## Open Questions

1. **Deployment model**: separate Vercel projects per language, or one project
   with build-arg variants? (Separate projects is simpler and avoids any
   runtime branching.)

2. **Shared progress DB vs. separate**: if deployments share a database, a user
   logging into both the French and English trainers would have their progress
   blobs collide (same slot positions, different content). Separate databases
   per deployment is the safe default.

3. **Generation skill**: duplicate the skill per language, or parameterize the
   existing one? Parameterizing is cleaner but the prompt differences between
   French and English grammar exercises may be substantial enough to warrant
   separate skills.
