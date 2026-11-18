/* ============================================================================
   PROJECTOR LIFE — visual aids on the patches
   ----------------------------------------------------------------------------
     gravity  per patch, drawn flat on the surface (4 mm proud):
              · g_t, the along-surface pull, as an amber arrow, length ∝ |g_t|
                (walls 0.6 m, facets 0.6·sin pitch, floor none)
              · g_n as a ring, radius ∝ |g_n|: green with inward chevrons when
                gravity presses the body in (floor, loft), magenta with outward
                chevrons when it peels it off (roof facets), a small grey ring
                at zero (walls)
     seams    a cyan ribbon along every seam edge, on both patches (so a seam
              reads as a line folded across the corner); the loft (no seams —
              creatures reach it by falling) gets a grey outline
     labels   a sprite per patch: a dot in the habitat colour, the id, the
              type (+ pitch on the facets)
   Everything is rebuilt from the patch list (apex change, masks, overrides)
   and fades with its patch (hidden when the patch's fade < 0.5).
   ========================================================================== */

import * as THREE from 'three';
import { toWorld, vec } from './roomModel.js';

export const AID_COLORS = {
  gt: '#ffb020',
  press: '#3ee08f',
  peel: '#ff4fa3',
  zero: '#9aa3a0',
  seam: '#3fc8ff',
  outline: '#8a8f8d',
  type: { floor: '#3ee08f', wall: '#ffb020', ceiling: '#ff4fa3' },
};

const LIFT = 0.004; // metres proud of the surface

function mat(color, extra = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    toneMapped: false,
    ...extra,
  });
}

/** Where the aids sit on a patch (local metres). */
function anchor(p) {
  if (p.kind === 'wall') return [p.width / 2, p.height * 0.56];
  if (p.kind === 'roof') return [p.width / 2, p.height * 0.36];
  // polygon centroid (area-weighted)
  let a = 0, cx = 0, cy = 0;
  const P = p.polygon;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i];
    const [x1, y1] = P[(i + 1) % P.length];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Triangles in patch-local 2-D → world positions array (lifted along the normal). */
function toWorldTris(p, tris2d, lift = LIFT) {
  const out = new Float32Array(tris2d.length * 3);
  for (let i = 0; i < tris2d.length / 2; i++) {
    const w = vec.add(toWorld(p, tris2d[i * 2], tris2d[i * 2 + 1]), vec.mul(p.normal, lift));
    out[i * 3] = w[0];
    out[i * 3 + 1] = w[1];
    out[i * 3 + 2] = w[2];
  }
  return out;
}

function meshFrom(positions, material, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.renderOrder = 10;
  m.raycast = () => {};
  return m;
}

/** Arrow from c − L/2·d to c + L/2·d, flat in local 2-D. */
function arrow2d(c, d, L) {
  const sw = 0.034;
  const hw = 0.11;
  const hl = Math.min(0.1, L * 0.45);
  const n = [-d[1], d[0]];
  const P = (s, t) => [c[0] + d[0] * s + n[0] * t, c[1] + d[1] * s + n[1] * t];
  const s0 = -L / 2;
  const s1 = L / 2 - hl;
  const q = [P(s0, -sw / 2), P(s1, -sw / 2), P(s1, sw / 2), P(s0, sw / 2)];
  const h = [P(s1, -hw / 2), P(L / 2, 0), P(s1, hw / 2)];
  return [...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3], ...h[0], ...h[1], ...h[2]];
}

function ring2d(c, r, w, seg = 48) {
  const out = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (a, rr) => [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr];
    const [i0, i1, o0, o1] = [p(a0, r - w / 2), p(a1, r - w / 2), p(a0, r + w / 2), p(a1, r + w / 2)];
    out.push(...i0, ...o0, ...o1, ...i0, ...o1, ...i1);
  }
  return out;
}

/** 4 chevrons on the ring, pointing in (press) or out (peel). */
function chevrons2d(c, r, inward) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const d = [Math.cos(a), Math.sin(a)];
    const n = [-d[1], d[0]];
    const base = r + (inward ? 0.055 : 0.02);
    const tip = r + (inward ? 0.015 : 0.06);
    const P = (s, t) => [c[0] + d[0] * s + n[0] * t, c[1] + d[1] * s + n[1] * t];
    out.push(...P(base, -0.03), ...P(tip, 0), ...P(base, 0.03));
  }
  return out;
}

/** A ribbon inside the patch along edge i (width w). */
function edgeRibbon2d(p, i, w) {
  const a = p.polygon[i];
  const b = p.polygon[(i + 1) % p.polygon.length];
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const L = Math.hypot(ex, ey);
  const n = [(-ey / L) * w, (ex / L) * w]; // inward for CCW polygons
  const a1 = [a[0] + n[0], a[1] + n[1]];
  const b1 = [b[0] + n[0], b[1] + n[1]];
  return [...a, ...b, ...b1, ...a, ...b1, ...a1];
}

function labelCanvas(p, typeText) {
  const W = 320;
  const H = 112;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(8, 10, 12, 0.82)';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
  const col = AID_COLORS.type[p.typeShown] || '#ffffff';
  g.fillStyle = col;
  g.beginPath();
  g.arc(30, 40, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f4f4f2';
  g.font = '600 34px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.textBaseline = 'middle';
  g.fillText(p.id, 52, 41);
  g.fillStyle = 'rgba(244, 244, 242, 0.72)';
  g.font = '400 25px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.fillText(typeText, 52, 82);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createAids() {
  const group = new THREE.Group();
  group.name = 'pjl-aids';
  const mats = {
    gt: mat(AID_COLORS.gt),
    press: mat(AID_COLORS.press),
    peel: mat(AID_COLORS.peel),
    zero: mat(AID_COLORS.zero, { opacity: 0.8 }),
    seam: mat(AID_COLORS.seam, { opacity: 0.9 }),
    outline: mat(AID_COLORS.outline, { opacity: 0.7 }),
  };
  const layers = { gravity: new THREE.Group(), seams: new THREE.Group(), labels: new THREE.Group() };
  for (const [k, g] of Object.entries(layers)) {
    g.name = `pjl-aids-${k}`;
    g.visible = false;
    group.add(g);
  }
  let perPatch = new Map(); // id → { gravity: Group, seams: Mesh|null, label: Sprite }
  let built = { gravity: false, seams: false, labels: false };
  let patches = [];
  let typeOf = (p) => p.type;

  function clearLayer(layer) {
    for (const o of [...layer.children]) {
      o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.isSprite) {
          c.material.map?.dispose();
          c.material.dispose();
        }
      });
      layer.remove(o);
    }
  }

  function buildGravity() {
    clearLayer(layers.gravity);
    for (const p of patches) {
      const g = new THREE.Group();
      g.name = `pjl-gravity-${p.id}`;
      const c = anchor(p);
      const [gx, gy] = p.gravity.gt;
      const gt = Math.hypot(gx, gy);
      if (gt > 1e-6) g.add(meshFrom(toWorldTris(p, arrow2d(c, [gx / gt, gy / gt], 0.6 * gt), LIFT * 1.6), mats.gt, 'gt'));
      const gn = p.gravity.gn;
      if (Math.abs(gn) < 1e-6) {
        g.add(meshFrom(toWorldTris(p, ring2d(c, 0.035, 0.014, 24)), mats.zero, 'gn'));
      } else {
        const r = 0.05 + 0.18 * Math.abs(gn);
        const m = gn > 0 ? mats.press : mats.peel;
        g.add(meshFrom(toWorldTris(p, ring2d(c, r, 0.024)), m, 'gn'));
        g.add(meshFrom(toWorldTris(p, chevrons2d(c, r, gn > 0)), m, 'gn-dir'));
      }
      layers.gravity.add(g);
      entry(p.id).gravity = g;
    }
    built.gravity = true;
  }

  function buildSeams() {
    clearLayer(layers.seams);
    for (const p of patches) {
      const tris = [];
      if (p.noSeams) {
        for (let i = 0; i < p.polygon.length; i++) tris.push(...edgeRibbon2d(p, i, 0.016));
      } else {
        for (const s of p.seams) tris.push(...edgeRibbon2d(p, s.edge, 0.022));
      }
      if (!tris.length) continue;
      const m = meshFrom(toWorldTris(p, tris), p.noSeams ? mats.outline : mats.seam, `pjl-seams-${p.id}`);
      layers.seams.add(m);
      entry(p.id).seams = m;
    }
    built.seams = true;
  }

  function buildLabels() {
    clearLayer(layers.labels);
    for (const p of patches) {
      const t = typeOf(p);
      const shown = { ...p, typeShown: t };
      const text = p.kind === 'roof' ? `${t} · ${p.pitchDeg.toFixed(1)}°` : p.kind === 'loft' ? `${t} · deck` : t;
      const tex = labelCanvas(shown, t !== p.typeAuto ? `${text} (override)` : text);
      const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const s = new THREE.Sprite(sm);
      s.name = `pjl-label-${p.id}`;
      s.renderOrder = 20;
      const c = anchor(p);
      const off = p.kind === 'wall' ? [0, 0.42] : p.kind === 'roof' ? [0, 0.32] : [0, 0];
      const w = vec.add(toWorld(p, c[0] + off[0], c[1] + off[1]), vec.mul(p.normal, 0.12));
      s.position.set(w[0], w[1], w[2]);
      s.scale.set(0.5, 0.175, 1);
      s.raycast = () => {};
      layers.labels.add(s);
      entry(p.id).label = s;
    }
    built.labels = true;
  }

  function entry(id) {
    if (!perPatch.has(id)) perPatch.set(id, {});
    return perPatch.get(id);
  }

  return {
    group,
    /** New patch list (and how to read each patch's shown type, for overrides). */
    setPatches(list, typeFn = null) {
      patches = list;
      if (typeFn) typeOf = typeFn;
      perPatch = new Map();
      built = { gravity: false, seams: false, labels: false };
      for (const [k, layer] of Object.entries(layers)) {
        if (layer.visible) ({ gravity: buildGravity, seams: buildSeams, labels: buildLabels })[k]();
        else clearLayer(layer);
      }
    },
    relabel(typeFn) {
      if (typeFn) typeOf = typeFn;
      if (layers.labels.visible) buildLabels();
      else built.labels = false;
    },
    setVisible({ gravity, seams, labels }) {
      layers.gravity.visible = !!gravity;
      layers.seams.visible = !!seams;
      layers.labels.visible = !!labels;
      if (gravity && !built.gravity) buildGravity();
      if (seams && !built.seams) buildSeams();
      if (labels && !built.labels) buildLabels();
    },
    /**
     * Per frame: hide a patch's aids while its surface is faded out; labels
     * keep a roughly constant size on screen (and hide when the camera is on
     * top of them, e.g. the wall-S label for someone standing in the door).
     */
    follow(fadeOf, camera = null) {
      if (!layers.gravity.visible && !layers.seams.visible && !layers.labels.visible) return;
      for (const p of patches) {
        const e = perPatch.get(p.id);
        if (!e) continue;
        const on = fadeOf(p) > 0.5;
        if (e.gravity) e.gravity.visible = on;
        if (e.seams) e.seams.visible = on;
        if (e.label) {
          let show = on;
          if (camera && show) {
            const d = camera.position.distanceTo(e.label.position);
            const w = Math.min(0.72, Math.max(0.24, d * 0.085));
            e.label.scale.set(w, w * 0.35, 1);
            show = d > 0.9;
          }
          e.label.visible = show;
        }
      }
    },
    dispose() {
      for (const layer of Object.values(layers)) clearLayer(layer);
      for (const m of Object.values(mats)) m.dispose();
      group.removeFromParent();
    },
  };
}
