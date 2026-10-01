import crypto from 'node:crypto';
import type { EtoroAccount } from '@wmm/shared';
import { type BrokerHolding, type BrokerResult, errorReason, holdingName } from './brokers';
import { fetchJson } from './http';

/**
 * eToro via its official public API (read-only key pair). Endpoints and fields
 * as verified in the ToTheMoon! project against eToro's OpenAPI definition.
 * Accounts are USD-denominated; every purchase is a separate position, so
 * positions are aggregated per instrument.
 */
export const ETORO_BASE =
  (process.env.NODE_ENV !== 'production' && process.env.WMM_DEV_ETORO_URL) || 'https://public-api.etoro.com/api/v1';

export interface EtoroCredentials extends EtoroAccount {
  apiKey: string;
  userKey: string;
}

interface EtoroPosition {
  positionID?: number;
  instrumentID: number;
  isBuy?: boolean;
  leverage?: number;
  units?: number;
  amount?: number;
  unrealizedPnL?: { pnL?: number };
}

interface EtoroPortfolio {
  credit?: number;
  positions?: EtoroPosition[];
  mirrors?: { availableAmount?: number; positions?: EtoroPosition[] }[];
}

interface InstrumentInfo {
  instrumentID: number;
  instrumentDisplayName?: string;
  instrumentTypeID?: number;
  symbolFull?: string;
}

const CRYPTO_TYPE = 10;

function client(c: EtoroCredentials, base: string) {
  return <T,>(path: string) =>
    fetchJson<T>('etoro', `${base}${path}`, {
      headers: {
        'x-api-key': c.apiKey,
        'x-user-key': c.userKey,
        'x-request-id': crypto.randomUUID(),
        Accept: 'application/json',
      },
      timeoutMs: 15_000,
    });
}

async function portfolio(c: EtoroCredentials, base: string): Promise<EtoroPortfolio> {
  const data = await client(c, base)<{ clientPortfolio?: EtoroPortfolio } & EtoroPortfolio>(
    c.env === 'demo' ? '/trading/info/demo/pnl' : '/trading/info/real/pnl',
  );
  return data.clientPortfolio ?? data;
}

async function instruments(c: EtoroCredentials, base: string, ids: number[]) {
  const out = new Map<number, InstrumentInfo>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).join(',');
    const data = await client(c, base)<{ instrumentDisplayDatas?: InstrumentInfo[] }>(
      `/market-data/instruments?instrumentIds=${encodeURIComponent(chunk)}`,
    );
    for (const row of data.instrumentDisplayDatas ?? []) out.set(Number(row.instrumentID), row);
  }
  return out;
}

export async function testEtoro(c: EtoroCredentials, base = ETORO_BASE) {
  const p = await portfolio(c, base);
  return { positions: (p.positions ?? []).length, cash: Number(p.credit ?? 0) };
}

/**
 * Maps a portfolio to holdings (USD):
 *  - unleveraged long positions → one holding per instrument, valued at invested amount + unrealised P/L
 *  - leveraged or short (CFD) positions → a single "CFD positions" holding at their equity
 *  - available cash + copy-trading cash → cash
 */
export function mapEtoroPortfolio(
  p: EtoroPortfolio,
  info: Map<number, InstrumentInfo>,
  account: { index: number; name: string },
): BrokerHolding[] {
  const prefix = `etoro_${account.index}_`;
  const label = account.name;
  const positions = [...(p.positions ?? []), ...(p.mirrors ?? []).flatMap((m) => m.positions ?? [])];

  const agg = new Map<number, { units: number; value: number }>();
  let cfd = 0;
  for (const pos of positions) {
    const equity = Number(pos.amount ?? 0) + Number(pos.unrealizedPnL?.pnL ?? 0);
    if (pos.isBuy === false || Number(pos.leverage ?? 1) !== 1) {
      cfd += equity;
      continue;
    }
    const a = agg.get(pos.instrumentID) ?? { units: 0, value: 0 };
    a.units += Number(pos.units ?? 0);
    a.value += equity;
    agg.set(pos.instrumentID, a);
  }

  const out: BrokerHolding[] = [];
  for (const [id, a] of agg) {
    if (a.units <= 0) continue;
    const i = info.get(id);
    const symbol = (i?.symbolFull ?? `ETORO${id}`).toUpperCase();
    const isCrypto = i?.instrumentTypeID === CRYPTO_TYPE;
    const ticker = isCrypto && symbol.endsWith('USD') && symbol.length > 3 ? symbol.slice(0, -3) : symbol.split('.')[0];
    out.push({
      id: `${prefix}${symbol}`,
      name: holdingName(i?.instrumentDisplayName ?? symbol, 'etoro', label),
      ticker,
      kind: isCrypto ? 'crypto' : 'investment',
      units: a.units,
      value: a.value,
      currency: 'USD',
      source: 'etoro',
    });
  }
  if (cfd !== 0) {
    out.push({ id: `${prefix}cfd`, name: holdingName('CFD positions', 'etoro', label), kind: 'investment', units: 1, value: cfd, currency: 'USD', source: 'etoro' });
  }
  const cash = Number(p.credit ?? 0) + (p.mirrors ?? []).reduce((s, m) => s + Number(m.availableAmount ?? 0), 0);
  if (cash > 0) {
    out.push({ id: `${prefix}cash`, name: holdingName('Available cash', 'etoro', label), kind: 'cash', units: cash, value: cash, currency: 'USD', source: 'etoro' });
  }
  return out;
}

export async function fetchEtoro(accounts: EtoroCredentials[], base = ETORO_BASE): Promise<BrokerResult> {
  const errors: BrokerResult['errors'] = [];
  const results = await Promise.all(
    accounts.map(async (account, index) => {
      if (!account.apiKey || !account.userKey) return [];
      const label = account.name || (accounts.length > 1 ? `#${index + 1}` : '');
      try {
        const p = await portfolio(account, base);
        const ids = [
          ...new Set([...(p.positions ?? []), ...(p.mirrors ?? []).flatMap((m) => m.positions ?? [])].map((x) => x.instrumentID)),
        ];
        const info = ids.length ? await instruments(account, base, ids).catch(() => new Map<number, InstrumentInfo>()) : new Map();
        return mapEtoroPortfolio(p, info, { index, name: label });
      } catch (err) {
        errors.push({ account: `eToro · ${account.name || `#${index + 1}`}`, reason: errorReason(err) });
        return [];
      }
    }),
  );
  return { holdings: results.flat(), errors };
}
