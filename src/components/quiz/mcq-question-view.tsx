import Link from "next/link";
import type { Choice, MultipleChoiceQuestion, Rule } from "~/data/types";
import { renderWithBlanks } from "~/lib/quiz-helpers";

export function McqQuestionView({
  question,
  selectedChoiceIndex,
  answered,
  onSelect,
  onNext,
  questionNum,
  rule,
}: {
  question: MultipleChoiceQuestion;
  selectedChoiceIndex: number | null;
  answered: boolean;
  onSelect: (index: number) => void;
  onNext: () => void;
  questionNum: number;
  rule?: Rule;
}) {
  return (
    <div className="animate-scale-in" key={question.id}>
      {/* Question prompt */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-ardoise uppercase tracking-wider">
            Question {questionNum}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-ardoise/60">
            <span className="hidden sm:inline">{rule?.title ? `${rule.title} · ` : ""}</span>
            <Link
              href={`/question/${question.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono hover:text-tricolore-bleu transition-colors"
              title="Ouvrir dans l'inspecteur"
            >
              {question.id}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        </div>
        <p className="text-xl md:text-2xl font-medium text-encre leading-relaxed">
          {renderWithBlanks(question.prompt)}
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-3 mb-8">
        {question.choices.map((choice, i) => (
          <ChoiceButton
            key={i}
            choice={choice}
            index={i}
            selected={selectedChoiceIndex === i}
            answered={answered}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>

      {/* Explanation + Next */}
      {answered && selectedChoiceIndex !== null && (
        <div className="animate-slide-up">
          <McqExplanationPanel
            choice={question.choices[selectedChoiceIndex]!}
            correctChoice={question.choices.find((c) => c.correct)!}
            wasCorrect={question.choices[selectedChoiceIndex]!.correct}
          />

          <button
            onClick={onNext}
            className="mt-6 w-full sm:w-auto px-8 py-3 bg-tricolore-bleu text-white font-medium rounded-xl hover:bg-encre-light transition-colors duration-200 cursor-pointer"
          >
            Question suivante
            <span className="ml-2 text-white/50 text-sm">Entrée ↵</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ChoiceButton({
  choice,
  index,
  selected,
  answered,
  onClick,
}: {
  choice: Choice;
  index: number;
  selected: boolean;
  answered: boolean;
  onClick: () => void;
}) {
  const keyLabel = index + 1;

  let borderColor = "border-craie";
  let bgColor = "bg-tricolore-blanc";
  let ringClass = "";

  if (answered) {
    if (choice.correct) {
      borderColor = "border-correct-border";
      bgColor = "bg-correct-bg";
      if (selected) ringClass = "ring-2 ring-correct/30";
    } else if (selected) {
      borderColor = "border-incorrect-border";
      bgColor = "bg-incorrect-bg";
      ringClass = "ring-2 ring-incorrect/30";
    } else {
      bgColor = "bg-papier-warm";
      borderColor = "border-craie/50";
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={answered}
      className={`w-full text-left px-5 py-4 rounded-xl border ${borderColor} ${bgColor} ${ringClass} transition-all duration-200 ${
        !answered ? "hover:border-tricolore-bleu/40 hover:shadow-md hover:shadow-tricolore-bleu/5 cursor-pointer" : ""
      } flex items-start gap-4`}
    >
      <span
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${
          answered && choice.correct
            ? "bg-correct text-white"
            : answered && selected && !choice.correct
              ? "bg-incorrect text-white"
              : "bg-tricolore-bleu/8 text-tricolore-bleu"
        }`}
      >
        {answered && choice.correct ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : answered && selected && !choice.correct ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          keyLabel
        )}
      </span>
      <span
        className={`text-base leading-relaxed pt-0.5 ${
          answered && !choice.correct && !selected ? "text-ardoise" : "text-encre"
        }`}
      >
        {choice.text}
      </span>
    </button>
  );
}

export function McqExplanationPanel({
  choice,
  correctChoice,
  wasCorrect,
}: {
  choice: Choice;
  correctChoice: Choice;
  wasCorrect: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        wasCorrect
          ? "bg-correct-bg border-correct-border"
          : "bg-incorrect-bg border-incorrect-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {wasCorrect ? (
          <>
            <div className="w-6 h-6 rounded-full bg-correct flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-semibold text-correct">Bonne réponse !</span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full bg-incorrect flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="font-semibold text-incorrect">Mauvaise réponse</span>
          </>
        )}
      </div>

      <p className="text-sm text-encre leading-relaxed">{choice.explanation}</p>

      {!wasCorrect && (
        <div className="mt-4 pt-4 border-t border-incorrect-border/50">
          <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-1">
            La bonne réponse : {correctChoice.text}
          </p>
          <p className="text-sm text-encre leading-relaxed">{correctChoice.explanation}</p>
        </div>
      )}
    </div>
  );
}
