import type { RuleExplanation, Section } from "~/content/types";

export function getExplanation(
  section: Section,
  ruleId: string,
): RuleExplanation | undefined {
  return section.explanations?.find((e) => e.ruleId === ruleId);
}
