export type LangConfig = {
  lang: string;
  sections: number;
  rulesPerSection: number;
  ruleSlots: number;
};

const CONFIGS: Record<string, LangConfig> = {
  fr: { lang: "fr", sections: 28, rulesPerSection: 20, ruleSlots: 560 },
  en: { lang: "en", sections: 28, rulesPerSection: 20, ruleSlots: 560 },
  de: { lang: "de", sections: 12, rulesPerSection: 10, ruleSlots: 120 },
};

const lang = process.env.NEXT_PUBLIC_LANG ?? "fr";

export const LANG_CONFIG: LangConfig = CONFIGS[lang] ?? CONFIGS.fr!;

export const RULE_SLOTS = LANG_CONFIG.ruleSlots;
export const RULES_PER_SECTION = LANG_CONFIG.rulesPerSection;
export const SECTIONS_COUNT = LANG_CONFIG.sections;
