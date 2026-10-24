/* ============================================================================
   FORGER — THE STUDIO (this page's toy GAN runs, memoised; pure, no DOM)
   ----------------------------------------------------------------------------
   Built on ToyGan from lecture6-7-study/gen.js (imported, never edited): a
   1-D generator and discriminator trained with slide 25's loop (phase 1 then
   phase 2 per batch). Everything here is this page's own run.

     frameAt(key, t)          the run GAN_PRESETS[key] after t iterations:
                              400 fakes (fixed noise), the discriminator's
                              P(real) curve, the real density, histogram
     demo(key, t, phase, k)   from iteration t, phase 1 (or 2) alone k times
                              in a row: { before, after, dMax, gMax } — the
                              largest weight change in each network
     coverHistory(key, t)     share of fakes on a real bump every 100 its
     warm(items)              computes what a round's items will draw

   Runs step forward lazily and keep a copy of the weights (and RMSprop
   accumulators) at each requested iteration, so a round only trains as far
   as its items need.
   ========================================================================== */
import { ToyGan, GAN_PRESETS, TARGETS, targetDensity, modeCover, maxChange } from '../../lecture6-7-study/gen.js';
import { STUDIO } from '../content/forger.js';

const copyNet = (net) => net.map((L) => ({ W: L.W.map((r) => r.slice()), b: L.b.slice() }));
const capture = (m) => ({ step: m.step, G: copyNet(m.G), D: copyNet(m.D), sG: copyNet(m.sG), sD: copyNet(m.sD) });

const runs = new Map();    // key → { m, caps: Map<t, capture>, covers: Map<t, number> }
const frames = new Map();  // `${key}:${t}` → frame
const demos = new Map();   // `${key}:${t}:${phase}:${k}` → demo

function run(key) {
  if (!runs.has(key)) runs.set(key, { m: new ToyGan(GAN_PRESETS[key]), caps: new Map(), covers: new Map() });
  return runs.get(key);
}

// the run's state at iteration t (steps forward; restarts if t is behind)
export function stateAt(key, t) {
  const r = run(key);
  if (r.caps.has(t)) return r.caps.get(t);
  if (r.m.step > t) {
    r.m = new ToyGan(GAN_PRESETS[key]);
  }
  while (r.m.step < t) {
    r.m.iterate();
    if (r.m.step % 100 === 0 && !r.covers.has(r.m.step)) {
      const c = modeCover(r.m.target, r.m.samples(STUDIO.samples, STUDIO.noiseSeed));
      r.covers.set(r.m.step, c.reduce((a, v) => a + v, 0));
    }
  }
  const cap = capture(r.m);
  r.caps.set(t, cap);
  return cap;
}

// a ToyGan holding a captured state (its own batches come from `seed`)
export function restore(key, cap, seed = STUDIO.demoSeed) {
  const m = new ToyGan({ ...GAN_PRESETS[key], seed });
  m.G = copyNet(cap.G);
  m.D = copyNet(cap.D);
  m.sG = copyNet(cap.sG);
  m.sD = copyNet(cap.sD);
  m.step = cap.step;
  return m;
}

export const axisOf = (key) => STUDIO.axis[GAN_PRESETS[key].target];

// what the stage draws for a model
export function drawData(key, m, t) {
  const target = TARGETS[GAN_PRESETS[key].target];
  const [lo, hi] = axisOf(key);
  const xs = m.samples(STUDIO.samples, STUDIO.noiseSeed);
  const nb = STUDIO.bins;
  const w = (hi - lo) / nb;
  const counts = new Array(nb).fill(0);
  let left = 0;
  let right = 0;
  xs.forEach((x) => {
    if (x < lo) left += 1;
    else if (x >= hi) right += 1;
    else counts[Math.min(nb - 1, Math.floor((x - lo) / w))] += 1;
  });
  const dens = counts.map((c) => c / (xs.length * w)); // a density, same area as the real curve
  const grid = Array.from({ length: 121 }, (_, i) => lo + ((hi - lo) * i) / 120);
  const mean = xs.reduce((a, v) => a + v, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, v) => a + (v - mean) ** 2, 0) / xs.length);
  return {
    key, t, lo, hi, w,
    hist: dens, left, right,
    grid,
    real: grid.map((x) => targetDensity(target, x)),
    d: grid.map((x) => m.disc(x).p),
    cover: modeCover(target, xs),
    mean, sd,
    modes: target.modes.map((md) => md.m),
  };
}

export function frameAt(key, t) {
  const id = `${key}:${t}`;
  if (!frames.has(id)) frames.set(id, drawData(key, restore(key, stateAt(key, t)), t));
  return frames.get(id);
}

// one phase alone, k times in a row, from iteration t
export function demo(key, t, phase, k = STUDIO.k) {
  const id = `${key}:${t}:${phase}:${k}`;
  if (demos.has(id)) return demos.get(id);
  const cap = stateAt(key, t);
  const m = restore(key, cap);
  for (let i = 0; i < k; i++) {
    if (phase === 1) m.phase1();
    else m.phase2();
  }
  const out = {
    before: frameAt(key, t),
    after: drawData(key, m, t),
    dMax: maxChange(cap.D, m.D),
    gMax: maxChange(cap.G, m.G),
    phase, k, t,
  };
  demos.set(id, out);
  return out;
}

// share of fakes within 3σ of a real bump, every 100 iterations up to t
export function coverHistory(key, t) {
  stateAt(key, t);
  const r = run(key);
  const out = [];
  for (let s = 100; s <= t; s += 100) {
    if (!r.covers.has(s)) stateAt(key, s); // only after a restart
    out.push({ t: s, v: r.covers.get(s) ?? 0 });
  }
  return out;
}

// compute what a round's items will draw (so the first station shows fast)
export function warm(items) {
  for (const it of items ?? []) {
    if (it.studio?.demo) demo(it.studio.key, it.studio.t, it.studio.demo);
    else if (it.studio) frameAt(it.studio.key, it.studio.t);
    if (it.pair) it.pair.forEach((p) => frameAt(p.key, p.t));
    if (it.history) coverHistory(it.studio.key, it.studio.t);
  }
}
