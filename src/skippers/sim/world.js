/* The venue + conditions as plain data the physics and the scorer share.
   Layout comes from public/skippers-sim/venue-layout.json (measured by the
   asset build; see Documents/skippers/sim/layout.md). PROVISIONAL below is a
   fallback with the same shape, used only if the JSON can't be read. */

import { prepCollider, rng } from './physics.js';

const D = Math.PI / 180;
// ramp axis helpers: A = seaward along the ramp (≈20° true), C = to the right of A
const rampFrame = (hdg) => {
  const A = [Math.sin(hdg * D), Math.cos(hdg * D)]; const C = [Math.cos(hdg * D), -Math.sin(hdg * D)];
  return (a, c) => [a * A[0] + c * C[0], a * A[1] + c * C[1]];
};
const rect = (P, a0, a1, c0, c1) => [P(a0, c0), P(a0, c1), P(a1, c1), P(a1, c0)];

export function provisionalLayout() {
  const hdg = 20; const P = rampFrame(hdg);
  const moorings = [];
  const r = rng(7);
  for (let i = 0; i < 9; i++) {
    const a = 90 + (i % 3) * 45 + r() * 15; const c = -70 + Math.floor(i / 3) * 55 + r() * 15;
    const [x, y] = P(a, c);
    moorings.push({ name: `mooring_${String(i + 1).padStart(2, '0')}`, x, y, len: i % 2 ? 9 : 6.5, headingDeg: 110, kind: i % 2 ? 'yacht' : 'runabout' });
  }
  return {
    provisional: true,
    rampHeadingDeg: hdg,
    jetty: {
      length: 36, width: 1.6, deckHeight: 1.0, poly: rect(P, -36, 0, -0.8, 0.8),
      cleats: [{ name: 'cleat_e1', ...xy(P(-6, 0.7)), side: 'east' }, { name: 'cleat_e2', ...xy(P(-15, 0.7)), side: 'east' }],
      lightPole: { ...xy(P(-0.6, 0)), h: 6 },
    },
    berths: [{ id: 'east', edge: [P(-30, 0.8), P(0, 0.8)], outward: P(0, 1) }, { id: 'west', edge: [P(-30, -0.8), P(0, -0.8)], outward: P(0, -1) }],
    colliders: [
      { name: 'jetty', kind: 'jetty', poly: rect(P, -36, 0, -0.8, 0.8) },
      { name: 'rock_west', kind: 'rock', poly: rect(P, -40, 4, -16, -6.5) },
      { name: 'rock_east', kind: 'rock', poly: rect(P, -40, 4, 6.5, 16) },
      { name: 'ramp_head', kind: 'ramp', poly: rect(P, -60, -30, -6.5, 6.5) },
      { name: 'shore_w', kind: 'shore', poly: rect(P, -120, -24, -400, -16) },
      { name: 'shore_e', kind: 'shore', poly: rect(P, -120, -24, 16, 400) },
      ...moorings.map((m) => ({ name: m.name, kind: 'moored', poly: boatPoly(m) })),
    ],
    water: { poly: rect(P, -40, 450, -400, 400) },
    moorings,
    transits: [{ id: 't1', front: { name: 'jetty light pole', ...xy(P(-0.6, 0)), h: 6 }, back: { name: 'tall Norfolk pine on the Esplanade', ...xy(P(-95, 3)), h: 22 }, sayAs: 'the jetty light pole lined up with the tall Norfolk pine behind it' }],
    landmarks: [],
    swimArea: null,
  };
}
function xy([x, y]) { return { x, y }; }
export function boatPoly(m) {
  const h = (m.headingDeg ?? 0) * D; const f = [Math.sin(h), Math.cos(h)]; const s = [Math.cos(h), -Math.sin(h)];
  const L = m.len ?? 7; const B = L * 0.36;
  const pts = [[0, L / 2], [B / 2, L / 4], [B / 2, -L / 2], [-B / 2, -L / 2], [-B / 2, L / 4]];
  return pts.map(([px, py]) => [m.x + px * s[0] + py * f[0], m.y + px * s[1] + py * f[1]]);
}

/* Build everything the sim needs from a layout. */
export function buildWorld(layout) {
  const L = layout ?? provisionalLayout();
  const hdg = L.rampHeadingDeg ?? 20;
  const P = rampFrame(hdg);
  const colliders = (L.colliders ?? []).map(prepCollider);
  // moored boats as colliders if the layout didn't already include them
  for (const m of L.moorings ?? []) if (!colliders.some((c) => c.name === m.name)) colliders.push(prepCollider({ name: m.name, kind: 'moored', poly: boatPoly(m) }));
  const berth = (L.berths ?? []).find((b) => b.id === 'east') ?? L.berths?.[0];
  return { layout: L, hdg, P, colliders, berth, moorings: L.moorings ?? [], transits: L.transits ?? [] };
}

/* Distance from point to polygon edge (0 if inside). */
export function distToPoly(p, poly) {
  let inside = false; let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]; const b = poly[i];
    if ((b[1] > p[1]) !== (a[1] > p[1]) && p[0] < ((a[0] - b[0]) * (p[1] - b[1])) / (a[1] - b[1]) + b[0]) inside = !inside;
    const ex = b[0] - a[0]; const ey = b[1] - a[1]; const l2 = ex * ex + ey * ey || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey));
  }
  return inside ? 0 : best;
}

/* Game conditions (NOT DoT data): two presets, randomised within range. */
export const PRESETS = {
  morning: { label: 'Morning: light easterly', windFrom: [70, 110], windKn: [5, 10], currentTo: [300, 340], currentKn: [0.1, 0.3] },
  afternoon: { label: 'Afternoon: SW sea breeze', windFrom: [205, 235], windKn: [10, 15], currentTo: [10, 50], currentKn: [0.1, 0.4] },
};
export function makeConditions(preset = 'morning', seed = 1) {
  const p = PRESETS[preset] ?? PRESETS.morning; const r = rng(seed * 7919 + 13);
  const pick = ([a, b]) => a + (b - a) * r();
  const wFrom = pick(p.windFrom); const wKn = pick(p.windKn); const cTo = pick(p.currentTo); const cKn = pick(p.currentKn);
  const ms = 1 / 1.943844;
  // wind vector points where the air is going (from + 180°)
  const wTo = (wFrom + 180) * D;
  return {
    preset, label: p.label, windFromDeg: wFrom, windKn: wKn, currentToDeg: cTo, currentKn: cKn,
    wind: [Math.sin(wTo) * wKn * ms, Math.cos(wTo) * wKn * ms],
    current: [Math.sin(cTo * D) * cKn * ms, Math.cos(cTo * D) * cKn * ms],
  };
}
