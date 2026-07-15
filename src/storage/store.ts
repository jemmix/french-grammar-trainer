import { RULE_SLOTS } from "~/config/lang-config";

// ─── UserStore interface ───────────────────────────────────────────

export interface UserStore {
  get(userId: string): Promise<Uint8Array | null>;
  put(userId: string, data: Uint8Array): Promise<void>;
  delete(userId: string): Promise<void>;
}

let cached: UserStore | null = null;

/**
 * Returns S3 store when S3_ENDPOINT is configured, otherwise SQLite (dev).
 * Lazy-loaded and cached to avoid re-importing on every call.
 */
export async function getStore(): Promise<UserStore> {
  if (cached) return cached;

  if (process.env.S3_ENDPOINT) {
    const { s3Store } = await import("./engines/s3");
    cached = s3Store;
  } else {
    const { sqliteStore } = await import("./engines/sqlite");
    cached = {
      get: async (userId) => sqliteStore.get(userId),
      put: async (userId, data) => sqliteStore.put(userId, data),
      delete: async (userId) => sqliteStore.delete(userId),
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
