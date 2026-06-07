import type { Question, Rule, Section } from "../data/types";

export interface QuestionContext {
  question: Question;
  rule: Rule;
  section: Section;
  lang: "fr" | "en" | "de";
}

export type PredicateResult =
  | { status: "pass" }
  | { status: "fail"; reason: string }
  | { status: "invalid"; reason: string };

export type ValidPredicateResult =
  | { status: "pass" }
  | { status: "fail"; reason: string };

export interface StructuralPredicate {
  id: string;
  category: "structural" | "language";
  check(ctx: QuestionContext): PredicateResult;
}

export interface LLMRequestSpec {
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMResponse {
  raw: string;
  model: string;
  harness: string;
  nonce: string;
  timestamp: string;
}

export interface LLMPredicate {
  id: string;
  category: "semantic" | "pedagogical";
  /**
   * 1 = priority (gating). Run before phase-2 predicates for the same question.
   * 2 = remaining. Skipped if the question is doomed by phase 1.
   */
  phase: 1 | 2;
  appliesTo(ctx: QuestionContext): boolean;
  generatePrompt(ctx: QuestionContext): LLMRequestSpec;
  interpretResponse(ctx: QuestionContext, rawResponse: string): PredicateResult;
}

export type Predicate = StructuralPredicate | LLMPredicate;

export function isLLMPredicate(p: Predicate): p is LLMPredicate {
  return p.category === "semantic" || p.category === "pedagogical";
}

export interface CacheEntry {
  cacheKey: string;
  predicateId: string;
  questionId: string;
  spec: LLMRequestSpec & { nonce: string };
  responses: LLMResponse[];
}

export interface ValidationOptions {
  lang?: "fr" | "en" | "de";
  sections?: string[];
  rules?: string[];
  questions?: string[];
  categories?: Array<"structural" | "language" | "semantic" | "pedagogical">;
  llm: boolean;
  dryRun: boolean;
  updateCache: boolean;
  pruneCache: boolean;
  concurrency?: number;
  model?: string;
  rateLimit: number;
}

export interface CheckResult {
  questionId: string;
  predicateId: string;
  category: string;
  pass: boolean;
  reason?: string;
  fromCache?: boolean;
  responseCount?: number;
  attemptDetails?: string[];
}

export interface ValidationReport {
  results: CheckResult[];
  passed: number;
  failed: number;
  warnings: number;
  cacheHits: number;
  cacheMisses: number;
  durationMs: number;
}
