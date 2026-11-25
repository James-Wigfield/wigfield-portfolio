/* The layout + viewpoint editor (CONTRACTS.md 8): help the render session place old photos.

   Outline: tap / click to drop corners (snapped to a 0.25 m grid, each edge's length live), tap the first corner
   to close it, drag a corner to move it, drag an edge's middle (+) to add a corner there, tap an edge to put a
   door or a window on it, or type the size ("about 4 × 3"). Viewpoints: drag a photo's thumbnail onto the plan
   (or, on a phone, tap the thumbnail then the plan): a wedge where he stood, its spread the photo's field of view
   (EXIF when known); drag its body to move it, its tip (or twist two fingers) to aim it; picking one shows the
   photo large beside the plan; exact / rough; remove; undo / redo. A viewpoint needs no outline.

   Feel: pointer events with pointer capture on the stage (touch-action: none: a drag never scrolls the page or
   pinches the browser), the dragged thing moved by writing its SVG attributes straight to the DOM (no React
   render per frame), committed on release; pan / zoom (drag the empty plan, wheel, two-finger pinch) as a CSS
   transform on the plan layer during the gesture. Keyboard: arrows nudge (Shift = 0.25 m), R / Shift+R turn,
   Delete removes, Ctrl+Z / Ctrl+Shift+Z, Esc. Hit targets ≥ 44 px on touch.

   value = { layout: capture.layout | null, views: capture.views | [] }; onChange(next) on every commit (the
   parent autosaves it). photos = [{ n, url (thumb), full?, width?, height?, exif? }]. guide = a faint outline
   (the rendered room, edit page); start = an outline to offer (the place's sketched room). */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { COPY } from '../../copy.js';
import { area, isSimple } from '../../scene/polygon.js';
import { photoFov } from '../freeform.js';
import {
  GRID,
  VIEW_STEP,
  aimOffset,
  bboxSize,
  defaultYaw,
  dist,
  edgeOf,
  fitOpening,
  fitView,
  insertCorner,
  openingEnds,
  parseSize,
  project,
  refitOpenings,
  removeCorner,
  scaleTo,
  snap,
  toPlan,
  toScreen,
  wedgePath,
  wedgeRotation,
  yawTo,
} from './geometry.js';
import './layout.css';

const SLOP = 6; // px before a press becomes a drag
const HISTORY = 80;

const coarse = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/** value → the editor's working document. */
function docOf(value) {
  const L = value?.layout || null;
  return {
    outline: L?.outline?.length >= 3 ? L.outline.map((p) => [...p]) : [],
    closed: L?.outline?.length >= 3,
    openings: (L?.openings || []).map((o) => ({ ...o })),
    sizeKnown: Boolean(L?.sizeKnown),
    views: (value?.views || []).map((v) => ({ ...v })),
  };
}
/** The working document → value (an outline only once it's closed). */
function valueOf(doc) {
  const layout = doc.closed && doc.outline.length >= 3 ? { outline: doc.outline, sizeKnown: doc.sizeKnown, openings: doc.openings } : null;
  return { layout, views: doc.views };
}

const fmtM = (m) => `${m < 10 ? m.toFixed(2).replace(/0$/, '') : m.toFixed(1)} m`;
const norm360 = (y) => ((Math.round(y * 10) / 10) % 360 + 360) % 360;

export default function LayoutEditor({ value, photos = [], guide = null, start = null, onChange, compact = false }) {
  const c = COPY.layout;
  const uid = useId();
  const [doc, setDoc] = useState(() => docOf(value));
  const docRef = useRef(doc); // kept in step by commit / undo / redo (the gestures read it)
  const hist = useRef({ past: [], future: [] });
  const [histN, setHistN] = useState({ past: 0, future: 0 });
  const [mode, setMode] = useState(() => (doc.views.length || doc.closed ? 'views' : 'outline'));
  const [sel, setSel] = useState(null); // { kind: 'corner'|'edge'|'opening'|'view', i?, photo? }
  const [pending, setPending] = useState(null); // a photo number waiting for a tap on the plan
  const [sizeText, setSizeText] = useState('');
  const [sizeErr, setSizeErr] = useState(null);
  const [touch] = useState(coarse);
  const [size, setSize] = useState(null);
  const [view, setViewState] = useState(null);
  const viewRef = useRef(null);
  const sizeRef = useRef(null);
  const setView = useCallback((v) => {
    viewRef.current = v;
    setViewState(v);
  }, []);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const ghostRef = useRef(null);
  const previewRef = useRef(null);
  const els = useRef({ outline: null, corners: [], labels: [], openings: [], wedges: new Map() });
  const gesture = useRef(null);
  const pointers = useRef(new Map());

  const photoOf = useCallback((n) => photos.find((p) => p.n === n) || null, [photos]);
  const fovOf = useCallback((n) => {
    const p = photoOf(n);
    return photoFov(p?.exif, { width: p?.width, height: p?.height }).deg;
  }, [photoOf]);

  /* ── the document: commit (undoable) ─────────────────────────────────────── */

  const commit = useCallback(
    (next, { keepFuture = false } = {}) => {
      const prev = docRef.current;
      hist.current.past.push(prev);
      if (hist.current.past.length > HISTORY) hist.current.past.shift();
      if (!keepFuture) hist.current.future = [];
      docRef.current = next;
      setDoc(next);
      setHistN({ past: hist.current.past.length, future: hist.current.future.length });
      onChange?.(valueOf(next));
    },
    [onChange],
  );
  const undo = useCallback(() => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(docRef.current);
    const prev = h.past.pop();
    docRef.current = prev;
    setDoc(prev);
    setSel(null);
    setHistN({ past: h.past.length, future: h.future.length });
    onChange?.(valueOf(prev));
  }, [onChange]);
  const redo = useCallback(() => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(docRef.current);
    const next = h.future.pop();
    docRef.current = next;
    setDoc(next);
    setSel(null);
    setHistN({ past: h.past.length, future: h.future.length });
    onChange?.(valueOf(next));
  }, [onChange]);

  /* ── size + the first view ───────────────────────────────────────────────── */

  /** The view that frames the outline, the viewpoints and the guide (d = the document to frame). */
  const frameFor = useCallback(
    (d, sz) => fitView([...d.outline, ...d.views.map((v) => [v.x, v.z]), ...(guide || []), ...(d.outline.length || d.views.length || guide?.length ? [] : start || [])], sz, { pad: touch ? 36 : 48 }),
    [guide, start, touch],
  );
  const frameRef = useRef(frameFor);
  useEffect(() => {
    frameRef.current = frameFor;
  }, [frameFor]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const next = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) };
      if (!next.w || !next.h) return;
      sizeRef.current = next;
      setSize((p) => (p && p.w === next.w && p.h === next.h ? p : next));
      // the first time it has a size: frame what there is
      if (!viewRef.current) setView(frameRef.current(docRef.current, next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setView]);
  const refit = (d = docRef.current) => sizeRef.current && setView(frameFor(d, sizeRef.current));

  const local = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  // gestures read the committed view from the ref; the render below draws with `view`
  const plan = (pt) => toPlan(viewRef.current, sizeRef.current, pt);
  const scr = (p) => toScreen(viewRef.current, sizeRef.current, p);
  const at = (p) => toScreen(view, size, p);
  const pathOf = (pts, closed, f) => (pts.length ? `M${pts.map((p) => f(p).map((v) => v.toFixed(1)).join(' ')).join(' L')}${closed ? ' Z' : ''}` : '');

  /* ── direct DOM paint during drags (no React render per frame) ───────────── */

  const paintOutline = (pts) => {
    const E = els.current;
    E.outline?.setAttribute('d', pathOf(pts, docRef.current.closed, scr));
    pts.forEach((p, i) => {
      const [x, y] = scr(p);
      E.corners[i]?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });
    if (docRef.current.closed) {
      pts.forEach((_, i) => {
        const [a, b] = edgeOf(pts, i);
        const lab = E.labels[i];
        if (!lab) return;
        const [x, y] = scr([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        lab.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        lab.querySelector('text').textContent = fmtM(dist(a, b));
      });
    }
  };
  const wedgeTransform = (v, f) => {
    const [x, y] = f([v.x, v.z]);
    return `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
  };
  const paintWedge = (v) => {
    const g = els.current.wedges.get(v.photo);
    if (!g) return;
    g.setAttribute('transform', wedgeTransform(v, scr));
    g.querySelector('[data-part="fan"]')?.setAttribute('transform', `rotate(${wedgeRotation(v.yaw)})`);
    const [ax, ay] = aimOffset(v.yaw, lenFor(viewRef.current));
    g.querySelector('[data-part="aim"]')?.setAttribute('transform', `translate(${ax.toFixed(1)} ${ay.toFixed(1)})`);
  };
  const paintOpening = (i, o, pts) => {
    const el = els.current.openings[i];
    if (!el) return;
    const [a, b] = openingEnds(pts, o).map(scr);
    el.querySelectorAll('line').forEach((l) => {
      l.setAttribute('x1', a[0]);
      l.setAttribute('y1', a[1]);
      l.setAttribute('x2', b[0]);
      l.setAttribute('y2', b[1]);
    });
  };

  const lenFor = (v) => (v ? Math.max(touch ? 58 : 46, Math.min(120, 1.1 * v.s)) : 50);
  const wedgeLen = lenFor(view);
  const bodyR = touch ? 16 : 13;

  /* ── adding a viewpoint ──────────────────────────────────────────────────── */

  const placeView = useCallback(
    (n, at) => {
      const d = docRef.current;
      const existing = d.views.find((v) => v.photo === n);
      const p = [snap(at[0], VIEW_STEP), snap(at[1], VIEW_STEP)];
      const v = existing ? { ...existing, x: p[0], z: p[1] } : { photo: n, x: p[0], z: p[1], yaw: norm360(defaultYaw(p, d.closed ? d.outline : null)), conf: 'rough' };
      commit({ ...d, views: [...d.views.filter((x) => x.photo !== n), v].sort((a, b) => a.photo - b.photo) });
      setSel({ kind: 'view', photo: n });
      setPending(null);
      setMode('views');
    },
    [commit],
  );

  /* ── the stage's pointer gestures ────────────────────────────────────────── */

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const g = gesture.current;
    if (g && (g.kind === 'view-body' || g.kind === 'view-aim') && g.photo) {
      // a finger on a wedge + a second finger: twist it
      const v = docRef.current.views.find((x) => x.photo === g.photo);
      gesture.current = { kind: 'twist', photo: g.photo, a0: Math.atan2(b[1] - a[1], b[0] - a[0]), yaw0: v.yaw, live: { ...v }, moved: true };
      return;
    }
    const m0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    gesture.current = { kind: 'pinch', d0: Math.max(10, dist(a, b)), m0, view0: viewRef.current, k: 1, m: m0, moved: true };
  };

  const onPointerDown = (e) => {
    if (!viewRef.current || !sizeRef.current) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    stageRef.current.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    stageRef.current.focus({ preventScroll: true });
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;
    const hit = e.target.closest?.('[data-role]')?.dataset || {};
    gesture.current = { kind: hit.role || 'bg', i: hit.i !== undefined ? Number(hit.i) : null, photo: hit.photo ? Number(hit.photo) : null, start: pt, moved: false, id: e.pointerId };
  };

  const onPointerMove = (e) => {
    if (!viewRef.current || !sizeRef.current) return;
    const pt = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    // hover: the next edge while drawing an outline
    if (!g) {
      const d = docRef.current;
      if (mode === 'outline' && !d.closed && d.outline.length && previewRef.current) {
        const last = scr(d.outline[d.outline.length - 1]);
        const p = scr(plan(pt).map((v) => snap(v)));
        previewRef.current.setAttribute('d', `M${last[0]} ${last[1]} L${p[0]} ${p[1]}`);
      }
      return;
    }
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      g.k = Math.max(0.2, Math.min(6, dist(a, b) / g.d0));
      g.m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      layerRef.current.style.transform = `translate(${g.m[0] - g.m0[0] * g.k}px, ${g.m[1] - g.m0[1] * g.k}px) scale(${g.k})`;
      return;
    }
    if (g.kind === 'twist') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.live.yaw = norm360(g.yaw0 - ((ang - g.a0) * 180) / Math.PI);
      paintWedge(g.live);
      return;
    }
    if (e.pointerId !== g.id) return;
    if (!g.moved && dist(pt, g.start) < SLOP) return;
    const d = docRef.current;
    if (!g.moved) {
      g.moved = true;
      // an edge's middle (+): a new corner there, dragged from now on
      if (g.kind === 'mid' && mode === 'outline' && d.closed) {
        const [a, b] = edgeOf(d.outline, g.i);
        const ins = insertCorner(d.outline, d.openings, g.i, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        commit({ ...d, ...ins });
        g.kind = 'corner';
        g.i += 1;
        g.inserted = true;
        return;
      }
      if (g.kind === 'view-body' || g.kind === 'view-aim') {
        const v = d.views.find((x) => x.photo === g.photo);
        g.live = v ? { ...v } : null;
        setSel({ kind: 'view', photo: g.photo });
      } else if (g.kind === 'corner' && mode === 'outline') {
        g.live = d.outline.map((p) => [...p]);
        setSel({ kind: 'corner', i: g.i });
      } else if (g.kind === 'opening' && mode === 'outline') {
        g.live = { ...d.openings[g.i] };
        setSel({ kind: 'opening', i: g.i });
      } else {
        g.kind = 'pan';
      }
    }
    const p = plan(pt);
    if (g.kind === 'corner' && g.live) {
      g.live[g.i] = [snap(p[0]), snap(p[1])];
      paintOutline(g.live);
    } else if (g.kind === 'opening' && g.live) {
      const [a, b] = edgeOf(d.outline, g.live.edge);
      const q = project(p, a, b);
      const L = dist(a, b);
      g.live = fitOpening(d.outline, { ...g.live, offset: snap(q.t * L - g.live.width / 2, 0.05) });
      paintOpening(g.i, g.live, d.outline);
    } else if (g.kind === 'view-body' && g.live) {
      g.live.x = snap(p[0], VIEW_STEP);
      g.live.z = snap(p[1], VIEW_STEP);
      paintWedge(g.live);
    } else if (g.kind === 'view-aim' && g.live) {
      g.live.yaw = norm360(Math.round(yawTo([g.live.x, g.live.z], p)));
      paintWedge(g.live);
    } else if (g.kind === 'pan') {
      layerRef.current.style.transform = `translate(${pt[0] - g.start[0]}px, ${pt[1] - g.start[1]}px)`;
      g.end = pt;
    }
  };

  const endGesture = (e, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch' || g.kind === 'twist') {
      if (pointers.current.size > 0) return; // wait for the last finger
      gesture.current = null;
      if (g.kind === 'pinch') {
        layerRef.current.style.transform = '';
        if (!cancelled) {
          const v0 = g.view0;
          const sz = sizeRef.current;
          const s = Math.max(6, Math.min(600, v0.s * g.k));
          const p0 = toPlan(v0, sz, g.m0);
          setView({ s, cx: p0[0] - (g.m[0] - sz.w / 2) / s, cz: p0[1] - (g.m[1] - sz.h / 2) / s });
        }
      } else if (!cancelled) {
        const d = docRef.current;
        commit({ ...d, views: d.views.map((v) => (v.photo === g.photo ? { ...g.live } : v)) });
      }
      return;
    }
    if (e.pointerId !== g.id) return;
    gesture.current = null;
    const d = docRef.current;
    if (cancelled) {
      layerRef.current.style.transform = '';
      if (g.live && g.kind === 'corner') paintOutline(d.outline);
      if (g.live && (g.kind === 'view-body' || g.kind === 'view-aim')) paintWedge(d.views.find((v) => v.photo === g.photo));
      return;
    }
    if (g.moved) {
      if (g.kind === 'corner' && g.live) {
        if (d.closed && (!isSimple(g.live, 0.05) || area(g.live) < 0.5)) {
          paintOutline(d.outline); // a corner can't fold the room over itself: back it goes
          if (g.inserted) undo();
          return;
        }
        commit({ ...d, outline: g.live, openings: refitOpenings(g.live, d.openings) }, { keepFuture: false });
      } else if (g.kind === 'opening' && g.live) {
        commit({ ...d, openings: d.openings.map((o, i) => (i === g.i ? g.live : o)) });
      } else if ((g.kind === 'view-body' || g.kind === 'view-aim') && g.live) {
        commit({ ...d, views: d.views.map((v) => (v.photo === g.photo ? { ...g.live } : v)) });
      } else if (g.kind === 'pan' && g.end) {
        layerRef.current.style.transform = '';
        const v = viewRef.current;
        setView({ ...v, cx: v.cx - (g.end[0] - g.start[0]) / v.s, cz: v.cz - (g.end[1] - g.start[1]) / v.s });
      }
      return;
    }
    // a tap
    const p = plan(g.start);
    if (g.kind === 'view-body' || g.kind === 'view-aim') {
      setSel({ kind: 'view', photo: g.photo });
      setMode('views');
      return;
    }
    if (mode === 'outline') {
      if (g.kind === 'corner') {
        if (!d.closed && g.i === 0 && d.outline.length >= 3) {
          if (!isSimple(d.outline, 0.05) || area(d.outline) < 0.5) return; // can't close a crossed / tiny shape
          commit({ ...d, closed: true });
          setSel(null);
          return;
        }
        setSel({ kind: 'corner', i: g.i });
        return;
      }
      if (g.kind === 'opening') return setSel({ kind: 'opening', i: g.i });
      if ((g.kind === 'edge' || g.kind === 'mid') && d.closed) {
        const [a, b] = edgeOf(d.outline, g.i);
        return setSel({ kind: 'edge', i: g.i, t: project(p, a, b).t });
      }
      if (!d.closed) {
        const at = [snap(p[0]), snap(p[1])];
        const last = d.outline[d.outline.length - 1];
        if (last && dist(last, at) < GRID / 2) return;
        // a tap on (or next to) the first corner closes the shape
        if (d.outline.length >= 3 && dist(d.outline[0], at) < GRID / 2) {
          if (isSimple(d.outline, 0.05) && area(d.outline) >= 0.5) commit({ ...d, closed: true });
          return;
        }
        commit({ ...d, outline: [...d.outline, at] });
        return;
      }
      setSel(null);
      return;
    }
    // viewpoints: a tap on the plan places the photo picked from the strip
    if (pending) return placeView(pending, p);
    setSel(null);
  };

  const onWheel = useCallback(
    (e) => {
      const v = viewRef.current;
      const sz = sizeRef.current;
      if (!v || !sz) return;
      e.preventDefault();
      const r = stageRef.current.getBoundingClientRect();
      const pt = [e.clientX - r.left, e.clientY - r.top];
      const s = Math.max(6, Math.min(600, v.s * Math.exp(-e.deltaY * 0.0015)));
      const p = toPlan(v, sz, pt);
      setView({ s, cx: p[0] - (pt[0] - sz.w / 2) / s, cz: p[1] - (pt[1] - sz.h / 2) / s });
    },
    [setView],
  );
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  /* ── dragging a thumbnail onto the plan ──────────────────────────────────── */

  const thumbDrag = useRef(null);
  const onThumbDown = (e, n) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    thumbDrag.current = { n, start: [e.clientX, e.clientY], id: e.pointerId, dragging: false, touch: e.pointerType !== 'mouse' };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onThumbMove = (e) => {
    const t = thumbDrag.current;
    if (!t || e.pointerId !== t.id) return;
    const dx = e.clientX - t.start[0];
    const dy = e.clientY - t.start[1];
    if (!t.dragging) {
      if (Math.hypot(dx, dy) < 8) return;
      // a finger sliding along the strip scrolls it; up or down out of it drags the photo
      if (t.touch && Math.abs(dx) > Math.abs(dy)) {
        thumbDrag.current = null;
        return;
      }
      t.dragging = true;
      if (ghostRef.current) ghostRef.current.hidden = false;
    }
    e.preventDefault();
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };
  const onThumbUp = (e) => {
    const t = thumbDrag.current;
    thumbDrag.current = null;
    if (ghostRef.current) ghostRef.current.hidden = true;
    if (!t || e.pointerId !== t.id) return;
    if (t.dragging) {
      const r = stageRef.current.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) placeView(t.n, plan([e.clientX - r.left, e.clientY - r.top]));
      return;
    }
    // a tap: pick it (then a tap on the plan places it); a placed one is selected too
    const placed = docRef.current.views.some((v) => v.photo === t.n);
    setMode('views');
    if (placed) setSel({ kind: 'view', photo: t.n });
    setPending((p) => (p === t.n ? null : t.n));
  };
  const onThumbCancel = () => {
    thumbDrag.current = null;
    if (ghostRef.current) ghostRef.current.hidden = true;
  };

  /* ── keyboard ────────────────────────────────────────────────────────────── */

  const onKeyDown = (e) => {
    const d = docRef.current;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      return redo();
    }
    if (e.key === 'Escape') {
      setPending(null);
      setSel(null);
      return;
    }
    if (e.key === 'Enter' && mode === 'outline' && !d.closed && d.outline.length >= 3 && isSimple(d.outline, 0.05) && area(d.outline) >= 0.5) {
      e.preventDefault();
      return commit({ ...d, closed: true });
    }
    const step = e.shiftKey ? GRID : VIEW_STEP;
    const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key] && sel) {
      e.preventDefault();
      const [dx, dz] = arrows[e.key];
      if (sel.kind === 'view') return commit({ ...d, views: d.views.map((v) => (v.photo === sel.photo ? { ...v, x: v.x + dx, z: v.z + dz } : v)) });
      if (sel.kind === 'corner') {
        const outline = d.outline.map((p, i) => (i === sel.i ? [p[0] + dx, p[1] + dz] : p));
        if (d.closed && (!isSimple(outline, 0.05) || area(outline) < 0.5)) return;
        return commit({ ...d, outline, openings: refitOpenings(outline, d.openings) });
      }
    }
    if ((e.key === 'r' || e.key === 'R') && sel?.kind === 'view') {
      e.preventDefault();
      const turn = e.shiftKey ? -5 : 5;
      return commit({ ...d, views: d.views.map((v) => (v.photo === sel.photo ? { ...v, yaw: norm360(v.yaw + turn) } : v)) });
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
      e.preventDefault();
      removeSelected();
    }
  };

  const removeSelected = () => {
    const d = docRef.current;
    if (!sel) return;
    if (sel.kind === 'view') commit({ ...d, views: d.views.filter((v) => v.photo !== sel.photo) });
    else if (sel.kind === 'opening') commit({ ...d, openings: d.openings.filter((_, i) => i !== sel.i) });
    else if (sel.kind === 'corner') {
      if (!d.closed) commit({ ...d, outline: d.outline.filter((_, i) => i !== sel.i) });
      else if (d.outline.length > 3) {
        const next = removeCorner(d.outline, d.openings, sel.i);
        if (isSimple(next.outline, 0.05) && area(next.outline) >= 0.5) commit({ ...d, ...next });
      }
    }
    setSel(null);
  };

  /* ── outline panel actions ───────────────────────────────────────────────── */

  const applySize = () => {
    const d = docRef.current;
    const wd = parseSize(sizeText);
    if (!wd) return setSizeErr(c.sizeBad);
    setSizeErr(null);
    let next;
    if (!d.closed) {
      // no outline yet: a rectangle that size
      next = { ...d, outline: [[0, 0], [wd[0], 0], [wd[0], wd[1]], [0, wd[1]]], closed: true, openings: [], sizeKnown: true };
    } else {
      const [bw, bd] = bboxSize(d.outline);
      // keep the sketch's orientation: the longer typed side along the longer side drawn
      const [w, dd] = (bw >= bd) === (wd[0] >= wd[1]) ? wd : [wd[1], wd[0]];
      const outline = scaleTo(d.outline, w, dd);
      next = { ...d, outline, openings: refitOpenings(outline, d.openings.map((o) => ({ ...o, offset: o.offset * (w / (bw || 1)) }))), sizeKnown: true };
    }
    commit(next);
    setSizeText('');
    refit(next);
  };
  const addOpening = (type) => {
    const d = docRef.current;
    if (sel?.kind !== 'edge') return;
    const L = dist(...edgeOf(d.outline, sel.i));
    const width = Math.min(type === 'door' ? 0.82 : 1.2, L);
    const o = fitOpening(d.outline, { edge: sel.i, offset: snap((sel.t ?? 0.5) * L - width / 2, 0.05), width, type });
    commit({ ...d, openings: [...d.openings, o] });
    setSel({ kind: 'opening', i: d.openings.length });
  };
  const useStart = () => {
    const d = docRef.current;
    const next = { ...d, outline: start.map((p) => [...p]), closed: true, openings: [], sizeKnown: true };
    commit(next);
    refit(next);
  };
  const clearOutline = () => {
    const d = docRef.current;
    commit({ ...d, outline: [], closed: false, openings: [], sizeKnown: false });
    setSel(null);
  };

  /* ── render ──────────────────────────────────────────────────────────────── */

  const selView = sel?.kind === 'view' ? doc.views.find((v) => v.photo === sel.photo) : null;
  const selPhoto = selView ? photoOf(selView.photo) : pending ? photoOf(pending) : null;
  const placed = new Set(doc.views.map((v) => v.photo));
  const canUndo = histN.past > 0;
  const canRedo = histN.future > 0;
  const gridPx = view ? view.s : 1;
  const origin = view && size ? at([0, 0]) : [0, 0];
  const hint = mode === 'outline' ? (doc.closed ? c.hintClosed : doc.outline.length ? c.hintDrawing : c.hintStart) : pending ? c.hintPlace(pending) : doc.views.length ? c.hintViews : c.hintFirstView;

  // the photos: beside the plan on a desktop (both in view for a drag), under it on a phone (a sideways strip)
  const strip = photos.length > 0 && (
    <ul className="mr-lay__strip" aria-label={c.stripLabel} data-mr="layout-strip">
    {photos.map((p) => (
      <li key={p.n}>
  <button
    type="button"
    className="mr-lay__thumb"
    aria-pressed={pending === p.n || (sel?.kind === 'view' && sel.photo === p.n)}
    data-placed={placed.has(p.n) ? '' : undefined}
    data-mr="layout-thumb"
    data-n={p.n}
    onPointerDown={(e) => onThumbDown(e, p.n)}
    onPointerMove={onThumbMove}
    onPointerUp={onThumbUp}
    onPointerCancel={onThumbCancel}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setMode('views');
        if (placed.has(p.n)) setSel({ kind: 'view', photo: p.n });
        else if (sizeRef.current) placeView(p.n, plan([sizeRef.current.w / 2, sizeRef.current.h / 2]));
      }
    }}
    aria-label={placed.has(p.n) ? c.thumbPlaced(p.n) : c.thumb(p.n)}
  >
    <img src={p.url} alt="" draggable={false} />
    <span className="mr-lay__thumb-n">{p.n}</span>
    {placed.has(p.n) && (
      <span className="mr-dot mr-lay__placed" data-status="rendered">
        {c.placed}
      </span>
    )}
  </button>
      </li>
    ))}
  </ul>
  );

  return (
    <div className="mr-lay" data-mr="layout-editor" data-compact={compact ? '' : undefined} data-mode={mode} data-touch={touch ? '' : undefined}>
      <div className="mr-lay__bar">
        <div className="mr-seg" role="group" aria-label={c.modeLabel}>
          <button type="button" aria-pressed={mode === 'outline'} onClick={() => (setMode('outline'), setPending(null))} data-mr="layout-mode-outline">
            {c.modeOutline}
          </button>
          <button type="button" aria-pressed={mode === 'views'} onClick={() => setMode('views')} data-mr="layout-mode-views">
            {c.modeViews}
          </button>
        </div>
        <div className="mr-lay__history">
          <button type="button" className="mr-linkbtn" onClick={undo} disabled={!canUndo} data-mr="layout-undo">
            {c.undo}
          </button>
          <button type="button" className="mr-linkbtn" onClick={redo} disabled={!canRedo} data-mr="layout-redo">
            {c.redo}
          </button>
          <button type="button" className="mr-linkbtn" onClick={() => refit()} data-mr="layout-fit">
            {c.fit}
          </button>
        </div>
      </div>
      <p className="mr-lay__hint" aria-live="polite" data-mr="layout-hint">
        {hint}
      </p>

      <div className="mr-lay__body">
        <div
          ref={stageRef}
          className="mr-lay__stage"
          tabIndex={0}
          role="application"
          aria-label={c.stageLabel}
          aria-describedby={`${uid}-keys`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e)}
          onPointerCancel={(e) => endGesture(e, true)}
          onLostPointerCapture={(e) => pointers.current.has(e.pointerId) && endGesture(e, true)}
          onKeyDown={onKeyDown}
          data-mr="layout-stage"
          data-views={doc.views.length}
          data-corners={doc.outline.length}
          data-closed={doc.closed ? '' : undefined}
        >
          {view && size && (
            <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
              <defs>
                <pattern id={`${uid}-grid`} patternUnits="userSpaceOnUse" width={gridPx} height={gridPx} x={origin[0]} y={origin[1]}>
                  {gridPx * GRID >= 9 && (
                    <path className="mr-lay__grid-minor" d={[1, 2, 3].map((k) => `M${k * gridPx * GRID} 0 V${gridPx} M0 ${k * gridPx * GRID} H${gridPx}`).join(' ')} />
                  )}
                  <path className="mr-lay__grid-major" d={`M0 0 V${gridPx} M0 0 H${gridPx}`} />
                </pattern>
              </defs>
              <g ref={layerRef} className="mr-lay__layer">
                <rect className="mr-lay__paper" x={-size.w} y={-size.h} width={size.w * 3} height={size.h * 3} fill={`url(#${uid}-grid)`} data-role="bg" />
                {guide?.length >= 3 && <path className="mr-lay__guide" d={pathOf(guide, true, at)} data-mr="layout-guide" />}
                {doc.outline.length > 0 && (
                  <path
                    ref={(el) => (els.current.outline = el)}
                    className="mr-lay__outline"
                    data-closed={doc.closed ? '' : undefined}
                    d={pathOf(doc.outline, doc.closed, at)}
                  />
                )}
                {mode === 'outline' && !doc.closed && doc.outline.length > 0 && <path ref={previewRef} className="mr-lay__preview" d="" />}
                {doc.closed &&
                  doc.outline.map((_, i) => {
                    const [a, b] = edgeOf(doc.outline, i);
                    const [ax, ay] = at(a);
                    const [bx, by] = at(b);
                    const [mx, my] = at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
                    const picked = sel?.kind === 'edge' && sel.i === i;
                    return (
                      <g key={`e${i}`}>
                        <line className="mr-lay__edgehit" x1={ax} y1={ay} x2={bx} y2={by} data-role="edge" data-i={i} data-picked={picked ? '' : undefined} />
                        <g ref={(el) => (els.current.labels[i] = el)} className="mr-lay__len" transform={`translate(${mx.toFixed(1)} ${my.toFixed(1)})`}>
                          <text dy="-8">{fmtM(dist(a, b))}</text>
                        </g>
                        {mode === 'outline' && (
                          <g className="mr-lay__mid" transform={`translate(${mx.toFixed(1)} ${my.toFixed(1)})`} data-role="mid" data-i={i}>
                            <circle r={touch ? 22 : 12} className="mr-lay__hit" />
                            <circle r={6} className="mr-lay__mid-dot" />
                            <path d="M-3 0 H3 M0 -3 V3" />
                          </g>
                        )}
                      </g>
                    );
                  })}
                {doc.closed &&
                  doc.openings.map((o, i) => {
                    const [a, b] = openingEnds(doc.outline, o).map(at);
                    const picked = sel?.kind === 'opening' && sel.i === i;
                    return (
                      <g key={`o${i}`} ref={(el) => (els.current.openings[i] = el)} className="mr-lay__opening" data-type={o.type} data-picked={picked ? '' : undefined} data-role="opening" data-i={i}>
                        <line className="mr-lay__hit-line" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                        <line className="mr-lay__opening-mark" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                      </g>
                    );
                  })}
                {mode === 'outline' &&
                  doc.outline.map((p, i) => {
                    const [x, y] = at(p);
                    const first = !doc.closed && i === 0 && doc.outline.length >= 3;
                    const picked = sel?.kind === 'corner' && sel.i === i;
                    return (
                      <g key={`c${i}`} ref={(el) => (els.current.corners[i] = el)} className="mr-lay__corner" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} data-role="corner" data-i={i} data-first={first ? '' : undefined} data-picked={picked ? '' : undefined}>
                        <circle r={touch ? 22 : 12} className="mr-lay__hit" />
                        <circle r={first ? 8 : 5.5} className="mr-lay__corner-dot" />
                      </g>
                    );
                  })}
                {doc.views.map((v) => {
                  const picked = sel?.kind === 'view' && sel.photo === v.photo;
                  const [ax, ay] = aimOffset(v.yaw, wedgeLen);
                  return (
                    <g
                      key={`v${v.photo}`}
                      ref={(el) => (el ? els.current.wedges.set(v.photo, el) : els.current.wedges.delete(v.photo))}
                      className="mr-lay__view"
                      transform={wedgeTransform(v, at)}
                      data-conf={v.conf}
                      data-picked={picked ? '' : undefined}
                      data-photo={v.photo}
                      data-mr="layout-view"
                    >
                      <path data-part="fan" className="mr-lay__fan" d={wedgePath(fovOf(v.photo), wedgeLen)} transform={`rotate(${wedgeRotation(v.yaw)})`} data-role="view-body" data-photo={v.photo} />
                      <g data-part="aim" transform={`translate(${ax.toFixed(1)} ${ay.toFixed(1)})`} data-role="view-aim" data-photo={v.photo}>
                        <circle r={touch ? 22 : 13} className="mr-lay__hit" />
                        <circle r={5} className="mr-lay__aim-dot" />
                      </g>
                      <g data-role="view-body" data-photo={v.photo}>
                        <circle r={touch ? 22 : bodyR + 4} className="mr-lay__hit" />
                        <circle r={bodyR} className="mr-lay__body" />
                        <text className="mr-lay__num" dy="4">
                          {v.photo}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
          <p id={`${uid}-keys`} className="mr-visually-hidden">
            {c.keys}
          </p>
        </div>

        {compact && strip}
        <aside className="mr-lay__side">
          {!compact && strip}
          {mode === 'outline' ? (
            <div className="mr-lay__panel" data-mr="layout-outline-panel">
              {start && (
                <button type="button" className="mr-btn" onClick={useStart} data-mr="layout-use-start">
                  {c.useStart}
                </button>
              )}
              <form
                className="mr-lay__size"
                onSubmit={(e) => {
                  e.preventDefault();
                  applySize();
                }}
              >
                <label className="mr-label" htmlFor={`${uid}-size`}>
                  {c.sizeLabel}
                </label>
                <div className="mr-lay__size-row">
                  <input id={`${uid}-size`} className="mr-input" value={sizeText} onChange={(e) => setSizeText(e.target.value)} placeholder={c.sizePlaceholder} inputMode="text" autoComplete="off" data-mr="layout-size" />
                  <button type="submit" className="mr-btn" data-mr="layout-size-apply">
                    {c.sizeApply}
                  </button>
                </div>
                {sizeErr ? <p className="mr-field-error">{sizeErr}</p> : doc.closed && <p className="mr-field-hint">{doc.sizeKnown ? c.sizeKnown : c.sizeRough}</p>}
              </form>
              {sel?.kind === 'edge' && doc.closed && (
                <div className="mr-lay__edgeacts" data-mr="layout-edge-actions">
                  <span className="mr-label">{c.edgeLabel(fmtM(dist(...edgeOf(doc.outline, sel.i))))}</span>
                  <div className="mr-lay__row">
                    <button type="button" className="mr-btn" onClick={() => addOpening('door')} data-mr="layout-add-door">
                      {c.door}
                    </button>
                    <button type="button" className="mr-btn" onClick={() => addOpening('window')} data-mr="layout-add-window">
                      {c.window}
                    </button>
                  </div>
                </div>
              )}
              {(sel?.kind === 'opening' || sel?.kind === 'corner') && (
                <button type="button" className="mr-linkbtn" onClick={removeSelected} data-mr="layout-remove">
                  {sel.kind === 'opening' ? c.removeOpening(doc.openings[sel.i]?.type) : c.removeCorner}
                </button>
              )}
              {doc.outline.length > 0 && (
                <button type="button" className="mr-linkbtn mr-lay__clear" onClick={clearOutline} data-mr="layout-clear">
                  {c.clearOutline}
                </button>
              )}
            </div>
          ) : (
            <div className="mr-lay__panel" data-mr="layout-views-panel">
              {selPhoto ? (
                <figure className="mr-lay__photo" data-mr="layout-photo">
                  <img src={selPhoto.full || selPhoto.url} alt={c.photoAlt(selPhoto.n)} />
                  <figcaption className="mr-label">
                    {c.photoN(selPhoto.n)}
                    {selPhoto.caption ? ` · ${selPhoto.caption}` : ''}
                  </figcaption>
                </figure>
              ) : (
                <p className="mr-field-hint">{photos.length ? c.pickOne : c.noPhotos}</p>
              )}
              {selView && (
                <div className="mr-lay__viewacts" data-mr="layout-view-actions">
                  <div className="mr-seg" role="group" aria-label={c.confLabel}>
                    {['exact', 'rough'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={selView.conf === k}
                        onClick={() => commit({ ...doc, views: doc.views.map((v) => (v.photo === selView.photo ? { ...v, conf: k } : v)) })}
                        data-mr={`layout-conf-${k}`}
                      >
                        {c.conf[k]}
                      </button>
                    ))}
                  </div>
                  <span className="mr-label mr-lay__yaw">{c.facing(Math.round(selView.yaw))}</span>
                  <button type="button" className="mr-linkbtn" onClick={removeSelected} data-mr="layout-remove-view">
                    {c.removeView}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <div ref={ghostRef} className="mr-lay__ghost" hidden aria-hidden="true">
        <svg viewBox="-20 -20 40 40" width="40" height="40">
          <path d="M0 0 L-12 16 A20 20 0 0 0 12 16 Z" />
          <circle r="8" />
        </svg>
      </div>
    </div>
  );
}

