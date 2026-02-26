import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import { sectionsIndex, sectionMap } from "~/data/sections-index";
import { getTier } from "~/lib/constants";
import { getRuleSlotIndex } from "~/lib/user-record";

// ── Raw blob data as returned by GET /api/progress ──────────────────────────

interface BlobData {
  version: number;
  createdAt: number;
  lastActiveAt: number;
  ruleSlots: number;
  powers: number[]; // 560 raw uint16 values in slot order
}

// ── All 560 slot descriptors, computed once at module level ──────────────────

const ALL_SLOTS = Array.from({ length: 28 }, (_, sIdx) => {
  const sectionNum = sIdx + 1;
  const sectionMeta = sectionsIndex[sIdx];
  const loadedSection = sectionMeta ? sectionMap[sectionMeta.id] : undefined;
  return Array.from({ length: 20 }, (_, rIdx) => {
    const ruleNum = rIdx + 1;
    const ruleId = `${String(sectionNum).padStart(2, "0")}-${String(ruleNum).padStart(2, "0")}`;
    const ruleTitle = loadedSection?.rules.find((r) => r.id === ruleId)?.title ?? null;
    return {
      ruleId,
      ruleTitle,
      slotIdx: sIdx * 20 + rIdx,
      sectionNum,
      ruleNum,
      sectionTitle: sectionMeta?.title ?? null,
    };
  });
}).flat();

// Group slots by section for display
const SLOT_SECTIONS = Array.from({ length: 28 }, (_, sIdx) => ({
  sectionNum: sIdx + 1,
  title: sectionsIndex[sIdx]?.title ?? null,
  slots: ALL_SLOTS.slice(sIdx * 20, sIdx * 20 + 20),
}));

// ── JSON export builder ──────────────────────────────────────────────────────

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
}) {
  const { userId, blobData, getRulePower, getSectionPower, getGlobalPower } = params;

  const globalPower = getGlobalPower();
  const globalTier = getTier(globalPower, globalPower > 0);

  // Decoded human-readable section — only attempted rules
  const decodedSections = sectionsIndex
    .map((meta) => {
      const section = sectionMap[meta.id];
      if (!section) return null;
      const sectionPower = getSectionPower(meta.id);
      const tier = getTier(sectionPower, sectionPower > 0);

      const rules = section.rules
        .map((rule) => {
          const slotIdx = getRuleSlotIndex(rule.id);
          const rawPower = slotIdx >= 0 ? (blobData.powers[slotIdx] ?? 0) : 0;
          if (rawPower === 0) return null;
          const ruleTier = getTier(getRulePower(rule.id), true);
          return {
            id: rule.id,
            title: rule.title,
            tier: ruleTier?.label ?? "Débutant",
            power: rawPower, // raw uint16 integer — same value as blob.powers[slotIdx]
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rules.length === 0) return null;

      return { id: meta.id, title: meta.title, tier: tier?.label ?? "Débutant", rules };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const now = new Date().toISOString();
  return {
    data: {
      exportedAt: now,
      userId,
      format: "french-grammar-trainer-export-v1",
      // blob — everything needed to reconstruct the K/V entry exactly
      blob: {
        version: blobData.version,       // uint8  at offset 0
        createdAt: blobData.createdAt,   // uint32 at offset 1, big-endian
        lastActiveAt: blobData.lastActiveAt, // uint32 at offset 5, big-endian
        ruleSlots: blobData.ruleSlots,   // uint16 at offset 9, big-endian
        // 560 uint16 big-endian values starting at offset 11.
        // Index = (sectionNum-1)*20 + (ruleNum-1). 0 = never attempted.
        powers: blobData.powers,
      },
      // decoded — human-readable tier labels (only attempted rules included)
      decoded: {
        globalTier: globalTier?.label ?? null,
        sections: decodedSections,
      },
    },
    filename: `grammaire-francaise-export-${now.slice(0, 10)}.json`,
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default function MyDataPage() {
  const router = useRouter();
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
  // Prevents the logout-triggered isLoggedIn=false from racing to redirect home
  const navigatingToGoodbye = useRef(false);

  // Redirect to home if not logged in (skip when deletion is in flight)
  useEffect(() => {
    if (!isLoading && !isLoggedIn && !navigatingToGoodbye.current) {
      void router.push("/");
    }
  }, [isLoading, isLoggedIn, router]);

  // Fetch raw blob data for the takeout display
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
    const { data, filename } = buildExportData({ userId, blobData, getRulePower, getSectionPower, getGlobalPower });
    downloadJson(data, filename);
  }, [userId, blobData, getRulePower, getSectionPower, getGlobalPower]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    navigatingToGoodbye.current = true;
    try {
      await fetch("/api/progress", { method: "DELETE" });
      await logout();
      await router.push("/goodbye");
    } catch {
      navigatingToGoodbye.current = false;
      setDeleting(false);
    }
  }, [deleting, logout, router]);

  if (isLoading || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-papier flex items-center justify-center">
        <div className="text-ardoise">Chargement...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mes données — Grammaire Française B1</title>
      </Head>

      <div className="min-h-screen bg-papier">
        <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
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

          <div className="flex items-center gap-3 mb-10">
            <div className="flex gap-0.5">
              <div className="w-1 h-7 rounded-full bg-tricolore-bleu" />
              <div className="w-1 h-7 rounded-full bg-craie" />
              <div className="w-1 h-7 rounded-full bg-tricolore-rouge" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-encre">Mes données</h1>
          </div>

          {/* ── Identity ────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Mon identifiant</h2>
            <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
              <p className="font-mono text-xs text-encre break-all mb-2">{userId}</p>
              <p className="text-xs text-ardoise leading-relaxed">
                Cet identifiant est dérivé de votre activité de manière irréversible. Il ne permet pas de vous identifier.
              </p>
            </div>
          </section>

          {/* ── Raw blob (full transparency takeout view) ────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-1">Données brutes stockées</h2>
            <p className="text-xs text-ardoise mb-3 leading-relaxed">
              Contenu exact de l&apos;entrée K/V dans la base de données.
              Toutes les informations nécessaires pour reconstruire le blob à l&apos;identique.
            </p>

            {blobLoading ? (
              <p className="text-sm text-ardoise py-4">Chargement…</p>
            ) : !blobData ? (
              <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
                <p className="text-sm text-ardoise">
                  Aucune donnée stockée. Complétez un quiz pour créer votre profil.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-tricolore-blanc border border-craie rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-papier-warm border-b border-craie">
                    <p className="text-xs font-semibold text-encre">En-tête — 11 octets (offset 0)</p>
                  </div>
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-craie/60">
                        <th className="text-left px-5 py-2 font-medium text-ardoise">Champ</th>
                        <th className="text-left px-5 py-2 font-medium text-ardoise">Type</th>
                        <th className="text-left px-5 py-2 font-medium text-ardoise">Offset</th>
                        <th className="text-right px-5 py-2 font-medium text-ardoise">Valeur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-craie/60">
                      <tr>
                        <td className="px-5 py-2 text-encre">version</td>
                        <td className="px-5 py-2 text-ardoise">uint8</td>
                        <td className="px-5 py-2 text-ardoise">0</td>
                        <td className="px-5 py-2 text-right text-encre">{blobData.version}</td>
                      </tr>
                      <tr>
                        <td className="px-5 py-2 text-encre">createdAt</td>
                        <td className="px-5 py-2 text-ardoise">uint32 BE</td>
                        <td className="px-5 py-2 text-ardoise">1</td>
                        <td className="px-5 py-2 text-right text-encre">
                          {blobData.createdAt}
                          <span className="ml-2 font-sans text-ardoise/60 text-[10px]">
                            ({new Date(blobData.createdAt * 1000).toISOString()})
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-5 py-2 text-encre">lastActiveAt</td>
                        <td className="px-5 py-2 text-ardoise">uint32 BE</td>
                        <td className="px-5 py-2 text-ardoise">5</td>
                        <td className="px-5 py-2 text-right text-encre">
                          {blobData.lastActiveAt}
                          <span className="ml-2 font-sans text-ardoise/60 text-[10px]">
                            ({new Date(blobData.lastActiveAt * 1000).toISOString()})
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-5 py-2 text-encre">ruleSlots</td>
                        <td className="px-5 py-2 text-ardoise">uint16 BE</td>
                        <td className="px-5 py-2 text-ardoise">9</td>
                        <td className="px-5 py-2 text-right text-encre">{blobData.ruleSlots}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Power slots */}
                <div className="bg-tricolore-blanc border border-craie rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-papier-warm border-b border-craie">
                    <p className="text-xs font-semibold text-encre">
                      Slots de progression — {blobData.ruleSlots} × uint16 BE, 1120 octets (offset 11)
                    </p>
                    <p className="text-[10px] text-ardoise mt-0.5">
                      Index = (section − 1) × 20 + (règle − 1) · 0 = jamais pratiqué · [1, 65535] = niveau EWMA
                    </p>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
                    {SLOT_SECTIONS.map(({ sectionNum, title, slots }) => (
                      <div key={sectionNum}>
                        <div className="px-5 py-1.5 bg-papier-warm/60 border-y border-craie/40 sticky top-0">
                          <span className="text-[10px] font-mono font-semibold text-ardoise">
                            Section {String(sectionNum).padStart(2, "0")}
                          </span>
                          {title && (
                            <span className="ml-2 text-[10px] text-ardoise/60">{title}</span>
                          )}
                        </div>
                        <table className="w-full text-xs font-mono">
                          <tbody className="divide-y divide-craie/40">
                            {slots.map(({ ruleId, ruleTitle, slotIdx }) => {
                              const raw = blobData.powers[slotIdx] ?? 0;
                              const tier = raw > 0 ? getTier(raw / 65535, true) : null;
                              return (
                                <tr key={ruleId} className={raw === 0 ? "opacity-35" : ""}>
                                  <td className="pl-5 pr-2 py-1.5 text-ardoise w-12 shrink-0">
                                    {slotIdx}
                                  </td>
                                  <td className="px-2 py-1.5 text-encre w-14 shrink-0">{ruleId}</td>
                                  <td className="px-2 py-1.5 text-ardoise/70 truncate max-w-0 w-full">
                                    {ruleTitle ?? ""}
                                  </td>
                                  <td className="px-2 pr-5 py-1.5 text-right text-encre font-semibold w-16 shrink-0 tabular-nums">
                                    {raw}
                                  </td>
                                  <td className="pr-5 py-1.5 text-right text-ardoise/60 w-24 shrink-0 font-sans text-[10px]">
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

          {/* ── JSON export ─────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Export JSON</h2>
            <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
              <p className="text-sm text-ardoise mb-4">
                Téléchargez toutes vos données — en-tête + les 560 entiers uint16 bruts + niveaux décodés.
              </p>
              <button
                onClick={handleExport}
                disabled={!blobData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-tricolore-bleu text-white text-sm font-medium rounded-lg hover:bg-encre-light transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger mes données (JSON)
              </button>
            </div>
          </section>

          {/* ── Account removal ────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Suppression du compte</h2>
            <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
              {!showDeleteConfirm ? (
                <>
                  <p className="text-sm text-ardoise mb-4">
                    Supprimez toutes vos données de progression de manière permanente.
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-incorrect text-incorrect text-sm font-medium rounded-lg hover:bg-incorrect-bg transition-colors cursor-pointer"
                  >
                    Supprimer mon compte
                  </button>
                </>
              ) : (
                <div className="animate-slide-up">
                  <div className="flex items-start gap-3 mb-5 p-4 rounded-lg bg-incorrect-bg border border-incorrect-border">
                    <svg className="w-5 h-5 text-incorrect shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-encre leading-relaxed">
                      <strong>Cette action est irréversible.</strong> Toutes vos données de progression seront supprimées définitivement.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="px-5 py-2.5 bg-incorrect text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                    >
                      {deleting ? "Suppression…" : "Confirmer la suppression"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-5 py-2.5 border border-craie text-ardoise text-sm font-medium rounded-lg hover:bg-papier-warm transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
