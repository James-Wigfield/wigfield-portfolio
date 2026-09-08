/**
 * A welding torch: a dark steel body with a rubber grip, a brass nozzle
 * tapering to a copper wire, a yellow cable curling out of the top, and the
 * arc itself (an additive blob that flickers while working).
 *
 * Tip: the end of the wire, (0, -0.255, 0). Axis: -y, along the torch.
 * Roll: upright.
 */
import * as THREE from "three";
import type { ToolMaterials } from "../materials";
import { chamferedCylinder, part } from "../shapes";
import type { ToolSpec } from "./types";

export function makeTorch(m: ToolMaterials): ToolSpec {
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);

  const TIP_Y = -0.255;

  g.add(part(keep(chamferedCylinder(0.026, 0.03, 0.16, 0.006, 20)), m.darkSteel, 0, -0.05, 0));
  g.add(part(keep(chamferedCylinder(0.033, 0.033, 0.07, 0.004, 20)), m.rubber, 0, -0.01, 0));
  g.add(part(keep(chamferedCylinder(0.011, 0.024, 0.11, 0.004, 20)), m.brass, 0, -0.185, 0));
  g.add(part(keep(chamferedCylinder(0.003, 0.003, 0.02, 0.001, 8)), m.copper, 0, -0.245, 0));
  // Trigger.
  g.add(part(keep(chamferedCylinder(0.006, 0.006, 0.03, 0.002, 10)), m.plasticAccent, 0, -0.07, 0.03, Math.PI / 2, 0, 0));
  // Cable out of the top, curling back.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(0, 0.07, -0.02),
    new THREE.Vector3(0, 0.08, -0.07),
    new THREE.Vector3(0, 0.05, -0.12),
  ]);
  g.add(part(keep(new THREE.TubeGeometry(path, 12, 0.008, 8, false)), m.cable));
  // The arc.
  const arc = part(keep(new THREE.SphereGeometry(0.014, 10, 8)), m.arc, 0, TIP_Y, 0);
  arc.castShadow = false;
  arc.scale.setScalar(0.001);
  g.add(arc);

  return {
    id: "torch",
    group: g,
    tip: new THREE.Vector3(0, TIP_Y, 0),
    axis: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(0, 0, 1),
    roll: "up",
    footprint: 0.012,
    probes: [new THREE.Vector3(0.011, -0.24, 0), new THREE.Vector3(-0.011, -0.24, 0), new THREE.Vector3(0, -0.24, 0.011)],
    carry: { position: new THREE.Vector3(0, 0, 0.02), rotation: new THREE.Euler(0, 0, 0) },
    tick: (dt, working, time) => {
      const s = working > 0.01 ? working * (0.75 + 0.25 * Math.sin(time * 47) * Math.sin(time * 31 + 1)) : 0.001;
      arc.scale.setScalar(Math.max(0.001, s));
    },
    dispose: () => geos.forEach((x) => x.dispose()),
  };
}
