/**
 * The portlet's body, rebuilt for instancing.
 *
 * The model (portlet.glb) is 27 meshes over 10 materials, all of them plain
 * colour with roughness 1 and no metalness: they differ in colour only. So
 * each animated part's meshes are MERGED into one geometry with the colour
 * baked into a vertex attribute, and every portlet is 8 draws (two legs,
 * body, two arms, head, eyes, antenna) sharing one set of geometries, with
 * ONE material each (its own, so it can fade in and out on its own).
 *
 * The hierarchy the animation drives is kept exactly: rig > inner (the
 * portlet's scale and footing) > lift (the model's own squash) > legs and
 * body; body > arms and head; head > eyes (blink) and bobble (the antenna).
 * A HAND SOCKET sits where the right hand's mesh was, for the tool.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const PART_NAMES = ["legL", "legR", "bodyG", "armL", "armR", "head", "eyes", "bobble"] as const;
export type PartName = (typeof PART_NAMES)[number];
type Xf = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };

export type RigTemplate = {
  geoms: Record<PartName, THREE.BufferGeometry>;
  nodes: Record<PartName | "lift", Xf>;
  /** Bounding box of the whole model, model units. */
  minY: number;
  height: number;
  /** Where the right hand is, in the right arm's space. */
  hand: THREE.Vector3;
};

export type Rig = {
  root: THREE.Group;
  inner: THREE.Group;
  lift: THREE.Group;
  parts: Record<PartName, THREE.Object3D>;
  rest: Record<PartName, THREE.Euler>;
  meshes: THREE.Mesh[];
  material: THREE.MeshStandardMaterial;
  /** The hand socket on the right arm. */
  hand: THREE.Object3D;
  scale: number;
  /** The model's lowest point (model units), so the feet can be kept on the ground when it scales. */
  minY: number;
};

const PARENT: Record<PartName, PartName | "lift"> = {
  legL: "lift",
  legR: "lift",
  bodyG: "lift",
  armL: "bodyG",
  armR: "bodyG",
  head: "bodyG",
  eyes: "head",
  bobble: "head",
};

function xf(o: THREE.Object3D): Xf {
  return { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() };
}

/** Bake the model's meshes into one geometry per animated part. */
export function buildRigTemplate(scene: THREE.Object3D): RigTemplate {
  scene.updateMatrixWorld(true);
  const named = new Map<string, THREE.Object3D>();
  scene.traverse((o) => {
    if (o.name) named.set(o.name, o);
  });
  const animated = new Set<string>([...PART_NAMES]);
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  const geoms = {} as Record<PartName, THREE.BufferGeometry>;

  for (const part of PART_NAMES) {
    const node = named.get(part);
    if (!node) throw new Error(`portlet.glb: no node "${part}"`);
    inv.copy(node.matrixWorld).invert();
    const pieces: THREE.BufferGeometry[] = [];
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Belongs to the nearest animated ancestor: skip meshes under a sub-part.
      let a = m.parent;
      while (a && a !== node && !animated.has(a.name)) a = a.parent;
      if (a !== node) return;
      let g = m.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      rel.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(rel);
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count;
      const colors = new Float32Array(n * 3);
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      const c = mat.color ?? new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      pieces.push(g);
    });
    const merged = pieces.length ? mergeGeometries(pieces, false) : new THREE.BufferGeometry();
    pieces.forEach((p) => p.dispose());
    if (!merged) throw new Error(`portlet.glb: could not merge "${part}"`);
    merged.computeBoundingSphere();
    geoms[part] = merged;
  }

  const nodes = {} as RigTemplate["nodes"];
  for (const part of [...PART_NAMES, "lift"] as const) {
    const node = named.get(part);
    if (!node) throw new Error(`portlet.glb: no node "${part}"`);
    nodes[part] = xf(node);
  }
  const box = new THREE.Box3().setFromObject(named.get("rig") ?? scene);
  const hand = named.get("armRHand")?.position.clone() ?? new THREE.Vector3(0, -0.235, 0);
  return { geoms, nodes, minY: box.min.y, height: box.max.y - box.min.y || 1, hand };
}

/** One portlet body from the template, `height` world units tall. */
export function instantiateRig(t: RigTemplate, height: number): Rig {
  const scale = height / t.height;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(scale);
  inner.position.y = -t.minY * scale;
  root.add(inner);
  const lift = new THREE.Group();
  const l = t.nodes.lift;
  lift.position.copy(l.position);
  lift.quaternion.copy(l.quaternion);
  lift.scale.copy(l.scale);
  inner.add(lift);

  const parts = {} as Record<PartName, THREE.Object3D>;
  const rest = {} as Record<PartName, THREE.Euler>;
  const meshes: THREE.Mesh[] = [];
  const holders: Partial<Record<PartName | "lift", THREE.Object3D>> = { lift };
  for (const part of PART_NAMES) {
    const node = new THREE.Group();
    node.name = part;
    const x = t.nodes[part];
    node.position.copy(x.position);
    node.quaternion.copy(x.quaternion);
    node.scale.copy(x.scale);
    const mesh = new THREE.Mesh(t.geoms[part], material);
    mesh.castShadow = true;
    node.add(mesh);
    meshes.push(mesh);
    const parent = holders[PARENT[part]];
    if (!parent) throw new Error(`rig: "${PARENT[part]}" must be built before "${part}"`);
    parent.add(node);
    holders[part] = node;
    parts[part] = node;
    rest[part] = node.rotation.clone();
  }
  const hand = new THREE.Object3D();
  hand.name = "handSocket";
  hand.position.copy(t.hand);
  parts.armR.add(hand);
  return { root, inner, lift, parts, rest, meshes, material, hand, scale, minY: t.minY };
}

export function disposeRigTemplate(t: RigTemplate) {
  for (const g of Object.values(t.geoms)) g.dispose();
}
