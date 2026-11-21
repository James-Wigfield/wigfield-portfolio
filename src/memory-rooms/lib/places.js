/* Whole places on this phone (CONTRACTS.md 6.4). A place is a building row on
   the server, but the phone must show its room checklist and edit its sketch
   with no signal, so every place captured or edited here also lives in the
   IndexedDB store `places`:

     { id, building: { …the fields as POSTed… }, sketch, localAt,
       files: [{ type: 'plan'|'photo'|'thumb', n }] }   (blobs stay in outboxFiles)

   usePlace(id) merges, newest first: the waiting outbox patch, the local record,
   the server row. Rooms captured = the server's spots with this buildingId plus
   room captures still in the outbox. */

import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { get, getAll, getByPrefix, put } from './idb.js';
import { addBuildingPatch, pendingPlace } from './outbox.js';
import { useOutbox } from './useOutbox.js';
import { mergeSketch } from '../building/sketch.js';
import { COPY } from '../copy.js';

/** A place's first sketch: one level, no rooms yet. */
export const emptySketch = () => ({ version: 1, levels: [{ id: 'ground', name: COPY.place.groundFloor }], rooms: [] });

export const getPlaceLocal = (id) => get('places', id);
export const listPlacesLocal = async () => (await getAll('places')).filter((r) => !String(r.id).startsWith('place-draft'));

export async function savePlaceLocal(record) {
  await put('places', { ...record, localAt: Date.now() });
}

/**
 * Save a new sketch: the local copy first (it shows at once), then the outbox PATCH. The rooms
 * this phone removed travel with it (`sketchRemoved`, never sent as such): the outbox merges the
 * sketch into the server's just before sending, so two phones' rooms never wipe each other.
 */
export async function saveSketch(id, sketch, title = '') {
  const local = (await getPlaceLocal(id)) || { id, building: null, files: [] };
  const before = new Set((local.sketch?.rooms || []).map((r) => r.id));
  for (const r of sketch.rooms) before.delete(r.id);
  const pending = await pendingPlace(id).catch(() => ({}));
  const removed = [...new Set([...(pending.patch?.sketchRemoved || []), ...before])].filter((rid) => !sketch.rooms.some((r) => r.id === rid));
  await savePlaceLocal({ ...local, sketch, sketchLocalOnly: false });
  await addBuildingPatch(id, { sketch, sketchRemoved: removed }, title);
}

/** An invalid sketch (rooms overlapping) stays on this phone only, and shows until it is fixed. */
export async function keepSketchLocal(id, sketch) {
  const local = (await getPlaceLocal(id)) || { id, building: null, files: [] };
  await savePlaceLocal({ ...local, sketch, sketchLocalOnly: true });
}

/** A place's own files still on this phone (not uploaded yet): [{ type, n, url }] (object URLs). */
export async function localPlaceFiles(id) {
  const rows = await getByPrefix('outboxFiles', `${id}|`);
  return rows
    .map((r) => {
      const [, type, n] = r.key.split('|');
      return r.blob ? { type, n: Number(n), url: URL.createObjectURL(r.blob) } : null;
    })
    .filter(Boolean);
}

/** Everything known about one place, from the server, this phone and the outbox (newest wins). */
async function readPlace(id) {
  const [local, pending, files] = await Promise.all([getPlaceLocal(id).catch(() => null), pendingPlace(id).catch(() => ({})), localPlaceFiles(id).catch(() => [])]);
  const [b, s] = await Promise.allSettled([api.getBuilding(id), api.listSpots()]);
  const server = b.status === 'fulfilled' ? b.value : null;
  const error = b.status === 'rejected' ? b.reason : s.status === 'rejected' ? s.reason : null;
  let spots;
  if (s.status === 'fulfilled') {
    spots = (s.value || []).filter((x) => x.buildingId === id && !x.deletedAt);
  } else {
    // offline: the rooms this phone last saw captured still count (never "to capture" again)
    spots = Object.entries(local?.rooms || {}).map(([roomId, spotId]) => ({ id: spotId, roomId, buildingId: id }));
  }
  const place = server || pending.create || local?.building || null;
  // the sketch: an invalid one kept on this phone > this phone's waiting edit on top of the server's >
  // the server's > the last one this phone saw
  let sketch;
  if (local?.sketchLocalOnly && local.sketch) sketch = local.sketch;
  else if (pending.patch?.sketch) sketch = mergeSketch(server?.sketch ?? null, pending.patch.sketch, pending.patch.sketchRemoved || []);
  else sketch = server?.sketch ?? local?.sketch ?? pending.create?.sketch ?? null;
  // remember what the server said, for the next time there's no signal
  if (server && (s.status === 'fulfilled' || !pending.patch)) {
    const rooms = s.status === 'fulfilled' ? Object.fromEntries(spots.filter((x) => x.roomId).map((x) => [x.roomId, x.id])) : local?.rooms || {};
    const next = { ...(local || { id, files: [] }), id, building: local?.building || null, rooms };
    if (!pending.patch && !local?.sketchLocalOnly && server.sketch) next.sketch = server.sketch;
    savePlaceLocal(next).catch(() => {});
  }
  return {
    status: place ? 'ok' : error?.status === 404 || !error ? 'missing' : 'error',
    place,
    server,
    sketch,
    spots,
    files,
    error,
  };
}

/** The place page's view of one place: { status, place, server, sketch, spots, files, queued, error, reload }. */
export function usePlace(id) {
  const [state, setState] = useState({ status: 'loading', place: null, sketch: null, spots: [], files: [], error: null });
  const [tick, setTick] = useState(0);
  const { completed, entries } = useOutbox();

  useEffect(() => {
    let alive = true;
    readPlace(id).then((next) => alive && setState(next));
    return () => {
      alive = false;
    };
  }, [id, completed, tick]);
  // object URLs of the local files go with the state that made them
  const files = state.files;
  useEffect(() => () => files.forEach((f) => f.url?.startsWith('blob:') && URL.revokeObjectURL(f.url)), [files]);

  // room captures still waiting in the outbox count as captured on this phone
  const queued = (entries || []).filter((e) => e.kind === 'spot' && e.state !== 'done' && e.buildingId === id);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, queued, reload };
}

/** Each checklist room's state: 'captured' (a spot has it), 'queued' (in the outbox), or 'todo'. */
export function roomStates(sketch, spots, queued = []) {
  const byRoom = new Map();
  for (const s of spots) if (s.roomId) byRoom.set(s.roomId, { state: 'captured', spot: s });
  for (const q of queued) if (q.roomId && !byRoom.has(q.roomId)) byRoom.set(q.roomId, { state: 'queued', entry: q });
  return (sketch?.rooms || []).map((r) => ({ room: r, ...(byRoom.get(r.id) || { state: 'todo' }) }));
}

/**
 * Every place for the map's index: the server's (live ones) plus any still only on this phone,
 * newest first: [{ id, title, placeLabel, sketch, local }]. A Worker without the building
 * routes (an old deploy) simply has none.
 */
export function usePlaces() {
  const [places, setPlaces] = useState([]);
  const { completed } = useOutbox();
  useEffect(() => {
    let alive = true;
    (async () => {
      const [server, local] = await Promise.all([api.listBuildings().catch(() => []), listPlacesLocal().catch(() => [])]);
      const byId = new Map();
      for (const b of server || []) if (!b.deletedAt) byId.set(b.id, { ...b, local: false });
      for (const r of local) {
        if (byId.has(r.id)) {
          // this phone's sketch only when it is newer than the server's row (an edit still going up)
          const srv = byId.get(r.id);
          const newer = r.sketchLocalOnly || (r.localAt && Date.parse(srv.updatedAt || 0) < r.localAt);
          if (r.sketch && newer) byId.set(r.id, { ...srv, sketch: r.sketch });
          continue;
        }
        if (r.building) byId.set(r.id, { ...r.building, id: r.id, sketch: r.sketch ?? r.building.sketch ?? null, local: true });
      }
      const list = [...byId.values()].sort((a, b) => String(b.capturedAt || b.createdAt || '').localeCompare(String(a.capturedAt || a.createdAt || '')));
      if (alive) setPlaces(list);
    })();
    return () => {
      alive = false;
    };
  }, [completed]);
  return places;
}

/** A place's name for a room's spot page ("Part of …"): the server's, else this phone's, else null. */
export function usePlaceTitle(id) {
  const [title, setTitle] = useState({ id: null, value: null });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    (async () => {
      const server = await api.getBuilding(id).catch(() => null);
      const local = server ? null : await getPlaceLocal(id).catch(() => null);
      if (alive) setTitle({ id, value: server?.title || local?.building?.title || null });
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  return title.id === id ? title.value : null;
}
