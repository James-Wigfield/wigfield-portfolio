import { useCallback, useEffect, useRef, useState } from 'react';

/* Small hooks for /skippers. Story mode is a trimmed copy of the portal's
   lecture8-study/story.js: a lab opens on its LAST beat (the finished
   picture), ▶ replays from a blank stage, reduced motion steps slower and
   the CSS has no transitions, so each beat shows its end state. */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useStory(n, { start = n - 1, ms = 1600 } = {}) {
  const [beat, setBeat] = useState(start);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    setPlaying(false);
  }, []);

  const go = useCallback((i) => {
    window.clearTimeout(timer.current);
    setPlaying(false);
    setBeat(Math.max(0, Math.min(n - 1, i)));
  }, [n]);

  const play = useCallback(() => {
    window.clearTimeout(timer.current);
    const reduced = prefersReducedMotion();
    const step = reduced ? ms * 1.4 : ms;
    let i = reduced ? 0 : -1;
    setBeat(i);
    setPlaying(true);
    const tick = () => {
      i += 1;
      setBeat(i);
      if (i < n - 1) timer.current = window.setTimeout(tick, step);
      else setPlaying(false);
    };
    timer.current = window.setTimeout(tick, i < 0 ? 350 : step);
  }, [n, ms]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { beat, go, play, stop, playing, n };
}

// The live width of an element: labs choose a simpler picture when narrow.
export function useWidth(ref, fallback = 800) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// A clock in ms that runs while `on` (for light rhythms); frozen at `still`
// under reduced motion.
export function useClock(on = true, still = 0) {
  const [t, setT] = useState(still);
  useEffect(() => {
    if (!on || prefersReducedMotion()) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now) => {
      setT(now - t0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}
