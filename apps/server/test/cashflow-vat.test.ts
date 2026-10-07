import { describe, expect, it } from 'vitest';
import { type Settings, settingsSchema } from '@wmm/shared';
import { calculate } from '../src/calc';
import { buildSyntheticFirefly, syntheticSettings } from './helpers';

const data = buildSyntheticFirefly({ until: '2026-09' });
const run = (cashflowVat: Partial<Settings['tax']['cashflowVat']>) => {
  const base = syntheticSettings();
  const settings = settingsSchema.parse({ ...base, tax: { ...base.tax, cashflowVat: { ...base.tax.cashflowVat, ...cashflowVat } } });
  return calculate({
    transactions: data.transactions,
    assetAccounts: [...data.assets, ...data.externalAssets],
    liabilityAccounts: data.liabilities,
    eurRates: new Map(Object.entries(data.eurRates)),
    now: new Date(2026, 8, 15, 10),
    settings,
  }).payload;
};

describe('VAT in the cash flow', () => {
  it('adds nothing to the payload when disabled', () => {
    const p = run({ scope: 'off' });
    const cashflow = JSON.stringify({ categories: p.categories, periods: p.periods });
    expect(cashflow).not.toContain('"vat"');
    expect(cashflow).not.toContain('incomeVat');
    expect(p.meta.cashflowVat).toBeUndefined();
  });

  it('company scope matches the VAT of the tax calculation', () => {
    const p = run({ scope: 'company' });
    expect(p.meta.cashflowVat).toBe('company');
    // Year to date = the tax year so far
    expect(p.periods!.ytd.incomeVat).toBeCloseTo(p.tax.revenue!.vat, 6);
    expect(p.periods!.ytd.expensesVat).toBeCloseTo(p.tax.expenses!.vat, 6);
    // Categories add up to the period totals
    const ytd = p.periods!.ytd;
    expect(ytd.categories.expenses.reduce((s, c) => s + (c.vat ?? 0), 0)).toBeCloseTo(ytd.expensesVat!, 6);
    // Personal categories carry no VAT in company scope
    expect(p.categories.expenses.find((c) => c.name === 'Groceries')?.vat).toBe(0);
    expect(p.categories.income.find((c) => c.name === 'Consulting')!.vat).toBeGreaterThan(0);
  });

  it('all scope applies the default rate except in excluded categories', () => {
    const p = run({ scope: 'all', excludedCategories: ['housing', 'Salary'] }); // matching ignores case
    const groceries = p.categories.expenses.find((c) => c.name === 'Groceries')!;
    expect(groceries.vat).toBeCloseTo(groceries.total - groceries.total / 1.24, 6);
    expect(p.categories.expenses.find((c) => c.name === 'Housing')!.vat).toBe(0);
    expect(p.categories.income.find((c) => c.name === 'Salary')!.vat).toBe(0);
    // Company transactions still use their VAT tags (ΦΠΑ 13, No VAT); Consulting is all company income, so both scopes agree
    const consulting = (s: 'company' | 'all') => run({ scope: s }).categories.income.find((c) => c.name === 'Consulting')!.vat!;
    expect(consulting('all')).toBeCloseTo(consulting('company'), 6);
  });
});
