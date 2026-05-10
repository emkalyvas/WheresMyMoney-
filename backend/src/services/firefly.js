'use strict';

const axios = require('axios');
const config = require('../config');

const PAGE_LIMIT = 100;

/**
 * Creates an Axios instance pre-configured with the Firefly III base URL
 * and Bearer token authentication.
 */
function createClient() {
  return axios.create({
    baseURL: `${config.firefly.apiUrl}/api/v1`,
    headers: {
      Authorization: `Bearer ${config.firefly.token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
}

/**
 * Generic paginator: fetches every page of a Firefly III list endpoint
 * and returns the combined `data` array.
 *
 * @param {import('axios').AxiosInstance} client
 * @param {string} url - Relative URL (e.g. '/accounts')
 * @param {object} params - Extra query parameters
 * @returns {Promise<Array>}
 */
async function fetchAllPages(client, url, params = {}) {
  const results = [];
  let page = 1;

  while (true) {
    const response = await client.get(url, {
      params: { ...params, page, limit: PAGE_LIMIT },
    });

    const { data, meta } = response.data;
    if (Array.isArray(data)) results.push(...data);

    const pagination = meta?.pagination;
    if (!pagination || page >= pagination.total_pages) break;
    page += 1;
  }

  return results;
}

/**
 * Fetches all transactions from the configured start date from Firefly III,
 * handling pagination automatically.
 *
 * Uses the search endpoint with `date_after:<date>` query.
 *
 * @returns {Promise<Array>} Raw Firefly III transaction group objects
 */
async function fetchTransactions() {
  const client = createClient();
  const startDate = config.calculations.startDate;
  return fetchAllPages(client, '/search/transactions', {
    query: `date_after:"${startDate}"`,
    type: 'all',
  });
}

/**
 * Fetches all asset accounts from Firefly III.
 * These represent the user's personal holdings (checking, savings, etc.).
 *
 * @returns {Promise<Array>}
 */
async function fetchAssetAccounts() {
  const client = createClient();
  return fetchAllPages(client, '/accounts', { type: 'asset' });
}

/**
 * Fetches all liability accounts (loans, mortgages, debts) from Firefly III.
 *
 * @returns {Promise<Array>}
 */
async function fetchLiabilityAccounts() {
  const client = createClient();
  return fetchAllPages(client, '/accounts', { type: 'liabilities' });
}

/**
 * Retrieves the EUR exchange rate for a given currency code.
 * Uses open.er-api.com for fiat currencies and falls back to Binance for cryptocurrencies.
 *
 * Returns 1 if the currency is already EUR or the lookup fails.
 *
 * @param {string} currencyCode - ISO 4217 code or Crypto symbol (e.g. 'USD', 'RSD', 'BTC')
 * @returns {Promise<number>} Rate to multiply native amount by to get EUR
 */
async function getEurRate(currencyCode) {
  if (!currencyCode || currencyCode.toUpperCase() === 'EUR') return 1;
  const code = currencyCode.toUpperCase();

  try {
    // 1. Try fiat currencies via open.er-api.com
    const response = await axios.get('https://open.er-api.com/v6/latest/EUR', {
      timeout: 5_000,
    });
    const rates = response.data?.rates;
    if (rates && rates[code]) {
      // The API returns how much of the target currency 1 EUR buys.
      return 1 / rates[code];
    }
  } catch (err) {
    console.warn(`[firefly] open.er-api.com failed for ${code}: ${err.message}`);
  }

  try {
    // 2. Fallback to Binance for cryptocurrencies
    const binanceResponse = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${code}EUR`, {
      timeout: 5_000,
    });
    if (binanceResponse.data && binanceResponse.data.price) {
      return parseFloat(binanceResponse.data.price);
    }
  } catch (err) {
    console.warn(`[firefly] Binance failed for ${code}: ${err.response?.data?.msg || err.message}`);
  }

  console.warn(`[firefly] Could not fetch EUR rate for ${code}, defaulting to 1`);
  return 1;
}

module.exports = {
  fetchTransactions,
  fetchAssetAccounts,
  fetchLiabilityAccounts,
  getEurRate,
};
