/* The images rendered spots stand on the map as (both engines).

   A rendered spot's marker is its `render/marker` (renders/marker.png: the hero trimmed to
   its content, ≤ 240 px, made at bake/push time, tools/memory-rooms/lib/marker.mjs). A spot
   pushed before markers existed has only the 1600 × 1200 hero: that is trimmed and shrunk
   here, once per page session, and the result kept as a blob URL.

   Nothing loads until a marker is actually asked for (a spot on screen). Entries are keyed
   by the R2 key + size + date, not the URL, so the ~12 h signed links rotating doesn't
   reload anything. A failed load leaves the spot as a plain status dot. */

import { useSyncExternalStore } from 'react';
import { mediaNamed } from '../lib/api.js';

/** Long edge of a marker image, px (matches tools/memory-rooms/lib/marker.mjs). */
export const MARKER_PX = 240;
const ALPHA_CUT = 8;
const PROBE_PX = 400;

const cache = new Map();
const listeners = new Set();
let version = 0;
function bump() {
  version += 1;
  for (const l of listeners) l();
}

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getVersion = () => version;
/** Re-renders the caller whenever a marker image arrives (or fails). */
export const useMarkerImages = () => useSyncExternalStore(subscribe, getVersion);

/** Where a spot's marker comes from: { media, from: 'marker' | 'hero' }, or null (not rendered, no image). */
export function markerSource(spot) {
  if (spot?.status !== 'rendered') return null;
  const marker = mediaNamed(spot, 'render', 'marker');
  if (marker?.url) return { media: marker, from: 'marker' };
  const hero = mediaNamed(spot, 'render', 'hero');
  return hero?.url ? { media: hero, from: 'hero' } : null;
}

const keyOf = (m) => `${m.r2Key}|${m.bytes ?? ''}|${m.createdAt ?? ''}`;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });
}

async function loadMarker(media) {
  const img = await loadImage(media.url);
  return { url: media.url, w: img.naturalWidth, h: img.naturalHeight };
}

const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) });

/** The hero, trimmed to its content and shrunk to MARKER_PX, as a PNG blob URL (same-origin, so readable). */
async function shrinkHero(media) {
  const img = await loadImage(media.url);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  // 1. a small copy finds the content box from the alpha channel
  const s = Math.min(1, PROBE_PX / Math.max(W, H));
  const probe = canvasOf(W * s, H * s);
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0, probe.width, probe.height);
  const { data } = pctx.getImageData(0, 0, probe.width, probe.height);
  let x0 = probe.width;
  let y0 = probe.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < probe.height; y++) {
    for (let x = 0; x < probe.width; x++) {
      if (data[(y * probe.width + x) * 4 + 3] > ALPHA_CUT) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('empty hero');
  const sx = Math.max(0, (x0 - 1) / s);
  const sy = Math.max(0, (y0 - 1) / s);
  const sw = Math.min(W, (x1 + 2) / s) - sx;
  const sh = Math.min(H, (y1 + 2) / s) - sy;
  // 2. crop at twice the target, then halve: one big drawImage step aliases
  const k = Math.min(1, MARKER_PX / Math.max(sw, sh));
  const mid = canvasOf(sw * k * 2, sh * k * 2);
  const mctx = mid.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(img, sx, sy, sw, sh, 0, 0, mid.width, mid.height);
  const out = canvasOf(sw * k, sh * k);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(mid, 0, 0, out.width, out.height);
  mid.width = 0; // frees the backing store now, not at GC
  probe.width = 0;
  const blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
  return { url: URL.createObjectURL(blob), w: out.width, h: out.height };
}

// Heroes are 1600 × 1200 and a few MB: shrink them one at a time.
let heroQueue = Promise.resolve();
const queued = (fn) => {
  const run = heroQueue.then(fn, fn);
  heroQueue = run.catch(() => {});
  return run;
};

/**
 * The marker image for a spot, { url, w, h, from } once ready, else null. The first call
 * starts loading it; useMarkerImages() re-renders the caller when it arrives.
 */
export function markerImage(spot) {
  const src = markerSource(spot);
  if (!src) return null;
  const key = keyOf(src.media);
  let entry = cache.get(key);
  // a failed load gets another try once the spot comes back with a fresh signed link
  if (!entry || (entry.state === 'failed' && entry.tried !== src.media.url)) {
    entry = { state: 'loading', tried: src.media.url, from: src.from };
    cache.set(key, entry);
    const job = src.from === 'marker' ? loadMarker(src.media) : queued(() => shrinkHero(src.media));
    const e = entry;
    job.then(
      (img) => {
        Object.assign(e, img, { state: 'ready' });
        bump();
      },
      (err) => {
        e.state = 'failed';
        console.warn(`[memory-rooms] no map marker for "${spot.title}" (${src.from}):`, err?.message || err);
        bump();
      },
    );
  }
  return entry.state === 'ready' ? entry : null;
}
