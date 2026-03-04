import { type NextRequest, NextResponse } from "next/server";
import { getStore } from "~/lib/store";
import { getSession } from "~/lib/server-session";
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

async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session.isLoggedIn ? session.userId : null;
}

export async function GET(_req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getStore();
  const data = await store.get(userId);
  if (!data) {
    return new NextResponse(null, { status: 204 });
  }
  const header = decodeHeader(data);
  const powers = decodeRecord(data);
  return NextResponse.json({ ...header, powers: Array.from(powers) });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as PostBody;
  if (!Array.isArray(body?.answers)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const store = await getStore();
  const existing = await store.get(userId);
  const powers = existing ? decodeRecord(existing) : createEmptyPowers();
  for (const item of body.answers) {
    if (typeof item.ruleId === "string" && typeof item.correct === "boolean") {
      recordAnswerInPlace(powers, item.ruleId, item.correct);
    }
  }
  await store.put(userId, encodeRecord(powers));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getStore();
  await store.delete(userId);
  return NextResponse.json({ ok: true });
}
