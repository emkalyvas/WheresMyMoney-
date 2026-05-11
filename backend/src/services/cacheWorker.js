'use strict';

const cron = require('node-cron');
const firefly = require('./firefly');
const { fetchExternalAssets } = require('./dataSources');
const { calculate } = require('./calculator');
const { saveStatistics } = require('./db');
const cfg = require('../config');

// Keep track of whether a recalculation is currently running
let isCalculating = false;

async function recalculateAndCache() {
  if (isCalculating) return;
  isCalculating = true;

  console.log(`[CacheWorker] Starting background calculation...`);
  try {
    const now = new Date();
    // Fetch all data sources in parallel
    const [rawTransactions, fireflyAssetAccounts, liabilityAccounts, externalAssets] = await Promise.all([
      firefly.fetchTransactions(),
      firefly.fetchAssetAccounts(),
      firefly.fetchLiabilityAccounts(),
      fetchExternalAssets()
    ]);

    // Flatten external assets into the asset accounts list
    const assetAccounts = [...fireflyAssetAccounts, ...externalAssets];

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

    // Calculate
    const statistics = calculate(rawTransactions, assetAccounts, liabilityAccounts, eurRates, now);

    // Save to DB
    await saveStatistics(statistics);
    console.log(`[CacheWorker] Successfully updated statistics cache.`);
  } catch (err) {
    console.error(`[CacheWorker] Error calculating statistics:`, err.message);
  } finally {
    isCalculating = false;
  }
}

function startCacheWorker() {
  const ttlMinutes = cfg.calculations.cacheTtlMinutes || 15;
  
  // Calculate immediately on startup
  recalculateAndCache();

  // Then schedule to run every ttlMinutes
  const cronExpression = `*/${ttlMinutes} * * * *`;
  cron.schedule(cronExpression, recalculateAndCache);
  console.log(`[CacheWorker] Scheduled to run every ${ttlMinutes} minutes.`);
}

module.exports = {
  startCacheWorker,
  recalculateAndCache
};
