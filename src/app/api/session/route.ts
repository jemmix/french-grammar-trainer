import { type NextRequest, NextResponse } from "next/server";

type SessionResponse =
  | { isLoggedIn: true; userId: string }
  | { isLoggedIn: false };

export function GET(req: NextRequest): NextResponse<SessionResponse> {
  const userId = req.cookies.get("fgt-session")?.value;
  if (userId && /^[0-9a-f]{64}$/.test(userId)) {
    return NextResponse.json({ isLoggedIn: true, userId });
  }
  return NextResponse.json({ isLoggedIn: false });
}
