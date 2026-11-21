#!/usr/bin/env node
/* v2-view-check: a scene.json v2 room (any polygon, a sloped ceiling) in the real pages, in headless
   Edge (no Mapbox loads). Pairs with shell-view-check.mjs (the same logic in Node, no browser).

     node tools/memory-rooms/v2-view-check.mjs [--base http://127.0.0.1:8794] [--dark] [--spot <id>]

   Needs a LOCAL Worker with a rendered v2 interior (seed one: node tools/memory-rooms/dev/seed-real-rooms.mjs
   --base http://127.0.0.1:8794 --dirs _v2-shed, after building + baking memory-rooms-work/_v2-shed).
   At 1440 and 390 (touch):
   - the spot page draws it (ready, no errors), and the dollhouse view differs from the plan cut;
   - Room / Plan: Plan sets data-plan="on" and swings to a near top-down view, Room returns; a photo
     viewpoint turns the plan off;
   - a v1 interior shows the same toggle;
   - the walk page: ready, the walk grid keeps you inside the outline (a corner of the bounding box
     outside an angled wall is not walkable, the middle is), every wall__<id> has a normal.
   Screens: memory-rooms-work/_v2-view-check/. Exit 1 on any failure. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveShell } from '../../src/memory-rooms/scene/shell.js';
import { pointInPolygon } from '../../src/memory-rooms/scene/polygon.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'memory-rooms-work', '_v2-view-check');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const BASE = (args.includes('--base') ? args[args.indexOf('--base') + 1] : process.env.MEMORIES_API || 'http://127.0.0.1:8794').replace(/\/+$/, '');
const SCHEME = args.includes('--dark') ? 'dark' : 'light';
const TOKEN = process.env.MEMORIES_PASSWORD || 'trip-local';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (n) => `[data-mr="${n}"]`;

const spots = (await (await fetch(`${BASE}/api/memories/spots`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()).data || [];
const hasModel = (s) => s.status === 'rendered' && (s.media || []).some((m) => m.type === 'model' && m.name === 'room');
const wantId = args.includes('--spot') ? args[args.indexOf('--spot') + 1] : null;
const v2 = spots.find((s) => (wantId ? s.id === wantId : s.scene?.version === 2 && s.scene?.kind === 'interior' && s.scene?.shell?.outline && hasModel(s)));
const v1 = spots.find((s) => s.scene?.kind === 'interior' && (s.scene?.version ?? 1) < 2 && hasModel(s));
if (!v2) {
  console.error(`no rendered v2 polygon interior at ${BASE} (seed one: see the header)`);
  process.exit(2);
}
const sh = resolveShell(v2.scene);

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
    localStorage.setItem('mr:map', 'atlas'); // never a billed Mapbox load
  }, TOKEN);
  return page;
}

const shot = (page, name, width) => page.screenshot({ path: path.join(OUT, `${name}-${width}-${SCHEME}.png`) });
const ready = (page) => page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 90000 });
/** Mean absolute difference (0..255) between two PNG screenshots of the stage. */
async function differs(page, a, b) {
  return page.evaluate(
    async (x, y) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 120;
      const g = c.getContext('2d');
      g.drawImage(ia, 0, 0, 160, 120);
      const da = g.getImageData(0, 0, 160, 120).data;
      g.drawImage(ib, 0, 0, 160, 120);
      const db = g.getImageData(0, 0, 160, 120).data;
      let s = 0;
      for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      return s / (da.length * 0.75);
    },
    `data:image/png;base64,${a}`,
    `data:image/png;base64,${b}`,
  );
}

async function press(page, width, s) {
  const el = await page.waitForSelector(s, { visible: true, timeout: 10000 });
  if (width < 600) await el.tap();
  else await el.click();
}

try {
  for (const width of [1440, 390]) {
    const L = `${width}`;
    const page = await open(width);
    await page.goto(`${BASE}/memories/${v2.id}`, { waitUntil: 'networkidle2' });
    await ready(page);
    await sleep(600);
    const stage = await page.$(sel('viewer'));
    const before = await stage.screenshot({ encoding: 'base64' });
    await shot(page, 'v2-room', width);
    if (width < 600) {
      // the toggle lives in the open sheet
      await sleep(400);
      await press(page, width, sel('sheet-handle'));
      await sleep(500);
    }
    await press(page, width, sel('plan-on'));
    await page.waitForSelector(`${sel('viewer')}[data-plan="on"]`, { timeout: 5000 }).catch(() => null);
    await sleep(1200);
    const plan = await page.$eval(sel('viewer'), (e) => e.dataset.plan);
    const pressed = await page.$eval(sel('plan-on'), (e) => e.getAttribute('aria-pressed'));
    if (width < 600) {
      await press(page, width, sel('sheet-handle'));
      await sleep(600);
    }
    const after = await stage.screenshot({ encoding: 'base64' });
    await shot(page, 'v2-plan', width);
    const d = await differs(page, before, after);
    record(`${L}: Plan cuts the room (data-plan on, the picture changes)`, plan === 'on' && pressed === 'true' && d > 4, `plan ${plan}, pressed ${pressed}, change ${d.toFixed(1)}`);
    if (width < 600) {
      await press(page, width, sel('sheet-handle'));
      await sleep(500);
    }
    await press(page, width, sel('plan-off'));
    await sleep(900);
    const back = await page.$eval(sel('viewer'), (e) => e.dataset.plan);
    record(`${L}: Room returns from the plan`, back === 'off', back);
    // a photo viewpoint turns the plan off
    await press(page, width, sel('plan-on'));
    await sleep(300);
    const thumb = await page.$(`${sel('viewpoint')}`);
    if (thumb) {
      if (width < 600) {
        await press(page, width, sel('sheet-handle'));
        await sleep(500);
        await thumb.tap();
      } else await thumb.click();
      await sleep(1500);
      const off = await page.$eval(sel('viewer'), (e) => e.dataset.plan);
      record(`${L}: flying to a photo turns the plan off`, off === 'off', off);
    }
    record(`${L}: v2 spot page, no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
    await page.browserContext().close();
  }

  // a v1 interior has the same toggle
  if (v1) {
    const page = await open(1440);
    await page.goto(`${BASE}/memories/${v1.id}`, { waitUntil: 'networkidle2' });
    await ready(page);
    await press(page, 1440, sel('plan-on'));
    await sleep(1200);
    const plan = await page.$eval(sel('viewer'), (e) => e.dataset.plan);
    await shot(page, 'v1-plan', 1440);
    record(`1440: a v1 interior has the plan cut too (${v1.title})`, plan === 'on', plan);
    record('1440: v1 spot page, no console/page errors', page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
    await page.browserContext().close();
  }

  // the walk: inside the outline only
  {
    const page = await open(1440);
    await page.goto(`${BASE}/memories/${v2.id}/walk`, { waitUntil: 'networkidle2' });
    await page.waitForSelector(`${sel('walk')}[data-state="ready"]`, { timeout: 90000 });
    await sleep(500);
    const probe = await page.$eval(sel('walk'), (el, pts) => {
      const g = el.__walk?.grid;
      const room = el.__walk?.room;
      // where the walker stands now (it spawned on a walkable cell)
      const here = [Number(el.dataset.x), Number(el.dataset.z)];
      return {
        walk: g ? [...pts, here].map(([x, z]) => g.walkable(x, z)) : null,
        here,
        normals: room?.normals ? Object.keys(room.normals).sort() : null,
      };
    }, [
      [sh.box.min[0] + 0.12, sh.box.min[1] + 0.12], // a corner of the box: outside an angled wall
    ]);
    const cornerInside = pointInPolygon([sh.box.min[0] + 0.12, sh.box.min[1] + 0.12], sh.outline);
    record('walk: the corner outside the angled wall is not walkable', probe.walk && probe.walk[0] === false && !cornerInside, JSON.stringify(probe.walk));
    record('walk: the room is walkable inside (where the walker stands)', probe.walk && probe.walk[1] === true && pointInPolygon(probe.here, sh.outline), `${JSON.stringify(probe.walk)} at ${probe.here}`);
    const want = sh.walls.map((w) => w.id).sort();
    record('walk: every wall has a normal (dollhouse by normal)', JSON.stringify(probe.normals) === JSON.stringify(want), `${probe.normals} vs ${want}`);
    await shot(page, 'v2-walk', 1440);
    record('walk: no console/page errors', page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
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
