# French Grammar Trainer — Project Guidelines

## Language Policy
- **App interface & grammar content**: Everything in French (UI text, questions, explanations, section titles)
- **Code, comments, commit messages, docs (PLAN.md, README, etc.)**: English
- **TABLE_OF_CONTENTS.md and other course material files**: French (course material, not app docs)

## Workflow
- **Course material / ToC changes**: Commit and push without asking — these are safe to land unattended
- **Code changes**: Commit and push liberally — user reviews post factum
- **Skill changes** (`.claude/skills/**`): Commit and push liberally — treat like code changes
- **CLAUDE.md**: Update liberally to reflect user preferences and vibes as they emerge
- **TODO.md**: Note bugs, UX gaps, content quality issues, and ideas liberally — don't wait for the user to ask. Anything worth remembering for later goes here.

## Question Generation Workflow

### Directory layout
- `gen/` — **gitignored** scratch directory for all temp files during generation
- `questions/<rule-id>.txt` — canonical merged source files, one per rule (committed)
- `src/data/sections/<section-id>.ts` — compiled TypeScript, generated from `questions/` (committed)

### Steps
1. **Generate** — run `/generate-questions` in parallel Haiku sub-agents (one per rule), writing raw files to `gen/<rule-id>.txt`
2. **Split** — `npm run split-txt -- gen/<rule-id>.txt ...` → produces `gen/<rule-id>-passed.txt` + `gen/<rule-id>-failed.txt`
3. **Fix** — manually correct failed questions, save as `gen/<rule-id>-fixed.txt` (remove `VALIDATION ERROR:` lines)
4. **Merge** — `npm run merge-txt -- --output questions/<rule-id>.txt gen/<rule-id>-passed.txt [gen/<rule-id>-fixed.txt]` (later files override earlier for duplicate IDs)
5. **Compile** — `npm run convert-txt -- --section-id ... --section-title ... --section-desc ... --output src/data/sections/<section-id>.ts questions/<rule-id>.txt ...`
6. **Commit** — `git add questions/ src/data/sections/ .gitignore`, commit and push (temp files in `gen/` are never tracked)

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
