/* ============================================================================
   DL EXAM PRACTICE — make the Export PDF headlessly (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/pdf.mjs <outDir> [--theme=arcade] [--pages=1,4,9]

   A copy of tools/dl-lecture8-study/pdf.mjs. Clicks Export PDF with
   window.print stubbed before the page loads (a real dialog would hang),
   then prints the page in that same print mode with page.pdf (A4, the
   page's own @page margins), runs pdftotext on it, and renders the listed
   pages with pdftoppm. Writes <outDir>/exam-practice.pdf, exam-practice.txt
   and page-N.png. Dev server on 5181 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5181';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || 'pdf-out');
fs.mkdirSync(OUT, { recursive: true });
const theme = flags.theme || 'jade';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e}`));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  }, theme);
  await page.goto(`${BASE}/portal/dl-exam-practice`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dlxp-sheet', { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('.dlxp-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
  await page.waitForFunction(() => window.__printCalls === 1, { timeout: 30000 });
  console.log(`print() called: ${await page.evaluate(() => window.__printCalls)} · title: ${await page.title()}`);
  await page.emulateMediaType('print');
  await new Promise((r) => setTimeout(r, 800));
  const file = path.join(OUT, 'exam-practice.pdf');
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await new Promise((r) => setTimeout(r, 300));
  console.log(`after: html class "${await page.evaluate(() => document.documentElement.className)}" · book mounted: ${await page.evaluate(() => !!document.querySelector('.dlxp-book'))} · title: ${await page.title()}`);
  const size = fs.statSync(file).size;
  execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', file, path.join(OUT, 'exam-practice.txt')]);
  const info = execFileSync('pdfinfo', [file]).toString();
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  console.log(`saved ${file} · ${pages} pages · ${(size / 1024).toFixed(0)} KB`);
  const want = String(flags.pages || '1,2,3').split(',').map(Number).filter((n) => n >= 1 && n <= pages);
  want.forEach((n) => {
    execFileSync('pdftoppm', ['-png', '-r', '70', '-f', String(n), '-l', String(n), file, path.join(OUT, 'page')]);
  });
  console.log(`rendered pages ${want.join(', ')}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
}
