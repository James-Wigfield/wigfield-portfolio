/* ============================================================================
   DESCENT — THE HOLES (closed-form 2D loss surfaces, analytic gradients)
   ----------------------------------------------------------------------------
   A hole is plain JSON (so a round item stays serialisable):
     { kind, p: {…surface params}, start: [θ₁, θ₂], flag: [θ₁, θ₂], r, eta, nMax }
   buildHole(spec) → { J(θ), grad(θ) } rebuilds the surface from it.

   The course is θ₁ ∈ [−5, 5] (horizontal) × θ₂ ∈ [−3, 3] (vertical): the
   game's own range (the slides' contour figures, Figure 11-7 and 11-8, print
   no axis values).

   kinds (the surface; which club it rewards is checked by actually running
   every club in maths/descentItems.js):
     bowl     ½(a(θ₁−f₁)² + b(θ₂−f₂)²), b ≫ a — the elongated bowl (slide 38)
     flats    ½k((θ₁−f₁)² + q(θ₂−f₂)²) with ηk tiny — the local gradient is
              tiny (slide 34)
     dimple   a gentle bowl with a Gaussian dip on the way — a local optimum
              (slide 34)
     narrow   a tilted narrow bowl at a large η — momentum overshoots
              (Figure 11-7, slides 36–37)
     valley   a long valley floor of constant slope k, then the flag —
              a long course (slides 40–41)
     cliff    a gentle bowl with a steep wall: the gradient explodes there
              (slide 29)
     round    ½k|θ − f|² — a plain bowl for the learning-rate dial (slide 48)

   contours(spec, levels) → [{ level, d }] SVG paths (marching squares) in
   course coordinates mapped by toSvg().
   ========================================================================== */

export const COURSE = { x0: -5, x1: 5, y0: -3, y1: 3, W: 600, H: 360 };
export const toSvg = ([x, y]) => [((x - COURSE.x0) / (COURSE.x1 - COURSE.x0)) * COURSE.W, ((COURSE.y1 - y) / (COURSE.y1 - COURSE.y0)) * COURSE.H];

const sq = (v) => v * v;

export function buildHole(spec) {
  const { kind, p } = spec;
  switch (kind) {
    case 'bowl':
    case 'flats': {
      const a = kind === 'bowl' ? p.a : p.k;
      const b = kind === 'bowl' ? p.b : p.k * p.q;
      const [f1, f2] = spec.flag;
      return {
        J: ([x, y]) => 0.5 * (a * sq(x - f1) + b * sq(y - f2)),
        grad: ([x, y]) => [a * (x - f1), b * (y - f2)],
      };
    }
    case 'round': {
      const [f1, f2] = spec.flag;
      return {
        J: ([x, y]) => 0.5 * p.k * (sq(x - f1) + sq(y - f2)),
        grad: ([x, y]) => [p.k * (x - f1), p.k * (y - f2)],
      };
    }
    case 'narrow': {
      // rotated: u along the valley, v across it
      const [f1, f2] = spec.flag;
      const c = Math.cos(p.phi);
      const s = Math.sin(p.phi);
      const uv = (x, y) => [c * (x - f1) + s * (y - f2), -s * (x - f1) + c * (y - f2)];
      return {
        J: ([x, y]) => {
          const [u, v] = uv(x, y);
          return 0.5 * (p.a * u * u + p.b * v * v);
        },
        grad: ([x, y]) => {
          const [u, v] = uv(x, y);
          const gu = p.a * u;
          const gv = p.b * v;
          return [c * gu - s * gv, s * gu + c * gv];
        },
      };
    }
    case 'dimple': {
      const [f1, f2] = spec.flag;
      const { k, A, sigma, d } = p;
      const e = (x, y) => Math.exp(-(sq(x - d[0]) + sq(y - d[1])) / (2 * sigma * sigma));
      return {
        J: ([x, y]) => 0.5 * k * (sq(x - f1) + sq(y - f2)) - A * e(x, y),
        grad: ([x, y]) => {
          const ex = e(x, y);
          return [k * (x - f1) + (A * ex * (x - d[0])) / (sigma * sigma), k * (y - f2) + (A * ex * (y - d[1])) / (sigma * sigma)];
        },
      };
    }
    case 'valley': {
      const [f1, f2] = spec.flag;
      const { k, w, b } = p;
      return {
        J: ([x, y]) => k * (Math.sqrt(w * w + sq(x - f1)) - w) + 0.5 * b * sq(y - f2),
        grad: ([x, y]) => [(k * (x - f1)) / Math.sqrt(w * w + sq(x - f1)), b * (y - f2)],
      };
    }
    case 'cliff': {
      // a gentle round bowl plus a steep wall rising to the left of x = wx
      const [f1, f2] = spec.flag;
      const { k, H, wx, delta, tilt } = p;
      const z = (x, y) => (wx + tilt * y - x) / delta; // > 0 on the wall side
      const sp = (t) => (t > 30 ? t : Math.log1p(Math.exp(t)));
      const sig = (t) => 1 / (1 + Math.exp(-t));
      return {
        J: ([x, y]) => 0.5 * k * (sq(x - f1) + sq(y - f2)) + H * sp(z(x, y)),
        grad: ([x, y]) => {
          const g = (H * sig(z(x, y))) / delta;
          return [k * (x - f1) - g, k * (y - f2) + g * tilt];
        },
      };
    }
    default:
      throw new Error(`unknown hole kind ${kind}`);
  }
}

/* ── contours: marching squares over the course ───────────────────────── */
export function sampleGrid(J, nx = 96, ny = 58) {
  const { x0, x1, y0, y1 } = COURSE;
  const vals = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= ny; j++) {
    const row = [];
    const y = y0 + ((y1 - y0) * j) / ny;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const v = J([x, y]);
      row.push(v);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    vals.push(row);
  }
  return { vals, nx, ny, lo, hi };
}

const fmt = (v) => Math.round(v * 10) / 10;

export function contourPath(grid, level) {
  const { vals, nx, ny } = grid;
  const { x0, x1, y0, y1 } = COURSE;
  const X = (i) => toSvg([x0 + ((x1 - x0) * i) / nx, 0])[0];
  const Y = (j) => toSvg([0, y0 + ((y1 - y0) * j) / ny])[1];
  const lerp = (a, b, va, vb) => a + ((level - va) / (vb - va)) * (b - a);
  let d = '';
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = vals[j][i];
      const v10 = vals[j][i + 1];
      const v01 = vals[j + 1][i];
      const v11 = vals[j + 1][i + 1];
      const pts = [];
      if ((v00 < level) !== (v10 < level)) pts.push([lerp(X(i), X(i + 1), v00, v10), Y(j)]);
      if ((v10 < level) !== (v11 < level)) pts.push([X(i + 1), lerp(Y(j), Y(j + 1), v10, v11)]);
      if ((v01 < level) !== (v11 < level)) pts.push([lerp(X(i), X(i + 1), v01, v11), Y(j + 1)]);
      if ((v00 < level) !== (v01 < level)) pts.push([X(i), lerp(Y(j), Y(j + 1), v00, v01)]);
      if (pts.length >= 2) d += `M${fmt(pts[0][0])} ${fmt(pts[0][1])}L${fmt(pts[1][0])} ${fmt(pts[1][1])}`;
      if (pts.length === 4) d += `M${fmt(pts[2][0])} ${fmt(pts[2][1])}L${fmt(pts[3][0])} ${fmt(pts[3][1])}`;
    }
  }
  return d;
}

/* Levels from the flag's loss upwards, spaced so low ground gets the most
   lines (u² spacing), `n` of them; returns [{ level, d, depth }] with depth
   0 (lowest) … 1 (highest). */
export function contours(spec, n = 12) {
  const { J } = buildHole(spec);
  const grid = sampleGrid(J);
  const lo = grid.lo;
  const hi = Math.min(grid.hi, lo + (grid.hi - lo) * 0.85);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const level = lo + (hi - lo) * u * u;
    out.push({ level, depth: u, d: contourPath(grid, level) });
  }
  return out;
}
