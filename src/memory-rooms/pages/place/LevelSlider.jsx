/* The Inside stage's level slider: a vertical hairline track over the left of the stage, one tick per level
   labelled with its name, the top level at the top. Dragging scrubs smoothly between levels (onScrub with a
   fractional level); letting go settles on the nearest (onSettle). Arrow keys move one level, Home / End go to the
   lowest / the top; a level's name is a button too. role="slider", so a screen reader hears the level's name. */

import { useRef, useState } from 'react';
import { COPY } from '../../copy.js';

export default function LevelSlider({ levels, value, onScrub, onSettle, disabled = false }) {
  const copy = COPY.building;
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null); // the fractional level while dragging
  const n = levels.length - 1;
  const shown = drag ?? value;
  const at = Math.round(value);
  if (n < 1) return null;

  const fromY = (clientY) => {
    const r = trackRef.current.getBoundingClientRect();
    const t = (clientY - r.top) / Math.max(1, r.height);
    return Math.max(0, Math.min(n, n * (1 - t)));
  };
  const down = (e) => {
    if (disabled || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus();
    const p = fromY(e.clientY);
    setDrag(p);
    onScrub(p);
  };
  const move = (e) => {
    if (drag == null) return;
    const p = fromY(e.clientY);
    setDrag(p);
    onScrub(p);
  };
  const up = (e) => {
    if (drag == null) return;
    const p = Math.round(fromY(e.clientY));
    setDrag(null);
    onSettle(p);
  };
  const key = (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key];
    let next = null;
    if (step) next = Math.max(0, Math.min(n, at + step));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n;
    if (next == null) return;
    e.preventDefault();
    if (next !== at) onSettle(next);
  };

  const pct = (i) => `${(1 - i / n) * 100}%`;
  return (
    <div className="mr-levelslider" data-mr="level-slider" data-level={levels[at]?.id}>
      <span className="mr-label mr-levelslider__title">{copy.levelLabel}</span>
      <div className="mr-levelslider__body">
        <div
          className="mr-levelslider__track"
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-orientation="vertical"
          aria-label={copy.levelSlider}
          aria-valuemin={0}
          aria-valuemax={n}
          aria-valuenow={at}
          aria-valuetext={levels[at]?.name || levels[at]?.id}
          aria-disabled={disabled || undefined}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        >
          <span className="mr-levelslider__rule" aria-hidden="true" />
          {levels.map((l, i) => (
            <span key={l.id} className="mr-levelslider__tick" style={{ top: pct(i) }} aria-hidden="true" />
          ))}
          <span className="mr-levelslider__thumb" style={{ top: pct(shown) }} aria-hidden="true" />
        </div>
        <ol className="mr-levelslider__names">
          {[...levels].reverse().map((l) => {
            const i = levels.indexOf(l);
            return (
              <li key={l.id} style={{ top: pct(i) }}>
                <button type="button" tabIndex={-1} disabled={disabled} aria-pressed={i === at} data-mr="level-name" data-id={l.id} onClick={() => onSettle(i)}>
                  {l.name || l.id}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
