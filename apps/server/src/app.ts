import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Fastify, { type FastifyBaseLogger, type FastifyInstance, LogController } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { registerAuth } from './auth/plugin';
import type { AppContext } from './context';
import { authRoutes } from './routes/auth';
import { reportRoutes } from './routes/reports';
import { settingsRoutes } from './routes/settings';
import { statisticsRoutes } from './routes/statistics';

export const LOG_REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.apiSecret',
];

export async function buildApp(ctx: AppContext, opts: { logger?: FastifyBaseLogger } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    ...(opts.logger ? { loggerInstance: opts.logger } : { logger: false }),
    trustProxy: ctx.env.trustProxy,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => crypto.randomBytes(6).toString('hex'),
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  // Concise access log for API calls only (no query strings, no headers).
  app.addHook('onResponse', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    req.log.info(
      { method: req.method, route: req.routeOptions.url ?? 'unknown', status: reply.statusCode, ms: Math.round(reply.elapsedTime) },
      'request',
    );
  });

  app.setErrorHandler((err: Error, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status === 429) {
      return reply.code(429).send({ success: false, error: 'Too many attempts, try again later', code: 'RATE_LIMITED' });
    }
    if (status < 500) {
      return reply.code(status).send({ success: false, error: err.message, code: (err as { code?: string }).code });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ success: false, error: 'Internal server error', requestId: req.id });
  });

  registerAuth(app, ctx);

  // Container health check; reveals nothing.
  app.get('/health', async () => ({ status: 'ok' }));

  authRoutes(app, ctx);
  settingsRoutes(app, ctx);
  statisticsRoutes(app, ctx);
  reportRoutes(app, ctx);

  // ------------------------------------------------------------------------
  // Single-page app (production build); in development Vite serves it.
  // ------------------------------------------------------------------------
  const indexHtml = path.join(ctx.env.webDir, 'index.html');
  const hasWeb = fs.existsSync(indexHtml);
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: ctx.env.webDir,
      wildcard: false,
      index: false,
      setHeaders(res, file) {
        res.header(
          'Cache-Control',
          file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.method !== 'GET' || !hasWeb) {
      return reply.code(404).send({ success: false, error: 'Not found' });
    }
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ctx.env.webDir, rel);
    if (rel && file.startsWith(ctx.env.webDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return reply.sendFile(rel);
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });

  return app;
}
