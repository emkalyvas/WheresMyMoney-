'use strict';

/**
 * Greek OE (Omorrythmi Etaireia) Tax Module.
 * 
 * Calculates:
 * 1. Corporate Income Tax (CIT) - Standard 22%
 * 2. Business Tax (Telos Epitidevmatos) - Flat fee
 * 3. Advance Tax - Percentage of CIT (Standard 40% for some, but configurable)
 * 4. Deducts previous year's advance tax.
 */

function calculate(context) {
  const {
    allJournals,
    liabilityAccounts,
    currentYear,
    previousYear,
    config
  } = context;

  const companyTag = config.companyTag;
  
  const companyExpensesThisYear = allJournals
    .filter((j) => j.date.getFullYear() === currentYear && j.type === 'withdrawal' && j.tags && j.tags.includes(companyTag))
    .reduce((acc, j) => acc + j.amount, 0);

  const grossRevenue = allJournals
    .filter((j) => j.date.getFullYear() === currentYear && j.type === 'deposit' && j.tags && j.tags.includes(companyTag))
    .reduce((acc, j) => acc + j.amount, 0);

  const netTaxableProfit = Math.max(0, grossRevenue - companyExpensesThisYear);

  const corporateIncomeTax = netTaxableProfit * config.incomeTaxRate;
  const businessTax = config.businessTax;
  const advanceTax = corporateIncomeTax * config.advanceTaxRate;

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

  const expectedTaxTotal = corporateIncomeTax + businessTax + advanceTax - previousAdvanceTax;
  const effectiveTaxRate = grossRevenue > 0 ? (expectedTaxTotal / grossRevenue) * 100 : 0;

  const breakdown = [
    {
      label: `Corporate Income Tax (CIT)`,
      value: corporateIncomeTax,
      type: 'warning',
      info: `CIT × ${(config.incomeTaxRate * 100).toFixed(0)}%`,
      path: 'tax.breakdown[0].value'
    },
    {
      label: `Business Tax (Telos Epitidevmatos)`,
      value: businessTax,
      type: 'warning',
      info: 'Flat annual fee',
      path: 'tax.breakdown[1].value'
    },
    {
      label: `Advance Tax (Prokatavoli)`,
      value: advanceTax,
      type: 'negative',
      info: `${(config.advanceTaxRate * 100).toFixed(0)}% of CIT towards next year`,
      path: 'tax.breakdown[2].value'
    }
  ];

  if (previousAdvanceTax > 0) {
    breakdown.push({
      label: `Minus Previous Advance Tax`,
      value: -previousAdvanceTax,
      type: 'positive',
      info: `Prepaid tax from ${previousYear}`,
      path: 'tax.breakdown[3].value'
    });
  }

  return {
    enabled: true,
    description: "Greek OE Company Tax Calculation (CIT, Advance Tax, and Flat Business Tax).",
    grossRevenue,
    companyExpenses: companyExpensesThisYear,
    netTaxableProfit,
    expectedTaxTotal,
    effectiveTaxRate,
    breakdown
  };
}

module.exports = { calculate };
