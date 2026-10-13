import { Cite, VerdictGlyph } from '../../../shared/chrome';
import { HYPOTHESES, VERDICTS } from '../../../shared/meta';
import { T } from '../../../shared/Num';

/* ============================================================================
   VERDICT DECK — THE HYPOTHESIS SCOREBOARD (N6) AND THE MARGIN
   ----------------------------------------------------------------------------
   <Scoreboard resolved fresh focus compact/>  the margin column: one
       ruled row per hypothesis, id, name, glyph and state label. A state
       change crossfades the glyph and wipes the label in; the row takes its
       verdict's tint. Colour never carries the state alone (shape + words).
   <PredictionTable step/>             slide 6: the four predictions in full,
       set as a journal table; the scoreboard is born here, all pending.
   <GlyphLegend/>                      the four states, shape and label.
   <VerdictLine id/>                   the inline verdict under a result.
   <Sidenotes items/>                  the margin glossary on slides 2 to 5.
   ========================================================================== */

function StateMark({ state, size = 34 }) {
  return (
    <span className={`d2-mark is-${state}`}>
      <VerdictGlyph state={state} size={size} />
    </span>
  );
}

export function Scoreboard({ resolved, fresh, focus = [], compact = false }) {
  if (compact) {
    return (
      <aside className="d2-board d2-board--compact" aria-label="Hypothesis scoreboard, all pending">
        <p className="d2-board__head" data-role="foot">H1-H4</p>
        <ol className="d2-board__list">
          {HYPOTHESES.map((h) => (
            <li key={h.id} className="d2-board__crow">
              <span className="d2-board__id" data-role="chart">{h.id}</span>
              <StateMark state="pending" size={32} />
            </li>
          ))}
        </ol>
      </aside>
    );
  }
  return (
    <aside className="d2-board" aria-label="Hypothesis scoreboard">
      <p className="d2-board__head" data-role="foot">Four predictions</p>
      <ol className="d2-board__list">
        {HYPOTHESES.map((h) => {
          const done = resolved.has(h.id);
          const state = done ? h.verdict : 'pending';
          const cls = [
            'd2-board__row',
            `is-${h.verdict}`,
            done ? 'is-done' : 'is-pending',
            fresh.has(h.id) ? 'is-fresh' : '',
            focus.includes(h.id) ? 'is-focus' : '',
          ].join(' ');
          return (
            <li key={h.id} className={cls} data-state={state}>
              <span className="d2-board__tint" aria-hidden="true" />
              <span className="d2-board__id" data-role="chart">{h.id}</span>
              <span className="d2-board__name" data-role="chart">{h.name}</span>
              <span className="d2-board__state">
                <span className="d2-board__glyphs">
                  <span className="d2-board__g d2-board__g--pending"><StateMark state="pending" /></span>
                  <span className="d2-board__g d2-board__g--final"><StateMark state={h.verdict} /></span>
                </span>
                <span className="d2-board__labels">
                  <span className="d2-board__l d2-board__l--pending" data-role="chart">{VERDICTS.pending.label}</span>
                  <span className={`d2-board__l d2-board__l--final is-${h.verdict}`} data-role="chart">{VERDICTS[h.verdict].label}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

export function PredictionTable({ on }) {
  return (
    <table className={`d2-ptable${on ? ' is-on' : ''}`}>
      <thead>
        <tr>
          <th data-role="foot" />
          <th data-role="foot">Prediction</th>
          <th data-role="foot">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {HYPOTHESES.map((h, i) => (
          <tr key={h.id} style={{ '--d2-i': i }}>
            <th scope="row">
              <span className="d2-ptable__id" data-role="chart">{h.id}</span>
              <span className="d2-ptable__name" data-role="chart">{h.name}</span>
            </th>
            <td className="d2-ptable__line" data-role="chart"><T>{h.line}</T></td>
            <td className="d2-ptable__state">
              <StateMark state="pending" size={30} />
              <span data-role="chart">{VERDICTS.pending.label}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GlyphLegend() {
  return (
    <div className="d2-legend">
      <p className="d2-board__head" data-role="foot">How to read a verdict</p>
      <ul>
        {['pending', 'trade', 'not', 'reversed'].map((s) => (
          <li key={s} className={`is-${s}`}>
            <StateMark state={s} size={30} />
            <span data-role="chart">{VERDICTS[s].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerdictLine({ id, on, children }) {
  const h = HYPOTHESES.find((x) => x.id === id);
  return (
    <div className={`d2-vline is-${h.verdict}${on ? ' is-on' : ''}`}>
      <StateMark state={h.verdict} size={44} />
      <p className="d2-vline__text" data-role="body">
        <span className="d2-vline__id">{h.id}</span> <span className="d2-vline__state">{VERDICTS[h.verdict].label}</span>
        {children ? <span className="d2-vline__why">{children}</span> : null}
      </p>
    </div>
  );
}

export function Sidenotes({ items }) {
  return (
    <aside className="d2-notes" aria-label="Terms">
      <p className="d2-board__head" data-role="foot">Terms</p>
      <dl>
        {items.map((it) => (
          <div key={it.term} className="d2-notes__item">
            <dt data-role="foot">{it.term}</dt>
            <dd data-role="foot">{it.def}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** An in-text citation, set as a footnote-sized mark (gate G4: foot >= 20 px). */
export function Ref({ k, refNum }) {
  return <span className="d2-ref" data-role="foot"><Cite k={k} refNum={refNum} /></span>;
}
