import { useState } from 'react';
import { logStore, useStore, fromISO, toISO, addMonths, daysBetween, isoWeek, fmtDate, filterDate, todayISO, mondayOf } from '../careLog';
import { useScene } from '../sceneKit';
import Stage from '../Stage';

/* ============================================================================
   BARISTA · MAINTENANCE SEQUENCER — six months as a drum machine
   ----------------------------------------------------------------------------
   26 week columns from the last deep clean (or the purchase date) × one row
   per job. Real dates from the care log: weekly rituals done, the filter's
   3-month due dates, the next deep clean. Clean cycle and descale are the
   machine's call, so their rows show logged dates as hits and a dashed lane
   for "when the light says". A playhead sweeps the bar; dots pulse as it
   passes. Tap a column to read that week.
   ========================================================================== */

const CELL = 14;
const LEFT = 96;
const TOP = 30;
const ROW = 22;

const ROWS = [
  { id: 'weekly', label: 'Weekly ritual' },
  { id: 'cycle', label: 'Clean cycle' },
  { id: 'filter', label: 'Water filter' },
  { id: 'descale', label: 'Descale' },
  { id: 'deep', label: 'Deep clean' },
];

function weekIndex(anchor, iso) {
  return Math.floor(daysBetween(anchor, iso) / 7);
}

export default function Sequencer() {
  const [log] = useStore(logStore);
  // Six months from the last deep clean — or, once that's overdue, the next
  // six months from this week (log the deep clean to re-anchor it).
  const logged = log.lastDeepClean || log.purchaseDate;
  const overdue = weekIndex(logged, todayISO()) > 25;
  const anchor = overdue ? toISO(mondayOf()) : logged;
  const now = weekIndex(anchor, todayISO());
  const [pick, setPick] = useState(Math.min(25, Math.max(0, now)));

  const weekStart = (i) => {
    const d = fromISO(anchor);
    d.setDate(d.getDate() + i * 7);
    return toISO(d);
  };

  // Hits per row: { col: 'done' | 'due' | 'missed' | 'plan' }
  const hits = { weekly: {}, cycle: {}, filter: {}, descale: {}, deep: {} };
  for (let i = 0; i < 26; i += 1) {
    const key = isoWeek(fromISO(weekStart(i)));
    const w = log.weeks?.[key];
    hits.weekly[i] = w?.complete ? 'done' : i < now ? 'missed' : i === now ? 'due' : 'plan';
  }
  const mark = (row, iso, kind) => {
    if (!iso) return;
    const i = weekIndex(anchor, iso);
    if (i >= 0 && i < 26) hits[row][i] = kind;
  };
  mark('cycle', log.lastCleanCycle, 'done');
  mark('descale', log.lastDescale, 'done');
  const f = filterDate(log);
  [3, 6, 9].forEach((m) => mark('filter', addMonths(f, m), daysBetween(addMonths(f, m), todayISO()) >= 0 ? 'due' : 'plan'));
  if (log.filterInstalled) mark('filter', log.filterInstalled, 'done');
  // The next deep clean lands six months on — the end of the bar. When it's
  // already overdue the window starts now, with the deep clean due this week.
  if (overdue) hits.deep[0] = 'due';
  else {
    hits.deep[25] = now >= 25 ? 'due' : 'plan';
    if (log.lastDeepClean) hits.deep[0] = 'done';
  }

  const api = useScene(
    (tl, q) => {
      const head = q('.bxi-sq-head');
      tl.set(head, { x: 0 }, 0);
      tl.fromTo(head, { x: 0 }, { x: 25 * CELL, duration: 6, ease: 'none' }, 0.2);
      for (let i = 0; i < 26; i += 1) {
        const dots = q(`.bxi-sq-col-${i}`);
        if (dots.length) {
          tl.fromTo(dots, { scale: 1, transformOrigin: '50% 50%' }, { scale: 1.7, duration: 0.09, yoyo: true, repeat: 1 }, 0.2 + i * (6 / 25));
        }
      }
    },
    { name: 'sequencer', rebuild: `${anchor}:${now}` },
  );

  const months = [];
  for (let i = 0; i < 26; i += 1) {
    const ws = weekStart(i);
    const prev = i ? weekStart(i - 1) : null;
    if (!prev || fromISO(ws).getMonth() !== fromISO(prev).getMonth()) months.push({ i, label: fmtDate(ws, { month: 'short' }) });
  }

  const rowsDue = ROWS.filter((r) => ['due', 'plan', 'done'].includes(hits[r.id][pick]));
  const W = LEFT + 26 * CELL + 8;
  const H = TOP + ROWS.length * ROW + 6;

  return (
    <div className="bxi-seq">
      {overdue && (
        <p className="bxi-small">The deep clean is due, so this shows the next six months from this week. Logging it re-anchors the grid.</p>
      )}
      <Stage {...api} className="bxi-scene--seq" name="Six months, week by week" viewBox={`0 0 ${W} ${H}`} label="A 26-week grid of maintenance jobs from the last deep clean, with a playhead sweeping across.">
        {months.map((m) => (
          <text key={m.i} className="bxi-s-label" x={LEFT + m.i * CELL + 2} y={12}>{m.label}</text>
        ))}
        {now >= 0 && now < 26 && (
          <g>
            <rect className="bxi-sq-now" x={LEFT + now * CELL} y={16} width={CELL} height={H - 18} rx="2" />
            <text className="bxi-s-label bxi-s-label--accent" x={LEFT + now * CELL + CELL / 2} y={24} textAnchor="middle">now</text>
          </g>
        )}
        <rect className="bxi-sq-pick" x={LEFT + pick * CELL + 1} y={TOP - 4} width={CELL - 2} height={ROWS.length * ROW} rx="2" />
        {ROWS.map((r, ri) => {
          const y = TOP + ri * ROW + ROW / 2;
          const lightRow = r.id === 'cycle' || r.id === 'descale';
          return (
            <g key={r.id}>
              <text className="bxi-s-label bxi-s-label--strong" x={6} y={y + 3}>{r.label}</text>
              <line className="bxi-s-faint" x1={LEFT} x2={LEFT + 26 * CELL} y1={y} y2={y} />
              {lightRow && <line className="bxi-sq-lane" x1={LEFT} x2={LEFT + 26 * CELL} y1={y} y2={y} />}
              {Array.from({ length: 26 }, (_, i) => {
                const h = hits[r.id][i];
                if (!h) return null;
                return (
                  <circle
                    key={i}
                    className={`bxi-sq-dot bxi-sq-dot--${h} bxi-sq-col-${i}`}
                    cx={LEFT + i * CELL + CELL / 2}
                    cy={y}
                    r={r.id === 'weekly' ? 3.2 : 4.6}
                  />
                );
              })}
            </g>
          );
        })}
        <g className="bxi-sq-head">
          <line className="bxi-sq-playhead" x1={LEFT + CELL / 2} x2={LEFT + CELL / 2} y1={TOP - 6} y2={H - 2} />
        </g>
        {Array.from({ length: 26 }, (_, i) => (
          <rect
            key={i}
            className="bxi-sq-hit"
            x={LEFT + i * CELL}
            y={TOP - 6}
            width={CELL}
            height={ROWS.length * ROW + 6}
            onClick={() => setPick(i)}
          >
            <title>{`Week of ${fmtDate(weekStart(i))}`}</title>
          </rect>
        ))}
      </Stage>
      <div className="bxi-seq__read">
        <button type="button" className="bxi-btn bxi-btn--ghost" onClick={() => setPick(Math.max(0, pick - 1))} aria-label="Previous week">‹</button>
        <div className="bxi-seq__week" aria-live="polite">
          <p className="bxi-label">Week {String(pick + 1).padStart(2, '0')} · from {fmtDate(weekStart(pick))}</p>
          <p className="bxi-body">
            {rowsDue.length ? rowsDue.map((r) => `${r.label}${hits[r.id][pick] === 'done' ? ' (done)' : ''}`).join(' · ') : 'Nothing scheduled — watch the light.'}
          </p>
        </div>
        <button type="button" className="bxi-btn bxi-btn--ghost" onClick={() => setPick(Math.min(25, pick + 1))} aria-label="Next week">›</button>
      </div>
      <ul className="bxi-seq__key">
        <li><span className="bxi-sq-sw bxi-sq-sw--done" /> done (logged)</li>
        <li><span className="bxi-sq-sw bxi-sq-sw--due" /> due</li>
        <li><span className="bxi-sq-sw bxi-sq-sw--plan" /> coming up</li>
        <li><span className="bxi-sq-sw bxi-sq-sw--missed" /> missed</li>
        <li><span className="bxi-sq-sw bxi-sq-sw--lane" /> when the light says</li>
      </ul>
    </div>
  );
}
