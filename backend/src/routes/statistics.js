'use strict';

const express = require('express');
const firefly = require('../services/firefly');
const { calculate } = require('../services/calculator');

const router = express.Router();

/**
 * GET /api/statistics
 *
 * Fetches all required data from Firefly III in parallel, resolves currency
 * exchange rates for non-EUR accounts, runs the calculator, and returns the
 * full statistics payload as JSON.
 *
 * Errors from Firefly III are surfaced as a structured JSON error response.
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all data sources in parallel to minimise latency
    const [rawTransactions, assetAccounts, liabilityAccounts] = await Promise.all([
      firefly.fetchTransactions(),
      firefly.fetchAssetAccounts(),
      firefly.fetchLiabilityAccounts(),
    ]);

    // Collect unique non-EUR currencies across all accounts
    const allAccounts = [...assetAccounts, ...liabilityAccounts];
    const foreignCurrencies = [
      ...new Set(
        allAccounts
          .map((a) => a.attributes?.currency_code)
          .filter((c) => c && c.toUpperCase() !== 'EUR')
      ),
    ];

    // Resolve exchange rates in parallel
    const rateEntries = await Promise.all(
      foreignCurrencies.map(async (currency) => [currency, await firefly.getEurRate(currency)])
    );
    const eurRates = new Map(rateEntries);

    const statistics = calculate(rawTransactions, assetAccounts, liabilityAccounts, eurRates, new Date());

    res.json({ success: true, data: statistics });
  } catch (err) {
    console.error('[statistics] Error computing statistics:', err.message);

    // Distinguish Firefly III connectivity errors from internal errors
    if (err.response) {
      return res.status(502).json({
        success: false,
        error: 'Firefly III API error',
        details: err.response.data,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  }
});

module.exports = router;
