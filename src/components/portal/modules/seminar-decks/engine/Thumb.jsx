import SlideView, { CANVAS_H, CANVAS_W } from './SlideView';

/* A slide drawn small: the 1920 x 1080 canvas scaled to `width` px, finished state, clips as holds. */
export default function Thumb({ deck, slide, width = 320, step, mode = 'thumb', className = '' }) {
  const s = width / CANVAS_W;
  const last = Math.max(1, slide.steps ?? 1) - 1;
  return (
    <div className={`sd-thumb ${className}`} style={{ width, height: Math.round(CANVAS_H * s) }}>
      <div className="sd-thumb__canvas" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${s})` }}>
        <SlideView deck={deck} slide={slide} step={step ?? last} mode={mode} phase="current" />
      </div>
    </div>
  );
}
