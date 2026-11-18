#!/usr/bin/env node
/* ============================================================================
   PROJECTOR LIFE — sim-check (Node, no browser)
   ----------------------------------------------------------------------------
   Runs the life host (src/components/portal/modules/projector-life/life/) on
   the real room patches (room/roomModel.js, measured masks) and checks:

     matrix      every system × preset at apex 2.7 / 3.3 / 4.2 with creatures:
                 no NaN/Infinity anywhere, populations bounded, ms per tick
     budget      default scene ms per 60 Hz frame (target ≲ 6 ms) and a heavy
                 scene that must slow down rather than stall
     seams       Physarum, Particle Life and creatures actually cross seams
                 (wall→roof at the eave, wall→wall, wall→floor)
     drift       Gray-Scott drift moves the pattern DOWN the walls
     geotaxis    Physarum 'down' sits lower on the walls than 'up'
     falls       low grip: creatures fall from the roof, never from the floor
     pitch       steeper roof changes ceiling behaviour (falls/min, PL peel)
     histograms  per-habitat trait histograms present and consistent
     masks       active masks and off-polygon cells are pure black
     raw         frame() gives a 320×180 flat rectangle that updates
     churn       patches appearing / disappearing (loft off/on) never throw
     evolution   (skipped with --quick) habitats drift apart over 4 sim-min

   Usage:  node tools/projector-life/sim-check.mjs [--quick]
   Prints a PASS/FAIL table; exits 1 on any FAIL. WARN rows never fail.
   The room's real landing() needs three.js + the GLB, so this uses a small
   stand-in heightfield (loft deck at 1.10 m, else floor).
   ========================================================================== */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/projector-life');
const imp = (p) => import(pathToFileURL(path.join(MOD, p)).href);

const { buildPatches } = await imp('room/roomModel.js');
const { createLifeHost, TICK, BUDGET } = await imp('life/index.js');
const { HIST_EDGES } = await imp('life/creatures.js');
const { GS_PRESETS, GS_TUNE } = await imp('life/systems/grayScott.js');
const { PHYS_PRESETS } = await imp('life/systems/physarum.js');
const { PL_PRESETS } = await imp('life/systems/particleLife.js');
const { LENIA_PRESETS } = await imp('life/systems/lenia.js');
const { defaults } = await imp('params.js');

const QUICK = process.argv.includes('--quick');
const APEXES = [2.7, 3.3, 4.2];
const rows = [];
const row = (status, name, detail) => {
  rows.push({ status, name, detail });
  const tag = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
  console.log(`${tag.padEnd(5)} ${name.padEnd(34)} ${detail}`);
};
const check = (ok, name, detail) => row(ok ? 'PASS' : 'FAIL', name, detail);
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

// ── helpers ───────────────────────────────────────────────────────────────────
function landingFor(patches) {
  const loft = patches.find((p) => p.id === 'loft');
  return (x, z, fromY) => {
    if (loft) {
      const lx = x - loft.origin[0], ly = loft.origin[2] - z;
      let inside = false;
      const poly = loft.polygon;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > ly !== yj > ly && lx < ((xj - xi) * (ly - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside && fromY > loft.origin[1]) return { y: loft.origin[1], patchId: 'loft', local: [lx, ly], surface: 'loft' };
    }
    return { y: 0, patchId: 'floor', local: [x, 4.36 - z], surface: 'floor' };
  };
}

function makeHost(apex, over = {}, seed = 7, patchOpts = {}) {
  const patches = buildPatches({ apex, ...patchOpts });
  const values = { ...defaults(), ...over };
  const host = createLifeHost({ patches, landing: landingFor(patches), values, seed });
  return { host, patches, values };
}

function allSystems(id) {
  return { 'life.sys.floor': id, 'life.sys.wall': id, 'life.sys.ceiling': id };
}

const finite = (arr, n = arr.length) => {
  for (let i = 0; i < n; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
};

/** Every float the host keeps: fields, particles, creatures, airborne bodies. */
function allFinite(host) {
  const { sys, creatures } = host._debug();
  const gs = sys.grayscott.field();
  if (gs.v && (!finite(gs.v) || !finite(gs.u))) return 'grayscott u/v';
  const ph = sys.physarum.field();
  if (ph.trail && !finite(ph.trail)) return 'physarum trail';
  const le = sys.lenia.field();
  if (le.A && !finite(le.A)) return 'lenia A';
  for (const [, p] of host.surfaces()) if (!p.data || p.data.length !== p.w * p.h * 4) return 'surface size';
  for (const c of creatures.list()) {
    for (const k of ['x', 'y', 'h', 'energy', 'wx', 'wy', 'wz', 'rx', 'ry', 'rd', 'vx', 'vy', 'vd']) if (!Number.isFinite(c[k])) return `creature.${k}`;
  }
  for (const b of host.airborne()) if (![b.x, b.y, b.z, b.r].every(Number.isFinite)) return 'airborne';
  const s = host.stats();
  if (!Number.isFinite(s.simMs)) return 'simMs';
  return null;
}

function ticks(host, n) {
  for (let i = 0; i < n; i++) host.step(TICK);
}

// ── 1. matrix: systems × presets × apex ──────────────────────────────────────
{
  const PRESETS = {
    grayscott: ['life.gsPreset', Object.keys(GS_PRESETS)],
    physarum: ['life.physPreset', Object.keys(PHYS_PRESETS)],
    particlelife: ['life.plPreset', Object.keys(PL_PRESETS)],
    lenia: ['life.leniaPreset', Object.keys(LENIA_PRESETS)],
  };
  let worst = 0, runs = 0, bad = [];
  const perSys = {};
  for (const apex of APEXES) {
    for (const [id, [key, names]] of Object.entries(PRESETS)) {
      for (const name of names) {
        const { host, values } = makeHost(apex, { ...allSystems(id), [key]: name, 'life.speed': 1 });
        const t0 = performance.now();
        ticks(host, 150);
        const ms = (performance.now() - t0) / 150;
        runs++;
        perSys[id] = Math.max(perSys[id] || 0, ms);
        worst = Math.max(worst, ms);
        const nf = allFinite(host);
        const s = host.stats();
        const crMax = (values['cr.floor'] + values['cr.wall'] + values['cr.ceiling']) * 1.5 + 12;
        const agents = s.systems.physarum.agents, parts = s.systems.particlelife.particles;
        if (nf) bad.push(`${id}/${name}@${apex}: non-finite ${nf}`);
        if (s.creatures.alive > crMax) bad.push(`${id}/${name}@${apex}: ${s.creatures.alive} creatures > ${crMax}`);
        if (agents > BUDGET.physAgents || parts > BUDGET.plParticles) bad.push(`${id}/${name}@${apex}: agents ${agents} / particles ${parts} over budget`);
        host.dispose();
      }
    }
  }
  check(bad.length === 0, 'matrix: finite + bounded', bad.length ? bad.slice(0, 3).join('; ') : `${runs} runs (4 systems × presets × 3 apexes), all finite, populations within budget`);
  check(worst < 12, 'matrix: ms per tick (all-one-system)', Object.entries(perSys).map(([k, v]) => `${k} ${fmt(v)}`).join(', ') + ' ms (worst tick, must be < 12)');
}

// ── 2. budget: default scene and a heavy one ─────────────────────────────────
{
  const { host } = makeHost(3.3, {}, 3);
  for (let i = 0; i < 120; i++) host.step(1 / 60); // warm up (JIT)
  let tot = 0, max = 0;
  const N = 1800; // 30 s at 60 Hz
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    host.step(1 / 60);
    const ms = performance.now() - t0;
    tot += ms;
    if (ms > max) max = ms;
  }
  const s = host.stats();
  check(tot / N <= 6, 'budget: default scene', `${fmt(tot / N)} ms/frame avg at 60 Hz (≤ 6), ${fmt(s.tickMs)} ms per tick, worst frame ${fmt(max, 1)} ms, ${fmt(s.tickRate, 1)} ticks/s`);
  host.dispose();

  const heavy = makeHost(3.3, { ...allSystems('physarum'), 'life.substeps': 4, 'life.speed': 3, 'cr.floor': 60, 'cr.wall': 60, 'cr.ceiling': 60 }, 3).host;
  for (let i = 0; i < 60; i++) heavy.step(1 / 60);
  let htot = 0, hmax = 0;
  for (let i = 0; i < 600; i++) {
    const t0 = performance.now();
    heavy.step(1 / 60);
    const ms = performance.now() - t0;
    htot += ms;
    if (ms > hmax) hmax = ms;
  }
  const hs = heavy.stats();
  check(hmax < 40, 'budget: heavy scene degrades', `physarum everywhere ×4 substeps ×3 speed, 180 creatures: ${fmt(htot / 600)} ms/frame avg, worst ${fmt(hmax, 1)} ms (no stall < 40), ticks/s ${fmt(hs.tickRate, 1)} of 90 asked`);
  heavy.dispose();

  const lenia = makeHost(3.3, allSystems('lenia'), 3).host;
  for (let i = 0; i < 60; i++) lenia.step(1 / 60);
  let ltot = 0;
  for (let i = 0; i < 600; i++) {
    const t0 = performance.now();
    lenia.step(1 / 60);
    ltot += performance.now() - t0;
  }
  const ls = lenia.stats();
  row(ltot / 600 <= 6 ? 'PASS' : 'WARN', 'budget: Lenia everywhere', `${fmt(ltot / 600)} ms/frame avg, Lenia steps every ${ls.systems.lenia.every} tick(s), ${ls.systems.lenia.taps} taps, R ${ls.systems.lenia.R}`);
  lenia.dispose();
}

// ── 3. seams are crossed ─────────────────────────────────────────────────────
{
  const { host } = makeHost(3.3, { ...allSystems('physarum'), 'life.geotaxis': 0.3 }, 5);
  ticks(host, 300);
  const ck = host.stats().systems.physarum.crossKinds;
  const need = ['wall>roof', 'roof>wall', 'wall>wall', 'wall>floor', 'floor>wall', 'roof>roof'];
  const missing = need.filter((k) => !ck[k]);
  check(!missing.length, 'seams: Physarum crosses', need.map((k) => `${k} ${ck[k] || 0}`).join(', '));
  host.dispose();

  const pl = makeHost(3.3, allSystems('particlelife'), 5).host;
  ticks(pl, 300);
  const pk = pl.stats().systems.particlelife.crossKinds;
  check((pk['roof>roof'] || 0) > 0 && (pk['wall>wall'] || 0) > 0 && ((pk['wall>floor'] || 0) + (pk['roof>wall'] || 0)) > 0, 'seams: Particle Life crosses', Object.entries(pk).map(([k, v]) => `${k} ${v}`).join(', '));
  pl.dispose();

  const cr = makeHost(3.3, { 'cr.floor': 30, 'cr.wall': 40, 'cr.ceiling': 30 }, 5).host;
  ticks(cr, 1800);
  const cs = cr.stats().creatures;
  check(cs.crossings > 0, 'seams: creatures cross', `${cs.crossings} crossings in 60 s: ${Object.entries(cs.crossKinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  cr.dispose();

  const off = makeHost(3.3, { ...allSystems('physarum'), 'life.seams': false }, 5).host;
  ticks(off, 150);
  check(off.stats().systems.physarum.crossings === 0, 'seams: off means off', `life.seams = false → ${off.stats().systems.physarum.crossings} crossings`);
  off.dispose();
}

// ── 4. Gray-Scott drift moves the pattern down the walls ─────────────────────
{
  /** Seed one blob mid-wall (rain off) and track the v-weighted centroid for 3 s. */
  function blobDrop(drift) {
    const rain = GS_TUNE.rain;
    GS_TUNE.rain = 0;
    const { host } = makeHost(3.3, { 'life.sys.wall': 'grayscott', 'life.sys.floor': 'off', 'life.sys.ceiling': 'off', 'life.gsPreset': 'coral', 'life.drift': drift, 'cr.on': false }, 9);
    host.clear();
    host.seed('wall-E', 0.9, 1.4);
    const { sys, D } = host._debug();
    const p = D.P[D.byId.get('wall-E')];
    const cy = () => {
      const { v } = sys.grayscott.field();
      let s0 = 0, sy = 0;
      for (const g of p.valid) {
        const j = ((g - p.off) / p.w) | 0;
        s0 += v[g];
        sy += v[g] * (j + 0.5);
      }
      return { y: sy / s0 / D.ppm, mass: s0 };
    };
    const y0 = cy().y;
    ticks(host, 90); // 180 Gray-Scott steps
    const y1 = cy();
    host.dispose();
    GS_TUNE.rain = rain;
    return { dy: y1.y - y0, mass: y1.mass };
  }
  const d1 = blobDrop(1), d0 = blobDrop(0);
  check(d1.dy < -0.2 && Math.abs(d0.dy) < 0.05 && d1.mass > 1, 'drift: GS runs down the walls', `a blob seeded mid-wall moved ${fmt(d1.dy)} m in 3 s with drift 1 (want < −0.2), ${fmt(d0.dy)} m with drift 0 (alive: v mass ${fmt(d1.mass, 0)})`);
  // and the default 'rain' keeps the walls alive under drift
  const { host } = makeHost(3.3, { 'cr.on': false }, 9);
  ticks(host, 1800);
  const mv = host.stats().systems.grayscott.meanV;
  check(mv > 0.03, 'drift: walls stay alive (rain)', `default scene after 60 s: wall mean v ${fmt(mv, 3)} (a drifting pattern with no source washes out to < 0.01)`);
  host.dispose();
}

// ── 5. Physarum geotaxis sign ────────────────────────────────────────────────
{
  const meanY = (sign) => {
    const { host } = makeHost(3.3, { 'life.sys.wall': 'physarum', 'life.sys.floor': 'off', 'life.sys.ceiling': 'off', 'life.geoSign': sign, 'life.geotaxis': 1, 'cr.on': false }, 4);
    ticks(host, 450);
    const { sys, D } = host._debug();
    let sy = 0, n = 0;
    for (const p of D.P) if (p.kind === 'wall') for (const [, y] of sys.physarum.agentsOn(p.idx)) {
      sy += y;
      n++;
    }
    host.dispose();
    return sy / n;
  };
  const down = meanY('down'), up = meanY('up');
  check(down < up - 0.2, 'geotaxis: sign works', `mean agent height on walls: 'down' ${fmt(down)} m, 'up' ${fmt(up)} m (wall 2.25 m)`);
}

// ── 6. low grip: falls from the roof, not from the floor ─────────────────────
{
  const run = (grip) => {
    const { host } = makeHost(3.3, { 'cr.grip': grip, 'cr.floor': 20, 'cr.wall': 0, 'cr.ceiling': 20, 'cr.selection': false, 'cr.mutation': 0 }, 6);
    ticks(host, 1800);
    const c = host.stats().creatures;
    host.dispose();
    return c;
  };
  const lo = run(0.35), hi = run(2);
  const loRoof = lo.fallsFrom.roof || 0, hiRoof = hi.fallsFrom.roof || 0;
  check(loRoof > 10 && !lo.fallsFrom.floor && loRoof > hiRoof, 'falls: low grip drops from roof', `grip 0.35: ${loRoof} falls from the roof, ${lo.fallsFrom.floor || 0} from the floor (loft edge ${lo.fallsFrom.loft || 0}); grip 2: ${hiRoof} from the roof — 60 s, 20 on roof, 20 on floor`);
}

// ── 7. pitch changes ceiling behaviour ───────────────────────────────────────
{
  const res = [];
  for (const apex of APEXES) {
    // a uniform population (every gene = 1, no mutation), so only the pitch differs
    const { host, values } = makeHost(apex, { 'cr.floor': 0, 'cr.wall': 0, 'cr.ceiling': 30, 'cr.selection': false, 'cr.mutation': 0 }, 12);
    for (const c of host._debug().creatures.list()) c.g = { feet: 0, grip: 1, mass: 1, swing: 0.6, flight: 1 };
    host.setParams(values, ['cr.grip']);
    ticks(host, 1800);
    const s = host.stats();
    const c = s.creatures;
    const roofMin = 30; // creature-minutes on the roof (population held at 30)
    res.push({ apex, falls: (c.fallsFrom.roof || 0) / roofMin, catches: c.catches / roofMin, eave: (c.crossKinds['roof>wall'] || 0) / roofMin, peel: s.systems.particlelife.detached });
    host.dispose();
  }
  const [a, , c] = res;
  const differs = Math.abs(a.falls - c.falls) / Math.max(a.falls, c.falls, 1e-9) > 0.2;
  check(differs && a.peel > c.peel, 'pitch: roof behaviour changes', res.map((r) => `apex ${r.apex}: ${fmt(r.falls)} falls, ${fmt(r.catches, 1)} catches, ${fmt(r.eave)} over-the-eave per creature-min, PL peel-offs ${r.peel}`).join(' | '));
}

// ── 8. histograms ────────────────────────────────────────────────────────────
{
  const { host } = makeHost(3.3, {}, 2);
  ticks(host, 300);
  const s = host.stats();
  const H = s.histograms;
  const keys = ['feet', 'grip', 'mass', 'swing', 'flight'];
  let ok = keys.every((k) => H[k] && Array.isArray(H[k].edges) && ['floor', 'wall', 'ceiling'].every((h) => H[k][h].length === H[k].edges.length - 1));
  const sums = ['floor', 'wall', 'ceiling'].map((h) => H.grip[h].reduce((a, b) => a + b, 0));
  ok = ok && sums[0] === s.populations.floor && sums[1] === s.populations.wall && sums[2] === s.populations.ceiling;
  ok = ok && JSON.stringify(Object.keys(HIST_EDGES)) === JSON.stringify(keys);
  check(ok, 'histograms: present', `keys ${keys.join('/')}, counts per habitat = populations (${sums.join('/')})`);
  host.dispose();
}

// ── 9. masks and off-polygon cells are black ─────────────────────────────────
{
  const { host } = makeHost(3.3, { ...allSystems('physarum') }, 2);
  ticks(host, 120);
  const { D } = host._debug();
  let lit = 0, checked = 0;
  for (const p of D.P) {
    const buf = host.surfaces().get(p.id);
    for (let k = 0; k < p.w * p.h; k++) {
      if (p.state[k] === 2) continue;
      checked++;
      if (buf.data[k * 4] || buf.data[k * 4 + 1] || buf.data[k * 4 + 2] || buf.data[k * 4 + 3] !== 255) lit++;
    }
  }
  const masks = D.patches.reduce((n, p) => n + (p.masks?.length || 0), 0);
  check(lit === 0 && masks > 0, 'masks: black', `${checked} masked/outside cells checked, ${lit} not pure black; ${masks} masks on the patches`);
  host.dispose();
}

// ── 10. raw frame ────────────────────────────────────────────────────────────
{
  const { host } = makeHost(3.3, {}, 2);
  const f0 = host.frame();
  const v0 = f0.version;
  for (let i = 0; i < 30; i++) {
    host.frame();
    host.step(1 / 30);
  }
  const f1 = host.frame();
  let lit = 0;
  for (let k = 0; k < f1.w * f1.h; k++) if (f1.data[k * 4] + f1.data[k * 4 + 1] + f1.data[k * 4 + 2] > 30) lit++;
  check(f1.w === 320 && f1.h === 180 && f1.data.length === 320 * 180 * 4 && f1.version > v0 && lit > 0, 'raw: frame() flat rectangle', `${f1.w}×${f1.h}, version ${v0} → ${f1.version}, ${fmt((100 * lit) / (f1.w * f1.h), 1)} % lit`);
  host.dispose();
}

// ── 11. churn: patches come and go, masks change ─────────────────────────────
{
  let err = null;
  try {
    for (const id of ['grayscott', 'physarum', 'particlelife', 'lenia']) {
      const { host, values } = makeHost(3.3, allSystems(id), 1);
      ticks(host, 20);
      for (const ps of [
        buildPatches({ apex: 3.3, loft: false }),
        buildPatches({ apex: 4.2 }),
        buildPatches({ apex: 2.7 }).map((p) => ({ ...p, masks: [] })),
        buildPatches({ apex: 3.3 }).filter((p) => p.kind === 'wall'),
        buildPatches({ apex: 3.3 }),
      ]) {
        host.setPatches(ps);
        ticks(host, 10);
        if (host.surfaces().size !== ps.length) throw new Error(`${id}: ${host.surfaces().size} surfaces for ${ps.length} patches`);
      }
      host.setParams({ ...values, 'map.mask.furniture': false, 'life.ppm': 24 }, ['map.mask.furniture', 'life.ppm']);
      ticks(host, 10);
      host.setParams({ ...values, 'region.loft.on': false, 'region.wall-N.system': 'off' }, ['region.loft.on', 'region.wall-N.system']);
      ticks(host, 10);
      const nf = allFinite(host);
      if (nf) throw new Error(`${id}: non-finite ${nf}`);
      host.reseed();
      host.clear();
      host.seed('wall-E', 0.9, 1.1);
      ticks(host, 5);
      host.dispose();
    }
  } catch (e) {
    err = e;
  }
  check(!err, 'churn: patches + masks change', err ? String(err.stack || err).split('\n').slice(0, 2).join(' ') : 'loft off/on, apex change, masks stripped, walls only, ppm 24, regions off, reseed/clear/seed: no throw');
}

// ── 12. evolution: habitats drift apart (slow) ───────────────────────────────
if (!QUICK) {
  const seeds = [5, 21];
  const acc = { floor: {}, wall: {}, ceiling: {} };
  const start = { floor: {}, wall: {}, ceiling: {} };
  for (const seed of seeds) {
    const { host } = makeHost(3.3, {}, seed);
    ticks(host, 30);
    const m0 = host.stats().means;
    ticks(host, Math.round((4 * 60) / TICK));
    const m = host.stats().means;
    for (const h of ['floor', 'wall', 'ceiling']) {
      for (const k of ['grip', 'feet', 'mass', 'swing']) {
        acc[h][k] = (acc[h][k] || 0) + (m[h][k] ?? NaN) / seeds.length;
        start[h][k] = (start[h][k] || 0) + (m0[h][k] ?? NaN) / seeds.length;
      }
    }
    host.dispose();
  }
  const tbl = ['grip', 'feet', 'mass', 'swing'].map((k) => `${k} f/w/c ${fmt(acc.floor[k])}/${fmt(acc.wall[k])}/${fmt(acc.ceiling[k])}`).join('; ');
  const spread0 = ['grip', 'mass', 'swing'].reduce((s, k) => s + Math.abs(start.ceiling[k] - start.floor[k]), 0);
  const spread = ['grip', 'mass', 'swing'].reduce((s, k) => s + Math.abs(acc.ceiling[k] - acc.floor[k]), 0);
  row(spread > spread0 * 1.5 && spread > 0.3 ? 'PASS' : 'WARN', 'evolution: habitats drift apart', `4 sim-min × ${seeds.length} seeds: ${tbl} (floor↔roof spread ${fmt(spread0)} → ${fmt(spread)})`);
}

// ── table ────────────────────────────────────────────────────────────────────
const fails = rows.filter((r) => r.status === 'FAIL');
const warns = rows.filter((r) => r.status === 'WARN');
console.log('\n' + '─'.repeat(72));
console.log(`sim-check: ${rows.length - fails.length - warns.length} PASS, ${warns.length} WARN, ${fails.length} FAIL${QUICK ? ' (quick: evolution skipped)' : ''}`);
process.exit(fails.length ? 1 : 0);
