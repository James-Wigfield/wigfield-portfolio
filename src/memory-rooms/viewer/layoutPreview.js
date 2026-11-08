/* A massing model built straight from scene.json, for spots that have a
   layout but no baked GLB yet (status captured / modelling).

   Same frame and node names as the GLB contract (CONTRACTS.md §4): `floor`,
   `ceiling`, `ground`, `wall_<side>` groups (with `wall_<side>__…` pieces,
   openings left as gaps, windows glazed with a `glass…` material) and
   `obj__<id>`, so the dollhouse logic and pins work unchanged.

   No lights: like the bake, shading is fixed per face (vertex colours from a
   soft top-front light) and drawn with MeshBasicMaterial. */

import * as THREE from 'three';

const RAD = Math.PI / 180;
const LIGHT = new THREE.Vector3(0.35, 0.9, 0.55).normalize();

const FLOOR_COLOURS = { timber: '#a7825c', carpet: '#9a948a', tile: '#d9d5cc', concrete: '#a9a59e', vinyl: '#c9c2b4', stone: '#b4ada2' };
const GROUND_COLOURS = { asphalt: '#55565a', grass: '#7a9461', sand: '#d9c9a3', snow: '#eef0f2', paving: '#b9b2a6', concrete: '#b3afa8', gravel: '#9d968b', dirt: '#8a7357' };
const WALL_COLOUR = '#e6e1d7';
const CEILING_COLOUR = '#f1eee7';
const OBJECT_COLOUR = '#b9b2a6';

const ROUND = new Set(['cylinder', 'lamp', 'pendant', 'stool']);

/** Brightness of a face with world normal n: 0.6 … 1. */
function shade(n) {
  return 0.6 + 0.3 * Math.max(0, n.dot(LIGHT)) + 0.1 * Math.max(0, n.y);
}

const _n = new THREE.Vector3();

/** Bake per-vertex colours into `geo` for a mesh rotated by `quat`. */
function paint(geo, hex, quat) {
  const base = new THREE.Color(hex);
  const normals = geo.attributes.normal;
  const colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    _n.fromBufferAttribute(normals, i);
    if (quat) _n.applyQuaternion(quat);
    const k = shade(_n);
    colours[i * 3] = base.r * k;
    colours[i * 3 + 1] = base.g * k;
    colours[i * 3 + 2] = base.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

class Kit {
  constructor() {
    this.solid = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.glass = new THREE.MeshBasicMaterial({ name: 'glass_preview', color: 0xcfe3e8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    this.edges = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 });
  }

  /** A painted mesh plus its hairline edges. geo is in the parent's frame. */
  mesh(name, geo, hex, quat) {
    paint(geo, hex, quat);
    const m = new THREE.Mesh(geo, this.solid);
    m.name = name;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.edges);
    lines.name = `${name}__edges`;
    lines.raycast = () => {};
    m.add(lines);
    return m;
  }

  /** Axis-aligned box from min/max corners (parent frame). */
  box(name, [x0, y0, z0], [x1, y1, z1], hex, quat) {
    const geo = new THREE.BoxGeometry(Math.max(x1 - x0, 1e-3), Math.max(y1 - y0, 1e-3), Math.max(z1 - z0, 1e-3));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.mesh(name, geo, hex, quat);
  }
}

function buildShell(kit, root, shell) {
  const { width: w, depth: d, height: h } = shell;
  const t = shell.walls?.thickness ?? 0.12;
  const wallHex = shell.walls?.color || WALL_COLOUR;
  const floorHex = shell.floor?.color || FLOOR_COLOURS[shell.floor?.finish] || FLOOR_COLOURS.timber;

  root.add(kit.box('floor', [-t, -0.06, -t], [w + t, 0, d + t], floorHex));
  if (shell.ceiling?.show !== false) {
    root.add(kit.box('ceiling', [0, h, 0], [w, h + 0.04, d], shell.ceiling?.color || CEILING_COLOUR));
  }

  // Each wall runs along one axis ("u") at a fixed coordinate across it.
  // North/south walls cover the corners (u from -t to w + t).
  const walls = {
    north: { along: 'x', u0: -t, u1: w + t, across: [-t, 0] },
    south: { along: 'x', u0: -t, u1: w + t, across: [d, d + t] },
    west: { along: 'z', u0: 0, u1: d, across: [-t, 0] },
    east: { along: 'z', u0: 0, u1: d, across: [w, w + t] },
  };
  for (const [side, spec] of Object.entries(walls)) {
    const group = new THREE.Group();
    group.name = `wall_${side}`;
    const ops = (shell.openings || [])
      .filter((o) => o.wall === side)
      .map((o) => {
        const sill = o.sill ?? (o.type === 'window' ? 0.9 : 0);
        return { ...o, a: o.offset, b: o.offset + o.width, sill, head: Math.min(h, sill + o.height) };
      })
      .sort((p, q) => p.a - q.a);

    const pieces = [];
    let cursor = spec.u0;
    for (const o of ops) {
      if (o.a > cursor) pieces.push([cursor, o.a, 0, h]);
      if (o.sill > 0) pieces.push([o.a, o.b, 0, o.sill]);
      if (o.head < h) pieces.push([o.a, o.b, o.head, h]);
      cursor = Math.max(cursor, o.b);
    }
    if (cursor < spec.u1) pieces.push([cursor, spec.u1, 0, h]);

    const toBox = (u0, u1, y0, y1, [c0, c1]) =>
      spec.along === 'x' ? [[u0, y0, c0], [u1, y1, c1]] : [[c0, y0, u0], [c1, y1, u1]];

    pieces.forEach(([u0, u1, y0, y1], i) => {
      const [min, max] = toBox(u0, u1, y0, y1, spec.across);
      group.add(kit.box(`wall_${side}__part${i}`, min, max, wallHex));
    });
    ops
      .filter((o) => o.type === 'window')
      .forEach((o, i) => {
        const mid = (spec.across[0] + spec.across[1]) / 2;
        const [min, max] = toBox(o.a, o.b, o.sill, o.head, [mid - 0.004, mid + 0.004]);
        const geo = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
        geo.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
        const pane = new THREE.Mesh(geo, kit.glass);
        pane.name = `wall_${side}__window${i}_glass`;
        group.add(pane);
      });
    root.add(group);
  }
}

function buildObject(kit, o) {
  const group = new THREE.Group();
  group.name = `obj__${o.id}`;
  group.position.set(o.at[0], o.at[1], o.at[2]);
  group.rotation.y = (o.rotY || 0) * RAD;
  const quat = new THREE.Quaternion().setFromEuler(group.rotation);
  const [w, h, d] = o.size;
  const hex = o.color || OBJECT_COLOUR;
  const accent = o.accent || hex;
  const name = (part) => `obj__${o.id}__${part}`;

  const cylinder = (part, r, y0, y1, colour, sides = 20) => {
    const geo = new THREE.CylinderGeometry(r, r, y1 - y0, sides);
    geo.translate(0, (y0 + y1) / 2, 0);
    geo.scale(1, 1, d / w);
    return kit.mesh(name(part), geo, colour, quat);
  };
  const blob = (part, rx, ry, cy, colour) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    geo.scale(rx, ry, rx * (d / w));
    geo.translate(0, cy, 0);
    return kit.mesh(name(part), geo, colour, quat);
  };

  switch (o.kit) {
    case 'tree':
    case 'palm':
      group.add(cylinder('trunk', Math.min(w, d) * 0.06, 0, h * 0.62, accent, 8));
      group.add(blob('crown', w / 2, o.kit === 'palm' ? h * 0.12 : h * 0.3, o.kit === 'palm' ? h * 0.88 : h * 0.68, hex));
      break;
    case 'pine': {
      group.add(cylinder('trunk', Math.min(w, d) * 0.07, 0, h * 0.2, accent, 8));
      const geo = new THREE.ConeGeometry(w / 2, h * 0.85, 12);
      geo.translate(0, h * 0.15 + (h * 0.85) / 2, 0);
      geo.scale(1, 1, d / w);
      group.add(kit.mesh(name('crown'), geo, hex, quat));
      break;
    }
    case 'plant':
      group.add(cylinder('pot', w * 0.3, 0, h * 0.32, accent, 16));
      group.add(blob('leaves', w / 2, h * 0.36, h * 0.62, hex));
      break;
    default:
      if (ROUND.has(o.kit)) group.add(cylinder('body', w / 2, 0, h, hex));
      else group.add(kit.box(name('body'), [-w / 2, 0, -d / 2], [w / 2, h, d / 2], hex, quat));
  }
  return group;
}

/** Build the preview for a scene. Returns a Group in scene.json coordinates. */
export function buildLayoutPreview(scene) {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'layout-preview';
  if (scene.shell) buildShell(kit, root, scene.shell);
  if (scene.site?.ground) {
    const g = scene.site.ground;
    const [w, d] = g.size;
    root.add(kit.box('ground', [-w / 2, -0.1, -d / 2], [w / 2, 0, d / 2], g.color || GROUND_COLOURS[g.finish] || GROUND_COLOURS.paving));
  }
  for (const o of scene.objects || []) root.add(buildObject(kit, o));
  return root;
}
