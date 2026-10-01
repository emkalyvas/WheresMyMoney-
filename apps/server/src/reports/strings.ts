/** Server-side strings (PDF report, e-mails). Add a language by adding a dictionary. */
const en = {
  appName: 'WheresMyMoney!',
  reportTitle: 'Financial report',
  generatedOn: 'Generated on {date}',
  dataSince: 'Data since {date}',
  approximate: 'Some values in this snapshot are estimates (historical exchange rates or holdings were unavailable).',
  sections: {
    overview: 'Overview',
    cashflow: 'Cash flow',
    monthly: 'Income vs expenses — last 12 months',
    categories: 'Top expense categories',
    tax: 'Business & tax — {year}',
    vat: 'VAT position',
    yoy: 'Year over year',
    accounts: 'Accounts',
    liabilities: 'Liabilities',
    planning: 'Planning',
  },
  kpi: {
    netWorth: 'Net worth',
    assets: 'Total assets',
    liabilities: 'Liabilities',
    cash: 'Cash',
    invested: 'Invested',
    income: 'Avg monthly income',
    expenses: 'Avg monthly expenses',
    surplus: 'Avg monthly surplus',
    surplus90: 'Monthly surplus, last 90 days',
    savingsRate: 'Savings rate',
    runway: 'Runway',
    runwayValue: '{months} months',
  },
  table: {
    category: 'Category',
    monthly: 'Monthly avg',
    last90: 'Last 90 days /mo',
    total: 'Total',
    account: 'Account',
    kind: 'Type',
    balance: 'Balance',
    share: 'Share',
    metric: 'Metric',
    previousYear: '{year}',
    projected: '{year} (projected)',
    change: 'Change',
  },
  tax: {
    revenueNet: 'Revenue (net)',
    expensesNet: 'Expenses (net)',
    profit: 'Taxable profit',
    expected: 'Expected tax',
    effectiveRate: 'Effective rate',
    cit: 'Corporate income tax',
    businessTax: 'Business tax',
    advanceTax: 'Advance tax',
    previousAdvanceTax: 'Minus previous advance tax',
    vatCollected: 'VAT collected',
    vatDeductible: 'VAT on expenses',
    vatPaid: 'VAT paid to the tax office',
    vatRemaining: 'VAT still due',
  },
  yoy: { income: 'Income', expenses: 'Expenses', surplus: 'Surplus' },
  kinds: { cash: 'Cash', investment: 'Investment', crypto: 'Crypto' },
  planning: {
    goal: 'Target',
    goalYear: 'Reached in (fixed monthly investment)',
    goalYearSurplus: 'Reached in (investing the full surplus)',
    fireTarget: 'Financial independence number',
    safeWithdrawal: 'Safe monthly withdrawal today',
    never: 'Not within horizon',
  },
  redactedAccount: 'Account {n}',
  page: 'Page {page} of {total}',
  email: {
    subject: 'WheresMyMoney! report — {month}',
    body: 'Your financial report for {month} is attached.',
    footer: 'Sent by WheresMyMoney!. Change recipients or the schedule under Settings → Reports.',
    testSubject: 'WheresMyMoney! — test e-mail',
    testBody: 'E-mail delivery is configured correctly.',
  },
};

export type Strings = typeof en;
const dictionaries: Record<string, Strings> = { en };

export function strings(language = 'en'): Strings {
  return dictionaries[language] ?? en;
}

export function fmt(template: string, params: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}
