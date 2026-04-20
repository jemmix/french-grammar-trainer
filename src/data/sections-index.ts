import type { Section, SectionMeta } from "./types";

// Per-language barrel files export loaded sections and metadata.
// Both are imported statically; webpack replaces process.env.NEXT_PUBLIC_LANG
// at build time, so the unused branch is dead-code-eliminated.
import { loadedSections as frSections, meta as frMeta } from "./fr";
import { loadedSections as enSections, meta as enMeta } from "./en";

const lang = process.env.NEXT_PUBLIC_LANG ?? "fr";
const _loadedSections: Section[] = lang === "en" ? enSections : frSections;
const _meta = lang === "en" ? enMeta : frMeta;

export const sectionMap: Record<string, Section> = Object.fromEntries(
  _loadedSections.map((s) => [s.id, s]),
);

const _questionCounts = new Map(_loadedSections.map((s) => [s.id, s.questions.length]));

export const sectionsIndex: SectionMeta[] = _meta.map((m) => ({
  ...m,
  questionCount: _questionCounts.get(m.id) ?? 0,
}));
