/* PROJECTOR LIFE — tiny UI helpers: per-viewer conveniences in localStorage
   (remembered tab, open groups, panel collapsed) and the stats hook.
   localStorage can throw (private mode, blocked site data), so every access
   is wrapped and the page works without it. */
import { useEffect, useState } from 'react';

const NS = 'pjl:';

export function loadPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — fine, it's a convenience */
  }
}

/** Live Stage stats (~4 Hz, plus forced emits on changes). null until ready. */
export function useStats(stage) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!stage) return undefined;
    const off = stage.subscribe(setS);
    return () => {
      off();
    };
  }, [stage]);
  return s;
}

/** prefers-reduced-motion, live. */
export function useReducedMotion() {
  const [rm, setRm] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const on = () => setRm(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return rm;
}

/** Element width via ResizeObserver (for layout decisions inside the stage). */
export function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`);
export const num = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
