import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

interface UserRow {
  data: Buffer;
}

const g = global as { _fgtDb?: Database.Database };

function getDb(): Database.Database {
  if (g._fgtDb) return g._fgtDb;
  const dbPath = process.env.SQLITE_DB_PATH ?? join(process.cwd(), "data", "dev.sqlite3");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
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

/**
 * Serializes modify() calls within this process. Combined with BEGIN IMMEDIATE
 * (which acquires SQLite's write lock), this gives full read-modify-write
 * isolation without CAS retries.
 */
let modifyChain: Promise<unknown> = Promise.resolve();

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

  async modify(
    userId: string,
    fn: (current: Uint8Array | null) => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const run = modifyChain.then(async () => {
      const db = getDb();
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db
          .prepare("SELECT data FROM users WHERE user_id = ?")
          .get(userId) as UserRow | undefined;
        const current = row ? new Uint8Array(row.data) : null;
        const newData = await fn(current);
        const buf = Buffer.from(newData);
        db.prepare(`
          INSERT INTO users (user_id, data, updated_at) VALUES (?, ?, unixepoch())
          ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
        `).run(userId, buf);
        db.exec("COMMIT");
        return newData;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    });
    // Prevent rejection from breaking the chain for subsequent callers
    modifyChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<Uint8Array>;
  },
};
