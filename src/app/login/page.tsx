"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import { t } from "~/lang";

const PRIVACY_COOKIE = "privacy-acknowledged";
const COOKIE_MAX_AGE = 315360000; // 10 years

function hasCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${PRIVACY_COOKIE}=`));
}

function setCookie() {
  document.cookie = `${PRIVACY_COOKIE}=1; SameSite=Lax; Path=/; max-age=${COOKIE_MAX_AGE}`;
}

const isDev = process.env.NODE_ENV === "development";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, isLoading } = useProgress();

  const [mounted, setMounted] = useState(false);
  const [cookiePresent, setCookiePresent] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const present = hasCookie();
    setMounted(true);
    setCookiePresent(present);
    setAcknowledge(present);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (isLoggedIn) {
      router.push("/");
    }
  }, [mounted, isLoading, isLoggedIn, router]);

  // Primary login: Google OAuth via next-auth
  const handleGoogleLogin = useCallback(async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    if (acknowledge) setCookie();
    await signIn("google", { callbackUrl: "/" });
  }, [loggingIn, acknowledge]);

  // Dev-only: fake login (sub="0", HMAC cookie)
  const handleDevLogin = useCallback(async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    if (acknowledge) setCookie();
    await login();
    router.push("/");
  }, [loggingIn, acknowledge, login, router]);

  // Dev-only: simulate denied user
  const handleDenied = useCallback(async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    const res = await fetch("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: "1" }),
    });
    const data = await res.json() as { userId?: string };
    router.push(`/denied${data.userId ? `?userId=${data.userId}` : ""}`);
  }, [loggingIn, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise text-sm">{t.login.connectingState}</div>
      </div>
    );
  }

  if (isLoggedIn) return null;

  return (
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
          {t.shared.back}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-0.5">
            <div className="w-1 h-7 rounded-full bg-tricolore-bleu" />
            <div className="w-1 h-7 rounded-full bg-craie" />
            <div className="w-1 h-7 rounded-full bg-tricolore-rouge" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-encre">{t.login.heading}</h1>
        </div>

        <p className="text-ardoise mb-6 leading-relaxed">
          {t.login.intro}
        </p>

        <div className="bg-tricolore-blanc border border-craie rounded-xl overflow-hidden mb-6">
          <div className="h-0.5 bg-gradient-to-r from-tricolore-bleu via-papier-warm to-tricolore-rouge" />
          <div className="p-6">
            <h2 className="text-sm font-semibold text-encre uppercase tracking-wider mb-4">{t.login.privacySummaryTitle}</h2>
            <ul className="space-y-3">
              {t.login.privacyBullets.map((text, i) => (
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
            {t.login.dontShowAgain}
          </span>
        </label>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => void handleGoogleLogin()}
            disabled={loggingIn}
            className="w-full px-6 py-3 bg-tricolore-bleu text-white font-medium rounded-xl hover:bg-encre-light transition-colors cursor-pointer disabled:opacity-60"
          >
            {t.login.loginButton(loggingIn)}
          </button>
          <Link
            href="/"
            className="w-full px-6 py-3 text-center border border-craie text-ardoise font-medium rounded-xl hover:bg-papier-warm transition-colors text-sm"
          >
            {t.login.stayAnonymous}
          </Link>
        </div>

        {/* Dev-mode tools */}
        {isDev && (
          <div className="mt-6 pt-6 border-t border-craie">
            <p className="text-[10px] uppercase tracking-widest text-ardoise/35 mb-3 text-center">
              {t.login.devModeLabel}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => void handleDevLogin()}
                disabled={loggingIn}
                className="w-full px-6 py-2.5 text-center border border-craie/60 text-ardoise/50 font-medium rounded-xl hover:bg-papier-warm hover:text-ardoise transition-colors text-sm disabled:opacity-40 cursor-pointer"
              >
                Fake login (sub=0)
              </button>
              <button
                onClick={() => void handleDenied()}
                disabled={loggingIn}
                className="w-full px-6 py-2.5 text-center border border-craie/60 text-ardoise/50 font-medium rounded-xl hover:bg-papier-warm hover:text-ardoise transition-colors text-sm disabled:opacity-40 cursor-pointer"
              >
                {t.login.simulateDenied}
              </button>
            </div>
          </div>
        )}

        {/* Footer link */}
        <p className="mt-6 text-center text-xs text-ardoise/60">
          {t.login.learnMorePrefix}{" "}
          <Link href="/privacy" className="hover:text-tricolore-bleu transition-colors underline">
            {t.login.privacyPolicyLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
