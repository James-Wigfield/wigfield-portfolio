/**
 * The PortletManager: owns the pool (maxActive bodies, one of each tool, one
 * set of props), decides who comes out when, and keeps the books.
 *
 * PACING. The portal is quiet most of the time. When it is empty, nothing
 * happens until a random quiet gap has passed; then an OUTING begins, whose
 * size (1, 2 or 3) is drawn from weights in the config, one being the common
 * case and three rare. Companions join on the spawn timer, each after its own
 * random gap and only by chance per check; a third joins only when the other
 * two are both mid-job and an extra cooldown has passed. A spawn is never
 * triggered by somebody leaving: every spawn is a probabilistic check on a
 * timer. When the last one goes home the outing is over and the quiet gap
 * starts again.
 *
 * LETTERS ARE RESERVED before a portlet appears and released only when it is
 * gone (home through the portal, dissolved, or dropped by an error), so two
 * are never on the same letter; `letterGap` keeps neighbours clear too, and
 * a per-letter cooldown stops the same letter being serviced twice running.
 * Jobs are exclusive while they run (one tool of each).
 *
 * THE GATE is a lock: one portlet on the steps at a time, in or out. A
 * returning portlet waits at the foot of the gate, looking about, until it
 * is free.
 *
 * THE GROUND under the feet is raycast against the gate model's own meshes
 * (plinth, ground slab, posts, lintel), so the steps are wherever the model
 * says they are, to their real edges. Off the gate it is the floor.
 */
import * as THREE from "three";
import { ACTION_TOOL, makeAction } from "./actions";
import { ACTION_KINDS, type ActionKind, PORTLET_CONFIG as C } from "./config";
import { type LetterContacts, letterContacts, letterScale } from "./contact";
import { DebugLayer, type DebugJob, type DebugTool } from "./debug";
import { disposeToolMaterials, makeToolMaterials, type ToolMaterials } from "./materials";
import { headingOf, rand } from "./math";
import { Portlet, type PortletState, type Routes } from "./portlet";
import { Props } from "./props";
import { type Measure, solveStance, type WordFrame } from "./reach";
import { buildRigTemplate, disposeRigTemplate, instantiateRig, type RigTemplate } from "./rig";
import type { Motion } from "./steering";
import { makeTools, type ToolId, type ToolSpec } from "./tools";
import type { Job, PlanContext, Spot } from "./types";

export type ManagerCtx = {
  word: THREE.Group;
  gate: THREE.Group;
  visible: boolean;
  animate: boolean;
  /** The word's scroll flight, 0..1; nobody comes out while it is up. */
  flight: number;
  debugContacts: boolean;
  debugPenetration: boolean;
};

export type PortletStats = {
  active: number;
  reserved: number[];
  jobs: number;
  /** Debug penetration checks run, and how many found a tool inside a letter (or the can). */
  checks: number;
  penetrations: number;
  wallJobs: number;
  drawsPerPortlet: number;
  /** Seconds spent with 0, 1, 2, 3 out. */
  activeSeconds: [number, number, number, number];
  /** Outings begun, by size 1..3. */
  outings: [number, number, number];
  /** The last few quiet stretches, seconds the portal sat empty. */
  quiet: number[];
  /** Renderer counters for the previous frame, written by the scene (renderer.info). */
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  fps: number;
};

/** States in which a portlet counts as mid-job (a third may join only then). */
const MIDJOB = new Set<PortletState>(["draw", "work", "move"]);

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _o = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();

function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export class PortletManager {
  readonly group = new THREE.Group();
  readonly stats: PortletStats = {
    active: 0,
    reserved: [],
    jobs: 0,
    checks: 0,
    penetrations: 0,
    wallJobs: 0,
    drawsPerPortlet: 8,
    activeSeconds: [0, 0, 0, 0],
    outings: [0, 0, 0],
    quiet: [],
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    fps: 0,
  };
  /** 0..1 how hard the portal should glow this frame. */
  flash = 0;

  private template: RigTemplate;
  private mats: ToolMaterials;
  private tools: Record<ToolId, ToolSpec>;
  private props: Props;
  private debug: DebugLayer;
  private portlets: Portlet[] = [];
  private motions: Motion[] = [];
  private measure: Measure;
  private reserved = new Map<number, number>();
  private cooldown = new Map<number, number>();
  private lastOnLetter = new Map<number, ActionKind>();
  private inUse = new Set<ActionKind>();
  private lastBySlot: (ActionKind | null)[] = [];
  private gateOwner: number | null = null;
  private clock = 0;
  private wasLeaving = false;
  private gate: THREE.Group | null = null;
  private word: THREE.Group | null = null;
  private gateMeshesFor: THREE.Group | null = null;
  private gateMeshes: THREE.Mesh[] = [];
  private groundFn = (x: number, z: number) => this.groundAt(x, z);
  // Pacing. An outing is a fixed number of spawns (its size), not a headcount
  // to keep topped up: once they have all come out, nobody else does until
  // the portal has emptied and the quiet gap has passed.
  private outing: { size: number; spawns: number; lastSpawnAt: number; joinGap: number } | null = null;
  private quietUntil = C.pool.firstAt;
  private emptiedAt = 0;
  private nextCheckAt = 0;

  constructor(glbScene: THREE.Object3D) {
    const a = C.actions;
    this.template = buildRigTemplate(glbScene);
    this.mats = makeToolMaterials();
    this.tools = makeTools(this.mats);
    this.props = new Props(this.mats, {
      nailLen: a.hammer.nailLen,
      boltHeadH: a.wrench.headH,
      canHeight: a.paint.canHeight,
      shineFade: a.polish.shineFade,
      sparks: 40,
      sparkLife: a.weld.sparkLife,
      sparkSpeed: a.weld.sparkSpeed,
      dust: a.vacuum.dust,
      dustPull: a.vacuum.pull,
    });
    // Measure the body once, from a rig at rest.
    const probe = instantiateRig(this.template, C.height);
    probe.root.updateMatrixWorld(true);
    const s = probe.parts.armR.getWorldPosition(new THREE.Vector3());
    const h = probe.hand.getWorldPosition(new THREE.Vector3());
    this.measure = { shoulderH: s.y, armLen: s.distanceTo(h), shoulderSide: s.x, shoulderFwd: s.z };
    probe.material.dispose();

    for (let i = 0; i < C.pool.maxActive; i++) {
      const rig = instantiateRig(this.template, C.height);
      this.group.add(rig.root);
      const p = new Portlet(i, rig, this.measure);
      this.portlets.push(p);
      this.motions.push(p.motion);
      this.lastBySlot.push(null);
    }
    for (const t of Object.values(this.tools)) {
      t.group.visible = false;
      this.group.add(t.group);
    }
    this.group.add(this.props.group);
    this.debug = new DebugLayer(this.mats, C.pool.maxActive);
    this.debug.prime();
    this.group.add(this.debug.group);
    this.stats.drawsPerPortlet = this.portlets[0].rig.meshes.length;
  }

  /* ---------------------------------------------------------------------- */

  update(dt: number, ctx: ManagerCtx) {
    this.clock += dt;
    this.gate = ctx.gate;
    this.word = ctx.word;
    const leaving = ctx.flight > 0.02 || !ctx.visible || !ctx.animate;
    if (leaving && !this.wasLeaving) {
      this.quietUntil = Math.max(this.quietUntil, this.clock + C.pool.vanishRest);
      this.outing = null;
    }
    this.wasLeaving = leaving;

    const env = { ground: this.groundFn, others: this.motions, time: this.clock, checkPenetration: ctx.debugPenetration };
    let flash = 0;
    for (const p of this.portlets) {
      if (!p.active) continue;
      try {
        p.update(dt, env, leaving);
      } catch (err) {
        console.error("[portlets] portlet failed; releasing its letter", err);
        p.abort();
      }
      if (!p.active) this.release(p);
      else {
        flash = Math.max(flash, p.flash);
        if (p.checked) {
          this.stats.checks += 1;
          if (p.penetrating) this.stats.penetrations += 1;
        }
      }
    }
    this.flash = flash;

    // The gate: the one who came out has left the steps; someone waiting may climb.
    if (this.gateOwner !== null) {
      const owner = this.portlets[this.gateOwner];
      if (!owner.active) this.gateOwner = null;
      else if (owner.state === "travel" && !this.inGateZone(owner.motion.pos)) this.gateOwner = null;
    }
    if (this.gateOwner === null) {
      const waiting = this.portlets.filter((p) => p.state === "wait");
      if (waiting.length) {
        waiting.sort((a, b) => b.t - a.t);
        this.gateOwner = waiting[0].slot;
        waiting[0].gateGranted = true;
      }
    }

    // Pacing: the spawn timer.
    const active = this.portlets.filter((p) => p.active).length;
    this.stats.activeSeconds[Math.min(3, active)] += dt;
    if (!leaving && this.clock >= this.nextCheckAt) {
      this.nextCheckAt = this.clock + C.pool.checkEvery;
      this.considerSpawn(ctx, active);
    }

    this.props.update(dt);
    this.stats.active = active;
    this.stats.reserved = [...this.reserved.keys()].sort((a, b) => a - b);

    this.debug.group.visible = ctx.debugContacts;
    if (ctx.debugContacts) {
      const jobs: (DebugJob | null)[] = this.portlets.map((p) => {
        if (!p.job) return null;
        const spot = p.job.spots[p.job.spot];
        return { mesh: p.job.mesh, candidates: letterContacts(p.job.mesh).candidates, chosen: spot?.contact ?? null, stance: spot?.stance ?? null };
      });
      const tools: (DebugTool | null)[] = this.portlets.map((p) => (p.toolS > 0.5 && p.job ? { tip: p.tipWorld, probes: p.probesWorld.slice(0, p.tool!.probes.length), ok: !p.penetrating } : null));
      this.debug.update(jobs, tools);
    }
  }

  /** A portlet is gone: give back its letter, its job, the gate. Nothing is
      spawned from here; that is the timer's business. */
  private release(p: Portlet) {
    for (const [letter, slot] of this.reserved) {
      if (slot === p.slot) {
        this.reserved.delete(letter);
        this.cooldown.set(letter, this.clock + C.pool.letterCooldown);
      }
    }
    const k = this.lastBySlot[p.slot];
    if (k && !this.portlets.some((o) => o !== p && o.active && o.job?.action.kind === k)) this.inUse.delete(k);
    if (this.gateOwner === p.slot) this.gateOwner = null;
    if (!this.portlets.some((o) => o.active)) this.emptiedAt = this.clock;
  }

  /* ---------------------------------------------------------------------- */

  /** The spawn check, on the timer. */
  private considerSpawn(ctx: ManagerCtx, active: number) {
    const P = C.pool;
    if (active === 0) {
      if (this.outing) {
        // The last one has gone home: the outing is over, the quiet gap begins.
        this.outing = null;
        this.quietUntil = this.emptiedAt + rand(P.quietMin, P.quietMax);
        return;
      }
      if (this.clock < this.quietUntil) return;
      const size = this.drawOutingSize();
      if (this.trySpawn(ctx)) {
        this.outing = { size, spawns: 1, lastSpawnAt: this.clock, joinGap: rand(P.joinGapMin, P.joinGapMax) };
        this.stats.outings[size - 1] += 1;
        if (this.emptiedAt > 0) {
          this.stats.quiet.push(+(this.clock - this.emptiedAt).toFixed(1));
          if (this.stats.quiet.length > 12) this.stats.quiet.shift();
        }
      } else {
        this.quietUntil = this.clock + 2; // nothing plannable just now
      }
      return;
    }
    // Somebody is out: may a companion join? Only while the outing has
    // spawns left, and never a third unless the other two are both mid-job.
    const o = this.outing ?? (this.outing = { size: active, spawns: active, lastSpawnAt: this.clock, joinGap: rand(P.joinGapMin, P.joinGapMax) });
    if (o.spawns >= o.size || active >= P.maxActive) return;
    const since = this.clock - o.lastSpawnAt;
    const need = active === 2 ? o.joinGap + P.thirdExtraGap : o.joinGap;
    if (since < need) return;
    if (active === 2 && !this.portlets.every((p) => !p.active || MIDJOB.has(p.state))) return;
    if (Math.random() > P.joinChance) return;
    if (this.trySpawn(ctx)) {
      o.spawns += 1;
      o.lastSpawnAt = this.clock;
      o.joinGap = rand(P.joinGapMin, P.joinGapMax);
    }
  }

  /** Where a portlet is, for the debug camera. */
  viewOf(slot: number) {
    const p = this.portlets[slot];
    return p?.active ? { pos: p.motion.pos, heading: p.motion.heading } : null;
  }

  private drawOutingSize() {
    const w = C.pool.outingWeights;
    const total = w.one + w.two + w.three;
    let r = Math.random() * total;
    if ((r -= w.one) < 0) return 1;
    if ((r -= w.two) < 0) return 2;
    return Math.min(3, C.pool.maxActive);
  }

  /** Try to send one out now. True if somebody left the portal. */
  private trySpawn(ctx: ManagerCtx): boolean {
    const word = ctx.word;
    const n = word.children.length;
    const slot = this.portlets.find((p) => !p.active);
    if (!n || !slot || this.gateOwner !== null) return false;
    // Anyone still on the steps blocks the door.
    for (const p of this.portlets) if (p.active && this.inGateZone(p.motion.pos)) return false;

    const letters = shuffle([...Array(n).keys()]).filter((i) => {
      if (this.reserved.has(i)) return false;
      if ((this.cooldown.get(i) ?? 0) > this.clock) return false;
      for (const r of this.reserved.keys()) if (Math.abs(r - i) <= C.pool.letterGap) return false;
      return true;
    });
    if (!letters.length) return false;
    const frame = this.wordFrame(word);
    const kinds = shuffle(ACTION_KINDS.filter((k) => !this.inUse.has(k)));
    // Variety: not what this letter had last, not what this body did last, if it can be helped.
    kinds.sort((a, b) => Number(a === this.lastBySlot[slot.slot]) - Number(b === this.lastBySlot[slot.slot]));

    for (const letter of letters) {
      const mesh = word.children[letter] as THREE.Mesh;
      if (!mesh.isMesh) continue;
      const contacts = letterContacts(mesh);
      const ordered = kinds.slice().sort((a, b) => Number(a === this.lastOnLetter.get(letter)) - Number(b === this.lastOnLetter.get(letter)));
      for (const kind of ordered) {
        const tool = this.tools[ACTION_TOOL[kind]];
        const action = makeAction(kind);
        const plan = this.planContext(mesh, contacts, tool, frame);
        let spots: Spot[] | null = null;
        try {
          spots = action.plan(plan);
        } catch (err) {
          console.error("[portlets] plan failed", kind, err);
        }
        if (!spots) continue;
        // Commit.
        this.reserved.set(letter, slot.slot);
        this.inUse.add(kind);
        this.lastBySlot[slot.slot] = kind;
        this.lastOnLetter.set(letter, kind);
        this.gateOwner = slot.slot;
        const job: Job = { letter, mesh, action, tool, spots, spot: 0, endX: 0 };
        const routes = this.routes(job, ctx, slot.slot);
        slot.start(job, tool, routes);
        this.stats.jobs += 1;
        if (!spots[0].contact.face) this.stats.wallJobs += 1;
        return true;
      }
    }
    return false;
  }

  private planContext(mesh: THREE.Mesh, contacts: LetterContacts, tool: ToolSpec, frame: WordFrame): PlanContext {
    const scale = this.portlets[0].rig.scale;
    const ls = letterScale(mesh);
    const m = this.measure;
    return {
      mesh,
      contacts,
      tool,
      scale,
      letterScale: ls,
      props: this.props,
      right: frame.right.clone(),
      shoulderSide: m.shoulderSide,
      solve: (p, nrm) => solveStance(p, nrm, tool, scale, m, frame),
      usable: (c, extra, edge) => {
        const fp = tool.footprint * scale; // world
        if (edge > 0 && c.edgeR * ls < edge) return false;
        if (c.flatR * ls < fp + extra) return false;
        const reach = tool.tip.length() * scale + 0.06;
        return c.clear * ls >= reach;
      },
    };
  }

  /** The word's horizontal frame and the footprint of all its letters. */
  private wordFrame(word: THREE.Group): WordFrame {
    const origin = word.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).transformDirection(word.matrixWorld).setY(0).normalize();
    const front = new THREE.Vector3(0, 0, 1).transformDirection(word.matrixWorld).setY(0).normalize();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const child of word.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      const box = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!);
      for (const x of [box.min.x, box.max.x])
        for (const z of [box.min.z, box.max.z]) {
          _v.set(x, 0, z).applyMatrix4(mesh.matrixWorld).sub(origin);
          const bx = _v.dot(right);
          const bz = _v.dot(front);
          minX = Math.min(minX, bx);
          maxX = Math.max(maxX, bx);
          minZ = Math.min(minZ, bz);
          maxZ = Math.max(maxZ, bz);
        }
    }
    return { origin, right, front, minX, maxX, minZ, maxZ };
  }

  /** The way out to the first spot and the ways back, world space. Each slot
      waits for the gate at its own spot along the foot, so nobody stands on
      anybody else's. */
  private routes(job: Job, ctx: ManagerCtx, slot: number): Routes {
    const word = ctx.word;
    const gate = ctx.gate;
    const g = C.gate;
    const lanes = C.lanes;
    const G = (x: number, y: number, z: number) => gate.localToWorld(new THREE.Vector3(x, y, z));
    const W = (x: number, y: number, z: number) => word.localToWorld(new THREE.Vector3(x, y, z));
    let minX = Infinity;
    let maxX = -Infinity;
    for (const m of word.children) {
      minX = Math.min(minX, m.position.x);
      maxX = Math.max(maxX, m.position.x);
    }
    const local = (p: THREE.Vector3) => word.worldToLocal(p.clone());
    const stance = job.spots[0].stance;
    const sl = local(stance);
    const endX = sl.x < (minX + maxX) / 2 ? minX - lanes.pastEnd : maxX + lanes.pastEnd;
    job.endX = endX;
    const door = G(0, g.hover, 0);
    const plinth = G(0, g.plinthTop, 0.02);
    const outDir = G(0, 0, 1).sub(G(0, 0, 0));
    const outHeading = headingOf(outDir.x, outDir.z);
    const laneX = Math.min(Math.max(sl.x, minX - lanes.pastEnd), maxX + lanes.pastEnd);
    const out = [
      G(0, g.plinthTop, g.plinthEdge - 0.02),
      G(0, g.stepTop, g.stepEdge - 0.02),
      G(0, 0, g.floorAt + 0.12),
      W(endX, 0, lanes.behind),
      W(endX, 0, lanes.front),
      W(laneX, 0, lanes.front),
      stance.clone(),
    ];
    const waitX = (slot - (C.pool.maxActive - 1) / 2) * 0.5;
    const back = (from: THREE.Vector3) => {
      const fl = local(from);
      const fx = Math.min(Math.max(fl.x, minX - lanes.pastEnd), maxX + lanes.pastEnd);
      return [W(fx, 0, lanes.front), W(endX, 0, lanes.front), W(endX, 0, lanes.behind), G(waitX, 0, g.zone + 0.2)];
    };
    const climb = [G(0, 0, g.floorAt), G(0, g.stepTop, g.stepEdge - 0.03), G(0, g.plinthTop, g.plinthEdge - 0.05), plinth];
    return { door, plinth, outHeading, out, back, climb };
  }

  /* ---------------------------------------------------------------------- */

  /** The gate model's own meshes (plinth, slab, posts, lintel), not the rings. */
  private meshesOf(gate: THREE.Group) {
    if (this.gateMeshesFor === gate) return this.gateMeshes;
    const node = gate.getObjectByName("gate") ?? gate;
    const list: THREE.Mesh[] = [];
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) list.push(m);
    });
    this.gateMeshesFor = gate;
    this.gateMeshes = list;
    return list;
  }

  /** The height of the ground under a world point: a ray down onto the gate's
      steps from below the lintel, else the floor. */
  private groundAt(x: number, z: number) {
    const gate = this.gate;
    if (!gate) return 0;
    gate.worldToLocal(_w.set(x, 0, z));
    if (Math.abs(_w.x) > 1.15 || _w.z < -0.45 || _w.z > 0.45) return 0;
    const meshes = this.meshesOf(gate);
    if (!meshes.length) return 0;
    _o.set(x, 1.2, z);
    ray.set(_o, DOWN);
    ray.near = 0;
    ray.far = 1.3;
    const hits = ray.intersectObjects(meshes, false);
    return hits.length ? Math.max(0, hits[0].point.y) : 0;
  }

  /** Debug: the ground along the gate's centre line, gate-space z -> height. */
  groundProfile(x = 0) {
    const gate = this.gate;
    if (!gate) return [];
    const out: [number, number][] = [];
    for (let z = -0.4; z <= 1.0; z += 0.02) {
      gate.localToWorld(_v.set(x, 0, z));
      out.push([+z.toFixed(2), +this.groundAt(_v.x, _v.z).toFixed(3)]);
    }
    return out;
  }

  private inGateZone(pos: THREE.Vector3) {
    const gate = this.gate;
    if (!gate) return false;
    gate.worldToLocal(_w.copy(pos));
    return _w.z < C.gate.zone && Math.abs(_w.x) < C.gate.halfWidth + 0.35;
  }

  /** A plain-data picture of the pool, for the console and the soak test. */
  snapshot() {
    const word = this.word;
    const localZ = (v?: THREE.Vector3) => (word && v ? +word.worldToLocal(v.clone()).z.toFixed(3) : null);
    return {
      clock: +this.clock.toFixed(1),
      gateOwner: this.gateOwner,
      outing: this.outing ? { ...this.outing, since: +(this.clock - this.outing.lastSpawnAt).toFixed(1) } : null,
      quietIn: +(this.quietUntil - this.clock).toFixed(1),
      reserved: [...this.reserved.entries()],
      inUse: [...this.inUse],
      measure: { ...this.measure, scale: this.portlets[0].rig.scale },
      stats: { ...this.stats },
      portlets: this.portlets.map((p) => ({
        slot: p.slot,
        state: p.state,
        t: +p.t.toFixed(1),
        letter: p.job?.letter ?? null,
        action: p.job?.action.kind ?? null,
        phase: p.job?.action.describe() ?? null,
        spot: p.job ? `${p.job.spot + 1}/${p.job.spots.length}` : null,
        face: p.job?.spots[p.job.spot]?.contact.face ?? null,
        stanceZ: localZ(p.job?.spots[p.job.spot]?.stance),
        pos: [+p.motion.pos.x.toFixed(2), +p.motion.pos.y.toFixed(3), +p.motion.pos.z.toFixed(2)],
        groundLR: [+p.motion.groundL.toFixed(3), +p.motion.groundR.toFixed(3)],
        footLR: [+p.motion.footL.toFixed(3), +p.motion.footR.toFixed(3)],
        stairs: p.motion.stairs,
        speed: +p.motion.speed.toFixed(2),
        arrived: p.motion.arrived,
        oriented: p.motion.oriented,
        turning: p.motion.turning,
        turnRate: +p.motion.turnRate.toFixed(2),
        stepUp: +p.motion.stepUp.toFixed(2),
        airborne: p.motion.airborne,
        bodyPitch: +p.currentPose.bodyPitch.toFixed(3),
        headPitch: +p.currentPose.headPitch.toFixed(3),
        toolW: +p.toolW.toFixed(2),
        penetrating: p.penetrating,
      })),
    };
  }

  /* ---------------------------------------------------------------------- */

  dispose() {
    for (const p of this.portlets) {
      p.abort();
      p.rig.material.dispose();
    }
    for (const t of Object.values(this.tools)) t.dispose();
    this.props.dispose();
    this.debug.dispose();
    disposeToolMaterials(this.mats);
    disposeRigTemplate(this.template);
  }
}
