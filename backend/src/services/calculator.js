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
  const allJournals = normalizeTransactions(rawTransactions);
  const journals = allJournals.filter((j) => j.date >= startDate && j.type !== 'transfer');

  const expenses = journals.filter((j) => j.type === 'withdrawal');
  const income = journals.filter((j) => j.type === 'deposit');

  // Total months elapsed from startDate to now (used for mean calculations)
  const allMonths = monthRange(startDate, now);
  const totalMonths = allMonths.length;

  // -------------------------------------------------------------------------
  // 2. Global means
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
  
  const currentMonthExpensesTotal = sumAmounts(groupBy(expenses, (j) => monthKey(j.date))[currentMonthKey2] ?? []);
  const currentMonthIncomeTotal = sumAmounts(groupBy(income, (j) => monthKey(j.date))[currentMonthKey2] ?? []);

  const previousMeanMonthlyExpenses = previousTotalMonths > 0 ? (totalExpenses - currentMonthExpensesTotal) / previousTotalMonths : 0;
  const previousMeanMonthlyIncome = previousTotalMonths > 0 ? (totalIncome - currentMonthIncomeTotal) / previousTotalMonths : 0;
  const previousMeanMonthlySurplus = previousMeanMonthlyIncome - previousMeanMonthlyExpenses;

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
  const companyTag = cfg.companyTag;
  
  const companyExpensesThisYear = thisYearExpenses
    .filter((j) => j.tags && j.tags.includes(companyTag))
    .reduce((acc, j) => acc + j.amount, 0);

  const grossRevenue = thisYearIncome
    .filter((j) => j.tags && j.tags.includes(companyTag))
    .reduce((acc, j) => acc + j.amount, 0);

  const netTaxableProfit = Math.max(0, grossRevenue - companyExpensesThisYear);

  const corporateIncomeTax = netTaxableProfit * cfg.incomeTaxRate;
  const businessTax = cfg.businessTax;
  const advanceTax = corporateIncomeTax * cfg.advanceTaxRate;

  // Extract previous year's advance tax from liability accounts
  const previousTaxAccountName = `Φόρος Εισοδήματος ${previousYear}`;
  const previousTaxAccount = liabilityAccounts.find(a => a.attributes?.name === previousTaxAccountName);
  let previousAdvanceTax = 0;
  if (previousTaxAccount && previousTaxAccount.attributes?.notes) {
    const match = previousTaxAccount.attributes.notes.match(/Προκαταβολ[ηή]:\s*([\d.]+)/i);
    if (match) {
      previousAdvanceTax = parseFloat(match[1]);
    }
  }

  const expectedTax = corporateIncomeTax + businessTax + advanceTax - previousAdvanceTax;
  const effectiveTaxRate = grossRevenue > 0 ? (expectedTax / grossRevenue) * 100 : 0;

  // -------------------------------------------------------------------------
  // 5. Net monthly income (annualised projection based on YTD data)
  // -------------------------------------------------------------------------
  const startOfYear = new Date(currentYear, 0, 1);
  const daysPassed = Math.max(1, Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24)));
  const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
  const daysInYear = isLeapYear ? 366 : 365;

  // Formula: (netTaxableProfit - expectedTax) / daysPassed * daysInYear
  const netAnnualIncome = ((netTaxableProfit - expectedTax) / daysPassed) * daysInYear;

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

      return {
        name,
        total: sumAmounts(txs),
        monthlyMean: totalMonths > 0 ? sumAmounts(txs) / totalMonths : 0,
        transactionCount: txs.length,
        currentMonthAmount,
        previousMonthAmount,
        previousMonthlyMean,
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

      return {
        name,
        total: sumAmounts(txs),
        monthlyMean: totalMonths > 0 ? sumAmounts(txs) / totalMonths : 0,
        transactionCount: txs.length,
        currentMonthAmount,
        previousMonthAmount,
        previousMonthlyMean,
        currentRank,
        previousRank,
        rankChange,
      };
    })
    .sort((a, b) => b.total - a.total);

  const topExpenseCategory = categoryExpenses[0] ?? null;

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

  // Runway: how many months of mean spending can we sustain from assets
  const runwayMonths =
    meanMonthlyExpenses > 0 ? totalAssetsEur / meanMonthlyExpenses : null;

  // -------------------------------------------------------------------------
  // 9. Assemble final payload
  // -------------------------------------------------------------------------
  return {
    summary: {
      meanMonthlyExpenses,
      meanMonthlyIncome,
      meanMonthlySurplus,
      previousMeanMonthlyExpenses,
      previousMeanMonthlyIncome,
      previousMeanMonthlySurplus,
      savingsRate,
      totalMonths,
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
    tax: {
      grossRevenue,
      companyExpenses: companyExpensesThisYear,
      netTaxableProfit,
      corporateIncomeTax,
      businessTax,
      advanceTax,
      previousAdvanceTax,
      expectedTax,
      effectiveTaxRate,
      config: {
        incomeTaxRate: cfg.incomeTaxRate,
        businessTax: cfg.businessTax,
        advanceTaxRate: cfg.advanceTaxRate,
      },
    },
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
      totalInvestedEur: assetList.filter(a => a.currency === 'BTC' || a.currency === 'ADA' || (a.id.startsWith('t212_') && a.id !== 't212_cash')).reduce((s, a) => s + a.balanceEur, 0),
      investedStocks: assetList.filter(a => a.id.startsWith('t212_') && a.id !== 't212_cash').map(a => ({
        name: a.name.replace(' (Trading212)', ''),
        ticker: a.ticker || a.name.split(' ')[0],
        balance: a.balance,
        balanceEur: a.balanceEur
      })),
    },
    categories: {
      expenses: categoryExpenses,
      income: categoryIncome,
      topExpense: topExpenseCategory,
    },
    monthlyData,
    runway: {
      months: runwayMonths,
      totalAssetsEur,
      meanMonthlyExpenses,
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
