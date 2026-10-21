/* ============================================================================
   DL LECTURE 3 STUDY — headless "Export PDF" (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-lecture3-study/pdf.mjs <out.pdf> [--deep] [--theme=jade|coral|arcade]

   Does what the Export PDF button does, without a print dialog: window.print
   is stubbed before the page loads, the real button is clicked (ticking
   "include §12.1–12.3 deep dives" first with --deep), then the page is
   rendered in print media to an A4 PDF. Writes <out.pdf> and <out>.txt
   (pdftotext -enc UTF-8 -layout) and prints the page count and size. Dev server on 5173
   (SITE_URL to override). page-check.mjs runs the same path with assertions.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const POPPLER = (exe) => (fs.existsSync(`C:/Program Files/Git/mingw64/bin/${exe}.exe`) ? `C:/Program Files/Git/mingw64/bin/${exe}.exe` : exe);
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'lecture3-read-play.pdf');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e}`));
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; window.__printTitle = document.title; };
  }, flags.theme || 'jade');
  await page.goto(`${BASE}/portal/dl-lecture-3-study`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dl3s-sec', { timeout: 30000 });
  if (flags.deep) await page.click('.dl3s-export__opt input');
  await page.click('.dl3s-export__row .dl3s-btn');
  await page.waitForFunction(() => window.__printCalls === 1, { timeout: 10000 });
  const st = await page.evaluate(() => ({ cls: document.documentElement.className, title: window.__printTitle }));
  console.log(`print mode: ${st.cls} · title "${st.title}"`);
  await page.emulateMediaType('print');
  await page.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const after = await page.evaluate(() => ({ cls: document.documentElement.className, title: document.title }));
  console.log(`after: class "${after.cls}" · title "${after.title}"`);
  const txt = OUT.replace(/\.pdf$/i, '.txt');
  execFileSync(POPPLER('pdftotext'), ['-enc', 'UTF-8', '-layout', OUT, txt]);
  const info = execFileSync(POPPLER('pdfinfo'), [OUT]).toString();
  const pages = /Pages:\s+(\d+)/.exec(info)?.[1];
  console.log(`saved ${OUT} · ${pages} pages · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · text ${txt}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
}
