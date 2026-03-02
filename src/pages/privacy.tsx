import Head from "next/head";
import Link from "next/link";
import { t } from "~/lang";
import type { PrivacySectionPara } from "~/lang/types";

function renderPara(para: PrivacySectionPara, myDataLinkText: string, key?: number) {
  if (typeof para === "string") {
    return (
      <p key={key} className="text-sm text-ardoise leading-relaxed mt-3 first:mt-0">
        {para}
      </p>
    );
  }
  return (
    <p key={key} className="text-sm text-ardoise leading-relaxed mt-3 first:mt-0">
      {para.before}
      <Link href={para.linkHref} className="text-tricolore-bleu hover:underline">
        {myDataLinkText}
      </Link>
      {para.after}
    </p>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>{t.privacy.pageTitle} — {t.meta.appTitle}</title>
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
            {t.shared.back}
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex gap-0.5">
              <div className="w-1 h-7 rounded-full bg-tricolore-bleu" />
              <div className="w-1 h-7 rounded-full bg-craie" />
              <div className="w-1 h-7 rounded-full bg-tricolore-rouge" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-encre">{t.privacy.heading}</h1>
          </div>

          <div className="space-y-8 text-encre">
            {t.privacy.sections.map((section) => (
              <section key={section.num}>
                <h2 className="text-lg font-semibold text-encre mb-3 flex items-baseline gap-2.5">
                  <span className="text-sm font-mono text-tricolore-bleu/30 tabular-nums shrink-0">{section.num}</span>
                  <span>
                    {section.title}
                    {section.titleCode && (
                      <> <code className="text-xs font-mono bg-craie/30 px-1.5 py-0.5 rounded">{section.titleCode}</code></>
                    )}
                  </span>
                </h2>
                {section.paras.map((para, i) =>
                  renderPara(para, t.privacy.myDataLinkText, i)
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
