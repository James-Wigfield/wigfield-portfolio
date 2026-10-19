/* ============================================================================
   DL PROJECT 2 — quick screenshots (puppeteer-core + Edge)
   ----------------------------------------------------------------------------
     node tools/dl-project2/shot.mjs <outDir> [theme=jade,coral,arcade] [width=1440,390]
            [full=1] [reduced=0] [settle=ms] [scroll=selector]
   Signs in through the portal gate the way the other checks do, opens
   /portal/dl-project-2 and writes <theme>-<width>.png. Prints console errors.
   SITE_URL overrides the dev server (default http://localhost:5173).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const [outDir = 'shots', ...rest] = process.argv.slice(2);
const kv = Object.fromEntries(rest.map((a) => a.split('=')));
const themes = (kv.theme || 'jade').split(',');
const widths = (kv.width || '1440').split(',').map(Number);
const full = kv.full !== '0';
const reduced = kv.reduced === '1';
const settle = Number(kv.settle || 1500);
const sub = kv.sub ? `/${kv.sub}` : '';
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const errors = [];
try {
  for (const theme of themes) {
    for (const width of widths) {
      const page = await browser.newPage();
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${theme} ${width}] ${m.type()}: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`[${theme} ${width}] pageerror: ${e}`));
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument((t) => {
        sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
        localStorage.setItem('portal:theme', t);
      }, theme);
      await page.goto(`${BASE}/portal/dl-project-2${sub}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.dlp2-sheet', { timeout: 20000 });
      if (kv.scroll) {
        await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), kv.scroll);
      }
      await new Promise((r) => setTimeout(r, settle));
      const file = path.join(outDir, `${theme}-${width}${kv.tag ? `-${kv.tag}` : ''}.png`);
      await page.screenshot({ path: file, fullPage: full });
      console.log('wrote', file);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.log(`\n${errors.length} console messages:`);
  for (const e of errors) console.log('  ', e);
} else console.log('no console errors or warnings');
