#!/usr/bin/env node
/* plan-check: a traced building.json drawn over the floor-plan photo it was traced from, so the tracing can be
   checked by eye (and by number) before anything is built. No Blender, no browser.

     node tools/memory-rooms/plan-check.mjs <work dir | building.json> --photo <plan.jpg> [--level ground]
          --fit a1=412,388 a5=1630,392 [a9=…]        (two or more plan nodes → their pixels on the photo)
          [--out <png>]

   The fit is a similarity (scale, rotation, shift; a photographed plan is rarely skewed) from the node ↔ pixel
   pairs: exact with two, least squares with more (then the residual of every pair is printed: over ~1.5 % of
   the plan's size means a node is in the wrong place, or the photo is skewed). Drawn on the photo: every wall as
   its thickness band (exterior darker), openings as blue strokes, node ids, room names at their middles, and the
   fit pairs as rings. Writes <work>/plan-check-<level>.png (or --out) and prints the path.

   The validator runs first (building/validate.js): an invalid building.json is reported, not drawn. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { validateBuilding } from '../../src/memory-rooms/building/validate.js';
import { nodeMap, roomPolygon, wallLines, wallOpenings } from '../../src/memory-rooms/building/geometry.js';

const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--fit') && !/=/.test(a));
const opt = (n, d = null) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!target || !opt('--photo')) {
  console.error('usage: node tools/memory-rooms/plan-check.mjs <work dir | building.json> --photo <plan.jpg> --fit a1=x,y a5=x,y [--level id] [--out png]');
  process.exit(2);
}
const file = fs.statSync(target).isDirectory() ? path.join(target, 'building.json') : target;
const b = JSON.parse(fs.readFileSync(file, 'utf8'));
const v = validateBuilding(b);
if (!v.ok) {
  console.error(`building.json is not valid:\n  ${v.errors.map((e) => `${e.path} ${e.message}`).join('\n  ')}`);
  process.exit(1);
}
const levelId = opt('--level', b.levels[0].id);
const level = b.levels.find((l) => l.id === levelId);
if (!level) {
  console.error(`no level "${levelId}" (levels: ${b.levels.map((l) => l.id).join(', ')})`);
  process.exit(1);
}
const nodes = nodeMap(level);
const pairs = [];
const fitStart = args.indexOf('--fit');
for (let i = fitStart + 1; fitStart >= 0 && i < args.length && !args[i].startsWith('--'); i++) {
  const m = /^([a-z0-9-]+)=(-?[\d.]+),(-?[\d.]+)$/i.exec(args[i]);
  if (!m) continue;
  if (!nodes.has(m[1])) {
    console.error(`--fit: no node "${m[1]}" on level ${levelId}`);
    process.exit(1);
  }
  pairs.push({ id: m[1], p: nodes.get(m[1]), q: [Number(m[2]), Number(m[3])] });
}
if (pairs.length < 2) {
  console.error('--fit needs at least two node=x,y pairs (plan nodes and where they are on the photo, in pixels)');
  process.exit(2);
}

// least-squares similarity q = a·p + t with a = s·e^{iθ} as a complex number (exact for two pairs)
const mean = (k, f) => pairs.reduce((s, pr) => s + pr[k][f], 0) / pairs.length;
const pc = [mean('p', 0), mean('p', 1)];
const qc = [mean('q', 0), mean('q', 1)];
let num0 = 0;
let num1 = 0;
let den = 0;
for (const { p, q } of pairs) {
  const px = p[0] - pc[0];
  const py = p[1] - pc[1];
  const qx = q[0] - qc[0];
  const qy = q[1] - qc[1];
  num0 += px * qx + py * qy;
  num1 += px * qy - py * qx;
  den += px * px + py * py;
}
const ar = num0 / den;
const ai = num1 / den;
const T = ([x, z]) => [ar * (x - pc[0]) - ai * (z - pc[1]) + qc[0], ai * (x - pc[0]) + ar * (z - pc[1]) + qc[1]];
const scale = Math.hypot(ar, ai);

const img = sharp(opt('--photo'));
const meta = await img.metadata();
const W = meta.width;
const H = meta.height;
const lines = wallLines(b, levelId);
const svg = [];
const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const px = (m) => Math.max(1, m * scale);
for (const w of lines) {
  const h = w.thickness / 2;
  const quad = [
    [w.pa[0] + w.left[0] * h, w.pa[1] + w.left[1] * h],
    [w.pb[0] + w.left[0] * h, w.pb[1] + w.left[1] * h],
    [w.pb[0] - w.left[0] * h, w.pb[1] - w.left[1] * h],
    [w.pa[0] - w.left[0] * h, w.pa[1] - w.left[1] * h],
  ].map(T);
  svg.push(`<polygon points="${quad.map(fmt).join(' ')}" fill="${w.exterior ? 'rgba(170,30,30,0.45)' : 'rgba(230,80,40,0.35)'}" stroke="#b01e1e" stroke-width="${px(0.01)}"/>`);
  for (const o of wallOpenings(b, w.id)) {
    const a = T([w.pa[0] + w.dir[0] * o.u0, w.pa[1] + w.dir[1] * o.u0]);
    const c = T([w.pa[0] + w.dir[0] * o.u1, w.pa[1] + w.dir[1] * o.u1]);
    svg.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${o.type === 'window' ? '#1f6fd1' : '#0f9d58'}" stroke-width="${px(w.thickness * 1.4)}" stroke-linecap="butt" opacity="0.85"/>`);
  }
}
const fs1 = Math.max(10, px(0.22));
for (const [id, p] of nodes) {
  const q = T(p);
  svg.push(`<circle cx="${q[0]}" cy="${q[1]}" r="${Math.max(2, px(0.05))}" fill="#111"/><text x="${q[0] + 4}" y="${q[1] - 4}" font-family="monospace" font-size="${fs1 * 0.7}" fill="#111" stroke="#fff" stroke-width="2" paint-order="stroke">${id}</text>`);
}
for (const r of b.rooms.filter((x) => x.level === levelId)) {
  const poly = roomPolygon(b, r);
  const c = T([poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]);
  svg.push(`<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-family="Georgia, serif" font-size="${fs1}" fill="#5a1d8c" stroke="#fff" stroke-width="3" paint-order="stroke">${(r.name || r.id).replace(/[<&]/g, '')}</text>`);
}
const residuals = pairs.map(({ id, p, q }) => {
  const t = T(p);
  svg.push(`<circle cx="${q[0]}" cy="${q[1]}" r="${Math.max(6, px(0.15))}" fill="none" stroke="#e0a800" stroke-width="3"/>`);
  return { id, px: Math.hypot(t[0] - q[0], t[1] - q[1]) };
});
const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join('')}</svg>`);
const dir = path.dirname(file);
const out = opt('--out', path.join(dir, `plan-check-${levelId}.png`));
await img.composite([{ input: overlay, top: 0, left: 0 }]).png().toFile(out);

const span = Math.max(...lines.flatMap((w) => [w.pa[0], w.pb[0]])) - Math.min(...lines.flatMap((w) => [w.pa[0], w.pb[0]]));
console.log(`plan-check ${file} · level ${levelId} · ${lines.length} walls, ${nodes.size} nodes`);
console.log(`  fit: ${scale.toFixed(2)} px/m, rotated ${((Math.atan2(ai, ar) * 180) / Math.PI).toFixed(2)}°`);
if (pairs.length > 2) {
  const tol = span * scale * 0.015;
  for (const r of residuals) console.log(`  ${r.px > tol ? '!' : ' '} ${r.id}: ${r.px.toFixed(1)} px off${r.px > tol ? ' (more than 1.5 % of the plan: check this node, or the photo is skewed)' : ''}`);
}
console.log(`  → ${out}`);
