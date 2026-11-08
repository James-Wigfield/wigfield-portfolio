#!/usr/bin/env node
/* Viewpoint alignment check: fly to a photo viewpoint, grab the letterboxed
   view at blend 0 (model) and blend 1 (photo), and measure how well they
   line up. With Blender's own renders as the photos (seed-dev uses
   renders/camN.png) they should match almost exactly.

     node tools/memory-rooms/dev-viewer/align-check.mjs <spotId> <photo> [name] [--gpu] [--phone]

   Writes <name>-model.png, <name>-photo.png, <name>-diff.png (abs difference,
   ×4) and <name>-edges.png (model edges in red over the photo) to
   memory-rooms-work/_dev/screens/viewer/, and prints the mean abs difference. */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_dev', 'screens', 'viewer');
const args = process.argv.slice(2);
const [spotId, photoArg, nameArg] = args.filter((a) => !a.startsWith('--'));
const photo = Number(photoArg || 1);
const name = nameArg || `align-${spotId.slice(0, 8)}-p${photo}`;
const BASE = process.env.MR_BASE || 'http://localhost:5192';
const phone = args.includes('--phone');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: args.includes('--gpu')
    ? ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('mr:token', 'trip-local');
  localStorage.setItem('mr:who', 'james');
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${BASE}/memories/${spotId}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 60000 });
await page.click(`[data-mr="viewpoint"][data-photo="${photo}"]`);
await new Promise((r) => setTimeout(r, 1500));
// wait for the photo itself to be decoded
await page.waitForFunction(() => {
  const img = document.querySelector('.mr-viewer__photo');
  return img && img.complete && img.naturalWidth > 0;
});

const clip = await page.evaluate(() => {
  const v = window.__mrViewer;
  const r = v.viewRect();
  const box = v.canvas.getBoundingClientRect();
  return { x: box.left + r.x, y: box.top + r.y, width: r.w, height: r.h };
});
const grab = async (blend) => {
  await page.evaluate((b) => window.__mrViewer.setBlend(b), blend);
  await new Promise((r) => setTimeout(r, 250));
  return page.screenshot({ clip: { x: Math.ceil(clip.x) + 1, y: Math.ceil(clip.y) + 1, width: Math.floor(clip.width) - 2, height: Math.floor(clip.height) - 2 } });
};
const model = await grab(0);
const photoShot = await grab(1);
await browser.close();

const a = await sharp(model).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const b = await sharp(photoShot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = a.info;
const diff = Buffer.alloc(a.data.length);
let sum = 0;
for (let i = 0; i < a.data.length; i++) {
  const d = Math.abs(a.data[i] - b.data[i]);
  sum += d;
  diff[i] = Math.min(255, d * 4);
}
const mean = sum / a.data.length;

// model edges (luma gradient) drawn red over the photo
const luma = (buf, i) => 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
const edges = Buffer.from(b.data);
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const i = (y * width + x) * 3;
    const gx = luma(a.data, i + 3) - luma(a.data, i - 3);
    const gy = luma(a.data, i + width * 3) - luma(a.data, i - width * 3);
    if (Math.hypot(gx, gy) > 40) {
      edges[i] = 255;
      edges[i + 1] = 0;
      edges[i + 2] = 0;
    }
  }
}
const raw = { raw: { width, height, channels: 3 } };
await sharp(model).toFile(path.join(OUT, `${name}-model.png`));
await sharp(photoShot).toFile(path.join(OUT, `${name}-photo.png`));
await sharp(diff, raw).png().toFile(path.join(OUT, `${name}-diff.png`));
await sharp(edges, raw).png().toFile(path.join(OUT, `${name}-edges.png`));
console.log(`${name}: ${width}x${height}, mean abs diff ${mean.toFixed(2)} / 255`);
if (errors.length) {
  console.log(`errors:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
