'use strict';

const config = require('../config');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a YYYY-MM string for a given Date. */
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Sums the `amount` property of an array of journal entries. */
function sumAmounts(journals) {
  return journals.reduce((acc, j) => acc + j.amount, 0);
}

function getMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Generates every YYYY-MM key between startDate and endDate (inclusive). */
function monthRange(startDate, endDate) {
  const months = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= end) {
    months.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

/**
 * Flattens Firefly III transaction group objects into individual journal entries.
 * Each group can contain multiple split journals; we flatten them all.
 */
function normalizeTransactions(rawTransactions) {
  const journals = [];
  for (const tx of rawTransactions) {
    for (const journal of tx.attributes?.transactions ?? []) {
      journals.push({
        date: new Date(journal.date),
        type: journal.type, // 'withdrawal' | 'deposit' | 'transfer'
        amount: parseFloat(journal.amount ?? '0'),
        currency: journal.currency_code,
        category: journal.category_name || 'Uncategorized',
        tags: journal.tags ?? [],
        description: journal.description ?? '',
      });
    }
  }
  return journals;
}

/**
 * Groups an array of journals by a string key derived from each journal.
 * @param {Array} journals
 * @param {(j: object) => string} keyFn
 */
function groupBy(journals, keyFn) {
  return journals.reduce((acc, j) => {
    const key = keyFn(j);
    if (!acc[key]) acc[key] = [];
    acc[key].push(j);
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Main calculation function
// ---------------------------------------------------------------------------

/**
 * Computes the full set of economic statistics from raw Firefly III data.
 *
 * @param {Array}  rawTransactions   - Company-tagged transaction groups from Firefly
 * @param {Array}  assetAccounts     - Asset accounts from Firefly
 * @param {Array}  liabilityAccounts - Liability accounts from Firefly
 * @param {Map<string,number>} eurRates - Map of currencyCode -> EUR rate
 * @param {Date}   now               - Current date (injected for testability)
 * @returns {object} Statistics payload
 */
function calculate(rawTransactions, assetAccounts, liabilityAccounts, eurRates, now) {
  const cfg = config.calculations;
  const startDate = new Date(cfg.startDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const previousYear = currentYear - 1;

  // -------------------------------------------------------------------------
  // 1. Normalise & filter transactions
  // -------------------------------------------------------------------------
  const rawAllJournals = normalizeTransactions(rawTransactions);
  
  // CRITICAL: Bound transactions by the 'now' date so backfill snapshots are accurate
  const allJournals = rawAllJournals.filter((j) => j.date <= now);

  const journals = allJournals.filter((j) => j.date >= startDate && j.type !== 'transfer');

  const expenses = journals.filter((j) => j.type === 'withdrawal');
  const income = journals.filter((j) => j.type === 'deposit');

  // Total months elapsed from startDate to now (used for mean calculations)
  const allMonths = monthRange(startDate, now);
  const totalMonths = allMonths.length;

  // -------------------------------------------------------------------------
  // 2. Global means & medians
  // -------------------------------------------------------------------------
  const totalExpenses = sumAmounts(expenses);
  const totalIncome = sumAmounts(income);

  const meanMonthlyExpenses = totalMonths > 0 ? totalExpenses / totalMonths : 0;
  const meanMonthlyIncome = totalMonths > 0 ? totalIncome / totalMonths : 0;
  const meanMonthlySurplus = meanMonthlyIncome - meanMonthlyExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Previous Means
  const previousTotalMonths = Math.max(1, totalMonths - 1);
  const prevMonthDate2 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey2 = monthKey(prevMonthDate2);
  const currentMonthKey2 = monthKey(now);
  
  const expensesByMonthTemp = groupBy(expenses, (j) => monthKey(j.date));
  const incomeByMonthTemp = groupBy(income, (j) => monthKey(j.date));
  
  const currentMonthExpensesTotal = sumAmounts(expensesByMonthTemp[currentMonthKey2] ?? []);
  const currentMonthIncomeTotal = sumAmounts(incomeByMonthTemp[currentMonthKey2] ?? []);

  const previousMeanMonthlyExpenses = previousTotalMonths > 0 ? (totalExpenses - currentMonthExpensesTotal) / previousTotalMonths : 0;
  const previousMeanMonthlyIncome = previousTotalMonths > 0 ? (totalIncome - currentMonthIncomeTotal) / previousTotalMonths : 0;
  const previousMeanMonthlySurplus = previousMeanMonthlyIncome - previousMeanMonthlyExpenses;

  // Global Medians
  const monthlyExpensesArr = allMonths.map(m => sumAmounts(expensesByMonthTemp[m] ?? []));
  const monthlyIncomeArr = allMonths.map(m => sumAmounts(incomeByMonthTemp[m] ?? []));
  const monthlySurplusArr = allMonths.map(m => (sumAmounts(incomeByMonthTemp[m] ?? []) - sumAmounts(expensesByMonthTemp[m] ?? [])));
  
  const medianMonthlyExpenses = getMedian(monthlyExpensesArr);
  const medianMonthlyIncome = getMedian(monthlyIncomeArr);
  const medianMonthlySurplus = getMedian(monthlySurplusArr);

  // Previous Global Medians
  const previousMonths = allMonths.filter(m => m !== currentMonthKey2);
  const previousMonthlyExpensesArr = previousMonths.map(m => sumAmounts(expensesByMonthTemp[m] ?? []));
  const previousMonthlyIncomeArr = previousMonths.map(m => sumAmounts(incomeByMonthTemp[m] ?? []));
  const previousMonthlySurplusArr = previousMonths.map(m => (sumAmounts(incomeByMonthTemp[m] ?? []) - sumAmounts(expensesByMonthTemp[m] ?? [])));

  const previousMedianMonthlyExpenses = getMedian(previousMonthlyExpensesArr);
  const previousMedianMonthlyIncome = getMedian(previousMonthlyIncomeArr);
  const previousMedianMonthlySurplus = getMedian(previousMonthlySurplusArr);

  // -------------------------------------------------------------------------
  // 2b. Rolling Averages (90-day and 180-day up to the last complete day)
  // -------------------------------------------------------------------------
  const lastCompleteDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  
  const days90Ago = new Date(lastCompleteDay);
  days90Ago.setDate(days90Ago.getDate() - 90);
  
  const days180Ago = new Date(lastCompleteDay);
  days180Ago.setDate(days180Ago.getDate() - 180);

  const expenses90d = expenses.filter(j => j.date > days90Ago && j.date <= lastCompleteDay);
  const income90d = income.filter(j => j.date > days90Ago && j.date <= lastCompleteDay);
  const expenses180d = expenses.filter(j => j.date > days180Ago && j.date <= lastCompleteDay);
  const income180d = income.filter(j => j.date > days180Ago && j.date <= lastCompleteDay);

  const daysInMonth = 365 / 12;
  const rolling90DayExpenses = (sumAmounts(expenses90d) / 90) * daysInMonth;
  const rolling90DayIncome = (sumAmounts(income90d) / 90) * daysInMonth;
  const rolling90DaySurplus = rolling90DayIncome - rolling90DayExpenses;
  const rolling180DayExpenses = (sumAmounts(expenses180d) / 180) * daysInMonth;
  const rolling180DayIncome = (sumAmounts(income180d) / 180) * daysInMonth;

  // -------------------------------------------------------------------------
  // 3. Current-year & previous-year stats
  // -------------------------------------------------------------------------
  const thisYearExpenses = expenses.filter((j) => j.date.getFullYear() === currentYear);
  const thisYearIncome = income.filter((j) => j.date.getFullYear() === currentYear);
  const prevYearExpenses = expenses.filter((j) => j.date.getFullYear() === previousYear);
  const prevYearIncome = income.filter((j) => j.date.getFullYear() === previousYear);

  const thisYearTotalExpenses = sumAmounts(thisYearExpenses);
  const thisYearTotalIncome = sumAmounts(thisYearIncome);
  const prevYearTotalExpenses = sumAmounts(prevYearExpenses);
  const prevYearTotalIncome = sumAmounts(prevYearIncome);

  const thisYearSurplus = thisYearTotalIncome - thisYearTotalExpenses;
  const prevYearSurplus = prevYearTotalIncome - prevYearTotalExpenses;
  
  const projectedThisYearIncome = currentMonth > 0 ? (thisYearTotalIncome / currentMonth) * 12 : 0;
  const projectedThisYearExpenses = currentMonth > 0 ? (thisYearTotalExpenses / currentMonth) * 12 : 0;
  const projectedThisYearSurplus = projectedThisYearIncome - projectedThisYearExpenses;

  const surplusDiff = projectedThisYearSurplus - prevYearSurplus;
  const surplusGrowthPct =
    prevYearSurplus !== 0 ? (surplusDiff / Math.abs(prevYearSurplus)) * 100 : null;

  const incomeGrowthPct =
    prevYearTotalIncome > 0
      ? ((projectedThisYearIncome - prevYearTotalIncome) / prevYearTotalIncome) * 100
      : null;
  const expensesGrowthPct =
    prevYearTotalExpenses > 0
      ? ((projectedThisYearExpenses - prevYearTotalExpenses) / prevYearTotalExpenses) * 100
      : null;

  // -------------------------------------------------------------------------
  // 4. Tax calculations (company transactions, current year)
  // -------------------------------------------------------------------------
  const taxModules = require('./taxModules');
  const activeTaxModule = taxModules.getActiveTaxModule();
  
  let tax = { enabled: false, grossRevenue: 0, companyExpenses: 0, netTaxableProfit: 0, expectedTaxTotal: 0, effectiveTaxRate: 0 };
  
  if (activeTaxModule) {
    tax = activeTaxModule.calculate({
      allJournals,
      liabilityAccounts,
      currentYear,
      previousYear,
      config: cfg
    });
  }

  // -------------------------------------------------------------------------
  // 5. Net monthly income (annualised projection based on YTD data)
  // -------------------------------------------------------------------------
  const startOfYear = new Date(currentYear, 0, 1);
  const daysPassed = Math.max(1, Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24)));
  const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
  const daysInYear = isLeapYear ? 366 : 365;

  // Formula: (netTaxableProfit - expectedTaxTotal) / daysPassed * daysInYear
  const netAnnualIncome = tax.enabled 
    ? ((tax.netTaxableProfit - tax.expectedTaxTotal) / daysPassed) * daysInYear
    : 0;

  const netMonthlyIncomeRaw = netAnnualIncome / 12;

  // -------------------------------------------------------------------------
  // 6. Monthly breakdown for chart (all months in range)
  // -------------------------------------------------------------------------
  const expensesByMonth = groupBy(expenses, (j) => monthKey(j.date));
  const incomeByMonth = groupBy(income, (j) => monthKey(j.date));

  const currentMonthKey = monthKey(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = monthKey(prevMonthDate);
  const currentMonthExpenses = sumAmounts(expensesByMonth[currentMonthKey] ?? []);
  const currentMonthIncome = sumAmounts(incomeByMonth[currentMonthKey] ?? []);
  const prevMonthExpenses = sumAmounts(expensesByMonth[prevMonthKey] ?? []);

  const monthlyData = allMonths.map((m) => {
    const monthExpenses = sumAmounts(expensesByMonth[m] ?? []);
    const monthIncome = sumAmounts(incomeByMonth[m] ?? []);
    return {
      month: m,
      income: monthIncome,
      expenses: monthExpenses,
      surplus: monthIncome - monthExpenses,
    };
  });

  // -------------------------------------------------------------------------
  // 7. Category breakdowns
  // -------------------------------------------------------------------------
  const expensesByCategory = groupBy(expenses, (j) => j.category);
  const incomeByCategory = groupBy(income, (j) => j.category);

  const currentMonthExpensesByCategory = groupBy(expenses.filter(j => monthKey(j.date) === currentMonthKey), (j) => j.category);
  const prevMonthExpensesByCategory = groupBy(expenses.filter(j => monthKey(j.date) === prevMonthKey), (j) => j.category);
  const currentMonthIncomeByCategory = groupBy(income.filter(j => monthKey(j.date) === currentMonthKey), (j) => j.category);
  const prevMonthIncomeByCategory = groupBy(income.filter(j => monthKey(j.date) === prevMonthKey), (j) => j.category);

  const getRankMap = (txsByCategory) => {
    return Object.entries(txsByCategory)
      .map(([name, txs]) => ({ name, total: sumAmounts(txs) }))
      .sort((a, b) => b.total - a.total)
      .reduce((acc, item, index) => {
        acc[item.name] = index + 1;
        return acc;
      }, {});
  };

  const currentExpenseRanks = getRankMap(currentMonthExpensesByCategory);
  const prevExpenseRanks = getRankMap(prevMonthExpensesByCategory);
  const currentIncomeRanks = getRankMap(currentMonthIncomeByCategory);
  const prevIncomeRanks = getRankMap(prevMonthIncomeByCategory);

  const categoryExpenses = Object.entries(expensesByCategory)
    .map(([name, txs]) => {
      const currentMonthAmount = sumAmounts(currentMonthExpensesByCategory[name] ?? []);
      const previousMonthAmount = sumAmounts(prevMonthExpensesByCategory[name] ?? []);
      const currentRank = currentExpenseRanks[name] ?? null;
      const previousRank = prevExpenseRanks[name] ?? null;
      let rankChange = null;
      if (currentRank && previousRank) rankChange = previousRank - currentRank; // positive means moved up

      const totalWithoutCurrentMonth = sumAmounts(txs) - currentMonthAmount;
      const previousMonthlyMean = previousTotalMonths > 0 ? totalWithoutCurrentMonth / previousTotalMonths : 0;

      const txsByMonth = groupBy(txs, (j) => monthKey(j.date));
      const monthlyValues = allMonths.map(m => sumAmounts(txsByMonth[m] ?? []));
      const previousMonthlyValues = previousMonths.map(m => sumAmounts(txsByMonth[m] ?? []));

      return {
        name,
        total: sumAmounts(txs),
        monthlyMean: totalMonths > 0 ? sumAmounts(txs) / totalMonths : 0,
        monthlyMedian: getMedian(monthlyValues),
        transactionCount: txs.length,
        currentMonthAmount,
        previousMonthAmount,
        previousMonthlyMean,
        previousMonthlyMedian: getMedian(previousMonthlyValues),
        currentRank,
        previousRank,
        rankChange,
      };
    })
    .sort((a, b) => b.total - a.total);

  const categoryIncome = Object.entries(incomeByCategory)
    .map(([name, txs]) => {
      const currentMonthAmount = sumAmounts(currentMonthIncomeByCategory[name] ?? []);
      const previousMonthAmount = sumAmounts(prevMonthIncomeByCategory[name] ?? []);
      const currentRank = currentIncomeRanks[name] ?? null;
      const previousRank = prevIncomeRanks[name] ?? null;
      let rankChange = null;
      if (currentRank && previousRank) rankChange = previousRank - currentRank; 

      const totalWithoutCurrentMonth = sumAmounts(txs) - currentMonthAmount;
      const previousMonthlyMean = previousTotalMonths > 0 ? totalWithoutCurrentMonth / previousTotalMonths : 0;

      const txsByMonth = groupBy(txs, (j) => monthKey(j.date));
      const monthlyValues = allMonths.map(m => sumAmounts(txsByMonth[m] ?? []));
      const previousMonthlyValues = previousMonths.map(m => sumAmounts(txsByMonth[m] ?? []));

      return {
        name,
        total: sumAmounts(txs),
        monthlyMean: totalMonths > 0 ? sumAmounts(txs) / totalMonths : 0,
        monthlyMedian: getMedian(monthlyValues),
        transactionCount: txs.length,
        currentMonthAmount,
        previousMonthAmount,
        previousMonthlyMean,
        previousMonthlyMedian: getMedian(previousMonthlyValues),
        currentRank,
        previousRank,
        rankChange,
      };
    })
    .sort((a, b) => b.total - a.total);

  const topExpenseCategory = categoryExpenses[0] ?? null;

  const expenses90dByCategory = groupBy(expenses90d, (j) => j.category);
  const income90dByCategory = groupBy(income90d, (j) => j.category);

  const categoryExpenses90d = Object.entries(expenses90dByCategory)
    .map(([name, txs]) => {
      const total = sumAmounts(txs);
      return {
        name,
        total,
        monthlyMean: (total / 90) * daysInMonth,
        transactionCount: txs.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const categoryIncome90d = Object.entries(income90dByCategory)
    .map(([name, txs]) => {
      const total = sumAmounts(txs);
      return {
        name,
        total,
        monthlyMean: (total / 90) * daysInMonth,
        transactionCount: txs.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const topExpenseCategory90d = categoryExpenses90d[0] ?? null;

  // -------------------------------------------------------------------------
  // 8. Assets (all accounts, EUR-converted)
  // -------------------------------------------------------------------------
  function mapAccount(acc, type) {
    if (acc.balanceEur !== undefined) return acc; // Pre-mapped external account
    const attrs = acc.attributes;
    const currency = attrs.currency_code ?? 'EUR';
    const balance = parseFloat(attrs.current_balance ?? '0');
    const rate = eurRates.get(currency) ?? 1;
    const balanceEur = balance * rate;
    return {
      id: acc.id,
      name: attrs.name,
      type: attrs.type ?? type,
      currency,
      balance,
      balanceEur,
      exchangeRate: rate,
    };
  }

  const ignoredNames = new Set(config.firefly.ignoredAccounts.map(n => n.toLowerCase()));
  const isIgnored = (acc) => {
    const name = acc.name || acc.attributes?.name || '';
    return ignoredNames.has(name.toLowerCase());
  };

  const assetList = assetAccounts.filter(a => !isIgnored(a)).map((a) => mapAccount(a, 'asset'));
  const liabilityList = liabilityAccounts.filter(a => !isIgnored(a)).map((a) => mapAccount(a, 'liability'));

  const totalAssetsEur = assetList.reduce((s, a) => s + a.balanceEur, 0);
  const totalLiabilitiesEur = liabilityList.reduce((s, a) => s + Math.abs(a.balanceEur), 0);
  const netWorthEur = totalAssetsEur - totalLiabilitiesEur;

  // Inject allocation percentage
  assetList.forEach(a => {
    a.allocationPct = totalAssetsEur > 0 ? (a.balanceEur / totalAssetsEur) * 100 : 0;
  });

  const projCfg = config.projections;
  const currentTotalInvested = assetList.filter(a => a.currency === 'BTC' || a.currency === 'ADA' || (a.id.startsWith('t212_') && !a.id.endsWith('_cash'))).reduce((s, a) => s + a.balanceEur, 0);
  const currentCash = totalAssetsEur - currentTotalInvested;

  // Runway: how many months of spending can we sustain from assets (using 90-day rolling avg)
  const runwayBasisExpenses = rolling90DayExpenses > 0 ? rolling90DayExpenses : meanMonthlyExpenses;
  const runwayMonths = runwayBasisExpenses > 0 ? totalAssetsEur / runwayBasisExpenses : null;
  const liquidRunwayMonths = runwayBasisExpenses > 0 ? currentCash / runwayBasisExpenses : null;

  // -------------------------------------------------------------------------
  // 9. Future Projections
  // -------------------------------------------------------------------------
  
  const annualExpenses = runwayBasisExpenses * 12;
  const retirementTarget = annualExpenses > 0 ? annualExpenses / projCfg.safeWithdrawalRate : null;
  const safeAnnualWithdrawal = currentTotalInvested * projCfg.safeWithdrawalRate;
  const safeMonthlyWithdrawal = safeAnnualWithdrawal / 12;
  
  const targetAssetGoal = projCfg.targetAssetGoal;
  const investmentGrowthRate = projCfg.investmentGrowthRate;
  
  const projectionData = [];
  let investedFullSurplus = currentTotalInvested;
  let investedConfiguredAmount = currentTotalInvested;
  
  // Annual surplus (what we save in a year)
  const annualSurplus = meanMonthlySurplus > 0 ? meanMonthlySurplus * 12 : 0;
  // Configured annual investment
  const configuredAnnualInvestment = projCfg.monthlyInvestmentAmount * 12;
  
  let retirementYearFullSurplus = null;
  let retirementYearConfiguredAmount = null;
  let targetYearFullSurplus = null;
  let targetYearConfiguredAmount = null;
  
  for (let y = 0; y <= projCfg.horizonYears; y++) {
    const yearLabel = currentYear + y;
    
    const totalFullSurplus = investedFullSurplus + currentCash;
    const totalConfiguredAmount = investedConfiguredAmount + currentCash;
    
    projectionData.push({
      year: yearLabel,
      fullSurplusAssets: totalFullSurplus,
      configuredAmountAssets: totalConfiguredAmount,
    });
    
    if (retirementTarget && totalFullSurplus >= retirementTarget && retirementYearFullSurplus === null) {
      retirementYearFullSurplus = yearLabel;
    }
    if (totalFullSurplus >= targetAssetGoal && targetYearFullSurplus === null) {
      targetYearFullSurplus = yearLabel;
    }
    
    if (retirementTarget && totalConfiguredAmount >= retirementTarget && retirementYearConfiguredAmount === null) {
      retirementYearConfiguredAmount = yearLabel;
    }
    if (totalConfiguredAmount >= targetAssetGoal && targetYearConfiguredAmount === null) {
      targetYearConfiguredAmount = yearLabel;
    }
    
    // Grow and add contributions for next year
    investedFullSurplus = investedFullSurplus * (1 + investmentGrowthRate) + annualSurplus;
    investedConfiguredAmount = investedConfiguredAmount * (1 + investmentGrowthRate) + configuredAnnualInvestment;
  }

  // -------------------------------------------------------------------------
  // 10. Assemble final payload
  // -------------------------------------------------------------------------
  return {
    summary: {
      meanMonthlyExpenses,
      meanMonthlyIncome,
      meanMonthlySurplus,
      medianMonthlyExpenses,
      medianMonthlyIncome,
      medianMonthlySurplus,
      previousMeanMonthlyExpenses,
      previousMeanMonthlyIncome,
      previousMeanMonthlySurplus,
      previousMedianMonthlyExpenses,
      previousMedianMonthlyIncome,
      previousMedianMonthlySurplus,
      savingsRate,
      totalMonths,
      rolling90DayExpenses,
      rolling90DayIncome,
      rolling90DaySurplus,
      rolling180DayExpenses,
      rolling180DayIncome,
    },
    surplus: {
      thisYear: thisYearSurplus,
      projectedThisYear: projectedThisYearSurplus,
      previousYear: prevYearSurplus,
      difference: surplusDiff,
      growthPercent: surplusGrowthPct,
    },
    yearOverYear: {
      incomeThisYear: thisYearTotalIncome,
      projectedIncomeThisYear: projectedThisYearIncome,
      incomePreviousYear: prevYearTotalIncome,
      incomeGrowthPercent: incomeGrowthPct,
      expensesThisYear: thisYearTotalExpenses,
      projectedExpensesThisYear: projectedThisYearExpenses,
      expensesPreviousYear: prevYearTotalExpenses,
      expensesGrowthPercent: expensesGrowthPct,
      currentYear,
      previousYear,
    },
    monthOverMonth: {
      expensesCurrentMonth: currentMonthExpenses,
      incomeCurrentMonth: currentMonthIncome,
      expensesPreviousMonth: prevMonthExpenses,
      currentMonthName: currentMonthKey,
      previousMonthName: prevMonthKey,
    },
    tax,
    netMonthlyIncome: {
      projected: netAnnualIncome,
      monthly: netMonthlyIncomeRaw,
      currentMonth,
    },
    assets: {
      totalEur: totalAssetsEur,
      totalLiabilitiesEur,
      netWorthEur,
      accounts: assetList,
      liabilities: liabilityList,
      totalBtc: assetList.filter(a => a.currency === 'BTC').reduce((s, a) => s + a.balance, 0),
      totalBtcEur: assetList.filter(a => a.currency === 'BTC').reduce((s, a) => s + a.balanceEur, 0),
      totalAda: assetList.filter(a => a.currency === 'ADA').reduce((s, a) => s + a.balance, 0),
      totalAdaEur: assetList.filter(a => a.currency === 'ADA').reduce((s, a) => s + a.balanceEur, 0),
      totalInvestedEur: assetList.filter(a => a.currency === 'BTC' || a.currency === 'ADA' || (a.id.startsWith('t212_') && !a.id.endsWith('_cash'))).reduce((s, a) => s + a.balanceEur, 0),
      investedStocks: Object.values(assetList
        .filter(a => a.id.startsWith('t212_') && !a.id.endsWith('_cash'))
        .reduce((acc, a) => {
          const ticker = a.ticker || a.name.split(' ')[0];
          if (!acc[ticker]) {
            acc[ticker] = {
              name: a.name.replace(/ \(Trading212.*\)/, ''),
              ticker: ticker,
              balance: 0,
              balanceEur: 0
            };
          }
          acc[ticker].balance += a.balance;
          acc[ticker].balanceEur += a.balanceEur;
          return acc;
        }, {})
      ),
    },
    categories: {
      expenses: categoryExpenses,
      income: categoryIncome,
      topExpense: topExpenseCategory,
      expenses90d: categoryExpenses90d,
      income90d: categoryIncome90d,
      topExpense90d: topExpenseCategory90d,
    },
    monthlyData,
    runway: {
      months: runwayMonths,
      liquidMonths: liquidRunwayMonths,
      totalAssetsEur,
      totalCashEur: currentCash,
      basisExpenses: runwayBasisExpenses,
    },
    projections: {
      data: projectionData,
      targetGoal: targetAssetGoal,
      retirementTarget: retirementTarget,
      safeAnnualWithdrawal,
      safeMonthlyWithdrawal,
      investmentGrowthRate: investmentGrowthRate,
      monthlyInvestmentAmount: projCfg.monthlyInvestmentAmount,
      milestones: {
        retirementYearFullSurplus,
        retirementYearConfiguredAmount,
        targetYearFullSurplus,
        targetYearConfiguredAmount,
      }
    },
    meta: {
      lastUpdated: now.toISOString(),
      dataStartDate: cfg.startDate,
      currentMonth,
      currentYear,
      totalMonths,
    },
  };
}

module.exports = { calculate };
