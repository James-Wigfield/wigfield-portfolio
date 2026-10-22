/* ============================================================================
   GRADIENT ARCADE — PERSISTENCE
   ----------------------------------------------------------------------------
   Everything the arcade remembers lives in localStorage under the `dla:`
   prefix, behind this one file. Every read and write is wrapped in try/catch:
   a private window, blocked site data or a full quota must never break a
   game — the arcade just forgets.

   Keys (schema VERSION 1):
     dla:v         number                       schema version
     dla:profile   { xp, streak: { count, last }, bests: { [gameId]: { [level]: { score, maxScore, at } } },
                     plays: { [gameId]: n }, rounds }
     dla:boxes     { [conceptId]: { box, due, seen, right, wrong, last } }   Leitner state (core/scheduler.js)
     dla:history   [{ at, gameId, mode, level, score, maxScore }]           newest first, capped
     dla:settings  { muted, introSeen: { [gameId]: true }, reduced }
     dla:mix       { date, plan, done: [...], results: [...] }              today's Daily Mix in progress
     dla:exam      { at, plan, done, results }                              an exam in progress

   The API is a tiny repository (get/set per record) so moving it to Supabase
   later is mechanical: swap the body of load/save for a table round-trip and
   keep the accessors.
   ========================================================================== */

const PREFIX = 'dla:';
export const VERSION = 1;

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable */
  }
}

// Run once per session: bump the schema if an older one is found.
export function migrate() {
  const v = load('v', 0);
  if (v === VERSION) return;
  // v0 → v1: nothing stored before v1 existed
  save('v', VERSION);
}

/* ── typed accessors (shape-checked on read so bad data is dropped, not trusted) */
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);

export const EMPTY_PROFILE = { xp: 0, streak: { count: 0, last: '' }, bests: {}, plays: {}, rounds: 0 };

export function getProfile() {
  const p = obj(load('profile', null));
  if (!p) return { ...EMPTY_PROFILE, streak: { ...EMPTY_PROFILE.streak } };
  return {
    xp: Number.isFinite(p.xp) ? p.xp : 0,
    streak: obj(p.streak) ? { count: Number(p.streak.count) || 0, last: typeof p.streak.last === 'string' ? p.streak.last : '' } : { count: 0, last: '' },
    bests: obj(p.bests) ?? {},
    plays: obj(p.plays) ?? {},
    rounds: Number(p.rounds) || 0,
  };
}
export const setProfile = (p) => save('profile', p);

export function getBoxes() {
  const b = obj(load('boxes', null)) ?? {};
  const out = {};
  Object.entries(b).forEach(([id, s]) => {
    if (obj(s) && Number.isFinite(s.box)) out[id] = { box: s.box, due: s.due ?? '', seen: s.seen ?? 0, right: s.right ?? 0, wrong: s.wrong ?? 0, last: s.last ?? '' };
  });
  return out;
}
export const setBoxes = (b) => save('boxes', b);

export const HISTORY_CAP = 100;
export function getHistory() {
  const h = load('history', []);
  return Array.isArray(h) ? h.filter(obj).slice(0, HISTORY_CAP) : [];
}
export function pushHistory(entry) {
  const h = [entry, ...getHistory()].slice(0, HISTORY_CAP);
  save('history', h);
  return h;
}

export const DEFAULT_SETTINGS = { muted: false, introSeen: {} };
export function getSettings() {
  const s = obj(load('settings', null));
  return s ? { muted: !!s.muted, introSeen: obj(s.introSeen) ?? {} } : { ...DEFAULT_SETTINGS, introSeen: {} };
}
export const setSettings = (s) => save('settings', s);

export const getMix = () => obj(load('mix', null));
export const setMix = (m) => (m ? save('mix', m) : remove('mix'));
export const getExam = () => obj(load('exam', null));
export const setExam = (e) => (e ? save('exam', e) : remove('exam'));

// Wipe everything (a "reset progress" button, and the headless check).
export function resetAll() {
  ['profile', 'boxes', 'history', 'settings', 'mix', 'exam'].forEach(remove);
  save('v', VERSION);
}
