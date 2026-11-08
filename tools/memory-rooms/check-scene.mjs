#!/usr/bin/env node
/* check-scene: is this scene.json buildable and believable?

     node tools/memory-rooms/check-scene.mjs <scene.json | spotId> [--json] [--quiet]

   1. Schema + cross-references (the shared validator, src/memory-rooms/scene/validate.js).
   2. Geometry, with a 2 cm tolerance:
      - every object sits inside the shell (interior) / near the site (exterior),
      - nothing floats: an object rests on the floor, on another object's top, against a wall
        or another object's side (mount "wall"), or hangs from the ceiling — `mount: "free"` opts out,
      - nothing interpenetrates by more than 2 cm unless one lists the other in `overlaps`,
      - each door and window fits inside its wall, openings don't collide, doors start at the floor,
      - every camera is inside the room (or near the site) and points at something,
      - pins and lights sit inside the room.
   Errors fail the check (exit 1). Warnings are advice. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateScene } from '../../src/memory-rooms/scene/validate.js';
import { aabb, footprint, openingSpan, wallLength, verticalFov } from '../../src/memory-rooms/scene/geometry.js';
import { WORK } from './lib/api.mjs';

const TOL = 0.02 + 1e-6; // 2 cm (+ epsilon for float sums like 0.07 - 0.05)
const WALL_KITS = new Set(['frame', 'shelf', 'tv', 'curtain', 'sign', 'awning', 'cabinet', 'lamp', 'box', 'bespoke', 'glb']);
const fmtM = (m) => (Math.abs(m) < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`);

export function checkScene(scene) {
  const errors = [];
  const warnings = [];
  const { ok, errors: schemaErrors } = validateScene(scene);
  if (!ok) {
    for (const e of schemaErrors) errors.push(`${e.path || '/'} ${e.message}`);
    return { errors, warnings };
  }

  const objs = scene.objects;
  const boxes = new Map(objs.map((o) => [o.id, aabb(o)]));
  const interior = scene.kind === 'interior';
  const shell = scene.shell;

  // ── inside the shell / site ────────────────────────────────────────────
  for (const o of objs) {
    const b = boxes.get(o.id);
    if (interior) {
      const out = [
        ['west', -b.min[0]], ['east', b.max[0] - shell.width],
        ['north', -b.min[2]], ['south', b.max[2] - shell.depth],
        ['ceiling', b.max[1] - shell.height], ['floor', -b.min[1]],
      ].filter(([, d]) => d > TOL);
      for (const [side, d] of out) errors.push(`${o.id}: pokes ${fmtM(d)} through the ${side}${side === 'floor' || side === 'ceiling' ? '' : ' wall'}`);
    } else {
      const [w, d] = scene.site.ground.size;
      const over = Math.max(-w / 2 - b.min[0], b.max[0] - w / 2, -d / 2 - b.min[2], b.max[2] - d / 2);
      if (over > TOL) warnings.push(`${o.id}: hangs ${fmtM(over)} off the ground plate (fine for context pieces)`);
      if (b.min[1] < -TOL) errors.push(`${o.id}: sinks ${fmtM(-b.min[1])} below the ground`);
    }
  }

  // ── floating ───────────────────────────────────────────────────────────
  for (const o of objs) {
    if (o.mount === 'free') continue;
    const b = boxes.get(o.id);
    const y = o.at[1];
    const onFloor = Math.abs(y) <= TOL;
    const support = objs.find((p) => p.id !== o.id && Math.abs(p.at[1] + p.size[1] - y) <= TOL && pointInPoly([o.at[0], o.at[2]], footprint(p)));
    const touchingWall = interior && (b.min[0] <= TOL || b.max[0] >= shell.width - TOL || b.min[2] <= TOL || b.max[2] >= shell.depth - TOL);
    const touchingSide = objs.find((p) => p.id !== o.id && sideContact(b, boxes.get(p.id)));
    const fromCeiling = interior && b.max[1] >= shell.height - TOL;
    const mount = o.mount;
    if (mount === 'floor' && !onFloor) errors.push(`${o.id}: mount "floor" but its base is at y = ${y}`);
    else if (mount === 'on' && !support) errors.push(`${o.id}: mount "on" but nothing's top is at y = ${y} under its centre`);
    else if (mount === 'wall' && !touchingWall && !touchingSide) errors.push(`${o.id}: mount "wall" but it touches no wall or object side (within 2 cm)`);
    else if (mount === 'ceiling' && !fromCeiling) errors.push(`${o.id}: mount "ceiling" but its top is ${fmtM(shell ? shell.height - b.max[1] : 0)} below the ceiling`);
    else if (!mount && !onFloor && !support && !fromCeiling && !((touchingWall || touchingSide) && WALL_KITS.has(o.kit))) {
      const below = objs.filter((p) => p.id !== o.id && pointInPoly([o.at[0], o.at[2]], footprint(p)) && p.at[1] + p.size[1] <= y + TOL);
      const top = below.length ? Math.max(...below.map((p) => p.at[1] + p.size[1])) : 0;
      errors.push(`${o.id}: floats ${fmtM(y - top)} above ${below.length ? 'what is under it' : 'the floor'} (set mount if intended)`);
    }
  }

  // ── interpenetration ───────────────────────────────────────────────────
  for (let i = 0; i < objs.length; i++) {
    for (let j = i + 1; j < objs.length; j++) {
      const a = objs[i];
      const c = objs[j];
      if ((a.overlaps || []).includes(c.id) || (c.overlaps || []).includes(a.id)) continue;
      const yOverlap = Math.min(a.at[1] + a.size[1], c.at[1] + c.size[1]) - Math.max(a.at[1], c.at[1]);
      if (yOverlap <= TOL) continue;
      const depth = Math.min(yOverlap, satDepth(footprint(a), footprint(c)));
      if (depth > TOL) errors.push(`${a.id} and ${c.id} interpenetrate by ${fmtM(depth)} (add "overlaps" if intended, e.g. a chair tucked under a desk)`);
    }
  }

  // ── openings ───────────────────────────────────────────────────────────
  if (interior) {
    const byWall = new Map();
    (shell.openings || []).forEach((op, i) => {
      const len = wallLength(shell, op.wall);
      const span = openingSpan(shell, op);
      const label = `opening ${i} (${op.type}, ${op.wall})`;
      if (op.offset + op.width > len + 0.001) errors.push(`${label}: runs ${fmtM(op.offset + op.width - len)} past the end of the ${fmtM(len)} wall`);
      if (span.head > shell.height + 0.001) errors.push(`${label}: its top (${span.head.toFixed(2)} m) is above the ceiling (${shell.height} m)`);
      if (op.type === 'door' && span.sill > 0.001) warnings.push(`${label}: a door with a sill of ${fmtM(span.sill)}`);
      if (op.type === 'window' && span.sill < 0.05) warnings.push(`${label}: a window at floor level; is it a door or a glass wall?`);
      if (op.offset < 0.05 || len - (op.offset + op.width) < 0.05) warnings.push(`${label}: within 5 cm of a corner`);
      if (!byWall.has(op.wall)) byWall.set(op.wall, []);
      byWall.get(op.wall).push({ i, a: op.offset, b: op.offset + op.width, op });
      // door swing kept clear
      if (op.type === 'door') {
        const swing = doorSwing(shell, op);
        for (const o of objs) {
          if (o.at[1] > 0.3 || o.size[1] < 0.03) continue; // wall-hung things and rugs never block a door
          const d = satDepth(swing, footprint(o));
          if (d > 0.05) warnings.push(`${o.id}: sits in the swing of ${label}`);
        }
      }
    });
    for (const [wall, list] of byWall) {
      list.sort((x, y) => x.a - y.a);
      for (let k = 1; k < list.length; k++) {
        if (list[k].a < list[k - 1].b - 0.001) errors.push(`openings ${list[k - 1].i} and ${list[k].i} overlap on the ${wall} wall`);
      }
    }
  }

  // ── cameras ────────────────────────────────────────────────────────────
  for (const cam of scene.cameras) {
    const label = `camera for photo ${cam.photo}`;
    const [px, py, pz] = cam.pos;
    if (interior) {
      const m = 0.05;
      if (px < m || px > shell.width - m || pz < m || pz > shell.depth - m || py < 0.1 || py > shell.height - m) {
        // "wide from the door" photos are often taken standing IN the doorway: allow a camera up to
        // 0.6 m outside the wall line if it is within a door/opening's span and below its head.
        const inDoorway = (shell.openings || []).some((op) => {
          if (op.type === 'window') return false;
          const s = openingSpan(shell, op);
          const along = op.wall === 'north' || op.wall === 'south' ? px : pz;
          const out = { north: -pz, south: pz - shell.depth, west: -px, east: px - shell.width }[op.wall];
          return along >= op.offset && along <= op.offset + op.width && out <= 0.6 && out > -m - 0.001 && py < s.head;
        });
        if (inDoorway) warnings.push(`${label}: pos [${cam.pos}] is in a doorway (fine for "wide from the door")`);
        else errors.push(`${label}: pos [${cam.pos}] is outside the room`);
      }
      const [lx, ly, lz] = cam.look;
      if (lx < -0.5 || lx > shell.width + 0.5 || lz < -0.5 || lz > shell.depth + 0.5 || ly < -0.5 || ly > shell.height + 0.5) {
        errors.push(`${label}: look [${cam.look}] is outside the room`);
      }
    } else {
      const [w, d] = scene.site.ground.size;
      if (Math.abs(px) > w * 1.5 || Math.abs(pz) > d * 1.5) warnings.push(`${label}: pos is far outside the site`);
      if (py < 0.1) errors.push(`${label}: pos is below the ground`);
    }
    const dir = sub(cam.look, cam.pos);
    const dist = len3(dir);
    if (dist < 0.3) {
      errors.push(`${label}: look is only ${fmtM(dist)} from pos`);
      continue;
    }
    const aspect = cam.aspect ?? 0.75;
    const vf = (verticalFov(cam, aspect) * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const seen = objs.filter((o) => {
      const c = [o.at[0], o.at[1] + o.size[1] / 2, o.at[2]];
      return inFrustum(cam.pos, dir, c, hf, vf);
    });
    if (!seen.length) warnings.push(`${label}: no object's centre is in view; check pos/look/fov`);
    if (Math.abs(cam.pos[1] - 1.5) > 0.6 && interior) warnings.push(`${label}: eye height ${cam.pos[1]} m (phones are usually held at 1.2–1.7 m)`);
  }

  // ── pins + lights ──────────────────────────────────────────────────────
  if (interior) {
    const inside = (p, m = 0) => p[0] >= -m && p[0] <= shell.width + m && p[2] >= -m && p[2] <= shell.depth + m && p[1] >= -m && p[1] <= shell.height + m;
    (scene.pins || []).forEach((p, i) => inside(p.at, 0.05) || errors.push(`pin ${i}: at [${p.at}] is outside the room`));
    (scene.lights || []).forEach((l, i) => l.at && !inside(l.at, 0.05) && errors.push(`light ${i} (${l.type}): at [${l.at}] is outside the room`));
    if (!(scene.lights || []).length) warnings.push('no lights: the kit will use its default fill (fine, but a lamp or window light usually reads better)');
  }
  if (!scene.cameras.length) warnings.push('no cameras: compare.mjs needs one camera per photo');

  return { errors, warnings };
}

// ── geometry helpers ─────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);

function pointInPoly([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Penetration depth of two convex polygons (SAT); 0 when separated. */
function satDepth(p, q) {
  let best = Infinity;
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      const n = [z1 - z2, x2 - x1];
      const l = Math.hypot(n[0], n[1]) || 1;
      const ax = [n[0] / l, n[1] / l];
      const proj = (pts) => pts.map(([x, z]) => x * ax[0] + z * ax[1]);
      const a = proj(p);
      const b = proj(q);
      const overlap = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b));
      if (overlap <= 0) return 0;
      best = Math.min(best, overlap);
    }
  }
  return best;
}

/** Two boxes touch side to side (within 2 cm) and overlap in the other two axes. */
function sideContact(a, b) {
  for (let ax = 0; ax < 3; ax += 2) {
    const other = ax === 0 ? 2 : 0;
    const touch = Math.abs(a.max[ax] - b.min[ax]) <= TOL || Math.abs(b.max[ax] - a.min[ax]) <= TOL;
    const overlapOther = Math.min(a.max[other], b.max[other]) - Math.max(a.min[other], b.min[other]) > 0;
    const overlapY = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]) > 0;
    if (touch && overlapOther && overlapY) return true;
  }
  return false;
}

/** The square a door leaf sweeps inside the room (its width deep). */
function doorSwing(shell, op) {
  const s = openingSpan(shell, op);
  const w = op.width;
  const [x1, z1] = s.from;
  const [x2, z2] = s.to;
  const inward = { north: [0, 1], south: [0, -1], west: [1, 0], east: [-1, 0] }[op.wall];
  return [
    [x1, z1],
    [x2, z2],
    [x2 + inward[0] * w, z2 + inward[1] * w],
    [x1 + inward[0] * w, z1 + inward[1] * w],
  ];
}

function inFrustum(pos, dir, p, hf, vf) {
  const f = dir.map((v) => v / len3(dir));
  const upWorld = [0, 1, 0];
  let r = [f[1] * upWorld[2] - f[2] * upWorld[1], f[2] * upWorld[0] - f[0] * upWorld[2], f[0] * upWorld[1] - f[1] * upWorld[0]];
  r = r.map((v) => v / (len3(r) || 1));
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = sub(p, pos);
  const z = dot(v, f);
  if (z <= 0.1) return false;
  return Math.abs(dot(v, r) / z) <= Math.tan(hf / 2) && Math.abs(dot(v, u) / z) <= Math.tan(vf / 2);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function resolveScenePath(arg) {
  if (!arg) return null;
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) return arg;
  if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) return path.join(arg, 'scene.json');
  return path.join(WORK, arg, 'scene.json');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const file = resolveScenePath(args.find((a) => !a.startsWith('--')));
  if (!file || !fs.existsSync(file)) {
    console.error('usage: node tools/memory-rooms/check-scene.mjs <scene.json | work dir | spotId> [--json]');
    process.exit(2);
  }
  let scene;
  try {
    scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✗ ${file} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = checkScene(scene);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ file, ok: !errors.length, errors, warnings }, null, 2));
  } else {
    console.log(`check-scene ${file}`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    if (!args.includes('--quiet')) for (const w of warnings) console.log(`  ! ${w}`);
    console.log(errors.length ? `\n${errors.length} error(s), ${warnings.length} warning(s)` : `\nOK (${scene.objects.length} objects, ${scene.cameras.length} cameras, ${warnings.length} warning(s))`);
  }
  process.exit(errors.length ? 1 : 0);
}
