import Head from "next/head";
import Link from "next/link";

export default function GoodbyePage() {
  return (
    <>
      <Head>
        <title>Au revoir — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier flex items-center justify-center px-6">
        <div className="max-w-md w-full animate-scale-in">
          <div className="rounded-2xl border border-craie bg-tricolore-blanc px-8 py-10 md:px-10 md:py-12 shadow-sm text-center">
            <div className="inline-flex items-center gap-0.5 mb-5">
              <div className="w-1.5 h-8 rounded-full bg-tricolore-bleu" />
              <div className="w-1.5 h-8 rounded-full bg-craie" />
              <div className="w-1.5 h-8 rounded-full bg-tricolore-rouge" />
            </div>

            <h1 className="text-3xl font-bold text-encre mb-3">Au revoir !</h1>

            <div className="flex justify-center mb-5">
              <svg width="60" height="12" viewBox="0 0 60 12" className="text-craie" fill="none">
                <path d="M0 6Q15 0 30 6Q45 12 60 6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>

            <p className="text-ardoise leading-relaxed mb-2">
              Vos données seront supprimées sous peu.
            </p>
            <p className="text-sm text-ardoise leading-relaxed mb-8">
              Vous pouvez continuer à pratiquer en mode anonyme, ou vous
              reconnecter pour créer un nouveau profil vierge et reprendre le
              suivi de vos progrès.
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
      </div>
    </>
  );
}
