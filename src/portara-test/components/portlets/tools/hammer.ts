/**
 * A claw hammer. Wooden handle with a rubber grip where the hand is, a steel
 * head across the end with a round striking face on +z and a tapered peen on
 * -z.
 *
 * Tip: the centre of the striking face, (0, -0.27, 0.105).
 * Axis: +z, the face strikes along it. Roll: the handle points toward the
 * shoulder, so the hammer swings in the plane of the arm.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { chamferedCylinder, part, roundedBox } from "../shapes";
import type { ToolSpec } from "./types";

export function makeHammer(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const HEAD_Y = -0.27;
  const FACE_Z = 0.105;

  // Handle: slightly fatter toward the head, chamfered both ends.
  g.add(part(keep(chamferedCylinder(0.015, 0.018, 0.3, 0.006, 18)), m.wood, 0, -0.12, 0));
  // Rubber grip round the hand.
  g.add(part(keep(chamferedCylinder(0.02, 0.02, 0.09, 0.004, 18)), m.rubber, 0, -0.015, 0));
  // Head: a rounded block, its long axis along z.
  g.add(part(keep(roundedBox(0.07, 0.06, 0.15, 0.012)), m.steel, 0, HEAD_Y, 0.008));
  // Striking face: a short chamfered cylinder along z.
  g.add(part(keep(chamferedCylinder(0.03, 0.03, 0.026, 0.006, 20)), m.steel, 0, HEAD_Y, FACE_Z - 0.013, Math.PI / 2, 0, 0));
  // Peen: tapered, on the back.
  g.add(part(keep(chamferedCylinder(0.018, 0.03, 0.05, 0.005, 20)), m.darkSteel, 0, HEAD_Y, -0.085, -Math.PI / 2, 0, 0));
  // A steel wedge where the handle meets the head.
  g.add(part(keep(roundedBox(0.03, 0.035, 0.04, 0.006)), m.darkSteel, 0, HEAD_Y + 0.045, 0));

  return {
    id: "hammer",
    group: g,
    tip: new THREE.Vector3(0, HEAD_Y, FACE_Z),
    axis: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
    roll: "shoulder",
    footprint: 0.03,
    probes: [
      new THREE.Vector3(0.028, HEAD_Y, FACE_Z),
      new THREE.Vector3(-0.028, HEAD_Y, FACE_Z),
      new THREE.Vector3(0, HEAD_Y + 0.028, FACE_Z),
      new THREE.Vector3(0, HEAD_Y - 0.028, FACE_Z),
    ],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
