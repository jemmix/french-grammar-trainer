import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sectionMap } from "~/data/sections-index";
import { t } from "~/lang";
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
  return <QuizClient section={section} />;
}
