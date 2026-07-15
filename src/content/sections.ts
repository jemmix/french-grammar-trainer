import type { Section, SectionMeta } from "./types";
import { env } from "~/config/env";

// Per-language barrel files export loaded sections and metadata.
// Both are imported statically; webpack replaces process.env.NEXT_PUBLIC_LANG
// at build time, so the unused branch is dead-code-eliminated.
import { loadedSections as frSections, meta as frMeta } from "./fr";
import { loadedSections as enSections, meta as enMeta } from "./en";
import { loadedSections as deSections, meta as deMeta } from "./de";

const lang = env.lang;
const _allSections: Record<string, Section[]> = { fr: frSections, en: enSections, de: deSections };
const _allMeta: Record<string, Omit<SectionMeta, "questionCount">[]> = { fr: frMeta, en: enMeta, de: deMeta };
const _loadedSections = _allSections[lang] ?? frSections;
const _meta = _allMeta[lang] ?? frMeta;

export const sectionMap: Record<string, Section> = Object.fromEntries(
  _loadedSections.map((s) => [s.id, s]),
);

const _questionCounts = new Map(_loadedSections.map((s) => [s.id, s.questions.length]));

export const sectionsIndex: SectionMeta[] = _meta.map((m) => ({
  ...m,
  questionCount: _questionCounts.get(m.id) ?? 0,
}));
