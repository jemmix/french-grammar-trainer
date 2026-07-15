import type { RuleExplanation } from "../../types";

const explanations: RuleExplanation[] = [
  {
    ruleId: "01-01",
    title: "Present Simple Affirmative (I / you / we / they)",
    body: "With **I**, **you**, **we**, and **they**, the present simple uses the base form of the verb — no ending is added. Use it for habits, routines, general truths, and permanent states.",
    examples: [
      "I **walk** to work every day.",
      "You **speak** English very well.",
      "We **live** in a small town.",
      "They **play** football on Saturdays.",
      "My parents **work** in the same building.",
    ],
  },
  {
    ruleId: "01-02",
    title: "Third Person Singular (-s, -es, -ies)",
    body: "With **he**, **she**, or **it**, add **-s** to most verbs. Add **-es** after `s`, `sh`, `ch`, `x`, or `o`. If the verb ends in consonant + **y**, change `y` to `i` and add **-es**.",
    examples: [
      "She **walks** to the bus stop. (walk → walks)",
      "He **watches** TV after dinner. (watch → watches)",
      "It **goes** without saying. (go → goes)",
      "She **studies** every evening. (study → studies)",
      "He **plays** the guitar. (play → plays — vowel + y, just add -s)",
    ],
  },
  {
    ruleId: "01-03",
    title: "Present Simple Negative (don't / doesn't)",
    body: "To make a negative, use **don't** (do not) with **I / you / we / they** and **doesn't** (does not) with **he / she / it**. The main verb stays in its **base form** — never add -s after `doesn't`.",
    examples: [
      "I **don't like** coffee.",
      "You **don't need** a ticket.",
      "He **doesn't live** here anymore.",
      "She **doesn't want** to go. (not ~~doesn't wants~~)",
      "We **don't understand** the question.",
    ],
  },
];

export default explanations;
