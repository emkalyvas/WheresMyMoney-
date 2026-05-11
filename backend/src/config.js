'use strict';

require('dotenv').config();

/**
 * Central configuration module.
 * All values are read from environment variables with sensible defaults.
 */
module.exports = {
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),

  firefly: {
    apiUrl: (process.env.FIREFLY_API_URL || 'http://localhost:8080').replace(/\/$/, ''),
    token: process.env.FIREFLY_TOKEN || '',
    ignoredAccounts: (process.env.IGNORE_FIREFLY_ACCOUNTS || '').split(',').map(a => a.trim()).filter(Boolean),
  },

  dataSources: {
    trading212: {
      apiKey: process.env.TRADING212_API_KEY || '',
      apiSecret: process.env.TRADING212_API_SECRET || '',
      env: process.env.TRADING212_ENV || 'live',
    },
  },

  calculations: {
    startDate: process.env.START_DATE || '2023-01-01',
    incomeTaxRate: parseFloat(process.env.INCOME_TAX_RATE || '0.22'),
    businessTax: parseFloat(process.env.BUSINESS_TAX || '800'),
    advanceTaxRate: parseFloat(process.env.ADVANCE_TAX_RATE || '0.40'),
    cacheTtlMinutes: parseInt(process.env.STATISTICS_CACHE_TTL_MINUTES || '15', 10),
    companyTag: process.env.COMPANY_TAG || 'MnApps',
  },
};
