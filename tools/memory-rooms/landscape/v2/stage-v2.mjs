#!/usr/bin/env node
/* Stage a LIVE (v2) landscape as a Memory Rooms spot, ready for push.mjs.

     node tools/memory-rooms/landscape/v2/stage-v2.mjs <work> [--create | --id <spotId>] [--title "…"]
         [--spawn x,z,yaw] [--home 300] [--live] [--hero-from http://localhost:5173]

   --create makes the spot first (POST /api/memories/spots, an exterior at the frame's centre, no photos); a non-
   local Worker needs --live. Writes memory-rooms-work/<id>/:
     room.glb     the packed landscape (pack.mjs → <work>/build/room.glb)
     scene.json   an exterior whose site.terrain is the box + `live` { spawn, home, pois } (CONTRACTS §6.8)
     map.glb      a small vertex-coloured terrain for the /memories map (newer than room.glb, so push keeps it)
     renders/hero.png  the spot page's opening view, shot in the landscape harness (needs the Vite dev server)
   POIs come from <work>/pois.json when it exists ([{ id, name, at: [x, y, z], text, sources }]). */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
import { client, config, workDir } from '../../lib/api.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const work = path.resolve(argv[0] || '');
const room = path.join(work, 'build', 'room.glb');
if (!argv[0] || !fs.existsSync(room)) {
  console.error('usage: stage-v2.mjs <work with build/room.glb (pack.mjs)> [--create | --id id] [--live]');
  process.exit(2);
}
const meta = JSON.parse(fs.readFileSync(path.join(work, 'data', 'data.json'), 'utf8'));
const fr = meta.frame;
const title = opt('title', 'Point Peron');

let id = opt('id');
if (flag('create')) {
  const { base } = config();
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
  if (!local && !flag('live')) {
    console.error(`${base} is not a local Worker: pass --live to create the spot there.`);
    process.exit(1);
  }
  id = id || crypto.randomUUID();
  const [lng, lat] = fr.centre_lnglat;
  const res = await client().saveSpot({
    id,
    createdBy: 'james',
    kind: 'exterior',
    title,
    note: opt('note', 'Point Peron, Rockingham: the old Peron Battery, its paths, beaches and reefs, walkable.'),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    placeLabel: opt('place', 'Rockingham, WA'),
    locSource: 'typed',
    capturedAt: new Date().toISOString(),
  });
  console.log('created spot', id, res?.data?.title ?? '');
}
if (!id) {
  console.error('no spot: pass --id <spotId> or --create');
  process.exit(2);
}
const dir = workDir(id);
fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
fs.copyFileSync(room, path.join(dir, 'room.glb'));

// ---- scene.json
const spawn = (opt('spawn', '0,0,0') || '').split(',').map(Number);
const poisFile = path.join(work, 'pois.json');
const pois = fs.existsSync(poisFile) ? JSON.parse(fs.readFileSync(poisFile, 'utf8')) : [];
const [lo, hi] = meta.hRange;
const scene = {
  version: 1,
  kind: 'exterior',
  title,
  notes:
    'Live landscape (tools/memory-rooms/landscape/v2): ground from Geoscience Australia\'s 5 m LiDAR DEM; the sea floor read off WA Department of Transport\'s LiDAR bathymetry image (its colour ramp calibrated to DoT\'s depth bands: modelled from survey, about ±1-2 m); paths, roads and buildings from OpenStreetMap; ground cover and plant density from Copernicus Sentinel-2. The battery, the observation post and the bunkers are modelled from Wikimedia Commons photos (sizes estimated from them, not surveyed). Textures, plants and rocks are made procedurally for this model.',
  site: {
    ground: { finish: 'sand', size: [2, 2] },
    terrain: {
      size: [Math.round(fr.half[0] * 20) / 10, Math.round(fr.half[1] * 20) / 10],
      heights: [Math.floor(lo), Math.ceil(hi + 10)],
      vexag: 1,
      sources: [
        'Elevation: DEM of Australia derived from LiDAR 5 m grid, © Geoscience Australia (CC BY 4.0)',
        'Sea floor: WA Department of Transport LiDAR bathymetry (Cockburn Sound), via Landgate SLIP (CC BY 3.0 AU)',
        '© OpenStreetMap contributors (ODbL)',
        'Contains modified Copernicus Sentinel data 2026',
        'Reference photos: Wikimedia Commons (Calistemon and others, CC BY-SA)',
      ],
      live: { spawn: [spawn[0] || 0, spawn[1] || 0, spawn[2] || 0], home: Number(opt('home', 300)), pois },
    },
  },
  objects: [],
  cameras: [],
};
fs.writeFileSync(path.join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'spot.json'), JSON.stringify({ id, landscape: work, v: 2 }, null, 2) + '\n');

// ---- map.glb: the box's ground as an 8 m vertex-coloured mesh (sea floor tinted as seen through water)
{
  const rawH = await sharp(path.join(work, 'data', 'heights.png')).raw().toBuffer({ resolveWithObject: true });
  const rawS = await sharp(path.join(work, 'data', 'splat.png')).raw().toBuffer({ resolveWithObject: true });
  const rawV = await sharp(path.join(work, 'data', 'veg.png')).raw().toBuffer({ resolveWithObject: true });
  const W = rawH.info.width;
  const ch = rawH.info.channels;
  const step = 8;
  const x0 = -fr.half[0];
  const x1 = fr.half[0];
  const z0 = -fr.half[1];
  const z1 = fr.half[1];
  const nx = Math.floor((x1 - x0) / step) + 1;
  const nz = Math.floor((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Uint8Array(nx * nz * 4);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const c = Math.min(W - 1, Math.max(0, Math.floor(x - fr.x0)));
      const r = Math.min(rawH.info.height - 1, Math.max(0, Math.floor(z + fr.y1)));
      const o = (r * W + c) * ch;
      const h = ((rawH.data[o] << 8) | rawH.data[o + 1]) / meta.heights.scale - meta.heights.offset;
      const k = j * nx + i;
      pos.set([x, h, z], k * 3);
      const s = [rawS.data[(r * W + c) * rawS.info.channels], rawS.data[(r * W + c) * rawS.info.channels + 1], rawS.data[(r * W + c) * rawS.info.channels + 2]].map((v) => v / 255);
      const v = rawV.data[(r * W + c) * rawV.info.channels] / 255;
      let rgb;
      if (h < 0) {
        const d = Math.min(1, -h / 8);
        rgb = [0.35 - 0.25 * d, 0.72 - 0.35 * d, 0.72 - 0.2 * d];
      } else {
        const sand = [0.86, 0.79, 0.62];
        const rock = [0.74, 0.71, 0.62];
        const soil = [0.44, 0.4, 0.31];
        const heath = [0.36, 0.42, 0.27];
        rgb = [0, 1, 2].map((q) => sand[q] * s[0] + rock[q] * s[1] + soil[q] * s[2]).map((q, qi) => q * (1 - v * 0.8) + heath[qi] * v * 0.8);
      }
      col.set([...rgb.map((q) => Math.round(Math.min(1, lin(q)) * 255)), 255], k * 4);
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i;
    idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
  }
  const doc = new Document();
  const buf = doc.createBuffer();
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  const mat = doc.createMaterial('ground').setBaseColorFactor([1, 1, 1, 1]).setExtension('KHR_materials_unlit', unlit.createUnlit());
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setNormalized(true).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(nx * nz < 65536 ? new Uint16Array(idx) : new Uint32Array(idx)).setBuffer(buf))
    .setMaterial(mat);
  const mesh = doc.createMesh('ground').addPrimitive(prim);
  const node = doc.createNode('ground').setMesh(mesh);
  doc.createScene('scene').addChild(node);
  await new NodeIO().registerExtensions([KHRMaterialsUnlit]).write(path.join(dir, 'map.glb'), doc);
  console.log('map.glb', (fs.statSync(path.join(dir, 'map.glb')).size / 1024).toFixed(0), 'KB');
}

// ---- hero: the spot page's opening view, in the harness
const heroBase = opt('hero-from', 'http://localhost:5173');
try {
  const home = scene.site.terrain.live.home;
  const el = (30 * Math.PI) / 180;
  const az = (-24 * Math.PI) / 180;
  const tx = 0;
  const tz = 0;
  const ty = 16;
  const cam = [tx + home * Math.cos(el) * Math.sin(az), ty + home * Math.sin(el), tz + home * Math.cos(el) * Math.cos(az)];
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const dataUrl = `/${path.relative(process.cwd(), path.join(work, 'data')).split(path.sep).join('/')}`;
  await page.goto(`${heroBase}/tools/memory-rooms/landscape/v2/harness/index.html?data=${encodeURIComponent(dataUrl)}&cam=${cam.map((v) => v.toFixed(1)).join(',')},${tx},${ty},${tz}&t=4&hud=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__land && (window.__land.ready || window.__land.error), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(dir, 'renders', 'hero.png') });
  await browser.close();
  console.log('renders/hero.png');
} catch (err) {
  console.log('  ! no hero render (is the Vite dev server up?):', err.message);
}
console.log(`staged ${dir}\n  room.glb ${(fs.statSync(path.join(dir, 'room.glb')).size / 1e6).toFixed(2)} MB\nnext: node tools/memory-rooms/push.mjs ${id}`);
