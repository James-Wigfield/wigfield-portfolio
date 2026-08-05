import { useState, useEffect, useRef } from 'react';
import LiveClock from './LiveClock';
import FaultyTerminal from './bits/FaultyTerminal';

/* The four hats, in one readout. The headline cycles through them while the dark
   "manifest" panel ignites the matching row in the signal colour — the same
   scan-viewport motif (dark inset, glowing signal) repurposed from voxels to
   identity. One orchestrated motion moment, driven by a single index.

   The hero is the book's dark COVER (the rest of the page stays light paper):
   a full-bleed FaultyTerminal shader — an amber phosphor terminal, tinted with
   the site's signal colour — runs behind everything. The hand-off into the
   light page is a CURTAIN REVEAL (see home.css): the backdrop is pinned to
   the viewport and windowed by the hero's clip-path, so the About "sheet"
   slides up OVER a stationary terminal. The scroll listener here dims the
   terminal toward an ember floor while it is being covered — never to black,
   so the reveal always has something alive to cover — then display:nones it
   once fully off screen (the shader's IntersectionObserver stops GL work).
   Reduced motion swaps the shader for a static scanline texture; every
   terminal prop is a module-scope constant because any prop change rebuilds
   the WebGL context (see bits/FaultyTerminal.jsx). */
const ROLES = [
  { title: 'Honours AI Researcher', meta: 'UWA' },
  { title: 'Automation Engineer', meta: 'GoFlo' },
  { title: 'IT Manager', meta: 'RKMRS' },
  { title: 'Software Developer', meta: 'SafeStyle' },
];

const CYCLE_MS = 2600;
const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

/* Terminal look — tuned for a background role: big dim cells, slow time, calm
   flicker, brand phosphor. gridMul MUST stay module-scope (prop stability). */
const TERMINAL_GRID = [2, 1];
const TERMINAL = {
  scale: 1.6,
  gridMul: TERMINAL_GRID,
  digitSize: 1.3,
  timeScale: 0.22,
  scanlineIntensity: 0.22,
  glitchAmount: 0.9,
  flickerAmount: 0.45,
  noiseAmp: 0.9,
  curvature: 0.08,
  tint: '#ff6a3d', // --signal: the ignited-lesion orange, as phosphor
  mouseReact: true,
  mouseStrength: 0.35,
  globalMouse: true, // content + scrim sit over the canvas — track via window

  pageLoadAnimation: true,
  brightness: 0.6,
};

export default function Hero() {
  const [active, setActive] = useState(0);
  const [reduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const backdropRef = useRef(null);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setActive((i) => (i + 1) % ROLES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  /* Power-down: dim the terminal toward an ember floor (0.3) as the About
     sheet covers it — never to black, so the curtain always reveals something
     alive — and stop painting entirely once it's fully off screen. Style
     writes on a ref — never React state, and never shader props (a prop
     change would rebuild the WebGL context). */
  useEffect(() => {
    if (reduced) return;
    const el = backdropRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = window.innerHeight;
        const y = window.scrollY;
        const p = Math.min(1, Math.max(0, y / (h * 0.9)));
        el.style.opacity = String(1 - p * 0.7);
        // Fully covered → remove from layout; the shader's own
        // IntersectionObserver then skips all GL work until scrolled back.
        el.style.display = y > h ? 'none' : '';
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <section id="top" className="hp-hero" aria-label="Introduction">
      <div
        ref={backdropRef}
        className={`hp-hero__backdrop${reduced ? ' hp-hero__backdrop--static' : ''}`}
        aria-hidden="true"
      >
        {!reduced && (
          <FaultyTerminal
            {...TERMINAL}
            dpr={Math.min(window.devicePixelRatio || 1, 1.5)}
          />
        )}
      </div>

      <div className="hp-wrap hp-hero__grid">
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
