"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "~/next/contexts/progress-context";
import type { SectionMeta } from "~/content/types";
import type { SlotSection, RuleMetaEntry } from "~/content/slots";
import { getTier } from "~/mastery/tiers";
import { getRuleSlotIndex } from "~/mastery/progress";
import { t } from "~/lang";
import { BrandMark, useTheme } from "~/next/themes";

interface BlobData {
  version: number;
  createdAt: number;
  lastActiveAt: number;
  ruleSlots: number;
  powers: number[];
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildExportData(params: {
  userId: string;
  blobData: BlobData;
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
  getGlobalPower: () => number;
  sectionsIndex: SectionMeta[];
  ruleMeta: Map<string, RuleMetaEntry>;
}) {
  const { userId, blobData, getRulePower, getSectionPower, getGlobalPower, sectionsIndex, ruleMeta } = params;

  const globalPower = getGlobalPower();
  const globalTier = getTier(globalPower, globalPower > 0);

  const sectionRules = new Map<string, string[]>();
  for (const [ruleId, meta] of ruleMeta) {
    const arr = sectionRules.get(meta.sectionId) ?? [];
    arr.push(ruleId);
    sectionRules.set(meta.sectionId, arr);
  }

  const decodedSections = sectionsIndex
    .map((meta) => {
      const ruleIds = sectionRules.get(meta.id);
      if (!ruleIds || ruleIds.length === 0) return null;
      const sectionPower = getSectionPower(meta.id);
      const tier = getTier(sectionPower, sectionPower > 0);

      const rules = ruleIds
        .map((ruleId) => {
          const slotIdx = getRuleSlotIndex(ruleId);
          const rawPower = slotIdx >= 0 ? (blobData.powers[slotIdx] ?? 0) : 0;
          if (rawPower === 0) return null;
          const ruleTier = getTier(getRulePower(ruleId), true);
          const ruleInfo = ruleMeta.get(ruleId);
          return {
            id: ruleId,
            title: ruleInfo?.title ?? ruleId,
            tier: ruleTier?.label ?? t.tiers[5]!.label,
            power: rawPower,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rules.length === 0) return null;

      return { id: meta.id, title: meta.title, tier: tier?.label ?? t.tiers[5]!.label, rules };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const now = new Date().toISOString();
  return {
    data: {
      exportedAt: now,
      userId,
      format: t.myData.exportFormat,
      blob: {
        version: blobData.version,
        createdAt: blobData.createdAt,
        lastActiveAt: blobData.lastActiveAt,
        ruleSlots: blobData.ruleSlots,
        powers: blobData.powers,
      },
      decoded: {
        globalTier: globalTier?.label ?? t.tiers[5]!.label,
        sections: decodedSections,
      },
    },
    filename: t.myData.exportFilename(now.slice(0, 10)),
  };
}

export function MyDataClient({
  sectionsIndex,
  slotSections,
  ruleMeta,
}: {
  sectionsIndex: SectionMeta[];
  slotSections: SlotSection[];
  ruleMeta: Map<string, RuleMetaEntry>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const {
    isLoggedIn,
    isLoading,
    userId,
    logout,
    getRulePower,
    getSectionPower,
    getGlobalPower,
  } = useProgress();

  const [blobData, setBlobData] = useState<BlobData | null>(null);
  const [blobLoading, setBlobLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigatingToGoodbye = useRef(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn && !navigatingToGoodbye.current) {
      router.push("/");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || isLoading) return;
    fetch("/api/progress")
      .then(async (r) => {
        if (r.status === 200) {
          const data = (await r.json()) as BlobData;
          setBlobData(data);
        }
      })
      .catch(() => {})
      .finally(() => setBlobLoading(false));
  }, [isLoggedIn, isLoading]);

  const handleExport = useCallback(() => {
    if (!userId || !blobData) return;
    const { data, filename } = buildExportData({
      userId,
      blobData,
      getRulePower,
      getSectionPower,
      getGlobalPower,
      sectionsIndex,
      ruleMeta,
    });
    downloadJson(data, filename);
  }, [userId, blobData, getRulePower, getSectionPower, getGlobalPower, sectionsIndex, ruleMeta]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    navigatingToGoodbye.current = true;
    try {
      await fetch("/api/progress", { method: "DELETE" });
      await logout();
      router.push("/goodbye");
    } catch {
      navigatingToGoodbye.current = false;
      setDeleting(false);
    }
  }, [deleting, logout, router]);

  if (isLoading || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-muted">{t.shared.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.shared.back}
        </Link>

        <div className="flex items-center gap-3 mb-10">
          <BrandMark theme={theme} size="sm" />
          <h1 className="text-2xl md:text-3xl font-bold text-ink">{t.myData.heading}</h1>
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider border-l-2 border-primary/20 pl-3 mb-3">{t.myData.identityTitle}</h2>
          <div className="bg-surface border border-chalk rounded-xl p-5">
            <p className="font-mono text-[11px] text-ink break-all select-all bg-paper-warm rounded-lg px-3 py-2 border border-chalk/60 mb-3">{userId}</p>
            <p className="text-xs text-muted leading-relaxed">
              {t.myData.identityDesc}
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider border-l-2 border-primary/20 pl-3 mb-1">{t.myData.rawDataTitle}</h2>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            {t.myData.rawDataDesc}
          </p>

          {blobLoading ? (
            <p className="text-sm text-muted py-4">{t.myData.blobLoading}</p>
          ) : !blobData ? (
            <div className="bg-surface border border-chalk rounded-xl p-5">
              <p className="text-sm text-muted">
                {t.myData.noData}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-surface border border-chalk rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-paper-warm border-b border-chalk">
                  <p className="text-xs font-semibold text-ink">{t.myData.headerSectionLabel}</p>
                </div>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-chalk/60">
                      <th className="text-left px-5 py-2 font-medium text-muted">{t.myData.tableField}</th>
                      <th className="text-left px-5 py-2 font-medium text-muted">{t.myData.tableType}</th>
                      <th className="text-left px-5 py-2 font-medium text-muted">{t.myData.tableOffset}</th>
                      <th className="text-right px-5 py-2 font-medium text-muted">{t.myData.tableValue}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk/60">
                    <tr>
                      <td className="px-5 py-2 text-ink">version</td>
                      <td className="px-5 py-2 text-muted">uint8</td>
                      <td className="px-5 py-2 text-muted">0</td>
                      <td className="px-5 py-2 text-right text-ink">{blobData.version}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2 text-ink">createdAt</td>
                      <td className="px-5 py-2 text-muted">uint32 BE</td>
                      <td className="px-5 py-2 text-muted">1</td>
                      <td className="px-5 py-2 text-right text-ink">
                        {blobData.createdAt}
                        <span className="ml-2 font-sans text-muted/60 text-[10px]">
                          ({new Date(blobData.createdAt * 1000).toISOString()})
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2 text-ink">lastActiveAt</td>
                      <td className="px-5 py-2 text-muted">uint32 BE</td>
                      <td className="px-5 py-2 text-muted">5</td>
                      <td className="px-5 py-2 text-right text-ink">
                        {blobData.lastActiveAt}
                        <span className="ml-2 font-sans text-muted/60 text-[10px]">
                          ({new Date(blobData.lastActiveAt * 1000).toISOString()})
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 py-2 text-ink">ruleSlots</td>
                      <td className="px-5 py-2 text-muted">uint16 BE</td>
                      <td className="px-5 py-2 text-muted">9</td>
                      <td className="px-5 py-2 text-right text-ink">{blobData.ruleSlots}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-surface border border-chalk rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-paper-warm border-b border-chalk">
                  <p className="text-xs font-semibold text-ink">
                    {t.myData.slotsLabel(blobData.ruleSlots)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {t.myData.slotsDesc}
                  </p>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
                  {slotSections.map(({ sectionNum, title, slots }) => (
                    <div key={sectionNum}>
                      <div className="px-5 py-1.5 bg-paper-warm/60 border-y border-chalk/40 sticky top-0">
                        <span className="text-[10px] font-mono font-semibold text-muted">
                          {t.myData.sectionPrefix} {String(sectionNum).padStart(2, "0")}
                        </span>
                        {title && (
                          <span className="ml-2 text-[10px] text-muted/60">{title}</span>
                        )}
                      </div>
                      <table className="w-full text-xs font-mono">
                        <tbody className="divide-y divide-chalk/40">
                          {slots.map(({ ruleId, ruleTitle, slotIdx }) => {
                            const raw = blobData.powers[slotIdx] ?? 0;
                            const tier = raw > 0 ? getTier(raw / 65535, true) : null;
                            return (
                              <tr key={ruleId} className={raw === 0 ? "opacity-35" : ""}>
                                <td className="pl-5 pr-2 py-1.5 text-muted w-12 shrink-0">
                                  {slotIdx}
                                </td>
                                <td className="px-2 py-1.5 text-ink w-14 shrink-0">{ruleId}</td>
                                <td className="px-2 py-1.5 text-muted/70 truncate max-w-0 w-full">
                                  {ruleTitle ?? ""}
                                </td>
                                <td className="px-2 pr-5 py-1.5 text-right text-ink font-semibold w-16 shrink-0 tabular-nums">
                                  {raw}
                                </td>
                                <td className="pr-5 py-1.5 text-right text-muted/60 w-24 shrink-0 font-sans text-[10px]">
                                  {tier?.label ?? ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider border-l-2 border-primary/20 pl-3 mb-3">{t.myData.jsonExportTitle}</h2>
          <div className="bg-surface border border-chalk rounded-xl p-5">
            <p className="text-sm text-muted mb-4">
              {t.myData.jsonExportDesc}
            </p>
            <button
              onClick={handleExport}
              disabled={!blobData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-ink-light transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t.myData.downloadButton}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider border-l-2 border-primary/20 pl-3 mb-3">{t.myData.deleteTitle}</h2>
          <div className="bg-surface border border-chalk rounded-xl p-5">
            {!showDeleteConfirm ? (
              <>
                <p className="text-sm text-muted mb-4">
                  {t.myData.deleteDesc}
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-incorrect text-incorrect text-sm font-medium rounded-lg hover:bg-incorrect-bg transition-colors cursor-pointer"
                >
                  {t.myData.deleteButton}
                </button>
              </>
            ) : (
              <div className="animate-slide-up">
                <div className="flex items-start gap-3 mb-5 p-4 rounded-lg bg-incorrect-bg border border-incorrect-border">
                  <svg className="w-5 h-5 text-incorrect shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-ink leading-relaxed">
                    {t.myData.deleteWarning}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="px-5 py-2.5 bg-incorrect text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? t.myData.deletingLabel : t.myData.deleteConfirmButton}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-5 py-2.5 border border-chalk text-muted text-sm font-medium rounded-lg hover:bg-paper-warm transition-colors cursor-pointer"
                  >
                    {t.myData.cancelButton}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
