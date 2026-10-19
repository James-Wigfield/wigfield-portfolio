/* ============================================================================
   DL PROJECT 2 — SCENE GEOMETRY HELPERS
   Small pure functions shared by the scene art: scales, paths, number format.
   ========================================================================== */

// linear scale: lin(d0, d1, r0, r1)(v)
export const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

// [[x, y], …] → "M x y L x y …"
export const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

// a series of values on an x scale starting at month m0 (1-based)
export const seriesPath = (vals, x, y, m0 = 1) => pathOf(vals.map((v, i) => [x(m0 + i), y(v)]));

export const fmt = (v, d = 1) => Number(v).toFixed(d);

// thousands separator, Keras style (1,234)
export const thou = (n) => Number(n).toLocaleString('en-AU');

export const range = (n, start = 0) => Array.from({ length: n }, (_, i) => start + i);

// a horizontal bracket ⎴ from x0 to x1 at y (tick height h, pointing down)
export const bracket = (x0, x1, y, h = 6) => `M${x0} ${y + h}V${y}H${x1}V${y + h}`;
