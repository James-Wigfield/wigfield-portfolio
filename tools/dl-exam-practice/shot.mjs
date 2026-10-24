/* ============================================================================
   DL EXAM PRACTICE — screenshots (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/shot.mjs <outDir> [--paper=sample|A|B] [--q=0..4]
          [--theme=jade|coral|arcade] [--width=1440] [--reveal] [--mark=n]
          [--filter=L9] [--full] [--reduce] [--nlm] [--tag=name]

   Opens /portal/dl-exam-practice on one paper and page (0 = cover), optionally
   reveals every part of that question (--reveal), sets every self-mark to n
   (--mark), applies a lecture filter, opens the NotebookLM dropdown (--nlm),
   then saves the viewport (or the full page with --full) to
     <outDir>/<tag|paper-q>-<theme>-<width>.png
   window.print is stubbed so nothing can open a dialog. Prints every console
   error/warning it saw. Dev server on 5181 (SITE_URL to override).
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
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'shots');
const theme = flags.theme || 'jade';
const width = Number(flags.width || 1440);
const paper = flags.paper || 'sample';
const q = Number(flags.q ?? 1);
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e}`));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  if (flags.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((t, p, n, f) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try {
      localStorage.setItem('portal:theme', t);
      localStorage.setItem('dlxp:paper', JSON.stringify(p));
      localStorage.setItem('dlxp:at', JSON.stringify({ [p]: n }));
      localStorage.setItem('dlxp:filter', JSON.stringify(f));
    } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  }, theme, paper, q, flags.filter || 'all');
  await page.goto(`${BASE}/portal/dl-exam-practice`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dlxp-sheet', { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  if (flags.reveal) {
    await page.evaluate(() => [...document.querySelectorAll('.dlxp-qbar button')].find((b) => /Reveal all/.test(b.textContent))?.click());
    await sleep(1800);
  }
  if (flags.mark !== undefined) {
    const n = Number(flags.mark);
    await page.evaluate((v) => {
      document.querySelectorAll('.dlxp-mark').forEach((g) => {
        const btns = g.querySelectorAll('.dlxp-mark__n');
        (btns[Math.min(v, btns.length - 1)])?.click();
      });
    }, n);
    await sleep(500);
  }
  if (flags.nlm) {
    await page.evaluate(() => document.querySelector('.dlxp-export__toggle')?.click());
    await sleep(300);
  }
  await sleep(600);
  const tag = flags.tag || `${paper}-q${q}${flags.reveal ? '-rev' : ''}`;
  const file = path.join(OUT, `${tag}-${theme}-${width}.png`);
  if (flags.full) await page.screenshot({ path: file, fullPage: true });
  else if (flags.sheet !== undefined) {
    // element shots: keep the portal's sticky topbar from painting over the sheet
    await page.addStyleTag({ content: '.portal__topbar { position: static !important; }' });
    const els = await page.$$('.dlxp-turn > .dlxp-sheet');
    const el = els[Number(flags.sheet)];
    if (!el) throw new Error(`no sheet ${flags.sheet} (have ${els.length})`);
    await el.scrollIntoView();
    await sleep(300);
    await el.screenshot({ path: file });
  } else {
    if (flags.scroll) await page.evaluate((y) => window.scrollTo(0, y), Number(flags.scroll));
    else await page.evaluate(() => document.querySelector('.dlxp-bar')?.scrollIntoView());
    await sleep(300);
    await page.screenshot({ path: file });
  }
  const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log(`saved ${file} · scrollWidth ${sw.sw} / clientWidth ${sw.cw}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
}
