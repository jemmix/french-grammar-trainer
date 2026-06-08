"use client";

import { createContext, useContext } from "react";
import type { ThemeName } from "./types";

const ThemeContext = createContext<ThemeName>("lemonde");

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeName;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
