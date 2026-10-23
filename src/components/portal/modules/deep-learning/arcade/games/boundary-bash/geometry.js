/* Boundary Bash — plot geometry (pure; no facts). A square view of the
   (x₁, x₂) plane, the clipped boundary wᵀx + b = 0, its ŷ = 1 half-plane,
   and the w arrow; plus the Figure 10-6b layout for the XOR network. */

export function makeView(lo, hi, size = 320, pad = 18) {
  const k = (size - 2 * pad) / (hi - lo);
  return {
    lo, hi, size, pad, k,
    sx: (x) => pad + (x - lo) * k,
    sy: (y) => size - pad - (y - lo) * k,
  };
}

const f = (w, b, p) => w[0] * p[0] + w[1] * p[1] + b;

// poly ∩ {side·(wᵀx + b) ≥ 0} (Sutherland–Hodgman against one half-plane)
export function clip(poly, w, b, side = 1) {
  const g = (p) => side * f(w, b, p);
  const out = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const gp = g(p);
    const gq = g(q);
    if (gp >= 0) out.push(p);
    if ((gp >= 0) !== (gq >= 0)) {
      const t = gp / (gp - gq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}

export const box = (lo, hi) => [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];

// the box ∩ {wᵀx + b ≥ 0} (side = 1) or {wᵀx + b ≤ 0} (side = −1)
export const halfPlane = (w, b, lo, hi, side = 1) => clip(box(lo, hi), w, b, side);

// the boundary line clipped to the box: [[x, y], [x, y]] or null
export function boundarySeg(w, b, lo, hi) {
  if (!w[0] && !w[1]) return null;
  const pts = [];
  const add = (p) => {
    if (p[0] < lo - 1e-9 || p[0] > hi + 1e-9 || p[1] < lo - 1e-9 || p[1] > hi + 1e-9) return;
    if (pts.some((q) => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7)) return;
    pts.push(p);
  };
  if (w[1]) [lo, hi].forEach((x) => add([x, -(w[0] * x + b) / w[1]]));
  if (w[0]) [lo, hi].forEach((y) => add([-(w[1] * y + b) / w[0], y]));
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

// where to draw the w arrow: from a point of the line near the view's centre, along w, slid
// along the line away from the point on show (`avoid`) so the two never overlap
export function wArrow(w, b, lo, hi, len, avoid = null) {
  const n2 = w[0] * w[0] + w[1] * w[1];
  if (!n2) return null;
  const n = Math.sqrt(n2);
  const c = [(lo + hi) / 2, (lo + hi) / 2];
  const t0 = f(w, b, c) / n2;
  const foot0 = [c[0] - t0 * w[0], c[1] - t0 * w[1]];
  const d = [-w[1] / n, w[0] / n];
  const u = [w[0] / n, w[1] / n];
  const m = 0.5;
  const inside = (p) => p[0] >= lo + m && p[0] <= hi - m && p[1] >= lo + m && p[1] <= hi - m;
  let best = null;
  [0, 1.5, -1.5, 2.6, -2.6].forEach((s) => {
    const foot = [foot0[0] + s * d[0], foot0[1] + s * d[1]];
    const tip = [foot[0] + len * u[0], foot[1] + len * u[1]];
    if (!inside(foot) || !inside(tip)) return;
    const mid = [(foot[0] + tip[0]) / 2, (foot[1] + tip[1]) / 2];
    const gap = avoid ? Math.min(...[foot, mid, tip].map((p) => Math.hypot(p[0] - avoid[0], p[1] - avoid[1]))) : 9;
    const score = Math.min(gap, 1.6) - Math.abs(s) * 0.01;
    if (!best || score > best.score) best = { foot, tip, score };
  });
  if (best) return { foot: best.foot, tip: best.tip };
  return { foot: foot0, tip: [foot0[0] + len * u[0], foot0[1] + len * u[1]] };
}

// a label spot for a point: off the point, on the side away from the boundary, kept in the box
// (in view pixels; the text is centred on the returned spot, about halfW wide)
export function pointLabel(view, w, b, x, halfW = 26) {
  const n = Math.hypot(w[0], w[1]) || 1;
  const zx = f(w, b, x);
  const away = zx < 0 ? -1 : 1;
  const lo = view.pad + halfW + 2;
  const hi = view.size - view.pad - halfW - 2;
  const toData = (px, py) => [view.lo + (px - view.pad) / view.k, view.lo + (view.size - view.pad - py) / view.k];
  const px0 = view.sx(x[0]);
  const py0 = view.sy(x[1]);
  // candidate centres: off along the normal (away from the line), above, below, then toward the line
  const raw = [
    [px0 + ((away * w[0]) / n) * (halfW + 12), py0 - ((away * w[1]) / n) * 22 + 4],
    [px0, py0 - 17],
    [px0, py0 + 25],
    [px0 - ((away * w[0]) / n) * (halfW + 12), py0 + ((away * w[1]) / n) * 22 + 4],
  ];
  const scored = raw.map(([px, py], i) => {
    const cx = Math.min(hi, Math.max(lo, px));
    const cy = Math.min(view.size - view.pad - 4, Math.max(view.pad + 12, py));
    // the label's ends and centre stay on the point's side of the boundary (unless the point is on it)
    const clear = zx === 0 || [-halfW, 0, halfW].every((dx) => Math.sign(f(w, b, toData(cx + dx, cy - 4))) === Math.sign(zx));
    // and the label box keeps off the marker itself
    const offMarker = Math.abs(cx - px0) > halfW + 6 || Math.abs(cy - 4 - py0) > 12;
    return { at: [cx, cy], bad: (Math.hypot(cx - px, cy - py) > 4 ? 2 : 0) + (clear ? 0 : 3) + (offMarker ? 0 : 5), i };
  });
  scored.sort((p, q) => p.bad - q.bad || p.i - q.i);
  return scored[0].at;
}

// a label spot just inside the box near one end of a segment
export function segLabel(seg, lo, hi, inset = 0.35, which = 0) {
  const [a, b] = which ? [seg[1], seg[0]] : seg;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const p = [a[0] + ((b[0] - a[0]) / d) * inset, a[1] + ((b[1] - a[1]) / d) * inset];
  return [Math.min(hi - 0.15, Math.max(lo + 0.15, p[0])), Math.min(hi - 0.15, Math.max(lo + 0.15, p[1]))];
}

/* Figure 10-6b's layout (viewBox 0 0 300 262). */
export const MLP = {
  w: 300,
  h: 262,
  r: 21,
  x: [[80, 238], [200, 238]],
  hid: [[80, 140], [200, 140]],
  out: [140, 48],
  // weight-label spots: in[i][j] for input i → hidden j; v[j] for hidden j → output
  wIn: [[[80, 196], [113, 210]], [[167, 210], [200, 196]]],
  wOut: [[108, 96], [172, 96]],
  bias: [[121, 128], [241, 128]],
  biasOut: [181, 36],
};

export function edge(a, b, ra, rb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  return { x1: a[0] + (dx / d) * ra, y1: a[1] + (dy / d) * ra, x2: b[0] - (dx / d) * rb, y2: b[1] - (dy / d) * rb };
}

export function arrowHead(x2, y2, x1, y1, size = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (ang) => `${x2 - size * Math.cos(a + ang)},${y2 - size * Math.sin(a + ang)}`;
  return `${x2},${y2} ${p(0.45)} ${p(-0.45)}`;
}
