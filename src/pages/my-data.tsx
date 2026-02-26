import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useProgress } from "~/contexts/progress-context";
import { ProgressRing } from "~/components/progress-ring";
import { sectionsIndex } from "~/data/sections-index";
import { sectionMap } from "~/data/sections-index";
import { getTier } from "~/lib/constants";

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
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
  getGlobalPower: () => number;
}) {
  const { userId, getRulePower, getSectionPower, getGlobalPower } = params;
  const globalPower = getGlobalPower();
  const globalTier = getTier(globalPower, globalPower > 0);

  const exportedSections = sectionsIndex
    .map((meta) => {
      const section = sectionMap[meta.id];
      if (!section) return null;
      const sectionPower = getSectionPower(meta.id);
      const tier = getTier(sectionPower, sectionPower > 0);

      const rules = section.rules
        .map((rule) => {
          const power = getRulePower(rule.id);
          if (power === 0) return null;
          const ruleTier = getTier(power, true);
          return {
            id: rule.id,
            title: rule.title,
            tier: ruleTier?.label ?? "Débutant",
            powerLevel: Math.round(power * 1000) / 1000,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rules.length === 0) return null;

      return {
        id: meta.id,
        title: meta.title,
        tier: tier?.label ?? "Débutant",
        rules,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const now = new Date().toISOString();
  const filename = `grammaire-francaise-export-${now.slice(0, 10)}.json`;

  return {
    data: {
      exportedAt: now,
      userId,
      format: "french-grammar-trainer-export-v1",
      globalTier: globalTier?.label ?? "Débutant",
      sections: exportedSections,
    },
    filename,
  };
}

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

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Redirect to home if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      void router.push("/");
    }
  }, [isLoading, isLoggedIn, router]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    if (!userId) return;
    const { data, filename } = buildExportData({ userId, getRulePower, getSectionPower, getGlobalPower });
    downloadJson(data, filename);
  }, [userId, getRulePower, getSectionPower, getGlobalPower]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch("/api/progress", { method: "DELETE" });
      await logout();
      await router.push("/");
    } catch {
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

  const attemptedSections = sectionsIndex
    .map((meta) => {
      const section = sectionMap[meta.id];
      if (!section) return null;
      const power = getSectionPower(meta.id);
      if (power === 0) return null;
      const attemptedRules = section.rules.filter((r) => getRulePower(r.id) > 0);
      return { meta, section, power, attemptedRules };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const totalAttemptedRules = attemptedSections.reduce((sum, s) => sum + s.attemptedRules.length, 0);

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

          {/* Identity */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Mon identifiant</h2>
            <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
              <p className="font-mono text-xs text-encre break-all mb-2">{userId}</p>
              <p className="text-xs text-ardoise leading-relaxed">
                Cet identifiant est dérivé de votre activité de manière irréversible. Il ne peut pas être associé à votre identité.
              </p>
            </div>
          </section>

          {/* Progress summary */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Progression</h2>

            {attemptedSections.length === 0 ? (
              <p className="text-sm text-ardoise py-4 text-center">
                Aucune progression enregistrée. Commencez à pratiquer !
              </p>
            ) : (
              <>
                <p className="text-sm text-ardoise mb-4">
                  {attemptedSections.length} section{attemptedSections.length > 1 ? "s" : ""} pratiquée{attemptedSections.length > 1 ? "s" : ""},
                  {" "}{totalAttemptedRules} règle{totalAttemptedRules > 1 ? "s" : ""} au total
                </p>

                <div className="space-y-3">
                  {attemptedSections.map(({ meta, section, power, attemptedRules }) => {
                    const tier = getTier(power, true);
                    const isExpanded = expandedSections.has(meta.id);

                    return (
                      <div key={meta.id} className="bg-tricolore-blanc border border-craie rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleSection(meta.id)}
                          className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-papier-warm transition-colors cursor-pointer"
                        >
                          <ProgressRing power={power} attempted={true} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-encre truncate">{meta.title}</p>
                            <p className="text-xs text-ardoise mt-0.5">
                              {tier?.label ?? "Débutant"} · {attemptedRules.length}/20 règles pratiquées
                            </p>
                          </div>
                          <svg
                            className={`w-4 h-4 text-ardoise shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-craie">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-papier-warm border-b border-craie">
                                  <th className="text-left px-5 py-2 font-medium text-ardoise">Règle</th>
                                  <th className="text-right px-5 py-2 font-medium text-ardoise">Niveau</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-craie/60">
                                {section.rules.map((rule) => {
                                  const rulePower = getRulePower(rule.id);
                                  if (rulePower === 0) return null;
                                  const ruleTier = getTier(rulePower, true);
                                  return (
                                    <tr key={rule.id}>
                                      <td className="px-5 py-2.5 text-encre leading-snug">
                                        <span className="font-mono text-ardoise/50 mr-2">{rule.id}</span>
                                        {rule.title}
                                      </td>
                                      <td className="px-5 py-2.5 text-right text-ardoise whitespace-nowrap">
                                        {ruleTier?.label ?? "Débutant"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Data export */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-ardoise uppercase tracking-wider mb-3">Export des données</h2>
            <div className="bg-tricolore-blanc border border-craie rounded-xl p-5">
              <p className="text-sm text-ardoise mb-4">
                Téléchargez une copie complète de vos données de progression au format JSON.
              </p>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-tricolore-bleu text-white text-sm font-medium rounded-lg hover:bg-encre-light transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger mes données (JSON)
              </button>
            </div>
          </section>

          {/* Account removal */}
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
