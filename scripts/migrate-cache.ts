/**
 * One-shot cache reorganization: migrate the flat `llm-cache/*.json` layout to
 * the generational hot/cold layout, with re-keying.
 *
 * Background: every cache key drifted because the LLM predicates' system prompts
 * were reformatted (2026-05-21, commits 1d7c75fd9 / 7db6c4c7d). The flat cache
 * is therefore 100% stale-keyed — no current validation run can hit it. This
 * script recovers value by RE-KEYING: for each flat entry whose `userPrompt`
 * still matches a current (question, predicate) pair, the entry is re-stored
 * under the NEW cache key (derived from the current system prompt), preserving
 * its responses. Entries whose responses no longer parse under the current
 * interpreter are dropped, as are entries with no current match.
 *
 *   1. Regenerate every (question, predicate) prompt for fr/de/en.
 *   2. For each flat file, look up by (predicateId, questionId, userPrompt).
 *      - No match → prune (orphaned).
 *      - Match, but no stored response parses under current interpreter → prune.
 *      - Match, ≥1 response parses → re-key into cold gen under the new key.
 *   3. Write gzipped JSONL buckets to llm-cache/cold/{lang}/{rule}.gz.
 *
 * Usage:
 *   npx tsx scripts/migrate-cache.ts            # live run
 *   npx tsx scripts/migrate-cache.ts --dry-run  # report only, no writes
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { join } from "path";

import type { CacheEntry, LLMPredicate, QuestionContext } from "../src/validation/types";
import { isLLMPredicate } from "../src/validation/types";
import { allPredicates } from "../src/validation/predicates";
import { computeCacheKey, sectionRuleFromQuestionId } from "../src/validation/cache";

const FLAT_DIR = "llm-cache";
const COLD_DIR = join(FLAT_DIR, "cold");
const STAGING_DIR = join(FLAT_DIR, ".migrate-staging");

const LANGS = ["fr", "de", "en"] as const;

interface SigMatch {
  ctx: QuestionContext;
  newKey: string;
  lang: string;
  sectionRule: string;
}

async function buildSignatureIndex(): Promise<Map<string, SigMatch>> {
  const sig = new Map<string, SigMatch>();
  for (const lang of LANGS) {
    const mod = await import("../src/content/" + lang + "/index.ts");
    for (const section of mod.loadedSections) {
      const rules = new Map<string, any>();
      for (const rule of section.rules || []) rules.set(rule.id, rule);
      for (const question of section.questions || []) {
        const rule = rules.get(question.ruleId);
        if (!rule) continue;
        const ctx: QuestionContext = { question, rule, section, lang: lang as any };
        for (const predicate of allPredicates) {
          if (!isLLMPredicate(predicate)) continue;
          const llmp = predicate as LLMPredicate;
          if (!llmp.appliesTo(ctx)) continue;
          const spec = llmp.generatePrompt(ctx);
          const newKey = computeCacheKey(llmp.id, question.id, spec);
          const sectionRule = sectionRuleFromQuestionId(question.id);
          sig.set(`${llmp.id}|${question.id}|${spec.userPrompt}`, { ctx, newKey, lang, sectionRule });
        }
      }
    }
  }
  return sig;
}

function readFlatEntry(key: string): CacheEntry | null {
  const path = join(FLAT_DIR, `${key}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CacheEntry;
  } catch {
    return null;
  }
}

/**
 * Whether at least one stored response parses (status !== "invalid") under the
 * current predicate interpreter. Entries with zero parseable responses carry no
 * recoverable signal and are dropped.
 */
function hasParseableResponse(predicate: LLMPredicate, ctx: QuestionContext, entry: CacheEntry): boolean {
  for (const resp of entry.responses) {
    try {
      if (predicate.interpretResponse(ctx, resp.raw).status !== "invalid") return true;
    } catch {
      // keep scanning
    }
  }
  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("Building signature index from live question files...");
  const sig = await buildSignatureIndex();
  console.log(`  ${sig.size} unique (predicate, question, userPrompt) signatures across fr/de/en`);

  const predById = new Map<string, LLMPredicate>();
  for (const p of allPredicates) if (isLLMPredicate(p)) predById.set(p.id, p as LLMPredicate);

  const flatFiles = existsSync(FLAT_DIR)
    ? readdirSync(FLAT_DIR).filter((f) => f.endsWith(".json"))
    : [];
  console.log(`  ${flatFiles.length} flat cache files present in llm-cache/`);

  const buckets = new Map<string, Map<string, CacheEntry>>(); // "${lang}/${rule}" -> newKey -> entry
  const recoveredKeys = new Set<string>();
  let orphaned = 0;
  let unparseable = 0;
  let recovered = 0;

  function bucketFor(lang: string, sectionRule: string): Map<string, CacheEntry> {
    const id = `${lang}/${sectionRule}`;
    let b = buckets.get(id);
    if (!b) {
      b = new Map();
      buckets.set(id, b);
    }
    return b;
  }

  for (const file of flatFiles) {
    const oldKey = file.replace(/\.json$/, "");
    const entry = readFlatEntry(oldKey);
    if (!entry) {
      orphaned++;
      if (!dryRun) rmSync(join(FLAT_DIR, file));
      continue;
    }

    const match = sig.get(`${entry.predicateId}|${entry.questionId}|${entry.spec.userPrompt}`);
    if (!match) {
      orphaned++;
      if (!dryRun) rmSync(join(FLAT_DIR, file));
      continue;
    }

    const predicate = predById.get(entry.predicateId);
    if (!predicate || !hasParseableResponse(predicate, match.ctx, entry)) {
      unparseable++;
      if (!dryRun) rmSync(join(FLAT_DIR, file));
      continue;
    }

    // Re-key: file the entry under the new cache key, preserving responses + nonce.
    const rekeyed: CacheEntry = { ...entry, cacheKey: match.newKey };
    const bucket = bucketFor(match.lang, match.sectionRule);
    const existing = bucket.get(match.newKey);
    if (existing) {
      // Merge responses (dedupe by nonce) in the rare case two old entries map to one new key.
      const seen = new Set(existing.responses.map((r) => r.nonce));
      for (const r of rekeyed.responses) {
        if (!seen.has(r.nonce)) existing.responses.push(r);
      }
    } else {
      bucket.set(match.newKey, rekeyed);
      recoveredKeys.add(match.newKey);
      recovered++;
    }
  }

  console.log(`\nMigration summary:`);
  console.log(`  Recovered (re-keyed):  ${recovered} entries → ${recoveredKeys.size} distinct keys`);
  console.log(`  Dropped unparseable:   ${unparseable} entries (responses fail current interpreter)`);
  console.log(`  Dropped orphaned:      ${orphaned} entries (no current userPrompt match)`);
  console.log(`  Coverage:              ${recoveredKeys.size}/${sig.size} referenced keys (${Math.round((recoveredKeys.size / sig.size) * 100)}%)`);

  if (dryRun) {
    console.log("\n[dry-run] no files written.");
    return;
  }

  // Write cold gen to staging.
  if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(join(STAGING_DIR, "cold"), { recursive: true });

  let writtenFiles = 0;
  let writtenEntries = 0;
  for (const [id, keyToEntry] of buckets) {
    const [lang, sectionRule] = id.split("/");
    const entries = [...keyToEntry.values()].sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));
    const lines = entries.map((e) => JSON.stringify(e));
    const payload = Buffer.from(lines.join("\n") + "\n");
    const outDir = join(STAGING_DIR, "cold", lang!);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${sectionRule}.gz`), gzipSync(payload));
    writtenFiles++;
    writtenEntries += entries.length;
  }
  console.log(`\nWrote ${writtenFiles} cold files (${writtenEntries} entries) to staging.`);

  // Swap staging into place.
  if (existsSync(COLD_DIR)) rmSync(COLD_DIR, { recursive: true, force: true });
  mkdirSync(COLD_DIR.substring(0, COLD_DIR.lastIndexOf("/")) || ".", { recursive: true });
  renameSync(join(STAGING_DIR, "cold"), COLD_DIR);

  // Remove any remaining flat files.
  for (const file of flatFiles) {
    const p = join(FLAT_DIR, file);
    if (existsSync(p)) rmSync(p);
  }
  if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true, force: true });

  console.log(`\nDone. cold/ holds ${writtenFiles} files. Verify with:`);
  console.log("  npx tsx scripts/validate.ts --lang fr --llm");
  console.log("  npx tsx scripts/validate.ts --lang de --llm");
  console.log("  npx tsx scripts/validate.ts --lang en --llm");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
