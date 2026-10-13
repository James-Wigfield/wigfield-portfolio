/* ============================================================================
   VERDICT DECK — CONSTANTS AND PURE HELPERS (no JSX)
   ----------------------------------------------------------------------------
   The hypothesis scoreboard's timeline, the margin glossary, and the geometry
   of the motion graphics (N2 lanes, N3 tiles). Counts come from the fact
   manifest (shared/facts.js) and are computed, never typed.
   ========================================================================== */

import { FACTS } from '../../shared/facts';

const v = (k) => FACTS[k]?.value;

/* ── The scoreboard (N6) ─────────────────────────────────────────────────
   Main slides in order. A hypothesis resolves on one slide at one build step
   (the [CLICK] where its verdict is spoken); every later slide shows it
   resolved. Verdicts themselves come from HYPOTHESES (shared/meta.js). */
export const ORDER = ['title', 'problem', 'overview', 'previous', 'bet', 'question', 'built', 'tested', 'works', 'fair', 'twin', 'loss-speed', 'meaning'];
const RESOLVE = {
  fair: { H1: 3 },
  twin: { H4: 3 },
  'loss-speed': { H2: 1, H3: 3 },
};
const FOCUS = {
  fair: ['H1'],
  twin: ['H4'],
  'loss-speed': ['H2', 'H3'],
};

/** For a slide and build step: { resolved: Set of ids, fresh: Set resolved on this slide, focus: [] }. */
export function boardAt(slideId, step) {
  const at = ORDER.indexOf(slideId);
  const resolved = new Set();
  const fresh = new Set();
  ORDER.forEach((id, i) => {
    const r = RESOLVE[id];
    if (!r) return;
    Object.entries(r).forEach(([h, s]) => {
      if (i < at) resolved.add(h);
      else if (i === at && step >= s) {
        resolved.add(h);
        fresh.add(h);
      }
    });
  });
  return { resolved, fresh, focus: FOCUS[slideId] ?? [] };
}

/* ── Margin glossary (slides 2 to 5): the one term defined aloud there ──── */
export const GLOSSARY = {
  problem: [{ term: 'Segmentation', def: 'outlining every lesion, voxel by voxel' }],
  overview: [{ term: 'Precision', def: 'the share of predictions that hit a lesion' }],
  previous: [{ term: 'CNN', def: 'a network of small filters that slide over the image' }],
  bet: [{ term: 'Mamba', def: 'a sequence model whose cost grows linearly with length' }],
};

/* ── N2: the selective-scan schematic ────────────────────────────────────
   A 4 x 3 x 3 block (schematic) read in six orders. Each token keeps one
   shade (its place in the +x order), so the lanes show the same tokens in
   different orders. */
export const BLOCK = { X: 4, Y: 3, Z: 3 };
export const TOKENS = (() => {
  const out = [];
  for (let z = 0; z < BLOCK.Z; z += 1) {
    for (let y = 0; y < BLOCK.Y; y += 1) {
      for (let x = 0; x < BLOCK.X; x += 1) out.push({ x, y, z, i: out.length });
    }
  }
  return out;
})();
const keyOf = {
  x: (t) => t.x + BLOCK.X * (t.y + BLOCK.Y * t.z),
  y: (t) => t.y + BLOCK.Y * (t.x + BLOCK.X * t.z),
  z: (t) => t.z + BLOCK.Z * (t.x + BLOCK.X * t.y),
};
export const LANES = ['x', 'y', 'z'].flatMap((ax) => {
  const fwd = [...TOKENS].sort((a, b) => keyOf[ax](a) - keyOf[ax](b)).map((t) => t.i);
  return [
    { id: `+${ax}`, order: fwd },
    { id: `-${ax}`, order: [...fwd].reverse() },
  ];
});

/** Shade for token i of n: light to deep Mamba blue. */
export function tokenShade(i, n = TOKENS.length) {
  const a = [214, 230, 242];
  const b = [12, 74, 120];
  const f = i / (n - 1);
  const c = a.map((u, k) => Math.round(u + (b[k] - u) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* ── N3: the data tiles ──────────────────────────────────────────────────
   697 tiles (597 autoPET-III, 100 DEEP-PSMA). 130 go to the sealed vault
   (110 + 20); the 567 others go to five folds. Fold 0 is run 4's 57 autoPET
   validation cases plus the DEEP-PSMA remainder of its size; folds 1 to 4
   share the rest evenly. The DEEP-PSMA split this gives (10, 17, 17, 18, 18)
   is the one in appendices/b-configuration.tex, tab:app-fold-composition. */
export function tilePlan() {
  const nA = v('data.autopet');
  const nD = v('data.deeppsma');
  const testA = v('data.test_autopet');
  const testD = v('data.test_deeppsma');
  const f0 = v('data.fold0');
  const f0A = v('train.val57');
  const nFolds = v('data.folds');
  const poolD = v('data.pool_deeppsma');
  const poolA = v('data.pool_autopet');

  const dFold = [f0 - f0A];
  const restD = poolD - dFold[0];
  const per = Math.floor(restD / (nFolds - 1));
  let extra = restD - per * (nFolds - 1);
  const dTail = [];
  for (let k = nFolds - 1; k >= 1; k -= 1) {
    dTail.unshift(per + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  dFold.push(...dTail);
  const aFold = [f0A];
  const restA = poolA - f0A;
  const perA = Math.floor(restA / (nFolds - 1));
  let extraA = restA - perA * (nFolds - 1);
  for (let k = 1; k < nFolds; k += 1) {
    aFold.push(perA + (extraA > 0 ? 1 : 0));
    if (extraA > 0) extraA -= 1;
  }

  // A fixed pseudo-random order (a patient-level draw stands behind the real split).
  const hash = (i) => {
    let h = (i + 1) * 2654435761;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  const tiles = [];
  for (let i = 0; i < nA + nD; i += 1) tiles.push({ i, cohort: i < nA ? 'a' : 'b', r: hash(i) });
  const pick = (cohort) => tiles.filter((t) => t.cohort === cohort).sort((p, q) => p.r - q.r);
  const aOrder = pick('a');
  const dOrder = pick('b');
  aOrder.slice(0, testA).forEach((t) => { t.dest = 'test'; });
  dOrder.slice(0, testD).forEach((t) => { t.dest = 'test'; });
  let ai = testA;
  let di = testD;
  for (let k = 0; k < nFolds; k += 1) {
    aOrder.slice(ai, ai + aFold[k]).forEach((t) => { t.dest = k; });
    dOrder.slice(di, di + dFold[k]).forEach((t) => { t.dest = k; });
    ai += aFold[k];
    di += dFold[k];
  }
  return { tiles, nFolds, foldSizes: aFold.map((a, k) => a + dFold[k]), testN: testA + testD };
}
