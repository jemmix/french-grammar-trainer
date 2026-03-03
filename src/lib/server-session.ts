import { cookies } from "next/headers";
import { env } from "~/env";
import { sqliteStore } from "./sqlite-store";
import { createEmptyPowers, decodeRecord } from "./user-record";
import { verifyCookie, shouldRenew } from "./session-cookie";
import { isUserAllowed } from "./allow-list";

type SessionResult =
  | { isLoggedIn: false }
  | { isLoggedIn: true; userId: string; shouldRenew: boolean };

export async function getSession(): Promise<SessionResult> {
  const cookie = (await cookies()).get("fgt-session")?.value;
  if (!cookie) return { isLoggedIn: false };

  const verified = verifyCookie(cookie, env.COOKIE_SECRET);
  if (!verified) return { isLoggedIn: false };

  const allowed = await isUserAllowed(verified.userId);
  if (!allowed) return { isLoggedIn: false };

  return {
    isLoggedIn: true,
    userId: verified.userId,
    shouldRenew: shouldRenew(verified.iat),
  };
}

export function getProgressPowers(userId: string): number[] {
  const data = sqliteStore.get(userId);
  if (!data) return Array.from(createEmptyPowers());
  return Array.from(decodeRecord(data));
}
