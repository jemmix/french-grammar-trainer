import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

interface UserRow {
  data: Buffer;
  version: number;
}

const g = global as { _fgtDb?: Database.Database };

function getDb(): Database.Database {
  if (g._fgtDb) return g._fgtDb;
  const dbDir = join(process.cwd(), "data");
  mkdirSync(dbDir, { recursive: true });
  const db = new Database(join(dbDir, "dev.sqlite3"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      data BLOB NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  // Migration: add version column if missing (existing dev databases)
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "version")) {
    db.exec("ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 0");
  }
  g._fgtDb = db;
  return db;
}

const MAX_CAS_RETRIES = 5;

export const sqliteStore = {
  get(userId: string): Uint8Array | null {
    const db = getDb();
    const row = db
      .prepare("SELECT data FROM users WHERE user_id = ?")
      .get(userId) as { data: Buffer } | undefined;
    if (!row) return null;
    return new Uint8Array(row.data);
  },

  put(userId: string, data: Uint8Array): void {
    const db = getDb();
    const buf = Buffer.from(data);
    db.prepare(`
      INSERT INTO users (user_id, data, version, updated_at) VALUES (?, ?, 0, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = users.version + 1, updated_at = unixepoch()
    `).run(userId, buf);
  },

  delete(userId: string): void {
    const db = getDb();
    db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
  },

  async modify(
    userId: string,
    fn: (current: Uint8Array | null) => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const db = getDb();

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const row = db
        .prepare("SELECT data, version FROM users WHERE user_id = ?")
        .get(userId) as UserRow | undefined;

      if (!row) {
        // New user — INSERT IF NOT EXISTS to handle race
        const newData = await fn(null);
        const result = db
          .prepare(
            "INSERT INTO users (user_id, data, version, updated_at) VALUES (?, ?, 0, unixepoch()) ON CONFLICT(user_id) DO NOTHING",
          )
          .run(userId, Buffer.from(newData));
        if (result.changes > 0) return newData;
        continue; // Lost the insert race, retry as update
      }

      const current = new Uint8Array(row.data);
      const newData = await fn(current);
      const result = db
        .prepare(
          "UPDATE users SET data = ?, version = version + 1, updated_at = unixepoch() WHERE user_id = ? AND version = ?",
        )
        .run(Buffer.from(newData), userId, row.version);

      if (result.changes > 0) return newData;
      // CAS failed — version changed between read and write, retry
    }

    throw new Error(`CAS retry limit (${MAX_CAS_RETRIES}) exceeded for user ${userId}`);
  },
};
