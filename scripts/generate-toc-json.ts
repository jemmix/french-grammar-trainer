/**
 * Generates machine-readable TOC JSON files from TABLE_OF_CONTENTS.md files.
 *
 * Usage: npx tsx scripts/generate-toc-json.ts [--lang fr|en]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { parseTocMarkdown } from "./lib/parse-toc";

function main() {
  const args = process.argv.slice(2);
  let lang = "fr";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" && args[i + 1]) {
      lang = args[i + 1]!;
      i++;
    }
  }

  const contentDir = join(process.cwd(), "content", lang);
  const tocPath = join(contentDir, "TABLE_OF_CONTENTS.md");

  if (!existsSync(tocPath)) {
    console.error(`TOC file not found: ${tocPath}`);
    process.exit(1);
  }

  const content = readFileSync(tocPath, "utf-8");
  const toc = parseTocMarkdown(content, lang);

  const outputDir = join(process.cwd(), "content", lang);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, "toc.json");
  writeFileSync(outputPath, JSON.stringify(toc, null, 2), "utf-8");

  console.log(`Generated ${outputPath}`);
  console.log(`  ${toc.sections.length} sections`);
  console.log(`  ${toc.sections.reduce((n, s) => n + s.rules.length, 0)} rules`);
}

main();
