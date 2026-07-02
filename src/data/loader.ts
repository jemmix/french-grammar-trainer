/**
 * Runtime loader that reads DSL question files (questions/<lang>/*.txt) and
 * builds the same `Section[]` structure the app expects.
 *
 * Replaces the previously pre-compiled TypeScript blobs in src/data/<lang>/.
 * Trade-off: a few ms of parsing at server boot (see scripts/bench-loader.ts)
 * in exchange for not making webpack transform ~7 MB of TS literals on every
 * `next dev` restart.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Section, SectionMeta, Question, Rule } from "./types";
import {
  parseTxtFile,
  type ParsedFile,
  type ParsedMcqQuestion,
  type ParsedInputQuestion,
} from "../lib/parse-txt";

const QUESTIONS_ROOT = join(process.cwd(), "questions");

interface SectionMetaInput {
  id: string;
  title: string;
  description: string;
}

function stripPhraseDelimiters(s: string): string {
  return s
    .replace(/^«\s*/, "")
    .replace(/\s*»$/, "")
    .replace(/^[\u201c"]\s*/, "")
    .replace(/\s*[\u201d"]$/, "");
}

function toMcq(q: ParsedMcqQuestion, generatedBy: string): Question {
  const choices = [
    { text: q.right.text, correct: true, explanation: q.right.explanation },
    ...q.wrongs.map((w) => ({ text: w.text, correct: false, explanation: w.explanation })),
  ];
  return {
    id: q.id,
    type: "mcq",
    ruleId: q.ruleId,
    generatedBy,
    prompt: q.prompt,
    choices,
  } as Question;
}

function toInput(q: ParsedInputQuestion, generatedBy: string): Question {
  const instruction = q.prompt.replace(/^Instruction\s*:\s*/i, "").trim();
  const stripped = stripPhraseDelimiters(q.phrase);
  const splitIdx = stripped.indexOf("___");
  const before = splitIdx === -1 ? stripped : stripped.slice(0, splitIdx);
  const after = splitIdx === -1 ? "" : stripped.slice(splitIdx + 3);
  return {
    id: q.id,
    type: "input",
    ruleId: q.ruleId,
    generatedBy,
    prompt: instruction,
    phrase: { before, after },
    hint: q.hint,
    answer: q.right.text,
    explanation: q.right.explanation,
    wrongAnswers: q.wrongs.map((w) => ({ text: w.text, explanation: w.explanation })),
  } as Question;
}

function sectionIdFromRuleId(ruleId: string, metas: SectionMetaInput[]): string {
  const prefix = ruleId.split("-")[0]!;
  const match = metas.find((m) => m.id.startsWith(prefix + "-") || m.id === prefix);
  if (!match) throw new Error(`No section meta matches rule prefix "${prefix}" (from ${ruleId})`);
  return match.id;
}

/**
 * Loads and parses all DSL files for a language into app-shaped `Section[]`.
 * Section ordering follows `metas`; rules/questions follow file/parse order.
 */
export function loadSectionsFromDsl(lang: string, metas: SectionMetaInput[]): Section[] {
  const dir = join(QUESTIONS_ROOT, lang);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  const parsedFiles: ParsedFile[] = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    const parsed = parseTxtFile(content);
    if (parsed.parseErrors.length > 0) {
      const errs = parsed.parseErrors.map((e) => `  - ${e}`).join("\n");
      throw new Error(`DSL parse errors in ${file}:\n${errs}`);
    }
    parsedFiles.push(parsed);
  }

  const sections: Section[] = metas.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    rules: [],
    questions: [],
  }));
  const byId = new Map(sections.map((s) => [s.id, s]));

  for (const p of parsedFiles) {
    const sectionId = sectionIdFromRuleId(p.ruleId, metas);
    const section = byId.get(sectionId);
    if (!section) throw new Error(`Parsed rule ${p.ruleId} maps to unknown section ${sectionId}`);

    const rule: Rule = { id: p.ruleId, sectionId, title: p.ruleTitle };
    section.rules.push(rule);

    for (const q of p.questions) {
      if (q.type === "mcq") {
        section.questions.push(toMcq(q, p.generatedBy));
      } else {
        section.questions.push(toInput(q as ParsedInputQuestion, p.generatedBy));
      }
    }
  }

  return sections;
}
