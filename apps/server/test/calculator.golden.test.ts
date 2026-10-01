import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculate } from '../src/calc';
import { buildSyntheticFirefly, expectSuperset, syntheticSettings } from './helpers';

/**
 * The golden files were produced by the v1 calculator (see fixtures/make-golden.cjs).
 * v2 must reproduce every v1 field, because external clients read them.
 */
const CASES = ['mid-year', 'early-january', 'month-end-backfill'];

describe('calculator matches v1 output', () => {
  for (const name of CASES) {
    it(name, () => {
      const golden = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, `fixtures/golden-${name}.json`), 'utf8'));
      const data = buildSyntheticFirefly({ until: golden.until });
      const { payload } = calculate({
        transactions: data.transactions,
        assetAccounts: [...data.assets, ...data.externalAssets],
        liabilityAccounts: data.liabilities,
        eurRates: new Map(Object.entries(data.eurRates)),
        now: new Date(golden.now),
        settings: syntheticSettings(),
      });
      expect(expectSuperset(payload, golden.output)).toEqual([]);
    });
  }
});

describe('excluding the current month from averages', () => {
  it('averages only complete months', () => {
    const data = buildSyntheticFirefly({ until: '2026-09' });
    const input = {
      transactions: data.transactions,
      assetAccounts: [...data.assets, ...data.externalAssets],
      liabilityAccounts: data.liabilities,
      eurRates: new Map(Object.entries(data.eurRates)),
      now: new Date(2026, 8, 15, 10),
    };
    const v1 = calculate({ ...input, settings: syntheticSettings() }).payload;
    const v2 = calculate({ ...input, settings: syntheticSettings({ excludeCurrentMonthFromAverages: true }) }).payload;

    expect(v2.summary.totalMonths).toBe(v1.summary.totalMonths - 1);
    const complete = v1.monthlyData.slice(0, -1);
    const expectedMean = complete.reduce((s, m) => s + m.expenses, 0) / complete.length;
    expect(v2.summary.meanMonthlyExpenses).toBeCloseTo(expectedMean, 6);
    // Values that external clients read are unaffected by this option
    expect(v2.tax).toEqual(v1.tax);
    expect(v2.yearOverYear).toEqual(v1.yearOverYear);
  });
});
