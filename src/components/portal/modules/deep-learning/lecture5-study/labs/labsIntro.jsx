import { useState } from 'react';
import { Lab } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { ROADMAP } from '../slideData';
import './labsIntro.css';

/* ============================================================================
   LECTURE 5 STUDY — LABS FOR §0 AND §1
     RoadmapLab   slide 3's eight topics, wired to the sections that teach
                  them, with how much of each one's notebook is copied
     UsesLab      slide 4's three things autoencoders are good for, each
                  linked to where this lecture picks it up (or doesn't)
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

function SecChip({ id }) {
  const { jumpTo } = useStudy();
  const s = SEC[id];
  if (!s) return null;
  return (
    <button type="button" className="dl5s-secchip" onClick={() => jumpTo(id)}>
      <b>§{s.no}</b> {s.short}
    </button>
  );
}

/* ── §0 · the roadmap ─────────────────────────────────────────────────────── */
export function RoadmapLab() {
  const { stats, jumpTo } = useStudy();
  return (
    <Lab
      title="Slide 3’s roadmap, mapped onto this page"
      slides="slide 3"
      tryThis="before scrolling on, guess which topic gets the most slides; then click its chips. The bar beside each topic fills as you tick off its notebook lines."
    >
      <ol className="dl5s-road">
        {ROADMAP.map((t, i) => {
          const done = t.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = t.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={t.topic} className="dl5s-road__item">
              <span className="dl5s-road__no" aria-hidden="true">{i + 1}</span>
              <span className="dl5s-road__topic">{t.topic}</span>
              <span className="dl5s-road__prog" aria-label={`${done} of ${total} notebook lines copied`}>
                <span className="dl5s-road__track"><span className="dl5s-road__fill" style={{ width: `${pct}%` }} /></span>
                <span className="dl5s-road__pct">{done}/{total}</span>
              </span>
              <span className="dl5s-road__secs">
                {t.secs.map((id) => <SecChip key={id} id={id} />)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="dl5s-cap">
        Slide 3 bundles “visualizing the reconstruction” with tying the weights; this page shows reconstructions first, in{' '}
        <button type="button" className="dl5s-link" onClick={() => jumpTo('s06')}>§6</button>, together with the t-SNE plot of slides 14–15,
        which slide 3 doesn’t list. <i>Diffusion models will not be covered in the unit</i> (slide 3).{' '}
        <button type="button" className="dl5s-link" onClick={() => jumpTo('s10')}>§10</button> is the summary and the reading for next time.
      </p>
    </Lab>
  );
}

/* ── §1 · what autoencoders are good for ─────────────────────────────────── */
const USES = [
  {
    key: 'dr',
    name: 'Dimensionality reduction',
    says: 'The codings typically have a much lower dimensionality than the input data.',
    here: 'A 3D point becomes 2 numbers (§2, §3); a 784-pixel image becomes 30 (§4–§6).',
    secs: ['s02', 's03', 's04', 's05', 's06'],
    ratio: { from: 784, to: 30 },
  },
  {
    key: 'fd',
    name: 'Feature detectors · unsupervised pre-training',
    says: 'Autoencoders act as feature detectors, and they can be used for unsupervised pre-training of deep neural networks.',
    here: 'Train a stacked autoencoder on all the data without labels, then reuse its lower (encoder) layers in the network for the real task (§7).',
    secs: ['s07'],
  },
  {
    key: 'gen',
    name: 'Generative models',
    says: 'Some autoencoders can randomly generate new data that looks very similar to the training data, e.g. new faces after training on faces.',
    caveat: 'However, the generated images are usually fuzzy and not entirely realistic.',
    here: 'Slide 4 only mentions this use. No later slide in this lecture builds a generative autoencoder.',
    secs: [],
  },
];

export function UsesLab() {
  const [on, setOn] = useState('dr');
  const u = USES.find((x) => x.key === on);
  return (
    <Lab
      title="Three things an autoencoder is good for"
      slides="slide 4"
      tryThis="predict which of the three uses this lecture spends the most slides on, then pick each one and count its section chips. Notice which one gets none."
    >
      <div className="dl5s-uses" role="tablist" aria-label="Uses of autoencoders">
        {USES.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={on === x.key}
            className={`dl5s-uses__tab${on === x.key ? ' dl5s-uses__tab--on' : ''}`}
            onClick={() => setOn(x.key)}
          >
            <span className="dl5s-uses__n">{i + 1}</span>
            <span className="dl5s-uses__name">{x.name}</span>
            <span className="dl5s-uses__count">{x.secs.length ? `${x.secs.length} section${x.secs.length === 1 ? '' : 's'}` : 'mentioned only'}</span>
          </button>
        ))}
      </div>
      <div className="dl5s-uses__body" role="tabpanel">
        <p className="dl5s-readout"><span className="dl5s-slidev" /><b>Slide 4:</b> {u.says}</p>
        {u.caveat && <p className="dl5s-readout"><span className="dl5s-slidev" /><b>Caveat:</b> {u.caveat}</p>}
        <p className="dl5s-readout"><b>On this page:</b> {u.here}</p>
        {u.ratio && (
          <p className="dl5s-total">
            {u.ratio.from} inputs → <b>{u.ratio.to}</b> codings: {Math.round((u.ratio.from / u.ratio.to) * 10) / 10}× fewer numbers per image <span className="dl5s-own">this page’s arithmetic</span>
          </p>
        )}
        {u.secs.length > 0 && <p className="dl5s-uses__secs">{u.secs.map((id) => <SecChip key={id} id={id} />)}</p>}
      </div>
      <ol className="dl5s-printonly dl5s-uses__all">
        {USES.map((x) => (
          <li key={x.key}><b>{x.name}.</b> {x.says} {x.caveat} {x.here}</li>
        ))}
      </ol>
    </Lab>
  );
}
