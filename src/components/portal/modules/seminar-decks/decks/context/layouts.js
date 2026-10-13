import { N3 } from './geometry';

/* ============================================================================
   DECK 3 (context) — TILE LAYOUTS (N3 and N4b), pure functions
   ----------------------------------------------------------------------------
   N3: one tile per scan, counts from the manifest (data.*). Which tile goes to
   the sealed test set is schematic (evenly spread within each cohort); the
   counts are exact: 597 + 100 = 697; 110 + 20 = 130 sealed; 567 pooled as
   fold 0 (67) and folds 1 to 4 (125 each).
   N4b: the 100 DEEP-PSMA scans as tiles, then as one dot per scan at
   (lesion count, run 4 minus PSMASegmentator F1).
   ========================================================================== */

export const TILE = { w: 22, h: 28, px: 28, py: 36 };
export const VAULT1 = { x: 1100, y: 60 };
export const VAULT2 = { x: 1300, y: 56 };
export const FOLD_X = (f) => 40 + f * (8 * TILE.px + 22);

const spread = (start, n, k) => {
  const out = new Set();
  for (let j = 0; j < k; j += 1) out.add(start + Math.floor(((j + 0.5) * n) / k));
  return out;
};

/*
 * DEEP-PSMA cases per fold. Fold 0 is run 4's 57 autoPET-III validation cases
 * plus the rest (67 - 57 = 10); folds 1 to 4 split the other 70 as evenly as
 * stratification allows, the odd ones last: 17, 17, 18, 18. This matches
 * tab:app-fold-composition (appendices/b-configuration.tex) without typing it.
 */
export function foldDeep() {
  const f0 = N3.fold0 - N3.val57;
  const rest = N3.poolDeep - f0;
  const base = Math.floor(rest / 4);
  const extra = rest - 4 * base;
  return [f0, ...[0, 1, 2, 3].map((i) => base + (i >= 4 - extra ? 1 : 0))];
}

export function scanTiles() {
  const testA = spread(0, N3.autopet, N3.testAutopet);
  const testD = spread(N3.autopet, N3.deeppsma, N3.testDeep);
  const tiles = [];
  let p = 0;
  let q = 0;
  for (let i = 0; i < N3.total; i += 1) {
    const dp = i >= N3.autopet;
    const test = dp ? testD.has(i) : testA.has(i);
    const t = { i, dp, test };
    t.s0 = { x: 40 + (i % 45) * TILE.px, y: 40 + Math.floor(i / 45) * TILE.py };
    if (test) {
      t.s1 = { x: VAULT1.x + (q % 10) * TILE.px, y: VAULT1.y + Math.floor(q / 10) * TILE.py };
      t.s2 = { x: VAULT2.x + (q % 10) * TILE.px, y: VAULT2.y + Math.floor(q / 10) * TILE.py };
      q += 1;
    } else {
      t.s1 = { x: 40 + (p % 36) * TILE.px, y: 40 + Math.floor(p / 36) * TILE.py };
      p += 1;
    }
    tiles.push(t);
  }
  // Folds keep their cohort mix: each fold lists its autoPET-III tiles, then its DEEP-PSMA ones.
  const sizes = [N3.fold0, N3.foldN, N3.foldN, N3.foldN, N3.foldN];
  const deep = foldDeep();
  const poolA = tiles.filter((t) => !t.test && !t.dp);
  const poolD = tiles.filter((t) => !t.test && t.dp);
  let ia = 0;
  let id = 0;
  sizes.forEach((size, fold) => {
    const members = [...poolA.slice(ia, ia + size - deep[fold]), ...poolD.slice(id, id + deep[fold])];
    ia += size - deep[fold];
    id += deep[fold];
    members.forEach((t, idx) => {
      t.fold = fold;
      t.s2 = { x: FOLD_X(fold) + (idx % 8) * TILE.px, y: 56 + Math.floor(idx / 8) * TILE.py };
    });
  });
  return tiles;
}

/** The first sealed autoPET-III tile stands for case A (the slide opens on it). */
export const CASE_A_TILE = Math.floor((0.5 * N3.autopet) / N3.testAutopet);

/* N4b plot area inside the 1728 x 722 content box. */
export const DOTS = { l: 170, r: 1660, t: 96, b: 600, n0: 1.6, n1: 260, d0: -50, d1: 50 };
export const dotX = (n) => DOTS.l + ((Math.log10(n) - Math.log10(DOTS.n0)) / (Math.log10(DOTS.n1) - Math.log10(DOTS.n0))) * (DOTS.r - DOTS.l);
export const dotY = (d) => DOTS.t + ((DOTS.d1 - Math.max(DOTS.d0, Math.min(DOTS.d1, d))) / (DOTS.d1 - DOTS.d0)) * (DOTS.b - DOTS.t);
export const FAIR_GRID = { x: 40, y: 96, px: 42, py: 52, w: 34, h: 42 };
