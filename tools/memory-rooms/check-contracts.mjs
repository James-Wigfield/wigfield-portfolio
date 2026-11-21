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
}

console.log(fails.length ? `\n${fails.length} failed, ${pass} passed` : `\n${pass} passed`);
process.exit(fails.length ? 1 : 0);
