'use strict';

const express = require('express');
const { getStatistics } = require('../services/db');

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
    const statistics = await getStatistics();

    if (!statistics) {
      return res.status(503).json({
        success: false,
        error: 'Data is currently being calculated. Please try again in a few moments.',
        retryAfter: 5
      });
    }

    res.json({ success: true, data: statistics });
  } catch (err) {
    console.error('[statistics] Error fetching cached statistics:', err.message);

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  }
});

module.exports = router;
