import type { Question, Section } from "~/content/types";
import { PROGRESS } from "~/lib/constants";

export function ruleWeight(power: number, attempted: boolean): number {
  if (!attempted) return PROGRESS.WEIGHT_UNATTEMPTED;
  return Math.pow(1 - power, PROGRESS.WEIGHT_EXPONENT) + PROGRESS.WEIGHT_FLOOR;
}

export function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

function shuffleChoices(q: Question): Question {
  if (q.type !== "mcq") return q;
  return { ...q, choices: shuffleArray(q.choices) };
}

export interface LearnPickResult {
  questions: Question[];
  focusRuleId: string | null;
}

export function pickLearnQuestions(params: {
  sections: Section[];
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
}): LearnPickResult {
  const { sections, getRulePower, getSectionPower } = params;

  const loadedSections = sections.filter((s) => s.questions.length > 0);
  if (loadedSections.length === 0) return { questions: [], focusRuleId: null };

  const collected = new Set<string>();
  const result: Question[] = [];

  const addQuestions = (candidates: Question[], limit: number): void => {
    const shuffled = shuffleArray(candidates);
    let added = 0;
    for (const q of shuffled) {
      if (added >= limit) break;
      if (!collected.has(q.id)) {
        collected.add(q.id);
        result.push(shuffleChoices(q));
        added++;
      }
    }
  };

  const sectionWeights = loadedSections.map((s) => {
    const power = getSectionPower(s.id);
    return ruleWeight(power, power > 0);
  });
  const focusSectionIdx = weightedRandomIndex(sectionWeights);
  const focusSection = loadedSections[focusSectionIdx]!;

  const rulesWithQuestions = (section: Section) =>
    section.rules.filter((r) => section.questions.some((q) => q.ruleId === r.id));

  const focusSectionRules = rulesWithQuestions(focusSection);

  if (focusSectionRules.length === 0) {
    addQuestions(loadedSections.flatMap((s) => s.questions), PROGRESS.LEARN_TOTAL);
    return { questions: shuffleArray(result), focusRuleId: null };
  }

  const focusRuleWeights = focusSectionRules.map((r) => {
    const power = getRulePower(r.id);
    return ruleWeight(power, power > 0);
  });
  const focusRuleIdx = weightedRandomIndex(focusRuleWeights);
  const focusRule = focusSectionRules[focusRuleIdx]!;

  const focusRuleQs = focusSection.questions.filter((q) => q.ruleId === focusRule.id);
  addQuestions(focusRuleQs, PROGRESS.LEARN_FOCUS);

  if (result.length < PROGRESS.LEARN_FOCUS) {
    const otherRules = focusSectionRules
      .filter((r) => r.id !== focusRule.id)
      .sort((a, b) => {
        const wa = ruleWeight(getRulePower(a.id), getRulePower(a.id) > 0);
        const wb = ruleWeight(getRulePower(b.id), getRulePower(b.id) > 0);
        return wb - wa;
      });
    for (const rule of otherRules) {
      if (result.length >= PROGRESS.LEARN_FOCUS) break;
      const qs = focusSection.questions.filter((q) => q.ruleId === rule.id);
      addQuestions(qs, PROGRESS.LEARN_FOCUS - result.length);
    }
  }

  const strongRulesInFocus = focusSectionRules
    .filter((r) => getRulePower(r.id) >= PROGRESS.ENCOURAGE_THRESHOLD)
    .sort((a, b) => getRulePower(b.id) - getRulePower(a.id));

  if (strongRulesInFocus.length > 0) {
    const strongest = strongRulesInFocus[0]!;
    addQuestions(
      focusSection.questions.filter((q) => q.ruleId === strongest.id),
      PROGRESS.LEARN_FOCUS_ENCOURAGE,
    );
  } else {
    const fallbackRule = focusSectionRules.find((r) => r.id !== focusRule.id);
    if (fallbackRule) {
      addQuestions(
        focusSection.questions.filter((q) => q.ruleId === fallbackRule.id),
        PROGRESS.LEARN_FOCUS_ENCOURAGE,
      );
    }
  }

  const focusRulePos = focusSection.rules.findIndex((r) => r.id === focusRule.id);
  const adjacentOffsets = [-2, -1, 1, 2];
  const adjacentRules = adjacentOffsets
    .map((offset) => focusSection.rules[focusRulePos + offset])
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .filter((r) => focusSection.questions.some((q) => q.ruleId === r.id));

  const adjacentTarget = result.length + PROGRESS.LEARN_ADJACENT;
  for (const rule of shuffleArray(adjacentRules)) {
    if (result.length >= adjacentTarget) break;
    addQuestions(
      focusSection.questions.filter((q) => q.ruleId === rule.id),
      1,
    );
  }

  const adjacentStrong = focusSectionRules.filter(
    (r) => r.id !== focusRule.id && getRulePower(r.id) >= PROGRESS.ENCOURAGE_THRESHOLD,
  );
  if (adjacentStrong.length > 0) {
    const pick = adjacentStrong[Math.floor(Math.random() * adjacentStrong.length)]!;
    addQuestions(
      focusSection.questions.filter((q) => q.ruleId === pick.id),
      PROGRESS.LEARN_ADJACENT_ENCOURAGE,
    );
  }

  const otherSections = loadedSections.filter((s) => s.id !== focusSection.id);
  const leftfieldTarget = result.length + PROGRESS.LEARN_LEFTFIELD;

  if (otherSections.length > 0) {
    const otherWeights = otherSections.map((s) => {
      const power = getSectionPower(s.id);
      return ruleWeight(power, power > 0);
    });

    const numLeftfieldSections = Math.min(otherSections.length, 2 + Math.floor(Math.random() * 2));
    const pickedSectionIdxs = new Set<number>();

    for (let i = 0; i < numLeftfieldSections; i++) {
      const tempWeights = otherWeights.map((w, idx) => (pickedSectionIdxs.has(idx) ? 0 : w));
      if (tempWeights.every((w) => w === 0)) break;
      pickedSectionIdxs.add(weightedRandomIndex(tempWeights));
    }

    const questionsPerLFSection = Math.ceil(PROGRESS.LEARN_LEFTFIELD / numLeftfieldSections);

    for (const sIdx of pickedSectionIdxs) {
      if (result.length >= leftfieldTarget) break;
      const lfSection = otherSections[sIdx]!;
      const lfRules = rulesWithQuestions(lfSection);
      if (lfRules.length === 0) continue;

      const lfWeights = lfRules.map((r) => {
        const power = getRulePower(r.id);
        return ruleWeight(power, power > 0);
      });
      const lfRuleIdx = weightedRandomIndex(lfWeights);
      const lfRule = lfRules[lfRuleIdx]!;

      addQuestions(
        lfSection.questions.filter((q) => q.ruleId === lfRule.id),
        questionsPerLFSection,
      );
    }

    const allOtherStrong = otherSections.flatMap((s) =>
      rulesWithQuestions(s)
        .filter((r) => getRulePower(r.id) >= PROGRESS.ENCOURAGE_THRESHOLD)
        .map((r) => ({ section: s, rule: r })),
    );
    if (allOtherStrong.length > 0) {
      const pick = allOtherStrong[Math.floor(Math.random() * allOtherStrong.length)]!;
      addQuestions(
        pick.section.questions.filter((q) => q.ruleId === pick.rule.id),
        PROGRESS.LEARN_LEFTFIELD_ENCOURAGE,
      );
    }
  }

  if (result.length < PROGRESS.LEARN_TOTAL) {
    const allQuestions = loadedSections.flatMap((s) => s.questions);
    addQuestions(allQuestions, PROGRESS.LEARN_TOTAL - result.length);
  }

  return {
    questions: shuffleArray(result.slice(0, PROGRESS.LEARN_TOTAL)),
    focusRuleId: focusRule.id,
  };
}

/**
 * Power-aware section quiz: picks 20 questions from a section, weighted by rule strength.
 *
 * Algorithm:
 * 1. Group section questions by rule
 * 2. Compute weight per rule (inverted power: weak rules selected more)
 * 3. For each of 20 slots: pick a weighted rule, then a random unused question from it
 * 4. Shuffle the final batch
 *
 * Fallback: When logged out (all powers = 0), weights are equal → uniform random selection.
 */
export function pickSectionQuizQuestions(params: {
  section: Section;
  getRulePower: (ruleId: string) => number;
  targetCount?: number;
}): Question[] {
  const { section, getRulePower, targetCount = 20 } = params;

  if (section.questions.length === 0) return [];

  const questionsByRule = new Map<string, Question[]>();
  for (const q of section.questions) {
    if (!questionsByRule.has(q.ruleId)) {
      questionsByRule.set(q.ruleId, []);
    }
    questionsByRule.get(q.ruleId)!.push(q);
  }

  const rulesWithQuestions = section.rules.filter((r) => questionsByRule.has(r.id));

  if (rulesWithQuestions.length === 0) return [];

  const weights = rulesWithQuestions.map((r) => {
    const power = getRulePower(r.id);
    return ruleWeight(power, power > 0);
  });

  const collected = new Set<string>();
  const result: Question[] = [];

  for (let i = 0; i < targetCount && result.length < targetCount; i++) {
    const ruleIdx = weightedRandomIndex(weights);
    const rule = rulesWithQuestions[ruleIdx]!;
    const qs = questionsByRule.get(rule.id)!;

    const available = qs.filter((q) => !collected.has(q.id));
    if (available.length === 0) {
      const allUnused = section.questions.filter((q) => !collected.has(q.id));
      if (allUnused.length === 0) break;
      const q = allUnused[Math.floor(Math.random() * allUnused.length)]!;
      collected.add(q.id);
      result.push(shuffleChoices(q));
    } else {
      const q = available[Math.floor(Math.random() * available.length)]!;
      collected.add(q.id);
      result.push(shuffleChoices(q));
    }
  }

  return shuffleArray(result);
}
