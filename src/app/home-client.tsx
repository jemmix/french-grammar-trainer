"use client";

import { useState } from "react";
import Link from "next/link";
import { useProgress } from "~/contexts/progress-context";
import { ProgressRing } from "~/components/progress-ring";
import { GoogleSignInButton } from "~/components/google-sign-in-button";
import { SigningOutOverlay } from "~/components/signing-out-overlay";
import { getTier } from "~/lib/tiers";
import { t } from "~/lang";
import { BrandMark, useTheme } from "~/themes";
import type { SectionMeta } from "~/data/types";

function SectionCardContent({
  sectionNum,
  section,
  available,
  showCount,
  ringPower,
  ringAttempted,
}: {
  sectionNum: string | undefined;
  section: { title: string; description: string; questionCount: number };
  available: boolean;
  showCount: boolean;
  ringPower?: number;
  ringAttempted?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        {ringPower !== undefined ? (
          <div className="relative shrink-0 w-9 h-9">
            <ProgressRing power={ringPower} attempted={ringAttempted ?? false} size={36} />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-ink">
              {sectionNum}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/8 text-sm font-semibold text-primary shrink-0">
            {sectionNum}
          </span>
        )}
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-opacity duration-500 ${
            showCount ? "opacity-100" : "opacity-0 pointer-events-none"
          } ${
            available
              ? "bg-correct-bg text-correct border border-correct-border"
              : "bg-paper-warm text-muted border border-chalk"
          }`}
        >
          {available ? `${section.questionCount} questions` : t.home.comingSoon}
        </span>
      </div>
      <h2 className="text-base font-semibold text-ink leading-snug mb-2">
        {section.title}
      </h2>
      <p className="text-sm text-muted leading-relaxed">
        {section.description}
      </p>
      {available && (
        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {t.home.startButton}
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      )}
    </>
  );
}

export function HomeClient({ sections }: { sections: SectionMeta[] }) {
  const [revealed, setRevealed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const {
    isLoggedIn,
    isLoading,
    userId,
    logout,
    getSectionPower,
    getGlobalPower,
  } = useProgress();

  const availableSections = sections.filter((s) => s.questionCount > 0);
  const hiddenCount = sections.length - availableSections.length;
  const visibleSections = revealed ? sections : availableSections;

  const globalPower = isLoggedIn && !isLoading ? getGlobalPower() : 0;
  const globalTier = getTier(globalPower, globalPower > 0);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
  };

  const theme = useTheme();

  return (
    <div className="min-h-screen bg-paper">
      {signingOut && <SigningOutOverlay />}

      {/* Header */}
      <header className="border-b border-chalk bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <BrandMark theme={theme} size="lg" />
                <p className="text-sm font-medium tracking-widest uppercase text-muted">
                  {t.meta.levelLabel}
                </p>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink">
                {t.home.heading}
              </h1>
              <p className="mt-3 text-lg text-muted max-w-2xl">
                {t.home.subtitle}
              </p>
            </div>

            {/* Auth controls */}
            <div className="shrink-0 flex flex-col items-end gap-1.5 pt-1">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/my-data"
                    className="text-xs text-muted hover:text-ink transition-colors"
                  >
                    {t.home.myDataLink}
                  </Link>
                  <button
                    onClick={() => void handleLogout()}
                    className="text-xs text-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    {t.home.logout}
                  </button>
                  {userId && (
                    <span className="text-[10px] font-mono text-muted/40">
                      {userId.slice(0, 8)}…
                    </span>
                  )}
                </>
              ) : (
                <GoogleSignInButton href="/login" label={t.login.googleSignIn} />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Section Grid */}
      <main className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        {/* Progress + Learn CTA (unified) */}
        <div className="mb-8">
          <Link
            href="/quiz/learn"
            className="group block sm:flex sm:items-center sm:gap-5 px-6 py-5 rounded-xl border border-chalk bg-surface hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-200"
          >
            {isLoggedIn && !isLoading && globalPower > 0 && globalTier && (
              <div className="flex items-center gap-3 mb-3 pb-3 sm:mb-0 sm:pb-0 border-b sm:border-b-0 sm:border-r border-chalk/60 sm:pr-5 shrink-0">
                <ProgressRing power={globalPower} attempted={true} size={40} />
                <div>
                  <p className="text-sm font-semibold text-ink">{globalTier.label}</p>
                  <p className="text-xs text-muted">{globalTier.promo}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="font-semibold text-ink text-base mb-0.5">
                  {t.home.learnFreelyTitle}
                </p>
                <p className="text-sm text-muted">
                  {isLoggedIn
                    ? t.home.learnFreelySubLogged
                    : t.home.learnFreelySubAnon}
                </p>
              </div>
              <div className="flex items-center gap-2 text-primary font-medium text-sm shrink-0">
                {t.home.startButton}
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {visibleSections.map((section, i) => {
            const available = section.questionCount > 0;
            const sectionNum = section.id.split("-")[0];
            const sectionPower = isLoggedIn ? getSectionPower(section.id) : undefined;
            const sectionAttempted = sectionPower !== undefined && sectionPower > 0;

            return (
              <div
                key={section.id}
                className="animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
              >
                {available ? (
                  <Link
                    href={`/quiz/${section.id}`}
                    className="group block h-full rounded-xl border border-chalk bg-surface p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
                  >
                    <SectionCardContent
                      sectionNum={sectionNum}
                      section={section}
                      available
                      showCount={revealed}
                      ringPower={sectionPower}
                      ringAttempted={sectionAttempted}
                    />
                  </Link>
                ) : (
                  <div className="block h-full rounded-xl border border-chalk/60 bg-paper-warm p-6 opacity-55">
                    <SectionCardContent
                      sectionNum={sectionNum}
                      section={section}
                      available={false}
                      showCount={revealed}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-chalk py-8 text-center text-sm text-muted">
        <p>
          {t.home.footerTagline}
          <span className="mx-2 opacity-30">·</span>
          <Link href="/privacy" className="hover:text-ink transition-colors">
            {t.home.privacyLink}
          </Link>
        </p>
        {hiddenCount > 0 && (
          <button
            onClick={() => setRevealed((r) => !r)}
            className="mt-4 inline-flex items-center gap-3 text-xs text-muted/35 hover:text-muted/65 transition-colors duration-300 group cursor-pointer"
          >
            <span className="block h-px w-6 bg-current transition-[width] duration-300 group-hover:w-10" />
            <span className="tracking-wide">
              {revealed ? t.home.hiddenCollapse : t.home.hiddenReveal(hiddenCount)}
            </span>
            <span className="block h-px w-6 bg-current transition-[width] duration-300 group-hover:w-10" />
          </button>
        )}
      </footer>
    </div>
  );
}
