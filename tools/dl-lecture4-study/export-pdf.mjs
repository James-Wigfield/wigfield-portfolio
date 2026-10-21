/* ============================================================================
   DL LECTURE 4 STUDY — headless "Read + Play" PDF export
   (puppeteer-core + local Edge, through the portal gate like page-check)
   ----------------------------------------------------------------------------
     node tools/dl-lecture4-study/export-pdf.mjs <out.pdf> [--theme=arcade] [--focus]

   Does what the page's Export PDF button does, without a print dialog:
   window.print is stubbed before the page loads, the button is clicked
   (print mode on, labs in their finished state, LaTeX lines added), the page
   is printed with page.pdf (A4, print media), and then 'afterprint' is
   dispatched so the page restores itself. Prints the page count, the size
   and whether the stub was called once. --focus starts in focus mode (the
   overlay fallback) to exercise leaving and re-entering it.
   Dev server on 5173 (SITE_URL to override).
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
const out = path.resolve(args.find((a) => !a.startsWith('--')) || 'dl4s-read-play.pdf');
const theme = flags.theme || 'jade';

export async function exportPdf(page, file) {
  // print mode through the real button; the stub counts the call
  await page.click('.dl4s-export__btn');
  await page.waitForFunction(() => (window.__printCalls || 0) > 0, { timeout: 20000 });
  const state = await page.evaluate(() => ({
    calls: window.__printCalls,
    cls: document.documentElement.classList.contains('dl4s-printing'),
    title: document.title,
    ptex: document.querySelectorAll('.dl4s-ptex').length,
  }));
  await page.emulateMediaType('print');
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await new Promise((r) => setTimeout(r, 600));
  return state;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
  const msgs = [];
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') msgs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push(`pageerror: ${e}`));
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluateOnNewDocument((t, focus) => {
      sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
      try { localStorage.setItem('portal:theme', t); } catch { /* ignore */ }
      window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
      if (focus) delete Element.prototype.requestFullscreen; // the overlay fallback
    }, theme, !!flags.focus);
    await page.goto(`${BASE}/portal/dl-lecture-4-study`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dl4s-sec', { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));
    if (flags.focus) {
      await page.click('.dl4s-hero__actions .dl4s-btn--primary');
      await new Promise((r) => setTimeout(r, 800));
    }
    const state = await exportPdf(page, out);
    const after = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('dl4s-printing'),
      title: document.title,
      ptex: document.querySelectorAll('.dl4s-ptex').length,
      focus: document.querySelector('.dl4s').classList.contains('dl4s--focus'),
    }));
    const bytes = fs.statSync(out).size;
    const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`saved ${out}`);
    console.log(`pages ${pages} · ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`while printing: print() calls ${state.calls}, class ${state.cls}, title “${state.title}”, LaTeX lines ${state.ptex}`);
    console.log(`after afterprint: class ${after.cls}, title “${after.title}”, LaTeX lines ${after.ptex}, focus mode ${after.focus}`);
  } finally {
    await browser.close();
    console.log(msgs.length ? `console:\n${msgs.join('\n')}` : 'console: clean');
  }
}
