import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import type { Question } from "~/data/types";
import { sectionMap } from "~/data/sections-index";
import { McqQuestionView } from "~/components/quiz/mcq-question-view";
import { InputQuestionView } from "~/components/quiz/input-question-view";
import { ScoreSummary } from "~/components/quiz/score-summary";
import { pickLearnQuestions } from "~/lib/question-picker";

function getAllRulesMap(): Map<string, { title: string }> {
  const map = new Map<string, { title: string }>();
  for (const section of Object.values(sectionMap)) {
    for (const rule of section.rules) {
      map.set(rule.id, { title: rule.title });
    }
  }
  return map;
}

const allRulesMap = getAllRulesMap();

export default function LearnPage() {
  const { recordAnswer, flush, getRulePower, getSectionPower, isLoading } = useProgress();

  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean; question: Question }[]>([]);
  const [initialized, setInitialized] = useState(false);

  const allSections = Object.values(sectionMap);

  const initQuiz = useCallback(() => {
    const picked = pickLearnQuestions({
      sections: allSections,
      getRulePower,
      getSectionPower,
    });
    setQuizQuestions(picked);
    setCurrentIndex(0);
    setSelectedChoiceIndex(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setAnswers([]);
    setInitialized(true);
  }, [allSections, getRulePower, getSectionPower]);

  // Wait for progress to load before picking questions
  useEffect(() => {
    if (!isLoading && !initialized) {
      initQuiz();
    }
  }, [isLoading, initialized, initQuiz]);

  const currentQuestion = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;

  const handleMcqSelect = useCallback(
    (index: number) => {
      if (answered || !currentQuestion || currentQuestion.type !== "mcq") return;
      setSelectedChoiceIndex(index);
      setAnswered(true);
      const isCorrect = currentQuestion.choices[index]?.correct ?? false;
      if (isCorrect) setScore((s) => s + 1);
      setAnswers((a) => [...a, { correct: isCorrect, question: currentQuestion }]);
      recordAnswer(currentQuestion.ruleId, isCorrect);
    },
    [answered, currentQuestion, recordAnswer],
  );

  const handleInputAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentQuestion) return;
      setAnswered(true);
      if (isCorrect) setScore((s) => s + 1);
      setAnswers((a) => [...a, { correct: isCorrect, question: currentQuestion }]);
      recordAnswer(currentQuestion.ruleId, isCorrect);
    },
    [currentQuestion, recordAnswer],
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
    initQuiz();
  }, [initQuiz]);

  // Flush progress to server when quiz finishes
  useEffect(() => {
    if (finished) void flush();
  }, [finished, flush]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && answered && !finished) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT") return;
        handleNext();
        return;
      }
      if (!answered && currentQuestion?.type === "mcq") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= currentQuestion.choices.length) {
          handleMcqSelect(num - 1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [answered, finished, currentQuestion, handleNext, handleMcqSelect]);

  if (isLoading || !initialized || quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise">Chargement...</div>
      </div>
    );
  }

  const progress = finished ? 100 : (currentIndex / totalQuestions) * 100;
  const currentRule = currentQuestion ? allRulesMap.get(currentQuestion.ruleId) : undefined;

  return (
    <>
      <Head>
        <title>Apprentissage libre — Grammaire Française B1</title>
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
              quizTitle="Apprentissage libre"
              onRestart={handleRestart}
            />
          ) : currentQuestion?.type === "mcq" ? (
            <McqQuestionView
              question={currentQuestion}
              selectedChoiceIndex={selectedChoiceIndex}
              answered={answered}
              onSelect={handleMcqSelect}
              onNext={handleNext}
              questionNum={currentIndex + 1}
              rule={currentRule ? { id: currentQuestion.ruleId, sectionId: "", title: currentRule.title } : undefined}
            />
          ) : currentQuestion?.type === "input" ? (
            <InputQuestionView
              question={currentQuestion}
              answered={answered}
              onAnswer={handleInputAnswer}
              onNext={handleNext}
              questionNum={currentIndex + 1}
              rule={currentRule ? { id: currentQuestion.ruleId, sectionId: "", title: currentRule.title } : undefined}
            />
          ) : null}
        </main>
      </div>
    </>
  );
}
