#!/usr/bin/env node
/* Probe: are dark thin parts of a baked GLB (palm trunks) mipmap bleed from the
   atlas's black gutters? Renders the same view with mipmaps on and off.
     node tools/memory-rooms/dev-viewer/probe-mips.mjs <spotId> [--gpu] */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_dev', 'screens', 'viewer');
const args = process.argv.slice(2);
const spotId = args.find((a) => !a.startsWith('--'));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: args.includes('--gpu') ? ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => localStorage.setItem('mr:token', 'trip-local'));
await page.goto(`http://localhost:5192/memories/${spotId}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: path.join(OUT, 'probe-mips-on.png') });
const info = await page.evaluate(() => {
  const v = window.__mrViewer;
  const out = [];
  v.world.traverse((o) => {
    const m = o.material;
    if (m?.map && !out.includes(m.map)) out.push(m.map);
  });
  for (const t of out) {
    t.minFilter = 1006; // LinearFilter
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  v.requestRender();
  return out.map((t) => `${t.image?.width}x${t.image?.height} flipY=${t.flipY}`);
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: path.join(OUT, 'probe-mips-off.png') });
console.log('maps', info);
await browser.close();
