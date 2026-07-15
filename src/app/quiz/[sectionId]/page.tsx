import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sectionMap } from "~/content/sections";
import { t } from "~/lang";
import { getSession } from "~/lib/server-session";
import { getStore } from "~/lib/store";
import {
  decodeRecord,
  getDisplayPower,
  getRuleSlotIndex,
} from "~/lib/user-record";
import { lz4Decompress } from "~/lib/lz4";
import { pickSectionQuizQuestions } from "~/lib/question-picker";
import { getExplanation } from "~/content/explanations";
import { QuizClient } from "./quiz-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}): Promise<Metadata> {
  const { sectionId } = await params;
  const section = sectionMap[sectionId];
  return {
    title: section
      ? `${section.title} — ${t.meta.appTitle}`
      : t.meta.appTitle,
  };
}

async function getInitialQuestionsAndExplanation(sectionId: string) {
  const session = await getSession();
  const section = sectionMap[sectionId]!;

  let getRulePower = (_ruleId: string) => 0; // default: logged out

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

  const questions = pickSectionQuizQuestions({
    section,
    getRulePower,
    targetCount: 20,
  });

  // Find weakest rule for interstitial explanation
  let explanation = null;
  const rulesWithQs = section.rules.filter((r) =>
    section.questions.some((q) => q.ruleId === r.id),
  );

  if (rulesWithQs.length > 0) {
    // Find the rule with highest weight (weakest)
    let weakestRule = rulesWithQs[0]!;
    let weakestWeight = -Infinity;

    for (const rule of rulesWithQs) {
      const power = getRulePower(rule.id);
      const weight = Math.pow(1 - power, 2) + 0.05; // matching ruleWeight logic
      if (weight > weakestWeight) {
        weakestWeight = weight;
        weakestRule = rule;
      }
    }

    const power = getRulePower(weakestRule.id);
    if (power < 0.2) {
      explanation = getExplanation(section, weakestRule.id) ?? null;
    }
  }

  return { questions, explanation };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  const section = sectionMap[sectionId];
  if (!section) {
    notFound();
  }

  const { questions, explanation } = await getInitialQuestionsAndExplanation(sectionId);

  return (
    <QuizClient
      section={section}
      initialQuestions={questions}
      initialExplanation={explanation}
    />
  );
}
