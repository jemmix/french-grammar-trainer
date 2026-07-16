import { type NextRequest, NextResponse } from "next/server";
import { getStore, deserialize, modifyUserPowers } from "~/storage/store";
import { getSession } from "~/next/lib/server-session";
import { recordAnswerInPlace } from "~/mastery/progress";

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
  const raw = await store.get(userId);
  if (!raw) {
    return new NextResponse(null, { status: 204 });
  }
  const { header, powers } = await deserialize(raw);
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
  await modifyUserPowers(userId, (powers) => {
    for (const item of body.answers) {
      if (typeof item.ruleId === "string" && typeof item.correct === "boolean") {
        recordAnswerInPlace(powers, item.ruleId, item.correct);
      }
    }
  });
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
