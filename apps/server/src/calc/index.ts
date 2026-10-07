import { type Settings, type StatisticsPayload, project } from '@wmm/shared';
import type { FireflyAccount, FireflyTransactionGroup } from '../sources/firefly';
import { calculateTax } from '../tax';
import { type InputAccount, accountName, buildAssets, buildIgnoredSet } from './accounts';
import { type AverageWindow, categoryStats, rollingCategoryStats } from './categories';
import { periodSummaries, periodWindows } from './periods';
import { cashflowVatFn } from './vat';
import {
  DAYS_IN_MONTH,
  type Journal,
  groupBy,
  median,
  monthKey,
  monthRange,
  normalizeTransactions,
  sumAmounts,
} from './util';

export const PAYLOAD_SCHEMA_VERSION = 2;

export interface CalcInput {
  transactions: FireflyTransactionGroup[];
  /** Firefly asset accounts plus pre-mapped external (e.g. Trading 212) accounts. */
  assetAccounts: InputAccount[];
  liabilityAccounts: FireflyAccount[];
  eurRates: Map<string, number>;
  now: Date;
  settings: Settings;
  approximations?: string[];
}

export interface CalcOutput {
  payload: StatisticsPayload;
  /** Journals the payload was computed from (used by the data-health checks). */
  journals: Journal[];
}

/** Parses the configured start date the way v1 did (UTC midnight). */
export function parseStartDate(s: string) {
  return new Date(s);
}

export function calculate(input: CalcInput): CalcOutput {
  const { settings, now, eurRates } = input;
  const startDate = parseStartDate(settings.general.startDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const previousYear = currentYear - 1;

  // -------------------------------------------------------------------------
  // 0. Ignored accounts & journal filtering
  // -------------------------------------------------------------------------
  const ignored = buildIgnoredSet(settings.accounts.rules, [...input.assetAccounts, ...input.liabilityAccounts]);
  const isIgnored = (name: string | null | undefined) => !!name && ignored.has(name.toLowerCase());

  // Bound by "now" so backfilled snapshots only see the past; drop ignored accounts.
  const allJournals = normalizeTransactions(input.transactions).filter(
    (j) => j.date <= now && !isIgnored(j.sourceName) && !isIgnored(j.destinationName),
  );
  const journals = allJournals.filter((j) => j.date >= startDate && j.type !== 'transfer');
  const expenses = journals.filter((j) => j.type === 'withdrawal');
  const income = journals.filter((j) => j.type === 'deposit');

  // -------------------------------------------------------------------------
  // 1. Averaging window (optionally excluding the current, incomplete month)
  // -------------------------------------------------------------------------
  const allMonths = monthRange(startDate, now);
  const currentMonthKey = monthKey(now);
  const prevMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const excludeCurrent = settings.general.excludeCurrentMonthFromAverages && allMonths.length > 1;
  const avgMonths = excludeCurrent ? allMonths.filter((m) => m !== currentMonthKey) : allMonths;
  const window: AverageWindow = {
    months: avgMonths,
    previousMonths: avgMonths.slice(0, -1),
    currentMonthKey,
    prevMonthKey,
  };
  const avgSet = new Set(avgMonths);
  const inAvg = (j: Journal) => avgSet.has(monthKey(j.date));
  const totalMonths = avgMonths.length;
  const previousTotalMonths = Math.max(1, totalMonths - 1);
  const lastAvgMonth = avgMonths[avgMonths.length - 1];

  // -------------------------------------------------------------------------
  // 2. Means & medians
  // -------------------------------------------------------------------------
  const totalExpenses = sumAmounts(expenses);
  const totalIncome = sumAmounts(income);
  const avgExpenses = excludeCurrent ? sumAmounts(expenses.filter(inAvg)) : totalExpenses;
  const avgIncome = excludeCurrent ? sumAmounts(income.filter(inAvg)) : totalIncome;

  const meanMonthlyExpenses = totalMonths > 0 ? avgExpenses / totalMonths : 0;
  const meanMonthlyIncome = totalMonths > 0 ? avgIncome / totalMonths : 0;
  const meanMonthlySurplus = meanMonthlyIncome - meanMonthlyExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const expensesByMonth = groupBy(expenses, (j) => monthKey(j.date));
  const incomeByMonth = groupBy(income, (j) => monthKey(j.date));
  const monthExpenses = (m: string) => sumAmounts(expensesByMonth[m] ?? []);
  const monthIncome = (m: string) => sumAmounts(incomeByMonth[m] ?? []);

  const previousMeanMonthlyExpenses = (avgExpenses - monthExpenses(lastAvgMonth)) / previousTotalMonths;
  const previousMeanMonthlyIncome = (avgIncome - monthIncome(lastAvgMonth)) / previousTotalMonths;

  const surplusOf = (m: string) => monthIncome(m) - monthExpenses(m);

  // -------------------------------------------------------------------------
  // 3. Rolling 90/180-day averages up to the last complete day
  // -------------------------------------------------------------------------
  const lastCompleteDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  const daysAgo = (n: number) => {
    const d = new Date(lastCompleteDay);
    d.setDate(d.getDate() - n);
    return d;
  };
  const d90 = daysAgo(90);
  const d180 = daysAgo(180);
  const within = (from: Date) => (j: Journal) => j.date > from && j.date <= lastCompleteDay;
  const expenses90d = expenses.filter(within(d90));
  const income90d = income.filter(within(d90));
  const rolling90DayExpenses = (sumAmounts(expenses90d) / 90) * DAYS_IN_MONTH;
  const rolling90DayIncome = (sumAmounts(income90d) / 90) * DAYS_IN_MONTH;
  const rolling180DayExpenses = (sumAmounts(expenses.filter(within(d180))) / 180) * DAYS_IN_MONTH;
  const rolling180DayIncome = (sumAmounts(income.filter(within(d180))) / 180) * DAYS_IN_MONTH;

  // -------------------------------------------------------------------------
  // 4. This year vs previous year (v1 semantics — part of the public API)
  // -------------------------------------------------------------------------
  const ofYear = (xs: Journal[], y: number) => sumAmounts(xs.filter((j) => j.date.getFullYear() === y));
  const thisYearIncome = ofYear(income, currentYear);
  const thisYearExpenses = ofYear(expenses, currentYear);
  const prevYearIncome = ofYear(income, previousYear);
  const prevYearExpenses = ofYear(expenses, previousYear);
  const thisYearSurplus = thisYearIncome - thisYearExpenses;
  const prevYearSurplus = prevYearIncome - prevYearExpenses;
  const projectedIncome = (thisYearIncome / currentMonth) * 12;
  const projectedExpenses = (thisYearExpenses / currentMonth) * 12;
  const projectedSurplus = projectedIncome - projectedExpenses;
  const surplusDiff = projectedSurplus - prevYearSurplus;

  // -------------------------------------------------------------------------
  // 5. Tax
  // -------------------------------------------------------------------------
  const tax = calculateTax(
    { allJournals, liabilityAccounts: input.liabilityAccounts, currentYear, previousYear },
    settings.tax,
  );

  const startOfYear = new Date(currentYear, 0, 1);
  const daysPassed = Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / 86_400_000));
  const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;
  const netAnnualIncome = tax.enabled
    ? ((tax.netTaxableProfit - tax.expectedTaxTotal) / daysPassed) * (isLeap ? 366 : 365)
    : 0;

  // -------------------------------------------------------------------------
  // 6. Categories
  // -------------------------------------------------------------------------
  const vatOf = cashflowVatFn(settings.tax);
  const categoryExpenses = categoryStats(expenses, window, vatOf);
  const categoryIncome = categoryStats(income, window, vatOf);
  const categoryExpenses90d = rollingCategoryStats(expenses90d, 90);
  const categoryIncome90d = rollingCategoryStats(income90d, 90);

  // -------------------------------------------------------------------------
  // 7. Assets, runway, projections
  // -------------------------------------------------------------------------
  const assets = buildAssets(
    input.assetAccounts,
    input.liabilityAccounts,
    eurRates,
    settings.accounts.rules,
    ignored,
  );
  const currentInvested = assets.totalInvestedEur;
  const currentCash = assets.totalEur - currentInvested;

  const runwayBasis = rolling90DayExpenses > 0 ? rolling90DayExpenses : meanMonthlyExpenses;
  const p = settings.planning;
  const projections = project({
    currentInvested,
    currentCash,
    meanMonthlySurplus,
    annualExpenses: runwayBasis * 12,
    safeWithdrawalRate: p.safeWithdrawalRate,
    investmentGrowthRate: p.investmentGrowthRate,
    monthlyInvestmentAmount: p.monthlyInvestmentAmount,
    targetAssetGoal: p.targetAssetGoal,
    horizonYears: p.horizonYears,
    startYear: currentYear,
  });

  // -------------------------------------------------------------------------
  // 8. Periods (v2)
  // -------------------------------------------------------------------------
  const avgEndMonth = lastAvgMonth ?? currentMonthKey;
  const [ey, em] = avgEndMonth.split('-').map(Number);
  const avgEnd =
    avgEndMonth === currentMonthKey ? now : new Date(ey, em, 0, 23, 59, 59, 999); // last day of that month
  const periods = periodSummaries(income, expenses, periodWindows(now, startDate, totalMonths, avgEnd), vatOf);

  const payload: StatisticsPayload = {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    summary: {
      meanMonthlyExpenses,
      meanMonthlyIncome,
      meanMonthlySurplus,
      medianMonthlyExpenses: median(avgMonths.map(monthExpenses)),
      medianMonthlyIncome: median(avgMonths.map(monthIncome)),
      medianMonthlySurplus: median(avgMonths.map(surplusOf)),
      previousMeanMonthlyExpenses,
      previousMeanMonthlyIncome,
      previousMeanMonthlySurplus: previousMeanMonthlyIncome - previousMeanMonthlyExpenses,
      previousMedianMonthlyExpenses: median(window.previousMonths.map(monthExpenses)),
      previousMedianMonthlyIncome: median(window.previousMonths.map(monthIncome)),
      previousMedianMonthlySurplus: median(window.previousMonths.map(surplusOf)),
      savingsRate,
      totalMonths,
      rolling90DayExpenses,
      rolling90DayIncome,
      rolling90DaySurplus: rolling90DayIncome - rolling90DayExpenses,
      rolling180DayExpenses,
      rolling180DayIncome,
    },
    surplus: {
      thisYear: thisYearSurplus,
      projectedThisYear: projectedSurplus,
      previousYear: prevYearSurplus,
      difference: surplusDiff,
      growthPercent: prevYearSurplus !== 0 ? (surplusDiff / Math.abs(prevYearSurplus)) * 100 : null,
    },
    yearOverYear: {
      incomeThisYear: thisYearIncome,
      projectedIncomeThisYear: projectedIncome,
      incomePreviousYear: prevYearIncome,
      incomeGrowthPercent: prevYearIncome > 0 ? ((projectedIncome - prevYearIncome) / prevYearIncome) * 100 : null,
      expensesThisYear: thisYearExpenses,
      projectedExpensesThisYear: projectedExpenses,
      expensesPreviousYear: prevYearExpenses,
      expensesGrowthPercent:
        prevYearExpenses > 0 ? ((projectedExpenses - prevYearExpenses) / prevYearExpenses) * 100 : null,
      currentYear,
      previousYear,
    },
    monthOverMonth: {
      expensesCurrentMonth: monthExpenses(currentMonthKey),
      incomeCurrentMonth: monthIncome(currentMonthKey),
      expensesPreviousMonth: monthExpenses(prevMonthKey),
      currentMonthName: currentMonthKey,
      previousMonthName: prevMonthKey,
    },
    tax,
    netMonthlyIncome: { projected: netAnnualIncome, monthly: netAnnualIncome / 12, currentMonth },
    assets,
    categories: {
      expenses: categoryExpenses,
      income: categoryIncome,
      topExpense: categoryExpenses[0] ?? null,
      expenses90d: categoryExpenses90d,
      income90d: categoryIncome90d,
      topExpense90d: categoryExpenses90d[0] ?? null,
    },
    monthlyData: allMonths.map((m) => ({
      month: m,
      income: monthIncome(m),
      expenses: monthExpenses(m),
      surplus: monthIncome(m) - monthExpenses(m),
    })),
    runway: {
      months: runwayBasis > 0 ? assets.totalEur / runwayBasis : null,
      liquidMonths: runwayBasis > 0 ? currentCash / runwayBasis : null,
      totalAssetsEur: assets.totalEur,
      totalCashEur: currentCash,
      basisExpenses: runwayBasis,
    },
    projections,
    periods,
    meta: {
      lastUpdated: now.toISOString(),
      dataStartDate: settings.general.startDate,
      currentMonth,
      currentYear,
      totalMonths,
      approximations: input.approximations ?? [],
      excludeCurrentMonthFromAverages: excludeCurrent,
      ...(vatOf ? { cashflowVat: settings.tax.cashflowVat.scope as 'company' | 'all' } : {}),
    },
  };

  return { payload, journals: allJournals };
}

export { accountName };
