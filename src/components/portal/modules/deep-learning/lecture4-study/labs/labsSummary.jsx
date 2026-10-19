import { useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { Lab, Chips } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { SCOREBOARD, MULTASK_RUNS, OUTCOMES, NAIVE7 } from '../slideData';
import { fmtInt } from '../rnn';
import './labsSummary.css';

/* ============================================================================
   LECTURE 4 STUDY — THE SCOREBOARD AND §16
     Scoreboard     the compact validation-MAE strip a section shows under its
                    labs (`board: true`): every model the slides have scored up
                    to and including this section, newest marked
     ScoreboardLab  the whole board in §16: slide order or best first, the
                    not-like-for-like rows flagged, slide 33's two runs
     OutcomesLab    slide 51's outcomes as a self-check, each linked back to
                    its sections and notebook pages
   Every number on the board is printed on a slide (SCOREBOARD in
   slideData.js); nothing here is computed except bar lengths.
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
const ORDER = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]));
const SCALE = 45000; // bar length = MAE / SCALE (the board's range of interest)
const BASE = NAIVE7.mae.rail;

const kindNote = (e) => (e.kind === 'ahead14' ? '14 days ahead' : e.kind === 'multi' ? '1 day ahead · two-output model' : e.kind === 'baseline' ? 'baseline · March–May 2019' : '1 day ahead');
const fair = (e) => e.kind !== 'ahead14';

function Row({ e, isNew, onJump, compact = false }) {
  const off = e.mae > SCALE;
  const pct = Math.min(1, e.mae / SCALE) * 100;
  return (
    <li className={`dl4s-board__row${isNew ? ' dl4s-board__row--new' : ''}${fair(e) ? '' : ' dl4s-board__row--unfair'}`}>
      <span className="dl4s-board__model">
        <code>{e.model}</code>
        {!compact && <small>{e.code}</small>}
      </span>
      <span className="dl4s-board__bar" aria-hidden="true">
        <span className={`dl4s-board__fill${e.kind === 'baseline' ? ' dl4s-board__fill--base' : ''}`} style={{ width: `${pct}%` }} />
        {off && <span className="dl4s-board__off">off the scale →</span>}
        <span className="dl4s-board__baseline" style={{ left: `${(BASE / SCALE) * 100}%` }} />
      </span>
      <span className="dl4s-board__val">{e.label}</span>
      <span className="dl4s-board__meta">
        {onJump ? (
          <button type="button" className="dl4s-link" onClick={() => onJump(e.sec)}>slide {e.slide}</button>
        ) : (
          <span>slide {e.slide}</span>
        )}
        <span className="dl4s-board__kind">
          <span className={`dl4s-dot${fair(e) ? '' : ' dl4s-dot--warn'}`} />
          {kindNote(e)}
        </span>
        {isNew && <span className="dl4s-board__new">new here</span>}
      </span>
      {e.note && !compact && <span className="dl4s-board__note">{e.note}</span>}
    </li>
  );
}

/* ── the strip under a section's labs ────────────────────────────────────── */
export function Scoreboard({ upTo }) {
  const { jumpTo } = useStudy();
  const at = ORDER[upTo] ?? 0;
  const sofar = SCOREBOARD.filter((e) => ORDER[e.sec] <= at);
  const next = SCOREBOARD.find((e) => ORDER[e.sec] > at);
  // the baseline, the best like-for-like model so far, and this section's rows
  const one = sofar.filter((e) => !e.kind && !e.gt && e.sec !== upTo);
  const best = one.length ? one.reduce((a, e) => (e.mae < a.mae ? e : a)) : null;
  const shown = sofar.filter((e) => e.kind === 'baseline' || e.sec === upTo || e === best);
  return (
    <section className="dl4s-board dl4s-board--compact" aria-label="Validation-MAE scoreboard so far">
      <header className="dl4s-board__head">
        <span className="dl4s-board__title"><Icon name="chart" size={14} /> Validation-MAE scoreboard</span>
        <span className="dl4s-board__sub">rail riders · models scored on the validation windows of 2019-01 → 2019-05; the naive baseline on March–May 2019 · lower is better · every number printed on a slide</span>
      </header>
      <ol className="dl4s-board__list">
        {shown.map((e) => <Row key={e.id} e={e} isNew={e.sec === upTo} onJump={jumpTo} compact />)}
      </ol>
      <p className="dl4s-board__foot">
        the baseline{best ? ', the best so far' : ''} and what’s new here · {sofar.length} of {SCOREBOARD.length} models so far (all in §16)
        {next && <> · next: <code>{next.model}</code> (§{SEC[next.sec]?.no})</>}
        {' · '}the dashed tick is the naive baseline, {fmtInt(BASE)} · hollow dot = 14 days ahead, not like-for-like (details in §16)
      </p>
    </section>
  );
}

/* ── the whole board (§16) ───────────────────────────────────────────────── */
export function ScoreboardLab() {
  const { jumpTo } = useStudy();
  const [order, setOrder] = useState('slides');
  const [only, setOnly] = useState('all');
  const rows = useMemo(() => {
    let r = SCOREBOARD.slice();
    if (only === 'fair') r = r.filter(fair);
    if (order === 'best') r.sort((a, b) => a.mae - b.mae);
    return r;
  }, [order, only]);
  const best = SCOREBOARD.filter((e) => fair(e) && !e.kind).reduce((a, e) => (e.mae < a.mae ? e : a));
  return (
    <Lab
      title="The whole scoreboard · slides 18–50"
      slides="slides 18–50"
      tryThis="before sorting best-first, predict the winner among the one-day rail forecasts; then show only like-for-like rows and notice which numbers drop out — and why they can’t be compared directly."
    >
      <div className="dl-lab__controls">
        <Chips label="order" value={order} options={[{ v: 'slides', l: 'slide order (the story)' }, { v: 'best', l: 'best first' }]} onChange={setOrder} />
        <Chips label="rows" value={only} options={[{ v: 'all', l: 'all twelve' }, { v: 'fair', l: 'like-for-like only' }]} onChange={setOnly} />
      </div>
      <section className="dl4s-board dl4s-board--full" aria-label="Validation-MAE scoreboard">
        <ol className="dl4s-board__list">
          {rows.map((e) => <Row key={e.id} e={e} onJump={jumpTo} />)}
        </ol>
      </section>
      <div className="dl4s-board__runs">
        <p className="dl4s-stagehead">Slide 33’s multask_model — two runs, both printed</p>
        <table className="dl-table">
          <thead><tr><th>run</th><th>both outputs together</th><th>bus</th><th>rail</th></tr></thead>
          <tbody>
            {MULTASK_RUNS.map((r) => (
              <tr key={r.run}><td>{r.run}</td><td>{fmtInt(r.total)}</td><td>{fmtInt(r.bus)}</td><td>{fmtInt(r.rail)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="dl4s-cap">
          “Different runs can yield slightly different results” (slide 33). In both runs the together-number is, to rounding, the mean of the bus and rail MAEs
          ((26,812 + 28,896) / 2 = 27,854; (25,162 + 23,680) / 2 = 24,421) — this page’s check, not the slide’s.
        </p>
      </div>
      <p className="dl4s-readout">
        Best one-day rail forecast on the slides: <b><code>{best.model}</code> at {best.label}</b> (slide {best.slide}), with 5 input features. The naive
        7-day shift scored {fmtInt(BASE)} over March–May 2019 (slide 18). Rows flagged with a hollow dot are not like-for-like: they forecast 14 days ahead, which
        is harder than one. The multitask row is the rail output of a model that also predicts bus; its both-outputs figure, 27,855, is the one not to compare.
      </p>
    </Lab>
  );
}

/* ── §16 · the slide-51 outcomes ─────────────────────────────────────────── */
export function OutcomesLab() {
  const { stats, jumpTo, outcomes, toggleOutcome } = useStudy();
  const done = outcomes.length;
  return (
    <Lab
      title="Slide 51 · can you do each of these?"
      slides="slide 51"
      tryThis="tick an outcome once you can explain it from your notes without looking; if you can’t yet, its chips jump back to the section — or straight to its notebook page."
    >
      <p className="dl4s-readout"><b>{done}/{OUTCOMES.length}</b> outcomes ticked · <b>{stats.pages}/{SECTIONS.length}</b> notebook pages copied</p>
      <ol className="dl4s-outcomes">
        {OUTCOMES.map((o, n) => {
          const on = outcomes.includes(n);
          const lines = o.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = o.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          return (
            <li key={o.text} className={`dl4s-outcome${on ? ' dl4s-outcome--on' : ''}`}>
              <button type="button" className="dl4s-outcome__tick" aria-pressed={on} onClick={() => toggleOutcome(n)} aria-label={`${o.text}: ${on ? 'ticked' : 'not ticked'}`}>
                {on && <Icon name="check" size={13} strokeWidth={2.4} />}
              </button>
              <span className="dl4s-outcome__text">{o.text}</span>
              <span className="dl4s-outcome__links">
                {o.secs.filter((id) => SEC[id]).map((id) => (
                  <span key={id} className="dl4s-outcome__sec">
                    <button type="button" className="dl4s-secchip" onClick={() => jumpTo(id)}><b>§{SEC[id].no}</b> {SEC[id].short}</button>
                    <button type="button" className="dl4s-link dl4s-outcome__nb" onClick={() => jumpTo(id, { nb: true })}>notebook page{stats.per[id]?.complete ? ' · copied' : ''}</button>
                  </span>
                ))}
              </span>
              <span className="dl4s-outcome__prog">{lines}/{total} lines</span>
            </li>
          );
        })}
      </ol>
    </Lab>
  );
}
