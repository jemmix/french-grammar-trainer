import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

interface UserRow {
  data: Buffer;
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
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  g._fgtDb = db;
  return db;
}

export const sqliteStore = {
  get(userId: string): Uint8Array | null {
    const db = getDb();
    const row = db
      .prepare("SELECT data FROM users WHERE user_id = ?")
      .get(userId) as UserRow | undefined;
    if (!row) return null;
    return new Uint8Array(row.data);
  },

  put(userId: string, data: Uint8Array): void {
    const db = getDb();
    const buf = Buffer.from(data);
    db.prepare(`
      INSERT INTO users (user_id, data, updated_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
    `).run(userId, buf);
  },

  delete(userId: string): void {
    const db = getDb();
    db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
  },
};
