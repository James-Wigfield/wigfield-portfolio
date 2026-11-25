/* Small React hooks for Dream Rooms. Layout lives in dream-rooms.css; these only carry state. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api.js';
import { confirmAuth } from './auth.js';
import { getOutboxSnapshot, rememberList, subscribeOutbox } from './outbox.js';

/** The outbox's state (lib/outbox.js). */
export function useOutbox() {
  return useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getOutboxSnapshot);
}

/**
 * The lean list (GET /api/dreams), archive order. { rows, error, loading, reload, setRows }.
 * A good answer also refreshes the numbers the phone keeps for numbering a night's next dream.
 */
export function useDreamList() {
  const [res, setRes] = useState({ rows: null, error: null, n: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.list({ signal: ctrl.signal }).then(
      (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setRes((r) => ({ rows: list, error: null, n: r.n + 1 }));
        rememberList(list).catch(() => {});
      },
      (error) => {
        if (error?.name === 'AbortError') return;
        confirmAuth(error).then((gated) => {
          if (!gated) setRes((r) => ({ rows: r.rows, error, n: r.n + 1 }));
        });
      },
    );
    return () => ctrl.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  const setRows = useCallback((fn) => setRes((r) => ({ ...r, rows: typeof fn === 'function' ? fn(r.rows) : fn })), []);
  return { rows: res.rows, error: res.error, loading: res.rows === null && !res.error, reload, setRows };
}

/** Adds <meta>/<link> tags to <head> while mounted: [{ tag: 'meta'|'link', ...attributes }]. */
export function useHeadTags(tags) {
  const key = JSON.stringify(tags);
  useEffect(() => {
    const els = JSON.parse(key).map(({ tag, ...attrs }) => {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.dataset.dr = 'head';
      document.head.appendChild(el);
      return el;
    });
    return () => els.forEach((el) => el.remove());
  }, [key]);
}

/** True while the user asks for reduced motion. */
export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener?.('change', cb);
      return () => mq?.removeEventListener?.('change', cb);
    },
    () => Boolean(window.matchMedia?.(query).matches),
    () => false,
  );
}

let webgl = null;
/** Whether this browser can draw WebGL at all (checked once, the test context released). */
export function canUseWebGL() {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webgl = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/**
 * The visual viewport (the part above an open phone keyboard): { height, top } in px, or null
 * where the API doesn't exist. Capture sizes itself to it so Save stays above the keyboard.
 */
export function useVisualViewport() {
  const [vv, setVv] = useState(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVv({ height: Math.round(v.height), top: Math.round(v.offsetTop) }));
    };
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
    };
  }, []);
  return vv;
}
