import { posEncoding, PE_BASE } from '../attn';
import { maskUrl } from './pixmap';

/* ============================================================================
   §10 · THE POSITIONAL-ENCODING MATRIX FOR THE WAVE ORGAN
   ----------------------------------------------------------------------------
   P for 200 positions × d = 512 dimensions: this page's own choice (the
   slides don't give the size behind Figure 16-9; with these, the pair
   i = 100 / 101 runs through several cycles across p = 0 … 199, as in the
   figure). Drawn as Figure 16-9's bottom panel: x = position p, y =
   dimension i (0 at the bottom). Positive and negative values become two
   luminance masks, so the heatmap takes the theme's --dl8s-pos / --dl8s-neg.

     peMatrix(variant)      P ('code' = slide 35, base 10_000; 'slide' =
                            slide 32 as typeset, base 1000)
     peMasks(variant, rows) { pos, neg } mask images, 3 px per position and
                            `rows` tall: the 512 dimensions area-averaged
                            down to the height they are drawn at (letting
                            the browser shrink 512 alternating sin / cos
                            rows makes moiré bands that aren't in P)
     peAt(p, i, variant)    the same formula at any (fractional) p, for the
                            smooth wave curves
     pePeriod(i, variant)   how many positions the wave of dimension i takes
                            to repeat: 2π · base^((i − i mod 2) / d)
   ========================================================================== */

export const PE_LEN = 200;
export const PE_D = 512;
export const PE_XS = 3; // each position is 3 image pixels wide (crisp columns)

const mats = {};
export function peMatrix(variant) {
  if (!mats[variant]) mats[variant] = posEncoding(PE_LEN, PE_D, variant);
  return mats[variant];
}

// mean of f(i) over the dimensions covered by image row y of `rows` (row 0 =
// the top = the highest dimensions). Each sin / cos pair (2k, 2k + 1) is
// averaged first, so a row never holds an uneven share of sines and cosines.
const PAIRS = PE_D / 2;
function rowMean(f, y, rows) {
  const t0 = (y * PAIRS) / rows;
  const t1 = ((y + 1) * PAIRS) / rows;
  let s = 0;
  for (let t = Math.floor(t0); t < Math.ceil(t1); t++) {
    const w = Math.min(t + 1, t1) - Math.max(t, t0);
    const k = PAIRS - 1 - t;
    if (w > 0) s += (w * (f(2 * k) + f(2 * k + 1))) / 2;
  }
  return s / (t1 - t0);
}

const masks = {};
export function peMasks(variant, rows) {
  const key = `${variant}:${rows}`;
  if (masks[key]) return masks[key];
  const P = peMatrix(variant);
  const avg = (sign) => {
    const grid = Array.from({ length: rows }, (_, y) => Array.from({ length: PE_LEN }, (_, p) => rowMean((i) => Math.max(0, sign * P[p][i]), y, rows)));
    return maskUrl(PE_LEN * PE_XS, rows, (x, y) => grid[y][Math.floor(x / PE_XS)]);
  };
  masks[key] = { pos: avg(1), neg: avg(-1) };
  return masks[key];
}

const expOf = (i) => (i % 2 === 0 ? i : i - 1) / PE_D;
export function peAt(p, i, variant) {
  const a = p / PE_BASE[variant] ** expOf(i);
  return i % 2 === 0 ? Math.sin(a) : Math.cos(a);
}
export const pePeriod = (i, variant) => 2 * Math.PI * PE_BASE[variant] ** expOf(i);
