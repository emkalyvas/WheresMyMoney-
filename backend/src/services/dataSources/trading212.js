'use strict';

const axios = require('axios');
const config = require('../../config');

/**
 * Connects to the Trading212 API to fetch open positions and uninvested cash.
 * Returns them as an array of 'asset' accounts compatible with the WheresMyMoney! calculator.
 */
async function fetchTrading212Assets() {
  const { apiKey, apiSecret, env } = config.dataSources.trading212;

  // If not configured, silently skip
  if (!apiKey || !apiSecret) {
    return [];
  }

  const baseUrl =
    env.toLowerCase() === 'live'
      ? 'https://live.trading212.com/api/v0'
      : 'https://demo.trading212.com/api/v0';

  // Construct Basic Auth header
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  try {
    // We fetch cash and positions concurrently
    // Fallback to /account/cash if /account/summary fails or is incomplete
    const [cashRes, positionsRes] = await Promise.all([
      client.get('/equity/account/cash').catch(e => {
        console.warn(`[trading212] Failed to fetch cash: ${e.message}`);
        return { data: {} };
      }),
      client.get('/equity/positions').catch(e => {
        console.warn(`[trading212] Failed to fetch positions: ${e.message}`);
        return { data: [] };
      })
    ]);

    const cashData = cashRes.data || {};
    const positionsData = Array.isArray(positionsRes.data) ? positionsRes.data : [];

    // Attempt to extract free cash (could be under 'free', 'total', etc. based on undocumented structure, 
    // usually `free` is available cash)
    const uninvestedCash = parseFloat(cashData.free ?? cashData.total ?? cashData.cash ?? '0');

    const assets = [];

    // 1. Uninvested Cash
    if (uninvestedCash > 0) {
      assets.push({
        id: 't212_cash',
        name: 'Uninvested Cash (Trading212)',
        type: 'asset',
        currency: 'EUR', // Assuming account currency is EUR as per API limitations doc
        balance: uninvestedCash,
        balanceEur: uninvestedCash,
        exchangeRate: 1,
      });
    }

    // 2. Open Positions
    // T212 API returns values in the primary account currency
    for (const pos of positionsData) {
      const instrument = pos.instrument || {};
      let ticker = instrument.ticker || 'UNKNOWN';
      // Strip common Trading212 suffixes for a cleaner display
      ticker = ticker.replace(/_(US_)?EQ$/, '');
      const name = instrument.name || ticker;
      const quantity = parseFloat(pos.quantity ?? '0');
      
      // Calculate current value. Often positions API returns currentPrice, averagePrice, etc.
      const currentPrice = parseFloat(pos.currentPrice ?? '0');
      const walletImpact = pos.walletImpact || {};
      const value = walletImpact.currentValue ?? pos.currentValue ?? pos.value ?? (quantity * currentPrice);
      
      if (quantity > 0) {
        assets.push({
          id: `t212_${ticker}`,
          name: `${name} (Trading212)`,
          ticker: ticker,
          type: 'asset',
          currency: 'EUR', // Primary account currency
          balance: quantity, // The amount of that specific ticker (e.g. 11.2 WEBN)
          balanceEur: value, // The relevant amount in EUR
          exchangeRate: 1, // T212 returns values in account currency (EUR)
        });
      }
    }

    return assets;

  } catch (err) {
    console.error(`[trading212] Error fetching data: ${err.message}`);
    return [];
  }
}

module.exports = {
  fetchTrading212Assets,
};
