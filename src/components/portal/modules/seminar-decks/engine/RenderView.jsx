import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SlideView, { CANVAS_H, CANVAS_W } from './SlideView';
import { buildSequence } from './sequence';
import { indexFromLabel } from './controller';
import { useFit } from './hooks';

/* ============================================================================
   SEMINAR DECKS — RENDER ROUTE  (<deck>/render/<slide-id or label>)
   ----------------------------------------------------------------------------
   One slide on its own, drawn over the page at 1920 x 1080 (or fitted to the
   window with ?fit=1), for the export script and the gates. ?step=N picks a
   build step (default: the last, the finished state); ?mode=present renders
   it live, otherwise clips show their hold frames and nothing animates.
   When fonts and images have loaded the root gets data-ready="1".
   ========================================================================== */

export default function RenderView({ deck, slideId }) {
  const { seq } = buildSequence(deck);
  const params = new URLSearchParams(window.location.search);
  let i = seq.findIndex((s) => s.id === slideId);
  if (i < 0) i = indexFromLabel(seq, slideId);
  const slide = seq[Math.max(0, i)];
  const last = Math.max(1, slide?.steps ?? 1) - 1;
  const step = params.has('step') ? Math.min(last, Math.max(0, parseInt(params.get('step'), 10) || 0)) : last;
  const mode = params.get('mode') === 'present' ? 'present' : 'export';
  const fitOn = params.get('fit') === '1';
  const { ref: fitRef, s: fitS, left: fitLeft, top: fitTop } = useFit(CANVAS_W, CANVAS_H);
  const root = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const settle = async () => {
      await document.fonts.ready;
      for (let k = 0; k < 40 && alive; k += 1) {
        const imgs = [...(root.current?.querySelectorAll('img') ?? [])];
        const pending = imgs.filter((im) => !im.complete);
        if (!pending.length) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 250));
      if (alive) setReady(true);
    };
    settle();
    return () => {
      alive = false;
    };
  }, [slideId, step]);

  if (!slide) return null;
  const style = fitOn
    ? { transform: `translate(${fitLeft}px, ${fitTop}px) scale(${fitS})` }
    : undefined;

  return createPortal(
    <div className={`sd-render${fitOn ? ' sd-render--fit' : ''}`} ref={fitOn ? fitRef : undefined} data-ready={ready ? '1' : '0'} data-slide={slide.id}>
      <div className="sd-render__canvas sd-static" ref={root} style={{ width: CANVAS_W, height: CANVAS_H, ...style }}>
        <SlideView deck={deck} slide={slide} step={step} mode={mode} phase="current" dir="jump" />
      </div>
    </div>,
    document.body,
  );
}
