import { getSession } from "~/lib/server-session";
import { getStore } from "~/lib/store";
import { sectionMap } from "~/data/sections-index";
import { decodeRecord, getDisplayPower, getRuleSlotIndex } from "~/lib/user-record";
import { lz4Decompress } from "~/lib/lz4";
import { pickLearnQuestions } from "~/lib/question-picker";
import { getExplanation } from "~/lib/explanation-helpers";
import type { RuleExplanation } from "~/data/types";
import { LearnClient } from "./learn-client";

export default async function LearnPage() {
  const session = await getSession();

  let getRulePower = (_ruleId: string) => 0;

  if (session.isLoggedIn) {
    const store = await getStore();
    const blob = await store.get(session.userId);
    if (blob) {
      try {
        const decompressed = await lz4Decompress(blob);
        const powers = decodeRecord(decompressed);
        getRulePower = (ruleId: string) => {
          const idx = getRuleSlotIndex(ruleId);
          if (idx < 0) return 0;
          const power = powers[idx] ?? 0;
          return getDisplayPower(power);
        };
      } catch {
        // Decoding error, fall back to all zeros
      }
    }
  }

  const allSections = Object.values(sectionMap);
  const getSectionPower = (_sectionId: string) => 0;

  const result = pickLearnQuestions({
    sections: allSections,
    getRulePower,
    getSectionPower,
  });

  let initialExplanation: RuleExplanation | null = null;
  if (result.focusRuleId) {
    const power = getRulePower(result.focusRuleId);
    if (power < 0.2) {
      for (const section of allSections) {
        const explanation = getExplanation(section, result.focusRuleId);
        if (explanation) {
          initialExplanation = explanation;
          break;
        }
      }
    }
  }

  const ruleMeta = new Map(
    allSections.flatMap((section) =>
      section.rules.map((rule) => [rule.id, { id: rule.id, title: rule.title }]),
    ),
  );

  const explanationMap = new Map<string, RuleExplanation>();
  for (const section of allSections) {
    if (section.explanations) {
      for (const explanation of section.explanations) {
        explanationMap.set(explanation.ruleId, explanation);
      }
    }
  }

  return (
    <LearnClient
      initialQuestions={result.questions}
      initialExplanation={initialExplanation}
      ruleMeta={ruleMeta}
      explanationMap={explanationMap}
    />
  );
}
