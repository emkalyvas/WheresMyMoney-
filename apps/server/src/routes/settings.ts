import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  type ConnectionTestResult,
  type SecretKey,
  type SettingsResponse,
  fireflySettingsSchema,
  settingsPatchSchema,
  settingsSchema,
} from '@wmm/shared';
import type { AppContext } from '../context';
import { FireflyClient } from '../sources/firefly';
import { UpstreamError } from '../sources/http';
import { testTrading212 } from '../sources/trading212';

const fireflyTestSchema = z.object({
  url: fireflySettingsSchema.shape.url.optional(),
  token: z.string().max(4096).optional(),
});

const t212TestSchema = z.object({
  apiKey: z.string().max(512).optional(),
  apiSecret: z.string().max(512).optional(),
  env: z.enum(['live', 'demo']).optional(),
});

function failure(err: unknown): ConnectionTestResult {
  if (err instanceof UpstreamError) return { ok: false, message: err.reason };
  return { ok: false, message: 'unreachable' };
}

export function settingsRoutes(app: FastifyInstance, ctx: AppContext) {
  const response = (): SettingsResponse => ({
    settings: ctx.settings.get(),
    secrets: ctx.settings.secretStatuses(),
    importedFromEnv: ctx.settings.wasImportedFromEnv(),
  });

  app.get('/api/settings', async () => response());

  app.patch('/api/settings', async (req) => {
    const patch = settingsPatchSchema.parse(req.body);
    if (patch.section) {
      const before = ctx.settings.get().trading212.accounts.map((a) => a.id);
      ctx.settings.updateSection(patch.section, patch.value);
      if (patch.section === 'trading212') {
        // Drop the credentials of removed Trading 212 accounts.
        const after = new Set(ctx.settings.get().trading212.accounts.map((a) => a.id));
        for (const id of before) if (!after.has(id)) ctx.settings.deleteSecretsWithPrefix(`trading212.${id}.`);
      }
    }
    if (patch.secrets) ctx.settings.setSecrets(patch.secrets as Partial<Record<SecretKey, string | null>>);
    return response();
  });

  /** Settings without secrets, for backup or moving to another instance. */
  app.get('/api/settings/export', async (_req, reply) => {
    reply.header('Content-Disposition', 'attachment; filename="wheresmymoney-settings.json"');
    return { app: 'WheresMyMoney!', version: 2, exportedAt: new Date().toISOString(), settings: ctx.settings.get() };
  });

  app.post('/api/settings/import', async (req) => {
    const body = z.object({ settings: z.unknown() }).parse(req.body);
    const imported = settingsSchema.parse(body.settings);
    // Keep Trading 212 accounts (their credentials are not part of exports).
    ctx.settings.replace({ ...imported, trading212: ctx.settings.get().trading212 });
    return response();
  });

  // -------------------------------------------------------------------------
  // Connection tests. Values typed in the form (not yet saved) take precedence.
  // -------------------------------------------------------------------------

  app.post('/api/settings/test/firefly', async (req): Promise<ConnectionTestResult> => {
    const body = fireflyTestSchema.parse(req.body ?? {});
    const url = body.url || ctx.settings.get().firefly.url;
    const token = body.token || ctx.settings.getSecret('firefly.token');
    if (!url || !token) return { ok: false, message: 'not_configured' };
    try {
      const client = new FireflyClient(url, token);
      const about = await client.about();
      const accounts = await client.fetchAssetAccounts();
      return { ok: true, message: 'connected', details: { version: about.version, accounts: accounts.length } };
    } catch (err) {
      return failure(err);
    }
  });

  app.post<{ Params: { id: string } }>(
    '/api/settings/test/trading212/:id',
    async (req): Promise<ConnectionTestResult> => {
      const body = t212TestSchema.parse(req.body ?? {});
      const account = ctx.settings.get().trading212.accounts.find((a) => a.id === req.params.id);
      const apiKey = body.apiKey || ctx.settings.getSecret(`trading212.${req.params.id}.apiKey` as SecretKey);
      const apiSecret = body.apiSecret || ctx.settings.getSecret(`trading212.${req.params.id}.apiSecret` as SecretKey);
      if (!apiKey || !apiSecret) return { ok: false, message: 'not_configured' };
      try {
        await testTrading212({
          id: req.params.id,
          name: account?.name ?? '',
          env: body.env ?? account?.env ?? 'live',
          apiKey,
          apiSecret,
        });
        return { ok: true, message: 'connected' };
      } catch (err) {
        return failure(err);
      }
    },
  );

  app.post('/api/settings/test/email', async (): Promise<ConnectionTestResult> => {
    if (!ctx.reports.emailConfigured()) return { ok: false, message: 'not_configured' };
    try {
      await ctx.reports.sendTestEmail();
      return { ok: true, message: 'sent' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });

  // -------------------------------------------------------------------------
  // Pickers fed from Firefly / the last sync
  // -------------------------------------------------------------------------

  app.get('/api/firefly/tags', async (_req, reply) => {
    try {
      return { tags: await ctx.sync.firefly().fetchTags() };
    } catch (err) {
      return reply.code(502).send({ success: false, error: failure(err).message });
    }
  });

  app.get('/api/accounts', async () => ({
    accounts: ctx.sync.knownAccounts(),
    rules: ctx.settings.get().accounts.rules,
  }));
}
