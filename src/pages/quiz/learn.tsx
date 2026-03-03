import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import type { Question, RuleExplanation } from "~/data/types";
import { sectionMap } from "~/data/sections-index";
import { McqQuestionView } from "~/components/quiz/mcq-question-view";
import { InputQuestionView } from "~/components/quiz/input-question-view";
import { ScoreSummary } from "~/components/quiz/score-summary";
import { RuleExplanationInterstitial } from "~/components/quiz/rule-explanation-interstitial";
import { ExplanationPanel } from "~/components/quiz/explanation-panel";
import { pickLearnQuestions } from "~/lib/question-picker";
import { getExplanation } from "~/lib/explanation-helpers";
import { t } from "~/lang";

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
  const [showingInterstitial, setShowingInterstitial] = useState(false);
  const [interstitialExplanation, setInterstitialExplanation] = useState<RuleExplanation | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const allSections = Object.values(sectionMap);

  const initQuiz = useCallback(() => {
    const result = pickLearnQuestions({
      sections: allSections,
      getRulePower,
      getSectionPower,
    });
    setQuizQuestions(result.questions);
    setCurrentIndex(0);
    setSelectedChoiceIndex(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setAnswers([]);
    setPanelOpen(false);
    setInitialized(true);

    // Check for interstitial on focus rule
    if (result.focusRuleId) {
      const power = getRulePower(result.focusRuleId);
      // Find which section contains this rule
      for (const section of allSections) {
        const explanation = getExplanation(section, result.focusRuleId);
        if (explanation && power < 0.20) {
          setShowingInterstitial(true);
          setInterstitialExplanation(explanation);
          break;
        }
      }
    }
  }, [allSections, getRulePower, getSectionPower]);

  // Wait for progress to load before picking questions
  useEffect(() => {
    if (!isLoading && !initialized) {
      initQuiz();
    }
  }, [isLoading, initialized, initQuiz]);

  const currentQuestion = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;

  // Current question's explanation (for side panel)
  const currentExplanation = useMemo(() => {
    if (!currentQuestion) return undefined;
    for (const section of allSections) {
      const explanation = getExplanation(section, currentQuestion.ruleId);
      if (explanation) return explanation;
    }
    return undefined;
  }, [currentQuestion, allSections]);

  // Close panel when current question has no explanation
  useEffect(() => {
    if (!currentExplanation) setPanelOpen(false);
  }, [currentExplanation]);

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
    setShowingInterstitial(false);
    setInterstitialExplanation(null);
    setInitialized(false);
  }, []);

  // Flush progress to server when quiz finishes
  useEffect(() => {
    if (finished) void flush();
  }, [finished, flush]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showingInterstitial) return;
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
  }, [answered, finished, currentQuestion, handleNext, handleMcqSelect, showingInterstitial]);

  if (isLoading || !initialized || quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise">{t.shared.loading}</div>
      </div>
    );
  }

  // Show interstitial before quiz starts
  if (showingInterstitial && interstitialExplanation) {
    return (
      <>
        <Head>
          <title>{t.quiz.learnFreelyQuizTitle} — {t.meta.appTitle}</title>
        </Head>
        <RuleExplanationInterstitial
          explanation={interstitialExplanation}
          onStart={() => setShowingInterstitial(false)}

        />
      </>
    );
  }

  const progress = finished ? 100 : (currentIndex / totalQuestions) * 100;
  const currentRule = currentQuestion ? allRulesMap.get(currentQuestion.ruleId) : undefined;

  return (
    <>
      <Head>
        <title>{t.quiz.learnFreelyQuizTitle} — {t.meta.appTitle}</title>
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
              {t.shared.sections}
            </Link>
            <div className="flex items-center gap-3">
              {!finished && currentExplanation && (
                <button
                  onClick={() => setPanelOpen((o) => !o)}
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

        <main className="mx-auto max-w-3xl px-6 py-8 md:py-12">
          {finished ? (
            <ScoreSummary
              score={score}
              total={totalQuestions}
              answers={answers}
              quizTitle={t.quiz.learnFreelyQuizTitle}
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

        {/* Explanation side panel */}
        {currentExplanation && (
          <ExplanationPanel
            explanation={currentExplanation}
            isOpen={panelOpen}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>
    </>
  );
}
