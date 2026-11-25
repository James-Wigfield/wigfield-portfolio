/* ============================================================================
   DREAM ROOMS · capture: type a text file into the REAL capture page
   (/dreams/new) headlessly at 390 px, press Save, wait for the upload, print
   the new id. For the self-test and fixtures, never for real dreams.
     node tools/dream-rooms/capture.mjs <file.txt> [--night YYYY-MM-DD] [--site http://127.0.0.1:8796]
   Prints the id and night only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { config } from './lib/api.mjs';
import { args } from './lib/work.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const a = args();
const file = a._[0];
if (!file) {
  console.log('usage: node tools/dream-rooms/capture.mjs <file.txt> [--night YYYY-MM-DD] [--site <url>]');
  process.exit(1);
}
const text = fs.readFileSync(file, 'utf8');
const cfg = config();
const SITE = (a.site || process.env.DREAMS_SITE || new URL(cfg.base).origin).replace(/\/+$/, '');
const token = cfg.token;

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=390,844'],
});
let code = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('dr:token', t), token);
  await page.goto(`${SITE}/dreams/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-dr="capture-text"]:not([disabled])', { timeout: 20000 });
  if (typeof a.night === 'string') {
    await page.click('[data-dr="night-chip"]');
    await page.waitForSelector('[data-dr="night-input"]');
    await page.evaluate((v) => {
      const el = document.querySelector('[data-dr="night-input"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, a.night);
    await page.waitForFunction((v) => document.querySelector('[data-dr="night-chip"]')?.dataset.date === v, { timeout: 5000 }, a.night);
    await page.focus('[data-dr="capture-text"]');
  }
  await page.keyboard.type(text, { delay: 0 });
  await page.waitForSelector('[data-dr="autosave"][data-state="saved"]', { timeout: 10000 });
  await page.click('[data-dr="save"]');
  await page.waitForSelector('[data-dr="saved"][data-upload="uploaded"]', { timeout: 30000 });
  const id = await page.$eval('[data-dr="saved"]', (el) => el.dataset.id);
  const night = await page.$eval('[data-dr="night-chip"]', (el) => el.dataset.date).catch(() => '?');
  console.log(`captured ${id}  (night ${night}, ${text.length} chars, via ${SITE}/dreams/new)`);
  if (errors.length) {
    console.log(`console errors: ${errors.length}`);
    code = 1;
  }
} catch (err) {
  console.error(`capture failed: ${String(err.message || err).split('\n')[0]}`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
