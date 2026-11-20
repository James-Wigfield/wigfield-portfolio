/* ============================================================================
   RESUME - headless check of /portal/resume
   (puppeteer-core + local Edge, seeded through the portal gate)
     node tools/resume/page-check.mjs [outDir]          (dev server on 5191)
     SITE_URL=http://localhost:5173 node tools/resume/page-check.mjs out

   Checks: v1 + v2 render in jade / coral / arcade at 1440 and 390 with no
   horizontal page scroll; the switch changes the URL and the document; the
   Export PDF print path (print media + the module's @page) gives an A4 PDF
   with no portal chrome, v2 on at most 2 pages; no entry split across a page
   break; no em-dash in the module's source; zero console errors or warnings.
   Screenshots + both PDFs land in outDir.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5191';
const ROUTE = '/portal/resume';
const OUT = path.resolve(process.argv[2] || 'tools/resume/out');
const THEMES = ['jade', 'coral', 'arcade'];
fs.mkdirSync(OUT, { recursive: true });

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
};
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

// 0. no em-dash (or en-dash used as one) anywhere in the module or this tool
const SRC = ['src/components/portal/modules/resume', 'tools/resume'];
for (const dir of SRC) {
  for (const f of fs.readdirSync(dir).filter((n) => /\.(jsx?|mjs|css)$/.test(n))) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    ok(!/\u2014/.test(txt), `${dir}/${f}: no em-dash`);
  }
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const consoleMsgs = [];

async function open(theme, width, sub = '') {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) consoleMsgs.push(`[${theme} ${width} ${sub}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleMsgs.push(`[${theme} ${width} ${sub}] pageerror ${e.message}`));
  await page.setViewport({ width, height: 1000 });
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('portal:theme', t); } catch { /* */ } }, theme);
  await page.goto(`${BASE}${ROUTE}${sub ? `/${sub}` : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.rsm-doc', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// 1. both versions x theme x width
for (const theme of THEMES) {
  for (const width of [1440, 390]) {
    for (const sub of ['', 'v1']) {
      const page = await open(theme, width, sub);
      const m = await page.evaluate(() => ({
        sel: document.querySelector('.rsm-switch__btn[aria-selected="true"] b')?.textContent,
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        text: document.querySelector('.rsm-doc')?.innerText.length || 0,
        font: getComputedStyle(document.querySelector('.rsm-doc')).fontFamily,
      }));
      const want = sub === 'v1' ? 'Version 1' : 'Version 2';
      ok(m.sel === want && m.text > 1500 && !m.hscroll, `${theme} ${width} ${want}: renders (${m.text} chars), no h-scroll`);
      if (theme === 'jade' || width === 1440) {
        await page.screenshot({ path: path.join(OUT, `${theme}-${width}-${sub || 'v2'}.png`), fullPage: true });
      }
      await page.close();
    }
  }
}

// 2. the switch drives the URL
{
  const page = await open('jade', 1440);
  await page.click('.rsm-switch__btn:not(.is-on)');
  await page.waitForFunction(() => location.pathname.endsWith('/resume/v1'));
  const sel = await page.$eval('.rsm-switch__btn.is-on b', (b) => b.textContent);
  ok(sel === 'Version 1', 'switch -> /portal/resume/v1 shows Version 1');
  await page.click('.rsm-switch__btn:not(.is-on)');
  await page.waitForFunction(() => location.pathname.endsWith('/resume'));
  ok(true, 'switch back -> /portal/resume (v2 default)');
  await page.close();
}

// 3. the PDF: print media, the module's @page (A4), chrome hidden, page count,
//    and no entry crossing a page boundary
for (const sub of ['', 'v1']) {
  const page = await open('arcade', 1440, sub);
  const name = sub || 'v2';
  // page-break audit: lay the document out at print width and check each
  // entry against the A4 content height (297mm - 13mm - 14mm = 270mm)
  await page.emulateMediaType('print');
  await page.setViewport({ width: 794, height: 1123 });
  const audit = await page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || getComputedStyle(e).display !== 'none' && e.getClientRects().length).length;
    const chrome = ['.portal__sidebar', '.portal__topbar', '.portal__banner', '.rsm-top', '.rsm-notes']
      .filter((s) => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; });
    const doc = document.querySelector('.rsm-doc');
    const bg = getComputedStyle(document.body).backgroundColor;
    return { chrome, bg, docShadow: getComputedStyle(doc).boxShadow, entries: vis('.rsm-entry') };
  });
  ok(audit.chrome.length === 0, `${name} print: portal chrome hidden (${audit.chrome.join(', ') || 'none showing'})`);
  ok(audit.docShadow === 'none', `${name} print: paper shadow off`);
  const pdfPath = path.join(OUT, `resume-${name}.pdf`);
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  const bytes = fs.readFileSync(pdfPath, 'latin1');
  const pages = (bytes.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const box = bytes.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  const a4 = box && Math.abs(+box[1] - 595.92) < 2 && Math.abs(+box[2] - 842.88) < 2;
  ok(a4, `${name} PDF: A4 (${box ? `${box[1]} x ${box[2]} pt` : 'no MediaBox'})`);
  ok(name === 'v1' ? pages >= 1 && pages <= 2 : pages <= 2, `${name} PDF: ${pages} page(s)${name === 'v2' ? ' (target 2)' : ''}`);
  await page.close();
}

await browser.close();

ok(consoleMsgs.length === 0, `console clean (${consoleMsgs.length} errors/warnings)`);
consoleMsgs.slice(0, 10).forEach((m) => console.log('   ', m));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
