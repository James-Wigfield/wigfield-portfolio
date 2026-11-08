/* Full-screen photo viewer: arrow keys, swipe, Escape. Rendered inside the
   .mr root (not a portal) so it keeps the design tokens. */

import { useEffect, useRef } from 'react';
import { COPY } from '../../copy.js';
import { Chevron, Cross } from './icons.jsx';

const copy = COPY.spot.lightbox;

export default function Lightbox({ photos, index, title, onIndex, onClose }) {
  const closeRef = useRef(null);
  const swipe = useRef(null);
  const n = photos.length;
  const p = photos[index];

  useEffect(() => {
    const previous = document.activeElement;
    // focus for keyboard users, without a ring flashing up on a tap
    closeRef.current?.focus({ preventScroll: true, focusVisible: false });
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n);
      else if (e.key === 'ArrowRight') onIndex((index + 1) % n);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, n, onIndex, onClose]);

  if (!p) return null;

  const onPointerDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - s.y)) onIndex((index + (dx < 0 ? 1 : -1) + n) % n);
  };

  return (
    <div className="mr-lightbox" role="dialog" aria-modal="true" aria-label={copy.label}>
      <div className="mr-lightbox__frame" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <img key={p.url} className="mr-lightbox__img" src={p.url} alt={COPY.spot.photoAlt(p.photo, title)} draggable="false" />
      </div>
      <div className="mr-lightbox__bar">
        <span className="mr-label">{copy.counter(index + 1, n)}</span>
        <div className="mr-lightbox__nav">
          {n > 1 && (
            <>
              <button type="button" className="mr-icon-btn" aria-label={copy.prev} onClick={() => onIndex((index - 1 + n) % n)}>
                <Chevron dir="left" />
              </button>
              <button type="button" className="mr-icon-btn" aria-label={copy.next} onClick={() => onIndex((index + 1) % n)}>
                <Chevron dir="right" />
              </button>
            </>
          )}
          <button ref={closeRef} type="button" className="mr-icon-btn" aria-label={copy.close} onClick={onClose}>
            <Cross />
          </button>
        </div>
      </div>
    </div>
  );
}
