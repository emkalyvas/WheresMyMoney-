import type { AccountKind, AccountStat, HoldingStat, Settings, StatisticsPayload } from '@wmm/shared';
import type { FireflyAccount } from '../sources/firefly';
import { isFiat } from '../sources/fx';
import { BROKER_SUFFIX_RE } from '../sources/brokers';

export type InputAccount = FireflyAccount | AccountStat;

const isMapped = (a: InputAccount): a is AccountStat => (a as AccountStat).balanceEur !== undefined;

export function accountName(a: InputAccount): string {
  return isMapped(a) ? a.name : (a.attributes?.name ?? '');
}

/**
 * Names (lower-cased) of accounts excluded from all calculations: those disabled
 * in Settings → Accounts plus those with "include in net worth" off in Firefly.
 */
export function buildIgnoredSet(rules: Settings['accounts']['rules'], accounts: InputAccount[]): Set<string> {
  const ignored = new Set(
    Object.entries(rules)
      .filter(([, r]) => r.include === false)
      .map(([name]) => name.toLowerCase()),
  );
  for (const a of accounts) {
    if (!isMapped(a) && a.attributes?.include_net_worth === false && a.attributes.name) {
      ignored.add(a.attributes.name.toLowerCase());
    }
  }
  return ignored;
}

export function defaultKind(a: Pick<AccountStat, 'id' | 'currency' | 'kind'>): AccountKind {
  if (a.kind) return a.kind;
  if (a.id.startsWith('t212_')) return a.id.endsWith('_cash') ? 'cash' : 'investment';
  return isFiat(a.currency) ? 'cash' : 'crypto';
}

function mapAccount(a: InputAccount, fallbackType: string, eurRates: Map<string, number>): AccountStat {
  if (isMapped(a)) {
    return { ...a, source: a.source ?? (a.id.startsWith('t212_') ? 'trading212' : 'firefly') };
  }
  const attrs = a.attributes;
  const currency = attrs.currency_code ?? 'EUR';
  const balance = Number.parseFloat(attrs.current_balance ?? '0');
  const rate = eurRates.get(currency) ?? 1;
  return {
    id: a.id,
    name: attrs.name,
    type: attrs.type ?? fallbackType,
    currency,
    balance,
    balanceEur: balance * rate,
    exchangeRate: rate,
    source: 'firefly',
  };
}

const isInvestedKind = (k: AccountKind | undefined) => k === 'investment' || k === 'crypto';

export function buildAssets(
  assetAccounts: InputAccount[],
  liabilityAccounts: InputAccount[],
  eurRates: Map<string, number>,
  rules: Settings['accounts']['rules'],
  ignored: Set<string>,
): StatisticsPayload['assets'] {
  const ruleByName = new Map(Object.entries(rules).map(([n, r]) => [n.toLowerCase(), r]));
  const keep = (a: InputAccount) => !ignored.has(accountName(a).toLowerCase());

  const accounts = assetAccounts.filter(keep).map((a) => {
    const acc = mapAccount(a, 'asset', eurRates);
    acc.kind = ruleByName.get(acc.name.toLowerCase())?.kind ?? defaultKind(acc);
    return acc;
  });
  const liabilities = liabilityAccounts.filter(keep).map((a) => mapAccount(a, 'liability', eurRates));

  const totalEur = accounts.reduce((s, a) => s + a.balanceEur, 0);
  const totalLiabilitiesEur = liabilities.reduce((s, a) => s + Math.abs(a.balanceEur), 0);
  for (const a of accounts) a.allocationPct = totalEur > 0 ? (a.balanceEur / totalEur) * 100 : 0;

  const byCurrency = (code: string) => accounts.filter((a) => a.currency === code);
  const sum = (xs: AccountStat[], k: 'balance' | 'balanceEur') => xs.reduce((s, a) => s + a[k], 0);

  // Individual broker positions (any broker), grouped by ticker across accounts.
  const stocks = accounts.filter((a) => !!a.source && a.source !== 'firefly' && a.kind === 'investment' && a.ticker);
  const investedStocks = Object.values(
    stocks.reduce<Record<string, HoldingStat>>((acc, a) => {
      const ticker = a.ticker ?? a.name.split(' ')[0];
      acc[ticker] ??= { name: a.name.replace(BROKER_SUFFIX_RE, ''), ticker, balance: 0, balanceEur: 0 };
      acc[ticker].balance += a.balance;
      acc[ticker].balanceEur += a.balanceEur;
      return acc;
    }, {}),
  );

  const cryptoHoldings = Object.values(
    accounts
      .filter((a) => a.kind === 'crypto')
      .reduce<Record<string, HoldingStat>>((acc, a) => {
        // Wallets in Firefly carry the coin as their currency; broker positions are in EUR with a ticker.
        const coin = (a.source && a.source !== 'firefly' && a.ticker ? a.ticker : a.currency).toUpperCase();
        acc[coin] ??= { name: coin, ticker: coin, balance: 0, balanceEur: 0 };
        acc[coin].balance += a.balance;
        acc[coin].balanceEur += a.balanceEur;
        return acc;
      }, {}),
  );

  const byKind: Record<AccountKind, number> = { cash: 0, investment: 0, crypto: 0 };
  for (const a of accounts) byKind[a.kind ?? 'cash'] += a.balanceEur;

  return {
    totalEur,
    totalLiabilitiesEur,
    netWorthEur: totalEur - totalLiabilitiesEur,
    accounts,
    liabilities,
    totalBtc: sum(byCurrency('BTC'), 'balance'),
    totalBtcEur: sum(byCurrency('BTC'), 'balanceEur'),
    totalAda: sum(byCurrency('ADA'), 'balance'),
    totalAdaEur: sum(byCurrency('ADA'), 'balanceEur'),
    totalInvestedEur: accounts.filter((a) => isInvestedKind(a.kind)).reduce((s, a) => s + a.balanceEur, 0),
    investedStocks,
    byKind,
    cryptoHoldings,
  };
}
