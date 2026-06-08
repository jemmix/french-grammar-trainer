"use client";

import type { ThemeName } from "./types";
import { LemondeBrandMark } from "./lemonde";
import { BauhausBrandMark } from "./bauhaus";
import { KitschBrandMark } from "./kitsch";

export { ThemeProvider, useTheme } from "./context";
export { resolveTheme, THEME_NAMES, type ThemeName } from "./types";

export { LemondeBrandMark, BauhausBrandMark, KitschBrandMark };

const BRAND_MARKS: Record<ThemeName, typeof LemondeBrandMark> = {
  lemonde: LemondeBrandMark,
  bauhaus: BauhausBrandMark,
  kitsch: KitschBrandMark,
};

export function BrandMark(props: {
  theme: ThemeName;
  size?: "sm" | "lg";
  className?: string;
}) {
  const Component = BRAND_MARKS[props.theme];
  return <Component size={props.size} className={props.className} />;
}
