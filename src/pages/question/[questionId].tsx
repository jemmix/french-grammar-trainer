import type { JSX } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Choice,
  InputQuestion,
  MultipleChoiceQuestion,
  Question,
  Rule,
  Section,
} from "~/data/types";
import { sectionMap } from "~/data/sections-index";

// ---------------------------------------------------------------------------
// Question lookup helper
// ---------------------------------------------------------------------------

interface QuestionContext {
  question: Question;
  section: Section;
  rule: Rule;
}

/** Replaces runs of 2+ underscores with a styled inline blank element. */
function renderWithBlanks(text: string): (string | JSX.Element)[] {
  return text.split(/(_{2,})/).map((part, i) =>
    /^_{2,}$/.test(part) ? (
      <span
        key={i}
        className="inline-block min-w-[4.5ch] mx-0.5 px-2 py-0.5 align-baseline rounded-[3px] bg-tricolore-bleu/[.07] border-b-2 border-tricolore-bleu/40"
        aria-label="blanc"
      />
    ) : part
  );
}

function findQuestion(questionId: string): QuestionContext | null {
  for (const section of Object.values(sectionMap)) {
    const question = section.questions.find((q) => q.id === questionId);
    if (question) {
      const rule = section.rules.find((r) => r.id === question.ruleId);
      if (rule) return { question, section, rule };
    }
  }
  return null;
}

// Levenshtein distance (reused from quiz page)
function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2;
  const prev = Array.from({ length: lb + 1 }, (_, i) => i);
  const curr = new Array<number>(lb + 1);
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j]!;
  }
  return prev[lb]!;
}

type InputResultKind =
  | "exact"
  | "case-warning"
  | "wrong-prepared"
  | "typo-correct"
  | "typo-wrong"
  | "unknown";

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
  if (trimmed === answer) return { kind: "exact", isCorrect: true };
  if (trimmed.toLowerCase() === answer.toLowerCase())
    return { kind: "case-warning", isCorrect: true, matchedAnswer: answer };
  for (const wrong of question.wrongAnswers) {
    if (trimmed.toLowerCase() === wrong.text.toLowerCase())
      return { kind: "wrong-prepared", isCorrect: false, matchedAnswer: wrong.text, wrongExplanation: wrong.explanation };
  }
  if (levenshteinDistance(trimmed.toLowerCase(), answer.toLowerCase()) === 1)
    return { kind: "typo-correct", isCorrect: false, matchedAnswer: answer };
  for (const wrong of question.wrongAnswers) {
    if (levenshteinDistance(trimmed.toLowerCase(), wrong.text.toLowerCase()) === 1)
      return { kind: "typo-wrong", isCorrect: false, matchedAnswer: wrong.text, wrongExplanation: wrong.explanation };
  }
  return { kind: "unknown", isCorrect: false };
}

/** Accepts any run of 2+ underscores as the placeholder. */
function parsePhrase(phrase: string): { before: string; after: string } {
  const content = phrase.replace(/^«\s*/, "").replace(/\s*»$/, "");
  const match = content.match(/_{2,}/);
  if (!match || match.index === undefined) return { before: content, after: "" };
  return { before: content.slice(0, match.index), after: content.slice(match.index + match[0].length) };
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

function findAdjacentQuestions(
  questionId: string,
  section: Section,
): { prev: string | null; next: string | null } {
  const idx = section.questions.findIndex((q) => q.id === questionId);
  return {
    prev: idx > 0 ? section.questions[idx - 1]!.id : null,
    next: idx < section.questions.length - 1 ? section.questions[idx + 1]!.id : null,
  };
}

// ===========================================================================
// Main Page
// ===========================================================================

export default function QuestionReviewPage() {
  const router = useRouter();
  const { questionId } = router.query;

  const ctx = useMemo(
    () => (typeof questionId === "string" ? findQuestion(questionId) : null),
    [questionId],
  );

  const adjacent = useMemo(
    () =>
      ctx ? findAdjacentQuestions(ctx.question.id, ctx.section) : { prev: null, next: null },
    [ctx],
  );

  // Keyboard nav: left/right arrows
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && adjacent.prev) {
        void router.push(`/question/${adjacent.prev}`);
      } else if (e.key === "ArrowRight" && adjacent.next) {
        void router.push(`/question/${adjacent.next}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [adjacent, router]);

  if (!ctx) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-ardoise text-lg mb-4">Question introuvable</p>
          <Link href="/" className="text-tricolore-bleu font-medium hover:underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const { question, section, rule } = ctx;
  const ruleQuestions = section.questions.filter((q) => q.ruleId === rule.id);
  const posInRule = ruleQuestions.findIndex((q) => q.id === question.id) + 1;

  return (
    <>
      <Head>
        <title>{question.id} — Revue — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier">
        {/* ── Top bar ── */}
        <div className="sticky top-0 z-10 bg-tricolore-blanc/90 backdrop-blur-sm border-b border-craie">
          <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between gap-4">
            <Link
              href={`/quiz/${section.id}`}
              className="flex items-center gap-2 text-sm text-ardoise hover:text-encre transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {section.title}
            </Link>

            <div className="flex items-center gap-2">
              {/* Prev / Next arrows */}
              <div className="flex items-center gap-1">
                {adjacent.prev ? (
                  <Link
                    href={`/question/${adjacent.prev}`}
                    className="p-1.5 rounded-lg text-ardoise hover:text-encre hover:bg-papier-warm transition-colors"
                    title={`Question précédente (${adjacent.prev})`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="p-1.5 text-craie"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></span>
                )}
                {adjacent.next ? (
                  <Link
                    href={`/question/${adjacent.next}`}
                    className="p-1.5 rounded-lg text-ardoise hover:text-encre hover:bg-papier-warm transition-colors"
                    title={`Question suivante (${adjacent.next})`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="p-1.5 text-craie"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
                )}
              </div>

              <CopyPermalinkButton />
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-3xl px-6 py-8 md:py-12">
          {/* ── Metadata header ── */}
          <div className="animate-fade-in mb-10">
            {/* Breadcrumb chips */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <MetaChip label={section.title} />
              <ChevronDot />
              <MetaChip label={rule.title} />
              <ChevronDot />
              <MetaChip label={`${posInRule} / ${ruleQuestions.length}`} muted />
            </div>

            {/* ID + badges row */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-encre tracking-tight font-mono">
                {question.id}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                question.type === "mcq"
                  ? "bg-tricolore-bleu/8 text-tricolore-bleu"
                  : "bg-warning/10 text-warning"
              }`}>
                {question.type === "mcq" ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    QCM
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Saisie
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-papier-warm text-[11px] font-medium text-ardoise border border-craie">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {question.generatedBy}
              </span>
            </div>
          </div>

          {/* ── Question body ── */}
          <div className="animate-scale-in">
            {question.type === "mcq" ? (
              <McqReview question={question} />
            ) : (
              <InputReview question={question} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// ===========================================================================
// Shared components
// ===========================================================================

function MetaChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={`text-xs font-medium leading-tight ${muted ? "text-ardoise" : "text-encre"}`}>
      {label}
    </span>
  );
}

function ChevronDot() {
  return (
    <svg className="w-3 h-3 text-craie shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CopyPermalinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ardoise hover:text-encre hover:bg-papier-warm border border-craie transition-all duration-200 cursor-pointer"
      title="Copier le lien permanent"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-correct" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-correct">Copié</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Permalien
        </>
      )}
    </button>
  );
}

// ===========================================================================
// Collapsible section
// ===========================================================================

function Disclosure({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-craie rounded-xl bg-tricolore-blanc overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-papier-warm transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-encre">{title}</span>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-papier-warm text-ardoise border border-craie">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-ardoise transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-craie px-5 py-4 animate-slide-up">
          {children}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// MCQ Review
// ===========================================================================

function McqReview({ question }: { question: MultipleChoiceQuestion }) {
  const [expandedChoices, setExpandedChoices] = useState<Set<number>>(new Set());

  const toggleChoice = (i: number) => {
    setExpandedChoices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedChoices(new Set(question.choices.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedChoices(new Set());
  };

  const allExpanded = expandedChoices.size === question.choices.length;

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <div className="py-5 px-5 rounded-xl bg-tricolore-blanc border border-craie">
        <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-3">Énoncé</p>
        <p className="text-xl md:text-2xl font-medium text-encre leading-relaxed">
          {renderWithBlanks(question.prompt)}
        </p>
      </div>

      {/* Choices header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ardoise uppercase tracking-wider">
          Choix ({question.choices.length})
        </p>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-xs text-tricolore-bleu hover:underline cursor-pointer"
        >
          {allExpanded ? "Tout replier" : "Tout déplier"}
        </button>
      </div>

      {/* Choice cards */}
      <div className="space-y-3">
        {question.choices.map((choice, i) => (
          <McqChoiceCard
            key={i}
            choice={choice}
            index={i}
            expanded={expandedChoices.has(i)}
            onToggle={() => toggleChoice(i)}
          />
        ))}
      </div>
    </div>
  );
}

function McqChoiceCard({
  choice,
  index,
  expanded,
  onToggle,
}: {
  choice: Choice;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isCorrect = choice.correct;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isCorrect
          ? "border-correct-border bg-correct-bg/50"
          : "border-craie bg-tricolore-blanc"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4 cursor-pointer"
      >
        <span
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
            isCorrect
              ? "bg-correct text-white"
              : "bg-tricolore-bleu/8 text-tricolore-bleu"
          }`}
        >
          {isCorrect ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            index + 1
          )}
        </span>
        <span className="text-base leading-relaxed pt-0.5 text-encre flex-1">
          {choice.text}
        </span>
        <svg
          className={`w-4 h-4 text-ardoise shrink-0 mt-1.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pl-16 animate-slide-up">
          <p className="text-sm text-encre/80 leading-relaxed">{choice.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Input Review
// ===========================================================================

function InputReview({ question }: { question: InputQuestion }) {
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<InputResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { before, after } = parsePhrase(question.phrase);

  const handleSubmit = useCallback(() => {
    if (!userInput.trim()) return;
    setResult(evaluateInput(userInput, question));
  }, [userInput, question]);

  const handleReset = useCallback(() => {
    setUserInput("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (result) handleReset();
        else handleSubmit();
      }
    },
    [result, handleSubmit, handleReset],
  );

  let underlineColor = "border-craie";
  if (result) {
    if (result.kind === "exact") underlineColor = "border-correct";
    else if (result.kind === "case-warning") underlineColor = "border-warning";
    else underlineColor = "border-incorrect";
  }

  const inputWidth = Math.max(userInput.length, question.answer.length, 3);

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <div className="py-5 px-5 rounded-xl bg-tricolore-blanc border border-craie">
        <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-3">Consigne</p>
        <p className="text-base text-encre leading-relaxed">{question.prompt}</p>
      </div>

      {/* Phrase with inline input */}
      <div className="py-6 px-5 rounded-xl bg-tricolore-blanc border border-craie">
        <p className="text-xs font-medium text-ardoise uppercase tracking-wider mb-4">Tester la saisie</p>
        <p className="text-xl md:text-2xl font-medium text-encre leading-relaxed inline">
          <span>«&nbsp;{before}</span>
          <span className="inline-flex items-baseline mx-0.5">
            <span className="relative">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => !result && setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!!result}
                placeholder="…"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ width: `${inputWidth + 1.5}ch` }}
                className={`
                  text-xl md:text-2xl font-semibold text-tricolore-bleu
                  bg-transparent outline-none text-center
                  border-b-2 ${underlineColor}
                  ${!result ? "focus:border-tricolore-bleu" : ""}
                  placeholder:text-craie placeholder:font-light
                  transition-colors duration-300
                  py-0.5 px-1 min-w-[3ch]
                  ${result ? "cursor-default" : ""}
                `}
              />
            </span>
          </span>
          <span>{after}&nbsp;»</span>
        </p>

        {/* Submit / Reset */}
        <div className="mt-5 flex items-center gap-3">
          {!result ? (
            <button
              onClick={handleSubmit}
              disabled={!userInput.trim()}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                userInput.trim()
                  ? "bg-tricolore-bleu text-white hover:bg-encre-light shadow-sm"
                  : "bg-craie text-ardoise cursor-not-allowed"
              }`}
            >
              Valider
              <span className={`ml-2 text-xs ${userInput.trim() ? "text-white/40" : "text-ardoise/40"}`}>Entrée ↵</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-papier-warm border border-craie text-encre hover:bg-craie/50 transition-colors cursor-pointer"
            >
              Réessayer
              <span className="ml-2 text-xs text-ardoise/40">Entrée ↵</span>
            </button>
          )}
        </div>

        {/* Inline result feedback */}
        {result && (
          <div className="mt-4 animate-slide-up">
            <InputResultBadge result={result} question={question} userInput={userInput.trim()} />
          </div>
        )}
      </div>

      {/* Correct answer panel */}
      <Disclosure title="Bonne réponse" defaultOpen>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-correct">{question.answer}</p>
          <p className="text-sm text-encre/80 leading-relaxed">{question.explanation}</p>
        </div>
      </Disclosure>

      {/* All prepared wrong answers */}
      <Disclosure title="Mauvaises réponses prévues" badge={`${question.wrongAnswers.length}`}>
        <div className="space-y-4">
          {question.wrongAnswers.map((wa, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-incorrect/10 flex items-center justify-center">
                <svg className="w-3 h-3 text-incorrect" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-encre">{wa.text}</p>
                <p className="text-sm text-ardoise leading-relaxed">{wa.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </Disclosure>

      {/* Typo detection */}
      <Disclosure title="Variantes typo (distance 1)">
        <TypoVariantsPanel question={question} />
      </Disclosure>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input result feedback (compact, inline)
// ---------------------------------------------------------------------------

function InputResultBadge({
  result,
  question,
  userInput,
}: {
  result: InputResult;
  question: InputQuestion;
  userInput: string;
}) {
  const configs: Record<InputResultKind, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
    "exact": {
      bg: "bg-correct-bg", border: "border-correct-border",
      icon: <svg className="w-3.5 h-3.5 text-correct" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
      label: "Correspondance exacte",
    },
    "case-warning": {
      bg: "bg-warning-bg", border: "border-warning-border",
      icon: <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>,
      label: `Correct mais mauvaise casse — attendu « ${question.answer} »`,
    },
    "wrong-prepared": {
      bg: "bg-incorrect-bg", border: "border-incorrect-border",
      icon: <svg className="w-3.5 h-3.5 text-incorrect" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
      label: `Mauvaise réponse prévue « ${result.matchedAnswer} »`,
    },
    "typo-correct": {
      bg: "bg-incorrect-bg", border: "border-incorrect-border",
      icon: <svg className="w-3.5 h-3.5 text-incorrect" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
      label: `Typo de la bonne réponse « ${result.matchedAnswer} »`,
    },
    "typo-wrong": {
      bg: "bg-incorrect-bg", border: "border-incorrect-border",
      icon: <svg className="w-3.5 h-3.5 text-incorrect" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
      label: `Typo de « ${result.matchedAnswer} » (mauvaise réponse)`,
    },
    "unknown": {
      bg: "bg-incorrect-bg", border: "border-incorrect-border",
      icon: <svg className="w-3.5 h-3.5 text-incorrect" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" /></svg>,
      label: `« ${userInput} » — aucune correspondance`,
    },
  };

  const cfg = configs[result.kind];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      {cfg.icon}
      <span className="text-sm text-encre">{cfg.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typo variants panel
// ---------------------------------------------------------------------------

function TypoVariantsPanel({ question }: { question: InputQuestion }) {
  const allTargets = useMemo(() => {
    const targets = [
      { text: question.answer, kind: "correct" as const },
      ...question.wrongAnswers.map((wa) => ({ text: wa.text, kind: "wrong" as const })),
    ];
    return targets;
  }, [question]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ardoise leading-relaxed">
        Le système détecte les saisies à distance de Levenshtein 1 de chaque réponse prévue.
        Voici les chaînes cibles et leur longueur.
      </p>
      <div className="space-y-2">
        {allTargets.map((target, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`shrink-0 w-2 h-2 rounded-full ${target.kind === "correct" ? "bg-correct" : "bg-incorrect/40"}`} />
            <code className="text-sm font-mono text-encre bg-papier-warm px-2 py-0.5 rounded">
              {target.text}
            </code>
            <span className="text-xs text-ardoise">
              {target.text.length} car. — détecte les typos à ±1
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
