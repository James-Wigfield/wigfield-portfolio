/* ============================================================================
   DL PROJECT 2 — MOTION HELPERS
   ----------------------------------------------------------------------------
   prefers-reduced-motion (kept live) and the dev-only seek handle.

   window.__dlp2 (DEV builds only) lets the console and the headless check
   drive any mounted scene frame-exactly:
     __dlp2.ids()              mounted scene ids
     __dlp2.seek(id, p)        jump to progress p (0..1) and pause
     __dlp2.play(id) / pause(id) / replay(id)
     __dlp2.state(id)          { progress, beat, beats, playing, reduced }
     __dlp2.beatEnds(id)       progress at which each beat has finished
   It never hands a timeline back: page.evaluate would hang serialising one.
   ========================================================================== */
import { useEffect, useState } from 'react';

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

const REGISTRY = new Map();

export function registerScene(id, api) {
  REGISTRY.set(id, api);
  if (import.meta.env.DEV && typeof window !== 'undefined' && !window.__dlp2) {
    const get = (sid) => {
      const s = REGISTRY.get(sid);
      if (!s) throw new Error(`no scene "${sid}" — mounted: ${[...REGISTRY.keys()].join(', ')}`);
      return s;
    };
    window.__dlp2 = {
      ids: () => [...REGISTRY.keys()],
      seek: (sid, p) => { get(sid).seek(p); return get(sid).state(); },
      play: (sid) => { get(sid).play(); return true; },
      pause: (sid) => { get(sid).pause(); return true; },
      replay: (sid) => { get(sid).replay(); return true; },
      state: (sid) => get(sid).state(),
      beatEnds: (sid) => get(sid).beatEnds(),
      speed: (sid, k) => { get(sid).speed(k); return true; },
    };
  }
  return () => {
    if (REGISTRY.get(id) === api) REGISTRY.delete(id);
  };
}
