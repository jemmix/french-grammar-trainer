import type { Question, Rule, Section } from "../data/types";

export interface QuestionContext {
  question: Question;
  rule: Rule;
  section: Section;
  lang: "fr" | "en";
}

export interface PredicateResult {
  pass: boolean;
  reason?: string;
}

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
  lang?: "fr" | "en";
  sections?: string[];
  rules?: string[];
  questions?: string[];
  categories?: Array<"structural" | "language" | "semantic" | "pedagogical">;
  llm?: boolean;
  dryRun?: boolean;
  updateCache?: boolean;
  pruneCache?: boolean;
}

export interface CheckResult {
  questionId: string;
  predicateId: string;
  category: string;
  pass: boolean;
  reason?: string;
  fromCache?: boolean;
  responseCount?: number;
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
