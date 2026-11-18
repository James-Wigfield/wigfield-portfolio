#!/usr/bin/env node
/* Side-by-side screenshots of the Mapbox style candidates (map/mapbox/style.js) on
   /memories: the opening view, the whole globe, a region with the trip's labels and a
   street (the pick map's world), light and dark. One map load per style per scheme.

     npm run build && npx wrangler dev --port 8788
     node tools/memory-rooms/dev/map-style-shots.mjs [--styles atlas,standard] [--width 1440]

   → memory-rooms-work/_map-styles/<style>-<scheme>-<view>.png and compare-<scheme>.png */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { config, WORK } from '../lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const styles = opt('--styles', 'atlas,standard').split(',');
const width = Number(opt('--width', '1440'));
const OUT = path.join(WORK, '_map-styles');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();

const VIEWS = [
  { name: 'open', camera: null },
  { name: 'globe', camera: { center: [-100, 28], zoom: 1.2 } },
  { name: 'region', camera: { center: [-119.5, 35.5], zoom: 5.6 } },
  { name: 'street', camera: { center: [-73.9905, 40.7265], zoom: 14.5 } },
];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const shots = {};
for (const scheme of ['light', 'dark']) {
  for (const style of styles) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('mr:token', t);
      localStorage.setItem('mr:who', 'james');
    }, cfg.token);
    await page.goto(`${base}/memories?mapstyle=${style}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-mr="map"][data-engine="mapbox"][data-ready]', { timeout: 30000 });
    const clip = await page.$eval('.mr-mappage-map', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    for (const v of VIEWS) {
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
      await new Promise((r) => setTimeout(r, 600));
      const file = path.join(OUT, `${style}-${scheme}-${v.name}.png`);
      await page.screenshot({ path: file, clip });
      (shots[scheme] ||= []).push({ style, view: v.name, file });
      console.log(`${style} ${scheme} ${v.name}`);
    }
    await page.close();
  }
}
await browser.close();

// contact sheet per scheme: a column per style, a row per view, at half size
for (const [scheme, list] of Object.entries(shots)) {
  const meta = await sharp(list[0].file).metadata();
  const w = Math.round(meta.width / 2);
  const h = Math.round(meta.height / 2);
  const gap = 12;
  const head = 36;
  const W = styles.length * w + (styles.length + 1) * gap;
  const H = head + VIEWS.length * h + (VIEWS.length + 1) * gap;
  const bg = scheme === 'dark' ? '#141413' : '#f6f4ef';
  const ink = scheme === 'dark' ? '#ecebe6' : '#1d1c1a';
  const titles = styles
    .map((s, i) => `<text x="${gap + i * (w + gap) + 4}" y="26" font-family="Consolas, monospace" font-size="18" fill="${ink}">${s.toUpperCase()} · ${scheme}</text>`)
    .join('');
  const comps = [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${head}">${titles}</svg>`), left: 0, top: 0 }];
  for (const s of list) {
    const col = styles.indexOf(s.style);
    const row = VIEWS.findIndex((v) => v.name === s.view);
    comps.push({ input: await sharp(s.file).resize(w, h).png().toBuffer(), left: gap + col * (w + gap), top: head + gap + row * (h + gap) });
  }
  const out = path.join(OUT, `compare-${scheme}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(comps).png().toFile(out);
  console.log(`→ ${out}`);
}
