import type { NextApiRequest, NextApiResponse } from "next";

type SessionResponse =
  | { isLoggedIn: true; userId: string }
  | { isLoggedIn: false };

function getSessionCookie(req: NextApiRequest): string | undefined {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx < 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === "fgt-session") return val;
  }
  return undefined;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionResponse>,
) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const userId = getSessionCookie(req);
  if (userId && /^[0-9a-f]{64}$/.test(userId)) {
    res.json({ isLoggedIn: true, userId });
  } else {
    res.json({ isLoggedIn: false });
  }
}
