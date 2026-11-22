#!/usr/bin/env node
/* Venue layout for the Skippers practical sim (Palm Beach EAST ramp, Rockingham WA).

     node tools/skippers-sim/layout.mjs        → public/skippers-sim/venue-layout.json

   Single source of truth: every measured number lives here (method + numbers in
   Documents/skippers/sim/layout.md). The Blender venue script reads the JSON this writes,
   so the GLB and the physics always agree.

   Frame (the contract): metres, X = east, Y = north, Z = up. Origin = seaward end (head) of
   the centre jetty, on its centreline, z = 0 at mean water level.
   Ramp axis frame used below: s = metres along the ramp axis toward the sea (head = 0,
   landward is negative), t = metres across it, + = east side. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(REPO, 'public/skippers-sim/venue-layout.json');

// ── measured (Google Maps satellite z20/z21 + scale bar; see layout.md) ───────────────────
const HEADING = 17; // ramp/jetty axis, degrees true (seaward). Measured 16–17.2° on two zooms.
const JETTY_LEN = 33; // head → shore root, m (z21: 391 px × 0.0849 m/px = 33.2)
const JETTY_W = 1.7; // deck width, m (≈ 20 px at z21; ±0.3)
const DECK_H = 0.8; // deck above MWL at the head, m (Street View estimate)
const RAMP_W = 11.5; // concrete ramp, kerb to kerb, m (z21 135 px ⊥ × 0.0849)
const RAMP_TOE_S = -23; // where the concrete meets the water in the imagery (≈ MWL)
const RAMP_TOP_S = -62; // top of the slope / turnaround apron
const LANE_W = (RAMP_W - JETTY_W) / 2; // ≈ 4.9 m each

const th = (HEADING * Math.PI) / 180;
const U = [Math.sin(th), Math.cos(th)]; // seaward along the axis
const V = [Math.cos(th), -Math.sin(th)]; // across, east side
const P = (s, t) => [r2(s * U[0] + t * V[0]), r2(s * U[1] + t * V[1])];
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const quadST = (s0, s1, t0, t1) => [P(s0, t0), P(s0, t1), P(s1, t1), P(s1, t0)];

// polygon helpers: CCW + convex hull (colliders must be convex, CCW)
const area = (p) => p.reduce((a, q, i) => a + (q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1]), 0) / 2;
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return ccw([...lo.slice(0, -1), ...up.slice(0, -1)]);
}

// ── jetty ─────────────────────────────────────────────────────────────────────────────────
const jettyPoly = ccw(quadST(-JETTY_LEN, 0, -JETTY_W / 2, JETTY_W / 2));
const cleats = [];
[-2, -8, -14, -20].forEach((s, i) => {
  const e = P(s, JETTY_W / 2 - 0.12), w = P(s, -JETTY_W / 2 + 0.12);
  cleats.push({ name: `cleat_e${i + 1}`, x: e[0], y: e[1], side: 'east' });
  cleats.push({ name: `cleat_w${i + 1}`, x: w[0], y: w[1], side: 'west' });
});
const pole = P(-0.4, 0);

// ── rock revetments (z21 satellite, converted to s/t) ─────────────────────────────────────
const rockWest = hull([P(-24.5, -RAMP_W / 2), P(-25, -18), P(-46, -11.5), P(-46, -RAMP_W / 2)]);
const rockEast = hull([P(-22, RAMP_W / 2), P(-21.9, 10.1), P(-40.3, 13.8), P(-48.3, 11), P(-48.3, RAMP_W / 2)]);

// ── shore waterline (west → east), Blender x/y. z18 + z21 satellite, sand/water edge ──────
const SHORE_W = [[-460, 35], [-250, 24], [-112, 19], [-78, -2], [-40, -17], [-22, -23]];
const SHORE_E = [[3, -40], [30, -50], [80, -59], [212, -88], [338, -125], [470, -146]];
const shoreQuads = (line, name) =>
  line.slice(0, -1).map((a, i) => {
    const b = line[i + 1];
    return { name: `${name}_${String(i + 1).padStart(2, '0')}`, kind: 'shore', poly: ccw([a, b, [b[0], b[1] - 60], [a[0], a[1] - 60]]) };
  });
// the strip between each beach and its rock wall, so there is no gap at the rock toes
const shoreGapW = { name: 'shore_w_rockjoin', kind: 'shore', poly: hull([[-22, -23], [-40, -17], P(-25, -18), P(-46, -11.5), [-40, -77], [-22, -83]]) };
const shoreGapE = { name: 'shore_e_rockjoin', kind: 'shore', poly: hull([P(-21.9, 10.1), P(-40.3, 13.8), [3, -40], [3, -100], P(-48.3, 11)]) };

// ── the CLOSED west ramp + groyne (~100 m west, by the Rotary Beach Front toilets) ────────
const westGroyne = ccw([[-104, -20], [-99.5, -20], [-96.5, 16], [-101, 16]]);
const westRamp = ccw([[-118, -24], [-105, -24], [-104, 2], [-117, 2]]);

// ── Palm Beach jetty (long public jetty to the east; visual + collider) ───────────────────
const pbjHead = [349, -44], pbjRoot = [339, -157];
const pbj = (() => {
  const d = [pbjHead[0] - pbjRoot[0], pbjHead[1] - pbjRoot[1]], L = Math.hypot(...d), n = [d[1] / L * 1.7, -d[0] / L * 1.7];
  return ccw([[pbjRoot[0] - n[0], pbjRoot[1] - n[1]], [pbjRoot[0] + n[0], pbjRoot[1] + n[1]], [pbjHead[0] + n[0], pbjHead[1] + n[1]], [pbjHead[0] - n[0], pbjHead[1] - n[1]]]);
})();

// ── moorings: boats visible in the z18 satellite (positions measured), bows to the SW sea breeze
const MOORED = [
  [36, 97, 'runabout'], [17, 138, 'yacht'], [87, 136, 'yacht'], [154, 140, 'yacht'], [172, 81, 'runabout'],
  [140, 49, 'runabout'], [204, 35, 'yacht'], [246, 84, 'yacht'], [68, 208, 'yacht'], [134, 201, 'yacht'],
  [212, 170, 'yacht'], [316, 211, 'yacht'], [-283, 168, 'yacht'], [-289, 245, 'yacht'],
]; // all 14 measured off the z18 satellite (boats further W/E fall outside the playable box)
const moorings = MOORED.map(([x, y, kind], i) => ({
  name: `mooring_${String(i + 1).padStart(2, '0')}`, x, y, len: kind === 'yacht' ? 9 : 5.5,
  headingDeg: 205 + ((i * 37) % 21) - 10, kind,
}));
const mooredColliders = moorings.map((m) => {
  const h = (m.headingDeg * Math.PI) / 180, f = [Math.sin(h), Math.cos(h)], r = [Math.cos(h), -Math.sin(h)], b = m.kind === 'yacht' ? 1.6 : 1.1;
  const pt = (a, c) => [r2(m.x + f[0] * a + r[0] * c), r2(m.y + f[1] * a + r[1] * c)];
  return { name: `moored_${m.name.slice(8)}`, kind: 'moored', poly: ccw([pt(m.len / 2, 0), pt(m.len * 0.15, b), pt(-m.len / 2, b * 0.85), pt(-m.len / 2, -b * 0.85), pt(m.len * 0.15, -b)]) };
});

// ── transits (front low, back high) ───────────────────────────────────────────────────────
const TREE_BEHIND = { name: 'big_tree_behind_ramp', x: -4.4, y: -96, h: 13 }; // round canopy tree, park E of ramp top
const PINE_A = { name: 'norfolk_pine_a', x: 97, y: -117, h: 24 }; // Esplanade pine cluster E of the ramp
const POLE = { name: 'jetty_light_pole', x: pole[0], y: pole[1], h: 6 };
const PBJ_LIGHT = { name: 'palm_beach_jetty_head_light', x: pbjHead[0], y: pbjHead[1], h: 4.5 };
const PINE_B = { name: 'norfolk_pine_b', x: 380, y: -175, h: 22 }; // pine on the Esplanade behind the Palm Beach jetty root (provisional)

const layout = {
  provisional: false,
  generatedBy: 'tools/skippers-sim/layout.mjs',
  origin: { lat: -32.27532, lon: 115.71691, note: 'jetty head (seaward end of the centre jetty), eastern Palm Beach ramp, Rockingham' },
  rampHeadingDeg: HEADING,
  ramp: {
    width: RAMP_W, laneWidth: r2(LANE_W), toeS: RAMP_TOE_S, topS: RAMP_TOP_S, slope: 0.12,
    note: 's = metres along the axis (seaward +), t = across (east +): P(s,t) = s*[sin h, cos h] + t*[cos h, -sin h]. Concrete continues ~10 m below MWL past the toe.',
    lanes: [
      { id: 'west', poly: ccw(quadST(RAMP_TOP_S, RAMP_TOE_S + 10, -RAMP_W / 2, -JETTY_W / 2)) },
      { id: 'east', poly: ccw(quadST(RAMP_TOP_S, RAMP_TOE_S + 10, JETTY_W / 2, RAMP_W / 2)) },
    ],
  },
  jetty: {
    length: JETTY_LEN, width: JETTY_W, deckHeight: DECK_H, deckHeightRoot: 1.5, poly: jettyPoly, cleats,
    lightPole: { x: pole[0], y: pole[1], h: 6 },
    note: 'deck level at 0.8 m from the head to s = -23 (ramp toe), then rises with the ramp to the root at s = -33. Green FRP grating deck, black posts along the east edge.',
  },
  berths: [
    { id: 'east', edge: [P(-22, JETTY_W / 2), P(-1, JETTY_W / 2)], outward: [r3(V[0]), r3(V[1])], note: 'east lane side' },
    { id: 'west', edge: [P(-22, -JETTY_W / 2), P(-1, -JETTY_W / 2)], outward: [r3(-V[0]), r3(-V[1])], note: 'west lane side' },
  ],
  colliders: [
    { name: 'jetty_centre', kind: 'jetty', poly: jettyPoly },
    { name: 'rock_west', kind: 'rock', poly: rockWest },
    { name: 'rock_east', kind: 'rock', poly: rockEast },
    { name: 'ramp_lane_west', kind: 'ramp', poly: ccw(quadST(RAMP_TOP_S, RAMP_TOE_S, -RAMP_W / 2, -JETTY_W / 2)) },
    { name: 'ramp_lane_east', kind: 'ramp', poly: ccw(quadST(RAMP_TOP_S, RAMP_TOE_S, JETTY_W / 2, RAMP_W / 2)) },
    ...shoreQuads(SHORE_W, 'shore_w'),
    ...shoreQuads(SHORE_E, 'shore_e'),
    shoreGapW, shoreGapE,
    { name: 'closed_groyne_west', kind: 'closed_ramp', poly: westGroyne },
    { name: 'closed_ramp_west', kind: 'closed_ramp', poly: westRamp },
    { name: 'palm_beach_jetty', kind: 'jetty', poly: pbj },
    ...mooredColliders,
  ],
  water: { poly: ccw([[-300, -160], [360, -160], [360, 460], [-300, 460]]), note: 'playable box; land is cut out by the shore/rock/ramp colliders' },
  moorings,
  transits: [
    { id: 't1', front: POLE, back: TREE_BEHIND, bearingDeg: 182, sayAs: 'the jetty light pole lined up with the big round tree in the park behind the ramp: run in from the moorings on about 182°' },
    { id: 't2', front: POLE, back: PINE_A, bearingDeg: 140, sayAs: 'the jetty light pole lined up with the tall Norfolk pine on the Esplanade (the cluster east of the ramp): run in from the north-west on about 140°' },
    { id: 't3', front: PBJ_LIGHT, back: PINE_B, bearingDeg: 166, provisional: true, sayAs: 'the Palm Beach jetty head light lined up with the Norfolk pine behind its root: run south toward the long jetty on about 166°' },
  ],
  landmarks: [
    { name: 'palm_beach_jetty', x: 344, y: -100, head: pbjHead, root: pbjRoot, length: 114 },
    { name: 'closed_west_ramp', x: -108, y: -6, note: 'CLOSED for renovation: fenced, do not use' },
    { name: 'polo_beach', x: -60, y: -30 },
    { name: 'rotary_beach_front_toilets', x: -161, y: -21 },
    { name: 'garden_island', x: -3900, y: 7400, bearingDeg: 332, distanceM: 8400, note: '4–13 km NW; visual proxy in the GLB is bearing-true but pulled in to 2.5 km' },
    { name: 'kwinana_industrial', x: 3500, y: 7000, bearingDeg: 27, note: 'industrial shoreline far NE; visual proxy at 2.5 km' },
    { name: 'pano_hkJyp6FInXYqglHZyQVZDA', x: -15.1, y: -41.2, note: 'Street View (Jul 2024) on the ramp' },
  ],
  swimArea: null,
  pines: [PINE_A, { name: 'norfolk_pine_c', x: 57, y: -108, h: 20 }, { name: 'norfolk_pine_d', x: 116, y: -127, h: 23 }, { name: 'norfolk_pine_e', x: 136, y: -129, h: 21 }, { name: 'norfolk_pine_f', x: 194, y: -144, h: 22 }, PINE_B],
};

// sanity: every collider convex + CCW
for (const c of layout.colliders) {
  const p = c.poly;
  if (area(p) <= 0) throw new Error(`${c.name} not CCW`);
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], d = p[(i + 2) % p.length];
    if ((b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]) < -1e-6) throw new Error(`${c.name} not convex`);
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(layout, null, 1));
console.log(`✓ ${path.relative(REPO, OUT)}: ${layout.colliders.length} colliders, ${moorings.length} moorings, ${layout.transits.length} transits`);
