import Icon from '../../../icons';
import { DONTS, RESTOCK, STORING, SERVICE } from '../content';
import { logStore, restockStore, prefsStore, useStore, fmtDate, todayISO, isoWeek, weekOffset, filterDate, addMonths } from '../careLog';
import { Hook, Receipt, Dot, TipMark, Rich, Label } from '../ui';

/* ============================================================================
   BARISTA · TAB 07 — RESTOCK & LOG
   ----------------------------------------------------------------------------
   Don'ts (IB, with receipts) · what's on hand vs what the next deep clean
   needs (persisted) · the care log, every date editable/backfillable ·
   storing the machine for the Dec–Jan trip · Breville AU service number.
   ========================================================================== */

const LOG_FIELDS = [
  { key: 'purchaseDate', label: 'Bought', note: 'Defaulted to six months before first open' },
  { key: 'lastDeepClean', label: 'Last deep clean' },
  { key: 'lastCleanCycle', label: 'Last cleaning cycle' },
  { key: 'lastDescale', label: 'Last descale' },
  { key: 'filterInstalled', label: 'Filter fitted', note: 'Blank = assumed at first use' },
];

export default function Log() {
  const [log, setLog] = useStore(logStore);
  const [stock, setStock] = useStore(restockStore);
  const [prefs, setPrefs] = useStore(prefsStore);
  const storing = prefs.storing || {};
  const weeksDone = Object.values(log.weeks || {}).filter((w) => w.complete).length;
  const recent = Array.from({ length: 8 }, (_, i) => weekOffset(-7 + i));

  const setDate = (key, value) => setLog((l) => ({ ...l, [key]: value || (key === 'purchaseDate' ? l.purchaseDate : null) }));
  const bump = (id, d) => setStock((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) + d) }));
  const toggleStore = (i) => setPrefs((p) => ({ ...p, storing: { ...(p.storing || {}), [i]: !p.storing?.[i] } }));

  return (
    <>
      <Hook sub="What never to do, what to keep on hand, and the dates the status gauges read from.">
        Keep it stocked. Keep it honest.
      </Hook>

      <div className="bxi-split">
        <section className="bxi-sect">
          <Label>Don’t</Label>
          <ul className="bxi-ruled">
            {DONTS.map((d) => (
              <li key={d.t}>
                <span className="bxi-nope" aria-hidden="true" />
                <span className="bxi-ruled__body">
                  <span className="bxi-ruled__t">
                    {d.t}
                    {d.tip && <TipMark />}
                  </span>
                </span>
                <Receipt src={d.src} />
              </li>
            ))}
          </ul>
        </section>

        <section className="bxi-sect">
          <Label>On hand · next deep clean needs</Label>
          <ul className="bxi-stock">
            {RESTOCK.map((r) => {
              const have = stock[r.id] || 0;
              const short = r.deep > have;
              return (
                <li key={r.id} className="bxi-stock__row">
                  <div className="bxi-stock__text">
                    <span className="bxi-stock__name">
                      <Dot tone={short ? 'due' : 'good'} /> {r.name}
                    </span>
                    <span className="bxi-ruled__s">{r.use}</span>
                    <Receipt src={r.src} />
                  </div>
                  <div className="bxi-stock__ctl">
                    <button type="button" className="bxi-stepper" onClick={() => bump(r.id, -1)} aria-label={`One fewer ${r.name}`}>−</button>
                    <span className="bxi-stock__n" aria-live="polite">
                      <span className="bxi-num">{have}</span>
                      <span className="bxi-small"> / {r.deep} needed</span>
                    </span>
                    <button type="button" className="bxi-stepper" onClick={() => bump(r.id, 1)} aria-label={`One more ${r.name}`}>+</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="bxi-small">Item names only — no part codes or prices were verified on breville.com/en-au.</p>
        </section>
      </div>

      <section className="bxi-sect">
        <Label>Care log · edit or backfill any date</Label>
        <div className="bxi-logrows">
          {LOG_FIELDS.map((f) => (
            <label key={f.key} className="bxi-logrow">
              <span className="bxi-logrow__k">{f.label}</span>
              <input
                type="date"
                className="bxi-date"
                value={log[f.key] || ''}
                max={todayISO()}
                onChange={(e) => setDate(f.key, e.target.value)}
              />
              <span className="bxi-logrow__v">{log[f.key] ? fmtDate(log[f.key]) : '—'}</span>
              {f.note && <span className="bxi-logrow__n">{f.note}</span>}
            </label>
          ))}
        </div>
        <p className="bxi-small">
          Filter due {fmtDate(addMonths(filterDate(log), 3))} · weekly rituals completed: <span className="bxi-num">{weeksDone}</span>
        </p>
        <ol className="bxi-weeks" aria-label="Last eight weeks">
          {recent.map((wk) => {
            const w = log.weeks?.[wk];
            return (
              <li key={wk} className={`bxi-weeks__w${w?.complete ? ' bxi-weeks__w--done' : ''}${wk === isoWeek() ? ' bxi-weeks__w--now' : ''}`}>
                <span className="bxi-weeks__k">W{wk.split('-W')[1]}</span>
                <span className="bxi-weeks__v">{w ? `${w.done}/${w.total}` : '—'}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="bxi-sect">
        <Label>Storing it for a trip · away Dec–Jan? Do this the night before</Label>
        <ul className="bxi-checks bxi-checks--compact">
          {STORING.map((t, i) => (
            <li key={t} className={`bxi-check${storing[i] ? ' bxi-check--on' : ''}`}>
              <button type="button" className="bxi-check__btn" aria-pressed={!!storing[i]} onClick={() => toggleStore(i)}>
                <span className="bxi-check__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="bxi-check__box" aria-hidden="true">{storing[i] && <Icon name="check" size={14} />}</span>
                <span className="bxi-check__text"><span className="bxi-check__t"><Rich text={t} /></span></span>
              </button>
            </li>
          ))}
        </ul>
        <Receipt src="IB p.26" />
      </section>

      <p className="bxi-small bxi-sourceline">
        <Dot tone="care" /> Breville customer service · AU <span className="bxi-num">{SERVICE.au}</span> · NZ{' '}
        <span className="bxi-num">{SERVICE.nz}</span> <Receipt src={SERVICE.src} />
      </p>
    </>
  );
}
