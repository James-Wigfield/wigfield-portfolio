#!/usr/bin/env node
/* Screenshots of rendered spots standing on the /memories map: markers (map/markers.js) at the
   opening (country) view and in a city, the live 3D dioramas past zoom 15 (map/mapbox/models3d.js),
   a clicked model (ring + card) and the SVG atlas, at 1440 and 390 (touch, DPR 2), light and dark,
   plus one contact sheet. One Mapbox load per width per scheme (4 a run), atlas extra.

     npm run build && npx wrangler dev --port 8788 && node tools/memory-rooms/seed-dev.mjs --examples-only
     node tools/memory-rooms/dev/marker-shots.mjs [--views country,nyc,nyc3d,sd3d,card3d,atlas] [--tag name]
   (also: sd = San Diego at zoom 12, card = a marker clicked)

   → memory-rooms-work/_markers/<tag>-<width>-<scheme>-<view>.png and <tag>-sheet.png */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { config, WORK } from '../lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const tag = opt('--tag', 'markers');
const OUT = path.join(WORK, '_markers');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();

/** camera: null = the opening view; atlas: a separate ?map=atlas page. */
const ALL_VIEWS = [
  { name: 'country', label: 'country (opening view)', camera: null },
  { name: 'nyc', label: 'city: New York, zoom 12.6', camera: { center: [-73.9897, 40.7276], zoom: 12.6 } },
  { name: 'sd', label: 'city: San Diego, zoom 12', camera: { center: [-117.1611, 32.7175], zoom: 12 } },
  { name: 'card', label: 'a marker clicked: ring + card', camera: { center: [-117.1611, 32.7175], zoom: 12 }, select: true },
  { name: 'nyc3d', label: '3D: New York, zoom 16 (tilts to 52°)', camera: { center: [-73.9866, 40.7306], zoom: 16 }, three: true },
  { name: 'sd3d', label: '3D: San Diego, zoom 16, the map turned 35°', camera: { center: [-117.1611, 32.7162], zoom: 16, bearing: -35 }, three: true },
  { name: 'card3d', label: 'a 3D model clicked: ring + card', camera: { center: [-117.1611, 32.7162], zoom: 16, bearing: -35 }, three: true, select: true },
  { name: 'atlas', label: 'atlas fallback (opening view)', atlas: true },
];
const DEFAULT_VIEWS = 'country,nyc,nyc3d,sd3d,card3d,atlas';
const want = opt('--views', DEFAULT_VIEWS).split(',');
const VIEWS = ALL_VIEWS.filter((v) => want.includes(v.name));
const COLS = [
  { width: 1440, scheme: 'light' },
  { width: 1440, scheme: 'dark' },
  { width: 390, scheme: 'light' },
  { width: 390, scheme: 'dark' },
];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function open(width, scheme, route) {
  const page = await browser.newPage();
  const mobile = width < 600;
  await page.emulate({
    viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : await browser.userAgent(),
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push(m.text()));
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, cfg.token);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle2' });
  return page;
}
const clipOf = (page) =>
  page.$eval('.mr-mappage-map', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
/** Waits until every rendered spot on screen that can show a marker does (or 8 s). */
const markersSettled = (page) =>
  page
    .waitForFunction(() => document.querySelectorAll('[data-mr="spot-dot"][data-marker], [data-mr="cluster"][data-fan]').length > 0, { timeout: 8000 })
    .catch(() => {});

const shots = [];
for (const col of COLS) {
  let page = null;
  for (const v of VIEWS.filter((x) => !x.atlas)) {
    if (!page) {
      page = await open(col.width, col.scheme, '/memories');
      await page.waitForSelector('[data-mr="map"][data-engine="mapbox"][data-ready]', { timeout: 30000 });
    }
    await page.evaluate(
      (camera) =>
        new Promise((done) => {
          const map = document.querySelector('[data-mr="map"]').__mrMap;
          if (camera) map.jumpTo(camera);
          map.once('idle', done);
          map.triggerRepaint();
          setTimeout(done, 15000);
        }),
      v.camera,
    );
    if (v.three) {
      // models loaded, the tilt eased in, nothing left to draw
      await page.waitForFunction(() => window.__mrModels?.().live > 0 && window.__mrModels().loading === 0, { timeout: 45000 }).catch(() => {});
      await page.waitForFunction(() => Number(document.querySelector('[data-mr="map"]').dataset.pitch) >= 45, { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => new Promise((done) => {
        const map = document.querySelector('[data-mr="map"]').__mrMap;
        map.once('idle', done);
        map.triggerRepaint();
        setTimeout(done, 8000);
      }));
    } else await markersSettled(page);
    if (v.select) {
      await page.$eval(v.three ? '[data-mr="spot-dot"][data-model]' : '[data-mr="spot-dot"][data-marker]', (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForSelector('[data-mr="spot-card"]', { visible: true, timeout: 5000 }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 700));
    const file = path.join(OUT, `${tag}-${col.width}-${col.scheme}-${v.name}.png`);
    await page.screenshot({ path: file, clip: v.select ? undefined : await clipOf(page) });
    if (v.select) await page.keyboard.press('Escape');
    shots.push({ ...col, view: v.name, file });
    console.log(`${col.width} ${col.scheme} ${v.name}${page.problems.length ? `  ! ${page.problems.join(' | ')}` : ''}`);
  }
  if (page) {
    const loads = await page.evaluate(() => window.__mrMapLoads || 0);
    if (loads !== 1) console.log(`  ! ${loads} map loads`);
    await page.close();
  }
  if (VIEWS.some((x) => x.atlas)) {
    const atlas = await open(col.width, col.scheme, '/memories?map=atlas');
    await atlas.waitForSelector('[data-mr="map"] .mr-atlas-borders', { timeout: 20000 });
    await markersSettled(atlas);
    await new Promise((r) => setTimeout(r, 500));
    const file = path.join(OUT, `${tag}-${col.width}-${col.scheme}-atlas.png`);
    await atlas.screenshot({ path: file, clip: await clipOf(atlas) });
    shots.push({ ...col, view: 'atlas', file });
    console.log(`${col.width} ${col.scheme} atlas${atlas.problems.length ? `  ! ${atlas.problems.join(' | ')}` : ''}`);
    await atlas.close();
  }
}
await browser.close();

// contact sheet: a row per view, a column per width × scheme, every shot ROW_H tall
const ROW_H = 380;
const gap = 14;
const head = 34;
const label = 30;
const colW = [];
for (const [i, col] of COLS.entries()) {
  const s = shots.find((x) => x.width === col.width && x.scheme === col.scheme);
  const m = await sharp(s.file).metadata();
  colW[i] = Math.round((m.width / m.height) * ROW_H);
}
const W = colW.reduce((a, b) => a + b, 0) + gap * (COLS.length + 1);
const H = head + VIEWS.length * (ROW_H + label + gap) + gap;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const texts = [];
const comps = [];
let x = gap;
for (const [i, col] of COLS.entries()) {
  texts.push(`<text x="${x + 2}" y="24" font-family="Consolas, monospace" font-size="17" fill="#1d1c1a">${col.width} · ${col.scheme}</text>`);
  for (const [r, v] of VIEWS.entries()) {
    const s = shots.find((q) => q.width === col.width && q.scheme === col.scheme && q.view === v.name);
    const top = head + r * (ROW_H + label + gap);
    if (i === 0) texts.push(`<text x="${gap + 2}" y="${top + 21}" font-family="Consolas, monospace" font-size="15" fill="#5b5852">${esc(v.label)}</text>`);
    if (s) comps.push({ input: await sharp(s.file).resize(colW[i], ROW_H, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: x, top: top + label });
  }
  x += colW[i] + gap;
}
comps.unshift({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${texts.join('')}</svg>`), left: 0, top: 0 });
const sheet = path.join(OUT, `${tag}-sheet.png`);
await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(sheet);
console.log(`→ ${sheet}`);
