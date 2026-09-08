/**
 * A T-handle socket wrench: a chrome shaft down from the grip to a hex
 * socket cup at the end, and a rubber-tipped T-bar across the top where the
 * hand is. It is AXIAL - the socket drops over the bolt head along the
 * shaft - so the grip stands off the letter by the shaft's length, which the
 * portlet's short arm can reach; an open-end spanner lies flat in the plane
 * of the bolt and would put the grip well beyond it.
 *
 * Tip: the mouth of the socket, (0, -0.29, 0). Axis: -y. Roll: the T-bar
 * starts upright; the action turns it about the bolt's axis to tighten.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { chamferedCylinder, part, roundedBox } from "../shapes";
import type { ToolSpec } from "./types";

export function makeWrench(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const TIP_Y = -0.29;
  const CUP_R = 0.032;

  // T-bar through the grip, rubber ends.
  g.add(part(keep(roundedBox(0.17, 0.022, 0.022, 0.008)), m.chrome, 0, 0, 0));
  g.add(part(keep(chamferedCylinder(0.014, 0.014, 0.04, 0.004, 14)), m.rubber, 0.085, 0, 0, 0, 0, Math.PI / 2));
  g.add(part(keep(chamferedCylinder(0.014, 0.014, 0.04, 0.004, 14)), m.rubber, -0.085, 0, 0, 0, 0, Math.PI / 2));
  // Shaft.
  g.add(part(keep(chamferedCylinder(0.011, 0.011, 0.23, 0.003, 14)), m.chrome, 0, -0.125, 0));
  // Socket: a cup, wider than the shaft, with a dark hex mouth showing the opening.
  g.add(part(keep(chamferedCylinder(CUP_R, CUP_R - 0.004, 0.06, 0.006, 6)), m.darkSteel, 0, -0.26, 0));
  const mouth = part(keep(new THREE.CylinderGeometry(CUP_R - 0.009, CUP_R - 0.009, 0.004, 6)), m.rubber, 0, TIP_Y + 0.001, 0);
  mouth.castShadow = false;
  g.add(mouth);

  return {
    id: "wrench",
    group: g,
    tip: new THREE.Vector3(0, TIP_Y, 0),
    axis: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(1, 0, 0),
    roll: "up",
    footprint: CUP_R,
    probes: [
      new THREE.Vector3(CUP_R, TIP_Y, 0),
      new THREE.Vector3(-CUP_R, TIP_Y, 0),
      new THREE.Vector3(0, TIP_Y, CUP_R),
      new THREE.Vector3(0, TIP_Y, -CUP_R),
    ],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
