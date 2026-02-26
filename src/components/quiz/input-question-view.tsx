import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InputQuestion, Rule } from "~/data/types";
import {
  evaluateInput,
  parsePhrase,
  type InputResult,
} from "~/lib/quiz-helpers";

export function InputQuestionView({
  question,
  answered,
  onAnswer,
  onNext,
  questionNum,
  rule,
}: {
  question: InputQuestion;
  answered: boolean;
  onAnswer: (isCorrect: boolean) => void;
  onNext: () => void;
  questionNum: number;
  rule?: Rule;
}) {
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<InputResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const { before, after } = parsePhrase(question.phrase);

  // Reset state when question changes
  useEffect(() => {
    setUserInput("");
    setResult(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [question.id]);

  // Focus next button after answering
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => nextButtonRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleSubmit = useCallback(() => {
    if (answered || !userInput.trim()) return;
    const res = evaluateInput(userInput, question);
    setResult(res);
    onAnswer(res.isCorrect);
  }, [answered, userInput, question, onAnswer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!answered) {
          handleSubmit();
        } else {
          onNext();
        }
      }
    },
    [answered, handleSubmit, onNext],
  );

  // Underline color for the inline input
  let underlineColor = "border-craie";
  if (result) {
    if (result.kind === "exact") underlineColor = "border-correct";
    else if (result.kind === "case-warning") underlineColor = "border-warning";
    else underlineColor = "border-incorrect";
  }

  // Measure input width to fit content
  const inputWidth = Math.max(userInput.length, question.answer.length, 3);

  return (
    <div className="animate-scale-in" key={question.id}>
      {/* Instruction line */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium text-ardoise uppercase tracking-wider">
              Question {questionNum}
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tricolore-bleu/8 text-tricolore-bleu text-[10px] font-semibold uppercase tracking-wider">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              saisie
            </span>
          </div>
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
        <p className="text-base text-ardoise leading-relaxed">
          {question.prompt}
        </p>
      </div>

      {/* Sentence with inline input */}
      <div className="mb-8 py-6 px-5 rounded-xl bg-tricolore-blanc border border-craie">
        <p className="text-xl md:text-2xl font-medium text-encre leading-relaxed inline">
          <span>«&nbsp;{before}</span>
          <span className="inline-flex items-baseline mx-0.5">
            <span className="relative">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => !answered && setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={answered}
                placeholder="…"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ width: `${inputWidth + 1.5}ch` }}
                className={`
                  text-xl md:text-2xl font-semibold text-tricolore-bleu
                  bg-transparent outline-none text-center
                  border-b-2 ${underlineColor}
                  ${!answered ? "focus:border-tricolore-bleu" : ""}
                  placeholder:text-craie placeholder:font-light
                  transition-colors duration-300
                  py-0.5 px-1 min-w-[3ch]
                  ${answered ? "cursor-default" : ""}
                `}
              />
            </span>
          </span>
          <span>{after}&nbsp;»</span>
        </p>
      </div>

      {/* Submit button */}
      {!answered && (
        <div className="mb-8">
          <button
            onClick={handleSubmit}
            disabled={!userInput.trim()}
            className={`
              px-8 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer
              ${userInput.trim()
                ? "bg-tricolore-bleu text-white hover:bg-encre-light shadow-sm"
                : "bg-craie text-ardoise cursor-not-allowed"
              }
            `}
          >
            Valider
            <span className={`ml-2 text-sm ${userInput.trim() ? "text-white/40" : "text-ardoise/40"}`}>Entrée ↵</span>
          </button>
        </div>
      )}

      {/* Result feedback */}
      {answered && result && (
        <div className="animate-slide-up">
          <InputFeedbackPanel
            result={result}
            question={question}
            userInput={userInput.trim()}
          />

          <button
            ref={nextButtonRef}
            onClick={onNext}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onNext();
              }
            }}
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

export function InputFeedbackPanel({
  result,
  question,
  userInput,
}: {
  result: InputResult;
  question: InputQuestion;
  userInput: string;
}) {
  switch (result.kind) {
    // ---- Exact correct ----
    case "exact":
      return (
        <div className="rounded-xl border p-5 bg-correct-bg border-correct-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-correct flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-semibold text-correct">Bonne réponse !</span>
          </div>
          <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
        </div>
      );

    // ---- Correct but wrong case ----
    case "case-warning":
      return (
        <div className="rounded-xl border p-5 bg-warning-bg border-warning-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-semibold text-warning">Bonne réponse !</span>
          </div>
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-warning/5 border border-warning/15">
            <svg className="w-4 h-4 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-encre">
              Attention à la casse : la bonne écriture est <strong>« {result.matchedAnswer} »</strong>, pas « {userInput} ».
            </p>
          </div>
          <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
        </div>
      );

    // ---- Prepared wrong answer ----
    case "wrong-prepared":
      return (
        <div className="rounded-xl border p-5 bg-incorrect-bg border-incorrect-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-incorrect flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="font-semibold text-incorrect">Mauvaise réponse</span>
          </div>
          <p className="text-sm text-encre leading-relaxed">{result.wrongExplanation}</p>
          <div className="mt-4 pt-4 border-t border-incorrect-border/50">
            <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-1">
              La bonne réponse : {question.answer}
            </p>
            <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      );

    // ---- Typo of correct answer ----
    case "typo-correct":
      return (
        <div className="rounded-xl border p-5 bg-warning-bg border-warning-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <span className="font-semibold text-warning">Presque !</span>
          </div>
          <p className="text-sm text-encre leading-relaxed mb-3">
            Vous vouliez probablement dire <strong>« {result.matchedAnswer} »</strong> — c&apos;est la bonne réponse, mais l&apos;orthographe compte !
          </p>
          <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
        </div>
      );

    // ---- Typo of wrong answer ----
    case "typo-wrong":
      return (
        <div className="rounded-xl border p-5 bg-warning-bg border-warning-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <span className="font-semibold text-warning">Presque, mais non</span>
          </div>
          <p className="text-sm text-encre leading-relaxed mb-3">
            Vous vouliez probablement dire <strong>« {result.matchedAnswer} »</strong> — c&apos;est incorrect.
          </p>
          <p className="text-sm text-encre leading-relaxed">{result.wrongExplanation}</p>
          <div className="mt-4 pt-4 border-t border-warning-border/50">
            <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-1">
              La bonne réponse : {question.answer}
            </p>
            <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      );

    // ---- Unknown answer ----
    case "unknown":
      return (
        <div className="rounded-xl border p-5 bg-incorrect-bg border-incorrect-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-ardoise flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
              </svg>
            </div>
            <span className="font-semibold text-ardoise">Réponse inattendue</span>
          </div>
          <p className="text-sm text-encre leading-relaxed mb-1">
            « {userInput} » ne correspond à aucune réponse prévue.
          </p>
          <div className="mt-4 pt-4 border-t border-incorrect-border/50">
            <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-1">
              La bonne réponse : {question.answer}
            </p>
            <p className="text-sm text-encre leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      );
  }
}
