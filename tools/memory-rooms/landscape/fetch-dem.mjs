#!/usr/bin/env node
// Fetch a DEM for a lng/lat box from the AWS open terrain tiles (Terrarium; default) or Mapbox Terrain-RGB and write it as
// a float32 grid in a local metric frame (east = +x, north = +y, metres from the box centre).
//
//   node tools/memory-rooms/landscape/fetch-dem.mjs --bbox 115.676,-32.282,115.706,-32.258 --z 15 --out memory-rooms-work/_peron
//
// Writes <out>/dem.json (meta) + dem.f32 (row-major, north row first) + dem.png (hillshade preview).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith('--')) a.push([v.slice(2), all[i + 1]]);
  return a;
}, []));
const [w, s, e, n] = args.bbox.split(',').map(Number);
const z = Number(args.z || 15);
const out = args.out;
const step = Number(args.step || 2); // output grid spacing, metres
fs.mkdirSync(path.join(out, 'tiles'), { recursive: true });

const source = args.source || 'terrarium'; // terrarium = AWS open terrain tiles (no key); mapbox = Terrain-RGB
const token = source === 'mapbox' ? fs.readFileSync('.env.local', 'utf8').match(/VITE_MAPBOX_TOKEN=(\S+)/)[1] : null;

const lon2x = (lon) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const x0 = Math.floor(lon2x(w)), x1 = Math.floor(lon2x(e));
const y0 = Math.floor(lat2y(n)), y1 = Math.floor(lat2y(s));

const tiles = new Map();
for (let tx = x0; tx <= x1; tx++) {
  for (let ty = y0; ty <= y1; ty++) {
    const file = path.join(out, 'tiles', `${source}-${z}-${tx}-${ty}.png`);
    if (!fs.existsSync(file)) {
      const url = source === 'mapbox'
        ? `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${tx}/${ty}.pngraw?access_token=${token}`
        : `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} for tile ${z}/${tx}/${ty}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const h = new Float32Array(info.width * info.height);
    for (let i = 0; i < h.length; i++) {
      const o = i * info.channels;
      h[i] = source === 'mapbox'
        ? -10000 + (data[o] * 65536 + data[o + 1] * 256 + data[o + 2]) * 0.1
        : data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
    }
    tiles.set(`${tx},${ty}`, { h, size: info.width });
  }
}
console.log(`tiles z${z}: x ${x0}..${x1}, y ${y0}..${y1} (${tiles.size})`);

// Bilinear sample in global pixel space.
function sample(lon, lat) {
  const size = tiles.values().next().value.size;
  const gx = lon2x(lon) * size - 0.5, gy = lat2y(lat) * size - 0.5;
  const px = Math.floor(gx), py = Math.floor(gy), fx = gx - px, fy = gy - py;
  const at = (X, Y) => {
    const t = tiles.get(`${Math.floor(X / size)},${Math.floor(Y / size)}`);
    if (!t) return NaN;
    return t.h[(Y % size) * size + (X % size)];
  };
  return (at(px, py) * (1 - fx) + at(px + 1, py) * fx) * (1 - fy) + (at(px, py + 1) * (1 - fx) + at(px + 1, py + 1) * fx) * fy;
}

// Local metric frame: equirectangular about the centre (error < 1 cm over 3 km).
const lat0 = (s + n) / 2, lon0 = (w + e) / 2;
const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * lat0 * Math.PI / 180);
const mPerDegLon = 111412.84 * Math.cos(lat0 * Math.PI / 180);
const width = (e - w) * mPerDegLon, height = (n - s) * mPerDegLat;
const cols = Math.floor(width / step) + 1, rows = Math.floor(height / step) + 1;
const grid = new Float32Array(cols * rows);
let min = Infinity, max = -Infinity;
for (let r = 0; r < rows; r++) {
  const y = height / 2 - r * step;
  for (let c = 0; c < cols; c++) {
    const x = -width / 2 + c * step;
    const v = sample(lon0 + x / mPerDegLon, lat0 + y / mPerDegLat);
    grid[r * cols + c] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
}
fs.writeFileSync(path.join(out, 'dem.f32'), Buffer.from(grid.buffer));
const meta = { source: `${source} z${z}`, bbox: [w, s, e, n], centre: [lon0, lat0], mPerDegLon, mPerDegLat,
  width, height, step, cols, rows, min, max };
fs.writeFileSync(path.join(out, 'dem.json'), JSON.stringify(meta, null, 2));

// Hillshade preview (sun from the north-west), sea (< 0.3 m) tinted blue.
const img = Buffer.alloc(cols * rows * 3);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const i = r * cols + c, v = grid[i];
  const dx = (grid[r * cols + Math.min(c + 1, cols - 1)] - grid[r * cols + Math.max(c - 1, 0)]) / (2 * step);
  const dy = (grid[Math.max(r - 1, 0) * cols + c] - grid[Math.min(r + 1, rows - 1) * cols + c]) / (2 * step);
  const shade = Math.max(0, Math.min(1, 0.6 + (-dx + dy) * 1.5));
  const t = Math.max(0, Math.min(1, v / Math.max(max, 1)));
  const o = i * 3;
  if (v < 0.3) { img[o] = 40; img[o + 1] = 90; img[o + 2] = 140; }
  else { img[o] = 255 * shade * (0.5 + 0.5 * t); img[o + 1] = 255 * shade * (0.6 + 0.3 * t); img[o + 2] = 255 * shade * 0.45; }
}
await sharp(img, { raw: { width: cols, height: rows, channels: 3 } }).png().toFile(path.join(out, 'dem.png'));
console.log(JSON.stringify(meta, null, 2));
