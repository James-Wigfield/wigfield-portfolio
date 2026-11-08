#!/usr/bin/env node
/* score: how far is a blind reconstruction from the synthetic ground truth?

     node tools/memory-rooms/selftest/score.mjs <spotId> [--truth tools/memory-rooms/selftest/truth/truth.scene.json]

   The modeller picks its own "north", so the truth is tried in all four 90°
   rotations of the room and the best-matching frame is used. Objects are matched
   greedily by distance (a kit mismatch costs 1 m). Writes selftest/results.json
   and prints a table. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { workDir } from '../lib/api.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--truth'));
const truthPath = args.includes('--truth') ? args[args.indexOf('--truth') + 1] : path.join(HERE, 'truth', 'truth.scene.json');
if (!id) {
  console.error('usage: node tools/memory-rooms/selftest/score.mjs <spotId>');
  process.exit(2);
}
const dir = workDir(id);
const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
const recon = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));

const W = truth.shell.width;
const D = truth.shell.depth;
const RAD = Math.PI / 180;

// Map a truth point / direction into a frame rotated by k × 90° (clockwise from above).
function rotPoint([x, y, z], k) {
  switch (k) {
    case 1: return [D - z, y, x];
    case 2: return [W - x, y, D - z];
    case 3: return [z, y, W - x];
    default: return [x, y, z];
  }
}
const rotDims = (k) => (k % 2 ? { width: D, depth: W } : { width: W, depth: D });
const WALLS = ['north', 'east', 'south', 'west']; // clockwise
const rotWall = (wall, k) => WALLS[(WALLS.indexOf(wall) + k) % 4];
const front = (rotY) => [Math.sin((rotY || 0) * RAD), Math.cos((rotY || 0) * RAD)]; // (dx, dz)
function rotDir([dx, dz], k) {
  let v = [dx, dz];
  for (let i = 0; i < k; i++) v = [-v[1], v[0]];
  return v;
}
const angleBetween = (a, b) => {
  const d = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) / RAD;
  return d;
};
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (v) => (v.length ? v.reduce((s, n) => s + n, 0) / v.length : null);
const median = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const r2 = (n) => (n === null ? null : Math.round(n * 100) / 100);
const KIT_FAMILY = { cabinet: 'storage', shelf: 'storage', box: 'storage', bed: 'bed', bunk: 'bed', chair: 'seat', stool: 'seat', armchair: 'seat', sofa: 'seat', table: 'table', desk: 'table', counter: 'table', bar: 'table', lamp: 'light', pendant: 'light' };
const kitCost = (a, b) => (a === b ? 0 : KIT_FAMILY[a] && KIT_FAMILY[a] === KIT_FAMILY[b] ? 0.4 : 1.0);

function evaluate(k) {
  const objs = truth.objects.map((o) => ({ ...o, tAt: rotPoint(o.at, k), tFront: rotDir(front(o.rotY), k) }));
  const pairs = [];
  for (const t of objs) for (const r of recon.objects) pairs.push({ t, r, cost: dist2(t.tAt, r.at) + kitCost(t.kit, r.kit) });
  pairs.sort((a, b) => a.cost - b.cost);
  const usedT = new Set();
  const usedR = new Set();
  const matches = [];
  for (const p of pairs) {
    if (usedT.has(p.t.id) || usedR.has(p.r.id) || p.cost > 2.0) continue;
    usedT.add(p.t.id);
    usedR.add(p.r.id);
    matches.push(p);
  }
  const posErr = matches.map((m) => dist2(m.t.tAt, m.r.at));
  const cost = mean(posErr.map((e) => Math.min(e, 1.5))) + (truth.objects.length - matches.length) * 0.3;
  return { k, matches, posErr, cost, objs };
}

const best = [0, 1, 2, 3].map(evaluate).sort((a, b) => a.cost - b.cost)[0];
const k = best.k;
const dims = rotDims(k);
const room = {
  frameRotation: `${k * 90}°`,
  width: { truth: dims.width, recon: recon.shell?.width, err: r2(Math.abs(dims.width - (recon.shell?.width ?? 0))), pct: r2((100 * Math.abs(dims.width - (recon.shell?.width ?? 0))) / dims.width) },
  depth: { truth: dims.depth, recon: recon.shell?.depth, err: r2(Math.abs(dims.depth - (recon.shell?.depth ?? 0))), pct: r2((100 * Math.abs(dims.depth - (recon.shell?.depth ?? 0))) / dims.depth) },
  height: { truth: truth.shell.height, recon: recon.shell?.height, err: r2(Math.abs(truth.shell.height - (recon.shell?.height ?? 0))), pct: r2((100 * Math.abs(truth.shell.height - (recon.shell?.height ?? 0))) / truth.shell.height) },
  area: { truth: r2(W * D), recon: r2((recon.shell?.width ?? 0) * (recon.shell?.depth ?? 0)) },
};

// openings: same wall (after rotation) + same type
const wallLen = (dimsObj, wall) => (wall === 'north' || wall === 'south' ? dimsObj.width : dimsObj.depth);
const openings = truth.shell.openings.map((op) => {
  const wall = rotWall(op.wall, k);
  // offsets run from the lower-x / lower-z end; a rotation can flip that direction
  const len = wallLen({ width: W, depth: D }, op.wall);
  const flip = { 1: ['east', 'west'], 2: ['north', 'south', 'east', 'west'], 3: ['north', 'south'] }[k] || [];
  const offset = flip.includes(op.wall) ? len - op.offset - op.width : op.offset;
  const cand = (recon.shell?.openings || []).filter((o) => o.wall === wall && o.type === op.type);
  const m = cand.sort((a, b) => Math.abs(a.offset - offset) - Math.abs(b.offset - offset))[0];
  return {
    truth: `${op.type} on ${wall} @ ${r2(offset)} m, ${op.width} m wide`,
    found: Boolean(m),
    offsetErr: m ? r2(Math.abs(m.offset - offset)) : null,
    widthErr: m ? r2(Math.abs(m.width - op.width)) : null,
  };
});

const objects = best.matches.map((m) => ({
  truth: m.t.id,
  recon: m.r.id,
  kit: m.t.kit === m.r.kit ? m.t.kit : `${m.t.kit}→${m.r.kit}`,
  posErr: r2(dist2(m.t.tAt, m.r.at)),
  sizeErr: r2(mean([0, 1, 2].map((i) => Math.abs(m.t.size[i] - m.r.size[i])))),
  rotErr: Math.round(angleBetween(m.t.tFront, front(m.r.rotY))),
}));
const missed = best.objs.filter((o) => !best.matches.some((m) => m.t.id === o.id)).map((o) => o.id);
const extra = recon.objects.filter((o) => !best.matches.some((m) => m.r.id === o.id)).map((o) => o.id);

const cameras = truth.cameras.map((c) => {
  const rc = recon.cameras.find((x) => x.photo === c.photo);
  if (!rc) return { photo: c.photo, found: false };
  const tp = rotPoint(c.pos, k);
  const tl = rotPoint(c.look, k);
  const tdir = [tl[0] - tp[0], tl[1] - tp[1], tl[2] - tp[2]];
  const rdir = [rc.look[0] - rc.pos[0], rc.look[1] - rc.pos[1], rc.look[2] - rc.pos[2]];
  const ang = Math.acos(Math.max(-1, Math.min(1, (tdir[0] * rdir[0] + tdir[1] * rdir[1] + tdir[2] * rdir[2]) / (Math.hypot(...tdir) * Math.hypot(...rdir))))) / RAD;
  return { photo: c.photo, posErr: r2(dist3(tp, rc.pos)), aimErrDeg: Math.round(ang), fovErr: Math.round(Math.abs((rc.fov ?? 70) - (c.fov ?? 70))) };
});

let compare = null;
const cmpFile = path.join(dir, 'compare.json');
if (fs.existsSync(cmpFile)) compare = JSON.parse(fs.readFileSync(cmpFile, 'utf8'));
const rounds = fs.readdirSync(dir).filter((f) => /^compare-round\d+\.json$/.test(f)).sort().map((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { round: j.round, ...j.mean };
});

const results = {
  spot: id,
  at: new Date().toISOString(),
  room,
  openings,
  objects: {
    truthCount: truth.objects.length,
    reconCount: recon.objects.length,
    matched: objects.length,
    missed,
    extra,
    posErrMean: r2(mean(objects.map((o) => o.posErr))),
    posErrMedian: r2(median(objects.map((o) => o.posErr))),
    sizeErrMean: r2(mean(objects.map((o) => o.sizeErr))),
    rotErrMedianDeg: median(objects.map((o) => o.rotErr)),
    detail: objects,
  },
  cameras: {
    posErrMean: r2(mean(cameras.filter((c) => c.posErr != null).map((c) => c.posErr))),
    aimErrMeanDeg: Math.round(mean(cameras.filter((c) => c.aimErrDeg != null).map((c) => c.aimErrDeg)) ?? 0),
    detail: cameras,
  },
  images: compare ? { final: compare.mean, perCamera: compare.cameras, rounds } : null,
};
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));

console.log(`Self-test score for ${id} (truth frame rotated ${room.frameRotation} to match)`);
console.log(`Room  width ${room.width.recon} vs ${room.width.truth} m (±${room.width.err}, ${room.width.pct}%)  depth ${room.depth.recon} vs ${room.depth.truth} (±${room.depth.err}, ${room.depth.pct}%)  height ${room.height.recon} vs ${room.height.truth} (±${room.height.err})`);
for (const o of openings) console.log(`Opening ${o.truth}: ${o.found ? `found, offset ±${o.offsetErr} m, width ±${o.widthErr} m` : 'NOT FOUND'}`);
console.log(`Objects matched ${objects.length}/${truth.objects.length} (recon has ${recon.objects.length}); position error mean ${results.objects.posErrMean} m, median ${results.objects.posErrMedian} m; size error mean ${results.objects.sizeErrMean} m; facing error median ${results.objects.rotErrMedianDeg}°`);
for (const o of objects) console.log(`  ${o.truth.padEnd(10)} → ${o.recon.padEnd(14)} ${o.kit.padEnd(16)} pos ±${o.posErr} m  size ±${o.sizeErr} m  facing ${o.rotErr}°`);
if (missed.length) console.log(`  missed: ${missed.join(', ')}`);
if (extra.length) console.log(`  extra:  ${extra.join(', ')}`);
console.log(`Cameras: position error mean ${results.cameras.posErrMean} m, aim error mean ${results.cameras.aimErrMeanDeg}°`);
for (const c of cameras) console.log(`  photo ${c.photo}: ${c.found === false ? 'no camera' : `pos ±${c.posErr} m, aim ${c.aimErrDeg}°, fov ±${c.fovErr}°`}`);
if (compare) {
  console.log(`Images (final round): structure ${compare.mean.structure}, tone ${compare.mean.tone}, colour ${compare.mean.colour}`);
  for (const r of rounds) console.log(`  round ${r.round}: structure ${r.structure}, tone ${r.tone}, colour ${r.colour}`);
}
console.log(`→ ${path.join(HERE, 'results.json')}`);
