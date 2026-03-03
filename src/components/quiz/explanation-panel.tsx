import { useEffect, type JSX } from "react";
import type { RuleExplanation } from "~/data/types";
import { t } from "~/lang";

/** Renders a light markdown subset: **bold**, `code`, and ~~strikethrough~~ inline. */
export function RenderMiniMarkdown({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-encre">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 rounded bg-tricolore-bleu/[.06] text-[13px] font-mono text-encre/75">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("~~") && part.endsWith("~~")) {
          return <s key={i} className="text-tricolore-rouge/60">{part.slice(2, -2)}</s>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Explanation panel — pure CSS responsive:
 *
 * - **Desktop (≥ lg)**: Rendered inside a width-animated wrapper as a flex
 *   sibling of the quiz content. Sticky, scrolls independently, separated
 *   by a left border. No fixed positioning — it's in the document flow.
 *
 * - **Mobile (< lg)**: Fixed bottom sheet with backdrop, scrollable content,
 *   and body-scroll lock when open.
 *
 * The parent quiz runner is responsible for the desktop layout wrapper
 * (the flex container and the width-animated div). This component renders
 * both the desktop sidebar content and the mobile sheet; CSS hides the
 * irrelevant one at each breakpoint.
 */
export function ExplanationPanel({
  explanation,
  isOpen,
  onClose,
  mode = "both",
}: {
  explanation: RuleExplanation | undefined;
  isOpen: boolean;
  onClose: () => void;
  mode?: "desktop" | "mobile" | "both";
}) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) return; // desktop — no lock needed
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const title = explanation?.title ?? t.quiz.viewExplanation;

  const content = explanation ? (
    <>
      <div className="text-[14.5px] text-encre/85 leading-[1.7] mb-5">
        <RenderMiniMarkdown text={explanation.body} />
      </div>
      <div className="text-xs font-medium text-ardoise/60 uppercase tracking-widest mb-2.5">
        {t.quiz.examples}
      </div>
      <ul className="space-y-2">
        {explanation.examples.map((ex, i) => (
          <li key={i} className="flex gap-2 text-[13.5px] text-encre/75 leading-relaxed">
            <span className="text-tricolore-bleu/30 mt-[3px] shrink-0 select-none" aria-hidden>&#x2022;</span>
            <span><RenderMiniMarkdown text={ex} /></span>
          </li>
        ))}
      </ul>
    </>
  ) : (
    <p className="text-sm text-ardoise/70 italic">
      {t.quiz.noExplanation}
    </p>
  );

  const closeButton = (
    <button
      onClick={onClose}
      className="shrink-0 p-1 -mr-1 rounded-md text-ardoise/50 hover:text-encre transition-colors"
      aria-label={t.quiz.closeExplanation}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  const showDesktop = mode === "desktop" || mode === "both";
  const showMobile = mode === "mobile" || mode === "both";

  return (
    <>
      {/* ── Desktop: in-flow sidebar (hidden below lg) ──────────────── */}
      {showDesktop && (
        <div
          className="hidden lg:block sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto"
          role="complementary"
          aria-label={title}
        >
          <div className="flex items-start justify-between px-5 pt-5 pb-2">
            <h3 className="text-[15px] font-semibold text-encre leading-snug pr-3">{title}</h3>
            {closeButton}
          </div>
          <div className="px-5 pb-6">{content}</div>
        </div>
      )}

      {/* ── Mobile: fixed bottom sheet (hidden at lg+) ─────────────── */}
      {showMobile && (
        <>
          {/* Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 z-40 bg-encre/25 transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="complementary"
            aria-label={title}
            className={`
              lg:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl
              bg-tricolore-blanc shadow-[0_-4px_32px_rgba(0,0,0,0.08)]
              transition-transform duration-300 ease-out
              flex flex-col max-h-[80vh]
              ${isOpen ? "translate-y-0" : "translate-y-full"}
            `}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-[3px] rounded-full bg-craie" />
            </div>
            <div className="flex items-start justify-between px-5 pt-1 pb-2 shrink-0">
              <h3 className="text-base font-semibold text-encre leading-snug pr-4">{title}</h3>
              {closeButton}
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-6">
              {content}
            </div>
          </div>
        </>
      )}
    </>
  );
}
