/* The drawing sheet's title block, bottom-right of the 3D stage: sheet number,
   place, captured date, a scale bar that follows the zoom and a north arrow
   that turns with the orbit. The viewer's 'view' event drives the live parts
   straight into the DOM (no React render per frame). */

import { useEffect, useRef } from 'react';
import { COPY } from '../../copy.js';
import { scaleFor } from './scale.js';

const fmt = (m) => String(+m.toFixed(2));

export default function TitleBlock({ viewer, sheet, name, place, date, compact = false }) {
  const barRef = useRef(null);
  const labelRef = useRef(null);
  const northRef = useRef(null);
  const copy = COPY.titleBlock;

  useEffect(() => {
    if (!viewer) return undefined;
    return viewer.on('view', ({ mpp, north }) => {
      const { metres, px } = scaleFor(mpp, compact ? 40 : 56);
      if (barRef.current) barRef.current.style.width = `${Math.round(px)}px`;
      if (labelRef.current) labelRef.current.textContent = compact ? copy.scaleShort(fmt(metres)) : copy.scale(fmt(metres / 2), fmt(metres));
      if (northRef.current) northRef.current.style.transform = `rotate(${north.toFixed(1)}deg)`;
    });
  }, [viewer, copy, compact]);

  return (
    <aside className="mr-titleblock" data-compact={compact ? '' : undefined} aria-label={copy.label} data-mr="titleblock">
      <dl className="mr-titleblock__rows">
        {name && (
          <div className="mr-titleblock__name">
            <dt>{copy.name}</dt>
            <dd>{name}</dd>
          </div>
        )}
        {sheet && (
          <div>
            <dt>{copy.sheet}</dt>
            <dd data-mr="sheet">{sheet}</dd>
          </div>
        )}
        {!compact && place && (
          <div>
            <dt>{copy.place}</dt>
            <dd>{place}</dd>
          </div>
        )}
        {date && (
          <div>
            <dt>{copy.date}</dt>
            <dd>{date}</dd>
          </div>
        )}
      </dl>
      <div className="mr-titleblock__foot" aria-hidden="true">
        <span className="mr-scalebar">
          <span className="mr-scalebar__bar" ref={barRef}>
            <i />
            <i />
          </span>
          <span className="mr-scalebar__label" ref={labelRef} />
        </span>
        <span className="mr-north">
          <svg viewBox="-12 -15 24 30" ref={northRef} role="presentation">
            <path className="mr-north__fill" d="M0 -8 L0 9 L-4.5 9 Z" />
            <path className="mr-north__line" d="M0 -8 L4.5 9 L0 9 L-4.5 9 Z" />
            <text className="mr-north__n" x="0" y="-10.5">{copy.north}</text>
          </svg>
        </span>
      </div>
    </aside>
  );
}
