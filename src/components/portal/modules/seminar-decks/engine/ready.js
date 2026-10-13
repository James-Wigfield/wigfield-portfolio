import { useSyncExternalStore } from 'react';
import uwaLogo from '../../../../../assets/portal/uwa-medical-physics.png';
import { deckMedia } from './sequence';
import { hasBlob, mediaPath, setBlob, MEDIA_BASE } from './media';
import { primeJson } from './hooks';

/* ============================================================================
   SEMINAR DECKS — READY CHECK (network robustness)
   ----------------------------------------------------------------------------
   The talk runs from the live site, so the room's Wi-Fi matters. The Ready
   check fetches every clip, hold frame, figure, data file and font a deck uses
   into memory and serves them from blob URLs (engine/media.js), loads each
   font face into the document (document.fonts keeps a loaded face), and
   imports every code chunk the talk needs. After it reports ready, the talk
   runs to the end with the network off.
   Status is per window and per deck: useReady(slug).
   ========================================================================== */

const status = new Map(); // slug -> { state, done, total, bytes, failed: [], fonts }
const sizes = new Map(); // media path -> bytes, for files already in memory
const listeners = new Set();
let ver = 0;
const emit = () => {
  ver += 1;
  listeners.forEach((l) => l());
};

export function useReady(slug) {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ver,
    () => ver,
  );
  return status.get(slug) ?? { state: 'idle', done: 0, total: 0, bytes: 0, failed: [] };
}

export function readyStatus(slug) {
  return status.get(slug) ?? { state: 'idle', done: 0, total: 0, bytes: 0, failed: [] };
}

// Fonts the engine's own screens use (presenter view, overlays), loaded for every deck.
const ENGINE_FONTS = ['fraunces-normal-400-700.woff2', 'hanken-normal-400-700.woff2', 'plexmono-normal-500.woff2', 'plexmono-normal-600.woff2'];
const ENGINE_FACES = [
  { family: 'SD Fraunces', weight: 600, style: 'normal' },
  { family: 'SD Hanken', weight: 400, style: 'normal' },
  { family: 'SD Plex Mono', weight: 500, style: 'normal' },
  { family: 'SD Plex Mono', weight: 600, style: 'normal' },
];

/** Code the talk needs after the network may have gone (lazy chunks). */
const CODE = [
  () => import('./PresentMode.jsx'),
  () => import('./PresenterView.jsx'),
];

async function fetchAsBlob(path) {
  const url = path.startsWith('/') ? path : `${MEDIA_BASE}${path}`;
  const res = await fetch(url, { cache: 'reload' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  return { blob, url };
}

export async function runReadyCheck(deck, { loadDeck } = {}) {
  const slug = deck.slug;
  const cur = status.get(slug);
  if (cur?.state === 'running') return cur;

  const paths = new Set([...deckMedia(deck), ...ENGINE_FONTS.map((f) => `fonts/${f}`)].map(mediaPath));
  [...paths].forEach((p) => {
    if (p.endsWith('.mp4')) paths.add(p.replace(/\.mp4$/, '.png'));
  });
  const list = [...paths];
  const s = { state: 'running', done: 0, total: list.length + 1, bytes: 0, failed: [], fonts: 0 };
  status.set(slug, s);
  emit();

  const queue = [...list, uwaLogo];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        if (hasBlob(p) && sizes.has(p)) {
          // Already in memory (another deck, or an earlier check): never replace
          // a blob a playing video may be using.
          s.bytes += sizes.get(p);
        } else {
          const { blob } = await fetchAsBlob(p);
          sizes.set(p, blob.size);
          s.bytes += blob.size;
          setBlob(p, URL.createObjectURL(blob));
        }
        if (p.startsWith('data/') && p.endsWith('.json')) primeJson(p);
      } catch (e) {
        s.failed.push(String(e.message ?? e));
      }
      s.done += 1;
      emit();
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  // Fonts: load every face the deck uses into the document.
  const faces = [...(deck.fontFaces ?? [])];
  ENGINE_FACES.forEach((f) => {
    if (!faces.some((x) => x.family === f.family && x.weight === f.weight && (x.style ?? 'normal') === f.style)) faces.push(f);
  });
  for (const f of faces) {
    try {
      const spec = `${f.style ?? 'normal'} ${f.weight ?? 400} 40px "${f.family}"`;
      const loaded = await document.fonts.load(spec, 'The 84.3% 0123456789 ABCxyz');
      if (loaded.length) s.fonts += 1;
      else s.failed.push(`font ${f.family} ${f.weight} ${f.style ?? ''}`);
    } catch (e) {
      s.failed.push(`font ${f.family}: ${e.message ?? e}`);
    }
  }

  // Code chunks.
  try {
    await Promise.all(CODE.map((c) => c()));
    if (loadDeck) await loadDeck();
  } catch (e) {
    s.failed.push(`code: ${e.message ?? e}`);
  }

  s.state = s.failed.length ? 'failed' : 'ready';
  emit();
  return s;
}

export const fmtMB = (b) => `${(b / (1024 * 1024)).toFixed(1)} MB`;
