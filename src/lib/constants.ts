export const PROGRESS = {
  // EWMA (15/16 decay — all integer math via bit shifts)
  DECAY_SHIFT: 4,               // >> 4 = divide by 16
  CORRECT_BUMP: 4095,           // 65535 >> 4 — added on correct answer
  MAX_POWER: 65535,             // uint16 max
  MASTERY_THRESHOLD: 0.95,      // Display power considered "mastered"
  RULE_SLOTS: 560,              // 28 sections × 20 rules
  RULES_PER_SECTION: 20,

  // Question picker
  WEIGHT_FLOOR: 0.05,           // Minimum selection weight
  WEIGHT_UNATTEMPTED: 0.50,     // Weight for never-attempted rules
  WEIGHT_EXPONENT: 2,           // (1 - power)^N exponent

  // Learn Whatever budget
  LEARN_TOTAL: 20,
  LEARN_FOCUS: 9,
  LEARN_FOCUS_ENCOURAGE: 1,
  LEARN_ADJACENT: 4,
  LEARN_ADJACENT_ENCOURAGE: 1,
  LEARN_LEFTFIELD: 4,
  LEARN_LEFTFIELD_ENCOURAGE: 1,
  ENCOURAGE_THRESHOLD: 0.6,     // Min display power for "encouragement" source

  // Sync
  FLUSH_INTERVAL_MS: 30_000,
} as const;

// Display tiers (ordered high → low for lookup)
export const TIERS = [
  { min: 0.95, label: "Maîtrisé !",   color: "#facc15", promo: "Bravo, vous maîtrisez ce sujet !" },
  { min: 0.80, label: "Très avancé",  color: "#34d399", promo: "La maîtrise approche !" },
  { min: 0.60, label: "Avancé",       color: "#fb923c", promo: "Vous devenez solide !" },
  { min: 0.40, label: "Intermédiaire", color: "#fbbf24", promo: "Niveau intermédiaire atteint !" },
  { min: 0.20, label: "En progrès",   color: "#2dd4bf", promo: "Vous progressez, continuez !" },
  { min: 0.00, label: "Débutant",     color: "#38bdf8", promo: "Première étape franchie !" },
] as const;

export type Tier = (typeof TIERS)[number];

export function getTier(
  displayPower: number,
  attempted: boolean,
): { label: string; color: string; promo: string } | null {
  if (!attempted) return null;
  for (const tier of TIERS) {
    if (displayPower >= tier.min) {
      return { label: tier.label, color: tier.color, promo: tier.promo };
    }
  }
  return { label: "Débutant", color: "#38bdf8", promo: "Première étape franchie !" };
}
