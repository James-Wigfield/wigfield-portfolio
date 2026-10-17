/* ============================================================================
   BARISTA · TIMERS — follow-along countdowns that survive the background
   ----------------------------------------------------------------------------
   A timer is data, not a ticking counter:
     { id, label, kind: 'count' | 'elapsed', sec, step, startedAt,
       pausedAt, pausedMs, doneAt, bg, tip }
   Remaining time is always computed from wall-clock timestamps, so a tab
   left in the background (or a reload) comes back correct. Running timers
   persist to `bxi:timers:v1`.

   The clock is an external store (one 4 Hz ticker shared by every reader)
   so components never call Date.now() during render.
   ========================================================================== */

import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './careLog';

/* ── Shared clock ─────────────────────────────────────────────────────── */
let nowMs = Date.now();
const clockSubs = new Set();
let ticker = null;

function subscribeClock(fn) {
  clockSubs.add(fn);
  if (!ticker) {
    nowMs = Date.now();
    ticker = setInterval(() => {
      nowMs = Date.now();
      clockSubs.forEach((f) => f());
    }, 250);
  }
  return () => {
    clockSubs.delete(fn);
    if (!clockSubs.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

const noopSubscribe = () => () => {};
const getNow = () => nowMs;

/** Current time in ms, refreshed 4×/s while `live`. */
export function useNow(live = true) {
  return useSyncExternalStore(live ? subscribeClock : noopSubscribe, getNow, getNow);
}

/** Force a fresh reading (event handlers only — not during render). */
export const stamp = () => {
  nowMs = Date.now();
  return nowMs;
};

/* ── Timer store ──────────────────────────────────────────────────────── */
const KEY = 'bxi:timers:v1';
let timers = (() => {
  const t = readJSON(KEY, []);
  return Array.isArray(t) ? t : [];
})();
const subs = new Set();

function commit(next) {
  timers = next;
  writeJSON(KEY, timers);
  subs.forEach((f) => f());
}

function subscribeTimers(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

const getTimers = () => timers;

export function useTimerList() {
  return useSyncExternalStore(subscribeTimers, getTimers, getTimers);
}

export const getTimer = (id) => timers.find((t) => t.id === id) || null;

export function startTimer(spec, step) {
  const t = {
    id: spec.id,
    label: spec.label,
    kind: spec.kind === 'elapsed' ? 'elapsed' : 'count',
    sec: spec.sec || 0,
    step: step || null,
    bg: !!spec.bg,
    tip: !!spec.tip,
    startedAt: stamp(),
    pausedAt: null,
    pausedMs: 0,
    doneAt: null,
  };
  commit([...timers.filter((x) => x.id !== spec.id), t]);
  return t;
}

export function pauseTimer(id) {
  const now = stamp();
  commit(timers.map((t) => (t.id === id && !t.pausedAt && !t.doneAt ? { ...t, pausedAt: now } : t)));
}

export function resumeTimer(id) {
  const now = stamp();
  commit(
    timers.map((t) =>
      t.id === id && t.pausedAt ? { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null } : t,
    ),
  );
}

export function stopTimer(id) {
  commit(timers.filter((t) => t.id !== id));
}

export function markDone(id, at) {
  commit(timers.map((t) => (t.id === id ? { ...t, doneAt: at } : t)));
}

/* ── Maths ────────────────────────────────────────────────────────────── */
export function elapsedMs(t, now) {
  if (!t) return 0;
  const end = t.doneAt || t.pausedAt || now;
  return Math.max(0, end - t.startedAt - t.pausedMs);
}

export function remainingMs(t, now) {
  if (!t || t.kind === 'elapsed') return 0;
  return Math.max(0, t.sec * 1000 - elapsedMs(t, now));
}

export const isRunning = (t) => !!t && !t.pausedAt && !t.doneAt;

/** 125000 → "2:05"; elapsed-style "1:02:05" past an hour. */
export function clock(ms, { ceil = true } = {}) {
  const s = ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The "what you should see now" line for an elapsed time. */
export function seeLine(see, ms) {
  if (!see || !see.length) return '';
  const s = ms / 1000;
  let line = see[0][1];
  see.forEach(([at, text]) => {
    if (s >= at) line = text;
  });
  return line;
}

/* ── Alerts: a short beep + buzz, only when sound is on ──────────────── */
let audio = null;
export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    [0, 0.22].forEach((offset) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      const t0 = audio.currentTime + offset;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + 0.18);
    });
  } catch {
    /* no audio — silent */
  }
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* no vibration */
  }
}

/* ── Screen Wake Lock (feature-detected, silent when missing) ─────────── */
let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || document.hidden || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener?.('release', () => {
      lock = null;
    });
  } catch {
    lock = null;
  }
}

export function setWakeLock(on) {
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && lock) {
      lock.release().catch(() => {});
      lock = null;
    } else if (!document.hidden) acquire();
  });
}

export const wakeLockHeld = () => !!lock;
