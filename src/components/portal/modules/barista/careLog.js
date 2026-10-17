/* ============================================================================
   BARISTA · CARE LOG — every persisted record, plus the date maths
   ----------------------------------------------------------------------------
   Keys (all versioned, all JSON):
     bxi:care-log:v1        { v, purchaseDate, lastCleanCycle, lastDescale,
                              filterInstalled, lastDeepClean, light, weeks }
     bxi:deep-clean:v1      { done: { stepId: iso }, at: stepIndex, branch }
     bxi:weekly:<ISO-week>  { ticks: { itemId: true } }
     bxi:restock:v1         { tablets, sachets, filters, seals }  (on hand)
     bxi:prefs:v1           { sound }
     bxi:timers:v1          [ running follow-along timers ]

   Every read and write is wrapped in try/catch. If storage throws (private
   mode, blocked site data) a module-level Map takes over, so the guide still
   works for the session — it just forgets on reload.

   Each record is a small store (get / set / subscribe) read through
   `useStore`, so every tab sees the same state without a context provider.

   SUPABASE: the care log is one row (`barista_care_log`, one per user) and
   weekly ticks are rows keyed by ISO week (`barista_weekly`). Swapping means
   replacing readJSON / writeJSON with portalApi-style async `{ data, error }`
   calls and hydrating the stores from them — the shapes stay as they are.
   ========================================================================== */

import { useSyncExternalStore } from 'react';

const memory = new Map();

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch {
    /* blocked — fall through to memory */
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function writeJSON(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked — memory keeps it for the session */
  }
}

/* ── Tiny shared stores ───────────────────────────────────────────────── */
function createStore(key, init) {
  let value;
  let loaded = false;
  const subs = new Set();
  const get = () => {
    if (!loaded) {
      value = init(readJSON(key, null));
      loaded = true;
    }
    return value;
  };
  const set = (next) => {
    value = typeof next === 'function' ? next(get()) : next;
    writeJSON(key, value);
    subs.forEach((fn) => fn());
  };
  const subscribe = (fn) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  return { key, get, set, subscribe };
}

const stores = new Map();
function keyedStore(key, init) {
  if (!stores.has(key)) stores.set(key, createStore(key, init));
  return stores.get(key);
}

/** Subscribe a component to a store. Returns [value, set]. */
export function useStore(store) {
  const value = useSyncExternalStore(store.subscribe, store.get, store.get);
  return [value, store.set];
}

/* ── Dates (local calendar days, stored as YYYY-MM-DD) ────────────────── */
const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayISO = () => toISO(new Date());

/** Calendar months, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso, n) {
  const d = fromISO(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}

export function daysBetween(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthName = (iso) => MONTHS[fromISO(iso).getMonth()];

export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  return fromISO(iso).toLocaleDateString('en-AU', opts);
}

/** ISO-8601 week key, e.g. "2026-W42" (weeks start Monday). */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/** The ISO week key `n` weeks before (negative) or after `date`. */
export function weekOffset(n, date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return isoWeek(d);
}

/** Monday of the ISO week containing `date`. */
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

/* ── The care log ─────────────────────────────────────────────────────── */
export const LOG_KEY = 'bxi:care-log:v1';

function freshLog() {
  // First open: assume the machine is about six months old (it was bought
  // roughly April 2026) and that the box filter went in at first use.
  const purchase = addMonths(todayISO(), -6);
  return {
    v: 1,
    purchaseDate: purchase,
    lastCleanCycle: null,
    lastDescale: null,
    filterInstalled: null,
    lastDeepClean: null,
    light: { state: 'off', at: null },
    weeks: {},
  };
}

export const logStore = createStore(LOG_KEY, (stored) => {
  if (stored && stored.v === 1) return { ...freshLog(), ...stored };
  const log = freshLog();
  writeJSON(LOG_KEY, log);
  return log;
});

/** Filter date to use when none was logged: the purchase (first use). */
export const filterDate = (log) => log.filterInstalled || log.purchaseDate;

/**
 * Status for the four gauges. Clean cycle and descale are driven by the
 * machine's light, so they report days since James did them and go red only
 * when he says the light is asking — no prediction.
 */
export function gauges(log, today = todayISO()) {
  const since = (iso) => (iso ? daysBetween(iso, today) : null);
  const deepFrom = log.lastDeepClean || log.purchaseDate;
  const deepDue = addMonths(deepFrom, 6);
  const fDate = filterDate(log);
  const filterDue = addMonths(fDate, 3);
  const span = (from, to) => Math.max(1, daysBetween(from, to));
  const light = log.light?.state || 'off';
  return [
    {
      id: 'deep',
      label: 'Deep clean',
      value: daysBetween(deepFrom, today) / span(deepFrom, deepDue),
      due: daysBetween(today, deepDue) <= 0,
      line: daysBetween(today, deepDue) <= 0 ? 'Due now' : `Due ${fmtDate(deepDue, { day: 'numeric', month: 'short' })}`,
      sub: log.lastDeepClean ? `Last ${fmtDate(log.lastDeepClean)}` : 'Never logged',
      src: 'This guide · six-monthly',
    },
    {
      id: 'filter',
      label: 'Water filter',
      value: daysBetween(fDate, today) / span(fDate, filterDue),
      due: daysBetween(today, filterDue) <= 0,
      line: daysBetween(today, filterDue) <= 0 ? 'Replace now' : `Due ${fmtDate(filterDue, { day: 'numeric', month: 'short' })}`,
      sub: log.filterInstalled ? `Fitted ${fmtDate(log.filterInstalled)}` : 'Assumed: fitted at first use',
      src: 'IB p.22 · every 3 months',
    },
    {
      id: 'cycle',
      label: 'Clean cycle',
      value: light === 'flash' ? 1 : Math.min(0.92, (since(log.lastCleanCycle) ?? 0) / 180),
      due: light === 'flash',
      line: light === 'flash' ? 'Light flashing — run it' : 'When the light flashes',
      sub: log.lastCleanCycle ? `Last ${fmtDate(log.lastCleanCycle)} · ${since(log.lastCleanCycle)} d` : 'Never logged',
      src: 'IB p.22 · machine decides',
    },
    {
      id: 'descale',
      label: 'Descale',
      value: light === 'solid' ? 1 : Math.min(0.92, (since(log.lastDescale) ?? 0) / 180),
      due: light === 'solid',
      line: light === 'solid' ? 'Light solid — descale' : 'When the light is solid',
      sub: log.lastDescale ? `Last ${fmtDate(log.lastDescale)} · ${since(log.lastDescale)} d` : 'Never logged',
      src: 'IB p.23 · machine decides',
    },
  ];
}

/** Write the dates a finished deep clean covers. */
export function completeDeepClean(log, { filterFitted, date = todayISO() } = {}) {
  return {
    ...log,
    lastDeepClean: date,
    lastCleanCycle: date,
    lastDescale: date,
    filterInstalled: filterFitted ? date : log.filterInstalled,
    light: { state: 'off', at: new Date().toISOString() },
  };
}

/* ── Deep-clean progress ──────────────────────────────────────────────── */
export const deepStore = createStore('bxi:deep-clean:v1', (s) => ({
  done: {},
  branch: {},
  ...(s || {}),
}));

/* ── Weekly checklist ─────────────────────────────────────────────────── */
export const weekStore = (key) => keyedStore(`bxi:weekly:${key}`, (s) => ({ ticks: {}, ...(s || {}) }));

/**
 * Consecutive completed ISO weeks, counting back from this week (or from last
 * week if this one isn't finished yet — the streak is still alive).
 */
export function streak(weeks, now = new Date()) {
  let n = 0;
  let offset = weeks[isoWeek(now)]?.complete ? 0 : -1;
  while (weeks[weekOffset(offset, now)]?.complete) {
    n += 1;
    offset -= 1;
  }
  return n;
}

/* ── Restock (what James has on hand) ─────────────────────────────────── */
export const restockStore = createStore('bxi:restock:v1', (s) => ({
  // The box: 2 tablets and 1 sachet (James's photo); no spare filter or seal.
  tablets: 2,
  sachets: 1,
  filters: 0,
  seals: 0,
  ...(s || {}),
}));

/* ── Preferences ──────────────────────────────────────────────────────── */
export const prefsStore = createStore('bxi:prefs:v1', (s) => ({ sound: false, ...(s || {}) }));
