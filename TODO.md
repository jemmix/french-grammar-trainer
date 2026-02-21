# TODO

## Content generation

- **Haiku duplicates right answer as wrong answer** — when Haiku runs out of distinct wrong-answer ideas mid-question, it repeats the right answer with a confused explanation ("C'est la bonne réponse !"). The `split-txt` validator catches it, but it should be prevented upstream. Options: add an explicit "never repeat RIGHT ANSWER as a WRONG ANSWER" rule to SKILL.md; add a self-check step at END QUESTION; emit a clearer error in the validator. See discussion in session notes.

- **Grammar-check generated answers** — no validation that answers are grammatically plausible French (e.g. a generated wrong answer like "je arrive" would pass validation). Could run answers through a grammar API, a local spaCy/Lefff model, or a cheap LLM call to flag obviously broken forms before committing content.

## UI / UX

- **Show section context on quiz page** — currently there is no indication of which grammar rule or tense is being tested except the URL bar. A learner jumping straight into a quiz from a link has no idea whether to expect présent, passé composé, etc. Consider showing the section title and/or rule title on the quiz screen.
