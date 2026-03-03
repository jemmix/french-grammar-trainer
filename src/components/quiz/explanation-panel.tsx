import { useEffect, type JSX } from "react";
import type { RuleExplanation } from "~/data/types";
import { t } from "~/lang";

/** Renders a light markdown subset: **bold** and `code` inline. */
export function RenderMiniMarkdown({ text }: { text: string }): JSX.Element {
  // Split on **bold** and `code` patterns
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-encre">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 rounded bg-craie/60 text-sm font-mono text-encre/80">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("~~") && part.endsWith("~~")) {
          return <s key={i} className="text-tricolore-rouge/60">{part.slice(2, -2)}</s>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ExplanationPanel({
  explanation,
  isOpen,
  onClose,
}: {
  explanation: RuleExplanation;
  isOpen: boolean;
  onClose: () => void;
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

  return (
    <div
      role="complementary"
      aria-label={explanation.title}
      className={`
        fixed z-50 bg-tricolore-blanc shadow-lg transition-transform duration-300 ease-out
        /* Mobile: bottom sheet */
        inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl
        /* Desktop: right side panel */
        lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:max-h-none lg:rounded-t-none lg:rounded-l-2xl lg:w-[380px]
        ${isOpen
          ? "translate-y-0 lg:translate-y-0 lg:translate-x-0"
          : "translate-y-full lg:translate-y-0 lg:translate-x-full"
        }
      `}
    >
      {/* Mobile drag indicator */}
      <div className="flex justify-center pt-3 pb-1 lg:hidden">
        <div className="w-10 h-1 rounded-full bg-craie" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-3 pb-2 lg:pt-5">
        <h3 className="text-lg font-semibold text-encre leading-snug pr-4">
          {explanation.title}
        </h3>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 -mr-1.5 rounded-lg text-ardoise hover:text-encre hover:bg-craie/50 transition-colors"
          aria-label={t.quiz.closeExplanation}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto px-5 pb-6 max-h-[calc(80vh-4rem)] lg:max-h-[calc(100vh-5rem)]">
        {/* Body */}
        <div className="text-[15px] text-encre/90 leading-relaxed mb-5">
          <RenderMiniMarkdown text={explanation.body} />
        </div>

        {/* Examples */}
        <h4 className="text-xs font-medium text-ardoise uppercase tracking-wider mb-3">
          {t.quiz.examples}
        </h4>
        <ul className="space-y-2.5">
          {explanation.examples.map((ex, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm text-encre/85 leading-relaxed"
            >
              <span className="text-tricolore-bleu/50 mt-0.5 shrink-0">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="3" />
                </svg>
              </span>
              <span><RenderMiniMarkdown text={ex} /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
