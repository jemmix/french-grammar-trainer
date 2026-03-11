/**
 * Converts .txt question files (from generate-questions skill) to a TypeScript
 * section file ready for import by the application.
 *
 * Validates before converting — exits with an error if any .txt file has issues.
 *
 * Usage:
 *   npx tsx scripts/convert-txt.ts \
 *     --section-id "01-present-indicatif" \
 *     --section-title "Le présent de l'indicatif" \
 *     --section-desc "Formation et emplois du présent de l'indicatif" \
 *     --output src/data/fr/01-present-indicatif.ts \
 *     01-01.txt 01-02.txt ...
 *
 * If --output is omitted, the TypeScript is printed to stdout.
 */

import { readFileSync, writeFileSync } from "fs";
import {
  parseTxtFile,
  collectValidationErrors,
  compileSectionToTs,
} from "./lib/compile-section.js";

function parseArgs(argv: string[]): { flags: Record<string, string>; files: string[] } {
  const args = argv.slice(2);
  const flags: Record<string, string> = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = args[++i] ?? "";
    } else {
      files.push(arg);
    }
  }

  return { flags, files };
}

function main() {
  const { flags, files } = parseArgs(process.argv);

  if (files.length === 0 || !flags["section-id"] || !flags["section-title"]) {
    console.error(
      [
        "Usage: npx tsx scripts/convert-txt.ts \\",
        "  --section-id <id> \\",
        "  --section-title <title> \\",
        "  --section-desc <description> \\",
        "  [--output <path>] \\",
        "  <rule1.txt> [<rule2.txt> ...]",
        "",
        "Example:",
        "  npx tsx scripts/convert-txt.ts \\",
        '    --section-id "01-present-indicatif" \\',
        '    --section-title "Le présent de l\'indicatif" \\',
        '    --section-desc "Formation et emplois du présent de l\'indicatif" \\',
        "    --output src/data/fr/01-present-indicatif.ts \\",
        "    01-01.txt 01-02.txt",
      ].join("\n"),
    );
    process.exit(1);
  }

  const sectionId = flags["section-id"]!;
  const sectionTitle = flags["section-title"]!;
  const sectionDesc = flags["section-desc"] ?? "";
  const outputPath = flags["output"];

  const parsed = files.map((path) => {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      console.error(`ERROR: Cannot read file "${path}"`);
      process.exit(1);
    }
    return { path, parsed: parseTxtFile(content) };
  });

  let hadErrors = false;
  for (const { path, parsed: p } of parsed) {
    const errors = collectValidationErrors(p);
    if (errors.length > 0) {
      console.error(`\nValidation errors in ${path}:`);
      for (const e of errors) console.error(`  ${e}`);
      hadErrors = true;
    }
  }
  if (hadErrors) {
    console.error("\nFix validation errors before converting. Run validate-txt for details.");
    process.exit(1);
  }

  const compiled = compileSectionToTs(
    { sectionId, sectionTitle, sectionDesc },
    parsed,
  );

  if (outputPath) {
    writeFileSync(outputPath, compiled.tsCode, "utf-8");
    console.log(`✓ Written ${compiled.questionCount} questions to ${outputPath}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Add the section to src/data/sections-index.ts`);
    console.log(`  2. Import and register it in src/pages/quiz/[sectionId].tsx`);
  } else {
    process.stdout.write(compiled.tsCode);
  }
}

main();
