import type { LangStrings } from "./types";
import { env } from "~/config/env";
import fr from "./fr";
import en from "./en";
import de from "./de";

const bundles: Record<string, LangStrings> = { fr, en, de };

// Falls back to French if the configured language is unset or unrecognized.
export const t: LangStrings = bundles[env.lang] ?? fr;
