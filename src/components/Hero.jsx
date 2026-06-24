import { useState, useEffect } from 'react';
import LiveClock from './LiveClock';

/* The four hats, in one readout. The headline cycles through them while the dark
   "manifest" panel ignites the matching row in the signal colour — the same
   scan-viewport motif (dark inset, glowing signal) repurposed from voxels to
   identity. One orchestrated motion moment, driven by a single index. */
const ROLES = [
  { title: 'Honours AI Researcher', meta: 'UWA' },
  { title: 'Automation Engineer', meta: 'GoFlo' },
  { title: 'IT Manager', meta: 'RKMRS' },
  { title: 'Software Developer', meta: 'SafeStyle' },
];

const CYCLE_MS = 2600;
const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % ROLES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="top" className="hp-hero hp-wrap" aria-label="Introduction">
      <div className="hp-hero__grid">
        <div className="hp-hero__intro">
          <p className="hp-eyebrow hp-hero__eyebrow">Researcher · AI Engineer · Developer</p>

          <h1 className="hp-hero__title">
            <span className="hp-hero__name">James Wigfield</span>
            <span className="hp-hero__role-line" aria-hidden="true">
              <span className="hp-hero__role-rotator">
                <span key={active} className="hp-hero__role-word">
                  {ROLES[active].title}
                </span>
              </span>
            </span>
            <span className="hp-sr-only">
              James Wigfield — an honours AI researcher, automation engineer, IT manager,
              and software developer.
            </span>
          </h1>

          <p className="hp-hero__lede">
            A final-year AI honours student at UWA with a foot in <em>research</em> and a foot
            in <em>industry</em> — from medical-imaging models to automation and software for
            real businesses.
          </p>

          <div className="hp-hero__cta">
            <button className="hp-btn hp-btn--solid" onClick={go('work')}>
              See the work <span className="hp-btn__arrow" aria-hidden="true">→</span>
            </button>
            <button className="hp-btn hp-btn--ghost" onClick={go('contact')}>
              Get in touch
            </button>
          </div>

          <div className="hp-hero__meta">
            <LiveClock />
            <span>B.Adv CS (Hons) · UWA</span>
          </div>
        </div>

        <div className="hp-hero__fig">
          <div className="hp-manifest" style={{ '--active': active }} aria-hidden="true">
            <div className="hp-viewport__corners">
              <span /><span /><span /><span />
            </div>
            <p className="hp-manifest__head">roles.manifest</p>

            <ul className="hp-manifest__list">
              <span className="hp-manifest__scan" />
              {ROLES.map((r, i) => (
                <li key={r.title} className={`hp-manifest__row${i === active ? ' is-lit' : ''}`}>
                  <span className="hp-manifest__idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hp-manifest__title">{r.title}</span>
                  <span className="hp-manifest__meta">{r.meta}</span>
                </li>
              ))}
            </ul>

            <p className="hp-manifest__foot">
              <span>04 / 04 active</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
