/* The layout editor's plan maths, pure (no React, no DOM): the view transform (metres ↔ screen px, north up:
   x east = right, z south = down), grid snapping, edges, an opening's place on its edge, the typed size
   ("about 4 × 3"), and a viewpoint's wedge as SVG path data. Metres in the scene frame (CONTRACTS.md 1, 8). */

import { lookOf, yawOf } from '../freeform.js';

/** Snap step for corners (m): fine enough for a room, coarse enough for a finger. */
export const GRID = 0.25;
/** Viewpoints snap finer: where someone stood is rarely on a quarter-metre grid. */
export const VIEW_STEP = 0.05;
export const snap = (v, step = GRID) => Math.round(v / step) * step;

/** view = { s: px per metre, cx, cz: the plan point at the centre }, size = { w, h } px. */
export const toScreen = (view, size, [x, z]) => [(x - view.cx) * view.s + size.w / 2, (z - view.cz) * view.s + size.h / 2];
export const toPlan = (view, size, [px, py]) => [(px - size.w / 2) / view.s + view.cx, (py - size.h / 2) / view.s + view.cz];

/** A view that fits `pts` (plan metres) into the size with `pad` px, never closer than maxS px/m. */
export function fitView(pts, size, { pad = 48, minSpan = 4, maxS = 160 } = {}) {
  if (!pts.length) return { s: Math.min(maxS, Math.min(size.w, size.h) / (minSpan + 2)), cx: minSpan / 2, cz: minSpan / 2 };
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  const w = Math.max(minSpan, x1 - x0);
  const d = Math.max(minSpan, z1 - z0);
  const s = Math.min(maxS, (size.w - 2 * pad) / w, (size.h - 2 * pad) / d);
  return { s: Math.max(8, s), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export const edgeOf = (pts, i) => [pts[i], pts[(i + 1) % pts.length]];
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The point on segment a→b nearest p: { t (0–1 along it), d (distance), at: [x, z] }. */
export function project(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  const at = [a[0] + t * dx, a[1] + t * dz];
  return { t, d: dist(p, at), at };
}

/** The edge (closed outline) nearest p within `reach` metres: { edge, t, d, at } or null. */
export function nearestEdge(pts, p, reach) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = edgeOf(pts, i);
    const q = project(p, a, b);
    if (q.d <= reach && (!best || q.d < best.d)) best = { edge: i, ...q };
  }
  return best;
}

/** An opening's two ends on its edge, plan metres. */
export function openingEnds(pts, o) {
  const [a, b] = edgeOf(pts, o.edge);
  const L = dist(a, b) || 1;
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return [
    [a[0] + u[0] * o.offset, a[1] + u[1] * o.offset],
    [a[0] + u[0] * (o.offset + o.width), a[1] + u[1] * (o.offset + o.width)],
  ];
}

/** Keep an opening on its edge: offset clamped so it fits; width clamped to the edge. */
export function fitOpening(pts, o) {
  const L = dist(...edgeOf(pts, o.edge));
  const width = Math.min(o.width, Math.max(0.2, L));
  return { ...o, width, offset: Math.max(0, Math.min(L - width, o.offset)) };
}

/** After corner i moved, openings on its two edges are kept on them (clamped). */
export function refitOpenings(pts, openings) {
  return (openings || []).filter((o) => o.edge < pts.length).map((o) => fitOpening(pts, o));
}

/** Insert a corner into edge i (between i and i+1): the openings after it shift their edge numbers. */
export function insertCorner(pts, openings, i, at) {
  const next = [...pts.slice(0, i + 1), at, ...pts.slice(i + 1)];
  const L0 = dist(pts[i], at);
  const shifted = (openings || []).flatMap((o) => {
    if (o.edge < i) return [o];
    if (o.edge > i) return [{ ...o, edge: o.edge + 1 }];
    // on the split edge: whichever half holds its middle
    const mid = o.offset + o.width / 2;
    return mid <= L0 ? [o] : [{ ...o, edge: i + 1, offset: o.offset - L0 }];
  });
  return { outline: next, openings: refitOpenings(next, shifted) };
}

/** Remove corner i: its two edges merge, openings on them go (they'd land somewhere new). */
export function removeCorner(pts, openings, i) {
  if (pts.length <= 3) return { outline: pts, openings };
  const next = pts.filter((_, k) => k !== i);
  const prev = (i - 1 + pts.length) % pts.length;
  const kept = (openings || [])
    .filter((o) => o.edge !== i && o.edge !== prev)
    .map((o) => (o.edge > i ? { ...o, edge: o.edge - 1 } : o));
  return { outline: next, openings: refitOpenings(next, kept) };
}

/** "about 4 × 3", "4x3.5", "4 by 3 m" → [4, 3] (metres), or null. */
export function parseSize(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:m\b)?\s*(?:x|×|by|\*)\s*(\d+(?:[.,]\d+)?)/i.exec(String(text || ''));
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  return a > 0.5 && b > 0.5 && a < 100 && b < 100 ? [a, b] : null;
}

/** The outline scaled so its bounding box is w × d (the box's NW corner stays put). */
export function scaleTo(pts, w, d) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const z0 = Math.min(...zs);
  const bw = Math.max(...xs) - x0 || 1;
  const bd = Math.max(...zs) - z0 || 1;
  return pts.map(([x, z]) => [x0 + ((x - x0) * w) / bw, z0 + ((z - z0) * d) / bd]);
}

export const bboxSize = (pts) => {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
};

/** A rectangle w × d with its NW corner at the origin (a place's sketched room). */
export const rectOutline = (w, d) => [
  [0, 0],
  [w, 0],
  [w, d],
  [0, d],
];

/** The yaw from a viewpoint to a plan point (aiming a wedge at the pointer). */
export const yawTo = (from, to) => yawOf(to[0] - from[0], to[1] - from[1]);

/**
 * A viewpoint's wedge in SCREEN px, drawn at the origin looking along +y (screen down = plan south = yaw 0);
 * the caller rotates it by -yaw (SVG rotates clockwise; yaw 90 = east = screen right). r = its length in px.
 */
export function wedgePath(fovDeg, r) {
  const h = ((Math.min(170, Math.max(10, fovDeg)) / 2) * Math.PI) / 180;
  const ax = Math.sin(h) * r;
  const ay = Math.cos(h) * r;
  return `M0 0 L${(-ax).toFixed(1)} ${ay.toFixed(1)} A${r} ${r} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)} Z`;
}

/** SVG rotation (degrees, clockwise on screen) that turns a +y-looking wedge to look along `yaw`. */
export const wedgeRotation = (yaw) => -yaw;

/** The aim handle's offset from the body, screen px, for a yaw. */
export function aimOffset(yaw, r) {
  const [dx, dz] = lookOf(yaw);
  return [dx * r, dz * r];
}

/** A new viewpoint's yaw: toward the outline's middle (or south when there is no outline). */
export function defaultYaw(at, outline) {
  if (!outline?.length) return 0;
  const c = outline.reduce((s, p) => [s[0] + p[0] / outline.length, s[1] + p[1] / outline.length], [0, 0]);
  return dist(at, c) < 0.2 ? 0 : yawTo(at, c);
}
