#!/usr/bin/env node
/* shell-view-check: the viewer side of "any shell shape" (Phase 3), in Node, no browser.

     node tools/memory-rooms/shell-view-check.mjs [--glb <room.glb> --scene <scene.json>]...

   For every example scene and every work-folder scene (v1 boxes, v2 polygons, sloped
   ceilings, a room of the example building):
     - the layout preview builds with no NaN, one `wall_<side>` / `wall__<id>` group per
       closed wall of the normalised shell, a floor, and a ceiling when it shows;
     - the dollhouse hides exactly the walls whose outward normal faces the camera
       (8 bearings), and on v1 boxes that is the same set the old side table gave;
     - attachedWall on a v1 box gives the same wall through the v1 code and the any-shape
       code (every object of every v1 scene);
     - the plan cut clips every material at floor + 1.2 m, inks every solid wall mesh,
       and removing it puts every material back.
   With --glb/--scene pairs it also reads baked GLBs: every wall node has its outward
   normal in the glTF extras (v2) and it matches the scene's normalised shell. */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { REPO, WORK } from './lib/api.mjs';
import { resolveShell } from '../../src/memory-rooms/scene/shell.js';
import { insetEdges } from '../../src/memory-rooms/scene/polygon.js';
import { buildLayoutPreview } from '../../src/memory-rooms/viewer/layoutPreview.js';
import { applyDollhouse, attachedWall, attachedWallAny, groupRoom, indexRoom, WALL_OUT } from '../../src/memory-rooms/viewer/dollhouse.js';
import { CUT_Y, PlanCut } from '../../src/memory-rooms/viewer/planCut.js';

const args = process.argv.slice(2);
let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) pass++;
  else {
    fail++;
    console.log(`✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
};

const EX = path.join(REPO, 'tools/memory-rooms/examples');
const building = JSON.parse(fs.readFileSync(path.join(EX, 'house.building.json'), 'utf8'));
const scenes = [];
for (const f of fs.readdirSync(EX)) if (f.endsWith('.scene.json')) scenes.push({ name: `examples/${f}`, scene: JSON.parse(fs.readFileSync(path.join(EX, f), 'utf8')) });
if (fs.existsSync(WORK)) {
  for (const d of fs.readdirSync(WORK)) {
    const p = path.join(WORK, d, 'scene.json');
    if (fs.existsSync(p)) scenes.push({ name: `work/${d}`, scene: JSON.parse(fs.readFileSync(p, 'utf8')) });
  }
}

const nanFree = (root) => {
  let bad = 0;
  root.traverse((o) => {
    const p = o.geometry?.attributes?.position;
    if (p) for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) bad++;
  });
  return bad === 0;
};

const fakeRenderer = () => ({ localClippingEnabled: false });

for (const { name, scene } of scenes) {
  if (scene.kind !== 'interior') continue;
  const b = scene.shell?.building ? building : null;
  const sh = resolveShell(scene, b);
  ok(sh, `${name}: the shell resolves`);
  if (!sh) continue;
  const root = buildLayoutPreview(scene, b);
  root.updateMatrixWorld(true);
  ok(nanFree(root), `${name}: preview has no NaN vertices`);
  const v1Box = scene.shell.width !== undefined;
  const closed = sh.walls.filter((w) => !w.open);
  for (const w of closed) {
    const node = w.node; // v1: wall_<side>; v2 (any shape, boxes too): wall__<id>
    if ((scene.version ?? 1) < 2) ok(node === `wall_${w.id}`, `${name}: v1 keeps the wall_<side> names`);
    const g = root.getObjectByName(node);
    let meshes = 0;
    g?.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    ok(g && meshes > 0, `${name}: preview wall ${node}`, g ? `${meshes} meshes` : 'missing');
  }
  ok(root.getObjectByName('floor'), `${name}: preview floor`);
  if (!v1Box || (scene.version ?? 1) >= 2) {
    // every wall piece is a closed solid facing out (positive signed volume)
    let bad = [];
    const _a = new THREE.Vector3();
    const _b = new THREE.Vector3();
    const _c = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh || !/^wall_/.test(o.name) || /glass/.test(o.name)) return;
      const pos = o.geometry.attributes.position;
      let vol = 0;
      for (let i = 0; i < pos.count; i += 3) {
        _a.fromBufferAttribute(pos, i);
        _b.fromBufferAttribute(pos, i + 1);
        _c.fromBufferAttribute(pos, i + 2);
        vol += _a.dot(_b.clone().cross(_c)) / 6;
      }
      if (!(vol > 1e-6)) bad.push(`${o.name} ${vol.toExponential(1)}`);
    });
    ok(bad.length === 0, `${name}: every preview wall piece faces out (closed, positive volume)`, bad.slice(0, 3).join(', '));
    // every corner is walled: a ray down through the middle of each corner's mitre hits a wall
    // (a standalone room; a building's room has open sides and walls of several thicknesses)
    const t = sh.walls[0]?.thickness || 0.12;
    const outer = insetEdges(sh.outline, sh.outline.map(() => -t));
    const ray = new THREE.Raycaster();
    const missing = [];
    sh.outline.forEach((v, i) => {
      const oc = outer[i].start;
      const mx = (v[0] + oc[0]) / 2;
      const mz = (v[1] + oc[1]) / 2;
      ray.set(new THREE.Vector3(mx, 50, mz), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(root, true).find((h) => /^wall_/.test(h.object.name) && h.point.y > 0.5);
      if (!hit) missing.push(`[${mx.toFixed(2)}, ${mz.toFixed(2)}]`);
    });
    if (sh.kind !== 'building') ok(missing.length === 0, `${name}: every corner of the room is walled (mitred)`, missing.join(' '));
  }
  if (sh.ceiling?.show !== false) {
    const c = root.getObjectByName('ceiling');
    ok(c, `${name}: preview ceiling`);
    if (c) {
      c.geometry.computeBoundingBox();
      const { min, max } = c.geometry.boundingBox;
      const top = sh.top ?? sh.height;
      ok(Math.abs(max.y - top) < 0.06 && Math.abs(min.y - sh.height) < 0.06, `${name}: preview ceiling spans the eaves to the top`, `${min.y.toFixed(2)}–${max.y.toFixed(2)} vs ${sh.height}–${top}`);
    }
  }

  // dollhouse: hidden = walls whose normal faces the camera
  const index = indexRoom(root, scene, b);
  const room = { root, interior: true, ...index };
  const cx = (sh.box.min[0] + sh.box.max[0]) / 2;
  const cz = (sh.box.min[1] + sh.box.max[1]) / 2;
  let allRight = true;
  let detail = '';
  for (let k = 0; k < 8; k++) {
    const az = (k * 45 + 10) * (Math.PI / 180);
    const cam = [cx + Math.sin(az) * 20, cz - Math.cos(az) * 20];
    applyDollhouse(room, cam, [cx, cz], true);
    const dx = Math.sin(az);
    const dz = -Math.cos(az);
    for (const w of closed) {
      const key = w.id;
      const want = w.out[0] * dx + w.out[1] * dz > 0.18 ? 0 : 1;
      const got = room.fades[key]?.target;
      if (got !== want) {
        allRight = false;
        detail = `bearing ${k * 45 + 10}: wall ${key} target ${got}, want ${want}`;
      }
      if (v1Box) {
        const old = WALL_OUT[key][0] * dx + WALL_OUT[key][1] * dz > 0.18 ? 0 : 1;
        if (old !== got) {
          allRight = false;
          detail = `bearing ${k * 45 + 10}: wall ${key} differs from the v1 side table`;
        }
      }
    }
    if (room.fades.ceiling.target !== 0) {
      allRight = false;
      detail = 'ceiling not cut away';
    }
  }
  ok(allRight, `${name}: dollhouse hides the walls facing the camera (8 bearings)`, detail);
  const grouped = groupRoom(root, scene, b);
  ok(closed.every((w) => grouped.normals[w.id]), `${name}: every closed wall has a normal`);

  // attachedWall parity on v1 boxes
  if (v1Box) {
    const diff = (scene.objects || []).filter((o) => {
      const a = attachedWall(o, scene.shell);
      const gate = attachedWall({ ...o }, { ...scene.shell, width: undefined }, sh);
      return a !== gate || (a !== null && attachedWallAny(o, sh) !== a);
    });
    ok(diff.length === 0, `${name}: attachedWall v1 = any-shape on every object`, diff.map((o) => o.id).join(', '));
  }

  // the plan cut
  const holder = new THREE.Group();
  holder.position.y = 2.7; // an upper floor: the plane follows the room's own floor
  holder.add(root);
  holder.updateMatrixWorld(true);
  const r = fakeRenderer();
  const cut = new PlanCut(r);
  const before = new Map();
  const sidesBefore = new Map();
  root.traverse((o) => {
    if (o.isMesh) {
      for (const m of [o.material].flat()) {
        before.set(m, m.clippingPlanes);
        // a double-sided wall material (as a bake can be) must go front-sided while cut, and come back
        if (/^wall_/.test(o.parent?.name || o.name)) m.side = THREE.DoubleSide;
        sidesBefore.set(m, m.side);
      }
    }
  });
  const croom = { root, holder, walls: index.walls };
  cut.apply(croom);
  let clipped = 0;
  let planeY = null;
  root.traverse((o) => {
    if (o.isMesh && !o.userData.planCutInk) {
      for (const m of [o.material].flat()) {
        if (m.clippingPlanes?.length === 1) {
          clipped++;
          planeY = m.clippingPlanes[0].constant;
        }
      }
    }
  });
  let solid = 0;
  let inked = 0;
  for (const list of Object.values(index.walls)) {
    for (const g of list) {
      if ((g.name || '').startsWith('obj__')) continue; // things hung on a wall are not wall section
      g.traverse((o) => {
        if (!o.isMesh || o.userData.planCutInk) return;
        if (!/glass/i.test(o.material?.name || '')) solid++;
        if (o.children.some((c) => c.userData.planCutInk)) inked++;
      });
    }
  }
  ok(r.localClippingEnabled && clipped > 0 && Math.abs(planeY - (2.7 + CUT_Y)) < 1e-9, `${name}: plan cut clips at floor + ${CUT_Y} m`, `clipped ${clipped}, plane ${planeY}`);
  ok(solid > 0 && inked === solid, `${name}: plan cut inks every solid wall mesh`, `${inked}/${solid}`);
  let frontOnly = true;
  for (const list of Object.values(index.walls)) for (const g of list) if (!(g.name || '').startsWith('obj__')) g.traverse((o) => o.isMesh && !o.userData.planCutInk && !/glass/i.test(o.material?.name || '') && [o.material].flat().some((m) => m.side !== THREE.FrontSide) && (frontOnly = false));
  ok(frontOnly, `${name}: cut walls draw front faces only (the ink shows through the cut)`);
  cut.remove(croom);
  let restored = true;
  let twins = 0;
  root.traverse((o) => {
    if (o.userData.planCutInk) twins++;
    if (o.isMesh) for (const m of [o.material].flat()) if ((before.has(m) && m.clippingPlanes !== before.get(m)) || (sidesBefore.has(m) && m.side !== sidesBefore.get(m))) restored = false;
  });
  ok(restored && twins === 0 && !r.localClippingEnabled, `${name}: removing the plan cut restores every material`);

  // with its normalised shell: a section cap (the walls' footprints at the cut), about perimeter × thickness
  const cut2 = new PlanCut(r);
  const sroom = { root, holder, walls: index.walls, shell: sh };
  cut2.apply(sroom);
  const cap = root.getObjectByName('__section_cap');
  let area = 0;
  if (cap) {
    const pa = cap.geometry.attributes.position.array;
    for (let i = 0; i < pa.length; i += 9) area += Math.abs((pa[i + 3] - pa[i]) * (pa[i + 8] - pa[i + 2]) - (pa[i + 6] - pa[i]) * (pa[i + 5] - pa[i + 2])) / 2;
  }
  const want = sh.walls.filter((w) => !w.open).reduce((acc, w) => acc + w.length * (w.thickness || 0.12), 0);
  ok(cap && area > want * 0.5 && area < want * 1.6, `${name}: plan cut draws a section cap (walls' footprints at 1.2 m)`, cap ? `${area.toFixed(2)} m² vs ~${want.toFixed(2)}` : 'no cap');
  cut2.remove(sroom);
  ok(!root.getObjectByName('__section_cap'), `${name}: removing the plan cut takes the cap away`);
}

// baked GLBs: wall nodes carry their outward normals
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--glb') continue;
  const glbPath = args[i + 1];
  const scenePath = args[args.indexOf('--scene', i)] === '--scene' ? args[args.indexOf('--scene', i) + 1] : null;
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const scene = scenePath ? JSON.parse(fs.readFileSync(scenePath, 'utf8')) : null;
  const sh = scene ? resolveShell(scene) : null;
  const walls = (gltf.nodes || []).filter((n) => /^wall__[a-z0-9-]+$/.test(n.name || ''));
  ok(walls.length > 0, `${path.basename(path.dirname(glbPath))}: GLB has wall__<id> nodes`, `${walls.length}`);
  for (const n of walls) {
    const id = n.name.slice(6);
    const nrm = n.extras?.mrWall?.normal;
    ok(Array.isArray(nrm) && nrm.length === 2, `GLB ${n.name}: extras.mrWall.normal`);
    const w = sh?.walls.find((x) => x.id === id);
    if (w && nrm) ok(Math.abs(w.out[0] - nrm[0]) < 1e-4 && Math.abs(w.out[1] - nrm[1]) < 1e-4, `GLB ${n.name}: normal matches the scene's shell`, `${nrm} vs ${w.out}`);
  }
}

console.log(`\nscenes: ${scenes.filter((s) => s.scene.kind === 'interior').map((s) => s.name).join(', ')}`);
console.log(`shell-view-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
