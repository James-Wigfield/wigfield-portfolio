/* Where the hero render looks from, as a compass azimuth (degrees clockwise from the room's
   north, from the room toward the camera) and an elevation. The map turns each 3D diorama so
   that, with the map pointing north, it's seen from this side, the same view as its marker
   (renders/marker.png is cut from the hero).

   A port of tools/memory-rooms/blender/build_room.py: choose_interior_corner() and
   choose_exterior_azimuth(), with lighting.py's sun azimuth. Keep them in step. A scene's own
   `hero` view wins, as it does in Blender. */

/** build_room.py THREE_QUARTER_ELEV / THREE_QUARTER_FOV. */
export const HERO_ELEV = { interior: 36, exterior: 30 };
export const HERO_FOV = 34;

const COMPASS = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
/** lighting.py MOODS: [sun azimuth, sun energy]. */
const MOODS = { morning: [110, 3.2], day: [200, 3.6], golden: [255, 3.4], evening: [285, 1.6], night: [160, 0.15], overcast: [180, 0] };

const DEG = 180 / Math.PI;
const norm = (a) => ((a % 360) + 360) % 360;

function interiorCorner(scene) {
  const W = scene.shell?.width ?? 0;
  const D = scene.shell?.depth ?? 0;
  const score = { north: 0, south: 0, east: 0, west: 0 };
  for (const o of scene.shell?.openings || []) score[o.wall] += o.type === 'window' ? 2 : 1;
  const block = { north: 0, south: 0, east: 0, west: 0 }; // tall things the camera looks through
  for (const ob of scene.objects || []) {
    const [x, y, z] = ob.at;
    const [w, h, d] = ob.size;
    const r = Math.max(w, d) / 2 + 0.15;
    const near = { north: z - r <= 0, south: z + r >= D, west: x - r <= 0, east: x + r >= W };
    const tall = y + h > 1.1 && h > 0.9 && ob.mount !== 'wall' && ob.mount !== 'ceiling';
    const hung = ob.mount === 'wall' || ob.kit === 'frame' || ob.kit === 'curtain';
    for (const [wall, hit] of Object.entries(near)) {
      if (!hit) continue;
      score[wall] += 0.5;
      if (tall) block[wall] += 3 + 2 * h * Math.min(w, 1.5);
      if (hung) block[wall] += 8;
    }
  }
  // camera azimuth → (the two walls it looks AT, the two it looks THROUGH); ties: the earlier one
  const corners = [
    [135, ['north', 'west'], ['south', 'east']],
    [225, ['north', 'east'], ['south', 'west']],
    [45, ['south', 'west'], ['north', 'east']],
    [315, ['south', 'east'], ['north', 'west']],
  ];
  let best = corners[0];
  let bestV = -Infinity;
  for (const c of corners) {
    const v = score[c[1][0]] + score[c[1][1]] - block[c[2][0]] - block[c[2][1]];
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best[0];
}

/** lighting.py: the (last) sun's azimuth, else the mood's sun, else 250 for a sunless exterior. */
function sunAzimuth(scene) {
  const [moodAz, sunE] = MOODS[scene.style?.mood] || MOODS.day;
  const suns = (scene.lights || []).filter((l) => l.type === 'sun');
  const last = suns[suns.length - 1];
  if (last) return last.azimuth ?? COMPASS[last.from] ?? moodAz;
  return sunE > 0 ? moodAz : 250;
}

function exteriorAzimuth(scene) {
  const objs = scene.objects || [];
  if (!objs.length) return 150;
  let main = objs[0];
  const key = (o) => [o.kit === 'block' ? 1 : 0, o.size[0] * o.size[2]];
  for (const o of objs) {
    const [a, b] = key(o);
    const [ma, mb] = key(main);
    if (a > ma || (a === ma && b > mb)) main = o;
  }
  const front = norm(180 - (main.rotY || 0));
  const sun = sunAzimuth(scene);
  const dist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const cands = [norm(front + 40), norm(front - 40)];
  return dist(cands[1], sun) < dist(cands[0], sun) ? cands[1] : cands[0];
}

/** { azimuth, elevation } of the hero camera for a scene.json (null → a south-east three-quarter). */
export function heroView(scene) {
  const kind = scene?.kind === 'exterior' ? 'exterior' : 'interior';
  if (!scene) return { azimuth: 135, elevation: HERO_ELEV.interior };
  const h = scene.hero;
  if (h?.pos && h?.look) {
    const dx = h.pos[0] - h.look[0];
    const dy = h.pos[1] - h.look[1];
    const dz = h.pos[2] - h.look[2];
    return { azimuth: norm(Math.atan2(dx, -dz) * DEG), elevation: Math.atan2(dy, Math.hypot(dx, dz)) * DEG };
  }
  return { azimuth: kind === 'interior' ? interiorCorner(scene) : exteriorAzimuth(scene), elevation: HERO_ELEV[kind] };
}
