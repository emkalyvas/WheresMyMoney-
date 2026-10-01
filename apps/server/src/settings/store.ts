import { EventEmitter } from 'node:events';
import {
  type SecretKey,
  type SecretStatus,
  type Settings,
  type SettingsSection,
  sectionSchemas,
  settingsSchema,
} from '@wmm/shared';
import type { DB } from '../db';
import { decrypt, encrypt, secretHint } from './crypto';

export interface SettingsChange {
  sections: SettingsSection[];
  secrets: string[];
}

/**
 * Persistent settings + encrypted secrets.
 * Emits 'change' with the affected sections/secret keys after every write.
 */
export class SettingsStore extends EventEmitter<{ change: [SettingsChange] }> {
  private cache: Settings | null = null;

  constructor(
    private readonly db: DB,
    private readonly key: Buffer,
  ) {
    super();
  }

  isInitialised(): boolean {
    return !!this.db.prepare('SELECT 1 FROM settings WHERE id = 1').get();
  }

  wasImportedFromEnv(): boolean {
    const row = this.db.prepare('SELECT imported_from_env FROM settings WHERE id = 1').get() as
      | { imported_from_env: number }
      | undefined;
    return row?.imported_from_env === 1;
  }

  get(): Settings {
    if (this.cache) return this.cache;
    const row = this.db.prepare('SELECT json FROM settings WHERE id = 1').get() as { json: string } | undefined;
    // Parsing through the schema fills in defaults for fields added in later versions.
    this.cache = settingsSchema.parse(row ? JSON.parse(row.json) : {});
    return this.cache;
  }

  /** Replace the whole settings object (used by the importer and setup). */
  replace(next: Settings, opts: { importedFromEnv?: boolean } = {}) {
    const parsed = settingsSchema.parse(next);
    this.write(parsed, opts.importedFromEnv);
    this.emit('change', { sections: Object.keys(parsed) as SettingsSection[], secrets: [] });
  }

  updateSection<K extends SettingsSection>(section: K, value: unknown): Settings[K] {
    const parsed = sectionSchemas[section].parse(value) as Settings[K];
    const next = { ...this.get(), [section]: parsed };
    this.write(next);
    this.emit('change', { sections: [section], secrets: [] });
    return parsed;
  }

  private write(next: Settings, importedFromEnv?: boolean) {
    const now = new Date().toISOString();
    const json = JSON.stringify(next);
    if (!this.isInitialised()) {
      this.db
        .prepare('INSERT INTO settings (id, json, imported_from_env, updated_at) VALUES (1, ?, ?, ?)')
        .run(json, importedFromEnv ? 1 : 0, now);
    } else {
      this.db.prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1').run(json, now);
    }
    this.cache = next;
  }

  // -------------------------------------------------------------------------
  // Secrets
  // -------------------------------------------------------------------------

  getSecret(key: SecretKey): string | undefined {
    const row = this.db.prepare('SELECT iv, tag, data FROM secrets WHERE key = ?').get(key) as
      | { iv: Buffer; tag: Buffer; data: Buffer }
      | undefined;
    if (!row) return undefined;
    return decrypt(this.key, row, key);
  }

  /** Write secrets; `null` (or empty string) deletes. Emits a single change event. */
  setSecrets(values: Partial<Record<SecretKey, string | null>>, opts: { silent?: boolean } = {}) {
    const now = new Date().toISOString();
    const keys = Object.keys(values) as SecretKey[];
    this.db.transaction(() => {
      for (const key of keys) {
        const value = values[key];
        if (value == null || value === '') {
          this.db.prepare('DELETE FROM secrets WHERE key = ?').run(key);
          continue;
        }
        const enc = encrypt(this.key, value, key);
        this.db
          .prepare(
            `INSERT INTO secrets (key, iv, tag, data, hint, updated_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET iv = excluded.iv, tag = excluded.tag, data = excluded.data,
               hint = excluded.hint, updated_at = excluded.updated_at`,
          )
          .run(key, enc.iv, enc.tag, enc.data, secretHint(value) ?? null, now);
      }
    })();
    if (keys.length && !opts.silent) this.emit('change', { sections: [], secrets: keys });
  }

  deleteSecretsWithPrefix(prefix: string) {
    this.db.prepare('DELETE FROM secrets WHERE key LIKE ?').run(`${prefix}%`);
  }

  secretStatuses(): Record<string, SecretStatus> {
    const rows = this.db.prepare('SELECT key, hint, updated_at FROM secrets').all() as {
      key: string;
      hint: string | null;
      updated_at: string;
    }[];
    return Object.fromEntries(
      rows.map((r) => [r.key, { set: true, hint: r.hint ?? undefined, updatedAt: r.updated_at }]),
    );
  }
}
