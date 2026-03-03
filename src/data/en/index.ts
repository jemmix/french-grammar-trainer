import type { Section, SectionMeta } from "../types";
import section01 from "./01-present-simple-continuous";
import section02 from "./02-past-simple";

export const loadedSections: Section[] = [section01, section02];

export const meta: Omit<SectionMeta, "questionCount">[] = [
  { id: "01-present-simple-continuous", title: "Present Simple & Present Continuous", description: "Affirmative, negative, and question forms; spelling rules; habits vs. temporary actions" },
  { id: "02-past-simple", title: "Past Simple", description: "Regular and irregular verbs, negatives, questions, time expressions, used to" },
  { id: "03-past-continuous", title: "Past Continuous", description: "Formation, background descriptions, interrupted actions, simultaneous actions" },
  { id: "04-present-perfect-simple", title: "Present Perfect Simple", description: "Formation, ever/never, already/yet, for/since, life experience" },
  { id: "05-present-perfect-continuous", title: "Present Perfect Continuous", description: "Formation, duration, recent activity, simple vs. continuous" },
  { id: "06-past-perfect", title: "Past Perfect", description: "Formation, earlier past actions, reported speech, third conditional" },
  { id: "07-future-forms", title: "Future Forms", description: "Will, going to, present continuous for future, shall, time clauses" },
  { id: "08-conditionals-zero-first-second", title: "Conditionals (Zero, First, Second)", description: "Zero, first, and second conditionals; unless; likely vs. unlikely" },
  { id: "09-third-mixed-conditionals", title: "Third Conditional & Mixed Conditionals", description: "Third conditional, mixed conditionals, regrets, wish + past perfect" },
  { id: "10-modal-verbs", title: "Modal Verbs", description: "Can, could, may, might, must, should, have to, would, had better" },
  { id: "11-passive-voice", title: "Passive Voice", description: "Formation across tenses, by-agent, get-passive, causative have/get" },
  { id: "12-reported-speech", title: "Reported Speech", description: "Tense backshift, say vs. tell, reported questions/commands, reporting verbs" },
  { id: "13-relative-clauses", title: "Relative Clauses", description: "Defining and non-defining; who, which, that, whose, where, when" },
  { id: "14-articles", title: "Articles", description: "A/an, the, zero article; geographical names, institutions, fixed expressions" },
  { id: "15-quantifiers", title: "Quantifiers", description: "Some/any, much/many, few/little, each/every, both/either/neither, enough/too" },
  { id: "16-comparatives-superlatives", title: "Comparatives & Superlatives", description: "Short and long adjectives, irregular forms, as...as, gradual change" },
  { id: "17-adjective-order-position", title: "Adjective Order & Position", description: "Attributive/predicative, OSASCOMP order, -ed/-ing adjectives, compound adjectives" },
  { id: "18-adverbs", title: "Adverbs", description: "Formation, position, frequency, degree, too/enough, so/such" },
  { id: "19-prepositions-time-place", title: "Prepositions of Time & Place", description: "At/on/in for time and place, movement, relative position, verb + preposition" },
  { id: "20-phrasal-verbs", title: "Phrasal Verbs", description: "Separable/inseparable, common phrasal verbs by topic, three-word phrasal verbs" },
  { id: "21-gerunds-infinitives", title: "Gerunds & Infinitives", description: "Verbs + gerund/infinitive, meaning changes, used to vs. be used to" },
  { id: "22-questions-tag-questions", title: "Question Formation & Tag Questions", description: "Yes/no, wh-, indirect, negative, tag, echo, and embedded questions" },
  { id: "23-conjunctions-linking-words", title: "Conjunctions & Linking Words", description: "Coordinating, subordinating, contrast, result, purpose, condition" },
  { id: "24-countable-uncountable-nouns", title: "Countable & Uncountable Nouns", description: "Countable/uncountable distinction, quantifiers, dual-use nouns, collective nouns" },
  { id: "25-subject-verb-agreement", title: "Subject\u2013Verb Agreement", description: "Compound subjects, collective nouns, indefinite pronouns, there is/are" },
  { id: "26-pronouns", title: "Pronouns", description: "Subject, object, possessive, reflexive, indefinite, demonstrative, dummy it/there" },
  { id: "27-word-order-sentence-structure", title: "Word Order & Sentence Structure", description: "SVO, adverb placement, inversion, cleft sentences, parallel structure" },
  { id: "28-common-confusions", title: "Common Confusions", description: "Make/do, say/tell, borrow/lend, used to/be used to, affect/effect" },
];
