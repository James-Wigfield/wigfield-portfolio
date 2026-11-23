#!/usr/bin/env node
/* zfight-shots: a built place turned round, zoomed out, for spotting z-fighting (coplanar site areas shimmering).

     node tools/memory-rooms/dev/zfight-shots.mjs --building <id> [--base http://127.0.0.1:8796] [--old-near] [--tag x]

   Opens /memories/b/<id> (with the password), Outside, then for 8 azimuths at the far orbit distance writes
   memory-rooms-work/_zfight/<tag>-<az>.png, plus a "jitter" pair 0.3 degrees apart and the share of pixels that
   changed in the site between them (z-fighting = a speckled flip far above what the small turn explains).
   --old-near pins the camera's near plane at 0.05 m (the viewer before nearFor), for a before/after. */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { EDGE, REPO } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = opt('--base', 'http://127.0.0.1:8796').replace(/\/+$/, '');
const BID = opt('--building', null);
const OLD = args.includes('--old-near');
const TAG = opt('--tag', OLD ? 'old-near' : 'new-near');
const OUT = path.join(REPO, 'memory-rooms-work', '_zfight');
fs.mkdirSync(OUT, { recursive: true });
if (!BID) {
  console.error('usage: zfight-shots.mjs --building <id> [--base <url>] [--old-near] [--tag x]');
  process.exit(2);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((pw) => {
  localStorage.setItem('mr:token', pw);
  localStorage.setItem('mr:who', 'james');
}, process.env.MEMORIES_PASSWORD || 'trip-local');
await page.goto(`${BASE}/memories/b/${BID}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-mr="building"] [data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
const stage = await page.$('[data-mr="building"] [data-mr="viewer"]');

async function pose(az, far = 2.0) {
  await page.evaluate(
    (az, far, old) => {
      const v = document.querySelector('[data-mr="building"] [data-mr="viewer"]').__viewer || document.querySelector('[data-mr="building"] .mr-viewer').__viewer;
      if (old) v.nearFor = () => 0.05;
      const t = v.controls.target;
      if (!v.__d0) v.__d0 = v.camera.position.distanceTo(t);
      const d = Math.min(v.controls.maxDistance, v.__d0 * far);
      const el = (32 * Math.PI) / 180;
      const a = (az * Math.PI) / 180;
      v.camera.position.set(t.x + d * Math.cos(el) * Math.sin(a), t.y + d * Math.sin(el), t.z + d * Math.cos(el) * Math.cos(a));
      v.camera.lookAt(t);
      v.controls.update();
      v.requestRender();
    },
    az,
    far,
    OLD,
  );
  await new Promise((r) => setTimeout(r, 450));
}

const near = [];
for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
  await pose(az);
  await stage.screenshot({ path: path.join(OUT, `${TAG}-${az}.png`) });
  near.push(await page.evaluate(() => (document.querySelector('[data-mr="building"] [data-mr="viewer"]').__viewer || document.querySelector('[data-mr="building"] .mr-viewer').__viewer).camera.near));
}
// a jitter pair: the share of pixels that change a lot for a 0.3 degree turn
const flips = [];
for (const az of [20, 110, 200, 290]) {
  await pose(az);
  const a = await sharp(await stage.screenshot()).raw().toBuffer({ resolveWithObject: true });
  await pose(az + 0.3);
  const b = await sharp(await stage.screenshot()).raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  const n = a.info.width * a.info.height;
  for (let i = 0; i < n; i++) {
    const k = i * a.info.channels;
    const d = Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]);
    if (d > 60) changed++;
  }
  flips.push(+((changed / n) * 100).toFixed(2));
}
console.log(JSON.stringify({ tag: TAG, near: near.map((x) => +x.toFixed(3)), flipPctPer0_3deg: flips }));
await browser.close();
