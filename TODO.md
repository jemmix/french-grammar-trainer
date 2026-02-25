# TODO

## Content generation

- **Nonsensical questions** — some generated questions are internally incoherent: e.g. an input question with PROMPT "Conjuguez le verbe au présent" but neither the PROMPT nor the PHRASE names which verb to conjugate, leaving the blank completely undefined. These pass all structural checks. Possible mitigations: add a prompt instruction like "the verb to conjugate must appear explicitly in the sentence or prompt"; add a heuristic validator that flags INPUT questions whose PHRASE contains a bare `___` with no adjacent verb-form context; or add a post-generation LLM review step that reads each question and checks for self-consistency.

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

## Content scale

- **Topic-sharded generation** — add a `topic` parameter to the generate-questions skill (e.g. work, travel, leisure, buying groceries, healthcare, education) so each generation batch stays within API response limits (25–50 questions) while covering the same grammar rule through varied real-world contexts. A rule like "présent des verbes en -er" could have one file per topic, all merged into the section. Lets the corpus grow incrementally without any single generation call getting too large.

## Weird questions

- 10-11-005: Suisse and Suisse aucun article the same thing?

