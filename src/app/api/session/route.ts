import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { verifyCookie } from "~/lib/session-cookie";
import { isUserAllowed } from "~/lib/allow-list";

type SessionResponse =
  | { isLoggedIn: true; userId: string }
  | { isLoggedIn: false };

export async function GET(req: NextRequest): Promise<NextResponse<SessionResponse>> {
  const val = req.cookies.get("fgt-session")?.value;
  if (!val) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const verified = verifyCookie(val, env.COOKIE_SECRET);
  if (!verified) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const allowed = await isUserAllowed(verified.userId);
  if (!allowed) {
    return NextResponse.json({ isLoggedIn: false });
  }

  return NextResponse.json({ isLoggedIn: true, userId: verified.userId });
}
