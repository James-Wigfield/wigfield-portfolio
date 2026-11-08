/* The spot list beside (desktop) or behind a switch (phone) the map.
   Rows on the map first, newest first; then an "Elsewhere" group. */

import { useEffect, useRef } from 'react';
import { COPY } from '../copy.js';
import { formatDate } from '../lib/format.js';
import { personName, placeOf, thumbOf } from '../lib/spots.js';

function SpotRow({ spot, selected, onSelect }) {
  const th = thumbOf(spot);
  return (
    <button type="button" className="mr-row" data-mr="spot-row" data-id={spot.id} aria-pressed={selected} onClick={() => onSelect(spot.id)}>
      <span className="mr-row-thumb">{th && <img src={th.url} alt="" loading="lazy" />}</span>
      <span className="mr-row-main">
        <span className="mr-row-title">{spot.title}</span>
        <span className="mr-row-sub">{[placeOf(spot), formatDate(spot.capturedAt)].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="mr-row-side">
        <span className="mr-dot" data-status={spot.status}>
          {COPY.app.status[spot.status] || spot.status}
        </span>
        <span className="mr-label">{personName(spot.createdBy)}</span>
      </span>
    </button>
  );
}

export default function SpotList({ spots, elsewhere, selectedId, onSelect, elsewhereRef }) {
  const ref = useRef(null);

  // Keep the selected row in view when the selection comes from the map.
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const row = ref.current.querySelector(`[data-mr="spot-row"][data-id="${CSS.escape(selectedId)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="mr-list" ref={ref}>
      {spots.length > 0 && (
        <ul className="mr-list-rows">
          {spots.map((s) => (
            <li key={s.id}>
              <SpotRow spot={s} selected={s.id === selectedId} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
      {elsewhere.length > 0 && (
        <section className="mr-list-group" ref={elsewhereRef} data-mr="elsewhere">
          <h3 className="mr-label mr-list-group-title">{COPY.list.elsewhere}</h3>
          <ul className="mr-list-rows">
            {elsewhere.map((s) => (
              <li key={s.id}>
                <SpotRow spot={s} selected={s.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
