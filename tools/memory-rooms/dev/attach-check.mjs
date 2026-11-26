#!/usr/bin/env node
/* attach-check: what hides with each wall on a building room's SPOT page (no building.json), from its real slice.
   Reads <work>/<spot>/room.glb (node names, extras, positions: no textures) into a three.js tree and runs
   viewer/dollhouse.js groupRoom(root, scene, null), the call the spot page makes.

     node tools/memory-rooms/dev/attach-check.mjs <spotId> [<spotId> ...]

   Prints, per wall, the scene objects that hide with it, and every wall-mounted object that attaches to nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { groupRoom } from '../../../src/memory-rooms/viewer/dollhouse.js';

const WORK = path.resolve('memory-rooms-work');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
let bad = 0;
for (const id of process.argv.slice(2)) {
  const dir = path.join(WORK, id);
  const scene = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));
  const doc = await io.read(path.join(dir, 'room.glb'));
  const root = new THREE.Group();
  const build = (node, parent) => {
    const mesh = node.getMesh();
    let obj;
    if (mesh) {
      const g = new THREE.Group();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(pos.getArray()), 3));
        g.add(new THREE.Mesh(geo));
      }
      obj = g;
    } else obj = new THREE.Group();
    obj.name = node.getName();
    obj.userData = { ...(node.getExtras() || {}) };
    obj.position.fromArray(node.getTranslation());
    obj.quaternion.fromArray(node.getRotation());
    obj.scale.fromArray(node.getScale());
    parent.add(obj);
    for (const c of node.listChildren()) build(c, obj);
  };
  for (const n of doc.getRoot().getDefaultScene().listChildren()) build(n, root);
  const { walls, normals } = groupRoom(root, scene, null);
  console.log(`\n${scene.title} (${id})`);
  const hung = new Set();
  for (const [key, list] of Object.entries(walls)) {
    const objs = list.map((o) => o.name).filter((n) => n.startsWith('obj__')).map((n) => n.slice(5));
    objs.forEach((o) => hung.add(o));
    if (objs.length) console.log(`  ${key} (normal ${JSON.stringify(normals[key])}): ${objs.join(', ')}`);
  }
  for (const o of scene.objects) {
    if (o.mount === 'wall' && !hung.has(o.id)) {
      console.log(`  ✗ ${o.id} is mount "wall" but hides with no wall`);
      bad++;
    }
  }
}
process.exit(bad ? 1 : 0);
