'use strict';

const { fetchTrading212Assets } = require('./trading212');

/**
 * Aggregates all external data sources (outside of Firefly III).
 * Returns a unified array of 'asset' accounts.
 */
async function fetchExternalAssets() {
  const assets = await Promise.all([
    fetchTrading212Assets(),
    // Add future data sources here
  ]);

  // Flatten the array of arrays
  return assets.flat();
}

module.exports = {
  fetchExternalAssets,
};
