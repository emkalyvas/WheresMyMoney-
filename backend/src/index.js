'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const statisticsRouter = require('./routes/statistics');
const { generateDashboardPdf, generateDashboardHtml } = require('./services/pdfGenerator');
const { getStatistics } = require('./services/db');
const { startScheduler } = require('./services/reportScheduler');

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// Basic request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/statistics', statisticsRouter);

// On-demand PDF report download
app.get('/api/report/pdf', async (_req, res) => {
  try {
    console.log('[Report] Generating on-demand PDF report…');
    const frontendUrl = process.env.FRONTEND_INTERNAL_URL || `http://frontend:3000`;
    const pdfBuffer = await generateDashboardPdf(frontendUrl);

    const now = new Date();
    const filename = `WheresMyMoney_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) {
    console.error('[Report] Failed to generate PDF:', err);
    res.status(500).json({ error: 'Failed to generate PDF report.' });
  }
});

// On-demand HTML report download
app.get('/api/report/html', async (_req, res) => {
  try {
    console.log('[Report] Generating on-demand HTML report…');
    const frontendUrl = process.env.FRONTEND_INTERNAL_URL || `http://frontend:3000`;
    const htmlBuffer = await generateDashboardHtml(frontendUrl);

    const now = new Date();
    const filename = `WheresMyMoney_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.html`;

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': htmlBuffer.length,
    });
    res.end(htmlBuffer);
  } catch (err) {
    console.error('[Report] Failed to generate HTML:', err);
    res.status(500).json({ error: 'Failed to generate HTML report.' });
  }
});

// Health-check endpoint (useful for Docker & load balancers)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const { startCacheWorker } = require('./services/cacheWorker');

app.listen(config.port, () => {
  console.log(`WheresMyMoney! backend running on port ${config.port}`);
  console.log(`Firefly III: ${config.firefly.apiUrl}`);
  console.log(`Data from: ${config.calculations.startDate}`);

  // Start the background data cache worker
  startCacheWorker();

  // Start the monthly report scheduler
  startScheduler();
});
