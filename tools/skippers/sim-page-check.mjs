/* Page check for /skippers/practical/drive (puppeteer-core + local Edge, real
   GPU via ANGLE d3d11). 1440 px, light + dark: zero console errors, both GLBs
   load, fps sampled, a few seconds of driving, screenshots saved.
   Usage: node tools/skippers/sim-page-check.mjs [base=http://localhost:5173] [outDir] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.argv[2] ?? 'http://localhost:5173';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const out = process.argv[3] ?? path.join(root, 'Documents/skippers/sim/shots');
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', protocolTimeout: 120000,
  args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
let failures = 0;
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const glb = new Set();
  page.on('response', (r) => { const u = r.url(); if (u.endsWith('.glb') && r.ok()) glb.add(u.split('/').pop()); });
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('sk:theme', JSON.stringify(t)); } catch { /* */ } }, theme);
  await page.goto(`${base}/skippers/practical/drive`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate((t) => { document.querySelector('.sk')?.setAttribute('data-theme', t); }, theme);
  await page.screenshot({ path: path.join(out, `drive-menu-${theme}.png`) });
  // start a drill: controlled stop (boat already moving)
  await page.evaluate(() => { [...document.querySelectorAll('.sim-menu button')].find((b) => b.textContent.trim() === 'Drills')?.click(); });
  await sleep(150);
  await page.evaluate(() => { [...document.querySelectorAll('.sim-drills button')].find((b) => b.textContent.includes('Controlled stop'))?.click(); });
  await sleep(150);
  await page.evaluate(() => document.querySelector('.sim-go')?.click());
  await page.waitForFunction(() => window.__simReady?.venue && window.__simReady?.boat, { timeout: 30000 }).catch(() => {});
  await sleep(2500);
  await page.keyboard.press('w'); await sleep(400); await page.keyboard.down('d'); await sleep(500); await page.keyboard.up('d');
  await sleep(2500);
  const st = await page.evaluate(() => ({ ready: window.__simReady, fps: window.__simFps?.slice(-3), phase: window.__sim?.g.phase, kn: Math.hypot(window.__sim?.g.boat.u, window.__sim?.g.boat.v) * 1.944 }));
  await page.screenshot({ path: path.join(out, `drive-helm-${theme}.png`) });
  await page.keyboard.press('v'); await sleep(1200);
  await page.screenshot({ path: path.join(out, `drive-chase-${theme}.png`) });
  // a drill at the berth with labels (pre-start)
  await page.evaluate(() => [...document.querySelectorAll('.sim-bar button')].find((b) => b.textContent.includes('Menu'))?.click());
  await sleep(200);
  await page.evaluate(() => { [...document.querySelectorAll('.sim-menu button')].find((b) => b.textContent.trim() === 'Drills')?.click(); });
  await page.evaluate(() => { [...document.querySelectorAll('.sim-drills button')].find((b) => b.textContent.includes('Pre-start'))?.click(); });
  await page.evaluate(() => document.querySelector('.sim-go')?.click());
  await sleep(3000);
  await page.mouse.move(720, 500); await page.mouse.down(); await page.mouse.move(520, 620, { steps: 8 }); await page.mouse.up();
  await sleep(800);
  await page.screenshot({ path: path.join(out, `drive-prestart-${theme}.png`) });
  // finish it fast via the API to show the scoresheet
  await page.evaluate(() => { const G = window.__sim; for (const id of ['hs_fuel_line', 'hs_fuel_gauge', 'hs_intakes', 'hs_lanyard', 'hs_lever', 'hs_prop']) G.cmd({ t: 'hs', id }); if (G.g.prompt?.key === 'swimmer') G.cmd({ t: 'choose', key: 'swimmer', value: 'move' }); G.cmd({ t: 'look', yaw: 3 }); for (let i = 0; i < 30; i++) G.tick(); G.cmd({ t: 'hs', id: 'hs_key' }); });
  await sleep(1200);
  await page.screenshot({ path: path.join(out, `drive-sheet-${theme}.png`) });
  const glbOk = (glb.has('venue.glb') && glb.has('boat.glb')) || !!(st.ready?.venue && st.ready?.boat);
  const ok = errors.length === 0 && glbOk;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme}: glbs=[${[...glb].join(', ')}] ready=${JSON.stringify(st.ready)} fps=${JSON.stringify(st.fps)} phase=${st.phase} speed=${st.kn?.toFixed(1)} kn errors=${errors.length}`);
  for (const e of errors.slice(0, 8)) console.log('   ', e.slice(0, 300));
  await page.close();
}
await browser.close();
console.log(failures ? `${failures} FAILED` : 'page check passed');
process.exit(failures ? 1 : 0);
