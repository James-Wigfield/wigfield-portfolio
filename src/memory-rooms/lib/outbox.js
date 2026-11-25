/* The outbox: every saved capture lands in IndexedDB first and uploads from
   there, so a capture is never lost (no signal, tab closed, phone restarted).

   Upload order per entry: api.saveSpot (an upsert, safe to retry), then every
   thumb, every photo, then the optional scan; each file is flagged `uploaded`
   as it lands. Done entries stay ~24 h, then are pruned. Unsent ones never are.

   Four kinds of entry (CONTRACTS.md 6.4, 7), uploaded oldest first:
     spot             (kind absent) a capture: saveSpot + its photos / thumbs / scan
     building         a whole place: saveBuilding + its floor-plan photos and outside shots
     building-patch   a later change to a place (the sketch plan, its collection): one PATCH, the
                      newest edit replacing an older one still waiting (id `patch:<buildingId>`)
     collection       a collection made on this phone (capture's "New collection…"): one POST,
                      create once by its uuid (id `collection:<uuid>`), queued BEFORE the capture
                      that uses it, so it goes up first

   Triggers: right after a save, on `online`, when the tab becomes visible, on
   app load, and a backoff timer (5 s → 5 min) while anything is pending.
   A 401 stops the queue and sends the user to the gate (nothing is dropped);
   `resumeOutbox()` restarts it after a good password.

   React reads it through useOutbox() (useSyncExternalStore). */

import { api } from './api.js';
import { mergeSketch } from '../building/sketch.js';
import { signalUnauthorized } from './auth.js';
import { get, getAll, isVolatile, write } from './idb.js';

const KEEP_DONE_MS = 24 * 3600 * 1000;
const BACKOFF_MS = [5, 15, 30, 60, 120, 300].map((s) => s * 1000);

const fileKey = (id, type, n) => `${id}|${type}|${n}`;

/* ── observable state ──────────────────────────────────────────────────── */

let state = {
  entries: [], // summaries, oldest first: { id, title, total, uploaded, state, error, failed, createdAt, doneAt }
  pending: 0, // entries not yet done (incl. ones needing attention)
  running: false,
  current: null, // { id, index, total } while a file is going up
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  blocked: false, // got a 401; waiting for the gate
  failing: false, // last attempt hit a network/server error; a retry is scheduled
  retryAt: null,
  completed: 0, // bumps whenever an entry finishes (the map reloads on it)
  volatile: false, // IndexedDB unavailable: in-memory only
};
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribeOutbox = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getOutboxSnapshot = () => state;

const kindOf = (e) => e.kind || 'spot';
const entryTitle = (e) => e.spot?.title || e.building?.title || e.collection?.name || e.title || '';

function summarize(e) {
  const failed = e.files.filter((f) => f.error).length;
  return {
    id: e.id,
    kind: kindOf(e),
    title: entryTitle(e),
    buildingId: e.spot?.buildingId || e.building?.id || e.buildingId || null, // a room of a place, or the place
    roomId: e.spot?.roomId || null,
    total: e.files.length,
    uploaded: e.files.filter((f) => f.uploaded).length,
    state: e.state,
    error: e.error || null,
    // kept on this phone for now (the database isn't set up for whole places yet, or its place isn't up)
    held: e.state === 'pending' && e.held ? e.held : null,
    failed,
    createdAt: e.createdAt,
    doneAt: e.doneAt || null,
  };
}

async function refresh() {
  const rows = await getAll('outbox');
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const entries = rows.map(summarize);
  set({ entries, pending: entries.filter((e) => e.state !== 'done').length });
  return rows;
}

function patchSummary(entry) {
  const s = summarize(entry);
  set({ entries: state.entries.map((e) => (e.id === s.id ? s : e)) });
}

/* ── adding ────────────────────────────────────────────────────────────── */

let askedPersist = false;
function persistOnce() {
  if (askedPersist) return;
  askedPersist = true;
  try {
    navigator.storage?.persist?.()?.catch?.(() => {});
  } catch {
    /* not supported */
  }
}

/**
 * Puts a capture in the outbox (atomically clearing the draft it came from) and starts uploading.
 * files: [{ type: 'thumb'|'photo'|'scan', n, blob, width?, height?, contentType }]
 */
export async function addCapture(spot, files, { clearDraft = true } = {}) {
  const entry = {
    id: spot.id,
    spot,
    files: files.map((f) => ({
      type: f.type,
      n: f.n,
      width: f.width || null,
      height: f.height || null,
      contentType: f.contentType,
      bytes: f.blob.size,
      ...(f.exif ? { exif: f.exif } : {}), // a photo's EXIF (CONTRACTS.md 8): sent as x-exif with it
      uploaded: false,
    })),
    spotSaved: false,
    state: 'pending',
    error: null,
    attempts: 0,
    createdAt: Date.now(),
    doneAt: null,
  };
  // 1. The capture lands in the outbox (the commit point: from here it can't be lost).
  await write(['outbox', 'outboxFiles'], (w) => {
    w.put('outbox', entry);
    for (const f of files) w.put('outboxFiles', { key: fileKey(spot.id, f.type, f.n), blob: f.blob });
  });
  // 2. Then the draft is cleared in its OWN transaction. Clearing the stores the
  //    photos came from inside the same transaction that re-stores them made iOS
  //    Safari hang on Save. If this step fails, the draft is dropped on next load
  //    because its id is already in the outbox (useDraft).
  if (clearDraft) {
    await write(['draft', 'draftPhotos'], (w) => {
      w.clear('draft');
      w.clear('draftPhotos');
    }).catch((err) => console.warn('[memory-rooms] draft not cleared (it will be on next load)', err));
  }
  persistOnce();
  await refresh();
  kickOutbox();
  return entry.id;
}

/**
 * A whole place into the outbox: its row (POSTed once) and its files
 * ({ type: 'plan'|'photo'|'thumb', n, blob, width?, height?, contentType }).
 */
export async function addBuilding(building, files) {
  const entry = {
    id: building.id,
    kind: 'building',
    building,
    files: files.map((f) => ({ type: f.type, n: f.n, width: f.width || null, height: f.height || null, contentType: f.contentType, bytes: f.blob.size, uploaded: false })),
    spotSaved: false,
    state: 'pending',
    error: null,
    attempts: 0,
    createdAt: Date.now(),
    doneAt: null,
  };
  await write(['outbox', 'outboxFiles'], (w) => {
    w.put('outbox', entry);
    for (const f of files) w.put('outboxFiles', { key: fileKey(building.id, f.type, f.n), blob: f.blob });
  });
  persistOnce();
  await refresh();
  kickOutbox();
  return entry.id;
}

/**
 * A change to a place (e.g. its sketch) into the outbox. One waiting patch per place: a newer
 * edit merges into it (and keeps its place in the queue, after the place's own row).
 */
export async function addBuildingPatch(buildingId, patch, title = '') {
  const id = `patch:${buildingId}`;
  const prev = await get('outbox', id);
  const waiting = prev && prev.state !== 'done';
  const entry = {
    id,
    kind: 'building-patch',
    buildingId,
    title,
    patch: waiting ? { ...prev.patch, ...patch } : patch,
    files: [],
    spotSaved: false,
    state: 'pending',
    error: null,
    attempts: waiting ? prev.attempts : 0,
    createdAt: waiting ? prev.createdAt : Date.now(),
    doneAt: null,
  };
  await write('outbox', (w) => w.put('outbox', entry));
  await refresh();
  kickOutbox();
  return id;
}

/**
 * A collection made on this phone (it may have no signal) into the outbox: POSTed once, before the capture that
 * names it (entries go up oldest first). Its row is what the pickers show until the server has it.
 */
export async function addCollection(collection) {
  const entry = {
    id: `collection:${collection.id}`,
    kind: 'collection',
    collection,
    files: [],
    spotSaved: false,
    state: 'pending',
    error: null,
    attempts: 0,
    createdAt: Date.now(),
    doneAt: null,
  };
  await write('outbox', (w) => w.put('outbox', entry));
  persistOnce();
  await refresh();
  kickOutbox();
  return entry.id;
}

/** Collections still waiting in the outbox (made on this phone, not on the server yet). */
export async function pendingCollections() {
  const rows = await getAll('outbox');
  return rows.filter((e) => e.kind === 'collection' && e.state !== 'done').map((e) => e.collection);
}

/** Pending changes to one place, newest merged (what the place page shows before the server has it). */
export async function pendingPlace(buildingId) {
  const rows = await getAll('outbox');
  const create = rows.find((e) => e.kind === 'building' && e.id === buildingId && e.state !== 'done');
  const patch = rows.find((e) => e.kind === 'building-patch' && e.buildingId === buildingId && e.state !== 'done');
  return { create: create?.building || null, patch: patch?.patch || null };
}

/* ── uploading ─────────────────────────────────────────────────────────── */

let running = false;
let again = false;
let timer = null;
let failures = 0;

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    kickOutbox();
  }, ms);
  set({ retryAt: Date.now() + ms });
}

const isTransient = (status) => status === 0 || status === 404 || status === 408 || status === 429 || status >= 500;

function describe(err) {
  const details = Array.isArray(err?.details) ? `: ${err.details.join('; ')}` : '';
  return { status: err?.status ?? 0, message: `${err?.message || 'Upload failed'}${details}` };
}

/** Starts (or re-runs) the queue. Cheap to call often. */
export function kickOutbox() {
  if (state.blocked) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  clearTimeout(timer);
  timer = null;
  run().finally(() => {
    running = false;
    if (again) {
      again = false;
      kickOutbox();
    }
  });
}

async function run() {
  set({ running: true });
  try {
    if (navigator.locks?.request) {
      // One tab uploads at a time; another tab just looks again later.
      await navigator.locks.request('mr-outbox', { ifAvailable: true }, async (lock) => {
        if (lock) await drain();
        else schedule(5000);
      });
    } else {
      await drain();
    }
  } catch (err) {
    // IndexedDB trouble: never lose anything, just try again later.
    console.error('[memory-rooms] outbox', err);
    schedule(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]);
  } finally {
    set({ running: false, current: null });
  }
}

let heldAny = false;

async function drain() {
  heldAny = false;
  const rows = (await refresh()).filter((e) => e.state === 'pending');
  if (!rows.length) {
    failures = 0;
    set({ failing: false, retryAt: null });
    return;
  }
  if (navigator.onLine === false) {
    // The `online` event restarts us; the timer is a fallback for flaky onLine reporting.
    set({ online: false });
    schedule(BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]);
    return;
  }
  set({ online: true });
  for (const entry of rows) {
    const result = await uploadEntry(entry);
    if (result === 'stop') return;
  }
  failures = 0;
  set({ failing: false, retryAt: null });
  await refresh();
  // something is held (not the network's fault): look again in a while, without blocking anything
  if (heldAny) schedule(BACKOFF_MS[BACKOFF_MS.length - 1]);
}

/**
 * A place's later change. A sketch is merged into the server's just before it goes (two phones
 * sketching the same place keep each other's rooms), sent with the server's updatedAt so a write in
 * between is a 409 (held, merged again next round).
 */
async function sendPatch(entry) {
  const { sketchRemoved, ...patch } = entry.patch || {};
  if (patch.sketch) {
    const server = await api.getBuilding(entry.buildingId);
    patch.sketch = mergeSketch(server?.sketch ?? null, patch.sketch, sketchRemoved || []);
    if (server?.updatedAt) patch.ifUpdatedAt = server.updatedAt;
  }
  await api.patchBuilding(entry.buildingId, patch);
}

/** Held, not failed: the server can't take this entry YET (it uploads by itself later), the rest go on. */
function heldReason(kind, err) {
  if (err?.code === 'needs-sql') return 'needs-sql';
  if (kind === 'building' && err?.status === 404) return 'needs-sql'; // a Worker without the building routes
  if (kind === 'collection' && err?.status === 404) return 'needs-sql'; // a Worker without the collection routes
  if (kind === 'building-patch' && (err?.status === 404 || err?.status === 409)) return 'place-first';
  return null;
}

/** ms to wait for one request before treating it as a dropped connection. */
const timeoutFor = (bytes) => 60_000 + Math.round((bytes || 0) / 40); // ~40 KB/s floor

async function uploadEntry(entry) {
  const total = entry.files.length;
  const kind = kindOf(entry);
  try {
    if (!entry.spotSaved) {
      set({ current: { id: entry.id, index: 0, total } });
      if (kind === 'building') await api.saveBuilding(entry.building);
      else if (kind === 'collection') await api.saveCollection(entry.collection);
      else if (kind === 'building-patch') {
        const sent = JSON.stringify(entry.patch);
        await sendPatch(entry);
        // a newer edit merged into this entry while it was going up: leave it pending, it goes next
        const cur = await get('outbox', entry.id);
        if (cur && JSON.stringify(cur.patch) !== sent) {
          again = true;
          return 'next';
        }
      } else await api.saveSpot(entry.spot);
      entry.held = null;
      entry.spotSaved = true;
      entry.attempts += 1;
      await write('outbox', (w) => w.put('outbox', entry));
    }
    for (let i = 0; i < total; i++) {
      const f = entry.files[i];
      if (f.uploaded || f.error) continue;
      set({ current: { id: entry.id, index: i + 1, total } });
      const row = await get('outboxFiles', fileKey(entry.id, f.type, f.n));
      if (!row?.blob) {
        f.error = { status: 0, message: 'The file is missing from this phone' };
      } else {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutFor(f.bytes));
        try {
          const put = kind === 'building' ? api.putBuildingMedia : api.putMedia;
          await put(entry.id, f.type, f.n, row.blob, {
            width: f.width,
            height: f.height,
            contentType: f.contentType,
            signal: ctrl.signal,
            exif: f.exif || null,
          });
          f.uploaded = true;
        } catch (err) {
          if (err?.status === 401 || isTransient(err?.status ?? 0)) throw err;
          f.error = describe(err); // rejected for good (too big, wrong type): skip it, keep going
        } finally {
          clearTimeout(t);
        }
      }
      await write('outbox', (w) => w.put('outbox', entry));
      patchSummary(entry);
    }
    const failed = entry.files.filter((f) => f.error).length;
    if (failed) {
      entry.state = 'error';
      entry.error = { status: 0, message: `${failed} file${failed === 1 ? '' : 's'} could not be uploaded` };
    } else {
      entry.state = 'done';
      entry.doneAt = Date.now();
      entry.error = null;
    }
    await write('outbox', (w) => w.put('outbox', entry));
    failures = 0;
    set({ completed: state.completed + 1, failing: false });
    await refresh();
    return 'ok';
  } catch (err) {
    const status = err?.status ?? 0;
    if (status === 401) {
      set({ blocked: true, current: null });
      signalUnauthorized();
      return 'stop';
    }
    const held = heldReason(kind, err);
    if (held) {
      // only touch the counters: a patch entry may have a newer edit merged into it meanwhile
      const cur = (await get('outbox', entry.id)) || entry;
      cur.attempts = (cur.attempts || 0) + 1;
      cur.lastError = describe(err);
      cur.held = held;
      await write('outbox', (w) => w.put('outbox', cur));
      heldAny = true;
      await refresh();
      return 'next';
    }
    if (isTransient(status)) {
      if (status === 404) entry.spotSaved = false; // the spot row vanished: POST it again first
      entry.attempts += 1;
      entry.lastError = describe(err);
      await write('outbox', (w) => w.put('outbox', entry));
      failures += 1;
      set({ failing: true, online: navigator.onLine !== false });
      schedule(BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)]);
      return 'stop';
    }
    // The spot itself was rejected (400): needs attention, but carry on with the others.
    entry.state = 'error';
    entry.error = describe(err);
    await write('outbox', (w) => w.put('outbox', entry));
    await refresh();
    return 'next';
  }
}

/** Retry one entry (or every entry needing attention) now. */
export async function retryOutbox(id) {
  const rows = await getAll('outbox');
  const touched = rows.filter((e) => e.state === 'error' && (!id || e.id === id));
  if (touched.length) {
    await write('outbox', (w) => {
      for (const e of touched) {
        e.state = 'pending';
        e.error = null;
        e.files.forEach((f) => delete f.error);
        w.put('outbox', e);
      }
    });
  }
  failures = 0;
  set({ blocked: false });
  await refresh();
  kickOutbox();
}

/** After the gate accepts a password again. */
export function resumeOutbox() {
  set({ blocked: false });
  kickOutbox();
}

async function prune() {
  const old = (await getAll('outbox')).filter((e) => e.state === 'done' && e.doneAt && Date.now() - e.doneAt > KEEP_DONE_MS);
  if (!old.length) return;
  await write(['outbox', 'outboxFiles'], (w) => {
    for (const e of old) {
      w.del('outbox', e.id);
      w.delPrefix('outboxFiles', `${e.id}|`);
    }
  });
}

/* ── lifecycle (the shell starts it while a password is set) ───────────── */

let starts = 0;
const onOnline = () => {
  set({ online: true });
  failures = 0;
  kickOutbox();
};
const onOffline = () => set({ online: false });
const onVisible = () => {
  if (document.visibilityState === 'visible') {
    refresh().then(() => kickOutbox(), () => {});
  }
};

export function startOutbox() {
  starts += 1;
  if (starts === 1) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    set({ online: navigator.onLine !== false });
    isVolatile().then((v) => set({ volatile: v }));
    prune()
      .catch(() => {})
      .then(refresh)
      .then(() => kickOutbox())
      .catch((err) => console.error('[memory-rooms] outbox start', err));
  }
  return () => {
    starts -= 1;
    if (starts === 0) {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(timer);
      timer = null;
    }
  };
}
