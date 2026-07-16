/**
 * The single process.env reader for framework-agnostic domains.
 * Domains import values from here instead of reading process.env directly.
 * On a framework swap (e.g. SvelteKit), rewrite this one file to read `$env/*`.
 *
 * ENGINE vars (STORAGE_ENGINE, AUTH_ENGINE) are validated as required by the
 * t3 env schema in src/next/env.js. The defaults below are only for type
 * safety — the app will not start if they are missing.
 */
export const env = {
  /** Active content/UI language, e.g. "fr", "en", "de". */
  lang: process.env.NEXT_PUBLIC_LANG ?? "fr",
  /** Argon2 salt for user-id mangling. Server-only (no NEXT_PUBLIC_ prefix). */
  hmacKey: process.env.HMAC_KEY,
  /** Storage backend: "s3", "d1", or "sqlite". */
  storageEngine: (process.env.STORAGE_ENGINE ?? "sqlite") as "s3" | "d1" | "sqlite",
  /** Auth backend: "dev" (fake HMAC login) or "google" (Google OAuth). */
  authEngine: (process.env.AUTH_ENGINE ?? "dev") as "dev" | "google",
} as const;
