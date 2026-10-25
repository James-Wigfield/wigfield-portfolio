/* ============================================================================
   DL TRICKY TOPICS — every notebook page's measured height (dev helper)
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/fits.mjs        (dev server on 5184; SITE_URL)
   Opens every topic in topics/index.js and prints each page's "n of 30
   rules" from its hidden 760 px measuring copy. page-check.mjs asserts the
   same budget independently.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/tricky-topics');
const { TOPICS } = await import(pathToFileURL(path.join(ROOT, 'topics/index.js')).href);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5184';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    window.print = () => {};
  });
  for (const t of TOPICS) {
    await page.goto(`${BASE}/portal/dl-tricky-topics/${t.id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dltt-fit[data-rules]:not([data-rules=""])', { timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    const fits = await page.$$eval('.dltt-fit', (els) => els.map((e) => `${e.dataset.page}: ${e.dataset.rules || '?'} rules`));
    console.log(`${t.id.padEnd(12)} ${fits.join(' · ')}`);
  }
} finally {
  await browser.close();
}
