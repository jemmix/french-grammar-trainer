import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Question, Rule, Section } from "~/data/types";
import { sectionMap } from "~/data/sections-index";
import { t } from "~/lang";
import { QuestionReviewClient } from "./question-review-client";

interface QuestionContext {
  question: Question;
  section: Section;
  rule: Rule;
}

function findQuestion(questionId: string): QuestionContext | null {
  for (const section of Object.values(sectionMap)) {
    const question = section.questions.find((q) => q.id === questionId);
    if (question) {
      const rule = section.rules.find((r) => r.id === question.ruleId);
      if (rule) return { question, section, rule };
    }
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ questionId: string }>;
}): Promise<Metadata> {
  const { questionId } = await params;
  return {
    title: t.questionReview.pageTitle(questionId),
  };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const ctx = findQuestion(questionId);
  if (!ctx) {
    notFound();
  }
  return (
    <QuestionReviewClient
      question={ctx.question}
      section={ctx.section}
      rule={ctx.rule}
    />
  );
}
