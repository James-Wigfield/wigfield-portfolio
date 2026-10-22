import { receipt, fmtAnswer } from './why';
import { Why } from './WhyText';

/* ============================================================================
   GRADIENT ARCADE — THE "WHY" CARD (one per mistake, on the results screen)
   ----------------------------------------------------------------------------
   The learning moment: the prompt, what was given, the correct answer, one
   or two sentences in the slides' notation, and the receipt
   (Lecture 4 · slide 43). `item.why` may hold $…$ inline maths.
   `item.beyond` marks a claim the slides don't state. Styles: kit.css.
   ========================================================================== */

export function WhyCard({ item, given, n }) {
  return (
    <article className="dla-why">
      <header className="dla-why__head">
        {n !== undefined && <span className="dla-why__n">{n}</span>}
        <span className="dla-why__prompt">{item.promptText ?? (typeof item.prompt === 'string' ? item.prompt : item.title ?? '')}</span>
      </header>
      <div className="dla-why__row">
        <span className="dla-why__k">you</span>
        <span className="dla-why__v dla-why__v--given">{fmtAnswer(item, given)}</span>
        <span className="dla-why__k">answer</span>
        <span className="dla-why__v dla-why__v--ans">{fmtAnswer(item, item.answer)}{item.unit ? ` ${item.unit}` : ''}</span>
      </div>
      <p className="dla-why__text"><Why text={item.why} /></p>
      <p className="dla-why__receipt">
        <span className="dla-why__dot" aria-hidden="true" />
        {receipt(item.src)}
        {item.beyond && <span className="dla-why__beyond"> · beyond the slides</span>}
      </p>
    </article>
  );
}
