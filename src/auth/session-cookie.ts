import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie expires after 30 days */
export const COOKIE_MAX_AGE_S = 30 * 86_400;
/** Re-issue cookie if signed more than 20 days ago */
export const COOKIE_RENEW_AFTER_S = 20 * 86_400;

interface CookiePayload {
  uid: string;
  iat: number;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

/**
 * Create a signed session cookie value.
 * Format: base64url(json_payload).base64url(hmac_signature)
 */
export function signCookie(userId: string, secret: string): string {
  const payload: CookiePayload = {
    uid: userId,
    iat: Math.floor(Date.now() / 1000),
  };
  const encoded = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = hmac(encoded, secret);
  return `${encoded}.${sig}`;
}

/**
 * Verify a signed cookie and return its contents, or null if invalid/expired.
 */
export function verifyCookie(
  cookie: string,
  secret: string,
): { userId: string; iat: number } | null {
  const dotIdx = cookie.indexOf(".");
  if (dotIdx === -1) return null;

  const encoded = cookie.slice(0, dotIdx);
  const sig = cookie.slice(dotIdx + 1);

  // Verify HMAC
  const expected = hmac(encoded, secret);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  // Decode payload
  let payload: CookiePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as CookiePayload;
  } catch {
    return null;
  }

  if (typeof payload.uid !== "string" || typeof payload.iat !== "number") {
    return null;
  }

  // Check expiry
  const nowS = Math.floor(Date.now() / 1000);
  if (nowS - payload.iat > COOKIE_MAX_AGE_S) {
    return null;
  }

  return { userId: payload.uid, iat: payload.iat };
}

/**
 * Returns true if the cookie was issued 20+ days ago and should be renewed.
 */
export function shouldRenew(iat: number): boolean {
  const nowS = Math.floor(Date.now() / 1000);
  return nowS - iat >= COOKIE_RENEW_AFTER_S;
}
