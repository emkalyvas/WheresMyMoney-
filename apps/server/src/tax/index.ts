import type { Settings, TaxResult } from '@wmm/shared';
import type { Journal } from '../calc/util';
import type { FireflyAccount } from '../sources/firefly';
import { calculateGrOe } from './gr-oe';

export interface TaxContext {
  /** Journals bounded by "now", excluding ignored accounts; includes transfers and pre-start-date rows. */
  allJournals: Journal[];
  liabilityAccounts: FireflyAccount[];
  currentYear: number;
  previousYear: number;
}

export const DISABLED_TAX: TaxResult = {
  enabled: false,
  grossRevenue: 0,
  companyExpenses: 0,
  netTaxableProfit: 0,
  expectedTaxTotal: 0,
  effectiveTaxRate: 0,
};

/** Registry of tax modules. Add new modules here and to TAX_MODULES in @wmm/shared. */
export function calculateTax(ctx: TaxContext, tax: Settings['tax']): TaxResult {
  switch (tax.module) {
    case 'gr_oe':
      return calculateGrOe(ctx, tax.grOe);
    default:
      return { ...DISABLED_TAX };
  }
}
