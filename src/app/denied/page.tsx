import type { Metadata } from "next";
import Link from "next/link";
import { t } from "~/lang";
import { BrandMark } from "~/themes";
import { resolveTheme } from "~/config/theme";
import { env } from "~/env";

const theme = resolveTheme(env.NEXT_PUBLIC_THEME, env.NEXT_PUBLIC_LANG);

export const metadata: Metadata = {
  title: `${t.denied.pageTitle} — ${t.meta.appTitle}`,
};

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const userIdParam = params.userId;
  const userIdStr = typeof userIdParam === "string" ? userIdParam : undefined;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md w-full animate-scale-in">
        <div className="rounded-2xl border border-chalk bg-surface px-8 py-10 md:px-10 md:py-12 shadow-sm text-center">
          <svg className="w-10 h-10 mx-auto text-muted/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>

          <div className="inline-flex items-center gap-0.5 mb-5">
            <BrandMark theme={theme} size="lg" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-ink mb-4">{t.denied.heading}</h1>

          <p className="text-muted leading-relaxed mb-6">
            {t.denied.body}
          </p>

          {userIdStr && (
            <div className="mb-6 p-4 rounded-xl bg-paper border border-chalk text-left">
              <p className="text-xs text-muted mb-2">
                {t.denied.idLabel}
              </p>
              <p className="font-mono text-[11px] text-ink break-all select-all bg-paper-warm rounded-lg px-3 py-2 border border-chalk/60">
                {userIdStr}
              </p>
            </div>
          )}

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-ink transition-colors font-medium"
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
