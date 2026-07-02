/**
 * Compact the hot generation into the cold generation.
 *
 * After a `validate --update-cache` run, freshly fetched responses live as
 * individual JSON files under `llm-cache/hot/{lang}/{rule}/*.json`. This script
 * folds them into the corresponding gzipped JSONL cold files
 * (`llm-cache/cold/{lang}/{rule}.gz`) and then clears hot.
 *
 * Merge rules per (lang, section-rule) bucket:
 *   - Cold entries whose key also appears in hot are replaced by the hot entry
 *     (hot wins — it carries the latest responses).
 *   - Cold-only entries are preserved as-is.
 *   - Hot-only entries are appended.
 *   - Responses within an entry are deduped by nonce.
 *
 * Usage:
 *   npx tsx scripts/promote-cache.ts            # live run
 *   npx tsx scripts/promote-cache.ts --dry-run  # report only, no writes
 *   npx tsx scripts/promote-cache.ts --lang fr  # promote one language only
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { gzipSync, gunzipSync } from "zlib";
import { join } from "path";

import type { CacheEntry } from "../src/validation/types";

const CACHE_DIR = "llm-cache";
const HOT_DIR = join(CACHE_DIR, "hot");
const COLD_DIR = join(CACHE_DIR, "cold");

function isDirectory(path: string): boolean {
  try {
    return readdirSync(path) !== undefined;
  } catch {
    return false;
  }
}

/** Map of cacheKey -> entry for one (lang, section-rule) bucket. */
type Bucket = Map<string, CacheEntry>;

function readColdBucket(coldFile: string): Bucket {
  const bucket: Bucket = new Map();
  if (!existsSync(coldFile)) return bucket;
  let raw: string;
  try {
    raw = gunzipSync(readFileSync(coldFile)).toString("utf-8");
  } catch {
    return bucket; // corrupt: treat as empty, will be rewritten
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as CacheEntry;
      bucket.set(entry.cacheKey, entry);
    } catch {
      // skip malformed line
    }
  }
  return bucket;
}

interface HotScan {
  buckets: Map<string, { lang: string; sectionRule: string; entries: Bucket }>;
  totalHotEntries: number;
}

function scanHot(langFilter: string | null): HotScan {
  const buckets = new Map<string, { lang: string; sectionRule: string; entries: Bucket }>();
  let totalHotEntries = 0;

  if (!existsSync(HOT_DIR)) return { buckets, totalHotEntries };

  for (const lang of readdirSync(HOT_DIR)) {
    if (langFilter && lang !== langFilter) continue;
    const langDir = join(HOT_DIR, lang);
    if (!isDirectory(langDir)) continue;
    for (const sectionRule of readdirSync(langDir)) {
      const ruleDir = join(langDir, sectionRule);
      if (!isDirectory(ruleDir)) continue;
      const bucketId = `${lang}/${sectionRule}`;
      let entries = buckets.get(bucketId)?.entries;
      if (!entries) {
        entries = new Map();
        buckets.set(bucketId, { lang, sectionRule, entries });
      }
      for (const file of readdirSync(ruleDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const entry = JSON.parse(readFileSync(join(ruleDir, file), "utf-8")) as CacheEntry;
          entries.set(entry.cacheKey, entry);
          totalHotEntries++;
        } catch {
          // skip unreadable hot file
        }
      }
    }
  }
  return { buckets, totalHotEntries };
}

/** Merge a hot entry into a cold bucket. Hot responses win; dedupe by nonce. */
function mergeHotIntoCold(cold: Bucket, hot: CacheEntry): void {
  const existing = cold.get(hot.cacheKey);
  if (!existing) {
    cold.set(hot.cacheKey, hot);
    return;
  }
  const seen = new Set(existing.responses.map((r) => r.nonce));
  for (const r of hot.responses) {
    if (!seen.has(r.nonce)) existing.responses.push(r);
  }
}

function serializeBucket(bucket: Bucket): Buffer {
  const entries = [...bucket.values()].sort((a, b) => a.cacheKey.localeCompare(b.cacheKey));
  const lines = entries.map((e) => JSON.stringify(e));
  return gzipSync(Buffer.from(lines.join("\n") + "\n"));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const langArgIdx = process.argv.indexOf("--lang");
  const langFilter = langArgIdx !== -1 ? process.argv[langArgIdx + 1] : null;

  console.log("Scanning hot generation...");
  const { buckets, totalHotEntries } = scanHot(langFilter ?? null);
  if (totalHotEntries === 0) {
    console.log("  hot/ is empty — nothing to promote.");
    return;
  }
  console.log(
    `  ${totalHotEntries} hot entries across ${buckets.size} bucket(s)` +
      (langFilter ? ` (lang=${langFilter})` : "") +
      ".",
  );

  let promoted = 0; // hot entries newly added to a cold bucket
  let updated = 0; // hot entries merged into an existing cold entry
  let coldFilesTouched = 0;
  let coldFilesCreated = 0;

  for (const [bucketId, { lang, sectionRule, entries: hotEntries }] of buckets) {
    const coldFile = join(COLD_DIR, lang, `${sectionRule}.gz`);
    const cold = readColdBucket(coldFile);
    const coldExistedBefore = cold.size > 0 || existsSync(coldFile);

    for (const [, hot] of hotEntries) {
      if (cold.has(hot.cacheKey)) {
        mergeHotIntoCold(cold, hot);
        updated++;
      } else {
        cold.set(hot.cacheKey, hot);
        promoted++;
      }
    }

    if (dryRun) continue;

    if (!existsSync(join(COLD_DIR, lang))) {
      mkdirSync(join(COLD_DIR, lang), { recursive: true });
    }
    writeFileSync(coldFile, serializeBucket(cold));
    if (coldExistedBefore) coldFilesTouched++;
    else coldFilesCreated++;
  }

  console.log("\nPromotion summary:");
  console.log(`  Hot entries appended to cold: ${promoted}`);
  console.log(`  Hot entries merged into cold: ${updated}`);
  if (!dryRun) {
    console.log(`  Cold files rewritten:         ${coldFilesTouched}`);
    console.log(`  Cold files created:           ${coldFilesCreated}`);
  }

  if (dryRun) {
    console.log("\n[dry-run] no files written, hot/ left untouched.");
    return;
  }

  // Clear promoted hot entries.
  if (langFilter) {
    const langDir = join(HOT_DIR, langFilter);
    if (existsSync(langDir)) rmSync(langDir, { recursive: true, force: true });
    console.log(`\nCleared hot/${langFilter}/.`);
  } else if (existsSync(HOT_DIR)) {
    rmSync(HOT_DIR, { recursive: true, force: true });
    console.log("\nCleared hot/.");
  }

  console.log("\nDone. Verify with:");
  console.log("  npx tsx scripts/validate.ts --lang fr --llm --dry-run");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
