/* Heatmap colours for ./svgParts.jsx: a value's cell is the role colour
   (positive) or slate (negative) mixed into the stage floor by |v| / max.
   Kept in a .js file so the .jsx files export components only. */
export const ROLE_VAR = {
  c1: '--dl12r-c1',
  c0: '--dl12r-c0',
  fwd: '--dl12r-fwd',
  bwd: '--dl12r-bwd',
  w: '--dl12r-w',
  off: '--dl12r-off',
};

export function cellFill(role, v, max = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'transparent';
  const t = Math.min(1, Math.abs(v) / (max || 1));
  const p = Math.round(8 + t * 88);
  const hue = v >= 0 ? `var(${ROLE_VAR[role] ?? '--ink-3'})` : 'var(--dl12r-neg)';
  return `color-mix(in srgb, ${hue} ${p}%, var(--dl12r-floor))`;
}

// sequential (0 … 1) fill for weights: nothing at 0, the full colour at 1
export function weightFill(role, w) {
  const p = Math.round(Math.max(0, Math.min(1, w)) * 92 + 4);
  return `color-mix(in srgb, var(${ROLE_VAR[role] ?? '--ink-3'}) ${p}%, var(--dl12r-floor))`;
}

export const maxAbs = (M) => Math.max(1e-9, ...M.flat().filter((x) => x !== null).map((x) => Math.abs(x)));
