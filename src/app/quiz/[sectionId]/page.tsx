import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sectionMap } from "~/content/sections";
import { t } from "~/lang";
import { getSession } from "~/next/lib/server-session";
import { getStore, deserialize } from "~/storage/store";
import { getDisplayPower, getRuleSlotIndex } from "~/mastery/progress";
import { pickSectionQuizQuestions } from "~/quiz/select";
import { selectSectionInterstitial } from "~/quiz/interstitial";
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

  const questions = pickSectionQuizQuestions({
    section,
    getRulePower,
    targetCount: 20,
  });

  const explanation = selectSectionInterstitial(section, getRulePower);

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
