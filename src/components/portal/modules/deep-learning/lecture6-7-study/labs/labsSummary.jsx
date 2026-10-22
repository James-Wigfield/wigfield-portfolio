import Icon from '../../../../icons';
import { Lab } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { OUTCOMES, READING } from '../slideData';
import './labsSummary.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LAB FOR §12
     OutcomesLab   slide 31's five outcomes as a persisted self-check, each
                   linked to the sections (and notebook pages) that teach it
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function OutcomesLab() {
  const { stats, jumpTo, outcomes, toggleOutcome } = useStudy();
  const done = outcomes.length;
  return (
    <Lab
      title="Slide 31 · can you do each of these?"
      slides="slides 31–32"
      tryThis="tick an outcome only once you can explain it from your notes without looking. If you can’t yet, its chips jump back to the section, or straight to its notebook page."
    >
      <p className="dl67s-readout dl67s-noprint"><b>{done}/{OUTCOMES.length}</b> outcomes ticked · <b>{stats.pages}</b> notebook pages copied</p>
      <ol className="dl67s-outcomes">
        {OUTCOMES.map((o, n) => {
          const on = outcomes.includes(n);
          const lines = o.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = o.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          return (
            <li key={o.text} className={`dl67s-outcome${on ? ' dl67s-outcome--on' : ''}`}>
              <button type="button" className="dl67s-outcome__tick" aria-pressed={on} onClick={() => toggleOutcome(n)} aria-label={`${o.text}: ${on ? 'ticked' : 'not ticked'}`}>
                {on && <Icon name="check" size={13} strokeWidth={2.4} />}
              </button>
              <span className="dl67s-outcome__text">{o.text}</span>
              <span className="dl67s-outcome__links">
                {o.secs.filter((id) => SEC[id]).map((id) => (
                  <span key={id} className="dl67s-outcome__sec">
                    <button type="button" className="dl67s-secchip" onClick={() => jumpTo(id)}><b>§{SEC[id].no}</b> {SEC[id].short}</button>
                    {stats.per[id]?.total > 0 && (
                      <button type="button" className="dl67s-link dl67s-outcome__nb" onClick={() => jumpTo(id, { nb: true })}>notebook page{stats.per[id]?.complete ? ' · copied' : ''}</button>
                    )}
                  </span>
                ))}
              </span>
              <span className="dl67s-outcome__prog">{lines}/{total} lines</span>
            </li>
          );
        })}
      </ol>
      <p className="dl67s-cap">
        <b>In neither list:</b> semantic interpolation (slides 17–18,{' '}
        <button type="button" className="dl67s-link" onClick={() => jumpTo('s06')}>§6</button>). It sits among the variational autoencoder slides, so this page counts it under that outcome.
      </p>
      <p className="dl67s-cap"><b>Slide 32:</b> {READING}</p>
    </Lab>
  );
}
