import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { mediaUrl, useMediaVersion } from './media';

/* ============================================================================
   SEMINAR DECKS — SMALL HOOKS
   ========================================================================== */

const forcedReduced = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('reduced') === '1';

function subscribeReduced(cb) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** prefers-reduced-motion, or ?reduced=1 for testing. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => forcedReduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/** Fit a fixed logical canvas into a measured box (letterboxed, centred). */
export function useFit(w, h) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box.w && box.h ? Math.min(box.w / w, box.h / h) : 0;
  return { ref, s, left: (box.w - w * s) / 2, top: (box.h - h * s) / 2 };
}

/* JSON files under public/seminar-decks/data, cached per window. Fetched
   through mediaUrl so the Ready check's in-memory copy is used offline. */
const jsonCache = new Map();
const jsonListeners = new Set();
let jsonVersion = 0;

function loadJson(path) {
  if (jsonCache.has(path)) return;
  jsonCache.set(path, null);
  fetch(mediaUrl(path))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => {
      jsonCache.set(path, d);
      jsonVersion += 1;
      jsonListeners.forEach((l) => l());
    })
    .catch(() => {
      jsonCache.delete(path);
    });
}

export function useJson(path) {
  useMediaVersion();
  useSyncExternalStore(
    (l) => {
      jsonListeners.add(l);
      return () => jsonListeners.delete(l);
    },
    () => jsonVersion,
    () => jsonVersion,
  );
  if (!jsonCache.has(path)) loadJson(path);
  return jsonCache.get(path) ?? null;
}

/** Prime the JSON cache (Ready check). */
export function primeJson(path) {
  if (!jsonCache.get(path)) {
    jsonCache.delete(path);
    loadJson(path);
  }
}
