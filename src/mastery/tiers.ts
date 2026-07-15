import { t } from "~/lang";

// Tier thresholds and colors — ordered high → low (same index order as t.tiers in lang bundles).
export const TIER_THRESHOLDS = [
  { min: 0.95, color: "#facc15" },
  { min: 0.80, color: "#34d399" },
  { min: 0.60, color: "#fb923c" },
  { min: 0.40, color: "#fbbf24" },
  { min: 0.20, color: "#2dd4bf" },
  { min: 0.00, color: "#38bdf8" },
] as const;

export interface TierResult {
  min: number;
  color: string;
  label: string;
  promo: string;
}

export function getTier(displayPower: number, attempted: boolean): TierResult | null {
  if (!attempted) return null;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    const threshold = TIER_THRESHOLDS[i]!;
    if (displayPower >= threshold.min) {
      const strings = t.tiers[i];
      if (!strings) return null;
      return { ...threshold, ...strings };
    }
  }
  // Fallback to last tier (beginner)
  const last = TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]!;
  const lastStrings = t.tiers[t.tiers.length - 1]!;
  return { ...last, ...lastStrings };
}
