#!/usr/bin/env node
/* Self-test step 2: capture the synthetic photos as a spot THROUGH THE REAL UI,
   on a 390 px phone viewport in headless Edge: gate → who → kind + name →
   photos → the memory → location → save → wait for the outbox to upload.

     node tools/memory-rooms/selftest/capture.mjs [--base http://127.0.0.1:8788] [--photos <dir>] [--headful]

   Needs the built site on wrangler dev (npm run build && npx wrangler dev --port 8788).
   Prints the new spot id on the last line (`SPOT <id>`). */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { client, config, WORK } from '../lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const photoDir = opt('--photos', path.join(WORK, '_selftest-truth', 'photos'));
const cfg = config();
cfg.base = base;
const api = client(cfg);

const photos = fs.readdirSync(photoDir).filter((f) => /^\d+\.jpe?g$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b)).map((f) => path.join(photoDir, f));
if (photos.length < 4) throw new Error(`need ≥ 4 photos in ${photoDir}`);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: !args.includes('--headful'),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run'],
});
const context = browser.defaultBrowserContext();
await context.overridePermissions(base, ['geolocation']);
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await page.setGeolocation({ latitude: 40.7243, longitude: -73.9927, accuracy: 14 }); // a hostel on the Lower East Side
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console.error: ${m.text()}`));

const sel = (name) => `[data-mr="${name}"]`;
async function click(name) {
  await page.waitForSelector(sel(name), { visible: true, timeout: 15000 });
  await page.click(sel(name));
}
async function type(name, text) {
  await page.waitForSelector(sel(name), { visible: true, timeout: 15000 });
  await page.click(sel(name));
  await page.$eval(sel(name), (el) => el.select?.());
  await page.type(sel(name), text);
}

const fresh = !args.includes('--keep-storage');
await page.goto(`${base}/memories/new`, { waitUntil: 'networkidle2' });
if (fresh) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
}

// gate + who
if (await page.$(sel('gate-password'))) {
  await type('gate-password', cfg.token);
  await click('gate-submit');
}
await page.waitForSelector(`${sel('who-james')}, ${sel('kind-interior')}`, { visible: true, timeout: 15000 });
if (await page.$(sel('who-james'))) await click('who-james');
if (!page.url().endsWith('/memories/new')) await page.goto(`${base}/memories/new`, { waitUntil: 'networkidle2' });

// 1. kind + name
await click('kind-interior');
await type('title-input', 'Hostel bunk room (synthetic)');
await click('next');

// 2. photos
const input = await page.waitForSelector(sel('photo-input'), { timeout: 15000 });
await input.uploadFile(...photos);
await page.waitForFunction((n) => document.querySelectorAll('[data-mr="photo-thumb"]').length >= n, { timeout: 60000 }, photos.length);
await click('next');

// 3. the memory
await type('note-input', 'Top bunk where we met the Danish crew on night one.');
const preset = await page.$(`${sel('scale-preset')}[data-value="small room"]`);
if (preset) await preset.click();
else await type('scale-input', 'small room');
await click('next');

// 4. location
await click('loc-gps');
await page.waitForFunction(() => /±|\d+\s?m/.test(document.body.innerText), { timeout: 20000 }).catch(() => problems.push('no GPS accuracy shown'));
await click('save');

const saved = await page.waitForSelector(sel('saved'), { timeout: 30000 });
const id = await saved.evaluate((el) => el.getAttribute('data-id'));
fs.mkdirSync(path.join(WORK, '_selftest-truth'), { recursive: true });
await page.screenshot({ path: path.join(WORK, '_selftest-truth', 'capture-saved-390.png') });

// wait for the outbox to finish uploading
const t0 = Date.now();
let spot = null;
while (Date.now() - t0 < 120000) {
  try {
    spot = await api.getSpot(id);
    const n = (t) => spot.media.filter((m) => m.type === t).length;
    if (n('photo') === photos.length && n('thumb') === photos.length) break;
  } catch {
    /* not there yet */
  }
  await new Promise((r) => setTimeout(r, 1000));
}
await browser.close();

const n = (t) => (spot?.media || []).filter((m) => m.type === t).length;
const longEdges = (spot?.media || []).filter((m) => m.type === 'photo').map((m) => Math.max(m.width, m.height));
console.log(`spot ${id}: ${n('photo')} photos (long edges ${longEdges.join(', ')}), ${n('thumb')} thumbs, place "${spot?.placeLabel}", ${spot?.lat}, ${spot?.lng} ±${spot?.locAccuracyM} m (${spot?.locSource}), by ${spot?.createdBy}`);
if (problems.length) console.log(`problems:\n  ${problems.join('\n  ')}`);
if (n('photo') !== photos.length) {
  console.error('✗ the upload did not complete');
  process.exit(1);
}
console.log(`SPOT ${id}`);
