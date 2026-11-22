/* Structure vs furniture, and the empty / furnished state of a baked room or building level (CONTRACTS.md §4, §6.4).

   Every node a bake exports since 2026-11-22 carries glTF extras `mrKind: "structure" | "furniture"`
   (three.js: userData.mrKind). GLBs baked before that fall back to the name rules: a node named `obj__…` or
   `room__<room>__obj__…` (or under one) is furniture, everything else structure.

   The empty state is a SECOND BAKE of the structure with the furniture hidden from the render (clean light on the
   walls and floors, no furniture shadows) into the same lightmap UV layout. It ships as a texture-only GLB
   (`model/empty` on a spot, `model/level-<id>-empty` on a building): one tiny triangle per atlas, its material
   named exactly as the room's (`baked_atlas<i>`), carrying that atlas re-baked empty. Going empty hides every
   furniture mesh and swaps the map of every material of that name; going back swaps the originals in. No geometry
   is reloaded or re-parsed; the empty set loads once, on first use.

   Furniture hides through three.js LAYERS (moved off layer 0, which the camera and the raycaster use), never
   `visible`: the dollhouse fades drive `visible` on wall-attached pieces and would bring them back. */

import * as THREE from 'three';
import { disposeTexture } from './dispose.js';

export const HIDDEN_LAYER = 5;
const FURNITURE_NAME = /^(obj__|room__.+?__obj__)/;
const ATLAS_NAME = /^baked_atlas\d+$/;

/** 'furniture' | 'structure' for one object, from its nearest labelled ancestor, else the name rules. */
export function kindOf(obj, root) {
  for (let o = obj; o && o !== root?.parent; o = o.parent) {
    const k = o.userData?.mrKind;
    if (k === 'furniture' || k === 'structure') return k;
  }
  for (let o = obj; o && o !== root?.parent; o = o.parent) {
    if (FURNITURE_NAME.test(o.name || '')) return 'furniture';
  }
  return 'structure';
}

/** Index a loaded room root: its furniture meshes, and whether its labels came from the bake. */
export function indexFurnishing(root) {
  const furniture = [];
  let labelled = false;
  root.traverse((o) => {
    if (o.userData?.mrKind) labelled = true;
    if ((o.isMesh || o.isLine || o.isPoints) && kindOf(o, root) === 'furniture') furniture.push(o);
  });
  return { furniture, labelled };
}

/** Hide (or show) a room's furniture: every furniture mesh off layer 0 (camera + raycaster), on HIDDEN_LAYER. */
export function setFurnitureShown(room, shown) {
  for (const o of room.furnishing?.furniture || []) {
    if (shown) o.layers.set(0);
    else o.layers.set(HIDDEN_LAYER);
  }
}

/** The atlases in a texture-only empty GLB, by material name. */
export function emptyMapsFrom(gltfScene, anisotropy = 4) {
  const maps = new Map();
  gltfScene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m?.map && ATLAS_NAME.test(m.name || '') && !maps.has(m.name)) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = anisotropy;
        m.map.needsUpdate = true;
        maps.set(m.name, m.map);
      }
    }
  });
  // everything but the textures we keep
  gltfScene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) m.dispose();
  });
  return maps;
}

/**
 * Point every material of `room` named like an atlas at the empty (or the furnished) map. The furnished maps are
 * remembered the first time (every dollhouse clone shares the original's texture), so this swaps both ways.
 */
export function swapAtlases(room, empty) {
  const f = room.furnishing;
  if (!f?.emptyMaps) return 0;
  f.fullMaps ||= new Map();
  let n = 0;
  room.root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || !ATLAS_NAME.test(m.name || '')) continue;
      if (!f.fullMaps.has(m.name) && m.map) f.fullMaps.set(m.name, m.map);
      const next = empty ? f.emptyMaps.get(m.name) : f.fullMaps.get(m.name);
      if (next && m.map !== next) {
        m.map = next;
        n++;
      }
    }
  });
  return n;
}

/** Free the set that is not on any material (the other one goes with the room's tree). */
export function disposeFurnishing(room) {
  const f = room.furnishing;
  if (!f) return;
  const used = new Set();
  room.root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.map) used.add(m.map);
  });
  for (const set of [f.emptyMaps, f.fullMaps]) for (const t of set?.values() || []) if (!used.has(t)) disposeTexture(t);
  f.emptyMaps = null;
  f.fullMaps = null;
}
