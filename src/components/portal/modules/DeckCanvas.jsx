import { useLayoutEffect, useRef, useState } from 'react';
import { CANVAS, resolveColor } from './deckModel';
import { renderMarkdown } from './markdownLite';

/* ============================================================================
   DeckCanvas — renders ONE slide of a deck, scaled to fit its container
   ----------------------------------------------------------------------------
   The deck lives in a fixed logical space (CANVAS, 1280×720). This measures the
   container and draws the canvas at native size with a `scale()` transform, so
   the same coordinates render identically in-page and in full screen. Elements
   are absolutely positioned in canvas units; text renders via markdownLite.

   Read-only for now; the in-portal editor (later) will reuse the same geometry.
   ========================================================================== */

// Measure a node's box; recompute the fit-scale for CANVAS inside it.
function useFitScale(canvas) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = box.w && box.h ? Math.min(box.w / canvas.w, box.h / canvas.h) : 0;
  const left = (box.w - canvas.w * s) / 2;
  const top = (box.h - canvas.h * s) / 2;
  return { ref, s, left, top };
}

function TextElement({ el }) {
  const st = el.style || {};
  return (
    <div
      className="dc-el dc-el--text"
      style={{
        left: el.x, top: el.y, width: el.w, height: el.h,
        zIndex: el.z || 0,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        fontSize: st.fontSize ? `${st.fontSize}px` : undefined,
        textAlign: st.align || 'left',
        color: resolveColor(st.color),
        background: resolveColor(st.bg),
        fontWeight: st.weight,
      }}
    >
      <div className="dc-md">{renderMarkdown(el.markdown)}</div>
    </div>
  );
}

function ImageElement({ el }) {
  return (
    <div
      className="dc-el dc-el--image"
      style={{
        left: el.x, top: el.y, width: el.w, height: el.h,
        zIndex: el.z || 0,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      }}
    >
      <img src={el.src} alt={el.alt || ''} style={{ objectFit: el.fit || 'contain' }} />
    </div>
  );
}

export default function DeckCanvas({ slide, canvas = CANVAS }) {
  const { ref, s, left, top } = useFitScale(canvas);
  const elements = [...(slide?.elements || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
  const bg = slide?.background;

  return (
    <div className="dc-viewport" ref={ref}>
      <div
        className="dc-canvas"
        style={{
          width: canvas.w,
          height: canvas.h,
          transform: `translate(${left}px, ${top}px) scale(${s})`,
          background: bg?.type === 'color' ? resolveColor(bg.color) : undefined,
          visibility: s ? 'visible' : 'hidden',
        }}
      >
        {elements.map((el) =>
          el.type === 'image'
            ? <ImageElement key={el.id} el={el} />
            : <TextElement key={el.id} el={el} />,
        )}
      </div>
    </div>
  );
}

// Expose the logical size for callers that want it without importing the model.
DeckCanvas.CANVAS = CANVAS;
