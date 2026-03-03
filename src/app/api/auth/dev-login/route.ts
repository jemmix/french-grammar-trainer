import { type NextRequest, NextResponse } from "next/server";
import { mangleUserId } from "~/lib/auth";
import { isUserAllowed } from "~/lib/allow-list";
import { signCookie, COOKIE_MAX_AGE_S } from "~/lib/session-cookie";
import { env } from "~/env";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { sub?: unknown };
  const sub = typeof body?.sub === "string" ? body.sub : "0";
  const userId = await mangleUserId(sub);

  const allowed = await isUserAllowed(userId);
  if (!allowed) {
    return NextResponse.json({ ok: false, denied: true, userId });
  }

  const cookie = signCookie(userId, env.COOKIE_SECRET);
  const response = NextResponse.json({ ok: true, userId });
  response.cookies.set("fgt-session", cookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
    secure: false,
  });
  return response;
}
