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
  },

  calculations: {
    startDate: process.env.START_DATE || '2023-01-01',
    incomeTaxRate: parseFloat(process.env.INCOME_TAX_RATE || '0.22'),
    businessTax: parseFloat(process.env.BUSINESS_TAX || '800'),
    advanceTaxRate: parseFloat(process.env.ADVANCE_TAX_RATE || '0.40'),
    companyTag: process.env.COMPANY_TAG || 'MnApps',
  },
};
