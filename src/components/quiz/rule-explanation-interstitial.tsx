import { useEffect } from "react";
import type { RuleExplanation } from "~/data/types";
import { t } from "~/lang";
import { RenderMiniMarkdown } from "./explanation-panel";

export function RuleExplanationInterstitial({
  explanation,
  onStart,
}: {
  explanation: RuleExplanation;
  onStart: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onStart();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStart]);

  return (
    <div className="min-h-screen bg-papier flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-xl">
        <p className="text-sm text-ardoise mb-3 text-center">
          {t.quiz.interstitialIntro}
        </p>

        <div className="bg-tricolore-blanc rounded-xl shadow-sm border border-craie p-6 md:p-8">
          {/* Title */}
          <h2 className="text-xl md:text-2xl font-semibold text-encre mb-4 leading-snug">
            {explanation.title}
          </h2>

          {/* Body */}
          <div className="text-base text-encre/90 leading-relaxed mb-6">
            <RenderMiniMarkdown text={explanation.body} />
          </div>

          {/* Examples */}
          <div className="mb-8">
            <h3 className="text-xs font-medium text-ardoise uppercase tracking-wider mb-3">
              {t.quiz.examples}
            </h3>
            <ul className="space-y-2">
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

          {/* Action */}
          <button
            onClick={onStart}
            className="w-full py-3 px-6 rounded-lg bg-tricolore-bleu text-tricolore-blanc font-semibold text-base transition-all hover:bg-tricolore-bleu/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tricolore-bleu/50 focus-visible:ring-offset-2"
          >
            {t.quiz.startPractice}
            <span className="ml-2 text-xs text-white/40">{t.quiz.enterHint}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
