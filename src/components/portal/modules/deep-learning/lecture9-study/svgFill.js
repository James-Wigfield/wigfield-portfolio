/* Heatmap colours for ./svgParts.jsx: a value's cell is the role colour
   (positive) or the negative-reward colour (negative) mixed into the stage
   floor by |v| / max. −∞ (an impossible action) is drawn as a hatch by the
   caller, so it gets no fill here. Kept in a .js file so the .jsx files
   export components only. */
export const ROLE_VAR = {
  val: '--dl9s-val',
  ret: '--dl9s-ret',
  pol: '--dl9s-pol',
  act: '--dl9s-act',
  obs: '--dl9s-obs',
  agent: '--dl9s-agent',
  rpos: '--dl9s-rpos',
  env: '--dl9s-env',
};

export function cellFill(role, v, max = 1) {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return 'transparent';
  const t = Math.min(1, Math.abs(v) / (max || 1));
  const p = Math.round(8 + t * 82);
  const hue = v >= 0 ? `var(${ROLE_VAR[role] ?? '--ink-3'})` : 'var(--dl9s-neg)';
  return `color-mix(in srgb, ${hue} ${p}%, var(--dl9s-floor))`;
}

// sequential (0 … 1) fill for probabilities: nothing at 0, the full colour at 1
export function weightFill(role, w) {
  const p = Math.round(Math.max(0, Math.min(1, w)) * 92 + 4);
  return `color-mix(in srgb, var(${ROLE_VAR[role] ?? '--ink-3'}) ${p}%, var(--dl9s-floor))`;
}

export const maxAbs = (M) => Math.max(1e-9, ...M.flat().filter((x) => x !== null && Number.isFinite(x)).map((x) => Math.abs(x)));
