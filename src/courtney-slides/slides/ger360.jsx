import { Frame, Words } from '../engine/Words';
import { E, count, draw, fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';
import { POSES, Rig, STS, blendPose, sitOn } from '../art/rig';
import { Mark } from '../art/Glyphs';

/* ============================================================================
   CHAPTER 4 — GER360: what an effective class targets (strength, balance,
   progression), the class as it runs today, and how it compares.
   ========================================================================== */

const f1 = (v) => v.toFixed(1);

function Chair({ x0, x1, seatY, g, data = 'chair' }) {
  return (
    <g className="g-chair" data-a={data}>
      <path d={`M ${x0} ${seatY} H ${x1}`} className="g-chair__seat" />
      <path d={`M ${x0 + 6} ${seatY} V ${seatY - 230} M ${x0 + 10} ${seatY} L ${x0 + 14} ${g} M ${x1 - 10} ${seatY} L ${x1 - 14} ${g}`} />
    </g>
  );
}

/* ── 10. Strength targets ─────────────────────────────────────────────────── */

const T_BASE = { ...POSES.stand, x: 660, g: 968 };
const T_SEAT = T_BASE.g - 166;
const T_SIT = sitOn({ ...POSES.sit, x: T_BASE.x, g: T_BASE.g }, T_SEAT);
const T_KEYS = [{ s: T_SIT.s, t: T_SIT.t, k: T_SIT.k, u: T_SIT.u, f: T_SIT.f }, ...STS.slice(1)];
const MUSCLES = [
  { name: 'Quadriceps & glutes', what: 'sit-to-stands, transfers, stairs', bands: ['quads', 'glutes'] },
  { name: 'Hip abductors', what: 'pelvic stability when walking', bands: ['abductors'] },
  { name: 'Hamstrings', what: 'hip extension, knee control when walking', bands: ['hams'] },
  { name: 'Plantarflexors & dorsiflexors', what: 'push-off, foot clearance, ankle stability', bands: ['calf', 'tib'] },
  { name: 'Trunk flexors & back extensors', what: 'postural control', bands: ['back', 'abs'] },
];

const TG_CFG = {
  state: (el) => ({ rig: new Rig(el.querySelector('[data-rig]')), k: 4, fig: 0 }),
  render: (S) => {
    S.rig.set(blendPose(T_BASE, T_KEYS, S.k));
    S.rig.g.style.opacity = String(S.fig);
  },
  beats: [
    (t, q, S) => {
      frameIn(t, q);
      rise(t, q('[data-a="stand"]'), 0.3, { y: 12 });
      t.fromTo(S, { fig: 0 }, { fig: 1, duration: 0.8 }, 0.3);
      q('[data-a="mrow"]').forEach((r, i) => {
        const at = 0.8 + i * 0.6;
        grow(t, r.querySelector('[data-a="mrule"]'), at, { d: 0.8 });
        rise(t, r.querySelectorAll('[data-a="mtxt"]'), at + 0.08, { y: 14, stagger: 0.07 });
        draw(t, r.querySelector('[data-a="mswatch"]'), at + 0.1, { d: 0.5 });
        MUSCLES[i].bands.forEach((b) => {
          t.fromTo(S.rig.band[b], { opacity: 0 }, { opacity: 1, duration: 0.5 }, at + 0.15);
          t.fromTo(S.rig.band[b], { attr: { 'stroke-width': 30 } }, { attr: { 'stroke-width': 12 }, duration: 0.7, ease: E.out }, at + 0.15);
        });
      });
    },
    (t, q, S) => {
      fade(t, q('[data-a="chair"]'), 0, { d: 0.6 });
      t.fromTo(S, { k: 4 }, { k: 0, duration: 1.4, ease: 'power2.inOut' }, 0.3);
      grow(t, q('[data-a="frule"]'), 0.2, { d: 0.9 });
      wordsIn(t, q('[data-a="func"] .cs-wi'), 0.35, { stagger: 0.04 });
    },
  ],
  ambient: ({ S, beat, draw: redraw, delay }) => {
    if (beat < 1) return;
    const tl = gsap.timeline({ repeat: -1, delay: delay + 0.4, onUpdate: redraw });
    tl.to(S, { k: 4, duration: 1.7, ease: 'power2.inOut' })
      .to(S, { k: 4, duration: 0.7 })
      .to(S, { k: 0, duration: 1.5, ease: 'power2.inOut' })
      .to(S, { k: 0, duration: 0.6 });
  },
};

export function TargetsSlide({ ctx, meta }) {
  const root = useSlide(ctx, TG_CFG);
  return (
    <div className="cs-stage s-tg" ref={root}>
      <Frame meta={meta} title="An effective class targets function" />
      <p className="t-small s-tg__stand" data-a="stand">Target specific impairments, with enough intensity, frequency and progression.</p>
      <svg className="s-tg__fig" width="1920" height="1080" viewBox="0 0 1920 1080">
        <Chair x0={T_SIT.x - 300} x1={T_SIT.x - 150} seatY={T_SEAT} g={T_BASE.g} />
        <path d={`M 140 ${T_BASE.g + 2} H 880`} className="g-floor" />
        <g data-rig="" />
      </svg>
      {MUSCLES.map((m, i) => (
        <div className="s-tg__row" key={m.name} style={{ top: 300 + i * 118 }} data-a="mrow">
          <span className="s-tg__rule" data-a="mrule" />
          <svg className="s-tg__sw" width="40" height="80" viewBox="0 0 40 80"><path d="M 20 10 V 70" data-a="mswatch" /></svg>
          <p className="s-tg__name" data-a="mtxt">{m.name}</p>
          <p className="s-tg__what" data-a="mtxt">{m.what}</p>
        </div>
      ))}
      <span className="s-tg__frule" data-a="frule" />
      <p className="s-tg__func" data-a="func">
        <Words text="Plus functional strengthening: *sit-to-stands,* *step-ups,* *supported* *squats*" />
      </p>
    </div>
  );
}
TargetsSlide.beats = TG_CFG.beats.length;

/* ── 11. Balance ──────────────────────────────────────────────────────────── */

const FOOTP = 'M 0 -62 C 16 -62 23 -48 23 -28 C 23 -6 18 18 16 38 C 14 56 8 62 0 62 C -8 62 -14 56 -16 38 C -18 18 -23 -6 -23 -28 C -23 -48 -16 -62 0 -62 Z';
const STANCES = [
  { name: 'Feet apart', feet: [[-62, 0, -7], [62, 0, 7]], sway: [12, 14] },
  { name: 'Feet together', feet: [[-26, 0, -2], [26, 0, 2]], sway: [13, 16] },
  { name: 'Semi-tandem', feet: [[-25, 34, 0], [25, -32, 0]], sway: [14, 22] },
  { name: 'Tandem', feet: [[0, 64, 0], [0, -64, 0]], sway: [15, 30] },
  { name: 'Single leg', sub: 'with support', feet: [[0, 0, 0]], lifted: [44, -8, 6], sway: [15, 22] },
];
const PX = (i) => 112 + i * 344;
const PCY = 474;

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  p.forEach((pt) => {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop();
    lo.push(pt);
  });
  const hi = [];
  [...p].reverse().forEach((pt) => {
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], pt) <= 0) hi.pop();
    hi.push(pt);
  });
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
const footPts = ([x, y, deg]) => {
  const a = (deg * Math.PI) / 180;
  return Array.from({ length: 28 }, (_, i) => {
    const u = (i / 28) * Math.PI * 2;
    const px = 22 * Math.cos(u);
    const py = 61 * Math.sin(u);
    return [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)];
  });
};
const swayAt = ([ax, ay], u) => [ax * Math.sin(u) + 0.3 * ax * Math.sin(3 * u + 1), 0.8 * ay * Math.sin(2 * u + 0.5) + 0.3 * ay * Math.cos(u)];
const BAL = STANCES.map((s) => {
  const h = hull(s.feet.flatMap(footPts));
  const cx = s.feet.reduce((a, f) => a + f[0], 0) / s.feet.length;
  const cy = s.feet.reduce((a, f) => a + f[1], 0) / s.feet.length;
  const sway = Array.from({ length: 73 }, (_, i) => swayAt(s.sway, (i / 72) * Math.PI * 2));
  return {
    hull: `M ${h.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L ')} Z`,
    sway: `M ${sway.map(([x, y]) => `${f1(cx + x)} ${f1(cy + y)}`).join(' L ')}`,
    cx,
    cy,
  };
});

const BL_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      rise(t, q('[data-a="h1"]'), 0.3, { y: 10 });
      q('[data-a="panel"]').forEach((p, i) => {
        const at = 0.5 + i * 0.4;
        const feet = p.querySelectorAll('[data-a="foot"]');
        t.fromTo(feet, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: E.pop, stagger: 0.12 }, at);
        draw(t, p.querySelector('[data-a="hull"]'), at + 0.3, { d: 0.7 });
        fade(t, p.querySelector('[data-a="hullfill"]'), at + 0.5, { d: 0.5 });
        draw(t, p.querySelector('[data-a="sway"]'), at + 0.6, { d: 1.1, ease: 'none' });
        fade(t, p.querySelectorAll('[data-a="lift"]'), at + 0.5);
        rise(t, p.querySelectorAll('[data-a="plbl"]'), at + 0.2, { y: 10, stagger: 0.06 });
        pop(t, p.querySelectorAll('[data-a="lvl"]'), at + 0.4, { s: 0.2, stagger: 0.05 });
      });
      fade(t, q('[data-a="harder"]'), 2.6);
      draw(t, q('[data-a="harderline"]'), 2.6, { d: 1 });
    },
    (t, q) => {
      rise(t, q('[data-a="h2"]'), 0, { y: 10 });
      q('[data-a="dyn"]').forEach((d, i) => {
        const at = 0.2 + i * 0.5;
        grow(t, d.querySelector('[data-a="drule"]'), at, { d: 0.8 });
        fade(t, d.querySelectorAll('[data-a="dfoot"]'), at + 0.1, { stagger: 0.08 });
        draw(t, d.querySelectorAll('[data-a="darrow"]'), at + 0.3, { d: 0.6, stagger: 0.12 });
        fade(t, d.querySelectorAll('[data-a="dhead"]'), at + 0.6, { stagger: 0.12 });
        rise(t, d.querySelectorAll('[data-a="dtxt"]'), at + 0.2, { y: 12 });
      });
    },
  ],
  ambient: ({ q, delay }) => {
    q('[data-a="cop"]').forEach((dot, i) => {
      const s = STANCES[i];
      const b = BAL[i];
      const o = { u: 0 };
      gsap.to(o, {
        u: Math.PI * 2,
        duration: 5 - i * 0.5,
        ease: 'none',
        repeat: -1,
        delay,
        onUpdate: () => {
          const [x, y] = swayAt(s.sway, o.u);
          dot.setAttribute('cx', f1(b.cx + x));
          dot.setAttribute('cy', f1(b.cy + y));
        },
      });
    });
  },
};

function DynGraphic({ kind }) {
  const foot = (x, y, d = 0, key = '') => <path key={key} d={FOOTP} transform={`translate(${x} ${y}) rotate(${d}) scale(0.7)`} className="g-foot" data-a="dfoot" />;
  if (kind === 0) {
    return (
      <svg width="200" height="190" viewBox="-100 -95 200 190">
        {foot(-20, 0, -4, 'a')}
        {foot(20, 0, 4, 'b')}
        <path d="M 0 -50 V -86" className="g-arrow" data-a="darrow" />
        <path d="M 46 0 H 92" className="g-arrow" data-a="darrow" />
        <path d="M 0 50 V 86" className="g-arrow" data-a="darrow" />
        <path d="M -8 -76 L 0 -88 L 8 -76" className="g-arrowhead" data-a="dhead" />
        <path d="M 82 -8 L 94 0 L 82 8" className="g-arrowhead" data-a="dhead" />
        <path d="M -8 76 L 0 88 L 8 76" className="g-arrowhead" data-a="dhead" />
      </svg>
    );
  }
  if (kind === 1) {
    return (
      <svg width="200" height="190" viewBox="-100 -95 200 190">
        {foot(-14, 50, 0, 'a')}
        {foot(14, -52, 0, 'b')}
        <rect x="-60" y="-8" width="120" height="16" rx="4" className="g-hurdle" />
        <path d="M 30 36 C 70 20 70 -24 30 -40" className="g-arrow" data-a="darrow" />
        <path d="M 30 -26 L 26 -42 L 42 -42" className="g-arrowhead" data-a="dhead" />
      </svg>
    );
  }
  return (
    <svg width="200" height="190" viewBox="-100 -95 200 190">
      <path d="M -50 -60 L 50 -60 L 50 60 L -50 60 Z" className="g-bos" />
      {foot(-24, 0, -4, 'a')}
      {foot(24, 0, 4, 'b')}
      <path d="M 10 -20 L 86 -78" className="g-arrow g-arrow--risk" data-a="darrow" />
      <path d="M 72 -80 L 88 -80 L 86 -64" className="g-arrowhead g-arrowhead--risk" data-a="dhead" />
    </svg>
  );
}

const DYN = ['Forward, lateral and backward stepping', 'Obstacle negotiation', 'Reaching outside the base of support'];

export function BalanceSlide({ ctx, meta }) {
  const root = useSlide(ctx, BL_CFG);
  return (
    <div className="cs-stage s-bl" ref={root}>
      <Frame meta={meta} title="Balance work has to challenge balance" />
      <p className="t-micro s-bl__h1" data-a="h1"><span className="dot dot--move" />Narrow the base of support</p>
      {STANCES.map((s, i) => (
        <div className="s-bl__panel" key={s.name} style={{ left: PX(i) }} data-a="panel">
          <svg width="320" height="300" viewBox="-160 -150 320 300" className="s-bl__svg">
            <path d={BAL[i].hull} className="s-bl__hullfill" data-a="hullfill" />
            {s.feet.map((f) => (
              <g key={`${f[0]},${f[1]}`} transform={`translate(${f[0]} ${f[1]}) rotate(${f[2]})`}>
                <path d={FOOTP} className="g-foot" data-a="foot" />
              </g>
            ))}
            {s.lifted && (
              <g transform={`translate(${s.lifted[0]} ${s.lifted[1]}) rotate(${s.lifted[2]})`}>
                <path d={FOOTP} className="g-foot g-foot--lifted" data-a="lift" />
              </g>
            )}
            <path d={BAL[i].hull} className="s-bl__hull" data-a="hull" />
            <path d={BAL[i].sway} className="s-bl__sway" data-a="sway" />
            <circle r="8" cx={BAL[i].cx} cy={BAL[i].cy} className="s-bl__cop" data-a="cop" />
          </svg>
          <p className="s-bl__name" data-a="plbl">{s.name}</p>
          {s.sub && <p className="s-bl__sub" data-a="plbl">{s.sub}</p>}
          <div className="s-bl__lvl">
            {[0, 1, 2, 3, 4].map((k) => <span key={k} className={k <= i ? 'is-on' : ''} data-a="lvl" />)}
          </div>
        </div>
      ))}
      <svg className="s-bl__harder" width="1920" height="60" viewBox="0 0 1920 60" data-a="harder">
        <path d="M 120 30 H 1790" className="s-bl__hline" data-a="harderline" />
        <path d="M 1772 18 L 1792 30 L 1772 42" className="s-bl__hline" />
      </svg>
      <p className="t-micro s-bl__hlbl" data-a="harder">Harder</p>
      <p className="t-micro s-bl__h2" data-a="h2"><span className="dot dot--move" />Then make it dynamic</p>
      {DYN.map((d, i) => (
        <div className="s-bl__dyn" key={d} style={{ left: 112 + i * 576 }} data-a="dyn">
          <span className="s-bl__drule" data-a="drule" />
          <div className="s-bl__dg"><DynGraphic kind={i} /></div>
          <p className="s-bl__dtxt" data-a="dtxt">{d}</p>
        </div>
      ))}
      <p className="s-bl__foot t-small">Feet seen from above · shaded area = base of support · dot = centre of pressure (schematic)</p>
    </div>
  );
}
BalanceSlide.beats = BL_CFG.beats.length;

/* ── 12. Progress it ──────────────────────────────────────────────────────── */

const KNOBS = ['Resistance', 'Repetitions', 'Range', 'Speed', 'Complexity'];
const KX = (i) => 112 + 96 + i * 336;
const KR = 62;
const kpt = (a, r = KR) => [r * Math.cos(((a - 90) * Math.PI) / 180), r * Math.sin(((a - 90) * Math.PI) / 180)];
const karc = (a0, a1, r = KR + 16) => {
  const [x0, y0] = kpt(a0, r);
  const [x1, y1] = kpt(a1, r);
  return `M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
};
const P_BASE = { ...POSES.sit, x: 520, g: 980 };
const SEAT_STD = P_BASE.g - 166;
const SEAT_LOW = P_BASE.g - 136;

const PG_CFG = {
  state: (el) => ({ rig: new Rig(el.querySelector('[data-rig]')), seat: SEAT_STD, db: 0, k: 0, fig: 0, el }),
  render: (S) => {
    const sit = sitOn(P_BASE, S.seat);
    const keys = [{ s: sit.s, t: sit.t, k: sit.k, u: sit.u, f: sit.f }, ...STS.slice(1)];
    const J = S.rig.set(blendPose(P_BASE, keys, S.k));
    S.rig.g.style.opacity = String(S.fig);
    const chair = S.el.querySelector('[data-p="chair"]');
    if (chair) {
      const x0 = P_BASE.x - 300;
      const x1 = P_BASE.x - 150;
      const y = S.seat;
      chair.setAttribute('d', `M ${x0} ${f1(y)} H ${x1} M ${x0 + 6} ${f1(y)} V ${f1(y - 230)} M ${x0 + 10} ${f1(y)} L ${x0 + 14} ${P_BASE.g} M ${x1 - 10} ${f1(y)} L ${x1 - 14} ${P_BASE.g}`);
    }
    const db = S.el.querySelector('[data-p="db"]');
    if (db) {
      db.setAttribute('transform', `translate(${f1(J.wrist[0])} ${f1(J.wrist[1])})`);
      db.setAttribute('opacity', S.db.toFixed(3));
    }
  },
  beats: [
    (t, q) => {
      frameIn(t, q);
      q('[data-a="knob"]').forEach((k, i) => {
        const at = 0.3 + i * 0.18;
        draw(t, k.querySelector('[data-a="ktrack"]'), at, { d: 0.6 });
        pop(t, k.querySelector('[data-a="kbody"]'), at + 0.1, { s: 0.5 });
        t.fromTo(k.querySelector('[data-a="kturn"]'), { rotation: -120, svgOrigin: '0 0' }, { rotation: 0, svgOrigin: '0 0', duration: 1.2, ease: 'power3.inOut' }, at + 0.4);
        t.fromTo(k.querySelector('[data-a="kfill"]'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, ease: 'power3.inOut' }, at + 0.4);
        rise(t, k.querySelectorAll('[data-a="klbl"]'), at + 0.2, { y: 10 });
      });
    },
    (t, q, S) => {
      fade(t, q('[data-a="exfig"]'), 0, { d: 0.5 });
      t.fromTo(S, { fig: 0 }, { fig: 1, duration: 0.6 }, 0);
      grow(t, q('[data-a="exrule"]'), 0.1, { d: 0.9 });
      rise(t, q('[data-a="ex"]'), 0.2, { y: 14, stagger: 0.12 });
      count(t, q('[data-a="ten"]')[0], 10, 0.4, { d: 1.2 });
      t.fromTo(S, { db: 0 }, { db: 1, duration: 0.5 }, 1.5);
      t.to(S, { db: 0, duration: 0.4 }, 2.9);
      t.fromTo(S, { seat: SEAT_STD }, { seat: SEAT_LOW, duration: 1, ease: 'power2.inOut' }, 3.1);
      rise(t, q('[data-a="or"]'), 1.4, { y: 10, stagger: 1.6 });
    },
    (t, q) => {
      grow(t, q('[data-a="cvrule"]'), 0, { d: 0.9 });
      rise(t, q('[data-a="cv"]'), 0.15, { y: 12, stagger: 0.12 });
      grow(t, q('[data-a="goalrule"]'), 0.6, { d: 0.9 });
      wordsIn(t, q('[data-a="goal"] .cs-wi'), 0.75, { stagger: 0.03 });
    },
  ],
  ambient: ({ S, beat, draw: redraw, delay }) => {
    if (beat < 1) return;
    const tl = gsap.timeline({ repeat: -1, delay: delay + 0.3, onUpdate: redraw });
    tl.to(S, { k: 4, duration: 1.7, ease: 'power2.inOut' })
      .to(S, { k: 4, duration: 0.6 })
      .to(S, { k: 0, duration: 1.5, ease: 'power2.inOut' })
      .to(S, { k: 0, duration: 0.6 });
  },
};

export function ProgressSlide({ ctx, meta }) {
  const root = useSlide(ctx, PG_CFG);
  return (
    <div className="cs-stage s-pg" ref={root}>
      <Frame meta={meta} title="Progress it, individually" />
      <svg className="s-pg__knobs" width="1920" height="1080" viewBox="0 0 1920 1080">
        {KNOBS.map((k, i) => (
          <g key={k} transform={`translate(${KX(i)} 352)`} data-a="knob">
            <path d={karc(-135, 135)} className="s-pg__ktrack" data-a="ktrack" />
            <path d={karc(-135, 90)} className="s-pg__kfill" data-a="kfill" />
            <g data-a="kbody">
              <circle r={KR} className="s-pg__kbody" />
              <g data-a="kturn">
                <g transform="rotate(90)">
                  <path d={`M 0 ${-KR + 14} V ${-KR + 40}`} className="s-pg__kptr" />
                </g>
              </g>
            </g>
          </g>
        ))}
      </svg>
      {KNOBS.map((k, i) => (
        <p key={k} className="s-pg__klbl" style={{ left: KX(i) - 140 }} data-a="klbl">{k}</p>
      ))}
      <svg className="s-pg__fig" width="1920" height="1080" viewBox="0 0 1920 1080" data-a="exfig">
        <path data-p="chair" className="g-chair g-chair--one" />
        <path d={`M 140 ${P_BASE.g + 2} H 760`} className="g-floor" />
        <g data-rig="" />
        <g data-p="db" className="g-db">
          <rect x="-26" y="-7" width="52" height="14" rx="4" />
          <rect x="-34" y="-17" width="12" height="34" rx="3" />
          <rect x="22" y="-17" width="12" height="34" rx="3" />
        </g>
      </svg>
      <span className="s-pg__exrule" data-a="exrule" />
      <p className="t-micro s-pg__exk" data-a="ex">For example</p>
      <p className="s-pg__ex" data-a="ex">Someone who can comfortably do <b><span data-a="ten">10</span> sit-to-stands</b> from a standard chair might progress to</p>
      <p className="s-pg__or" data-a="or"><span className="dot dot--bone" />holding a light weight</p>
      <p className="s-pg__or s-pg__or--2" data-a="or"><span className="dot dot--bone" />or using a slightly lower chair, if it's safe</p>
      <span className="s-pg__cvrule" data-a="cvrule" />
      <p className="t-micro s-pg__cvk" data-a="cv">Cardiovascular endurance too</p>
      <p className="s-pg__cv" data-a="cv">Marching, walking circuits, repeated stepping</p>
      <span className="s-pg__goalrule" data-a="goalrule" />
      <p className="s-pg__goal" data-a="goal">
        <Words text="Enough challenge to drive *adaptation,* without compromising *safety.*" />
      </p>
    </div>
  );
}
ProgressSlide.beats = PG_CFG.beats.length;

/* ── 13. GER360 today ─────────────────────────────────────────────────────── */

const BLOCKS = [
  { name: 'Seated warm-up', what: 'Knee extensions, marching, biceps curls, punches', icon: 'chair' },
  { name: 'Strengthening', what: 'Individually prescribed weights and ankle weights', icon: 'db' },
  { name: 'Standing lower limb', what: 'Standing leg exercises', icon: 'stand' },
  { name: 'Sit-to-stands', what: 'Once the weights are off', icon: 'sts' },
  { name: 'Standing balance', what: 'Balance activities', icon: 'bal' },
  { name: 'Obstacle course', what: 'One at a time, with the AHA', icon: 'cones' },
  { name: 'Cognitive & social', what: 'Ball toss, naming items in a category', icon: 'ball' },
];
const BW = (1808 - 112) / 7;
const BX = (i) => 112 + i * BW;
const COMPONENTS = [
  { name: 'Resistance training', from: [1], cls: 'bone' },
  { name: 'Functional strengthening', from: [3], cls: 'bone' },
  { name: 'Weight-bearing activity', from: [2, 4, 5], cls: 'bone' },
  { name: 'Balance & coordination', from: [4, 5], cls: 'move' },
  { name: 'Cognitive dual-tasking', from: [6], cls: 'ink' },
];
const CW = (1808 - 112) / 5;
const CXc = (i) => 112 + i * CW + CW / 2;

function BlockIcon({ kind }) {
  switch (kind) {
    case 'chair':
      return <path d="M -20 -30 V 20 M -20 6 H 22 M -16 6 L -18 32 M 18 6 L 20 32" />;
    case 'db':
      return <path d="M -26 0 H 26 M -26 -14 V 14 M -18 -18 V 18 M 26 -14 V 14 M 18 -18 V 18" />;
    case 'stand':
      return <g><circle cx="0" cy="-28" r="7" /><path d="M 0 -20 V 6 M 0 6 L -8 32 M 0 6 L 16 22 L 26 18 M 0 -12 L -14 4 M 0 -12 L 14 4" /></g>;
    case 'sts':
      return <path d="M -24 -30 V 20 M -24 6 H 4 M -20 6 L -22 32 M 22 22 V -22 M 12 -12 L 22 -24 L 32 -12" />;
    case 'bal':
      return <g><circle cx="0" cy="-28" r="7" /><path d="M 0 -20 V 8 M 0 8 V 32 M 0 8 L 18 18 M -22 -12 L 22 -12" /></g>;
    case 'cones':
      return <path d="M -30 28 L -20 -6 L -10 28 Z M 10 28 L 20 -6 L 30 28 Z M -36 28 H 36" />;
    default:
      return <g><circle cx="-8" cy="6" r="18" /><path d="M -26 6 Q -8 -6 10 6 M -8 -12 V 24" /><path d="M 14 -30 h 22 v 14 h -14 l -6 6 v -6 h -2 z" /></g>;
  }
}

const CS_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      t.fromTo(q('[data-a="playhead"]'), { x: 0, autoAlpha: 1 }, { x: 1808 - 112, duration: 3.6, ease: 'power1.inOut' }, 0.4);
      t.to(q('[data-a="playhead"]'), { autoAlpha: 0, duration: 0.3 }, 4.0);
      q('[data-a="block"]').forEach((b, i) => {
        const at = 0.45 + i * 0.5;
        grow(t, b.querySelector('[data-a="brule"]'), at, { d: 0.5 });
        rise(t, b.querySelectorAll('[data-a="btxt"]'), at + 0.05, { y: 16, stagger: 0.08 });
        draw(t, b.querySelectorAll('[data-a="bicon"] path, [data-a="bicon"] circle'), at + 0.1, { d: 0.6, stagger: 0.05 });
      });
    },
    (t, q) => {
      draw(t, q('[data-a="link"]'), 0, { d: 1.1, stagger: 0.12, ease: 'power2.inOut' });
      q('[data-a="comp"]').forEach((c, i) => {
        const at = 0.5 + i * 0.15;
        pop(t, c.querySelector('[data-a="cdot"]'), at, { s: 0.2 });
        rise(t, c.querySelector('[data-a="cname"]'), at + 0.05, { y: 12 });
      });
      fade(t, q('[data-a="cnote"]'), 1.6);
    },
  ],
};

export function ClassSlide({ ctx, meta }) {
  const root = useSlide(ctx, CS_CFG);
  return (
    <div className="cs-stage s-cs" ref={root}>
      <Frame meta={meta} title="GER360 today: a strong foundation" foot="AHA = allied health assistant." />
      <span className="s-cs__playhead" data-a="playhead" />
      {BLOCKS.map((b, i) => (
        <div className="s-cs__block" key={b.name} style={{ left: BX(i), width: BW - 18 }} data-a="block">
          <span className="s-cs__brule" data-a="brule" />
          <p className="s-cs__bn t-mono" data-a="btxt">{String(i + 1).padStart(2, '0')}</p>
          <svg className="s-cs__bicon" width="100" height="90" viewBox="-50 -45 100 90" data-a="bicon"><BlockIcon kind={b.icon} /></svg>
          <p className="s-cs__bname" data-a="btxt">{b.name}</p>
          <p className="s-cs__bwhat" data-a="btxt">{b.what}</p>
        </div>
      ))}
      <svg className="s-cs__links" width="1920" height="1080" viewBox="0 0 1920 1080">
        {COMPONENTS.flatMap((c, ci) => c.from.map((bi) => {
          const x0 = BX(bi) + (BW - 18) / 2;
          const x1 = CXc(ci);
          return <path key={`${ci}-${bi}`} d={`M ${f1(x0)} 690 C ${f1(x0)} 770 ${f1(x1)} 760 ${f1(x1)} 836`} className={`s-cs__link s-cs__link--${c.cls}`} data-a="link" />;
        }))}
      </svg>
      {COMPONENTS.map((c, i) => (
        <div className="s-cs__comp" key={c.name} style={{ left: CXc(i) - CW / 2, width: CW }} data-a="comp">
          <span className={`dot dot--${c.cls === 'ink' ? 'ink' : c.cls}`} data-a="cdot" />
          <p className="s-cs__cname" data-a="cname">{c.name}</p>
        </div>
      ))}
      <p className="t-small s-cs__cnote" data-a="cnote">Already covering several key parts of physical function.</p>
    </div>
  );
}
ClassSlide.beats = CS_CFG.beats.length;

/* ── 14. How GER360 compares ──────────────────────────────────────────────── */

const TABLE = [
  { rec: 'Progressive resistance', now: 'Weights and ankle weights', mark: 'part', opp: 'Track and progress the load over time' },
  { rec: 'Weight-bearing & impact', now: 'Standing exercises, walking, marching on the spot: low load', mark: 'part', opp: 'Controlled stamping, heel drops, purposeful stepping' },
  { rec: 'Balance & functional mobility', now: 'Standing balance, obstacle course', mark: 'yes', opp: 'More multidirectional stepping, changes of direction' },
  { rec: 'Trunk & back extensors', now: 'Little targeted work', mark: 'no', opp: 'Targeted trunk and back-extensor strengthening' },
];
const QUESTIONS = ['Are we progressively challenging participants enough?', 'Is there enough load to support bone health?', 'Is there room for more targeted exercises?'];

const CP_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      wordsIn(t, q('[data-a="re"] .cs-wi'), 0.3, { stagger: 0.04 });
      t.fromTo(q('[data-a="strike"]'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, 1.3);
      q('[data-a="qq"]').forEach((el, i) => {
        grow(t, el.querySelector('[data-a="qrule"]'), 1.5 + i * 0.2, { d: 0.7 });
        rise(t, el.querySelectorAll('[data-a="qt"]'), 1.6 + i * 0.2, { y: 12 });
      });
    },
    (t, q) => {
      t.to(q('[data-a="qq"]'), { autoAlpha: 0, y: -10, duration: 0.4, stagger: 0.05 }, 0);
      grow(t, q('[data-a="thrule"]'), 0.3, { d: 0.8 });
      rise(t, q('[data-a="th"]'), 0.35, { y: 10, stagger: 0.05 });
      q('[data-row="0"], [data-row="1"]').forEach((r, i) => {
        const at = 0.7 + i * 0.6;
        grow(t, r.querySelector('[data-a="trule"]'), at, { d: 0.8 });
        rise(t, r.querySelectorAll('[data-a="tc"]'), at + 0.1, { y: 14, stagger: 0.12 });
        pop(t, r.querySelector('.dot'), at + 0.3, { s: 0.2 });
      });
    },
    (t, q) => {
      q('[data-row="2"], [data-row="3"]').forEach((r, i) => {
        const at = i * 0.6;
        grow(t, r.querySelector('[data-a="trule"]'), at, { d: 0.8 });
        rise(t, r.querySelectorAll('[data-a="tc"]'), at + 0.1, { y: 14, stagger: 0.12 });
        pop(t, r.querySelector('.dot'), at + 0.3, { s: 0.2 });
      });
      grow(t, q('[data-a="endrule"]'), 1.2, { d: 0.8 });
      wordsIn(t, q('[data-a="end"] .cs-wi'), 1.35, { stagger: 0.035 });
    },
  ],
};

export function CompareSlide({ ctx, meta }) {
  const root = useSlide(ctx, CP_CFG);
  return (
    <div className="cs-stage s-cp" ref={root}>
      <Frame meta={meta} title="How does GER360 compare?" />
      <p className="s-cp__re" data-a="re">
        <span className="s-cp__which">
          <Words text="Less about which exercises," />
          <span className="s-cp__strike" data-a="strike" />
        </span>{' '}
        <Words text="more about the *training* *stimulus.*" />
      </p>
      {QUESTIONS.map((qq, i) => (
        <div className="s-cp__q" key={qq} style={{ left: 112 + i * 576 }} data-a="qq">
          <span className="s-cp__qrule" data-a="qrule" />
          <p className="s-cp__qn t-mono" data-a="qt">Q{i + 1}</p>
          <p className="s-cp__qt" data-a="qt">{qq}</p>
        </div>
      ))}
      <span className="s-cp__thrule" data-a="thrule" />
      <p className="t-micro s-cp__th" style={{ left: 112 }} data-a="th">Target</p>
      <p className="t-micro s-cp__th" style={{ left: 640 }} data-a="th">GER360 now</p>
      <p className="t-micro s-cp__th" style={{ left: 1240 }} data-a="th">Opportunity</p>
      {TABLE.map((r, i) => (
        <div className="s-cp__row" key={r.rec} style={{ top: 560 + i * 92 }} data-row={i}>
          <span className="s-cp__trule" data-a="trule" />
          <p className="s-cp__rec" data-a="tc">{r.rec}</p>
          <p className="s-cp__now" data-a="tc"><Mark kind={r.mark} />{r.now}</p>
          <p className="s-cp__opp" data-a="tc"><span className="s-cp__arrow">→</span>{r.opp}</p>
        </div>
      ))}
      <p className="s-cp__key t-small"><Mark kind="yes" /> in place <Mark kind="part" /> partly <Mark kind="no" /> not yet</p>
      <span className="s-cp__endrule" data-a="endrule" />
      <p className="s-cp__end" data-a="end">
        <Words text="Not replacing what we do: *building* *on* it, for falls prevention *and* bone health." />
      </p>
    </div>
  );
}
CompareSlide.beats = CP_CFG.beats.length;
