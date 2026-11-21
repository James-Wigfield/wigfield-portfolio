/* The spot list beside (desktop) or under (phone) the map, set like an archive's
   index: "No. 004", the rendered room's cut-out standing on the paper (or a small
   print of its first photo until it's built), the title in the serif, place and
   date. Rows on the map first, newest first; then an "Elsewhere" group. Hovering
   a row lifts its marker on the map. */

import { useEffect, useRef } from 'react';
import { COPY } from '../copy.js';
import { mediaNamed } from '../lib/api.js';
import { personName, placeOf, thumbOf } from '../lib/spots.js';
import { spotDate } from '../lib/trip.js';
import { markerImage, useMarkerImages } from './markerImages.js';

function SpotRow({ spot, n, selected, onSelect, onHover }) {
  useMarkerImages(); // re-render when a shrunk hero arrives
  // the cut-out: render/marker, else the hero trimmed in the browser (the map's markers share it)
  const stored = mediaNamed(spot, 'render', 'marker');
  const made = !stored && spot.status === 'rendered' ? markerImage(spot) : null;
  const marker = stored || made;
  const th = marker ? null : thumbOf(spot);
  return (
    <button
      type="button"
      className="mr-row"
      data-mr="spot-row"
      data-id={spot.id}
      aria-pressed={selected}
      onClick={() => onSelect(spot.id)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(spot.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(spot.id)}
      onBlur={() => onHover(null)}
    >
      <span className="mr-row-no" data-mr="row-no">
        {n ? COPY.list.no(n) : ''}
      </span>
      <span className="mr-row-cut" data-kind={marker ? 'marker' : th ? 'print' : 'none'}>
        {marker ? <img src={marker.url} alt="" loading="lazy" /> : th ? <img src={th.url} alt="" loading="lazy" /> : null}
      </span>
      <span className="mr-row-main">
        <span className="mr-row-title">{spot.title}</span>
        <span className="mr-row-sub">
          <span className="mr-dot" data-status={spot.status} aria-hidden="true" />
          {[placeOf(spot), COPY.list.day(spotDate(spot))].filter(Boolean).join(' · ')}
        </span>
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

export default function SpotList({ spots, elsewhere, selectedId, onSelect, onHover = () => {}, numbers, elsewhereRef }) {
  const ref = useRef(null);

  // Keep the selected row in view when the selection comes from the map.
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const row = ref.current.querySelector(`[data-mr="spot-row"][data-id="${CSS.escape(selectedId)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const row = (s) => (
    <li key={s.id}>
      <SpotRow spot={s} n={numbers?.get(s.id)} selected={s.id === selectedId} onSelect={onSelect} onHover={onHover} />
    </li>
  );
  return (
    <div className="mr-list" ref={ref}>
      {spots.length > 0 && <ul className="mr-list-rows">{spots.map(row)}</ul>}
      {elsewhere.length > 0 && (
        <section className="mr-list-group" ref={elsewhereRef} data-mr="elsewhere">
          <h3 className="mr-label mr-list-group-title">{COPY.list.elsewhere}</h3>
          <ul className="mr-list-rows">{elsewhere.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
