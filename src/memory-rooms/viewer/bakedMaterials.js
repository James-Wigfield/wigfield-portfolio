/* The GLB contract (CONTRACTS.md §4): Blender has already lit everything and
   baked the result into each material's baseColorTexture, display-referred
   (through AgX, sRGB). So the viewer replaces every material with an unlit
   MeshBasicMaterial and never recomputes light on the phone.

     glass…  → tinted, 18 % opaque, no depth write
     emit…   → flat emissive (or base) colour
     other   → the baked map × baseColorFactor (or just the colour, untextured) */

import * as THREE from 'three';
import { disposeMaterial } from './dispose.js';

const GLASS_OPACITY = 0.18;

function isBlack(c) {
  return !c || (c.r < 1e-4 && c.g < 1e-4 && c.b < 1e-4);
}

function toBasic(m, anisotropy) {
  const name = m.name || '';
  const lower = name.toLowerCase();
  const color = m.color ? m.color.clone() : new THREE.Color(0xffffff);

  if (lower.startsWith('glass')) {
    return new THREE.MeshBasicMaterial({
      name,
      color,
      transparent: true,
      opacity: GLASS_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  if (lower.startsWith('emit')) {
    const glow = !isBlack(m.emissive) ? m.emissive.clone().multiplyScalar(Math.max(1, m.emissiveIntensity ?? 1)) : color;
    return new THREE.MeshBasicMaterial({ name, color: glow, map: m.emissiveMap || null, side: m.side });
  }

  const map = m.map || null;
  if (map) {
    // The bake is display-referred sRGB: decode as sRGB so output == input.
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
    map.needsUpdate = true;
  }
  return new THREE.MeshBasicMaterial({
    name,
    map,
    color,
    side: m.side,
    vertexColors: m.vertexColors,
    transparent: m.transparent,
    opacity: m.opacity,
    alphaTest: m.alphaTest,
    depthWrite: m.depthWrite,
  });
}

/**
 * Swap every material under `root` for its unlit twin. Originals (and any of
 * their textures the twins don't reuse) are disposed straight away.
 */
export function applyBakedMaterials(root, { anisotropy = 4 } = {}) {
  const twins = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((m) => {
      if (!twins.has(m)) twins.set(m, toBasic(m, anisotropy));
      return twins.get(m);
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
  const keep = new Set();
  for (const twin of twins.values()) {
    if (twin.map) keep.add(twin.map);
  }
  for (const original of twins.keys()) disposeMaterial(original, keep);
  return root;
}
