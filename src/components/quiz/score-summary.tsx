import Link from "next/link";
import type { Question } from "~/data/types";

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
      ? { label: "Excellent !", color: "text-correct" }
      : percentage >= 70
        ? { label: "Bien !", color: "text-tricolore-bleu" }
        : percentage >= 50
          ? { label: "Peut mieux faire", color: "text-amber-600" }
          : { label: "À retravailler", color: "text-incorrect" };

  return (
    <div className="animate-scale-in">
      {/* Score card */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-0.5 mb-4">
          <div className="w-1 h-6 rounded-full bg-tricolore-bleu" />
          <div className="w-1 h-6 rounded-full bg-craie" />
          <div className="w-1 h-6 rounded-full bg-tricolore-rouge" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-encre mb-2">
          Résultat — {quizTitle}
        </h1>
        <div className="mt-6 mb-3">
          <span className="text-6xl md:text-7xl font-bold tabular-nums text-encre">
            {score}
          </span>
          <span className="text-2xl text-ardoise font-medium"> / {total}</span>
        </div>
        <p className={`text-xl font-semibold ${grade.color}`}>{grade.label}</p>
        <p className="text-ardoise mt-1">{percentage}% de bonnes réponses</p>
      </div>

      {/* Answer breakdown */}
      <div className="border border-craie rounded-xl bg-tricolore-blanc overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-craie bg-papier-warm">
          <h2 className="text-sm font-semibold text-encre">Détail des réponses</h2>
        </div>
        <div className="divide-y divide-craie/60">
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
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-tricolore-bleu/40 shrink-0" title="Question à saisie" />
                )}
                <p className="text-sm text-encre leading-relaxed flex-1">
                  {answer.question.prompt}
                </p>
                <Link
                  href={`/question/${answer.question.id}`}
                  className="shrink-0 text-[10px] font-mono text-ardoise/50 hover:text-tricolore-bleu transition-colors"
                  title={`Voir ${answer.question.id}`}
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
          className="flex-1 px-6 py-3 bg-tricolore-bleu text-white font-medium rounded-xl hover:bg-encre-light transition-colors cursor-pointer"
        >
          Recommencer
        </button>
        <Link
          href="/"
          className="flex-1 px-6 py-3 text-center border border-craie text-encre font-medium rounded-xl hover:bg-papier-warm transition-colors"
        >
          Choisir une autre section
        </Link>
      </div>
    </div>
  );
}
