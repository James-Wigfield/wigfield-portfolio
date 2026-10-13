import { useMemo } from 'react';
import { buildSequence } from './sequence';
import { useReducedMotion } from './hooks';

/* ============================================================================
   SEMINAR DECKS — ONE SLIDE ON THE 1920 x 1080 CANVAS
   ----------------------------------------------------------------------------
   Renders slide.render(ctx) inside the deck's Frame. ctx:
     step, steps      current build step and the slide's step count
     active           true for the slide the audience is looking at
     phase            'current' | 'next' (preloading) | 'prev' (left behind)
     mode             'present' | 'preview' | 'thumb' | 'export'
     dir              how the step was entered: forward | backward | jump
     reduced          prefers-reduced-motion (or ?reduced=1)
     clip(i)          the state for a clip that plays at build step i
     at(i)            true once build step i has been reached
     refNum(k)        the deck's IEEE number for a cited work
     slide, deck, info
   ========================================================================== */

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export default function SlideView({ deck, slide, step = 0, phase = 'current', mode = 'present', dir = 'jump', className = '' }) {
  const reduced = useReducedMotion();
  const info = buildSequence(deck);
  const steps = Math.max(1, slide.steps ?? 1);
  const active = phase === 'current' && mode === 'present';

  const ctx = useMemo(() => {
    const isStatic = mode !== 'present';
    const clip = (i = 0) => {
      if (isStatic) return step >= i ? 'hold' : 'start';
      if (phase === 'prev') return step >= i ? 'hold' : 'start';
      if (phase === 'next') return 'start';
      if (step > i) return 'hold';
      if (step === i) return dir === 'backward' ? 'hold' : 'play';
      return 'start';
    };
    return {
      step, steps, active, phase, mode, dir, reduced, slide, deck, info,
      clip,
      at: (i) => step >= i,
      refNum: info.refNum,
      still: isStatic || reduced,
    };
  }, [step, steps, active, phase, mode, dir, reduced, slide, deck, info]);

  const Frame = deck.Frame;
  const body = slide.render ? slide.render(ctx) : null;

  return (
    <div
      className={`sd-slide ${deck.className ?? ''} ${className}`}
      data-slide={slide.id}
      data-step={step}
      data-mode={mode}
      data-phase={phase}
      data-reduced={reduced ? '1' : '0'}
      data-kind={slide.kind}
      style={{ width: CANVAS_W, height: CANVAS_H }}
    >
      {Frame ? <Frame slide={slide} ctx={ctx}>{body}</Frame> : body}
    </div>
  );
}
