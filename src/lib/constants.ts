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

// Tier thresholds and colors — ordered high → low (same index order as t.tiers in lang bundles).
// Labels and promo strings live in the lang bundle; getTier is in src/lib/tiers.ts.
export const TIER_THRESHOLDS = [
  { min: 0.95, color: "#facc15" },
  { min: 0.80, color: "#34d399" },
  { min: 0.60, color: "#fb923c" },
  { min: 0.40, color: "#fbbf24" },
  { min: 0.20, color: "#2dd4bf" },
  { min: 0.00, color: "#38bdf8" },
] as const;
