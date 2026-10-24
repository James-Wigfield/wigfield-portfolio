/* ============================================================================
   LECTURES 1–2 REFRESHER — PLOT HELPERS (scales, ticks, paths)
   Kept in a .js file so the .jsx files export components only.
   ========================================================================== */

// a linear map [d0, d1] → [r0, r1]
export function lin(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  const f = (v) => r0 + (v - d0) * k;
  f.inv = (p) => d0 + (p - r0) / k;
  f.domain = [d0, d1];
  f.range = [r0, r1];
  return f;
}

// a log10 map [d0, d1] → [r0, r1] (d0, d1 > 0)
export function log10Scale(d0, d1, r0, r1) {
  const a = Math.log10(d0);
  const b = Math.log10(d1);
  const f = (v) => r0 + ((Math.log10(Math.max(v, 1e-300)) - a) / (b - a)) * (r1 - r0);
  f.inv = (p) => 10 ** (a + ((p - r0) / (r1 - r0)) * (b - a));
  f.domain = [d0, d1];
  f.range = [r0, r1];
  return f;
}

// "nice" ticks for a linear domain
export function ticks(d0, d1, n = 5) {
  const span = d1 - d0;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(d0 / step) * step; v <= d1 + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

// an SVG path through f(x) sampled over the x-domain of sx. Points far
// outside the y-range (or not finite) break the line; draw it inside a
// clipPath of the plot box to cut the rest cleanly.
export function fnPath(f, sx, sy, n = 160) {
  const [x0, x1] = sx.domain;
  const [y0, y1] = sy.domain;
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  let d = '';
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y) || y < lo - (hi - lo) || y > hi + (hi - lo)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`;
    pen = true;
  }
  return d;
}

// a path through points [[x, y], …] in data space
export const ptsPath = (pts, sx, sy) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`).join('');

// superscript exponent for log axis labels: 10⁻⁵ … 10¹
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const pow10Label = (e) => (e === 0 ? '1' : e === 1 ? '10' : `10${String(e).split('').map((c) => SUP[c]).join('')}`);

/* The line w₁x₁ + w₂x₂ + b = 0 clipped to the box [x0,x1]×[y0,y1]: its two
   end points in data space, or null if it misses the box. */
export function clipLine(w, b, [x0, x1], [y0, y1]) {
  const pts = [];
  const add = (x, y) => {
    if (x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9 && !pts.some((p) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9)) pts.push([x, y]);
  };
  if (Math.abs(w[1]) > 1e-12) {
    add(x0, -(w[0] * x0 + b) / w[1]);
    add(x1, -(w[0] * x1 + b) / w[1]);
  }
  if (Math.abs(w[0]) > 1e-12) {
    add(-(w[1] * y0 + b) / w[0], y0);
    add(-(w[1] * y1 + b) / w[0], y1);
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
