/* Small 3D helpers the viewer draws itself: the photo-camera glyphs and the
   soft ground disc. Plain three.js. */

import * as THREE from 'three';
import { verticalFov } from '../scene/geometry.js';

const RAD = Math.PI / 180;
const GLYPH_DEPTH = 0.3; // default metres from the lens to the frustum's far rectangle

/** Point a camera-like object at `look`, then apply the photo's roll. */
export function aimCamera(obj, pos, look, roll = 0, isCamera = true) {
  obj.position.set(pos[0], pos[1], pos[2]);
  obj.up.set(0, 1, 0);
  obj.lookAt(look[0], look[1], look[2]);
  // roll: positive = clockwise as seen by the photographer. A camera looks
  // down its local -z, so clockwise (seen from behind it) is a negative turn
  // about +z; for non-camera objects (+z forward) the sign flips.
  if (roll) obj.rotateZ((isCamera ? -roll : roll) * RAD);
}

/**
 * One wireframe camera per scene camera: apex at the lens, a rectangle with
 * the photo's aspect, a small tick on top. Each gets an invisible pick box.
 * Returns { group, picks: Mesh[] (userData.photo = n), setColor(hex), setHover(n) }.
 */
export function buildCameraGlyphs(cameras, aspectOf, depth = GLYPH_DEPTH) {
  const group = new THREE.Group();
  group.name = 'viewer__cameras';
  const line = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9 });
  const hot = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 1 });
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const picks = [];
  const glyphs = [];

  for (const cam of cameras) {
    const aspect = aspectOf(cam);
    const vf = verticalFov(cam, aspect) * RAD;
    const hh = depth * Math.tan(vf / 2);
    const hw = hh * aspect;
    const z = depth;
    const c = [
      [-hw, -hh, z],
      [hw, -hh, z],
      [hw, hh, z],
      [-hw, hh, z],
    ];
    const pts = [];
    const seg = (a, b) => pts.push(...a, ...b);
    for (const p of c) seg([0, 0, 0], p);
    for (let i = 0; i < 4; i++) seg(c[i], c[(i + 1) % 4]);
    const tick = hh * 0.35;
    seg([-tick, hh * 1.08, z], [0, hh * 1.08 + tick, z]);
    seg([0, hh * 1.08 + tick, z], [tick, hh * 1.08, z]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const glyph = new THREE.LineSegments(geo, line);
    glyph.name = `viewer__camera${cam.photo}`;
    glyph.raycast = () => {};
    aimCamera(glyph, cam.pos, cam.look, cam.roll, false);

    const pickGeo = new THREE.BoxGeometry(Math.max(hw * 2.6, depth * 0.7), Math.max(hh * 2.6, depth * 0.7), z * 1.4);
    pickGeo.translate(0, 0, z * 0.5);
    const pick = new THREE.Mesh(pickGeo, pickMat);
    pick.userData.photo = cam.photo;
    glyph.add(pick);
    picks.push(pick);
    glyphs.push(glyph);
    group.add(glyph);
  }

  return {
    group,
    picks,
    setColor(color) {
      line.color.set(color);
      hot.color.set(color);
    },
    /** The line materials may be off-mesh (hover swaps them), so free them here. */
    disposeMaterials() {
      line.dispose();
      hot.dispose();
    },
    setHover(photo) {
      for (const g of glyphs) g.material = g.children[0].userData.photo === photo ? hot : line;
      line.opacity = photo == null ? 0.9 : 0.55;
    },
  };
}

/** A radial alpha texture: opaque in the middle, fading to nothing at the rim. */
function fadeTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(0.78, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * The soft disc under a site (or a room): a circle that fades into the stage
 * colour behind the transparent canvas.
 */
export function buildGroundDisc(radius, centre, opacity = 1) {
  const map = fadeTexture();
  const mat = new THREE.MeshBasicMaterial({ color: 0x888888, alphaMap: map, transparent: true, opacity, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), mat);
  disc.name = 'viewer__disc';
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(centre[0], -0.015, centre[1]);
  disc.renderOrder = -1;
  disc.raycast = () => {};
  return disc;
}
