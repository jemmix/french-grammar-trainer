/**
 * Aggressive benchmark for the runtime DSL loader.
 *
 * Isolates the loader's actual work (read + parse + shape) from tsx's
 * TypeScript transform overhead by calling loadSectionsFromDsl directly,
 * and compares against the user's `cat | wc -l` baseline.
 *
 * Run: npx tsx scripts/bench-loader.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { performance } from "perf_hooks";
import { loadSectionsFromDsl } from "../src/data/loader";
import type { Section } from "../src/data/types";

const langs = ["de", "fr", "en"] as const;
const iters = 25;
const warmup = 5;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
function stats(xs: number[]) {
  const min = Math.min(...xs), max = Math.max(...xs);
  const m = median(xs);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const p95 = [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;
  return { min, med: m, mean, max, p95 };
}

// Pre-fetch meta per lang (mirrors what app does once at boot).
const metas: Record<string, { id: string; title: string; description: string }[]> = {};
for (const lang of langs) {
  const mod = await import(`../src/data/${lang}/index.ts`);
  metas[lang] = mod.meta;
}
console.log(`Benchmark: loadSectionsFromDsl() — ${iters} iters, ${warmup} warmup\n`);

const totals: Record<string, number> = {};
for (const lang of langs) {
  // Warmup
  for (let i = 0; i < warmup; i++) loadSectionsFromDsl(lang, metas[lang]!);

  const times: number[] = [];
  let qcount = 0;
  for (let i = 0; i < iters; i++) {
    const t = performance.now();
    const sections = loadSectionsFromDsl(lang, metas[lang]!);
    times.push(performance.now() - t);
    qcount = sections.reduce((n: number, s: Section) => n + s.questions.length, 0);
  }
  totals[lang] = qcount;
  const s = stats(times);
  console.log(
    `${lang}  ${String(qcount).padStart(5)} Q / ${String(readdirSync(join("questions", lang)).length).padStart(3)} files  ` +
    `med=${s.med.toFixed(2)}ms  mean=${s.mean.toFixed(2)}ms  ` +
    `min=${s.min.toFixed(2)}  p95=${s.p95.toFixed(2)}  max=${s.max.toFixed(2)}`,
  );
}

// Baseline: cat all .txt files (raw I/O) and `wc -l` equivalent.
console.log("\nBaseline (raw I/O only, no parsing):");
for (const lang of langs) {
  const dir = join("questions", lang);
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  for (let w = 0; w < warmup; w++) for (const f of files) readFileSync(join(dir, f), "utf-8");
  const times: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t = performance.now();
    let lines = 0;
    for (const f of files) {
      const c = readFileSync(join(dir, f), "utf-8");
      for (let k = 0; k < c.length; k++) if (c.charCodeAt(k) === 10) lines++;
    }
    times.push(performance.now() - t);
    if (i === 0 && lang === "de") console.log(`  (de wc -l equivalent: ${lines} lines)`);
  }
  const s = stats(times);
  console.log(
    `${lang}  read+wc  med=${s.med.toFixed(2)}ms  min=${s.min.toFixed(2)}  max=${s.max.toFixed(2)}`,
  );
}

// Throughput summary
console.log("\nThroughput (questions / ms, median):");
for (const lang of langs) {
  const dir = join("questions", lang);
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  for (let w = 0; w < warmup; w++) loadSectionsFromDsl(lang, metas[lang]!);
  const times: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t = performance.now();
    loadSectionsFromDsl(lang, metas[lang]!);
    times.push(performance.now() - t);
  }
  const qps = totals[lang]! / median(times);
  console.log(`  ${lang}: ${qps.toFixed(0)} Q/ms  (${(qps * 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Q/s)`);
}
