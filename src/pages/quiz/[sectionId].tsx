import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Choice,
  InputQuestion,
  MultipleChoiceQuestion,
  Question,
  Section,
  WrongAnswer,
} from "~/data/types";

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

// Levenshtein distance — only need to check if distance is exactly 1
function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2; // early exit — can't be distance 1

  const prev = Array.from({ length: lb + 1 }, (_, i) => i);
  const curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j]!;
  }
  return prev[lb]!;
}

type InputResultKind =
  | "exact"          // correct, exact match
  | "case-warning"   // correct but wrong case
  | "wrong-prepared" // matches a prepared wrong answer
  | "typo-correct"   // typo of the correct answer
  | "typo-wrong"     // typo of a prepared wrong answer
  | "unknown";       // no match at all

interface InputResult {
  kind: InputResultKind;
  isCorrect: boolean;
  matchedAnswer?: string;
  explanation?: string;
  wrongExplanation?: string;
}

function evaluateInput(userInput: string, question: InputQuestion): InputResult {
  const trimmed = userInput.trim();
  const answer = question.answer;

  // 1. Exact match
  if (trimmed === answer) {
    return { kind: "exact", isCorrect: true };
  }

  // 2. Case-insensitive correct
  if (trimmed.toLowerCase() === answer.toLowerCase()) {
    return { kind: "case-warning", isCorrect: true, matchedAnswer: answer };
  }

  // 3. Exact match against prepared wrong answers (case-insensitive)
  for (const wrong of question.wrongAnswers) {
    if (trimmed.toLowerCase() === wrong.text.toLowerCase()) {
      return {
        kind: "wrong-prepared",
        isCorrect: false,
        matchedAnswer: wrong.text,
        wrongExplanation: wrong.explanation,
      };
    }
  }

  // 4. Typo of correct answer (Levenshtein distance 1, case-insensitive)
  if (levenshteinDistance(trimmed.toLowerCase(), answer.toLowerCase()) === 1) {
    return {
      kind: "typo-correct",
      isCorrect: false,
      matchedAnswer: answer,
    };
  }

  // 5. Typo of a prepared wrong answer (Levenshtein distance 1, case-insensitive)
  for (const wrong of question.wrongAnswers) {
    if (levenshteinDistance(trimmed.toLowerCase(), wrong.text.toLowerCase()) === 1) {
      return {
        kind: "typo-wrong",
        isCorrect: false,
        matchedAnswer: wrong.text,
        wrongExplanation: wrong.explanation,
      };
    }
  }

  // 6. No match
  return { kind: "unknown", isCorrect: false };
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
      // Also shuffle choices within MCQ questions
      const withShuffledChoices = selected.map((q) =>
        q.type === "mcq" ? { ...q, choices: shuffleArray(q.choices) } : q,
      );
      setQuizQuestions(withShuffledChoices);
    }
  }, [section]);

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
    },
    [answered, currentQuestion],
  );

  const handleInputAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentQuestion) return;
      setAnswered(true);
      if (isCorrect) setScore((s) => s + 1);
      setAnswers((a) => [...a, { correct: isCorrect, question: currentQuestion }]);
    },
    [currentQuestion],
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
      const withShuffledChoices = selected.map((q) =>
        q.type === "mcq" ? { ...q, choices: shuffleArray(q.choices) } : q,
      );
      setQuizQuestions(withShuffledChoices);
      setCurrentIndex(0);
      setSelectedChoiceIndex(null);
      setAnswered(false);
      setScore(0);
      setFinished(false);
      setAnswers([]);
    }
  }, [section]);

  // Keyboard shortcuts for MCQ questions and advancing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Enter to advance (but only when not inside the input field for input questions)
      if (e.key === "Enter" && answered && !finished) {
        // Don't hijack Enter from the input question's own submit
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
          ) : currentQuestion?.type === "mcq" ? (
            <McqQuestionView
              question={currentQuestion}
              selectedChoiceIndex={selectedChoiceIndex}
              answered={answered}
              onSelect={handleMcqSelect}
              onNext={handleNext}
              questionNum={currentIndex + 1}
            />
          ) : currentQuestion?.type === "input" ? (
            <InputQuestionView
              question={currentQuestion}
              answered={answered}
              onAnswer={handleInputAnswer}
              onNext={handleNext}
              questionNum={currentIndex + 1}
            />
          ) : null}
        </main>
      </div>
    </>
  );
}

// ===========================================================================
// MCQ Question View (unchanged logic, renamed from QuestionView)
// ===========================================================================

function McqQuestionView({
  question,
  selectedChoiceIndex,
  answered,
  onSelect,
  onNext,
  questionNum,
}: {
  question: MultipleChoiceQuestion;
  selectedChoiceIndex: number | null;
  answered: boolean;
  onSelect: (index: number) => void;
  onNext: () => void;
  questionNum: number;
}) {
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

// ===========================================================================
// Input Question View
// ===========================================================================

/** Split an input question prompt into instruction + sentence with blank parts */
function parseInputPrompt(prompt: string): {
  instruction: string;
  before: string;
  after: string;
} {
  // Prompts follow: "Instruction : « before ___ after »"
  const guiIdx = prompt.indexOf("«");
  if (guiIdx === -1) {
    // Fallback: treat entire prompt as instruction, blank is the whole sentence
    return { instruction: prompt, before: "", after: "" };
  }
  const instruction = prompt.slice(0, guiIdx).replace(/\s*:\s*$/, "").trim();
  const sentence = prompt.slice(guiIdx + 1).replace(/»\s*$/, "").trim();
  const blankIdx = sentence.indexOf("___");
  if (blankIdx === -1) {
    return { instruction, before: sentence, after: "" };
  }
  return {
    instruction,
    before: sentence.slice(0, blankIdx),
    after: sentence.slice(blankIdx + 3),
  };
}

function InputQuestionView({
  question,
  answered,
  onAnswer,
  onNext,
  questionNum,
}: {
  question: InputQuestion;
  answered: boolean;
  onAnswer: (isCorrect: boolean) => void;
  onNext: () => void;
  questionNum: number;
}) {
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<InputResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const { instruction, before, after } = parseInputPrompt(question.prompt);

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
  const inputWidth = Math.max(userInput.length, 3);

  return (
    <div className="animate-scale-in" key={question.id}>
      {/* Instruction line */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
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
        <p className="text-base text-ardoise leading-relaxed">
          {instruction}
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

// ===========================================================================
// Input Feedback Panel
// ===========================================================================

function InputFeedbackPanel({
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

// ===========================================================================
// MCQ Components (unchanged)
// ===========================================================================

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

function McqExplanationPanel({
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

// ===========================================================================
// Score Summary
// ===========================================================================

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
              <div className="flex items-center gap-2">
                {answer.question.type === "input" && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-tricolore-bleu/40 shrink-0" title="Question à saisie" />
                )}
                <p className="text-sm text-encre leading-relaxed">
                  {answer.question.prompt}
                </p>
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
