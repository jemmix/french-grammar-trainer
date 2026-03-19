import type { Predicate } from "../types";
import { elisionPredicate } from "./elision";
import { mcqCorrectIsTruePredicate } from "./mcq-correct-is-true";
import { mcqWrongIsFalsePredicate } from "./mcq-wrong-is-false";
import { mcqStructuralPredicate } from "./mcq-structural";
import { inputStructuralPredicate } from "./input-structural";
import { inputPromptSelfContainedPredicate } from "./input-prompt-self-contained";
import { inputPromptWellFormedPredicate } from "./input-prompt-well-formed";
import { inputWrongPlausiblePredicate } from "./input-wrong-plausible";
import { inputExplanationAccuratePredicate } from "./input-explanation-accurate";
import { questionRuleAlignmentPredicate } from "./question-rule-alignment";
import { noAmbiguousPromptsPredicate } from "./no-ambiguous-prompts";
import { grammarValidPredicate } from "./grammar-valid";
import { hintNotTrivialPredicate } from "./hint-not-trivial";
import { notRidiculousPredicate } from "./not-ridiculous";
import { frenchLanguagePredicate } from "./french-language";

export const allPredicates: Predicate[] = [
  elisionPredicate,
  mcqStructuralPredicate,
  inputStructuralPredicate,
  mcqCorrectIsTruePredicate,
  mcqWrongIsFalsePredicate,
  inputPromptSelfContainedPredicate,
  inputPromptWellFormedPredicate,
  inputWrongPlausiblePredicate,
  inputExplanationAccuratePredicate,
  questionRuleAlignmentPredicate,
  noAmbiguousPromptsPredicate,
  grammarValidPredicate,
  hintNotTrivialPredicate,
  notRidiculousPredicate,
  frenchLanguagePredicate,
];

export {
  elisionPredicate,
  mcqCorrectIsTruePredicate,
  mcqWrongIsFalsePredicate,
  mcqStructuralPredicate,
  inputStructuralPredicate,
  inputPromptSelfContainedPredicate,
  inputPromptWellFormedPredicate,
  inputWrongPlausiblePredicate,
  inputExplanationAccuratePredicate,
  questionRuleAlignmentPredicate,
  noAmbiguousPromptsPredicate,
  grammarValidPredicate,
  hintNotTrivialPredicate,
  notRidiculousPredicate,
  frenchLanguagePredicate,
};
