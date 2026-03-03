import { NextResponse } from "next/server";

export function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fgt-session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
