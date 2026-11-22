#!/usr/bin/env node
/* building-view-check: a built whole place on its page (/memories/b/:id), in headless Edge (no Mapbox loads).

     node tools/memory-rooms/dev/seed-building.mjs --base http://127.0.0.1:8794   (once)
     node tools/memory-rooms/building-view-check.mjs [--base http://127.0.0.1:8794] [--dark] [--building <id>]
                                                    (--building: any built place, e.g. one seeded by dev/seed-place.mjs)

   At 1440 and 390 (touch):
   - the 3D building loads above the checklist (ready), from its level GLBs + exterior;
   - Outside: every level closed, the roof on; Inside: the roof lifted off; Levels: the levels pulled apart and
     the roof above them; Plan: EVERY level side by side where building/planLayout.js puts it (a row at 1440, a
     column at 390), each floor down on the table and clipped at its 1.2 m with its section cap, one label per
     level, the exterior hidden; the picture changes between stages;
   - Plan taps map back to the right level: an uncaptured room upstairs says its own name; (the synthetic house)
     tapping the living room flies in and opens its spot;
   - Inside's level slider (2+ levels): starts on the top level; ArrowDown opens the one below (the level above
     lifts away and fades out, the open one is cut away); a drag scrubs (a level part-way lifted); End;
   - Furnished (when the levels have their empty bake): off hides every furniture mesh (off layer 0) and puts
     the structure on the empty atlases, loading each level's empty set ONCE; on puts it all back at once; the
     state survives a stage change; without an empty bake there's no toggle;
   - Spin: on turns the camera round the target at a constant elevation; a drag stops it;
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
const BID = args.includes('--building') ? args[args.indexOf('--building') + 1] : '00000000-0000-4000-8000-00000000b001';
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
const SYNTH = BID === '00000000-0000-4000-8000-00000000b001';
const spotsOf = (await (await fetch(`${BASE}/api/memories/spots`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()).data.filter((x) => x.buildingId === BID);
const { levelPlanLayout } = await import('../../src/memory-rooms/building/planLayout.js');
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
      levels: v.rooms
        .filter((r) => r.id.startsWith('level-'))
        .map((r) => ({ id: r.id, visible: r.holder.visible, x: +r.holder.position.x.toFixed(3), y: +r.holder.position.y.toFixed(3), z: +r.holder.position.z.toFixed(3), cut: r.cutawayMode, alpha: r.alpha ?? 1 })),
      labels: (v.labels || []).map((l) => l.el.textContent),
      aspect: v.width / v.height,
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

const until = async (fn, timeout = 5000, every = 100) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) return null;
    await sleep(every);
  }
};
const viewerOf = (page) => page.$(`${sel('building')} ${sel('viewer')}`);

async function insideSlider(page, width, L) {
  if (plan.levels.length < 2) return;
  await press(page, width, sel('building-inside'));
  await sleep(1300);
  const slider = await page.$(`${sel('level-slider')} [role="slider"]`);
  const n = plan.levels.length - 1;
  const now = () => slider.evaluate((e) => Number(e.getAttribute('aria-valuenow')));
  record(`${L}: Inside: a level slider, on the top level`, Boolean(slider) && (await now()) === n);
  if (!slider) return;
  const order = [...plan.levels].sort((p, q) => p.elevation - q.elevation).map((l) => `level-${l.id}`);
  await slider.focus();
  await page.keyboard.press('ArrowDown');
  await sleep(1300);
  const st = await viewerState(page);
  const top = st.levels.find((l) => l.id === order[n]);
  const open = st.levels.find((l) => l.id === order[n - 1]);
  record(
    `${L}: Inside: ArrowDown opens the level below (the one above lifted away, faded out)`,
    (await now()) === n - 1 && top.y > 3 && top.alpha < 0.02 && !top.visible && open.cut === 'auto' && open.alpha === 1,
    JSON.stringify([top, open]),
  );
  await page.screenshot({ path: path.join(OUT, `inside-${order[n - 1]}-${width}-${SCHEME}.png`) });
  // a drag scrubs: half-way up from the open level, the upper level part-way lifted
  const box = await slider.boundingBox();
  const at = (t) => [box.x + box.width / 2, box.y + box.height * (1 - t)];
  if (width < 600) {
    await page.touchscreen.touchStart(...at((n - 1) / n));
    await page.touchscreen.touchMove(...at((n - 0.5) / n));
  } else {
    await page.mouse.move(...at((n - 1) / n));
    await page.mouse.down();
    await page.mouse.move(...at((n - 0.5) / n), { steps: 6 });
  }
  await sleep(150);
  const scrub = await viewerState(page);
  const part = scrub.levels.find((l) => l.id === order[n]);
  record(`${L}: Inside: dragging the slider scrubs (the level above part-way lifted)`, part.alpha > 0.05 && part.alpha < 0.95, `alpha ${part.alpha.toFixed(2)}, y ${part.y}`);
  if (width < 600) await page.touchscreen.touchEnd();
  else await page.mouse.up();
  await sleep(1200);
  await slider.focus();
  await page.keyboard.press('End');
  await sleep(1200);
  record(`${L}: Inside: End goes back to the top level`, (await now()) === n);
}

async function furnished(page, width, L) {
  const btn = await page.$(sel('furnished'));
  const hasEmpty = await (await viewerOf(page)).evaluate((el) => el.__viewer.rooms.some((r) => r.emptyUrl));
  if (!hasEmpty) {
    record(`${L}: Furnished: no toggle without an empty bake`, !btn);
    return;
  }
  record(`${L}: Furnished: the toggle is there`, Boolean(btn));
  if (!btn) return;
  await press(page, width, sel('building-plan'));
  await sleep(1400);
  await page.screenshot({ path: path.join(OUT, `plan-furnished-${width}-${SCHEME}.png`) });
  const probe = async () =>
    (await viewerOf(page)).evaluate((el) => {
      const v = el.__viewer;
      let furn = 0;
      let off = 0;
      let swapped = 0;
      let atlas = 0;
      for (const r of v.rooms) {
        for (const o of r.furnishing?.furniture || []) {
          furn++;
          if (!o.layers.isEnabled(0)) off++;
        }
        const empty = new Set(r.furnishing?.emptyMaps?.values() || []);
        r.root.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (!/^baked_atlas[0-9]+$/.test(m.name || '')) continue;
            atlas++;
            if (empty.has(m.map)) swapped++;
          }
        });
      }
      return { furnished: v.furnished, loads: v.emptyLoads, furn, off, swapped, atlas, loading: Boolean(el.dataset.furnishedLoading) };
    });
  const click = () => (width < 600 ? btn.tap() : btn.click());
  await click();
  const off = await until(async () => {
    const p = await probe();
    return !p.furnished && !p.loading && p.off === p.furn && p.swapped > 0 ? p : null;
  }, 20000);
  const levelsWithEmpty = await (await viewerOf(page)).evaluate((el) => el.__viewer.rooms.filter((r) => r.emptyUrl).length);
  record(`${L}: Furnished off: every furniture mesh hidden, the structure on the empty atlases`, Boolean(off), JSON.stringify(off || (await probe())));
  record(`${L}: Furnished off: each level's empty set loaded once`, Boolean(off) && off.loads === levelsWithEmpty, `${off?.loads} loads, ${levelsWithEmpty} levels`);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `plan-empty-${width}-${SCHEME}.png`) });
  await press(page, width, sel('building-inside'));
  await sleep(1300);
  const kept = await probe();
  record(`${L}: Furnished: the state survives a stage change`, !kept.furnished && kept.off === kept.furn, JSON.stringify(kept));
  await page.screenshot({ path: path.join(OUT, `inside-empty-${width}-${SCHEME}.png`) });
  await click();
  await sleep(150);
  const on = await probe();
  record(`${L}: Furnished on: back at once (no load, nothing hidden, the bake's own atlases)`, on.furnished && on.off === 0 && on.swapped === 0 && on.loads === off?.loads, JSON.stringify(on));
  await click();
  await sleep(200);
  const again = await probe();
  record(`${L}: Furnished off again: no second load`, !again.furnished && again.loads === off?.loads && again.off === again.furn, JSON.stringify(again));
  await click();
  await sleep(200);
}

async function spin(page, width, L) {
  await press(page, width, sel('building-outside'));
  await sleep(1300);
  const cam = async () =>
    (await viewerOf(page)).evaluate((el) => {
      const v = el.__viewer;
      const o = v.camera.position.clone().sub(v.controls.target);
      return { az: Math.atan2(o.x, o.z), el: Math.atan2(o.y, Math.hypot(o.x, o.z)), r: o.length(), on: el.dataset.spin };
    });
  const a = await cam();
  await press(page, width, sel('spin'));
  await sleep(2600);
  const b = await cam();
  const dAz = Math.abs(Math.atan2(Math.sin(b.az - a.az), Math.cos(b.az - a.az)));
  record(`${L}: Spin: the camera turns round the target, at the same elevation`, b.on === 'on' && dAz > 0.02 && Math.abs(b.el - a.el) < 0.005 && Math.abs(b.r - a.r) < 0.01, `dAz ${dAz.toFixed(3)} dEl ${(b.el - a.el).toFixed(4)}`);
  // a drag stops it
  const box = await (await page.$(`${sel('building')} canvas`)).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (width < 600) {
    await page.touchscreen.touchStart(cx, cy);
    await page.touchscreen.touchMove(cx + 40, cy);
    await page.touchscreen.touchEnd();
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy, { steps: 4 });
    await page.mouse.up();
  }
  await sleep(300);
  const c = await cam();
  const pressed = await page.$eval(sel('spin'), (e) => e.getAttribute('aria-pressed'));
  record(`${L}: Spin: a drag stops it (and the toggle says so)`, c.on === 'off' && pressed === 'false', `${c.on} ${pressed}`);
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
    const lay = levelPlanLayout(plan, pl.aspect, { ids: pl.levels.map((l) => l.id.slice(6)) });
    const placed = lay.levels.every((ll) => {
      const got = pl.levels.find((l) => l.id === `level-${ll.id}`);
      return got && got.visible && Math.abs(got.x - ll.offset[0]) < 1e-3 && Math.abs(got.z - ll.offset[1]) < 1e-3 && Math.abs(got.y + ll.elevation) < 1e-3;
    });
    record(
      `${L}: Plan: every level side by side (${lay.direction}), each cut with its section cap, labelled, the exterior hidden`,
      pl && placed && pl.cuts.length === pl.levels.length && pl.cap && pl.exterior === false && (pl.levels.length < 2 || pl.labels.length === pl.levels.length),
      `${lay.direction} ${JSON.stringify(pl.levels.map((l) => [l.id, l.x, l.y, l.z]))} labels ${pl.labels.join('/')}`,
    );
    if (plan.levels.length > 1) record(`${L}: Plan: a row on a wide stage, a column on a phone`, lay.direction === (width < 600 ? 'column' : 'row'), lay.direction);
    const distinct = new Set(Object.values(shots)).size;
    record(`${L}: each stage looks different`, distinct === 4, `${distinct} distinct pictures`);
    // a tap on an upper level maps back to it: an uncaptured room upstairs says its own name
    if (plan.levels.length > 1) {
      const upper = lay.levels[lay.levels.length - 1];
      const room = plan.rooms.find((r) => r.level === upper.id && !spotsOf.some((x) => x.roomId === r.id) && r.name);
      if (room) {
        const [cx, cz] = mid(room.id);
        const [ux, uy] = await screenOf(page, [cx + upper.offset[0], cz + upper.offset[1]], 0.05);
        if (width < 600) await page.touchscreen.tap(ux, uy);
        else await page.mouse.click(ux, uy);
        await sleep(500);
        const h = await page.$eval('.mr-building__hint', (e) => e.textContent);
        record(`${L}: Plan: a tap upstairs maps to that level's room`, h.includes(room.name), h);
      }
    }
    // the Inside level slider, Furnished and Spin (before the taps below leave the page)
    await insideSlider(page, width, L);
    await furnished(page, width, L);
    await spin(page, width, L);
    if (!SYNTH) {
      if (width < 600) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        record('390: no sideways scroll on the place page', overflow <= 0, `${overflow}px`);
      }
      record(`${L}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
      await page.browserContext().close();
      continue;
    }
    await press(page, width, sel('building-plan'));
    await sleep(1400);
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
