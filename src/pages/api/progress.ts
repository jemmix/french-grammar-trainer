import type { NextApiRequest, NextApiResponse } from "next";
import { sqliteStore } from "~/lib/sqlite-store";
import {
  createEmptyPowers,
  decodeRecord,
  encodeRecord,
  recordAnswerInPlace,
} from "~/lib/user-record";

interface AnswerItem {
  ruleId: string;
  correct: boolean;
}

interface PostBody {
  answers: AnswerItem[];
}

function getSessionUserId(req: NextApiRequest): string | null {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx < 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === "fgt-session" && /^[0-9a-f]{64}$/.test(val)) return val;
  }
  return null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const data = sqliteStore.get(userId);
    if (!data) {
      res.status(204).end();
      return;
    }
    const powers = decodeRecord(data);
    res.json({ powers: Array.from(powers) });
    return;
  }

  if (req.method === "POST") {
    const body = req.body as PostBody;
    if (!Array.isArray(body?.answers)) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const existing = sqliteStore.get(userId);
    const powers = existing ? decodeRecord(existing) : createEmptyPowers();
    for (const item of body.answers) {
      if (typeof item.ruleId === "string" && typeof item.correct === "boolean") {
        recordAnswerInPlace(powers, item.ruleId, item.correct);
      }
    }
    sqliteStore.put(userId, encodeRecord(powers));
    res.json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    sqliteStore.delete(userId);
    res.json({ ok: true });
    return;
  }

  res.status(405).end();
}
