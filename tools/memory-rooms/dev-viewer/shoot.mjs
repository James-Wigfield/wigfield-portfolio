#!/usr/bin/env node
/* Headless checks + screenshots for the Memory Rooms viewer, spot and group pages.

     node tools/memory-rooms/dev-viewer/shoot.mjs [scenario …] [--gpu] [--base http://localhost:5192]

   Scenarios: bedroom diner preview photos group missing phone dark lightbox scan dispose
   (none given = all). Screens land in memory-rooms-work/_dev/screens/viewer/. Exits 1 on any
   console error / page error / failed check. Needs the dev Worker (8794) + Vite (5192) running
   and setup-dev.mjs run once (kitchen spot + sample scan). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_dev', 'screens', 'viewer');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : process.env.MR_BASE || 'http://localhost:5192';
const GPU = args.includes('--gpu');
const wanted = args.filter((a) => !a.startsWith('--') && !/^https?:/.test(a));

// The real routes need the shell (MemoryRoomsApp) to compile; while it is mid-build,
// fall back to harness.html (same pages on a HashRouter). --harness forces it.
let HARNESS = args.includes('--harness');
if (!HARNESS) {
  const res = await fetch(`${BASE}/src/memory-rooms/MemoryRoomsApp.jsx`).catch(() => null);
  HARNESS = !res || !res.ok;
}
const HARNESS_PATH = '/tools/memory-rooms/dev-viewer/harness.html#';
const href = (p) => (HARNESS ? `${HARNESS_PATH}${p}` : p);
console.log(HARNESS ? 'using the dev harness (shell not compiling or --harness)' : 'using the real /memories routes');

export const IDS = {
  bedroom: 'cff5581a-b32a-58f7-aef5-794ba09860f5',
  diner: '1d9c7950-99d8-5790-a606-a18b06589160',
  banff: '1f27a318-e9e8-58c7-a6bc-570bd04bf431',
  hostel: '1a174b40-431b-5ccf-a6b2-6c718e5a44ce',
  kitchen: '35d78d36-cd77-51f3-a853-3222e46b2d8e',
};
const DESKTOP = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844, mobile: true };

fs.mkdirSync(OUT, { recursive: true });
const problems = [];
const notes = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: GPU
    ? ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(url, { w, h, mobile, dark, allow404 } = DESKTOP) {
  const page = await browser.newPage();
  page.label = `${url} ${w}x${h}${dark ? ' dark' : ''}`;
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: !!mobile, hasTouch: !!mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mr:token', 'trip-local');
    localStorage.setItem('mr:who', 'james');
  });
  page.on('console', (m) => {
    const t = m.type();
    // the browser logs the intentional 404 fetch of a missing spot as an error
    if (t === 'error' && allow404 && /status of 40[04]/.test(m.text())) return;
    if (t === 'error') problems.push(`console.error [${page.label}] ${m.text()}`);
    else if (t === 'warn' && !/GPU stall|ReadPixels|WebGL/.test(m.text())) notes.push(`console.warn [${page.label}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror [${page.label}] ${e.message}`));
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(why)) problems.push(`requestfailed [${page.label}] ${r.url()} ${why}`);
  });
  await page.goto(`${BASE}${href(url)}`, { waitUntil: 'domcontentloaded' });
  return page;
}

async function waitState(page, state = 'ready', timeout = 45000) {
  try {
    await page.waitForSelector(`[data-mr="viewer"][data-state="${state}"]`, { timeout });
    return true;
  } catch {
    const got = await page.$eval('[data-mr="viewer"]', (el) => `${el.dataset.state}/${el.dataset.mode}`).catch(() => 'no viewer');
    problems.push(`[${page.label}] viewer never reached ${state} (is ${got})`);
    return false;
  }
}

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  shot ${name}.png`);
};

/** Orbit to an offset of the home pose; returns which walls are visible after the next frame. */
async function orbit(page, dAz, dEl = 0, scale = 1) {
  await page.evaluate(
    (a, e, s) => {
      const v = window.__mrViewer;
      v.tweens.clear();
      v.setOrbitPose(v.offsetPose(v.homePose, a, e, s));
      v.requestRender();
    },
    dAz,
    dEl,
    scale,
  );
  await sleep(400);
  return page.evaluate(() => {
    const v = window.__mrViewer;
    const walls = v.rooms[0].walls;
    const vis = Object.fromEntries(Object.entries(walls).map(([k, list]) => [k, list.length ? list.every((o) => o.visible) : null]));
    const c = v.camera.position;
    const attached = {};
    v.world.traverse((o) => {
      if (/^obj__(shelf|poster|curtain)$/.test(o.name)) attached[o.name.slice(5)] = o.visible;
    });
    return { cam: [c.x, c.y, c.z].map((n) => +n.toFixed(2)), walls: vis, ceiling: v.rooms[0].ceilings.map((o) => o.visible), attached };
  });
}

const memory = (page) => page.evaluate(() => ({ ...window.__mrViewer.renderer.info.memory }));

/** Client-side navigation (BrowserRouter listens to popstate). */
async function navigate(page, url) {
  await page.evaluate(
    (u, harness) => {
      if (harness) {
        window.location.hash = u;
        return;
      }
      window.history.pushState({}, '', u);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    url,
    HARNESS,
  );
}

const SCENARIOS = {
  async bedroom() {
    const page = await open(`/memories/${IDS.bedroom}`);
    if (!(await waitState(page))) return;
    await sleep(2600);
    await shot(page, 'bedroom-desktop-light-home');
    for (const [az, el] of [[0, 0], [90, 0], [180, 0], [270, 0], [45, -25]]) {
      const r = await orbit(page, az, el);
      notes.push(`bedroom orbit az+${az} el${el}: cam ${r.cam.join(',')} walls ${JSON.stringify(r.walls)} ceiling ${r.ceiling}`);
      await shot(page, `bedroom-orbit-az${az}${el ? `-el${-el}` : ''}`);
    }
    await orbit(page, 0, 0);
    await page.click('[data-mr="pin"][data-index="0"]');
    await sleep(300);
    await shot(page, 'bedroom-pin-open');
    // shelf → south wall, poster → west, curtain → north (bedroom.scene.json)
    for (const [az, expect] of [[0, { shelf: false, curtain: true, poster: true }], [180, { shelf: true, curtain: false, poster: false }]]) {
      const r = await orbit(page, az, 0);
      for (const [k, want] of Object.entries(expect)) {
        if (r.attached[k] !== want) problems.push(`az+${az}: obj__${k} visible=${r.attached[k]}, expected ${want} (wall-attached hiding)`);
      }
      notes.push(`bedroom az+${az} attached ${JSON.stringify(r.attached)}`);
    }
    await orbit(page, 0, 0);
    await page.hover('[data-mr="viewpoint"][data-photo="2"]');
    await sleep(250);
    const tag = await page.$eval('.mr-camtag:not([hidden])', (el) => el.textContent).catch(() => null);
    if (tag !== 'Photo 2') problems.push(`hovering thumbnail 2 should label its camera glyph, got ${tag}`);
    await shot(page, 'bedroom-thumb-hover-camtag');
    await page.mouse.move(5, 300);
    const inStage = await page.$$eval('.mr-spot__stage [data-mr="viewpoint"]', (els) => els.length);
    if (!inStage) problems.push('viewpoint buttons are not inside the stage');
    await page.click('[data-mr="viewpoint"][data-photo="1"]');
    await sleep(1600);
    const vp = await page.evaluate(() => ({ ...window.__mrViewer.getViewpoint(), fov: window.__mrViewer.camera.fov, aspect: window.__mrViewer.camera.aspect }));
    notes.push(`bedroom viewpoint 1: ${JSON.stringify(vp)}`);
    if (vp.photo !== 1) problems.push('viewpoint 1 not active after click');
    if (!(await page.$('[data-mr="blend-slider"]'))) problems.push('blend slider missing in a viewpoint');
    await shot(page, 'bedroom-vp1-blend100');
    for (const b of [0.5, 0]) {
      await page.evaluate((x) => window.__mrViewer.setBlend(x), b);
      await sleep(250);
      const val = await page.$eval('[data-mr="blend-slider"]', (el) => el.value);
      if (Math.abs(Number(val) - b) > 0.01) problems.push(`blend slider shows ${val}, expected ${b}`);
      await shot(page, `bedroom-vp1-blend${Math.round(b * 100)}`);
    }
    await page.evaluate(() => window.__mrViewer.setBlend(1));
    await page.click('[data-mr="viewpoint"][data-photo="2"]');
    await sleep(1600);
    await shot(page, 'bedroom-vp2-blend100');
    await page.evaluate(() => window.__mrViewer.setBlend(0));
    await sleep(200);
    await shot(page, 'bedroom-vp2-blend0');
    await page.click('[data-mr="home-view"]');
    await sleep(1300);
    const back = await page.evaluate(() => window.__mrViewer.getViewpoint());
    if (back.photo !== null) problems.push('home-view did not return to the orbit');
    await shot(page, 'bedroom-back-home');
    await page.close();
  },

  async scan() {
    const page = await open(`/memories/${IDS.bedroom}`);
    if (!(await waitState(page))) return;
    if (!(await page.$('[data-mr="mode-scan"]'))) {
      problems.push('no mode-scan toggle on the bedroom (scan media missing?)');
      return;
    }
    await page.click('[data-mr="mode-scan"]');
    await page.waitForSelector('[data-mr="viewer"][data-mode="scan"]', { timeout: 5000 });
    const ok = await waitState(page, 'ready', 60000);
    await sleep(2500);
    if (ok) notes.push(`scan bounds: ${await page.evaluate(() => JSON.stringify(window.__mrViewer.scan?.bounds))}`);
    await shot(page, 'bedroom-scan');
    await page.click('[data-mr="mode-model"]');
    await waitState(page);
    await sleep(500);
    const mode = await page.$eval('[data-mr="viewer"]', (el) => el.dataset.mode);
    if (mode !== 'model') problems.push(`after mode-model, data-mode = ${mode}`);
    await shot(page, 'bedroom-scan-back-to-model');
    await page.close();
  },

  async diner() {
    for (const dark of [false, true]) {
      const page = await open(`/memories/${IDS.diner}`, { ...DESKTOP, dark });
      if (!(await waitState(page))) continue;
      await sleep(2600);
      await shot(page, `diner-desktop-${dark ? 'dark' : 'light'}`);
      if (!dark) {
        await page.click('[data-mr="viewpoint"][data-photo="1"]');
        await sleep(1600);
        await page.evaluate(() => window.__mrViewer.setBlend(0));
        await sleep(200);
        await shot(page, 'diner-vp1-blend0');
      }
      await page.close();
    }
  },

  async preview() {
    for (const dark of [false, true]) {
      const page = await open(`/memories/${IDS.kitchen}`, { ...DESKTOP, dark });
      if (!(await waitState(page))) continue;
      const mode = await page.$eval('[data-mr="viewer"]', (el) => el.dataset.mode);
      if (mode !== 'preview') problems.push(`kitchen data-mode = ${mode}, expected preview`);
      await sleep(2600);
      await shot(page, `kitchen-preview-desktop-${dark ? 'dark' : 'light'}`);
      await page.close();
    }
  },

  async photos() {
    let page = await open(`/memories/${IDS.banff}`);
    await page.waitForSelector('[data-mr="photo-strip"]', { timeout: 20000 });
    await sleep(800);
    if (await page.$('[data-mr="viewer"]')) problems.push('banff (no scene) should not mount a viewer');
    await shot(page, 'banff-photos-desktop');
    await page.close();
    page = await open(`/memories/${IDS.hostel}`, PHONE);
    await page.waitForSelector('[data-mr="photo-strip"]', { timeout: 20000 });
    await sleep(800);
    await shot(page, 'hostel-photos-phone');
    await page.screenshot({ path: path.join(OUT, 'hostel-photos-phone-full.png'), fullPage: true });
    const strip = await page.$eval('[data-mr="photo-strip"]', (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: window.innerWidth - r.right };
    });
    if (strip.left < 8 || strip.right < 8) problems.push(`hostel phone: photo strip touches the screen edge (${JSON.stringify(strip)})`);
    await page.close();
  },

  async lightbox() {
    const page = await open(`/memories/${IDS.bedroom}`, PHONE);
    await waitState(page);
    await page.click('[data-mr="photo-strip"] button:nth-child(2)');
    await page.waitForSelector('.mr-lightbox', { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await sleep(500);
    const counter = await page.$eval('.mr-lightbox .mr-label', (el) => el.textContent);
    if (!counter.startsWith('3')) problems.push(`lightbox arrow right: counter ${counter}`);
    await shot(page, 'lightbox-phone');
    await page.keyboard.press('Escape');
    await sleep(200);
    if (await page.$('.mr-lightbox')) problems.push('lightbox did not close on Escape');
    await page.close();
  },

  async group() {
    for (const [size, tag] of [[DESKTOP, 'desktop'], [PHONE, 'phone']]) {
      const page = await open('/memories/group/example-flat', size);
      if (!(await waitState(page))) continue;
      await sleep(2600);
      const rooms = await page.$$eval('[data-mr="group-room"]', (els) => els.map((e) => e.dataset.id));
      notes.push(`group rooms (${tag}): ${rooms.join(', ')}`);
      if (rooms.length < 2) problems.push(`group page lists ${rooms.length} rooms`);
      await shot(page, `group-${tag}`);
      if (!(await page.$('.mr-spot__stage [data-mr="home-view"]'))) problems.push(`group (${tag}): home-view not on the stage`);
      if (tag === 'desktop') {
        await page.click(`[data-mr="group-room"][data-id="${IDS.kitchen}"] .mr-rooms__focus`);
        await sleep(1100);
        await shot(page, 'group-desktop-focus-kitchen');
        const r = await orbit(page, 140, 0);
        notes.push(`group orbit az+140: ${JSON.stringify(r)}`);
        await shot(page, 'group-desktop-from-north');
      }
      await page.close();
    }
  },

  async missing() {
    const page = await open('/memories/00000000-0000-4000-8000-000000000000', { ...DESKTOP, allow404: true });
    await page.waitForSelector('[data-mr-page="missing"]', { timeout: 15000 }).catch(() => problems.push('404 page not shown'));
    await shot(page, 'missing-desktop');
    await page.close();
  },

  async phone() {
    for (const dark of [false, true]) {
      const page = await open(`/memories/${IDS.bedroom}`, { ...PHONE, dark });
      if (!(await waitState(page))) continue;
      await sleep(2600);
      await shot(page, `bedroom-phone-${dark ? 'dark' : 'light'}`);
      if (!dark) {
        await page.click('[data-mr="viewpoint"][data-photo="1"]');
        await sleep(1600);
        await page.evaluate(() => window.__mrViewer.setBlend(0.5));
        await sleep(200);
        await shot(page, 'bedroom-phone-vp1-blend50');
        const geo = await page.evaluate(() => {
          const s = document.querySelector('.mr-spot__stage [data-mr="blend-slider"]')?.getBoundingClientRect();
          const p = document.querySelector('.mr-viewer__photo')?.getBoundingClientRect();
          return s && p ? { sliderTop: s.top, sliderBottom: s.bottom, photoBottom: p.bottom, vh: window.innerHeight } : null;
        });
        notes.push(`phone viewpoint geometry ${JSON.stringify(geo)}`);
        if (!geo) problems.push('phone: blend slider not inside the stage');
        else {
          if (geo.sliderBottom > geo.vh) problems.push('phone: blend slider is below the fold');
          if (geo.sliderTop - geo.photoBottom > 60) problems.push(`phone: slider ${Math.round(geo.sliderTop - geo.photoBottom)} px below the photo`);
        }
        await page.screenshot({ path: path.join(OUT, 'bedroom-phone-vp1-full.png'), fullPage: true });
      }
      await page.close();
    }
    const page = await open(`/memories/${IDS.diner}`, { ...PHONE, dark: true });
    if (await waitState(page)) {
      await sleep(2600);
      await shot(page, 'diner-phone-dark');
    }
    await page.close();
  },

  async dark() {
    const page = await open(`/memories/${IDS.bedroom}`, { ...DESKTOP, dark: true });
    if (!(await waitState(page))) return;
    await sleep(2600);
    await shot(page, 'bedroom-desktop-dark');
    await page.close();
  },

  async poster() {
    const page = await browser.newPage();
    await page.setViewport({ width: DESKTOP.w, height: DESKTOP.h });
    await page.evaluateOnNewDocument(() => localStorage.setItem('mr:token', 'trip-local'));
    page.on('pageerror', (e) => problems.push(`pageerror [poster] ${e.message}`));
    await page.goto(`${BASE}${href(`/memories/${IDS.diner}`)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 45000 });
    // second visit with a slow line: the hero render shows while the GLB loads
    await page.emulateNetworkConditions({ download: 400 * 1024, upload: 400 * 1024, latency: 80 });
    await navigate(page, `/memories/${IDS.kitchen}`);
    await waitState(page);
    await page.setCacheEnabled(false);
    await navigate(page, `/memories/${IDS.diner}`);
    await page.waitForSelector('[data-mr="viewer"][data-state="loading"]', { timeout: 10000 });
    await sleep(2500);
    await shot(page, 'diner-loading-poster');
    const posters = await page.$$eval('.mr-viewer__poster.is-loaded:not(.is-hidden):not(.is-covered)', (els) => els.length);
    if (!posters) problems.push('loading: no poster showing while the GLB loads');
    await page.emulateNetworkConditions(null);
    await waitState(page, 'ready', 60000);
    await page.close();
  },

  async motion() {
    const page = await open(`/memories/${IDS.bedroom}`);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (!(await waitState(page))) return;
    await sleep(150);
    const reveal = await page.evaluate(() => window.__mrViewer.tweens.size);
    if (reveal) problems.push(`reduced motion: ${reveal} tween(s) still running after load`);
    await page.click('[data-mr="viewpoint"][data-photo="1"]');
    await sleep(120);
    const vp = await page.evaluate(() => window.__mrViewer.getViewpoint());
    if (vp.flying || vp.photo !== 1) problems.push(`reduced motion: viewpoint did not jump (${JSON.stringify(vp)})`);
    await page.close();
  },

  async error() {
    const page = await open(`/memories/${IDS.bedroom}`, { ...DESKTOP, allow404: true });
    if (!(await waitState(page))) return;
    await page.evaluate(() => {
      const v = window.__mrViewer;
      v.load({ ...v.spec, glbUrl: '/api/memories/file/spots/nope/model/room.glb' });
    });
    await waitState(page, 'error', 15000);
    if (!(await page.$('.mr-viewer__error button'))) problems.push('error state has no retry button');
    await shot(page, 'viewer-error-desktop');
    await page.close();
  },

  async theme() {
    const page = await open(`/memories/${IDS.diner}`);
    if (!(await waitState(page))) return;
    const before = await page.evaluate(() => window.__mrViewer.disc.material.color.getHexString());
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await sleep(400);
    const after = await page.evaluate(() => window.__mrViewer.disc.material.color.getHexString());
    notes.push(`theme switch: disc #${before} → #${after}`);
    if (before === after) problems.push('disc colour did not follow a live theme switch');
    await page.close();
  },

  async dispose() {
    const page = await open(`/memories/${IDS.bedroom}`);
    if (!(await waitState(page))) return;
    const viewer0 = await page.evaluateHandle(() => window.__mrViewer);
    const seq = [IDS.diner, IDS.kitchen, IDS.bedroom];
    const rows = [];
    rows.push({ step: 0, spot: 'bedroom', ...(await memory(page)) });
    for (let i = 1; i <= 12; i++) {
      const id = seq[(i - 1) % seq.length];
      await navigate(page, `/memories/${id}`);
      await sleep(150);
      await waitState(page);
      await sleep(300);
      rows.push({ step: i, spot: Object.keys(IDS).find((k) => IDS[k] === id), ...(await memory(page)) });
    }
    const same = await page.evaluate((v) => v === window.__mrViewer, viewer0);
    notes.push(`dispose: same viewer instance across navigation = ${same}`);
    for (const r of rows) notes.push(`dispose step ${String(r.step).padStart(2)} ${r.spot.padEnd(8)} geometries ${r.geometries} textures ${r.textures}`);
    const bySpot = {};
    for (const r of rows) (bySpot[r.spot] ??= []).push(r);
    for (const [spot, list] of Object.entries(bySpot)) {
      const g = new Set(list.map((r) => r.geometries));
      const t = new Set(list.map((r) => r.textures));
      if (g.size > 1 || t.size > 1) problems.push(`dispose: ${spot} memory varies across visits: geometries ${[...g]} textures ${[...t]}`);
    }
    // the page swap (spot → group → spot) must free the old context too
    await navigate(page, '/memories/group/example-flat');
    await waitState(page);
    await navigate(page, `/memories/${IDS.bedroom}`);
    await waitState(page);
    notes.push(`dispose: after group round trip ${JSON.stringify(await memory(page))}`);
    await page.close();
  },
};

const run = wanted.length ? wanted : Object.keys(SCENARIOS);
for (const name of run) {
  if (!SCENARIOS[name]) {
    console.error(`unknown scenario ${name}`);
    continue;
  }
  console.log(`· ${name}`);
  try {
    await SCENARIOS[name]();
  } catch (err) {
    problems.push(`${name}: ${err.message}`);
  }
}
await browser.close();

for (const n of notes) console.log(`  note ${n}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nall checks passed');
