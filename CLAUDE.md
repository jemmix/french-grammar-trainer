# French Grammar Trainer — Project Guidelines

## Language Policy
- **App interface & grammar content**: Everything in French (UI text, questions, explanations, section titles)
- **Code, comments, commit messages, docs (PLAN.md, README, etc.)**: English
- **TABLE_OF_CONTENTS.md and other course material files**: French (course material, not app docs)

## Workflow
- **Course material / ToC changes**: Commit and push without asking — these are safe to land unattended
- **Code changes**: Commit and push liberally — user reviews post factum
- **CLAUDE.md**: Update liberally to reflect user preferences and vibes as they emerge

## Content Quality Rules
- Questions may have 2-5 choices — 2 is fine when more would force duplicate/near-duplicate options
- **No duplicate or near-duplicate choices**: each option must be a genuinely different answer. Multiple forms of the same article (le/la/l'/les) or same determiner family count as near-duplicates unless the question specifically tests that distinction (e.g. h aspiré vs h muet)
- Run `npm run validate-content` before committing question data to catch duplicates automatically
- Wrong answers must be plausible mistakes, not padding
