import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { sectionsIndex } from "~/data/sections-index";
import { useProgress } from "~/contexts/progress-context";
import { ProgressRing } from "~/components/progress-ring";
import { getTier } from "~/lib/constants";

export default function Home() {
  const [revealed, setRevealed] = useState(false);
  const {
    isLoggedIn,
    isLoading,
    userId,
    logout,
    getSectionPower,
    getGlobalPower,
  } = useProgress();

  const availableSections = sectionsIndex.filter((s) => s.questionCount > 0);
  const hiddenCount = sectionsIndex.length - availableSections.length;
  const visibleSections = revealed ? sectionsIndex : availableSections;

  const globalPower = isLoggedIn && !isLoading ? getGlobalPower() : 0;
  const globalTier = getTier(globalPower, globalPower > 0);

  return (
    <>
      <Head>
        <title>Grammaire Française B1</title>
        <meta name="description" content="Entraînement à la grammaire française niveau B1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#002654" />
      </Head>

      <div className="min-h-screen bg-papier">
        {/* Header */}
        <header className="border-b border-craie bg-tricolore-blanc">
          <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-8 rounded-full bg-tricolore-bleu" />
                    <div className="w-1.5 h-8 rounded-full bg-craie" />
                    <div className="w-1.5 h-8 rounded-full bg-tricolore-rouge" />
                  </div>
                  <p className="text-sm font-medium tracking-widest uppercase text-ardoise">
                    Niveau B1
                  </p>
                </div>
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-encre">
                  Grammaire Française
                </h1>
                <p className="mt-3 text-lg text-ardoise max-w-2xl">
                  Maîtrisez les règles essentielles de la grammaire française à travers
                  des exercices interactifs. Choisissez une section pour commencer.
                </p>
              </div>

              {/* Auth controls */}
              {process.env.NODE_ENV === "development" && (
                <div className="shrink-0 flex flex-col items-end gap-1 pt-1">
                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/my-data"
                        className="text-xs text-ardoise hover:text-encre transition-colors"
                      >
                        Mes données
                      </Link>
                      <button
                        onClick={() => void logout()}
                        className="text-xs text-ardoise hover:text-encre transition-colors cursor-pointer"
                      >
                        Se déconnecter
                      </button>
                      {userId && (
                        <span className="text-[10px] font-mono text-ardoise/40">
                          {userId.slice(0, 8)}…
                        </span>
                      )}
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className="text-xs text-tricolore-bleu hover:text-encre transition-colors"
                    >
                      Se connecter
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Section Grid */}
        <main className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          {/* Global progress banner */}
          {isLoggedIn && !isLoading && (
            <div className="mb-8">
              {globalPower > 0 && globalTier ? (
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-craie bg-tricolore-blanc">
                  <ProgressRing power={globalPower} attempted={true} size={40} />
                  <div>
                    <p className="text-sm font-semibold text-encre">
                      {globalTier.label}
                    </p>
                    <p className="text-xs text-ardoise">{globalTier.promo}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ardoise text-center py-3">
                  Commencez à pratiquer pour suivre vos progrès !
                </p>
              )}
            </div>
          )}

          {/* Apprendre librement CTA */}
          <div className="mb-8">
            <Link
              href="/quiz/learn"
              className="group flex items-center justify-between px-6 py-5 rounded-xl border border-tricolore-bleu/20 bg-tricolore-blanc hover:border-tricolore-bleu/40 hover:shadow-lg hover:shadow-tricolore-bleu/5 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div>
                <p className="font-semibold text-encre text-base mb-0.5">
                  Apprendre librement
                </p>
                <p className="text-sm text-ardoise">
                  {isLoggedIn
                    ? "20 questions adaptées à votre niveau"
                    : "20 questions de tous les sujets"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-tricolore-bleu font-medium text-sm">
                Commencer
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
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
                      className="group block h-full rounded-xl border border-craie bg-tricolore-blanc p-6 transition-all duration-200 hover:border-tricolore-bleu/30 hover:shadow-lg hover:shadow-tricolore-bleu/5 hover:-translate-y-0.5"
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
                    <div className="block h-full rounded-xl border border-craie/60 bg-papier-warm p-6 opacity-55">
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
        <footer className="border-t border-craie py-8 text-center text-sm text-ardoise">
          <p>
            Grammaire Française B1 — Entraînement interactif
            <span className="mx-2 opacity-30">·</span>
            <Link href="/privacy" className="hover:text-encre transition-colors">
              Confidentialité
            </Link>
          </p>
          {hiddenCount > 0 && (
            <button
              onClick={() => setRevealed((r) => !r)}
              className="mt-4 inline-flex items-center gap-3 text-xs text-ardoise/35 hover:text-ardoise/65 transition-colors duration-300 group cursor-pointer"
            >
              <span className="block h-px w-6 bg-current transition-[width] duration-300 group-hover:w-10" />
              <span className="tracking-wide">
                {revealed ? "réduire" : `+${hiddenCount} sections à venir`}
              </span>
              <span className="block h-px w-6 bg-current transition-[width] duration-300 group-hover:w-10" />
            </button>
          )}
        </footer>
      </div>
    </>
  );
}

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
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-tricolore-bleu/8 text-sm font-semibold text-tricolore-bleu shrink-0">
          {sectionNum}
        </span>
        <div className="flex items-center gap-2">
          {ringPower !== undefined && (
            <ProgressRing
              power={ringPower}
              attempted={ringAttempted ?? false}
              size={28}
            />
          )}
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-opacity duration-500 ${
              showCount ? "opacity-100" : "opacity-0 pointer-events-none"
            } ${
              available
                ? "bg-correct-bg text-correct border border-correct-border"
                : "bg-papier-warm text-ardoise border border-craie"
            }`}
          >
            {available ? `${section.questionCount} questions` : "Bientôt"}
          </span>
        </div>
      </div>
      <h2 className="text-base font-semibold text-encre leading-snug mb-2">
        {section.title}
      </h2>
      <p className="text-sm text-ardoise leading-relaxed">
        {section.description}
      </p>
      {available && (
        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-tricolore-bleu opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Commencer
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      )}
    </>
  );
}
