import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findQuestion } from "~/content/find";
import { t } from "~/lang";
import { QuestionReviewClient } from "./question-review-client";

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
