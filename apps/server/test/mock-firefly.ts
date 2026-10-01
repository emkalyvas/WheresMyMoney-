/**
 * A tiny fake Firefly III API serving the synthetic dataset, for integration
 * tests and local development without real financial data.
 *
 *   npm run mock:firefly --workspace @wmm/server      # http://localhost:8089, token "mock-token"
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildSyntheticFirefly } from './fixtures/synthetic.mjs';

export const MOCK_TOKEN = 'mock-token';

export function startMockFirefly(port = 0): Promise<{ url: string; close: () => Promise<void> }> {
  const now = new Date();
  const until = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const data = buildSyntheticFirefly({ until });
  const start = new Date(2024, 0, 1).getTime();

  const tags = [...new Set(data.transactions.flatMap((g: { attributes: { transactions: { tags: string[] }[] } }) => g.attributes.transactions.flatMap((t) => t.tags)))].map(
    (tag, i) => ({ id: String(i + 1), attributes: { tag } }),
  );

  // Balances "as of" a past date grow linearly towards today, so backfilled history looks plausible.
  type MockAccount = { attributes: { current_balance: string } };
  const accountsAt = (list: MockAccount[], date: string | null) => {
    if (!date) return list;
    const progress = Math.min(1, Math.max(0, (Date.parse(date) - start) / (now.getTime() - start)));
    const factor = 0.55 + 0.45 * progress;
    return list.map((a) => ({
      ...a,
      attributes: { ...a.attributes, current_balance: (Number(a.attributes.current_balance) * factor).toFixed(2) },
    }));
  };

  const page = <T,>(items: T[], url: URL) => {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const p = Number(url.searchParams.get('page') ?? 1);
    const total = Math.max(1, Math.ceil(items.length / limit));
    return {
      data: items.slice((p - 1) * limit, p * limit),
      meta: { pagination: { total: items.length, count: limit, per_page: limit, current_page: p, total_pages: total } },
    };
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/vnd.api+json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== `Bearer ${MOCK_TOKEN}`) return send(401, { message: 'Unauthenticated.' });

    switch (url.pathname) {
      case '/api/v1/about':
        return send(200, { data: { version: '6.1.0-mock', api_version: '6.1.0', php_version: '8.3', os: 'mock' } });
      case '/api/v1/accounts': {
        const type = url.searchParams.get('type');
        const date = url.searchParams.get('date');
        const list = type === 'liabilities' ? data.liabilities : data.assets;
        return send(200, page(accountsAt(list, date), url));
      }
      case '/api/v1/transactions': {
        const s = url.searchParams.get('start');
        const e = url.searchParams.get('end');
        const items = data.transactions.filter((g: { attributes: { transactions: { date: string }[] } }) => {
          const d = g.attributes.transactions[0].date.slice(0, 10);
          return (!s || d >= s) && (!e || d <= e);
        });
        return send(200, page(items, url));
      }
      case '/api/v1/tags':
        return send(200, page(tags, url));
      default:
        return send(404, { message: 'Not found' });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MOCK_FIREFLY_PORT ?? 8089);
  const { url } = await startMockFirefly(port);
  console.log(`Mock Firefly III listening on ${url} (token: ${MOCK_TOKEN})`);
}
