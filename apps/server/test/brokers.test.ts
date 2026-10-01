import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toAccountStats } from '../src/sources/brokers';
import { fetchEtoro, mapEtoroPortfolio } from '../src/sources/etoro';
import {
  type IbkrCacheEntry,
  fetchFlexStatement,
  fetchIbkr,
  flexToHoldings,
  parseFlexStatements,
  parseFlexStatus,
} from '../src/sources/ibkr';
import { UpstreamError } from '../src/sources/http';

const FLEX_XML = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/ibkr-flex.xml'), 'utf8');
const status = (body: string) => `<FlexStatementResponse timestamp="x">${body}</FlexStatementResponse>`;

/** Tiny programmable HTTP server: handler(pathname, req) → [status, body]. */
async function server(handler: (url: URL, req: http.IncomingMessage) => [number, string, string?]) {
  const hits: string[] = [];
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    hits.push(url.pathname);
    const [code, body, type] = handler(url, req);
    res.writeHead(code, { 'Content-Type': type ?? 'application/xml' });
    res.end(body);
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { base, hits, close: () => new Promise<void>((r) => srv.close(() => r())) };
}

describe('IBKR Flex parsing', () => {
  it('reads positions (summary rows only), cash per currency and NAV', () => {
    const [s] = parseFlexStatements(FLEX_XML);
    expect(s.accountId).toBe('U0000001');
    expect(s.baseCurrency).toBe('EUR');
    expect(s.positions.map((p) => p.symbol)).toEqual(['VWCE', 'CSPX', 'AAPL']);
    expect(s.positions[1].description).toBe('ISHARES CORE S&P 500');
    expect(s.cash).toEqual({ EUR: 1250.5, USD: 2500 });
    expect(s.nav.at(-1)).toEqual({ date: '2026-09-29', total: 34513, cash: 3496 });
    expect(s.sections).toEqual(expect.arrayContaining(['OpenPositions', 'CashReport', 'EquitySummaryInBase']));
  });

  it('maps a statement to holdings in their own currency', () => {
    const holdings = flexToHoldings(parseFlexStatements(FLEX_XML), { index: 0, name: 'Main' });
    expect(holdings.map((h) => [h.id, h.currency, h.value, h.kind])).toEqual([
      ['ibkr_0_128831206', 'EUR', 15000, 'investment'],
      ['ibkr_0_75776072', 'USD', 8000, 'investment'],
      ['ibkr_0_999', 'USD', 210, 'investment'],
      ['ibkr_0_cash_EUR', 'EUR', 1250.5, 'cash'],
      ['ibkr_0_cash_USD', 'USD', 2500, 'cash'],
    ]);
    expect(holdings[0].name).toBe('VANGUARD FTSE ALL-WORLD UCITS ETF (IBKR - Main)');
  });

  it('parses status envelopes and refuses DTDs', () => {
    expect(parseFlexStatus(status('<Status>Fail</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid.</ErrorMessage>'))).toMatchObject({
      status: 'Fail',
      code: 1015,
    });
    expect(parseFlexStatus(FLEX_XML)).toBeNull();
    expect(() => parseFlexStatus('<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>')).toThrow(UpstreamError);
  });
});

describe('IBKR Flex Web Service flow', () => {
  let srv: Awaited<ReturnType<typeof server>>;
  let pending = 1;
  let token = 'good-token';
  beforeAll(async () => {
    srv = await server((url) => {
      if (url.searchParams.get('t') !== token) {
        return [200, status('<Status>Fail</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid.</ErrorMessage>')];
      }
      if (url.pathname.endsWith('/SendRequest')) {
        if (url.searchParams.get('q') !== '123456') return [200, status('<Status>Fail</Status><ErrorCode>1014</ErrorCode>')];
        return [200, status('<Status>Success</Status><ReferenceCode>0012345678</ReferenceCode>')];
      }
      if (url.pathname.endsWith('/GetStatement')) {
        expect(url.searchParams.get('q')).toBe('0012345678'); // leading zeros preserved
        if (pending-- > 0) return [200, status('<Status>Warn</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress.</ErrorMessage>')];
        return [200, FLEX_XML];
      }
      return [404, ''];
    });
  });
  afterAll(() => srv.close());

  it('requests, polls while the statement is generated, and returns it', async () => {
    pending = 1;
    const xml = await fetchFlexStatement('good-token', '123456', { base: srv.base, pollMs: 5 });
    expect(xml).toContain('FlexQueryResponse');
  });

  it('maps IBKR error codes to reasons', async () => {
    await expect(fetchFlexStatement('bad', '123456', { base: srv.base, pollMs: 5 })).rejects.toMatchObject({ reason: 'unauthorized' });
    await expect(fetchFlexStatement('good-token', '999', { base: srv.base, pollMs: 5 })).rejects.toMatchObject({ reason: 'invalid_config' });
  });

  it('caches statements for the refresh interval and falls back to the cache on errors', async () => {
    const store = new Map<string, IbkrCacheEntry>();
    const cache = { get: (id: string) => store.get(id), set: (id: string, e: IbkrCacheEntry) => void store.set(id, e) };
    const account = { id: 'abc123', name: 'Main', queryId: '123456', refreshHours: 6, token: 'good-token' };
    const opts = { base: srv.base, pollMs: 5 };
    pending = 0;
    srv.hits.length = 0;

    const first = await fetchIbkr([account], cache, { ...opts, now: new Date('2026-10-01T08:00:00Z') });
    expect(first.holdings).toHaveLength(5);
    const calls = srv.hits.length;

    const cached = await fetchIbkr([account], cache, { ...opts, now: new Date('2026-10-01T10:00:00Z') });
    expect(cached.holdings).toHaveLength(5);
    expect(srv.hits.length).toBe(calls); // no request within 6 hours

    token = 'rotated';
    const failed = await fetchIbkr([account], cache, { ...opts, now: new Date('2026-10-01T20:00:00Z') });
    expect(failed.errors).toEqual([{ account: 'IBKR · Main', reason: 'unauthorized' }]);
    expect(failed.holdings).toHaveLength(5); // last known statement
    token = 'good-token';
  });
});

describe('eToro', () => {
  const portfolio = {
    clientPortfolio: {
      credit: 250.5,
      positions: [
        { positionID: 1, instrumentID: 1001, isBuy: true, leverage: 1, units: 2, amount: 300, unrealizedPnL: { pnL: 380 } },
        { positionID: 2, instrumentID: 1001, isBuy: true, leverage: 1, units: 1, amount: 250, unrealizedPnL: { pnL: 90 } },
        { positionID: 3, instrumentID: 100000, isBuy: true, leverage: 1, units: 0.01, amount: 600, unrealizedPnL: { pnL: 238 } },
        { positionID: 4, instrumentID: 1001, isBuy: false, leverage: 5, units: 1, amount: 100, unrealizedPnL: { pnL: -20 } },
      ],
      mirrors: [{ availableAmount: 49.5, positions: [] }],
    },
  };
  const instruments = {
    instrumentDisplayDatas: [
      { instrumentID: 1001, instrumentDisplayName: 'Apple', instrumentTypeID: 5, symbolFull: 'AAPL' },
      { instrumentID: 100000, instrumentDisplayName: 'Bitcoin', instrumentTypeID: 10, symbolFull: 'BTCUSD' },
    ],
  };

  it('aggregates positions per instrument and separates CFDs and cash', () => {
    const info = new Map(instruments.instrumentDisplayDatas.map((i) => [i.instrumentID, i]));
    const h = mapEtoroPortfolio(portfolio.clientPortfolio, info, { index: 0, name: '' });
    expect(h.map((x) => [x.id, x.kind, x.units, x.value])).toEqual([
      ['etoro_0_AAPL', 'investment', 3, 1020],
      ['etoro_0_BTCUSD', 'crypto', 0.01, 838],
      ['etoro_0_cfd', 'investment', 1, 80],
      ['etoro_0_cash', 'cash', 300, 300],
    ]);
    expect(h[0]).toMatchObject({ name: 'Apple (eToro)', ticker: 'AAPL', currency: 'USD' });
    expect(h[1].ticker).toBe('BTC');
  });

  it('sends the key pair and converts USD to EUR', async () => {
    const srv = await server((url, req) => {
      if (req.headers['x-api-key'] !== 'pub' || req.headers['x-user-key'] !== 'usr' || !req.headers['x-request-id']) {
        return [401, '{}', 'application/json'];
      }
      if (url.pathname === '/trading/info/real/pnl') return [200, JSON.stringify(portfolio), 'application/json'];
      if (url.pathname === '/market-data/instruments') return [200, JSON.stringify(instruments), 'application/json'];
      return [404, '{}', 'application/json'];
    });
    try {
      const ok = await fetchEtoro([{ id: 'e1e1e1', name: 'Main', env: 'real', apiKey: 'pub', userKey: 'usr' }], srv.base);
      expect(ok.errors).toEqual([]);
      const stats = toAccountStats(ok.holdings, new Map([['USD', 0.9]]));
      expect(stats.find((s) => s.id === 'etoro_0_AAPL')).toMatchObject({ balanceEur: 1020 * 0.9, exchangeRate: 0.9, source: 'etoro' });

      const bad = await fetchEtoro([{ id: 'e1e1e1', name: 'Main', env: 'real', apiKey: 'wrong', userKey: 'usr' }], srv.base);
      expect(bad).toEqual({ holdings: [], errors: [{ account: 'eToro · Main', reason: 'unauthorized' }] });
    } finally {
      await srv.close();
    }
  });
});

describe('broker holdings in the payload', () => {
  it('merges crypto from wallets and brokers by coin', async () => {
    const { buildAssets } = await import('../src/calc/accounts');
    const wallet = { id: '4', attributes: { name: 'Bitcoin Wallet', type: 'asset', currency_code: 'BTC', current_balance: '0.05' } };
    const broker = toAccountStats(
      [{ id: 'etoro_0_BTCUSD', name: 'Bitcoin (eToro)', ticker: 'BTC', kind: 'crypto', units: 0.01, value: 800, currency: 'USD', source: 'etoro' }],
      new Map([['USD', 0.9]]),
    );
    const assets = buildAssets([wallet, ...broker], [], new Map([['BTC', 60000]]), {}, new Set());
    expect(assets.cryptoHoldings).toHaveLength(1);
    expect(assets.cryptoHoldings?.[0]).toMatchObject({ name: 'BTC', ticker: 'BTC' });
    expect(assets.cryptoHoldings?.[0].balance).toBeCloseTo(0.06, 10);
    expect(assets.cryptoHoldings?.[0].balanceEur).toBeCloseTo(3720, 6);
    expect(assets.byKind?.crypto).toBeCloseTo(3720);
  });
});
