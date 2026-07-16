import { RULE_SLOTS } from "~/config/lang-config";
import { env } from "~/config/env";
import { createEmptyPowers } from "~/mastery/progress";

// ─── UserStore interface ───────────────────────────────────────────

export interface UserStore {
  get(userId: string): Promise<Uint8Array | null>;
  put(userId: string, data: Uint8Array): Promise<void>;
  delete(userId: string): Promise<void>;
  /**
   * Read-modify-set with optimistic locking. The callback receives the
   * current data (or null if none exists) and returns the new data.
   * Retries on concurrent modification.
   */
  modify(
    userId: string,
    fn: (current: Uint8Array | null) => Promise<Uint8Array>,
  ): Promise<Uint8Array>;
}

let cached: UserStore | null = null;

/**
 * Returns the storage backend selected by STORAGE_ENGINE (s3 or sqlite).
 * Lazy-loaded and cached to avoid re-importing on every call.
 */
export async function getStore(): Promise<UserStore> {
  if (cached) return cached;

  if (env.storageEngine === "s3") {
    const { s3Store } = await import("./engines/s3");
    cached = s3Store;
  } else if (env.storageEngine === "d1") {
    const { d1Store } = await import("./engines/d1");
    cached = d1Store;
  } else {
    const { sqliteStore } = await import("./engines/sqlite");
    cached = {
      get: async (userId) => sqliteStore.get(userId),
      put: async (userId, data) => sqliteStore.put(userId, data),
      delete: async (userId) => sqliteStore.delete(userId),
      modify: (userId, fn) => sqliteStore.modify(userId, fn),
    };
  }
  return cached;
}

// ─── Binary codec (inline) ─────────────────────────────────────────

export const HEADER_SIZE = 11;
export const BLOB_SIZE = HEADER_SIZE + RULE_SLOTS * 2;

export interface RecordHeader {
  version: number;     // uint8  — always 1
  createdAt: number;   // uint32 — unix seconds
  lastActiveAt: number; // uint32 — unix seconds
  ruleSlots: number;   // uint16 — language-dependent (560 for fr/en, 120 for de)
}

export function decodeHeader(data: Uint8Array): RecordHeader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    version: view.getUint8(0),
    createdAt: view.getUint32(1, false),
    lastActiveAt: view.getUint32(5, false),
    ruleSlots: view.getUint16(9, false),
  };
}

/**
 * Encodes powers to binary blob (11-byte header + RULE_SLOTS uint16 big-endian).
 */
export function encodeRecord(powers: Uint16Array): Uint8Array {
  const buf = new Uint8Array(BLOB_SIZE);
  const view = new DataView(buf.buffer);
  const now = Math.floor(Date.now() / 1000);
  view.setUint8(0, 1);                   // version
  view.setUint32(1, now, false);         // createdAt (big-endian)
  view.setUint32(5, now, false);         // lastActiveAt
  view.setUint16(9, RULE_SLOTS, false);  // ruleSlots
  for (let i = 0; i < RULE_SLOTS; i++) {
    view.setUint16(HEADER_SIZE + i * 2, powers[i] ?? 0, false);
  }
  return buf;
}

/**
 * Decodes binary blob back to a Uint16Array of RULE_SLOTS power values.
 */
export function decodeRecord(data: Uint8Array): Uint16Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const powers = new Uint16Array(RULE_SLOTS);
  for (let i = 0; i < RULE_SLOTS; i++) {
    powers[i] = view.getUint16(HEADER_SIZE + i * 2, false);
  }
  return powers;
}

// ─── LZ4 (inline) ──────────────────────────────────────────────────

interface Lz4Module {
  compress: (input: Uint8Array) => Uint8Array;
  decompress: (input: Uint8Array) => Uint8Array;
}

let _lz4: Lz4Module | null = null;

async function getLz4(): Promise<Lz4Module> {
  if (_lz4) return _lz4;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import("lz4js")) as any;
  _lz4 = (mod.default ?? mod) as Lz4Module;
  return _lz4;
}

// ─── serialize / deserialize ───────────────────────────────────────

/**
 * Serializes powers to a compressed binary blob for storage.
 */
export async function serialize(powers: Uint16Array): Promise<Uint8Array> {
  return (await getLz4()).compress(encodeRecord(powers));
}

/**
 * Deserializes a compressed storage blob into header metadata + powers.
 */
export async function deserialize(data: Uint8Array): Promise<{
  header: RecordHeader;
  powers: Uint16Array;
}> {
  const blob = (await getLz4()).decompress(data);
  return { header: decodeHeader(blob), powers: decodeRecord(blob) };
}

// ─── High-level power modification ─────────────────────────────────

/**
 * Orchestrates a read-modify-set on the user's power array with optimistic
 * locking. The callback mutates `powers` in-place. The store engine handles
 * serialization, compression, CAS retries, and persistence.
 */
export async function modifyUserPowers(
  userId: string,
  modify: (powers: Uint16Array) => void,
): Promise<void> {
  const store = await getStore();
  await store.modify(userId, async (current) => {
    const powers = current
      ? decodeRecord((await getLz4()).decompress(current))
      : createEmptyPowers();
    modify(powers);
    return (await getLz4()).compress(encodeRecord(powers));
  });
}
