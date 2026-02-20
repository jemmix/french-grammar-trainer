import Head from "next/head";
import Link from "next/link";
import { sectionsIndex } from "~/data/sections-index";

export default function Home() {
  return (
    <>
      <Head>
        <title>Grammaire Française B1</title>
        <meta name="description" content="Entraînement à la grammaire française niveau B1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-papier">
        {/* Header */}
        <header className="border-b border-craie bg-tricolore-blanc">
          <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
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
        </header>

        {/* Section Grid */}
        <main className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {sectionsIndex.map((section, i) => {
              const available = section.questionCount > 0;
              const sectionNum = section.id.split("-")[0];

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
                      <SectionCardContent sectionNum={sectionNum} section={section} available />
                    </Link>
                  ) : (
                    <div className="block h-full rounded-xl border border-craie/60 bg-papier-warm p-6 opacity-55">
                      <SectionCardContent sectionNum={sectionNum} section={section} available={false} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-craie py-8 text-center text-sm text-ardoise">
          <p>Grammaire Française B1 — Entraînement interactif</p>
        </footer>
      </div>
    </>
  );
}

function SectionCardContent({
  sectionNum,
  section,
  available,
}: {
  sectionNum: string | undefined;
  section: { title: string; description: string; questionCount: number };
  available: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-tricolore-bleu/8 text-sm font-semibold text-tricolore-bleu shrink-0">
          {sectionNum}
        </span>
        {available ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-correct-bg text-correct border border-correct-border">
            {section.questionCount} questions
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-papier-warm text-ardoise border border-craie">
            Bientôt
          </span>
        )}
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
