import { NextResponse } from "next/server";
import { getSession } from "~/lib/server-session";

type SessionResponse =
  | { isLoggedIn: true; userId: string }
  | { isLoggedIn: false };

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: true, userId: session.userId });
  }
  return NextResponse.json({ isLoggedIn: false });
}
