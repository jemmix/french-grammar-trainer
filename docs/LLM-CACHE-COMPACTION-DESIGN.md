# LLM Cache Compaction Design

## Problem

The LLM validation cache (`llm-cache/`) stores one JSON file per entry. At 15,900 entries it's 65 MB on disk (37.6 MB raw, bloated by 4K filesystem blocks). At full scale (~200K entries across languages) this would grow to several GB.

## Design: Pseudo-LSM-tree

### Write path (unchanged)

Validation runs write individual JSON files to `llm-cache/` as today. No changes to the hot path.

### Read path (modified)

`loadCacheEntry(key)`:

1. Check `llm-cache/<key>.json` — if exists, return it (hot / uncompacted)
2. Look up key in manifest → find blob file + offset → decompress relevant blob → seek to entry → return

### Compaction (`npm run compact-cache`)

1. Scan `llm-cache/*.json`
2. Group entries by language + section (e.g. `fr-01`, `en-02`) derived from `questionId` prefix
3. For each group: serialize as NDJSON (one JSON object per line), brotli-6 compress
4. Write blobs to `llm-cache/blobs/<lang>-<section>.br`
5. Write manifest `llm-cache/blobs/manifest.json`: `{ key → { blob, offset, length } }` index
6. Delete the compacted JSON files from `llm-cache/`

### Blob layout

```
llm-cache/
├── <key>.json          # uncompacted entries (hot)
├── blobs/
│   ├── manifest.json   # { version, entries: { key → { blob, offset, length } } }
│   ├── fr-01.br        # brotli-compressed NDJSON
│   ├── fr-02.br
│   ├── en-01.br
│   └── ...
```

## Benchmarks

### Per-section blob compression (section-01: 33 MB raw, 15,000 entries)

| Algo   | Level | Compressed | Ratio  | Compress | Decompress |
|--------|-------|-----------|--------|----------|------------|
| brotli | 1     | 4.8 MB    | 14.4%  | 127ms    | 55ms       |
| brotli | 6     | 2.9 MB    | 8.7%   | 418ms    | 36ms       |
| brotli | 8     | 2.7 MB    | 8.1%   | 748ms    | 31ms       |
| brotli | 11    | 2.4 MB    | 7.0%   | 24.5s    | 28ms       |
| zstd   | 1     | 4.5 MB    | 13.2%  | 170ms    | 109ms      |
| zstd   | 3     | 3.9 MB    | 11.3%  | 178ms    | 103ms      |
| zstd   | 6     | 3.4 MB    | 9.8%   | 236ms    | 106ms      |
| zstd   | 10    | 3.0 MB    | 8.6%   | 349ms    | 113ms      |
| zstd   | 15    | 2.8 MB    | 8.0%   | 2.3s     | 107ms      |
| zstd   | 19    | 2.4 MB    | 7.0%   | 7.6s     | 107ms      |

### Per-entry (current approach) vs blob compression

| Method              | Size     | Notes                           |
|---------------------|----------|---------------------------------|
| Current (JSON files)| 65 MB    | 4K block overhead               |
| Per-entry brotli-6  | 15.5 MB  | SQLite-style, no shared dict    |
| Blob brotli-6       | 2.9 MB   | Shared dictionary across entries|

**Blob is 5x smaller than per-entry** because brotli exploits cross-entry redundancy (shared system prompts, JSON structure).

### NDJSON vs Protobuf

| Format                  | Raw    | Brotli-6 |
|-------------------------|--------|----------|
| Full JSON as-is         | 1233 KB| 118 KB   |
| Compact JSON            | 1125 KB| 117 KB   |
| Strip nonce/harness/ts  | 935 KB | 78 KB    |
| Short keys + stripped   | 860 KB | 76 KB    |

Brotli handles JSON key repetition well. Field stripping would save 34% but we keep all fields for debuggability. Protobuf would save marginally over NDJSON after brotli — not worth the schema maintenance.

## Chosen configuration

- **Format**: NDJSON (one entry per line), all fields preserved
- **Compression**: brotli-6 via Node `zlib.brotliCompressSync` (built-in, no deps)
- **Blob granularity**: per language per section (e.g. `fr-01`, `en-03`)
- **Estimated full-scale size**: ~20 MB total vs multi-GB projected

## Implementation notes

- `src/validation/cache.ts` needs minor changes: `loadCacheEntry` checks blobs as fallback, `getAllCacheKeys` reads manifest
- `scripts/compact-cache.ts`: new script, reads JSON files, groups, compresses, writes blobs + manifest
- `.gitignore`: update to ignore `llm-cache/blobs/` alongside `llm-cache/*.json`
- Content-addressable keys remain unchanged — editing questions invalidates old entries as before
