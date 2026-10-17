import { LANES, fmtMinutes } from '../schedule';
import { STEPS } from '../content';

/* ============================================================================
   BARISTA · GANTT — the computed deep-clean schedule, three lanes
   ----------------------------------------------------------------------------
   You · Machine · Soak bath. Bars sit at their computed start/end; the
   critical chain is inked, passive work is hatched, the open-ended tip soak
   has a dashed tail. Every bar is a button into the step player.
   ========================================================================== */

const title = (stepId) => STEPS.find((s) => s.id === stepId)?.title || stepId;

/** Stack overlapping bars within a lane into rows. */
function rows(tasks) {
  const ends = [];
  return tasks
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((t) => {
      let r = ends.findIndex((e) => e <= t.start);
      if (r < 0) r = ends.length;
      ends[r] = t.end;
      return { t, r };
    });
}

export default function Gantt({ schedule, onPick, current }) {
  const { tasks, total, critical, steps } = schedule;
  const stepNo = (id) => steps.findIndex((s) => s.id === id) + 1;
  const ticks = [];
  // Every 10 min, leaving room for the end label.
  for (let m = 0; m < total - 6; m += 10) ticks.push(m);

  return (
    <div className="bxi-gantt" role="group" aria-label="Deep-clean schedule">
      <div className="bxi-gantt__scroll">
        <div className="bxi-gantt__inner">
          <div className="bxi-gantt__axis" aria-hidden="true">
            {ticks.map((m) => (
              <span key={m} className="bxi-gantt__tick" style={{ left: `${(m / total) * 100}%` }}>
                {m}
              </span>
            ))}
            <span className="bxi-gantt__tick bxi-gantt__tick--end" style={{ left: '100%' }}>{total} min</span>
          </div>
          {LANES.map((lane) => {
            const own = tasks.filter((t) => t.uses.includes(lane.id) && (t.end > t.start || t.open));
            const placed = rows(own);
            const nRows = Math.max(1, ...placed.map((p) => p.r + 1));
            return (
              <div key={lane.id} className="bxi-gantt__lane" style={{ '--rows': nRows }}>
                <span className="bxi-gantt__lanelabel">{lane.label}</span>
                <div className="bxi-gantt__track">
                  {ticks.map((m) => (
                    <span key={m} className="bxi-gantt__grid" style={{ left: `${(m / total) * 100}%` }} aria-hidden="true" />
                  ))}
                  {placed.map(({ t, r }) => {
                    const passive = !t.uses.includes('you');
                    const w = ((t.end - t.start) / total) * 100;
                    const n = stepNo(t.step);
                    const cls = [
                      'bxi-bar',
                      critical.has(t.id) ? 'bxi-bar--crit' : '',
                      passive ? 'bxi-bar--passive' : '',
                      t.open ? 'bxi-bar--open' : '',
                      current === t.step ? 'bxi-bar--current' : '',
                      w < 7 ? 'bxi-bar--narrow' : '',
                    ].join(' ');
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={cls}
                        style={{ left: `${(t.start / total) * 100}%`, width: `${w}%`, top: `calc(${r} * var(--row))` }}
                        onClick={() => onPick(t.step)}
                        title={`${String(n).padStart(2, '0')} ${title(t.step)} — ${t.label}, ${t.start}–${t.end} min (${t.src === 'est' ? 'estimate' : t.src})`}
                        aria-label={`Step ${n}: ${t.label}, minute ${t.start} to ${t.end}`}
                      >
                        <span className="bxi-bar__n">{String(n).padStart(2, '0')}</span>
                        <span className="bxi-bar__t">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bxi-gantt__key">
        <span><i className="bxi-key-swatch bxi-key-swatch--crit" /> critical chain</span>
        <span><i className="bxi-key-swatch" /> hands-on</span>
        <span><i className="bxi-key-swatch bxi-key-swatch--passive" /> machine / soaking</span>
        <span><i className="bxi-key-swatch bxi-key-swatch--open" /> no set time</span>
        <span className="bxi-gantt__scrollhint">Scroll sideways →</span>
      </div>
      <p className="bxi-small">
        Times are minutes from the start. Machine cycles and soaks use the manual&apos;s times; hands-on minutes are this
        guide&apos;s estimates. Total {fmtMinutes(total)} (est.).
      </p>
    </div>
  );
}
