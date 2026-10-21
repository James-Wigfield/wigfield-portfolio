/* ============================================================================
   DL LECTURE 3 STUDY — section screenshots (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-lecture3-study/shot.mjs <outDir> [ids…] [--theme=jade|coral|arcade]
          [--width=1440] [--part=all|play|nb|read|hero|index] [--full] [--nlm]

   For each section id (s00, s12, … or "all") it saves
     <outDir>/<id>-<part>-<theme>-<width>.png
   part "play" is the Play beat, "nb" the notebook page, "read" the Read beat,
   "all" the whole section; "hero" (the title block, with the export UI) and
   "index" (the rail, or the dropdown when narrow) ignore ids. --nlm opens the
   NotebookLM prompt panel first. --full adds one full-page screenshot.
   Prints every console error/warning it saw. Dev server on 5173 (SITE_URL to
   override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
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
  }, theme);
  await page.goto(`${BASE}/portal/dl-lecture-3-study`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dl3s-sec', { timeout: 30000 });
  // element shots: keep the sticky bars from painting over the element
  if (!flags.full) await page.addStyleTag({ content: '.dl3s-bar, .portal__topbar, .dl3s-rail { position: static !important; }' });
  if (flags.nlm) await page.click('.dl3s-export__nlm');
  await new Promise((r) => setTimeout(r, 600));
  if (part === 'hero' || part === 'index') {
    if (part === 'index' && width < 920) {
      await page.click('.dl3s-bar__actions .dl3s-btn');
      await new Promise((r) => setTimeout(r, 300));
    }
    const el = await page.$(part === 'hero' ? '.dl3s-hero' : '.dl3s-rail, .dl3s-drop');
    const file = path.join(OUT, `${part}-${theme}-${width}.png`);
    if (el) { await el.screenshot({ path: file }); console.log(`saved ${file}`); } else console.log(`missing ${part}`);
    ids = [];
  } else if (!ids.length || ids.includes('all')) {
    ids = await page.$$eval('.dl3s-sec', (els) => els.map((e) => e.id.replace('dl3s-', '')));
  }
  for (const id of ids) {
    const sel = {
      all: `#dl3s-${id}`,
      play: `#dl3s-${id} .dl3s-beat--play`,
      nb: `#dl3s-${id}-nb`,
      read: `#dl3s-${id} .dl3s-beat--read`,
    }[part];
    const el = await page.$(sel);
    if (!el) { console.log(`missing ${sel}`); continue; }
    await el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 250));
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
