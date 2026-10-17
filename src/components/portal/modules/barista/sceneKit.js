/* ============================================================================
   BARISTA · SCENE KIT — the one way every animated scene is built
   ----------------------------------------------------------------------------
   useScene(build, opts) gives a scene component:
     ref        put on the scene root (an element wrapping the SVG)
     replay()   plain restart() — never invalidate()
     scrub(p)   follow-along: hold the timeline and set it to a point inside
                its timed segment (labels `live` → `live-end`), p ∈ [0, 1]
     release()  hand the timeline back to the IntersectionObserver
     reduced    true under prefers-reduced-motion (no timeline is built; the
                JSX defaults ARE the finished, labelled frame)

   Contract (hard-won on the Portara pages):
     • one paused timeline per scene, built inside gsap.context(), reverted
       on unmount
     • every stateful tween is fromTo with explicit values, plus tl.set()
       resets at t=0 — so restart() replays identically
     • the opening frame is rendered at build time (progress 1 → 0, events
       suppressed) so nothing flashes before the first play
     • plays on the first IntersectionObserver hit, pauses off-screen and
       while the tab is hidden, resumes on return
   Dev only: window.__bxi = { list, info, seek, progress, restart } for
   frame-exact seeking. Its functions return plain data, never a timeline.
   ========================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import gsap from 'gsap';

const motionQuery = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function subscribeMotion(cb) {
  const m = motionQuery();
  m?.addEventListener?.('change', cb);
  return () => m?.removeEventListener?.('change', cb);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => !!motionQuery()?.matches, () => false);
}

/* ── Dev registry ─────────────────────────────────────────────────────── */
const registry = new Map();

function register(name, tl) {
  let key = name;
  let n = 2;
  while (registry.has(key)) key = `${name}#${n++}`;
  registry.set(key, tl);
  return key;
}

export function installDevHandle() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  window.__bxi = {
    list: () => [...registry.keys()],
    info: (k) => {
      const tl = registry.get(k);
      return tl ? { duration: tl.duration(), time: tl.time(), progress: tl.progress(), paused: tl.paused(), repeat: tl.repeat() } : null;
    },
    seek: (k, t) => {
      const tl = registry.get(k);
      if (tl) {
        tl.pause(t);
        tl.data?.syncBeat?.();
      }
    },
    progress: (k, p) => {
      const tl = registry.get(k);
      if (tl) {
        tl.pause();
        tl.progress(p);
        tl.data?.syncBeat?.();
      }
    },
    restart: (k) => {
      registry.get(k)?.restart();
    },
  };
}

/* ── The hook ─────────────────────────────────────────────────────────── */
export function useScene(build, { name = 'scene', loop = false, rebuild = '' } = {}) {
  const ref = useRef(null);
  const tlRef = useRef(null);
  const buildRef = useRef(build);
  const holdRef = useRef(false);
  const startedRef = useRef(false);
  const reduced = useReducedMotion();
  // Which numbered beat is playing (null before play / reduced, -1 at the end).
  const [beat, setBeat] = useState(null);

  useLayoutEffect(() => {
    buildRef.current = build;
  });

  useLayoutEffect(() => {
    const root = ref.current;
    if (reduced || !root) return undefined;
    let key = null;
    startedRef.current = false;
    holdRef.current = false;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        paused: true,
        repeat: loop ? -1 : 0,
        repeatDelay: loop ? 0.8 : 0,
        defaults: { ease: 'power2.out' },
      });
      const cues = [];
      const cue = (i, at) => {
        cues.push([at, i]);
        tl.call(setBeat, [i], at);
      };
      buildRef.current(tl, gsap.utils.selector(root), { root, cue });
      // Close on "all beats done" so the legend returns to its resting state.
      const end = tl.duration();
      tl.call(setBeat, [-1], end);
      // Seeks and scrubs skip callbacks, so they re-derive the beat from time.
      cues.sort((a, b) => a[0] - b[0]);
      tl.data = {
        syncBeat: () => {
          const t = tl.time();
          if (t >= end - 1e-3) return setBeat(-1);
          let b = null;
          cues.forEach(([at, i]) => {
            if (at <= t + 1e-6) b = i;
          });
          return setBeat(b);
        },
      };
      tl.progress(1, true).progress(0, true);
      tlRef.current = tl;
      key = register(name, tl);
      if (import.meta.env.DEV) root.setAttribute('data-bxi-scene', key);
    }, root);

    let visible = false;
    const sync = () => {
      const tl = tlRef.current;
      if (!tl || holdRef.current) return;
      const run = visible && !document.hidden;
      if (run) {
        if (!startedRef.current) {
          startedRef.current = true;
          tl.play(0);
        } else if (tl.paused() && (loop || tl.progress() < 1)) {
          tl.resume();
        }
      } else if (!tl.paused()) {
        tl.pause();
      }
    };

    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          sync();
        },
        { threshold: 0.2 },
      );
      io.observe(root);
    } else {
      visible = true;
      sync();
    }
    document.addEventListener('visibilitychange', sync);

    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      if (key) registry.delete(key);
      if (import.meta.env.DEV) root.removeAttribute('data-bxi-scene');
      tlRef.current = null;
      ctx.revert();
    };
  }, [reduced, loop, name, rebuild]);

  const replay = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    holdRef.current = false;
    startedRef.current = true;
    tl.restart();
  }, []);

  const scrub = useCallback((p) => {
    const tl = tlRef.current;
    if (!tl) return;
    holdRef.current = true;
    startedRef.current = true;
    const a = tl.labels.live ?? 0;
    const b = tl.labels['live-end'] ?? tl.duration();
    tl.pause(a + (b - a) * Math.min(1, Math.max(0, p)));
    tl.data?.syncBeat?.();
  }, []);

  /** Hold the timeline at an absolute time (or a label + offset). */
  const hold = useCallback((t) => {
    const tl = tlRef.current;
    if (!tl) return;
    holdRef.current = true;
    startedRef.current = true;
    tl.pause(typeof t === 'string' ? tl.labels[t] ?? 0 : t);
    tl.data?.syncBeat?.();
  }, []);

  const getTl = useCallback(() => tlRef.current, []);

  const release = useCallback(() => {
    const tl = tlRef.current;
    holdRef.current = false;
    if (tl) {
      tl.progress(1);
      tl.data?.syncBeat?.();
    }
  }, []);

  return { ref, replay, scrub, hold, getTl, release, reduced, beat };
}

/**
 * Follow-along sync: while `live` is a number (0..1) the timeline is held at
 * that point of its `live` segment; when it goes back to null the scene
 * jumps to its finished frame and the observer takes over again.
 */
export function useLive(api, live) {
  const { scrub, release } = api;
  const active = typeof live === 'number';
  useEffect(() => {
    if (active) scrub(live);
  }, [active, live, scrub]);
  useEffect(() => {
    if (!active) return undefined;
    return () => release();
  }, [active, release]);
}

/* ── Small helpers shared by scene builders ───────────────────────────── */

/** Dash-draw stroke twins: sets the dash once, returns the tween list. */
export function drawIn(tl, paths, at, { duration = 1, stagger = 0.06, ease = 'power2.inOut' } = {}) {
  paths.forEach((p, i) => {
    const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 200;
    gsap.set(p, { strokeDasharray: len });
    tl.fromTo(p, { strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, duration, ease, immediateRender: true }, at + i * stagger);
  });
}

/** Opacity pop in with a slight rise. */
export function popIn(tl, els, at, { duration = 0.35, y = 6, stagger = 0.05 } = {}) {
  if (!els || (Array.isArray(els) && !els.length)) return;
  tl.fromTo(els, { opacity: 0, y }, { opacity: 1, y: 0, duration, stagger, immediateRender: true }, at);
}
