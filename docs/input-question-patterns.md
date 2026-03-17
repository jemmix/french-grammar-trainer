# Input Question Patterns for Non-Trivial Hints

These patterns create input questions where the hint provides grammatical context without directly revealing the answer. The answer cannot be found as a substring in either the question or the hint.

## Pattern Categories

### 1. 3rd Person Suffix Strip
Context sentence uses 3rd person singular (-s/-es), target uses base form for I/we/you/they.

**Example:**
> He cooks dinner every night. You and I do the same as he does on the weekends.
> - Phrase: "You and I ___ on the weekends."
> - Answer: `cook`
> - Hint: "do the same as he does"

### 2. Irregular Past Extraction
Context sentence uses irregular past, target uses present form.

**Example (A-I):**
> Yesterday, they drank soda. Today, we perform that same action with water.
> - Phrase: "Today, we ___ water."
> - Answer: `drink`
> - Hint: "perform that same action"

**Example (O-I):**
> He drove a truck last year. Now, we perform that same action with a small car.
> - Phrase: "Now, we ___ a small car."
> - Answer: `drive`
> - Hint: "perform that same action"

**Example (E-A):**
> She spoke very loudly. We always perform the same action softly in the library.
> - Phrase: "We always ___ softly in the library."
> - Answer: `speak`
> - Hint: "perform the same action"

**Example (Found-Find):**
> They found a gold coin. I usually perform that same action with my keys.
> - Phrase: "I usually ___ my keys in my pocket."
> - Answer: `find`
> - Hint: "perform that same action"

**Example (Wrote-Write):**
> She wrote a long story. You and I do the same thing with short emails.
> - Phrase: "You and I ___ short emails."
> - Answer: `write`
> - Hint: "do the same thing"

### 3. Gerund Extraction
Context sentence uses gerund (-ing) as noun, target uses base verb form.

**Example:**
> Swimming is great for your health. Most people perform that activity in the summer.
> - Phrase: "Most people ___ in the summer."
> - Answer: `swim`
> - Hint: "perform that activity"

### 4. Nominalization
Context uses noun form, target uses verb form (noun and verb must be different words).

**Example (Song-Sing):**
> That is a beautiful song. You and I use the verb form of 'song' together in the car.
> - Phrase: "You and I ___ together in the car."
> - Answer: `sing`
> - Hint: "the verb form of 'song'"

**Example (Choice-Choose):**
> It was a difficult choice. We usually use the verb form of 'choice' for the cheapest option.
> - Phrase: "We usually ___ the cheapest option."
> - Answer: `choose`
> - Hint: "the verb form of 'choice'"

**Example (Flight-Fly):**
> The flight to London is long. Birds use the verb form of 'flight' south for the winter.
> - Phrase: "Birds ___ south for the winter."
> - Answer: `fly`
> - Hint: "the verb form of 'flight'"

**Example (Thought-Think):**
> I had a sudden thought. You and I use the verb form of 'thought' about the future a lot.
> - Phrase: "You and I ___ about the future a lot."
> - Answer: `think`
> - Hint: "the verb form of 'thought'"

### 5. Regular Past (-ed)
Context uses regular past, target uses base form.

**Example:**
> We walked five miles yesterday. Every Saturday, we do that same action to the park.
> - Phrase: "Every Saturday, we ___ to the park."
> - Answer: `walk`
> - Hint: "do that same action"

### 6. Agent Noun
Context uses agent noun (-er/-or), target uses base verb.

**Example (Worker-Work):**
> Those workers are very fast. You and I do what a 'worker' does from nine to five.
> - Phrase: "You and I ___ from nine to five."
> - Answer: `work`
> - Hint: "do what a 'worker' does"

### 7. Continuous Extraction
Context uses present continuous, target uses base form.

**Example:**
> The neighbors are shouting. You and I do the same as the neighbors when we are angry.
> - Phrase: "You and I ___ when we are angry."
> - Answer: `shout`
> - Hint: "do the same as the neighbors"

### 8. 3rd Person (-es)
Context uses 3rd person with -es ending, target uses base form.

**Example:**
> My brother washes his hair daily. You and I do the same thing every other day.
> - Phrase: "You and I ___ every other day."
> - Answer: `wash`
> - Hint: "do the same thing"

## Hint Phrases Reference

These semantic hint phrases guide the learner to the meaning without revealing the form:

| Hint Phrase | Usage |
|-------------|-------|
| "do the same as [subject]" | Actions |
| "perform that same action" | Actions |
| "do the same thing" | Actions |
| "the verb form of '[noun]'" | Nominalizations |
| "do what a '[noun]' does" | Agent nouns |
| "perform that activity" | Gerunds |

## Validation

These patterns should pass the `hint-not-trivial` predicate because:
- The answer word does not appear in the question text
- The answer word does not appear in the hint
- The hint provides semantic context, not the answer itself

## Words to Avoid

Avoid noun-verb pairs where both forms are identical:
- walk (noun) → walk (verb)
- run (noun) → run (verb)
- love (noun) → love (verb)

Prefer pairs with distinct forms:
- song → sing
- flight → fly
- choice → choose
- thought → think
