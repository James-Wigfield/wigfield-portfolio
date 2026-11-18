/* ============================================================================
   PROJECTOR LIFE — measuring the She'd GLB (pure, Node-safe, no three.js)
   ----------------------------------------------------------------------------
   Everything here works on plain "triangle soups" in WORLD space:
     prim = { name, kind: 'wall'|'glass'|'floor'|'loft'|'furniture'|'ceiling',
              positions: Float32Array (x,y,z…), index: Uint16/32Array | null }
   tools/projector-life/room-check.mjs parses the GLB's JSON + BIN chunks into
   that shape, runs measureRoom() and writes the result to room/measured.js
   (`--write`), or compares measured.js against a fresh measurement. The
   runtime only imports measured.js (static numbers, no measuring at load).
   ========================================================================== */

import { SHED, FLATS, cornerXZ, polygonArea } from './roomModel.js';
import {
  flatDist, wallLocalX, flatOfXZ, toFloorLocal, octagonFloorLocal,
  convexHull, clipConvex, simplifyPolygon, round3, ensureCCW, rect, inTri2, snapInto,
} from './geom2d.js';

const A = SHED.apothem;
const H = SHED.eaveY;
const WALL_POLY = rect(0, 0, SHED.side, H);
/** A wall-local rectangle, rounded to mm and snapped inside the wall patch. */
const wallRect = (x0, y0, x1, y1) => snapInto(round3(rect(x0, y0, x1, y1)), WALL_POLY);

/** Iterate a prim's triangles: fn(ia, ib, ic) with vertex indices (×3 into positions). */
export function forTris(prim, fn) {
  const { index, positions } = prim;
  if (index) for (let t = 0; t < index.length; t += 3) fn(index[t] * 3, index[t + 1] * 3, index[t + 2] * 3);
  else for (let t = 0; t < positions.length / 3; t += 3) fn(t * 3, (t + 1) * 3, (t + 2) * 3);
}

/** Unit normal y and area of a triangle. */
export function triNormal(P, a, b, c) {
  const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
  const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const L = Math.hypot(nx, ny, nz);
  return L < 1e-14 ? null : { nx: nx / L, ny: ny / L, nz: nz / L, area: L / 2 };
}

// ── loft deck ───────────────────────────────────────────────────────────────
/**
 * The deck: the height with the most upward-facing area between 0.8 and 1.6 m,
 * and the convex hull of the upward triangles at that height, clipped to the
 * octagon's inner faces (the beam ends poke a few mm into the walls).
 */
export function measureLoftDeck(loftPrims) {
  const byY = new Map();
  for (const prim of loftPrims) {
    const P = prim.positions;
    forTris(prim, (a, b, c) => {
      const n = triNormal(P, a, b, c);
      if (!n || n.ny < 0.95) return;
      const y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
      if (y < 0.8 || y > 1.6) return;
      const key = Math.round(y * 200) / 200; // 5 mm bins
      byY.set(key, (byY.get(key) || 0) + n.area);
    });
  }
  let deckY = SHED.loftDeckY;
  let best = 0;
  for (const [y, a] of byY) if (a > best) [best, deckY] = [a, y];
  const pts = [];
  let ySum = 0;
  let yN = 0;
  for (const prim of loftPrims) {
    const P = prim.positions;
    forTris(prim, (a, b, c) => {
      const n = triNormal(P, a, b, c);
      if (!n || n.ny < 0.95) return;
      for (const v of [a, b, c]) {
        if (Math.abs(P[v + 1] - deckY) > 0.006) return;
      }
      for (const v of [a, b, c]) {
        pts.push(toFloorLocal(P[v], P[v + 2]));
        ySum += P[v + 1];
        yN++;
      }
    });
  }
  const hull = convexHull(pts);
  const clipped = clipConvex(hull, octagonFloorLocal());
  const polygon = snapInto(round3(ensureCCW(simplifyPolygon(clipped, 1e-4))), octagonFloorLocal());
  return { y: Math.round((ySum / yN) * 1000) / 1000, polygon, area: polygonArea(polygon), upwardAreaAtDeck: best };
}

// ── wall openings ───────────────────────────────────────────────────────────
function wallTrisOnFlat(wallPrims, k) {
  const out = [];
  for (const prim of wallPrims) {
    const P = prim.positions;
    forTris(prim, (a, b, c) => {
      const cx = (P[a] + P[b] + P[c]) / 3;
      const cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (flatOfXZ(cx, cz) !== k) return;
      out.push([a, b, c].map((v) => ({
        x: wallLocalX(k, P[v], P[v + 2]),
        y: P[v + 1],
        d: flatDist(k, P[v], P[v + 2]),
      })));
    });
  }
  return out;
}

/**
 * An opening in flat k, from `seed` (wall-local x, y, a point inside it):
 *   * a hole in the inner face (the window): march from the seed along ±x and
 *     ±y until an inner-face triangle covers the point;
 *   * a leaf flush with the inner face (the door leaf sits at d = 2.180): the
 *     bounding box of the inner-face triangle under the seed (a quad's two
 *     triangles share its bounding box).
 * Then the trim (lining, architrave, frame, sill: geometry proud of the inner
 * face) touching it widens it to the mask.
 */
export function measureOpening(wallPrims, k, seed) {
  const tris = wallTrisOnFlat(wallPrims, k);
  const inner = tris.filter((t) => t.every((q) => Math.abs(q.d - A) < 0.003));
  const under = (x, y) => inner.find((t) => inTri2(x, y, t[0].x, t[0].y, t[1].x, t[1].y, t[2].x, t[2].y, 1e-6));
  let hole;
  let flush = false;
  const leaf = under(seed[0], seed[1]);
  if (leaf) {
    flush = true;
    const xs = leaf.map((q) => q.x);
    const ys = leaf.map((q) => q.y);
    hole = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    if (hole.x1 - hole.x0 > SHED.side * 0.9) return null; // the seed hit the wall itself, not a leaf
  } else {
    const step = 0.0005;
    const march = (dx, dy, limit) => {
      let x = seed[0];
      let y = seed[1];
      for (let i = 0; i < limit / step; i++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (under(nx, ny) || ny < 0 || ny > H) break;
        x = nx;
        y = ny;
      }
      return dx ? x : y;
    };
    hole = { x0: march(-1, 0, 1.5), x1: march(1, 0, 1.5), y0: march(0, -1, 2.3), y1: march(0, 1, 2.3) };
  }
  if (hole.y0 < 0.02) hole.y0 = 0;

  // Trim: triangles proud of the inner face that touch the hole (± 12 cm) and
  // are not the room-wide trims (skirting, panel joint, fascia band, corner battens).
  const side = SHED.side;
  let [x0, y0, x1, y1] = [hole.x0, hole.y0, hole.x1, hole.y1];
  for (const t of tris) {
    if (!t.every((q) => q.d < A - 0.002)) continue;
    const xs = t.map((q) => q.x);
    const ys = t.map((q) => q.y);
    const tx0 = Math.min(...xs), tx1 = Math.max(...xs), ty0 = Math.min(...ys), ty1 = Math.max(...ys);
    if (ty1 < 0.095) continue; //                         skirting
    if (ty0 > SHED.fasciaY - 0.01) continue; //           fascia band
    if (ty0 > SHED.jointY - 0.03 && ty1 < SHED.jointY + 0.03) continue; // panel joint
    if (tx1 < 0.05 || tx0 > side - 0.05) continue; //       corner battens
    if (tx1 < hole.x0 - 0.12 || tx0 > hole.x1 + 0.12 || ty1 < hole.y0 - 0.12 || ty0 > hole.y1 + 0.12) continue;
    x0 = Math.min(x0, tx0);
    x1 = Math.max(x1, tx1);
    y0 = Math.min(y0, ty0);
    y1 = Math.max(y1, ty1);
  }
  if (y0 < 0.03) y0 = 0;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    flush,
    hole: { x0: r3(hole.x0), x1: r3(hole.x1), y0: r3(hole.y0), y1: r3(hole.y1) },
    mask: { x0: r3(Math.max(0, x0)), x1: r3(Math.min(side, x1)), y0: r3(Math.max(0, y0)), y1: r3(Math.min(H, y1)) },
  };
}

// ── furniture ──────────────────────────────────────────────────────────────
const FLUSH_GAP = 0.08; // a wall counts as "stood against" when the object comes this close
const BACK_DEPTH = 0.25; // how deep a slice of the object's back is projected onto the wall
const ON_FLOOR = 0.05; // min y below this → the object stands on the floor

function objectStats(prims) {
  const pts = [];
  let minY = Infinity;
  for (const prim of prims) {
    const P = prim.positions;
    for (let i = 0; i < P.length; i += 3) {
      pts.push([P[i], P[i + 1], P[i + 2]]);
      minY = Math.min(minY, P[i + 1]);
    }
  }
  return { pts, minY };
}

/** Floor footprints and wall masks for one object (all its prims). */
export function measureObject(name, prims, { kind = 'furniture' } = {}) {
  const { pts, minY } = objectStats(prims);
  const masks = [];
  const id = name.replace(/^obj__/, '');
  if (minY < ON_FLOOR) {
    const hull = convexHull(pts.map(([x, , z]) => toFloorLocal(x, z)));
    const poly = snapInto(round3(ensureCCW(simplifyPolygon(clipConvex(hull, octagonFloorLocal()), 2e-4))), octagonFloorLocal());
    if (poly.length >= 3 && polygonArea(poly) > 0.002) masks.push({ patch: 'floor', id, kind, polygon: poly });
  }
  for (let k = 0; k < 8; k++) {
    let dmax = -Infinity;
    for (const [x, , z] of pts) dmax = Math.max(dmax, flatDist(k, x, z));
    if (A - dmax > FLUSH_GAP) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y, z] of pts) {
      if (flatDist(k, x, z) < dmax - BACK_DEPTH) continue;
      const lx = wallLocalX(k, x, z);
      x0 = Math.min(x0, lx);
      x1 = Math.max(x1, lx);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    x0 = Math.max(0, x0);
    x1 = Math.min(SHED.side, x1);
    if (y0 < ON_FLOOR) y0 = 0;
    y1 = Math.min(H, y1);
    if (x1 - x0 < 0.03 || y1 - y0 < 0.03) continue;
    masks.push({ patch: `wall-${FLATS[k]}`, id, kind, polygon: wallRect(x0, y0, x1, y1) });
  }
  return masks;
}

// ── loft on the walls and floor ─────────────────────────────────────────────
/**
 * Where the loft blocks the walls: for every deck edge lying on a wall's inner
 * face, the wall from the floor to the deck top (the deck, its beam and the
 * under-loft space); where the deck's front line meets a wall, a strip up to
 * the tallest loft part there (the balustrade end post). Plus the deck's
 * footprint on the floor (the under-loft floor no projector reaches).
 */
export function measureLoftMasks(loftPrims, deck) {
  const masks = [];
  const world = deck.polygon.map(([x, y]) => [x + SHED.centre[0] - A, SHED.centre[2] + A - y]); // floor-local → world xz
  const onWall = (p) => {
    for (let k = 0; k < 8; k++) if (Math.abs(flatDist(k, p[0], p[1]) - A) < 0.012) return k;
    return -1;
  };
  const n = world.length;
  const wallEdges = new Set();
  for (let i = 0; i < n; i++) {
    const p = world[i];
    const q = world[(i + 1) % n];
    // An edge lies on wall k when both ends are on its plane (corners sit on two planes).
    for (let k = 0; k < 8; k++) {
      if (Math.abs(flatDist(k, p[0], p[1]) - A) > 0.012 || Math.abs(flatDist(k, q[0], q[1]) - A) > 0.012) continue;
      const xa = wallLocalX(k, p[0], p[1]);
      const xb = wallLocalX(k, q[0], q[1]);
      const x0 = Math.max(0, Math.min(xa, xb));
      const x1 = Math.min(SHED.side, Math.max(xa, xb));
      if (x1 - x0 < 0.02) continue;
      wallEdges.add(i);
      masks.push({ patch: `wall-${FLATS[k]}`, id: 'loft', kind: 'loft', polygon: wallRect(x0, 0, x1, deck.y) });
    }
  }
  // Front-line ends that land on a wall: the tallest loft geometry within 15 cm.
  const pts = [];
  for (const prim of loftPrims) {
    const P = prim.positions;
    for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i + 1], P[i + 2]]);
  }
  const done = [];
  for (let i = 0; i < n; i++) {
    if (wallEdges.has(i)) continue;
    for (const p of [world[i], world[(i + 1) % n]]) {
      const k = onWall(p);
      if (k < 0) continue;
      if (done.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05)) continue;
      done.push(p);
      let top = 0;
      for (const [x, y, z] of pts) {
        if (Math.hypot(x - p[0], z - p[1]) > 0.15) continue;
        if (A - flatDist(k, x, z) > 0.12) continue;
        top = Math.max(top, y);
      }
      if (top < deck.y + 0.1) continue;
      const lx = wallLocalX(k, p[0], p[1]);
      const x0 = Math.max(0, lx - 0.08);
      const x1 = Math.min(SHED.side, lx + 0.08);
      masks.push({ patch: `wall-${FLATS[k]}`, id: 'loft-post', kind: 'loft', polygon: wallRect(x0, 0, x1, Math.min(H, top)) });
    }
  }
  masks.push({ patch: 'floor', id: 'loft', kind: 'loft', polygon: deck.polygon.map((q) => q.slice()) });
  return masks;
}

// ── flats vs the GLB ────────────────────────────────────────────────────────
/**
 * Inner-face statistics per flat from the wall prims: how many vertices sit on
 * the apothem plane (± tol), the span they cover (x along the flat, y), and the
 * eave (max y of every wall prim).
 */
export function measureFlats(wallPrims, tol = 0.01) {
  // The inner face is the most populated distance in the ±tol band around the
  // apothem; `onFace` counts vertices within 1 mm of the measured face.
  const flats = FLATS.map((id, k) => ({ id, k, n: 0, face: NaN, onFace: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  const hist = FLATS.map(() => new Map());
  let eave = -Infinity;
  let outside = 0;
  // A vertex belongs to flat k's face band when it is within `tol` of k's plane
  // and within the flat's extent along it (corner vertices count for both flats).
  const each = (fn) => {
    for (const prim of wallPrims) {
      const P = prim.positions;
      for (let i = 0; i < P.length; i += 3) {
        for (let k = 0; k < 8; k++) {
          const lx = wallLocalX(k, P[i], P[i + 2]);
          if (lx < -0.005 || lx > SHED.side + 0.005) continue;
          fn(k, flatDist(k, P[i], P[i + 2]), P[i], P[i + 1], P[i + 2]);
        }
      }
    }
  };
  for (const prim of wallPrims) {
    const P = prim.positions;
    for (let i = 0; i < P.length; i += 3) {
      eave = Math.max(eave, P[i + 1]);
      const k = flatOfXZ(P[i], P[i + 2]);
      if (flatDist(k, P[i], P[i + 2]) > A + 0.13) outside++;
    }
  }
  each((k, d) => {
    if (Math.abs(d - A) > tol) return;
    flats[k].n++;
    const key = Math.round(d * 1000);
    hist[k].set(key, (hist[k].get(key) || 0) + 1);
  });
  for (const f of flats) {
    let best = 0;
    for (const [key, c] of hist[f.k]) if (c > best) [best, f.face] = [c, key / 1000];
  }
  each((k, d, x, y, z) => {
    const f = flats[k];
    if (Math.abs(d - f.face) > 0.001) return;
    f.onFace++;
    const lx = wallLocalX(k, x, z);
    f.x0 = Math.min(f.x0, lx);
    f.x1 = Math.max(f.x1, lx);
    f.y0 = Math.min(f.y0, y);
    f.y1 = Math.max(f.y1, y);
  });
  return { flats, eave, outside };
}

/** The old roof's underside: eave ring and cap ring heights/radii. */
export function measureOldRoof(ceilingPrims) {
  let capY = -Infinity;
  let capR = 0;
  let eaveR = 0;
  let n = 0;
  for (const prim of ceilingPrims) {
    const P = prim.positions;
    for (let i = 0; i < P.length; i += 3) {
      const r = Math.hypot(P[i] - SHED.centre[0], P[i + 2] - SHED.centre[2]);
      const y = P[i + 1];
      if (r < 0.4 && y < 2.7) {
        if (y > capY - 1e-4) {
          capY = Math.max(capY, y);
        }
      }
      if (Math.abs(y - H) < 0.002 && r > 2.3 && r < 2.4) {
        eaveR += r;
        n++;
      }
    }
  }
  // cap radius: the ring at capY
  for (const prim of ceilingPrims) {
    const P = prim.positions;
    for (let i = 0; i < P.length; i += 3) {
      const r = Math.hypot(P[i] - SHED.centre[0], P[i + 2] - SHED.centre[2]);
      if (Math.abs(P[i + 1] - capY) < 0.002 && r < 0.4) capR = Math.max(capR, r);
    }
  }
  return { capY, capR, eaveR: n ? eaveR / n : NaN };
}

// ── everything ──────────────────────────────────────────────────────────────
const DOOR_SEED = [SHED.side / 2, 1.0]; //      centred on the S flat (layout.md)
const WINDOW_SEED = [SHED.side / 2 + 0.06, 1.2]; // NE flat, +0.06 along the flat (layout.md)

/** Measure the whole room from prims (see the file header for the prim shape). */
export function measureRoom(prims) {
  const of = (kind) => prims.filter((p) => p.kind === kind);
  const walls = of('wall');
  const loft = of('loft');
  const deck = measureLoftDeck(loft);
  const door = measureOpening(walls, 4, DOOR_SEED);
  const win = measureOpening(walls, 1, WINDOW_SEED);
  const masks = [];
  if (door) masks.push({ patch: 'wall-S', id: 'door', kind: 'door', polygon: rect(door.mask.x0, door.mask.y0, door.mask.x1, door.mask.y1) });
  if (win) masks.push({ patch: 'wall-NE', id: 'window', kind: 'window', polygon: rect(win.mask.x0, win.mask.y0, win.mask.x1, win.mask.y1) });
  masks.push(...measureLoftMasks(loft, deck));
  const byObj = new Map();
  for (const p of of('furniture')) {
    if (!byObj.has(p.name)) byObj.set(p.name, []);
    byObj.get(p.name).push(p);
  }
  for (const [name, list] of [...byObj.entries()].sort()) masks.push(...measureObject(name, list));
  const flats = measureFlats(walls);
  return {
    deck,
    door,
    window: win,
    masks,
    flats,
    oldRoof: measureOldRoof(of('ceiling')),
    corners: Array.from({ length: 8 }, (_, k) => cornerXZ(k)),
  };
}
