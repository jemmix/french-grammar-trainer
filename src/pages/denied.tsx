import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export default function DeniedPage() {
  const router = useRouter();
  const { userId } = router.query;
  const userIdStr = typeof userId === "string" ? userId : undefined;

  return (
    <>
      <Head>
        <title>Accès limité — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier flex items-center justify-center px-6">
        <div className="max-w-md w-full animate-scale-in">
          <div className="rounded-2xl border border-craie bg-tricolore-blanc px-8 py-10 md:px-10 md:py-12 shadow-sm text-center">
            <svg className="w-10 h-10 mx-auto text-ardoise/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>

            <div className="inline-flex items-center gap-0.5 mb-5">
              <div className="w-1.5 h-8 rounded-full bg-tricolore-bleu" />
              <div className="w-1.5 h-8 rounded-full bg-craie" />
              <div className="w-1.5 h-8 rounded-full bg-tricolore-rouge" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-encre mb-4">Accès limité</h1>

            <p className="text-ardoise leading-relaxed mb-6">
              L&apos;accès à cette application est actuellement sur invitation.
              Si vous souhaitez y accéder, veuillez contacter l&apos;équipe.
            </p>

            {userIdStr && (
              <div className="mb-6 p-4 rounded-xl bg-papier border border-craie text-left">
                <p className="text-xs text-ardoise mb-2">
                  Votre identifiant (à inclure dans votre demande d&apos;accès) :
                </p>
                <p className="font-mono text-[11px] text-encre break-all select-all bg-papier-warm rounded-lg px-3 py-2 border border-craie/60">
                  {userIdStr}
                </p>
              </div>
            )}

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-tricolore-bleu hover:text-encre transition-colors font-medium"
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
