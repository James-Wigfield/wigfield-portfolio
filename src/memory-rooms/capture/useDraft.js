/* The capture being filled in, kept in IndexedDB as it grows (fields in
   `draft`, each processed photo in `draftPhotos`), so a reload, a crashed tab or
   iOS dropping the page while the camera is open loses nothing.

   save(who) moves it into the outbox in one transaction (lib/outbox.js). */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { get, getAll, put, del, write } from '../lib/idb.js';
import { addCapture } from '../lib/outbox.js';
import { writeLastLoc } from '../lib/storage.js';
import { newId } from '../lib/uuid.js';

export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 12;
export const MAX_SCAN_BYTES = 100 * 1024 * 1024;

const fresh = () => ({
  id: newId(),
  step: 0,
  kind: null,
  title: '',
  note: '',
  scaleHint: '',
  scalePreset: null,
  loc: null, // { lat, lng, accuracy, source: 'gps'|'pin'|'typed', label }
  photos: [], // { id, seq, url (thumb object URL), width, height, thumbWidth, thumbHeight, name }
  scan: null, // { name, size }
});

/** A plain in-memory copy of a Blob (one read out of IndexedDB is backed by the database's own file). */
async function inMemory(blob) {
  return new Blob([await blob.arrayBuffer()], { type: blob.type || 'image/jpeg' });
}

const META_KEYS = ['id', 'step', 'kind', 'title', 'note', 'scaleHint', 'scalePreset', 'loc', 'scan'];
const metaOf = (s) => Object.fromEntries(META_KEYS.map((k) => [k, s[k]]));
const isDirty = (s) => Boolean(s.kind || s.title || s.note || s.photos.length || s.scan || s.loc);

function reducer(state, a) {
  switch (a.type) {
    case 'loaded':
      return { ...a.draft, loaded: true, restored: a.restored };
    case 'set':
      return { ...state, ...a.patch };
    case 'update':
      return { ...state, ...a.fn(state) };
    case 'addPhoto':
      return { ...state, photos: [...state.photos, a.photo] };
    case 'removePhoto':
      return { ...state, photos: state.photos.filter((p) => p.id !== a.id) };
    case 'scan':
      return { ...state, scan: a.scan };
    case 'reset':
      return { ...fresh(), loaded: true, restored: false };
    default:
      return state;
  }
}

export function useDraft() {
  const [state, dispatch] = useReducer(reducer, null, () => ({ ...fresh(), loaded: false, restored: false }));
  const urls = useRef(new Set()); // object URLs to revoke
  const blobs = useRef(new Map()); // in-memory copy of this session's files (fallback if IndexedDB fails)
  const saving = useRef(false);

  const forgetFiles = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    blobs.current.clear();
  }, []);

  /* load (once) */
  useEffect(() => {
    let alive = true;
    (async () => {
      let draft = null;
      try {
        let meta = await get('draft', 'current');
        // Saved already (the draft clean-up after Save didn't finish): drop it, don't offer it twice.
        if (meta?.id && (await get('outbox', meta.id))) {
          await write(['draft', 'draftPhotos'], (w) => {
            w.clear('draft');
            w.clear('draftPhotos');
          }).catch(() => {});
          meta = null;
        }
        if (meta) {
          const rows = await getAll('draftPhotos');
          const photos = rows
            .filter((r) => r.id !== 'scan' && r.thumb)
            .sort((a, b) => a.seq - b.seq)
            .map((r) => ({
              id: r.id,
              seq: r.seq,
              url: URL.createObjectURL(r.thumb),
              width: r.width,
              height: r.height,
              thumbWidth: r.thumbWidth,
              thumbHeight: r.thumbHeight,
              name: r.name,
            }));
          const scanRow = rows.find((r) => r.id === 'scan');
          draft = { ...fresh(), ...meta, photos, scan: scanRow ? { name: scanRow.name, size: scanRow.size } : null };
        }
      } catch (err) {
        console.warn('[memory-rooms] could not restore the draft', err);
      }
      if (!alive) {
        draft?.photos.forEach((p) => URL.revokeObjectURL(p.url));
        return;
      }
      draft?.photos.forEach((p) => urls.current.add(p.url));
      dispatch({ type: 'loaded', draft: draft || fresh(), restored: Boolean(draft && isDirty(draft)) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => forgetFiles, [forgetFiles]);

  /* persist the fields (debounced; photos are written as they arrive) */
  const metaJson = state.loaded && isDirty(state) ? JSON.stringify({ key: 'current', ...metaOf(state) }) : null;
  useEffect(() => {
    if (!metaJson) return undefined;
    const t = setTimeout(() => {
      if (!saving.current) put('draft', JSON.parse(metaJson)).catch((err) => console.warn('[memory-rooms] draft', err));
    }, 250);
    return () => clearTimeout(t);
  }, [metaJson]);

  const set = useCallback((patch) => dispatch({ type: 'set', patch }), []);
  /** Functional update: fn(draft) → patch (for async results like a GPS fix). */
  const update = useCallback((fn) => dispatch({ type: 'update', fn }), []);

  const addPhoto = useCallback(async (p, name) => {
    const id = newId();
    const seq = Date.now() + Math.random();
    blobs.current.set(id, { photo: p.photo, thumb: p.thumb });
    try {
      await put('draftPhotos', { id, seq, name, photo: p.photo, thumb: p.thumb, width: p.width, height: p.height, thumbWidth: p.thumbWidth, thumbHeight: p.thumbHeight });
    } catch (err) {
      console.warn('[memory-rooms] photo kept in memory only', err);
    }
    const url = URL.createObjectURL(p.thumb);
    urls.current.add(url);
    dispatch({
      type: 'addPhoto',
      photo: { id, seq, url, width: p.width, height: p.height, thumbWidth: p.thumbWidth, thumbHeight: p.thumbHeight, name },
    });
  }, []);

  const removePhoto = useCallback((photo) => {
    dispatch({ type: 'removePhoto', id: photo.id });
    URL.revokeObjectURL(photo.url);
    urls.current.delete(photo.url);
    blobs.current.delete(photo.id);
    del('draftPhotos', photo.id).catch(() => {});
  }, []);

  const setScan = useCallback(async (file) => {
    blobs.current.set('scan', { blob: file });
    try {
      await put('draftPhotos', { id: 'scan', blob: file, name: file.name, size: file.size });
    } catch (err) {
      console.warn('[memory-rooms] scan kept in memory only', err);
    }
    dispatch({ type: 'scan', scan: { name: file.name, size: file.size } });
  }, []);

  const removeScan = useCallback(() => {
    blobs.current.delete('scan');
    del('draftPhotos', 'scan').catch(() => {});
    dispatch({ type: 'scan', scan: null });
  }, []);

  const reset = useCallback(async () => {
    saving.current = true;
    try {
      await write(['draft', 'draftPhotos'], (w) => {
        w.clear('draft');
        w.clear('draftPhotos');
      });
    } catch {
      /* nothing to clear */
    }
    forgetFiles();
    dispatch({ type: 'reset' });
    saving.current = false;
  }, [forgetFiles]);

  /** Moves the draft into the outbox. Resolves { id, title } once it's safely stored. */
  const save = useCallback(
    async (who) => {
      saving.current = true;
      try {
        // Prefer this session's in-memory files: re-storing files READ BACK from
        // IndexedDB is what hung Save on iOS Safari. Files that only exist in the
        // database (a draft restored after a reload) are copied into memory first.
        const needStored = state.photos.some((p) => !blobs.current.get(p.id)?.photo) || (state.scan && !blobs.current.get('scan'));
        let stored = new Map();
        if (needStored) {
          try {
            stored = new Map((await getAll('draftPhotos')).map((r) => [r.id, r]));
          } catch {
            /* nothing stored: use what's in memory */
          }
        }
        const pics = [];
        for (const p of state.photos) {
          const mem = blobs.current.get(p.id);
          if (mem?.photo && mem?.thumb) {
            pics.push({ ...p, ...mem });
            continue;
          }
          const row = stored.get(p.id);
          if (row?.photo && row?.thumb) pics.push({ ...p, ...row, photo: await inMemory(row.photo), thumb: await inMemory(row.thumb) });
        }
        const files = [
          ...pics.map((r, i) => ({ type: 'thumb', n: i + 1, blob: r.thumb, width: r.thumbWidth, height: r.thumbHeight, contentType: 'image/jpeg' })),
          ...pics.map((r, i) => ({ type: 'photo', n: i + 1, blob: r.photo, width: r.width, height: r.height, contentType: 'image/jpeg' })),
        ];
        const scan = blobs.current.get('scan')?.blob || (stored.get('scan')?.blob ? await inMemory(stored.get('scan').blob) : null);
        if (state.scan && scan) files.push({ type: 'scan', n: 'scan', blob: scan, contentType: 'application/octet-stream' });

        const loc = state.loc || {};
        const hasXY = Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
        const spot = {
          id: state.id,
          createdBy: who,
          kind: state.kind,
          title: state.title.trim(),
          note: state.note.trim(),
          lat: hasXY ? loc.lat : null,
          lng: hasXY ? loc.lng : null,
          locAccuracyM: hasXY && Number.isFinite(loc.accuracy) ? Math.round(loc.accuracy) : null,
          placeLabel: loc.label?.trim() || null,
          locSource: hasXY || loc.label ? loc.source || 'typed' : null,
          scaleHint: state.scaleHint.trim() || null,
          capturedAt: new Date().toISOString(),
        };
        await addCapture(spot, files);
        writeLastLoc(spot.lat, spot.lng);
        const thumbs = files.filter((f) => f.type === 'thumb').map((f) => f.blob);
        forgetFiles();
        dispatch({ type: 'reset' });
        return { id: spot.id, title: spot.title, files: files.length, thumbs };
      } finally {
        saving.current = false;
      }
    },
    [state, forgetFiles],
  );

  return { draft: state, set, update, addPhoto, removePhoto, setScan, removeScan, reset, save };
}
