/* Screenshots of the "Abstract options" tab in the light (jade) and dark (arcade)
   themes, for looking at by eye. Needs the dev server on 5199.
     node tools/dissertation-diff/abstract-shots.mjs <out-dir> [option-n] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.SITE_URL || 'http://127.0.0.1:5199';
const out = process.argv[2] || 'abstract-shots';
const n = process.argv[3] || '3';
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  });
  await page.goto(`${BASE}/portal/dissertation-red-pen/abstract-options/${n}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.abo-prose', { timeout: 20000 });
  await sleep(600);
  await page.screenshot({ path: path.join(out, 'light-top.png') });
  await page.screenshot({ path: path.join(out, 'light-full.png'), fullPage: true });
  await page.click('button[aria-label="Arcade theme"]').catch(() => {});
  await sleep(600);
  await page.screenshot({ path: path.join(out, 'dark-top.png') });
  await page.screenshot({ path: path.join(out, 'dark-full.png'), fullPage: true });
  await page.click('button[aria-label="Jade theme"]').catch(() => {});
  console.log('errors:', errors.length ? errors : 'none');
} finally {
  await browser.close();
}
