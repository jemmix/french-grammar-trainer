import Head from "next/head";
import Link from "next/link";

export default function GoodbyePage() {
  return (
    <>
      <Head>
        <title>Au revoir — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center gap-0.5 mb-6">
            <div className="w-1.5 h-8 rounded-full bg-tricolore-bleu" />
            <div className="w-1.5 h-8 rounded-full bg-craie" />
            <div className="w-1.5 h-8 rounded-full bg-tricolore-rouge" />
          </div>

          <h1 className="text-3xl font-bold text-encre mb-4">Au revoir !</h1>

          <p className="text-ardoise leading-relaxed mb-2">
            Vos données ont été supprimées.
          </p>
          <p className="text-ardoise leading-relaxed mb-8">
            Vous êtes toujours le bienvenu — l&apos;application reste entièrement disponible en mode anonyme.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-tricolore-bleu text-white font-medium rounded-xl hover:bg-encre-light transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </>
  );
}
