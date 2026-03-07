/**
 * Compares blind verification responses against answer keys
 * Simple version without external dependencies
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";

const args = process.argv.slice(2);
const sectionPrefix = args[0] || "01";

const blindDir = "gen/blind-verify";
const files = readdirSync(blindDir)
  .filter(f => f.match(new RegExp(`^${sectionPrefix}-\\d+-response\\.txt$`)))
  .map(f => f.replace("-response.txt", ""))
  .sort();

console.log(`\n=== Blind Verification Results for Section ${sectionPrefix} ===\n`);
console.log(`Found ${files.length} rules to analyze\n`);

const summary = {
  total: 0,
  match: 0,
  extraCorrect: 0,
  missedCorrect: 0,
  unclear: 0,
  missing: 0
};

const allIssues = [];

for (const ruleId of files) {
  const keyPath = `${blindDir}/${ruleId}-key.json`;
  const responsePath = `${blindDir}/${ruleId}-response.txt`;
  
  const keyData = JSON.parse(readFileSync(keyPath, "utf-8"));
  const responseText = readFileSync(responsePath, "utf-8");
  
  // Parse responses
  const responses = new Map();
  const lines = responseText.split("\n");
  let currentId = null;
  let currentCorrect = [];
  let currentUnclear = null;
  
  for (const line of lines) {
    if (line.startsWith("ID:")) {
      if (currentId) {
        responses.set(currentId, { correct: currentCorrect, unclear: currentUnclear });
      }
      currentId = line.split(":")[1].trim();
      currentCorrect = [];
      currentUnclear = null;
    } else if (line.startsWith("CORRECT:")) {
      const answers = line.substring(8).split(",").map(a => a.trim());
      currentCorrect = answers;
    } else if (line.startsWith("UNCLEAR:")) {
      currentUnclear = line.substring(8).trim();
    }
  }
  if (currentId) {
    responses.set(currentId, { correct: currentCorrect, unclear: currentUnclear });
  }
  
  // Compare
  const ruleResult = {
    ruleId,
    total: keyData.length,
    match: 0,
    extraCorrect: 0,
    missedCorrect: 0,
    unclear: 0,
    missing: 0,
    issues: []
  };
  
  for (const key of keyData) {
    const response = responses.get(key.id);
    
    if (!response) {
      ruleResult.missing++;
      ruleResult.issues.push({
        id: key.id,
        status: "MISSING",
        expected: key.correctAnswer,
        got: []
      });
      continue;
    }
    
    if (response.unclear) {
      ruleResult.unclear++;
      ruleResult.issues.push({
        id: key.id,
        status: "UNCLEAR",
        expected: key.correctAnswer,
        got: response.correct,
        reason: response.unclear
      });
      continue;
    }
    
    const normalizedExpected = key.correctAnswer.toLowerCase().trim();
    const normalizedGot = response.correct.map(a => a.toLowerCase().trim());
    const hasExpected = normalizedGot.includes(normalizedExpected);
    const hasExtra = normalizedGot.some(a => a !== normalizedExpected);
    
    if (hasExpected && !hasExtra) {
      ruleResult.match++;
    } else if (hasExpected && hasExtra) {
      ruleResult.extraCorrect++;
      ruleResult.issues.push({
        id: key.id,
        status: "EXTRA-CORRECT",
        expected: key.correctAnswer,
        got: response.correct
      });
    } else if (!hasExpected) {
      ruleResult.missedCorrect++;
      ruleResult.issues.push({
        id: key.id,
        status: "MISSED-CORRECT",
        expected: key.correctAnswer,
        got: response.correct
      });
    }
  }
  
  summary.total += ruleResult.total;
  summary.match += ruleResult.match;
  summary.extraCorrect += ruleResult.extraCorrect;
  summary.missedCorrect += ruleResult.missedCorrect;
  summary.unclear += ruleResult.unclear;
  summary.missing += ruleResult.missing;
  
  allIssues.push(ruleResult);
  
  console.log(`${ruleId}: ${ruleResult.match}/${ruleResult.total} match` +
    ` | Extra: ${ruleResult.extraCorrect}` +
    ` | Missed: ${ruleResult.missedCorrect}` +
    ` | Unclear: ${ruleResult.unclear}` +
    ` | Missing: ${ruleResult.missing}`);
}

console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log(`Total questions: ${summary.total}`);
console.log(`Match: ${summary.match} (${((summary.match / summary.total) * 100).toFixed(1)}%)`);
console.log(`Extra-correct: ${summary.extraCorrect}`);
console.log(`Missed-correct: ${summary.missedCorrect}`);
console.log(`Unclear: ${summary.unclear}`);
console.log(`Missing: ${summary.missing}`);

// Write detailed report
const reportPath = `${blindDir}/comparison-report.txt`;
const report = [];

report.push(`Blind Verification Report - Section ${sectionPrefix}`);
report.push(`Generated: ${new Date().toISOString()}`);
report.push("");
report.push("SUMMARY");
report.push(`  Total questions: ${summary.total}`);
report.push(`  Match: ${summary.match} (${((summary.match / summary.total) * 100).toFixed(1)}%)`);
report.push(`  Extra-correct: ${summary.extraCorrect}`);
report.push(`  Missed-correct: ${summary.missedCorrect}`);
report.push(`  Unclear: ${summary.unclear}`);
report.push(`  Missing: ${summary.missing}`);
report.push("");

for (const result of allIssues) {
  if (result.issues.length === 0) continue;
  
  report.push("");
  report.push("=".repeat(60));
  report.push(`${result.ruleId}: ${result.issues.length} issues`);
  report.push("=".repeat(60));
  
  for (const issue of result.issues) {
    report.push("");
    report.push(`[${issue.status}] ${issue.id}`);
    report.push(`  Expected: ${issue.expected}`);
    report.push(`  Got: ${issue.got.join(", ")}`);
    if (issue.reason) {
      report.push(`  Reason: ${issue.reason}`);
    }
  }
}

writeFileSync(reportPath, report.join("\n"));
console.log(`\nDetailed report written to: ${reportPath}`);
