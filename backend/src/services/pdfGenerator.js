'use strict';

const puppeteer = require('puppeteer');
async function setupPage(frontendUrl) {
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

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(frontendUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#main .card', { timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return { browser, page };
}

/**
 * Generates a seamless PDF dashboard.
 */
async function generateDashboardPdf(frontendUrl) {
  let browserInstance;
  try {
    const { browser, page } = await setupPage(frontendUrl);
    browserInstance = browser;

    // Expand category lists to show all categories in the PDF
    await page.evaluate(async () => {
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Show') && btn.textContent.includes('More')) {
          btn.click();
        }
      });
      // Wait a tiny moment for React to render the extra items
      await new Promise(r => setTimeout(r, 300));
    });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // Use the unique CSS @page dimensions
      outline: true,           // Add PDF bookmarks
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return pdfBuffer;
  } finally {
    if (browserInstance) await browserInstance.close();
  }
}

/**
 * Generates a standalone HTML report with embedded styles.
 */
async function generateDashboardHtml(frontendUrl) {
  let browserInstance;
  try {
    const { browser, page } = await setupPage(frontendUrl);
    browserInstance = browser;

    const html = await page.evaluate(async () => {
      // 0. Expand category lists
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Show') && btn.textContent.includes('More')) {
          btn.click();
        }
      });

      // Give React a tiny moment to render the extra items
      await new Promise(r => setTimeout(r, 200));

      // 1. Inline all external stylesheets
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of links) {
        try {
          const res = await fetch(link.href);
          const css = await res.text();
          const style = document.createElement('style');
          style.textContent = css;
          document.head.appendChild(style);
          link.remove();
        } catch (e) {
          console.error('Failed to inline stylesheet', link.href);
        }
      }

      // 2. Remove scripts to make it a static snapshot
      document.querySelectorAll('script').forEach(el => el.remove());

      // 3. Ensure base layout styles are preserved without breaking existing ones
      const baseStyles = document.createElement('style');
      baseStyles.textContent = `
        body { background: #070c1a !important; color: #fff !important; margin: 0; padding: 0; }
        /* Add some padding so it doesn't hug the edges when viewed as a file */
        .app { min-height: 100vh; }
      `;
      document.head.appendChild(baseStyles);

      // 4. Remove interactive buttons (Refresh, Hamburger, Download report footer, and Category Toggles)
      document.querySelectorAll('#btn-refresh, .hamburger-btn, .sidebar-footer').forEach(el => el.remove());
      
      // Remove all "Show More" / "Show Less" buttons specifically
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Show') && (btn.textContent.includes('More') || btn.textContent.includes('Less'))) {
          btn.remove();
        }
      });

      return '<!DOCTYPE html>\n<html>\n' + document.documentElement.innerHTML + '\n</html>';
    });

    return Buffer.from(html, 'utf-8');
  } finally {
    if (browserInstance) await browserInstance.close();
  }
}

module.exports = { generateDashboardPdf, generateDashboardHtml };
