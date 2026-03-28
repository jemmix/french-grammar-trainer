# Binary Question Storage — Design Doc

**Status:** Draft v0.1
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

```
┌──────────────────────────────────────────────────┐
│ Header (16 bytes)                                │
│   magic       uint32   0x574F5244 ("WORD")       │
│   version     uint8    1                         │
│   wordCount   uint32   total unique words        │
│   bucketCount uint32   # of hashmap buckets      │
│   stringOff   uint32   offset to string table    │
│   (padding)   3 bytes                            │
├──────────────────────────────────────────────────┤
│ Hashmap (bucketCount × 12 bytes)                 │
│   Per bucket:                                    │
│     hash24     uint24   lower 24 bits of xxhash  │
│     wordId     uint32   word ID (0-based)        │
│     offset     uint32   byte offset in string tbl│
├──────────────────────────────────────────────────┤
│ String table (variable length)                   │
│   Each entry:                                    │
│     len         varint   byte length of word     │
│     bytes       byte[]   UTF-8 word (no NUL)     │
└──────────────────────────────────────────────────┘
```

**Lookup (word → uint32):** hash the word, mod `bucketCount`, linear-probe the hashmap. Compare the hash24 + full string on match. Returns `wordId`.

**Lookup (uint32 → word):** since word IDs are sequential starting at 0, and each string-table entry is fixed by its offset stored in the hashmap entry, we can also build a direct `wordId → string table offset` index at load time by scanning the hashmap into a flat array.

**Load strategy:** read entire file once into an `ArrayBuffer`. Build two runtime arrays:
- `words: string[]` — indexed by wordId, for decoding
- `wordToId: Map<string, number>` — for encoding (build phase only)

At 280K questions with ~20 words each, the unique word count will be ~5K–15K (French has a limited vocabulary in grammar exercises). The hashmap with ~32K buckets × 12 bytes ≈ 384KB. The string table ≈ 100KB. Total: **~500KB per language**.

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

Maps section IDs, rule IDs, and question IDs to byte ranges in `questions.bin`. Uses a disk-layout hashmap for O(1) lookups.

```
┌──────────────────────────────────────────────────┐
│ Header (24 bytes)                                │
│   magic         uint32   0x494E4458 ("INDX")     │
│   version       uint8    1                       │
│   bucketCount   uint32   # of hashmap buckets    │
│   entryCount    uint32   total entries           │
│   questionsOff  uint32   offset to question index│
│   (padding)     7 bytes                          │
├──────────────────────────────────────────────────┤
│ Section/Rule hashmap (bucketCount × 20 bytes)    │
│   Per bucket:                                    │
│     hash16     uint16   lower 16 bits of xxhash  │
│     keyOff     uint32   offset to key string     │
│     offset     uint32   byte offset in q.bin     │
│     length     uint32   byte length in q.bin     │
│     count      uint16   # of questions            │
│     kind       uint8    0=section, 1=rule         │
│     (padding)  2 bytes                           │
├──────────────────────────────────────────────────┤
│ Question hashmap (at questionsOff)               │
│   Separate hashmap for question-by-ID lookup.    │
│   Same structure but value is (offset, length)   │
│   with count=1 implicit.                         │
├──────────────────────────────────────────────────┤
│ Key strings (variable length)                    │
│   Each entry:                                    │
│     len         varint   byte length             │
│     bytes       byte[]   UTF-8 key               │
└──────────────────────────────────────────────────┘
```

**Lookup (ruleId → questions):** hash the rule ID string, mod `bucketCount`, linear-probe. Returns `(offset, length, count)` — a byte range in `questions.bin` containing `count` consecutive protobuf-encoded questions.

**Assumption:** questions are written in rule-order within each section (rule 01-01, then 01-02, etc.). All questions for a given rule are contiguous. This is already the natural order from the DSL files.

**Load strategy:** read entire file into `ArrayBuffer`. Build runtime `Map<string, {offset, length, count}>` during initialization.

At 28 sections + 560 rules + 280K question entries ≈ 280K entries × 20 bytes ≈ **5.6 MB** for the index (before hashmap load factor). With a 0.7 load factor, ~8 MB. Acceptable for a one-time ramdisk read.

**Optimization note:** question-by-ID lookups may not be needed at runtime (the app loads questions per-rule, not per-question). If unneeded, the question hashmap can be dropped, cutting the index to ~12KB (only sections + rules). Keep in the design for now as a maybe.

## Runtime Flow

### Initialization (once per cold start)

```
1. Read dictionary-{lang}.bin → ArrayBuffer (≈500KB, one syscall)
2. Parse dictionary: build words[] and wordToId map
3. Read index-{lang}.bin → ArrayBuffer (≈8MB, one syscall)
4. Parse index: build sectionMap, ruleMap, questionMap
5. DO NOT read questions.bin yet — defer to first access
```

Steps 1–4 take < 5ms on a ramdisk (sequential reads + simple parsing).

### Loading questions for a rule

```
1. Look up ruleId in ruleMap → (offset, length, count)
2. Read questions.bin[offset..offset+length] → ArrayBuffer
3. Decode count protobuf messages from the buffer
4. For each message, resolve WordSeq fields → strings using words[]
5. Return Question[] objects
```

For a single rule (500 questions × 150 bytes ≈ 75KB), this is one seek + one read + protobuf decoding. Total: < 2ms.

### Memory-resident caching

Once a rule's questions are decoded, cache the `Question[]` in a process-level `Map<string, Question[]>`. On Vercel, the function instance survives between requests, so subsequent requests for the same rule hit the in-memory cache.

The index and dictionary stay resident for the lifetime of the function instance.

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

- Split on whitespace and punctuation boundaries.
- Punctuation tokens (`,`, `.`, `?`, `!`, `:`, `;`, `"`, `«`, `»`, `(`, `)`, `-`, `'`) are separate words.
- Special tokens: `___` (blank marker in input phrases) gets its own word ID.
- Numbers are kept as-is (not split into digits).
- This preserves exact round-tripping: `join(decode(encode(text))) === text`.

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
- **Question-by-ID index:** needed at runtime, or can we drop it from index.bin?
- **Lazy rule loading vs eager:** load all rules on first cold start, or truly defer until each rule is requested? Lazy is better for memory but adds latency on first quiz request.
- **Multi-language:** one set of three files per language, sharing nothing? Or can we share the dictionary across languages (English and French have no common words)?
- **Streaming decode:** for large rules (500 questions), decode protobuf messages in a tight loop with no allocations beyond the final objects? Or batch?
- **Word splitting edge cases:** apostrophes in French (`l'homme`, `j'ai`) — split into `l'` + `homme` or keep as single token? Needs a decision.
- **Verification:** how to validate binary files at build time? Round-trip comparison against current TypeScript output? Checksum?
