import type { PeriodCategory, PeriodKey, PeriodSummary } from '@wmm/shared';
import { DAYS_IN_MONTH, type Journal, groupBy, localDateKey, sumAmounts } from './util';

const DAY_MS = 24 * 60 * 60 * 1000;

interface PeriodWindow {
  from: Date; // inclusive
  to: Date; // inclusive
  months: number;
}

/**
 * Period windows for the UI's period picker.
 *  - month: the current calendar month so far
 *  - 90d:   the 90 days up to the last complete day (same basis as rolling averages)
 *  - ytd:   1 January → now
 *  - 12m:   the last 12 complete calendar months
 *  - all:   the averaging window (start date → last averaged month)
 */
export function periodWindows(now: Date, startDate: Date, avgMonthsCount: number, avgEnd: Date) {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const lastCompleteDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  const d90 = new Date(lastCompleteDay.getTime() - 90 * DAY_MS + 1);
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const ytdDays = Math.max(1, (now.getTime() - jan1.getTime()) / DAY_MS);

  const windows: Record<PeriodKey, PeriodWindow> = {
    month: { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday, months: 1 },
    '90d': { from: d90, to: lastCompleteDay, months: 90 / DAYS_IN_MONTH },
    ytd: { from: jan1, to: endOfToday, months: ytdDays / DAYS_IN_MONTH },
    '12m': {
      from: new Date(now.getFullYear(), now.getMonth() - 12, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      months: 12,
    },
    all: { from: startDate, to: avgEnd, months: Math.max(1, avgMonthsCount) },
  };
  return windows;
}

function categories(journals: Journal[], months: number, total: number): PeriodCategory[] {
  return Object.entries(groupBy(journals, (j) => j.category))
    .map(([name, txs]) => {
      const t = sumAmounts(txs);
      return {
        name,
        total: t,
        monthly: t / months,
        share: total > 0 ? t / total : 0,
        transactionCount: txs.length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function periodSummaries(
  income: Journal[],
  expenses: Journal[],
  windows: Record<PeriodKey, PeriodWindow>,
): Record<PeriodKey, PeriodSummary> {
  const out = {} as Record<PeriodKey, PeriodSummary>;
  for (const [key, w] of Object.entries(windows) as [PeriodKey, PeriodWindow][]) {
    const inWindow = (j: Journal) => j.date >= w.from && j.date <= w.to;
    const inc = income.filter(inWindow);
    const exp = expenses.filter(inWindow);
    const incomeTotal = sumAmounts(inc);
    const expensesTotal = sumAmounts(exp);
    out[key] = {
      from: localDateKey(w.from),
      to: localDateKey(w.to),
      months: w.months,
      income: incomeTotal,
      expenses: expensesTotal,
      surplus: incomeTotal - expensesTotal,
      savingsRate: incomeTotal > 0 ? ((incomeTotal - expensesTotal) / incomeTotal) * 100 : null,
      monthlyIncome: incomeTotal / w.months,
      monthlyExpenses: expensesTotal / w.months,
      categories: {
        expenses: categories(exp, w.months, expensesTotal),
        income: categories(inc, w.months, incomeTotal),
      },
    };
  }
  return out;
}
