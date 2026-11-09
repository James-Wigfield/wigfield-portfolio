import { Frame, Words } from '../engine/Words';
import { E, draw, fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';
import { FemurArt } from '../art/FemurArt';
import { Person } from '../art/Glyphs';

/* ============================================================================
   CHAPTER 1 — INTRODUCTION: title, why this matters, today
   ========================================================================== */

/* ── 1. Title ─────────────────────────────────────────────────────────────── */

const TITLE_CFG = {
  beats: [
    (t, q) => {
      rise(t, q('[data-a="kicker"]'), 0, { y: 16, d: 0.7 });
      wordsIn(t, q('[data-a="title"] .cs-wi'), 0.1, { stagger: 0.09, d: 1.1 });
      rise(t, q('[data-a="sub"]'), 0.75, { y: 20 });
      grow(t, q('[data-a="rule"]'), 0.95, { d: 1 });
      rise(t, q('[data-a="who"]'), 1.1, { y: 16, stagger: 0.1 });
      // the femur draws itself, fills, then grows its stress lines
      draw(t, q('[data-a="fem-edge"]'), 0.2, { d: 2.4, ease: 'power2.inOut' });
      fade(t, q('[data-a="fem-fill"]'), 1.5, { d: 1.2 });
      draw(t, q('[data-a="trab"]'), 1.7, { d: 1.3, stagger: 0.035, ease: 'power2.out' });
      draw(t, q('[data-a="ring"]'), 2.2, { d: 1.6, stagger: 0.2, ease: 'power3.inOut' });
      fade(t, q('[data-a="tick"]'), 2.6, { d: 0.04, stagger: 0.02 });
      t.fromTo(q('[data-a="load"]'), { autoAlpha: 0, y: -70 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'back.out(2.2)' }, 3.3);
      fade(t, q('[data-a="caption"]'), 3.4);
    },
  ],
  ambient: ({ q, delay }) => {
    gsap.to(q('[data-a="reticle"]'), { rotation: 360, svgOrigin: '170 195', duration: 90, ease: 'none', repeat: -1, delay });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: delay + 0.6 });
    tl.to(q('[data-a="load"]'), { y: 14, duration: 0.22, ease: 'power2.in' })
      .to(q('[data-a="load"]'), { y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    tl.fromTo(q('[data-a="pulse"]'), { autoAlpha: 1, drawSVG: '0% 0%' }, { drawSVG: '0% 22%', duration: 0.35, ease: 'none', stagger: 0.07 }, 0.15)
      .to(q('[data-a="pulse"]'), { drawSVG: '78% 100%', duration: 1.2, ease: 'power1.inOut', stagger: 0.07 }, 0.5)
      .to(q('[data-a="pulse"]'), { drawSVG: '100% 100%', duration: 0.4, ease: 'none', stagger: 0.07 }, 1.7)
      .set(q('[data-a="pulse"]'), { autoAlpha: 0 });
  },
};

export function TitleSlide({ ctx }) {
  const root = useSlide(ctx, TITLE_CFG);
  return (
    <div className="cs-stage s-title" ref={root}>
      <p className="s-title__kicker" data-a="kicker"><span className="cs-dot" />Geriatrics placement · GER360 group exercise</p>
      <h1 className="s-title__h" data-a="title">
        <Words text="Building" />
        <br />
        <Words text="Stronger" />
        <br />
        <Words text="*Bones*" />
      </h1>
      <p className="s-title__sub" data-a="sub">Optimising our GER360 group classes</p>
      <span className="s-title__rule" data-a="rule" />
      <p className="s-title__who" data-a="who">Courtney Steyn</p>
      <p className="s-title__role" data-a="who">Physiotherapy student</p>
      <FemurArt x={1150} y={150} />
      <p className="s-title__cap t-micro" data-a="caption">Proximal femur · trabecular stress lines</p>
    </div>
  );
}
TitleSlide.beats = TITLE_CFG.beats.length;

/* ── 2. Why this matters ──────────────────────────────────────────────────── */

const CASCADE = [
  { icon: 'fall', label: 'A fall' },
  { icon: 'fracture', label: 'Neck of femur fracture' },
  { icon: 'implant', label: 'Hemiarthroplasty or total hip replacement' },
  { icon: 'bed', label: 'Prolonged admission & rehabilitation' },
  { icon: 'frame', label: 'Deconditioning & lost independence' },
];
const CX = (i) => 250 + i * 355;
const CY = 430;

function CascadeIcon({ kind }) {
  switch (kind) {
    case 'fall':
      return (
        <g>
          <circle cx="20" cy="-30" r="10" />
          <path d="M 12 -18 L -12 10 M -12 10 L -32 30 M -12 10 L 6 34 M 4 -10 L 30 2 M 4 -10 L -14 -30" />
          <path d="M -44 44 H 44" className="ic-ground" />
          <path d="M 34 -40 q 8 6 6 16 M 40 -46 q 12 9 9 24" className="ic-motion" />
        </g>
      );
    case 'fracture':
      return (
        <g>
          <path d="M -36 0 H 36" className="ic-bone" />
          <circle cx="-40" cy="-8" r="9" className="ic-knob" />
          <circle cx="-40" cy="8" r="9" className="ic-knob" />
          <circle cx="40" cy="-8" r="9" className="ic-knob" />
          <circle cx="40" cy="8" r="9" className="ic-knob" />
          <path d="M -4 -18 L 5 -5 L -5 4 L 6 18" className="ic-crack" />
        </g>
      );
    case 'implant':
      return (
        <g>
          <circle cx="-16" cy="-26" r="14" />
          <path d="M -6 -16 L 12 -4 L 22 40 L 10 42 L 0 -2" />
        </g>
      );
    case 'bed':
      return (
        <g>
          <path d="M -44 34 V -20 M -44 12 H 44 V 34 M -44 -2 H 44" />
          <rect x="-38" y="-16" width="20" height="10" rx="4" />
          <path d="M -14 -6 Q 4 -22 30 -8" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M -26 40 V -18 Q -26 -30 -14 -30 H 14 Q 26 -30 26 -18 V 40 M -26 4 H 26" />
          <circle cx="-26" cy="40" r="4" />
          <circle cx="26" cy="40" r="4" />
        </g>
      );
  }
}

const WHY_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      rise(t, q('[data-a="ward"]'), 0.3, { y: 12 });
      t.fromTo(q('[data-a="track"]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 3.2, ease: 'power1.inOut' }, 0.5);
      t.fromTo(q('[data-a="runner"]'), { autoAlpha: 0, x: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.5);
      t.fromTo(q('[data-a="runner"]'), { x: 0 }, { x: CX(CASCADE.length - 1) - CX(0), duration: 3.2, ease: 'power1.inOut', immediateRender: false }, 0.5);
      t.to(q('[data-a="runner"]'), { autoAlpha: 0, duration: 0.3 }, 3.7);
      const labels = q('[data-a="nlabel"]');
      q('[data-a="node"]').forEach((n, i) => {
        const at = 0.5 + (i / (CASCADE.length - 1)) * 3.0;
        pop(t, n.querySelector('[data-a="disc"]'), at, { s: 0.2, d: 0.6 });
        draw(t, n.querySelectorAll('[data-a="ic"] path, [data-a="ic"] circle, [data-a="ic"] rect'), at + 0.1, { d: 0.7, stagger: 0.04 });
        rise(t, labels[i], at + 0.15, { y: 16 });
      });
    },
    (t, q) => {
      grow(t, q('[data-a="statrule"]'), 0, { d: 0.9 });
      t.fromTo(q('[data-a="big"]'), { autoAlpha: 0, scale: 1.4, transformOrigin: '0% 60%' }, { autoAlpha: 1, scale: 1, duration: 1, ease: E.out }, 0.1);
      rise(t, q('[data-a="statl"]'), 0.4, { y: 18, stagger: 0.12 });
      pop(t, q('[data-a="person"]'), 0.3, { s: 0.6, stagger: 0.12 });
      t.to(q('[data-a="lost"] [data-a="pfill"]'), { autoAlpha: 0, duration: 1, ease: 'power2.inOut' }, 1.3);
      fade(t, q('[data-a="lost"] [data-a="pline"]'), 1.3, { d: 1 });
      fade(t, q('[data-a="persontag"]'), 1.8);
    },
    (t, q) => {
      t.to(q('[data-a="dimmable"]'), { autoAlpha: 0.13, duration: 0.8, ease: 'power2.inOut' }, 0);
      t.fromTo(q('[data-a="qwash"]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.1);
      wordsIn(t, q('[data-a="q"] .cs-wi'), 0.3, { stagger: 0.05 });
      grow(t, q('[data-a="qrule"]'), 0.9, { origin: '50% 50%' });
    },
  ],
};

export function WhySlide({ ctx, meta }) {
  const root = useSlide(ctx, WHY_CFG);
  const trackD = `M ${CX(0)} ${CY} H ${CX(CASCADE.length - 1)}`;
  return (
    <div className="cs-stage s-why" ref={root}>
      <Frame meta={meta} title="Why does this matter?" foot="Harvey et al. (2022), Medical Journal of Australia: people aged 50+ hospitalised with a hip fracture in NSW, 2011–2018." />
      <div className="s-why__cascade" data-a="dimmable">
        <p className="t-micro s-why__ward" data-a="ward">What I saw on the geriatrics ward</p>
        <svg className="s-why__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <path d={trackD} className="s-why__track" data-a="track" />
          <circle r="11" className="s-why__runner" data-a="runner" cx={CX(0)} cy={CY} />
          {CASCADE.map((c, i) => (
            <g key={c.icon} data-a="node" transform={`translate(${CX(i)} ${CY})`}>
              <circle r="74" className={`s-why__disc${i === CASCADE.length - 1 ? ' is-risk' : ''}`} data-a="disc" />
              <g data-a="ic" className={`s-why__ic${i === CASCADE.length - 1 ? ' is-risk' : ''}`}><CascadeIcon kind={c.icon} /></g>
            </g>
          ))}
        </svg>
        {CASCADE.map((c, i) => (
          <p key={c.icon} className="t-label s-why__label" style={{ left: CX(i) - 150, top: CY + 104 }} data-a="node-label">
            <span data-a="nlabel" style={{ display: 'block' }}>{c.label}</span>
          </p>
        ))}
      </div>
      <div className="s-why__stat" data-a="dimmable">
        <span className="s-why__statrule" data-a="statrule" />
        <p className="t-micro s-why__more" data-a="statl">More than</p>
        <p className="s-why__big" data-a="big">1 <span>in</span> 4</p>
        <p className="t-lead s-why__statl" data-a="statl">people aged 50+ hospitalised with a hip fracture died within 12 months</p>
        <p className="t-small s-why__statsrc" data-a="statl">26.7% of 36,088 · NSW, 2011–2018</p>
        <svg className="s-why__people" width="560" height="260" viewBox="0 0 560 260">
          {[0, 1, 2, 3].map((k) => (
            <g key={k} transform={`translate(${70 + k * 140} 150)`}>
              <g data-a="person" data-lost={k === 3 ? 'y' : undefined}>
                <g data-a={k === 3 ? 'lost' : undefined}>
                  <Person fill={k === 3} />
                </g>
              </g>
            </g>
          ))}
        </svg>
        <p className="t-micro s-why__ptag" data-a="persontag">within 12 months</p>
      </div>
      <div className="s-why__qwash" data-a="qwash" />
      <p className="s-why__q" data-a="q">
        <Words text="Could GER360 do more for *bone* *health,* *strength* and *falls* *prevention?*" />
      </p>
      <span className="s-why__qrule" data-a="qrule" />
    </div>
  );
}
WhySlide.beats = WHY_CFG.beats.length;

/* ── 3. Today ─────────────────────────────────────────────────────────────── */

const AGENDA = [
  ['How our bodies, and our *bones,* change with age', 'Ageing & bone'],
  ['What Australian *guidelines* recommend', 'Guidelines'],
  ['How our *GER360* class compares', 'GER360'],
  ['Targeted exercises we could *add*', 'Evidence & ideas'],
];

const TODAY_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      grow(t, q('[data-a="arule"]'), 0.25, { stagger: 0.12, d: 1 });
      q('[data-a="row"]').forEach((r, i) => {
        const at = 0.45 + i * 0.16;
        t.fromTo(r.querySelector('[data-a="num"]'), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: E.out }, at);
        wordsIn(t, r.querySelectorAll('.cs-wi'), at + 0.05, { stagger: 0.03 });
        fade(t, r.querySelector('[data-a="tag"]'), at + 0.4);
      });
      t.fromTo(q('[data-a="play"]'), { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.5);
      t.to(q('[data-a="play"]'), { y: 3 * 150, duration: 1.6, ease: 'power2.inOut' }, 0.8);
      t.to(q('[data-a="play"]'), { y: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6);
    },
  ],
};

export function TodaySlide({ ctx, meta }) {
  const root = useSlide(ctx, TODAY_CFG);
  return (
    <div className="cs-stage s-today" ref={root}>
      <Frame meta={meta} title="Today" />
      <span className="s-today__play" data-a="play" />
      {AGENDA.map(([txt, tag], i) => (
        <div className="s-today__row" key={tag} style={{ top: 300 + i * 150 }} data-a="row">
          <span className="s-today__rule" data-a="arule" />
          <span className="s-today__num" data-a="num">0{i + 1}</span>
          <p className="s-today__txt"><Words text={txt} /></p>
          <span className="t-micro s-today__tag" data-a="tag">{tag}</span>
        </div>
      ))}
      <span className="s-today__rule s-today__rule--end" data-a="arule" style={{ top: 300 + 4 * 150 }} />
    </div>
  );
}
TodaySlide.beats = TODAY_CFG.beats.length;
