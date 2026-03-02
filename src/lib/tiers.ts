import { t } from "~/lang";
import { TIER_THRESHOLDS } from "~/lib/constants";

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
