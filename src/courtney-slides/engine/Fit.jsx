import { useLayoutEffect, useRef, useState } from 'react';

export const W = 1920;
export const H = 1080;

/** Measures its box and hands children a 1920 x 1080 canvas scaled to fit (letterboxed, centred). */
export function Fit({ className = 'cs-fit', children, onPointerDown, onPointerUp }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;
  const left = (box.w - W * s) / 2;
  const top = (box.h - H * s) / 2;
  return (
    <div ref={ref} className={className} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {s > 0 && (
        <div className="cs-canvas" style={{ transform: `translate(${left}px, ${top}px) scale(${s})` }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A still slide for the grid, presenter preview and print. */
export function SlideStill({ slide, beat, meta }) {
  const Comp = slide.Comp;
  return (
    <div className="cs-slot">
      <div className="cs-ground" />
      <div className="cs-slide">
        <Comp ctx={{ beat: beat ?? slide.beats - 1, live: false }} meta={meta} />
      </div>
    </div>
  );
}
