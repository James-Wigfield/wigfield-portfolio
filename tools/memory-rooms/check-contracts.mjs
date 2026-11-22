#!/usr/bin/env node
/* check-contracts: the scene v2 + building.json contracts agree with themselves.

     node tools/memory-rooms/check-contracts.mjs [--verbose]

   1. Every example (tools/memory-rooms/examples/) and every local work scene validates in JS
      (src/memory-rooms/scene|building/validate.js) AND in the Python mirror (blender/scene_io.py,
      blender/building_io.py); every v1 scene resolves to the legacy wall names.
   2. Broken mutations of the examples fail on BOTH sides, at the same paths, including the path
      the mutation is about.
   3. The geometry agrees: normalised shells (outline, walls, normals, openings, ceiling heights on a
      grid), room frames, exterior loops, stair footprints, plan -> lng/lat (JS vs Python, 1e-6).
   Exit 1 on any failure. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateScene } from '../../src/memory-rooms/scene/validate.js';
import { validateBuilding } from '../../src/memory-rooms/building/validate.js';
import { checkScene } from './check-scene.mjs';
import { ceilingAt, resolveShell, buildingRoomShell } from '../../src/memory-rooms/scene/shell.js';
import { exteriorLoops, planToLngLat, roomFrame, stairFootprint } from '../../src/memory-rooms/building/geometry.js';
import { roomIdFor, sketchToBuilding, validateSketch } from '../../src/memory-rooms/building/sketch.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const EX = path.join(HERE, 'examples');
const WORK = path.join(REPO, 'memory-rooms-work');
const verbose = process.argv.includes('--verbose');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

let pass = 0;
const fails = [];
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass++;
    if (verbose) console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
  }
};

const house = read(path.join(EX, 'house.building.json'));
const scenes = fs
  .readdirSync(EX)
  .filter((f) => f.endsWith('.scene.json'))
  .map((f) => ({ name: `examples/${f}`, value: read(path.join(EX, f)) }));
if (fs.existsSync(WORK)) {
  for (const d of fs.readdirSync(WORK)) {
    const f = path.join(WORK, d, 'scene.json');
    if (fs.existsSync(f)) scenes.push({ name: `work/${d.slice(0, 8)}`, value: read(f) });
  }
}
const buildingFor = (s) => (s.shell?.building ? house : null);
const GRID = [];
for (let x = 0; x <= 16; x += 1.37) for (let z = 0; z <= 6.5; z += 0.91) GRID.push([+x.toFixed(3), +z.toFixed(3)]);

// ── jobs: valid fixtures + mutations ─────────────────────────────────────────
const jobs = [];
for (const s of scenes) jobs.push({ label: `valid ${s.name}`, kind: 'scene', value: s.value, building: buildingFor(s.value), expect: [] });
jobs.push({ label: 'valid examples/house.building.json', kind: 'building', value: house, expect: [] });

const shed = scenes.find((s) => s.name.includes('shed-octagon')).value;
const ware = scenes.find((s) => s.name.includes('warehouse-gable')).value;
const living = scenes.find((s) => s.name.includes('house-living')).value;
const sceneMut = (label, base, fn, expect) => {
  const v = clone(base);
  fn(v);
  jobs.push({ label: `scene: ${label}`, kind: 'scene', value: v, building: buildingFor(v), expect });
};
sceneMut('v1 may not use a polygon outline', shed, (v) => (v.version = 1), ['/shell']);
sceneMut('outline bbox must start at [0, 0]', shed, (v) => (v.shell.outline = v.shell.outline.map(([x, z]) => [x + 1, z])), ['/shell/outline']);
sceneMut('polygon openings name edges, not sides', shed, (v) => {
  delete v.shell.openings[0].edge;
  v.shell.openings[0].wall = 'south';
}, ['/shell/openings/0/wall']);
sceneMut('edge index past the outline', shed, (v) => (v.shell.openings[0].edge = 9), ['/shell/openings/0/edge']);
sceneMut('pyramid needs a peak', shed, (v) => delete v.shell.ceiling.peak, ['/shell/ceiling']);
sceneMut('peak below the eaves', shed, (v) => (v.shell.ceiling.peak = 2.0), ['/shell/ceiling/peak']);
sceneMut('outline and width together', shed, (v) => (v.shell.width = 4.36), ['/shell']);
sceneMut('a bow-tie outline', shed, (v) => (v.shell.outline = [[0, 0], [3, 3], [3, 0], [0, 3]]), ['/shell/outline']);
sceneMut('ridge outside the room', ware, (v) => (v.shell.ceiling.ridgeAt = 20), ['/shell/ceiling/ridgeAt']);
sceneMut('a flat ceiling has no peak', ware, (v) => (v.shell.ceiling = { shape: 'flat', peak: 4 }), ['/shell/ceiling']);
sceneMut('box openings name sides, not edges', ware, (v) => {
  delete v.shell.openings[0].wall;
  v.shell.openings[0].edge = 0;
}, ['/shell/openings/0/edge']);
sceneMut('skillion needs low', ware, (v) => (v.shell.ceiling = { shape: 'skillion', peak: 4.4 }), ['/shell/ceiling']);
sceneMut('a room of a building has no frame', living, (v) => (v.frame = { group: 'home', origin: [0, 0] }), ['']);
sceneMut('a room of a building has no width', living, (v) => (v.shell.width = 4), ['/shell']);
sceneMut('room needs building', living, (v) => delete v.shell.building, ['/shell']);
sceneMut('v1 may not shape a ceiling', ware, (v) => {
  v.version = 1;
}, ['/shell/ceiling']);

const bMut = (label, fn, expect) => {
  const v = clone(house);
  fn(v);
  jobs.push({ label: `building: ${label}`, kind: 'building', value: v, expect });
};
bMut('a shared wall exists once (same nodes)', (v) => v.levels[0].walls.push({ id: 'dup', a: 'a2', b: 'a1' }), ['/levels/0/walls/20']);
bMut('a shared wall exists once (overlap)', (v) => {
  v.levels[0].nodes.push({ id: 'x1', at: [1, 0] }, { id: 'x2', at: [4, 0] });
  v.levels[0].walls.push({ id: 'dup', a: 'x1', b: 'x2' });
}, ['/levels/0/walls/20']);
bMut('a wall to a missing node', (v) => (v.levels[0].walls[3].b = 'nope'), ['/levels/0/walls/3/b']);
bMut('a node on a wall must split it', (v) => v.levels[0].nodes.push({ id: 'mid', at: [3, 0] }), ['/levels/0/walls/0']);
bMut('walls that cross without a node', (v) => {
  v.levels[0].nodes.push({ id: 'p1', at: [2, -1] }, { id: 'p2', at: [2, 1] });
  v.levels[0].walls.push({ id: 'cross', a: 'p1', b: 'p2' });
}, ['/levels/0/walls/20']);
bMut('a room on a missing node', (v) => (v.rooms[0].outline[1] = 'zz'), ['/rooms/0/outline/1']);
bMut('two rooms overlap', (v) => v.rooms.push({ ...clone(v.rooms[0]), id: 'living-copy' }), ['/rooms/10/outline']);
bMut('an opening past its wall', (v) => (v.openings[0].offset = 4.5), ['/openings/0']);
bMut('an opening on a missing wall', (v) => (v.openings[0].wall = 'nope'), ['/openings/0/wall']);
bMut('two openings overlap', (v) => v.openings.push({ id: 'clash', wall: 'g-s2', type: 'window', offset: 2.2, width: 1, height: 1.5 }), ['/openings/20']);
bMut('stairs must go up', (v) => {
  v.stairs[0].from = 'upper';
  v.stairs[0].to = 'ground';
}, ['/stairs/0/to']);
bMut('exterior walls close into a loop', (v) => (v.levels[0].walls[10].exterior = false), ['/levels/0/walls']);
bMut('duplicate room id', (v) => (v.rooms[1].id = 'living'), ['/rooms/1/id']);
bMut('ids have no underscores', (v) => (v.rooms[0].id = 'living_room'), ['/rooms/0/id']);
bMut('wall ids are unique across levels', (v) => (v.levels[1].walls[0].id = 'g-n1'), ['/levels/1/walls/0/id']);
bMut('a spot in two rooms', (v) => {
  v.rooms[0].spotIds = ['00000000-0000-4000-8000-000000000001'];
  v.rooms[1].spotIds = ['00000000-0000-4000-8000-000000000001'];
}, ['/rooms/1/spotIds/0']);
bMut('roof on a missing level', (v) => (v.roof.level = 'attic'), ['/roof/level']);
bMut('an opening may not start inside the wall it meets', (v) => v.openings.push({ id: 'tight', wall: 'g-i1', type: 'door', offset: 0, width: 0.8, height: 2 }), ['/openings/20']);
bMut('an upper floor may not cut into the level below', (v) => (v.levels[1].elevation = 2.8), ['/levels/1/elevation']);
bMut('a room side may not skip a junction node', (v) => (v.rooms[0].outline = ['a1', 'a2', 'a13', 'a12', 'a11']), ['/rooms/0/outline/1']);
bMut('a gable ridge outside the room', (v) => (v.rooms[0].ceiling = { shape: 'gable', peak: 3.6, ridgeAt: 9 }), ['/rooms/0/ceiling/ridgeAt']);

// optional exterior detail (2026-11-22, 12B Fletcher pass 2): outside.rake / outside.panels, stair finish + walls,
// sheet fences, site.features. A house using all of them is valid; each field has a broken case.
const detailed = (v) => {
  v.levels[0].walls[0].outside = {
    finish: 'render',
    color: '#f2f1ec',
    rake: { finish: 'timber', color: '#74462b' },
    panels: [{ offset: 0.5, width: 1.0, sill: 0.4, height: 2.0, finish: 'timber', color: '#74462b' }, { offset: 2.0, width: 0.6, finish: 'stone' }],
  };
  Object.assign(v.stairs[0], { finish: 'tile', walls: 'both', wallColor: '#f2f1ec' });
  v.site.fences = [...(v.site.fences || []), { id: 'colorbond', line: [[0, 0], [2, 0]], kind: 'sheet', color: '#1d1e20' }];
  v.site.features = [
    { id: 'planter', kind: 'ring', at: [1, 1], size: [1.8, 0.45, 1.8], color: '#1d1e20', finish: 'steel' },
    { id: 'stone-1', kind: 'disc', at: [2, 2], size: [0.6, 0.05, 0.6], finish: 'stone' },
    { id: 'post', kind: 'cylinder', at: [3, 2], size: [0.1, 2.4, 0.1] },
    { id: 'beam', kind: 'box', at: [3, 3], y: 2.4, size: [3, 0.2, 0.1], rotY: 90, finish: 'steel' },
    { id: 'ball', kind: 'shrub', at: [4, 3], size: [0.6, 0.5, 0.6] },
    { id: 'letterbox', kind: 'letterbox', at: [5, 3], size: [2, 0.9, 0.5], label: '12B', color: '#1f2022' },
  ];
};
{
  const v = clone(house);
  detailed(v);
  jobs.push({ label: 'valid house with every optional exterior detail', kind: 'building', value: v, expect: [] });
}
const dMut = (label, fn, expect) => bMut(label, (v) => (detailed(v), fn(v)), expect);
dMut('a rake has a facade finish', (v) => (v.levels[0].walls[0].outside.rake.finish = 'glitter'), ['/levels/0/walls/0/outside/rake/finish']);
dMut('a panel may not run past its wall', (v) => (v.levels[0].walls[0].outside.panels[0].offset = 40), ['/levels/0/walls/0/outside/panels/0']);
dMut('a panel needs a finish', (v) => delete v.levels[0].walls[0].outside.panels[1].finish, ['/levels/0/walls/0/outside/panels/1']);
dMut('a stair finish from the list', (v) => (v.stairs[0].finish = 'glass'), ['/stairs/0/finish']);
dMut('stair walls from the list', (v) => (v.stairs[0].walls = 'front'), ['/stairs/0/walls']);
dMut('a stair wall colour is a hex', (v) => (v.stairs[0].wallColor = 'white'), ['/stairs/0/wallColor']);
dMut('a fence kind from the list', (v) => (v.site.fences.at(-1).kind = 'wattle'), [`/site/fences/${house.site.fences.length}/kind`]);
dMut('feature ids are unique', (v) => (v.site.features[1].id = 'planter'), ['/site/features/1/id']);
dMut('a feature kind from the list', (v) => (v.site.features[0].kind = 'statue'), ['/site/features/0/kind']);
dMut('a feature size is [w, h, d]', (v) => (v.site.features[0].size = [1.8, 0.45]), ['/site/features/0/size']);
dMut('a feature label is short', (v) => (v.site.features[5].label = 'TWELVE B ST'), ['/site/features/5/label']);

// two small buildings for the reviewer's edge cases (2026-11-21)
const box = (id, nodes, walls, rooms) => ({
  version: 1,
  title: id,
  levels: [{ id: 'g', elevation: 0, height: 2.6, nodes: nodes.map(([nid, x, z]) => ({ id: nid, at: [x, z] })), walls }],
  rooms,
});
const loop = (ids, t) => ids.map((a, i) => ({ id: `w${i + 1}`, a, b: ids[(i + 1) % ids.length], exterior: true, ...(t?.[i] ? { thickness: t[i] } : {}) }));
// every corner of each room on the other's sides, a 1 m strip shared: only the cut-side probe sees it
// a fixed room origin moves the room frame (both sides), so re-tracing never shifts the furniture
{
  const v = clone(house);
  v.rooms[0].origin = [-0.5, -0.25];
  jobs.push({ label: 'valid room with a fixed origin', kind: 'building', value: v, expect: [] });
}
const strip = box(
  'strip',
  [['p1', 0, 0], ['p2', 3, 0], ['p3', 4, 0], ['p4', 6, 0], ['p5', 6, 4], ['p6', 4, 4], ['p7', 3, 4], ['p8', 0, 4]],
  loop(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
  [
    { id: 'a', name: 'A', level: 'g', outline: ['p1', 'p2', 'p3', 'p6', 'p7', 'p8'] },
    { id: 'b', name: 'B', level: 'g', outline: ['p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
  ],
);
jobs.push({ label: 'building: a strip overlap (every corner on the other room)', kind: 'building', value: strip, expect: ['/rooms/1/outline'] });
// nearly parallel neighbours of different thickness: the inset corner must stay a small step
const skew = box('skew', [['a', 0, 0], ['b', 10, 0], ['c', 10, 4], ['j', 3, 4.01], ['d', 0, 4]], loop(['a', 'b', 'c', 'j', 'd'], [0, 0, 0, 0.1, 0]), [
  { id: 'r', name: 'R', level: 'g', outline: ['a', 'b', 'c', 'j', 'd'] },
]);
jobs.push({ label: 'valid near-parallel walls of two thicknesses', kind: 'building', value: skew, expect: [] });

// ── run both sides ───────────────────────────────────────────────────────────
const py = process.env.PYTHON || 'python';
const pyOut = JSON.parse(
  execFileSync(py, [path.join(HERE, 'blender', 'contract_dump.py')], {
    input: JSON.stringify(jobs.map((j) => ({ kind: j.kind, value: j.value, building: j.building || null, samples: GRID }))),
    maxBuffer: 64 * 1024 * 1024,
  }).toString(),
);

const near = (a, b, tol = 1e-6) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => near(x, b[i], tol));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Object.keys(a).every((k) => near(a[k], b[k], tol));
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol || (!Number.isFinite(a) && !Number.isFinite(b));
  return a === b;
};
const summary = (sh) =>
  sh && {
    kind: sh.kind,
    outline: sh.outline,
    box: sh.box,
    height: sh.height,
    top: sh.top,
    walls: sh.walls.map((w) => ({ id: w.id, node: w.node, a: w.a, b: w.b, out: w.out })),
    openings: sh.openings.map((o) => ({ wall: o.wall, from: o.from, to: o.to, sill: o.sill, head: o.head })),
    ceiling: GRID.map(([x, z]) => ceilingAt(sh, x, z)),
  };

console.log('check-contracts');
jobs.forEach((job, i) => {
  const p = pyOut[i];
  const js = job.kind === 'scene' ? validateScene(job.value).errors.map((e) => e.path) : validateBuilding(job.value).errors.map((e) => e.path);
  const jsSet = [...new Set(js)].sort();
  const pySet = [...new Set(p.errors)].sort();
  if (!job.expect.length) {
    ok(!jsSet.length, `${job.label}: JS valid`, jsSet.join(', '));
    ok(!pySet.length, `${job.label}: Python valid`, pySet.join(', '));
  } else {
    for (const e of job.expect) {
      ok(jsSet.includes(e), `${job.label}: JS flags ${e || '/'}`, `got ${jsSet.join(', ') || 'nothing'}`);
      ok(pySet.includes(e), `${job.label}: Python flags ${e || '/'}`, `got ${pySet.join(', ') || 'nothing'}`);
    }
  }
  ok(JSON.stringify(jsSet) === JSON.stringify(pySet), `${job.label}: JS and Python agree on the paths`, `JS [${jsSet}] vs Py [${pySet}]`);

  if (job.expect.length || jsSet.length) return;
  if (job.kind === 'scene' && job.value.kind === 'interior') {
    const sh = resolveShell(job.value, job.building);
    ok(near(summary(sh), p.shell), `${job.label}: normalised shell matches Python`);
    if ((job.value.version ?? 1) === 1) ok(sh.walls.every((w) => w.node === `wall_${w.id}`), `${job.label}: v1 keeps wall_<side> names`);
  }
  if (job.kind === 'building') {
    const b = job.value;
    ok(near(Object.fromEntries(b.levels.map((l) => [l.id, exteriorLoops(b, l.id)])), p.loops), `${job.label}: exterior loops match Python`);
    ok(near(Object.fromEntries(b.rooms.map((r) => [r.id, roomFrame(b, r).origin])), p.frames), `${job.label}: room frames match Python`);
    ok(near((b.stairs || []).map(stairFootprint), p.stairs), `${job.label}: stair footprints match Python`);
    if (b.geo) ok(near(planToLngLat(b.geo, [10, -5]), p.geo, 1e-9), `${job.label}: plan -> lng/lat matches Python`);
    for (const r of b.rooms) ok(near(summary(buildingRoomShell(b, r.id)), p.shells[r.id]), `${job.label}: room ${r.id} shell matches Python`);
  }
});

// ── facts the rest of the system leans on ────────────────────────────────────
{
  const b = house;
  const lv = buildingRoomShell(b, 'living');
  ok(near(lv.box.min, [0.125, 0.125]) && near(lv.box.max, [5.95, 4.95]), 'room frame: living inner faces at half a wall thickness from the centreline box');
  const k = buildingRoomShell(b, 'kitchen');
  ok(k.outline.length === 6, 'a step where an exterior wall meets a thinner one in line (kitchen east side)', `${k.outline.length} corners`);
  const [lng, lat] = planToLngLat({ lat: 0, lng: 0, north: 90 }, [0, -111.32]);
  ok(near([lng, lat], [0.001, 0], 1e-6), 'geo.north = 90: plan up points east');
  const shedShell = resolveShell(shed);
  ok(near(ceilingAt(shedShell, 2.18, 2.18), 2.68, 1e-9) && near(ceilingAt(shedShell, 0, 2.18), 2.25, 1e-9), 'pyramid: peak at the apex, eaves on a flat');
  const wareShell = resolveShell(ware);
  ok(near(ceilingAt(wareShell, 7.67, 3), 5.28) && near(ceilingAt(wareShell, 0, 3), 3.46) && near(ceilingAt(wareShell, 15.95, 3), 3.4), 'gable: ridge and both eaves');
  ok(wareShell.walls.find((w) => w.id === 'north').node === 'wall__north', 'v2 box walls are wall__<side>');
}

// ── the phone's sketch plan → a first building.json ─────────────────────────
{
  const sketch = {
    version: 1,
    levels: [{ id: 'ground', name: 'Ground' }, { id: 'upper', name: 'Upstairs' }],
    rooms: [
      { id: 'living', name: 'Living', level: 'ground', rect: [0, 0, 6, 5] },
      { id: 'kitchen', name: 'Kitchen', level: 'ground', rect: [6, 0, 5, 3.5] },
      { id: 'hall', name: 'Hall', level: 'ground', rect: [6, 3.5, 5, 4.5] },
      { id: 'bath', name: 'Bath', level: 'ground', rect: [0, 5, 3, 3] },
      { id: 'study', name: 'Study', level: 'ground', rect: [3, 5, 3, 3] },
      { id: 'garage', name: 'Garage', level: 'ground', rect: [11, 2, 4, 6] },
      { id: 'bed1', name: 'Bed 1', level: 'upper', rect: [0, 0, 5.5, 4.8] },
      { id: 'laundry', name: 'Laundry', level: 'upper', mark: { photo: 1, u: 0.4, v: 0.6 } },
    ],
  };
  ok(validateSketch(sketch).ok, 'sketch: the example sketch is valid', JSON.stringify(validateSketch(sketch).errors));
  const b = sketchToBuilding(sketch, { title: 'Sketched', geo: { lat: -31.95, lng: 115.86 } });
  const v = validateBuilding(b);
  ok(v.ok, 'sketch -> building.json validates (walls once, split at every junction, exterior loop closes)', JSON.stringify(v.errors.slice(0, 3)));
  const g = b.levels[0];
  ok(g.walls.length === 20 && g.walls.filter((w) => w.exterior).length === 11, 'sketch -> building: ground has 20 walls, 11 of them exterior', `${g.walls.length} walls, ${g.walls.filter((w) => w.exterior).length} exterior`);
  const living = b.rooms.find((r) => r.id === 'living');
  ok(living.outline.length === 6, 'sketch -> building: living picks up the T-junction nodes on its sides', living.outline.join(' '));
  ok(/Laundry/.test(b.notes || ''), 'sketch -> building: an undrawn room is listed in notes');
  const bad = clone(sketch);
  bad.rooms[1].rect = [5, 0, 5, 3.5];
  ok(validateSketch(bad).errors.some((e) => e.path === '/rooms/1/rect'), 'sketch: overlapping drawn rooms are refused');
  bad.rooms[2].level = 'attic';
  ok(validateSketch(bad).errors.some((e) => e.path === '/rooms/2/level'), 'sketch: a room on a missing level is refused');
  ok(roomIdFor('Bed 2', ['bed-2']) === 'bed-2-2' && roomIdFor('Kitchen') === 'kitchen' && roomIdFor('Ñandú Room') === 'nandu-room', 'sketch: room ids from names');
  const two = (rect) => ({ version: 1, levels: [{ id: 'g', name: 'G' }], rooms: [{ id: 'a', name: 'A', level: 'g', rect: [0, 0, 4, 4] }, { id: 'b', name: 'B', level: 'g', rect }] });
  ok(validateSketch(two([4, 4, 3, 3])).errors.some((e) => /corner/.test(e.message)), 'sketch: touching only at a corner is refused');
  ok(validateSketch(two([4.01, 0, 3, 3])).errors.some((e) => /1 cm/.test(e.message)), 'sketch: a 1 cm gap is refused');
  ok(validateSketch(two([3.99, 0, 3, 3])).errors.some((e) => /overlaps/.test(e.message)), 'sketch: a 1 cm overlap is refused');
  ok(validateSketch(two([4, 1, 3, 2])).ok && validateBuilding(sketchToBuilding(two([4, 1, 3, 2]))).ok, 'sketch: rooms sharing part of a side are fine and build');
  ok(validateSketch(two([4.5, 0, 3, 3])).ok, 'sketch: rooms 50 cm apart are fine');
}

// ── check-scene on v2 shells: the reviewer's cases ───────────────────────────
{
  const L = clone(shed);
  L.shell.outline = [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]];
  L.shell.ceiling = { color: '#efede8' };
  L.shell.openings = [];
  L.objects = [{ id: 'crate', kit: 'box', size: [4.2, 0.9, 1.3], at: [3, 0, 3], rotY: 45 }];
  L.lights = [];
  L.pins = [];
  L.cameras = [{ photo: 1, pos: [1, 1.5, 1], look: [3, 0.5, 3], fov: 70, aspect: 0.75 }];
  const r = checkScene(L);
  ok(r.errors.some((e) => /corner at \[3,3\]/.test(e)), "check-scene: an L's inside corner running into an object is an error", r.errors.join(' | '));
  const lv = clone(living);
  lv.shell.room = 'nope';
  const r2 = checkScene(lv, { building: house });
  ok(r2.errors.some((e) => /no room "nope"/.test(e)), 'check-scene: a missing room says so (not "give its building.json")', r2.errors.join(' | '));
  const broken = clone(house);
  delete broken.rooms[0].outline;
  let r3;
  try {
    r3 = checkScene(living, { building: broken });
  } catch (e) {
    r3 = { errors: [`threw ${e.message}`] };
  }
  ok(r3.errors.some((e) => e.startsWith('building /rooms/0')), 'check-scene: a broken building reports its errors (no crash)', r3.errors.join(' | '));
  const sk = buildingRoomShell(skew, 'r');
  ok(sk.outline.every(([x, z]) => x > -0.2 && x < 10.2 && z > -0.2 && z < 4.2), 'inset: near-parallel walls of two thicknesses stay inside the room', JSON.stringify(sk.outline));
}

console.log(fails.length ? `\n${fails.length} failed, ${pass} passed` : `\n${pass} passed`);
process.exit(fails.length ? 1 : 0);
