import type { Trading212Account } from '@wmm/shared';
import { type BrokerHolding, type BrokerResult, errorReason } from './brokers';
import { fetchJson } from './http';

export interface Trading212Credentials extends Trading212Account {
  apiKey: string;
  apiSecret: string;
}

interface CashResponse {
  free?: number | string;
  total?: number | string;
  cash?: number | string;
}

interface Position {
  instrument?: { ticker?: string; name?: string };
  ticker?: string;
  quantity?: number | string;
  currentPrice?: number | string;
  currentValue?: number;
  value?: number;
  walletImpact?: { currentValue?: number };
}

function baseUrl(env: 'live' | 'demo') {
  return env === 'live' ? 'https://live.trading212.com/api/v0' : 'https://demo.trading212.com/api/v0';
}

function headers(c: Trading212Credentials) {
  return {
    Authorization: `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64')}`,
    Accept: 'application/json',
  };
}

export async function testTrading212(c: Trading212Credentials) {
  const cash = await fetchJson<CashResponse>('trading212', `${baseUrl(c.env)}/equity/account/cash`, {
    headers: headers(c),
    timeoutMs: 10_000,
  });
  return { cash: Number.parseFloat(String(cash.free ?? cash.total ?? cash.cash ?? 0)) };
}

/**
 * Uninvested cash and open positions for every configured account. Ids and
 * names follow v1 conventions (`t212_…`, "… (Trading212 - <name>)") so stored
 * history and account settings stay valid. Values are reported in EUR.
 */
export async function fetchTrading212(accounts: Trading212Credentials[]): Promise<BrokerResult> {
  const errors: BrokerResult['errors'] = [];
  const results = await Promise.all(
    accounts.map(async (account, index) => {
      if (!account.apiKey || !account.apiSecret) return [];
      const label = account.name || `#${index + 1}`;
      const url = baseUrl(account.env);
      const h = headers(account);
      const get = <T,>(path: string) =>
        fetchJson<T>('trading212', `${url}${path}`, { headers: h, timeoutMs: 10_000 }).catch((e: unknown) => {
          errors.push({ account: `Trading 212 · ${label}`, reason: errorReason(e) });
          return null;
        });

      const [cash, positions] = await Promise.all([get<CashResponse>('/equity/account/cash'), get<Position[]>('/equity/positions')]);

      const multi = accounts.length > 1;
      const suffix = account.name ? ` - ${account.name}` : multi ? ` (${index + 1})` : '';
      const idPrefix = multi ? `t212_${index}_` : 't212_';
      const out: BrokerHolding[] = [];

      const uninvested = Number.parseFloat(String(cash?.free ?? cash?.total ?? cash?.cash ?? '0'));
      if (uninvested > 0) {
        out.push({
          id: `${idPrefix}cash`,
          name: `Uninvested Cash (Trading212${suffix})`,
          kind: 'cash',
          units: uninvested,
          value: uninvested,
          currency: 'EUR',
          source: 'trading212',
        });
      }

      for (const pos of Array.isArray(positions) ? positions : []) {
        const rawTicker = pos.instrument?.ticker ?? pos.ticker ?? 'UNKNOWN';
        const ticker = rawTicker.replace(/_(US_)?EQ$/, '');
        const quantity = Number.parseFloat(String(pos.quantity ?? '0'));
        const price = Number.parseFloat(String(pos.currentPrice ?? '0'));
        const value = pos.walletImpact?.currentValue ?? pos.currentValue ?? pos.value ?? quantity * price;
        if (quantity > 0) {
          out.push({
            id: `${idPrefix}${ticker}`,
            name: `${pos.instrument?.name ?? ticker} (Trading212${suffix})`,
            ticker,
            kind: 'investment',
            units: quantity,
            value,
            currency: 'EUR',
            source: 'trading212',
          });
        }
      }
      return out;
    }),
  );
  return { holdings: results.flat(), errors };
}
