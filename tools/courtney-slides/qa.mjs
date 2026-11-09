// QA for /courtney-slides: the slide wipe mid-way, presenter view, audience <-> presenter
// sync, the grid, notes, a phone viewport and reduced motion.
//   node tools/courtney-slides/qa.mjs <outDir>      (BASE env, default http://localhost:5173)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE || 'http://localhost:5173';
const out = process.argv[2] || 'qa';
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) problems.push(msg);
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const watch = (page, tag) => {
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') problems.push(`${tag} ${m.type()}: ${m.text()}`);
  });
};

// 1. wipe mid-way + deep link
const a = await browser.newPage();
watch(a, 'audience');
await a.setViewport({ width: 1600, height: 900 });
await a.goto(`${BASE}/courtney-slides#3`, { waitUntil: 'networkidle0' });
await sleep(3500);
await a.keyboard.press('ArrowRight');
await sleep(420);
await a.screenshot({ path: path.join(out, 'wipe-mid.png') });
await sleep(2500);
check((await a.evaluate(() => location.hash)) === '#4', 'ArrowRight from #3 lands on #4');

// 2. presenter window in the same browser: sync both ways
const p = await browser.newPage();
watch(p, 'presenter');
await p.setViewport({ width: 1400, height: 860 });
await p.goto(`${BASE}/courtney-slides?view=presenter#4`, { waitUntil: 'networkidle0' });
await sleep(1500);
await p.screenshot({ path: path.join(out, 'presenter.png') });
await p.bringToFront();
await p.keyboard.press('ArrowRight');
await sleep(800);
check((await a.evaluate(() => location.hash)) === '#4.2', 'presenter → audience sync (#4.2)');
await a.bringToFront();
await a.keyboard.press('ArrowRight');
await sleep(800);
const pvText = await p.evaluate(() => document.querySelector('.cs-pv__bar')?.textContent || '');
check(/click 3 of/.test(pvText), `audience → presenter sync (presenter shows "${pvText.slice(0, 40)}")`);
await p.screenshot({ path: path.join(out, 'presenter-synced.png') });

// 3. grid + notes + back across a slide boundary
await a.keyboard.press('g');
await sleep(900);
await a.screenshot({ path: path.join(out, 'grid.png') });
check(!!(await a.$('.cs-grid')), 'G opens the grid');
await a.keyboard.press('Escape');
await a.keyboard.press('n');
await sleep(400);
check(!!(await a.$('.cs-notes p.is-now')), 'N opens notes with the current click highlighted');
await a.screenshot({ path: path.join(out, 'notes.png') });
await a.keyboard.press('n');
await a.keyboard.press('Home');
await sleep(600);
await a.keyboard.press('ArrowLeft');
check((await a.evaluate(() => location.hash)) === '#1', 'Back on the first slide stays put');
await a.goto(`${BASE}/courtney-slides#5`, { waitUntil: 'networkidle0' });
await sleep(800);
await a.keyboard.press('ArrowLeft');
await sleep(300);
check((await a.evaluate(() => location.hash)) === '#4.5', 'Back from #5 lands on the last click of #4');

// 4. phone
const m = await browser.newPage();
watch(m, 'phone');
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(`${BASE}/courtney-slides#9`, { waitUntil: 'networkidle0' });
await sleep(3000);
await m.screenshot({ path: path.join(out, 'phone.png') });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check(!overflow, 'no horizontal scroll on a phone');
await m.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await sleep(800);
await m.screenshot({ path: path.join(out, 'phone-landscape.png') });

// 5. reduced motion: a click lands straight on the finished frame
const r = await browser.newPage();
watch(r, 'reduced');
await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await r.setViewport({ width: 1280, height: 720 });
await r.goto(`${BASE}/courtney-slides#6`, { waitUntil: 'networkidle0' });
await sleep(400);
await r.screenshot({ path: path.join(out, 'reduced.png') });

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join('\n')}` : '\nall good');
process.exitCode = problems.length ? 1 : 0;
