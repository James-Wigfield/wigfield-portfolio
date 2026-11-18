#!/usr/bin/env node
/* fly-check: "Play the trip", the /memories flyover (src/memory-rooms/map/flyover/), in headless
   Edge on the real GPU (ANGLE d3d11: Mapbox needs WebGL 2), at 1440 and 390 px (390 = touch,
   mobile viewport, CPU throttled while it measures).

     npm run build && npx wrangler dev --port 8788       (restart wrangler after every build)
     MEMORIES_API=http://127.0.0.1:8788 node tools/memory-rooms/seed-dev.mjs --examples-only
     node tools/memory-rooms/fly-check.mjs [--base http://127.0.0.1:8788] [--dark]
                                           [--only globe-1440,globe-390,reduced,atlas,static]
                                           [--throttle 4] [--no-seed]

   On a local Worker it first adds five test spots (ids from their titles, so re-runs reuse them;
   never against a non-local base): Perth (captured, with a photo), Brooklyn, Calgary, Venice
   (captured, with photos) and one with no location, around the two rendered examples, so the
   route has long hops (WA → the USA) and short ones, both people, and a spot it must skip.

   Mapbox loads: 3 per run (the globe at 1440, the globe at 390 via ?play=1, reduced motion at
   1440). The atlas pages (?map=atlas) make none. Every page asserts window.__mrMapLoads.

   Checks
     globe 1440  Play button → every stop in capturedAt order (data-index / data-stop / data-at on
                 [data-mr="flyover"]), captions (title, note, date · who, the first photo on
                 captured-only stops), ~4 s linger, rendered stops dive past zoom 15 at ~55° and
                 orbit with the 3D diorama live within the cap, disposed by the next town-level stop,
                 long hops pull out to the globe, the route grows as it flies, it ends on the whole
                 route; fps during flights; pause holds the camera (flight and linger), Space / ← → /
                 Escape, prev / next (+ their limits), 1× / 2× (the linger halves), exit (button and
                 Escape) puts center / zoom / pitch / bearing / padding / tilt limit back and removes
                 the route source + layer, models disposed, an open card comes back; bar and caption
                 clear of the Mapbox logo + attribution; the filters change the stops (none left →
                 Play disabled); the route colour is the --mr-map-route token; the caption opens the
                 spot page; the Play button leaves the "n elsewhere" note clickable (all pages)
     globe 390   /memories?play=1 autoplays; the map takes the screen, the bar sits in the bottom
                 quarter with ≥ 44 px targets, clear of the Mapbox logo + attribution; the same run
                 checks with touch + CPU ÷throttle and fps; exit drops ?play=1 and returns the
                 opening view; a drag pauses and play carries on; the Play button (≥ 44 px) and
                 exit restore; a tap on the caption
     reduced     prefers-reduced-motion: cuts behind a fade, no orbit, no flights
     atlas       ?map=atlas at 1440 and 390: the simpler version completes in order with 0 map loads,
                 Perth captioned "Off this map", route path, end caption, exit restores the view
     static      flyover.css has no colour literals (tokens only) and no left-rule callouts
     console     zero console errors and page errors on every page
   Screenshots → memory-rooms-work/_page-check/fly-*-<scheme>.png. Exit 1 if anything fails. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { client, config, REPO, WORK } from './lib/api.mjs';
import { COPY } from '../../src/memory-rooms/copy.js';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const only = new Set(opt('--only', 'static,atlas,globe-1440,globe-390,reduced').split(','));
const THROTTLE = Number(opt('--throttle', '4'));
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};
const info = (line) => console.log(`  · ${line}`);
let mapLoads = 0;
const fpsLines = [];

/* ── test spots (local Worker only) ──────────────────────────────────────── */

const uuidFor = (s) => {
  const h = crypto.createHash('sha1').update(`memory-rooms-fly-check:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const FLY_SPOTS = [
  { title: 'Perth study (fly-check)', by: 'james', lat: -31.9523, lng: 115.8613, place: 'Perth, WA', note: 'Packing list on the wall, flights booked.', at: '2026-11-08T09:00:00.000Z', hue: 200 },
  { title: 'Brooklyn Bridge walk (fly-check)', by: 'justin', lat: 40.7061, lng: -73.9969, place: 'New York, NY', note: 'Walked it at dawn, nobody else on it.', at: '2026-12-18T15:00:00.000Z', hue: 20 },
  { title: 'Calgary bar (fly-check)', by: 'justin', lat: 51.0447, lng: -114.0719, place: 'Calgary, AB', note: 'The bartender taught us a card trick.', at: '2026-12-20T20:00:00.000Z', hue: 280 },
  { title: 'Venice boardwalk (fly-check)', by: 'james', lat: 33.985, lng: -118.4695, place: 'Los Angeles, CA', note: 'Rollerbladers and a man with a parrot.', at: '2027-01-02T18:00:00.000Z', hue: 120 },
  { title: 'No location (fly-check)', by: 'james', lat: null, lng: null, place: null, note: 'Saved without a fix, so never on the route.', at: '2026-12-25T12:00:00.000Z', hue: 0 },
];

async function photo(label, hue, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue},35%,52%)"/>
    <text x="${w * 0.06}" y="${h * 0.9}" font-family="Segoe UI, Arial" font-size="${Math.round(w / 14)}" fill="#fff">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

let seeded = false; // the test spots are soft-deleted again at the end, so other checks see the plain examples
async function seedFlySpots() {
  if (!LOCAL || args.includes('--no-seed')) return;
  seeded = true;
  const have = new Map((await api.listSpots({ deleted: true })).map((s) => [s.id, s]));
  for (const s of FLY_SPOTS) {
    const id = uuidFor(s.title);
    const fields = {
      createdBy: s.by, kind: 'exterior', title: s.title, note: s.note, lat: s.lat, lng: s.lng,
      locAccuracyM: s.lat == null ? null : 25, locSource: s.lat == null ? null : 'gps', placeLabel: s.place, scaleHint: 'big building', capturedAt: s.at,
    };
    if (have.get(id)?.deletedAt) await api.restoreSpot(id); // left from the last run
    if (have.has(id)) await api.patchSpot(id, fields); // puts the values back if anything edited them
    else await api.saveSpot({ id, ...fields });
    if (!(have.get(id)?.media || []).some((m) => m.type === 'thumb')) {
      const big = await photo(s.title.replace(' (fly-check)', ''), s.hue, 1536, 2048);
      await api.putMedia(id, 'photo', 1, big, { contentType: 'image/jpeg', width: 1536, height: 2048 });
      const small = await sharp(big).resize({ width: 360, height: 480, fit: 'inside' }).jpeg({ quality: 78 }).toBuffer();
      await api.putMedia(id, 'thumb', 1, small, { contentType: 'image/jpeg', width: 360, height: 480 });
    }
  }
}
await seedFlySpots();

/* ── what the flyover should do with the spots on the Worker ─────────────── */

const SPOTS = await api.listSpots();
const byId = new Map(SPOTS.map((s) => [s.id, s]));
const located = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng);
const when = (s) => String(s.capturedAt || s.createdAt || '');
/** The flyover's stops: spots with a location, oldest capture first (ties: created, then id). */
const stopsOf = (list) =>
  list.filter(located).sort((a, b) => when(a).localeCompare(when(b)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
/**
 * The stops the end view must show (DECISIONS 84): all of them when they fit one view (the short way
 * round in longitude, ≤ 150°), else the main region, the largest group split at 60° gaps: no view of
 * a globe can hold nearly antipodal stops (Perth and New York), so those run over the horizon.
 */
function endStops(list) {
  const lngs = list.map((s) => s.lng).sort((a, b) => a - b);
  let gap = -1;
  for (let i = 0; i < lngs.length; i++) gap = Math.max(gap, (i + 1 < lngs.length ? lngs[i + 1] : lngs[0] + 360) - lngs[i]);
  if (360 - gap <= 150) return list;
  const sorted = [...list].sort((a, b) => a.lng - b.lng);
  const groups = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].lng - sorted[i - 1].lng > 60) groups.push([]);
    groups[groups.length - 1].push(sorted[i]);
  }
  if (groups.length > 1 && sorted[0].lng + 360 - sorted[sorted.length - 1].lng <= 60) groups[0].push(...groups.pop());
  return groups.reduce((m, g) => (g.length > m.length ? g : m));
}
const isRendered = (s) => s.status === 'rendered' && s.media.some((m) => m.type === 'model' && m.name !== 'map');
const hasThumb = (s) => s.media.some((m) => m.type === 'thumb');
const ON_MAP = { west: -141, east: -52, south: 18, north: 60.5 }; // src/memory-rooms/map/geo.js
const onAtlas = (s) => located(s) && s.lat >= ON_MAP.south && s.lat <= ON_MAP.north && s.lng >= ON_MAP.west && s.lng <= ON_MAP.east;
const titleOf = (id) => byId.get(id)?.title || id;
const RAD = Math.PI / 180;
const km = (a, b) => {
  const h = Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lng - a.lng) * RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const STOPS = stopsOf(SPOTS);
const RENDERED = STOPS.filter(isRendered);
if (STOPS.length < 3 || !RENDERED.length) {
  console.error(`Need at least 3 located spots incl. a rendered one with a model (have ${STOPS.length}, ${RENDERED.length} rendered): run seed-dev.mjs --examples-only against ${base} first.`);
  process.exit(1);
}
const LONG_HOP_KM = 1500;
console.log(`fly-check ${scheme} @ ${base}: ${STOPS.length} stops: ${STOPS.map((s, i) => `${s.title}${isRendered(s) ? ' [3D]' : ''}${i ? ` (${Math.round(km(STOPS[i - 1], s))} km)` : ''}`).join(' → ')}\n`);
/** Rough wall time of a whole run at 1× (ms): flights + lingers + the end flight. */
const RUN_MS = STOPS.reduce((a, s, i) => a + (i === 0 || km(STOPS[i - 1], s) > LONG_HOP_KM ? 6500 : 3200) + 4000, 3200);

/* ── the browser ─────────────────────────────────────────────────────────── */

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: GPU });
const sel = (name) => `[data-mr="${name}"]`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MAPBOX_READY = `${sel('map')}[data-engine="mapbox"][data-ready]`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });

/* In the page from the first script on: rAF frame times tagged with the flyover's phase, and one
   segment per (index, phase, playing, speed) with the camera, the 3D layer and the route sampled
   through it. window.__fc.on starts true so /memories?play=1 is recorded from its first frame. */
function RECORDER() {
  const fc = (window.__fc = { on: true, frames: [], segs: [], key: '', cur: null });
  const q = (s) => document.querySelector(s);
  const mapOf = () => q('[data-mr="map"]')?.__mrMap || null;
  window.__fcState = () => {
    const el = q('[data-mr="flyover"]');
    if (!el) return null;
    const d = el.dataset;
    return {
      index: Number(d.index), count: Number(d.count), phase: d.phase, playing: el.hasAttribute('data-playing'), speed: Number(d.speed),
      stop: d.stop, at: d.at, rendered: el.hasAttribute('data-rendered'), reduced: el.hasAttribute('data-reduced'), fade: Boolean(el.querySelector('.mr-fly__fade[data-on]')),
    };
  };
  window.__fcCam = () => {
    const map = mapOf();
    if (!map) return null;
    const c = map.getCenter();
    return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
  };
  window.__fcRoute = () => {
    const map = mapOf();
    if (!map) {
      const p = q('[data-mr="fly-route"]');
      return p ? { svg: true, coords: (p.getAttribute('d') || '').split(/[ML]/).length - 1 } : null;
    }
    let src = null;
    let layer = null;
    try {
      src = map.getSource('mr-route');
      layer = map.getLayer('mr-route-line');
    } catch {
      return null;
    }
    if (!src && !layer) return null;
    const f = src?._data?.features || [];
    return { source: Boolean(src), layer: Boolean(layer), features: f.length, coords: f.reduce((a, x) => a + x.geometry.coordinates.length, 0), color: layer ? map.getPaintProperty('mr-route-line', 'line-color') : null };
  };
  window.__fcCaption = () => {
    const cap = q('[data-mr="fly-caption"]');
    if (!cap) return null;
    const img = cap.querySelector('img');
    const txt = (s) => cap.querySelector(s)?.textContent || '';
    return { href: cap.getAttribute('href'), meta: txt('.mr-fly__meta'), title: txt('.mr-fly__title'), note: txt('.mr-fly__note'), thumb: img ? { loaded: img.complete && img.naturalWidth > 0, w: img.naturalWidth } : null };
  };
  let last = 0;
  let n = 0;
  let hooked = null;
  const tick = (t) => {
    const s = window.__fcState();
    const map = mapOf();
    if (map && hooked !== map) {
      hooked = map;
      map.on('move', () => {
        if (fc.cur) fc.cur.moves += 1;
      });
    }
    if (fc.on && last) fc.frames.push([t - last, s ? s.phase : '', s && s.playing ? 1 : 0]);
    last = t;
    const key = s ? `${s.index}|${s.phase}|${s.playing ? 1 : 0}|${s.speed}` : '';
    if (key !== fc.key) {
      fc.key = key;
      if (fc.cur) fc.cur.t1 = t;
      fc.cur = null;
      if (s && fc.on) {
        const cam = window.__fcCam();
        const seg = { index: s.index, phase: s.phase, playing: s.playing, speed: s.speed, stop: s.stop, at: s.at, rendered: s.rendered, t0: t, t1: null, first: cam, last: cam, minZoom: cam ? cam.zoom : null, moves: 0, frames: 0, fade: 0, maxLive: 0, routeMin: null, routeMax: null };
        fc.segs.push(seg);
        fc.cur = seg;
        if (s.phase === 'linger') {
          setTimeout(() => {
            seg.cap1 = window.__fcCaption();
            seg.cam1 = window.__fcCam();
          }, 500);
          setTimeout(() => {
            seg.cap2 = window.__fcCaption();
            seg.models = window.__mrModels ? window.__mrModels() : null;
          }, 1500);
        }
      }
    }
    const seg = fc.cur;
    if (seg && fc.on) {
      seg.frames += 1;
      if (s?.fade) seg.fade += 1;
      const cam = window.__fcCam();
      if (cam) {
        seg.last = cam;
        seg.minZoom = Math.min(seg.minZoom ?? Infinity, cam.zoom);
      }
      if (++n % 5 === 0) {
        const m = window.__mrModels ? window.__mrModels() : null;
        if (m) seg.maxLive = Math.max(seg.maxLive, m.live);
        const r = window.__fcRoute();
        if (r && Number.isFinite(r.coords)) {
          seg.routeMin = Math.min(seg.routeMin ?? Infinity, r.coords);
          seg.routeMax = Math.max(seg.routeMax ?? -Infinity, r.coords);
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function open(width, { reduced = false, cpu = 1 } = {}) {
  const page = await browser.newPage();
  const mobile = width < 600;
  const ua = await browser.userAgent();
  await page.emulate({
    viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : ua,
  });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ]);
  if (cpu > 1) await page.emulateCPUThrottling(cpu);
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.problems.push(`console.error: ${m.text()}`);
  });
  await page.evaluateOnNewDocument((token) => {
    try {
      localStorage.setItem('mr:token', token);
      localStorage.setItem('mr:who', 'james');
    } catch {
      /* ignore */
    }
  }, cfg.token);
  await page.evaluateOnNewDocument(RECORDER);
  await page.bringToFront();
  return page;
}
function noErrors(page, label) {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
}
async function countLoads(page, label, want) {
  const n = await page.evaluate(() => window.__mrMapLoads || 0);
  mapLoads += n;
  record(`${label}: window.__mrMapLoads === ${want}`, n === want, `${n} load(s)`);
}

const flyState = (page) => page.evaluate(() => window.__fcState());
/** Waits (≤ timeout) for a JS expression over the flyover state `s` (null when it isn't showing). */
const until = (page, expr, timeout = 15000) =>
  page
    .waitForFunction(`(() => { const s = window.__fcState(); return Boolean(s && (${expr})); })()`, { timeout, polling: 100 })
    .then(() => true)
    .catch(() => false);
const gone = (page, timeout = 5000) =>
  page
    .waitForFunction(() => !document.querySelector('[data-mr="flyover"]'), { timeout, polling: 100 })
    .then(() => true)
    .catch(() => false);
const recReset = (page) =>
  page.evaluate(() => {
    const fc = window.__fc;
    fc.frames = [];
    fc.segs = [];
    fc.key = '';
    fc.cur = null;
    fc.on = true;
  });
/** The recorder updates on the next frame after the DOM changes: give it a few before reading. */
const recRead = async (page) => {
  await wait(300);
  return page.evaluate(() => ({ frames: window.__fc.frames, segs: window.__fc.segs }));
};
/** Mid-flight screenshot: at the flight's widest point (a long hop pulls out to the globe), else ~45 % in. */
async function midShot(page, name, ms) {
  const t0 = Date.now();
  const wide = await page
    .waitForFunction(() => (window.__fcCam()?.zoom ?? 99) <= 2.2, { timeout: ms * 0.7, polling: 50 })
    .then(() => true)
    .catch(() => false);
  if (!wide) await wait(Math.max(0, ms * 0.45 - (Date.now() - t0)));
  const r = await routeInfo(page);
  await shot(page, name);
  return r;
}
const press = (page, width, s) => (width < 600 ? page.tap(s) : page.click(s));
const blur = (page) => page.evaluate(() => document.activeElement?.blur?.());
const key = async (page, k) => {
  await blur(page);
  await page.keyboard.press(k);
};
const camFull = (page) =>
  page.$eval(sel('map'), (el) => {
    const m = el.__mrMap;
    const c = m.getCenter();
    return { lng: c.lng, lat: c.lat, zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing(), padding: m.getPadding(), maxPitch: m.getMaxPitch() };
  });
const angDiff = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
function camDelta(a, b) {
  return {
    center: Math.max(Math.abs(a.lng - b.lng), Math.abs(a.lat - b.lat)),
    zoom: Math.abs(a.zoom - b.zoom),
    pitch: Math.abs(a.pitch - b.pitch),
    bearing: angDiff(a.bearing, b.bearing),
  };
}
const fmtDelta = (d) => `Δcentre ${d.center.toExponential(1)}°, Δzoom ${d.zoom.toExponential(1)}, Δpitch ${d.pitch.toFixed(3)}°, Δbearing ${d.bearing.toFixed(3)}°`;
const idle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) => {
        const map = document.querySelector('[data-mr="map"]')?.__mrMap;
        if (!map) return done(false);
        const t = setTimeout(() => done(false), 15000);
        map.once('idle', () => {
          clearTimeout(t);
          done(true);
        });
        map.triggerRepaint();
      }),
  );
const models = (page) => page.evaluate(() => window.__mrModels?.() || null);
const modelsDisposed = (page) =>
  page
    .waitForFunction(() => {
      const s = window.__mrModels?.();
      return !s || (s.live === 0 && s.loading === 0 && s.geometries === 0);
    }, { timeout: 12000, polling: 200 })
    .then(() => true)
    .catch(() => false);
const modelsLive = (page) =>
  page
    .waitForFunction(() => {
      const s = window.__mrModels?.();
      return s && s.live >= 1 && s.loading === 0;
    }, { timeout: 30000, polling: 200 })
    .then(() => true)
    .catch(() => false);
const routeInfo = (page) => page.evaluate(() => window.__fcRoute());
/** Stops on screen and on the near side of the globe (a project → unproject round trip, as toScreen does). */
const visibleStops = (page, list) =>
  page.$eval(
    sel('map'),
    (el, pts) => {
      const m = el.__mrMap;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const R = Math.PI / 180;
      const ang = (a, b) => Math.acos(Math.min(1, Math.max(-1, Math.sin(a[1] * R) * Math.sin(b[1] * R) + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.cos((b[0] - a[0]) * R)))) / R;
      return pts.map((p) => {
        const s = m.project(p);
        if (!(s.x >= 0 && s.y >= 0 && s.x <= w && s.y <= h)) return false;
        const back = m.unproject(s);
        return ang(p, [back.lng, back.lat]) < 0.5;
      });
    },
    list.map((s) => [s.lng, s.lat]),
  );
const layout = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width, h: r.height };
    };
    const bar = document.querySelector('.mr-fly__bar');
    return {
      vw: innerWidth,
      vh: innerHeight,
      bar: box(bar),
      buttons: bar ? [...bar.querySelectorAll('button')].map((b) => ({ mr: b.dataset.mr, ...box(b) })) : [],
      caption: box(document.querySelector('.mr-fly__caption')),
      logo: box(document.querySelector('.mapboxgl-ctrl-logo')),
      attrib: box(document.querySelector('.mapboxgl-ctrl-attrib')),
      map: box(document.querySelector('.mr-mappage-map')),
      side: getComputedStyle(document.querySelector('.mr-mappage-side')).display,
      play: box(document.querySelector('[data-mr="fly-play"]')),
    };
  });
const overlaps = (a, b) => Boolean(a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1);
/** The Play button must not cover the "n elsewhere" note (shown when a spot is outside the trip area). */
async function playClearOfNote(page, label) {
  const r = await page.evaluate(() => {
    const note = document.querySelector('[data-mr="elsewhere-note"]');
    const play = document.querySelector('[data-mr="fly-play"]');
    if (!note || !play) return { note: Boolean(note), play: Boolean(play) };
    const a = note.getBoundingClientRect();
    const b = play.getBoundingClientRect();
    const top = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
    const box = (q) => `${Math.round(q.left)},${Math.round(q.top)}–${Math.round(q.right)},${Math.round(q.bottom)}`;
    return { note: true, play: true, overlap: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, top: top?.closest('[data-mr]')?.dataset.mr || top?.tagName || null, a: box(a), b: box(b) };
  });
  if (!r.note) return info(`${label}: no "elsewhere" note on this data (every spot is in the trip area)`);
  record(`${label}: the Play button leaves the "n elsewhere" note clickable`, !r.overlap && r.top === 'elsewhere-note', `note ${r.a}, Play ${r.b}, on top at the note's centre: ${r.top}`);
}
/** Keeps the run's own fps line for the report. */
function fpsOf(frames) {
  const f = frames.filter(([, ph, pl]) => ph === 'flying' && pl).map(([dt]) => dt);
  if (f.length < 20) return null;
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  const s = [...f].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { n: f.length, fps: 1000 / mean, mean, p5: at(0.05), p95: at(0.95), low: 1000 / at(0.95), max: s[s.length - 1] };
}
const metaOf = (spot, engine) => `${COPY.fly.meta(COPY.spot.date(spot.capturedAt), COPY.app.people[spot.createdBy] || spot.createdBy)}${engine === 'atlas' && !onAtlas(spot) ? ` · ${COPY.fly.offMap}` : ''}`;

/**
 * Checks one whole run (Play → 'end') from the recorder. expect: the stops in order.
 * engine: 'mapbox' | 'atlas'. cap: the 3D model cap. speed: 1 | 2. reduced: cuts expected.
 */
function analyse(label, rec, { expect, engine, cap = 0, speed = 1, reduced = false, fps = false }) {
  const { segs, frames } = rec;
  const visits = [];
  for (const s of segs) if (s.phase === 'linger' && (!visits.length || visits[visits.length - 1].index !== s.index)) visits.push(s);
  const ids = visits.map((v) => v.stop);
  const want = expect.map((s) => s.id);
  const dated = visits.every((v, i) => i === 0 || String(v.at) >= String(visits[i - 1].at));
  record(
    `${label}: every stop with a location visited once, in capturedAt order`,
    JSON.stringify(ids) === JSON.stringify(want) && visits.every((v, i) => v.index === i) && dated && segs.some((s) => s.phase === 'end'),
    `${ids.length}/${want.length} (data-index ${visits.map((v) => v.index).join(',')}): ${ids.map((id) => titleOf(id).replace(/ \((fly-check|example)\)/, '')).join(' → ')}${segs.some((s) => s.phase === 'end') ? ' → end' : ', never reached the end'}`,
  );
  const target = 4000 / speed;
  const lingerMs = visits.filter((v) => v.t1 && v.playing).map((v) => v.t1 - v.t0);
  record(
    `${label}: each stop lingers ~${(target / 1000).toFixed(0)} s at ${speed}×`,
    lingerMs.length === visits.length && lingerMs.length > 0 && lingerMs.every((ms) => ms > target * 0.85 && ms < target * 1.35),
    `${lingerMs.map((ms) => (ms / 1000).toFixed(2)).join(' / ')} s`,
  );

  const bad = [];
  for (const v of visits) {
    const spot = byId.get(v.stop);
    if (!spot) continue;
    const c = v.cap2 || v.cap1;
    if (!c) {
      bad.push(`${spot.title}: no caption`);
      continue;
    }
    if (c.title !== spot.title) bad.push(`${spot.title}: title "${c.title}"`);
    if (c.note !== (spot.note || '')) bad.push(`${spot.title}: note "${c.note}"`);
    if (c.meta !== metaOf(spot, engine)) bad.push(`${spot.title}: meta "${c.meta}", expected "${metaOf(spot, engine)}"`);
    if (c.href !== `/memories/${spot.id}`) bad.push(`${spot.title}: link ${c.href}`);
    const thumb = !isRendered(spot) && hasThumb(spot);
    if (thumb && !c.thumb?.loaded) bad.push(`${spot.title}: first photo ${c.thumb ? 'not loaded' : 'missing'}`);
    if (!thumb && c.thumb) bad.push(`${spot.title}: a photo on a rendered stop`);
  }
  record(`${label}: captions: title, note, date · who; the first photo on captured-only stops`, bad.length === 0 && visits.length > 0, bad.slice(0, 3).join(' | '));

  if (engine === 'mapbox') {
    const flights = (i) => segs.find((s) => s.phase === 'flying' && s.index === i && s.playing);
    const camBad = [];
    for (const v of visits) {
      const spot = byId.get(v.stop);
      const cam = v.cam1 || v.first;
      if (!cam) continue;
      if (isRendered(spot)) {
        if (!(cam.zoom >= 15) || Math.abs(cam.pitch - 55) > 2.5) camBad.push(`${spot.title}: zoom ${cam.zoom.toFixed(2)}, pitch ${cam.pitch.toFixed(1)}°`);
      } else if (Math.abs(cam.zoom - 12.5) > 0.3 || cam.pitch > 1) camBad.push(`${spot.title}: zoom ${cam.zoom.toFixed(2)}, pitch ${cam.pitch.toFixed(1)}°`);
    }
    const shown = visits.map((v) => {
      const c = v.cam1 || v.first;
      return c ? `z${c.zoom.toFixed(1)}/${c.pitch.toFixed(0)}°` : '?';
    });
    record(`${label}: rendered stops dive past zoom 15 at ~55°, captured-only stops stay at town level, flat`, camBad.length === 0, camBad.length ? camBad.join(' | ') : shown.join(' '));

    const mBad = [];
    for (const v of visits) {
      const spot = byId.get(v.stop);
      const m = v.models;
      if (isRendered(spot)) {
        if (!m || m.live < 1 || m.live > cap || !m.ids.includes(v.stop) || m.broken) mBad.push(`${spot.title}: ${m ? `${m.live} live, ${m.loading} loading${m.ids.includes(v.stop) ? '' : ', not its model'}` : 'no 3D layer'}`);
      } else if (m && (m.live > 0 || m.geometries > 0)) mBad.push(`${spot.title} (town level): ${m.live} live / ${m.geometries} geometries still up`);
    }
    const maxLive = Math.max(0, ...segs.map((s) => s.maxLive));
    const last = [...visits].reverse().find((v) => v.models)?.models;
    record(
      `${label}: the 3D diorama stands at each rendered stop (≤ ${cap} live) and is disposed by the next town-level stop`,
      mBad.length === 0 && maxLive <= cap && RENDERED.length > 0,
      mBad.length ? mBad.join(' | ') : `most live at once ${maxLive}${last ? `; ${last.loaded} loaded / ${last.disposed} disposed so far` : ''}`,
    );

    const orbit = visits.filter((v) => isRendered(byId.get(v.stop)) && v.first && v.last).map((v) => angDiff(v.last.bearing, v.first.bearing));
    if (reduced) record(`${label}: no orbit under reduced motion`, orbit.every((d) => d < 0.5), `bearing moved ${orbit.map((d) => `${d.toFixed(1)}°`).join(', ')}`);
    else record(`${label}: the camera orbits a rendered stop while it lingers`, orbit.length > 0 && orbit.every((d) => d >= 25), `bearing turned ${orbit.map((d) => `${d.toFixed(1)}°`).join(', ')} (36° a linger)`);

    if (reduced) {
      const cuts = expect.map((_, i) => flights(i)).filter(Boolean);
      const slow = cuts.filter((s) => !s.t1 || s.t1 - s.t0 > 1000 || s.moves > 3 || s.fade === 0);
      record(
        `${label}: every move is a cut behind a fade (no flight)`,
        cuts.length === expect.length && slow.length === 0,
        cuts.map((s) => `${s.t1 ? Math.round(s.t1 - s.t0) : '?'} ms/${s.moves} move(s)/${s.fade ? 'fade' : 'NO fade'}`).join(', '),
      );
      const end = segs.find((s) => s.phase === 'end');
      record(`${label}: the end view is a cut too`, Boolean(end) && end.moves <= 3, `${end?.moves ?? '?'} move event(s)`);
    } else {
      const hops = [];
      for (let i = 1; i < expect.length; i++) {
        const f = flights(i);
        const d = km(expect[i - 1], expect[i]);
        const long = d > LONG_HOP_KM;
        hops.push({ i, d, long, z: f?.minZoom, ok: f ? (long ? f.minZoom <= 2.5 : f.minZoom > 4) : false });
      }
      record(
        `${label}: long hops pull out to the globe (min zoom ≤ 2.5), short hops don't`,
        hops.every((h) => h.ok),
        hops.map((h) => `${Math.round(h.d)} km${h.long ? ' (long)' : ''} → z${h.z == null ? '?' : h.z.toFixed(1)}${h.ok ? '' : ' ✗'}`).join(', '),
      );
      const grow = [];
      for (let i = 1; i < expect.length; i++) {
        const f = flights(i);
        grow.push({ i, ok: Boolean(f && f.routeMin != null && f.routeMax > f.routeMin), r: f ? `${f.routeMin}→${f.routeMax}` : '?' });
      }
      record(`${label}: the route line grows as the camera flies each leg`, grow.every((g) => g.ok), `route points per leg ${grow.map((g) => g.r).join(', ')}`);
    }
  }
  if (fps) {
    const f = fpsOf(frames);
    if (f) {
      const line = `${label}: flights ${f.fps.toFixed(1)} fps mean (${f.mean.toFixed(1)} ms), p5 ${f.p5.toFixed(1)} ms / p95 ${f.p95.toFixed(1)} ms (5th-percentile fps ${f.low.toFixed(1)}), worst ${f.max.toFixed(0)} ms, ${f.n} frames`;
      fpsLines.push(line);
      info(line);
    }
    return f;
  }
  return null;
}

/* ── static: tokens only, no callouts ────────────────────────────────────── */

if (only.has('static')) {
  const css = fs.readFileSync(path.join(REPO, 'src/memory-rooms/map/flyover/flyover.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const literals = css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b/gi) || [];
  record('static: flyover.css colours are .mr tokens only (no literals)', literals.length === 0, literals.slice(0, 5).join(' '));
  const leftRule = css.match(/border-left\s*:[^;]*/gi) || [];
  record('static: no left-rule callouts in flyover.css', leftRule.length === 0, leftRule.join(' | '));
  const copy = ['play', 'pause', 'resume', 'again', 'prev', 'next', 'exit', 'endTitle', 'offMap'].filter((k) => !COPY.fly[k]);
  record('static: the flyover copy lives in copy.js (fly section)', copy.length === 0, copy.length ? `missing ${copy.join(', ')}` : '');
}

/* ── the atlas fallback (no Mapbox load) ─────────────────────────────────── */

const atlasView = (page) => page.$eval(`${sel('map')} > g[data-bg]`, (g) => g.getAttribute('transform')).catch(() => null);
const nums = (t) => (t || '').match(/-?[\d.]+(e-?\d+)?/g)?.map(Number) || [];
for (const W of only.has('atlas') ? [1440, 390] : []) {
  const label = `atlas ${W}`;
  const page = await open(W);
  await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
  const drawn = await page.waitForSelector(`${sel('map')} .mr-atlas-borders`, { timeout: 20000 }).then(() => true).catch(() => false);
  await wait(800);
  const v0 = await atlasView(page);
  const btn = await page.$(sel('fly-play'));
  const btnOn = btn ? await btn.evaluate((el) => !el.disabled && el.offsetParent !== null) : false;
  record(`${label}: the atlas has a working "Play the trip" button (not a broken one)`, drawn && btnOn);
  await playClearOfNote(page, label);
  if (!btnOn) {
    noErrors(page, label);
    await page.close();
    continue;
  }
  await recReset(page);
  await press(page, W, sel('fly-play'));
  const started = await until(page, 's.index === 0 && s.playing', 5000);
  await press(page, W, sel('fly-speed'));
  const fast = await until(page, 's.speed === 2', 3000);
  record(`${label}: it starts at the first stop; 1×/2× switches`, started && fast, `${(await flyState(page))?.count} stops`);
  if (W < 600) {
    const l = await layout(page);
    const small = l.buttons.filter((b) => b.w < 44 || b.h < 44);
    record(
      `${label}: the bar sits at the bottom (within thumb reach), every target ≥ 44 px`,
      l.bar && l.bar.y0 >= l.vh * 0.75 && l.bar.y1 <= l.vh && small.length === 0,
      `bar ${Math.round(l.bar?.y0)}–${Math.round(l.bar?.y1)} of ${l.vh} px; buttons ${l.buttons.map((b) => `${Math.round(b.w)}×${Math.round(b.h)}`).join(' ')}`,
    );
  }
  if (await until(page, 's.index === 1 && s.phase === "linger"', 30000)) {
    await wait(500);
    await shot(page, `fly-atlas-${W}`);
  }
  const done = await page
    .waitForFunction(() => window.__fcState()?.phase === 'end', { timeout: RUN_MS, polling: 250 })
    .then(() => true)
    .catch(() => false);
  const rec = await recRead(page);
  analyse(label, rec, { expect: STOPS, engine: 'atlas', speed: 2 });
  const route = await page.$eval(sel('fly-route'), (p) => (p.getAttribute('d') || '').length).catch(() => 0);
  const endCap = await page.$eval(sel('fly-end'), (el) => el.textContent).catch(() => '');
  const offMap = STOPS.filter((s) => !onAtlas(s)).map((s) => s.title);
  record(
    `${label}: ends on the whole trip with the route drawn (stops off the atlas captioned "${COPY.fly.offMap}")`,
    done && route > 50 && endCap.includes(COPY.fly.endTitle),
    `route path ${route} chars, end caption "${endCap.slice(0, 40)}", off the atlas: ${offMap.join(', ') || 'none'}`,
  );
  // controls: play again, pause, ← →, then exit (Escape at 1440, the button at 390)
  await press(page, W, sel('fly-toggle'));
  const again = await until(page, 's.index === 0 && s.playing && s.phase === "flying"', 3000);
  let keys = true;
  if (W >= 600) {
    await key(page, 'Space');
    const paused = await until(page, '!s.playing', 2000);
    await key(page, 'Space');
    const resumed = await until(page, 's.playing', 2000);
    await key(page, 'ArrowRight');
    const right = await until(page, 's.index === 1', 2000);
    await key(page, 'ArrowLeft');
    const left = await until(page, 's.index === 0', 2000);
    keys = paused && resumed && right && left;
  } else {
    await press(page, W, sel('fly-next'));
    const nx = await until(page, 's.index === 1', 2000);
    await press(page, W, sel('fly-prev'));
    keys = nx && (await until(page, 's.index === 0', 2000));
  }
  record(`${label}: play again, pause/resume, previous/next work${W >= 600 ? ' (Space, ←, →)' : ' (taps)'}`, again && keys);
  if (W >= 600) await key(page, 'Escape');
  else await press(page, W, sel('fly-exit'));
  const out = await gone(page);
  await wait(1500); // the atlas eases back
  const v1 = await atlasView(page);
  const d = Math.max(...nums(v0).map((n, i) => Math.abs(n - (nums(v1)[i] ?? Infinity))));
  const routeLeft = await page.$(sel('fly-route'));
  record(`${label}: exit${W >= 600 ? ' (Escape)' : ''} closes it, drops the route and puts the atlas view back`, out && !routeLeft && d < 0.5, `transform ${v0} → ${v1}`);
  await countLoads(page, label, 0);
  noErrors(page, label);
  await page.close();
}

/* ── the globe at 1440 ───────────────────────────────────────────────────── */

const CAP = { 1440: 6, 390: 3 };

/** The exit checks shared by every globe page: overlay, route, camera, models, chrome. */
async function exitChecks(page, label, before, { exact = true } = {}) {
  const out = await gone(page);
  await page.waitForFunction(() => !document.querySelector('[data-mr="map"]')?.__mrMap?.isMoving(), { timeout: 8000, polling: 100 }).catch(() => {});
  await idle(page);
  const after = await camFull(page);
  const route = await routeInfo(page);
  const d = camDelta(before, after);
  const tol = exact ? 1e-6 : 1e-4;
  const camOk = d.center < tol && d.zoom < tol && d.pitch < 0.01 && d.bearing < 0.01;
  const padOk = JSON.stringify(before.padding) === JSON.stringify(after.padding);
  record(
    `${label}: centre, zoom, pitch, bearing${exact ? ', padding and tilt limit' : ''} back as they were`,
    out && camOk && (!exact || (padOk && after.maxPitch === before.maxPitch)),
    `${fmtDelta(d)}${exact ? `; padding ${padOk ? 'same' : `${JSON.stringify(before.padding)} → ${JSON.stringify(after.padding)}`}; maxPitch ${before.maxPitch} → ${after.maxPitch}` : ''}`,
  );
  record(`${label}: the route source and layer are removed`, route === null, route ? JSON.stringify(route) : '');
  const disposed = await modelsDisposed(page);
  const m = await models(page);
  record(`${label}: the flight's 3D models are disposed`, disposed && (!m || m.disposed >= m.loaded), m ? `${m.loaded} loaded / ${m.disposed} disposed, ${m.live} live, ${m.textures} textures / ${m.geometries} geometries` : 'no 3D layer was made');
  const chrome = await page.evaluate(() => ({
    flying: document.querySelector('.mr-mappage')?.hasAttribute('data-flying'),
    play: Boolean(document.querySelector('[data-mr="fly-play"]')),
    controls: getComputedStyle(document.querySelector('.mr-mapctl')).display !== 'none',
  }));
  record(`${label}: the Play button and the map controls come back`, !chrome.flying && chrome.play && chrome.controls, JSON.stringify(chrome));
  return after;
}

if (only.has('globe-1440')) {
  const W = 1440;
  const label = `globe ${W}`;
  const page = await open(W);
  await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(MAPBOX_READY, { timeout: 30000 }).then(() => true).catch(() => false);
  record(`${label}: the Mapbox globe loads`, ready, await page.$eval('.mr-spotsmap', (el) => `engine ${el.dataset.engine}${el.dataset.engineReason ? ` (${el.dataset.engineReason})` : ''}`).catch(() => 'no map'));
  if (ready) {
    await idle(page);
    // a view of the user's own (the exit must put exactly this back)
    await page.click(sel('zoom-in'));
    await wait(600);
    await idle(page);
    const before = await camFull(page);
    const playBtn = await page.$eval(sel('fly-play'), (el) => ({ on: !el.disabled, text: el.textContent, label: el.getAttribute('aria-label') })).catch(() => null);
    record(`${label}: "Play the trip" is on the map`, Boolean(playBtn?.on) && playBtn.text.includes(COPY.fly.play), playBtn ? `"${playBtn.text}"` : 'missing');
    await playClearOfNote(page, label);

    await recReset(page);
    await page.click(sel('fly-play'));
    const started = await until(page, 's.index === 0 && s.playing', 5000);
    const s0 = await flyState(page);
    const r0 = await routeInfo(page);
    record(
      `${label}: Play starts at the first stop with the route source + line layer on the same map`,
      started && s0?.count === STOPS.length && s0?.stop === STOPS[0].id && r0?.source && r0?.layer,
      `${s0 ? `${s0.index + 1}/${s0.count} "${titleOf(s0.stop)}"` : 'no overlay'}, route ${r0 ? `source ${r0.source}, layer ${r0.layer}` : 'none'}`,
    );
    const chrome = await page.evaluate(() => ({
      flying: document.querySelector('.mr-mappage')?.hasAttribute('data-flying'),
      play: Boolean(document.querySelector('[data-mr="fly-play"]')),
      controls: getComputedStyle(document.querySelector('.mr-mapctl')).display,
      count: document.querySelector('[data-mr="fly-count"]')?.textContent,
      speed: document.querySelector('[data-mr="fly-speed"]')?.textContent,
    }));
    record(
      `${label}: while it plays the map controls hide and the bar reads "${COPY.fly.counter(1, STOPS.length)}" / "${COPY.fly.speed(1)}"`,
      chrome.flying && !chrome.play && chrome.controls === 'none' && chrome.count === COPY.fly.counter(1, STOPS.length) && chrome.speed === COPY.fly.speed(1),
      JSON.stringify(chrome),
    );
    const colour = await page.$eval(sel('map'), (el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--mr-map-route)';
      el.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return { token: c, line: el.__mrMap.getPaintProperty('mr-route-line', 'line-color') };
    }).catch(() => null);
    record(`${label}: the route line is painted from --mr-map-route (${scheme})`, Boolean(colour) && String(colour.line).replace(/\s/g, '') === colour.token.replace(/\s/g, ''), colour ? `${colour.line} vs token ${colour.token}` : '');
    const lw = await layout(page);
    const box = (b) => (b ? `${Math.round(b.x0)},${Math.round(b.y0)}–${Math.round(b.x1)},${Math.round(b.y1)}` : 'none');
    record(
      `${label}: the bar and caption keep clear of the Mapbox logo and attribution`,
      !overlaps(lw.bar, lw.logo) && !overlaps(lw.bar, lw.attrib) && !overlaps(lw.caption, lw.attrib),
      `bar ${box(lw.bar)}, logo ${box(lw.logo)}, attribution ${box(lw.attrib)}`,
    );

    const done = await page
      .waitForFunction(() => window.__fcState()?.phase === 'end', { timeout: RUN_MS * 2 + 30000, polling: 250 })
      .then(() => true)
      .catch(() => false);
    const rec = await recRead(page);
    const f = analyse(label, rec, { expect: STOPS, engine: 'mapbox', cap: CAP[W], speed: 1, fps: true });
    record(`${label}: flights hold ≥ 30 fps on average`, Boolean(f) && f.fps >= 30, f ? `${f.fps.toFixed(1)} fps` : 'no flight frames');
    if (done) {
      await page.waitForFunction(() => !document.querySelector('[data-mr="map"]').__mrMap.isMoving(), { timeout: 10000, polling: 100 }).catch(() => {});
      await idle(page);
      const vis = await visibleStops(page, STOPS);
      const cam = await camFull(page);
      const r = await routeInfo(page);
      const endCap = await page.$eval(sel('fly-end'), (el) => el.textContent).catch(() => '');
      const must = new Set(endStops(STOPS).map((s) => s.id));
      const missing = STOPS.filter((s, i) => must.has(s.id) && !vis[i]).map((s) => s.title);
      record(
        `${label}: it ends on the whole route (every stop in view, or the main region when they can't share one globe view; flat, north up)`,
        missing.length === 0 && cam.pitch < 0.5 && angDiff(cam.bearing, 0) < 0.5,
        `${vis.filter(Boolean).length}/${STOPS.length} stops in view${missing.length ? ` (not: ${missing.join(', ')})` : ''}, centre ${cam.lng.toFixed(1)},${cam.lat.toFixed(1)} z${cam.zoom.toFixed(2)}, pitch ${cam.pitch.toFixed(1)}°`,
      );
      record(
        `${label}: the end shows the full route (${STOPS.length - 1} legs) and "${COPY.fly.endTitle}"`,
        r?.features === STOPS.length - 1 && endCap.includes(COPY.fly.endTitle) && endCap.includes(COPY.fly.endBody(STOPS.length)),
        `${r?.features} line(s), ${r?.coords} points; "${endCap}"`,
      );
      await shot(page, `fly-end-${W}`);
      const lim = await page.evaluate(() => ({
        next: document.querySelector('[data-mr="fly-next"]').disabled,
        prev: document.querySelector('[data-mr="fly-prev"]').disabled,
        label: document.querySelector('[data-mr="fly-toggle"]').getAttribute('aria-label'),
      }));
      record(`${label}: at the end the main button reads "${COPY.fly.again}"`, lim.label === COPY.fly.again && lim.next && !lim.prev, JSON.stringify(lim));
    }

    // ── controls ──
    await page.click(sel('fly-toggle')); // Play again
    const again = await until(page, 's.index === 0 && s.phase === "flying" && s.playing', 3000);
    record(`${label}: "${COPY.fly.again}" starts over from the first stop`, again);
    await wait(900);
    await key(page, 'Space');
    const paused = await until(page, '!s.playing', 2000);
    const c1 = await camFull(page);
    await wait(1500);
    const c2 = await camFull(page);
    const sp = await flyState(page);
    const held = camDelta(c1, c2);
    record(
      `${label}: Space pauses mid-flight and the camera holds`,
      paused && sp.phase === 'flying' && sp.index === 0 && held.center === 0 && held.zoom === 0 && held.pitch === 0 && held.bearing === 0,
      `over 1.5 s: ${fmtDelta(held)}; toggle label "${await page.$eval(sel('fly-toggle'), (el) => el.getAttribute('aria-label'))}"`,
    );
    await key(page, 'Space');
    const resumed = await until(page, 's.playing && s.phase === "flying"', 2000);
    await key(page, 'ArrowRight');
    const right = await until(page, 's.index === 1 && s.phase === "flying"', 2000);
    record(`${label}: Space resumes, → goes to the next stop`, resumed && right, `now ${(await flyState(page))?.index + 1}/${STOPS.length}`);
    // mid-flight screenshot (into stop 2; a long hop pulls out to the globe)
    const into1 = km(STOPS[0], STOPS[1]) > LONG_HOP_KM ? 6500 : 3200;
    const rMid = await midShot(page, `fly-mid-${W}`, into1);
    const there = await until(page, 's.index === 1 && s.phase === "linger"', into1 + 8000);
    const rThere = await routeInfo(page);
    record(`${label}: mid-flight the leg is part-drawn, complete on arrival`, there && rMid && rThere && rThere.coords > rMid.coords, `${rMid?.coords} → ${rThere?.coords} route points`);
    if (isRendered(STOPS[1])) {
      const live = await modelsLive(page);
      await wait(800);
      const m = await models(page);
      await shot(page, `fly-3d-${W}`);
      record(`${label}: screenshot at the 3D stop "${STOPS[1].title}"`, live && m.live >= 1 && m.live <= CAP[W], `${m?.live} live, ${m?.textures} textures / ${m?.geometries} geometries`);
    }
    // pause in the linger: the orbit and the linger clock both stop
    const lingerSince = Date.now();
    await page.click(sel('fly-toggle'));
    const p2 = await until(page, '!s.playing', 2000);
    const b1 = await camFull(page);
    await wait(1500);
    const b2 = await camFull(page);
    await wait(Math.max(0, 5000 - (Date.now() - lingerSince)));
    const still = await flyState(page);
    record(
      `${label}: pausing a linger holds the camera (no orbit) and the stop (> 4 s)`,
      p2 && camDelta(b1, b2).bearing === 0 && camDelta(b1, b2).zoom === 0 && still.index === 1 && still.phase === 'linger',
      `bearing ${b1.bearing.toFixed(2)}° → ${b2.bearing.toFixed(2)}°, after ${((Date.now() - lingerSince) / 1000).toFixed(1)} s still ${still.index + 1}/${STOPS.length} ${still.phase}`,
    );
    await page.click(sel('fly-toggle'));
    const moved = await until(page, 's.index === 2 && s.phase === "flying" && s.playing', 6000);
    record(`${label}: play carries on from the paused linger to the next stop`, moved);

    // 2×: the next linger halves
    await recReset(page);
    await page.click(sel('fly-speed'));
    const two = await until(page, 's.speed === 2', 2000);
    const speedText = await page.$eval(sel('fly-speed'), (el) => [el.textContent, el.getAttribute('aria-label')]);
    await until(page, 's.index === 3 && s.phase === "flying"', 15000);
    await page.waitForFunction(() => window.__fc.segs.some((s) => s.phase === 'linger' && s.speed === 2 && s.t1), { timeout: 3000 }).catch(() => {});
    const r2 = await recRead(page);
    const l2 = r2.segs.find((s) => s.phase === 'linger' && s.speed === 2 && s.t1 && s.playing);
    const l2ms = l2 ? l2.t1 - l2.t0 : NaN;
    record(
      `${label}: 2× halves the linger`,
      two && speedText[0] === COPY.fly.speed(2) && speedText[1] === COPY.fly.speedLabel(2) && l2ms > 1600 && l2ms < 2700,
      `"${speedText[0]}", linger ${(l2ms / 1000).toFixed(2)} s`,
    );
    // previous / next: keys and buttons, and their limits
    const iA = (await flyState(page)).index;
    await key(page, 'ArrowLeft');
    const left = await until(page, `s.index === ${iA - 1}`, 2000);
    await page.click(sel('fly-prev'));
    const prevBtn = await until(page, `s.index === ${iA - 2}`, 2000);
    await page.click(sel('fly-next'));
    const nextBtn = await until(page, `s.index === ${iA - 1}`, 2000);
    record(`${label}: ← and the previous / next buttons step one stop`, left && prevBtn && nextBtn, `${iA + 1} → ${iA} → ${iA - 1} → ${iA}`);
    for (let i = 0; i < STOPS.length; i++) await key(page, 'ArrowLeft');
    await until(page, 's.index === 0', 2000);
    const first = await page.evaluate(() => [window.__fcState().index, document.querySelector('[data-mr="fly-prev"]').disabled]);
    for (let i = 0; i < STOPS.length + 1; i++) await key(page, 'ArrowRight');
    await until(page, `s.index === ${STOPS.length - 1}`, 2000);
    const lastS = await page.evaluate(() => [window.__fcState().index, document.querySelector('[data-mr="fly-next"]').disabled]);
    record(
      `${label}: it stops at the ends (previous disabled on the first stop, next on the last)`,
      first[0] === 0 && first[1] && lastS[0] === STOPS.length - 1 && lastS[1],
      `first ${first[0] + 1} prev ${first[1] ? 'disabled' : 'ENABLED'}, last ${lastS[0] + 1} next ${lastS[1] ? 'disabled' : 'ENABLED'}`,
    );
    await page.click(sel('fly-speed'));
    await until(page, 's.speed === 1', 2000);
    // exit with Escape from a rendered stop with its model up
    const lastRendered = isRendered(STOPS[STOPS.length - 1]);
    if (lastRendered) {
      await until(page, `s.index === ${STOPS.length - 1} && s.phase === "linger"`, 15000);
      await modelsLive(page);
    }
    const mUp = await models(page);
    await key(page, 'Escape');
    info(`Escape at "${STOPS[STOPS.length - 1].title}" with ${mUp?.live ?? 0} model(s) live`);
    await exitChecks(page, `${label} Escape`, before);

    // exit with the button, mid-flight, with a spot's card open before Play: the card comes back
    const carded = RENDERED[RENDERED.length - 1];
    await page.click(`[data-mr="spot-row"][data-id="${carded.id}"]`);
    const cardBefore = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).then(() => true).catch(() => false);
    await wait(400);
    await page.waitForFunction(() => !document.querySelector('[data-mr="map"]').__mrMap.isMoving(), { timeout: 8000, polling: 100 }).catch(() => {});
    await idle(page);
    const before2 = await camFull(page);
    await page.click(sel('fly-play'));
    await until(page, 's.phase === "flying" && s.playing', 3000);
    const cardHidden = !(await page.$(sel('spot-card')));
    await wait(1200);
    await page.click(sel('fly-exit'));
    await exitChecks(page, `${label} exit button`, before2);
    const cardBack = await page.waitForSelector(sel('spot-card'), { visible: true, timeout: 5000 }).then((h) => h.evaluate((el) => el.textContent)).catch(() => '');
    record(
      `${label}: a card open before Play closes for the flight and comes back on exit`,
      cardBefore && cardHidden && cardBack.includes(carded.title),
      `before ${cardBefore ? 'open' : 'not open'}, during ${cardHidden ? 'closed' : 'OPEN'}, after "${cardBack.slice(0, 40)}"`,
    );
    await page.keyboard.press('Escape');
    await wait(400);

    // the filters decide the stops
    for (const [name, value, pick] of [
      ['person', 'justin', (s) => s.createdBy === 'justin'],
      ['status', 'rendered', (s) => s.status === 'rendered'],
    ]) {
      await page.click(`[data-mr="filter-${name}"][data-value="${value}"]`);
      await wait(300);
      const want = stopsOf(SPOTS.filter(pick));
      await page.click(sel('fly-play'));
      await until(page, 's.index === 0', 3000);
      const seen = [];
      for (let i = 0; i < want.length; i++) {
        await until(page, `s.index === ${i}`, 2000);
        seen.push((await flyState(page)).stop);
        await key(page, 'ArrowRight');
      }
      const n = (await flyState(page))?.count;
      await key(page, 'Escape');
      await gone(page);
      await page.click(`[data-mr="filter-${name}"][data-value="all"]`);
      await wait(300);
      record(
        `${label}: filter ${name} = ${value} → the flyover visits just those stops, in order`,
        n === want.length && JSON.stringify(seen) === JSON.stringify(want.map((s) => s.id)),
        `${n} stops: ${seen.map(titleOf).join(' → ')}`,
      );
    }
    await page.click('[data-mr="filter-status"][data-value="modelling"]');
    await wait(300);
    const none = stopsOf(SPOTS.filter((s) => s.status === 'modelling')).length === 0;
    const disabled = await page.$eval(sel('fly-play'), (el) => el.disabled).catch(() => null);
    record(`${label}: with no stop left by the filters, Play is disabled`, !none || disabled === true, `disabled=${disabled}`);
    await page.click('[data-mr="filter-status"][data-value="all"]');
    await wait(300);

    // the caption opens the spot
    await page.click(sel('fly-play'));
    const lingering = await until(page, 's.index === 0 && s.phase === "linger"', 15000);
    if (lingering) {
      const style = await page.evaluate(() =>
        ['.mr-fly__caption', '.mr-fly__bar'].map((s) => {
          const cs = getComputedStyle(document.querySelector(s));
          return { s, l: cs.borderLeftWidth, t: cs.borderTopWidth, r: cs.borderRightWidth, lc: cs.borderLeftColor, tc: cs.borderTopColor };
        }),
      );
      record(`${label}: caption and bar are hairline-ruled all round (no coloured left rule)`, style.every((x) => x.l === x.t && x.l === x.r && x.lc === x.tc), style.map((x) => `${x.s} ${x.l}/${x.t}/${x.r}`).join(', '));
      await page.click(sel('fly-caption'));
      const opened = await page.waitForFunction((id) => location.pathname === `/memories/${id}` && document.querySelector('.mr-spot__title'), { timeout: 10000 }, STOPS[0].id).then(() => true).catch(() => false);
      const title = await page.$eval('.mr-spot__title', (el) => el.textContent).catch(() => '');
      await wait(1500);
      await shot(page, `fly-caption-open-${W}`);
      const errs = page.problems.filter((p) => /pageerror/.test(p));
      record(
        `${label}: clicking the caption opens the spot page`,
        opened && title === STOPS[0].title && !(await page.$(sel('flyover'))),
        `${await page.evaluate(() => location.pathname)} title "${title}", body ${(await page.evaluate(() => document.body.innerText.trim().length))} chars${errs.length ? `; ${errs[0]}` : ''}`,
      );
    } else record(`${label}: clicking the caption opens the spot page`, false, 'never reached the first stop');
  }
  await countLoads(page, label, 1);
  noErrors(page, label);
  await page.close();
}

/* ── the globe at 390: ?play=1, touch, CPU throttled ─────────────────────── */

if (only.has('globe-390')) {
  const W = 390;
  const label = `globe ${W}`;
  const page = await open(W);
  await page.goto(`${base}/memories?play=1`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(MAPBOX_READY, { timeout: 45000 }).then(() => true).catch(() => false);
  // throttle once the map is up (a throttled load can trip useMapbox's 12 s fallback to the atlas)
  await page.emulateCPUThrottling(THROTTLE);
  record(`${label}: the Mapbox globe loads (touch; CPU ÷${THROTTLE} from here)`, ready);
  if (ready) {
    const auto = await until(page, 's.index === 0 && s.playing', 8000);
    const s0 = await flyState(page);
    record(`${label}: /memories?play=1 starts the flyover by itself`, auto && s0?.count === STOPS.length && s0?.stop === STOPS[0].id, s0 ? `${s0.index + 1}/${s0.count} "${titleOf(s0.stop)}"` : 'no overlay');
    await wait(600);
    const l = await layout(page);
    const small = l.buttons.filter((b) => b.w < 44 || b.h < 44);
    record(
      `${label}: the map takes the screen while it plays (the list hides)`,
      l.side === 'none' && l.map && l.map.h >= l.vh * 0.75 && !l.play,
      `map ${Math.round(l.map?.h)} of ${l.vh} px, list display ${l.side}, Play button ${l.play ? 'shown' : 'hidden'}`,
    );
    record(
      `${label}: the bar sits in the bottom quarter, within thumb reach, every target ≥ 44 px`,
      l.bar && l.bar.y0 >= l.vh * 0.75 && l.bar.y1 <= l.vh && l.bar.x0 >= 0 && l.bar.x1 <= l.vw && small.length === 0 && l.buttons.length >= 5,
      `bar ${Math.round(l.bar?.y0)}–${Math.round(l.bar?.y1)} of ${l.vh} px; ${l.buttons.map((b) => `${b.mr} ${Math.round(b.w)}×${Math.round(b.h)}`).join(', ')}`,
    );
    const bx = (b) => (b ? `${Math.round(b.x0)},${Math.round(b.y0)}–${Math.round(b.x1)},${Math.round(b.y1)}` : 'none');
    record(
      `${label}: the bar keeps clear of the Mapbox logo and attribution`,
      !overlaps(l.bar, l.logo) && !overlaps(l.bar, l.attrib),
      `bar ${bx(l.bar)}, logo ${bx(l.logo)}, attribution ${bx(l.attrib)}`,
    );

    const done = await page
      .waitForFunction(() => window.__fcState()?.phase === 'end', { timeout: RUN_MS * 3 + 30000, polling: 250 })
      .then(() => true)
      .catch(() => false);
    const rec = await recRead(page);
    const f = analyse(label, rec, { expect: STOPS, engine: 'mapbox', cap: CAP[W], speed: 1, fps: true });
    record(`${label}: flights hold ≥ 20 fps on average (touch, CPU ÷${THROTTLE})`, Boolean(f) && f.fps >= 20, f ? `${f.fps.toFixed(1)} fps` : 'no flight frames');
    const lc = await layout(page);
    await page.emulateCPUThrottling(1);
    if (done) {
      await page.waitForFunction(() => !document.querySelector('[data-mr="map"]').__mrMap.isMoving(), { timeout: 10000, polling: 100 }).catch(() => {});
      await idle(page);
      const vis = await visibleStops(page, STOPS).catch(() => []);
      const cam = await camFull(page);
      const must = new Set(endStops(STOPS).map((s) => s.id));
      const missing = STOPS.filter((s, i) => must.has(s.id) && !vis[i]).map((s) => s.title);
      record(
        `${label}: it ends on the whole route (every stop in view, or the main region when they can't share one globe view)`,
        vis.length === STOPS.length && missing.length === 0,
        `${vis.filter(Boolean).length}/${STOPS.length} stops in view${missing.length ? ` (not: ${missing.join(', ')})` : ''}, centre ${cam.lng.toFixed(1)},${cam.lat.toFixed(1)} z${cam.zoom.toFixed(2)}`,
      );
      await shot(page, `fly-end-${W}`);
    }
    record(`${label}: caption and bar don't overlap`, !overlaps(lc.caption, lc.bar), lc.caption ? `caption ${Math.round(lc.caption.y0)}–${Math.round(lc.caption.y1)}, bar ${Math.round(lc.bar?.y0)}–${Math.round(lc.bar?.y1)}` : 'no caption at the end');

    // Play again → next: the mid-flight and 3D-stop screenshots, then exit with ?play=1 still in the URL
    await page.tap(sel('fly-toggle')); // Play again
    const again = await until(page, 's.index === 0 && s.phase === "flying" && s.playing', 3000);
    await page.tap(sel('fly-next'));
    const nx = await until(page, 's.index === 1 && s.phase === "flying" && s.playing', 2000);
    record(`${label}: tapping "${COPY.fly.again}", then next`, again && nx, `${(await flyState(page))?.index + 1}/${STOPS.length}`);
    const into1 = 6500; // from the end view: always a long hop
    await midShot(page, `fly-mid-${W}`, into1);
    const there = await until(page, 's.index === 1 && s.phase === "linger"', into1 + 8000);
    if (isRendered(STOPS[1])) {
      const live = await modelsLive(page);
      await wait(800);
      const m = await models(page);
      await shot(page, `fly-3d-${W}`);
      record(`${label}: next reaches the 3D stop; ≤ ${CAP[W]} model(s) live`, there && live && m.live >= 1 && m.live <= CAP[W], `${m?.live} live, ${m?.textures} textures / ${m?.geometries} geometries`);
    }
    // exit: the button; ?play=1 goes from the URL, the list and the opening view come back
    await page.tap(sel('fly-exit'));
    const out = await gone(page);
    await page.waitForFunction(() => !document.querySelector('[data-mr="map"]')?.__mrMap?.isMoving(), { timeout: 8000, polling: 100 }).catch(() => {});
    await idle(page);
    const after = await camFull(page);
    const back = await page.evaluate(() => ({
      search: location.search,
      auto: document.querySelector('[data-mr="map"]').hasAttribute('data-auto'),
      side: getComputedStyle(document.querySelector('.mr-mappage-side')).display,
      play: Boolean(document.querySelector('[data-mr="fly-play"]')),
    }));
    const route = await routeInfo(page);
    record(
      `${label}: tapping exit drops ?play=1 and brings back the list and the opening view (flat, north up)`,
      out && !/play=/.test(back.search) && back.auto && back.side !== 'none' && back.play && after.pitch < 0.01 && angDiff(after.bearing, 0) < 0.01 && route === null,
      `search "${back.search}", data-auto ${back.auto}, list ${back.side}, pitch ${after.pitch.toFixed(2)}°, bearing ${after.bearing.toFixed(2)}°, route ${route ? 'still there' : 'removed'}`,
    );
    const disposed = await modelsDisposed(page);
    const m = await models(page);
    record(`${label}: the flight's 3D models are disposed`, disposed, m ? `${m.loaded} loaded / ${m.disposed} disposed, ${m.textures} textures / ${m.geometries} geometries` : '');

    // a drag on the map pauses it; once the drag has settled, play carries on
    await page.tap(sel('fly-play'));
    await until(page, 's.index === 0 && s.phase === "flying" && s.playing', 3000);
    await wait(900);
    const cx = W / 2;
    const cy = 300;
    await page.touchscreen.touchStart(cx, cy);
    for (let k = 1; k <= 10; k++) await page.touchscreen.touchMove(cx - k * 10, cy + k * 4);
    await page.touchscreen.touchEnd();
    const dragPaused = await until(page, '!s.playing', 2000);
    await page.waitForFunction(() => !document.querySelector('[data-mr="map"]').__mrMap.isMoving(), { timeout: 5000, polling: 100 }).catch(() => {});
    await wait(1500); // a tap straight after a drag can be eaten by the browser's gesture handling
    await page.tap(sel('fly-toggle'));
    const resumedAfterDrag = await until(page, 's.playing', 2000);
    await wait(1000);
    const stillPlaying = (await flyState(page))?.playing;
    record(
      `${label}: a drag on the map pauses the flyover; tapping play carries on`,
      dragPaused && resumedAfterDrag && stillPlaying,
      `drag → ${dragPaused ? 'paused' : 'still playing'}; play → ${resumedAfterDrag ? (stillPlaying ? 'playing' : 'playing, then paused again') : 'not resumed'}`,
    );
    await page.tap(sel('fly-exit'));
    await gone(page);
    await page.waitForFunction(() => !document.querySelector('[data-mr="map"]').__mrMap.isMoving(), { timeout: 5000, polling: 100 }).catch(() => {});
    await idle(page);

    // the Play button itself, and an exact restore of the view it started from
    const lp = await layout(page);
    record(`${label}: the Play button is a ≥ 44 px target`, lp.play && lp.play.h >= 44 && lp.play.w >= 44, lp.play ? `${Math.round(lp.play.w)}×${Math.round(lp.play.h)}` : 'missing');
    await playClearOfNote(page, label);
    const before = await camFull(page);
    await page.tap(sel('fly-play'));
    await until(page, 's.phase === "flying" && s.playing', 3000);
    await wait(1500);
    await page.tap(sel('fly-exit'));
    await exitChecks(page, `${label} Play → exit`, before, { exact: false });

    // tap the caption
    await page.tap(sel('fly-play'));
    const lingering = await until(page, 's.index === 0 && s.phase === "linger"', 15000);
    if (lingering) {
      await page.tap(sel('fly-caption'));
      const opened = await page.waitForFunction((id) => location.pathname === `/memories/${id}` && document.querySelector('.mr-spot__title'), { timeout: 10000 }, STOPS[0].id).then(() => true).catch(() => false);
      await wait(1500);
      await shot(page, `fly-caption-open-${W}`);
      const errs = page.problems.filter((p) => /pageerror/.test(p));
      record(
        `${label}: tapping the caption opens the spot page`,
        opened,
        `${await page.evaluate(() => location.pathname)}, body ${(await page.evaluate(() => document.body.innerText.trim().length))} chars${errs.length ? `; ${errs[0]}` : ''}`,
      );
    } else record(`${label}: tapping the caption opens the spot page`, false, 'never reached the first stop');
  }
  await countLoads(page, label, 1);
  noErrors(page, label);
  await page.close();
}

/* ── reduced motion (1440) ───────────────────────────────────────────────── */

if (only.has('reduced')) {
  const W = 1440;
  const label = `reduced ${W}`;
  const page = await open(W, { reduced: true });
  await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
  const ready = await page.waitForSelector(MAPBOX_READY, { timeout: 30000 }).then(() => true).catch(() => false);
  record(`${label}: the Mapbox globe loads`, ready);
  if (ready) {
    await idle(page);
    const before = await camFull(page);
    await recReset(page);
    await page.click(sel('fly-play'));
    await until(page, 's.index === 0', 3000);
    const s0 = await flyState(page);
    const fade = await page.$('.mr-fly__fade');
    record(`${label}: the overlay knows (data-reduced) and has its fade layer`, Boolean(s0?.reduced) && Boolean(fade));
    if (await until(page, 's.index === 1 && s.phase === "linger"', 15000)) {
      await wait(1200);
      await shot(page, `fly-reduced-${W}`);
    }
    const done = await page
      .waitForFunction(() => window.__fcState()?.phase === 'end', { timeout: RUN_MS, polling: 100 })
      .then(() => true)
      .catch(() => false);
    const rec = await recRead(page);
    analyse(label, rec, { expect: STOPS, engine: 'mapbox', cap: CAP[W], speed: 1, reduced: true });
    record(`${label}: the run completes`, done);
    await key(page, 'Escape');
    await exitChecks(page, `${label} exit`, before, { exact: false });
  }
  await countLoads(page, label, 1);
  noErrors(page, label);
  await page.close();
}

await browser.close();
if (seeded) for (const s of FLY_SPOTS) await api.deleteSpot(uuidFor(s.title)).catch(() => {});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Mapbox loads this run: ${mapLoads}. Screenshots: ${OUT}`);
for (const l of fpsLines) console.log(`fps  ${l}`);
if (failed.length) console.log(`\nFailed:\n${failed.map((r) => `  ✗ ${r.name}  ${r.detail}`).join('\n')}`);
process.exit(failed.length ? 1 : 0);
