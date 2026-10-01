/**
 * Allow-list of metrics that can be charted over time from stored snapshots.
 * The history API only accepts these ids (or a category metric), never a raw
 * JSON path from the client.
 */
export type MetricFormat = 'currency' | 'percent' | 'months';

export interface MetricDef {
  path: string;
  format: MetricFormat;
  /** true when a decrease is good (expenses) */
  invert?: boolean;
}

export const METRICS = {
  netWorth: { path: '$.assets.netWorthEur', format: 'currency' },
  totalAssets: { path: '$.assets.totalEur', format: 'currency' },
  totalLiabilities: { path: '$.assets.totalLiabilitiesEur', format: 'currency', invert: true },
  totalInvested: { path: '$.assets.totalInvestedEur', format: 'currency' },
  cash: { path: '$.runway.totalCashEur', format: 'currency' },
  meanMonthlyIncome: { path: '$.summary.meanMonthlyIncome', format: 'currency' },
  meanMonthlyExpenses: { path: '$.summary.meanMonthlyExpenses', format: 'currency', invert: true },
  meanMonthlySurplus: { path: '$.summary.meanMonthlySurplus', format: 'currency' },
  medianMonthlyIncome: { path: '$.summary.medianMonthlyIncome', format: 'currency' },
  medianMonthlyExpenses: { path: '$.summary.medianMonthlyExpenses', format: 'currency', invert: true },
  medianMonthlySurplus: { path: '$.summary.medianMonthlySurplus', format: 'currency' },
  rolling90DayIncome: { path: '$.summary.rolling90DayIncome', format: 'currency' },
  rolling90DayExpenses: { path: '$.summary.rolling90DayExpenses', format: 'currency', invert: true },
  rolling90DaySurplus: { path: '$.summary.rolling90DaySurplus', format: 'currency' },
  savingsRate: { path: '$.summary.savingsRate', format: 'percent' },
  runwayMonths: { path: '$.runway.months', format: 'months' },
  liquidRunwayMonths: { path: '$.runway.liquidMonths', format: 'months' },
  projectedIncome: { path: '$.yearOverYear.projectedIncomeThisYear', format: 'currency' },
  projectedExpenses: { path: '$.yearOverYear.projectedExpensesThisYear', format: 'currency', invert: true },
  projectedSurplus: { path: '$.surplus.projectedThisYear', format: 'currency' },
  netMonthlyIncome: { path: '$.netMonthlyIncome.monthly', format: 'currency' },
  taxRevenueNet: { path: '$.tax.revenue.net', format: 'currency' },
  taxExpensesNet: { path: '$.tax.expenses.net', format: 'currency', invert: true },
  taxableProfit: { path: '$.tax.netTaxableProfit', format: 'currency' },
  expectedTax: { path: '$.tax.expectedTaxTotal', format: 'currency', invert: true },
  vatRemaining: { path: '$.tax.vatLiability.remaining', format: 'currency', invert: true },
} as const satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

export function isMetricId(id: string): id is MetricId {
  return Object.prototype.hasOwnProperty.call(METRICS, id);
}

/** Category metrics are encoded as `category:<expenses|income>:<name>`. */
export function parseCategoryMetric(id: string): { kind: 'expenses' | 'income'; name: string } | null {
  const m = /^category:(expenses|income):(.{1,120})$/.exec(id);
  return m ? { kind: m[1] as 'expenses' | 'income', name: m[2] } : null;
}

export function categoryMetricId(kind: 'expenses' | 'income', name: string): string {
  return `category:${kind}:${name}`;
}
