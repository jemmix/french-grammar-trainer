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
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center gap-0.5 mb-6">
            <div className="w-1.5 h-8 rounded-full bg-tricolore-bleu" />
            <div className="w-1.5 h-8 rounded-full bg-craie" />
            <div className="w-1.5 h-8 rounded-full bg-tricolore-rouge" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-encre mb-4">Accès limité</h1>

          <p className="text-ardoise leading-relaxed mb-6">
            L&apos;accès à cette application est actuellement sur invitation. Si vous souhaitez y accéder, veuillez contacter l&apos;équipe.
          </p>

          {userIdStr && (
            <div className="mb-6 p-4 rounded-xl bg-tricolore-blanc border border-craie">
              <p className="text-xs text-ardoise mb-2">Votre identifiant (à inclure dans votre demande d&apos;accès) :</p>
              <p className="font-mono text-xs text-encre break-all select-all">{userIdStr}</p>
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
    </>
  );
}
