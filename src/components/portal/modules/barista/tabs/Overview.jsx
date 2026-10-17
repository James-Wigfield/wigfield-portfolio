import Icon from '../../../icons';
import { HERO, LIGHT, WEEKLY } from '../content';
import { logStore, deepStore, weekStore, useStore, gauges, isoWeek, streak, daysBetween, todayISO, fmtDate, addMonths } from '../careLog';
import { fmtMinutes } from '../schedule';
import { Hook, Label, Receipt, Dot } from '../ui';
import Gauge from '../Gauge';
import SceneBoot from '../scenes/SceneBoot';
import SceneLight from '../scenes/SceneLight';

/* ============================================================================
   BARISTA · TAB 01 — OVERVIEW
   ----------------------------------------------------------------------------
   The machine boots in; the light decoder (James says what the light is
   doing — the machine decides, the guide never predicts); four status gauges
   from the care log; two doors into the routines.
   ========================================================================== */

const STATES = ['off', 'flash', 'solid'];

export default function Overview({ nav, schedule }) {
  const [log, setLog] = useStore(logStore);
  const [deep] = useStore(deepStore);
  const week = isoWeek();
  const [ticks] = useStore(weekStore(week));
  const light = log.light?.state || 'off';
  const L = LIGHT[light];
  const months = Math.max(0, Math.round(daysBetween(log.purchaseDate, todayISO()) / 30.4));
  const core = WEEKLY.filter((w) => !w.optional);
  const weekDone = core.filter((w) => ticks.ticks?.[w.id]).length;
  const deepDone = schedule.steps.filter((s) => deep.done?.[s.id]).length;
  const run = streak(log.weeks || {});

  const setLight = (state) => setLog((l) => ({ ...l, light: { state, at: new Date().toISOString() } }));

  return (
    <>
      <section className="bxi-hero">
        <div className="bxi-hero__scene">
          <SceneBoot />
        </div>
        <div className="bxi-hero__text">
          <p className="bxi-label bxi-label--accent">{HERO.eyebrow}</p>
          <h2 className="bxi-hero__title">{HERO.title}</h2>
          <p className="bxi-hook__sub">{HERO.sub}</p>
          <dl className="bxi-hero__facts">
            <div>
              <dt>Owned</dt>
              <dd><span className="bxi-num">{months}</span> months</dd>
            </div>
            <div>
              <dt>Deep clean</dt>
              <dd>{log.lastDeepClean ? `last ${fmtDate(log.lastDeepClean)}` : 'never logged'}</dd>
            </div>
            <div>
              <dt>Next due</dt>
              <dd>{fmtDate(addMonths(log.lastDeepClean || log.purchaseDate, 6))}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="bxi-sect">
        <Hook sub="The machine decides when a cleaning cycle or a descale is due. Tell the guide what the light is doing.">
          What’s the maintenance light doing?
        </Hook>
        <div className="bxi-seg bxi-seg--light" role="radiogroup" aria-label="Maintenance light">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={light === s}
              className={`bxi-seg__btn${light === s ? ' bxi-seg__btn--on' : ''}`}
              onClick={() => setLight(s)}
            >
              <span className={`bxi-ledchip bxi-ledchip--${s}`} aria-hidden="true" />
              {LIGHT[s].label}
            </button>
          ))}
        </div>
        <div className="bxi-split">
          <SceneLight state={light} />
          <div className="bxi-standfirst bxi-decoder" key={light}>
            <p className="bxi-label">{L.label} · {L.src}</p>
            <p className="bxi-decoder__head">{L.head}</p>
            <p className="bxi-body">{L.body}</p>
            <button type="button" className="bxi-btn bxi-btn--solid bxi-decoder__go" onClick={() => nav.to(L.go)}>
              {L.go.label} <Icon name="arrowRight" size={14} />
            </button>
            {light !== 'off' && (
              <button type="button" className="bxi-quiet" onClick={() => setLight('off')}>
                Done it — light’s off now
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="bxi-sect">
        <Label>Status · from your care log</Label>
        <div className="bxi-gauges">
          {gauges(log).map((g) => (
            <Gauge key={g.id} g={g} />
          ))}
        </div>
        <p className="bxi-small">
          Clean cycle and descale never predict a date — the light is the authority. Dates are editable in{' '}
          <button type="button" className="bxi-inlink" onClick={() => nav.go('log')}>Restock &amp; log</button>.
        </p>
      </section>

      <section className="bxi-doors">
        <button type="button" className="bxi-door" onClick={() => nav.go('routine', 'weekly')}>
          <span className="bxi-door__no">04 · Every week</span>
          <span className="bxi-door__t">Weekly ritual</span>
          <span className="bxi-door__s">About ten minutes. Resets every Monday.</span>
          <span className="bxi-door__meta">
            <span className="bxi-num">{weekDone}/{core.length}</span> this week
            {run > 0 && <> · <span className="bxi-num">{run}</span>-week streak</>}
          </span>
          <Icon name="arrowRight" size={18} className="bxi-door__arrow" />
        </button>
        <button type="button" className="bxi-door" onClick={() => nav.go('deep-clean')}>
          <span className="bxi-door__no">05 · Every six months</span>
          <span className="bxi-door__t">Deep clean</span>
          <span className="bxi-door__s">{schedule.steps.length} steps, optimised to {fmtMinutes(schedule.total)} (est.).</span>
          <span className="bxi-door__meta">
            <span className="bxi-num">{deepDone}/{schedule.steps.length}</span> done
          </span>
          <Icon name="arrowRight" size={18} className="bxi-door__arrow" />
        </button>
      </section>

      <p className="bxi-small bxi-sourceline">
        <Dot tone="care" />
        Every step cites Breville’s ANZ instruction book <Receipt src="IB p.2–32" />. Where something comes from general
        espresso practice instead, it’s marked as a tip.
      </p>
    </>
  );
}
