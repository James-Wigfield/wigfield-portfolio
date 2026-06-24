import Reveal from './Reveal';

export default function Contact() {
  return (
    <section id="contact" className="hp-section hp-contact" aria-labelledby="contact-title">
      <div className="hp-wrap">
        <Reveal>
          <div className="hp-chead__bar" aria-hidden="true">
            <span className="hp-chead__n">06</span>
            <span className="hp-chead__line" />
          </div>
          <p className="hp-eyebrow">Contact</p>
          <h2 id="contact-title" className="hp-contact__title">
            Let's <em>talk</em>.
          </h2>
          <p className="hp-contact__lede">
            A grad role, an automation project, or a business drowning in manual processes —
            if it's an interesting problem, I'd like to hear about it.
          </p>
        </Reveal>

        <Reveal className="hp-contact__lines">
          <a className="hp-contact__line" href="mailto:jameswigfield1@gmail.com">
            <span className="hp-contact__k">Email</span>
            <span className="hp-contact__v">
              jameswigfield1@gmail.com
              <span className="hp-btn__arrow" aria-hidden="true">→</span>
            </span>
          </a>
          <a className="hp-contact__line" href="tel:+61455887910">
            <span className="hp-contact__k">Phone</span>
            <span className="hp-contact__v">
              0455 887 910
              <span className="hp-btn__arrow" aria-hidden="true">→</span>
            </span>
          </a>
          <div className="hp-contact__line">
            <span className="hp-contact__k">Location</span>
            <span className="hp-contact__v">Perth, Western Australia</span>
          </div>
        </Reveal>

        <Reveal className="hp-contact__cta">
          <a className="hp-btn hp-btn--solid" href="mailto:jameswigfield1@gmail.com">
            Send me an email <span className="hp-btn__arrow" aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
