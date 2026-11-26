/* ============================================================================
   SPECTA SELECTA — headless check of /portal/specta-selecta
   (puppeteer-core + local Edge, seeded through the portal gate)
     node tools/specta-selecta/page-check.mjs <outDir>      (wrangler dev on 8788)
     SITE_URL=https://jameswigfield.com node tools/specta-selecta/page-check.mjs <outDir>

   Two passes: the real API (whatever the Worker answers, usually the empty
   state for now) and a mocked /status with two releases, so the filled-in
   page is checked too. Every tab in jade / coral / arcade at 1440 and 390:
   renders, no horizontal page scroll, no console errors. Screenshots → outDir.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8788';
const ROUTE = '/portal/specta-selecta';
if (!process.argv[2]) {
  console.error('usage: node tools/specta-selecta/page-check.mjs <outDir>');
  process.exit(1);
}
const OUT = path.resolve(process.argv[2]);
const TABS = ['', 'mac', 'windows', 'releases'];
const THEMES = ['jade', 'coral', 'arcade'];
fs.mkdirSync(OUT, { recursive: true });

const MOCK_STATUS = {
  configured: { updateKey: true, githubToken: true },
  github: { ok: true },
  releases: [
    {
      version: '0.2.0', tag: 'v0.2.0', publishedAt: '2026-11-27T02:00:00Z',
      notes: 'Faster start-up.\nFixes a crash when the window is resized.',
      assets: [
        { id: 201, name: 'Specta.Selecta_0.2.0_aarch64.dmg', size: 11_200_000, kind: 'mac-dmg' },
        { id: 202, name: 'Specta.Selecta_aarch64.app.tar.gz', size: 10_400_000, kind: 'mac-update' },
        { id: 203, name: 'Specta.Selecta_aarch64.app.tar.gz.sig', size: 420, kind: 'signature' },
        { id: 204, name: 'Specta.Selecta_0.2.0_x64-setup.exe', size: 6_100_000, kind: 'win-installer' },
        { id: 205, name: 'latest.json', size: 1300, kind: 'latest-json' },
      ],
    },
    {
      version: '0.1.0', tag: 'v0.1.0', publishedAt: '2026-11-26T10:00:00Z', notes: '',
      assets: [{ id: 101, name: 'Specta.Selecta_0.1.0_aarch64.dmg', size: 11_000_000, kind: 'mac-dmg' }],
    },
  ],
};

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
};
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const consoleMsgs = [];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

async function open(theme, width, sub, mock) {
  const page = await browser.newPage();
  const tag = `[${mock ? 'mock' : 'real'} ${theme} ${width} ${sub || 'latest'}]`;
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) consoleMsgs.push(`${tag} ${m.text()}`); });
  page.on('pageerror', (e) => consoleMsgs.push(`${tag} pageerror ${e.message}`));
  if (mock) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.endsWith('/api/specta-selecta/status')) {
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STATUS) });
      }
      if (u.endsWith('/api/specta-selecta/test-update')) {
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, version: '0.2.0', platforms: ['darwin-aarch64', 'darwin-aarch64-app', 'windows-x86_64', 'windows-x86_64-nsis'], rewrittenOk: true, refusesNoKey: true }) });
      }
      return req.continue();
    });
  }
  await page.setViewport({ width, height: 900 });
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('portal:theme', t); } catch { /* */ } }, theme);
  await page.goto(`${BASE}${ROUTE}${sub ? `/${sub}` : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.sps-panel', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.sps-panel')?.innerText.includes('Checking the releases'), { timeout: 15000 });
  return page;
}

for (const mock of [false, true]) {
  for (const theme of THEMES) {
    for (const width of [1440, 390]) {
      for (const sub of TABS) {
        const page = await open(theme, width, sub, mock);
        const m = await page.evaluate(() => ({
          sel: document.querySelector('.sps-tabs__tab[aria-selected="true"]')?.textContent,
          hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
          text: document.querySelector('.sps-panel')?.innerText || '',
        }));
        const label = `${mock ? 'mock' : 'real'} ${theme} ${width} ${sub || 'latest'}`;
        ok(m.text.length > 40 && !m.hscroll, `${label}: renders (${m.text.length} chars), no h-scroll (${m.sel})`);
        if (mock && sub === 'releases') ok(m.text.includes('0.2.0') && m.text.includes('0.1.0'), `${label}: both releases listed`);
        if (mock && sub === 'mac') ok(m.text.includes('Open Anyway') && m.text.includes('xattr'), `${label}: install steps`);
        if (!mock && sub === '') ok(/Update key/i.test(m.text), `${label}: status dots`);
        if (mock && sub === '' && theme === 'jade' && width === 1440) {
          await page.click('.sps-btn--primary');
          await page.waitForFunction(() => document.querySelector('.sps-panel')?.innerText.includes('works'), { timeout: 5000 }).catch(() => {});
          const t = await page.evaluate(() => document.querySelector('.sps-panel').innerText);
          ok(/Update route · works/i.test(t), `${label}: Test the update route → works`);
        }
        if (width === 1440 || theme === 'jade') {
          await page.screenshot({ path: path.join(OUT, `${mock ? 'mock' : 'real'}-${theme}-${width}-${sub || 'latest'}.png`), fullPage: true });
        }
        await page.close();
      }
    }
  }
}

await browser.close();
ok(consoleMsgs.length === 0, `no console errors/warnings${consoleMsgs.length ? `:\n  ${consoleMsgs.slice(0, 8).join('\n  ')}` : ''}`);
console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
setTimeout(() => process.exit(fails.length ? 1 : 0), 50);
