#!/usr/bin/env node
/* palette: dominant colours per photo → palette.json (+ palette.png to look at).

     node tools/memory-rooms/palette.mjs <spotId | work dir> [--k 6]

   k-means in CIELAB on a 96 px copy of each photo (deterministic seeding), so
   "the sofa is that blue" comes from pixels, not guesswork. Writes
     palette.json  { photos: { "1": [{ hex, share }…] … }, overall: [{ hex, share }…] }
     palette.png   each thumbnail with its swatches, for a quick look. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { workDir } from './lib/api.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const K = args.includes('--k') ? Number(args[args.indexOf('--k') + 1]) : 6;
if (!target) {
  console.error('usage: node tools/memory-rooms/palette.mjs <spotId | work dir> [--k 6]');
  process.exit(2);
}
const dir = fs.existsSync(target) ? target : workDir(target);
const photoDir = path.join(dir, 'photos');
const files = fs.readdirSync(photoDir).filter((f) => /^\d+\.jpe?g$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b));

// ── colour maths ────────────────────────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
const finv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
function rgbToLab(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => lin(v / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function labToHex([L, a, b]) {
  const fy = (L + 16) / 116;
  const X = finv(fy + a / 500) * 0.95047;
  const Y = finv(fy);
  const Z = finv(fy - b / 200) * 1.08883;
  const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, unlin(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('')}`;
}
const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

function kmeans(points, k) {
  // k-means++ with a fixed pseudo-random sequence → same palette every run
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centers = [points[Math.floor(rand() * points.length)]];
  while (centers.length < k) {
    const dist = points.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    const total = dist.reduce((s, v) => s + v, 0);
    let r = rand() * total;
    let i = 0;
    while (r > dist[i] && i < dist.length - 1) r -= dist[i++];
    centers.push(points[i]);
  }
  const assign = new Array(points.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    points.forEach((p, i) => {
      let best = 0;
      for (let c = 1; c < k; c++) if (d2(p, centers[c]) < d2(p, centers[best])) best = c;
      assign[i] = best;
    });
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assign[i] === c);
      if (members.length) centers[c] = [0, 1, 2].map((j) => members.reduce((s, m) => s + m[j], 0) / members.length);
    }
  }
  const counts = new Array(k).fill(0);
  assign.forEach((c) => counts[c]++);
  return centers.map((c, i) => ({ hex: labToHex(c), share: +(counts[i] / points.length).toFixed(3), lab: c })).sort((a, b) => b.share - a.share);
}

async function labPixels(file, size = 96) {
  const { data, info } = await sharp(file).resize(size, size, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = [];
  for (let i = 0; i < info.width * info.height; i++) out.push(rgbToLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]));
  return out;
}

// ── run ─────────────────────────────────────────────────────────────────────
const photos = {};
let all = [];
for (const file of files) {
  const px = await labPixels(path.join(photoDir, file));
  photos[parseInt(file)] = kmeans(px, K).map(({ hex, share }) => ({ hex, share }));
  all = all.concat(px.filter((_, i) => i % 3 === 0));
}
const overall = kmeans(all, Math.min(8, K + 2)).map(({ hex, share }) => ({ hex, share }));
fs.writeFileSync(path.join(dir, 'palette.json'), JSON.stringify({ k: K, photos, overall }, null, 2));

// palette.png: thumbnail + swatch strip per photo, overall strip at the bottom
const TW = 240;
const rows = [];
for (const file of files) {
  const n = parseInt(file);
  const thumb = await sharp(path.join(photoDir, file)).resize(TW, TW, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  rows.push({ n, thumb: thumb.data, h: thumb.info.height, w: thumb.info.width, sw: photos[n] });
}
const SW = 520;
const W = TW + SW + 30;
const overallH = 70;
const H = rows.reduce((s, r) => s + r.h + 10, 10) + overallH + 20;
const svgParts = [];
const composites = [];
let y = 10;
for (const r of rows) {
  composites.push({ input: r.thumb, left: 10, top: y });
  let x = TW + 20;
  for (const s of r.sw) {
    const w = 28 + Math.round(s.share * (SW - r.sw.length * 30));
    svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${r.h - 24}" fill="${s.hex}"/><text x="${x + 4}" y="${y + r.h - 8}" font-family="Consolas" font-size="11" fill="#333">${s.hex}</text>`);
    x += w + 2;
  }
  svgParts.push(`<text x="14" y="${y + 18}" font-family="Consolas" font-size="14" fill="#fff" stroke="#000" stroke-width="0.5">${r.n}</text>`);
  y += r.h + 10;
}
let x = 10;
svgParts.push(`<text x="10" y="${y + 12}" font-family="Consolas" font-size="12" fill="#333">OVERALL</text>`);
for (const s of overall) {
  const w = 40 + Math.round(s.share * (W - 20 - overall.length * 42));
  svgParts.push(`<rect x="${x}" y="${y + 18}" width="${w}" height="${overallH - 26}" fill="${s.hex}"/><text x="${x + 4}" y="${y + overallH + 6}" font-family="Consolas" font-size="11" fill="#333">${s.hex}</text>`);
  x += w + 2;
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgParts.join('')}</svg>`);
await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f2ee' } })
  .composite([...composites, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(path.join(dir, 'palette.png'));

console.log(`palette.json + palette.png → ${dir}`);
console.log(`overall: ${overall.map((s) => `${s.hex} ${Math.round(s.share * 100)}%`).join('  ')}`);
