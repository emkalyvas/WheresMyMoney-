import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../context';

export function reportRoutes(app: FastifyInstance, ctx: AppContext) {
  const download = async (reply: FastifyReply) => {
    try {
      const { pdf, filename } = await ctx.reports.generatePdf();
      ctx.reports.recordGenerated();
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Cache-Control', 'no-store')
        .send(pdf);
    } catch (err) {
      if ((err as Error).message === 'NO_DATA') {
        return reply.code(503).send({ success: false, error: 'No statistics available yet', code: 'NO_DATA' });
      }
      throw err;
    }
  };

  app.get('/api/reports', async () => ctx.reports.overview());
  app.get('/api/reports/pdf', async (_req, reply) => download(reply));
  /** v1 path */
  app.get('/api/report/pdf', async (_req, reply) => download(reply));

  app.post('/api/reports/send', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (_req, reply) => {
    if (!ctx.reports.emailConfigured()) {
      return reply.code(409).send({ success: false, error: 'E-mail is not configured', code: 'NOT_CONFIGURED' });
    }
    try {
      await ctx.reports.sendReport('manual');
      return { success: true };
    } catch (err) {
      return reply.code(502).send({ success: false, error: (err as Error).message });
    }
  });
}
