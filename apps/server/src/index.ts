import { buildApp, LOG_REDACT } from './app';
import { createContext, startBackground } from './bootstrap';
import { openDatabase } from './db';
import { readBootEnv } from './env';
import pino from 'pino';

const env = readBootEnv();
const log = pino({
  level: env.logLevel,
  redact: LOG_REDACT,
  ...(env.isProduction ? {} : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
});

const { db, importedLegacyDb } = openDatabase(env.dataDir);
if (importedLegacyDb) log.info('Copied the v1 database (cache.db → wmm.db); existing history is preserved.');

const ctx = await createContext(env, db, log);
const app = await buildApp(ctx, { logger: log });

if (ctx.setup.code) {
  log.warn('──────────────────────────────────────────────────────────────');
  log.warn(`  First-run setup: open the app and enter setup code ${ctx.setup.code}`);
  log.warn('──────────────────────────────────────────────────────────────');
}

await app.listen({ port: env.port, host: env.host });
startBackground(ctx);

const shutdown = async (signal: string) => {
  log.info({ signal }, 'shutting down');
  ctx.sync.stop();
  ctx.reports.stop();
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
