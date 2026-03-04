"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import type { Question, RuleExplanation, Section } from "~/data/types";
import { McqQuestionView } from "~/components/quiz/mcq-question-view";
import { InputQuestionView } from "~/components/quiz/input-question-view";
import { ScoreSummary } from "~/components/quiz/score-summary";
import { RuleExplanationInterstitial } from "~/components/quiz/rule-explanation-interstitial";
import { ExplanationPanel } from "~/components/quiz/explanation-panel";
import { shuffleArray, QUESTIONS_PER_QUIZ } from "~/lib/quiz-helpers";
import { getExplanation } from "~/lib/explanation-helpers";
import { ruleWeight } from "~/lib/question-picker";
import { t } from "~/lang";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pickShuffledQuestions(section: Section): Question[] {
  const shuffled = shuffleArray(section.questions);
  const selected = shuffled.slice(0, Math.min(QUESTIONS_PER_QUIZ, shuffled.length));
  return selected.map((q) =>
    q.type === "mcq" ? { ...q, choices: shuffleArray(q.choices) } : q,
  );
}

function findWeakestExplanation(
  section: Section,
  getRulePower: (ruleId: string) => number,
): RuleExplanation | null {
  const rulesWithQs = section.rules.filter((r) =>
    section.questions.some((q) => q.ruleId === r.id),
  );
  if (rulesWithQs.length === 0) return null;

  let weakestRule = rulesWithQs[0]!;
  let weakestWeight = -1;
  for (const rule of rulesWithQs) {
    const power = getRulePower(rule.id);
    const w = ruleWeight(power, power > 0);
    if (w > weakestWeight) {
      weakestWeight = w;
      weakestRule = rule;
    }
  }
  const power = getRulePower(weakestRule.id);
  if (power >= 0.20) return null;
  return getExplanation(section, weakestRule.id) ?? null;
}

// ── Quiz runner (self-contained, no interstitial logic) ──────────────────────

function SectionQuizRunner({ section }: { section: Section }) {
  const { recordAnswer, flush } = useProgress();

  const [quizQuestions, setQuizQuestions] = useState<Question[]>(() =>
    pickShuffledQuestions(section),
  );
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
    return getExplanation(section, currentQuestion.ruleId);
  }, [section, currentQuestion]);

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
    setQuizQuestions(pickShuffledQuestions(section));
    setCurrentIndex(0);
    setSelectedChoiceIndex(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setAnswers([]);
    setPanelOpen(false);
  }, [section]);

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

  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise">{t.shared.loading}</div>
      </div>
    );
  }

  const progress = finished ? 100 : (currentIndex / totalQuestions) * 100;

  return (
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
            {t.shared.sections}
          </Link>
          <div className="flex items-center gap-3">
            {!finished && (currentExplanation || panelOpen) && (
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  panelOpen
                    ? "text-tricolore-bleu bg-tricolore-bleu/10"
                    : "text-ardoise hover:text-encre hover:bg-craie/50"
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
              <span className="text-sm font-medium text-encre tabular-nums">
                {currentIndex + 1} / {totalQuestions}
              </span>
            )}
            {!finished && (
              <span className="text-sm font-semibold text-tricolore-bleu tabular-nums">
                {t.quiz.points(score)}
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-craie">
          <div
            className="h-full bg-tricolore-bleu transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content row: quiz + sidebar */}
      <div className="lg:flex lg:min-h-[calc(100vh-3.5rem)]">
        {/* Quiz content */}
        <main className="flex-1 min-w-0 px-6 py-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            {finished ? (
              <ScoreSummary
                score={score}
                total={totalQuestions}
                answers={answers}
                quizTitle={section.title}
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
                rule={section.rules.find((r) => r.id === currentQuestion.ruleId)}
              />
            ) : currentQuestion?.type === "input" ? (
              <InputQuestionView
                question={currentQuestion}
                answered={answered}
                onAnswer={handleInputAnswer}
                onNext={handleNext}
                questionNum={currentIndex + 1}
                rule={section.rules.find((r) => r.id === currentQuestion.ruleId)}
              />
            ) : null}
          </div>
        </main>

        {/* Desktop sidebar */}
        <div
          className={`
            hidden lg:block border-l border-craie bg-papier-warm
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

// ── Exported client component (phase router) ─────────────────────────────────

type Phase =
  | { kind: "interstitial"; explanation: RuleExplanation }
  | { kind: "quiz" };

export function QuizClient({ section }: { section: Section }) {
  const { getRulePower } = useProgress();

  const [phase, setPhase] = useState<Phase>(() => {
    const explanation = findWeakestExplanation(section, getRulePower);
    if (explanation) return { kind: "interstitial", explanation };
    return { kind: "quiz" };
  });

  if (phase.kind === "interstitial") {
    return (
      <RuleExplanationInterstitial
        explanation={phase.explanation}
        onStart={() => setPhase({ kind: "quiz" })}
      />
    );
  }

  return <SectionQuizRunner section={section} />;
}
