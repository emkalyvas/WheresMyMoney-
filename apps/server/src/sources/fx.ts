import type { Settings } from '@wmm/shared';
import { fetchJson } from './http';

const FIAT = new Set(Intl.supportedValuesOf('currency').map((c) => c.toUpperCase()));

export function isFiat(code: string) {
  return FIAT.has(code.toUpperCase());
}

export interface FxResult {
  /** currency → EUR multiplier */
  rates: Map<string, number>;
  /** currencies with no rate from any provider (last known rate used when available) */
  missing: string[];
  /** currencies resolved from the last known stored rate */
  stale: string[];
}

/**
 * Resolves EUR conversion rates for the given currencies. Fiat rates come from a
 * single request per sync (not one per currency); crypto from Binance tickers.
 * When a provider fails, the last known rate is reused instead of defaulting to 1.
 */
export async function resolveEurRates(
  currencies: string[],
  fx: Settings['fx'],
  lastKnown: Record<string, number>,
): Promise<FxResult> {
  const wanted = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c && c !== 'EUR'))];
  const rates = new Map<string, number>();
  if (wanted.length === 0) return { rates, missing: [], stale: [] };

  const fiat = wanted.filter(isFiat);
  const crypto = wanted.filter((c) => !isFiat(c));

  if (fiat.length && fx.fiatProvider === 'open-er-api') {
    try {
      const res = await fetchJson<{ rates?: Record<string, number> }>('fx', 'https://open.er-api.com/v6/latest/EUR', {
        timeoutMs: 8_000,
      });
      for (const c of fiat) {
        const perEur = res.rates?.[c];
        if (perEur && perEur > 0) rates.set(c, 1 / perEur);
      }
    } catch {
      /* fall through to last known */
    }
  }

  if (crypto.length && fx.cryptoProvider === 'binance') {
    await Promise.all(
      crypto.map(async (c) => {
        try {
          const res = await fetchJson<{ price?: string }>(
            'fx',
            `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(`${c}EUR`)}`,
            { timeoutMs: 8_000 },
          );
          const price = Number.parseFloat(res.price ?? '');
          if (price > 0) rates.set(c, price);
        } catch {
          /* fall through */
        }
      }),
    );
  }

  const missing: string[] = [];
  const stale: string[] = [];
  for (const c of wanted) {
    if (rates.has(c)) continue;
    if (lastKnown[c]) {
      rates.set(c, lastKnown[c]);
      stale.push(c);
    } else {
      missing.push(c);
    }
  }
  return { rates, missing, stale };
}
