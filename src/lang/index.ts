import type { LangStrings } from "./types";
import fr from "./fr";
import en from "./en";
import de from "./de";

const lang = process.env.NEXT_PUBLIC_LANG ?? "fr";
const bundles: Record<string, LangStrings> = { fr, en, de };

// Falls back to French if NEXT_PUBLIC_LANG is unset or unrecognized.
export const t: LangStrings = bundles[lang] ?? fr;
