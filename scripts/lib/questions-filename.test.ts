import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const QUESTIONS_DIR = path.join(process.cwd(), "questions");
const RULE_FILE_PATTERN = /^\d{2}-\d{2}\.txt$/;

describe("questions directory filename hygiene", () => {
  const langDirs = fs.existsSync(QUESTIONS_DIR)
    ? fs.readdirSync(QUESTIONS_DIR).filter((d) => fs.statSync(path.join(QUESTIONS_DIR, d)).isDirectory())
    : [];

  for (const lang of langDirs) {
    const langDir = path.join(QUESTIONS_DIR, lang);

    it(`all files in questions/${lang}/ match NN-NN.txt pattern`, () => {
      const files = fs.readdirSync(langDir);
      const offenders = files.filter((f) => !RULE_FILE_PATTERN.test(f));

      if (offenders.length > 0) {
        expect.fail(
          `Found ${offenders.length} file(s) with invalid names in questions/${lang}/:\n` +
          offenders.map((f) => `  ${f}`).join("\n") +
          `\nExpected pattern: NN-NN.txt (e.g. 01-03.txt). ` +
          `Stale pipeline artifacts (*-passed.txt, *-failed.txt, *-fixed.txt) should not be committed.`
        );
      }
    });
  }
});
