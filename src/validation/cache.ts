import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import type { CacheEntry, LLMRequestSpec, LLMResponse } from "./types";

const CACHE_DIR = "llm-cache";

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function computeCacheKey(predicateId: string, questionId: string, spec: LLMRequestSpec): string {
  const content = `${predicateId}:${questionId}:${spec.systemPrompt}:${spec.userPrompt}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function generateNonce(): string {
  return `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCachePath(cacheKey: string): string {
  return join(CACHE_DIR, `${cacheKey}.json`);
}

export function loadCacheEntry(cacheKey: string): CacheEntry | null {
  const path = getCachePath(cacheKey);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CacheEntry;
  } catch {
    return null;
  }
}

export function saveCacheEntry(entry: CacheEntry): void {
  ensureCacheDir();
  const path = getCachePath(entry.cacheKey);
  writeFileSync(path, JSON.stringify(entry, null, 2));
}

export function createCacheEntry(
  cacheKey: string,
  predicateId: string,
  questionId: string,
  spec: LLMRequestSpec,
  nonce: string
): CacheEntry {
  return {
    cacheKey,
    predicateId,
    questionId,
    spec: { ...spec, nonce },
    responses: [],
  };
}

export function addResponseToCache(entry: CacheEntry, response: LLMResponse): void {
  entry.responses.push(response);
  saveCacheEntry(entry);
}

export function getAllCacheKeys(): Set<string> {
  if (!existsSync(CACHE_DIR)) return new Set();
  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  return new Set(files.map((f) => f.replace(".json", "")));
}

export function pruneCache(keepKeys: Set<string>): string[] {
  const allKeys = getAllCacheKeys();
  const removed: string[] = [];
  for (const key of allKeys) {
    if (!keepKeys.has(key)) {
      const path = getCachePath(key);
      rmSync(path);
      removed.push(key);
    }
  }
  return removed;
}
