import type { Question, Section } from "~/data/types";
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

function shuffleArray<T>(array: T[]): T[] {
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

export function pickLearnQuestions(params: {
  sections: Section[];
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
}): Question[] {
  const { sections, getRulePower, getSectionPower } = params;

  // Only sections that have questions loaded
  const loadedSections = sections.filter((s) => s.questions.length > 0);
  if (loadedSections.length === 0) return [];

  const collected = new Set<string>(); // question IDs already picked
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

  // 1. Weighted-pick focus section
  const sectionWeights = loadedSections.map((s) => {
    const power = getSectionPower(s.id);
    return ruleWeight(power, power > 0);
  });
  const focusSectionIdx = weightedRandomIndex(sectionWeights);
  const focusSection = loadedSections[focusSectionIdx]!;

  // Helper: rules in a section that have at least one question
  const rulesWithQuestions = (section: Section) =>
    section.rules.filter((r) => section.questions.some((q) => q.ruleId === r.id));

  const focusSectionRules = rulesWithQuestions(focusSection);

  if (focusSectionRules.length === 0) {
    // Degenerate fallback
    addQuestions(loadedSections.flatMap((s) => s.questions), PROGRESS.LEARN_TOTAL);
    return shuffleArray(result);
  }

  // 2. Weighted-pick focus rule
  const focusRuleWeights = focusSectionRules.map((r) => {
    const power = getRulePower(r.id);
    return ruleWeight(power, power > 0);
  });
  const focusRuleIdx = weightedRandomIndex(focusRuleWeights);
  const focusRule = focusSectionRules[focusRuleIdx]!;

  // 3. Collect up to LEARN_FOCUS questions from the focus rule
  const focusRuleQs = focusSection.questions.filter((q) => q.ruleId === focusRule.id);
  addQuestions(focusRuleQs, PROGRESS.LEARN_FOCUS);

  // Supplement from other weak rules in the section if not enough
  if (result.length < PROGRESS.LEARN_FOCUS) {
    const otherRules = focusSectionRules
      .filter((r) => r.id !== focusRule.id)
      .sort((a, b) => {
        // Higher weight = weaker rule = prioritize
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

  // 4. Collect 1 encouragement from strongest attempted rule in focusSection
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
    // Fallback: any other rule in section
    const fallbackRule = focusSectionRules.find((r) => r.id !== focusRule.id);
    if (fallbackRule) {
      addQuestions(
        focusSection.questions.filter((q) => q.ruleId === fallbackRule.id),
        PROGRESS.LEARN_FOCUS_ENCOURAGE,
      );
    }
  }

  // 5 & 6. Adjacent rules: ±1, ±2 from focusRule in section.rules array
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

  // Adjacent encouragement: another strong rule in focusSection
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

  // 7 & 8. Leftfield: pick 2-3 non-focus sections (weighted), then questions from weak rules
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

    // Leftfield encouragement: strong rule from a non-focus section
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

  // 9. Fill any remaining slots from all available questions
  if (result.length < PROGRESS.LEARN_TOTAL) {
    const allQuestions = loadedSections.flatMap((s) => s.questions);
    addQuestions(allQuestions, PROGRESS.LEARN_TOTAL - result.length);
  }

  // Final shuffle
  return shuffleArray(result.slice(0, PROGRESS.LEARN_TOTAL));
}
