/**
 * A rotary polisher: a yellow motor body with a rubber grip, a dark backing
 * plate and a thick cream pad that spins while working.
 *
 * Tip: the centre of the pad's face, (0, -0.162, 0). Axis: -y. Roll:
 * upright. Footprint: the whole pad, so it only ever lands on a patch flat
 * enough to take it.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { chamferedCylinder, part, roundedBox } from "../shapes";
import type { ToolSpec } from "./types";

export function makeBuffer(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const PAD_R = 0.068;
  const TIP_Y = -0.162;

  g.add(part(keep(chamferedCylinder(0.03, 0.036, 0.12, 0.008, 20)), m.plasticYellow, 0, -0.06, 0));
  g.add(part(keep(chamferedCylinder(0.034, 0.034, 0.06, 0.004, 20)), m.rubber, 0, -0.02, 0));
  g.add(part(keep(roundedBox(0.016, 0.028, 0.012, 0.004)), m.plasticAccent, 0.03, -0.05, 0.01));
  g.add(part(keep(chamferedCylinder(0.058, 0.058, 0.012, 0.004, 24)), m.plasticDark, 0, -0.126, 0));
  const pad = part(keep(chamferedCylinder(PAD_R, PAD_R - 0.006, 0.03, 0.01, 28)), m.pad, 0, -0.147, 0);
  g.add(pad);
  // A seam on the pad so its spin reads.
  const seam = part(keep(roundedBox(0.1, 0.004, 0.004, 0.0015)), m.plasticYellow, 0, -0.164, 0);
  seam.castShadow = false;
  pad.add(seam);
  seam.position.set(0, -0.0165, 0);

  return {
    id: "buffer",
    group: g,
    tip: new THREE.Vector3(0, TIP_Y, 0),
    axis: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(0, 0, 1),
    roll: "up",
    footprint: PAD_R,
    probes: [
      new THREE.Vector3(PAD_R - 0.006, TIP_Y, 0),
      new THREE.Vector3(-(PAD_R - 0.006), TIP_Y, 0),
      new THREE.Vector3(0, TIP_Y, PAD_R - 0.006),
      new THREE.Vector3(0, TIP_Y, -(PAD_R - 0.006)),
    ],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    tick: (dt, working) => {
      pad.rotation.y += 20 * working * dt;
    },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
