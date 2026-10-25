/* ============================================================================
   DL TRICKY TOPICS — screenshots of one topic (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture9-study/shot.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/shot.mjs <outDir> <topicId> [ids…]
          [--theme=jade|coral|arcade] [--width=1440] [--part=all|play|read|nb|open|measure]
          [--full] [--reduce]

   For each item id (open, a step id, drill, p1 … or "all") it saves
     <outDir>/<topic>-<id>-<part>-<theme>-<width>.png
   part "play" = the Play beat, "read" = the Read beat, "nb" = a notebook
   page (ids p1, p2 …), "measure" = a notebook page's hidden 760 px copy,
   "open" = the opener. --full adds one full-page screenshot. Prints every
   console error/warning it saw. Dev server on 5184 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5184';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const pos = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve(pos[0] || 'shots');
const topic = pos[1];
let ids = pos.slice(2);
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
  if (flags.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((t) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  }, theme);
  await page.goto(`${BASE}/portal/dl-tricky-topics/${topic}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dltt-sec', { timeout: 30000 });
  if (!flags.full) await page.addStyleTag({ content: '.dltt-bar, .dltt-tabs, .portal__topbar, .dltt-rail { position: static !important; }' });
  await new Promise((r) => setTimeout(r, 1200));
  if (!ids.length || ids.includes('all')) ids = await page.$$eval('.dltt-sec', (els, t) => els.map((e) => e.id.replace(`dltt-${t}-`, '')), topic);
  for (const id of ids) {
    const sec = `#dltt-${topic}-${id}`;
    const sel = {
      all: sec,
      play: `${sec} .dltt-beat--play`,
      read: `${sec} .dltt-beat--read`,
      nb: `${sec}-nb`,
      open: `#dltt-${topic}-open`,
    }[part];
    if (part === 'measure') {
      const box = await page.$(`.dltt-nb:has([data-page="${id}"]) .dltt-measure`);
      if (!box) { console.log(`missing measure ${id}`); continue; }
      await page.evaluate((el) => { el.style.cssText = 'position:static;width:auto;height:auto;overflow:visible;visibility:visible'; }, box);
      const file = path.join(OUT, `${topic}-${id}-measure-${theme}.png`);
      await (await box.$('.dltt-measure__box')).screenshot({ path: file });
      console.log(`saved ${file}`);
      continue;
    }
    const el = await page.$(sel);
    if (!el) { console.log(`missing ${sel}`); continue; }
    await el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 500));
    const file = path.join(OUT, `${topic}-${id}-${part}-${theme}-${width}.png`);
    await el.screenshot({ path: file });
    console.log(`saved ${file}`);
  }
  if (flags.full) {
    const file = path.join(OUT, `${topic}-full-${theme}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`saved ${file}`);
  }
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
}
