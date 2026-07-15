import { RULE_SLOTS, RULES_PER_SECTION, SECTIONS_COUNT } from "~/config/lang-config";

/**
 * Converts a rule ID like "01-01" to a slot index.
 * Returns -1 if the ID is malformed.
 */
export function getRuleSlotIndex(ruleId: string): number {
  const parts = ruleId.split("-");
  if (parts.length !== 2) return -1;
  const section = parseInt(parts[0]!, 10);
  const rule = parseInt(parts[1]!, 10);
  if (isNaN(section) || isNaN(rule)) return -1;
  if (section < 1 || section > SECTIONS_COUNT || rule < 1 || rule > RULES_PER_SECTION) return -1;
  return (section - 1) * RULES_PER_SECTION + (rule - 1);
}

/**
 * Integer EWMA: next = old - (old >> 4) + (correct ? 4095 : 0), clamped [1, 65535].
 * Modifies `powers` in-place.
 */
export function recordAnswerInPlace(
  powers: Uint16Array,
  ruleId: string,
  correct: boolean,
): void {
  const idx = getRuleSlotIndex(ruleId);
  if (idx < 0) return;
  const old = powers[idx] ?? 0;
  let next = old - (old >> 4) + (correct ? 4095 : 0);
  next = Math.max(0, Math.min(65535, next));
  if (next < 1) next = 1;
  powers[idx] = next;
}

export function createEmptyPowers(): Uint16Array {
  return new Uint16Array(RULE_SLOTS);
}

/** raw === 0 means "never attempted"; otherwise maps [1, 65535] → (0, 1]. */
export function getDisplayPower(raw: number): number {
  return raw === 0 ? 0 : raw / 65535;
}

/**
 * Mean display power of all rule slots in the given section.
 * Unattempted slots (raw === 0) count as 0.
 * sectionId must start with a two-digit number, e.g. "01-present-indicatif".
 */
export function getSectionDisplayPower(
  powers: Uint16Array,
  sectionId: string,
): number {
  const match = sectionId.match(/^(\d+)/);
  if (!match) return 0;
  const n = parseInt(match[1]!, 10);
  const start = (n - 1) * RULES_PER_SECTION;
  let sum = 0;
  for (let i = start; i < start + RULES_PER_SECTION; i++) {
    sum += (powers[i] ?? 0) / 65535;
  }
  return sum / RULES_PER_SECTION;
}

/**
 * Mean display power across all sections (each section's score is itself
 * the average of its rule slots).
 */
export function getGlobalDisplayPower(powers: Uint16Array): number {
  let sum = 0;
  for (let s = 1; s <= SECTIONS_COUNT; s++) {
    sum += getSectionDisplayPower(powers, String(s).padStart(2, "0"));
  }
  return sum / SECTIONS_COUNT;
}
