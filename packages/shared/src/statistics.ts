import type { AccountKind } from './settings';

/**
 * The statistics payload served by `GET /api/statistics`.
 *
 * COMPATIBILITY: every v1 field is preserved with the same name and meaning,
 * because external clients (e.g. TimologioPlus) read it. v2 only *adds*
 * fields (marked "v2"). Old snapshots stored by v1 lack the v2 fields, so the
 * UI must treat them as optional.
 */

export interface CategoryStat {
  name: string;
  total: number;
  monthlyMean: number;
  monthlyMedian: number;
  transactionCount: number;
  currentMonthAmount: number;
  previousMonthAmount: number;
  previousMonthlyMean: number;
  previousMonthlyMedian: number;
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null;
}

export interface RollingCategoryStat {
  name: string;
  total: number;
  monthlyMean: number;
  transactionCount: number;
}

export interface TaxBreakdownRow {
  label: string;
  value: number;
  type: 'warning' | 'negative' | 'positive';
  info: string;
  path: string;
  /** v2: stable identifier for i18n */
  key?: string;
}

export interface TaxResult {
  enabled: boolean;
  description?: string;
  grossRevenue: number;
  companyExpenses: number;
  revenue?: { net: number; gross: number; vat: number };
  expenses?: { net: number; gross: number; vat: number };
  vatLiability?: { collected: number; paid: number; total: number; paidToGovt: number; remaining: number };
  netTaxableProfit: number;
  expectedTaxTotal: number;
  effectiveTaxRate: number;
  breakdown?: TaxBreakdownRow[];
  /** v2 */
  module?: string;
  year?: number;
}

export interface AccountStat {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  balanceEur: number;
  exchangeRate: number;
  allocationPct?: number;
  ticker?: string;
  /** v2 */
  kind?: AccountKind;
  /** v2: where the account came from */
  source?: 'firefly' | 'trading212';
}

export interface HoldingStat {
  name: string;
  ticker: string;
  balance: number;
  balanceEur: number;
}

export interface MonthlyDatum {
  month: string;
  income: number;
  expenses: number;
  surplus: number;
}

export const PERIOD_KEYS = ['month', '90d', 'ytd', '12m', 'all'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** v2: per-period cash-flow summary, powering the period picker in the UI. */
export interface PeriodSummary {
  from: string;
  to: string;
  /** Length of the period expressed in months (fractional for day-based periods). */
  months: number;
  income: number;
  expenses: number;
  surplus: number;
  savingsRate: number | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  categories: {
    expenses: PeriodCategory[];
    income: PeriodCategory[];
  };
}

export interface PeriodCategory {
  name: string;
  total: number;
  monthly: number;
  share: number;
  transactionCount: number;
}

export interface StatisticsPayload {
  /** v2. Absent in v1 snapshots. */
  schemaVersion?: number;
  summary: {
    meanMonthlyExpenses: number;
    meanMonthlyIncome: number;
    meanMonthlySurplus: number;
    medianMonthlyExpenses: number;
    medianMonthlyIncome: number;
    medianMonthlySurplus: number;
    previousMeanMonthlyExpenses: number;
    previousMeanMonthlyIncome: number;
    previousMeanMonthlySurplus: number;
    previousMedianMonthlyExpenses: number;
    previousMedianMonthlyIncome: number;
    previousMedianMonthlySurplus: number;
    savingsRate: number;
    totalMonths: number;
    rolling90DayExpenses: number;
    rolling90DayIncome: number;
    rolling90DaySurplus: number;
    rolling180DayExpenses: number;
    rolling180DayIncome: number;
  };
  surplus: {
    thisYear: number;
    projectedThisYear: number;
    previousYear: number;
    difference: number;
    growthPercent: number | null;
  };
  yearOverYear: {
    incomeThisYear: number;
    projectedIncomeThisYear: number;
    incomePreviousYear: number;
    incomeGrowthPercent: number | null;
    expensesThisYear: number;
    projectedExpensesThisYear: number;
    expensesPreviousYear: number;
    expensesGrowthPercent: number | null;
    currentYear: number;
    previousYear: number;
  };
  monthOverMonth: {
    expensesCurrentMonth: number;
    incomeCurrentMonth: number;
    expensesPreviousMonth: number;
    currentMonthName: string;
    previousMonthName: string;
  };
  tax: TaxResult;
  netMonthlyIncome: {
    projected: number;
    monthly: number;
    currentMonth: number;
  };
  assets: {
    totalEur: number;
    totalLiabilitiesEur: number;
    netWorthEur: number;
    accounts: AccountStat[];
    liabilities: AccountStat[];
    totalBtc: number;
    totalBtcEur: number;
    totalAda: number;
    totalAdaEur: number;
    totalInvestedEur: number;
    investedStocks: HoldingStat[];
    /** v2: totals per account kind */
    byKind?: Record<AccountKind, number>;
    /** v2: crypto holdings grouped by currency */
    cryptoHoldings?: HoldingStat[];
  };
  categories: {
    expenses: CategoryStat[];
    income: CategoryStat[];
    topExpense: CategoryStat | null;
    expenses90d: RollingCategoryStat[];
    income90d: RollingCategoryStat[];
    topExpense90d: RollingCategoryStat | null;
  };
  monthlyData: MonthlyDatum[];
  runway: {
    months: number | null;
    liquidMonths: number | null;
    totalAssetsEur: number;
    totalCashEur: number;
    basisExpenses: number;
  };
  projections: {
    data: { year: number; fullSurplusAssets: number; configuredAmountAssets: number }[];
    targetGoal: number;
    retirementTarget: number | null;
    safeAnnualWithdrawal: number;
    safeMonthlyWithdrawal: number;
    investmentGrowthRate: number;
    monthlyInvestmentAmount: number;
    /** v2: inputs needed to recompute what-if projections client-side */
    inputs?: {
      currentInvested: number;
      currentCash: number;
      meanMonthlySurplus: number;
      annualExpenses: number;
      safeWithdrawalRate: number;
      horizonYears: number;
      startYear: number;
    };
    milestones: {
      retirementYearFullSurplus: number | null;
      retirementYearConfiguredAmount: number | null;
      targetYearFullSurplus: number | null;
      targetYearConfiguredAmount: number | null;
    };
  };
  /** v2 */
  periods?: Record<PeriodKey, PeriodSummary>;
  meta: {
    lastUpdated: string;
    dataStartDate: string;
    currentMonth: number;
    currentYear: number;
    totalMonths: number;
    /** v2: things that are estimated rather than exact (e.g. backfilled snapshots) */
    approximations?: string[];
    excludeCurrentMonthFromAverages?: boolean;
  };
  /** Added when served from the cache. */
  _cachedAt?: string;
}
