/* ============================================================================
   DEV SETUP — headless check of /portal/dev-setup
   (puppeteer-core + local Edge, seeded through the portal gate)
     node tools/dev-setup/page-check.mjs [outDir]        (dev server on 5191)
     SITE_URL=http://localhost:5173 node tools/dev-setup/page-check.mjs out

   Checks: every tab renders in jade / coral / arcade at 1440 and 390 with no
   horizontal page scroll; layout + look switchers and mouse hotspots react;
   checklist ticks survive a reload; storage that throws doesn't break it;
   zero console errors or warnings. Screenshots land in outDir.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5191';
const ROUTE = '/portal/dev-setup';
const OUT = path.resolve(process.argv[2] || 'tools/dev-setup/out');
const TABS = ['', 'layout', 'launch', 'mouse', 'terminal', 'order'];
const THEMES = ['jade', 'coral', 'arcade'];
fs.mkdirSync(OUT, { recursive: true });

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
};
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const consoleMsgs = [];

async function open(theme, width, sub = '', extra) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) consoleMsgs.push(`[${theme} ${width} ${sub}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleMsgs.push(`[${theme} ${width} ${sub}] pageerror ${e.message}`));
  await page.setViewport({ width, height: 900 });
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('portal:theme', t); } catch { /* */ } }, theme);
  if (extra) await page.evaluateOnNewDocument(extra);
  await page.goto(`${BASE}${ROUTE}${sub ? `/${sub}` : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dws-panel', { timeout: 15000 });
  return page;
}

// 1. every tab × theme × width
for (const theme of THEMES) {
  for (const width of [1440, 390]) {
    for (const sub of TABS) {
      const page = await open(theme, width, sub);
      const m = await page.evaluate(() => ({
        sel: document.querySelector('.dws-tabs__tab[aria-selected="true"]')?.textContent,
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        text: document.querySelector('.dws-panel')?.innerText.length || 0,
      }));
      ok(m.text > 200 && !m.hscroll, `${theme} ${width} ${sub || 'now'}: renders (${m.text} chars), no h-scroll (${m.sel})`);
      if (width === 1440 || theme === 'jade') {
        await page.screenshot({ path: path.join(OUT, `${theme}-${width}-${sub || 'now'}.png`), fullPage: true });
      }
      await page.close();
    }
  }
}

// 2. interactions
{
  const page = await open('jade', 1440, 'layout');
  const count = async () => page.$$eval('.dws-mon .dws-zone[data-role="claude"]', (z) => z.length);
  ok((await count()) === 6, 'layout A shows 6 Claude zones');
  await page.evaluate(() => [...document.querySelectorAll('.dws-seg button')].find((b) => b.textContent.startsWith('B'))?.click());
  ok((await count()) === 9, 'layout B shows 9 Claude zones');
  await page.evaluate(() => [...document.querySelectorAll('.dws-seg button')].find((b) => b.textContent.startsWith('Today'))?.click());
  ok((await count()) === 5, 'today shows 5 Claude zones');
  await page.close();
}
{
  const page = await open('jade', 1440, 'mouse');
  await page.evaluate(() => document.querySelectorAll('.dws-hot')[1].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const on = await page.$$eval('.dws-map tbody tr[data-on="true"] th', (t) => t.map((x) => x.textContent));
  ok(on.length === 1 && on[0].startsWith('Thumb wheel'), `mouse hotspot 3 selects the thumb wheel row (${on})`);
  await page.close();
}
{
  const page = await open('jade', 1440, 'terminal');
  await page.evaluate(() => [...document.querySelectorAll('.dws-seg button')].find((b) => b.textContent.startsWith('Glass'))?.click());
  const glass = await page.$eval('.dws-term', (t) => t.dataset.glass);
  const snip = await page.$eval('.dws-ed__body', (b) => b.innerText);
  ok(glass === 'true' && snip.includes('"opacity": 85') && !snip.includes('Catppuccin'), 'Glass look swaps preview + snippet');
  await page.close();
}
{
  const page = await open('jade', 1440, 'order');
  await page.evaluate(() => { try { localStorage.removeItem('dws:done'); } catch { /* */ } });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('.dws-order input');
  await page.reload({ waitUntil: 'networkidle0' });
  const ticked = await page.$$eval('.dws-order li[data-done="true"]', (l) => l.length);
  ok(ticked === 1, 'checklist tick survives reload');
  await page.evaluate(() => localStorage.removeItem('dws:done'));
  await page.close();
}
{
  const page = await open('jade', 1440, 'order', () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const n = await page.$$eval('.dws-order li', (l) => l.length);
  ok(n === 10, 'renders with storage blocked');
  await page.close();
}

await browser.close();
const relevant = consoleMsgs.filter((m) => !/blocked/.test(m));
ok(relevant.length === 0, `console clean (${relevant.length})`);
relevant.slice(0, 10).forEach((m) => console.log('   ', m));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
