import type { RuleExplanation } from "../../types";

const explanations: RuleExplanation[] = [
  {
    ruleId: "02-01",
    title: "Past Simple Regular Verbs (-ed)",
    body: "Regular verbs form the past simple by adding **-ed** to the base form. Use the past simple for completed actions at a specific time in the past. The form is the same for all persons.",
    examples: [
      "I **walked** to the park yesterday.",
      "She **cleaned** the kitchen this morning.",
      "They **arrived** at noon.",
      "We **played** tennis last weekend.",
      "He **worked** late on Friday.",
    ],
  },
  {
    ruleId: "02-02",
    title: "Past Simple Spelling Rules for -ed",
    body: "Three key spelling rules apply when adding **-ed**: if the verb ends in **-e**, just add **-d** (live → lived). If it ends in consonant + **-y**, change `y` to `i` and add **-ed** (study → studied). If a short verb ends in consonant-vowel-consonant, **double** the final consonant (stop → stopped).",
    examples: [
      "She **lived** in Paris for two years. (live → lived, just add -d)",
      "He **studied** all night. (study → studied, y → ied)",
      "The bus **stopped** suddenly. (stop → stopped, double the p)",
      "They **planned** the trip carefully. (plan → planned, double the n)",
      "We **enjoyed** the film. (enjoy → enjoyed, vowel + y, just add -ed)",
    ],
  },
  {
    ruleId: "02-03",
    title: "Past Simple Pronunciation of -ed",
    body: "The **-ed** ending has three pronunciations: **/t/** after voiceless sounds (`k`, `p`, `f`, `s`, `sh`, `ch`) like **walked**; **/d/** after voiced sounds (`b`, `g`, `v`, `z`, `l`, `m`, `n`) like **called**; **/ɪd/** after `t` or `d` sounds like **wanted** or **needed**.",
    examples: [
      "**walked** → /wɔːkt/ (-ed sounds like /t/ after the voiceless /k/)",
      "**called** → /kɔːld/ (-ed sounds like /d/ after the voiced /l/)",
      "**wanted** → /ˈwɒntɪd/ (-ed sounds like /ɪd/ after /t/)",
      "**needed** → /ˈniːdɪd/ (-ed sounds like /ɪd/ after /d/)",
      "**played** → /pleɪd/ (-ed sounds like /d/ after the voiced /eɪ/)",
    ],
  },
];

export default explanations;
