import Head from "next/head";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Politique de confidentialité — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier">
        <div className="mx-auto max-w-2xl px-6 py-12 md:py-20">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ardoise hover:text-encre transition-colors mb-10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex gap-0.5">
              <div className="w-1 h-7 rounded-full bg-tricolore-bleu" />
              <div className="w-1 h-7 rounded-full bg-craie" />
              <div className="w-1 h-7 rounded-full bg-tricolore-rouge" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-encre">Politique de confidentialité</h1>
          </div>

          <div className="prose-like space-y-8 text-encre">

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Ce que nous collectons</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Nous ne collectons aucune donnée personnelle identifiable. Nous ne stockons pas votre adresse e-mail, votre nom, votre photo de profil, ni aucune autre information permettant de vous identifier directement.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                La seule information stockée est votre <strong>progression</strong> : un niveau cumulé par règle de grammaire (560 règles au total), représentant moins de 1,2 Ko de données.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Comment nous stockons vos données</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Nous dérivons un identifiant anonyme depuis votre compte de connexion à l&apos;aide d&apos;une fonction à sens unique (Argon2id). Cet identifiant ne permet pas de remonter jusqu'à votre compte d&apos;origine.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Vos données de progression sont stockées sous forme d&apos;un blob binaire associé à cet identifiant anonyme. Même en cas d&apos;accès non autorisé à notre base de données, il serait impossible de faire le lien entre vos données et votre identité.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Le cookie <code className="text-xs font-mono bg-craie/30 px-1.5 py-0.5 rounded">privacy-acknowledged</code></h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Si vous cochez « Ne plus afficher ce message » lors de la connexion, un cookie non-sensible est placé dans votre navigateur pour mémoriser ce choix. Ce cookie ne contient aucune donnée personnelle — uniquement la valeur <code className="text-xs font-mono">1</code>. Il expire après 10 ans.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Le cookie de session <code className="text-xs font-mono bg-craie/30 px-1.5 py-0.5 rounded">fgt-session</code></h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Lors de la connexion, un cookie HttpOnly est créé contenant votre identifiant anonyme. Ce cookie permet au serveur de retrouver votre progression lors de vos prochaines visites. Il ne contient aucune donnée personnelle.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Mode sans inscription</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                L&apos;application est entièrement utilisable sans vous connecter. Dans ce cas, aucune donnée n&apos;est envoyée ni stockée sur nos serveurs. Votre progression n&apos;est pas sauvegardée entre les sessions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Export et suppression de vos données</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Si vous êtes connecté, vous pouvez à tout moment exporter vos données ou supprimer votre compte depuis la page{" "}
                <Link href="/my-data" className="text-tricolore-bleu hover:underline">
                  Mes données
                </Link>
                . La suppression est immédiate et irréversible.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Contact</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Pour toute question relative à vos données, contactez-nous via le dépôt du projet.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
