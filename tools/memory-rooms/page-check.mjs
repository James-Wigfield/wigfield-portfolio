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
     edit      /memories/:id/edit at 390 (touch) and 1440: title, day and place (drag, GPS far away, typed
               place) → Save → spot page, reload, the marker + 3D diorama at the new place; 0 Mapbox loads
               until "Change location", then 1; offline; ?map=atlas; two phones (409); leaving asks
               (page-check-edit.mjs; it puts every spot it edits back)
     console   zero console errors and zero page errors on every screen
     extras    then ar-check, fly-check, walk-check, walk-mp-check, viewer-upgrades-check (theme, spin,
               furnished) and place-walk-check (a whole place, two players, stairs) as their own processes (logs
               in _page-check/<name>-<scheme>.log; exit 2 = nothing to check here, counted as skipped);
               --no-extras skips them, --python goes to ar-check
   Screenshots → memory-rooms-work/_page-check/. Exit 1 if anything fails.
   Needs at least one rendered spot with a model (seed-dev.mjs --examples-only gives two). */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { client, config, WORK } from './lib/api.mjs';
import { editWalk } from './page-check-edit.mjs';

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
  page.heroRequests = 0; // the 1600 px hero render: the map should only ever fetch markers
  page.on('request', (r) => /\/renders\/hero\.png/.test(r.url()) && (page.heroRequests += 1));
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

/* Rendered spots stand on the map as their marker image (render/marker; the hero shrunk in
   the browser when a spot has none yet). A dot: data-marker = 'marker' | 'hero' once shown,
   data-w = its width. A cluster holding rendered spots: data-fan = how many it fans out. */
const named = (s, name) => s.media.some((m) => m.type === 'render' && m.name === name);
const RENDERED = spots.filter((s) => s.status === 'rendered' && Number.isFinite(s.lat) && (named(s, 'marker') || named(s, 'hero')));
const withMarker = new Set(RENDERED.filter((s) => named(s, 'marker')).map((s) => s.id));
/** The rendered spot furthest from any other spot: it stands alone at city zoom. */
const SOLO = RENDERED.map((s) => ({ s, d: Math.min(...spots.filter((o) => o !== s && Number.isFinite(o.lat)).map((o) => Math.hypot(o.lat - s.lat, o.lng - s.lng))) }))
  .sort((a, b) => b.d - a.d)[0]?.s;
const markerState = (page) =>
  page.$$eval(`${sel('spot-dot')}, ${sel('cluster')}`, (els) =>
    els.map((e) => ({ id: e.dataset.id || null, ids: (e.dataset.ids || '').split(',').filter(Boolean), status: e.dataset.status || null, marker: e.dataset.marker || null, w: Number(e.dataset.w || 0), fan: Number(e.dataset.fan || 0) })),
  );
/** Every rendered spot on screen shows its marker (alone) or is fanned by its cluster; true, or false after 10 s. */
const markersShown = (page, ids) =>
  page
    .waitForFunction(
      (ids) => {
        const dots = [...document.querySelectorAll('[data-mr="spot-dot"]')];
        const clusters = [...document.querySelectorAll('[data-mr="cluster"]')];
        return ids.every((id) => {
          const d = dots.find((e) => e.dataset.id === id);
          if (d) return Boolean(d.dataset.marker);
          const c = clusters.find((e) => (e.dataset.ids || '').split(',').includes(id));
          return c ? Number(c.dataset.fan || 0) > 0 : true; // off screen
        });
      },
      { timeout: 10000 },
      ids,
    )
    .then(() => true)
    .catch(() => false);
const cameraOf = (page) =>
  page.$eval(sel('map'), (el) => {
    const c = el.__mrMap.getCenter();
    return { center: [c.lng, c.lat], zoom: el.__mrMap.getZoom() };
  });
const jump = (page, camera) =>
  page.evaluate(
    (camera) =>
      new Promise((done) => {
        const map = document.querySelector('[data-mr="map"]').__mrMap;
        map.jumpTo(camera);
        map.once('idle', () => done());
        map.triggerRepaint();
        setTimeout(done, 15000);
      }),
    camera,
  );
/* Past zoom 15 rendered spots stand as live 3D models (src/memory-rooms/map/mapbox/models3d.js):
   window.__mrModels() → { live, loading, loaded, disposed, textures, geometries, … }. */
const MODEL_CAP = { 1440: 6, 390: 3 };
const modelStats = (page) => page.evaluate(() => window.__mrModels?.() || null);
const modelsSettled = (page, min = 1) =>
  page
    .waitForFunction((min) => {
      const s = window.__mrModels?.();
      return s && s.live >= min && s.loading === 0;
    }, { timeout: 45000 }, min)
    .then(() => true)
    .catch(() => false);
const pitchOf = (page) => page.$eval(sel('map'), (el) => Number(el.dataset.pitch || 0));
/** Mean grey-level change in a screen box when the 3D layer is switched off: > 0 means it draws there. */
async function layerDiff(page, b) {
  const clip = { x: Math.max(0, b.x0), y: Math.max(0, b.y0), width: Math.max(4, b.x1 - b.x0), height: Math.max(4, b.y1 - b.y0) };
  const grab = async () => sharp(await page.screenshot({ clip })).greyscale().raw().toBuffer();
  const toggle = (on) =>
    page.evaluate(
      (on) =>
        new Promise((done) => {
          const map = document.querySelector('[data-mr="map"]').__mrMap;
          map.setLayoutProperty('mr-models', 'visibility', on ? 'visible' : 'none');
          map.once('render', () => requestAnimationFrame(() => done()));
          map.triggerRepaint();
          setTimeout(done, 3000);
        }),
      on,
    );
  await page.$eval('.mr-mapoverlay', (el) => (el.style.visibility = 'hidden')).catch(() => {});
  const on = await grab();
  await toggle(false);
  const off = await grab();
  await toggle(true);
  await page.$eval('.mr-mapoverlay', (el) => (el.style.visibility = '')).catch(() => {});
  let sum = 0;
  for (let i = 0; i < on.length; i++) sum += Math.abs(on[i] - off[i]);
  return sum / on.length;
}
/** The screen box of a spot's model hit target (data-model), or null. */
const modelBox = (page, id) =>
  page.$eval(`${sel('spot-dot')}[data-id="${id}"][data-model] rect`, (el) => {
    const r = el.getBoundingClientRect();
    return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, model: el.parentElement.dataset.model };
  }).catch(() => null);
const WITH_MODEL = RENDERED.filter((s) => s.media.some((m) => m.type === 'model'));

const boxOf = (handle) => handle.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
});

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

  // rendered spots stand as their markers (from render/marker, never the 1600 px hero)
  const shown = await markersShown(page, RENDERED.map((s) => s.id));
  const opening = await markerState(page);
  const standing = opening.filter((d) => d.marker);
  const fans = opening.filter((d) => d.fan > 0);
  const fromHero = standing.filter((d) => withMarker.has(d.id) && d.marker !== 'marker');
  record(
    `map ${width}: rendered spots stand as markers (clusters fan them)`,
    shown && standing.length + fans.length > 0 && fromHero.length === 0 && page.heroRequests === 0,
    `${standing.length} marker(s) ${standing.map((d) => `${d.w}px`).join(' ')}, ${fans.length} fanned cluster(s), ${page.heroRequests} hero request(s)`,
  );
  await shot(page, `map-${width}`);

  // markers grow as you zoom in; a click on one opens its card, beside the marker
  if (SOLO) {
    const before = await cameraOf(page);
    const countryW = opening.find((d) => d.id === SOLO.id)?.w || Math.min(...standing.map((d) => d.w), Infinity);
    await jump(page, { center: [SOLO.lng, SOLO.lat], zoom: 12 });
    await markersShown(page, [SOLO.id]);
    const city = (await markerState(page)).find((d) => d.id === SOLO.id);
    record(`map ${width}: markers grow as you zoom in`, Boolean(city?.marker) && city.w > countryW + 20, `"${SOLO.title}" ${Number.isFinite(countryW) ? countryW : '?'} px → ${city?.w ?? 'none'} px at zoom 12`);
    const marker = await page.$(`${sel('spot-dot')}[data-id="${SOLO.id}"]`);
    if (marker) {
      await click(marker);
      const card = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).catch(() => null);
      const title = card ? await card.evaluate((el) => el.textContent) : '';
      let beside = true;
      if (card && width >= 600) {
        await wait(450);
        const a = await boxOf(card);
        const b = await boxOf(await page.$(`${sel('spot-dot')}[data-id="${SOLO.id}"] .mr-marker-img`));
        beside = a.x0 >= b.x1 - 1 || a.x1 <= b.x0 + 1;
      }
      record(`map ${width}: clicking a marker opens its card${width >= 600 ? ' beside it' : ''}`, Boolean(card) && title.includes(SOLO.title) && beside);
      await wait(450);
      await shot(page, `map-${width}-marker-card`);
      await page.keyboard.press('Escape');
    }
    await jump(page, before);
  }

  // past zoom 15 the spot's baked GLB stands on the map in 3D (one custom layer, no new map),
  // the map tilts, a click on the model opens its card, and zooming back out disposes it
  const LIVE = WITH_MODEL.find((s) => s.id === SOLO?.id) || WITH_MODEL[0];
  if (LIVE) {
    const before = await cameraOf(page);
    await jump(page, { center: [LIVE.lng, LIVE.lat], zoom: 15.8 });
    const settled = await modelsSettled(page);
    await page.waitForFunction(() => Number(document.querySelector('[data-mr="map"]').dataset.pitch) >= 45, { timeout: 8000 }).catch(() => {});
    await idle(page);
    const st = await modelStats(page);
    const box = await modelBox(page, LIVE.id);
    const diff = box ? await layerDiff(page, box) : 0;
    record(
      `map ${width}: past zoom 15 "${LIVE.title}" stands in 3D, within the cap`,
      settled && Boolean(box) && diff > 4 && st.live >= 1 && st.live <= MODEL_CAP[width] && !st.broken,
      `${st?.live} live (cap ${MODEL_CAP[width]}), from model/${box?.model}, layer changes ${diff.toFixed(1)} grey levels, pitch ${await pitchOf(page)}°, ${st?.textures} textures / ${st?.geometries} geometries`,
    );
    await shot(page, `map-${width}-3d`);
    if (box) {
      // a real click (a tap on a phone) on the model: the map's own click finds it under the pointer
      const cx = (box.x0 + box.x1) / 2;
      const cy = (box.y0 + box.y1) / 2;
      if (width < 600) await page.touchscreen.tap(cx, cy);
      else await page.mouse.click(cx, cy);
      const card = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).catch(() => null);
      const title = card ? await card.evaluate((el) => el.textContent) : '';
      record(`map ${width}: ${width < 600 ? 'tapping' : 'clicking'} a 3D model opens its card`, Boolean(card) && title.includes(LIVE.title));
      await wait(450);
      await shot(page, `map-${width}-3d-card`);
      await page.keyboard.press('Escape');
      await wait(300);
      // a drag that starts on the model pans the map (models let the pointer through)
      const c0 = await cameraOf(page);
      if (width < 600) {
        await page.touchscreen.touchStart(cx, cy);
        for (let k = 1; k <= 12; k++) await page.touchscreen.touchMove(cx - k * 12, cy);
        await page.touchscreen.touchEnd();
      } else {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let k = 1; k <= 12; k++) await page.mouse.move(cx - k * 12, cy);
        await page.mouse.up();
      }
      await wait(500);
      const c1 = await cameraOf(page);
      const moved = Math.hypot(c1.center[0] - c0.center[0], c1.center[1] - c0.center[1]);
      record(`map ${width}: a drag that starts on a 3D model pans the map`, moved > 1e-4 && !(await page.$(sel('spot-card'))), `centre moved ${(moved * 111000).toFixed(0)} m`);
    }
    await jump(page, { center: [LIVE.lng, LIVE.lat], zoom: 12 });
    const gone = await page
      .waitForFunction(() => {
        const s = window.__mrModels?.();
        return s && s.live === 0 && s.loading === 0 && s.geometries === 0;
      }, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForFunction(() => Number(document.querySelector('[data-mr="map"]').dataset.pitch) === 0, { timeout: 8000 }).catch(() => {});
    const after = await modelStats(page);
    const marker = (await markerState(page)).find((d) => d.id === LIVE.id);
    record(
      `map ${width}: zooming back out disposes the models, flattens the map, the marker returns`,
      gone && (await pitchOf(page)) === 0 && after.disposed >= after.loaded && after.textures <= 1 && Boolean(marker?.marker),
      `${after?.loaded} loaded / ${after?.disposed} disposed, ${after?.textures} textures / ${after?.geometries} geometries left, pitch ${await pitchOf(page)}°`,
    );
    await jump(page, before);
  }

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
  const shown = await markersShown(page, RENDERED.map((s) => s.id));
  const st = await markerState(page);
  record(
    'fallback: the atlas shows the same markers',
    shown && st.some((d) => d.marker === 'marker' || d.fan > 0) && page.heroRequests === 0,
    `${st.filter((d) => d.marker).length} marker(s), ${st.filter((d) => d.fan).length} fanned cluster(s), ${page.heroRequests} hero request(s)`,
  );
  await shot(page, 'map-1440-atlas');
  record('fallback: the atlas makes no Mapbox load', (await loads(page)) === 0);
  noErrors(page, 'fallback atlas');
  await page.close();
}
{
  // A spot pushed before markers existed has only its hero: the map shrinks that in the browser.
  // (The atlas, so this costs no Mapbox load: the marker images are the same on both engines.)
  const page = await open(1440);
  await page.setRequestInterception(true);
  const stripped = (await api.listSpots()).map((s) => ({ ...s, media: s.media.filter((m) => !(m.type === 'render' && m.name === 'marker')) }));
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/memories/spots' && r.method() === 'GET') {
      r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: stripped }) });
    } else r.continue();
  });
  await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
  await atlasDrawn(page);
  const shown = await markersShown(page, RENDERED.map((s) => s.id));
  const st = await markerState(page);
  const heroMarkers = st.filter((d) => d.marker === 'hero');
  record('fallback: a spot without a marker shows its hero, shrunk in the browser', shown && heroMarkers.length > 0 && st.every((d) => !d.marker || d.marker === 'hero'), `${heroMarkers.length} from the hero, ${page.heroRequests} hero download(s)`);
  await shot(page, 'map-1440-atlas-hero-fallback');
  noErrors(page, 'fallback hero markers');
  await page.close();
}

// ── 3D: many rendered spots close together (copies injected into the spot list, nothing written) ──
// The cap holds (6 wide, 3 on a phone), nearest the centre first; a spot without model/map loads
// room.glb (textures shrunk in the browser); panning away and back leaves the GPU counts as they were.
const near3d = WITH_MODEL.find((s) => s.media.some((m) => m.type === 'model' && m.name === 'map'));
for (const width of near3d ? [1440, 390] : []) {
  const page = await open(width);
  const real = await api.listSpots();
  const fakes = [];
  for (let i = 0; i < 12; i++) {
    const src = WITH_MODEL[i % WITH_MODEL.length];
    const a = i * 2.39996; // golden angle: an even scatter
    const r = 0.0009 + 0.00035 * i; // degrees of latitude (≈ 100–550 m)
    fakes.push({
      ...src,
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      title: `${src.title} (copy ${i + 1})`,
      lat: near3d.lat + r * Math.sin(a),
      lng: near3d.lng + (r * Math.cos(a)) / Math.cos((near3d.lat * Math.PI) / 180),
      // copy 1 has only room.glb: the browser shrinks its textures
      media: i === 0 ? src.media.filter((m) => !(m.type === 'model' && m.name === 'map')) : src.media,
    });
  }
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/memories/spots' && r.method() === 'GET') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [...real, ...fakes] }) });
    else r.continue();
  });
  await page.goto(`${base}${q('/memories')}`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(MAPBOX_READY, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!ready) {
    record(`3d ${width}: the map loads with ${fakes.length} extra spots`, false);
    await page.close();
    continue;
  }
  const home = { center: [near3d.lng, near3d.lat], zoom: 15.4 };
  await jump(page, home);
  await modelsSettled(page);
  await page.waitForFunction(() => Number(document.querySelector('[data-mr="map"]').dataset.pitch) >= 45, { timeout: 8000 }).catch(() => {});
  await idle(page);
  await modelsSettled(page);
  const s0 = await modelStats(page);
  const dots = await page.$$eval(`${sel('spot-dot')}`, (els) => els.map((e) => ({ id: e.dataset.id, model: e.dataset.model || null, marker: e.dataset.marker || null })));
  const standing = dots.filter((d) => d.model);
  const room = dots.find((d) => d.id === fakes[0].id);
  record(
    `3d ${width}: ${dots.length} rendered spots on screen, ${MODEL_CAP[width]} at most live, the rest stay markers`,
    s0.live === Math.min(MODEL_CAP[width], dots.length) && standing.length === s0.live,
    `${s0.live} live, ${dots.filter((d) => d.marker).length} markers, ${dots.length - s0.live - dots.filter((d) => d.marker).length} dots (a model stands in front), ${s0.textures} textures / ${s0.geometries} geometries`,
  );
  if (room?.model) record(`3d ${width}: a spot without model/map loads room.glb instead`, room.model === 'room');
  await shot(page, `map-${width}-3d-many`);

  // pan away and back, five times: everything that leaves is disposed, the counts come back
  const path3d = [
    { center: [near3d.lng + 0.012, near3d.lat], zoom: 15.4 },
    { center: [near3d.lng - 0.004, near3d.lat + 0.004], zoom: 15.8 },
    { center: [near3d.lng + 0.004, near3d.lat - 0.004], zoom: 15.2 },
    { center: [near3d.lng, near3d.lat + 0.02], zoom: 15.4 },
    home,
  ];
  const seen = [];
  for (const cam of path3d) {
    await jump(page, cam);
    await modelsSettled(page, 0);
    await idle(page);
    const s = await modelStats(page);
    seen.push(`${s.live}:${s.textures}/${s.geometries}`);
  }
  await modelsSettled(page);
  const s1 = await modelStats(page);
  record(
    `3d ${width}: panning away and back leaves the GPU counts where they were`,
    s1.textures === s0.textures && s1.geometries === s0.geometries && s1.live === s0.live && s1.disposed > 0,
    `live:textures/geometries ${seen.join(' → ')}; ${s1.loaded} loaded, ${s1.disposed} disposed`,
  );
  record(`3d ${width}: still one map load`, (await loads(page)) === 1, `${await loads(page)} load(s)`);
  noErrors(page, `3d ${width}`);
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

// ── edit (/memories/:id/edit) ────────────────────────────────────────────────
await editWalk({ browser, base, api, open, record, shot, sel, wait, noErrors, idle, loads, atlasDrawn, jump, modelsSettled, OUT, scheme });

await browser.close();

// ── the night's features, each its own focused check (run here so page-check covers every section) ──
// ar-check (AR), fly-check (the flyover), walk-check + walk-mp-check (walking in, alone and together).
// --no-extras skips them; --python <usd-core 25.8 python> is passed to ar-check for usdchecker.
if (!args.includes('--no-extras')) {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const extra = [
    ['ar-check.mjs', args.includes('--python') ? ['--python', opt('--python')] : []],
    ['fly-check.mjs', []],
    ['walk-check.mjs', []],
    ['walk-mp-check.mjs', []],
    ['viewer-upgrades-check.mjs', []],
    ['place-walk-check.mjs', []],
  ];
  for (const [file, more] of extra) {
    const script = path.join(here, file);
    if (!fs.existsSync(script)) {
      record(`${file}: present`, false, 'missing');
      continue;
    }
    const run = spawnSync(process.execPath, [script, '--base', base, ...(scheme === 'dark' ? ['--dark'] : []), ...more], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, MEMORIES_API: base } });
    const out = `${run.stdout || ''}${run.stderr || ''}`;
    const pass = (out.match(/^✓/gm) || []).length;
    const fails = out.split(/\r?\n/).filter((l) => l.startsWith('✗'));
    fs.writeFileSync(path.join(OUT, `${file.replace(/\.mjs$/, '')}-${scheme}.log`), out);
    if (run.status === 2 && !pass && !fails.length) {
      record(`${file}: skipped (nothing to check here)`, true, out.trim().split(String.fromCharCode(10)).pop());
      continue;
    }
    record(`${file}: ${pass} passed, ${fails.length} failed`, run.status === 0 && fails.length === 0, fails.slice(0, 3).join(' | ') || (run.status ? `exit ${run.status}` : ''));
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}${mapstyle ? `, ${mapstyle}` : ''}). Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
