/* The outbox: a saved dream lands in IndexedDB first and uploads from there, so a capture
   is never lost (no signal at 6 am, the tab killed, the phone restarted). Trimmed from
   Memory Rooms' outbox (src/memory-rooms/lib/outbox.js): one kind of entry, no files.

   - Each entry is one POST /api/dreams by its client uuid: create-once, so a retry can
     never duplicate it. Oldest first.
   - Confirmed (the server answers with the stored row, same id) → the phone's copy of the
     words is deleted, and only { id, dreamt_on, night_order } is kept (store `known`) to
     number the next dream of that night.
   - Triggers: right after a save, on `online`, when the tab becomes visible, on app load,
     and a backoff timer (5 s → 5 min) while anything is pending.
   - 401/404 (the API's answer to a wrong password): re-ping; if the password no longer
     works the queue pauses and the shell shows the gate (nothing is dropped);
     `resumeOutbox()` restarts it after a good password.
   - 400/409/413: that entry needs attention (kept on the phone, shown, retryable); the
     others carry on.

   React reads it through useOutbox() (lib/useOutbox.js). Never logs words (decision 14). */

import { api } from './api.js';
import { confirmAuth } from './auth.js';
import { getAll, isVolatile, write } from './idb.js';

const BACKOFF_MS = [5, 15, 30, 60, 120, 300].map((s) => s * 1000);

/* ── observable state ──────────────────────────────────────────────────── */

let state = {
  entries: [], // oldest first, no words: { id, dreamt_on, night_order, state, error, createdAt }
  pending: 0, // entries not yet confirmed (incl. ones needing attention)
  running: false,
  current: null, // the id going up right now
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  blocked: false, // the password stopped working; waiting for the gate
  failing: false, // the last attempt hit a network/server error; a retry is scheduled
  retryAt: null,
  sent: [], // ids confirmed during this session (newest last)
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

const summarize = (e) => ({
  id: e.id,
  dreamt_on: e.row?.dreamt_on || null,
  night_order: e.row?.night_order || null,
  state: e.state,
  error: e.error || null,
  createdAt: e.createdAt,
});

async function refresh() {
  const rows = await getAll('outbox');
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const entries = rows.map(summarize);
  set({ entries, pending: entries.length });
  return rows;
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
 * A saved dream into the outbox, clearing the draft it came from in the same transaction
 * (the commit point: from here it can't be lost), then starts uploading.
 * row: { id, dreamt_on, night_order, raw_text, created_at }
 */
export async function addDream(row, { clearDraft = true } = {}) {
  const entry = { id: row.id, row, state: 'pending', error: null, attempts: 0, createdAt: Date.now() };
  await write(clearDraft ? ['outbox', 'draft'] : 'outbox', (w) => {
    w.put('outbox', entry);
    if (clearDraft) w.del('draft', 'current');
  });
  persistOnce();
  await refresh();
  kickOutbox();
  return entry.id;
}

/** The next night_order for a night: one after any row this phone knows (sent or waiting), else 1. */
export async function nextNightOrder(dreamtOn) {
  const [known, waiting] = await Promise.all([getAll('known'), getAll('outbox')]);
  let max = 0;
  for (const k of known) if (k.dreamt_on === dreamtOn) max = Math.max(max, k.night_order || 0);
  for (const e of waiting) if (e.row?.dreamt_on === dreamtOn) max = Math.max(max, e.row.night_order || 0);
  return max + 1;
}

/** The server's list replaces what the phone knows (numbers only, never words). */
export async function rememberList(rows) {
  if (!Array.isArray(rows)) return;
  const now = Date.now();
  await write('known', (w) => {
    w.clear('known');
    for (const r of rows) if (r?.id && r.dreamt_on) w.put('known', { id: r.id, dreamt_on: r.dreamt_on, night_order: r.night_order || 0, at: now });
  });
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
      await navigator.locks.request('dr-outbox', { ifAvailable: true }, async (lock) => {
        if (lock) await drain();
        else schedule(5000);
      });
    } else {
      await drain();
    }
  } catch (err) {
    // IndexedDB trouble: never lose anything, just try again later (no words in the log).
    console.error('[dream-rooms] outbox', err?.name || 'error');
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
    const result = await upload(entry);
    if (result === 'stop') return;
  }
  failures = 0;
  set({ failing: false, retryAt: null });
  await refresh();
}

async function upload(entry) {
  set({ current: entry.id });
  try {
    const saved = await api.create(entry.row);
    if (!saved || saved.id !== entry.id) throw Object.assign(new Error('not confirmed'), { status: 0 });
    // Confirmed: the words leave the phone; only the numbers stay.
    await write(['outbox', 'known'], (w) => {
      w.del('outbox', entry.id);
      w.put('known', { id: saved.id, dreamt_on: saved.dreamt_on, night_order: saved.night_order || entry.row.night_order || 0, at: Date.now() });
    });
    failures = 0;
    set({ sent: [...state.sent.filter((id) => id !== entry.id), entry.id], failing: false });
    await refresh();
    return 'ok';
  } catch (err) {
    const status = err?.status ?? 0;
    if (status === 401 || status === 404) {
      set({ current: null });
      if (await confirmAuth(err)) {
        set({ blocked: true });
        return 'stop';
      }
    }
    if (isTransient(status)) {
      entry.attempts += 1;
      await write('outbox', (w) => w.put('outbox', entry));
      failures += 1;
      set({ failing: true, online: navigator.onLine !== false });
      schedule(BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)]);
      return 'stop';
    }
    // Rejected (400, 409, 413): needs attention, kept on the phone; carry on with the others.
    entry.state = 'error';
    entry.error = { status, message: err?.message || 'rejected' };
    await write('outbox', (w) => w.put('outbox', entry));
    await refresh();
    return 'next';
  }
}

/** Retry every entry needing attention now. */
export async function retryOutbox() {
  const rows = await getAll('outbox');
  const touched = rows.filter((e) => e.state === 'error');
  if (touched.length) {
    await write('outbox', (w) => {
      for (const e of touched) {
        e.state = 'pending';
        e.error = null;
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

/* ── lifecycle (the shell starts it while a password is set) ───────────── */

let starts = 0;
const onOnline = () => {
  set({ online: true });
  failures = 0;
  kickOutbox();
};
const onOffline = () => set({ online: false });
const onVisible = () => {
  if (document.visibilityState === 'visible') refresh().then(() => kickOutbox(), () => {});
};

export function startOutbox() {
  starts += 1;
  if (starts === 1) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    set({ online: navigator.onLine !== false });
    isVolatile().then((v) => set({ volatile: v }));
    refresh()
      .then(() => kickOutbox())
      .catch((err) => console.error('[dream-rooms] outbox start', err?.name || 'error'));
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
