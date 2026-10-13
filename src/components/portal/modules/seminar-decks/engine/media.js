/* ============================================================================
   SEMINAR DECKS — MEDIA
   ----------------------------------------------------------------------------
   Every clip, poster, figure, data file and font the decks use is a file under
   public/seminar-decks/ (copied there; nothing links into another folder).
   `mediaUrl('clips/case-a-1-scan.mp4')` returns the URL to put in a src: the
   network path normally, or an in-memory blob URL once the Ready check has
   fetched that file (so the talk keeps running if the room's Wi-Fi drops).

   The blob registry is per window (the audience window runs its own check).
   Components re-render when it changes through useMediaVersion().
   ========================================================================== */

import { useSyncExternalStore } from 'react';

export const MEDIA_BASE = '/seminar-decks/';

const blobs = new Map(); // path -> blob URL
const listeners = new Set();
let version = 0;

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export function subscribeMedia(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useMediaVersion() {
  return useSyncExternalStore(subscribeMedia, () => version, () => version);
}

/** Normalise 'clips/x.mp4' or '/seminar-decks/clips/x.mp4' to 'clips/x.mp4'. */
export function mediaPath(p) {
  return String(p).replace(/^\/?seminar-decks\//, '').replace(/^\/+/, '');
}

// ?failclips=1 points every clip at a missing file (gate G5: the poster must show).
const failClips = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('failclips') === '1';

export function mediaUrl(p) {
  const path = mediaPath(p);
  if (failClips && path.endsWith('.mp4')) return `${MEDIA_BASE}clips/__missing__.mp4`;
  return blobs.get(path) ?? `${MEDIA_BASE}${path}`;
}

/** An absolute URL (e.g. a bundled asset such as the logo), or its in-memory copy. */
export function resolveUrl(abs) {
  return blobs.get(mediaPath(abs)) ?? abs;
}

export function hasBlob(p) {
  return blobs.has(mediaPath(p));
}

export function setBlob(p, url) {
  const path = mediaPath(p);
  const old = blobs.get(path);
  if (old && old !== url) URL.revokeObjectURL(old);
  blobs.set(path, url);
  emit();
}

export function blobCount() {
  return blobs.size;
}

/** The poster (hold frame) of a clip: same name, .png. */
export function posterOf(clip) {
  return mediaPath(clip).replace(/\.mp4$/, '.png');
}

/** Clip shorthand: 'case-a-1-scan' -> 'clips/case-a-1-scan.mp4'. */
export function clipPath(name) {
  const n = mediaPath(name);
  if (n.includes('/')) return n.endsWith('.mp4') ? n : `${n}.mp4`;
  return `clips/${n.endsWith('.mp4') ? n : `${n}.mp4`}`;
}
