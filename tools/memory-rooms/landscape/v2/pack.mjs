#!/usr/bin/env node
/* Pack a v2 landscape into ONE room.glb the spot page and the walk load like any spot's model.

     node tools/memory-rooms/landscape/v2/pack.mjs <work> [--out <file>]

   Takes <work>/build/props.glb (Blender: plant prototypes + sites) and adds every runtime data file from
   <work>/data/ (data.json's maps, the texture layers, the leaf atlas, plants.bin) as a byte accessor named
   `mrLand:<file>` (VEC4 / UNSIGNED_BYTE, zero-padded to 4 bytes), and puts in the glTF root extras:

     mrLandscape: { version: 1, meta: <data.json>, files: { '<file>': { accessor: 'mrLand:<file>', bytes } } }

   The browser (src/memory-rooms/landscape/Landscape.js fromGltf) reads them back with GLTFLoader's
   parser.getDependency('accessor', i). No new media type, no new upload path: it's still one room.glb.
   Default out: <work>/build/room.glb. Prints the size of every part. */

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const work = path.resolve(argv[0] || '');
const out = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(work, 'build', 'room.glb');
const dataDir = path.join(work, 'data');
const meta = JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));

const layers = Object.keys(meta.textures.tile);
const names = [
  'heights.png', 'splat.png', 'veg.png', 'water.png', 'shade.png', 'tex/waves.png', 'tex/leaves.png',
  ...layers.flatMap((l) => [`tex/${l}-a.png`, `tex/${l}-n.png`]),
  ...(meta.plants ? ['plants.bin'] : []),
];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(path.join(work, 'build', 'props.glb'));
// the props' geometry: welded, quantised, meshopt-compressed (three's GLTFLoader decodes it with MeshoptDecoder).
// Done BEFORE the data accessors go in, so only the meshes' buffers are touched.
await doc.transform(weld(), quantize({ quantizeColor: 8, quantizeNormal: 10, quantizePosition: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const root = doc.getRoot();
const buffer = root.listBuffers()[0] || doc.createBuffer();
const files = {};
let total = 0;
// smaller encodings: the data maps lossless (WebP), the texture layers lossy (their look survives it), the leaf
// atlas lossy with an exact alpha. plants.bin as is. The browser decodes by the MIME type recorded per file.
async function encode(name, raw) {
  if (!name.endsWith('.png')) return { bytes: raw, type: 'application/octet-stream' };
  const img = sharp(raw);
  if (/^tex\/.+-a\.png$/.test(name)) return { bytes: await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer(), type: 'image/jpeg' };
  if (/^tex\/(.+-n|waves)\.png$/.test(name)) return { bytes: await img.webp({ quality: 90, smartSubsample: true }).toBuffer(), type: 'image/webp' };
  if (name === 'tex/leaves.png') return { bytes: await img.webp({ quality: 88, alphaQuality: 100 }).toBuffer(), type: 'image/webp' };
  return { bytes: await img.webp({ lossless: true, effort: 6 }).toBuffer(), type: 'image/webp' };
}

for (const name of names) {
  const raw = fs.readFileSync(path.join(dataDir, name));
  const { bytes, type } = await encode(name, raw);
  const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
  padded.set(bytes);
  const accessor = `mrLand:${name}`;
  doc.createAccessor(accessor).setType('VEC4').setArray(padded).setBuffer(buffer);
  files[name] = { accessor, bytes: bytes.length, type };
  total += bytes.length;
  console.log(`  ${name.padEnd(22)} ${(raw.length / 1024).toFixed(0).padStart(6)} KB -> ${(bytes.length / 1024).toFixed(0).padStart(6)} KB ${type}`);
}
root.setExtras({ ...(root.getExtras() || {}), mrLandscape: { version: 1, meta, files } });
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
const size = fs.statSync(out).size;
console.log(`data ${(total / 1e6).toFixed(2)} MB + props → ${out} ${(size / 1e6).toFixed(2)} MB`);
