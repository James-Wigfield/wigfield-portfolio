#!/usr/bin/env node
/* building-selftest: the whole-building pipeline end to end on the synthetic two-level house
   (tools/memory-rooms/examples/house.building.json + its living room's scene), in a scratch work folder.

     node tools/memory-rooms/building-selftest.mjs [--samples 24] [--atlas 1024] [--keep] [--check-only]

   1. build_building.py → memory-rooms-work/_building-selftest/levels/<id>/room.blend (+ exterior/)
   2. bake.mjs on each → room.glb; copied to level-<id>.glb and exterior.glb at the work folder's root; levels bake
      with --empty too → level-<id>-empty.glb (and a copy beside each slice, as build-building.mjs does)
   3. slice_rooms.py on each baked level → spots/<room>/room.glb (the living room is furnished)
   4. checks (GLB JSON, no browser):
      - every wall of a level is ONE node `wall__<id>` in that level's GLB, none missing, none extra, each with
        extras mrWall {id, normal (unit), exterior, rooms}; floors and ceilings per room; the stair; each
        furnishing piece its own node `room__<room>__obj__<id>`; the level sits at its elevation;
      - exterior.glb has the roof and the ground (+ site areas);
      - mrKind extras on every node (furniture exactly on room__*__obj__* / obj__*); the empty state's GLB has a
        textured baked_atlas<i> for every atlas a structural mesh uses (levels and the slice);
      - the living room's slice: exactly its walls, its floor, ceiling and pieces renamed obj__<id>, in its room
        frame (near the origin), every wall's normal pointing OUT of the living room (= the normalised shell's).
   Exit 1 on any failure. --check-only re-runs 4 on what is there. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BLENDER, REPO, WORK } from './lib/api.mjs';
import { resolveShell } from '../../src/memory-rooms/scene/shell.js';
import { wallLines } from '../../src/memory-rooms/building/geometry.js';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DIR = path.join(WORK, '_building-selftest');
const BID = '00000000-0000-4000-8000-00000000b001';
const EX = path.join(REPO, 'tools/memory-rooms/examples');
const building = JSON.parse(fs.readFileSync(path.join(EX, 'house.building.json'), 'utf8'));
const living = JSON.parse(fs.readFileSync(path.join(EX, 'house-living.v2.scene.json'), 'utf8'));

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass++;
    console.log(`✓ ${label}`);
  } else {
    fail++;
    console.log(`✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
};
const run = (label, cmd, argv) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  fs.mkdirSync(path.join(DIR, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'logs', `${label.replace(/[^a-z0-9]+/gi, '-')}.log`), out);
  const good = r.status === 0;
  console.log(`${good ? '✓' : '✗'} ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!good) {
    console.log(out.split(/\r?\n/).slice(-25).join('\n'));
    process.exit(1);
  }
  return out;
};

if (!args.includes('--check-only')) {
  if (!args.includes('--keep')) fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIR, 'spots', 'living'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'building.json'), JSON.stringify(building, null, 1));
  fs.writeFileSync(path.join(DIR, 'spots', 'living', 'scene.json'), JSON.stringify(living, null, 1));
  const bb = path.join(REPO, 'tools/memory-rooms/blender/build_building.py');
  run('build_building', BLENDER, ['-b', '--factory-startup', '--python', bb, '--', '--building', path.join(DIR, 'building.json'), '--out', DIR, '--id', BID, '--scenes', path.join(DIR, 'spots'), '--samples', opt('--samples', '24'), '--res', '700']);
  const bake = path.join(REPO, 'tools/memory-rooms/bake.mjs');
  for (const lv of building.levels) {
    const ld = path.join(DIR, 'levels', lv.id);
    run(`bake level ${lv.id}`, process.execPath, [bake, ld, '--samples', opt('--samples', '24'), '--atlas', opt('--atlas', '1024'), '--empty']);
    fs.copyFileSync(path.join(ld, 'room.glb'), path.join(DIR, `level-${lv.id}.glb`));
    const empty = path.join(ld, 'room-empty.glb');
    fs.rmSync(path.join(DIR, `level-${lv.id}-empty.glb`), { force: true });
    if (fs.existsSync(empty)) fs.copyFileSync(empty, path.join(DIR, `level-${lv.id}-empty.glb`));
    const sl = path.join(REPO, 'tools/memory-rooms/blender/slice_rooms.py');
    const out = run(`slice level ${lv.id}`, BLENDER, ['-b', path.join(ld, 'room-baked.blend'), '--python', sl, '--', '--building', path.join(DIR, 'building.json'), '--id', BID, '--scenes', path.join(DIR, 'spots')]);
    const m = /SLICES (\[.*\])/.exec(out);
    for (const x of m ? JSON.parse(m[1]) : []) if (fs.existsSync(empty)) fs.copyFileSync(empty, path.join(path.dirname(x.glb), 'room-empty.glb'));
  }
  run('bake exterior', process.execPath, [bake, path.join(DIR, 'exterior'), '--samples', opt('--samples', '24'), '--atlas', opt('--atlas', '1024')]);
  fs.copyFileSync(path.join(DIR, 'exterior', 'room.glb'), path.join(DIR, 'exterior.glb'));
}

/** The JSON chunk of a GLB, and world-ish bounds of its top-level nodes (translation + accessor min/max). */
function readGlb(file) {
  const buf = fs.readFileSync(file);
  const len = buf.readUInt32LE(12);
  const g = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const nodes = g.nodes || [];
  const childOf = new Set(nodes.flatMap((n) => n.children || []));
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const visit = (i, t) => {
    const n = nodes[i];
    const tr = n.translation || [0, 0, 0];
    const at = [t[0] + tr[0], t[1] + tr[1], t[2] + tr[2]];
    if (n.mesh != null) {
      for (const p of g.meshes[n.mesh].primitives) {
        const a = g.accessors[p.attributes.POSITION];
        for (let k = 0; k < 3; k++) {
          bounds.min[k] = Math.min(bounds.min[k], at[k] + a.min[k]);
          bounds.max[k] = Math.max(bounds.max[k], at[k] + a.max[k]);
        }
      }
    }
    for (const c of n.children || []) visit(c, at);
  };
  nodes.forEach((_, i) => !childOf.has(i) && visit(i, [0, 0, 0]));
  return { g, nodes, names: nodes.map((n) => n.name || ''), top: nodes.filter((_, i) => !childOf.has(i)), bounds };
}

/** mrKind on every node, furniture exactly on the scene objects' nodes; returns the problems. */
function kindProblems(g) {
  const furn = (name) => /^obj__|__obj__/.test(name || '');
  return (g.nodes || []).filter((n) => {
    const k = n.extras?.mrKind;
    return k !== (furn(n.name) ? 'furniture' : 'structure');
  }).map((n) => `${n.name}=${n.extras?.mrKind}`);
}

/** Every baked_atlas<i> a STRUCTURAL mesh uses must have a textured twin in the empty GLB. */
function emptyProblems(g, emptyFile) {
  if (!fs.existsSync(emptyFile)) return [`no ${path.basename(emptyFile)}`];
  const e = readGlb(emptyFile).g;
  const have = new Set((e.materials || []).filter((m) => m.pbrMetallicRoughness?.baseColorTexture || m.emissiveTexture).map((m) => m.name));
  const need = new Set();
  for (const n of g.nodes || []) {
    if (n.mesh == null || n.extras?.mrKind !== 'structure') continue;
    for (const p of g.meshes[n.mesh].primitives) {
      const name = g.materials?.[p.material]?.name || '';
      if (/^baked_atlas\d+$/.test(name)) need.add(name);
    }
  }
  const extra = (e.meshes || []).flatMap((m) => m.primitives).length;
  const out = [...need].filter((x) => !have.has(x)).map((x) => `missing ${x}`);
  if (!need.size) out.push('no structural baked_atlas material found');
  if (extra > have.size) out.push(`${extra} primitives (expected one triangle per atlas)`);
  return out;
}

const isUnit = (n) => Array.isArray(n) && n.length === 2 && Math.abs(Math.hypot(n[0], n[1]) - 1) < 1e-3;

for (const lv of building.levels) {
  const file = path.join(DIR, `level-${lv.id}.glb`);
  if (!fs.existsSync(file)) {
    ok(false, `level ${lv.id}: level-${lv.id}.glb exists`);
    continue;
  }
  const { g, nodes, names, bounds } = readGlb(file);
  const kp = kindProblems(g);
  ok(kp.length === 0, `level ${lv.id}: every node has mrKind (furniture = room__*__obj__*)`, kp.slice(0, 8).join(', '));
  const furnished = nodes.some((n) => n.extras?.mrKind === 'furniture');
  const emptyFile = path.join(DIR, `level-${lv.id}-empty.glb`);
  if (furnished) {
    const ep = emptyProblems(g, emptyFile);
    ok(ep.length === 0, `level ${lv.id}: level-${lv.id}-empty.glb has every structural atlas`, ep.join(', '));
  } else {
    ok(!fs.existsSync(emptyFile), `level ${lv.id}: no furniture, so no empty state (no level-${lv.id}-empty.glb)`);
  }
  const want = wallLines(building, lv.id).map((w) => w.id).sort();
  const walls = nodes.filter((n) => /^wall__[a-z0-9-]+$/.test(n.name || ''));
  const got = walls.map((n) => n.name.slice(6)).sort();
  ok(JSON.stringify(got) === JSON.stringify(want), `level ${lv.id}: every wall exactly once (${want.length})`, `got ${got.join(',')}`);
  const badExtras = walls.filter((n) => !(n.extras?.mrWall && isUnit(n.extras.mrWall.normal) && typeof n.extras.mrWall.exterior === 'boolean' && n.extras.mrWall.rooms));
  ok(badExtras.length === 0, `level ${lv.id}: each wall carries mrWall {normal, exterior, rooms}`, badExtras.map((n) => n.name).join(', '));
  const rooms = building.rooms.filter((r) => r.level === lv.id).map((r) => r.id);
  const missing = rooms.filter((r) => !names.includes(`floor__${r}`) || !names.includes(`ceiling__${r}`));
  ok(missing.length === 0, `level ${lv.id}: a floor and a ceiling per room (${rooms.length})`, missing.join(', '));
  for (const s of (building.stairs || []).filter((x) => x.from === lv.id)) ok(names.includes(`stair__${s.id}`), `level ${lv.id}: stair ${s.id}`);
  const room = building.rooms.find((r) => r.id === living.shell.room);
  if (room.level === lv.id) {
    const pieces = living.objects.filter((o) => !names.includes(`room__${room.id}__obj__${o.id}`)).map((o) => o.id);
    ok(pieces.length === 0, `level ${lv.id}: each living-room piece is its own node room__living__obj__<id> (${living.objects.length})`, pieces.join(', '));
  }
  // glTF is y-up: the level's floors sit at its elevation
  const floorTop = Math.max(...nodes.filter((n) => /^floor__/.test(n.name || '') && n.name !== 'floor__slab').map((n) => n.translation?.[1] ?? 0));
  ok(Math.abs(floorTop - lv.elevation) < 0.01, `level ${lv.id}: sits at its elevation ${lv.elevation} m`, `floors at ${floorTop}`);
  // walls under a skillion roof part on this level rise to its plane (wall__<id>__rake, DECISIONS 179): allow its rise
  const over = building.roof?.overhang ?? 0.4;
  const rake = Math.max(0, ...(building.roof?.parts || []).filter((p) => p.level === lv.id && (p.type || building.roof.type) === 'skillion').map((p) => {
    const xs = p.outline.map((q) => q[0]), zs = p.outline.map((q) => q[1]);
    const low = p.low || building.roof.low || 'south';
    const span = (['east', 'west'].includes(low) ? Math.max(...xs) - Math.min(...xs) : Math.max(...zs) - Math.min(...zs)) + 2 * over;
    return Math.tan(((p.pitch ?? building.roof.pitch ?? 25) * Math.PI) / 180) * span;
  }));
  ok(bounds.min[1] > lv.elevation - 0.5 && bounds.max[1] < lv.elevation + lv.height + rake + 0.5, `level ${lv.id}: nothing above or below the level`, `${bounds.min[1].toFixed(2)}..${bounds.max[1].toFixed(2)}`);
  const hubs = names.filter((n) => /^wall__[a-z0-9-]+__hub__[a-z0-9-]+$/.test(n));
  ok(hubs.length > 0, `level ${lv.id}: junction hubs are their own nodes (wall__<owner>__hub__<node>)`, `${hubs.length}`);
  // no see-through band between storeys: this level's slab reaches down to the walls of the level below
  const under = building.levels.filter((x) => x.elevation < lv.elevation).sort((a, c) => c.elevation - a.elevation)[0];
  if (under) {
    const slabNode = nodes.find((n) => n.name === 'floor__slab');
    const meshMin = slabNode ? readGlb(file).g.accessors[readGlb(file).g.meshes[slabNode.mesh].primitives[0].attributes.POSITION].min[1] + (slabNode.translation?.[1] || 0) : Infinity;
    ok(meshMin <= under.elevation + under.height + 0.01, `level ${lv.id}: its slab closes the gap down to the walls below (${under.elevation + under.height} m)`, `slab bottom ${meshMin.toFixed(2)}`);
  }
}

{
  const file = path.join(DIR, 'exterior.glb');
  const ex = fs.existsSync(file) ? readGlb(file) : null;
  ok(ex && ex.names.includes('roof') && ex.names.includes('ground'), 'exterior.glb: roof + ground');
  if (ex) {
    const areas = (building.site?.areas || []).filter((a) => !ex.names.includes(`site__${a.id}`)).map((a) => a.id);
    ok(areas.length === 0, 'exterior.glb: every site area', areas.join(', '));
    const kp = kindProblems(ex.g);
    ok(kp.length === 0 && ex.nodes.every((n) => n.extras?.mrKind === 'structure'), 'exterior.glb: every node mrKind structure', kp.join(', '));
    const top = building.levels.reduce((m, l) => Math.max(m, l.elevation + l.height), 0);
    ok(ex.bounds.max[1] > top + 0.5, 'exterior.glb: the roof rises above the top level', `${ex.bounds.max[1].toFixed(2)} vs ${top}`);
  }
}

{
  const file = path.join(DIR, 'spots', 'living', 'room.glb');
  const sl = fs.existsSync(file) ? readGlb(file) : null;
  ok(Boolean(sl), 'the living room has its slice room.glb');
  if (sl) {
    const sh = resolveShell(living, building);
    const want = sh.walls.filter((w) => !w.open).map((w) => w.id).sort();
    const walls = sl.nodes.filter((n) => /^wall__[a-z0-9-]+$/.test(n.name || ''));
    const got = walls.map((n) => n.name.slice(6)).sort();
    ok(JSON.stringify(got) === JSON.stringify(want), `slice: exactly the living room's walls (${want.length})`, `got ${got.join(',')}`);
    const wrong = walls.filter((n) => {
      const w = sh.walls.find((x) => x.id === n.name.slice(6));
      const nrm = n.extras?.mrWall?.normal;
      return !w || !nrm || Math.abs(nrm[0] - w.out[0]) > 1e-3 || Math.abs(nrm[1] - w.out[1]) > 1e-3;
    });
    ok(wrong.length === 0, "slice: each wall's normal points out of the living room", wrong.map((n) => `${n.name} ${JSON.stringify(n.extras?.mrWall?.normal)}`).join(', '));
    const pieces = living.objects.filter((o) => !sl.names.includes(`obj__${o.id}`)).map((o) => o.id);
    ok(pieces.length === 0, 'slice: pieces renamed obj__<id>', pieces.join(', '));
    const kp = kindProblems(sl.g);
    ok(kp.length === 0 && living.objects.every((o) => sl.nodes.find((n) => n.name === `obj__${o.id}`)?.extras?.mrKind === 'furniture'), 'slice: mrKind on every node, its pieces furniture', kp.slice(0, 8).join(', '));
    const ep = emptyProblems(sl.g, path.join(DIR, 'spots', 'living', 'room-empty.glb'));
    ok(ep.length === 0, "slice: room-empty.glb beside it covers every structural atlas it uses", ep.join(', '));
    ok(sl.names.includes('floor__living') && sl.names.includes('ceiling__living'), 'slice: its floor and ceiling');
    const room = building.rooms.find((r) => r.id === 'living');
    const hubNodes = sl.names.filter((n) => /__hub__/.test(n)).map((n) => n.split('__hub__')[1]);
    ok(hubNodes.length > 0 && hubNodes.every((n) => room.outline.includes(n)), "slice: the junction hubs at its corners, and only those", hubNodes.join(','));
    const others = sl.names.filter((n) => /^(floor|ceiling)__/.test(n) && !/living/.test(n));
    ok(others.length === 0, "slice: no other room's floor or ceiling", others.join(', '));
    // the room frame: x, z start near 0 (the walls' half thickness out), y at the floor
    const bx = sh.box;
    ok(Math.abs(sl.bounds.min[0] - bx.min[0]) < 0.4 && Math.abs(sl.bounds.min[2] - bx.min[1]) < 0.4 && Math.abs(sl.bounds.min[1]) < 0.2, 'slice: in the room frame', `min ${sl.bounds.min.map((v) => v.toFixed(2))}`);
  }
}

// ── every level in one plan: levelPlanLayout (CONTRACTS.md 6.5) on 12B Fletcher and a synthetic 3-level place ──
{
  const check = (label, cond) => ok(cond, label);
  const { levelPlanLayout, levelAtLayoutPoint, levelFootprint } = await import('../../src/memory-rooms/building/planLayout.js');
  const inside = (box, cell) => box.min[0] >= cell.min[0] - 1e-9 && box.min[1] >= cell.min[1] - 1e-9 && box.max[0] <= cell.max[0] + 1e-9 && box.max[1] <= cell.max[1] + 1e-9;
  const apart = (lay) => lay.levels.every((l, i) => i === 0 || (lay.direction === 'row' ? l.cell.min[0] - lay.levels[i - 1].cell.max[0] : l.cell.min[1] - lay.levels[i - 1].cell.max[1]) >= lay.gap - 1e-9);
  const layoutOk = (b, label) => {
    const row = levelPlanLayout(b, 1.6);
    const col = levelPlanLayout(b, 0.7);
    const order = [...b.levels].sort((p, q) => p.elevation - q.elevation).map((l) => l.id);
    check(`${label}: lowest first, a row when wide and a column when portrait`, row.direction === 'row' && col.direction === 'column' && row.levels.map((l) => l.id).join() === order.join() && col.levels.map((l) => l.id).join() === order.join());
    check(`${label}: levels only move (same scale, same north): each footprint is its own plus the offset`, row.levels.every((l) => {
      const fp = levelFootprint(b, l.id);
      return Math.abs(l.box.min[0] - fp.min[0] - l.offset[0]) < 1e-9 && Math.abs(l.box.max[1] - fp.max[1] - l.offset[1]) < 1e-9;
    }));
    check(`${label}: every level inside its cell, cells a fixed gap apart, registered on the plan origin`, [row, col].every((lay) => lay.levels.every((l) => inside(l.box, l.cell)) && apart(lay) && lay.levels.every((l, i) => (lay.direction === 'row' ? l.offset[1] === 0 && Math.abs(l.offset[0] - i * lay.pitch) < 1e-9 : l.offset[0] === 0 && Math.abs(l.offset[1] - i * lay.pitch) < 1e-9))));
    const last = row.levels[row.levels.length - 1];
    const p = [(last.box.min[0] + last.box.max[0]) / 2, (last.box.min[1] + last.box.max[1]) / 2];
    const back = levelAtLayoutPoint(row, p);
    check(`${label}: a point in the top level's cell maps back to that level and its plan point`, back?.id === last.id && Math.abs(back.plan[0] - (p[0] - last.offset[0])) < 1e-9 && Math.abs(back.plan[1] - p[1]) < 1e-9);
    if (row.levels.length > 1) {
      const gap = [row.levels[0].cell.max[0] + row.gap / 2, (row.levels[0].cell.min[1] + row.levels[0].cell.max[1]) / 2];
      check(`${label}: a point in the gap between cells is no level`, levelAtLayoutPoint(row, gap) === null);
    }
    return row;
  };
  const fletcherFile = path.join(WORK, 'b-001c25b7-a2bd-4d71-a476-739b941f8f69', 'building.json');
  if (fs.existsSync(fletcherFile)) layoutOk(JSON.parse(fs.readFileSync(fletcherFile, 'utf8')), 'plan layout, 12B Fletcher (2 levels)');
  const rect = (id, [x0, z0, x1, z1]) => ({
    nodes: [
      { id: `${id}-a`, at: [x0, z0] },
      { id: `${id}-b`, at: [x1, z0] },
      { id: `${id}-c`, at: [x1, z1] },
      { id: `${id}-d`, at: [x0, z1] },
    ],
    walls: ['ab', 'bc', 'cd', 'da'].map((k) => ({ id: `${id}-w${k}`, a: `${id}-${k[0]}`, b: `${id}-${k[1]}`, exterior: true })),
  });
  // three footprints of different sizes, listed out of order (the layout sorts by elevation)
  const three = {
    version: 1,
    title: 'synthetic 3-level',
    levels: [
      { id: 'roof-deck', name: 'Roof deck', elevation: 6, height: 2.4, ...rect('r', [2, 1, 6, 5]) },
      { id: 'ground', name: 'Ground', elevation: 0, height: 2.7, ...rect('g', [0, 0, 10, 8]) },
      { id: 'first', name: 'First', elevation: 3, height: 2.7, ...rect('f', [1, -1, 8, 8]) },
    ],
    rooms: [],
    openings: [],
  };
  const lay3 = layoutOk(three, 'plan layout, synthetic 3 levels');
  check('plan layout, synthetic 3 levels: the cell is the union of every footprint (the first floor sticks out north)', lay3.levels[0].cell.min[1] < -1 + 1e-9 && lay3.levels.length === 3);
}

console.log(`\nbuilding-selftest: ${pass} passed, ${fail} failed  (${DIR})`);
process.exit(fail ? 1 : 0);
