import Icon from '../../../../icons';
import { Lab } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { OUTCOMES, READING } from '../slideData';
import './labsSummary.css';

/* ============================================================================
   LECTURE 5 STUDY — LAB FOR §10
     OutcomesLab   slide 26's six outcomes as a persisted self-check, each
                   linked to the sections (and notebook pages) that teach it;
                   §9 is listed honestly as the one topic with no outcome
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function OutcomesLab() {
  const { stats, jumpTo, outcomes, toggleOutcome } = useStudy();
  const done = outcomes.length;
  return (
    <Lab
      title="Slide 26 · can you do each of these?"
      slides="slides 26–27"
      tryThis="tick an outcome only once you can explain it from your notes without looking. If you can’t yet, its chips jump back to the section, or straight to its notebook page."
    >
      <p className="dl5s-readout dl5s-noprint"><b>{done}/{OUTCOMES.length}</b> outcomes ticked · <b>{stats.pages}</b> notebook pages copied</p>
      <ol className="dl5s-outcomes">
        {OUTCOMES.map((o, n) => {
          const on = outcomes.includes(n);
          const lines = o.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = o.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          return (
            <li key={o.text} className={`dl5s-outcome${on ? ' dl5s-outcome--on' : ''}`}>
              <button type="button" className="dl5s-outcome__tick" aria-pressed={on} onClick={() => toggleOutcome(n)} aria-label={`${o.text}: ${on ? 'ticked' : 'not ticked'}`}>
                {on && <Icon name="check" size={13} strokeWidth={2.4} />}
              </button>
              <span className="dl5s-outcome__text">{o.text}</span>
              <span className="dl5s-outcome__links">
                {o.secs.filter((id) => SEC[id]).map((id) => (
                  <span key={id} className="dl5s-outcome__sec">
                    <button type="button" className="dl5s-secchip" onClick={() => jumpTo(id)}><b>§{SEC[id].no}</b> {SEC[id].short}</button>
                    {stats.per[id]?.total > 0 && (
                      <button type="button" className="dl5s-link dl5s-outcome__nb" onClick={() => jumpTo(id, { nb: true })}>notebook page{stats.per[id]?.complete ? ' · copied' : ''}</button>
                    )}
                  </span>
                ))}
              </span>
              <span className="dl5s-outcome__prog">{lines}/{total} lines</span>
            </li>
          );
        })}
      </ol>
      <p className="dl5s-cap">
        <b>No outcome on slide 26:</b> slide 3’s topic “Training one autoencoder at a time”,{' '}
        <button type="button" className="dl5s-link" onClick={() => jumpTo('s09')}>§9</button>. It is still part of the lecture (slides 23–25).
      </p>
      <p className="dl5s-cap"><b>Slide 27:</b> {READING}.</p>
    </Lab>
  );
}
