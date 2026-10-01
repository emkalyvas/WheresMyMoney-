export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      -- v1-compatible tables (identical shape, so a copied v1 cache.db keeps working)
      CREATE TABLE IF NOT EXISTS statistics_cache (
        id TEXT PRIMARY KEY,
        payload TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS daily_statistics (
        date TEXT PRIMARY KEY,
        payload TEXT
      );

      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL,
        imported_from_env INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE secrets (
        key TEXT PRIMARY KEY,
        iv BLOB NOT NULL,
        tag BLOB NOT NULL,
        data BLOB NOT NULL,
        hint TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,          -- sha256 of the token; the token itself is never stored
        public_id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('web', 'api')),
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT
      );
      CREATE INDEX sessions_expires ON sessions (expires_at);

      CREATE TABLE sync_runs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        state TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        error TEXT
      );
      CREATE INDEX sync_runs_started ON sync_runs (started_at);

      CREATE TABLE report_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        recipients INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );

      CREATE TABLE kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];
