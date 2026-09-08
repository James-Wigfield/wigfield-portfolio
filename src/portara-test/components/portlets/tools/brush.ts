/**
 * A flat paint brush: a bevelled wooden handle, a steel ferrule, dark
 * bristles with fresh paint on their ends.
 *
 * Tip: the end of the bristles, (0, -0.29, 0). Axis: -y. Roll: the brush's
 * width (its x) stands upright, so a horizontal stroke lays a wide band.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { bevelled, part, roundedBox, roundedRectShape } from "../shapes";
import type { ToolSpec } from "./types";

export function makeBrush(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const TIP_Y = -0.29;

  g.add(part(keep(bevelled(roundedRectShape(0.034, 0.19, 0.012), 0.015, 0.003)), m.wood, 0, -0.095, 0));
  g.add(part(keep(roundedBox(0.05, 0.032, 0.018, 0.004)), m.steel, 0, -0.205, 0));
  const bristles = part(keep(roundedBox(0.054, 0.07, 0.014, 0.004)), m.bristle, 0, -0.255, 0);
  g.add(bristles);
  g.add(part(keep(roundedBox(0.056, 0.014, 0.016, 0.004)), m.paint, 0, -0.284, 0));

  return {
    id: "brush",
    group: g,
    tip: new THREE.Vector3(0, TIP_Y, 0),
    axis: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(1, 0, 0),
    roll: "up",
    footprint: 0.028,
    probes: [
      new THREE.Vector3(0.027, TIP_Y, 0),
      new THREE.Vector3(-0.027, TIP_Y, 0),
      new THREE.Vector3(0, TIP_Y, 0.007),
      new THREE.Vector3(0, TIP_Y, -0.007),
    ],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
