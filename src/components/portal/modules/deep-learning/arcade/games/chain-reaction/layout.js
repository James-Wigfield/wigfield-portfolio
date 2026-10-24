/* Chain Reaction — drawing geometry (pure; no React). The computation graph
   runs left to right: inputs → hidden (Σ + φ, drawn as in Figures 10-7 and
   10-9) → a linear output. Coordinates are in the SVG's viewBox units. */
import { PHI, softplus } from '../../maths/chainReaction.js';

export const G = {
  w: 392,
  h: 262,
  inp: [[36, 66], [36, 196]],
  hid: [[196, 66], [196, 196]],
  out: [336, 131],
  rIn: 17,
  rHid: 25,
  rOut: 25,
  // where the output's labels sit: ŷ above, c above the ring, y and ŷ − y below
  yhatAt: [336, 76],
  yAt: [336, 182],
  eAt: [336, 201],
};

const X = G.inp;
const H = G.hid;

// every connection: where it runs, its name, where its label sits, which parameter
export const EDGES = [
  { id: 'w00', a: X[0], b: H[0], ra: G.rIn, rb: G.rHid, name: 'w₁,₁', at: [96, 57], p: ['W', 0, 0] },
  { id: 'w10', a: X[1], b: H[0], ra: G.rIn, rb: G.rHid, name: 'w₂,₁', at: [84, 161], p: ['W', 1, 0] },
  { id: 'w01', a: X[0], b: H[1], ra: G.rIn, rb: G.rHid, name: 'w₁,₂', at: [84, 104], p: ['W', 0, 1] },
  { id: 'w11', a: X[1], b: H[1], ra: G.rIn, rb: G.rHid, name: 'w₂,₂', at: [96, 214], p: ['W', 1, 1] },
  { id: 'v0', a: H[0], b: G.out, ra: G.rHid, rb: G.rOut, name: 'v₁', at: [258, 84], p: ['v', 0] },
  { id: 'v1', a: H[1], b: G.out, ra: G.rHid, rb: G.rOut, name: 'v₂', at: [258, 190], p: ['v', 1] },
];

export const BIASES = [
  { id: 'b0', name: 'b₁', at: [196, 26], p: ['b', 0] },
  { id: 'b1', name: 'b₂', at: [196, 247], p: ['b', 1] },
  { id: 'c', name: 'c', at: [336, 96], p: ['c'] },
];

export function param(net, p) {
  if (p[0] === 'W') return net.W[p[1]][p[2]];
  if (p[0] === 'v') return net.v[p[1]];
  if (p[0] === 'b') return net.b[p[1]];
  return net.c;
}

// a segment between two circles' rims
export function seg(a, b, ra, rb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  return { x1: a[0] + ux * ra, y1: a[1] + uy * ra, x2: b[0] - ux * rb, y2: b[1] - uy * rb };
}

// a small arrowhead at fraction t along a segment, pointing forward (dir 1) or back (−1)
export function arrowHead(s, t = 0.62, dir = 1, size = 6) {
  const x = s.x1 + (s.x2 - s.x1) * t;
  const y = s.y1 + (s.y2 - s.y1) * t;
  const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  const ux = ((s.x2 - s.x1) / L) * dir;
  const uy = ((s.y2 - s.y1) / L) * dir;
  const px = -uy;
  const py = ux;
  const tip = [x + ux * size, y + uy * size];
  const l = [x - ux * size * 0.6 + px * size * 0.7, y - uy * size * 0.6 + py * size * 0.7];
  const r = [x - ux * size * 0.6 - px * size * 0.7, y - uy * size * 0.6 - py * size * 0.7];
  return [tip, l, r].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
}

// an activation glyph inside a w × h box centred on (cx, cy)
const GLYPH_FN = { ...PHI, softplus };
const GLYPH_RANGE = { sigmoid: [0, 1], tanh: [-1, 1], relu: [0, 3], heaviside: [0, 1], softplus: [0, 3] };
export function glyphPath(act, cx, cy, w, h) {
  const f = GLYPH_FN[act];
  if (!f) return '';
  const [lo, hi] = GLYPH_RANGE[act];
  const n = act === 'heaviside' ? 0 : 16;
  const pts = n
    ? Array.from({ length: n + 1 }, (_, i) => -3 + (6 * i) / n).map((z) => [cx - w / 2 + ((z + 3) / 6) * w, cy + h / 2 - ((f(z) - lo) / (hi - lo)) * h])
    : [[cx - w / 2, cy + h / 2], [cx, cy + h / 2], [cx, cy - h / 2], [cx + w / 2, cy - h / 2]];
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
}

// a plot transform: data (z, y) → viewBox (x, y)
export function plotter(box, zr, yr) {
  const [x0, y0, w, h] = box;
  const sx = (z) => x0 + ((z - zr[0]) / (zr[1] - zr[0])) * w;
  const sy = (v) => y0 + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(Math.max(yr[0], Math.min(yr[1], p[1]))).toFixed(1)}`).join(' ');
  return { sx, sy, path };
}

// y ticks for the small activation inset
export const INSET = {
  sigmoid: { yr: [-0.1, 1.1], ticks: [0, 0.25, 0.5, 0.75, 1], labels: [0, 0.5, 1] },
  tanh: { yr: [-1.15, 1.15], ticks: [-1, -0.5, 0, 0.5, 1], labels: [-1, 0, 1] },
  relu: { yr: [-0.4, 3.2], ticks: [0, 1, 2, 3], labels: [0, 1, 2, 3] },
  dsigmoid: { yr: [-0.02, 0.3], ticks: [0, 0.1, 0.2], labels: [0, 0.1, 0.2] },
};
