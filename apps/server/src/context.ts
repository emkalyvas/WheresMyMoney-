import type { BootEnv } from './env';
import type { DB } from './db';
import type { PasswordStore } from './auth/password';
import type { SessionStore } from './auth/sessions';
import type { SettingsStore } from './settings/store';
import type { SnapshotStore } from './sync/snapshots';
import type { SyncService } from './sync/service';
import type { ReportService } from './reports/service';

export interface AppContext {
  env: BootEnv;
  db: DB;
  settings: SettingsStore;
  passwords: PasswordStore;
  sessions: SessionStore;
  snapshots: SnapshotStore;
  sync: SyncService;
  reports: ReportService;
  /** One-time code required to complete first-run setup; null once a password exists. */
  setup: { code: string | null; envVarsFound: string[] };
}
