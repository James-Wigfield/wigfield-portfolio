#!/usr/bin/env node
/* page-check: the /memories screens in headless Edge, at 1440 and 390 px.

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     node tools/memory-rooms/page-check.mjs [--base http://127.0.0.1:8788] [--dark] [--gpu]

   Checks
     gate      fresh device → password gate → wrong password refused → right one → who picker
     map       the SVG map draws states + spot dots at 1440 and 390; a dot opens its card
     capture   /memories/new at 390: every step reachable (4 photos uploaded), nothing saved
     viewer    a rendered spot's GLB loads (data-state=ready) at 1440 and 390, a photo viewpoint flies
     console   zero console errors and zero page errors on every screen
   Screenshots → memory-rooms-work/_page-check/. Exit 1 if anything fails.
   Needs at least one rendered spot with a model (seed-dev.mjs --examples-only gives two). */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { client, config, WORK } from './lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};

const spots = await api.listSpots();
const rendered = spots.find((s) => s.status === 'rendered' && s.kind === 'interior' && s.media.some((m) => m.type === 'model') && s.scene?.cameras?.length);
if (!rendered) {
  console.error('No rendered interior spot with a model + cameras: run `node tools/memory-rooms/seed-dev.mjs --examples-only` first.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: args.includes('--gpu') ? ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function open(width, { authed = true } = {}) {
  const page = await browser.newPage();
  const mobile = width < 600;
  await page.emulate({ viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : (await browser.userAgent()) });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.problems.push(`console.error: ${m.text()}`);
  });
  if (authed) {
    await page.evaluateOnNewDocument((token) => {
      try {
        localStorage.setItem('mr:token', token);
        localStorage.setItem('mr:who', 'james');
      } catch {
        /* ignore */
      }
    }, cfg.token);
  }
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
const sel = (name) => `[data-mr="${name}"]`;
function noErrors(page, label) {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
}

// ── gate ─────────────────────────────────────────────────────────────────────
{
  const page = await open(390, { authed: false });
  await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
  const gate = await page.waitForSelector(sel('gate-password'), { visible: true, timeout: 20000 }).catch(() => null);
  record('gate: a fresh device sees the password gate', Boolean(gate));
  if (gate) {
    await shot(page, 'gate-390');
    await page.type(sel('gate-password'), 'definitely-wrong');
    await page.click(sel('gate-submit'));
    await new Promise((r) => setTimeout(r, 1200));
    record('gate: a wrong password is refused', Boolean(await page.$(sel('gate-password'))));
    await page.click(sel('gate-password'));
    for (let i = 0; i < 24; i++) await page.keyboard.press('Backspace'); // triple-click doesn't select under touch emulation
    await page.type(sel('gate-password'), cfg.token);
    await page.click(sel('gate-submit'));
    const who = await page.waitForSelector(sel('who-james'), { visible: true, timeout: 15000 }).catch(() => null);
    record('gate: the right password leads to the who-picker', Boolean(who));
    if (who) {
      await shot(page, 'who-390');
      await page.click(sel('who-james'));
      const map = await page.waitForSelector(sel('map'), { timeout: 15000 }).catch(() => null);
      record('gate: picking James opens the map', Boolean(map));
    }
  }
  // the 401 from the deliberately wrong password is expected; ignore failed-resource noise from it
  page.problems = page.problems.filter((p) => !/401|Unauthorized/i.test(p));
  noErrors(page, 'gate');
  await page.close();
}

// ── map ──────────────────────────────────────────────────────────────────────
for (const width of [1440, 390]) {
  const page = await open(width);
  await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
  // states are drawn as one merged land path + a borders mesh (map/AtlasMap.jsx), so measure the geometry
  const ok = await page.waitForSelector(`${sel('map')} .mr-atlas-borders`, { timeout: 20000 }).then(() => true).catch(() => false);
  const geometry = ok ? await page.$$eval(`${sel('map')} .mr-atlas-land, ${sel('map')} .mr-atlas-borders, ${sel('map')} .mr-atlas-canada`, (els) => els.map((e) => (e.getAttribute('d') || '').length)) : [];
  await page.waitForSelector(`${sel('spot-dot')}, ${sel('cluster')}`, { timeout: 15000 }).catch(() => null);
  const dots = await page.$$eval(`${sel('spot-dot')}, ${sel('cluster')}`, (els) => els.length);
  record(`map ${width}: states drawn and spots placed`, geometry.length === 3 && geometry.every((n) => n > 2000) && dots > 0, `land/borders/canada path lengths ${geometry.join('/')}, ${dots} dots/clusters`);
  await shot(page, `map-${width}`);
  const dot = await page.$(sel('spot-dot'));
  if (dot) {
    await dot.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const card = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).catch(() => null);
    record(`map ${width}: clicking a spot opens its card`, Boolean(card));
    if (card) await shot(page, `map-${width}-card`);
  }
  noErrors(page, `map ${width}`);
  await page.close();
}

// ── capture (390, walk every step, don't save) ──────────────────────────────
{
  const page = await open(390);
  await page.goto(`${base}/memories/new`, { waitUntil: 'networkidle2' });
  const steps = [];
  try {
    await page.waitForSelector(sel('kind-interior'), { visible: true, timeout: 15000 });
    await shot(page, 'capture-1-kind-390');
    await page.click(sel('kind-interior'));
    await page.type(sel('title-input'), 'page-check (not saved)');
    await page.click(sel('next'));
    steps.push('kind');
    const input = await page.waitForSelector(sel('photo-input'), { timeout: 10000 });
    await shot(page, 'capture-2-photos-empty-390');
    const tmp = [];
    for (let i = 1; i <= 4; i++) {
      const f = path.join(OUT, `tmp-photo-${i}.jpg`);
      await sharp({ create: { width: 1200, height: 1600, channels: 3, background: ['#a7774f', '#56677f', '#e9e2d4', '#7a5a3c'][i - 1] } }).jpeg().toFile(f);
      tmp.push(f);
    }
    await input.uploadFile(...tmp);
    await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length >= 4, { timeout: 30000 });
    await shot(page, 'capture-2-photos-390');
    await page.click(sel('next'));
    steps.push('photos');
    await page.waitForSelector(sel('note-input'), { visible: true, timeout: 10000 });
    await page.type(sel('note-input'), 'not saved');
    await shot(page, 'capture-3-memory-390');
    await page.click(sel('next'));
    steps.push('memory');
    await page.waitForSelector(sel('loc-gps'), { visible: true, timeout: 10000 });
    await shot(page, 'capture-4-location-390');
    steps.push('location');
    tmp.forEach((f) => fs.rmSync(f, { force: true }));
  } catch (e) {
    record('capture 390: step failed', false, e.message.split('\n')[0]);
  }
  record('capture 390: all four steps reachable', steps.length === 4, steps.join(' → '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record('capture 390: no horizontal overflow', overflow <= 1, `${overflow}px`);
  noErrors(page, 'capture 390');
  await page.close();
}

// ── viewer ───────────────────────────────────────────────────────────────────
for (const width of [1440, 390]) {
  const page = await open(width);
  await page.goto(`${base}/memories/${rendered.id}`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 90000 }).then(() => true).catch(() => false);
  const mode = await page.$eval(sel('viewer'), (el) => el.getAttribute('data-mode')).catch(() => null);
  record(`viewer ${width}: "${rendered.title}" GLB loads`, ready && mode === 'model', `state ${ready ? 'ready' : 'not ready'}, mode ${mode}`);
  await new Promise((r) => setTimeout(r, 2500));
  await shot(page, `viewer-${width}`);
  const vp = await page.$(`${sel('viewpoint')}[data-photo="1"]`);
  if (vp) {
    await vp.click();
    await new Promise((r) => setTimeout(r, 1800));
    const slider = await page.$(sel('blend-slider'));
    record(`viewer ${width}: photo viewpoint 1 flies and shows the blend slider`, Boolean(slider));
    await shot(page, `viewer-${width}-viewpoint1`);
  } else {
    record(`viewer ${width}: viewpoint buttons present`, false);
  }
  noErrors(page, `viewer ${width}`);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
