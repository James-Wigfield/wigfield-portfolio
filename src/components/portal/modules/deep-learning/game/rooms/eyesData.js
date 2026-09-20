/* ============================================================================
   House II data — a 6×6 RGB input, three 3-channel filters, one layer-2 filter
   ----------------------------------------------------------------------------
   Slide 15: z_k = b_k + Σ_c x_c ∗ f_{c,k}. Every filter here has one 3×3
   matrix PER INPUT CHANNEL, because a filter must have as many channels as
   its input (slide 15). Outputs are 4×4 (valid). Pure numbers.
   ========================================================================== */
import { ROOMS } from '../world/layout';

export const N = ROOMS.eyes.n; // 6
export const K = ROOMS.eyes.k; // 3
export const M = N - K + 1; // 4

const grid = (fn) => Array.from({ length: N }, (_, j) => Array.from({ length: N }, (_, i) => fn(i, j)));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* The picture: a low sun top-right, ground along the bottom, a tree at left. */
export const CHANNELS = [
  {
    id: 'red',
    name: 'Red channel',
    hue: '#e34948',
    v: grid((i, j) => {
      const sun = Math.hypot(i - 4, j - 1) < 1.35 ? 0.95 : 0;
      const ground = j >= 4 ? 0.35 : 0.08;
      return clamp01(Math.max(sun, ground));
    }),
  },
  {
    id: 'green',
    name: 'Green channel',
    hue: '#2e9a3a',
    v: grid((i, j) => {
      const ground = j >= 4 ? 0.8 : 0.12;
      const tree = i === 1 && (j === 2 || j === 3) ? 0.7 : 0;
      return clamp01(Math.max(ground, tree));
    }),
  },
  {
    id: 'blue',
    name: 'Blue channel',
    hue: '#2a78d6',
    v: grid((i, j) => (j <= 3 ? clamp01(0.9 - j * 0.14) : 0.1)),
  },
];

const zeros = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

/* Layer-1 filters: [channel][row][col]. The colours are the --dlv-* series so
   the sheets agree with the 2D StackingLab about which map is which. */
export const FILTERS = [
  {
    id: 'sun',
    k: 1,
    name: 'Filter 1 · finds the sun',
    hue: '#eb6834',
    w: [
      [[0, 0.25, 0], [0.25, 0.7, 0.25], [0, 0.25, 0]],
      zeros(),
      [[0, -0.1, 0], [-0.1, -0.4, -0.1], [0, -0.1, 0]],
    ],
  },
  {
    id: 'horizon',
    k: 2,
    name: 'Filter 2 · finds the horizon',
    hue: '#2a78d6',
    w: [
      zeros(),
      [[-0.35, -0.35, -0.35], [0, 0, 0], [0.5, 0.5, 0.5]],
      zeros(),
    ],
  },
  {
    id: 'sky',
    k: 3,
    name: 'Filter 3 · finds the sky',
    hue: '#4a3aa7',
    w: [
      [[-0.1, -0.1, -0.1], [-0.1, -0.1, -0.1], [-0.1, -0.1, -0.1]],
      zeros(),
      [[0.2, 0.2, 0.2], [0.2, 0.2, 0.2], [0.2, 0.2, 0.2]],
    ],
  },
];

/* One output tile: z_k at window (gx, gz) with bias b. */
export function conv3(f, gx, gz, bias = 0) {
  let s = bias;
  for (let c = 0; c < CHANNELS.length; c++) {
    const x = CHANNELS[c].v;
    const w = f.w[c];
    for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) s += x[gz + b][gx + a] * w[b][a];
  }
  return s;
}

/* Whole map + its display scale. */
export function featureMap(f, bias = 0) {
  const out = [];
  let max = 1e-6;
  for (let j = 0; j < M; j++) {
    const row = [];
    for (let i = 0; i < M; i++) {
      const v = conv3(f, i, j, bias);
      row.push(v);
      max = Math.max(max, Math.abs(v));
    }
    out.push(row);
  }
  return { map: out, max };
}

/* Layer 2: one filter whose channels are the layer-1 sheets that exist.
   Averages a 3×3 window across every sheet, so it reads "one filter reaches
   through all K maps". 2×2 output over 4×4 sheets. */
export const M2 = M - K + 1; // 2
export function layer2(sheets, gx, gz) {
  if (!sheets.length) return 0;
  let s = 0;
  for (const sh of sheets) for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) s += sh.map[gz + b][gx + a] / sh.max;
  return s / (9 * sheets.length);
}

/* value in [-1, 1] → colour between a dark slab and the hue */
export function shade(v, hue) {
  const t = clamp01(Math.abs(v));
  const h = parseInt(hue.slice(1), 16);
  const hr = (h >> 16) & 255;
  const hg = (h >> 8) & 255;
  const hb = h & 255;
  const base = v >= 0 ? [26, 30, 43] : [60, 40, 44];
  const r = Math.round(base[0] + (hr - base[0]) * t);
  const g = Math.round(base[1] + (hg - base[1]) * t);
  const b = Math.round(base[2] + (hb - base[2]) * t);
  return `rgb(${r},${g},${b})`;
}
