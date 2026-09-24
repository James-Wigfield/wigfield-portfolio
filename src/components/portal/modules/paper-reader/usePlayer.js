/* ============================================================================
   RSVP PAPERS — the player (a setTimeout chain over the timeline)
   ----------------------------------------------------------------------------
   One hook owns the clock. Every tick shows one item for its own duration and
   then advances; a stop item (pause card, end-of-main, end) leaves the player
   PAUSED ON the item so the card is displayed. `play()` from a stop item first
   steps past it — that's the "Continue" gesture.

   Timing reads the latest `durationFor` through a ref, so changing the WPM
   mid-sentence takes effect on the very next word without restarting the
   chain. Drift is corrected against performance.now() so 1000 wpm doesn't
   slowly sag under setTimeout latency.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isStop } from './timeline';

export function usePlayer(items, durationFor, initialIndex = 0) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)));
  const [playing, setPlaying] = useState(false);

  const indexRef = useRef(index);
  const playingRef = useRef(false);
  const timerRef = useRef(null);
  const dueRef = useRef(0);
  const durationRef = useRef(durationFor);
  const itemsRef = useRef(items);

  useEffect(() => { durationRef.current = durationFor; }, [durationFor]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const setIdx = useCallback((i) => {
    const max = Math.max(0, itemsRef.current.length - 1);
    const next = Math.min(Math.max(0, i), max);
    indexRef.current = next;
    setIndex(next);
    return next;
  }, []);

  const halt = useCallback(() => {
    clearTimer();
    playingRef.current = false;
    setPlaying(false);
  }, []);

  // Schedule the advance off the CURRENT item; the timeout re-enters through
  // scheduleRef so the chain continues without a self-reference.
  const scheduleRef = useRef(() => {});
  const schedule = useCallback(() => {
    clearTimer();
    const list = itemsRef.current;
    const item = list[indexRef.current];
    if (!item) { halt(); return; }
    const ms = durationRef.current(item);
    if (ms == null) { halt(); return; }             // stop point: stay on it, paused
    const now = performance.now();
    const late = dueRef.current ? Math.min(ms * 0.5, Math.max(0, now - dueRef.current)) : 0;
    dueRef.current = now + ms - late;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!playingRef.current) return;
      const next = indexRef.current + 1;
      if (next >= itemsRef.current.length) { halt(); return; }
      indexRef.current = next;
      setIndex(next);
      scheduleRef.current();
    }, Math.max(0, ms - late));
  }, [halt]);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);

  const play = useCallback(() => {
    const list = itemsRef.current;
    let i = indexRef.current;
    if (i >= list.length - 1 && isStop(list[i])) return;     // at the very end
    if (isStop(list[i])) i = setIdx(i + 1);                  // continue past a card
    playingRef.current = true;
    setPlaying(true);
    dueRef.current = 0;
    schedule();
  }, [schedule, setIdx]);

  const pause = useCallback(() => { halt(); }, [halt]);

  const toggle = useCallback(() => {
    if (playingRef.current) halt(); else play();
  }, [halt, play]);

  // Jump. Keeps playing (re-timed from the new item) if it was playing.
  const seek = useCallback((i) => {
    setIdx(i);
    if (playingRef.current) { dueRef.current = 0; schedule(); }
  }, [schedule, setIdx]);

  // Stop the clock on unmount.
  useEffect(() => () => clearTimer(), []);

  return { index, playing, play, pause, toggle, seek };
}
