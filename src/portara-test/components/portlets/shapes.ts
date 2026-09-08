/**
 * Geometry helpers for the tools: everything with an edge gets a bevel or a
 * chamfer, nothing is a raw box. All in the tool's own units.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** A box with rounded edges (radius r). */
export function roundedBox(w: number, h: number, d: number, r: number, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
}

/** A cylinder along y with chamfered ends. */
export function chamferedCylinder(rTop: number, rBottom: number, h: number, c: number, seg = 20) {
  const pts: THREE.Vector2[] = [];
  const cT = Math.min(c, rTop * 0.6, h / 3);
  const cB = Math.min(c, rBottom * 0.6, h / 3);
  pts.push(new THREE.Vector2(0, -h / 2));
  pts.push(new THREE.Vector2(rBottom - cB, -h / 2));
  pts.push(new THREE.Vector2(rBottom, -h / 2 + cB));
  pts.push(new THREE.Vector2(rTop, h / 2 - cT));
  pts.push(new THREE.Vector2(rTop - cT, h / 2));
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, seg);
}

/** A lathe from a profile of (radius, y) pairs, for handles and nozzles. */
export function lathe(profile: [number, number][], seg = 20) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
}

/** A 2D shape extruded along z with a bevel, centred on z. */
export function bevelled(shape: THREE.Shape, depth: number, bevel: number, seg = 2) {
  const b = Math.min(bevel, depth / 2.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: seg,
    curveSegments: 14,
  });
  geo.translate(0, 0, -(depth - 2 * b) / 2);
  return geo;
}

/** A regular polygon (hex nuts, bolt heads). */
export function polygonShape(r: number, sides: number, rot = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** A rounded rectangle shape. */
export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/** A mesh with shadows on, at a place, with a rotation. */
export function part(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}
