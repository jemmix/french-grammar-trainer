import { NextResponse, type NextRequest } from "next/server";

/**
 * Strip invalid authjs / fgt-session cookies before they reach the app.
 *
 * next-auth logs JWTSessionError internally when it encounters a corrupt
 * cookie — we can't suppress that without disabling all logging. The fix
 * is to catch bad cookies here in middleware (where we CAN delete them)
 * so auth() never sees them.
 */

const AUTHJS_SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/** A valid JWE compact serialization has exactly 5 base64url segments. */
function looksLikeJwe(value: string): boolean {
  return value.split(".").length === 5;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  let dirty = false;

  for (const name of AUTHJS_SESSION_COOKIES) {
    const value = request.cookies.get(name)?.value;
    if (value && !looksLikeJwe(value)) {
      response.cookies.delete(name);
      dirty = true;
    }
  }

  // Also clear fgt-session if it doesn't look like our "payload.sig" format
  const fgt = request.cookies.get("fgt-session")?.value;
  if (fgt && !fgt.includes(".")) {
    response.cookies.delete("fgt-session");
    dirty = true;
  }

  return dirty ? response : NextResponse.next();
}

export const config = {
  // Run on all page/api routes, skip static files
  matcher: ["/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|ico|webmanifest)).*)"],
};
