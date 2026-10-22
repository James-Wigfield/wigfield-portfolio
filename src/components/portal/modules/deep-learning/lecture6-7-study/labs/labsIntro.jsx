import { Lab } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { ROADMAP } from '../slideData';
import './labsIntro.css';

/* ============================================================================
   LECTURES 6–7 STUDY — LAB FOR §0
     RoadmapLab   slide 3's five topics, wired to the sections that teach
                  them, with how much of each one's notebook is copied
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

function SecChip({ id }) {
  const { jumpTo } = useStudy();
  const s = SEC[id];
  if (!s) return null;
  return (
    <button type="button" className="dl67s-secchip" onClick={() => jumpTo(id)}>
      <b>§{s.no}</b> {s.short}
    </button>
  );
}

export function RoadmapLab() {
  const { stats, jumpTo } = useStudy();
  return (
    <Lab
      title="Slide 3’s roadmap, mapped onto this page"
      slides="slide 3"
      tryThis="before scrolling on, guess which two of the five topics take the most slides; then count their section chips. The bar beside each topic fills as you tick off its notebook lines."
    >
      <ol className="dl67s-road">
        {ROADMAP.map((t, i) => {
          const done = t.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = t.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const slides = t.secs.map((id) => SEC[id]?.slides).join(', ');
          return (
            <li key={t.topic} className="dl67s-road__item">
              <span className="dl67s-road__no" aria-hidden="true">{i + 1}</span>
              <span className="dl67s-road__topic">{t.topic} <span className="dl67s-mini">· slides {slides}</span></span>
              <span className="dl67s-road__prog" aria-label={`${done} of ${total} notebook lines copied`}>
                <span className="dl67s-road__track"><span className="dl67s-road__fill" style={{ width: `${pct}%` }} /></span>
                <span className="dl67s-road__pct">{done}/{total}</span>
              </span>
              <span className="dl67s-road__secs">
                {t.secs.map((id) => <SecChip key={id} id={id} />)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="dl67s-cap">
        Variational autoencoders and GANs take four sections each (slides 10–18 and 19–27). The chapter title also names diffusion models, which
        this deck does not cover. <button type="button" className="dl67s-link" onClick={() => jumpTo('s12')}>§12</button> is the summary and the reading for next time.
      </p>
    </Lab>
  );
}
