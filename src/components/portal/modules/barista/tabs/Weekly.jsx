import Icon from '../../../icons';
import { WEEKLY, VIDEOS } from '../content';
import { logStore, weekStore, useStore, isoWeek, streak, mondayOf, fmtDate, toISO } from '../careLog';
import { Rich, Receipt, Dot } from '../ui';

/* ============================================================================
   BARISTA · WEEKLY RITUAL — a checklist that resets every ISO week
   ----------------------------------------------------------------------------
   Ticks live in bxi:weekly:<ISO-week>, so Monday brings a fresh list without
   any clean-up. Completing the core items writes the week into the care log
   (log.weeks), which drives the streak and the sequencer. The burr brush is
   conditional (only when the light flashed) and doesn't gate completion.
   The clear-water backflush isn't here: Breville gives no text steps for it.
   ========================================================================== */

const core = WEEKLY.filter((w) => !w.optional);

function MicroIcon({ kind }) {
  switch (kind) {
    case 'tray':
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--tray" aria-hidden="true">
          <rect className="bxi-micro__a" x="3" y="12" width="26" height="8" rx="2" />
          <path className="bxi-micro__b" d="M6 9h20" />
        </svg>
      );
    case 'screen':
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--screen" aria-hidden="true">
          <circle className="bxi-micro__a" cx="16" cy="12" r="9" />
          <path className="bxi-micro__b" d="M10 12h12M16 6v12" />
        </svg>
      );
    case 'basket':
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--basket" aria-hidden="true">
          <path className="bxi-micro__a" d="M5 7h22l-3 11H8Z" />
          <path className="bxi-micro__b" d="M11 21h10" />
        </svg>
      );
    case 'wand':
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--wand" aria-hidden="true">
          <path className="bxi-micro__a" d="M12 2l3 14h3l-2-14Z" />
          <path className="bxi-micro__b" d="M14 19q-2 2 0 4M18 19q2 2 0 4" />
        </svg>
      );
    case 'brush':
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--brush" aria-hidden="true">
          <path className="bxi-micro__a" d="M12 12h16" />
          <path className="bxi-micro__b" d="M12 8l-7-2M12 12H4M12 16l-7 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 24" className="bxi-micro bxi-micro--shine" aria-hidden="true">
          <rect className="bxi-micro__a" x="4" y="4" width="24" height="16" rx="3" />
          <path className="bxi-micro__b" d="M10 18l8-12" />
        </svg>
      );
  }
}

export default function Weekly() {
  const week = isoWeek();
  const store = weekStore(week);
  const [state, setState] = useStore(store);
  const [log, setLog] = useStore(logStore);
  const ticks = state.ticks || {};
  const done = core.filter((w) => ticks[w.id]).length;
  const complete = done === core.length;
  const run = streak(log.weeks || {});

  const toggle = (id) => {
    const next = { ...ticks, [id]: !ticks[id] };
    setState({ ticks: next });
    const n = core.filter((w) => next[w.id]).length;
    setLog((l) => ({
      ...l,
      weeks: { ...(l.weeks || {}), [week]: { done: n, total: core.length, complete: n === core.length } },
    }));
  };

  const clear = () => {
    setState({ ticks: {} });
    setLog((l) => ({ ...l, weeks: { ...(l.weeks || {}), [week]: { done: 0, total: core.length, complete: false } } }));
  };

  return (
    <div className="bxi-weekly">
      <div className="bxi-weekly__head">
        <div>
          <p className="bxi-label">Week {week.split('-W')[1]} · from Mon {fmtDate(toISO(mondayOf()), { day: 'numeric', month: 'short' })}</p>
          <p className="bxi-weekly__count" aria-live="polite">
            <span className="bxi-num">{String(done).padStart(2, '0')}</span> / {String(core.length).padStart(2, '0')}
            {complete && <span className="bxi-weekly__done"> · week done</span>}
          </p>
        </div>
        <div className="bxi-weekly__streak">
          <span className="bxi-num">{run}</span>
          <span className="bxi-small">week{run === 1 ? '' : 's'} in a row</span>
        </div>
      </div>
      <ul className="bxi-checks">
        {WEEKLY.map((w, i) => {
          const on = !!ticks[w.id];
          return (
            <li key={w.id} className={`bxi-check${on ? ' bxi-check--on' : ''}${w.optional ? ' bxi-check--opt' : ''}`}>
              <button type="button" className="bxi-check__btn" aria-pressed={on} onClick={() => toggle(w.id)}>
                <span className="bxi-check__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="bxi-check__box" aria-hidden="true">{on && <Icon name="check" size={14} />}</span>
                <span className="bxi-check__text">
                  <span className="bxi-check__t">{w.t}</span>
                  <span className="bxi-check__d"><Rich text={w.d} /></span>
                </span>
                <MicroIcon kind={w.anim} />
              </button>
              <span className="bxi-check__src"><Receipt src={w.src} /></span>
            </li>
          );
        })}
      </ul>
      <p className="bxi-small">
        <Dot tone="care" /> Breville also has a{' '}
        <a href={VIDEOS.backflush.url} target="_blank" rel="noreferrer">clear water backflush video</a>; it isn’t on
        this list because Breville publishes no written steps for it.
      </p>
      <button type="button" className="bxi-quiet" onClick={clear}>Clear this week</button>
    </div>
  );
}
