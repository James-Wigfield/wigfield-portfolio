/* The map model: model/map.glb, a small copy of room.glb for the /memories map, where a room
   stands as a diorama a couple of hundred pixels across (src/memory-rooms/map/mapbox/models3d.js).

     - baked atlases shrunk to MAP_TEXTURE_PX (WebP), since 2048 px is wasted at that size
     - geometry quantised and meshopt-compressed (EXT_meshopt_compression + KHR_mesh_quantization;
       three's GLTFLoader decodes it with its bundled MeshoptDecoder)
     - everything else unchanged: node names (walls, ceiling, obj__…), materials and their name
       prefixes (glass…, emit…), the scene frame (CONTRACTS.md §4)

   Made by bake.mjs after the bake, by push.mjs when it's missing or older than room.glb, and by
   backfill-map-assets.mjs for spots already pushed. Node only (glTF-Transform + meshoptimizer),
   so it can be made from a stored room.glb without Blender. */

import fs from 'node:fs';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

/** Longest edge of a map model's textures, px. */
export const MAP_TEXTURE_PX = 512;

let io = null;
async function getIO() {
  if (!io) {
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

const nodeNames = (doc) =>
  doc
    .getRoot()
    .listNodes()
    .map((n) => n.getName())
    .sort();

/** Every texture shrunk to fit MAP_TEXTURE_PX, re-encoded as WebP. (glTF-Transform's own
    textureCompress() trips over this sharp version's colourspace handling.) */
async function shrinkTextures(doc) {
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    const out = await sharp(Buffer.from(img))
      .resize({ width: MAP_TEXTURE_PX, height: MAP_TEXTURE_PX, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .webp({ quality: 86, effort: 5 })
      .toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType('image/webp');
    if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.\w+$/, '.webp'));
  }
}

/** room.glb (path or Buffer) → { buffer, bytes, sourceBytes } for map.glb. Throws if a node name was lost. */
export async function makeMapModel(room) {
  const input = Buffer.isBuffer(room) ? room : fs.readFileSync(room);
  const io = await getIO();
  const doc = await io.readBinary(new Uint8Array(input));
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const before = nodeNames(doc);
  await shrinkTextures(doc);
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const after = nodeNames(doc);
  const lost = before.filter((n) => n && !after.includes(n));
  if (lost.length) throw new Error(`map model lost node names: ${lost.slice(0, 5).join(', ')}`);
  const buffer = Buffer.from(await io.writeBinary(doc));
  return { buffer, bytes: buffer.length, sourceBytes: input.length };
}

/**
 * Write <work>/map.glb from <work>/room.glb when it's missing or older than room.glb.
 * → { path, bytes, made } or null without a room.glb.
 */
export async function ensureMapModelFile(workDir, { force = false } = {}) {
  const room = `${workDir}/room.glb`;
  const out = `${workDir}/map.glb`;
  if (!fs.existsSync(room)) return null;
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(room).mtimeMs) {
    return { path: out, bytes: fs.statSync(out).size, made: false };
  }
  const m = await makeMapModel(room);
  fs.writeFileSync(out, m.buffer);
  return { path: out, bytes: m.bytes, made: true };
}
