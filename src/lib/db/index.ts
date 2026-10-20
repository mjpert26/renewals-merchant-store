import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";
import { seedDemoData } from "./seed";

export type DB = Database.Database;

const globalForDb = globalThis as unknown as { __rewardsDb?: DB };

export function dbPath(): string {
  if (process.env.REWARDS_DB_PATH) return process.env.REWARDS_DB_PATH;
  // Serverless hosts such as Vercel only allow writes under the OS temp
  // directory. The demo database there is per instance and resets on cold
  // starts; use a hosted database for anything that must persist.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "rewards.db");
  return path.join(process.cwd(), "data", "rewards.db");
}

/** Opens (and if needed creates, migrates and seeds) a database at the given path. */
export function openDatabase(file: string, options: { seed?: boolean } = {}): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  if (!version) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  }
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
  if (!seeded && options.seed !== false) {
    seedDemoData(db);
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(new Date().toISOString());
  }
  return db;
}

/** Process-wide connection used by the application. */
export function getDb(): DB {
  if (!globalForDb.__rewardsDb) {
    globalForDb.__rewardsDb = openDatabase(dbPath());
  }
  return globalForDb.__rewardsDb;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Runs fn inside a write transaction. BEGIN IMMEDIATE takes the write lock up
 * front, so concurrent writers (other requests or other processes sharing the
 * database file) are serialized and balance checks cannot interleave.
 */
export function inWriteTransaction<T>(db: DB, fn: () => T): T {
  return db.transaction(fn).immediate();
}
