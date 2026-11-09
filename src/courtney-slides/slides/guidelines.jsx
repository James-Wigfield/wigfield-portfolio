import { Frame, Words } from '../engine/Words';
import { E, count, draw, fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';

/* ============================================================================
   CHAPTER 3 — GUIDELINES: adults 65+ (health.gov.au, March 2026) and the
   osteoporosis guidance (RACGP & Healthy Bones Australia 2024; HBA exercise
   prescription, Feb 2024). Wording follows the sources; see notes.js.
   ========================================================================== */

const f1 = (v) => v.toFixed(1);

/* ── 8. Adults 65+ ────────────────────────────────────────────────────────── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GX = (d) => 860 + d * 136;
const ROWS = [
  { key: 'mvpa', name: 'Moderate to vigorous activity', rule: '30 minutes or more, on most days', days: [0, 1, 2, 3, 4], open: [5, 6], cls: 'ink' },
  { key: 'str', name: 'Muscle strengthening', rule: '2 or more days a week', days: [1, 4], cls: 'bone' },
  { key: 'bal', name: 'Mobility, balance & coordination', rule: '3 or more days a week', days: [0, 2, 5], cls: 'move' },
  { key: 'light', name: 'Light activity', rule: 'Several hours, daily', band: true, cls: 'muted' },
];
const RY = (i) => 356 + i * 138;

const G65_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      rise(t, q('[data-a="day"]'), 0.3, { y: 10, stagger: 0.04 });
      q('[data-a="row"]').forEach((r, i) => {
        const at = 0.5 + i * 0.45;
        grow(t, r.querySelector('[data-a="rrule"]'), at, { d: 0.9 });
        rise(t, r.querySelectorAll('[data-a="rtxt"]'), at + 0.1, { y: 14, stagger: 0.08 });
        pop(t, r.querySelectorAll('[data-a="cell"]'), at + 0.3, { s: 0.2, stagger: 0.07, d: 0.5 });
        fade(t, r.querySelectorAll('[data-a="open"]'), at + 0.5, { stagger: 0.07 });
        grow(t, r.querySelectorAll('[data-a="band"]'), at + 0.3, { d: 1.6 });
      });
      fade(t, q('[data-a="also"]'), 2.6);
    },
    (t, q) => {
      t.to(q('[data-dim]'), { opacity: 0.28, duration: 0.6, ease: 'power2.inOut' }, 0);
      grow(t, q('[data-a="nrule"]'), 0.2, { d: 0.9 });
      wordsIn(t, q('[data-a="next"] .cs-wi'), 0.35, { stagger: 0.03 });
      t.fromTo(q('[data-a="arrow"]'), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: E.out }, 1.1);
    },
  ],
  ambient: ({ q, beat, delay }) => {
    if (beat < 1) return;
    gsap.to(q('[data-a="arrow"]'), { x: 14, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay });
  },
};

export function Guide65Slide({ ctx, meta }) {
  const root = useSlide(ctx, G65_CFG);
  return (
    <div className="cs-stage s-g65" ref={root}>
      <Frame meta={meta} title="Australian guidelines: adults 65 and over" foot="Australian Government Department of Health, Disability and Ageing (2026). Recommendations for older adults (65 years and over)." />
      <p className="t-micro s-g65__ex" data-a="day">Example week</p>
      {DAYS.map((d, i) => (
        <p key={d} className="t-micro s-g65__day" style={{ left: GX(i) - 50 }} data-a="day">{d}</p>
      ))}
      {ROWS.map((r, i) => (
        <div key={r.key} className="s-g65__row" style={{ top: RY(i) - 60 }} data-a="row" data-dim={r.key === 'mvpa' || r.key === 'light' ? '' : undefined}>
          <span className="s-g65__rrule" data-a="rrule" />
          <p className="s-g65__name" data-a="rtxt">{r.name}</p>
          <p className={`s-g65__rule c-${r.cls === 'ink' || r.cls === 'muted' ? 'muted' : r.cls}`} data-a="rtxt">{r.rule}</p>
          <svg className="s-g65__cells" width="1920" height="120" viewBox="0 0 1920 120">
            {r.band && <rect x={GX(0) - 40} y="50" width={GX(6) - GX(0) + 80} height="20" rx="10" className="s-g65__band" data-a="band" />}
            {(r.days ?? []).map((d) => (
              <g key={d} transform={`translate(${GX(d)} 60)`}>
                <circle r="36" className={`s-g65__cell s-g65__cell--${r.cls}`} data-a="cell" />
              </g>
            ))}
            {(r.open ?? []).map((d) => (
              <circle key={d} cx={GX(d)} cy="60" r="34" className="s-g65__open" data-a="open" />
            ))}
          </svg>
        </div>
      ))}
      <p className="t-small s-g65__also" data-a="also">Also recommended: limit sitting, break up long periods of sitting, and get 7–8 hours of good-quality sleep.</p>
      <span className="s-g65__nrule" data-a="nrule" />
      <p className="s-g65__next" data-a="next">
        <Words text="A general framework. For *poor* *bone* *health,* the guidance gets more specific" />
      </p>
      <svg className="s-g65__arrow" width="90" height="40" viewBox="0 0 90 40" data-a="arrow">
        <path d="M 4 20 H 80 M 62 6 L 80 20 L 62 34" />
      </svg>
    </div>
  );
}
Guide65Slide.beats = G65_CFG.beats.length;

/* ── 9. Osteoporosis prescription ─────────────────────────────────────────── */

const COLS = [
  { k: '01', name: 'Resistance training', line: 'At least twice a week, moderate to vigorous, and progressive', cls: 'bone' },
  { k: '02', name: 'Weight-bearing impact', line: 'Most days: at least 50 moderate impacts, in varied directions', cls: 'bone' },
  { k: '03', name: 'Challenging balance', line: 'Balance training should be genuinely challenging', cls: 'move' },
];
const CL = (i) => 112 + i * 584;
const GAUGE = { cx: 138, cy: 200, r: 112 };
const gpt = (v, r = GAUGE.r) => {
  const a = Math.PI + v * Math.PI;
  return [GAUGE.cx + r * Math.cos(a), GAUGE.cy + r * Math.sin(a)];
};
const garc = (v0, v1, r = GAUGE.r) => {
  const [x0, y0] = gpt(v0, r);
  const [x1, y1] = gpt(v1, r);
  return `M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}`;
};
const RING = { cx: 122, cy: 128, r: 92 };
const rarc = (a0, a1) => {
  const p = (a) => [RING.cx + RING.r * Math.cos((a - 90) * (Math.PI / 180)), RING.cy + RING.r * Math.sin((a - 90) * (Math.PI / 180))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${f1(x0)} ${f1(y0)} A ${RING.r} ${RING.r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
};
const FOOT = 'M -60 0 C -64 -18 -54 -34 -40 -38 L -26 -40 L -24 -120 L 10 -120 L 12 -46 C 30 -40 56 -30 66 -16 C 72 -6 68 0 60 0 Z';

const OS_CFG = {
  state: () => ({ v: 0 }),
  render: (S, el) => {
    const n = el.querySelector('[data-p="needle"]');
    if (!n) return;
    const [x, y] = gpt(S.v, GAUGE.r - 22);
    n.setAttribute('x2', f1(x));
    n.setAttribute('y2', f1(y));
  },
  beats: [
    (t, q) => {
      frameIn(t, q);
      q('[data-a="col"]').forEach((c, i) => {
        const at = 0.35 + i * 0.25;
        grow(t, c.querySelector('[data-a="crule"]'), at, { d: 0.9 });
        rise(t, c.querySelectorAll('[data-a="chead"]'), at + 0.1, { y: 16, stagger: 0.08 });
      });
      fade(t, q('[data-a="src1"]'), 1.2);
    },
    (t, q, S) => {
      const c = q('[data-c="0"]')[0];
      const s = (x) => c.querySelectorAll(x);
      draw(t, s('[data-a="garc"]'), 0, { d: 0.9 });
      fade(t, s('[data-a="gtick"]'), 0.3, { stagger: 0.04 });
      draw(t, s('[data-a="gband"]'), 0.6, { d: 0.6 });
      t.fromTo(S, { v: 0 }, { v: 0.8, duration: 1.6, ease: 'elastic.out(1, 0.55)' }, 0.8);
      fade(t, s('[data-a="needle"]'), 0.8, { d: 0.2 });
      pop(t, s('[data-a="rep"]'), 1.0, { s: 0.2, stagger: 0.025, d: 0.35 });
      fade(t, s('[data-a="bracket"]'), 1.8);
      rise(t, s('[data-a="det"]'), 1.2, { y: 14, stagger: 0.1 });
    },
    (t, q) => {
      const c = q('[data-c="1"]')[0];
      const s = (x) => c.querySelectorAll(x);
      draw(t, s('[data-a="ground"]'), 0, { d: 0.6 });
      fade(t, s('[data-a="foot"]'), 0.1, { d: 0.3 });
      const foot = s('[data-a="footmove"]');
      const ripples = [...s('[data-a="ripple"]')];
      for (let k = 0; k < 5; k++) {
        const at = 0.3 + k * 0.42;
        t.fromTo(foot, { y: -70 }, { y: 0, duration: 0.18, ease: 'power3.in', immediateRender: k === 0 }, at);
        t.fromTo(ripples, { attr: { rx: 20, ry: 5 }, opacity: 0.9 }, { attr: { rx: 120, ry: 22 }, opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06, immediateRender: false }, at + 0.18);
        if (k < 4) t.to(foot, { y: -70, duration: 0.22, ease: 'power2.out' }, at + 0.2);
      }
      t.set(ripples, { opacity: 0 }, 2.4);
      count(t, c.querySelector('[data-a="num"]'), 50, 0.3, { d: 1.9 });
      fade(t, s('[data-a="numl"]'), 0.4);
      fade(t, s('[data-a="bw"]'), 1.4);
      rise(t, s('[data-a="det"]'), 1.0, { y: 14, stagger: 0.1 });
    },
    (t, q) => {
      const c = q('[data-c="2"]')[0];
      const s = (x) => c.querySelectorAll(x);
      fade(t, s('[data-a="rtrack"]'), 0, { d: 0.4 });
      draw(t, s('[data-a="rseg"]'), 0.2, { d: 0.7, stagger: 0.55, ease: 'power2.inOut' });
      count(t, c.querySelector('[data-a="hrs"]'), 3, 0.2, { d: 2.1 });
      fade(t, s('[data-a="hrsl"]'), 0.4);
      pop(t, s('[data-a="sess"]'), 0.6, { stagger: 0.55 });
      rise(t, s('[data-a="det"]'), 1.0, { y: 14, stagger: 0.1 });
    },
    (t, q) => {
      grow(t, q('[data-a="cavrule"]'), 0, { d: 1 });
      rise(t, q('[data-a="cav"]'), 0.2, { y: 14, stagger: 0.15 });
    },
  ],
};

export function OsteoSlide({ ctx, meta }) {
  const root = useSlide(ctx, OS_CFG);
  return (
    <div className="cs-stage s-os" ref={root}>
      <Frame meta={meta} title="For low bone density: three kinds of exercise" foot="Wong et al. (2025), RACGP & Healthy Bones Australia osteoporosis guideline, rec. 17–18 · Healthy Bones Australia (2024), Exercise prescription for osteoporosis." />
      <p className="t-micro s-os__src" data-a="src1"><span className="dot dot--ink" />RACGP & Healthy Bones Australia guideline</p>
      {COLS.map((c, i) => (
        <div key={c.k} className="s-os__col" style={{ left: CL(i) }} data-a="col" data-c={i}>
          <span className="s-os__crule" data-a="crule" />
          <p className={`s-os__k c-${c.cls}`} data-a="chead">{c.k}</p>
          <p className="s-os__name" data-a="chead">{c.name}</p>
          <p className="s-os__line" data-a="chead">{c.line}</p>
          <p className="t-micro s-os__hba" data-a="det">Healthy Bones Australia prescription</p>

          {i === 0 && (
            <>
              <svg className="s-os__viz" width="528" height="260" viewBox="0 0 528 260">
                <path d={garc(0, 1)} className="s-os__garc" data-a="garc" />
                <path d={garc(0.75, 0.85, GAUGE.r)} className="s-os__gband" data-a="gband" />
                {[0, 0.25, 0.5, 0.75, 1].map((v) => {
                  const [x0, y0] = gpt(v, GAUGE.r + 10);
                  const [x1, y1] = gpt(v, GAUGE.r + 24);
                  const [lx, ly] = gpt(v, GAUGE.r + 46);
                  return (
                    <g key={v} data-a="gtick">
                      <path d={`M ${f1(x0)} ${f1(y0)} L ${f1(x1)} ${f1(y1)}`} className="s-os__gt" />
                      <text x={f1(lx)} y={f1(ly + 6)} textAnchor="middle" className="s-os__gtl">{Math.round(v * 100)}</text>
                    </g>
                  );
                })}
                <line x1={GAUGE.cx} y1={GAUGE.cy} x2={GAUGE.cx} y2={GAUGE.cy} className="s-os__needle" data-p="needle" data-a="needle" />
                <circle cx={GAUGE.cx} cy={GAUGE.cy} r="10" className="s-os__hub" data-a="needle" />
                <text x={GAUGE.cx} y={GAUGE.cy + 44} textAnchor="middle" className="s-os__gl">% of 1RM</text>
                {[0, 1, 2].map((set) => (
                  <g key={set} transform={`translate(330 ${74 + set * 40})`}>
                    {Array.from({ length: 8 }, (_, r) => (
                      <rect key={r} x={r * 22} y="0" width="16" height="30" rx="3" className={`s-os__rep${r < 5 ? ' is-on' : ' is-range'}${set === 2 ? ' is-opt' : ''}`} data-a="rep" />
                    ))}
                  </g>
                ))}
                <g data-a="bracket">
                  <path d="M 330 62 V 52 H 500 V 62" className="s-os__br" />
                  <text x="415" y="42" textAnchor="middle" className="s-os__brl">5–8 reps</text>
                  <text x="418" y="218" textAnchor="middle" className="s-os__brl">× 2–3 sets</text>
                </g>
              </svg>
              <p className="s-os__det" data-a="det"><b>2–3 days a week</b>, 2–3 sets of 5–8 reps at 75–85% of one-repetition maximum</p>
              <p className="s-os__det s-os__det--warn" data-a="det">Supervise anything above 75% 1RM</p>
            </>
          )}

          {i === 1 && (
            <>
              <svg className="s-os__viz" width="528" height="260" viewBox="0 0 528 260">
                <path d="M 20 206 H 300" className="s-os__ground" data-a="ground" />
                {[0, 1, 2].map((k) => <ellipse key={k} cx="150" cy="206" rx="20" ry="5" className="s-os__ripple" data-a="ripple" />)}
                <g data-a="foot">
                  <g transform="translate(150 206)">
                    <g data-a="footmove"><path d={FOOT} className="s-os__foot" /></g>
                  </g>
                </g>
                <text x="150" y="246" textAnchor="middle" className="s-os__bw" data-a="bw">2–4 × body weight</text>
              </svg>
              <p className="s-os__num" data-a="num">50</p>
              <p className="t-micro s-os__numl" data-a="numl">impacts<br />per session</p>
              <p className="s-os__det" data-a="det"><b>At least 3 days a week</b>, around 50 impacts per session</p>
              <p className="s-os__det s-os__det--warn" data-a="det">Introduce gradually; adjust for bone fragility</p>
            </>
          )}

          {i === 2 && (
            <>
              <svg className="s-os__viz" width="528" height="260" viewBox="0 0 528 260">
                <circle cx={RING.cx} cy={RING.cy} r={RING.r} className="s-os__rtrack" data-a="rtrack" />
                {[0, 1, 2].map((k) => <path key={k} d={rarc(k * 120 + 5, k * 120 + 115)} className="s-os__rseg" data-a="rseg" />)}
                {[0, 1, 2].map((k) => (
                  <g key={k} transform={`translate(${290 + k * 64} 140)`} data-a="sess">
                    <circle r="22" className="s-os__sess" />
                    <text y="7" textAnchor="middle" className="s-os__sessl">{k + 1}</text>
                  </g>
                ))}
                <text x="268" y="96" className="s-os__brl">at least 3 sessions</text>
              </svg>
              <p className="s-os__hrs" data-a="hrs">3</p>
              <p className="t-micro s-os__hrsl" data-a="hrsl">hours a week</p>
              <p className="s-os__det" data-a="det"><b>At least 3 hours a week</b> of exercise that includes progressive, challenging balance</p>
              <p className="s-os__det s-os__det--note" data-a="det">Resistance and impact work can count</p>
            </>
          )}
        </div>
      ))}
      <span className="s-os__cavrule" data-a="cavrule" />
      <p className="s-os__cav" data-a="cav"><b>Benchmarks, not starting targets.</b> If someone is very frail or at high risk of vertebral fracture, the programme should be supervised, modified and tailored.</p>
      <p className="s-os__cav s-os__cav--2" data-a="cav">One GER360 session can't meet these on its own; it should <b>complement</b> each person's wider programme.</p>
    </div>
  );
}
OsteoSlide.beats = OS_CFG.beats.length;
