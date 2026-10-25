import { useEffect, useRef, useState } from 'react';
import { useStudy } from './context';
import { prefersReducedMotion } from './hooks';

/* ============================================================================
   TRICKY TOPICS — THE OPENER'S HERO ANIMATION CLOCK (shared)
   ----------------------------------------------------------------------------
   useHeroBeats(n, { run, ms, ref }) → beat (0 … n−1)
   A topic's hero animation is a short sequence of beats (about five seconds
   in all); the component draws the state at the END of the current beat and
   CSS transitions animate between beats. The clock:
     · starts when the hero first scrolls into view, and again whenever
       `run` changes (the opener's replay button / a click on the floor)
     · never runs off screen (IntersectionObserver pauses it)
     · under prefers-reduced-motion, and while printing, sits on the last
       beat (the end state) — nothing moves
   ========================================================================== */

export function useHeroBeats(n, { run = 0, ms = 900, ref } = {}) {
  const { printing } = useStudy();
  const [beat, setBeat] = useState(n - 1);
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);
  const started = useRef(-1);

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!visible || printing || prefersReducedMotion()) return undefined;
    // first time in view, or a replay: run the beats from the top
    if (started.current === run) return undefined;
    started.current = run;
    let i = 0;
    let finished = false;
    const tick = () => {
      setBeat(i);
      i += 1;
      if (i < n) timer.current = window.setTimeout(tick, ms);
      else finished = true;
    };
    timer.current = window.setTimeout(tick, 60);
    return () => {
      window.clearTimeout(timer.current);
      // scrolled away mid-run: run it again from the top next time it shows
      if (!finished) started.current = -1;
    };
  }, [visible, run, n, ms, printing]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return printing ? n - 1 : beat;
}
