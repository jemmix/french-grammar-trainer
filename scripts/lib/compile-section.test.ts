/**
 * Unit test to verify that compiled TypeScript section files are fresh.
 *
 * For each section that has DSL source files, this test:
 * 1. Compiles the DSL files to TypeScript
 * 2. Compares the output with the existing .ts file
 * 3. Fails if they differ (indicating the .ts file is stale)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  parseTxtFile,
  collectValidationErrors,
  compileSectionToTs,
  type ParsedRuleFile,
} from "./compile-section";
import type { Toc } from "./toc-types";

interface SectionConfig {
  id: string;
  title: string;
  description: string;
}

function loadSectionConfigs(lang: string): Map<string, SectionConfig> {
  const indexPath = join(process.cwd(), "src", "data", lang, "index.ts");
  const content = readFileSync(indexPath, "utf-8");

  const configs = new Map<string, SectionConfig>();

  const metaMatch = content.match(/export const meta[^[]*\[([\s\S]*?)\];/);
  if (!metaMatch) {
    throw new Error(`Could not parse meta from ${indexPath}`);
  }

  const metaContent = metaMatch[1]!;
  const entryRegex = /\{\s*id:\s*"([^"]+)"\s*,\s*title:\s*"([^"]+)"\s*,\s*description:\s*"([^"]*)"/g;

  let match;
  while ((match = entryRegex.exec(metaContent)) !== null) {
    const [, id, title, description] = match;
    const sectionNum = id!.split("-")[0]!;
    configs.set(sectionNum, {
      id: id!,
      title: title!,
      description: description!,
    });
  }

  return configs;
}

function findDslFiles(lang: string): Map<string, string[]> {
  const questionsDir = join(process.cwd(), "questions", lang);
  const filesBySection = new Map<string, string[]>();

  if (!existsSync(questionsDir)) {
    return filesBySection;
  }

  const files = readdirSync(questionsDir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  for (const file of files) {
    const ruleId = file.replace(".txt", "");
    const sectionNum = ruleId.split("-")[0]!;

    if (!filesBySection.has(sectionNum)) {
      filesBySection.set(sectionNum, []);
    }
    filesBySection.get(sectionNum)!.push(join(questionsDir, file));
  }

  return filesBySection;
}

function loadToc(lang: string): Toc | null {
  const tocPath = join(process.cwd(), "content", lang, "toc.json");
  if (!existsSync(tocPath)) {
    return null;
  }
  return JSON.parse(readFileSync(tocPath, "utf-8"));
}

function normalizeForComparison(tsCode: string): string {
  return tsCode
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
}

for (const lang of ["fr", "en", "de"]) {
  describe(`TypeScript freshness: ${lang}`, () => {
    const toc = loadToc(lang);
    const sectionConfigs = loadSectionConfigs(lang);
    const dslFiles = findDslFiles(lang);

    if (!toc) {
      it.skip("TOC not found - run generate-toc-json.ts first");
      return;
    }

    for (const section of toc.sections) {
      const config = sectionConfigs.get(section.id);
      const files = dslFiles.get(section.id);

      if (!config || !files || files.length === 0) {
        continue;
      }

      it(`Section ${section.id} (${config.id}): TS file is fresh`, () => {
        const outputPath = join(process.cwd(), "src", "data", lang, `${config.id}.ts`);

        expect(
          existsSync(outputPath),
          `TS file not found: ${outputPath}`
        ).toBe(true);

        const existingContent = readFileSync(outputPath, "utf-8");

        const parsed: ParsedRuleFile[] = [];
        for (const filePath of files) {
          const content = readFileSync(filePath, "utf-8");
          const p = parseTxtFile(content);
          const validationErrors = collectValidationErrors(p);

          expect(
            validationErrors,
            `Validation errors in ${filePath.split("/").pop()}: ${validationErrors.join("; ")}`
          ).toHaveLength(0);

          parsed.push({ path: filePath.replace(process.cwd() + "/", ""), parsed: p });
        }

        const compiled = compileSectionToTs(
          { sectionId: config.id, sectionTitle: config.title, sectionDesc: config.description },
          parsed,
        );

        const existingNormalized = normalizeForComparison(existingContent);
        const compiledNormalized = normalizeForComparison(compiled.tsCode);

        if (existingNormalized !== compiledNormalized) {
          const existingLines = existingNormalized.split("\n");
          const compiledLines = compiledNormalized.split("\n");

          let firstDiff = -1;
          for (let i = 0; i < Math.max(existingLines.length, compiledLines.length); i++) {
            if (existingLines[i] !== compiledLines[i]) {
              firstDiff = i;
              break;
            }
          }

          expect.fail(
            `TS file is stale. First difference at line ${firstDiff + 1}.\n` +
            `Run: npx tsx scripts/compile-all.ts --lang ${lang}\n` +
            `Existing: ${existingLines[firstDiff] ?? "(end of file)"}\n` +
            `Expected: ${compiledLines[firstDiff] ?? "(end of file)"}`
          );
        }
      });
    }
  });
}
