'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config');

/**
 * Loads the active tax module based on the TAX_MODULE environment variable.
 */
function getActiveTaxModule() {
  const moduleName = config.calculations.taxModule;

  if (!moduleName || moduleName.toLowerCase() === 'none') {
    return null;
  }

  try {
    const modulePath = path.join(__dirname, `${moduleName}.js`);
    if (fs.existsSync(modulePath)) {
      return require(modulePath);
    } else {
      console.warn(`[TaxModules] Warning: Tax module '${moduleName}' not found. Tax calculations will be disabled.`);
      return null;
    }
  } catch (err) {
    console.error(`[TaxModules] Error loading tax module '${moduleName}':`, err.message);
    return null;
  }
}

module.exports = {
  getActiveTaxModule
};