/* PROJECTOR LIFE — room/ entry. STUB by the lead so the tab renders; the room
   agent replaces this file (contract: CONTRACTS.md §3). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import glbUrl from '../assets/she-d.glb?url';
import { buildPatches, SHED } from './roomModel.js';

export async function loadRoom({ values }) {
  const gltf = await new GLTFLoader().loadAsync(glbUrl);
  const root = new THREE.Group();
  root.name = 'pjl-room';
  root.add(gltf.scene);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    o.material = new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color, transparent: m.transparent, opacity: m.opacity });
    m.dispose();
  });
  const ceiling = gltf.scene.getObjectByName('ceiling');
  if (ceiling) ceiling.visible = false;
  let patches = buildPatches({ apex: values['room.apex'] });
  const [cx, , cz] = SHED.centre;
  return {
    root,
    get patches() {
      return patches;
    },
    landing: () => ({ y: 0, patchId: 'floor', local: [0, 0], surface: 'floor' }),
    views: {
      cutaway: { position: [cx + 4.2, 2.6, cz + 4.6], target: [cx, 1.1, cz], fov: 50 },
      door: { position: [cx, 1.6, cz + 2.0], target: [cx, 1.4, cz - 2], fov: 70 },
      armchair: { position: [2.74, 1.1, 0.75], target: [cx, 1.4, cz + 1], fov: 70 },
      loft: { position: [0.9, 1.35, 2.2], target: [cx + 0.3, 3, cz], fov: 75 },
      plan: { position: [cx, 9, cz + 0.001], target: [cx, 0, cz], fov: 45 },
    },
    surfaces: [],
    setParams(v, changed) {
      if (changed.includes('room.apex')) {
        patches = buildPatches({ apex: v['room.apex'] });
        return { patchesChanged: true };
      }
      return { patchesChanged: false };
    },
    update() {},
    pick: () => null,
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    },
  };
}
