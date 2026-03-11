/**
 * Core elision checking logic for French text.
 *
 * Determines whether the word before a blank (___) is correctly elided
 * based on the vowel/consonant sounds of possible answers.
 */

// Words with aspirate h — no elision before these
export const ASPIRATE_H = new Set([
  "hache", "haches", "haine", "haines", "haïr", "hais", "haïs", "haït",
  "haïssons", "haïssez", "haïssent", "halte", "hamac", "hamacs", "hameau",
  "hameaux", "hanche", "hanches", "handicap", "handicapé", "handicapée",
  "hangar", "hangars", "hanter", "hante", "hantes", "hantent", "harceler",
  "harcèle", "hardi", "hardie", "hardis", "hardies", "hareng", "harengs",
  "haricot", "haricots", "harpe", "harpes", "hasard", "hasards", "hâte",
  "hausse", "hausser", "haut", "haute", "hauts", "hautes", "hauteur",
  "hauteurs", "héros", "hêtre", "hêtres", "hibou", "hiboux", "hiérarchie",
  "hobby", "hobbies", "hockey", "hollande", "hollandais", "hollandaise",
  "homard", "homards", "hongre", "hongrois", "hongroise", "honte",
  "hooligan", "hooligans", "hoquet", "hoquets", "horde", "hordes", "hors",
  "hot-dog", "hotte", "hottes", "houblon", "housse", "housses", "hublot",
  "hublots", "huée", "huées", "huer", "hurler", "hurle", "hurles",
  "hurlent", "hutte", "huttes",
]);

// Elision pairs: [full form (before consonant), elided form (before vowel)]
export const ELISION_PAIRS: [string, string][] = [
  ["je", "j'"],
  ["me", "m'"],
  ["te", "t'"],
  ["se", "s'"],
  ["le", "l'"],
  ["la", "l'"],
  ["de", "d'"],
  ["ne", "n'"],
  ["que", "qu'"],
  ["ce", "c'"],
  ["jusque", "jusqu'"],
  ["puisque", "puisqu'"],
  ["lorsque", "lorsqu'"],
  ["quoique", "quoiqu'"],
  ["quelque", "quelqu'"],
];

export function startsWithVowelSound(word: string): boolean {
  if (!word) return false;
  const lower = word.toLowerCase();
  if (lower.startsWith("h")) {
    for (const ah of ASPIRATE_H) {
      if (lower === ah || lower.startsWith(ah)) return false;
    }
    return true;
  }
  return /^[aeiouyàâäéèêëîïôùûüÿœæ]/i.test(word);
}

export function startsWithConsonantSound(word: string): boolean {
  if (!word) return false;
  return !startsWithVowelSound(word);
}

export function getTextBeforeBlank(text: string): string | null {
  const m = text.match(/(\S+)\s+___/);
  return m ? m[1]! : null;
}

export function getTextBeforeBlankElided(text: string): string | null {
  const m = text.match(/(\S+['\u2019])\s*___/);
  return m ? m[1]! : null;
}

export type ElisionIssueKind = "elision-missing" | "elision-wrong";

export interface ElisionIssue {
  kind: ElisionIssueKind;
  message: string;
}

/**
 * Check if elision is correct given a prompt/phrase text and possible answers.
 *
 * @param text - The prompt or phrase containing ___
 * @param answers - All possible answers (correct + wrong choices)
 * @returns Array of issues found (empty if correct)
 */
export function checkElision(text: string, answers: string[]): ElisionIssue[] {
  const issues: ElisionIssue[] = [];

  if (answers.length === 0) return issues;

  const anyVowel = answers.some(a => startsWithVowelSound(a.trim()));
  const anyConsonant = answers.some(a => startsWithConsonantSound(a.trim()));

  // Case 1: word + space + ___ (non-elided form before blank)
  const wordBefore = getTextBeforeBlank(text);
  if (wordBefore) {
    const cleaned = wordBefore.replace(/[«»"',.:;!?()]/g, "").toLowerCase();
    if (anyVowel) {
      for (const [full, elided] of ELISION_PAIRS) {
        if (cleaned === full) {
          issues.push({
            kind: "elision-missing",
            message: `"${wordBefore} ___" but some answers start with vowel → should be "${elided}___"`,
          });
          break;
        }
      }
    }
  }

  // Case 2: word'___ (elided form before blank)
  const elidedBefore = getTextBeforeBlankElided(text);
  if (elidedBefore) {
    const cleaned = elidedBefore.replace(/[«»".,:;!?()]/g, "").replace(/\u2019/g, "'").toLowerCase();
    if (anyConsonant) {
      for (const [full, elided] of ELISION_PAIRS) {
        if (cleaned === elided) {
          issues.push({
            kind: "elision-wrong",
            message: `"${elidedBefore}___" but some answers start with consonant → should be "${full} ___"`,
          });
          break;
        }
      }
    }
  }

  return issues;
}
