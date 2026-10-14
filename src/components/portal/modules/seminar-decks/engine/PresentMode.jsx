import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SlideView, { CANVAS_H, CANVAS_W } from './SlideView';
import { buildSequence } from './sequence';
import { useDeck } from './useDeck';
import { useFit } from './hooks';
import { runReadyCheck, useReady } from './ready';
import { labelOf } from './controller';
import RemoteBoundary from './RemoteBoundary';
import RemoteScreen from './RemoteScreen';

/* ============================================================================
   SEMINAR DECKS — PRESENT MODE (also the audience window)
   ----------------------------------------------------------------------------
   The slide is a fixed 1920 x 1080 logical canvas, fitted to the window and
   letterboxed in black, drawn in an overlay on document.body (the portal shell
   has no full-viewport route). Only the current slide and its two neighbours
   are mounted: the previous one at its finished state, the next one at its
   first step, so its clip is already loading. F toggles full screen (the
   Fullscreen API on the overlay), Esc leaves. With `syncOn` the position is
   shared with the presenter view over the deck's BroadcastChannel.
   The Ready check runs on entry if it has not run in this window.
   ========================================================================== */

export default function PresentMode({ deck, initialIndex = 0, initialStep = 0, syncOn = false, audience = false, onExit, onChange }) {
  const info = buildSequence(deck);
  const { seq } = info;
  const rootRef = useRef(null);
  const [cursorHidden, setCursorHidden] = useState(false);
  const idle = useRef(0);
  const ready = useReady(deck.slug);

  const toggleFs = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const ctl = useDeck(seq, {
    slug: deck.slug,
    initialIndex,
    initialStep,
    syncOn,
    onExit,
    onFullscreen: toggleFs,
    onChange,
  });
  const { pos, typed } = ctl;
  const { ref: fitRef, s: fitS, left: fitLeft, top: fitTop } = useFit(CANVAS_W, CANVAS_H);

  useEffect(() => {
    runReadyCheck(deck);
  }, [deck]);

  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  // Hide the pointer after two seconds without movement.
  useEffect(() => {
    const onMove = () => {
      setCursorHidden(false);
      window.clearTimeout(idle.current);
      idle.current = window.setTimeout(() => setCursorHidden(true), 2000);
    };
    window.addEventListener('mousemove', onMove);
    idle.current = window.setTimeout(() => setCursorHidden(true), 2000);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(idle.current);
    };
  }, []);

  const slots = [];
  for (let d = -1; d <= 1; d += 1) {
    const i = pos.index + d;
    if (i < 0 || i >= seq.length) continue;
    const slide = seq[i];
    const phase = d === 0 ? 'current' : d < 0 ? 'prev' : 'next';
    const step = d === 0 ? pos.step : d < 0 ? Math.max(1, slide.steps ?? 1) - 1 : 0;
    slots.push({ slide, phase, step });
  }

  // The phone remote (not in the audience window, which follows over the
  // BroadcastChannel): draws nothing and sits outside the overlay.
  const remote = !audience && (
    <RemoteBoundary>
      <RemoteScreen slug={deck.slug} seq={seq} ctl={ctl} />
    </RemoteBoundary>
  );

  return <>{remote}{createPortal(
    <div
      ref={rootRef}
      className={`sd-present${cursorHidden ? ' sd-present--nocursor' : ''}${audience ? ' sd-present--audience' : ''}`}
      data-deck={deck.slug}
      data-ready={ready.state}
      data-index={pos.index}
      data-step={pos.step}
      role="application"
      aria-roledescription="slide presentation"
      aria-label={`${deck.name}: slide ${labelOf(seq, pos.index)}`}
    >
      <div className="sd-present__fit" ref={fitRef}>
        <div
          className="sd-present__canvas"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${fitLeft}px, ${fitTop}px) scale(${fitS})` }}
        >
          {slots.map(({ slide, phase, step }) => (
            <div key={slide.id} className={`sd-present__slot is-${phase}`} aria-hidden={phase !== 'current'}>
              <SlideView deck={deck} slide={slide} step={step} phase={phase} mode="present" dir={phase === 'current' ? pos.dir : 'jump'} />
            </div>
          ))}
        </div>
      </div>
      {pos.black && <div className="sd-present__black" aria-label="Screen blacked out" />}
      {typed && <div className="sd-present__typed">Go to {typed}</div>}
      {ready.state === 'running' && (
        <div className="sd-present__loading">Loading media {ready.done} / {ready.total}</div>
      )}
    </div>,
    document.body,
  )}</>;
}
