/* Small 3D helpers the viewer draws itself: the photo-camera glyphs and the
   soft ground disc. Plain three.js. */

import * as THREE from 'three';
import { verticalFov } from '../scene/geometry.js';

const RAD = Math.PI / 180;
const GLYPH_DEPTH = 0.3; // default metres from the lens to the frustum's far rectangle
const HOVER_SCALE = 2.6; // a hovered frustum grows so the photo on it reads

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
  // thin ink, quiet until hovered (the "Recall" sheet: drawn, not neon)
  const line = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 });
  const hot = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.95 });
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const picks = [];
  const glyphs = [];
  const thumbs = new Map(); // photo -> { mesh, mat }

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
    // the photo itself on the frustum's rectangle, shown on hover; turned to face the lens so
    // it reads the right way round from where it was taken (local +x is the photographer's left)
    const thumbMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    const thumbMesh = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hh * 2), thumbMat);
    thumbMesh.rotation.y = Math.PI;
    thumbMesh.position.z = z;
    thumbMesh.visible = false;
    thumbMesh.raycast = () => {};
    thumbMesh.name = `viewer__camera${cam.photo}__thumb`;
    glyph.add(thumbMesh);
    thumbs.set(cam.photo, { mesh: thumbMesh, mat: thumbMat });
    picks.push(pick);
    glyphs.push(glyph);
    group.add(glyph);
  }
  let hovered = null;
  const showThumbs = () => {
    for (const [photo, t] of thumbs) t.mesh.visible = photo === hovered && Boolean(t.mat.map);
  };

  return {
    group,
    picks,
    setColor(color) {
      line.color.set(color);
      hot.color.set(color);
    },
    /** The line materials may be off-mesh (hover swaps them), so free them here; thumbnails too. */
    disposeMaterials() {
      line.dispose();
      hot.dispose();
      for (const t of thumbs.values()) {
        t.mat.map?.dispose();
        t.mat.dispose();
        t.mesh.geometry.dispose();
      }
    },
    /** Give photo n its thumbnail texture (loaded by the viewer on first hover). */
    setThumb(photo, texture) {
      const t = thumbs.get(photo);
      if (!t) return texture?.dispose();
      t.mat.map = texture;
      t.mat.needsUpdate = true;
      showThumbs();
    },
    hasThumb: (photo) => Boolean(thumbs.get(photo)?.mat.map),
    setHover(photo) {
      hovered = photo ?? null;
      for (const g of glyphs) {
        const on = g.children[0].userData.photo === photo;
        g.material = on ? hot : line;
        g.scale.setScalar(on ? HOVER_SCALE : 1); // big enough for its photo to read
      }
      line.opacity = photo == null ? 0.42 : 0.24;
      showThumbs();
    },
  };
}

/**
 * The drafting table under a room: a fine ink grid on the paper that dissolves
 * with distance, plus a soft contact shadow under the footprint, so the
 * diorama reads as set down on a drawing, not floating on a disc.
 *   radius   how far the grid reaches from `centre` ([x, z])
 *   box      the footprint { min: [x, z], max: [x, z] } for the contact shadow
 *   cell     minor grid step in metres (major lines every `major` cells)
 * Returns the mesh; setColor(ink) recolours it for the theme.
 */
export function buildDraftingGround({ radius, centre, box, cell = 0.5, major = 2, shadow = 1 }) {
  const size = radius * 2.2;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uInk: { value: new THREE.Color(0x1d1c1a) },
      uShade: { value: new THREE.Color(0x1d1c1a) },
      uMinor: { value: 0.1 },
      uMajor: { value: 0.2 },
      uShadow: { value: 0.16 * shadow },
      uCell: { value: cell },
      uMajorEvery: { value: major },
      uCentre: { value: new THREE.Vector2(centre[0], centre[1]) },
      uRadius: { value: radius },
      uBoxMin: { value: new THREE.Vector2(box.min[0], box.min[1]) },
      uBoxMax: { value: new THREE.Vector2(box.max[0], box.max[1]) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform vec3 uShade;
      uniform float uMinor;
      uniform float uMajor;
      uniform float uShadow;
      uniform float uCell;
      uniform float uMajorEvery;
      uniform vec2 uCentre;
      uniform float uRadius;
      uniform vec2 uBoxMin;
      uniform vec2 uBoxMax;
      varying vec2 vXZ;
      float gridLine(vec2 p, float step) {
        vec2 g = abs(fract(p / step - 0.5) - 0.5) / fwidth(p / step);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        float d = length(vXZ - uCentre) / uRadius;
        float fade = 1.0 - smoothstep(0.35, 1.0, d);
        float minor = gridLine(vXZ, uCell) * uMinor;
        float major = gridLine(vXZ, uCell * uMajorEvery) * uMajor;
        // contact shadow: a rounded box under the footprint, soft at its edge
        vec2 c = (uBoxMin + uBoxMax) * 0.5;
        vec2 h = (uBoxMax - uBoxMin) * 0.5;
        vec2 q = abs(vXZ - c) - h;
        float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        float blur = max(0.35, min(h.x, h.y) * 0.45);
        float shadow = (1.0 - smoothstep(-blur * 0.2, blur, sd)) * uShadow;
        float line = max(minor, major) * fade;
        float a = max(line, shadow);
        if (a < 0.002) discard;
        // the shadow is always dark (ink on paper, black in the darkroom); the lines are the ink
        gl_FragColor = vec4(mix(uShade, uInk, line / max(a, 1e-4)), a);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'viewer__ground';
  mesh.position.set(centre[0], -0.012, centre[1]);
  mesh.renderOrder = -1;
  mesh.raycast = () => {};
  mesh.setColor = (ink, { minor = 0.1, major = 0.2, shadow: s = 0.16 } = {}, shade = ink) => {
    mat.uniforms.uInk.value.copy(ink);
    mat.uniforms.uShade.value.copy(shade);
    mat.uniforms.uMinor.value = minor;
    mat.uniforms.uMajor.value = major;
    mat.uniforms.uShadow.value = s * shadow;
  };
  return mesh;
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
