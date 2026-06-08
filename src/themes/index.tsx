"use client";

import type { ThemeName } from "./types";
import {
  LemondeBrandMark,
  LemondeHomeHeader,
  LemondeSectionCard,
} from "./lemonde";
import {
  BauhausBrandMark,
  BauhausHomeHeader,
  BauhausSectionCard,
} from "./bauhaus";
import {
  KitschBrandMark,
  KitschHomeHeader,
  KitschSectionCard,
} from "./kitsch";

export { ThemeProvider, useTheme } from "./context";
export { resolveTheme, THEME_NAMES, type ThemeName } from "./types";

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

export type HomeHeaderProps = {
  heading: string;
  subtitle: string;
  levelLabel: string;
  authControls: React.ReactNode;
  brandMark: React.ReactNode;
};

export type SectionCardProps = {
  available: boolean;
  href?: string;
  className?: string;
  children: React.ReactNode;
};

const HOME_HEADERS: Record<ThemeName, React.FC<HomeHeaderProps>> = {
  lemonde: LemondeHomeHeader,
  bauhaus: BauhausHomeHeader,
  kitsch: KitschHomeHeader,
};

const SECTION_CARDS: Record<ThemeName, React.FC<SectionCardProps>> = {
  lemonde: LemondeSectionCard,
  bauhaus: BauhausSectionCard,
  kitsch: KitschSectionCard,
};

export function ThemedHomeHeader(
  props: HomeHeaderProps & { theme: ThemeName },
) {
  const Component = HOME_HEADERS[props.theme];
  return <Component {...props} />;
}

export function ThemedSectionCard(
  props: SectionCardProps & { theme: ThemeName },
) {
  const Component = SECTION_CARDS[props.theme];
  return <Component {...props} />;
}
