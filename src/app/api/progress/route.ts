import { type NextRequest, NextResponse } from "next/server";
import { sqliteStore } from "~/lib/sqlite-store";
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

function getUserId(req: NextRequest): string | null {
  const val = req.cookies.get("fgt-session")?.value;
  if (val && /^[0-9a-f]{64}$/.test(val)) return val;
  return null;
}

export function GET(req: NextRequest) {
  const userId = getUserId(req);
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
  const userId = getUserId(req);
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

export function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  sqliteStore.delete(userId);
  return NextResponse.json({ ok: true });
}
