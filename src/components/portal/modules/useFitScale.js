import { useLayoutEffect, useRef, useState } from 'react';

/* ============================================================================
   useFitScale — measure a container and compute the scale that fits a fixed
   logical canvas inside it (letterboxed + centred). Shared by the deck renderer
   (DeckCanvas) and the editor (DeckEditor) so both use identical coordinate
   math: draw the canvas at native size, then `translate(left,top) scale(s)`.
   ========================================================================== */
export function useFitScale(canvas) {
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
