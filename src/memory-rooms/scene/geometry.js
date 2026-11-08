/* ============================================================================
   scene.json geometry helpers, shared by the viewer and check-scene.mjs.
   Plain maths, no three.js, so Node can import it too.

   Conventions (same as scene.schema.json):
     x west -> east, y up, z north -> south, metres.
     rotY degrees about +y; at rotY = 0 an object's front faces +z (south).
     rotating by +90 turns +z into +x (front faces east).
   ========================================================================== */

const RAD = Math.PI / 180;

/** Rotate an (x, z) offset by rotY degrees about +y (the three.js / Blender sense). */
export function rotXZ(x, z, rotY = 0) {
  const t = rotY * RAD;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

/** The 4 footprint corners of an object, world xz. */
export function footprint(obj) {
  const [w, , d] = obj.size;
  const [cx, , cz] = obj.at;
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, z]) => {
    const [rx, rz] = rotXZ(x, z, obj.rotY || 0);
    return [cx + rx, cz + rz];
  });
}

/** World-axis bounding box { min: [x, y, z], max: [x, y, z] } of an object. */
export function aabb(obj) {
  const pts = footprint(obj);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return {
    min: [Math.min(...xs), obj.at[1], Math.min(...zs)],
    max: [Math.max(...xs), obj.at[1] + obj.size[1], Math.max(...zs)],
  };
}

/** Length of a wall (interior): north/south walls run along x, east/west along z. */
export function wallLength(shell, wall) {
  return wall === 'north' || wall === 'south' ? shell.width : shell.depth;
}

/**
 * Where an opening sits, in world coordinates: its two ends on the wall line
 * plus the sill and head heights. offset runs from the wall's lower-x / lower-z end.
 */
export function openingSpan(shell, op) {
  const sill = op.sill ?? (op.type === 'window' ? 0.9 : 0);
  const a = op.offset;
  const b = op.offset + op.width;
  switch (op.wall) {
    case 'north': return { from: [a, 0], to: [b, 0], sill, head: sill + op.height };
    case 'south': return { from: [a, shell.depth], to: [b, shell.depth], sill, head: sill + op.height };
    case 'west': return { from: [0, a], to: [0, b], sill, head: sill + op.height };
    case 'east': return { from: [shell.width, a], to: [shell.width, b], sill, head: sill + op.height };
    default: return null;
  }
}

/** Inward normal (xz) of each interior wall. */
export const WALL_NORMAL = { north: [0, 1], south: [0, -1], west: [1, 0], east: [-1, 0] };

/**
 * A photo camera's vertical field of view (what three.js PerspectiveCamera.fov
 * wants). scene `fov` is across the photo's LONG edge; aspect = width / height.
 */
export function verticalFov(cam, aspect = cam.aspect ?? 0.75) {
  const fov = cam.fov ?? 70;
  if (aspect < 1) return fov; // portrait: the long edge is vertical
  return (2 * Math.atan(Math.tan((fov * RAD) / 2) / aspect)) / RAD;
}

/** Room-local point -> group frame (for /memories/group/:group). */
export function toGroupFrame([x, y, z], frame) {
  if (!frame) return [x, y, z];
  const [rx, rz] = rotXZ(x, z, frame.rotY || 0);
  return [frame.origin[0] + rx, y + (frame.y || 0), frame.origin[1] + rz];
}

/** Bounds of everything in a scene (shell or site plus objects), world space. */
export function sceneBounds(scene) {
  const min = [Infinity, 0, Infinity];
  const max = [-Infinity, 0, -Infinity];
  const grow = (p) => {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  };
  if (scene.shell) {
    grow([0, 0, 0]);
    grow([scene.shell.width, scene.shell.height, scene.shell.depth]);
  } else if (scene.site) {
    const [w, d] = scene.site.ground.size;
    grow([-w / 2, 0, -d / 2]);
    grow([w / 2, 0, d / 2]);
  }
  for (const o of scene.objects || []) {
    const b = aabb(o);
    grow(b.min);
    grow(b.max);
  }
  if (!Number.isFinite(min[0])) return { min: [-1, 0, -1], max: [1, 1, 1] };
  return { min, max };
}
