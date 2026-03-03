import type { RuleExplanation, Section } from "~/data/types";

export function getExplanation(
  section: Section,
  ruleId: string,
): RuleExplanation | undefined {
  return section.explanations?.find((e) => e.ruleId === ruleId);
}
