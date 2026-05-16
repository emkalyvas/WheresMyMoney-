'use strict';

const cron = require('node-cron');
const firefly = require('./firefly');
const { fetchExternalAssets } = require('./dataSources');
const { calculate } = require('./calculator');
const db = require('./db');
const { saveStatistics, saveDailySnapshot, saveSnapshotForDate } = db;
const cfg = require('../config');

// Keep track of whether a recalculation is currently running
let isCalculating = false;
let isBackfilling = false;

async function recalculateAndCache(dateObj = null) {
  // Ensure we only treat it as a specific backfill date if it's explicitly a Date object.
  // node-cron passes internal arguments to the callback that can cause errors here.
  const isSpecificDate = dateObj instanceof Date;
  
  if (!isSpecificDate && isCalculating) return;
  if (!isSpecificDate) isCalculating = true;

  const dateStr = isSpecificDate ? dateObj.toISOString().split('T')[0] : null;
  console.log(`[CacheWorker] Starting ${isSpecificDate ? `backfill for ${dateStr}` : 'background calculation'}...`);
  
  try {
    const now = isSpecificDate ? dateObj : new Date();
    const fireflyDate = isSpecificDate ? dateStr : null;

    // Fetch all data sources in parallel
    // Note: externalAssets (Trading 212) doesn't easily support historical point-in-time fetches via API,
    // so for backfilling we use the current external assets as a best-effort approximation if it's the only way.
    const [rawTransactions, fireflyAssetAccounts, liabilityAccounts, externalAssets] = await Promise.all([
      firefly.fetchTransactions(),
      firefly.fetchAssetAccounts(fireflyDate),
      firefly.fetchLiabilityAccounts(fireflyDate),
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
    if (isSpecificDate) {
      await saveSnapshotForDate(statistics, dateStr);
    } else {
      await saveStatistics(statistics);
      await saveDailySnapshot(statistics);
    }
    console.log(`[CacheWorker] Successfully updated statistics for ${isSpecificDate ? dateStr : 'cache'}.`);
  } catch (err) {
    console.error(`[CacheWorker] Error calculating statistics${isSpecificDate ? ` for ${dateStr}` : ''}:`, err.message);
  } finally {
    if (!isSpecificDate) isCalculating = false;
  }
}

/**
 * Performs a one-time backfill of daily_statistics from START_DATE until yesterday.
 * @param {boolean} force - If true, skips the 'hasData' check.
 */
async function backfillDailyData(force = false) {
  if (isBackfilling) return;
  
  if (!force) {
    const hasData = await db.hasDailyData();
    if (hasData) {
      console.log(`[CacheWorker] daily_statistics already has data, skipping backfill.`);
      return;
    }
  }

  isBackfilling = true;
  console.log(`[CacheWorker] Starting initial daily statistics backfill...`);

  try {
    const startDate = new Date(cfg.calculations.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (true) {
      // Calculate for the last day of the month for 'current'
      const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      lastDayOfMonth.setHours(0, 0, 0, 0);

      // Don't backfill for months that haven't ended yet
      if (lastDayOfMonth >= today) break;

      await recalculateAndCache(new Date(lastDayOfMonth));
      
      // Small delay to be nice to APIs
      await new Promise(resolve => setTimeout(resolve, 500));

      // Move current to the 1st of the next month
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    console.log(`[CacheWorker] Monthly backfill completed.`);
  } catch (err) {
    console.error(`[CacheWorker] Initial backfill failed:`, err.message);
  } finally {
    isBackfilling = false;
  }
}

async function startCacheWorker() {
  const ttlMinutes = cfg.calculations.cacheTtlMinutes || 15;
  
  // Check if we need to backfill BEFORE the first calculation
  const needsBackfill = !(await db.hasDailyData());

  // Calculate immediately on startup
  await recalculateAndCache();

  // Run backfill in the background if needed
  if (needsBackfill) {
    backfillDailyData(true);
  }

  // Then schedule to run every ttlMinutes
  const cronExpression = `*/${ttlMinutes} * * * *`;
  cron.schedule(cronExpression, () => recalculateAndCache());
  console.log(`[CacheWorker] Scheduled to run every ${ttlMinutes} minutes.`);
}

module.exports = {
  startCacheWorker,
  recalculateAndCache
};
