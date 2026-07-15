import { RULE_SLOTS, RULES_PER_SECTION } from "~/config/lang-config";

export const PROGRESS = {
  // EWMA (15/16 decay — all integer math via bit shifts)
  DECAY_SHIFT: 4,               // >> 4 = divide by 16
  CORRECT_BUMP: 4095,           // 65535 >> 4 — added on correct answer
  MAX_POWER: 65535,             // uint16 max
  MASTERY_THRESHOLD: 0.95,      // Display power considered "mastered"
  get RULE_SLOTS() { return RULE_SLOTS; },
  get RULES_PER_SECTION() { return RULES_PER_SECTION; },

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
