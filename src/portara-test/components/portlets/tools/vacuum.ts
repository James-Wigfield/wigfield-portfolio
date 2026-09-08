/**
 * A handheld vacuum: an orange body with a rubber grip loop on top, a grille
 * on the front, a dark nozzle flaring to a slot.
 *
 * Tip: the middle of the slot, (0, -0.255, 0). Axis: -y. Roll: upright, so
 * the slot lies across the sweep.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { chamferedCylinder, part, roundedBox } from "../shapes";
import type { ToolSpec } from "./types";

export function makeVacuum(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const TIP_Y = -0.255;

  g.add(part(keep(roundedBox(0.09, 0.15, 0.075, 0.02)), m.plasticAccent, 0, -0.075, 0));
  g.add(part(keep(roundedBox(0.034, 0.09, 0.034, 0.012)), m.rubber, 0, 0, 0));
  // Grille slats on the front.
  const slat = keep(roundedBox(0.06, 0.008, 0.006, 0.002));
  for (let i = 0; i < 4; i++) g.add(part(slat, m.plasticDark, 0, -0.05 - i * 0.018, 0.039));
  // A little power light.
  g.add(part(keep(new THREE.SphereGeometry(0.006, 10, 8)), m.plasticWhite, 0.03, -0.03, 0.04));
  // Nozzle, then the slot.
  g.add(part(keep(chamferedCylinder(0.02, 0.028, 0.08, 0.005, 18)), m.plasticDark, 0, -0.19, 0));
  g.add(part(keep(roundedBox(0.075, 0.03, 0.022, 0.008)), m.plasticDark, 0, -0.242, 0));

  return {
    id: "vacuum",
    group: g,
    tip: new THREE.Vector3(0, TIP_Y, 0),
    axis: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(0, 0, 1),
    roll: "up",
    footprint: 0.037,
    probes: [
      new THREE.Vector3(0.036, TIP_Y, 0),
      new THREE.Vector3(-0.036, TIP_Y, 0),
      new THREE.Vector3(0, TIP_Y, 0.01),
      new THREE.Vector3(0, TIP_Y, -0.01),
    ],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
