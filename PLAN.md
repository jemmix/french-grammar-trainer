# Development Plan — French Grammar Trainer

## Overview

Web app for French grammar training at B1 level. All UI and content in French. Multiple-choice questions (4-5 choices) with explanations for every answer. Stateless — no database, no authentication.

**Tech stack:** T3 (Next.js + TypeScript + tRPC + Tailwind CSS)

---

## Phase 1: Architecture & Infrastructure

### 1.1 Content Data Structure
- Define TypeScript types for the data model:
  - `Section`: id, title, description, list of rules
  - `Rule`: id, sectionId, title, explanation
  - `Question`: id, ruleId, prompt, choices (4-5), correct answer index, per-choice explanations
- Store all content as static JSON files in `src/data/`
- One JSON file per section (28 files), each containing its rules and questions
- Create an index file (`sections-index.json`) listing all sections with metadata

### 1.2 tRPC API
- `sections.getAll` — returns list of sections (id, title, description, question count)
- `sections.getById` — returns a section with its rules
- `quiz.getQuestions` — returns N random questions for a given section (shuffles choices on each call)

### 1.3 Content Generation
- Write a generation script (`scripts/generate-content.ts`) that uses the Claude API to produce grammar content
- Generate section by section, rule by rule, in batches of questions
- Automatic validation: check JSON structure, question uniqueness, explanation consistency
- Store results in `src/data/sections/`
- Support incremental mode (don't regenerate existing content)

---

## Phase 2: User Interface

### 2.1 Pages & Navigation
- **Home page** (`/`): list of all sections as clickable cards, each showing title, brief description, and available question count
- **Quiz page** (`/quiz/[sectionId]`): quiz interface for a given section

### 2.2 UI Components
- `SectionCard` — section card on the home page
- `QuizContainer` — main quiz container, manages local state (current question, score, answers)
- `QuestionDisplay` — renders the prompt and choices
- `ChoiceButton` — choice button with states (neutral, selected, correct, incorrect)
- `ExplanationPanel` — explanation panel shown after answering
- `ProgressBar` — quiz progress bar
- `ScoreDisplay` — score display at the end of a quiz

### 2.3 User Flow
1. User lands on home page, sees all sections
2. Clicks a section → quiz page
3. Receives 20 random questions from that section (configurable)
4. For each question:
   - Reads the prompt
   - Picks an answer from 4-5 options
   - Interface immediately reveals whether it's correct
   - Explanation for the chosen answer appears (+ correct answer explanation if wrong)
   - Clicks "Next question"
5. End of quiz → summary screen with score and option to restart

### 2.4 Style & Design
- Tailwind CSS for all styling
- Clean, readable, responsive design (mobile-first)
- Color palette: blue/white/red (subtle French flag inspiration)
- Clear typography, generous text size for readability
- Light animations for question transitions

---

## Phase 3: Grammar Content

### 3.1 Sections (28 sections — see TABLE_OF_CONTENTS.md)
Each section contains:
- ~20 distinct grammar rules
- ~500 questions per rule (~10,000 questions per section)
- Each question has 4-5 choices with individual explanations

### 3.2 Question Formats
Three question types:
1. **Fill in the blank** — "Hier, je ___ au cinéma." → suis allé / ai allé / allais / irai
2. **Identify the correct sentence** — "Quelle phrase est correcte ?" → 4-5 sentences, only one correct
3. **Transform** — "Mettez à l'imparfait : 'Je mange'" → Je mangeais / Je mangais / Je mangerais / Je mangai

### 3.3 Content Quality
- Clear, pedagogical explanations for every choice
- Wrong answers must be plausible mistakes (not absurd)
- **No duplicate or near-duplicate choices** within a question — each option must test a genuinely different confusion point. Questions may have 2-5 choices; 2 is fine when more would require padding
- Automated validation script (`npm run validate-content`) enforces uniqueness
- Varied, natural contexts (daily life, work, travel, etc.)
- Progressive difficulty within each section

---

## Phase 4: Polish

### 4.1 Performance
- Lazy load quiz data (only load the active section)
- Server-side shuffling to avoid sending all questions to the client

### 4.2 UX
- Keyboard shortcuts (1-5 to choose, Enter to proceed)
- Question counter ("Question 7/20")
- Ability to quit the quiz and return to home

---

## Execution Order

| Step | Description | Dependencies |
|---|---|---|
| 1 | TypeScript types and data structure | — |
| 2 | Content generation script | Step 1 |
| 3 | Generate content for all 28 sections | Step 2 |
| 4 | tRPC routes | Step 1 |
| 5 | Home page (section list) | Step 4 |
| 6 | Quiz page (MCQ interface) | Step 4 |
| 7 | Styling and responsive design | Steps 5-6 |
| 8 | UX and performance polish | Steps 5-7 |

---

## Technical Decisions

- **No database**: all content is static JSON, served via tRPC
- **No authentication**: anonymous, stateless interface
- **Server-side randomization**: client only receives a shuffled subset of questions
- **AI-generated content**: use Claude API to produce ~280,000 questions, with human validation by sampling
- **Large JSON files**: sections loaded on demand to avoid keeping everything in memory
