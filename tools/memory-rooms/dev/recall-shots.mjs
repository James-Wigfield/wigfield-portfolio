#!/usr/bin/env node
/* The "Recall" look, screen by screen, for design iteration (no Mapbox loads: ?map=atlas).

     node tools/memory-rooms/dev/recall-shots.mjs [--only map,spot,walk,capture,edit,gate] [--dark] [--base http://127.0.0.1:8788]

   Against a LOCAL Worker (wrangler dev --port 8788). Shoots each page at 1440 and 390 (touch),
   light or dark, plus the spot page mid-recall (points condensing) and with the phone sheet open.
   Writes memory-rooms-work/_recall/<page>-<width>-<scheme>.png and prints console errors. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_recall');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = flag('--base', 'http://127.0.0.1:8788');
const ONLY = flag('--only', 'map,spot,capture,edit,gate,walk').split(',');
const SCHEME = args.includes('--dark') ? 'dark' : 'light';
const TOKEN = process.env.MEMORIES_PASSWORD || 'trip-local';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(browser, width) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: SCHEME }]);
  if (width < 600) await p.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await p.evaluateOnNewDocument((token) => {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', 'james');
  }, TOKEN);
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && errors.push(`[${width}] ${m.type()}: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`[${width}] pageerror: ${e.message}`));
  return p;
}

const shot = (p, name, width) => p.screenshot({ path: path.join(OUT, `${name}-${width}-${SCHEME}.png`) });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const res = await fetch(`${BASE}/api/memories/spots`, { headers: { authorization: `Bearer ${TOKEN}` } });
  const spots = (await res.json()).data || [];
  const rendered = spots.find((s) => s.status === 'rendered' && /bedroom/i.test(s.title)) || spots.find((s) => s.status === 'rendered');
  for (const width of [1440, 390]) {
    const p = await page(browser, width);
    if (ONLY.includes('gate')) {
      const g = await page(browser, width);
      await g.evaluateOnNewDocument(() => localStorage.clear());
      await g.goto(`${BASE}/memories?map=atlas`, { waitUntil: 'networkidle0' });
      await shot(g, 'gate', width);
      await g.browserContext().close();
    }
    if (ONLY.includes('map')) {
      await p.goto(`${BASE}/memories?map=atlas`, { waitUntil: 'networkidle0' });
      await sleep(800);
      await shot(p, 'map', width);
      const row = await p.$('[data-mr="spot-row"]');
      if (row) {
        await row.click();
        await sleep(500);
        await shot(p, 'map-card', width);
      }
      const day = await p.$('[data-mr="day-strip"] .mr-days__strip');
      if (day) {
        const b = await day.boundingBox();
        await p.mouse.click(b.x + b.width * 0.08, b.y + b.height / 2);
        await sleep(300);
        await shot(p, 'map-day', width);
      }
    }
    if (ONLY.includes('spot') && rendered) {
      await p.goto(`${BASE}/memories/${rendered.id}`, { waitUntil: 'domcontentloaded' });
      await sleep(width < 600 ? 1300 : 1100);
      await shot(p, 'spot-recall', width);
      await p.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 20000 });
      await sleep(2600);
      await shot(p, 'spot', width);
      const pin = await p.$('[data-mr="pin"]:not([hidden])');
      if (pin) {
        await pin.click();
        await sleep(300);
        await shot(p, 'spot-pin', width);
      }
      const handle = await p.$('[data-mr="sheet-handle"]');
      if (handle) {
        await handle.click();
        await sleep(500);
        await shot(p, 'spot-sheet', width);
      }
      const night = spots.find((s) => s.scene?.style?.mood === 'night' && s.status === 'rendered');
      if (night) {
        await p.goto(`${BASE}/memories/${night.id}`, { waitUntil: 'domcontentloaded' });
        await p.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 20000 });
        await sleep(2600);
        await shot(p, 'spot-night', width);
      }
    }
    if (ONLY.includes('capture')) {
      await p.goto(`${BASE}/memories/new?map=atlas`, { waitUntil: 'networkidle0' });
      await sleep(400);
      await shot(p, 'capture', width);
    }
    if (ONLY.includes('edit') && rendered) {
      await p.goto(`${BASE}/memories/${rendered.id}/edit?map=atlas`, { waitUntil: 'networkidle0' });
      await sleep(400);
      await shot(p, 'edit', width);
    }
    if (ONLY.includes('walk') && rendered) {
      await p.goto(`${BASE}/memories/${rendered.id}/walk`, { waitUntil: 'domcontentloaded' });
      await sleep(4000);
      await shot(p, 'walk', width);
    }
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(`[${width}] sideways scroll: ${overflow}px`);
    await p.browserContext().close();
  }
} finally {
  await browser.close();
}
console.log(`screens in ${OUT}`);
if (errors.length) console.log(errors.join('\n'));
