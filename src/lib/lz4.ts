// Thin async wrappers around lz4js (CJS module, no type definitions).
// Lazy-loaded and cached so the module is only imported once.

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

export async function lz4Compress(data: Uint8Array): Promise<Uint8Array> {
  return (await getLz4()).compress(data);
}

export async function lz4Decompress(data: Uint8Array): Promise<Uint8Array> {
  return (await getLz4()).decompress(data);
}
