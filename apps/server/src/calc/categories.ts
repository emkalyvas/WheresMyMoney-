import type { CategoryStat, RollingCategoryStat } from '@wmm/shared';
import { DAYS_IN_MONTH, type Journal, groupBy, median, monthKey, sumAmounts } from './util';
import { type VatFn, sumVat } from './vat';

export interface AverageWindow {
  /** Months used for means/medians (all months, or only complete ones). */
  months: string[];
  /** Same window minus its last month: the "previous" comparison basis. */
  previousMonths: string[];
  currentMonthKey: string;
  prevMonthKey: string;
}

function rankMap(byCategory: Record<string, Journal[]>): Record<string, number> {
  return Object.entries(byCategory)
    .map(([name, txs]) => ({ name, total: sumAmounts(txs) }))
    .sort((a, b) => b.total - a.total)
    .reduce<Record<string, number>>((acc, item, index) => {
      acc[item.name] = index + 1;
      return acc;
    }, {});
}

/** All-time per-category statistics with month-over-month rank movement. */
export function categoryStats(journals: Journal[], w: AverageWindow, vatOf: VatFn | null = null): CategoryStat[] {
  const byCategory = groupBy(journals, (j) => j.category);
  const current = groupBy(
    journals.filter((j) => monthKey(j.date) === w.currentMonthKey),
    (j) => j.category,
  );
  const previous = groupBy(
    journals.filter((j) => monthKey(j.date) === w.prevMonthKey),
    (j) => j.category,
  );
  const currentRanks = rankMap(current);
  const previousRanks = rankMap(previous);

  const avgSet = new Set(w.months);
  const lastAvgMonth = w.months[w.months.length - 1];
  const nMonths = w.months.length;
  const nPrevious = Math.max(1, nMonths - 1);

  return Object.entries(byCategory)
    .map(([name, txs]) => {
      const total = sumAmounts(txs);
      const currentMonthAmount = sumAmounts(current[name] ?? []);
      const previousMonthAmount = sumAmounts(previous[name] ?? []);
      const currentRank = currentRanks[name] ?? null;
      const previousRank = previousRanks[name] ?? null;
      const rankChange = currentRank && previousRank ? previousRank - currentRank : null;

      const byMonth = groupBy(txs, (j) => monthKey(j.date));
      // When averaging over all months this equals the plain total (v1 behaviour).
      const windowTotal = sumAmounts(txs.filter((j) => avgSet.has(monthKey(j.date))));
      const lastMonthAmount = sumAmounts(byMonth[lastAvgMonth] ?? []);

      return {
        name,
        total,
        monthlyMean: nMonths > 0 ? windowTotal / nMonths : 0,
        monthlyMedian: median(w.months.map((m) => sumAmounts(byMonth[m] ?? []))),
        transactionCount: txs.length,
        currentMonthAmount,
        previousMonthAmount,
        previousMonthlyMean: (windowTotal - lastMonthAmount) / nPrevious,
        previousMonthlyMedian: median(w.previousMonths.map((m) => sumAmounts(byMonth[m] ?? []))),
        currentRank,
        previousRank,
        rankChange,
        ...(vatOf ? { vat: sumVat(txs, vatOf) } : {}),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Per-category totals over a trailing window of `days`, expressed per month. */
export function rollingCategoryStats(journals: Journal[], days: number): RollingCategoryStat[] {
  return Object.entries(groupBy(journals, (j) => j.category))
    .map(([name, txs]) => {
      const total = sumAmounts(txs);
      return { name, total, monthlyMean: (total / days) * DAYS_IN_MONTH, transactionCount: txs.length };
    })
    .sort((a, b) => b.total - a.total);
}
