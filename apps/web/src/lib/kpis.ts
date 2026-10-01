import type { MetricId, PeriodKey, StatisticsPayload } from '@wmm/shared';
import type { Method } from './view';

export interface PeriodKpis {
  income: number;
  expenses: number;
  surplus: number;
  savingsRate: number | null;
  previousIncome?: number;
  previousExpenses?: number;
  incomeMetric?: MetricId;
  expensesMetric?: MetricId;
  surplusMetric?: MetricId;
  /** the period actually used (old snapshots fall back to "all") */
  period: PeriodKey;
}

/** Monthly income/spending for the selected period and averaging method. */
export function periodKpis(data: StatisticsPayload, period: PeriodKey, method: Method): PeriodKpis {
  const s = data.summary;
  const rate = (inc: number, exp: number) => (inc > 0 ? ((inc - exp) / inc) * 100 : null);

  if (period === '90d') {
    return {
      income: s.rolling90DayIncome,
      expenses: s.rolling90DayExpenses,
      surplus: s.rolling90DaySurplus,
      savingsRate: data.periods?.['90d'].savingsRate ?? rate(s.rolling90DayIncome, s.rolling90DayExpenses),
      incomeMetric: 'rolling90DayIncome',
      expensesMetric: 'rolling90DayExpenses',
      surplusMetric: 'rolling90DaySurplus',
      period,
    };
  }
  if (period !== 'all' && data.periods) {
    const p = data.periods[period];
    return {
      income: p.monthlyIncome,
      expenses: p.monthlyExpenses,
      surplus: p.monthlyIncome - p.monthlyExpenses,
      savingsRate: p.savingsRate,
      period,
    };
  }
  if (method === 'median') {
    return {
      income: s.medianMonthlyIncome,
      expenses: s.medianMonthlyExpenses,
      surplus: s.medianMonthlySurplus,
      savingsRate: rate(s.medianMonthlyIncome, s.medianMonthlyExpenses),
      previousIncome: s.previousMedianMonthlyIncome,
      previousExpenses: s.previousMedianMonthlyExpenses,
      incomeMetric: 'medianMonthlyIncome',
      expensesMetric: 'medianMonthlyExpenses',
      surplusMetric: 'medianMonthlySurplus',
      period: 'all',
    };
  }
  return {
    income: s.meanMonthlyIncome,
    expenses: s.meanMonthlyExpenses,
    surplus: s.meanMonthlySurplus,
    savingsRate: s.savingsRate,
    previousIncome: s.previousMeanMonthlyIncome,
    previousExpenses: s.previousMeanMonthlyExpenses,
    incomeMetric: 'meanMonthlyIncome',
    expensesMetric: 'meanMonthlyExpenses',
    surplusMetric: 'meanMonthlySurplus',
    period: 'all',
  };
}

/** Totals per account kind (v1 snapshots lack `byKind`). */
export function byKind(data: StatisticsPayload) {
  if (data.assets.byKind) return data.assets.byKind;
  const invested = data.assets.totalInvestedEur;
  return { cash: data.assets.totalEur - invested, investment: invested, crypto: 0 };
}
