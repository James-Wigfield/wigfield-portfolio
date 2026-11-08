/* Zoom + pan state for an AtlasMap: container size (ResizeObserver), the view
   { k, cx, cy }, eased animated moves, and drag / pinch / wheel gestures.

   Until the user moves the map the view is "auto": `auto(size)` (e.g. fit to the
   spots), recomputed whenever the size or the spots change. The first drag, pinch,
   wheel or button turns it into an explicit view; "show everything" goes back to auto.

   Gestures only capture the pointer once it has moved, so taps on dots stay
   ordinary clicks; `wasDrag()` lets click handlers ignore the end of a drag. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HOME, MAX_K, MIN_K, baseScale, clampView, easeInOut, fitBox, transformOf, viewTween, zoomAround } from './zoom.js';

const local = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/** Starts a gesture from the pointers currently down (called on every pointer change). */
function restart(gesture, pointers, view) {
  gesture.current = {
    view,
    pts: new Map(Array.from(pointers.current, ([id, p]) => [id, { ...p }])),
    moved: gesture.current?.moved || false,
  };
}

/** Stops a running move (both the rAF loop and its fallback timer). */
function halt(anim) {
  cancelAnimationFrame(anim.current.raf);
  clearTimeout(anim.current.timer);
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * auto: a view, or (size) => view, used until the user moves the map (memoise it).
 * maxK: the closest zoom allowed for this map.
 */
export function useMapViewport({ auto = HOME, maxK = MAX_K } = {}) {
  const [el, setEl] = useState(null);
  const [svgEl, setSvgEl] = useState(null);
  const [size, setSize] = useState(null);
  const [view, setViewState] = useState(null); // null = auto
  const viewRef = useRef(null);
  const autoRef = useRef(HOME);
  const sizeRef = useRef(null);
  const anim = useRef({ raf: 0, timer: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);

  const autoView = useMemo(() => {
    if (typeof auto !== 'function') return clampView(auto, maxK);
    return size && size.w > 0 && size.h > 0 ? clampView(auto(size), maxK) : HOME;
  }, [auto, size, maxK]);
  useEffect(() => {
    autoRef.current = autoView;
  }, [autoView]);

  const clamp = useCallback((v) => clampView(v, maxK), [maxK]);

  const setView = useCallback((v) => {
    viewRef.current = v;
    setViewState(v);
  }, []);

  useEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const next = { w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) };
      sizeRef.current = next;
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  useEffect(() => () => halt(anim), []);

  /** Eased move to `target`; with backToAuto the view follows `auto` again afterwards. */
  const animateTo = useCallback(
    (target, { backToAuto = false } = {}) => {
      halt(anim);
      const to = clamp(target);
      const land = () => setView(backToAuto ? null : to);
      const sz = sizeRef.current;
      if (!sz || !sz.w || !sz.h || reducedMotion() || document.visibilityState === 'hidden') {
        land();
        return;
      }
      const tween = viewTween(viewRef.current ?? autoRef.current, to, sz);
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / tween.duration);
        if (t >= 1) {
          clearTimeout(anim.current.timer);
          land();
          return;
        }
        setView(tween.at(easeInOut(t)));
        anim.current.raf = requestAnimationFrame(tick);
      };
      anim.current.raf = requestAnimationFrame(tick);
      // If frames are throttled (background tab, battery saver), still land on the target.
      anim.current.timer = setTimeout(() => {
        cancelAnimationFrame(anim.current.raf);
        land();
      }, tween.duration + 250);
    },
    [setView, clamp],
  );

  const zoomBy = useCallback(
    (factor) => {
      if (!sizeRef.current) return;
      animateTo(zoomAround(viewRef.current ?? autoRef.current, sizeRef.current, factor, undefined, undefined, maxK));
    },
    [animateTo, maxK],
  );
  const reset = useCallback(() => animateTo(autoRef.current, { backToAuto: true }), [animateTo]);
  const fit = useCallback(
    (box, opts) => {
      if (!sizeRef.current) return null;
      const target = fitBox(box, sizeRef.current, { maxK, ...opts });
      animateTo(target);
      return target;
    },
    [animateTo, maxK],
  );
  const getView = useCallback(() => viewRef.current ?? autoRef.current, []);
  const wasDrag = useCallback(() => moved.current, []);

  /* ── gestures ─────────────────────────────────────────────────────────── */

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    halt(anim);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) {
      moved.current = false;
      gesture.current = null;
    }
    restart(gesture, pointers, viewRef.current ?? autoRef.current);
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!pointers.current.has(e.pointerId)) return;
      const sz = sizeRef.current;
      const g = gesture.current;
      if (!sz || !g) return;
      const pt = local(e);
      pointers.current.set(e.pointerId, pt);

      if (pointers.current.size === 1) {
        const a = g.pts.get(e.pointerId);
        if (!a) return;
        const dx = pt.x - a.x;
        const dy = pt.y - a.y;
        if (!g.moved && Math.hypot(dx, dy) < 6) return;
        if (!g.moved) {
          g.moved = true;
          moved.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
        }
        const { s } = transformOf(g.view, sz);
        setView(clamp({ k: g.view.k, cx: g.view.cx - dx / s, cy: g.view.cy - dy / s }));
        return;
      }

      const ids = Array.from(g.pts.keys()).filter((id) => pointers.current.has(id)).slice(0, 2);
      if (ids.length < 2) return;
      const [p1, p2] = ids.map((id) => g.pts.get(id));
      const [q1, q2] = ids.map((id) => pointers.current.get(id));
      const d0 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const d1 = Math.hypot(q2.x - q1.x, q2.y - q1.y) || 1;
      const m0 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const m1 = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };
      g.moved = true;
      moved.current = true;
      const t0 = transformOf(g.view, sz);
      const wx = (m0.x - t0.tx) / t0.s;
      const wy = (m0.y - t0.ty) / t0.s;
      const k = Math.min(maxK, Math.max(MIN_K, (g.view.k * d1) / d0));
      const s = baseScale(sz) * k;
      setView(clamp({ k, cx: wx - (m1.x - sz.w / 2) / s, cy: wy - (m1.y - sz.h / 2) / s }));
    },
    [setView, clamp, maxK],
  );

  const onPointerEnd = useCallback((e) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size) restart(gesture, pointers, viewRef.current ?? autoRef.current);
    else gesture.current = null;
  }, []);

  useEffect(() => {
    if (!svgEl) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      halt(anim);
      const sz = sizeRef.current;
      if (!sz) return;
      const r = svgEl.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.002));
      setView(zoomAround(viewRef.current ?? autoRef.current, sz, factor, e.clientX - r.left, e.clientY - r.top, maxK));
    };
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    return () => svgEl.removeEventListener('wheel', onWheel);
  }, [svgEl, setView, maxK]);

  const shown = view ?? autoView;
  const t = useMemo(() => (size && size.w > 0 && size.h > 0 ? transformOf(shown, size) : null), [shown, size]);

  return {
    setContainer: setEl,
    setSvg: setSvgEl,
    size,
    view: shown,
    isAuto: view === null,
    maxK,
    t,
    animateTo,
    zoomBy,
    reset,
    fit,
    getView,
    wasDrag,
    bind: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  };
}
