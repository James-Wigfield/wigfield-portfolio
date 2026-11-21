/* The trip, day by day (16 Dec -> 15 Jan): one cell per day, inked where a spot
   was captured. Tap a day to show only its spots; drag along the strip to scrub
   through the days; arrow keys step; "All days" clears it. Spots from outside the
   trip never appear here (they live under "Elsewhere"). */

import { useMemo, useRef } from 'react';
import { COPY } from '../copy.js';
import { spotDate, tripDays } from '../lib/trip.js';

const DAYS = tripDays();

export default function DayStrip({ spots, day, onDay }) {
  const stripRef = useRef(null);
  const dragging = useRef(false);
  const counts = useMemo(() => {
    const m = new Map();
    for (const s of spots) {
      const d = spotDate(s);
      if (d) m.set(d, (m.get(d) || 0) + 1);
    }
    return m;
  }, [spots]);
  const copy = COPY.days;
  const selected = day ? DAYS.find((d) => d.date === day) : null;

  const dayAt = (clientX) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!r) return null;
    const i = Math.max(0, Math.min(DAYS.length - 1, Math.floor(((clientX - r.left) / r.width) * DAYS.length)));
    return DAYS[i].date;
  };
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const d = dayAt(e.clientX);
    if (d) onDay(d);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const d = dayAt(e.clientX);
    if (d && d !== day) onDay(d);
  };
  const end = () => {
    dragging.current = false;
  };
  const onKeyDown = (e) => {
    const i = selected ? selected.index : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(0, Math.min(DAYS.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowRight' ? 1 : -1)));
      onDay(DAYS[next].date);
    } else if (e.key === 'Escape' && day) {
      e.preventDefault();
      onDay(null);
    }
  };

  return (
    <section className="mr-days" aria-label={copy.label} data-mr="day-strip">
      <div className="mr-days__head">
        <span className="mr-label">{selected ? copy.selected(selected.index + 1, selected.day, counts.get(selected.date) || 0) : copy.all}</span>
        {day && (
          <button type="button" className="mr-linkbtn" onClick={() => onDay(null)} data-mr="day-clear">
            {copy.clear}
          </button>
        )}
      </div>
      <div
        className="mr-days__strip"
        ref={stripRef}
        role="slider"
        tabIndex={0}
        aria-label={copy.slider}
        aria-valuemin={1}
        aria-valuemax={DAYS.length}
        aria-valuenow={selected ? selected.index + 1 : undefined}
        aria-valuetext={selected ? copy.selected(selected.index + 1, selected.day, counts.get(selected.date) || 0) : copy.all}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
      >
        {DAYS.map((d) => (
          <i
            key={d.date}
            data-on={counts.get(d.date) ? '' : undefined}
            style={counts.get(d.date) ? { '--n': Math.min(4, counts.get(d.date)) } : undefined}
            data-sel={d.date === day ? '' : undefined}
            data-first={d.day.getUTCDate() === 1 ? '' : undefined}
            title={copy.cell(d.index + 1, d.day, counts.get(d.date) || 0)}
            data-mr="day"
            data-date={d.date}
          />
        ))}
      </div>
      <div className="mr-days__ends" aria-hidden="true">
        <span className="mr-label">{copy.short(DAYS[0].day)}</span>
        <span className="mr-label">{copy.short(DAYS[DAYS.length - 1].day)}</span>
      </div>
    </section>
  );
}
