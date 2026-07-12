import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function parseDslFile(content: string): Map<string, { mcq: number; input: number }> {
  const ruleCounts = new Map<string, { mcq: number; input: number }>();

  const ruleMatch = content.match(/^RULE\s+([\d-]+)/m);
  if (!ruleMatch || !ruleMatch[1]) return ruleCounts;

  const ruleId = ruleMatch[1];
  ruleCounts.set(ruleId, { mcq: 0, input: 0 });

  const lines = content.split("\n");
  let currentType: "MCQ" | "INPUT" | null = null;

  for (const line of lines) {
    if (line.startsWith("TYPE:")) {
      currentType = line.includes("MCQ") ? "MCQ" : "INPUT";
    }
    if (line.startsWith("END QUESTION")) {
      if (currentType) {
        const counts = ruleCounts.get(ruleId);
        if (counts) {
          if (currentType === "MCQ") counts.mcq++;
          else counts.input++;
        }
      }
      currentType = null;
    }
  }

  return ruleCounts;
}

function extractFromSection(section: { questions: Array<{ ruleId: string; type: "mcq" | "input" }> }): Map<string, { mcq: number; input: number }> {
  const ruleCounts = new Map<string, { mcq: number; input: number }>();

  for (const q of section.questions) {
    if (!ruleCounts.has(q.ruleId)) {
      ruleCounts.set(q.ruleId, { mcq: 0, input: 0 });
    }
    const counts = ruleCounts.get(q.ruleId)!;
    if (q.type === "mcq") counts.mcq++;
    else counts.input++;
  }

  return ruleCounts;
}

function validateRuleProportions(
  ruleCounts: Map<string, { mcq: number; input: number }>,
  source: string
): { ruleId: string; total: number; inputPct: number; issue: string }[] {
  const issues: { ruleId: string; total: number; inputPct: number; issue: string }[] = [];

  // Rules where INPUT format is fundamentally incompatible (comparison rules
  // where no-ambiguous-prompts and question-rule-alignment create contradictory
  // requirements — specifying tense fails alignment, not specifying fails clarity)
  const noInputRules = new Set(["08-11", "08-12", "08-15", "08-17"]);

  for (const [ruleId, counts] of ruleCounts) {
    const total = counts.mcq + counts.input;
    const inputPct = total > 0 ? (counts.input / total) * 100 : 0;

    if (total === 0) {
      issues.push({ ruleId, total, inputPct, issue: "no questions" });
    } else if (total % 5 !== 0) {
      issues.push({ ruleId, total, inputPct, issue: `total ${total} not divisible by 5` });
    } else if (!noInputRules.has(ruleId) && inputPct !== 20) {
      issues.push({
        ruleId,
        total,
        inputPct,
        issue: `expected 20% input, got ${inputPct.toFixed(1)}% (${counts.input}/${total})`
      });
    }
  }

  return issues;
}

describe("DSL question proportions", () => {
  const questionsDir = path.join(process.cwd(), "questions");

  for (const lang of ["fr", "en", "de"]) {
    const langDir = path.join(questionsDir, lang);

    if (!fs.existsSync(langDir)) continue;

    const files = fs.readdirSync(langDir).filter(f => f.endsWith(".txt")).sort();

    describe(`questions/${lang}`, () => {
      for (const file of files) {
        it(`${file}: every rule has questions divisible by 5 with 20% input`, () => {
          const content = fs.readFileSync(path.join(langDir, file), "utf-8");
          const ruleCounts = parseDslFile(content);
          const issues = validateRuleProportions(ruleCounts, `questions/${lang}/${file}`);

          if (issues.length > 0) {
            const messages = issues.map(i => `${i.ruleId}: ${i.issue}`);
            expect.fail(`Proportion issues in ${file}:\n  ${messages.join("\n  ")}`);
          }

          expect(issues).toHaveLength(0);
        });
      }
    });
  }
});
