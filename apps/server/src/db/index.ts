import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS } from './migrations';

export type DB = Database.Database;

export const DB_FILE = 'wmm.db';
/** v1 database file name; copied (not moved) on first v2 boot so v1 history is kept. */
export const LEGACY_DB_FILE = 'cache.db';

export interface OpenDbResult {
  db: DB;
  importedLegacyDb: boolean;
}

export function openDatabase(dataDir: string): OpenDbResult {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, DB_FILE);
  const legacy = path.join(dataDir, LEGACY_DB_FILE);

  let importedLegacyDb = false;
  if (!fs.existsSync(file) && fs.existsSync(legacy)) {
    // v1 tables (statistics_cache, daily_statistics) are kept as-is by the migrations.
    fs.copyFileSync(legacy, file);
    importedLegacyDb = true;
  }

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return { db, importedLegacyDb };
}

export function openMemoryDatabase(): DB {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((r) => (r as { version: number }).version),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        m.version,
        new Date().toISOString(),
      );
    })();
  }
}

/** Small key/value store for derived state (known accounts, health report, scheduler bookkeeping). */
export function kvGet<T>(db: DB, key: string): T | undefined {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function kvSet(db: DB, key: string, value: unknown) {
  db.prepare(
    `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date().toISOString());
}
