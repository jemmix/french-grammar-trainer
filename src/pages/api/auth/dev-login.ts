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
  const userId = await mangleUserId("0");
  res.setHeader(
    "Set-Cookie",
    `fgt-session=${userId}; HttpOnly; SameSite=Lax; Path=/`,
  );
  res.json({ ok: true, userId });
}
