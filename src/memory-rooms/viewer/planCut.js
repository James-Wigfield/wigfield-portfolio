/* Plan cut: the architect's floor plan of a room. Everything above CUT_Y (1.2 m,
   the height a plan is drawn at) is clipped away, and the walls the cut passes
   through show as solid section ink. Furniture is cut too but stays hollow, the
   way a plan draws it in outline.

     const cut = new PlanCut(renderer);
     cut.apply(room, inkColour);   // room: { root, holder, walls, shell } (indexRoom + the normalised shell)
     cut.remove(room);
     cut.setInk(colour);

   The ink is a SECTION CAP: the walls' footprints drawn at the cut height (with a
   gap wherever a door or window crosses it), from the room's normalised shell with
   the same mitred corners the walls have. (A wall slab has no bottom face, so its
   own back faces would only show the floor band through the cut.) A room with no
   shell (an exterior, a scene-less model) falls back to back-face twins of its walls.

   Per room, the plane sits CUT_Y above the room's own floor (its holder's world
   y), so an upper-floor room in a group cuts at its own 1.2 m. */

import * as THREE from 'three';
import { insetEdges } from '../scene/polygon.js';

export const CUT_Y = 1.2;

const _p = new THREE.Vector3();
const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4;

/**
 * The walls' footprints at height y as triangles ([x, y, z] flat array, the shell's frame):
 * per wall, its solid stretches between the openings that cross y, from the inner face to the
 * outer one, mitred at the room's corners.
 */
export function sectionCap(sh, y) {
  const n = sh.outline.length;
  const found = [];
  for (let i = 0; i < n; i++) {
    const p = sh.outline[i];
    const q = sh.outline[(i + 1) % n];
    const w = sh.walls.find((x) => (near(x.a, p) && near(x.b, q)) || (near(x.a, q) && near(x.b, p)));
    found.push(w ? { w, rev: !near(w.a, p) } : null);
  }
  const edges = insetEdges(sh.outline, found.map((f) => (f && !f.w.open ? -(f.w.thickness || 0.12) : 0)));
  const outer = new Map();
  found.forEach((f, i) => f && outer.set(f.w.id, f.rev ? [edges[i].end, edges[i].start] : [edges[i].start, edges[i].end]));
  const pos = [];
  for (const w of sh.walls) {
    if (w.open || !(w.length > 0)) continue;
    const t = w.thickness || 0.12;
    const d = [(w.b[0] - w.a[0]) / w.length, (w.b[1] - w.a[1]) / w.length];
    const at = (u) => [w.a[0] + d[0] * u, w.a[1] + d[1] * u];
    const off = (p) => [p[0] + w.out[0] * t, p[1] + w.out[1] * t];
    const [A, B] = outer.get(w.id) || [off(w.a), off(w.b)];
    // solid stretches: [0, L] minus the openings that cross the cut
    const holes = sh.openings
      .filter((o) => o.wall === w.id && o.sill <= y && o.head >= y)
      .map((o) => [Math.max(0, o.offset), Math.min(w.length, o.offset + o.width)])
      .sort((p, q) => p[0] - q[0]);
    const solid = [];
    let u = 0;
    for (const [h0, h1] of holes) {
      if (h0 > u + 1e-4) solid.push([u, h0]);
      u = Math.max(u, h1);
    }
    if (u < w.length - 1e-4) solid.push([u, w.length]);
    for (const [u0, u1] of solid) {
      const p0 = at(u0);
      const p1 = at(u1);
      const q0 = u0 <= 1e-6 ? A : off(p0);
      const q1 = u1 >= w.length - 1e-6 ? B : off(p1);
      pos.push(p0[0], y, p0[1], p1[0], y, p1[1], q1[0], y, q1[1], p0[0], y, p0[1], q1[0], y, q1[1], q0[0], y, q0[1]);
    }
  }
  return pos;
}

export class PlanCut {
  constructor(renderer) {
    this.renderer = renderer;
    this.ink = new THREE.MeshBasicMaterial({ color: 0x1d1c1a, side: THREE.BackSide });
    this.ink.name = 'section-ink';
    this.cut = new Map(); // room -> { plane, saved, poche, inks, sides }
  }

  get active() {
    return this.cut.size > 0;
  }

  setInk(colour) {
    this.ink.color.copy(colour);
    for (const c of this.cut.values()) for (const m of c.inks) m.color.copy(colour);
  }

  apply(room, colour = null) {
    if (this.cut.has(room)) return;
    if (colour) this.ink.color.copy(colour);
    this.renderer.localClippingEnabled = true;
    (room.holder || room.root).getWorldPosition(_p);
    // keep y <= floor + CUT_Y (three.js discards the plane's negative side)
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), _p.y + CUT_Y);
    const saved = new Map();
    const clip = (mat) => {
      if (!mat || saved.has(mat)) return;
      saved.set(mat, mat.clippingPlanes);
      mat.clippingPlanes = [plane];
      mat.needsUpdate = true;
    };
    room.root.traverse((o) => {
      if (!(o.isMesh || o.isLine)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) clip(m);
    });

    const poche = [];
    const inks = [];
    const sides = new Map();
    const shell = room.shell;
    if (shell?.outline?.length >= 3 && shell.walls?.length) {
      // the section cap, a hair under the cut, in the room's own frame
      const pos = sectionCap(shell, CUT_Y - 0.002);
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const ink = new THREE.MeshBasicMaterial({ color: this.ink.color.clone(), side: THREE.DoubleSide });
        ink.name = 'section-ink';
        const cap = new THREE.Mesh(geo, ink);
        cap.name = '__section_cap';
        cap.userData.planCutInk = true;
        cap.raycast = () => {};
        room.root.add(cap);
        poche.push(cap);
        inks.push(ink);
      }
    } else {
      // no shell to draw the footprints from: back-face twins of the walls (shows where a slab is closed)
      const ink = this.ink.clone();
      ink.clippingPlanes = [plane];
      inks.push(ink);
      const seen = new Set();
      for (const list of Object.values(room.walls || {})) {
        for (const wall of list) {
          if ((wall.name || '').startsWith('obj__')) continue; // a frame or shelf hung on a wall: not wall section
          wall.traverse((o) => {
            if (!o.isMesh || seen.has(o) || o.userData.planCutInk) return;
            seen.add(o);
            if (isGlass(o.material)) return;
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
              if (!m || sides.has(m)) continue;
              sides.set(m, m.side);
              m.side = THREE.FrontSide; // a double-sided bake would paint over the ink
              m.needsUpdate = true;
            }
            const twin = new THREE.Mesh(o.geometry, ink);
            twin.name = `${o.name}__section`;
            twin.userData.planCutInk = true;
            twin.raycast = () => {};
            twin.renderOrder = -1;
            o.add(twin);
            poche.push(twin);
          });
        }
      }
    }
    this.cut.set(room, { plane, saved, poche, inks, sides });
  }

  remove(room) {
    const c = this.cut.get(room);
    if (!c) return;
    for (const [mat, prev] of c.saved) {
      mat.clippingPlanes = prev;
      mat.needsUpdate = true;
    }
    for (const [mat, side] of c.sides) {
      mat.side = side;
      mat.needsUpdate = true;
    }
    for (const m of c.poche) {
      m.removeFromParent();
      if (m.name === '__section_cap') m.geometry.dispose();
    }
    for (const m of c.inks) m.dispose();
    this.cut.delete(room);
    if (!this.cut.size) this.renderer.localClippingEnabled = false;
  }

  removeAll() {
    for (const room of [...this.cut.keys()]) this.remove(room);
  }

  dispose() {
    this.removeAll();
    this.ink.dispose();
  }
}

function isGlass(mat) {
  const list = Array.isArray(mat) ? mat : [mat];
  return list.some((m) => /glass/i.test(m?.name || ''));
}
