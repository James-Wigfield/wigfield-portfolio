/* Dollhouse cut-away: while orbiting an interior, hide the ceiling and every
   wall that stands between the camera and the room (or building) centre.

   GLB contract (CONTRACTS.md §4): a wall is the node `wall_<side>`, its
   children, or any node whose name starts with `wall_<side>` (e.g.
   `wall_north__window0_frame`). Hiding by prefix takes its frames, glass and
   door with it. The layout preview names its walls the same way.

   Walls fade rather than pop: each side (and the ceiling) gets its own clone
   of the materials it uses (a baked GLB shares ONE atlas material across the
   whole room), so its opacity can move on its own. */

import * as THREE from 'three';
import { aabb } from '../scene/geometry.js';

/** Outward normal (xz) of each interior wall, in the room's own frame. */
export const WALL_OUT = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const SIDES = Object.keys(WALL_OUT);
const WALL_RE = /^wall_(north|south|east|west)/;

/** A wall hides once the camera is this far round to its outside (cosine). */
const HIDE_DOT = 0.18;
const FADE_MS = 220;

/** Kits that hang on (or stand flush against) a wall. */
const WALL_KITS = new Set(['frame', 'curtain', 'tv', 'sign', 'shelf']);
const FLUSH_M = 0.03;
const MOUNT_REACH_M = 0.35;

/** Below this base height a thing stands on the floor and never hides with a wall. */
const FLOOR_STANDING_M = 0.05;

/**
 * The wall a scene object belongs to, or null: `mount: "wall"` objects take
 * their nearest wall; wall-mountable kits count when their footprint is
 * within 3 cm of a wall plane AND they're off the floor. (Otherwise they'd
 * float once the wall hides.) A bookcase or TV stand standing on the floor
 * against a wall stays: hiding it would only reveal the dark floor it shades.
 */
export function attachedWall(o, shell) {
  if (o.mount !== 'wall' && (o.mount === 'floor' || o.at[1] < FLOOR_STANDING_M) && o.kit !== 'curtain') return null;
  if (!shell) return null;
  const b = aabb(o);
  const dist = {
    north: Math.abs(b.min[2]),
    south: Math.abs(b.max[2] - shell.depth),
    west: Math.abs(b.min[0]),
    east: Math.abs(b.max[0] - shell.width),
  };
  let best = 'north';
  for (const side of SIDES) if (dist[side] < dist[best]) best = side;
  if (o.mount === 'wall') return dist[best] <= MOUNT_REACH_M ? best : null;
  return WALL_KITS.has(o.kit) && dist[best] <= FLUSH_M ? best : null;
}

/**
 * Index a room root: what hides with each wall side (the wall itself, its
 * prefixed parts, and the scene objects attached to it), the ceilings, and a
 * fade record per side + 'ceiling' ({ objs, mats, value, target }).
 */
export function indexRoom(root, scene = null) {
  const walls = { north: [], south: [], east: [], west: [] };
  const ceilings = [];
  const byName = new Map();
  root.traverse((obj) => {
    const name = obj.name || '';
    const m = WALL_RE.exec(name);
    if (m) walls[m[1]].push(obj);
    else if (name.startsWith('ceiling')) ceilings.push(obj);
    if (name.startsWith('obj__') && !byName.has(name)) byName.set(name, obj);
  });
  for (const o of scene?.objects || []) {
    const side = attachedWall(o, scene.shell);
    const node = side && byName.get(`obj__${o.id}`);
    if (node) walls[side].push(node);
  }

  const replaced = new Set();
  const fades = {};
  for (const [key, objs] of Object.entries({ ...walls, ceiling: ceilings })) {
    const clones = new Map();
    const seen = new Set();
    for (const obj of objs) {
      obj.traverse((o) => {
        if (!(o.isMesh || o.isLine) || seen.has(o)) return;
        seen.add(o);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const next = list.map((mat) => {
          if (!clones.has(mat)) {
            const c = mat.clone();
            c.userData.baseOpacity = mat.opacity;
            c.userData.baseTransparent = mat.transparent;
            clones.set(mat, c);
            replaced.add(mat);
          }
          return clones.get(mat);
        });
        o.material = Array.isArray(o.material) ? next : next[0];
      });
    }
    fades[key] = { objs, mats: [...clones.values()], value: 1, target: 1 };
  }

  // Originals no mesh uses any more: free them (their textures live on in the clones).
  if (replaced.size) {
    const used = new Set();
    root.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) used.add(m);
    });
    for (const m of replaced) if (!used.has(m)) m.dispose();
  }
  return { walls, ceilings, fades, fresh: true };
}

const _q = new THREE.Quaternion();
const _n = new THREE.Vector3();

/**
 * Decide which sides should show for one room (sets fade targets).
 *   room: { root, interior, fades }
 *   camXZ: [x, z] camera position; centreXZ: [x, z] reference centre (world)
 *   cutaway: true while orbiting; false shows everything (viewpoints)
 */
export function applyDollhouse(room, camXZ, centreXZ, cutaway) {
  const { fades } = room;
  fades.ceiling.target = cutaway ? 0 : 1;
  let dx = camXZ[0] - centreXZ[0];
  let dz = camXZ[1] - centreXZ[1];
  const len = Math.hypot(dx, dz);
  const decide = room.interior && cutaway && len > 1e-3;
  if (decide) {
    dx /= len;
    dz /= len;
    room.root.getWorldQuaternion(_q);
  }
  for (const side of SIDES) {
    let show = true;
    if (decide) {
      _n.set(WALL_OUT[side][0], 0, WALL_OUT[side][1]).applyQuaternion(_q);
      show = _n.x * dx + _n.z * dz <= HIDE_DOT;
    }
    fades[side].target = show ? 1 : 0;
  }
}

/** Move every fade toward its target. Returns true while any is still moving. */
export function stepFades(room, dtMs, instant) {
  let moving = false;
  const snap = instant || room.fresh;
  room.fresh = false;
  for (const f of Object.values(room.fades)) {
    if (f.value !== f.target) {
      const step = snap ? 1 : dtMs / FADE_MS;
      f.value = f.target > f.value ? Math.min(f.target, f.value + step) : Math.max(f.target, f.value - step);
      for (const m of f.mats) {
        m.opacity = m.userData.baseOpacity * f.value;
        m.transparent = m.userData.baseTransparent || f.value < 1;
      }
      for (const o of f.objs) o.visible = f.value > 0.001;
      if (f.value !== f.target) moving = true;
    }
  }
  return moving;
}
