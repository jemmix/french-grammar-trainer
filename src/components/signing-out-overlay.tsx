"use client";

import { t } from "~/lang";
import { BrandMark, useTheme } from "~/themes";

/**
 * Full-screen overlay shown immediately when sign-out is triggered.
 * Fades in with a gentle spinner and message.
 */
export function SigningOutOverlay() {
  const theme = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper animate-fade-in">
      <div className="mb-8">
        <BrandMark theme={theme} size="sm" />
      </div>

      {/* Spinner */}
      <div className="relative w-8 h-8 mb-6">
        <div
          className="absolute inset-0 rounded-full border-2 border-chalk border-t-primary"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>

      <p className="text-sm text-muted">{t.home.signingOut}</p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
