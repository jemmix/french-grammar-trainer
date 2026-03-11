/**
 * Compiles all DSL question files to TypeScript using TOC metadata.
 *
 * Usage: npx tsx scripts/compile-all.ts [--lang fr|en] [--dry-run]
 *
 * --dry-run: Show what would be compiled without writing files
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import {
  parseTxtFile,
  collectValidationErrors,
  compileSectionToTs,
  type ParsedRuleFile,
} from "./lib/compile-section.js";
import type { Toc } from "./lib/toc-types.js";

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

function main() {
  const args = process.argv.slice(2);
  let lang = "fr";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" && args[i + 1]) {
      lang = args[i + 1]!;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  const tocPath = join(process.cwd(), "content", lang, "toc.json");
  if (!existsSync(tocPath)) {
    console.error(`TOC not found: ${tocPath}. Run: npx tsx scripts/generate-toc-json.ts --lang ${lang}`);
    process.exit(1);
  }

  const toc: Toc = JSON.parse(readFileSync(tocPath, "utf-8"));
  const sectionConfigs = loadSectionConfigs(lang);
  const dslFiles = findDslFiles(lang);

  let compiled = 0;
  let skipped = 0;
  let errors = 0;

  for (const section of toc.sections) {
    const config = sectionConfigs.get(section.id);
    const files = dslFiles.get(section.id);

    if (!config) {
      console.log(`  [skip] Section ${section.id}: no config in index.ts`);
      skipped++;
      continue;
    }

    if (!files || files.length === 0) {
      console.log(`  [skip] Section ${section.id} (${config.id}): no DSL files`);
      skipped++;
      continue;
    }

    const outputPath = join(process.cwd(), "src", "data", lang, `${config.id}.ts`);

    const parsed: ParsedRuleFile[] = [];
    let hasErrors = false;

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const p = parseTxtFile(content);
      const validationErrors = collectValidationErrors(p);

      if (validationErrors.length > 0) {
        console.error(`  [error] ${basename(filePath)}: ${validationErrors.length} validation error(s)`);
        for (const e of validationErrors.slice(0, 3)) {
          console.error(`    - ${e}`);
        }
        if (validationErrors.length > 3) {
          console.error(`    ... and ${validationErrors.length - 3} more`);
        }
        hasErrors = true;
        errors++;
        break;
      }

      parsed.push({ path: filePath.replace(process.cwd() + "/", ""), parsed: p });
    }

    if (hasErrors) continue;

    const compiledSection = compileSectionToTs(
      { sectionId: config.id, sectionTitle: config.title, sectionDesc: config.description },
      parsed,
    );

    if (dryRun) {
      console.log(`  [dry-run] Would compile section ${section.id} (${config.id}): ${compiledSection.questionCount} questions`);
    } else {
      writeFileSync(outputPath, compiledSection.tsCode, "utf-8");
      console.log(`  [ok] ${config.id}.ts: ${compiledSection.questionCount} questions (${compiledSection.mcqCount} MCQ + ${compiledSection.inputCount} INPUT)`);
    }
    compiled++;
  }

  console.log(`\nSummary: ${compiled} compiled, ${skipped} skipped, ${errors} errors`);

  if (errors > 0) {
    process.exit(1);
  }
}

main();
