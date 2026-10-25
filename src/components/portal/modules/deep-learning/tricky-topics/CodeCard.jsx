import { useState } from 'react';
import { Code } from '../kit';
import { useStudy } from './context';
import { Rich } from './Rich';
import { Diagram } from './Diagram';

/* ============================================================================
   TRICKY TOPICS — AN "EXPLAIN THIS CODE" CARD
   ----------------------------------------------------------------------------
   Quiet exam practice after a step's lab: a kicker and its provenance, the
   lines in the VS Code block, one prompt, and a model answer behind a click
   (always open in print). Content is data, in the topic's topic.js:
     { id, title, prov, code, label?, prompt, answer: [lines], fig? }
   `prov` is Rich markup ({s|L3 · slide 35}, or "generated" for drill code).
   ========================================================================== */

export default function CodeCard({ card }) {
  const { printing } = useStudy();
  const [open, setOpen] = useState(false);
  if (!card) return null;
  const shown = open || printing;
  const ansId = `dltt-card-${card.id}`;
  return (
    <section className="dltt-card" aria-label={`Explain this code: ${card.title}`}>
      <header className="dltt-card__head">
        <span className="dltt-card__k">Explain this code</span>
        <span className="dltt-card__title">{card.title}</span>
        {card.prov && <span className="dltt-card__slide"><Rich text={card.prov} /></span>}
      </header>
      <Code code={card.code} label={card.label ?? 'python'} />
      <p className="dltt-card__q"><span className="dltt-card__qk">Q</span><span><Rich text={card.prompt} /></span></p>
      <button type="button" className="dltt-card__reveal" aria-expanded={shown} aria-controls={ansId} onClick={() => setOpen((o) => !o)}>
        {shown ? 'Hide the model answer' : 'Show a model answer'} <span aria-hidden="true">{shown ? '▴' : '▾'}</span>
      </button>
      {!shown && <p className="dltt-card__hint">Answer it on paper first: write the working, then check.</p>}
      {shown && (
        <div className="dltt-card__answer" id={ansId}>
          {card.fig && <figure className="dltt-card__fig"><Diagram fig={card.fig} /></figure>}
          <ul className="dltt-card__list">
            {card.answer.map((a) => <li key={a}><Rich text={a} /></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
