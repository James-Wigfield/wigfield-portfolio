/* What stands on a v2 landscape's ground: the built sites and the plants (tools/.../v2/build_v2.py → props.glb,
   scatter.py → plants.bin).

     const sites = buildSites(propsRoot, env, maps)      // a Group of the site meshes, lit (materials.siteMaterial)
     const plants = new Plants(propsRoot, meta, buf, env, maps)
     scene.add(sites, plants.group)
     plants.update(camera)                               // every frame: picks what's drawn and at which LOD

   Plants: every instance of a species within NEAR m is drawn as its card prototype (lod 0, alpha-tested leaves),
   from NEAR to FAR as its solid blob (lod 1), and beyond that not at all (the ground carries the heath colour, see
   the terrain shader). The two cross-fade over BAND m with a screen-door dither, so nothing pops. The instance
   list is sorted into 32 m cells; the chosen instances are copied into each InstancedMesh only when the camera
   has moved a few metres. */

import * as THREE from 'three';
import { plantMaterial, rockMaterial, siteMaterial } from './propMaterials.js';

export const PLANT_TYPES = ['olearia', 'scaevola', 'acacia', 'tall', 'tussock', 'dead', 'rocka', 'rockb', 'rockc', 'rockd'];
// per type: [near (cards), far (blob), cap0, cap1]; the tall shrubs and the dead bushes carry further
const RANGE = {
  olearia: [45, 160],
  scaevola: [45, 160],
  acacia: [45, 160],
  tall: [80, 320],
  tussock: [30, 70],
  dead: [40, 90],
  rocka: [70, 260],
  rockb: [70, 260],
  rockc: [70, 260],
  rockd: [70, 260],
};
const BAND = 8;
const CELL = 32;

/** A prototype's geometry in its own frame with the node's transform baked in (pack.mjs quantises the GLB: the
    positions are ints scaled by the node), as plain floats so the instances can scale it freely. */
function bakedGeometry(mesh) {
  const g = mesh.geometry.clone();
  for (const [name, attr] of Object.entries(g.attributes)) {
    if (attr.array instanceof Float32Array) continue;
    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  return g;
}

export function buildSites(root, env, maps) {
  const group = new THREE.Group();
  group.name = 'landscape__sites';
  const mats = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !/^site__/.test(o.name)) return;
    const kind = o.name.split('__')[2]?.replace(/[._]\d+$/, '') || 'concrete';
    if (!mats.has(kind)) mats.set(kind, siteMaterial(env, maps, kind));
    const m = new THREE.Mesh(o.geometry, mats.get(kind));
    m.name = o.name;
    o.updateWorldMatrix(true, false);
    m.applyMatrix4(o.matrixWorld);
    m.userData.mrLand = 'site';
    group.add(m);
  });
  group.userData.dispose = () => {
    for (const m of mats.values()) m.dispose();
    group.traverse((o) => o.isMesh && o.geometry.dispose());
  };
  return group;
}

export class Plants {
  constructor(root, meta, buffer, env, maps, { scale = 1, reach = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'landscape__plants';
    const f = meta.frame;
    const n = meta.plants.count;
    const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const W = f.cols * f.cell;
    const D = f.rows * f.cell;
    const x0 = f.x0;
    const z0 = -f.y1;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.rot = new Float32Array(n);
    this.s = new Float32Array(n);
    this.sy = new Float32Array(n);
    this.tint = new Float32Array(n);
    this.type = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      this.x[i] = x0 + (dv.getUint16(o, true) / 65535) * W;
      this.z[i] = z0 + (dv.getUint16(o + 2, true) / 65535) * D;
      this.y[i] = dv.getUint16(o + 4, true) / 100 - 20;
      this.type[i] = dv.getUint8(o + 6);
      this.rot[i] = (dv.getUint8(o + 7) / 255) * Math.PI * 2;
      this.s[i] = (dv.getUint8(o + 8) / 255) * 2;
      this.sy[i] = (dv.getUint8(o + 9) / 255) * 2;
      this.tint[i] = dv.getUint8(o + 10) / 255;
    }
    // cells: per type, a map cellKey -> [indices]
    this.cells = PLANT_TYPES.map(() => new Map());
    for (let i = 0; i < n; i++) {
      if (this.type[i] >= PLANT_TYPES.length) continue;
      const key = Math.floor((this.x[i] - x0) / CELL) + Math.floor((this.z[i] - z0) / CELL) * 4096;
      const m = this.cells[this.type[i]];
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(i);
    }
    this.x0 = x0;
    this.z0 = z0;
    // prototypes
    const proto = {};
    root.traverse((o) => {
      if (o.isMesh && /^proto__/.test(o.name)) proto[o.name] = o; // names are unique: keep the __<lod> suffix
    });
    this.meshes = [];
    this.scale = scale;
    // a lighter tier (phones): every draw distance shortened by `reach`
    this.range = Object.fromEntries(Object.entries(RANGE).map(([k, [n, f]]) => [k, [n * reach, f * reach]]));
    const capOf = (type, lod) => {
      const [near, far] = this.range[type];
      const area = lod === 0 ? Math.PI * (near + BAND) ** 2 : Math.PI * ((far + BAND) ** 2 - (near - BAND) ** 2);
      const total = meta.plants.byType[PLANT_TYPES.indexOf(type)] || 0;
      // at most the whole set; else a generous density bound (the scatter's densest cells)
      return Math.max(16, Math.min(total, Math.ceil(area * 0.75)));
    };
    for (const type of PLANT_TYPES) {
      for (const lod of [0, 1]) {
        const parts = [];
        if (/^rock/.test(type)) {
          if (proto[`proto__${type}__${lod}`]) parts.push(['rock', proto[`proto__${type}__${lod}`]]);
        } else if (type === 'dead') {
          if (lod === 0 && proto['proto__dead__0']) parts.push(['bark', proto['proto__dead__0']]);
        } else if (type === 'tall') {
          if (lod === 0) {
            if (proto['proto__tall__0']) parts.push(['cards', proto['proto__tall__0']]);
            if (proto['proto__tall__0__bark']) parts.push(['bark', proto['proto__tall__0__bark']]);
          } else if (proto['proto__tall__1']) parts.push(['blob', proto['proto__tall__1']]);
        } else if (proto[`proto__${type}__${lod}`]) {
          parts.push(['cards', proto[`proto__${type}__${lod}`]]); // both LODs are leaf cards (lod 1: a few big ones)
        }
        for (const [kind, src] of parts) {
          const cap = capOf(type, lod);
          const geo = bakedGeometry(src);
          const mat =
            kind === 'rock'
              ? rockMaterial(env, maps, { lod, near: this.range[type][0], far: this.range[type][1], band: BAND })
              : plantMaterial(env, maps, { kind, species: type, lod, near: this.range[type][0], far: this.range[type][1], band: BAND });
          const im = new THREE.InstancedMesh(geo, mat, cap);
          im.name = `plants__${type}__${lod}__${kind}`;
          im.frustumCulled = false;
          im.count = 0;
          const aTint = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
          aTint.setUsage(THREE.DynamicDrawUsage);
          geo.setAttribute('aTint', aTint);
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.userData = { type, lod, cap, aTint };
          this.group.add(im);
          this.meshes.push(im);
        }
      }
    }
    this.last = new THREE.Vector3(1e9, 0, 1e9);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this.drawn = 0;
  }

  update(camera, { force = false } = {}) {
    const cam = camera.position;
    if (!force && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < 3 && Math.abs(cam.y - this.last.y) < 3) return;
    this.last.copy(cam);
    let drawn = 0;
    for (const im of this.meshes) {
      const { type, lod, cap, aTint } = im.userData;
      const t = PLANT_TYPES.indexOf(type);
      const [near, far] = this.range[type];
      const r0 = lod === 0 ? 0 : near - BAND;
      const r1 = lod === 0 ? near + BAND : far + BAND;
      // camera height counts: from the air the near range is the ground under the camera
      const reach = Math.sqrt(Math.max(0, r1 * r1 - Math.max(0, cam.y - 20) ** 2));
      let k = 0;
      if (reach > 0) {
        const c0 = Math.floor((cam.x - reach - this.x0) / CELL);
        const c1 = Math.floor((cam.x + reach - this.x0) / CELL);
        const z0 = Math.floor((cam.z - reach - this.z0) / CELL);
        const z1 = Math.floor((cam.z + reach - this.z0) / CELL);
        const cells = this.cells[t];
        for (let cz = z0; cz <= z1 && k < cap; cz++) {
          for (let cx = c0; cx <= c1 && k < cap; cx++) {
            const list = cells.get(cx + cz * 4096);
            if (!list) continue;
            for (let li = 0; li < list.length && k < cap; li++) {
              const i = list[li];
              const dx = this.x[i] - cam.x;
              const dz = this.z[i] - cam.z;
              const dy = this.y[i] - cam.y;
              const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
              if (d < r0 || d > r1) continue;
              const sc = this.s[i] * this.scale;
              this._p.set(this.x[i], this.y[i], this.z[i]);
              this._q.setFromAxisAngle(this._up, this.rot[i]);
              this._s.set(sc, sc * this.sy[i], sc);
              this._m.compose(this._p, this._q, this._s);
              im.setMatrixAt(k, this._m);
              aTint.array[k] = this.tint[i];
              k++;
            }
          }
        }
      }
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
      aTint.needsUpdate = true;
      drawn += k;
    }
    this.drawn = drawn;
  }

  dispose() {
    for (const im of this.meshes) {
      im.geometry.dispose();
      im.material.dispose();
      im.dispose();
    }
    this.group.removeFromParent();
  }
}
