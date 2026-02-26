import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "node:crypto";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const userId = createHash("sha256").update("dev-google-sub-0").digest("hex");
  res.setHeader(
    "Set-Cookie",
    `fgt-session=${userId}; HttpOnly; SameSite=Lax; Path=/`,
  );
  res.json({ ok: true, userId });
}
