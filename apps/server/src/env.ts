import path from 'node:path';

/**
 * Bootstrap configuration. These are the ONLY values read from the
 * environment in v2; everything else is configured in the app.
 * (Legacy v1 variables are read once by the importer in settings/env-import.ts.)
 */
export interface BootEnv {
  port: number;
  host: string;
  dataDir: string;
  /** Optional 32-byte key (hex or base64). Generated into dataDir when absent. */
  secretKey: string | undefined;
  /** Passed to Fastify's trustProxy; addresses of reverse proxies whose X-Forwarded-* headers are trusted. */
  trustProxy: string | boolean;
  logLevel: string;
  webDir: string;
  isProduction: boolean;
}

export function readBootEnv(env: NodeJS.ProcessEnv = process.env): BootEnv {
  const trust = env.TRUST_PROXY ?? '127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1,fc00::/7';
  return {
    port: Number.parseInt(env.PORT ?? '3000', 10),
    host: env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR ?? './data'),
    secretKey: env.WMM_SECRET_KEY || undefined,
    trustProxy: trust === 'true' ? true : trust === 'false' ? false : trust,
    logLevel: env.LOG_LEVEL ?? 'info',
    webDir: path.resolve(env.WEB_DIR ?? path.join(import.meta.dirname, '../../web/dist')),
    isProduction: env.NODE_ENV === 'production',
  };
}
