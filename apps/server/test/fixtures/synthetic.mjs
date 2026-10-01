// Deterministic, entirely fictional Firefly III dataset used by the calculator
// golden tests and by the local mock Firefly server. No real data lives here.

function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}T00:00:00+02:00`;
const money = (n) => n.toFixed(2);

export const SYNTHETIC_SETTINGS = {
  companyTag: 'Acme',
  vatTag: 'ΦΠΑ',
  noVatTag: 'No VAT',
  defaultVat: 24,
  vatExpenseTags: ['Εφορια', 'ΦΠΑ'],
  ignoredAccounts: ['Old Wallet'],
  startDate: '2024-01-01',
};

/**
 * @param {{ until?: string }} [opts] last month (YYYY-MM) to generate, inclusive
 */
export function buildSyntheticFirefly(opts = {}) {
  const rand = mulberry32(42);
  const until = opts.until ?? '2026-09';
  const [untilY, untilM] = until.split('-').map(Number);
  const groups = [];
  let gid = 1000;

  const tx = (date, type, amount, extra = {}) => {
    groups.push({
      id: String(gid++),
      type: 'transactions',
      attributes: {
        transactions: [
          {
            date,
            type,
            amount: money(amount),
            currency_code: 'EUR',
            category_name: extra.category ?? null,
            tags: extra.tags ?? [],
            description: extra.description ?? `${type} ${extra.category ?? ''}`.trim(),
            source_name: extra.source ?? (type === 'deposit' ? extra.counterparty ?? 'Employer' : 'Main Account'),
            destination_name:
              extra.destination ?? (type === 'deposit' ? 'Main Account' : extra.counterparty ?? 'Shop'),
          },
        ],
      },
    });
  };

  // One transaction before the start date (must be ignored by the calculator)
  tx(iso(2023, 12, 20), 'withdrawal', 123.45, { category: 'Groceries' });

  for (let y = 2024; y <= untilY; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === untilY && m > untilM) break;
      const r = () => rand();

      tx(iso(y, m, 1), 'deposit', 2500 + Math.round(r() * 300), { category: 'Salary', counterparty: 'Employer' });

      const invoices = 1 + Math.floor(r() * 3);
      for (let i = 0; i < invoices; i++) {
        const variant = r();
        const tags = ['Acme'];
        if (variant < 0.25) tags.push('ΦΠΑ 13');
        else if (variant < 0.4) tags.push('No VAT');
        tx(iso(y, m, 5 + i * 7), 'deposit', 800 + Math.round(r() * 2400), {
          category: 'Consulting',
          tags,
          counterparty: `Client ${1 + Math.floor(r() * 4)}`,
        });
      }

      tx(iso(y, m, 2), 'withdrawal', 900, { category: 'Housing', counterparty: 'Landlord' });
      for (let i = 0; i < 4; i++) {
        tx(iso(y, m, 3 + i * 6), 'withdrawal', 40 + r() * 110, { category: 'Groceries', counterparty: 'Supermarket' });
      }
      tx(iso(y, m, 10), 'withdrawal', 30 + r() * 90, { category: 'Transport', counterparty: 'Fuel Station' });
      tx(iso(y, m, 15), 'withdrawal', 60 + r() * 80, { category: 'Utilities', counterparty: 'Power Co' });
      if (r() < 0.7) tx(iso(y, m, 18), 'withdrawal', 25 + r() * 120, { category: 'Eating Out', counterparty: 'Cafe' });
      if (r() < 0.3) tx(iso(y, m, 21), 'withdrawal', 15 + r() * 60, { counterparty: 'Kiosk' }); // uncategorized

      // Company expenses (default VAT, some with explicit rate)
      tx(iso(y, m, 12), 'withdrawal', 49.6, { category: 'Software', tags: ['Acme'], counterparty: 'SaaS Inc' });
      if (r() < 0.5) {
        tx(iso(y, m, 22), 'withdrawal', 120 + r() * 200, {
          category: 'Equipment',
          tags: ['Acme', 'ΦΠΑ 24'],
          counterparty: 'Hardware Store',
        });
      }

      // Quarterly VAT payment to the tax office (accent variant on purpose)
      if (m % 3 === 1 && !(y === 2024 && m === 1)) {
        tx(iso(y, m, 25), 'withdrawal', 300 + Math.round(r() * 400), {
          category: 'Taxes',
          tags: ['Εφορία', 'ΦΠΑ'],
          counterparty: 'Tax Office',
        });
      }

      // Transfer between own accounts (ignored by the calculator)
      tx(iso(y, m, 28), 'transfer', 300, { source: 'Main Account', destination: 'Savings' });

      // Transactions touching ignored accounts
      tx(iso(y, m, 8), 'withdrawal', 20, { category: 'Groceries', source: 'Old Wallet' });
      tx(iso(y, m, 9), 'deposit', 50, { category: 'Gifts', destination: 'Hidden Account', counterparty: 'Friend' });
    }
  }

  // A future-dated transaction (scheduled); must be ignored for "now" before it.
  tx(iso(untilY, untilM, 27), 'withdrawal', 999, { category: 'Holidays', counterparty: 'Airline' });

  const asset = (id, name, currency, balance, extra = {}) => ({
    id: String(id),
    type: 'accounts',
    attributes: {
      name,
      type: 'asset',
      currency_code: currency,
      current_balance: String(balance),
      include_net_worth: extra.includeNetWorth ?? true,
      notes: extra.notes ?? null,
      account_role: extra.role ?? 'defaultAsset',
    },
  });

  const assets = [
    asset(1, 'Main Account', 'EUR', 5234.12),
    asset(2, 'Savings', 'EUR', 12000),
    asset(3, 'USD Account', 'USD', 1500),
    asset(4, 'Bitcoin Wallet', 'BTC', 0.05),
    asset(5, 'Cardano Wallet', 'ADA', 3000),
    asset(6, 'Old Wallet', 'EUR', 300),
    asset(7, 'Hidden Account', 'EUR', 999, { includeNetWorth: false }),
  ];

  const liability = (id, name, balance, notes = null) => ({
    id: String(id),
    type: 'accounts',
    attributes: {
      name,
      type: 'liabilities',
      currency_code: 'EUR',
      current_balance: String(balance),
      include_net_worth: true,
      notes,
    },
  });

  const liabilities = [
    liability(20, 'Car Loan', -4000),
    liability(21, `Φόρος Εισοδήματος ${untilY - 1}`, -1200, 'Some note\nΠροκαταβολή: 1500.50'),
  ];

  const externalAssets = [
    { id: 't212_cash', name: 'Uninvested Cash (Trading212)', type: 'asset', currency: 'EUR', balance: 250.5, balanceEur: 250.5, exchangeRate: 1 },
    { id: 't212_VWCE', name: 'Vanguard FTSE All-World (Trading212)', ticker: 'VWCE', type: 'asset', currency: 'EUR', balance: 70, balanceEur: 8000, exchangeRate: 1 },
    { id: 't212_AAPL', name: 'Apple (Trading212)', ticker: 'AAPL', type: 'asset', currency: 'EUR', balance: 6, balanceEur: 1200, exchangeRate: 1 },
  ];

  const eurRates = { USD: 0.92, BTC: 58000, ADA: 0.45 };

  return { transactions: groups, assets, liabilities, externalAssets, eurRates };
}
