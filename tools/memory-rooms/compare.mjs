#!/usr/bin/env node
/* compare: each photo beside its Cycles render, a 50/50 overlay and an edge overlay
   (photo edges red, render edges blue), plus the top-down, in one sheet the modeller
   reads to find the biggest mismatches.

     node tools/memory-rooms/compare.mjs <spotId | work dir> [--round N]

   Needs photos/<n>.jpg (pull.mjs) and renders/cam<n>.png + renders/top.png
   (build_room.py). Writes compare.png + compare.json; with --round N also keeps
   compare-roundN.png / .json so rounds can be compared later.

   Scores per camera (both images scaled to 96 px on the long edge):
     structure  correlation of edge maps (Sobel magnitude): 1 = same lines in the same places.
                Layout errors (a wall in the wrong place, a camera aimed wrong) pull it down.
     tone       1 - mean |ΔL| of 12×16 block averages (CIELAB L/100): overall light and shade.
     colour     1 - mean Lab ΔE of 6×8 block averages / 50: the palette.
   They are guides for comparing rounds of the same spot, not absolute grades. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { workDir } from './lib/api.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const round = args.includes('--round') ? Number(args[args.indexOf('--round') + 1]) : null;
if (!target) {
  console.error('usage: node tools/memory-rooms/compare.mjs <spotId | work dir> [--round N]');
  process.exit(2);
}
const dir = fs.existsSync(target) ? target : workDir(target);
const scene = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));
const title = scene.title || path.basename(dir);

// ── metrics ──────────────────────────────────────────────────────────────────
async function grid(file, w, h) {
  const { data } = await sharp(file).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fl = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
function lab(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => lin(v / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * fl(Y) - 16, 500 * (fl(X) - fl(Y)), 200 * (fl(Y) - fl(Z))];
}
function sobel(lum, w, h) {
  const out = new Float64Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (dx, dy) => lum[(y + dy) * w + (x + dx)];
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      out[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return out;
}
function corr(a, b) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
async function scores(photo, render, portrait) {
  const [w, h] = portrait ? [72, 96] : [96, 72];
  const pa = await grid(photo, w, h);
  const ra = await grid(render, w, h);
  const lumOf = (d) => Float64Array.from({ length: w * h }, (_, i) => lab(d[i * 3], d[i * 3 + 1], d[i * 3 + 2])[0]);
  const structure = corr(sobel(lumOf(pa), w, h), sobel(lumOf(ra), w, h));
  const [bw, bh] = portrait ? [12, 16] : [16, 12];
  const pb = await grid(photo, bw, bh);
  const rb = await grid(render, bw, bh);
  let dl = 0;
  for (let i = 0; i < bw * bh; i++) dl += Math.abs(lab(pb[i * 3], pb[i * 3 + 1], pb[i * 3 + 2])[0] - lab(rb[i * 3], rb[i * 3 + 1], rb[i * 3 + 2])[0]);
  const [cw, ch] = portrait ? [6, 8] : [8, 6];
  const pc = await grid(photo, cw, ch);
  const rc = await grid(render, cw, ch);
  let de = 0;
  for (let i = 0; i < cw * ch; i++) {
    const p = lab(pc[i * 3], pc[i * 3 + 1], pc[i * 3 + 2]);
    const q = lab(rc[i * 3], rc[i * 3 + 1], rc[i * 3 + 2]);
    de += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  return {
    structure: +structure.toFixed(3),
    tone: +(1 - dl / (bw * bh) / 100).toFixed(3),
    colour: +Math.max(0, 1 - de / (cw * ch) / 50).toFixed(3),
  };
}

/**
 * Edge overlay: photo edges in red, render edges in blue, both in near-black. A wall line or
 * table edge 2–5 cm off shows as a red line beside a blue one, which the 50/50 blend hides.
 */
async function edgeOverlay(photoPng, renderPng, w, h) {
  const gray = async (buf) => (await sharp(buf).resize(w, h, { fit: 'fill' }).greyscale().blur(0.8).raw().toBuffer());
  const norm = (m) => {
    const sorted = Float64Array.from(m).sort();
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    return m.map((v) => Math.min(1, (v / p95) ** 1.3));
  };
  const pe = norm(sobel(Float64Array.from(await gray(photoPng)), w, h));
  const re = norm(sobel(Float64Array.from(await gray(renderPng)), w, h));
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    out[i * 3] = 255 - 225 * re[i];
    out[i * 3 + 1] = 255 - 225 * Math.max(pe[i], re[i]);
    out[i * 3 + 2] = 255 - 225 * pe[i];
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

// ── sheet ────────────────────────────────────────────────────────────────────
const CELL_H = 480;
const GAP = 16;
const LABEL_H = 34;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const text = (x, y, s, size = 15, fill = '#2a2a28', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Consolas, monospace" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;

const rows = [];
const results = [];
for (const cam of scene.cameras) {
  const photo = ['jpg', 'jpeg', 'png'].map((e) => path.join(dir, 'photos', `${cam.photo}.${e}`)).find((p) => fs.existsSync(p));
  const render = path.join(dir, 'renders', `cam${cam.photo}.png`);
  if (!photo || !fs.existsSync(render)) {
    results.push({ photo: cam.photo, missing: !photo ? 'photo' : 'render' });
    continue;
  }
  const meta = await sharp(photo).metadata();
  const portrait = meta.height >= meta.width;
  const w = Math.round(CELL_H * (meta.width / meta.height));
  const p = await sharp(photo).resize(w, CELL_H, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const r = await sharp(render).resize(w, CELL_H, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const overlay = await sharp(p).composite([{ input: await sharp(r).ensureAlpha(0.5).png().toBuffer(), blend: 'over' }]).png().toBuffer();
  const edges = await edgeOverlay(p, r, w, CELL_H);
  const s = await scores(photo, render, portrait);
  results.push({ photo: cam.photo, ...s });
  rows.push({ cam, w, p, r, overlay, edges, s });
}

const extra = [];
for (const name of ['top', 'three-quarter']) {
  const f = path.join(dir, 'renders', `${name}.png`);
  if (fs.existsSync(f)) {
    const m = await sharp(f).metadata();
    const w = Math.round(CELL_H * (m.width / m.height));
    extra.push({ name, w, buf: await sharp(f).resize(w, CELL_H, { fit: 'fill' }).removeAlpha().png().toBuffer() });
  }
}

const rowW = Math.max(0, ...rows.map((r) => r.w * 4 + GAP * 3));
const extraW = extra.reduce((s, e) => s + e.w + GAP, -GAP);
const W = Math.max(rowW, extraW, 900) + GAP * 2;
const HEADER = 70;
const H = HEADER + rows.length * (CELL_H + LABEL_H + GAP) + (extra.length ? CELL_H + LABEL_H + GAP : 0) + GAP;
const svg = [text(GAP, 32, `${title}: photo | render | 50/50 overlay | edges (red = photo, blue = render, dark = both)`, 22, '#1d1c1a', 700), text(GAP, 56, `${new Date().toISOString().slice(0, 16).replace('T', ' ')}${round ? `  ·  round ${round}` : ''}  ·  scores: structure (edges), tone (light), colour (palette); higher = closer`, 13, '#5b5852')];
const comps = [];
let y = HEADER;
for (const row of rows) {
  svg.push(text(GAP, y + 22, `PHOTO ${row.cam.photo}`, 15, '#1d1c1a', 700));
  svg.push(text(GAP + row.w + GAP, y + 22, `RENDER cam${row.cam.photo} · fov ${Math.round(row.cam.fov ?? 70)}°`, 13));
  svg.push(text(GAP + (row.w + GAP) * 2, y + 22, `str ${row.s.structure} · tone ${row.s.tone} · col ${row.s.colour}`, 12, '#b5532f', 700));
  svg.push(text(GAP + (row.w + GAP) * 3, y + 22, 'EDGES   red photo · blue render', 13));
  comps.push(
    { input: row.p, left: GAP, top: y + LABEL_H },
    { input: row.r, left: GAP + row.w + GAP, top: y + LABEL_H },
    { input: row.overlay, left: GAP + (row.w + GAP) * 2, top: y + LABEL_H },
    { input: row.edges, left: GAP + (row.w + GAP) * 3, top: y + LABEL_H },
  );
  y += CELL_H + LABEL_H + GAP;
}
let x = GAP;
for (const e of extra) {
  svg.push(text(x, y + 22, e.name.toUpperCase(), 15, '#1d1c1a', 700));
  comps.push({ input: e.buf, left: x, top: y + LABEL_H });
  x += e.w + GAP;
}
const sheet = sharp({ create: { width: W, height: H, channels: 3, background: '#f4f2ee' } })
  .composite([...comps, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join('')}</svg>`), left: 0, top: 0 }])
  .png();
const sheetBuf = await sheet.toBuffer();
fs.writeFileSync(path.join(dir, 'compare.png'), sheetBuf);

const mean = (k) => {
  const v = results.filter((r) => typeof r[k] === 'number').map((r) => r[k]);
  return v.length ? +(v.reduce((s, n) => s + n, 0) / v.length).toFixed(3) : null;
};
const summary = { title, round, at: new Date().toISOString(), cameras: results, mean: { structure: mean('structure'), tone: mean('tone'), colour: mean('colour') } };
fs.writeFileSync(path.join(dir, 'compare.json'), JSON.stringify(summary, null, 2));
if (round) {
  fs.writeFileSync(path.join(dir, `compare-round${round}.png`), sheetBuf);
  fs.writeFileSync(path.join(dir, `compare-round${round}.json`), JSON.stringify(summary, null, 2));
}

for (const r of results) {
  console.log(r.missing ? `photo ${r.photo}: missing ${r.missing}` : `photo ${r.photo}: structure ${r.structure}  tone ${r.tone}  colour ${r.colour}`);
}
console.log(`mean: structure ${summary.mean.structure}  tone ${summary.mean.tone}  colour ${summary.mean.colour}`);
console.log(`→ ${path.join(dir, 'compare.png')}${round ? ` (+ compare-round${round}.png)` : ''}`);
