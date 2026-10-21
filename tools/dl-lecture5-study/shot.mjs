/* ============================================================================
   DL LECTURE 5 STUDY — section screenshots (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-lecture5-study/shot.mjs <outDir> [ids…] [--theme=jade|coral|arcade]
          [--width=1440] [--part=all|play|nb|read|hero] [--full] [--focus]

   For each section id (s00, s01, … or "all") it saves
     <outDir>/<id>-<part>-<theme>-<width>.png
   where part "play" is the Play beat, "nb" the notebook page, "read" the Read
   beat, "all" the whole section. --full adds one full-page screenshot.
   Prints every console error/warning it saw. Dev server on 5176 (SITE_URL to
   override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5176';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const pos = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve(pos[0] || 'shots');
let ids = pos.slice(1);
const theme = flags.theme || 'jade';
const width = Number(flags.width || 1440);
const part = flags.part || 'all';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e}`));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  }, theme);
  await page.goto(`${BASE}/portal/dl-lecture-5-study`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dl5s-sec', { timeout: 30000 });
  if (flags.focus) await page.evaluate(() => document.querySelector('.dl5s-hero__actions .dl5s-btn--primary')?.click());
  // element shots: keep the sticky bars from painting over the element
  if (!flags.full) await page.addStyleTag({ content: '.dl5s-bar, .portal__topbar, .dl5s-rail { position: static !important; }' });
  await new Promise((r) => setTimeout(r, 900));
  if (!ids.length || ids.includes('all')) ids = await page.$$eval('.dl5s-sec', (els) => els.map((e) => e.id.replace('dl5s-', '')));
  if (part === 'hero') ids = ['hero'];
  for (const id of ids) {
    const sel = {
      all: `#dl5s-${id}`,
      play: `#dl5s-${id} .dl5s-beat--play`,
      nb: `#dl5s-${id}-nb`,
      read: `#dl5s-${id} .dl5s-beat--read`,
      hero: '.dl5s-hero',
    }[part];
    const el = await page.$(sel);
    if (!el) { console.log(`missing ${sel}`); continue; }
    await el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 350));
    const file = path.join(OUT, `${id}-${part}-${theme}-${width}.png`);
    await el.screenshot({ path: file });
    console.log(`saved ${file}`);
  }
  if (flags.full) {
    const file = path.join(OUT, `full-${theme}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`saved ${file}`);
  }
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
}
