#!/usr/bin/env node
/* building-view-check: a built whole place on its page (/memories/b/:id), in headless Edge (no Mapbox loads).

     node tools/memory-rooms/dev/seed-building.mjs --base http://127.0.0.1:8794   (once)
     node tools/memory-rooms/building-view-check.mjs [--base http://127.0.0.1:8794] [--dark]

   At 1440 and 390 (touch):
   - the 3D building loads above the checklist (ready), from its level GLBs + exterior;
   - Outside: every level closed, the roof on; Inside: the roof lifted off; Levels: the levels pulled apart and
     the roof above them; Plan: one level shown, clipped at its 1.2 m with a section cap, the others hidden; the
     picture changes between stages; the level picker switches the plan's level;
   - tapping a captured room (the living room) on the plan flies in and opens its spot; tapping a room with no
     spot says so;
   - no console errors, no sideways scroll at 390.
   Screens: memory-rooms-work/_building-view-check/. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { roomPolygon } from '../../src/memory-rooms/building/geometry.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_building-view-check');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const BASE = (args.includes('--base') ? args[args.indexOf('--base') + 1] : process.env.MEMORIES_API || 'http://127.0.0.1:8794').replace(/\/+$/, '');
const SCHEME = args.includes('--dark') ? 'dark' : 'light';
const TOKEN = process.env.MEMORIES_PASSWORD || 'trip-local';
const BID = '00000000-0000-4000-8000-00000000b001';
const SPOT = '00000000-0000-4000-8000-0000000051a1';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (n) => `[data-mr="${n}"]`;

const row = (await (await fetch(`${BASE}/api/memories/buildings/${BID}`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()).data;
if (!row?.plan) {
  console.error(`no built building ${BID} at ${BASE}: run tools/memory-rooms/dev/seed-building.mjs first`);
  process.exit(2);
}
const plan = row.plan;
const mid = (rid) => {
  const poly = roomPolygon(plan, plan.rooms.find((r) => r.id === rid));
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function open(width) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => m.type() === 'error' && page.problems.push(m.text()));
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: SCHEME }]);
  if (width < 600) await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('mr:token', token);
    localStorage.setItem('mr:who', 'james');
    localStorage.setItem('mr:map', 'atlas');
  }, TOKEN);
  return page;
}

/** What the viewer is doing, read off its instance (container.__viewer). */
const viewerState = (page) =>
  page.$eval(`${sel('building')} ${sel('viewer')}`, (el) => {
    const v = el.__viewer;
    if (!v) return null;
    const room = (id) => v.rooms.find((r) => r.id === id);
    let roofY = null;
    room('exterior')?.root.traverse((o) => {
      if (/^roof/.test(o.name || '') && roofY == null && o.userData.baseY != null) roofY = o.position.y - o.userData.baseY;
    });
    return {
      levels: v.rooms.filter((r) => r.id.startsWith('level-')).map((r) => ({ id: r.id, visible: r.holder.visible, y: r.holder.position.y, cut: r.cutawayMode })),
      exterior: room('exterior') ? room('exterior').holder.visible : null,
      roofLift: roofY,
      cuts: v.cutLevels ? [...v.cutLevels.keys()].map((r) => r.id) : [],
      cap: Boolean(v.world.getObjectByName('__section_cap')),
    };
  });

/** Screen point of a plan point [x, z] at height y (the canvas's own rect). */
const screenOf = (page, [x, z], y) =>
  page.$eval(
    `${sel('building')} ${sel('viewer')}`,
    (el, p) => {
      const v = el.__viewer;
      const r = v.viewRect();
      const c = el.querySelector('canvas').getBoundingClientRect();
      const q = v.camera.position.clone();
      q.set(p[0], p[2], p[1]).project(v.camera);
      return [c.left + r.x + ((q.x + 1) / 2) * r.w, c.top + r.y + ((1 - q.y) / 2) * r.h];
    },
    [x, z, y],
  );

async function press(page, width, s) {
  const el = await page.waitForSelector(s, { visible: true, timeout: 10000 });
  if (width < 600) await el.tap();
  else await el.click();
}

try {
  for (const width of [1440, 390]) {
    const L = `${width}`;
    const page = await open(width);
    await page.goto(`${BASE}/memories/b/${BID}`, { waitUntil: 'networkidle2' });
    const ready = await page.waitForSelector(`${sel('building')} ${sel('viewer')}[data-state="ready"]`, { timeout: 90000 }).then(() => true).catch(() => false);
    record(`${L}: the 3D building loads on the place page`, ready);
    if (!ready) {
      await page.screenshot({ path: path.join(OUT, `failed-${width}-${SCHEME}.png`) });
      continue;
    }
    await sleep(1200);
    const stage = await page.$(`${sel('building')} ${sel('viewer')}`);
    const shots = {};
    const states = {};
    for (const s of ['outside', 'inside', 'levels', 'plan']) {
      await press(page, width, sel(`building-${s}`));
      await sleep(1400);
      states[s] = await viewerState(page);
      shots[s] = await stage.screenshot({ encoding: 'base64' });
      await page.screenshot({ path: path.join(OUT, `${s}-${width}-${SCHEME}.png`) });
    }
    const o = states.outside;
    record(`${L}: Outside: every level closed, the roof on`, o && o.levels.every((l) => l.visible && l.cut === 'never' && l.y === 0) && o.exterior && (o.roofLift ?? 0) === 0, JSON.stringify(o));
    const i = states.inside;
    record(`${L}: Inside: the roof lifted off, the top level opened`, i && i.roofLift > 1 && i.levels.some((l) => l.cut === 'auto'), JSON.stringify(i));
    const lv = states.levels;
    record(`${L}: Levels: pulled apart, the roof above them`, lv && new Set(lv.levels.map((l) => l.y)).size === lv.levels.length && lv.levels.every((l) => l.cut === 'auto') && lv.roofLift > 3, JSON.stringify(lv));
    const pl = states.plan;
    record(`${L}: Plan: one level, cut at 1.2 m with a section cap, the rest hidden`, pl && pl.levels.filter((l) => l.visible).length === 1 && pl.cuts.length === 1 && pl.cap && pl.exterior === false, JSON.stringify(pl));
    const distinct = new Set(Object.values(shots)).size;
    record(`${L}: each stage looks different`, distinct === 4, `${distinct} distinct pictures`);
    // the level picker: the upper floor's plan
    if (plan.levels.length > 1) {
      const btns = await page.$$(sel('building-level'));
      if (width < 600) await btns[1].tap();
      else await btns[1].click();
      await sleep(1200);
      const up = await viewerState(page);
      record(`${L}: the level picker shows the upper floor's plan`, up.levels.find((l) => l.visible)?.id === `level-${plan.levels[1].id}` && up.cuts[0] === `level-${plan.levels[1].id}`, JSON.stringify(up.levels));
      await page.screenshot({ path: path.join(OUT, `plan-upper-${width}-${SCHEME}.png`) });
      if (width < 600) await btns[0].tap();
      else await btns[0].click();
      await sleep(1200);
    }
    // a room with no spot (the kitchen) says so; the living room opens its spot
    const [kx, ky] = await screenOf(page, mid('kitchen'), 0.05);
    if (width < 600) await page.touchscreen.tap(kx, ky);
    else await page.mouse.click(kx, ky);
    await sleep(500);
    const hint = await page.$eval('.mr-building__hint', (e) => e.textContent);
    record(`${L}: tapping a room with no photos says so`, /no photos yet/i.test(hint), hint);
    const [lx, ly] = await screenOf(page, mid('living'), 0.05);
    if (width < 600) await page.touchscreen.tap(lx, ly);
    else await page.mouse.click(lx, ly);
    const went = await page.waitForFunction((id) => location.pathname === `/memories/${id}`, { timeout: 8000 }, SPOT).then(() => true).catch(() => false);
    record(`${L}: tapping the living room flies in and opens its spot`, went, await page.evaluate(() => location.pathname));
    if (went) {
      const spotReady = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).then(() => true).catch(() => false);
      record(`${L}: the living room's slice opens on its spot page`, spotReady);
      await page.screenshot({ path: path.join(OUT, `living-${width}-${SCHEME}.png`) });
    }
    if (width < 600) {
      await page.goto(`${BASE}/memories/b/${BID}`, { waitUntil: 'networkidle2' });
      await page.waitForSelector(`${sel('building')} ${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).catch(() => {});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      record('390: no sideways scroll on the place page', overflow <= 0, `${overflow}px`);
    }
    record(`${L}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
    await page.browserContext().close();
  }
} catch (err) {
  record('ran to the end', false, err.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${SCHEME}). Screens: ${OUT}`);
process.exit(failed.length ? 1 : 0);
