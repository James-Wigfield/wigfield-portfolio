#!/usr/bin/env node
/* ============================================================================
   PROJECTOR LIFE — room check (Node, no browser, no three.js)
   ----------------------------------------------------------------------------
   Verifies the room model (room/roomModel.js) against itself and against the
   She'd GLB, parsed here straight from its JSON + BIN chunks:

     · the 8 wall flats sit where the GLB's inner wall faces are (apothem
       2.180 ± 0.01, corners, eave max y 2.25), and the old roof's eave/cap
     · patches close the room (wall bottoms ↔ floor edges, wall tops ↔ facet
       eaves, wall sides pair, hips pair, Σ n·A = 0, areas add up)
     · every seam has a reciprocal whose M is the inverse (world error < 1e-9)
     · gravity is right on floor / wall / pitched roof, and a steeper apex
       means more downslope pull |g_t| and less pull-off |g_n| on the facets
     · masks and the loft polygon lie inside their patches; door/window match
       the layout; room/measured.js matches a fresh measurement of the GLB
     · landing(): the heightfield lands bodies on the loft deck, not under it

   Usage:  node tools/projector-life/room-check.mjs            check, PASS/FAIL table, exit 1 on failure
           node tools/projector-life/room-check.mjs --write    re-measure the GLB → room/measured.js, then check
           node tools/projector-life/room-check.mjs --json     also print the measurement as JSON
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MOD = path.join(ROOT, 'src/components/portal/modules/projector-life');
const GLB = path.join(MOD, 'assets/she-d.glb');
const MEASURED_FILE = path.join(MOD, 'room/measured.js');
const args = new Set(process.argv.slice(2));

// ── GLB → world-space triangle soups ────────────────────────────────────────
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  const SIZE = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
  const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const accessor = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    const n = a.count * COMPS[a.type];
    const start = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
    if (bv.byteStride && bv.byteStride !== COMPS[a.type] * SIZE[a.componentType]) throw new Error('strided accessors not supported');
    const ab = bin.buffer.slice(start, start + n * SIZE[a.componentType]);
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    return new Type(ab);
  };
  const mul = (a, b) => {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  };
  const trs = (n) => {
    if (n.matrix) return n.matrix.slice();
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
    const s = n.scale || [1, 1, 1];
    const t = n.translation || [0, 0, 0];
    const m = [
      1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
      t[0], t[1], t[2], 1,
    ];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c];
    return m;
  };
  const prims = [];
  const walk = (ni, parent, top) => {
    const node = json.nodes[ni];
    const m = mul(parent, trs(node));
    const name = top || node.name;
    if (node.mesh != null) {
      for (const p of json.meshes[node.mesh].primitives) {
        if (p.mode != null && p.mode !== 4) continue;
        const pos = accessor(p.attributes.POSITION);
        const w = new Float32Array(pos.length);
        for (let i = 0; i < pos.length; i += 3) {
          const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
          w[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
          w[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          w[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
        const material = json.materials?.[p.material]?.name || '';
        let kind = 'furniture';
        if (name.startsWith('wall_')) kind = material.startsWith('glass') ? 'glass' : 'wall';
        else if (name === 'floor') kind = 'floor';
        else if (name === 'ceiling') kind = 'ceiling';
        else if (name === 'obj__loft') kind = 'loft';
        prims.push({ name, kind, material, positions: w, index: p.indices != null ? accessor(p.indices) : null });
      }
    }
    for (const c of node.children || []) walk(c, m, name); // `obj__x__mesh` children keep their object's name
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const ni of json.scenes[json.scene || 0].nodes) walk(ni, I, null);
  return { json, prims };
}

// ── results table ───────────────────────────────────────────────────────────
const rows = [];
function check(group, name, ok, detail = '') {
  rows.push({ group, name, ok: !!ok, detail: String(detail) });
  return ok;
}
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v));
const e = (v) => v.toExponential(1);

// ── run ─────────────────────────────────────────────────────────────────────
const { json, prims } = readGlb(GLB);
const imp = (f) => import(pathToFileURL(path.join(MOD, 'room', f)).href);
const measure = await imp('measure.js');
const fresh = measure.measureRoom(prims);

if (args.has('--write')) {
  const body = {
    source: 'assets/she-d.glb',
    deck: { y: fresh.deck.y, polygon: fresh.deck.polygon, area: Math.round(fresh.deck.area * 1e4) / 1e4 },
    door: fresh.door,
    window: fresh.window,
    oldRoof: { capY: Math.round(fresh.oldRoof.capY * 1000) / 1000, eaveR: Math.round(fresh.oldRoof.eaveR * 1e4) / 1e4 },
    masks: fresh.masks,
  };
  const text = `/* ============================================================================
   PROJECTOR LIFE — measured from the She'd GLB (GENERATED, do not hand-edit)
   ----------------------------------------------------------------------------
   Written by \`node tools/projector-life/room-check.mjs --write\` from
   ${body.source} (room/measure.js). The plain check fails if this file and a
   fresh measurement disagree by more than 2 mm.
     deck    the loft deck: height and outline (floor-local: x east, y north
             from the SW bounding corner, CCW)
     door    S flat, wall-local metres: the leaf (flush with the inner face)
             and the mask (leaf + lining + architrave)
     window  NE flat: the glazed hole and the mask (frame + sill)
     masks   [{ patch, id, kind, polygon }] in patch-local metres
   ========================================================================== */

export const MEASURED = ${JSON.stringify(body, null, 2).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]')};
`;
  fs.writeFileSync(MEASURED_FILE, text);
  console.log(`wrote ${path.relative(ROOT, MEASURED_FILE)} (${fresh.masks.length} masks); checking with a fresh process…`);
  // ES modules are cached: check the new numbers in a new process.
  const rest = process.argv.slice(2).filter((a) => a !== '--write');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...rest], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const RM = await imp('roomModel.js');
const { MEASURED } = await imp('measured.js');
const { buildHeightfield } = await imp('heightfield.js');
const { VIEWS } = await imp('views.js');
const G2 = await imp('geom2d.js');
const { SHED, FLATS, buildPatches, toWorld, mapPoint, mapDir, pitchDeg, polygonArea, vec } = RM;

// 1 · the GLB itself
{
  const names = json.nodes.map((n) => n.name);
  const need = ['ceiling', 'floor', 'wall_north', 'wall_east', 'wall_south', 'wall_west', 'obj__loft'];
  check('glb', 'nodes present', need.every((n) => names.includes(n)), `${json.nodes.length} nodes`);
  check('glb', 'unlit + webp', (json.extensionsUsed || []).includes('KHR_materials_unlit'), (json.extensionsUsed || []).join(', '));
  const cap = json.nodes.find((n) => n.name === 'obj__octagon');
  check('glb', 'obj__octagon has no mesh (cap lives in `ceiling`)', cap && cap.mesh == null);
}

// 2 · flats vs the GLB's actual vertices
{
  const { flats, eave, outside } = fresh.flats;
  for (const f of flats) {
    const ok = Math.abs(f.face - SHED.apothem) <= 0.01 && f.onFace >= 4
      && Math.abs(f.x0) < 0.01 && Math.abs(f.x1 - SHED.side) < 0.01 && Math.abs(f.y0) < 0.005 && Math.abs(f.y1 - SHED.eaveY) < 0.005;
    check('flats', `wall-${f.id} inner face`, ok, `face d=${f.face.toFixed(3)} (${f.onFace} verts) x ${f3(f.x0)}…${f3(f.x1)} y ${f3(f.y0)}…${f3(f.y1)}`);
  }
  check('flats', 'eave = max y of the walls', Math.abs(eave - SHED.eaveY) < 0.005, `max y ${f3(eave)}`);
  check('flats', 'no wall vertex beyond the outer face', outside === 0, `${outside} outside`);
  // corners: a GLB wall vertex within 2 mm of every patch corner (floor and eave)
  const walls = prims.filter((p) => p.kind === 'wall');
  const patches = buildPatches({ apex: SHED.apex.default });
  let worst = 0;
  for (const p of patches.filter((q) => q.kind === 'wall')) {
    for (const c of p.corners3d) {
      let best = Infinity;
      for (const w of walls) {
        const P = w.positions;
        for (let i = 0; i < P.length; i += 3) best = Math.min(best, Math.hypot(P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]));
      }
      worst = Math.max(worst, best);
    }
  }
  check('flats', 'wall patch corners are GLB vertices', worst < 0.002, `worst ${(worst * 1000).toFixed(2)} mm`);
  const old = fresh.oldRoof;
  check('flats', 'old roof eave ring at the circumradius', Math.abs(old.eaveR - SHED.circumradius) < 0.003, `r ${old.eaveR.toFixed(4)} vs ${SHED.circumradius.toFixed(4)}`);
  check('flats', 'old roof cap at 2.68', Math.abs(old.capY - SHED.oldRoof.capY) < 0.005, `cap y ${f3(old.capY)} → old apex ${f3(SHED.oldRoof.apex)}, ${SHED.oldRoof.pitchDeg.toFixed(1)}°`);
}

// 3 · measured.js vs a fresh measurement
{
  const close = (a, b, tol = 0.002) => a.length === b.length && a.every((q, i) => Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) <= tol);
  check('measured', 'deck height', Math.abs(MEASURED.deck.y - fresh.deck.y) < 0.002, `${f3(fresh.deck.y)} m`);
  check('measured', 'deck outline', close(MEASURED.deck.polygon, fresh.deck.polygon), `${fresh.deck.polygon.length} pts, ${fresh.deck.area.toFixed(3)} m²`);
  const key = (m) => `${m.patch}|${m.kind}|${m.id}`;
  const A = new Map((MEASURED.masks || []).map((m) => [key(m), m]));
  const B = new Map(fresh.masks.map((m) => [key(m), m]));
  const same = A.size === B.size && [...B].every(([k, m]) => A.has(k) && close(A.get(k).polygon, m.polygon));
  check('measured', 'masks', same, `${A.size} stored / ${B.size} measured`);
}

// 4 · door and window against layout.md
{
  const d = fresh.door;
  const w = fresh.window;
  const mid = SHED.side / 2;
  check('openings', 'door leaf 0.87 × 2.04, centred on wall-S', d && Math.abs(d.hole.x1 - d.hole.x0 - 0.87) < 0.01 && Math.abs(d.hole.y1 - 2.04) < 0.01 && Math.abs((d.hole.x0 + d.hole.x1) / 2 - mid) < 0.01,
    d ? `leaf ${f3(d.hole.x0)}…${f3(d.hole.x1)} × ${f3(d.hole.y0)}…${f3(d.hole.y1)}` : 'not found');
  check('openings', 'door mask covers the 0.94 × 2.08 lining', d && d.mask.x0 <= mid - 0.47 && d.mask.x1 >= mid + 0.47 && d.mask.y0 === 0 && d.mask.y1 >= 2.08,
    d ? `mask ${f3(d.mask.x0)}…${f3(d.mask.x1)} × ${f3(d.mask.y0)}…${f3(d.mask.y1)}` : '');
  check('openings', 'window hole centred +0.06 on wall-NE', w && Math.abs((w.hole.x0 + w.hole.x1) / 2 - (mid + 0.06)) < 0.01,
    w ? `hole ${f3(w.hole.x0)}…${f3(w.hole.x1)} × ${f3(w.hole.y0)}…${f3(w.hole.y1)}` : 'not found');
  check('openings', 'window mask covers the 0.67 × 0.40–2.07 frame', w && w.mask.x0 <= mid + 0.06 - 0.335 && w.mask.x1 >= mid + 0.06 + 0.335 && w.mask.y0 <= 0.4 && w.mask.y1 >= 2.07,
    w ? `mask ${f3(w.mask.x0)}…${f3(w.mask.x1)} × ${f3(w.mask.y0)}…${f3(w.mask.y1)}` : '');
}

// 5 · the patch model at several apex heights
const APEXES = [2.7, 3.0, 3.3, 3.75, 4.2, SHED.oldRoof.apex];
const facetG = [];
const s = SHED.side;
const floorArea = 2 * (1 + Math.SQRT2) * s * s;
for (const apex of APEXES) {
  const tag = apex === SHED.oldRoof.apex ? `old ${f3(apex)}` : `apex ${apex.toFixed(2)}`;
  const P = buildPatches({ apex });
  const byId = new Map(P.map((p) => [p.id, p]));
  check(tag, '18 patches, unique ids', P.length === 18 && byId.size === 18, `${P.length}`);
  check(tag, 'polygons CCW', P.every((p) => polygonArea(p.polygon) > 0));

  // closure: Σ n·A over the closed shell (loft excluded) = 0
  let sum = [0, 0, 0];
  for (const p of P) if (p.kind !== 'loft') sum = vec.add(sum, vec.mul(p.normal, p.area));
  check(tag, 'shell closes (Σ n·A = 0)', vec.len(sum) < 1e-9, `|Σ| ${e(vec.len(sum))}`);

  const seamTo = (a, edge, b, toEdge) => {
    const pa = byId.get(a);
    return pa && pa.seams.some((q) => q.edge === edge && q.to === b && (toEdge == null || q.toEdge === toEdge));
  };
  let ok1 = true, ok2 = true, ok3 = true, ok4 = true;
  for (let k = 0; k < 8; k++) {
    const n = FLATS[k];
    const n1 = FLATS[(k + 1) % 8];
    ok1 &&= seamTo(`wall-${n}`, 0, 'floor') && byId.get('floor').seams.some((q) => q.to === `wall-${n}` && q.toEdge === 0);
    ok2 &&= seamTo(`wall-${n}`, 2, `roof-${n}`, 0) && seamTo(`roof-${n}`, 0, `wall-${n}`, 2);
    ok3 &&= seamTo(`wall-${n}`, 1, `wall-${n1}`, 3) && seamTo(`wall-${n1}`, 3, `wall-${n}`, 1);
    ok4 &&= seamTo(`roof-${n}`, 1, `roof-${n1}`, 2) && seamTo(`roof-${n1}`, 2, `roof-${n}`, 1);
  }
  check(tag, 'wall bottoms ↔ floor edges', ok1);
  check(tag, 'wall tops ↔ facet eaves', ok2);
  check(tag, 'wall sides pair at the corners', ok3);
  check(tag, 'hips pair', ok4);
  const edgesOk = P.filter((p) => !p.noSeams).every((p) => p.polygon.every((_, i) => p.seams.filter((q) => q.edge === i).length === 1));
  const nSeams = P.reduce((n, p) => n + p.seams.length, 0);
  check(tag, 'every shell edge has exactly one seam', edgesOk && nSeams === 64, `${nSeams} seams`);

  // reciprocity + world error
  let worstInv = 0;
  let worstWorld = 0;
  let worstDir = 0;
  let recip = true;
  for (const p of P) {
    for (const sm of p.seams) {
      const q = byId.get(sm.to);
      const back = q.seams.find((t) => t.edge === sm.toEdge && t.to === p.id && t.toEdge === sm.edge);
      if (!back) {
        recip = false;
        continue;
      }
      // M_back ∘ M = identity
      for (const pt of [[0, 0], [1, 0], [0, 1], [0.37, 1.9]]) {
        const r = mapPoint(back.M, ...mapPoint(sm.M, ...pt));
        worstInv = Math.max(worstInv, Math.hypot(r[0] - pt[0], r[1] - pt[1]));
      }
      // points on the edge land on the same world point in the neighbour
      const a = p.polygon[sm.edge];
      const b = p.polygon[(sm.edge + 1) % p.polygon.length];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const lp = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const w1 = toWorld(p, ...lp);
        const w2 = toWorld(q, ...mapPoint(sm.M, ...lp));
        worstWorld = Math.max(worstWorld, vec.len(vec.sub(w1, w2)));
      }
      // the edge tangent maps to the same world direction
      const tl = mapDir(sm.M, b[0] - a[0], b[1] - a[1]);
      const d1 = vec.add(vec.mul(p.u, b[0] - a[0]), vec.mul(p.v, b[1] - a[1]));
      const d2 = vec.add(vec.mul(q.u, tl[0]), vec.mul(q.v, tl[1]));
      worstDir = Math.max(worstDir, vec.len(vec.sub(d1, d2)));
      // a point just inside this patch maps just outside the neighbour (unfolding)
      const inward = [-(b[1] - a[1]), b[0] - a[0]];
      const L = Math.hypot(...inward);
      const mid = [(a[0] + b[0]) / 2 + (inward[0] / L) * 0.01, (a[1] + b[1]) / 2 + (inward[1] / L) * 0.01];
      const m2 = mapPoint(sm.M, ...mid);
      if (RM.pointInPolygon(m2[0], m2[1], q.polygon)) recip = false;
    }
  }
  check(tag, 'every seam has a reciprocal, M⁻¹', recip && worstInv < 1e-9, `|M⁻¹M − I| ${e(worstInv)}`);
  check(tag, 'seam world error < 1e-9', worstWorld < 1e-9 && worstDir < 1e-9, `pos ${e(worstWorld)}, dir ${e(worstDir)}`);

  // areas
  const area = (kind) => P.filter((p) => p.kind === kind).reduce((a, p) => a + p.area, 0);
  const pitch = (pitchDeg(apex) * Math.PI) / 180;
  check(tag, 'areas add up', Math.abs(area('floor') - floorArea) < 1e-9 && Math.abs(area('wall') - 8 * s * SHED.eaveY) < 1e-9
    && Math.abs(area('roof') - floorArea / Math.cos(pitch)) < 1e-9 && Math.abs(area('loft') - MEASURED.deck.area) < 1e-3,
  `floor ${area('floor').toFixed(3)} · walls ${area('wall').toFixed(3)} · roof ${area('roof').toFixed(3)} · loft ${area('loft').toFixed(3)} m²`);

  // gravity
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  const fl = byId.get('floor');
  const lo = byId.get('loft');
  check(tag, 'gravity: floor + loft press in', [fl, lo].every((p) => near(p.gravity.gt[0], 0) && near(p.gravity.gt[1], 0) && near(p.gravity.gn, 1) && p.typeAuto === 'floor'));
  check(tag, 'gravity: walls drag down, no pull-off', P.filter((p) => p.kind === 'wall').every((p) => near(p.gravity.gt[0], 0) && near(p.gravity.gt[1], -1) && near(p.gravity.gn, 0) && p.typeAuto === 'wall'));
  const facets = P.filter((p) => p.kind === 'roof');
  const gt = Math.hypot(...facets[0].gravity.gt);
  check(tag, 'gravity: facets downslope + peel off', facets.every((p) => near(p.gravity.gt[0], 0) && near(p.gravity.gt[1], -Math.sin(pitch)) && near(p.gravity.gn, -Math.cos(pitch)) && p.typeAuto === 'ceiling'),
    `|g_t| ${gt.toFixed(3)} g_n ${facets[0].gravity.gn.toFixed(3)} at ${pitchDeg(apex).toFixed(1)}°`);
  if (apex !== SHED.oldRoof.apex) facetG.push({ apex, gt, gn: Math.abs(facets[0].gravity.gn) });

  // masks inside their patches
  let maskOk = true;
  let maskDetail = '';
  for (const p of P) {
    for (const m of p.masks) {
      const inside = m.polygon.every(([x, y]) => {
        // convex patch: inside or on every edge (CCW → left of each edge)
        return p.polygon.every((a, i) => {
          const b = p.polygon[(i + 1) % p.polygon.length];
          return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-6;
        });
      });
      if (!inside || polygonArea(m.polygon) <= 0) {
        maskOk = false;
        maskDetail += `${p.id}/${m.id} `;
      }
    }
  }
  const nMasks = P.reduce((n, p) => n + p.masks.length, 0);
  check(tag, 'masks inside their patches, CCW', maskOk, maskOk ? `${nMasks} masks` : maskDetail);
}
{
  // a steeper apex ⇒ larger |g_t|, smaller |g_n| on the facets
  const inc = facetG.every((g, i) => i === 0 || (g.gt > facetG[i - 1].gt && g.gn < facetG[i - 1].gn));
  check('gravity', 'steeper apex ⇒ |g_t|↑ |g_n|↓', inc, facetG.map((g) => `${g.apex}:${g.gt.toFixed(2)}/${g.gn.toFixed(2)}`).join(' '));
}

// 6 · masks present where they should be; options
{
  const P = buildPatches({ apex: 3.3 });
  const by = new Map(P.map((p) => [p.id, p]));
  const has = (id, kind, mid) => by.get(id).masks.some((m) => m.kind === kind && (!mid || m.id === mid));
  check('masks', 'door on wall-S, window on wall-NE', has('wall-S', 'door') && has('wall-NE', 'window'));
  check('masks', 'loft on wall-SW, wall-W, wall-NW (+ wall-N end, floor)', ['wall-SW', 'wall-W', 'wall-NW', 'wall-N', 'floor'].every((id) => has(id, 'loft')));
  const furn = P.flatMap((p) => p.masks.filter((m) => m.kind === 'furniture').map((m) => `${p.id}:${m.id}`));
  check('masks', 'furniture footprints + walls stood against', has('floor', 'furniture', 'armchair') && has('wall-N', 'furniture', 'armchair') && has('wall-W', 'furniture', 'heater'), `${furn.length}: ${furn.join(' ')}`);
  const loftPoly = by.get('loft').polygon;
  const floorPoly = by.get('floor').polygon;
  const inFloor = loftPoly.every(([x, y]) => floorPoly.every((a, i) => {
    const b = floorPoly[(i + 1) % floorPoly.length];
    return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-6;
  }));
  check('masks', 'loft polygon inside the floor octagon', inFloor, `deck y ${f3(by.get('loft').origin[1])}, ${loftPoly.length} pts`);
  const noLoft = buildPatches({ apex: 3.3, loft: false });
  check('masks', 'loft hidden → no loft patch, no loft masks', noLoft.length === 17 && noLoft.every((p) => p.masks.every((m) => m.kind !== 'loft')));
  const noFurn = buildPatches({ apex: 3.3, furniture: false });
  check('masks', 'furniture hidden → no furniture masks', noFurn.every((p) => p.masks.every((m) => m.kind !== 'furniture')));
}

// 7 · landing heightfield
{
  const t0 = performance.now();
  const hf = buildHeightfield(prims);
  const tBuild = performance.now() - t0;
  const L = hf.landing;
  const C = SHED.centre;
  const mid = L(C[0], C[2], 3.0);
  check('landing', 'room centre → floor', mid.patchId === 'floor' && Math.abs(mid.y) < 0.01, `y ${f3(mid.y)} ${mid.surface}`);
  // the middle of the deck, clear of the front rail: 0.6 m in from the W wall
  const onDeck = L(0.6, 2.2, 3.3);
  check('landing', 'roof over the loft → the deck (or bags on it)', onDeck.patchId === 'loft' && onDeck.y >= 1.09 && onDeck.y < 1.6, `y ${f3(onDeck.y)} ${onDeck.surface}`);
  const under = L(0.6, 2.2, 1.0);
  check('landing', 'dropped under the deck → below it', under.y < 1.0 && under.patchId !== 'loft', `y ${f3(under.y)} ${under.surface}`);
  const noLoft = L(0.6, 2.2, 3.3, { loft: false });
  check('landing', 'loft hidden → falls through to below', noLoft.y < 1.0, `y ${f3(noLoft.y)} ${noLoft.surface}`);
  const cab = L(1.4, 1.33, 1.0);
  check('landing', 'cabinet top (under the loft) ≈ 0.74', cab.surface === 'furniture' && Math.abs(cab.y - 0.74) < 0.03, `y ${f3(cab.y)} ${cab.surface}`);
  const cabOff = L(1.4, 1.33, 1.0, { furniture: false });
  check('landing', 'furniture hidden → floor', cabOff.patchId === 'floor' && Math.abs(cabOff.y) < 0.01, `y ${f3(cabOff.y)}`);
  const trunk = L(3.5, 3.15, 2.5);
  check('landing', 'trunk top', trunk.surface === 'furniture' && trunk.y > 0.5 && trunk.y < 1.0, `y ${f3(trunk.y)}`);
  // every point under every roof facet (steep apex) lands somewhere sane
  let bad = 0;
  let nDrops = 0;
  const P = buildPatches({ apex: 4.2 });
  for (const p of P.filter((q) => q.kind === 'roof')) {
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20 - i; j++) {
        const a = (i + 0.3) / 20;
        const b = (j + 0.3) / 20;
        if (a + b > 1) continue;
        const [x0, y0] = p.polygon[0];
        const [x1, y1] = p.polygon[1];
        const [x2, y2] = p.polygon[2];
        const w = toWorld(p, x0 + (x1 - x0) * a + (x2 - x0) * b, y0 + (y1 - y0) * a + (y2 - y0) * b);
        const r = L(w[0], w[2], w[1]);
        nDrops++;
        if (!(r.y >= -0.001 && r.y < w[1] && Array.isArray(r.local))) bad++;
      }
    }
  }
  check('landing', 'drops from every roof facet land', bad === 0, `${nDrops} drops, ${bad} bad`);
  const t1 = performance.now();
  let acc = 0;
  for (let i = 0; i < 100000; i++) acc += L(0.3 + (i % 97) * 0.04, 0.3 + ((i * 7) % 89) * 0.042, 3).y;
  const tq = performance.now() - t1;
  check('landing', 'fast (100k queries)', tq < 250 && Number.isFinite(acc), `build ${tBuild.toFixed(0)} ms, ${tq.toFixed(0)} ms / 100k`);
}

// 8 · views
{
  const A = SHED.apothem;
  const inside = (p) => G2.octagonDist(p[0], p[2]) < A - 0.02;
  const v = VIEWS;
  const finite = Object.values(v).every((q) => [...q.position, ...q.target, q.fov].every(Number.isFinite));
  check('views', 'all finite', finite, Object.keys(v).join(', '));
  check('views', 'door: eye 1.6 in the doorway', Math.abs(v.door.position[1] - 1.6) < 1e-9 && G2.octagonDist(v.door.position[0], v.door.position[2]) <= A, `d ${f3(G2.octagonDist(v.door.position[0], v.door.position[2]))}`);
  check('views', 'armchair: seated eye ≈ 1.1 inside', Math.abs(v.armchair.position[1] - 1.1) < 0.05 && inside(v.armchair.position));
  check('views', 'loft: eye ≈ 1.3 over the deck', Math.abs(v.loft.position[1] - 1.3) < 0.05 && RM.pointInPolygon(...G2.toFloorLocal(v.loft.position[0], v.loft.position[2]), MEASURED.deck.polygon));
  check('views', 'cutaway outside, plan above', !inside(v.cutaway.position) && v.plan.position[1] > 6);
}

// 9 · cutaway fade rules (fades.js is three-free: fake groups, fake camera)
{
  const { createFades, fadeGroup } = await imp('fades.js');
  const { cutawayView } = await imp('views.js');
  const run = (pos, opts) => {
    const g = {
      walls: FLATS.map(() => fadeGroup([])),
      roof: FLATS.map(() => fadeGroup([])),
      hips: FLATS.map(() => fadeGroup([])),
      boss: fadeGroup([]),
      oldRoof: FLATS.map(() => fadeGroup([])),
    };
    const f = createFades(g);
    f.update({ position: { x: pos[0], y: pos[1], z: pos[2] } }, 16, opts);
    const on = (list) => list.map((q, k) => (q.value > 0.5 ? FLATS[k] : null)).filter(Boolean);
    return { walls: on(g.walls), roof: on(g.roof), old: on(g.oldRoof) };
  };
  for (const apex of [2.7, 3.3, 4.2]) {
    const v = cutawayView(apex);
    const r = run(v.position, { cutaway: true, apex });
    check('cutaway', `hero at apex ${apex}: far facets + walls show`, r.roof.length >= 3 && r.walls.length >= 4 && r.walls.length <= 6 && !r.walls.includes('S'),
      `cam y ${f3(v.position[1])} · walls ${r.walls.join(' ')} · facets ${r.roof.join(' ')}`);
  }
  const old = cutawayView(SHED.oldRoof.apex);
  const ro = run(old.position, { cutaway: true, oldRoof: true });
  check('cutaway', 'hero with the old roof: its far sectors show', ro.old.length >= 3, `cam y ${f3(old.position[1])} · sectors ${ro.old.join(' ')}`);
  const plan = run(VIEWS.plan.position, { cutaway: true, apex: 4.2 });
  check('cutaway', 'plan: every wall, no roof', plan.walls.length === 8 && plan.roof.length === 0);
  for (const id of ['door', 'armchair', 'loft']) {
    const r = run(VIEWS[id].position, { cutaway: true, apex: 2.7 });
    check('cutaway', `${id} (inside, apex 2.7): everything shows`, r.walls.length === 8 && r.roof.length === 8);
  }
  const off = run(cutawayView(3.3).position, { cutaway: false, apex: 3.3 });
  check('cutaway', 'room.cutaway off: never fades', off.walls.length === 8 && off.roof.length === 8);
}

// ── print ───────────────────────────────────────────────────────────────────
if (args.has('--json')) console.log(JSON.stringify({ deck: fresh.deck, door: fresh.door, window: fresh.window, oldRoof: fresh.oldRoof }, null, 2));
const W = { group: Math.max(...rows.map((r) => r.group.length)), name: Math.max(...rows.map((r) => r.name.length)) };
let last = '';
for (const r of rows) {
  if (r.group !== last) {
    console.log('');
    last = r.group;
  }
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.group.padEnd(W.group)}  ${r.name.padEnd(W.name)}  ${r.detail}`);
}
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed${failed.length ? ` — ${failed.length} FAILED` : ''}`);
process.exit(failed.length ? 1 : 0);
