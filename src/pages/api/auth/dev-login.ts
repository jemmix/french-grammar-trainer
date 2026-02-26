import type { NextApiRequest, NextApiResponse } from "next";
import { mangleUserId } from "~/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const body = req.body as { sub?: unknown } | undefined;
  const sub = typeof body?.sub === "string" ? body.sub : "0";
  const userId = await mangleUserId(sub);

  // Any sub other than "0" is treated as a denied user (no session created)
  if (sub !== "0") {
    res.json({ ok: false, denied: true, userId });
    return;
  }

  res.setHeader(
    "Set-Cookie",
    `fgt-session=${userId}; HttpOnly; SameSite=Lax; Path=/`,
  );
  res.json({ ok: true, userId });
}
