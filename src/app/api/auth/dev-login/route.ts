import { type NextRequest, NextResponse } from "next/server";
import { mangleUserId } from "~/lib/auth";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { sub?: unknown };
  const sub = typeof body?.sub === "string" ? body.sub : "0";
  const userId = await mangleUserId(sub);

  // Any sub other than "0" is treated as a denied user (no session created)
  if (sub !== "0") {
    return NextResponse.json({ ok: false, denied: true, userId });
  }

  const response = NextResponse.json({ ok: true, userId });
  response.cookies.set("fgt-session", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
