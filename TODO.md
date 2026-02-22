# TODO

## Content generation

- **Haiku duplicates right answer as wrong answer** — when Haiku runs out of distinct wrong-answer ideas mid-question, it repeats the right answer with a confused explanation ("C'est la bonne réponse !"). The `split-txt` validator catches it, but it should be prevented upstream. Options: add an explicit "never repeat RIGHT ANSWER as a WRONG ANSWER" rule to SKILL.md; add a self-check step at END QUESTION; emit a clearer error in the validator. See discussion in session notes.

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

## Content scale

- **Topic-sharded generation** — add a `topic` parameter to the generate-questions skill (e.g. work, travel, leisure, buying groceries, healthcare, education) so each generation batch stays within API response limits (25–50 questions) while covering the same grammar rule through varied real-world contexts. A rule like "présent des verbes en -er" could have one file per topic, all merged into the section. Lets the corpus grow incrementally without any single generation call getting too large.

## UI / UX

- **Show section context on quiz page** — currently there is no indication of which grammar rule or tense is being tested except the URL bar. A learner jumping straight into a quiz from a link has no idea whether to expect présent, passé composé, etc. Consider showing the section title and/or rule title on the quiz screen.

- **Differentiate yellow feedback blurbs** — "yellow" currently covers two distinct situations that deserve different messages: (1) case mismatch (answer is correct but capitalisation differs, e.g. "L'eau" vs "l'eau") should say something like "Bonne réponse — attention à la majuscule" ; (2) near-miss / typo (answer is wrong but close to correct) should say something like "Presque ! Vérifiez l'orthographe". Right now they likely show the same generic blurb.
