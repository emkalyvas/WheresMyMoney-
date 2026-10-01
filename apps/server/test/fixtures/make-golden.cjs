// One-off: runs the v1 calculator (backend/src/services/calculator.js, removed in v2;
// check out commit 6c0fd0f to regenerate) against the
// synthetic dataset and writes its output as golden files. The v2 calculator must
// reproduce these results. Run with: TZ=Europe/Athens node make-golden.cjs
'use strict';

const fs = require('fs');
const path = require('path');

process.env.COMPANY_TAG = 'Acme';
process.env.START_DATE = '2024-01-01';
process.env.VAT_TAG = 'ΦΠΑ';
process.env.NO_VAT_TAG = 'No VAT';
process.env.DEFAULT_VAT = '24';
process.env.VAT_EXPENSE_TAG = 'Εφορια,ΦΠΑ';
process.env.IGNORE_FIREFLY_ACCOUNTS = 'Old Wallet';
process.env.INCOME_TAX_RATE = '0.22';
process.env.BUSINESS_TAX = '800';
process.env.ADVANCE_TAX_RATE = '0.40';
process.env.TARGET_ASSET_GOAL = '1000000';
process.env.EXPECTED_INVESTMENT_GROWTH_RATE = '0.07';
process.env.SAFE_WITHDRAWAL_RATE = '0.04';
process.env.MONTHLY_INVESTMENT_AMOUNT = '500';
process.env.PROJECTION_HORIZON_YEARS = '30';

const legacyCalc = require(path.resolve(__dirname, '../../../../backend/src/services/calculator.js'));

const CASES = [
  { name: 'mid-year', now: [2026, 8, 15, 10, 0], until: '2026-09' },
  { name: 'early-january', now: [2026, 0, 3, 9, 30], until: '2026-01' },
  { name: 'month-end-backfill', now: [2025, 5, 30, 0, 0], until: '2025-06' },
];

(async () => {
  const { buildSyntheticFirefly } = await import('./synthetic.mjs');
  for (const c of CASES) {
    const data = buildSyntheticFirefly({ until: c.until });
    const now = new Date(...c.now);
    const rates = new Map(Object.entries(data.eurRates));
    const out = legacyCalc.calculate(
      data.transactions,
      [...data.assets, ...data.externalAssets],
      data.liabilities,
      rates,
      now,
    );
    const file = path.join(__dirname, `golden-${c.name}.json`);
    fs.writeFileSync(file, JSON.stringify({ now: now.toISOString(), until: c.until, output: out }, null, 2));
    console.log('wrote', path.basename(file));
  }
})();
