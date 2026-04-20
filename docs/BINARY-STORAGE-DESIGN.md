# Binary Question Storage — Design Doc

**Status:** Draft v0.3
**Goal:** Instantaneous cold starts on Vercel at 280K questions (28 sections × 20 rules × 500 questions).

## Problem

Today all question data lives in TypeScript files (`src/data/{lang}/*.ts`) that are statically imported at build time. Each section is a single module exporting a `Section` object with its full `questions: Question[]` array inline.

Current state: 12 sections × 500 questions ≈ 6,000 questions. Target: 28 × 20 × 500 = **280,000 questions**.

At target scale, the question data alone will be tens of megabytes of JSON-equivalent text — all parsed into JS objects on import. This kills cold-start time and blows out memory on Vercel's serverless workers.

## Solution Overview

Replace the TypeScript source-of-truth with three binary files per language:

| File | Purpose |
|------|---------|
| `questions-{lang}.bin` | Concatenated protobuf-encoded questions (words replaced by uint32 IDs) |
| `index-{lang}.bin` | Binary hashmap: section/rule/question ID → offset + length in questions.bin |
| `dictionary-{lang}.bin` | Binary hashmap: word ↔ uint32 mapping + frequency-ordered word table |

All three files ship as static assets. At runtime the app reads them into `ArrayBuffer`s (Vercel keeps function files on a ramdisk, so reads are effectively `memcpy`).

## File Formats

### 1. `dictionary-{lang}.bin` — Word Dictionary

The dictionary is the foundation: every string in every question (prompt text, choice text, explanations, phrase fields) is split into words, and each word is replaced by a uint32 ID. Lower IDs are assigned to more frequent words (pseudo-Huffman), so varint encoding produces the smallest bytes for the most common words.

**Zero-init design:** the file IS the lookup structure. No parsing into JS objects. Word IDs are sequential (0..N), so decoding uses a flat offset table — two `DataView` reads per word, no hashmap probing at runtime.

```
┌──────────────────────────────────────────────────┐
│ Header (16 bytes)                                │
│   magic       uint32   0x574F5244 ("WORD")       │
│   version     uint8    1                         │
│   wordCount   uint32   N = total unique words    │
│   offsetsOff  uint32   offset to flat offset tbl │
│   stringsOff  uint32   offset to string table    │
│   (padding)   3 bytes                            │
├──────────────────────────────────────────────────┤
│ Flat offset table (N × 4 bytes)                  │
│   offsets[0]  uint32   byte offset of word 0     │
│   offsets[1]  uint32   byte offset of word 1     │
│   ...                                            │
│   offsets[N-1] uint32  byte offset of word N-1   │
├──────────────────────────────────────────────────┤
│ String table (variable length, at stringsOff)     │
│   Each word:                                     │
│     len         varint   byte length of word     │
│     bytes       byte[]   UTF-8 word (no NUL)     │
└──────────────────────────────────────────────────┘
```

**Lookup (uint32 → word string) — runtime decoding:**
```
1. read uint32 at buffer[offsetsOff + wordId * 4]  → strOffset
2. read varint at buffer[strOffset]                → len
3. decode UTF-8 at buffer[strOffset + varintSize, len]  → word
```
Two reads on ramdisk. No hashmap, no init, no JS object construction.

**Lookup (word string → uint32) — build time only:**
The build tool creates a separate hashmap section (omitted from above for clarity) or uses a sidecar file. This lookup is never needed at runtime — only during the build pipeline when encoding questions.

**Init cost:** zero. `fs.readFileSync` into a Buffer. The Buffer points into kernel page cache (ramdisk). No parsing.

**Size:** ~5K–15K unique words × 4 bytes/offset ≈ 60KB offset table + ~100KB string table ≈ **~160KB per language**.

### 2. `questions-{lang}.bin` — Question Data

A flat concatenation of individually-length-prefixed protobuf messages. No padding between entries.

```
┌──────────────────────────────────────────────────┐
│ Header (8 bytes)                                │
│   magic       uint32   0x51455354 ("QEST")       │
│   version     uint8    1                         │
│   questionCount uint24  total questions          │
│   (padding)   3 bytes                            │
├──────────────────────────────────────────────────┤
│ Question entries (concatenated, no gaps)         │
│   Each entry:                                    │
│     length     varint   byte length of protobuf  │
│     protobuf   byte[]   encoded Question message │
├──────────────────────────────────────────────────┤
│ ... more entries ...                             │
└──────────────────────────────────────────────────┘
```

#### Protobuf schema (`question.proto`)

```protobuf
syntax = "proto3";

enum QuestionType {
  MCQ = 0;
  INPUT = 1;
}

message WordSeq {
  // A sequence of word IDs forming a string.
  // Repeated uint32 fields use packed varint encoding automatically.
  repeated uint32 word_ids = 1;
}

message Choice {
  WordSeq text = 1;
  bool correct = 2;
  WordSeq explanation = 3;
}

message WrongAnswer {
  WordSeq text = 1;
  WordSeq explanation = 2;
}

message Phrase {
  WordSeq before = 1;
  WordSeq after = 2;
}

message Question {
  string id = 1;          // e.g. "01-03-042" — short, kept as UTF-8
  string rule_id = 2;     // e.g. "01-03" — short, kept as UTF-8
  QuestionType type = 3;
  WordSeq prompt = 4;
  string generated_by = 5; // e.g. "haiku" — kept as UTF-8
  // MCQ fields (type == MCQ)
  repeated Choice choices = 6;
  // Input fields (type == INPUT)
  Phrase phrase = 7;
  WordSeq hint = 8;
  WordSeq answer = 9;
  WordSeq explanation = 10;
  repeated WrongAnswer wrong_answers = 11;
}
```

**Key design choices:**
- `id`, `rule_id`, and `generated_by` are short, low-cardinality strings — not worth dictionary-encoding. Kept as plain UTF-8 protobuf strings.
- All user-facing text (prompts, choices, explanations, phrases) goes through `WordSeq` (packed array of uint32 word IDs).
- `WordSeq` uses protobuf's `packed` repeated uint32 encoding — a single length-delimited blob of varint-encoded integers. No per-element overhead.
- Protobuf default values (empty strings, false, 0) are omitted from the wire format entirely.

#### Size estimates

A typical MCQ question has ~60 words across prompt + 4 choices + 4 explanations. At an average of 2 bytes/varint for common words (pseudo-Huffman gives short IDs to frequent words), that's ~120 bytes for text + ~30 bytes of protobuf overhead ≈ **150 bytes/question**.

280K questions × 150 bytes ≈ **42 MB** for `questions-fr.bin`.

(For comparison, the raw TypeScript for 6K questions is already ~4.5 MB of text. At 280K questions the TS would be ~200+ MB before parsing.)

### 3. `index-{lang}.bin` — Offset Index

Three separate hashmaps in one file: sections, rules, and individual questions. The question hashmap is the largest but enables the hot path — pick a random question by ID and seek directly to it.

```
┌──────────────────────────────────────────────────┐
│ Header (20 bytes)                                │
│   magic         uint32   0x494E4458 ("INDX")     │
│   version       uint8    1                       │
│   sectionBuckets uint32   # of section hashmap   │
│   ruleBuckets   uint32   # of rule hashmap       │
│   questionBuckets uint32  # of question hashmap  │
│   (padding)     3 bytes                          │
├──────────────────────────────────────────────────┤
│ Section hashmap (sectionBuckets × 16 bytes)      │
│   Per bucket:                                    │
│     hash32     uint32   lower 32 bits of xxhash  │
│     keyOff     uint32   offset to key string     │
│     offset     uint32   byte offset in q.bin     │
│     length     uint32   byte length in q.bin     │
│   Section entries also embed metadata:           │
│     title, description, rules list — stored as   │
│     a small inline protobuf after the key string │
├──────────────────────────────────────────────────┤
│ Rule hashmap (ruleBuckets × 20 bytes)            │
│   Per bucket:                                    │
│     hash32     uint32   lower 32 bits of xxhash  │
│     keyOff     uint32   offset to key string     │
│     offset     uint32   byte offset in q.bin     │
│     length     uint32   byte length in q.bin     │
│     count      uint16   # of questions in rule   │
│     (padding)  2 bytes                           │
├──────────────────────────────────────────────────┤
│ Question hashmap (questionBuckets × 12 bytes)    │
│   Per bucket:                                    │
│     hash32     uint32   lower 32 bits of xxhash  │
│     keyOff     uint32   offset to key string     │
│     offset     uint32   byte offset in q.bin     │
│     length     uint16   byte length in q.bin     │
│     (padding)  2 bytes                           │
├──────────────────────────────────────────────────┤
│ Key strings (variable length)                    │
│   Each entry:                                    │
│     len         varint   byte length             │
│     bytes       byte[]   UTF-8 key               │
└──────────────────────────────────────────────────┘
```

**Design decisions:**
- Each question is individually indexed — the hot path can seek directly to a single question without scanning or decoding neighbors.
- Rules store a `count` field so the app knows the range of question IDs to pick from.
- Sections embed metadata (title, description, rules list) as a small protobuf, eliminating the need for a separate metadata file.

**Size estimate:** 280K question buckets × 12 bytes × (1/0.7 load factor) ≈ **4.8 MB** for the question hashmap. Rules: 560 × 20 × (1/0.7) ≈ 16 KB. Sections: negligible. Total: **~5 MB**.

**Init cost:** zero. `fs.readFileSync` → Buffer. No parsing into JS Maps.

**Runtime lookup (all from Buffer, no JS objects):**
```
function probeQuestion(buf, key): { offset, length } {
  const h = xxh32(key) % questionBuckets;
  let i = h;
  while (true) {
    const off = headerSize + i * 12;
    if (buf.getUint32(off) == xxh32(key)) {
      // verify full key string match
      if (keyMatch(buf, buf.getUint32(off + 4), key)) {
        return { offset: buf.getUint32(off + 8), length: buf.getUint16(off + 12) };
      }
    }
    i = (i + 1) % questionBuckets;
  }
}
```
Typical: 1-2 probes (0.7 load factor), each probe = 3 `DataView` reads. On ramdisk-resident buffer: ~nanoseconds.

## Runtime Flow

### Initialization (once per cold start)

```
1. dictBuf  = fs.readFileSync("dictionary-{lang}.bin")   // ~160KB
2. indexBuf = fs.readFileSync("index-{lang}.bin")         // ~5MB
3. qFd      = fs.openSync("questions-{lang}.bin", "r")    // file handle only
```

**That's it.** Three syscalls. No parsing, no Map construction, no object allocation. On Vercel's ramdisk, `readFileSync` doesn't even copy — the Buffer points into kernel page cache. Cold start impact: **~0ms** (dominated by module resolution, not data).

### Hot path: pick a random question for a rule

This is the most latency-sensitive operation in the app.

```
1. Probe indexBuf for ruleId → { offset, count }          // 2 DataView reads
2. Pick random i ∈ [0, count)
3. Derive questionId = `${ruleId}-${String(i+1).padStart(3,"0")}`
4. Probe indexBuf for questionId → { offset, length }     // 2 DataView reads
5. fs.read(qFd, buf, 0, length, offset)                   // ~150 bytes from ramdisk
6. Decode single protobuf message from buf
7. For each WordSeq: for each wordId, read dictBuf → word string
8. Return Question object
```

**Per-request cost:** 4 hashmap probes (each ~3 DataView reads) + 1 file read (~150 bytes) + 1 protobuf decode + ~60 word lookups (each 2 DataView reads). All operating on data already in CPU cache. Expected: **< 1ms**.

### Warm path: load all questions for a rule

```
1. Probe indexBuf for ruleId → { offset, length, count }
2. fs.read(qFd, buf, 0, length, offset)     // ~75KB from ramdisk
3. Decode count protobuf messages from buf
4. Resolve WordSeqs via dictBuf
5. Return Question[]
```

Expected: **< 2ms** for 500 questions.

### Why not parse into Maps at init?

Parsing 5MB of binary index into JS `Map<string, {offset, length}>` means:
- 280K string allocations for question ID keys
- 280K object allocations for values
- 280K Map.insert operations (hash + bucket insertion)
- All on a cold V8 that hasn't JIT'd any of this code yet

Empirically, this kind of init on Vercel serverless takes **5–20ms** — not catastrophic, but it's proportional to question count and runs on every cold start. The zero-init approach has constant cost regardless of data size.

The tradeoff: per-request lookups do `DataView` reads instead of `Map.get()`. But `Map.get()` with a string key still hashes the key internally — and probing a binary hashmap in a Buffer that's in L1/L2 cache is comparable. The difference (~10s of ns vs ~100s of ns) is invisible next to protobuf decoding.

### Memory layout

- `dictBuf`: ~160KB, always resident, in CPU cache (accessed every request)
- `indexBuf`: ~5MB, always resident, hot pages stay cached
- `questions.bin`: 42MB on disk, never fully loaded. Individual ~150 byte reads via file descriptor. OS page cache handles the rest — only touched pages are in RAM.

### Warm-up: graduated upgrade to in-memory structures

After the first request is served (cold start preserved), kick off a background warm-up that parses the Buffers into native JS structures. Once complete, all subsequent requests on the same worker use the faster path.

```typescript
import { after } from "next/server";

let warm: WarmIndex | null = null;

function warmUp() {
  warm = {
    dictWords: parseDictWords(dictBuf),          // string[] by wordId
    rules: new Map<string, RuleEntry>(),         // ruleId → {offset, count}
    questions: new Map<string, QuestionEntry>(), // questionId → {offset, length}
    sections: new Map<string, SectionMeta>(),    // sectionId → metadata
  };
  // populate by scanning indexBuf hashmaps into Maps (~5–15ms on warm JIT)
  scanIntoMaps(indexBuf, warm);
}

// In the request handler:
export async function GET(req: Request) {
  const result = lookupAndDecode(req);           // DataView probe path
  after(() => { if (!warm) warmUp(); });         // guaranteed post-response
  return Response.json(result);
}
```

**Lookup path with auto-graduation:**
```typescript
function lookupRule(ruleId: string) {
  if (warm) return warm.rules.get(ruleId);   // Map.get — fastest
  return probeRule(indexBuf, ruleId);         // DataView probe — zero-init
}
```

**Why `after()` and not `setImmediate`:**
`setImmediate` / `setTimeout(0)` are just macrotask callbacks — Vercel can suspend the worker the instant the response is flushed, before the callback fires. The warm-up would only run when the next request wakes the worker, defeating the purpose. `after()` from `next/server` is explicitly designed for this: guaranteed to run after the response is sent, within the same serverless invocation, before the worker is eligible for suspension.

**Why this works:**
- First request on a cold worker: DataView probes. No init penalty.
- `after()` callback fires post-response. V8 is now warm (JIT'd the probe functions, string allocation is optimized).
- Subsequent requests: `Map.get()` — ~50ns vs ~150ns for DataView probe. Difference is marginal, but the real win is for **bulk operations** (load all questions for a rule) where the warm dictionary avoids repeated DataView reads per word, replacing them with direct array indexing.
- Warm-up is idempotent and race-free: `warm` is either `null` or fully populated. No partial state. `if (!warm)` guard ensures only one warm-up runs even if multiple requests arrive before it completes.

**Tradeoff:** ~10–15ms of background CPU after first request. Guaranteed to complete within the invocation thanks to `after()`. If the worker dies anyway (e.g. max duration), no harm — the next cold start does DataView probes and triggers another warm-up.

## Build Pipeline

```
DSL .txt files
    │
    ▼
build-dictionary.ts        ← scans all .txt, counts word frequencies,
    │                         assigns uint32 IDs (pseudo-Huffman),
    │                         writes dictionary-{lang}.bin
    ▼
build-questions.ts         ← reads .txt + dictionary, encodes each
    │                         question as protobuf with word IDs,
    │                         concatenates into questions-{lang}.bin
    │                         (questions written in rule order)
    ▼
build-index.ts             ← scans questions.bin, records offsets per
    │                         section/rule/question, writes index-{lang}.bin
    ▼
public/data/               ← binary files land here as static assets
```

### Word splitting rules

- **Split by single space character.** No punctuation splitting, no special tokenization. Each space-delimited token is one word.
- `l'homme` → `["l'homme"]` (one word). `je suis allé.` → `["je", "sui", "allé."]` (three words).
- Join back with single space — exact round-trip by construction.
- **Build-time validation:** unit test / build step rejects any source text containing consecutive spaces (`"  "`) or leading/trailing whitespace. Source files are the authority on spacing.

### Pseudo-Huffman word ID assignment

1. Count word frequency across all questions in a language.
2. Sort descending by frequency.
3. Assign IDs starting at 1 (0 reserved for "unknown word" / fallback).
4. Common words like `le`, `de`, `à`, `et`, `la`, `les`, `un`, `une` get IDs 1–10, which encode as single bytes in varint.

This is not true Huffman coding (no bit-level packing) — it's a simpler scheme that exploits varint's natural compression of small integers. Much easier to implement and debug.

## Migration Plan

### Phase 1: Build tools (no runtime changes)

1. Write `scripts/build-dictionary.ts`
2. Write `scripts/build-questions.ts` + `question.proto`
3. Write `scripts/build-index.ts`
4. Wire into `npm run build-bin` (or integrate into existing build)
5. Validate: round-trip test (read .txt → write .bin → read .bin → compare with TypeScript output)

### Phase 2: Runtime loader

1. Write `src/lib/binary-loader.ts` — reads the three files, provides `getQuestionsForRule(ruleId): Question[]`
2. Add protobuf decoder (use `protobufjs` or write a minimal hand-rolled decoder for the single message type)
3. Wire into `sections-index.ts` as alternative backend behind a feature flag

### Phase 3: Cutover

1. Enable binary backend by default
2. Remove TypeScript question files from bundle
3. Keep TypeScript files in repo as source-of-truth until build pipeline is proven stable
4. Eventually move source-of-truth to .bin files (or keep .txt → .bin as the canonical pipeline)

### Phase 4: Section metadata

Section metadata (title, description, rules list) is small and rarely changes. Options:
- **Embed in index.bin** as additional entries alongside rule offsets
- **Keep as a small JSON file** — <1KB, trivial to load
- **Keep in TypeScript** — current approach, simplest

Recommendation: embed in index.bin for consistency. No separate file needed.

## Open Questions

- **Protobuf library:** `protobufjs` (full-featured, ~40KB gzipped), `protoc` + `@protobuf-ts` (code-gen, smaller), or hand-rolled minimal decoder (smallest, most work)?
- **Multi-language:** one set of three files per language, sharing nothing? Or can we share the dictionary across languages (English and French have no common words)?
- **Streaming decode:** for large rules (500 questions), decode protobuf messages in a tight loop with no allocations beyond the final objects? Or batch?
- **Verification:** how to validate binary files at build time? Round-trip comparison against current TypeScript output? Checksum?
- **Benchmark alternatives:** the per-question index + random-seek approach needs benchmarks against alternatives: (a) mmap + offset jump, (b) storing rule question offsets as a flat array in the index (no per-question hashmap), (c) pre-computed shuffle order per rule in the index. Measure on Vercel-like cold start.

## Resolved Decisions

- **Word splitting:** split by single space, join by single space. No punctuation tokenization. Build validates no double spaces in source. (v0.2)
- **Per-question indexing:** every question gets its own entry in the index hashmap. The hot path picks a random question ID, looks up its offset, seeks directly to that single protobuf. No need to decode a whole rule just to get one question. (v0.2)
- **Lazy file reads:** `questions.bin` is never fully loaded into app memory. File handle kept open, individual questions read on demand via seek + read. Ramdisk makes seeks essentially free. (v0.2)
- **Zero-init:** no parsing of binary files into JS objects at cold start. `fs.readFileSync` into Buffer (points to kernel page cache on ramdisk), file descriptor for questions. All lookups probe the Buffer directly via `DataView`. Dictionary uses flat offset table (sequential word IDs → no hashmap needed at runtime). Init cost: 3 syscalls, ~0ms. (v0.3)
- **Background warm-up:** after first request, `setImmediate` parses Buffers into JS `Map`s / `string[]`. Lookups auto-graduate: DataView probes on cold worker, `Map.get()` on warm worker. Best of both worlds — zero cold start cost, faster path for long-lived workers. (v0.3)
