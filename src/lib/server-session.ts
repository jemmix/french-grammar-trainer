import { cookies } from "next/headers";
import { sqliteStore } from "./sqlite-store";
import { createEmptyPowers, decodeRecord } from "./user-record";

export async function getSession() {
  const cookie = (await cookies()).get("fgt-session")?.value;
  if (!cookie || !/^[0-9a-f]{64}$/.test(cookie)) {
    return { isLoggedIn: false as const };
  }
  return { isLoggedIn: true as const, userId: cookie };
}

export function getProgressPowers(userId: string): number[] {
  const data = sqliteStore.get(userId);
  if (!data) return Array.from(createEmptyPowers());
  return Array.from(decodeRecord(data));
}
