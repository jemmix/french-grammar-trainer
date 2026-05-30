import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseTxtFile } from "./parse-txt.js";
import { checkQuestionElision, type QuestionElisionIssue } from "./elision-check.js";

const QUESTIONS_DIR = join(import.meta.dirname, "../../questions/fr");

const ALLOWED_FAILING_SECTIONS = new Set([
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
]);

function getSectionId(ruleId: string): string {
  return ruleId.split("-")[0]!;
}

function getAllQuestionFiles(): string[] {
  const files: string[] = [];
  const entries = readdirSync(QUESTIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".txt")) {
      files.push(join(QUESTIONS_DIR, entry.name));
    }
  }
  return files.sort();
}

interface FileResult {
  file: string;
  ruleId: string;
  sectionId: string;
  issues: QuestionElisionIssue[];
}

function checkFile(filePath: string): FileResult {
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseTxtFile(content);
  const ruleId = parsed.ruleId;
  const sectionId = getSectionId(ruleId);

  const issues: QuestionElisionIssue[] = [];
  for (const q of parsed.questions) {
    const qIssues = checkQuestionElision(q);
    issues.push(...qIssues);
  }

  return { file: filePath, ruleId, sectionId, issues };
}

describe("elision lint across all question files", () => {
  const files = getAllQuestionFiles();
  const results: FileResult[] = [];

  for (const file of files) {
    const result = checkFile(file);
    results.push(result);
  }

  it("sections 01-06 should have no elision issues", () => {
    const strictSections = new Set(["01", "02", "03", "04", "05", "06"]);
    const strictIssues = results
      .filter((r) => strictSections.has(r.sectionId))
      .flatMap((r) => r.issues);

    if (strictIssues.length > 0) {
      const messages = strictIssues.map(
        (i) => `  ${i.questionId}: [${i.kind}] ${i.message}`
      );
      expect.fail(
        `Sections 01-06 have ${strictIssues.length} elision issue(s):\n${messages.join("\n")}`
      );
    }
  });

  it("report all elision issues (sections 07-12 failures are allowed but logged)", () => {
    const allowedFailing: FileResult[] = [];
    const disallowedFailing: FileResult[] = [];

    for (const result of results) {
      if (result.issues.length > 0) {
        if (ALLOWED_FAILING_SECTIONS.has(result.sectionId)) {
          allowedFailing.push(result);
      } else if (result.sectionId !== "01") {
        const strictSections = new Set(["02", "03", "04", "05", "06"]);
        if (!strictSections.has(result.sectionId)) {
          disallowedFailing.push(result);
        }
        }
      }
    }

    for (const result of allowedFailing) {
      console.log(`\n[ALLOWED FAILURE] ${result.ruleId}:`);
      for (const issue of result.issues) {
        console.log(`  ${issue.questionId}: [${issue.kind}] ${issue.message}`);
      }
    }

    if (disallowedFailing.length > 0) {
      const messages = disallowedFailing.flatMap((r) =>
        r.issues.map((i) => `  ${i.questionId}: [${i.kind}] ${i.message}`)
      );
      expect.fail(
        `Unexpected elision issues in sections outside 01-12:\n${messages.join("\n")}`
      );
    }

    const totalAllowedIssues = allowedFailing.reduce(
      (sum, r) => sum + r.issues.length,
      0
    );
    if (totalAllowedIssues > 0) {
      console.log(
        `\n[INFO] ${totalAllowedIssues} elision issue(s) in allowed sections (07-12) - these do not fail the test`
      );
    }
  });
});
