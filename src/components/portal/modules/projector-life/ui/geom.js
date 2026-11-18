/* PROJECTOR LIFE — plan-view geometry for the panel's little SVG maps.
   Same frame as CONTRACTS §1 (x east, z south, centre (2.18, ·, 2.18)); the
   SVGs draw in metres relative to the centre, north up: (x − C, z − C). */

export const C = 2.18;
export const APOTHEM = 2.18;
export const CIRCUM = APOTHEM / Math.cos(Math.PI / 8);
export const FLATS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Corner k (between flat k−1 and flat k), plan coords relative to centre. */
export function corner(k, r = CIRCUM) {
  const a = (k * Math.PI) / 4 - Math.PI / 8;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/** Outward normal of flat k in plan coords. */
export function flatNormal(k) {
  const a = (k * Math.PI) / 4;
  return [Math.sin(a), -Math.cos(a)];
}

export const pts = (list) => list.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');

/** Octagon outline at apothem `a`. */
export function octagon(a = APOTHEM) {
  const r = a / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, k) => corner(k, r));
}

/** Floor-local (x east, y north from the SW bounding corner) → plan coords. */
export const floorLocalToPlan = ([x, y]) => [x - APOTHEM, APOTHEM - y];

/** World (x, z) ↔ plan. */
export const worldToPlan = (x, z) => [x - C, z - C];
export const planToWorld = (px, pz) => [px + C, pz + C];

/** Keep a plan point inside the octagon (with a margin). */
export function clampToOctagon(px, pz, margin = 0.12) {
  let x = px;
  let z = pz;
  const lim = APOTHEM - margin;
  for (let k = 0; k < 8; k++) {
    const [nx, nz] = flatNormal(k);
    const d = x * nx + z * nz;
    if (d > lim) {
      x -= (d - lim) * nx;
      z -= (d - lim) * nz;
    }
  }
  return [x, z];
}

/** Pretty patch name: 'wall-NE' → 'Wall NE', 'loft' → 'Loft deck'. */
export function patchName(id) {
  if (id === 'floor') return 'Floor';
  if (id === 'loft') return 'Loft deck';
  const m = /^(wall|roof)-(\w+)$/.exec(id || '');
  if (m) return `${m[1] === 'wall' ? 'Wall' : 'Roof'} ${m[2]}`;
  return id || '—';
}

export const TYPE_LABEL = { floor: 'Floor', wall: 'Wall', ceiling: 'Roof' };
