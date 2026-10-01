import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { PasswordStore } from './auth/password';
import { SessionStore } from './auth/sessions';
import type { AppContext } from './context';
import { type DB } from './db';
import type { BootEnv } from './env';
import { ReportService } from './reports/service';
import { loadOrCreateKey } from './settings/crypto';
import { LEGACY_ENV_VARS, hasLegacyEnv, importLegacyEnv } from './settings/env-import';
import { SettingsStore } from './settings/store';
import { SnapshotStore } from './sync/snapshots';
import { SyncService } from './sync/service';

/** Human-friendly one-time code (no ambiguous characters). */
export function generateSetupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}${chars.slice(4).join('')}`;
}

export function applyTimezone(tz: string) {
  if (tz && process.env.TZ !== tz) process.env.TZ = tz;
}

/**
 * Wires stores and services together and performs one-time migrations:
 * importing v1 environment variables into settings (secrets encrypted) and
 * hashing the v1 APP_PASSWORD so existing logins and integrations keep working.
 */
export async function createContext(
  env: BootEnv,
  db: DB,
  log: FastifyBaseLogger,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<AppContext> {
  const key = loadOrCreateKey(env.dataDir, env.secretKey);
  const settings = new SettingsStore(db, key);
  const passwords = new PasswordStore(db);
  const sessions = new SessionStore(db);
  const snapshots = new SnapshotStore(db);

  let envVarsFound: string[] = [];
  if (!settings.isInitialised()) {
    if (hasLegacyEnv(processEnv)) {
      const tz = processEnv.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const imported = importLegacyEnv(processEnv, tz);
      settings.replace(imported.settings, { importedFromEnv: true });
      settings.setSecrets(imported.secrets, { silent: true });
      if (imported.password && !passwords.isSet()) await passwords.set(imported.password);
      envVarsFound = imported.found;
      log.warn(
        { variables: imported.found },
        'Imported v1 configuration from environment variables. They are no longer read: remove them from your .env / compose file.',
      );
    } else {
      const tz = processEnv.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      settings.replace({ ...settings.get(), general: { ...settings.get().general, timezone: tz } });
    }
  } else {
    const leftover = LEGACY_ENV_VARS.filter((k) => (processEnv[k] ?? '').trim() !== '');
    if (leftover.length) {
      log.warn({ variables: leftover }, 'Ignoring v1 environment variables; settings are managed in the app now.');
    }
  }

  applyTimezone(settings.get().general.timezone);

  const sync = new SyncService(db, settings, snapshots, log);
  const reports = new ReportService(db, settings, snapshots, sync, log);

  const setupCode = passwords.isSet() ? null : generateSetupCode();
  return {
    env,
    db,
    settings,
    passwords,
    sessions,
    snapshots,
    sync,
    reports,
    setup: { code: setupCode, envVarsFound },
  };
}

/** Starts background work and reacts to settings changes. */
export function startBackground(ctx: AppContext) {
  const recalcSections = new Set(['general', 'firefly', 'trading212', 'etoro', 'ibkr', 'accounts', 'fx', 'tax', 'planning']);
  ctx.settings.on('change', (change) => {
    applyTimezone(ctx.settings.get().general.timezone);
    if (change.sections.includes('general')) ctx.sync.schedule();
    if (change.sections.some((s) => recalcSections.has(s)) || change.secrets.some((k) => !k.startsWith('smtp'))) {
      ctx.sync.requestRefresh();
    }
  });

  ctx.sync.schedule();
  ctx.reports.start();
  if (ctx.sync.isConfigured()) ctx.sync.start('refresh');

  const purge = setInterval(() => ctx.sessions.purgeExpired(), 60 * 60 * 1000);
  purge.unref();
}
