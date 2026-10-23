/* Overfit Clinic — plotting helpers for charts.jsx (pure; kept out of the
   .jsx so Fast Refresh sees components-only files). */

export const lin = (d0, d1, r0, r1) => {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v) => r0 + (v - d0) * k;
};

export const logScale = (d0, d1, r0, r1) => {
  const a = Math.log10(d0);
  const b = Math.log10(d1);
  const k = (r1 - r0) / (b - a || 1);
  return (v) => r0 + (Math.log10(Math.max(v, d0 / 10)) - a) * k;
};

/** about n round ticks between min and max */
export function niceTicks(min, max, n = 4) {
  const span = max - min || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}

/** one tick per decade between min and max (both powers of ten or not) */
export function decadeTicks(min, max) {
  const out = [];
  for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) out.push(e);
  return out;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 10^e as text: 1, 10, 100 … or 10⁻⁵ */
export function decadeLabel(e) {
  if (e >= 0 && e <= 3) return String(10 ** e);
  if (e === -1) return '0.1';
  return `10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

export function tickLabel(v) {
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-AU');
  return String(Number(v.toPrecision(3)));
}

export const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

/** cell fill for a heat map: a 0–1 weight (or a signed −1…1 value) as a colour-mix percentage */
export function heatFill(v, signed) {
  if (signed) {
    const p = Math.round(Math.min(1, Math.abs(v)) * 85);
    return `color-mix(in srgb, var(${v >= 0 ? '--dl8s-k' : '--dl8s-q'}) ${p}%, var(--surface))`;
  }
  return `color-mix(in srgb, var(--dl8s-pos) ${Math.round(Math.min(1, v) * 88)}%, var(--surface))`;
}

/** a strong cell's text switches to the floor colour so it stays legible in every theme */
export const heatStrong = (v, signed) => (signed ? Math.abs(v) : v) > 0.5;
