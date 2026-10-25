/* ============================================================================
   DL CODE LAB — screenshots (dev helper)
   (puppeteer-core + local Edge, seeded through the portal gate)
   ----------------------------------------------------------------------------
     node tools/dl-codelab/shot.mjs <outDir> [tabs…] [--theme=jade|coral|arcade|all]
          [--width=1440|390|both] [--full] [--viewport] [--reduce] [--card=<id>]

   For each tab id (or "all") it opens /portal/dl-code-lab/<tab> and saves
     <outDir>/<tab>-<theme>-<width>.png        the tab's panel (element shot)
   --full saves the whole page instead, --viewport only the first screen.
   --card=<id> saves just that card. With no tabs it shoots the page as it
   opens. Prints every console error/warning it saw. Dev server on 5182
   (SITE_URL to override).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5182';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const pos = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve(pos[0] || 'shots');
let tabs = pos.slice(1);
const themes = !flags.theme || flags.theme === 'all' ? ['jade', 'coral', 'arcade'] : [flags.theme];
const widths = flags.width === 'both' ? [1440, 390] : [Number(flags.width || 1440)];
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const msgs = [];
try {
  for (const theme of themes) {
    for (const width of widths) {
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
      const list = tabs.length ? tabs : [''];
      let all = list.includes('all');
      for (let i = 0; i < list.length; i += 1) {
        const tab = list[i];
        if (tab === 'all') continue;
        await page.goto(`${BASE}/portal/dl-code-lab${tab ? `/${tab}` : ''}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.dlc', { timeout: 30000 });
        await new Promise((r) => setTimeout(r, 700));
        const name = `${tab || 'page'}-${theme}-${width}`;
        if (flags.card) {
          const el = await page.$(`#dlc-${flags.card}`);
          if (el) { await el.screenshot({ path: path.join(OUT, `card-${flags.card}-${theme}-${width}.png`) }); console.log(`saved card ${flags.card}`); }
          continue;
        }
        if (flags.full || !tab) {
          await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !flags.viewport });
        } else {
          const el = (await page.$('.dlc-panel')) || (await page.$('.dlc'));
          await el.screenshot({ path: path.join(OUT, `${name}.png`) });
        }
        console.log(`saved ${name}`);
      }
      if (all) {
        const ids = await page.$$eval('[data-dlc-tab]', (els) => els.map((e) => e.getAttribute('data-dlc-tab')));
        for (const id of ids) {
          await page.goto(`${BASE}/portal/dl-code-lab/${id}`, { waitUntil: 'networkidle0' });
          await page.waitForSelector('.dlc', { timeout: 30000 });
          await new Promise((r) => setTimeout(r, 600));
          const name = `${id}-${theme}-${width}`;
          await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !flags.viewport });
          console.log(`saved ${name}`);
        }
        all = false;
      }
      await page.close();
    }
  }
} catch (e) {
  console.log(`FAILED: ${e.message}`);
} finally {
  await browser.close();
  console.log(msgs.length ? `console:\n${[...new Set(msgs)].join('\n')}` : 'console: clean');
}
