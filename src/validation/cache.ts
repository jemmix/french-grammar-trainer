import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { gunzipSync, gzipSync } from "zlib";
import { join } from "path";
import type { CacheEntry, LLMRequestSpec, LLMResponse } from "./types";

const CACHE_DIR = "llm-cache";
const HOT_DIR = join(CACHE_DIR, "hot");
const COLD_DIR = join(CACHE_DIR, "cold");

/**
 * Cold-store in-memory budget (~50MB of parsed entries). Parsed cold files are
 * kept in an LRU so repeated lookups during a single validate run are cheap;
 * least-recently-used section-rule files are evicted when the budget is
 * exceeded (steady-state memory).
 */
const COLD_LRU_BYTES = 50 * 1024 * 1024;

let activeLang: string = "fr";

export function setCacheContext(lang: string): void {
  activeLang = lang;
}

export function computeCacheKey(
  predicateId: string,
  questionId: string,
  spec: LLMRequestSpec,
): string {
  const content = `${predicateId}:${questionId}:${spec.systemPrompt}:${spec.userPrompt}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function generateNonce(): string {
  return `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Derive the per-rule subpath (e.g. "01-17") from a question id like "01-17-023".
 * Falls back to the whole id if the shape is unexpected.
 */
export function sectionRuleFromQuestionId(questionId: string): string {
  const parts = questionId.split("-");
  if (parts.length >= 2) return parts[0] + "-" + parts[1];
  return questionId;
}

function hotPath(lang: string, sectionRule: string, key: string): string {
  return join(HOT_DIR, lang, sectionRule, `${key}.json`);
}

function coldPath(lang: string, sectionRule: string): string {
  return join(COLD_DIR, lang, `${sectionRule}.gz`);
}

function ensureDir(path: string): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function createCacheEntry(
  cacheKey: string,
  predicateId: string,
  questionId: string,
  spec: LLMRequestSpec,
  nonce: string,
): CacheEntry {
  return {
    cacheKey,
    predicateId,
    questionId,
    spec: { ...spec, nonce },
    responses: [],
  };
}

// ---------------------------------------------------------------------------
// Hot generation (writable)
// ---------------------------------------------------------------------------

function loadFromHot(key: string, lang: string, sectionRule: string): CacheEntry | null {
  const path = hotPath(lang, sectionRule, key);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CacheEntry;
  } catch {
    return null;
  }
}

function saveToHot(entry: CacheEntry, lang: string): void {
  const sectionRule = sectionRuleFromQuestionId(entry.questionId);
  const path = hotPath(lang, sectionRule, entry.cacheKey);
  ensureDir(path);
  writeFileSync(path, JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// Cold generation (read-only, gzipped JSONL, LRU-cached in memory)
// ---------------------------------------------------------------------------

interface ColdCacheEntry {
  bytes: number;
  entries: Map<string, CacheEntry>;
}

const coldLru = new Map<string, ColdCacheEntry>();
let coldLruBytes = 0;

function touchCold(key: string): void {
  const value = coldLru.get(key);
  if (!value) return;
  coldLru.delete(key);
  coldLru.set(key, value);
}

function evictCold(): void {
  while (coldLruBytes > COLD_LRU_BYTES && coldLru.size > 0) {
    const oldest = coldLru.keys().next().value;
    if (oldest === undefined) break;
    const value = coldLru.get(oldest);
    if (value) coldLruBytes -= value.bytes;
    coldLru.delete(oldest);
  }
}

function loadColdFile(lang: string, sectionRule: string): Map<string, CacheEntry> {
  const lruKey = `${lang}/${sectionRule}`;
  const cached = coldLru.get(lruKey);
  if (cached) {
    touchCold(lruKey);
    return cached.entries;
  }

  const path = coldPath(lang, sectionRule);
  const entries = new Map<string, CacheEntry>();
  let bytes = 0;

  if (existsSync(path)) {
    try {
      const raw = gunzipSync(readFileSync(path)).toString("utf-8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const entry = JSON.parse(trimmed) as CacheEntry;
        bytes += trimmed.length;
        entries.set(entry.cacheKey, entry);
      }
    } catch {
      // corrupt cold file: treat as empty (will be regenerated on next promote)
    }
  }

  coldLruBytes += bytes;
  coldLru.set(lruKey, { bytes, entries });
  evictCold();

  return entries;
}

function loadFromCold(
  key: string,
  lang: string,
  sectionRule: string,
): CacheEntry | null {
  return loadColdFile(lang, sectionRule).get(key) ?? null;
}

// ---------------------------------------------------------------------------
// Merged public API (hot first, then cold)
// ---------------------------------------------------------------------------

export function loadCacheEntry(
  cacheKey: string,
  questionId: string,
): CacheEntry | null {
  const sectionRule = sectionRuleFromQuestionId(questionId);
  const hot = loadFromHot(cacheKey, activeLang, sectionRule);
  if (hot) return hot;
  return loadFromCold(cacheKey, activeLang, sectionRule);
}

export function saveCacheEntry(entry: CacheEntry): void {
  saveToHot(entry, activeLang);
}

export function addResponseToCache(entry: CacheEntry, response: LLMResponse): void {
  entry.responses.push(response);
  saveCacheEntry(entry);
}

// ---------------------------------------------------------------------------
// Enumeration / pruning (both generations)
// ---------------------------------------------------------------------------

interface LocatedKey {
  key: string;
  lang: string;
  sectionRule: string;
  generation: "hot" | "cold";
}

function listHotKeys(): LocatedKey[] {
  const out: LocatedKey[] = [];
  if (!existsSync(HOT_DIR)) return out;
  for (const lang of readdirSync(HOT_DIR)) {
    const langDir = join(HOT_DIR, lang);
    if (!isDirectory(langDir)) continue;
    for (const sectionRule of readdirSync(langDir)) {
      const ruleDir = join(langDir, sectionRule);
      if (!isDirectory(ruleDir)) continue;
      for (const file of readdirSync(ruleDir)) {
        if (!file.endsWith(".json")) continue;
        out.push({
          key: file.replace(/\.json$/, ""),
          lang,
          sectionRule,
          generation: "hot",
        });
      }
    }
  }
  return out;
}

function listColdKeys(): LocatedKey[] {
  const out: LocatedKey[] = [];
  if (!existsSync(COLD_DIR)) return out;
  for (const lang of readdirSync(COLD_DIR)) {
    const langDir = join(COLD_DIR, lang);
    if (!isDirectory(langDir)) continue;
    for (const file of readdirSync(langDir)) {
      if (!file.endsWith(".gz")) continue;
      const sectionRule = file.replace(/\.gz$/, "");
      const path = join(langDir, file);
      try {
        const raw = gunzipSync(readFileSync(path)).toString("utf-8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const entry = JSON.parse(trimmed) as CacheEntry;
          out.push({
            key: entry.cacheKey,
            lang,
            sectionRule,
            generation: "cold",
          });
        }
      } catch {
        // skip unreadable cold files
      }
    }
  }
  return out;
}

function isDirectory(path: string): boolean {
  try {
    return readdirSync(path) !== undefined;
  } catch {
    return false;
  }
}

export function getAllCacheKeys(): Set<string> {
  const keys = new Set<string>();
  for (const loc of listHotKeys()) keys.add(loc.key);
  for (const loc of listColdKeys()) keys.add(loc.key);
  return keys;
}

export function pruneCache(keepKeys: Set<string>): string[] {
  const removed: string[] = [];

  for (const loc of listHotKeys()) {
    if (!keepKeys.has(loc.key)) {
      rmSync(hotPath(loc.lang, loc.sectionRule, loc.key));
      removed.push(loc.key);
    }
  }

  const coldByFile = new Map<string, LocatedKey[]>();
  for (const loc of listColdKeys()) {
    if (!keepKeys.has(loc.key)) {
      const path = coldPath(loc.lang, loc.sectionRule);
      let bucket = coldByFile.get(path);
      if (!bucket) {
        bucket = [];
        coldByFile.set(path, bucket);
      }
      bucket.push(loc);
    }
  }

  for (const [path, locs] of coldByFile) {
    const dropKeys = new Set(locs.map((l) => l.key));
    const raw = gunzipSync(readFileSync(path)).toString("utf-8");
    const kept: string[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const entry = JSON.parse(trimmed) as CacheEntry;
      if (dropKeys.has(entry.cacheKey)) {
        removed.push(entry.cacheKey);
      } else {
        kept.push(trimmed);
      }
    }
    if (kept.length === 0) {
      rmSync(path);
    } else {
      writeFileSync(path, gzipSync(Buffer.from(kept.join("\n") + "\n")));
    }
  }

  return removed;
}
