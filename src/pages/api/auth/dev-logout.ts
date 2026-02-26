import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  res.setHeader(
    "Set-Cookie",
    "fgt-session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  );
  res.json({ ok: true });
}
