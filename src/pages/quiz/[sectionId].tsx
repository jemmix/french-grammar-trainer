import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Choice, Question, Section } from "~/data/types";

// Static imports for available sections
import articlesSection from "~/data/sections/10-articles";

const sectionMap: Record<string, Section> = {
  "10-articles": articlesSection,
};

const QUESTIONS_PER_QUIZ = 20;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

export default function QuizPage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const section = typeof sectionId === "string" ? sectionMap[sectionId] : undefined;

  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean; question: Question }[]>([]);

  // Initialize quiz with shuffled questions
  useEffect(() => {
    if (section) {
      const shuffled = shuffleArray(section.questions);
      const selected = shuffled.slice(0, Math.min(QUESTIONS_PER_QUIZ, shuffled.length));
      // Also shuffle choices within each question
      const withShuffledChoices = selected.map((q) => ({
        ...q,
        choices: shuffleArray(q.choices),
      }));
      setQuizQuestions(withShuffledChoices);
    }
  }, [section]);

  const currentQuestion = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;

  const handleSelect = useCallback(
    (index: number) => {
      if (answered || !currentQuestion) return;
      setSelectedChoiceIndex(index);
      setAnswered(true);
      const isCorrect = currentQuestion.choices[index]?.correct ?? false;
      if (isCorrect) setScore((s) => s + 1);
      setAnswers((a) => [...a, { correct: isCorrect, question: currentQuestion }]);
    },
    [answered, currentQuestion],
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= totalQuestions) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedChoiceIndex(null);
      setAnswered(false);
    }
  }, [currentIndex, totalQuestions]);

  const handleRestart = useCallback(() => {
    if (section) {
      const shuffled = shuffleArray(section.questions);
      const selected = shuffled.slice(0, Math.min(QUESTIONS_PER_QUIZ, shuffled.length));
      const withShuffledChoices = selected.map((q) => ({
        ...q,
        choices: shuffleArray(q.choices),
      }));
      setQuizQuestions(withShuffledChoices);
      setCurrentIndex(0);
      setSelectedChoiceIndex(null);
      setAnswered(false);
      setScore(0);
      setFinished(false);
      setAnswers([]);
    }
  }, [section]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && answered && !finished) {
        handleNext();
        return;
      }
      if (!answered && currentQuestion) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= currentQuestion.choices.length) {
          handleSelect(num - 1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [answered, finished, currentQuestion, handleNext, handleSelect]);

  if (!section) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-ardoise text-lg mb-4">Section introuvable</p>
          <Link href="/" className="text-tricolore-bleu font-medium hover:underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  if (quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise">Chargement...</div>
      </div>
    );
  }

  const progress = finished ? 100 : (currentIndex / totalQuestions) * 100;

  return (
    <>
      <Head>
        <title>{section.title} — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-tricolore-blanc/90 backdrop-blur-sm border-b border-craie">
          <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-ardoise hover:text-encre transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Sections
            </Link>
            {!finished && (
              <span className="text-sm font-medium text-encre tabular-nums">
                {currentIndex + 1} / {totalQuestions}
              </span>
            )}
            {!finished && (
              <span className="text-sm font-semibold text-tricolore-bleu tabular-nums">
                {score} pt{score !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-craie">
            <div
              className="h-full bg-tricolore-bleu transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <main className="mx-auto max-w-3xl px-6 py-8 md:py-12">
          {finished ? (
            <ScoreSummary
              score={score}
              total={totalQuestions}
              answers={answers}
              sectionTitle={section.title}
              onRestart={handleRestart}
            />
          ) : (
            currentQuestion && (
              <QuestionView
                question={currentQuestion}
                selectedChoiceIndex={selectedChoiceIndex}
                answered={answered}
                onSelect={handleSelect}
                onNext={handleNext}
                questionNum={currentIndex + 1}
              />
            )
          )}
        </main>
      </div>
    </>
  );
}

function QuestionView({
  question,
  selectedChoiceIndex,
  answered,
  onSelect,
  onNext,
  questionNum,
}: {
  question: Question;
  selectedChoiceIndex: number | null;
  answered: boolean;
  onSelect: (index: number) => void;
  onNext: () => void;
  questionNum: number;
}) {
  // Find the rule title for context
  const ruleId = question.ruleId;

  return (
    <div className="animate-scale-in" key={question.id}>
      {/* Question prompt */}
      <div className="mb-8">
        <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-3">
          Question {questionNum}
        </p>
        <p className="text-xl md:text-2xl font-medium text-encre leading-relaxed">
          {question.prompt}
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
          <ExplanationPanel
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

function ChoiceButton({
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

function ExplanationPanel({
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

function ScoreSummary({
  score,
  total,
  answers,
  sectionTitle,
  onRestart,
}: {
  score: number;
  total: number;
  answers: { correct: boolean; question: Question }[];
  sectionTitle: string;
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
          Résultat — {sectionTitle}
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
              <p className="text-sm text-encre leading-relaxed">
                {answer.question.prompt}
              </p>
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
          Recommencer cette section
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
