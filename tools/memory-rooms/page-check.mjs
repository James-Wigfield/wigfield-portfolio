#!/usr/bin/env node
/* page-check: the /memories screens in headless Edge, at 1440 and 390 px.

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     node tools/memory-rooms/page-check.mjs [--base http://127.0.0.1:8788] [--dark] [--swiftshader] [--mapstyle atlas|standard]

   The maps are Mapbox GL (WebGL 2), so Edge runs on the real GPU (ANGLE d3d11);
   --swiftshader falls back to software GL. One run makes about 5 Mapbox map loads
   (gate, map ×2, pick map ×2) out of the trial's 5,000 a month.

   Checks
     gate      fresh device → password gate → wrong password refused → right one → who picker
     map       the Mapbox globe loads and draws tiles at 1440 and 390; spots placed; a dot opens its card;
               a cluster splits (or lists); "n elsewhere" turns the globe to those spots; "Back to the
               trip" returns to the opening view; filters + clusters + cards + zooms keep ONE map load
     fallback  ?map=atlas draws the SVG atlas; with WebGL off the atlas takes over by itself
     capture   /memories/new: every step reachable at 390 (4 photos uploaded), nothing saved; the pick
               map loads at 390 and 1440 and a tap drops the pin; going offline swaps it to the atlas
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
const mapstyle = opt('--mapstyle', null);
const q = (route) => (mapstyle ? `${route}${route.includes('?') ? '&' : '?'}mapstyle=${mapstyle}` : route);
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
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

const launch = (extra = []) => puppeteer.launch({ executablePath: EDGE, headless: true, args: [...(args.includes('--swiftshader') ? SOFT : GPU), ...extra] });
const browser = await launch();

/** A page at `width`; `via` = a browser or an isolated context (fresh storage, e.g. no capture draft). */
async function open(width, { authed = true, via = browser } = {}) {
  const page = await via.newPage();
  const ua = await page.browser().userAgent();
  const mobile = width < 600;
  await page.emulate({ viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : ua });
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function noErrors(page, label) {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
}

// ── gate ─────────────────────────────────────────────────────────────────────
{
  const page = await open(390, { authed: false });
  await page.goto(`${base}${q('/memories')}`, { waitUntil: 'networkidle2' });
  const gate = await page.waitForSelector(sel('gate-password'), { visible: true, timeout: 20000 }).catch(() => null);
  record('gate: a fresh device sees the password gate', Boolean(gate));
  if (gate) {
    await shot(page, 'gate-390');
    await page.type(sel('gate-password'), 'definitely-wrong');
    await page.click(sel('gate-submit'));
    await wait(1200);
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

// ── map (Mapbox) ─────────────────────────────────────────────────────────────

const MAPBOX_READY = `${sel('map')}[data-engine="mapbox"][data-ready]`;
/** Resolves when the map inside `root` has nothing left to draw (or after 15 s). */
const idle = (page, root = sel('map')) =>
  page.evaluate(
    (root) =>
      new Promise((done) => {
        const map = document.querySelector(root)?.__mrMap;
        if (!map) return done(false);
        const t = setTimeout(() => done(false), 15000);
        map.once('idle', () => {
          clearTimeout(t);
          done(true);
        });
        map.triggerRepaint();
      }),
    root,
  );
/** Grey-level spread of the map canvas alone (markers hidden): a blank canvas is ~0. */
async function tileSpread(page, root) {
  await page.$eval('.mr-mapoverlay', (el) => (el.style.visibility = 'hidden')).catch(() => {});
  const canvas = await page.$(`${root} canvas`);
  const buf = canvas ? await canvas.screenshot() : null;
  await page.$eval('.mr-mapoverlay', (el) => (el.style.visibility = '')).catch(() => {});
  if (!buf) return 0;
  const st = await sharp(buf).greyscale().stats();
  return st.channels[0].stdev;
}
const loads = (page) => page.evaluate(() => window.__mrMapLoads || 0);
const zoomOf = (page) => page.$eval(sel('map'), (el) => Number(el.dataset.zoom));
const markerIds = (page) =>
  page.$$eval(`${sel('spot-dot')}, ${sel('cluster')}`, (els) => els.flatMap((e) => (e.dataset.id ? [e.dataset.id] : (e.dataset.ids || '').split(','))));
const click = (handle) => handle.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

const ON_MAP = { west: -141, east: -52, south: 18, north: 60.5 }; // the trip area, src/memory-rooms/map/geo.js
const awayIds = spots
  .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat >= ON_MAP.south && s.lat <= ON_MAP.north && s.lng >= ON_MAP.west && s.lng <= ON_MAP.east))
  .map((s) => s.id);

for (const width of [1440, 390]) {
  const page = await open(width);
  await page.goto(`${base}${q('/memories')}`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(MAPBOX_READY, { timeout: 30000 }).then(() => true).catch(() => false);
  const engine = await page.$eval('.mr-spotsmap', (el) => `${el.dataset.engine}${el.dataset.engineReason ? ` (${el.dataset.engineReason})` : ''}`).catch(() => 'none');
  record(`map ${width}: the Mapbox globe loads`, ready, `engine ${engine}`);
  if (!ready) {
    await shot(page, `map-${width}`);
    noErrors(page, `map ${width}`);
    await page.close();
    continue;
  }
  await idle(page);
  const spread = await tileSpread(page, sel('map'));
  await page.waitForSelector(`${sel('spot-dot')}, ${sel('cluster')}`, { timeout: 15000 }).catch(() => null);
  const dots = await page.$$eval(`${sel('spot-dot')}, ${sel('cluster')}`, (els) => els.length);
  const style = await page.$eval(sel('map'), (el) => el.dataset.style);
  record(`map ${width}: tiles drawn and spots placed`, spread > 3 && dots > 0, `style ${style}, canvas spread ${spread.toFixed(1)}, ${dots} dots/clusters`);
  await shot(page, `map-${width}`);

  // a spot opens its card
  const dot = await page.$(sel('spot-dot'));
  if (dot) {
    await click(dot);
    const card = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).catch(() => null);
    record(`map ${width}: clicking a spot opens its card`, Boolean(card));
    await wait(450); // the card fades in
    if (card) await shot(page, `map-${width}-card`);
    await page.keyboard.press('Escape');
  }

  // a cluster zooms apart (or, for rooms of one building, lists its spots)
  const cluster = await page.$(sel('cluster'));
  if (cluster) {
    const ids = (await cluster.evaluate((el) => el.dataset.ids)).split(',');
    await click(cluster);
    await wait(400);
    await idle(page);
    const listed = Boolean(await page.$(sel('cluster-card')));
    const apart = await page.$$eval(sel('spot-dot'), (els, ids) => ids.filter((id) => els.some((e) => e.dataset.id === id)).length, ids);
    record(`map ${width}: a cluster of ${ids.length} splits or lists`, listed || apart === ids.length, listed ? 'listed' : `${apart}/${ids.length} apart at zoom ${(await zoomOf(page)).toFixed(2)}`);
    await shot(page, `map-${width}-cluster`);
    await page.keyboard.press('Escape');
  }

  // filters and zooms re-draw the overlay only
  for (const [name, value] of [['person', 'justin'], ['person', 'all'], ['status', 'rendered'], ['status', 'all']]) {
    await page.click(`[data-mr="filter-${name}"][data-value="${value}"]`).catch(() => {});
    await wait(250);
  }
  const z0 = await zoomOf(page);
  await page.click(sel('zoom-in'));
  await wait(700);
  const z1 = await zoomOf(page);
  record(`map ${width}: zoom in`, z1 > z0 + 0.5, `${z0.toFixed(2)} → ${z1.toFixed(2)}`);

  // "n elsewhere" turns the globe to the spots outside the trip
  if (awayIds.length && (await page.$(sel('elsewhere-note')))) {
    await page.click(sel('elsewhere-note'));
    await wait(400);
    await idle(page);
    await wait(300);
    const shown = (await markerIds(page)).filter((id) => awayIds.includes(id)).length;
    record(`map ${width}: "elsewhere" turns the globe to them`, shown > 0, `${shown}/${awayIds.length} on screen`);
    await shot(page, `map-${width}-elsewhere`);
  }
  const resetOn = await page.$eval(sel('zoom-reset'), (el) => !el.disabled);
  await page.click(sel('zoom-reset'));
  await wait(400);
  await idle(page);
  const auto = await page.$eval(sel('map'), (el) => el.hasAttribute('data-auto'));
  record(`map ${width}: "Back to the trip" returns to the opening view`, resetOn && auto);
  const n = await loads(page);
  record(`map ${width}: filters, clusters, cards and zooms keep one map load`, n === 1, `${n} load(s)`);
  noErrors(page, `map ${width}`);
  await page.close();
}

// ── fallback: the SVG atlas ─────────────────────────────────────────────────

async function atlasDrawn(page, root = sel('map')) {
  const ok = await page.waitForSelector(`${root} .mr-atlas-borders`, { timeout: 20000 }).then(() => true).catch(() => false);
  const geometry = ok ? await page.$$eval(`${root} .mr-atlas-land, ${root} .mr-atlas-borders, ${root} .mr-atlas-canada`, (els) => els.map((e) => (e.getAttribute('d') || '').length)) : [];
  return { ok: geometry.length === 3 && geometry.every((len) => len > 2000), geometry };
}
{
  const page = await open(1440);
  await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
  const { ok, geometry } = await atlasDrawn(page);
  const dots = await page.$$eval(`${sel('spot-dot')}, ${sel('cluster')}`, (els) => els.length);
  record('fallback: ?map=atlas draws the SVG atlas with spots', ok && dots > 0, `land/borders/canada ${geometry.join('/')}, ${dots} dots/clusters`);
  await shot(page, 'map-1440-atlas');
  record('fallback: the atlas makes no Mapbox load', (await loads(page)) === 0);
  noErrors(page, 'fallback atlas');
  await page.close();
}
{
  const noGl = await launch(['--disable-webgl', '--disable-3d-apis']);
  const page = await open(390, { via: noGl });
  await page.goto(`${base}${q('/memories')}`, { waitUntil: 'networkidle2' });
  const { ok } = await atlasDrawn(page);
  const reason = await page.$eval('.mr-spotsmap', (el) => `${el.dataset.engine}/${el.dataset.engineReason}`).catch(() => 'none');
  record('fallback: with WebGL off the atlas takes over', ok && reason === 'atlas/webgl', reason);
  await shot(page, 'map-390-no-webgl');
  noErrors(page, 'fallback no-webgl');
  await page.close();
  await noGl.close();
}

// ── capture (walk every step, don't save) + the pick map ───────────────────

const PICK = sel('loc-pick-map');
async function walkToLocation(page, width) {
  const phone = width < 600;
  const steps = [];
  try {
    await page.waitForSelector(sel('kind-interior'), { visible: true, timeout: 15000 });
    if (phone) await shot(page, 'capture-1-kind-390');
    await page.click(sel('kind-interior'));
    await page.type(sel('title-input'), 'page-check (not saved)');
    await page.click(sel('next'));
    steps.push('kind');
    const input = await page.waitForSelector(sel('photo-input'), { timeout: 10000 });
    if (phone) await shot(page, 'capture-2-photos-empty-390');
    const tmp = [];
    for (let i = 1; i <= 4; i++) {
      const f = path.join(OUT, `tmp-photo-${width}-${i}.jpg`);
      await sharp({ create: { width: 1200, height: 1600, channels: 3, background: ['#a7774f', '#56677f', '#e9e2d4', '#7a5a3c'][i - 1] } }).jpeg().toFile(f);
      tmp.push(f);
    }
    await input.uploadFile(...tmp);
    await page.waitForFunction(() => document.querySelectorAll('[data-mr="photo-thumb"]').length >= 4, { timeout: 30000 });
    if (phone) await shot(page, 'capture-2-photos-390');
    await page.click(sel('next'));
    steps.push('photos');
    await page.waitForSelector(sel('note-input'), { visible: true, timeout: 10000 });
    await page.type(sel('note-input'), 'not saved');
    if (phone) await shot(page, 'capture-3-memory-390');
    await page.click(sel('next'));
    steps.push('memory');
    await page.waitForSelector(sel('loc-gps'), { visible: true, timeout: 10000 });
    steps.push('location');
    tmp.forEach((f) => fs.rmSync(f, { force: true }));
  } catch (e) {
    record(`capture ${width}: step failed`, false, e.message.split('\n')[0]);
  }
  return steps;
}

for (const width of [390, 1440]) {
  const phone = width < 600;
  const ctx = await browser.createBrowserContext(); // a fresh device: no draft from the last walk
  const page = await open(width, { via: ctx });
  await page.goto(`${base}${q('/memories/new')}`, { waitUntil: 'networkidle2' });
  const steps = await walkToLocation(page, width);
  if (phone) record('capture 390: all four steps reachable', steps.length === 4, steps.join(' → '));
  if (steps.length === 4) {
    const ready = await page.waitForSelector(`${PICK}[data-engine="mapbox"][data-ready]`, { timeout: 30000 }).then(() => true).catch(() => false);
    record(`capture ${width}: the pick map loads (Mapbox)`, ready);
    if (ready) {
      await idle(page, PICK);
      await page.$eval(PICK, (el) => el.scrollIntoView({ block: 'center' }));
      await wait(300);
      const at = await page.$eval(PICK, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (phone) await page.touchscreen.tap(at.x, at.y);
      else await page.mouse.click(at.x, at.y);
      const pinned = await page.waitForSelector(sel('loc-pin'), { timeout: 5000 }).then(() => true).catch(() => false);
      const source = await page.$eval(sel('loc-status'), (el) => el.dataset.source);
      record(`capture ${width}: a tap on the map drops the pin`, pinned && source === 'pin', `source ${source}`);
      await idle(page, PICK);
      await shot(page, `capture-4-location-${width}`);
      const n = await loads(page);
      record(`capture ${width}: one map load for the pick map`, n === 1, `${n} load(s)`);
      if (phone) {
        // signal drops mid-capture: the atlas takes over (it needs no network) and the pin stays
        await page.setOfflineMode(true);
        const atlas = await atlasDrawn(page, '.mr-pickmap[data-engine="atlas"]').then((r) => r.ok);
        const reason = await page.$eval('.mr-pickmap', (el) => el.dataset.engineReason).catch(() => null);
        const pinKept = Boolean(await page.$(sel('loc-pin')));
        record('capture 390: offline, the pick map swaps to the atlas and keeps the pin', atlas && reason === 'offline' && pinKept, `reason ${reason}`);
        await shot(page, 'capture-4-location-390-offline');
        await page.setOfflineMode(false);
      }
    }
  }
  if (phone) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    record('capture 390: no horizontal overflow', overflow <= 1, `${overflow}px`);
  }
  // going offline on purpose makes in-flight requests fail; that isn't the app's error
  page.problems = page.problems.filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError/i.test(p));
  noErrors(page, `capture ${width}`);
  await page.close();
  await ctx.close();
}

// ── viewer ───────────────────────────────────────────────────────────────────
for (const width of [1440, 390]) {
  const page = await open(width);
  await page.goto(`${base}/memories/${rendered.id}`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 90000 }).then(() => true).catch(() => false);
  const mode = await page.$eval(sel('viewer'), (el) => el.getAttribute('data-mode')).catch(() => null);
  record(`viewer ${width}: "${rendered.title}" GLB loads`, ready && mode === 'model', `state ${ready ? 'ready' : 'not ready'}, mode ${mode}`);
  await wait(2500);
  await shot(page, `viewer-${width}`);
  const vp = await page.$(`${sel('viewpoint')}[data-photo="1"]`);
  if (vp) {
    await vp.click();
    await wait(1800);
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
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}${mapstyle ? `, ${mapstyle}` : ''}). Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
