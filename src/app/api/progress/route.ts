import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { sqliteStore } from "~/lib/sqlite-store";
import { verifyCookie } from "~/lib/session-cookie";
import { isUserAllowed } from "~/lib/allow-list";
import {
  createEmptyPowers,
  decodeHeader,
  decodeRecord,
  encodeRecord,
  recordAnswerInPlace,
} from "~/lib/user-record";

interface AnswerItem {
  ruleId: string;
  correct: boolean;
}

interface PostBody {
  answers: AnswerItem[];
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const val = req.cookies.get("fgt-session")?.value;
  if (!val) return null;

  const verified = verifyCookie(val, env.COOKIE_SECRET);
  if (!verified) return null;

  const allowed = await isUserAllowed(verified.userId);
  if (!allowed) return null;

  return verified.userId;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = sqliteStore.get(userId);
  if (!data) {
    return new NextResponse(null, { status: 204 });
  }
  const header = decodeHeader(data);
  const powers = decodeRecord(data);
  return NextResponse.json({ ...header, powers: Array.from(powers) });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as PostBody;
  if (!Array.isArray(body?.answers)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const existing = sqliteStore.get(userId);
  const powers = existing ? decodeRecord(existing) : createEmptyPowers();
  for (const item of body.answers) {
    if (typeof item.ruleId === "string" && typeof item.correct === "boolean") {
      recordAnswerInPlace(powers, item.ruleId, item.correct);
    }
  }
  sqliteStore.put(userId, encodeRecord(powers));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  sqliteStore.delete(userId);
  return NextResponse.json({ ok: true });
}
