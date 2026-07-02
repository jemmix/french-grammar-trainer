# French Grammar Trainer — Project Guidelines

## Language Policy
- **App interface & grammar content**: In the target language of the deployment (`NEXT_PUBLIC_LANG`, default `fr`)
- **Code, comments, commit messages, docs (PLAN.md, README, etc.)**: English
- **`content/{lang}/TABLE_OF_CONTENTS.md` and other course material files**: In the target language

## Workflow
- **Course material / ToC changes**: Commit and push without asking — these are safe to land unattended
- **Code changes**: Commit and push liberally — user reviews post factum
- **Skill changes** (`.claude/skills/**`): Commit and push liberally — treat like code changes
- **CLAUDE.md**: Update liberally to reflect user preferences and vibes as they emerge
- **TODO.md**: Note bugs, UX gaps, content quality issues, and ideas liberally — don't wait for the user to ask. Anything worth remembering for later goes here. **Commit and push TODO.md immediately after every update** — don't batch it with other work.

## Question Generation Workflow

### Directory layout
- `gen/` — **gitignored** scratch directory for all temp files during generation
- `questions/{lang}/<rule-id>.txt` — canonical question source files, one per rule (committed); read at runtime by `src/data/loader.ts`
- `src/data/{lang}/index.ts` — section metadata + barrel that calls `loadSectionsFromDsl()` to build `Section[]` from the DSL files
- `content/{lang}/TABLE_OF_CONTENTS.md` — course outline, one per language (committed)

### Subagent type for generation
Always use **`general-purpose`** subagents (not `Bash`) for question generation. General-purpose agents have the Write tool and write files directly. Bash agents lack the Write tool — if used, the generated content stays trapped in the agent transcript, forcing the parent to read that transcript into context and re-write the file, doubling token cost and risking context compaction.

### Steps
1. **Generate** — run the generation script in a **separate terminal** (not as a sub-agent):
   ```
   npx tsx scripts/generate-section.ts <sec>-01:<sec>-20 [--lang fr]
   ```
   The script reads rule titles from `content/{lang}/TABLE_OF_CONTENTS.md`, launches parallel Haiku instances (default concurrency: 10), and writes raw files to `gen/<rule-id>.txt`. Use `--dry-run` to preview commands. Logs go to `gen/generate-section-logs/`.
2. **Split** — `npm run split-txt -- gen/<rule-id>.txt ...` → produces `gen/<rule-id>-passed.txt` + `gen/<rule-id>-failed.txt`
3. **Fix** — manually correct failed questions, save as `gen/<rule-id>-fixed.txt` (remove `VALIDATION ERROR:` lines)
4. **Merge** — `npm run merge-txt -- --output questions/{lang}/<rule-id>.txt gen/<rule-id>-passed.txt [gen/<rule-id>-fixed.txt]` (later files override earlier for duplicate IDs)
5. **Register** — add a metadata entry to `meta` in `src/data/{lang}/index.ts` (id, title, description). The runtime loader picks up all `.txt` files in `questions/{lang}/` automatically — no compile step.
6. **Commit** — `git add questions/ src/data/ .gitignore`, commit and push (temp files in `gen/` are never tracked)

## LLM Validation Cache

The `llm-cache/` directory is **content-addressable**: cache keys are computed from question content (`predicateId:questionId:systemPrompt:userPrompt`), so editing questions automatically invalidates old entries and generates new ones on the next run.

### Two-tier layout

- **`llm-cache/hot/{lang}/{section-rule}/{key}.json`** — writable generation. `validate --update-cache` writes one JSON file per fetched response here.
- **`llm-cache/cold/{lang}/{section-rule}.gz`** — read-only, gzipped JSONL (one compact `CacheEntry` per line). Looked up via an in-memory `Map` per cold file, LRU-cached at ~50MB steady-state.

`loadCacheEntry` checks hot first, then cold. There is no need to manually clear or prune cache entries after fixing questions.

### Promoting hot → cold

After `validate --update-cache` runs, freshly fetched responses sit in `hot/`. Compact them into `cold/`:

```bash
npx tsx scripts/promote-cache.ts            # all languages
npx tsx scripts/promote-cache.ts --lang fr  # one language
npx tsx scripts/promote-cache.ts --dry-run  # preview only
```

This merges each hot bucket into its cold `.gz` file (hot wins on conflict, responses deduped by nonce), then clears `hot/`. Run this before committing cache changes.

## Validation Gotchas
- **Validation reads DSL directly** — `scripts/validate.ts` and `scripts/validate-content.ts` load questions via `loadSectionsFromDsl()` from `questions/{lang}/*.txt`. Edits to DSL files are visible immediately; no compile step.
- **Validation exit code** — the script exits 1 on any failure, including borderline "No clear majority" results. This is intentional. "No clear majority" is a real failure, not a warning — fix it by redoing the content until all checks pass cleanly. Don't stop at "I improved things a lot."

## Content Quality Rules

### General
- Target **80% MCQ / 20% user-input** split across all content
- Wrong answers must be plausible mistakes, not padding
- Mark every question with `generatedBy` (model name, e.g. "opus")
- Run `npm run validate-content` before committing question data

### MCQ questions (`type: "mcq"`)
- Aim for **4 choices** per question as the default. 2-3 is fine when more would feel forced; 5 is fine for "which sentence is correct" questions
- **No duplicate or near-duplicate choices**: max 2 from the same determiner/grammar family
- **Choice diversity formula** (target for each question):
  - ~Half the choices should be **on-topic** (correct answer + a wrong answer from the same grammar family that tests a specific within-topic distinction, e.g. wrong gender, wrong elision)
  - ~One choice from an **adjacent topic** (e.g. indefinite instead of definite, imparfait instead of passé composé)
  - ~One choice that's **left-field plausible** — a different grammar construct entirely that a learner might confuse with the right answer (e.g. a partitive, a possessive, a contraction)

### User-input questions (`type: "input"`)
- Two separate fields: `prompt` (brief instruction, e.g. "Conjuguez le verbe au présent") and `phrase` (sentence with blank, e.g. `"« Je ___ avec mes amis. »"`)
- The `___` in `phrase` becomes an inline text input in the UI
- Provide **5–10 prepared wrong answers**, each with its own explanation; minimum 4 to pass validation
- Wrong answers should cover the most likely mistakes (wrong person/number, wrong tense, wrong article type, adjacent grammar constructs)
- Wrong answers must never duplicate the correct `answer`
- The correct `answer` field should use proper capitalization (matching is case-insensitive but case warnings are shown)
