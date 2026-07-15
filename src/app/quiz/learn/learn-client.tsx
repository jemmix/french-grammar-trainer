"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProgress } from "~/webapp/contexts/progress-context";
import type { Question, RuleExplanation } from "~/content/types";
import { McqQuestionView } from "~/webapp/components/quiz/mcq-question-view";
import { InputQuestionView } from "~/webapp/components/quiz/input-question-view";
import { ScoreSummary } from "~/webapp/components/quiz/score-summary";
import { RuleExplanationInterstitial } from "~/webapp/components/quiz/rule-explanation-interstitial";
import { ExplanationPanel } from "~/webapp/components/quiz/explanation-panel";
import { t } from "~/lang";

interface RuleMeta {
  id: string;
  title: string;
}

interface LearnQuizRunnerProps {
  initialQuestions: Question[];
  ruleMeta: Map<string, RuleMeta>;
  explanationMap: Map<string, RuleExplanation>;
  onRestart: () => void;
}

function LearnQuizRunner({
  initialQuestions,
  ruleMeta,
  explanationMap,
  onRestart,
}: LearnQuizRunnerProps) {
  const { recordAnswer, flush } = useProgress();

  const [quizQuestions, setQuizQuestions] = useState(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<{ correct: boolean; question: Question }[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const currentQuestion = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;

  const currentExplanation = useMemo(() => {
    if (!currentQuestion) return undefined;
    return explanationMap.get(currentQuestion.ruleId);
  }, [currentQuestion, explanationMap]);

  const currentRule = currentQuestion ? ruleMeta.get(currentQuestion.ruleId) : undefined;

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

  useEffect(() => {
    if (finished) void flush();
  }, [finished, flush]);

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

  const progress = finished ? 100 : (currentIndex / totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-paper page-bg">
      {/* Top bar */}
      <div className="top-bar sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-chalk">
        <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.shared.sections}
          </Link>
          <div className="flex items-center gap-3">
            {!finished && (currentExplanation || panelOpen) && (
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  panelOpen
                    ? "text-primary bg-primary/10"
                    : "text-muted hover:text-ink hover:bg-chalk/50"
                }`}
                title={t.quiz.viewExplanation}
                aria-label={t.quiz.viewExplanation}
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>
            )}
            {!finished && (
              <span className="text-sm font-medium text-ink tabular-nums">
                {currentIndex + 1} / {totalQuestions}
              </span>
            )}
            {!finished && (
              <span className="text-sm font-semibold text-primary tabular-nums">
                {t.quiz.points(score)}
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="progress-track h-0.5 bg-chalk">
          <div
            className="progress-fill h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content row: quiz + sidebar */}
      <div className="lg:flex lg:min-h-[calc(100vh-3.5rem)]">
        <main className="flex-1 min-w-0 px-6 py-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            {finished ? (
              <ScoreSummary
                score={score}
                total={totalQuestions}
                answers={answers}
                quizTitle={t.quiz.learnFreelyQuizTitle}
                onRestart={onRestart}
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
          </div>
        </main>

        {/* Desktop sidebar */}
        <div
          className={`
            hidden lg:block border-l border-chalk bg-paper-warm
            transition-[width] duration-300 ease-out shrink-0
            ${panelOpen ? "w-[340px]" : "w-0 border-l-0 overflow-hidden"}
          `}
        >
          <div className="w-[340px]">
            <ExplanationPanel
              explanation={currentExplanation}
              isOpen={panelOpen}
              onClose={() => setPanelOpen(false)}
              mode="desktop"
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <ExplanationPanel
        explanation={currentExplanation}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        mode="mobile"
      />
    </div>
  );
}

type Phase =
  | { kind: "loading" }
  | { kind: "interstitial"; explanation: RuleExplanation; questions: Question[] }
  | { kind: "quiz"; questions: Question[] };

export function LearnClient({
  initialQuestions,
  initialExplanation,
  ruleMeta,
  explanationMap,
}: {
  initialQuestions: Question[];
  initialExplanation: RuleExplanation | null;
  ruleMeta: Map<string, RuleMeta>;
  explanationMap: Map<string, RuleExplanation>;
}) {
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialExplanation) {
      return { kind: "interstitial", explanation: initialExplanation, questions: initialQuestions };
    }
    return { kind: "quiz", questions: initialQuestions };
  });

  const startNewRound = useCallback(() => {
    setPhase({ kind: "loading" });
  }, []);

  if (phase.kind === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-muted">{t.shared.loading}</div>
      </div>
    );
  }

  if (phase.kind === "interstitial") {
    return (
      <RuleExplanationInterstitial
        explanation={phase.explanation}
        onStart={() => setPhase({ kind: "quiz", questions: phase.questions })}
      />
    );
  }

  return (
    <LearnQuizRunner
      key={phase.questions[0]?.id ?? ""}
      initialQuestions={phase.questions}
      ruleMeta={ruleMeta}
      explanationMap={explanationMap}
      onRestart={startNewRound}
    />
  );
}
