/* ============================================================================
   PROJECTOR LIFE — the life host (CONTRACTS.md §4)
   ----------------------------------------------------------------------------
   CPU only, no three.js, no DOM: runs the same in the browser and in Node
   (tools/projector-life/sim-check.mjs).

   One DOMAIN (life/domain.js) holds a cell grid for every patch at one ppm.
   Each patch is assigned a system:
     region.<id>.system if not 'auto', else life.sys.<type> where type =
     region.<id>.type if not 'auto', else patch.typeAuto; region.<id>.on ===
     false → black (and creatures stay off it).
   Systems (Gray-Scott, Physarum, Particle Life, Lenia) each own a set of
   patches and step them together, so seams between patches running the same
   system are exchanged; creatures (Plate VII prototype) live on top.

   Time: fixed 30 Hz ticks inside step(dt), life.speed scales the clock,
   life.substeps multiplies the work per tick. A per-call budget (9 ms) and a
   cap of 4 ticks per call mean heavy settings slow the sim down rather than
   stall the page; buffers are repainted once per call when a tick ran.
   ========================================================================== */

import { buildDomain, resampleField } from './domain.js';
import { createPainter } from './draw.js';
import { createCreatures } from './creatures.js';
import { createGrayScott } from './systems/grayScott.js';
import { createPhysarum } from './systems/physarum.js';
import { createParticleLife } from './systems/particleLife.js';
import { createLenia } from './systems/lenia.js';
import { makeRng } from './lib/rng.js';

export const TICK = 1 / 30;
const MAX_TICKS = 4;
const BUDGET_MS = 9;
/** One global budget, split across patches by area inside each system. */
export const BUDGET = { physAgents: 45000, plParticles: 6000, leniaOps: 2.6e6 };
const RAW_BUDGET = { physAgents: 16000, plParticles: 1800, leniaOps: 1.2e6 };
/** Work per tick for each system (× life.substeps). */
const STEPS = { grayscott: 2, physarum: 1, particlelife: 1, lenia: 1 };
const SYSTEM_IDS = ['grayscott', 'physarum', 'particlelife', 'lenia'];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The flat rectangle an unmapped projector throws (map.mode = 'raw'). */
const RAW_PATCH = {
  id: 'raw',
  kind: 'wall',
  flat: null,
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
  polygon: [[0, 0], [8, 0], [8, 4.5], [0, 4.5]],
  width: 8,
  height: 4.5,
  area: 36,
  typeAuto: 'wall',
  type: 'wall',
  masks: [],
  seams: [],
  gravity: { gt: [0, -1], gn: 0 },
};
const RAW_PPM = 40; // 320 × 180

function makeSystem(id, deps) {
  if (id === 'grayscott') return createGrayScott(deps);
  if (id === 'physarum') return createPhysarum(deps);
  if (id === 'particlelife') return createParticleLife(deps);
  if (id === 'lenia') return createLenia(deps);
  return null;
}

export function createLifeHost({ patches, landing = null, values = {}, seed } = {}) {
  const rng = makeRng(seed);
  let V = values;
  let patchList = patches || [];
  let D = null;
  let dirty = true;
  let disposed = false;

  // assignment, per patch index
  let sysOf = [];
  let habOf = [];
  let onOf = [];
  let wallPatches = [];

  const surfaces = new Map();
  let outs = []; // Uint32Array view per patch idx
  let touched = []; // patch drew a glyph last paint
  const painter = createPainter();

  const sys = {};
  const deps = { rng, budget: BUDGET };
  const env = {
    domain: () => D,
    typeOf: (pi) => habOf[pi] || 'floor',
    blocked: (pi) => !onOf[pi],
    foodAt: (g) => {
      const s = sys[sysOf[D.cellPatch[g]]];
      return s ? s.food(g) : 0;
    },
    landing: (x, z, y) => (landing ? landing(x, z, y) : { y: 0, patchId: 'floor', local: null, surface: 'floor' }),
    walls: () => wallPatches,
    onBodyLands: (kind, L, b) => bodyLands(kind, L, b),
  };
  const creatures = createCreatures({ rng, env });
  sys.grayscott = makeSystem('grayscott', deps);
  sys.physarum = makeSystem('physarum', deps);
  sys.particlelife = makeSystem('particlelife', {
    ...deps,
    onDetach: (pi, x, y, vx, vy, s, rgb) => creatures.addFaller('spore', pi, x, y, vx, vy, rgb, { species: s }),
  });
  sys.lenia = makeSystem('lenia', deps);

  let tick = 0;
  let acc = 0;
  let simMs = 0;
  let tickMs = 0;
  let ticksWindow = 0, ticksT0 = now(), tickRate = 0;
  let lastSeed = null;

  // ── domain + assignment ───────────────────────────────────────────────────
  const maskOn = (kind) => V[`map.mask.${kind}`] !== false;
  const ppmOf = () => Math.max(8, Math.min(96, Math.round(Number(V['life.ppm']) || 40)));

  function computeAssignment() {
    const out = { sys: [], hab: [], on: [] };
    for (const p of patchList) {
      const on = V[`region.${p.id}.on`] !== false;
      const t = V[`region.${p.id}.type`];
      const hab = t && t !== 'auto' ? t : p.typeAuto || 'wall';
      const s = V[`region.${p.id}.system`];
      let id = s && s !== 'auto' ? s : V[`life.sys.${hab}`] || 'off';
      if (!on || !SYSTEM_IDS.includes(id)) id = 'off';
      out.sys.push(id);
      out.hab.push(hab);
      out.on.push(on);
    }
    return out;
  }

  function applyAssignment(prevById) {
    const a = computeAssignment();
    sysOf = a.sys;
    habOf = a.hab;
    onOf = a.on;
    for (const id of SYSTEM_IDS) {
      const list = [];
      const fresh = [];
      sysOf.forEach((s, pi) => {
        if (s !== id) return;
        list.push(pi);
        if (!prevById || prevById.get(patchList[pi].id) !== id) fresh.push(pi);
      });
      sys[id].assign(list, fresh);
    }
  }

  function makeCoarse() {
    return buildDomain(patchList, { ppm: ppmOf() / 2, maskOn, seams: V['life.seams'] !== false });
  }

  function allocSurfaces() {
    const keep = new Set();
    outs = [];
    touched = [];
    for (const p of D.P) {
      keep.add(p.id);
      let s = surfaces.get(p.id);
      if (!s || s.w !== p.w || s.h !== p.h || s.ppm !== D.ppm) {
        const data = new Uint8Array(p.w * p.h * 4);
        s = { w: p.w, h: p.h, ppm: D.ppm, data, version: (s?.version || 0) + 1 };
        surfaces.set(p.id, s);
      }
      outs[p.idx] = new Uint32Array(s.data.buffer, s.data.byteOffset, p.w * p.h);
      touched[p.idx] = true;
    }
    for (const id of [...surfaces.keys()]) if (!keep.has(id)) surfaces.delete(id);
    painter.bind(D, outs);
  }

  function rebuild() {
    const oldD = D;
    const prev = new Map();
    if (oldD) sysOf.forEach((s, pi) => prev.set(oldD.P[pi].id, s));
    D = buildDomain(patchList, { ppm: ppmOf(), maskOn, seams: V['life.seams'] !== false });
    wallPatches = D.P.filter((p) => p.kind === 'wall').map((p) => p.patch);
    for (const id of SYSTEM_IDS) sys[id].rebind(D, oldD, resampleField, makeCoarse);
    applyAssignment(oldD ? prev : null);
    for (const id of pendingReseed) sys[id].reseed();
    pendingReseed.clear();
    if (oldD) creatures.rebind(oldD);
    allocSurfaces();
    dirty = false;
    paint();
  }

  function bodyLands(kind, L, b) {
    if (kind !== 'spore' || !L || L.patchId == null) return;
    const pi = D.byId.get(L.patchId);
    if (pi === undefined || !onOf[pi]) return;
    const p = D.P[pi].patch;
    const dx = b.x - p.origin[0], dy = b.y - p.origin[1], dz = b.z - p.origin[2];
    const x = dx * p.u[0] + dy * p.u[1] + dz * p.u[2];
    const y = dx * p.v[0] + dy * p.v[1] + dz * p.v[2];
    const s = sysOf[pi];
    if (s === 'particlelife') sys.particlelife.land(pi, x, y, b.species ?? 0);
    else if (s !== 'off') sys[s].touch?.(pi, x, y);
    sporesLanded++;
  }
  let sporesLanded = 0;
  const pendingReseed = new Set();

  // ── painting ──────────────────────────────────────────────────────────────
  function paint() {
    for (const p of D.P) {
      const s = sysOf[p.idx];
      const out = outs[p.idx];
      if (s === 'off') {
        if (touched[p.idx]) out.fill(0xff000000);
      } else sys[s].paint(p.idx, out);
    }
    const before = touched;
    touched = new Array(D.P.length).fill(false);
    painter.onTouch = (pi) => {
      touched[pi] = true;
    };
    creatures.draw(painter);
    for (const p of D.P) {
      if (sysOf[p.idx] === 'off' && !before[p.idx] && !touched[p.idx]) continue; // still black
      surfaces.get(p.id).version++;
    }
  }

  // ── raw / unmapped frame ──────────────────────────────────────────────────
  const raw = { sysId: null, s: null, D: null, out: null, frame: null, wantedAt: -1e9, rng: makeRng(seed ? seed + 7 : undefined) };

  function rawEnsure() {
    const want = V['life.sys.wall'];
    if (raw.sysId === want && raw.D) return;
    raw.s?.dispose();
    raw.sysId = want;
    raw.D = buildDomain([RAW_PATCH], { ppm: RAW_PPM, maskOn: () => false, seams: false });
    const w = raw.D.P[0].w, h = raw.D.P[0].h;
    if (!raw.frame || raw.frame.w !== w || raw.frame.h !== h) {
      const data = new Uint8Array(w * h * 4);
      raw.frame = { w, h, data, version: 0 };
      raw.out = new Uint32Array(data.buffer);
    }
    raw.s = SYSTEM_IDS.includes(want) ? makeSystem(want, { rng: raw.rng, budget: RAW_BUDGET, onDetach: () => {} }) : null;
    if (raw.s) {
      raw.s.init?.(V);
      raw.s.setParams(V);
      raw.s.rebind(raw.D, null, resampleField, () => buildDomain([RAW_PATCH], { ppm: RAW_PPM / 2, maskOn: () => false, seams: false }));
      raw.s.assign([0], [0]);
      raw.s.paint(0, raw.out);
    } else raw.out.fill(0xff000000);
    raw.frame.version++;
  }

  function rawActive() {
    return now() - raw.wantedAt < 1500;
  }

  // ── params ────────────────────────────────────────────────────────────────
  function setParams(values2, changedKeys) {
    V = values2;
    const changed = changedKeys || Object.keys(values2);
    let needRebuild = false, needAssign = false;
    const reseedSys = new Set();
    for (const k of changed) {
      if (k === 'life.ppm' || k === 'life.seams' || k.startsWith('map.mask.')) needRebuild = true;
      else if (k.startsWith('region.') || k.startsWith('life.sys.')) needAssign = true;
    }
    for (const id of SYSTEM_IDS) if (sys[id].setParams(V)) reseedSys.add(id);
    creatures.setParams(V);
    if (changed.includes('cr.on') && V['cr.on']) creatures.reseed();
    if (!D) return;
    // A pending rebuild (setPatches() since the last step) means sysOf / D
    // still describe the OLD patch list: never map new indices onto it —
    // defer the assignment and reseeds to rebuild(), which applies both.
    if (needRebuild || dirty) {
      dirty = true;
      for (const id of reseedSys) pendingReseed.add(id);
      if (raw.s) raw.sysId = null;
      return;
    }
    if (needAssign) {
      const prev = new Map();
      sysOf.forEach((s, pi) => prev.set(D.P[pi].id, s));
      applyAssignment(prev);
      creatures.revalidate();
    }
    for (const id of reseedSys) sys[id].reseed();
    if (raw.s && (changed.includes('life.sys.wall') || reseedSys.has(raw.sysId))) {
      raw.sysId = null; // rebuilt on the next frame()
    } else if (raw.s) raw.s.setParams(V);
  }

  // ── init ──────────────────────────────────────────────────────────────────
  sys.particlelife.init(V);
  for (const id of SYSTEM_IDS) sys[id].setParams(V);
  creatures.setParams(V);
  rebuild();
  creatures.reseed();
  paint();

  function runTick() {
    const sub = Math.max(1, Math.min(8, Math.round(Number(V['life.substeps']) || 1)));
    for (const id of SYSTEM_IDS) {
      if (!sysOf.includes(id)) continue;
      sys[id].step(STEPS[id] * sub);
    }
    creatures.step(TICK);
    if (raw.s && rawActive()) raw.s.step(STEPS[raw.sysId] * sub);
    tick++;
    ticksWindow++;
  }

  const air = [];

  return {
    setPatches(p) {
      patchList = p || [];
      dirty = true;
    },

    setParams,

    step(dt) {
      if (disposed) return;
      const t0 = now();
      if (dirty) rebuild();
      const speed = Math.max(0, Number(V['life.speed']) || 0);
      acc += Math.max(0, Math.min(0.25, dt || 0)) * speed;
      let n = 0;
      while (acc >= TICK && n < MAX_TICKS) {
        runTick();
        acc -= TICK;
        n++;
        if (now() - t0 > BUDGET_MS) break;
      }
      if (acc > TICK * 2) acc = TICK * 2; // drop the debt: slower, never a stall
      if (n) {
        paint();
        if (raw.s && rawActive()) {
          raw.s.paint(0, raw.out);
          raw.frame.version++;
        }
      }
      const ms = now() - t0;
      simMs = simMs ? simMs * 0.9 + ms * 0.1 : ms;
      if (n) tickMs = tickMs ? tickMs * 0.9 + (ms / n) * 0.1 : ms / n;
      const t = now();
      if (t - ticksT0 > 1000) {
        tickRate = (ticksWindow * 1000) / (t - ticksT0);
        ticksWindow = 0;
        ticksT0 = t;
      }
    },

    surfaces() {
      if (dirty && !disposed) rebuild();
      return surfaces;
    },

    frame() {
      if (disposed) return null;
      raw.wantedAt = now();
      rawEnsure();
      return raw.frame;
    },

    airborne() {
      return creatures.airborne(air);
    },

    seed(patchId, x, y) {
      if (!D || disposed) return null;
      if (dirty) rebuild();
      const pi = D.byId.get(patchId);
      if (pi === undefined || !onOf[pi]) return null;
      const s = sysOf[pi];
      if (s !== 'off') sys[s].seedAt(pi, x, y);
      creatures.seedAt(pi, x, y);
      lastSeed = { patchId, x, y, system: s };
      paint();
      return lastSeed;
    },

    reseed() {
      if (!D || disposed) return;
      if (dirty) rebuild();
      for (const id of SYSTEM_IDS) {
        sys[id].restoreTargets?.();
        sys[id].reseed();
      }
      creatures.reseed();
      if (raw.s) raw.s.reseed();
      paint();
    },

    clear() {
      if (!D || disposed) return;
      if (dirty) rebuild();
      for (const id of SYSTEM_IDS) sys[id].clear();
      creatures.clear();
      if (raw.s) raw.s.clear();
      paint();
    },

    stats() {
      if (dirty && !disposed && D) rebuild();
      const cs = creatures.stats();
      const census = creatures.census();
      const { H, means } = creatures.histograms();
      const typeOf = (pi) => habOf[pi] || 'floor';
      const particles = { floor: 0, wall: 0, ceiling: 0 };
      for (const id of ['physarum', 'particlelife']) {
        if (!sysOf.includes(id)) continue;
        const c = sys[id].census(typeOf);
        particles.floor += c.floor;
        particles.wall += c.wall;
        particles.ceiling += c.ceiling;
      }
      const ph = sys.physarum.stats(), pl = sys.particlelife.stats();
      return {
        simMs,
        tickMs,
        tick,
        tickRate,
        populations: { floor: census.floor, wall: census.wall, ceiling: census.ceiling },
        particles,
        creatures: cs,
        histograms: H,
        means,
        seams: { physarum: ph.crossings, particles: pl.crossings, creatures: cs.crossings },
        systems: {
          grayscott: sys.grayscott.stats(),
          physarum: ph,
          particlelife: { ...pl, sporesLanded },
          lenia: sys.lenia.stats(),
        },
        assignment: Object.fromEntries(patchList.map((p, i) => [p.id, sysOf[i]])),
        ppm: D ? D.ppm : ppmOf(),
        lastSeed,
      };
    },

    /** Debug / checks only (not part of the contract). */
    _debug: () => ({ D, sys, creatures, sysOf, habOf, rng }),

    dispose() {
      disposed = true;
      for (const id of SYSTEM_IDS) sys[id].dispose();
      creatures.dispose();
      raw.s?.dispose();
      raw.s = null;
      surfaces.clear();
      outs = [];
      D = null;
    },
  };
}
