// Screenshot /skippers pages headlessly (puppeteer-core + local Edge).
//   node tools/skippers/shots.mjs <outDir> <path>[,<path>…] [widths=1440,390] [themes=light,dark] [base=http://localhost:5173]
// Each shot: <outDir>/<slug>-<width>-<theme>.png. Prints console errors and
// any horizontal overflow. Exits 1 on either.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const [outDir, pathsArg, widthsArg = '1440,390', themesArg = 'light,dark', base = 'http://localhost:5173'] = process.argv.slice(2);
if (!outDir || !pathsArg) {
  console.error('usage: shots.mjs <outDir> <paths> [widths] [themes] [base]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const paths = pathsArg.split(',');
const widths = widthsArg.split(',').map(Number);
const themes = themesArg.split(',');
const full = process.env.FULL === '1';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
let bad = 0;
for (const theme of themes) {
  for (const w of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: w < 600 ? 844 : 900, deviceScaleFactor: w < 600 ? 2 : 1 });
    await page.evaluateOnNewDocument((t) => {
      try { localStorage.setItem('sk:theme', JSON.stringify(t)); } catch { /* */ }
    }, theme);
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    for (const p of paths) {
      errs.length = 0;
      await page.goto(base + p, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 900));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const slug = p.replace(/^\/+/, '').replace(/\//g, '_') || 'start';
      const file = path.join(outDir, `${slug}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: full });
      const flag = [];
      if (over > 0) { flag.push(`OVERFLOW ${over}px`); bad += 1; }
      if (errs.length) { flag.push(`ERRORS: ${errs.join(' | ').slice(0, 400)}`); bad += 1; }
      console.log(`${file}${flag.length ? '  ' + flag.join('  ') : ''}`);
    }
    await page.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
