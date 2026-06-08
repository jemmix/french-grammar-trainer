export type ThemeName = "lemonde" | "bauhaus" | "kitsch";

export const THEME_NAMES: ThemeName[] = ["lemonde", "bauhaus", "kitsch"];

export function resolveTheme(
  themeEnv?: string,
  lang?: string,
): ThemeName {
  if (themeEnv && THEME_NAMES.includes(themeEnv as ThemeName)) {
    return themeEnv as ThemeName;
  }
  if (lang === "de") return "bauhaus";
  return "lemonde";
}
