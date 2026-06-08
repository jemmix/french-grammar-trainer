import Link from "next/link";
import type { Question } from "~/data/types";
import { t } from "~/lang";
import { BrandMark, useTheme } from "~/themes";

export function ScoreSummary({
  score,
  total,
  answers,
  quizTitle,
  onRestart,
}: {
  score: number;
  total: number;
  answers: { correct: boolean; question: Question }[];
  quizTitle: string;
  onRestart: () => void;
}) {
  const percentage = Math.round((score / total) * 100);

  const grade =
    percentage >= 90
      ? { label: t.score.gradeExcellent, color: "text-correct" }
      : percentage >= 70
        ? { label: t.score.gradeBien, color: "text-primary" }
        : percentage >= 50
          ? { label: t.score.gradeMoyenne, color: "text-amber-600" }
          : { label: t.score.gradeRework, color: "text-incorrect" };

  const theme = useTheme();

  return (
    <div className="animate-scale-in">
      {/* Score card */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-0.5 mb-4">
          <BrandMark theme={theme} size="sm" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">
          {t.score.resultTitle(quizTitle)}
        </h1>
        <div className="mt-6 mb-3">
          <span className="text-6xl md:text-7xl font-bold tabular-nums text-ink">
            {score}
          </span>
          <span className="text-2xl text-muted font-medium"> / {total}</span>
        </div>
        <p className={`text-xl font-semibold ${grade.color}`}>{grade.label}</p>
        <p className="text-muted mt-1">{t.score.percentCorrect(percentage)}</p>
      </div>

      {/* Answer breakdown */}
      <div className="border border-chalk rounded-xl bg-surface overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-chalk bg-paper-warm">
          <h2 className="text-sm font-semibold text-ink">{t.score.answerBreakdown}</h2>
        </div>
        <div className="divide-y divide-chalk/60">
          {answers.map((answer, i) => (
            <div key={i} className="px-5 py-3 flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                  answer.correct ? "bg-correct" : "bg-incorrect"
                }`}
              >
                {answer.correct ? (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <div className="flex-1 flex items-center gap-2">
                {answer.question.type === "input" && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" title={t.score.inputQuestionTitle} />
                )}
                <p className="text-sm text-ink leading-relaxed flex-1">
                  {answer.question.prompt}
                </p>
                <Link
                  href={`/question/${answer.question.id}`}
                  className="shrink-0 text-[10px] font-mono text-muted/50 hover:text-primary transition-colors"
                  title={t.score.questionLinkTitle(answer.question.id)}
                >
                  {answer.question.id}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRestart}
            className="btn-primary flex-1 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-ink-light transition-colors cursor-pointer"
          >
          {t.score.restart}
        </button>
        <Link
          href="/"
          className="flex-1 px-6 py-3 text-center border border-chalk text-ink font-medium rounded-xl hover:bg-paper-warm transition-colors"
        >
          {t.score.chooseDifferentSection}
        </Link>
      </div>
    </div>
  );
}
