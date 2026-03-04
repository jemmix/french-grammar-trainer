import { cookies } from "next/headers";
import { env } from "~/env";
import { getStore } from "./store";
import { createEmptyPowers, decodeRecord } from "./user-record";
import { verifyCookie, shouldRenew } from "./session-cookie";
import { isUserAllowed } from "./allow-list";
import { auth } from "./auth-config";

type SessionResult =
  | { isLoggedIn: false }
  | { isLoggedIn: true; userId: string; shouldRenew: boolean };

const NEXT_AUTH_COOKIES = [
  "authjs.session-token",
  "authjs.callback-url",
  "authjs.csrf-token",
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
  "__Secure-authjs.csrf-token",
];

/** Delete all next-auth session cookies so a corrupt token doesn't persist. */
async function clearNextAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of NEXT_AUTH_COOKIES) {
    if (jar.get(name)) {
      jar.delete(name);
    }
  }
}

export async function getSession(): Promise<SessionResult> {
  // 1. Try next-auth session (production Google OAuth)
  try {
    const nextAuthSession = await auth();
    const mangledId = (
      nextAuthSession as unknown as Record<string, unknown> | null
    )?.mangledUserId;
    if (typeof mangledId === "string" && mangledId) {
      return { isLoggedIn: true, userId: mangledId, shouldRenew: false };
    }
  } catch {
    // Invalid/corrupt next-auth cookie — delete it so it doesn't keep failing
    await clearNextAuthCookies();
  }

  // 2. Fall back to HMAC cookie (dev fake-login)
  const jar = await cookies();
  const cookie = jar.get("fgt-session")?.value;
  if (!cookie) return { isLoggedIn: false };

  const verified = verifyCookie(cookie, env.COOKIE_SECRET);
  if (!verified) {
    // Corrupt or expired HMAC cookie — delete it
    jar.delete("fgt-session");
    return { isLoggedIn: false };
  }

  const allowed = await isUserAllowed(verified.userId);
  if (!allowed) return { isLoggedIn: false };

  return {
    isLoggedIn: true,
    userId: verified.userId,
    shouldRenew: shouldRenew(verified.iat),
  };
}

export async function getProgressPowers(userId: string): Promise<number[]> {
  const store = await getStore();
  const data = await store.get(userId);
  if (!data) return Array.from(createEmptyPowers());
  return Array.from(decodeRecord(data));
}
