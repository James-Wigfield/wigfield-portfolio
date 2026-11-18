/* "Play the trip": the flyover's state machine (engine-free; each map drives its own
   camera from it: mapbox/useFlyoverMapbox.js, the atlas in useFlyoverAtlas.js).

     const fly = useFlyover(stops, { autoplay, onExit });
     fly.start()  fly.exit()  fly.toggle()  fly.pause()  fly.next()  fly.prev()  fly.toggleSpeed()
     fly.arrived(index)   // the engine says the camera reached stops[index]

   Phases: 'flying' (the camera is on its way to stops[index]), 'linger' (there:
   the caption shows, ~4 s at 1×, then on), 'end' (the whole route, paused).
   Pausing holds everything where it is: the engine stops the camera, the linger
   clock stops, and play carries on from there. Space / ← → / Escape while active
   (Space is left alone on a focused button, which presses it instead).

   `autoplay` (/memories?play=1) starts it at mount; it waits for the stops to load. */

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

export const LINGER_MS = 4000;
export const FLY_MS = 3200;
export const LONG_FLY_MS = 6500;
/** Reduced motion: the map fades out for this long, the camera jumps, it fades back. */
export const FADE_MS = 220;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const IDLE = { active: false, index: 0, phase: 'flying', playing: false, speed: 1 };
const noop = () => {};
/** A map with no flyover (the default prop). */
export const NO_FLY = { ...IDLE, count: 0, stop: null, reduced: false, start: noop, exit: noop, toggle: noop, pause: noop, next: noop, prev: noop, toggleSpeed: noop, arrived: noop };
const RUNNING = { active: true, index: 0, phase: 'flying', playing: true };

export function useFlyover(stops, { autoplay = false, onExit } = {}) {
  const [s, setS] = useState(() => (autoplay ? { ...IDLE, ...RUNNING } : IDLE));
  const [reduced] = useState(reducedMotion);
  const count = stops.length;
  const last = Math.max(0, count - 1);
  const index = Math.min(s.index, last); // the filters can shrink the stops under a running flyover
  const linger = useRef({ index: -1, elapsed: 0, since: 0 });
  const exitHook = useRef(onExit);
  useLayoutEffect(() => {
    exitHook.current = onExit;
  });

  const fresh = () => {
    linger.current = { index: -1, elapsed: 0, since: 0 };
  };
  const start = () => {
    if (!count) return;
    fresh();
    setS((p) => ({ ...p, ...RUNNING }));
  };
  const exit = () => {
    setS((p) => ({ ...IDLE, speed: p.speed }));
    exitHook.current?.();
  };
  const goTo = (i) => {
    fresh();
    setS((p) => (p.active ? { ...p, index: Math.max(0, Math.min(last, i)), phase: 'flying' } : p));
  };
  const next = () => goTo(index + 1);
  const prev = () => goTo(s.phase === 'end' ? last : index - 1);
  const toggle = () => {
    if (s.phase === 'end') fresh();
    setS((p) => {
      if (!p.active) return p;
      if (p.phase === 'end') return { ...p, index: 0, phase: 'flying', playing: true };
      return { ...p, playing: !p.playing };
    });
  };
  const pause = useCallback(() => setS((p) => (p.active && p.playing ? { ...p, playing: false } : p)), []);
  const toggleSpeed = () => setS((p) => ({ ...p, speed: p.speed === 1 ? 2 : 1 }));
  const arrived = useCallback((i) => setS((p) => (p.active && p.phase === 'flying' && Math.min(p.index, last) === i ? { ...p, index: i, phase: 'linger' } : p)), [last]);

  // The linger clock: runs only while playing, keeps its elapsed time across a pause.
  useEffect(() => {
    if (!s.active || s.phase !== 'linger' || !count) return undefined;
    if (linger.current.index !== index) linger.current = { index, elapsed: 0, since: 0 };
    if (!s.playing) return undefined;
    const cur = linger.current;
    cur.since = performance.now();
    const left = Math.max(0, (LINGER_MS - cur.elapsed) / s.speed); // elapsed is in 1× ms
    const timer = setTimeout(() => {
      setS((p) => {
        if (!p.active || p.phase !== 'linger' || Math.min(p.index, last) !== index) return p;
        return index < last ? { ...p, index: index + 1, phase: 'flying' } : { ...p, index, phase: 'end', playing: false };
      });
    }, left);
    return () => {
      clearTimeout(timer);
      cur.elapsed += (performance.now() - cur.since) * s.speed;
    };
  }, [s.active, s.phase, s.playing, s.speed, index, last, count]);

  // Keys while it runs.
  const onKey = useEffectEvent((e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      exit();
    } else if (e.key === ' ' || e.code === 'Space') {
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  });
  useEffect(() => {
    if (!s.active) return undefined;
    const handler = (e) => onKey(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [s.active]);

  const stop = s.active && count ? stops[index] : null;
  return { ...s, index, count, stop, reduced, start, exit, toggle, pause, next, prev, toggleSpeed, arrived };
}
