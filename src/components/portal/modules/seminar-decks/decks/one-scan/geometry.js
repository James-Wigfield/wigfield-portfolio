import { FACTS } from '../../shared/facts';

/* ============================================================================
   ONE SCAN, START TO FINISH — GEOMETRY (computed, never typed)
   ----------------------------------------------------------------------------
   Every size and count that a motion graphic draws comes from the fact
   manifest (shared/facts.js) or from the verified hold frames' layout, which
   was measured from the PNGs (pixel bands of the baked text, 12 Oct 2026):
     A1 hold   body x 714-1207, y 120-960; baked text bottom-left x 96-548,
               y 693-989; legend x 1522-1823, y 875-976
     A2-A5     body x 294-787 after the glide; right panel kicker y 101-120,
               gold rule y 138-141, title y 168-227, sub y 243-314, content
               from y 293 (A2a inset), 300 (A5 card), 329-354 (others)
   ========================================================================== */

const v = (k) => FACTS[k].value;

/* N1: windows to scale on the case A beat 1 hold (case-a-1-scan.png).
   One canvas pixel is n1.mm_per_px millimetres; the body layer's top-left is
   at (n1.origin_x, n1.origin_y) and it is n1.layer_w x n1.layer_h px. The
   view is coronal: x is left-right, y is head-toe. The three windows share
   one illustrative centre, the layer's centre, as in the dissertation's
   patch-geometry figure. */
export const N1 = (() => {
  const mm = v('n1.mm_per_px');
  const cx = v('n1.origin_x') + v('n1.layer_w') / 2;
  const cy = v('n1.origin_y') + v('n1.layer_h') / 2;
  const rect = (wmm, hmm) => {
    const w = wmm / mm;
    const h = hmm / mm;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  return {
    cx,
    cy,
    psm: rect(v('psm.patch_x_mm'), v('psm.patch_z_mm')),
    small: rect(v('patch.small_x_mm'), v('patch.small_z_mm')),
    large: rect(v('patch.large_x_mm'), v('patch.large_z_mm')),
  };
})();

/* N3: 697 tiles. Counts from data.*; positions computed here. */
const TOTAL = v('data.total');
const N_AP = v('data.autopet');
const N_DP = v('data.deeppsma');
const T_AP = v('data.test_autopet');
const T_DP = v('data.test_deeppsma');
const FOLD0 = v('data.fold0');
const FOLDN = v('data.fold_n');
const NFOLDS = v('data.folds');
const VAL57 = v('train.val57');
const POOL_DP = v('data.pool_deeppsma');

// Spread k of n items evenly (deterministic): the indices floor((j + 0.5) * n / k).
const spread = (n, k) => {
  const s = new Set();
  for (let j = 0; j < k; j += 1) s.add(Math.floor(((j + 0.5) * n) / k));
  return s;
};

export const N3 = (() => {
  const pool = { cols: 41, tile: 22, pitch: 26, x: 0, y: 0 };
  const testAp = spread(N_AP, T_AP);
  const testDp = spread(N_DP, T_DP);
  const tiles = [];
  for (let i = 0; i < TOTAL; i += 1) {
    const dp = i >= N_AP;
    const local = dp ? i - N_AP : i;
    const test = dp ? testDp.has(local) : testAp.has(local);
    tiles.push({ i, dp, test });
  }
  // Step 0: everything in one block, row-major (autoPET first).
  tiles.forEach((t) => {
    t.x0 = pool.x + (t.i % pool.cols) * pool.pitch;
    t.y0 = pool.y + Math.floor(t.i / pool.cols) * pool.pitch;
  });
  // Step 1: the test tiles move into the vault (13 x 10), autoPET first.
  const vault = { x: 1218, y: 40, cols: 13, pitch: 32, tile: 26 };
  const tests = tiles.filter((t) => t.test).sort((a, b) => (a.dp - b.dp) || (a.i - b.i));
  tests.forEach((t, k) => {
    t.x1 = vault.x + (k % vault.cols) * vault.pitch;
    t.y1 = vault.y + Math.floor(k / vault.cols) * vault.pitch;
  });
  tiles.filter((t) => !t.test).forEach((t) => {
    t.x1 = t.x0;
    t.y1 = t.y0;
  });
  // Step 2: the pool tiles regroup into five folds (fold 0 smaller). Each
  // fold keeps its two cohorts: fold 0 is run 4's autoPET validation cases
  // plus the DEEP-PSMA cases that fill it; the other DEEP-PSMA pool cases
  // spread over folds 1 to 4 (giving 10, 17, 17, 18, 18, as in the
  // dissertation's fold table, tab:app-fold-composition). autoPET first,
  // then DEEP-PSMA (hollow) at the end of each fold.
  const fold = { cols: 7, pitch: 24, gap: 46, y: 64 };
  const sizes = [FOLD0, ...Array(NFOLDS - 1).fill(FOLDN)];
  const dpFold = [FOLD0 - VAL57];
  const restDp = POOL_DP - dpFold[0];
  const per = Math.floor(restDp / (NFOLDS - 1));
  let extra = restDp - per * (NFOLDS - 1);
  const tail = [];
  for (let f = NFOLDS - 1; f >= 1; f -= 1) {
    tail.unshift(per + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  dpFold.push(...tail);
  const poolTiles = tiles.filter((t) => !t.test);
  const poolAp = poolTiles.filter((t) => !t.dp);
  const poolDp = poolTiles.filter((t) => t.dp);
  let ka = 0;
  let kd = 0;
  let k = 0;
  const foldBoxes = sizes.map((n, f) => {
    const x = f * (fold.cols * fold.pitch + fold.gap);
    const nDp = dpFold[f];
    const members = [...poolAp.slice(ka, ka + n - nDp), ...poolDp.slice(kd, kd + nDp)];
    ka += n - nDp;
    kd += nDp;
    members.forEach((t, j) => {
      t.x2 = x + (j % fold.cols) * fold.pitch;
      t.y2 = fold.y + Math.floor(j / fold.cols) * fold.pitch;
      t.fold = f;
      k += 1;
    });
    return { x, w: fold.cols * fold.pitch - (fold.pitch - pool.tile), n, nDp, rows: Math.ceil(n / fold.cols) };
  });
  tests.forEach((t) => {
    t.x2 = t.x1;
    t.y2 = t.y1;
  });
  return {
    tiles,
    pool,
    vault: { ...vault, w: vault.cols * vault.pitch, h: Math.ceil(tests.length / vault.cols) * vault.pitch },
    fold,
    foldBoxes,
    poolRows: Math.ceil(TOTAL / pool.cols),
    checks: { total: tiles.length, test: tests.length, pool: poolTiles.length, placed: k },
  };
})();

/* Slide 10: the sealed 130 as a 13 x 10 grid (same order as the vault). */
export const VAULT130 = (() => {
  const cols = 13;
  const n = T_AP + T_DP;
  return Array.from({ length: n }, (_, k) => ({ k, dp: k >= T_AP, col: k % cols, row: Math.floor(k / cols) }));
})();

/* Slide 10: the pooled lesion bars (lengths from the manifest counts). */
export const POOLED = (() => {
  const tp = v('r5.tp');
  const fn = v('r5.fn');
  const fp = v('r5.fp');
  const max = Math.max(tp + fn, tp + fp);
  return { tp, fn, fp, max };
})();

/* N8: option F (figures/architecture-option-f.svg, viewBox 409.888 x 419.525)
   revealed by clipping regions of the one verified file. Regions in viewBox
   units, measured from a render (stage boundaries chosen where no element is
   cut): R1 the input and the two convolutional stages, R2 the three Mamba
   stages, R3 the decoder, heads and the training-only organ head, R4 one
   Mamba block (the inset) and the legend. */
export const OPTF = (() => {
  const W = 409.888;
  const H = 419.525;
  const px = (x) => `${((x / W) * 100).toFixed(3)}%`;
  const py = (y) => `${((y / H) * 100).toFixed(3)}%`;
  const poly = (pts) => `polygon(${pts.map(([x, y]) => `${px(x)} ${py(y)}`).join(', ')})`;
  const xA = 137.3; // right edge of the conv stages
  const yA = 202.6; // bottom of stage 2
  const yB = 190.0; // top of stage 3's blocks
  const xC = 289.3; // right edge of the Mamba stages, above the bottleneck
  const yC = 265.0;
  const xD = 294.0; // right edge of the bottleneck
  const yD = 293.3; // top of the inset
  return {
    W,
    H,
    regions: {
      r1: poly([[0, 0], [xA, 0], [xA, yA], [0, yA]]),
      r2: poly([[0, yA], [xA, yA], [xA, yB], [xC, yB], [xC, yC], [xD, yC], [xD, yD], [0, yD]]),
      r3: poly([[xA, 0], [W, 0], [W, yD], [xD, yD], [xD, yC], [xC, yC], [xC, yB], [xA, yB]]),
      r4: poly([[0, yD], [W, yD], [W, H], [0, H]]),
    },
    // Camera per build step: the figure's scale (px per unit) and where its
    // origin sits inside the plate (plate is 1728 x 730).
    base: 5.2, // the figure is laid out at the largest camera scale, so the camera only ever shrinks it (stays sharp)
    cams: [
      { s: 3.56, x: 40, y: 0 },
      { s: 4.4, x: 40, y: 20 - 186 * 4.4 },
      { s: 4.0, x: 44, y: 10 - 280.5 * 4.0 },
      { s: 5.2, x: -190 * 5.2, y: 0 },
      { s: 1.73, x: 27, y: 2 },
    ],
    // The plate (slide x and width) per step: full content width while the
    // camera tours the regions, then only the figure's width for the whole
    // view, so the last build is not a white panel around a small figure.
    plates: [
      { x: 96, w: 1728 },
      { x: 96, w: 1728 },
      { x: 96, w: 1728 },
      { x: 96, w: 1728 },
      { x: 1060, w: 764 },
    ],
  };
})();
