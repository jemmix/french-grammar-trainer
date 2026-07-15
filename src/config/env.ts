/**
 * The single process.env reader for framework-agnostic domains.
 * Domains import values from here instead of reading process.env directly.
 * On a framework swap (e.g. SvelteKit), rewrite this one file to read `$env/*`.
 */
export const env = {
  /** Active content/UI language, e.g. "fr", "en", "de". */
  lang: process.env.NEXT_PUBLIC_LANG ?? "fr",
  /** Argon2 salt for user-id mangling. Server-only (no NEXT_PUBLIC_ prefix). */
  hmacKey: process.env.HMAC_KEY,
  /** When true, allow-list admits only the dev user (mangleUserId("0")). */
  allowListDevMode: process.env.ALLOW_LIST_DEV_MODE === "1",
} as const;
