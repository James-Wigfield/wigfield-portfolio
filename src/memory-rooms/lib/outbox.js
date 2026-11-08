/* The outbox: every saved capture lands in IndexedDB first and uploads from
   there, so a capture is never lost (no signal, tab closed, phone restarted).

   Upload order per entry: api.saveSpot (an upsert, safe to retry), then every
   thumb, every photo, then the optional scan; each file is flagged `uploaded`
   as it lands. Done entries stay ~24 h, then are pruned. Unsent ones never are.

   Triggers: right after a save, on `online`, when the tab becomes visible, on
   app load, and a backoff timer (5 s → 5 min) while anything is pending.
   A 401 stops the queue and sends the user to the gate (nothing is dropped);
   `resumeOutbox()` restarts it after a good password.

   React reads it through useOutbox() (useSyncExternalStore). */

import { api } from './api.js';
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

function summarize(e) {
  const failed = e.files.filter((f) => f.error).length;
  return {
    id: e.id,
    title: e.spot.title,
    total: e.files.length,
    uploaded: e.files.filter((f) => f.uploaded).length,
    state: e.state,
    error: e.error || null,
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
      uploaded: false,
    })),
    spotSaved: false,
    state: 'pending',
    error: null,
    attempts: 0,
    createdAt: Date.now(),
    doneAt: null,
  };
  const stores = clearDraft ? ['outbox', 'outboxFiles', 'draft', 'draftPhotos'] : ['outbox', 'outboxFiles'];
  await write(stores, (w) => {
    w.put('outbox', entry);
    for (const f of files) w.put('outboxFiles', { key: fileKey(spot.id, f.type, f.n), blob: f.blob });
    if (clearDraft) {
      w.clear('draft');
      w.clear('draftPhotos');
    }
  });
  persistOnce();
  await refresh();
  kickOutbox();
  return entry.id;
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

async function drain() {
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
}

/** ms to wait for one request before treating it as a dropped connection. */
const timeoutFor = (bytes) => 60_000 + Math.round((bytes || 0) / 40); // ~40 KB/s floor

async function uploadEntry(entry) {
  const total = entry.files.length;
  try {
    if (!entry.spotSaved) {
      set({ current: { id: entry.id, index: 0, total } });
      await api.saveSpot(entry.spot);
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
          await api.putMedia(entry.id, f.type, f.n, row.blob, {
            width: f.width,
            height: f.height,
            contentType: f.contentType,
            signal: ctrl.signal,
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
