import { useEffect, useRef } from 'react';

/* ============================================================================
   DL PROJECT 2 — CONTENTS RAIL
   ----------------------------------------------------------------------------
   JupyterLab's table of contents, typeset like a book's: the notebook's own
   headings (h1–h3, numbered as the notebook numbers them) with each section's
   explainer plates listed under it in small mono caps. Scroll-spy marks where
   you are; the rail keeps the current entry inside its own scroller and never
   scrolls the page.
   ========================================================================== */

export default function Toc({ entries, current, onJump, onClose, variant = 'rail' }) {
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    // the rail scrolls as a whole; in the dropdown only the list scrolls
    const box = variant === 'drop' ? list : list?.closest('.dlp2-rail');
    const item = list?.querySelector('[aria-current="location"]');
    if (!box || !item) return;
    const top = item.offsetTop;
    const pad = 56;
    if (top < box.scrollTop + pad) box.scrollTop = Math.max(0, top - pad);
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight - pad) box.scrollTop = top + item.offsetHeight - box.clientHeight + pad;
  }, [current, variant]);

  return (
    <nav className={`dlp2-toc dlp2-toc--${variant}`} aria-label="Notebook contents">
      <div className="dlp2-toc__head">
        <span className="dlp2-toc__title">Contents</span>
        <span className="dlp2-toc__key">
          <span className="dlp2-toc__keyplate" aria-hidden="true" /> plate
        </span>
        {onClose && (
          <button type="button" className="dlp2-toc__close" onClick={onClose} aria-label="Hide the contents rail">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
              <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <ol className="dlp2-toc__list" ref={listRef}>
        {entries.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              className={`dlp2-toc__item dlp2-toc__item--${e.kind} dlp2-toc__item--l${e.level}${i === current ? ' dlp2-toc__item--on' : ''}${i < current ? ' dlp2-toc__item--past' : ''}`}
              aria-current={i === current ? 'location' : undefined}
              onClick={() => onJump(e)}
            >
              {e.kind === 'plate' ? (
                <>
                  <span className="dlp2-toc__plateno">{e.no}</span>
                  <span className="dlp2-toc__text">{e.text}</span>
                </>
              ) : (
                <span className="dlp2-toc__text">{e.text}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
