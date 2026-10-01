import type { AccountKind, AccountStat, Broker } from '@wmm/shared';
import { UpstreamError } from './http';

/**
 * A position or cash balance reported by a broker, in the currency the broker
 * reports it in. The sync service converts it to EUR with the run's FX rates.
 */
export interface BrokerHolding {
  /** Stable id, e.g. "etoro_0_AAPL" or "ibkr_0_cash_USD". */
  id: string;
  name: string;
  ticker?: string;
  kind: AccountKind;
  /** Number of units for positions; the amount for cash. */
  units: number;
  /** Market value in `currency`. */
  value: number;
  currency: string;
  source: Broker;
}

export interface BrokerResult {
  holdings: BrokerHolding[];
  errors: { account: string; reason: string }[];
}

export const BROKER_LABEL: Record<Broker, string> = {
  trading212: 'Trading212',
  etoro: 'eToro',
  ibkr: 'IBKR',
};

/** "Apple (eToro - Main)" — the suffix lets the UI group and the holdings list strip it again. */
export function holdingName(name: string, broker: Broker, accountLabel: string) {
  return `${name} (${BROKER_LABEL[broker]}${accountLabel ? ` - ${accountLabel}` : ''})`;
}

export const BROKER_SUFFIX_RE = / \((Trading212|eToro|IBKR)\b.*\)$/;

export function errorReason(err: unknown): string {
  return err instanceof UpstreamError ? err.reason : 'unreachable';
}

/** Converts broker holdings to EUR asset accounts (missing rates fall back to 1, flagged by the health check). */
export function toAccountStats(holdings: BrokerHolding[], eurRates: Map<string, number>): AccountStat[] {
  return holdings.map((h) => {
    const currency = h.currency.toUpperCase();
    const rate = currency === 'EUR' ? 1 : (eurRates.get(currency) ?? 1);
    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      type: 'asset',
      currency: 'EUR',
      balance: h.units,
      balanceEur: h.value * rate,
      exchangeRate: rate,
      kind: h.kind,
      source: h.source,
    };
  });
}
