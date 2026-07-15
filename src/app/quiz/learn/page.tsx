import { getSession } from "~/lib/server-session";
import { getStore, deserialize } from "~/storage/store";
import { sectionMap } from "~/content/sections";
import { getDisplayPower, getRuleSlotIndex } from "~/mastery/progress";
import { pickLearnQuestions } from "~/quiz/select";
import { selectLearnInterstitial } from "~/quiz/interstitial";
import type { RuleExplanation } from "~/content/types";
import { LearnClient } from "./learn-client";

export default async function LearnPage() {
  const session = await getSession();

  let getRulePower = (_ruleId: string) => 0;

  if (session.isLoggedIn) {
    const store = await getStore();
    const blob = await store.get(session.userId);
    if (blob) {
      try {
        const { powers } = await deserialize(blob);
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

  const initialExplanation = selectLearnInterstitial(
    result.focusRuleId,
    getRulePower,
    allSections,
  );

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
