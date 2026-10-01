import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createContext } from '../src/bootstrap';
import type { AppContext } from '../src/context';
import { openMemoryDatabase } from '../src/db';
import type { BootEnv } from '../src/env';
import { MOCK_TOKEN, startMockFirefly } from './mock-firefly';

const silent = pino({ level: 'silent' });

function bootEnv(): BootEnv {
  return {
    port: 0,
    host: '127.0.0.1',
    dataDir: path.join(os.tmpdir(), 'wmm-test-unused'),
    secretKey: 'test-secret-key-at-least-16-chars',
    trustProxy: false,
    logLevel: 'silent',
    webDir: path.join(os.tmpdir(), 'wmm-no-web'),
    isProduction: false,
  };
}

async function makeApp(processEnv: NodeJS.ProcessEnv = {}) {
  const ctx = await createContext(bootEnv(), openMemoryDatabase(), silent, processEnv);
  const app = await buildApp(ctx);
  return { ctx, app };
}

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'];
  const first = Array.isArray(raw) ? raw[0] : (raw as string);
  return first.split(';')[0];
};

describe('first-run setup', () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  beforeAll(async () => ({ app, ctx } = await makeApp()));
  afterAll(() => app.close());

  it('blocks the API until setup is done', async () => {
    const status = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(status.json()).toMatchObject({ setupRequired: true });
    const stats = await app.inject({ method: 'GET', url: '/api/statistics' });
    expect(stats.statusCode).toBe(409);
  });

  it('requires the setup code printed in the logs', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: 'WRONG123', password: 'a-long-password' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('completes setup, logs in with a cookie and enforces CSRF', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: ctx.setup.code, password: 'a-long-password', timezone: 'Europe/Athens' },
    });
    expect(res.statusCode).toBe(200);
    const cookie = cookieOf(res);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(res.headers['set-cookie'])).toMatch(/SameSite=Strict/i);
    expect(ctx.settings.get().general.timezone).toBe('Europe/Athens');

    const get = await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } });
    expect(get.statusCode).toBe(200);

    const patch = { section: 'planning', value: { ...get.json().settings.planning, horizonYears: 25 } };
    const noCsrf = await app.inject({ method: 'PATCH', url: '/api/settings', headers: { cookie }, payload: patch });
    expect(noCsrf.statusCode).toBe(403);
    const ok = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie, 'x-requested-with': 'wmm' },
      payload: patch,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().settings.planning.horizonYears).toBe(25);
  });

  it('cannot be run twice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: 'ANYTHING', password: 'another-long-password' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('v1 compatibility and security (imported .env)', () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  let mock: Awaited<ReturnType<typeof startMockFirefly>>;
  let token: string;

  beforeAll(async () => {
    mock = await startMockFirefly();
    ({ app, ctx } = await makeApp({
      FIREFLY_API_URL: mock.url,
      FIREFLY_TOKEN: MOCK_TOKEN,
      APP_PASSWORD: 'legacy-pass',
      COMPANY_TAG: 'Acme',
      START_DATE: '2024-01-01',
      VAT_EXPENSE_TAG: 'Εφορια,ΦΠΑ',
      IGNORE_FIREFLY_ACCOUNTS: 'Old Wallet',
      SMTP_PASS: 'smtp-secret-value',
      TZ: 'Europe/Athens',
    }));
  });
  afterAll(async () => {
    await app.close();
    await mock.close();
  });

  it('imports v1 settings, keeps the v1 password and encrypts secrets at rest', async () => {
    const s = ctx.settings.get();
    expect(s.firefly.url).toBe(mock.url);
    expect(s.tax.module).toBe('gr_oe');
    expect(s.tax.grOe.companyTag).toBe('Acme');
    expect(s.accounts.rules['Old Wallet']).toEqual({ include: false });
    expect(ctx.passwords.isSet()).toBe(true);
    expect(ctx.setup.code).toBeNull();

    const raw = ctx.db.prepare('SELECT data FROM secrets').all() as { data: Buffer }[];
    for (const r of raw) {
      expect(r.data.toString('utf8')).not.toContain(MOCK_TOKEN);
      expect(r.data.toString('utf8')).not.toContain('smtp-secret-value');
    }
  });

  it('rejects unauthenticated and wrong-password requests like v1', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/statistics' })).statusCode).toBe(401);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'nope' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ success: false, error: 'Invalid password' });
  });

  it('POST /api/auth/login returns a bearer token (TimologioPlus flow)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'legacy-pass' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    token = body.token;
  });

  it('returns 503 with the v1 message before the first sync', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/statistics', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ success: false, retryAfter: 5 });
  });

  it('POST /api/statistics/recalculate syncs and returns fresh statistics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/statistics/recalculate',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { success, data } = res.json();
    expect(success).toBe(true);
    // Fields read by TimologioPlus
    expect(data.tax).toMatchObject({ enabled: true });
    for (const k of ['grossRevenue', 'companyExpenses', 'netTaxableProfit', 'expectedTaxTotal', 'effectiveTaxRate', 'description']) {
      expect(data.tax).toHaveProperty(k);
    }
    for (const k of ['collected', 'paid', 'total', 'paidToGovt', 'remaining']) expect(data.tax.vatLiability).toHaveProperty(k);
    expect(data.tax.revenue).toHaveProperty('vat');
    expect(data.tax.expenses).toHaveProperty('gross');
    expect(Array.isArray(data.tax.breakdown)).toBe(true);
    expect(data.yearOverYear.currentYear).toBe(new Date().getFullYear());
    expect(data.monthOverMonth).toHaveProperty('expensesCurrentMonth');
    expect(data.meta).toHaveProperty('currentYear');
    // Ignored account is excluded
    expect(data.assets.accounts.map((a: { name: string }) => a.name)).not.toContain('Old Wallet');
  });

  it('GET /api/statistics?year= keeps v1 validation and semantics', async () => {
    const auth = { authorization: `Bearer ${token}` };
    expect((await app.inject({ method: 'GET', url: '/api/statistics?year=20x5', headers: auth })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/statistics?year=1999', headers: auth })).statusCode).toBe(404);

    await ctx.sync.start('rebuild-history').done;
    const res = await app.inject({ method: 'GET', url: '/api/statistics?year=2025', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.meta.currentYear).toBe(2025);
    expect(res.json().data._cachedAt).toBe('2025-12-31');
  });

  it('serves v1 history paths and rejects arbitrary ones', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const ok = await app.inject({
      method: 'GET',
      url: '/api/statistics/history?metricPath=assets.netWorthEur&start=2024-01-01&end=2030-01-01',
      headers: auth,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.length).toBeGreaterThan(12);
    const cat = await app.inject({
      method: 'GET',
      url: `/api/statistics/history?metricPath=${encodeURIComponent('categories.expenses[?(@.name=="Housing")].monthlyMean')}&start=2024-01-01&end=2030-01-01`,
      headers: auth,
    });
    expect(cat.json().data.at(-1).value).toBeGreaterThan(0);
    const bad = await app.inject({
      method: 'GET',
      url: `/api/statistics/history?metricPath=${encodeURIComponent("$') FROM x --")}&start=2024-01-01&end=2030-01-01`,
      headers: auth,
    });
    expect(bad.statusCode).toBe(400);
  });

  it('never returns secret values', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings', headers: { authorization: `Bearer ${token}` } });
    const text = res.body;
    expect(text).not.toContain(MOCK_TOKEN);
    expect(text).not.toContain('smtp-secret-value');
    expect(res.json().secrets['firefly.token']).toMatchObject({ set: true });
  });

  it('sends no CORS headers and sets a strict CSP', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/status',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(String(res.headers['content-security-policy'])).toContain("default-src 'self'");
  });

  it('generates a PDF report', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/report/pdf', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produces data-health checks after a sync', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/data', headers: { authorization: `Bearer ${token}` } });
    const ids = res.json().checks.map((c: { id: string }) => c.id);
    expect(ids).toContain('uncategorized');
    expect(ids).toContain('company_tag_usage');
    expect(ids).toContain('advance_tax_account');
  });

  it('rate-limits password guessing', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: `guess-${i}` } })).statusCode;
    }
    expect(last).toBe(429);
  });
});
