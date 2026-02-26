import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useProgress } from "~/contexts/progress-context";

const PRIVACY_COOKIE = "privacy-acknowledged";
const COOKIE_MAX_AGE = 315360000; // 10 years

function hasCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${PRIVACY_COOKIE}=`));
}

function setCookie() {
  document.cookie = `${PRIVACY_COOKIE}=1; SameSite=Lax; Path=/; max-age=${COOKIE_MAX_AGE}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, isLoading } = useProgress();

  const [mounted, setMounted] = useState(false);
  const [cookiePresent, setCookiePresent] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Read cookie after first render (client-side only)
  useEffect(() => {
    const present = hasCookie();
    setMounted(true);
    setCookiePresent(present);
    setAcknowledge(present);
  }, []);

  // Once session check resolves, act on cookie state
  useEffect(() => {
    if (!mounted || isLoading) return;

    if (isLoggedIn) {
      void router.push("/");
      return;
    }

    // Cookie present → user already accepted privacy terms; skip the form and log in directly
    if (cookiePresent && !loggingIn) {
      setLoggingIn(true);
      void login().then(() => router.push("/"));
    }
  }, [mounted, isLoading, isLoggedIn, cookiePresent, loggingIn, login, router]);

  const handleLogin = useCallback(async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    if (acknowledge) setCookie();
    await login();
    await router.push("/");
  }, [loggingIn, acknowledge, login, router]);

  // Loading / auto-login in progress → show spinner, no form
  if (!mounted || isLoading || (cookiePresent && !isLoggedIn)) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise text-sm">Connexion…</div>
      </div>
    );
  }

  // Already logged in — redirect handled by effect above, but guard here too
  if (isLoggedIn) return null;

  return (
    <>
      <Head>
        <title>Se connecter — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier">
        <div className="mx-auto max-w-xl px-6 py-12 md:py-20">
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

          <div className="flex items-center gap-3 mb-6">
            <div className="flex gap-0.5">
              <div className="w-1 h-7 rounded-full bg-tricolore-bleu" />
              <div className="w-1 h-7 rounded-full bg-craie" />
              <div className="w-1 h-7 rounded-full bg-tricolore-rouge" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-encre">Se connecter</h1>
          </div>

          <p className="text-ardoise mb-6 leading-relaxed">
            Avant de vous connecter, veuillez prendre connaissance de notre politique de confidentialité.
          </p>

          <div className="bg-tricolore-blanc border border-craie rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-encre uppercase tracking-wider mb-4">Vos données, en bref</h2>
            <ul className="space-y-3">
              {[
                "Nous ne stockons pas votre adresse e-mail, votre nom, ni aucune donnée personnelle.",
                "Nous dérivons un identifiant irréversible depuis votre compte — nous ne pouvons pas remonter jusqu'à vous.",
                "Nous stockons uniquement votre progression : un niveau cumulé par règle de grammaire.",
                "Volume total des données : moins de 1,2 Ko.",
                "Un mode sans inscription est toujours disponible si vous préférez ne rien stocker.",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-tricolore-bleu/10 flex items-center justify-center">
                    <svg className="w-3 h-3 text-tricolore-bleu" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm text-encre leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* "Don't show again" checkbox */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={acknowledge}
              onChange={(e) => setAcknowledge(e.target.checked)}
              className="w-4 h-4 rounded border-craie text-tricolore-bleu cursor-pointer"
            />
            <span className="text-sm text-ardoise group-hover:text-encre transition-colors">
              Ne plus afficher ce message
            </span>
          </label>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void handleLogin()}
              disabled={loggingIn}
              className="w-full px-6 py-3 bg-tricolore-bleu text-white font-medium rounded-xl hover:bg-encre-light transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? "Connexion…" : "Se connecter (dev)"}
            </button>
            <Link
              href="/"
              className="w-full px-6 py-3 text-center border border-craie text-ardoise font-medium rounded-xl hover:bg-papier-warm transition-colors text-sm"
            >
              Rester anonyme →
            </Link>
          </div>

          {/* Footer link */}
          <p className="mt-6 text-center text-xs text-ardoise/60">
            En savoir plus →{" "}
            <Link href="/privacy" className="hover:text-tricolore-bleu transition-colors underline">
              Politique de confidentialité
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
