import type { AccountStat, Trading212Account } from '@wmm/shared';
import { UpstreamError, fetchJson } from './http';

export interface ExternalAccount extends AccountStat {
  source: 'trading212';
}

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
 * Fetches uninvested cash and open positions for every configured account and
 * maps them to asset accounts. Ids/names follow v1 conventions (`t212_…`,
 * "… (Trading212 - <name>)") so stored history stays comparable.
 */
export async function fetchTrading212Assets(
  accounts: Trading212Credentials[],
): Promise<{ assets: ExternalAccount[]; errors: { account: string; error: UpstreamError }[] }> {
  const errors: { account: string; error: UpstreamError }[] = [];
  const results = await Promise.all(
    accounts.map(async (account, index) => {
      if (!account.apiKey || !account.apiSecret) return [];
      const label = account.name || `#${index + 1}`;
      const url = baseUrl(account.env);
      const h = headers(account);

      const [cash, positions] = await Promise.all([
        fetchJson<CashResponse>('trading212', `${url}/equity/account/cash`, { headers: h, timeoutMs: 10_000 }).catch(
          (e: UpstreamError) => {
            errors.push({ account: label, error: e });
            return null;
          },
        ),
        fetchJson<Position[]>('trading212', `${url}/equity/positions`, { headers: h, timeoutMs: 10_000 }).catch(
          (e: UpstreamError) => {
            errors.push({ account: label, error: e });
            return null;
          },
        ),
      ]);

      const multi = accounts.length > 1;
      const suffix = account.name ? ` - ${account.name}` : multi ? ` (${index + 1})` : '';
      const idPrefix = multi ? `t212_${index}_` : 't212_';
      const out: ExternalAccount[] = [];

      const uninvested = Number.parseFloat(String(cash?.free ?? cash?.total ?? cash?.cash ?? '0'));
      if (uninvested > 0) {
        out.push({
          id: `${idPrefix}cash`,
          name: `Uninvested Cash (Trading212${suffix})`,
          type: 'asset',
          currency: 'EUR',
          balance: uninvested,
          balanceEur: uninvested,
          exchangeRate: 1,
          kind: 'cash',
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
            type: 'asset',
            currency: 'EUR',
            balance: quantity,
            balanceEur: value,
            exchangeRate: 1,
            kind: 'investment',
            source: 'trading212',
          });
        }
      }
      return out;
    }),
  );
  return { assets: results.flat(), errors };
}
