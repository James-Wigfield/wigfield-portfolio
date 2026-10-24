import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudy } from './context';
import { prefersReducedMotion } from './hooks';

/* ============================================================================
   LECTURES 1–2 REFRESHER — STORY MODE (the Lecture 8 kit, copied)
   ----------------------------------------------------------------------------
   useStory(n, opts) drives a lab's named beats (0 … n−1):
     beat        the beat on show; a lab draws the state at the END of it
     go(i)       jump to beat i (stops playing)
     play()      replay from beat 0, one beat every `ms`, stopping on the last
     playing     true while it runs
   Labs open on their last beat (the finished picture: the "aha" is visible
   before anyone presses anything) unless `start` says otherwise. While the
   page prints, the beat is pinned to the last one. Under reduced motion the
   beats still step, but the CSS transitions are off, so each beat appears
   at its end state straight away (and ▶ steps more slowly).
   ========================================================================== */

export function useStory(n, { start = n - 1, ms = 1500 } = {}) {
  const { printing } = useStudy();
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

  // ▶ starts from a blank stage (beat −1, nothing drawn yet) so the first
  // beat animates in too; labs treat beat < 0 as "before anything happens".
  const play = useCallback(() => {
    window.clearTimeout(timer.current);
    const reduced = prefersReducedMotion();
    const step = reduced ? ms * 1.4 : ms;
    setBeat(reduced ? 0 : -1);
    setPlaying(true);
    let i = reduced ? 0 : -1;
    const tick = () => {
      i += 1;
      setBeat(i);
      if (i < n - 1) timer.current = window.setTimeout(tick, i < 0 ? 350 : step);
      else setPlaying(false);
    };
    timer.current = window.setTimeout(tick, i < 0 ? 350 : step);
  }, [n, ms]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { beat: printing ? n - 1 : beat, go, play, stop, playing: printing ? false : playing, n };
}
