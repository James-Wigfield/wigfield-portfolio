/**
 * The debug layer: every usable contact on the letters being worked on (blue
 * on the face, pink on a wall, yellow for the chosen spot, with a whisker
 * along each normal), each active tool's tip (green: outside the letter,
 * red: inside) and its probes, and a ring on the floor at each stance. All
 * drawn without depth testing so nothing hides them.
 */
import * as THREE from "three";
import { type Candidate, candidateToWorld } from "./contact";
import type { ToolMaterials } from "./materials";

const MAX_DOTS = 1200;
const MAX_PROBES = 48;
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

export type DebugJob = { mesh: THREE.Mesh; candidates: Candidate[]; chosen: Candidate | null; stance: THREE.Vector3 | null };
export type DebugTool = { tip: THREE.Vector3; probes: THREE.Vector3[]; ok: boolean };

export class DebugLayer {
  group = new THREE.Group();
  private dots: THREE.InstancedMesh;
  private probes: THREE.InstancedMesh;
  private tips: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private lines: THREE.LineSegments;
  private linePos: Float32Array;
  private geos: THREE.BufferGeometry[] = [];
  private faceC = new THREE.Color("#3ec9ff");
  private wallC = new THREE.Color("#ff5ed2");
  private spotC = new THREE.Color("#ffe14a");

  constructor(
    private m: ToolMaterials,
    slots: number,
  ) {
    const dot = new THREE.SphereGeometry(0.0045, 8, 6);
    const probe = new THREE.SphereGeometry(0.003, 6, 5);
    const tip = new THREE.SphereGeometry(0.008, 10, 8);
    const ring = new THREE.TorusGeometry(0.11, 0.003, 6, 32);
    this.geos.push(dot, probe, tip, ring);
    const dotMat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.9 });
    this.dots = new THREE.InstancedMesh(dot, dotMat, MAX_DOTS);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.probes = new THREE.InstancedMesh(probe, m.debugSpot, MAX_PROBES);
    this.probes.count = 0;
    this.probes.frustumCulled = false;
    this.linePos = new Float32Array(MAX_DOTS * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
    lg.setDrawRange(0, 0);
    this.geos.push(lg);
    this.lines = new THREE.LineSegments(lg, m.debugLine);
    this.lines.frustumCulled = false;
    this.group.add(this.dots, this.probes, this.lines);
    for (let i = 0; i < slots; i++) {
      const t = new THREE.Mesh(tip, m.debugTipOk);
      t.visible = false;
      t.renderOrder = 999;
      this.tips.push(t);
      const r = new THREE.Mesh(ring, m.debugSpot);
      r.rotation.x = Math.PI / 2;
      r.visible = false;
      this.rings.push(r);
      this.group.add(t, r);
    }
    this.dots.renderOrder = 998;
    this.probes.renderOrder = 999;
    this.lines.renderOrder = 998;
    this.group.visible = false;
  }

  update(jobs: (DebugJob | null)[], tools: (DebugTool | null)[]) {
    let d = 0;
    let l = 0;
    for (const j of jobs) {
      if (!j) continue;
      for (const c of j.candidates) {
        if (d >= MAX_DOTS) break;
        candidateToWorld(j.mesh, c, _p, _n);
        _m.makeTranslation(_p.x, _p.y, _p.z);
        this.dots.setMatrixAt(d, _m);
        this.dots.setColorAt(d, c === j.chosen ? this.spotC : c.face ? this.faceC : this.wallC);
        d++;
        this.linePos[l++] = _p.x;
        this.linePos[l++] = _p.y;
        this.linePos[l++] = _p.z;
        _p.addScaledVector(_n, c === j.chosen ? 0.06 : 0.02);
        this.linePos[l++] = _p.x;
        this.linePos[l++] = _p.y;
        this.linePos[l++] = _p.z;
      }
    }
    this.dots.count = d;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.lines.geometry.setDrawRange(0, l / 3);

    let pr = 0;
    tools.forEach((t, i) => {
      const tipMesh = this.tips[i];
      const ring = this.rings[i];
      const job = jobs[i];
      if (ring) {
        ring.visible = !!job?.stance;
        if (job?.stance) ring.position.set(job.stance.x, job.stance.y + 0.002, job.stance.z);
      }
      if (!tipMesh) return;
      if (!t) {
        tipMesh.visible = false;
        return;
      }
      tipMesh.visible = true;
      tipMesh.position.copy(t.tip);
      tipMesh.material = t.ok ? this.m.debugTipOk : this.m.debugTipBad;
      for (const q of t.probes) {
        if (pr >= MAX_PROBES) break;
        _m.makeTranslation(q.x, q.y, q.z);
        this.probes.setMatrixAt(pr++, _m);
      }
    });
    this.probes.count = pr;
    this.probes.instanceMatrix.needsUpdate = true;
  }

  /** Force the instance colour buffer into being (setColorAt on a fresh mesh does it lazily). */
  prime() {
    this.dots.setColorAt(0, _c.set(0xffffff));
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    (this.dots.material as THREE.Material).dispose();
    this.dots.dispose();
    this.probes.dispose();
  }
}
