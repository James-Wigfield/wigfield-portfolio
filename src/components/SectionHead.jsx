import Reveal from './Reveal';

/* Standardised chapter heading: a numbered "scanline" bar that draws across on
   reveal, an eyebrow, the section title, and an optional intro line. Gives every
   section the same narrative framing (01 / 02 / 03 …) so the page reads as a
   deliberate document rather than a stack of blocks. */
export default function SectionHead({ n, eyebrow, title, intro, id }) {
  return (
    <Reveal className="hp-section__head hp-chead">
      <div className="hp-chead__bar" aria-hidden="true">
        <span className="hp-chead__n">{n}</span>
        <span className="hp-chead__line" />
      </div>
      <p className="hp-eyebrow hp-eyebrow--bare">{eyebrow}</p>
      <h2 id={id} className="hp-h2">{title}</h2>
      {intro && <p className="hp-section__intro">{intro}</p>}
    </Reveal>
  );
}
