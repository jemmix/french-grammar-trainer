/**
 * Parses TABLE_OF_CONTENTS.md files and produces machine-readable JSON.
 *
 * File format expected:
 *   ### N. Section Title
 *   1. Rule title
 *   2. Another rule title
 *   ...
 */

import type { Toc, TocSection, TocRule } from "./toc-types";

export function parseTocMarkdown(content: string, lang: string): Toc {
  const lines = content.split("\n");
  const sections: TocSection[] = [];

  let currentSection: TocSection | null = null;

  const sectionRegex = /^###\s+(\d+)\.\s+(.+)$/;
  const ruleRegex = /^(\d+)\.\s+(.+)$/;

  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const sectionNum = parseInt(sectionMatch[1]!, 10);
      currentSection = {
        id: String(sectionNum).padStart(2, "0"),
        number: sectionNum,
        title: sectionMatch[2]!.trim(),
        rules: [],
      };
      continue;
    }

    if (currentSection) {
      const ruleMatch = line.match(ruleRegex);
      if (ruleMatch) {
        const ruleNum = parseInt(ruleMatch[1]!, 10);
        currentSection.rules.push({
          id: `${String(currentSection.number).padStart(2, "0")}-${String(ruleNum).padStart(2, "0")}`,
          title: ruleMatch[2]!.trim(),
        });
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1]!.trim() : "";

  return { lang, title, sections };
}
