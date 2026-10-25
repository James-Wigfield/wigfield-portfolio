/* ============================================================================
   DL CODE LAB — measure every card's printed height (dev helper)
   ----------------------------------------------------------------------------
     node tools/dl-codelab/measure.mjs

   Puts the page in print mode (window.print stubbed), emulates print media
   at A4 width and prints each section's cards with their height as a share
   of one A4 page's content area (276 mm = 1,043 CSS px), plus a greedy
   estimate of the pages each section needs (cards never split, every
   section starts a page). Dev server on 5182 (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5182';
const PAGE_PX = (276 / 25.4) * 96;

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
try {
  const page = await browser.newPage();
  // A4 width less the 10 mm side margins, so print layout matches the PDF's
  await page.setViewport({ width: Math.round((190 / 25.4) * 96), height: 1100, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
  });
  await page.goto(`${BASE}/portal/dl-code-lab`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dlc-sec');
  await page.evaluate(() => [...document.querySelectorAll('.dlc-export button')].find((b) => /Export PDF/.test(b.textContent))?.click());
  await page.waitForFunction(() => window.__printCalls === 1, { timeout: 30000 });
  await page.emulateMediaType('print');
  await new Promise((r) => setTimeout(r, 800));
  const secs = await page.evaluate(() => [...document.querySelectorAll('.dlc-sec')].map((s) => ({
    id: s.dataset.sec,
    head: s.querySelector('.dlc-sec__head').getBoundingClientRect().height,
    items: [...s.querySelectorAll(':scope .dlc-lp__head, :scope .dlc-lp__facts, :scope .dlc-card')].map((el) => ({
      what: el.dataset.card || el.className.split(' ')[0],
      h: el.getBoundingClientRect().height,
      parts: el.dataset.card ? ['.dlc-card__head', '.dlc-card__why', '.dlc-card__main', '.dlc-card__colA', '.dlc-card__colB', '.dlc-move--pdraw', '.dlc-move--count', '.dlc-card__foot']
        .map((q) => `${q.replace(/\.dlc-(card__|move--)/, '')} ${Math.round(el.querySelector(q)?.getBoundingClientRect().height ?? 0)}`).join(' · ') : '',
    })),
  })));
  let total = 1;
  secs.forEach((s) => {
    let pages = 1;
    let used = s.head;
    s.items.forEach((it) => {
      if (used + it.h > PAGE_PX) { pages += 1; used = 0; }
      used += it.h;
    });
    total += pages;
    console.log(`\n${s.id}: ~${pages} pages`);
    s.items.forEach((it) => console.log(`  ${it.what.padEnd(22)} ${(it.h / PAGE_PX * 100).toFixed(0).padStart(3)}%  ${it.parts}`));
  });
  console.log(`\nestimate: ${total} pages (cover + sections)`);
} finally {
  await browser.close();
}
