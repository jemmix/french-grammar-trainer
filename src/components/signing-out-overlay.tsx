"use client";

import { t } from "~/lang";

/**
 * Full-screen overlay shown immediately when sign-out is triggered.
 * Fades in with a gentle spinner and message.
 */
export function SigningOutOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-papier animate-fade-in">
      {/* Tricolore bar */}
      <div className="flex gap-0.5 mb-8">
        <div className="w-1 h-6 rounded-full bg-tricolore-bleu" />
        <div className="w-1 h-6 rounded-full bg-craie" />
        <div className="w-1 h-6 rounded-full bg-tricolore-rouge" />
      </div>

      {/* Spinner */}
      <div className="relative w-8 h-8 mb-6">
        <div
          className="absolute inset-0 rounded-full border-2 border-craie border-t-tricolore-bleu"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>

      <p className="text-sm text-ardoise">{t.home.signingOut}</p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
