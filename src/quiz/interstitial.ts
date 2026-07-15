import type { Section, RuleExplanation } from "~/content/types";
import { getExplanation } from "~/content/explanations";

/**
 * Selects an interstitial explanation for a section quiz: finds the weakest
 * rule (highest weight) and returns its explanation if power < 0.2.
 */
export function selectSectionInterstitial(
  section: Section,
  getRulePower: (ruleId: string) => number,
): RuleExplanation | null {
  const rulesWithQs = section.rules.filter((r) =>
    section.questions.some((q) => q.ruleId === r.id),
  );

  if (rulesWithQs.length === 0) return null;

  let weakestRule = rulesWithQs[0]!;
  let weakestWeight = -Infinity;

  for (const rule of rulesWithQs) {
    const power = getRulePower(rule.id);
    const weight = Math.pow(1 - power, 2) + 0.05;
    if (weight > weakestWeight) {
      weakestWeight = weight;
      weakestRule = rule;
    }
  }

  const power = getRulePower(weakestRule.id);
  if (power < 0.2) {
    return getExplanation(section, weakestRule.id) ?? null;
  }
  return null;
}

/**
 * Selects an interstitial explanation for a learn quiz: if the focus rule
 * is weak (power < 0.2), searches all sections for its explanation.
 */
export function selectLearnInterstitial(
  focusRuleId: string | null,
  getRulePower: (ruleId: string) => number,
  sections: Section[],
): RuleExplanation | null {
  if (!focusRuleId) return null;
  const power = getRulePower(focusRuleId);
  if (power >= 0.2) return null;
  for (const section of sections) {
    const explanation = getExplanation(section, focusRuleId);
    if (explanation) return explanation;
  }
  return null;
}
