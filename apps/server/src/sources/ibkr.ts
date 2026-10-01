import { XMLParser } from 'fast-xml-parser';
import type { IbkrAccount } from '@wmm/shared';
import { type BrokerHolding, type BrokerResult, errorReason, holdingName } from './brokers';
import { UpstreamError, fetchText } from './http';

/**
 * Interactive Brokers via the read-only Flex Web Service: a token plus an
 * Activity Flex Query (XML). No gateway or 2FA. Statements are end-of-day and
 * take a few seconds to generate, so results are cached between syncs.
 * Protocol and error codes as verified in the ToTheMoon! project.
 */
export const FLEX_BASE =
  (process.env.NODE_ENV !== 'production' && process.env.WMM_DEV_IBKR_URL) ||
  'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';

/** Statement being generated, service busy, rate limited: try again shortly. */
const RETRYABLE = new Set([1001, 1004, 1005, 1006, 1007, 1008, 1009, 1018, 1019, 1021]);
/** Token invalid/expired, IP restriction, inactive account. */
const AUTH = new Set([1011, 1012, 1013, 1015, 1016]);

export interface IbkrCredentials extends IbkrAccount {
  token: string;
}

export interface FlexPosition {
  symbol: string;
  description: string;
  assetCategory: string;
  currency: string;
  conid: string;
  position: number;
  positionValue: number;
}

export interface FlexStatement {
  accountId: string;
  baseCurrency: string;
  toDate: string | null;
  positions: FlexPosition[];
  cash: Record<string, number>;
  nav: { date: string; total: number; cash: number | null }[];
  sections: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) =>
    ['FlexStatement', 'OpenPosition', 'CashReportCurrency', 'EquitySummaryByReportDateInBase'].includes(name),
});

function parseXml(xml: string): Record<string, unknown> {
  // Flex responses never declare a DTD; refusing one rules out entity-expansion tricks.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new UpstreamError('ibkr', 'bad_response');
  try {
    return parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new UpstreamError('ibkr', 'bad_response');
  }
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '' || v === '--' || v === 'N/A') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const ymd = (v: unknown): string | null => {
  const s = String(v ?? '').split(/[;T ,]/)[0];
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

export interface FlexStatus {
  status: string;
  reference: string | null;
  url: string | null;
  code: number;
  message: string;
}

/** The SendRequest/GetStatement status envelope, or null when the body is a statement. */
export function parseFlexStatus(xml: string): FlexStatus | null {
  const doc = parseXml(xml);
  const r = doc.FlexStatementResponse as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    status: String(r.Status ?? '').trim(),
    reference: r.ReferenceCode ? String(r.ReferenceCode).trim() : null,
    url: r.Url ? String(r.Url).trim() : null,
    code: Number(r.ErrorCode ?? 0) || 0,
    message: String(r.ErrorMessage ?? '').trim(),
  };
}

export function parseFlexStatements(xml: string): FlexStatement[] {
  const doc = parseXml(xml);
  const root = doc.FlexQueryResponse as Record<string, unknown> | undefined;
  const list = ((root?.FlexStatements as Record<string, unknown> | undefined)?.FlexStatement ?? []) as Record<string, unknown>[];
  if (!root || list.length === 0) throw new UpstreamError('ibkr', 'invalid_config');

  return list.map((st) => {
    const info = (st.AccountInformation ?? {}) as Record<string, string>;
    const base = String(info.currency || st.currency || 'USD').toUpperCase();
    const rowsOf = (section: string, row: string) =>
      (((st[section] as Record<string, unknown> | undefined)?.[row] ?? []) as Record<string, string>[]);

    const allPositions = rowsOf('OpenPositions', 'OpenPosition');
    const summary = allPositions.filter((p) => (p.levelOfDetail ?? 'SUMMARY').toUpperCase() === 'SUMMARY');
    const positions = (summary.length ? summary : allPositions)
      .map((p) => ({
        symbol: String(p.symbol ?? p.underlyingSymbol ?? '?').split(' ')[0],
        description: String(p.description ?? p.symbol ?? ''),
        assetCategory: String(p.assetCategory ?? 'STK').toUpperCase(),
        currency: String(p.currency ?? base).toUpperCase(),
        conid: String(p.conid ?? ''),
        position: num(p.position) ?? 0,
        positionValue: num(p.positionValue) ?? (num(p.position) ?? 0) * (num(p.markPrice) ?? 0) * (num(p.multiplier) ?? 1),
      }))
      .filter((p) => p.position !== 0);

    const cash: Record<string, number> = {};
    for (const c of rowsOf('CashReport', 'CashReportCurrency')) {
      const ccy = String(c.currency ?? '').toUpperCase();
      if (!ccy || ccy === 'BASE_SUMMARY' || String(c.levelOfDetail ?? '').toUpperCase() === 'BASECURRENCY') continue;
      const ending = num(c.endingCash);
      if (ending !== null) cash[ccy] = ending;
    }

    const nav = rowsOf('EquitySummaryInBase', 'EquitySummaryByReportDateInBase')
      .map((e) => ({ date: ymd(e.reportDate), total: num(e.total), cash: num(e.cash) }))
      .filter((e): e is { date: string; total: number; cash: number | null } => !!e.date && e.total !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      accountId: String(st.accountId || info.accountId || 'IBKR'),
      baseCurrency: base,
      toDate: ymd(st.toDate),
      positions,
      cash,
      nav,
      sections: Object.keys(st).filter((k) => typeof st[k] === 'object'),
    };
  });
}

export function flexToHoldings(statements: FlexStatement[], account: { index: number; name: string }): BrokerHolding[] {
  const out: BrokerHolding[] = [];
  const multi = statements.length > 1;
  for (const s of statements) {
    const prefix = `ibkr_${account.index}_${multi ? `${s.accountId}_` : ''}`;
    const label = [account.name, multi ? s.accountId : ''].filter(Boolean).join(' ');
    for (const p of s.positions) {
      out.push({
        id: `${prefix}${p.conid || p.symbol}`,
        name: holdingName(p.description || p.symbol, 'ibkr', label),
        ticker: p.symbol,
        kind: p.assetCategory === 'CRYPTO' ? 'crypto' : 'investment',
        units: p.position,
        value: p.positionValue,
        currency: p.currency,
        source: 'ibkr',
      });
    }
    const cash = Object.keys(s.cash).length
      ? s.cash
      : s.nav.at(-1)?.cash != null
        ? { [s.baseCurrency]: s.nav.at(-1)!.cash as number }
        : {};
    for (const [ccy, amount] of Object.entries(cash)) {
      if (amount === 0) continue;
      out.push({
        id: `${prefix}cash_${ccy}`,
        name: holdingName(`Cash ${ccy}`, 'ibkr', label),
        kind: 'cash',
        units: amount,
        value: amount,
        currency: ccy,
        source: 'ibkr',
      });
    }
  }
  return out;
}

export interface FlexOptions {
  base?: string;
  pollMs?: number;
  maxWaitMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusError(st: FlexStatus): UpstreamError {
  if (RETRYABLE.has(st.code)) return new UpstreamError('ibkr', 'not_ready');
  if (AUTH.has(st.code)) return new UpstreamError('ibkr', 'unauthorized');
  return new UpstreamError('ibkr', 'invalid_config');
}

/** SendRequest → poll GetStatement until the statement is ready. */
export async function fetchFlexStatement(token: string, queryId: string, opts: FlexOptions = {}): Promise<string> {
  const base = opts.base ?? FLEX_BASE;
  const pollMs = opts.pollMs ?? 5_000;
  const maxWaitMs = opts.maxWaitMs ?? 120_000;
  // IBKR rejects requests without a User-Agent.
  const init = { headers: { 'User-Agent': 'WheresMyMoney/2', Accept: 'application/xml' }, timeoutMs: 30_000 };

  let st: FlexStatus | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await fetchText('ibkr', `${base}/SendRequest?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`, init);
    st = parseFlexStatus(body);
    if (st && st.status.toLowerCase() === 'success' && st.reference) break;
    if (st && RETRYABLE.has(st.code) && attempt < 2) {
      await sleep(pollMs * (attempt + 2));
      continue;
    }
    throw st ? statusError(st) : new UpstreamError('ibkr', 'bad_response');
  }
  const url = st?.url || `${base}/GetStatement`;
  const ref = st!.reference!;

  const started = Date.now();
  let delay = pollMs;
  for (;;) {
    await sleep(delay);
    const body = await fetchText('ibkr', `${url}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(ref)}&v=3`, init);
    const status = parseFlexStatus(body);
    if (!status) return body;
    if (RETRYABLE.has(status.code) && Date.now() - started < maxWaitMs) {
      delay = Math.min(20_000, delay * 1.5);
      continue;
    }
    throw statusError(status);
  }
}

export interface IbkrCacheEntry {
  fetchedAt: string;
  queryId: string;
  holdings: BrokerHolding[];
}

export interface IbkrCache {
  get(id: string): IbkrCacheEntry | undefined;
  set(id: string, entry: IbkrCacheEntry): void;
}

export async function testIbkr(c: IbkrCredentials, opts: FlexOptions = {}) {
  const xml = await fetchFlexStatement(c.token, c.queryId, { maxWaitMs: 90_000, ...opts });
  const statements = parseFlexStatements(xml);
  const wanted = ['OpenPositions', 'CashReport', 'EquitySummaryInBase'];
  return {
    accounts: statements.length,
    positions: statements.reduce((s, x) => s + x.positions.length, 0),
    missingSections: [...new Set(statements.flatMap((s) => wanted.filter((w) => !s.sections.includes(w))))],
  };
}

/**
 * Holdings for every IBKR account. A statement is fetched only when the cached
 * one is older than the account's refresh interval; when IBKR is unavailable
 * the last statement is used and the error is reported.
 */
export async function fetchIbkr(
  accounts: IbkrCredentials[],
  cache: IbkrCache,
  opts: FlexOptions & { now?: Date; force?: boolean } = {},
): Promise<BrokerResult> {
  const errors: BrokerResult['errors'] = [];
  const now = opts.now ?? new Date();
  const results = await Promise.all(
    accounts.map(async (account, index) => {
      if (!account.token || !account.queryId) return [];
      const label = account.name || (accounts.length > 1 ? `#${index + 1}` : '');
      const cached = cache.get(account.id);
      const fresh =
        cached &&
        cached.queryId === account.queryId &&
        now.getTime() - Date.parse(cached.fetchedAt) < account.refreshHours * 3_600_000;
      if (fresh && !opts.force) return cached.holdings;
      try {
        const xml = await fetchFlexStatement(account.token, account.queryId, opts);
        const holdings = flexToHoldings(parseFlexStatements(xml), { index, name: label });
        cache.set(account.id, { fetchedAt: now.toISOString(), queryId: account.queryId, holdings });
        return holdings;
      } catch (err) {
        errors.push({ account: `IBKR · ${account.name || `#${index + 1}`}`, reason: errorReason(err) });
        return cached?.queryId === account.queryId ? cached.holdings : [];
      }
    }),
  );
  return { holdings: results.flat(), errors };
}
