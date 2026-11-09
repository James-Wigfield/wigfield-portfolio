// Screenshots of /courtney-slides for review.
//
//   node tools/courtney-slides/shots.mjs print <outDir> [slides]      finished frames from ?view=print
//   node tools/courtney-slides/shots.mjs live <outDir> <spec...>      live frames: "7.2@1500" = slide 7, click 2, 1.5 s in
//
// Env: BASE (default http://localhost:5173), W (screenshot width, default 960).
// Prints any console error / page error, and exits 1 if there were some.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE || 'http://localhost:5173';
const OUTW = Number(process.env.W || 960);
const [, , mode = 'print', outDir = 'shots', ...rest] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const errors = [];
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const save = async (buf, name) => {
  const file = path.join(outDir, name);
  await sharp(buf).resize({ width: OUTW }).png().toFile(file);
  console.log(file);
};

if (mode === 'print') {
  await page.goto(`${BASE}/courtney-slides?view=print`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  const pages = await page.$$('.cs-print__page');
  const want = rest[0] ? rest[0].split(',').map(Number) : pages.map((_, i) => i + 1);
  for (const n of want) {
    const el = pages[n - 1];
    if (!el) continue;
    await el.scrollIntoView();
    const buf = await el.screenshot();
    await save(buf, `s${String(n).padStart(2, '0')}.png`);
  }
} else if (mode === 'walk') {
  // Click through the whole deck live; tag every warning with the position it
  // happened at; screenshot each slide once its last build has finished.
  const hold = Number(rest[0] || 3800);
  await page.goto(`${BASE}/courtney-slides#1`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  for (let guard = 0; guard < 200; guard++) {
    await new Promise((r) => setTimeout(r, hold));
    const at = await page.evaluate(() => window.location.hash || '#1');
    errors.forEach((e, k) => { if (!e.startsWith('@')) errors[k] = `@${at} ${e}`; });
    const [slide, beat = '1'] = at.slice(1).split('.');
    const buf = await page.screenshot();
    await save(buf, `walk-${String(slide).padStart(2, '0')}-${beat}.png`);
    await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 150));
    const now = await page.evaluate(() => window.location.hash || '#1');
    if (now === at) break;
  }
} else {
  for (const spec of rest) {
    const [pos, ms = '4000'] = spec.split('@');
    await page.goto('about:blank');
    await page.goto(`${BASE}/courtney-slides#${pos.split('.')[0]}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const clicks = Number(pos.split('.')[1] || 1) - 1;
    // land on the slide, then click through to the wanted beat so its build plays live
    await new Promise((r) => setTimeout(r, clicks ? 1800 : 0));
    for (let c = 0; c < clicks; c++) {
      await page.keyboard.press('ArrowRight');
      await new Promise((r) => setTimeout(r, c === clicks - 1 ? 0 : 2600));
    }
    await new Promise((r) => setTimeout(r, Number(ms)));
    const buf = await page.screenshot();
    await save(buf, `live-${pos.replace('.', '_')}-${ms}.png`);
  }
}

await browser.close();
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
}
