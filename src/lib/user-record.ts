// Pure functions — no I/O, no Next.js imports

export const HEADER_SIZE = 11;
export const RULE_SLOTS = 560;
export const BLOB_SIZE = 1131; // 11 + 560 * 2

export interface RecordHeader {
  version: number;     // uint8  — always 1
  createdAt: number;   // uint32 — unix seconds
  lastActiveAt: number; // uint32 — unix seconds
  ruleSlots: number;   // uint16 — always 560
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
 * Converts a rule ID like "01-01" to a slot index 0–559.
 * Returns -1 if the ID is malformed.
 */
export function getRuleSlotIndex(ruleId: string): number {
  const parts = ruleId.split("-");
  if (parts.length !== 2) return -1;
  const section = parseInt(parts[0]!, 10);
  const rule = parseInt(parts[1]!, 10);
  if (isNaN(section) || isNaN(rule)) return -1;
  if (section < 1 || section > 28 || rule < 1 || rule > 20) return -1;
  return (section - 1) * 20 + (rule - 1);
}

/**
 * Integer EWMA: next = old - (old >> 4) + (correct ? 4095 : 0), clamped [1, 65535].
 * Modifies `powers` in-place.
 */
export function recordAnswerInPlace(
  powers: Uint16Array,
  ruleId: string,
  correct: boolean,
): void {
  const idx = getRuleSlotIndex(ruleId);
  if (idx < 0) return;
  const old = powers[idx] ?? 0;
  let next = old - (old >> 4) + (correct ? 4095 : 0);
  next = Math.max(0, Math.min(65535, next));
  if (next < 1) next = 1;
  powers[idx] = next;
}

/**
 * Encodes powers to binary blob (11-byte header + 560 uint16 big-endian).
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
 * Decodes binary blob back to a Uint16Array of 560 power values.
 */
export function decodeRecord(data: Uint8Array): Uint16Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const powers = new Uint16Array(RULE_SLOTS);
  for (let i = 0; i < RULE_SLOTS; i++) {
    powers[i] = view.getUint16(HEADER_SIZE + i * 2, false);
  }
  return powers;
}

export function createEmptyPowers(): Uint16Array {
  return new Uint16Array(RULE_SLOTS);
}

/** raw === 0 means "never attempted"; otherwise maps [1, 65535] → (0, 1]. */
export function getDisplayPower(raw: number): number {
  return raw === 0 ? 0 : raw / 65535;
}

/**
 * Mean display power of attempted rules in the given section.
 * sectionId must start with a two-digit number, e.g. "01-present-indicatif".
 */
export function getSectionDisplayPower(
  powers: Uint16Array,
  sectionId: string,
): number {
  const match = sectionId.match(/^(\d+)/);
  if (!match) return 0;
  const n = parseInt(match[1]!, 10);
  const start = (n - 1) * 20;
  const end = start + 20;
  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i++) {
    const raw = powers[i] ?? 0;
    if (raw !== 0) {
      sum += raw / 65535;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/** Mean display power of all attempted rules globally. */
export function getGlobalDisplayPower(powers: Uint16Array): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < RULE_SLOTS; i++) {
    const raw = powers[i] ?? 0;
    if (raw !== 0) {
      sum += raw / 65535;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}
