import type { Predicate } from "../types";
import { elisionPredicate } from "./elision";
import { mcqCorrectIsTruePredicate } from "./mcq-correct-is-true";
import { mcqWrongIsFalsePredicate } from "./mcq-wrong-is-false";
import { mcqStructuralPredicate } from "./mcq-structural";
import { inputStructuralPredicate } from "./input-structural";
import { inputPromptSelfContainedPredicate } from "./input-prompt-self-contained";

export const allPredicates: Predicate[] = [
  elisionPredicate,
  mcqStructuralPredicate,
  inputStructuralPredicate,
  mcqCorrectIsTruePredicate,
  mcqWrongIsFalsePredicate,
  inputPromptSelfContainedPredicate,
];

export {
  elisionPredicate,
  mcqCorrectIsTruePredicate,
  mcqWrongIsFalsePredicate,
  mcqStructuralPredicate,
  inputStructuralPredicate,
  inputPromptSelfContainedPredicate,
};
