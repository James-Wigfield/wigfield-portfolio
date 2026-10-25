/* Heatmap colours for ./svgParts.jsx: a value's cell is the role colour
   (positive) or the negative colour (negative) mixed into the stage floor by
   |v| / max. −∞ is drawn as a hatch by the caller, so it gets no fill here.
   Kept in a .js file so the .jsx files export components only. The roles
   are the page's one visual vocabulary (stage.css). */
export const ROLE_VAR = {
  w: '--dltt-w', // weights
  b: '--dltt-b', // biases
  data: '--dltt-data', // data / activations
  batch: '--dltt-batch', // shape axes ↓
  h: '--dltt-h',
  wd: '--dltt-wd',
  c: '--dltt-c',
  t: '--dltt-t',
  f: '--dltt-f',
  p: '--dltt-p', // probability
  win: '--dltt-win', // window / kernel
  jump: '--dltt-jump', // stride jump
  nt: '--dltt-nt', // non-trainable
};

export function cellFill(role, v, max = 1) {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return 'transparent';
  const t = Math.min(1, Math.abs(v) / (max || 1));
  const p = Math.round(8 + t * 82);
  const hue = v >= 0 ? `var(${ROLE_VAR[role] ?? '--ink-3'})` : 'var(--dltt-neg)';
  return `color-mix(in srgb, ${hue} ${p}%, var(--dltt-floor))`;
}

// sequential (0 … 1) fill for probabilities: nothing at 0, the full colour at 1
export function weightFill(role, w) {
  const p = Math.round(Math.max(0, Math.min(1, w)) * 92 + 4);
  return `color-mix(in srgb, var(${ROLE_VAR[role] ?? '--ink-3'}) ${p}%, var(--dltt-floor))`;
}

// a light wash of a role colour (for cells and boxes that hold that role)
export const wash = (role, pct = 14) => `color-mix(in srgb, var(${ROLE_VAR[role] ?? '--ink-3'}) ${pct}%, var(--dltt-floor))`;

export const maxAbs = (M) => Math.max(1e-9, ...M.flat().filter((x) => x !== null && Number.isFinite(x)).map((x) => Math.abs(x)));
