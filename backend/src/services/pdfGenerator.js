'use strict';

const puppeteer = require('puppeteer');

/**
 * Launches a headless Chromium browser, navigates to the frontend dashboard,
 * waits for the data to fully load, and returns the page as a PDF buffer.
 *
 * @param {string} frontendUrl - URL of the frontend to render (e.g., http://frontend:3000)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateDashboardPdf(frontendUrl) {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a wide viewport so the layout matches the desktop dashboard
    await page.setViewport({ width: 1600, height: 900 });

    // Navigate to the frontend and wait until the network is fully idle
    await page.goto(frontendUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the main dashboard to be visible (not the loading spinner)
    await page.waitForSelector('#main .card', { timeout: 30000 });

    // Small extra delay for charts/animations to finish rendering
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateDashboardPdf };
