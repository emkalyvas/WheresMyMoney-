import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../context';
import { localDateKey } from '../calc/util';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NOT_READY = {
  success: false,
  error: 'Data is currently being calculated. Please try again in a few moments.',
  retryAfter: 5,
};

/**
 * Statistics endpoints.
 *
 * `/api/statistics*` is the v1 contract used by external clients (TimologioPlus):
 * response envelope `{ success, data }`, query parameters and status codes are
 * unchanged. `/api/stats*` are the v2 endpoints used by the web app.
 */
export function statisticsRoutes(app: FastifyInstance, ctx: AppContext) {
  // ---------------------------------------------------------------- v1 -----
  app.get<{ Querystring: { year?: string } }>('/api/statistics', async (req, reply) => {
    const { year } = req.query;
    if (year !== undefined) {
      if (!/^\d{4}$/.test(year)) {
        return reply.code(400).send({ success: false, error: 'Invalid year format. Expected YYYY.' });
      }
      const data = ctx.snapshots.getByYear(year);
      if (!data) {
        return reply.code(404).send({ success: false, error: `No statistics snapshot found for year ${year}.` });
      }
      return { success: true, data };
    }
    const data = ctx.snapshots.getCurrent();
    if (!data) return reply.code(503).send(NOT_READY);
    return { success: true, data };
  });

  app.get<{ Querystring: { metricPath?: string; start?: string; end?: string } }>(
    '/api/statistics/history',
    async (req, reply) => {
      const { metricPath, start, end } = req.query;
      if (!metricPath || !start || !end) {
        return reply
          .code(400)
          .send({ success: false, error: 'Missing required query parameters: metricPath, start, end' });
      }
      const data = ctx.snapshots.legacyHistory(metricPath, start, end);
      if (!data) return reply.code(400).send({ success: false, error: 'Unsupported metricPath' });
      return { success: true, data };
    },
  );

  /** v1: force a recalculation and return the fresh statistics (waits for completion). */
  app.post('/api/statistics/recalculate', async (_req, reply) => {
    if (!ctx.sync.isConfigured()) return reply.code(503).send(NOT_READY);
    const job = await ctx.sync.start('refresh').done;
    const data = ctx.snapshots.getCurrent();
    if (!data) return reply.code(503).send(NOT_READY);
    if (job.state === 'failed') reply.header('X-WMM-Sync-Error', job.error ?? 'failed');
    return { success: true, data };
  });

  // ---------------------------------------------------------------- v2 -----
  app.get<{ Querystring: { at?: string } }>('/api/stats', async (req, reply) => {
    const at = req.query.at ? isoDate.parse(req.query.at) : undefined;
    const data = at && at < localDateKey(new Date()) ? ctx.snapshots.getAt(at) : ctx.snapshots.getCurrent();
    return reply.send({
      data,
      years: ctx.snapshots.availableYears(),
      sync: ctx.sync.status(),
    });
  });

  app.get<{ Querystring: { metric?: string; from?: string; to?: string } }>(
    '/api/stats/history',
    async (req, reply) => {
      const q = z
        .object({ metric: z.string().min(1).max(200), from: isoDate, to: isoDate })
        .parse(req.query);
      const points = ctx.snapshots.history(q.metric, q.from, q.to);
      if (!points) return reply.code(400).send({ success: false, error: 'Unknown metric', code: 'UNKNOWN_METRIC' });
      return { points };
    },
  );

  // -------------------------------------------------------------- sync -----
  app.get('/api/sync', async () => ctx.sync.status());

  app.post('/api/sync', async (req, reply) => {
    const body = z
      .object({ kind: z.enum(['refresh', 'rebuild-history']).default('refresh'), overwrite: z.boolean().default(false) })
      .parse(req.body ?? {});
    if (!ctx.sync.isConfigured()) {
      return reply.code(409).send({ success: false, error: 'Firefly III is not configured', code: 'NOT_CONFIGURED' });
    }
    const { job } = ctx.sync.start(body.kind, { overwrite: body.overwrite });
    return reply.code(202).send({ job });
  });

  app.get('/api/health/data', async () => ctx.sync.health());
}
