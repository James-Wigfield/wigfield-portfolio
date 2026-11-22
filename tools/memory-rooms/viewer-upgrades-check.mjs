#!/usr/bin/env node
/* viewer-upgrades-check: the light / dark switch on every Memory Rooms page, Spin on a spot, and Furnished on a
   building room's spot (DECISIONS 192–199). Headless Edge (real GPU), no Mapbox loads (mr:map = atlas).

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     node tools/memory-rooms/viewer-upgrades-check.mjs [--base http://127.0.0.1:8788] [--dark]

   theme     at 1440 and 390 on the map, a spot, a place, a spot's walk, a place's walk, capture and edit: the
             header has the switch (keyboard-focusable, a visible focus ring, a 44 px target on a phone); it
             starts on Auto = the device's scheme (--dark emulates a dark device); it steps Auto → Light → Dark
             and the page's tokens follow at once with no reload, and so do the viewer's drafting ink, the
             walk's clear colour and the map's land; the pick survives a reload and the very first paint of the
             .mr root is already the picked theme (no flash); no sideways scroll at 390
   spin      a spot: Spin turns the camera at a constant elevation; a photo viewpoint stops it; a hidden tab
             stops it; with prefers-reduced-motion it is still off until pressed, and then works
   furnished a building room's spot with an empty bake has Furnished (off hides its furniture and swaps the
             atlases, one load); a plain spot has no Furnished toggle
   glass     glass… materials are drawn see-through (transparent, opacity 0.18), so a room shows through them
   console   zero console errors and page errors
   Screens → memory-rooms-work/_page-check/upgrades-*.png. Exit 1 if anything fails. */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  return ok;
};
const until = async (fn, timeout = 5000, every = 100) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) return null;
    await sleep(every);
  }
};

const spots = await api.listSpots();
const buildings = await api.listBuildings().catch(() => []);
const hasModel = (s) => s.status === 'rendered' && s.media.some((m) => m.type === 'model' && m.name === 'room');
const plain = spots.find((s) => hasModel(s) && !s.buildingId && s.kind === 'interior' && s.scene?.cameras?.length);
const roomSpot = spots.find((s) => hasModel(s) && s.buildingId);
const place = buildings.find((b) => b.plan && b.media.some((m) => m.type === 'model' && /^level-/.test(m.name)));
if (!plain) {
  console.error('needs a rendered plain spot with cameras (seed-dev.mjs --examples-only)');
  process.exit(2);
}
const PAGES = [
  ['map', '/memories'],
  ['spot', `/memories/${plain.id}`, '[data-mr="viewer"][data-state="ready"]'],
  ...(place ? [['place', `/memories/b/${place.id}`, '[data-mr="building"] [data-mr="viewer"][data-state="ready"]']] : []),
  ['walk', `/memories/${plain.id}/walk`, '[data-mr="walk"][data-state="ready"]'],
  ...(place ? [['place-walk', `/memories/b/${place.id}/walk`, '[data-mr="walk"][data-state="ready"]']] : []),
  ['capture', '/memories/new'],
  ['edit', `/memories/${plain.id}/edit`],
];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
async function open(width, { reduced = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => m.type() === 'error' && page.problems.push(m.text()));
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ]);
  if (width < 600) await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width, height: 900 });
  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', 'james');
    localStorage.setItem('mr:map', 'atlas');
    // the first paint of the .mr root: its background the moment it is inserted (no flash of the other theme)
    window.__mrFirst = null;
    new MutationObserver((list, obs) => {
      const el = document.querySelector('.mr');
      if (!el) return;
      window.__mrFirst = { bg: getComputedStyle(el).backgroundColor, attr: document.documentElement.dataset.mrTheme || null };
      obs.disconnect();
    }).observe(document, { childList: true, subtree: true });
  }, cfg.token);
  return page;
}
const look = (page) =>
  page.evaluate(() => {
    const mr = document.querySelector('.mr');
    const v = document.querySelector('[data-mr="viewer"]')?.__viewer;
    const w = document.querySelector('[data-mr="walk"]')?.__walk;
    const land = document.querySelector('.mr-glyph-base, .mr-atlas-land, [data-mr="atlas"] path');
    return {
      attr: document.documentElement.dataset.mrTheme,
      root: mr?.dataset.theme,
      bg: mr ? getComputedStyle(mr).backgroundColor : null,
      pref: document.querySelector('[data-mr="theme-toggle"]')?.dataset.pref,
      // a night spot's stage is the darkroom in both themes (scene.style.mood): its ink never follows
      grid: document.querySelector('[data-mr="viewer"]')?.closest('[data-mood="night"]') ? null : v?.theme?.gridInk?.getHexString?.() || null,
      walk: w?.clear?.getHexString?.() || null,
      land: land ? getComputedStyle(land).fill : null,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
const darkBg = (c) => {
  const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/.exec(c || '');
  return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) < 3 * 128 : null;
};

// ── theme ──
for (const width of [1440, 390]) {
  for (const [name, route, wait] of PAGES) {
    const L = `${width} ${name}`;
    const page = await open(width);
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    const toggle = await page.waitForSelector('[data-mr="theme-toggle"]', { timeout: 20000 }).catch(() => null);
    if (wait) await page.waitForSelector(wait, { timeout: 90000 }).catch(() => null);
    await sleep(600);
    record(`${L}: the header has the theme switch`, Boolean(toggle));
    if (!toggle) {
      await page.browserContext().close();
      continue;
    }
    const a = await look(page);
    record(`${L}: Auto follows the device (${scheme})`, a.pref === 'system' && a.attr === scheme && a.root === scheme && darkBg(a.bg) === (scheme === 'dark'), JSON.stringify(a));
    const size = await toggle.boundingBox();
    if (width < 600) record(`${L}: a 44 px target on a phone`, size.width >= 44 && size.height >= 44, `${size.width}x${size.height}`);
    // keyboard: focus it, a visible ring, Enter steps it
    await page.evaluate(() => document.activeElement?.blur());
    await toggle.focus();
    await page.keyboard.press('Shift'); // focus-visible after a key
    const ring = await toggle.evaluate((e) => {
      const cs = getComputedStyle(e);
      return e.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    });
    record(`${L}: keyboard focus shows a ring`, ring);
    await page.keyboard.press('Enter'); // Auto → Light
    await sleep(250);
    const b = await look(page);
    await toggle.click(); // Light → Dark
    await sleep(350);
    const c = await look(page);
    const followed =
      b.pref === 'light' && b.attr === 'light' && darkBg(b.bg) === false && c.pref === 'dark' && c.attr === 'dark' && darkBg(c.bg) === true &&
      (b.grid == null || b.grid !== c.grid) && (b.walk == null || b.walk !== c.walk) && (b.land == null || b.land !== c.land);
    record(`${L}: Light → Dark follows at once (page, viewer, walk, map)`, followed, JSON.stringify({ b, c }));
    await page.screenshot({ path: path.join(OUT, `upgrades-theme-${name}-${width}-${scheme}.png`) });
    // the pick survives a reload, with no flash: the first paint is already dark
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-mr="theme-toggle"]', { timeout: 20000 }).catch(() => null);
    const first = await page.evaluate(() => window.__mrFirst);
    const d = await look(page);
    record(`${L}: the pick survives a reload, first paint already dark`, d.pref === 'dark' && d.attr === 'dark' && first && first.attr === 'dark' && darkBg(first.bg) === true, JSON.stringify(first));
    if (width < 600) record(`${L}: no sideways scroll`, d.overflow <= 0, `${d.overflow}px`);
    // back to Auto for the next page
    await page.evaluate(() => localStorage.removeItem('mr:theme'));
    record(`${L}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 2).join(' | '));
    await page.browserContext().close();
  }
}

// ── spin on a spot ──
const cam = (page) =>
  page.$eval('[data-mr="viewer"]', (el) => {
    const v = el.__viewer;
    const o = v.camera.position.clone().sub(v.controls.target);
    return { az: Math.atan2(o.x, o.z), el: Math.atan2(o.y, Math.hypot(o.x, o.z)), on: el.dataset.spin, view: v.view };
  });
const turned = (a, b) => Math.abs(Math.atan2(Math.sin(b.az - a.az), Math.cos(b.az - a.az)));
for (const width of [1440, 390]) {
  const L = `${width} spin`;
  const page = await open(width);
  await page.goto(`${base}/memories/${plain.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
  await sleep(2300); // the reveal swing
  const a = await cam(page);
  record(`${L}: off by default`, a.on === 'off');
  const btn = await page.$('[data-mr="spin"]');
  await (width < 600 ? btn.tap() : btn.click());
  await sleep(2500);
  const b = await cam(page);
  record(`${L}: Spin turns the camera at a constant elevation`, b.on === 'on' && turned(a, b) > 0.02 && Math.abs(b.el - a.el) < 0.005, `dAz ${turned(a, b).toFixed(3)} dEl ${(b.el - a.el).toFixed(4)}`);
  const vp = await page.$('[data-mr="viewpoint"]');
  await (width < 600 ? vp.tap() : vp.click());
  await sleep(300);
  record(`${L}: a photo viewpoint stops it`, (await cam(page)).on === 'off');
  await page.click('[data-mr="home-view"]');
  await sleep(1200);
  await (width < 600 ? (await page.$('[data-mr="spin"]')).tap() : page.click('[data-mr="spin"]'));
  await sleep(600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(200);
  record(`${L}: a hidden tab stops it`, (await cam(page)).on === 'off');
  record(`${L}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 2).join(' | '));
  await page.browserContext().close();
}
{
  const page = await open(1440, { reduced: true });
  await page.goto(`${base}/memories/${plain.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
  await sleep(800);
  const a = await cam(page);
  await sleep(1500);
  const a2 = await cam(page);
  record('reduced motion: nothing turns by itself', a.on === 'off' && turned(a, a2) < 1e-4);
  await page.click('[data-mr="spin"]');
  await sleep(2500);
  const b = await cam(page);
  record('reduced motion: Spin still works when pressed', b.on === 'on' && turned(a2, b) > 0.02, `dAz ${turned(a2, b).toFixed(3)}`);
  await page.browserContext().close();
}

// ── furnished on spots ──
{
  const page = await open(1440);
  await page.goto(`${base}/memories/${plain.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
  await sleep(500);
  record('furnished: a plain spot has no Furnished toggle', !(await page.$('[data-mr="furnished"]')));
  // glass is see-through
  const glass = await page.$eval('[data-mr="viewer"]', (el) => {
    const out = [];
    el.__viewer.world.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (/^glass/i.test(m.name || '')) out.push([m.transparent, +m.opacity.toFixed(2)]);
    });
    return out;
  });
  record('glass: drawn see-through (transparent, 0.18)', glass.length === 0 || glass.every(([t, o]) => t && o <= 0.18 + 1e-6), JSON.stringify(glass.slice(0, 3)));
  await page.browserContext().close();
}
if (roomSpot?.media.some((m) => m.type === 'model' && m.name === 'empty')) {
  const page = await open(1440);
  await page.goto(`${base}/memories/${roomSpot.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
  await sleep(1500);
  const btn = await page.$('[data-mr="furnished"]');
  record(`furnished: ${roomSpot.title} (a room of a place) has the toggle`, Boolean(btn));
  if (btn) {
    await page.screenshot({ path: path.join(OUT, `upgrades-spot-furnished-${scheme}.png`) });
    await btn.click();
    const off = await until(
      () =>
        page.$eval('[data-mr="viewer"]', (el) => {
          const v = el.__viewer;
          const r = v.rooms[0];
          const hidden = r.furnishing.furniture.every((o) => !o.layers.isEnabled(0));
          return !v.furnished && !el.dataset.furnishedLoading && hidden && r.furnishing.emptyMaps?.size ? { loads: v.emptyLoads, furniture: r.furnishing.furniture.length, maps: r.furnishing.emptyMaps.size } : null;
        }),
      20000,
    );
    record('furnished: off hides the furniture and swaps to the empty atlases (one load)', Boolean(off) && off.loads === 1, JSON.stringify(off));
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, `upgrades-spot-empty-${scheme}.png`) });
  }
  record('furnished: no console/page errors', page.problems.length === 0, page.problems.slice(0, 2).join(' | '));
  await page.browserContext().close();
} else console.log('  · no room spot with model/empty here: the spot Furnished checks are skipped');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Screens: ${OUT}`);
process.exit(failed.length ? 1 : 0);
