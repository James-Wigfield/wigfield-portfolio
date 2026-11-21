/* A massing model built straight from scene.json, for spots that have a
   layout but no baked GLB yet (status captured / modelling).

   Same frame and node names as the GLB contract (CONTRACTS.md §4, §6.3): `floor`,
   `ceiling`, `ground`, `wall_<side>` groups, or `wall__<id>` for v2 shells (with `…__` pieces,
   openings left as gaps, windows glazed with a `glass…` material) and
   `obj__<id>`, so the dollhouse logic and pins work unchanged.

   No lights: like the bake, shading is fixed per face (vertex colours from a
   soft top-front light) and drawn with MeshBasicMaterial. */

import * as THREE from 'three';
import { edgeOut, insetEdges, insetPolygon, windingSign } from '../scene/polygon.js';
import { ceilingAt, resolveShell, wallTopAt } from '../scene/shell.js';

const RAD = Math.PI / 180;
const LIGHT = new THREE.Vector3(0.35, 0.9, 0.55).normalize();

const FLOOR_COLOURS = { timber: '#a7825c', carpet: '#9a948a', tile: '#d9d5cc', concrete: '#a9a59e', vinyl: '#c9c2b4', stone: '#b4ada2' };
const GROUND_COLOURS = { asphalt: '#55565a', grass: '#7a9461', sand: '#d9c9a3', snow: '#eef0f2', paving: '#b9b2a6', concrete: '#b3afa8', gravel: '#9d968b', dirt: '#8a7357' };
const WALL_COLOUR = '#e6e1d7';
const CEILING_COLOUR = '#f1eee7';
const OBJECT_COLOUR = '#b9b2a6';

const ROUND = new Set(['cylinder', 'lamp', 'pendant', 'stool']);

/** Brightness of a face with world normal n: 0.6 … 1. */
function shade(n) {
  return 0.6 + 0.3 * Math.max(0, n.dot(LIGHT)) + 0.1 * Math.max(0, n.y);
}

const _n = new THREE.Vector3();

/** Bake per-vertex colours into `geo` for a mesh rotated by `quat`. */
function paint(geo, hex, quat) {
  const base = new THREE.Color(hex);
  const normals = geo.attributes.normal;
  const colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    _n.fromBufferAttribute(normals, i);
    if (quat) _n.applyQuaternion(quat);
    const k = shade(_n);
    colours[i * 3] = base.r * k;
    colours[i * 3 + 1] = base.g * k;
    colours[i * 3 + 2] = base.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

class Kit {
  constructor() {
    this.solid = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.glass = new THREE.MeshBasicMaterial({ name: 'glass_preview', color: 0xcfe3e8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    this.edges = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 });
  }

  /** A painted mesh plus its hairline edges. geo is in the parent's frame. */
  mesh(name, geo, hex, quat) {
    paint(geo, hex, quat);
    const m = new THREE.Mesh(geo, this.solid);
    m.name = name;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.edges);
    lines.name = `${name}__edges`;
    lines.raycast = () => {};
    m.add(lines);
    return m;
  }

  /** Axis-aligned box from min/max corners (parent frame). */
  box(name, [x0, y0, z0], [x1, y1, z1], hex, quat) {
    const geo = new THREE.BoxGeometry(Math.max(x1 - x0, 1e-3), Math.max(y1 - y0, 1e-3), Math.max(z1 - z0, 1e-3));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.mesh(name, geo, hex, quat);
  }
}

function buildShell(kit, root, shell) {
  const { width: w, depth: d, height: h } = shell;
  const t = shell.walls?.thickness ?? 0.12;
  const wallHex = shell.walls?.color || WALL_COLOUR;
  const floorHex = shell.floor?.color || FLOOR_COLOURS[shell.floor?.finish] || FLOOR_COLOURS.timber;

  root.add(kit.box('floor', [-t, -0.06, -t], [w + t, 0, d + t], floorHex));
  if (shell.ceiling?.show !== false) {
    root.add(kit.box('ceiling', [0, h, 0], [w, h + 0.04, d], shell.ceiling?.color || CEILING_COLOUR));
  }

  // Each wall runs along one axis ("u") at a fixed coordinate across it.
  // North/south walls cover the corners (u from -t to w + t).
  const walls = {
    north: { along: 'x', u0: -t, u1: w + t, across: [-t, 0] },
    south: { along: 'x', u0: -t, u1: w + t, across: [d, d + t] },
    west: { along: 'z', u0: 0, u1: d, across: [-t, 0] },
    east: { along: 'z', u0: 0, u1: d, across: [w, w + t] },
  };
  for (const [side, spec] of Object.entries(walls)) {
    const group = new THREE.Group();
    group.name = `wall_${side}`;
    const ops = (shell.openings || [])
      .filter((o) => o.wall === side)
      .map((o) => {
        const sill = o.sill ?? (o.type === 'window' ? 0.9 : 0);
        return { ...o, a: o.offset, b: o.offset + o.width, sill, head: Math.min(h, sill + o.height) };
      })
      .sort((p, q) => p.a - q.a);

    const pieces = [];
    let cursor = spec.u0;
    for (const o of ops) {
      if (o.a > cursor) pieces.push([cursor, o.a, 0, h]);
      if (o.sill > 0) pieces.push([o.a, o.b, 0, o.sill]);
      if (o.head < h) pieces.push([o.a, o.b, o.head, h]);
      cursor = Math.max(cursor, o.b);
    }
    if (cursor < spec.u1) pieces.push([cursor, spec.u1, 0, h]);

    const toBox = (u0, u1, y0, y1, [c0, c1]) =>
      spec.along === 'x' ? [[u0, y0, c0], [u1, y1, c1]] : [[c0, y0, u0], [c1, y1, u1]];

    pieces.forEach(([u0, u1, y0, y1], i) => {
      const [min, max] = toBox(u0, u1, y0, y1, spec.across);
      group.add(kit.box(`wall_${side}__part${i}`, min, max, wallHex));
    });
    ops
      .filter((o) => o.type === 'window')
      .forEach((o, i) => {
        const mid = (spec.across[0] + spec.across[1]) / 2;
        const [min, max] = toBox(o.a, o.b, o.sill, o.head, [mid - 0.004, mid + 0.004]);
        const geo = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
        geo.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
        const pane = new THREE.Mesh(geo, kit.glass);
        pane.name = `wall_${side}__window${i}_glass`;
        group.add(pane);
      });
    root.add(group);
  }
}

function buildObject(kit, o) {
  const group = new THREE.Group();
  group.name = `obj__${o.id}`;
  group.position.set(o.at[0], o.at[1], o.at[2]);
  group.rotation.y = (o.rotY || 0) * RAD;
  const quat = new THREE.Quaternion().setFromEuler(group.rotation);
  const [w, h, d] = o.size;
  const hex = o.color || OBJECT_COLOUR;
  const accent = o.accent || hex;
  const name = (part) => `obj__${o.id}__${part}`;

  const cylinder = (part, r, y0, y1, colour, sides = 20) => {
    const geo = new THREE.CylinderGeometry(r, r, y1 - y0, sides);
    geo.translate(0, (y0 + y1) / 2, 0);
    geo.scale(1, 1, d / w);
    return kit.mesh(name(part), geo, colour, quat);
  };
  const blob = (part, rx, ry, cy, colour) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    geo.scale(rx, ry, rx * (d / w));
    geo.translate(0, cy, 0);
    return kit.mesh(name(part), geo, colour, quat);
  };

  switch (o.kit) {
    case 'tree':
    case 'palm':
      group.add(cylinder('trunk', Math.min(w, d) * 0.06, 0, h * 0.62, accent, 8));
      group.add(blob('crown', w / 2, o.kit === 'palm' ? h * 0.12 : h * 0.3, o.kit === 'palm' ? h * 0.88 : h * 0.68, hex));
      break;
    case 'pine': {
      group.add(cylinder('trunk', Math.min(w, d) * 0.07, 0, h * 0.2, accent, 8));
      const geo = new THREE.ConeGeometry(w / 2, h * 0.85, 12);
      geo.translate(0, h * 0.15 + (h * 0.85) / 2, 0);
      geo.scale(1, 1, d / w);
      group.add(kit.mesh(name('crown'), geo, hex, quat));
      break;
    }
    case 'plant':
      group.add(cylinder('pot', w * 0.3, 0, h * 0.32, accent, 16));
      group.add(blob('leaves', w / 2, h * 0.36, h * 0.62, hex));
      break;
    default:
      if (ROUND.has(o.kit)) group.add(cylinder('body', w / 2, 0, h, hex));
      else group.add(kit.box(name('body'), [-w / 2, 0, -d / 2], [w / 2, h, d / 2], hex, quat));
  }
  return group;
}

// ── any shell (v2 polygons, sloped ceilings, rooms of a building) ───────────────

const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4;

/** Triangles (flat array of [x, y, z] triples) → a geometry with outward-facing faces. */
function solidFrom(tris, insidePoint) {
  const pos = [];
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    const inside = typeof insidePoint === 'function' ? insidePoint(i / 3) : insidePoint;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const m = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    const flip = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0;
    pos.push(...a, ...(flip ? c : b), ...(flip ? b : c));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * One piece of wall between u0 and u1 along it: a prism from the inner face (a→b) to the
 * outer one (A→B, mitred), from y0 up to top(u) (sampled, so a gable's slope and ridge show).
 */
function wallPiece(w, outer, u0, u1, y0, top) {
  const L = w.length;
  const sloped = top(u0) !== top(u1) || top((u0 + u1) / 2) !== top(u0);
  const n = sloped ? 12 : 1;
  const at = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  const I = [];
  const O = [];
  const T = [];
  for (let k = 0; k <= n; k++) {
    const u = u0 + ((u1 - u0) * k) / n;
    I.push(at(w.a, w.b, u / L));
    O.push(at(outer[0], outer[1], u / L));
    T.push(Math.max(y0 + 0.001, top(u)));
  }
  const v = (p, y) => [p[0], y, p[1]];
  const tris = [];
  const quad = (a, b, c, d) => tris.push(a, b, c, a, c, d);
  for (let k = 0; k < n; k++) {
    quad(v(I[k], y0), v(I[k + 1], y0), v(I[k + 1], T[k + 1]), v(I[k], T[k])); // inner face
    quad(v(O[k], y0), v(O[k + 1], y0), v(O[k + 1], T[k + 1]), v(O[k], T[k])); // outer face
    quad(v(I[k], T[k]), v(I[k + 1], T[k + 1]), v(O[k + 1], T[k + 1]), v(O[k], T[k])); // top
    quad(v(I[k], y0), v(I[k + 1], y0), v(O[k + 1], y0), v(O[k], y0)); // bottom
  }
  quad(v(I[0], y0), v(O[0], y0), v(O[0], T[0]), v(I[0], T[0]));
  quad(v(I[n], y0), v(O[n], y0), v(O[n], T[n]), v(I[n], T[n]));
  // a point inside the piece: the average of its corners (a prism with a sloped top is still convex enough)
  let sx = 0;
  let sz = 0;
  let sy = 0;
  for (let k = 0; k <= n; k++) {
    sx += I[k][0] + O[k][0];
    sz += I[k][1] + O[k][1];
    sy += y0 + T[k];
  }
  const mid = [sx / (2 * (n + 1)), sy / (2 * (n + 1)), sz / (2 * (n + 1))];
  return solidFrom(tris, mid);
}

/** The wall on outline edge p→q, either way round: { w, rev } (rev: the wall runs q→p), or null. */
function wallOnEdge(sh, p, q) {
  for (const w of sh.walls) {
    if (near(w.a, p) && near(w.b, q)) return { w, rev: false };
    if (near(w.a, q) && near(w.b, p)) return { w, rev: true };
  }
  return null;
}

/** The outer face (mitred) of each wall, keyed by wall id: [A, B] under its inner a, b. */
function outerFaces(sh) {
  const out = new Map();
  const n = sh.outline.length;
  const found = [];
  for (let i = 0; i < n; i++) found.push(wallOnEdge(sh, sh.outline[i], sh.outline[(i + 1) % n]));
  const edges = insetEdges(sh.outline, found.map((f) => (f && !f.w.open ? -(f.w.thickness || 0.12) : 0)));
  found.forEach((f, i) => {
    if (f) out.set(f.w.id, f.rev ? [edges[i].end, edges[i].start] : [edges[i].start, edges[i].end]);
  });
  for (const w of sh.walls) {
    if (out.has(w.id)) continue;
    const t = w.thickness || 0.12;
    out.set(w.id, [
      [w.a[0] + w.out[0] * t, w.a[1] + w.out[1] * t],
      [w.b[0] + w.out[0] * t, w.b[1] + w.out[1] * t],
    ]);
  }
  return out;
}

/** The floor's rim: the outline pushed out to the walls' outer faces (open sides stay put). */
function rimOf(sh) {
  const n = sh.outline.length;
  const d = [];
  for (let i = 0; i < n; i++) {
    const p = sh.outline[i];
    const q = sh.outline[(i + 1) % n];
    const f = wallOnEdge(sh, p, q);
    d.push(f && !f.w.open ? -(f.w.thickness || 0.12) : 0);
  }
  try {
    return insetPolygon(sh.outline, d);
  } catch {
    return sh.outline;
  }
}

/** The outline as a flat ([x, z]) triangulation: [[a, b, c]…] of [x, z] points. */
function planTriangles(outline) {
  const contour = outline.map(([x, z]) => new THREE.Vector2(x, z));
  return THREE.ShapeUtils.triangulateShape(contour, []).map((t) => t.map((i) => outline[i]));
}

/** Split plan triangles until no edge is longer than `max` m (so a sloped ceiling can bend at its ridge). */
function subdivide(tris, max) {
  const out = [];
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const stack = [...tris];
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const long = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (long <= max || out.length > 20000) out.push([a, b, c]);
    else {
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      stack.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
  }
  return out;
}

function buildShellAny(kit, root, sh) {
  const wallHex = sh.wallsSpec?.color || WALL_COLOUR;
  const floorHex = sh.floor?.color || FLOOR_COLOURS[sh.floor?.finish] || FLOOR_COLOURS.timber;

  // floor: the outline, 6 cm deep, out under the walls' outer faces
  const outers = outerFaces(sh);
  const rim = rimOf(sh);
  const rimSign = windingSign(rim);
  const floorTris = [];
  const inside = [];
  const c0 = sh.outline.reduce((s, p) => [s[0] + p[0] / sh.outline.length, s[1] + p[1] / sh.outline.length], [0, 0]);
  for (const [a, b, c] of planTriangles(rim)) {
    floorTris.push([a[0], 0, a[1]], [b[0], 0, b[1]], [c[0], 0, c[1]], [a[0], -0.06, a[1]], [c[0], -0.06, c[1]], [b[0], -0.06, b[1]]);
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    inside.push([m[0], -0.03, m[1]], [m[0], -0.03, m[1]]);
  }
  for (let i = 0; i < rim.length; i++) {
    const p = rim[i];
    const q = rim[(i + 1) % rim.length];
    floorTris.push([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], -0.06, q[1]], [p[0], 0, p[1]], [q[0], -0.06, q[1]], [p[0], -0.06, p[1]]);
    const o = edgeOut(p, q, rimSign);
    const m = [(p[0] + q[0]) / 2 - o[0] * 0.05, -0.03, (p[1] + q[1]) / 2 - o[1] * 0.05];
    inside.push(m, m);
  }
  root.add(kit.mesh('floor', solidFrom(floorTris, (i) => inside[i]), floorHex));

  // ceiling: flat at the eaves, or bent to the ceiling's shape (seen from below)
  if (sh.ceiling?.show !== false) {
    const flat = (sh.ceiling?.shape || 'flat') === 'flat';
    const plan = flat ? planTriangles(sh.outline) : subdivide(planTriangles(sh.outline), 0.3);
    const tris = [];
    for (const [a, b, c] of plan) tris.push(...[a, b, c].map(([x, z]) => [x, ceilingAt(sh, x, z), z]));
    const geo = solidFrom(tris, [c0[0], (sh.top ?? sh.height) + 50, c0[1]]); // faces point down
    root.add(kit.mesh('ceiling', geo, sh.ceiling?.color || CEILING_COLOUR));
  }

  // walls: one group per wall (`wall__<id>`, its outward normal in userData like the GLB's extras)
  for (const w of sh.walls) {
    if (w.open) continue;
    const group = new THREE.Group();
    group.name = w.node;
    group.userData.mrWall = { id: w.id, normal: w.out };
    const outer = outers.get(w.id);
    const top = (u) => wallTopAt(sh, w, u);
    const ops = sh.openings
      .filter((o) => o.wall === w.id)
      .map((o) => ({ ...o, a: Math.max(0, o.offset), b: Math.min(w.length, o.offset + o.width) }))
      .sort((p, q) => p.a - q.a);
    const pieces = [];
    let cursor = 0;
    for (const o of ops) {
      if (o.a > cursor) pieces.push([cursor, o.a, 0, top]);
      if (o.sill > 0) pieces.push([o.a, o.b, 0, () => o.sill]);
      pieces.push([o.a, o.b, o.head, top]);
      cursor = Math.max(cursor, o.b);
    }
    if (cursor < w.length) pieces.push([cursor, w.length, 0, top]);
    pieces.forEach(([u0, u1, y0, topFn], i) => {
      if (u1 - u0 < 1e-3) return;
      if (topFn(u0) <= y0 + 1e-3 && topFn(u1) <= y0 + 1e-3) return; // an opening right up to the top
      group.add(kit.mesh(`${w.node}__part${i}`, wallPiece(w, outer, u0, u1, y0, topFn), wallHex));
    });
    ops
      .filter((o) => o.type === 'window')
      .forEach((o, i) => {
        const at = (f) => [(w.a[0] + (w.b[0] - w.a[0]) * f + (outer[0][0] + (outer[1][0] - outer[0][0]) * f)) / 2, (w.a[1] + (w.b[1] - w.a[1]) * f + (outer[0][1] + (outer[1][1] - outer[0][1]) * f)) / 2];
        const p = at(o.a / w.length);
        const q = at(o.b / w.length);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([p[0], o.sill, p[1], q[0], o.sill, q[1], q[0], o.head, q[1], p[0], o.sill, p[1], q[0], o.head, q[1], p[0], o.head, p[1]], 3));
        geo.computeVertexNormals();
        const pane = new THREE.Mesh(geo, kit.glass);
        pane.name = `${w.node}__window${i}_glass`;
        group.add(pane);
      });
    root.add(group);
  }
}

/** Build the preview for a scene. Returns a Group in scene.json coordinates. */
export function buildLayoutPreview(scene, building = null) {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'layout-preview';
  if (scene.shell && (scene.version ?? 1) < 2) buildShell(kit, root, scene.shell);
  else if (scene.shell) {
    // v2 (a box, a polygon, a sloped ceiling, a room of a building): from the normalised shell, walls `wall__<id>`
    let sh = null;
    try {
      sh = resolveShell(scene, building);
    } catch {
      sh = null;
    }
    if (sh) buildShellAny(kit, root, sh);
  }
  if (scene.site?.ground) {
    const g = scene.site.ground;
    const [w, d] = g.size;
    root.add(kit.box('ground', [-w / 2, -0.1, -d / 2], [w / 2, 0, d / 2], g.color || GROUND_COLOURS[g.finish] || GROUND_COLOURS.paving));
  }
  for (const o of scene.objects || []) root.add(buildObject(kit, o));
  return root;
}
