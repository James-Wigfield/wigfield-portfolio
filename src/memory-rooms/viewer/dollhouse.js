/* Dollhouse cut-away: while orbiting an interior, hide the ceiling and every
   wall that stands between the camera and the room (or building) centre.

   GLB contract (CONTRACTS.md §4, §6.3): a wall is the node `wall_<side>` (v1)
   or `wall__<id>` (v2 polygons, building rooms), its children, or any node
   whose name starts with it (e.g. `wall_north__window0_frame`). Hiding by
   prefix takes its frames, glass and door with it. A wall hides by its outward
   normal: the normalised shell's (scene/shell.js), else the node's glTF extras
   (`mrWall.normal`), else the v1 side's. The layout preview names its walls
   the same way.

   Walls fade rather than pop: each side (and the ceiling) gets its own clone
   of the materials it uses (a baked GLB shares ONE atlas material across the
   whole room), so its opacity can move on its own. */

import * as THREE from 'three';
import { aabb, footprint } from '../scene/geometry.js';
import { parseWallNode, resolveShell, wallNormalOf } from '../scene/shell.js';

/** Outward normal (xz) of each v1 interior wall, in the room's own frame. */
export const WALL_OUT = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const SIDES = Object.keys(WALL_OUT);
/** Fade keys: the ceiling's is 'ceiling', a wall's is its id (v1 sides keep their names). */
const wallKey = (id) => (id === 'ceiling' ? 'wall:ceiling' : id);

/** The normalised shell of a scene (null for exteriors, unknown shapes, or a building room without its building). */
function shellOf(scene, building) {
  if (scene?.kind !== 'interior') return null;
  try {
    return resolveShell(scene, building);
  } catch {
    return null;
  }
}

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
export function attachedWall(o, shell, sh = null) {
  if (o.mount !== 'wall' && (o.mount === 'floor' || o.at[1] < FLOOR_STANDING_M) && o.kit !== 'curtain') return null;
  if (!shell) return null;
  if (shell.width === undefined) return sh ? attachedWallAny(o, sh) : null;
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
 * attachedWall for any shell (v2 polygons, building rooms): the nearest closed wall
 * the footprint runs alongside, measured from its inner face along the wall's normal.
 * On a box it gives the same answer as the v1 code above.
 */
export function attachedWallAny(o, sh) {
  const corners = footprint(o);
  let best = null;
  let bestD = Infinity;
  for (const w of sh.walls) {
    if (w.open || !(w.length > 0)) continue;
    const ux = (w.b[0] - w.a[0]) / w.length;
    const uz = (w.b[1] - w.a[1]) / w.length;
    let reach = -Infinity;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, z] of corners) {
      const rx = x - w.a[0];
      const rz = z - w.a[1];
      reach = Math.max(reach, rx * w.out[0] + rz * w.out[1]);
      const t = rx * ux + rz * uz;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    if (hi < -0.05 || lo > w.length + 0.05) continue; // not alongside this wall
    const d = Math.abs(reach);
    if (d < bestD) {
      bestD = d;
      best = w.id;
    }
  }
  if (best === null) return null;
  if (o.mount === 'wall') return bestD <= MOUNT_REACH_M ? best : null;
  return WALL_KITS.has(o.kit) && bestD <= FLUSH_M ? best : null;
}

/**
 * What hides with each wall and with the ceiling:
 *   { walls: { <wall id>: [Object3D]… }, normals: { <wall id>: [x, z] }, ceilings }.
 * v1 rooms keep their four sides (north/south/east/west) as ids.
 */
export function groupRoom(root, scene = null, building = null) {
  // v1 rooms (and exteriors, which have no shell) keep the four side keys exactly as before
  const v1Box = !scene?.shell || scene.shell.width !== undefined;
  const sh = v1Box ? null : shellOf(scene, building);
  const walls = v1Box ? { north: [], south: [], east: [], west: [] } : {};
  const normals = v1Box ? { ...WALL_OUT } : {};
  for (const w of sh?.walls || []) {
    if (w.open) continue;
    walls[wallKey(w.id)] = [];
    normals[wallKey(w.id)] = w.out;
  }
  const ceilings = [];
  const byName = new Map();
  root.traverse((obj) => {
    const name = obj.name || '';
    const wall = parseWallNode(name);
    if (wall && (!v1Box || wall.legacy || !scene)) {
      const key = wallKey(wall.id);
      (walls[key] ||= []).push(obj);
      if (!(key in normals)) {
        const mw = obj.userData?.mrWall;
        if (mw && 'exterior' in mw) {
          // a building level's wall (CONTRACTS.md 6.4): its normal is the wall's LEFT normal. An exterior wall
          // hides when its outside faces the camera (the side with no room); a partition never hides.
          if (mw.exterior && Array.isArray(mw.normal)) normals[key] = mw.rooms?.left ? [-mw.normal[0], -mw.normal[1]] : mw.normal;
          else if (!mw.exterior) normals[key] = null;
        } else {
          const n = wallNormalOf(obj);
          if (n) normals[key] = n;
        }
      }
    } else if (name.startsWith('ceiling')) ceilings.push(obj);
    if (name.startsWith('obj__') && !byName.has(name)) byName.set(name, obj);
  });
  for (const o of scene?.objects || []) {
    if (o.kit === 'pendant' || o.mount === 'ceiling') {
      // hung from the ceiling: it floats once the ceiling is cut away, so it goes with it
      const node = byName.get(`obj__${o.id}`);
      if (node) ceilings.push(node);
      continue;
    }
    const side = attachedWall(o, scene.shell, sh);
    const node = side && byName.get(`obj__${o.id}`);
    if (node) (walls[wallKey(side)] ||= []).push(node);
  }
  return { walls, normals, ceilings };
}

/**
 * Every mesh a dollhouse view from camXZ hides (the walls on the camera's side, the
 * ceiling), without touching any material: what "Recall" leaves out of its cloud.
 */
export function hiddenAtView(root, scene, camXZ, centreXZ, building = null) {
  const { walls, normals, ceilings } = groupRoom(root, scene, building);
  const out = new Set();
  let dx = camXZ[0] - centreXZ[0];
  let dz = camXZ[1] - centreXZ[1];
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const take = (list) => list.forEach((o) => o.traverse((c) => out.add(c)));
  for (const [key, n] of Object.entries(normals)) if (n && n[0] * dx + n[1] * dz > HIDE_DOT) take(walls[key] || []);
  take(ceilings);
  return out;
}

/**
 * Index a room root: what hides with each wall side (the wall itself, its
 * prefixed parts, and the scene objects attached to it), the ceilings, and a
 * fade record per side + 'ceiling' ({ objs, mats, value, target }).
 */
export function indexRoom(root, scene = null, building = null) {
  const { walls, normals, ceilings } = groupRoom(root, scene, building);

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
  return { walls, normals, ceilings, fades, fresh: true };
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
  const normals = room.normals || WALL_OUT;
  for (const key of Object.keys(fades)) {
    if (key === 'ceiling') continue;
    const n = normals[key];
    let show = true;
    if (decide && n) {
      _n.set(n[0], 0, n[1]).applyQuaternion(_q);
      show = _n.x * dx + _n.z * dz <= HIDE_DOT;
    }
    fades[key].target = show ? 1 : 0;
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
