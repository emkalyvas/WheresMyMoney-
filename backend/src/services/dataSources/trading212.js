'use strict';

const axios = require('axios');
const config = require('../../config');

/**
 * Connects to the Trading212 API to fetch open positions and uninvested cash.
 * Returns them as an array of 'asset' accounts compatible with the WheresMyMoney! calculator.
 */
async function fetchTrading212Assets() {
  const accounts = config.dataSources.trading212Accounts || [];
  
  if (accounts.length === 0) {
    return [];
  }

  // Fetch all accounts concurrently
  const accountPromises = accounts.map(async (account, index) => {
    const { apiKey, apiSecret, env } = account;
    
    // Silently skip if misconfigured
    if (!apiKey || !apiSecret) {
      return [];
    }

    const baseUrl =
      env.toLowerCase() === 'live'
        ? 'https://live.trading212.com/api/v0'
        : 'https://demo.trading212.com/api/v0';

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
      const [cashRes, positionsRes] = await Promise.all([
        client.get('/equity/account/cash').catch(e => {
          console.warn(`[trading212] Failed to fetch cash for account ${index}: ${e.message}`);
          return { data: {} };
        }),
        client.get('/equity/positions').catch(e => {
          console.warn(`[trading212] Failed to fetch positions for account ${index}: ${e.message}`);
          return { data: [] };
        })
      ]);

      const cashData = cashRes.data || {};
      const positionsData = Array.isArray(positionsRes.data) ? positionsRes.data : [];

      const uninvestedCash = parseFloat(cashData.free ?? cashData.total ?? cashData.cash ?? '0');
      const assets = [];
      const accSuffix = accounts.length > 1 ? ` (${index + 1})` : '';
      const idPrefix = accounts.length > 1 ? `t212_${index}_` : 't212_';

      if (uninvestedCash > 0) {
        assets.push({
          id: `${idPrefix}cash`,
          name: `Uninvested Cash (Trading212${accSuffix})`,
          type: 'asset',
          currency: 'EUR',
          balance: uninvestedCash,
          balanceEur: uninvestedCash,
          exchangeRate: 1,
        });
      }

      for (const pos of positionsData) {
        const instrument = pos.instrument || {};
        let ticker = instrument.ticker || 'UNKNOWN';
        ticker = ticker.replace(/_(US_)?EQ$/, '');
        const name = instrument.name || ticker;
        const quantity = parseFloat(pos.quantity ?? '0');
        
        const currentPrice = parseFloat(pos.currentPrice ?? '0');
        const walletImpact = pos.walletImpact || {};
        const value = walletImpact.currentValue ?? pos.currentValue ?? pos.value ?? (quantity * currentPrice);
        
        if (quantity > 0) {
          assets.push({
            id: `${idPrefix}${ticker}`,
            name: `${name} (Trading212${accSuffix})`,
            ticker: ticker,
            type: 'asset',
            currency: 'EUR',
            balance: quantity,
            balanceEur: value,
            exchangeRate: 1,
          });
        }
      }

      return assets;
    } catch (err) {
      console.error(`[trading212] Error fetching data for account ${index}: ${err.message}`);
      return [];
    }
  });

  const results = await Promise.all(accountPromises);
  return results.flat();
}

module.exports = {
  fetchTrading212Assets,
};
