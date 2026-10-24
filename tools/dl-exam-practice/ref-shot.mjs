/* ============================================================================
   DL EXAM PRACTICE — screenshots of the old CITS5508 Sample Exam (reference)
   (puppeteer-core + local Edge, through the hub's PIN gate)
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/ref-shot.mjs <outDir> [--width=1440]

   Opens /hub/cits5508 → Sample Exam with "Exam-paper mode" on, saves the
   list (<outDir>/old-list-<width>.png), then opens the first worked solution
   and reveals every step (<outDir>/old-solution-<width>.png). It is the look
   the new Exam Practice page is measured against; it never changes the old
   page. Dev server on 5181 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5181';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'ref-shots');
const width = Number(flags.width || 1440);
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('hub_auth', '1');
    try { localStorage.setItem('cits5508_exam_lightmode', '1'); } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/hub/cits5508`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sample Exam')?.click());
  await page.waitForSelector('.exq-card', { timeout: 20000 });
  await sleep(600);
  const list = path.join(OUT, `old-list-${width}.png`);
  await page.screenshot({ path: list });
  console.log(`saved ${list}`);
  await page.evaluate(() => document.querySelector('.exq-card .exq-sol-open')?.click());
  await page.waitForSelector('.cheat-paper', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.exq-reveal-all')?.click());
  await sleep(500);
  const sol = path.join(OUT, `old-solution-${width}.png`);
  const el = await page.$('.cheat-paper');
  await el.screenshot({ path: sol });
  console.log(`saved ${sol}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
}
