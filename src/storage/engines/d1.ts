const API_BASE = "https://api.cloudflare.com/client/v4/accounts";

function accountId(): string {
  return process.env.D1_ACCOUNT_ID!;
}

function databaseId(): string {
  return process.env.D1_DATABASE_ID!;
}

function apiToken(): string {
  return process.env.D1_API_TOKEN!;
}

interface D1Result {
  rows: Record<string, unknown>[];
  changes: number;
}

async function d1Query(
  sql: string,
  ...params: (string | number | null)[]
): Promise<D1Result> {
  const url = `${API_BASE}/${accountId()}/d1/database/${databaseId()}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    result: Array<{
      results: {
        rows: Record<string, unknown>[];
        success: boolean;
        meta: { changes: number };
      };
    }>;
    success: boolean;
    errors: unknown[];
  };
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`);
  }
  const r = json.result[0]!.results;
  return { rows: r.rows, changes: r.meta.changes };
}

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await d1Query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  tableReady = true;
}

const MAX_CAS_RETRIES = 5;

export const d1Store = {
  async get(userId: string): Promise<Uint8Array | null> {
    await ensureTable();
    const { rows } = await d1Query(
      "SELECT data FROM users WHERE user_id = ?",
      userId,
    );
    if (rows.length === 0) return null;
    const b64 = (rows[0]!.data as string);
    return new Uint8Array(Buffer.from(b64, "base64"));
  },

  async put(userId: string, data: Uint8Array): Promise<void> {
    await ensureTable();
    const b64 = Buffer.from(data).toString("base64");
    await d1Query(
      `INSERT INTO users (user_id, data, version, updated_at) VALUES (?, ?, 0, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = users.version + 1, updated_at = unixepoch()`,
      userId,
      b64,
    );
  },

  async delete(userId: string): Promise<void> {
    await ensureTable();
    await d1Query("DELETE FROM users WHERE user_id = ?", userId);
  },

  async modify(
    userId: string,
    fn: (current: Uint8Array | null) => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    await ensureTable();

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const { rows } = await d1Query(
        "SELECT data, version FROM users WHERE user_id = ?",
        userId,
      );

      if (rows.length === 0) {
        // New user — INSERT IF NOT EXISTS
        const newData = await fn(null);
        const b64 = Buffer.from(newData).toString("base64");
        const { changes } = await d1Query(
          "INSERT INTO users (user_id, data, version, updated_at) VALUES (?, ?, 0, unixepoch()) ON CONFLICT(user_id) DO NOTHING",
          userId,
          b64,
        );
        if (changes > 0) return newData;
        continue;
      }

      const currentB64 = rows[0]!.data as string;
      const version = rows[0]!.version as number;
      const current = new Uint8Array(Buffer.from(currentB64, "base64"));

      const newData = await fn(current);
      const newB64 = Buffer.from(newData).toString("base64");

      const { changes } = await d1Query(
        "UPDATE users SET data = ?, version = version + 1, updated_at = unixepoch() WHERE user_id = ? AND version = ?",
        newB64,
        userId,
        version,
      );

      if (changes > 0) return newData;
      // CAS failed — retry
    }

    throw new Error(`CAS retry limit (${MAX_CAS_RETRIES}) exceeded for user ${userId}`);
  },
};
