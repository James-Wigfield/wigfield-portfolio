/* Collections on this phone (CONTRACTS.md 7): groups of spots and whole places ("Joe's House",
   "USA 2026"). The server's list, plus any made on this phone that are still in the outbox,
   plus a copy of the last list in localStorage, so capture's picker works with no signal.

   A spot's collection is its own `collectionId`, else its place's (a room of a whole place shows
   under the place's collection unless the room sets its own): effectiveCollection(). */

import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { addCollection, pendingCollections } from './outbox.js';
import { readLocal, writeLocal } from './storage.js';
import { useOutbox } from './useOutbox.js';
import { newId } from './uuid.js';

const CACHE_KEY = 'mr:collections';
const LAST_KEY = 'mr:lastCollection';
/** "No collection", as remembered and as a picker value (a collection id is a uuid, never this). */
export const NONE = 'none';

function readCache() {
  try {
    const v = JSON.parse(readLocal(CACHE_KEY, '[]'));
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string') : [];
  } catch {
    return [];
  }
}

const bySort = (a, b) =>
  (a.sort ?? Infinity) - (b.sort ?? Infinity) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id);

/** The collection picked last on this phone: an id, NONE, or null (never picked). */
export function lastCollection() {
  const v = readLocal(LAST_KEY);
  return v === NONE || /^[0-9a-f-]{36}$/i.test(v || '') ? v : null;
}
export function rememberCollection(id) {
  writeLocal(LAST_KEY, id || NONE);
}

/** The collection a spot shows under: its own, else its place's (placesById: Map id → place). */
export function effectiveCollection(spot, placesById) {
  if (spot?.collectionId) return spot.collectionId;
  const place = spot?.buildingId ? placesById?.get(spot.buildingId) : null;
  return place?.collectionId || null;
}

/** Every collection known here: { collections (sorted), status: 'loading'|'ok'|'offline', reload }. */
export function useCollections() {
  const [state, setState] = useState(() => ({ status: 'loading', server: readCache(), pending: [] }));
  const [tick, setTick] = useState(0);
  const { completed } = useOutbox();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [server, pending] = await Promise.allSettled([api.listCollections(), pendingCollections()]);
      if (!alive) return;
      const waiting = pending.status === 'fulfilled' ? pending.value : [];
      if (server.status === 'fulfilled') {
        const list = server.value || [];
        writeLocal(CACHE_KEY, JSON.stringify(list));
        setState({ status: 'ok', server: list, pending: waiting });
      } else {
        // no signal, or a Worker / database without collections yet: the last list this phone saw
        setState((s) => ({ status: 'offline', server: s.server, pending: waiting }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [completed, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const ids = new Set(state.server.map((c) => c.id));
  const collections = [...state.server, ...state.pending.filter((c) => !ids.has(c.id)).map((c) => ({ ...c, local: true }))].sort(bySort);
  return { collections, status: state.status, reload };
}

/**
 * A new collection, made on this phone: queued in the outbox (it goes up before the capture that names it, and
 * waits for signal like one) and returned at once, so the picker can select it.
 */
export async function createCollectionQueued(name) {
  const c = { id: newId(), name: String(name).trim().slice(0, 60), createdAt: new Date().toISOString() };
  await addCollection(c);
  return c;
}

/** A new collection, made now on the server (edit page, sidebar: they need signal anyway). */
export async function createCollectionNow(name) {
  return api.saveCollection({ id: newId(), name: String(name).trim().slice(0, 60) });
}
