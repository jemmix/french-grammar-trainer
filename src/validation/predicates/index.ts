import type { Predicate } from "../types";
import { elisionPredicate } from "./elision";
import { mcqCorrectIsTruePredicate } from "./mcq-correct-is-true";

export const allPredicates: Predicate[] = [
  elisionPredicate,
  mcqCorrectIsTruePredicate,
];

export { elisionPredicate, mcqCorrectIsTruePredicate };
