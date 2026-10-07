import type { Settings } from '@wmm/shared';
import { vatRateFor } from '../tax/gr-oe';
import { type Journal, foldKey } from './util';

/** VAT contained in a journal's (gross) amount. */
export type VatFn = (j: Journal) => number;

/**
 * VAT for the cash-flow figures, with the same rules as the tax calculation:
 * the no-VAT tag means 0 %, a "<prefix> <rate>" tag sets the rate, otherwise
 * the default rate applies; VAT = gross − gross / (1 + rate).
 *
 * Scope "company" only counts company-tagged transactions; scope "all" counts
 * everything except the excluded categories. Returns null when disabled, so the
 * payload is unchanged.
 */
export function cashflowVatFn(tax: Settings['tax']): VatFn | null {
  const { scope, excludedCategories } = tax.cashflowVat;
  if (scope === 'off') return null;
  const cfg = tax.grOe;
  const excluded = new Set(excludedCategories.map(foldKey));
  return (j) => {
    if (scope === 'company' && (!cfg.companyTag || !j.tags.includes(cfg.companyTag))) return 0;
    if (excluded.has(foldKey(j.category))) return 0;
    const rate = vatRateFor(j.tags, cfg);
    return j.amount - j.amount / (1 + rate / 100);
  };
}

export function sumVat(journals: Journal[], vatOf: VatFn): number {
  return journals.reduce((acc, j) => acc + vatOf(j), 0);
}
