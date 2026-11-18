#!/usr/bin/env node
/* model-soak: frame rate and GPU counts while panning the /memories map with live 3D models
   (src/memory-rooms/map/mapbox/models3d.js). Real input: mouse drags at 1440, touch drags at 390
   (touch emulation, DPR 2). 12 copies of the rendered spots are injected around the first one with
   a map model (the spot list is intercepted: nothing is written to the Worker), so up to the cap
   (6 / 3) are live and they come and go as the map pans.

     npm run build && npx wrangler dev --port 8788 && node tools/memory-rooms/seed-dev.mjs --examples-only
     node tools/memory-rooms/dev/model-soak.mjs [--seconds 8] [--widths 1440,390] [--throttle 4]

   Each width runs the same drags twice, with the 3D layer on and off (the markers alone), and
   reports fps, the p95 frame time, the 3D layer's own draw time per frame, and textures /
   geometries / live models sampled every 250 ms. The phone run's CPU is throttled (--throttle,
   default 4×) as a rough stand-in for a mid-range phone; the GPU is still this PC's.
   Edge on the real GPU (ANGLE d3d11), like page-check. 2 Mapbox loads per width. */

import puppeteer from 'puppeteer-core';
import { client, config } from '../lib/api.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const seconds = Number(opt('--seconds', '8'));
const widths = opt('--widths', '1440,390').split(',').map(Number);
const throttle = Number(opt('--throttle', '4'));
const cfg = config();
cfg.base = base;
const api = client(cfg);

const real = await api.listSpots();
const withModel = real.filter((s) => s.status === 'rendered' && s.media.some((m) => m.type === 'model'));
const anchor = withModel.find((s) => s.media.some((m) => m.type === 'model' && m.name === 'map')) || withModel[0];
if (!anchor) {
  console.error('No rendered spot with a model: run `node tools/memory-rooms/seed-dev.mjs --examples-only` first.');
  process.exit(1);
}
const fakes = Array.from({ length: 12 }, (_, i) => {
  const src = withModel[i % withModel.length];
  const a = i * 2.39996;
  const r = 0.0009 + 0.00035 * i;
  return {
    ...src,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    title: `${src.title} (copy ${i + 1})`,
    lat: anchor.lat + r * Math.sin(a),
    lng: anchor.lng + (r * Math.cos(a)) / Math.cos((anchor.lat * Math.PI) / 180),
  };
});

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function run(width, threeD) {
  const page = await browser.newPage();
  const mobile = width < 600;
  await page.emulate({
    viewport: { width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : await browser.userAgent(),
  });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, cfg.token);
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/memories/spots' && r.method() === 'GET') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [...real, ...fakes] }) });
    else r.continue();
  });
  await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
  if (mobile && throttle > 1) await page.emulateCPUThrottling(throttle);
  await page.waitForSelector('[data-mr="map"][data-engine="mapbox"][data-ready]', { timeout: 30000 });
  await page.evaluate(
    (c) =>
      new Promise((done) => {
        const map = document.querySelector('[data-mr="map"]').__mrMap;
        map.jumpTo({ center: c, zoom: 15.4 });
        map.once('idle', done);
        setTimeout(done, 15000);
      }),
    [anchor.lng, anchor.lat],
  );
  await page.waitForFunction(() => window.__mrModels?.().live > 0 && window.__mrModels().loading === 0, { timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500)); // the tilt eases in
  if (!threeD) await page.evaluate(() => document.querySelector('[data-mr="map"]').__mrMap.setLayoutProperty('mr-models', 'visibility', 'none'));

  // in the page: frame intervals from rAF, GPU counts every 250 ms
  await page.evaluate(() => {
    const s = (window.__soak = { frames: [], samples: [], on: true });
    let last = performance.now();
    const tick = (t) => {
      s.frames.push(t - last);
      last = t;
      if (s.on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    s.timer = setInterval(() => {
      const m = window.__mrModels?.();
      if (m) s.samples.push([m.live, m.textures, m.geometries]);
    }, 250);
  });

  // drags: right, left, up, down, diagonal…, 70% of the map each, ~0.9 s each
  const box = await page.$eval('[data-mr="map"]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const moves = [
    [0.35, 0],
    [-0.35, 0],
    [0, 0.3],
    [0, -0.3],
    [0.3, 0.25],
    [-0.3, -0.25],
  ];
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const [fx, fy] = moves[i++ % moves.length];
    const from = { x: cx - (fx * box.w) / 2, y: cy - (fy * box.h) / 2 };
    const to = { x: cx + (fx * box.w) / 2, y: cy + (fy * box.h) / 2 };
    const steps = 54;
    if (mobile) {
      await page.touchscreen.touchStart(from.x, from.y);
      for (let k = 1; k <= steps; k++) {
        await page.touchscreen.touchMove(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
        await new Promise((r) => setTimeout(r, 16));
      }
      await page.touchscreen.touchEnd();
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let k = 1; k <= steps; k++) {
        await page.mouse.move(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
        await new Promise((r) => setTimeout(r, 16));
      }
      await page.mouse.up();
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  const res = await page.evaluate(() => {
    const s = window.__soak;
    s.on = false;
    clearInterval(s.timer);
    return { frames: s.frames.slice(5), samples: s.samples, loads: window.__mrMapLoads, stats: window.__mrModels?.() || null };
  });
  await page.close();
  const total = res.frames.reduce((a, b) => a + b, 0);
  const sorted = [...res.frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const col = (k) => res.samples.map((x) => x[k]);
  const range = (a) => (a.length ? `${Math.min(...a)}–${Math.max(...a)}` : 'n/a');
  return { fps: (res.frames.length / total) * 1000, p95, live: range(col(0)), textures: range(col(1)), geometries: range(col(2)), loads: res.loads, stats: res.stats, problems };
}

console.log(`model-soak: ${seconds} s of drags per run, 12 injected copies around "${anchor.title}"\n`);
for (const width of widths) {
  for (const threeD of [true, false]) {
    const r = await run(width, threeD);
    console.log(
      `${String(width).padStart(4)} ${width < 600 ? `touch, CPU ÷${throttle}` : 'mouse'} ${threeD ? '3D on ' : '3D off'}  ${r.fps.toFixed(1)} fps, p95 ${r.p95.toFixed(1)} ms` +
        (threeD && r.stats?.frames ? `, 3D layer ${(r.stats.drawMs / r.stats.frames).toFixed(2)} ms/frame (max ${r.stats.drawMaxMs.toFixed(1)})` : '') +
        `  | live ${r.live}, textures ${r.textures}, geometries ${r.geometries}` +
        `  | ${r.stats?.loaded ?? 0} loaded / ${r.stats?.disposed ?? 0} disposed, ${r.loads} map load(s)${r.problems.length ? `  ! ${r.problems.slice(0, 2).join(' | ')}` : ''}`,
    );
  }
}
await browser.close();
