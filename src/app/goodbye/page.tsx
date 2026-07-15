import type { Metadata } from "next";
import Link from "next/link";
import { t } from "~/lang";
import { BrandMark } from "~/webapp/themes";
import { resolveTheme } from "~/config/theme";
import { env } from "~/webapp/env";

const theme = resolveTheme(env.NEXT_PUBLIC_THEME, env.NEXT_PUBLIC_LANG);

export const metadata: Metadata = {
  title: `${t.goodbye.pageTitle} — ${t.meta.appTitle}`,
};

export default function GoodbyePage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md w-full animate-scale-in">
        <div className="rounded-2xl border border-chalk bg-surface px-8 py-10 md:px-10 md:py-12 shadow-sm text-center">
          <div className="inline-flex items-center gap-0.5 mb-5">
            <BrandMark theme={theme} size="lg" />
          </div>

          <h1 className="text-3xl font-bold text-ink mb-3">{t.goodbye.heading}</h1>

          <div className="flex justify-center mb-5">
            <svg width="60" height="12" viewBox="0 0 60 12" className="text-chalk" fill="none">
              <path d="M0 6Q15 0 30 6Q45 12 60 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          <p className="text-muted leading-relaxed mb-2">
            {t.goodbye.body1}
          </p>
          <p className="text-sm text-muted leading-relaxed mb-8">
            {t.goodbye.body2}
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-ink-light transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.shared.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
