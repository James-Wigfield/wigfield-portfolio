import { useState } from 'react';
import { Code } from '../kit';
import { useStudy } from './context';
import { Rich } from './Rich';
import { Diagram } from './diagrams';
import { CARDS } from './cards';
import { cardLines } from './cardLines';
import { CODE_SLIDE } from './slideData';

/* ============================================================================
   LECTURE 9 STUDY — AN "EXPLAIN THIS CODE" CARD
   ----------------------------------------------------------------------------
   Quiet exam practice after a section's labs: a kicker and the slide, a few
   verbatim lines in the VS Code block, one prompt, and a model answer behind
   a click (always open in print). Content: ./cards.js.
   ========================================================================== */

export default function CodeCard({ id }) {
  const card = CARDS[id];
  const { printing } = useStudy();
  const [open, setOpen] = useState(false);
  if (!card) return null;
  const shown = open || printing;
  const ansId = `dl9s-card-${id}`;
  return (
    <section className="dl9s-card" aria-label={`Explain this code: ${card.title}`}>
      <header className="dl9s-card__head">
        <span className="dl9s-card__k">Explain this code</span>
        <span className="dl9s-card__title">{card.title}</span>
        <span className="dl9s-card__slide">{/[–,]/.test(card.slide) ? 'slides' : 'slide'} {card.slide}</span>
      </header>
      {card.snippets.map((sn) => (
        <Code key={`${sn.src}${sn.lines[0]}`} code={cardLines(sn)} label={`slide ${CODE_SLIDE[sn.src]}`} />
      ))}
      <p className="dl9s-card__q"><span className="dl9s-card__qk">Q</span><span><Rich text={card.prompt} /></span></p>
      <button type="button" className="dl9s-card__reveal" aria-expanded={shown} aria-controls={ansId} onClick={() => setOpen((o) => !o)}>
        {shown ? 'Hide the model answer' : 'Show a model answer'} <span aria-hidden="true">{shown ? '▴' : '▾'}</span>
      </button>
      {!shown && <p className="dl9s-card__hint">Answer it on paper first: a few sentences, or a quick diagram.</p>}
      {shown && (
        <div className="dl9s-card__answer" id={ansId}>
          {card.fig && <figure className="dl9s-card__fig"><Diagram fig={card.fig} /></figure>}
          <ul className="dl9s-card__list">
            {card.answer.map((a) => <li key={a}><Rich text={a} /></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
