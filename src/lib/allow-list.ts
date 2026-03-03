import { mangleUserId } from "./auth";

let devAllowedId: string | undefined;

/**
 * Check whether a mangled userId is on the allowlist.
 *
 * - ALLOW_LIST_DEV_MODE=1: allows only mangleUserId("0") (computed & cached once)
 * - Otherwise: returns false (placeholder for production gist-based allowlist)
 */
export async function isUserAllowed(mangledUserId: string): Promise<boolean> {
  if (process.env.ALLOW_LIST_DEV_MODE === "1") {
    if (devAllowedId === undefined) {
      devAllowedId = await mangleUserId("0");
    }
    return mangledUserId === devAllowedId;
  }

  // Production: placeholder — no users allowed until gist-based allowlist is wired up
  return false;
}
