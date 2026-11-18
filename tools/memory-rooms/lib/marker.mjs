/* The map marker: renders/hero.png (1600 × 1200, transparent, the baked dollhouse view)
   trimmed to its content and shrunk to fit MARKER_PX, as a palette PNG with alpha.
   The /memories map draws it standing on the spot's location (src/memory-rooms/map/markers.js).

   Made by bake.mjs after the bake, by push.mjs when a work folder has a hero but no
   (or an older) marker, and by backfill-markers.mjs for spots already pushed. */

import fs from 'node:fs';
import sharp from 'sharp';

/** Long edge of the marker, px. The map shows it at up to ~120 CSS px. */
export const MARKER_PX = 240;
/** Alpha at or below this counts as background when trimming (anti-aliased edges stay). */
const ALPHA_CUT = 8;
const PAD = 2;

/** The bounding box of every pixel with alpha > ALPHA_CUT, or null for an empty image. */
async function contentBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * channels;
    for (let x = 0; x < w; x++) {
      if (data[row + x * channels + channels - 1] > ALPHA_CUT) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  // Content running into the frame (an exterior whose ground plate the hero camera cropped)
  // would give a hard-edged rectangle on the map: those edges get feathered.
  const cut = { left: x0 <= 1, top: y0 <= 1, right: x1 >= w - 2, bottom: y1 >= h - 2 };
  return { left, top, width: Math.min(w, x1 + PAD + 1) - left, height: Math.min(h, y1 + PAD + 1) - top, source: { w, h }, cut };
}

/** Share of the width/height over which a cut edge fades to nothing. */
const FEATHER = 0.16;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A w × h single-channel mask: 255 inside, fading to 0 toward each cut edge. */
function featherMask(w, h, cut) {
  const fx = Math.max(1, w * FEATHER);
  const fy = Math.max(1, h * FEATHER);
  const mask = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    let ay = 1;
    if (cut.top) ay = Math.min(ay, smooth((y + 0.5) / fy));
    if (cut.bottom) ay = Math.min(ay, smooth((h - y - 0.5) / fy));
    for (let x = 0; x < w; x++) {
      let a = ay;
      if (cut.left) a = Math.min(a, smooth((x + 0.5) / fx));
      if (cut.right) a = Math.min(a, smooth((w - x - 0.5) / fx));
      mask[y * w + x] = Math.round(a * 255);
    }
  }
  return mask;
}

/**
 * hero (path or Buffer) → { buffer, width, height, bytes, trimmed } for the marker PNG.
 * Throws if the hero is fully transparent.
 */
export async function makeMarker(hero) {
  const input = Buffer.isBuffer(hero) ? hero : fs.readFileSync(hero);
  const box = await contentBox(input);
  if (!box) throw new Error('the hero render is empty (fully transparent)');
  let { data, info } = await sharp(input)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .resize({ width: MARKER_PX, height: MARKER_PX, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const feathered = Object.values(box.cut).some(Boolean);
  if (feathered) {
    const mask = featherMask(info.width, info.height, box.cut);
    data = Buffer.from(data);
    for (let i = 0; i < mask.length; i++) data[i * 4 + 3] = Math.round((data[i * 4 + 3] * mask[i]) / 255);
  }
  const buffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ palette: true, quality: 92, effort: 8, compressionLevel: 9 })
    .toBuffer();
  return { buffer, width: info.width, height: info.height, bytes: buffer.length, trimmed: box, feathered };
}

/**
 * Write <renders>/marker.png from <renders>/hero.png when it's missing or older than the hero.
 * → the marker's { path, width, height, bytes } (made: false if it was already up to date), or null without a hero.
 */
export async function ensureMarkerFile(rendersDir, { force = false } = {}) {
  const hero = `${rendersDir}/hero.png`;
  const out = `${rendersDir}/marker.png`;
  if (!fs.existsSync(hero)) return null;
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(hero).mtimeMs) {
    const meta = await sharp(out).metadata();
    return { path: out, width: meta.width, height: meta.height, bytes: fs.statSync(out).size, made: false };
  }
  const m = await makeMarker(hero);
  fs.writeFileSync(out, m.buffer);
  return { path: out, width: m.width, height: m.height, bytes: m.bytes, made: true };
}
