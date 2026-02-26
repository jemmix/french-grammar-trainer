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

          <div className="space-y-8 text-encre">

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Ce que nous collectons</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Nous ne collectons aucune donnée personnelle identifiable. Nous ne stockons pas votre adresse e-mail, votre nom, votre photo de profil, ni aucune autre information permettant de vous identifier directement.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Pour les utilisateurs connectés, la seule information stockée est votre <strong>progression</strong> : un niveau cumulé par règle de grammaire (560 règles au total), représentant moins de 1,2 Ko de données.
                Les utilisateurs anonymes ne génèrent aucune donnée côté serveur.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Comment nous stockons vos données</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Lors de la connexion, nous dérivons un identifiant anonyme depuis votre compte à l&apos;aide d&apos;une fonction à sens unique (Argon2id). Cet identifiant ne permet pas de remonter jusqu&apos;à votre compte d&apos;origine — même pour nous.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Vos données de progression sont stockées sous forme d&apos;un blob binaire associé à cet identifiant. La clé (l&apos;identifiant anonyme) et la valeur (le blob de progression) ne contiennent aucune donnée personnelle.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">
                Cookie <code className="text-xs font-mono bg-craie/30 px-1.5 py-0.5 rounded">privacy-acknowledged</code>
              </h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Si vous cochez « Ne plus afficher ce message » lors de la connexion, un cookie est placé dans votre navigateur pour mémoriser ce choix. Ce cookie ne contient aucune donnée personnelle — uniquement la valeur <code className="text-xs font-mono">1</code>. Il expire après 10 ans et n&apos;est jamais transmis à un tiers.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Ce cookie est facultatif. Les utilisateurs qui ne se connectent pas ne le reçoivent jamais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">
                Cookie de session <code className="text-xs font-mono bg-craie/30 px-1.5 py-0.5 rounded">fgt-session</code>
              </h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Lors de la connexion, un cookie HttpOnly est créé contenant votre identifiant anonyme. Ce cookie permet au serveur de retrouver votre progression lors de vos prochaines visites. Il ne contient aucune donnée personnelle et n&apos;est jamais transmis à un tiers.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Les utilisateurs anonymes ne reçoivent pas ce cookie.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Mode anonyme</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                L&apos;application est entièrement utilisable sans compte. Dans ce cas, aucune donnée n&apos;est envoyée ni stockée côté serveur, aucun cookie de session n&apos;est créé, et votre progression n&apos;est pas conservée entre les sessions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-encre mb-3">Export et suppression de vos données</h2>
              <p className="text-sm text-ardoise leading-relaxed">
                Les utilisateurs connectés peuvent consulter l&apos;intégralité de leurs données, les exporter en JSON, et supprimer leur compte depuis la page{" "}
                <Link href="/my-data" className="text-tricolore-bleu hover:underline">
                  Mes données
                </Link>.
                L&apos;export inclut les données brutes (valeurs entières exactes telles que stockées dans la base) et leur interprétation décodée.
                La suppression est immédiate et irréversible.
              </p>
              <p className="text-sm text-ardoise leading-relaxed mt-3">
                Les utilisateurs anonymes n&apos;ont rien à supprimer : aucune donnée n&apos;est stockée les concernant.
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
