#!/usr/bin/env node
/* Packs a PixelLab character export (the unzipped download of `export_asset format zip`) into
   the one sprite sheet + layout the walk page draws (src/memory-rooms/walk/characters/).

     node tools/memory-rooms/build-characters.mjs <unzipped folder> <name> [--skip anim/dir/frame,...]
       → src/memory-rooms/walk/characters/<name>.png + <name>.json

   The export holds `Idle/rotations/<dir>.png` (8 directions) and
   `Idle/animations/<anim>/<dir>/frame_NNN.png`. Animations can sit on different canvases (92 vs
   104 px), so every frame goes into one square cell, centred across and with each animation's
   feet (the lowest opaque row of its first frame) on the same row, so nothing hops when an
   animation changes. A jump keeps its own rise because only the FIRST frame sets the line.

   Layout: { cell, feet, top, head, cols, anims: { idle|walk|wave|sit|jump: { <dir>: [cell index…] } } }:
   feet = the row every animation stands on, head = the top of the head standing (sets the height),
   top = the highest pixel of any frame (a raised arm).
   `idle` comes from the 8 rotations (one frame each). Directions a walk lacks (west, south-west,
   north-west) are mirrored in the browser from their east twins. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, name, ...rest] = process.argv.slice(2);
if (!src || !name) {
  console.error('usage: build-characters.mjs <unzipped folder> <name> [--skip anim/dir/frame,...]');
  process.exit(1);
}
const skip = new Set((rest[rest.indexOf('--skip') + 1] || '').split(',').filter(Boolean));
const OUT = path.resolve('src/memory-rooms/walk/characters');
fs.mkdirSync(OUT, { recursive: true });

const meta = JSON.parse(fs.readFileSync(path.join(src, 'metadata.json'), 'utf8'));
const state = meta.states[0];
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

async function load(rel) {
  const img = sharp(path.join(src, rel)).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let bottom = -1;
  let top = info.height;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        bottom = Math.max(bottom, y);
        top = Math.min(top, y);
        break;
      }
    }
  }
  return { rel, data, w: info.width, h: info.height, bottom, top };
}

// gather: [{ anim, dir, frames: [loaded…] }]
const groups = [];
groups.push(...(await Promise.all(DIRS.filter((d) => state.frames.rotations[d]).map(async (dir) => ({ anim: 'idle', dir, frames: [await load(state.frames.rotations[dir])] })))));
for (const [anim, byDir] of Object.entries(state.frames.animations)) {
  for (const [dir, list] of Object.entries(byDir)) {
    const frames = [];
    list.forEach((rel, i) => {
      if (!skip.has(`${anim}/${dir}/${i}`)) frames.push(rel);
    });
    groups.push({ anim, dir, frames: await Promise.all(frames.map(load)) });
  }
}

const cell = Math.max(...groups.flatMap((g) => g.frames.map((f) => Math.max(f.w, f.h))));
const feet = cell - 6; // every animation's feet land on this row
const cols = 16;
const total = groups.reduce((n, g) => n + g.frames.length, 0);
const rows = Math.ceil(total / cols);
const composites = [];
const anims = {};
let top = cell;
let head = cell; // the top of the head standing still (idle, south): the character's height
let i = 0;
for (const g of groups) {
  const lift = g.frames[0].bottom; // the first frame's feet set this animation's line
  const ids = [];
  for (const f of g.frames) {
    const left = (i % cols) * cell + Math.round((cell - f.w) / 2);
    const dy = feet - lift;
    composites.push({ input: f.data, raw: { width: f.w, height: f.h, channels: 4 }, left, top: Math.floor(i / cols) * cell + dy });
    top = Math.min(top, f.top + dy);
    if (g.anim === 'idle' && g.dir === 'south') head = f.top + dy;
    ids.push(i++);
  }
  (anims[g.anim] ??= {})[g.dir] = ids;
}

const sheet = path.join(OUT, `${name}.png`);
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites)
  .png({ palette: true, colours: 256, effort: 10 })
  .toFile(sheet);
const layout = { source: `PixelLab character ${meta.group_id || ''}`.trim(), cell, feet, top, head, cols, rows, anims };
fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(layout, null, 1)}\n`);
console.log(`${name}: ${total} frames in ${cols}×${rows} cells of ${cell} px → ${path.relative(process.cwd(), sheet)} (${(fs.statSync(sheet).size / 1024).toFixed(0)} KB); feet row ${feet}, head row ${head} (highest pixel ${top})`);
for (const [a, byDir] of Object.entries(anims)) console.log(`  ${a}: ${Object.entries(byDir).map(([d, l]) => `${d} ${l.length}`).join(', ')}`);
