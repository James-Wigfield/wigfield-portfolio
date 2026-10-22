import Icon from '../../../../icons';
import { Stage } from '../stage';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { ROADMAP, OUTCOMES } from '../slideData';
import './labsIntro.css';

/* ============================================================================
   LECTURE 8 STUDY — §0 AND §17
     RoadmapLab   slide 3's seven topics as a route: one stop per topic, the
                  sections that teach it as links, and a stop fills in once
                  all its notebook lines are copied
     OutcomesLab  slide 50's six outcomes as a persisted self-check, each
                  linked to its sections and notebook pages
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

function SecLinks({ ids, nb = false }) {
  const { jumpTo, stats } = useStudy();
  return (
    <span className="dl8s-route__secs">
      {ids.filter((id) => SEC[id]).map((id) => (
        <span key={id} className="dl8s-route__sec">
          <button type="button" className="dl8s-route__link" onClick={() => jumpTo(id)}>
            <b>§{SEC[id].no}</b> {SEC[id].short}
          </button>
          {nb && stats.per[id]?.total > 0 && (
            <button type="button" className="dl8s-route__nb" onClick={() => jumpTo(id, { nb: true })}>
              notes{stats.per[id]?.complete ? ' ✓' : ''}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}

/* ── §0 · the route ──────────────────────────────────────────────────────── */
export function RoadmapLab() {
  const { stats } = useStudy();
  return (
    <Stage
      title="Seven stops, in slide order"
      slides="slide 3"
      tryThis="Guess which stop takes the most sections, then follow its links."
      own={null}
    >
      <ol className="dl8s-route">
        {ROADMAP.map((t, i) => {
          const done = t.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = t.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          const full = total > 0 && done === total;
          return (
            <li key={t.topic} className={`dl8s-route__stop${full ? ' dl8s-route__stop--done' : ''}`}>
              <span className="dl8s-route__dot" aria-hidden="true">{full ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}</span>
              <span className="dl8s-route__topic">{t.topic}</span>
              <SecLinks ids={t.secs} />
              <span className="dl8s-route__count" aria-label={`${done} of ${total} notebook lines copied`}>{done}/{total}</span>
            </li>
          );
        })}
      </ol>
    </Stage>
  );
}

/* ── §17 · slide 50's outcomes ───────────────────────────────────────────── */
export function OutcomesLab() {
  const { outcomes, toggleOutcome, printing } = useStudy();
  return (
    <Stage
      title="Can you do each of these?"
      slides="slides 50–51"
      tryThis="Tick an outcome only when you can explain it without looking; if not, its links jump back to the section or its notes."
      own={null}
    >
      <ol className="dl8s-route dl8s-route--outcomes">
        {OUTCOMES.map((o, n) => {
          const on = outcomes.includes(n);
          return (
            <li key={o.text} className={`dl8s-route__stop${on ? ' dl8s-route__stop--done' : ''}`}>
              <button
                type="button"
                className="dl8s-route__dot dl8s-route__tick"
                aria-pressed={on}
                onClick={() => toggleOutcome(n)}
                aria-label={`${o.text}: ${on ? 'ticked' : 'not ticked'}`}
              >
                {on ? <Icon name="check" size={12} strokeWidth={2.6} /> : printing ? n + 1 : ''}
              </button>
              <span className="dl8s-route__topic">{o.text}</span>
              <SecLinks ids={o.secs} nb />
            </li>
          );
        })}
      </ol>
    </Stage>
  );
}
