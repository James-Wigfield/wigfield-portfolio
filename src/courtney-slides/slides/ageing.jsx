import { Frame, Words } from '../engine/Words';
import { E, draw, fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';
import { POSES, Rig, solve } from '../art/rig';
import { Lattice, buildLattice } from '../art/lattice';

/* ============================================================================
   CHAPTER 2 — AGEING & BONE: four systems, remodelling, the bone-loss
   spectrum, and the fracture cycle.
   ========================================================================== */

const f1 = (v) => v.toFixed(1);

/* ── 4. Four systems ──────────────────────────────────────────────────────── */

const FIG = { ...POSES.stand, x: 1000, g: 930 };
const FJ = solve(FIG);

const SYSTEMS = [
  {
    k: '01', name: 'Musculoskeletal', left: 112, top: 268,
    items: ['Sarcopenia: less muscle mass and strength', 'Lower bone mineral density', 'Thinner cartilage, stiffer joints'],
    so: 'Harder walking, transfers and daily tasks; higher fragility-fracture risk',
  },
  {
    k: '02', name: 'Cardiovascular', left: 1180, top: 268,
    items: ['Lower maximum heart rate and reserve', 'Less exercise tolerance, earlier fatigue', 'Changes in blood pressure regulation'],
    so: 'Postural hypotension and dizziness',
  },
  {
    k: '03', name: 'Sensory & neurological', left: 112, top: 622,
    items: ['Lower visual acuity and depth perception', 'Reduced hearing, proprioception and vestibular function', 'Slower reaction time'],
    so: 'Harder to spot hazards, clear obstacles and recover a loss of balance',
  },
  {
    k: '04', name: 'Homeostatic reserve', left: 1180, top: 622,
    items: ['Less capacity to absorb stressors: illness, injury, a hospital stay'],
    so: 'Deconditioning and a slower return to independence',
  },
];

const FIBRES = (() => {
  const out = [];
  const lost = new Set([2, 7, 11, 15, 17]);
  let n = 0;
  for (let row = -2; row <= 2; row++) {
    const cnt = 5 - Math.abs(row);
    for (let c = 0; c < cnt; c++) {
      const x = 110 + (c - (cnt - 1) / 2) * 31;
      const y = 70 + row * 26;
      out.push({ x, y, lost: lost.has(n) });
      n++;
    }
  }
  return out;
})();

function SysGraphic({ k }) {
  if (k === '01') {
    return (
      <svg width="220" height="140" viewBox="0 0 220 140" className="s-sys__svg">
        <ellipse cx="110" cy="70" rx="96" ry="64" className="g-ghost" data-a="g1-ghost" />
        <ellipse cx="110" cy="70" rx="78" ry="52" className="g-risk-line" data-a="g1-edge" />
        {FIBRES.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="11" className={`g-fibre${p.lost ? ' is-lost' : ''}`} data-a={p.lost ? 'g1-lost' : 'g1-fibre'} />
        ))}
      </svg>
    );
  }
  if (k === '02') {
    return (
      <svg width="220" height="140" viewBox="0 0 220 140" className="s-sys__svg">
        <path d="M 8 132 H 214" className="g-axis" />
        <path d="M 8 34 H 214" className="g-ghost" />
        <path d="M 8 132 C 70 124 116 40 160 36 L 214 36" className="g-ghost" />
        <g data-a="g2-cap"><path d="M 8 70 H 214" className="g-risk-line g-dash" /></g>
        <path d="M 8 132 C 70 126 112 76 150 72 L 214 72" className="g-risk-line" data-a="g2-curve" />
        <text x="214" y="26" className="g-tag" textAnchor="end">max HR</text>
      </svg>
    );
  }
  if (k === '03') {
    return (
      <svg width="220" height="140" viewBox="0 0 220 140" className="s-sys__svg">
        <path d="M 8 110 H 214" className="g-axis" />
        <g data-a="g3-flash" className="g-flash">
          <path d="M 26 40 V 22 M 26 70 V 88 M 11 55 H -3 M 41 55 H 55 M 15 44 L 6 35 M 37 44 L 46 35 M 15 66 L 6 75 M 37 66 L 46 75" />
          <circle cx="26" cy="55" r="7" />
        </g>
        <path d="M 104 92 V 128" className="g-ghost" />
        <path d="M 26 110 H 176" className="g-risk-bar" data-a="g3-bar" />
        <path d="M 176 88 V 132" className="g-risk-line" data-a="g3-mark" />
        <text x="176" y="80" className="g-tag" textAnchor="middle">react</text>
      </svg>
    );
  }
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" className="s-sys__svg">
      <path d="M 6 36 H 214" className="g-axis g-dash" />
      <path d="M 56 6 V 26 M 48 18 L 56 28 L 64 18" className="g-risk-line" data-a="g4-hit" />
      <path d="M 6 36 H 56 L 74 104 C 100 104 112 40 150 37 L 214 36" className="g-ghost" data-a="g4-young" />
      <path d="M 6 36 H 56 L 74 112 C 124 114 164 80 214 70" className="g-risk-line" data-a="g4-old" />
      <text x="214" y="128" className="g-tag" textAnchor="end">time →</text>
    </svg>
  );
}

const SYS_HEART = 'M 0 6 C -10 -4 -22 2 -16 14 L 0 28 L 16 14 C 22 2 10 -4 0 6 Z';

function sysBeat(k) {
  return (t, q, S) => {
    const box = q(`[data-q="${k}"]`)[0];
    const sel = (s) => box.querySelectorAll(s);
    if (k === 0) {
      frameIn(t, q);
      t.fromTo(S, { fig: 0 }, { fig: 1, duration: 1, ease: 'power2.out' }, 0.2);
    }
    const at = k === 0 ? 0.7 : 0;
    grow(t, sel('[data-a="qrule"]'), at, { d: 0.9 });
    rise(t, sel('[data-a="qh"]'), at + 0.1, { y: 14 });
    rise(t, sel('[data-a="item"]'), at + 0.35, { y: 16, stagger: 0.12 });
    rise(t, sel('[data-a="so"]'), at + 0.9, { y: 12 });
    fade(t, sel('svg'), at + 0.1, { d: 0.4 });
    const g = at + 0.3;
    if (k === 0) {
      fade(t, sel('[data-a="g1-ghost"]'), g, { d: 0.5 });
      t.fromTo(sel('[data-a="g1-fibre"], [data-a="g1-lost"]'), { attr: { r: 15 } }, { attr: { r: 11 }, duration: 1.6, ease: 'power2.inOut' }, g + 0.4);
      t.fromTo(sel('[data-a="g1-lost"]'), { opacity: 1 }, { opacity: 0.2, duration: 1.2, stagger: 0.1 }, g + 0.8);
      t.fromTo(sel('[data-a="g1-edge"]'), { attr: { rx: 96, ry: 64 } }, { attr: { rx: 78, ry: 52 }, duration: 1.6, ease: 'power2.inOut' }, g + 0.4);
      t.fromTo(S, { b1: 0 }, { b1: 1, duration: 1, ease: 'power2.out' }, g + 0.6);
      pop(t, q('[data-a="tag1"]'), g + 0.8);
    }
    if (k === 1) {
      t.fromTo(sel('[data-a="g2-cap"]'), { y: -36 }, { y: 0, duration: 1.4, ease: 'power3.inOut' }, g + 0.3);
      draw(t, sel('[data-a="g2-curve"]'), g + 0.4, { d: 1.4 });
      pop(t, q('[data-a="heart"]'), g + 0.2, { s: 0.3 });
      pop(t, q('[data-a="tag2"]'), g + 0.5);
    }
    if (k === 2) {
      pop(t, sel('[data-a="g3-flash"]'), g, { s: 0.2 });
      grow(t, sel('[data-a="g3-bar"]'), g + 0.3, { d: 1.4, origin: '0% 50%' });
      t.fromTo(sel('[data-a="g3-mark"]'), { autoAlpha: 0, x: -150 }, { autoAlpha: 1, x: 0, duration: 1.4, ease: 'power3.inOut' }, g + 0.3);
      pop(t, q('[data-a="eye"]'), g + 0.2, { s: 0.2 });
      t.fromTo(q('[data-a="wave"]'), { autoAlpha: 0, x: 18 }, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.12, ease: E.out }, g + 0.3);
      pop(t, q('[data-a="tag3"]'), g + 0.5);
    }
    if (k === 3) {
      draw(t, sel('[data-a="g4-hit"]'), g, { d: 0.5 });
      draw(t, sel('[data-a="g4-young"]'), g + 0.3, { d: 1.6 });
      draw(t, sel('[data-a="g4-old"]'), g + 0.5, { d: 2 });
      t.fromTo(q('[data-a="reserve"]'), { autoAlpha: 0, attr: { rx: 300, ry: 470 } }, { autoAlpha: 1, attr: { rx: 196, ry: 384 }, duration: 2, ease: 'power3.inOut' }, g);
      pop(t, q('[data-a="tag4"]'), g + 1.2);
    }
  };
}

const SYS_CFG = {
  state: (el) => ({ rig: new Rig(el.querySelector('[data-rig]')), fig: 0, b1: 0 }),
  render: (S) => {
    S.rig.set(FIG);
    S.rig.g.style.opacity = String(S.fig);
    ['quads', 'hams', 'calf', 'glutes'].forEach((n) => {
      S.rig.band[n].setAttribute('opacity', S.b1.toFixed(3));
      S.rig.band[n].classList.add('is-risk');
    });
  },
  beats: [
    sysBeat(0), sysBeat(1), sysBeat(2), sysBeat(3),
    (t, q) => {
      grow(t, q('[data-a="endrule"]'), 0, { d: 1 });
      wordsIn(t, q('[data-a="end"] .cs-wi'), 0.15, { stagger: 0.03 });
    },
  ],
  ambient: ({ q, beat, delay }) => {
    if (beat < 1) return;
    gsap.to(q('[data-a="heartbeat"]'), { scale: 1.18, transformOrigin: '50% 50%', duration: 0.18, ease: 'power2.out', yoyo: true, repeat: -1, repeatDelay: 0.7, delay });
  },
};

export function SystemsSlide({ ctx, meta }) {
  const root = useSlide(ctx, SYS_CFG);
  const chest = [FJ.shoulder[0] + 6, FJ.shoulder[1] + 74];
  const eye = [FJ.head[0] + 16, FJ.head[1] - 6];
  return (
    <div className="cs-stage s-sys" ref={root}>
      <Frame meta={meta} title="What happens to our bodies as we age?" />
      <svg className="s-sys__fig" width="1920" height="1080" viewBox="0 0 1920 1080">
        <ellipse cx={FJ.hip[0] + 6} cy={FJ.hip[1] + 40} rx="196" ry="384" className="g-reserve" data-a="reserve" />
        <g data-rig="" />
        <g transform={`translate(${f1(chest[0])} ${f1(chest[1])})`}>
          <g data-a="heart"><path d={SYS_HEART} className="g-heart" data-a="heartbeat" /></g>
        </g>
        <circle cx={eye[0]} cy={eye[1]} r="7" className="g-eye" data-a="eye" />
        {[0, 1, 2].map((i) => (
          <path key={i} data-a="wave" className="g-wave" d={`M ${f1(eye[0] + 40 + i * 18)} ${f1(eye[1] - 24 - i * 8)} q ${10 + i * 2} ${24 + i * 8} 0 ${48 + i * 16}`} />
        ))}
        <text x={FJ.knee[0] - 86} y={FJ.knee[1] - 70} className="s-sys__tag" data-a="tag1">01</text>
        <text x={chest[0] + 58} y={chest[1] + 20} className="s-sys__tag" data-a="tag2">02</text>
        <text x={eye[0] + 104} y={eye[1] + 40} className="s-sys__tag" data-a="tag3">03</text>
        <text x={FJ.hip[0] + 200} y={FJ.hip[1] + 260} className="s-sys__tag" data-a="tag4">04</text>
      </svg>
      {SYSTEMS.map((s, i) => (
        <div className="s-sys__q" key={s.k} style={{ left: s.left, top: s.top }} data-q={i}>
          <span className="s-sys__qrule" data-a="qrule" />
          <p className="s-sys__qh" data-a="qh"><span>{s.k}</span>{s.name}</p>
          <div className="s-sys__row">
            <div className="s-sys__g"><SysGraphic k={s.k} /></div>
            <ul className="s-sys__items">
              {s.items.map((it) => <li key={it} data-a="item">{it}</li>)}
            </ul>
          </div>
          <p className="s-sys__so" data-a="so"><span>→</span> {s.so}</p>
        </div>
      ))}
      <span className="s-sys__endrule" data-a="endrule" />
      <p className="s-sys__end" data-a="end">
        <Words text="These changes happen at *different* *rates* in everyone, so programmes must be *individualised.*" />
      </p>
    </div>
  );
}
SystemsSlide.beats = SYS_CFG.beats.length;

/* ── 5. Remodelling ───────────────────────────────────────────────────────── */

const RM = { x0: 112, x1: 1808, top: 640, bot: 960, cx: 900, w: 460, dmax: 150 };
const bump = (x) => {
  const u = (x - RM.cx) / (RM.w / 2);
  return Math.abs(u) >= 1 ? 0 : (1 + Math.cos(Math.PI * u)) / 2;
};
const surfY = (x, D, F) => RM.top + D * bump(x) * (1 - F);
function pitPath(D, F, closeTo) {
  // a closed shape whose top edge is the surface (D, F) and bottom is `closeTo` (a y or a function)
  const pts = [];
  for (let x = RM.cx - RM.w / 2 - 12; x <= RM.cx + RM.w / 2 + 12; x += 10) pts.push([x, surfY(x, D, F)]);
  let d = `M ${RM.x0} ${RM.top} L ${f1(pts[0][0])} ${RM.top} `;
  pts.forEach(([x, y]) => { d += `L ${f1(x)} ${f1(y)} `; });
  d += `L ${RM.x1} ${RM.top} `;
  if (typeof closeTo === 'number') return `${d}L ${RM.x1} ${closeTo} L ${RM.x0} ${closeTo} Z`;
  const back = [];
  for (let x = RM.cx + RM.w / 2 + 12; x >= RM.cx - RM.w / 2 - 12; x -= 10) back.push([x, closeTo(x)]);
  return `M ${f1(pts[0][0])} ${RM.top} ${pts.map(([x, y]) => `L ${f1(x)} ${f1(y)}`).join(' ')} ${back.map(([x, y]) => `L ${f1(x)} ${f1(y)}`).join(' ')} Z`;
}
const OB_X = [-170, -102, -34, 34, 102, 170];
const EMBED = 2;
const OCYTES = [[260, 790], [420, 890], [560, 750], [1280, 820], [1440, 720], [1600, 890], [1730, 770], [700, 910], [1130, 930], [330, 690]];
const OC_SHAPE = 'M -120 30 C -128 -10 -96 -58 -40 -62 C 0 -66 40 -70 82 -50 C 122 -30 130 6 120 30 Q 110 38 100 30 Q 90 40 80 30 Q 70 40 60 30 Q 50 40 40 30 Q 30 40 20 30 Q 10 40 0 30 Q -10 40 -20 30 Q -30 40 -40 30 Q -50 40 -60 30 Q -70 40 -80 30 Q -90 40 -100 30 Q -110 40 -120 30 Z';

const RM_CFG = {
  state: (el) => {
    const g = (n) => el.querySelector(`[data-p="${n}"]`);
    return {
      el: { old: g('old'), clipOld: g('clipold'), nb: g('new'), oc: g('oc'), obs: [...el.querySelectorAll('[data-p="ob"]')], cyte: g('cyte'), beam: g('beam'), panL: g('panL'), panR: g('panR'), gap: g('gap') },
      D: 0, F: 0, ocx: -620, ocA: 0, obA: 0, obY: -240, emb: 0, tilt: 0, loss: 0,
    };
  },
  render: (S) => {
    const E2 = S.el;
    const old = pitPath(S.D, 0, RM.bot);
    E2.old.setAttribute('d', old);
    E2.clipOld.setAttribute('d', old);
    // new bone: between the current surface and the carved pit floor
    E2.nb.setAttribute('d', pitPath(S.D, S.F * (1 - S.loss), (x) => surfY(x, S.D, 0)));
    E2.nb.setAttribute('opacity', S.F > 0.002 ? '1' : '0');
    const ocY = RM.top - 52 + S.D * 0.78;
    E2.oc.setAttribute('transform', `translate(${f1(RM.cx + S.ocx)} ${f1(ocY)})`);
    E2.oc.setAttribute('opacity', S.ocA.toFixed(3));
    E2.obs.forEach((o, i) => {
      const x = RM.cx + OB_X[i];
      const Fi = i === EMBED ? Math.min(S.F, 0.42 + 0.58 * (1 - S.emb)) : S.F * (1 - S.loss);
      const y = surfY(x, S.D, Fi) - 22 + S.obY + (i === EMBED ? 26 * S.emb : 0);
      o.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
      o.setAttribute('opacity', (S.obA * (i === EMBED ? 1 - S.emb : 1)).toFixed(3));
    });
    const cx = RM.cx + OB_X[EMBED];
    const cy = surfY(cx, S.D, Math.min(S.F, 0.42)) + 4;
    E2.cyte.setAttribute('transform', `translate(${f1(cx)} ${f1(cy)})`);
    E2.cyte.setAttribute('opacity', S.emb.toFixed(3));
    E2.beam.setAttribute('transform', `rotate(${S.tilt.toFixed(2)} 1580 316)`);
    const pan = (side) => {
      const a = (S.tilt * Math.PI) / 180;
      const dx = side * 190;
      return [1580 + dx * Math.cos(a), 316 + dx * Math.sin(a)];
    };
    const [lx, ly] = pan(-1);
    const [rx, ry] = pan(1);
    E2.panL.setAttribute('transform', `translate(${f1(lx)} ${f1(ly)})`);
    E2.panR.setAttribute('transform', `translate(${f1(rx)} ${f1(ry)})`);
    E2.gap.setAttribute('opacity', S.loss > 0 ? Math.min(1, S.loss * 4).toFixed(3) : '0');
  },
  beats: [
    (t, q, S) => {
      frameIn(t, q);
      fade(t, q('[data-a="strip"]'), 0.2, { d: 0.8 });
      rise(t, q('[data-a="lblL"]'), 0.5, { y: 18, stagger: 0.1 });
      fade(t, q('[data-a="tagY"]'), 0.6);
      t.fromTo(S, { ocA: 0, ocx: -620 }, { ocA: 1, ocx: 0, duration: 1.8, ease: 'power3.out' }, 0.6);
      t.fromTo(S, { D: 0 }, { D: RM.dmax, duration: 2.4, ease: 'power1.inOut' }, 2.0);
    },
    (t, q, S) => {
      t.fromTo(S, { ocx: 0, ocA: 1 }, { ocx: 560, ocA: 0, duration: 1.4, ease: 'power2.in' }, 0);
      rise(t, q('[data-a="lblR"]'), 0.3, { y: 18, stagger: 0.1 });
      t.fromTo(S, { obA: 0, obY: -240 }, { obA: 1, obY: 0, duration: 1.1, ease: 'back.out(1.4)' }, 0.5);
      t.fromTo(S, { F: 0 }, { F: 1, duration: 2.6, ease: 'power1.inOut' }, 1.4);
      t.fromTo(S, { emb: 0 }, { emb: 1, duration: 1, ease: 'power2.inOut' }, 2.4);
      rise(t, q('[data-a="lblC"]'), 3.0, { y: 12 });
    },
    (t, q, S) => {
      t.to(q('[data-a="tagY"]'), { autoAlpha: 0, duration: 0.4 }, 0);
      fade(t, q('[data-a="tagO"]'), 0.3);
      fade(t, q('[data-a="scale"]'), 0.1, { d: 0.6 });
      rise(t, q('[data-a="scaleL"]'), 0.3, { y: 10, stagger: 0.08 });
      t.fromTo(S, { tilt: 0 }, { tilt: -9, duration: 1.6, ease: 'elastic.out(1, 0.5)' }, 0.9);
      t.fromTo(S, { loss: 0 }, { loss: 0.36, duration: 1.8, ease: 'power2.inOut' }, 1.2);
      rise(t, q('[data-a="lossL"]'), 2.4, { y: 10 });
      wordsIn(t, q('[data-a="shift"] .cs-wi'), 1.6, { stagger: 0.03 });
    },
  ],
  ambient: ({ q, delay }) => {
    gsap.to(q('[data-a="nuc"]'), { y: -3, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.25, delay });
  },
};

export function RemodelSlide({ ctx, meta }) {
  const root = useSlide(ctx, RM_CFG);
  const id = `rm${meta.n}`;
  const lam = [680, 726, 772, 818, 864, 910];
  return (
    <div className="cs-stage s-rm" ref={root}>
      <Frame meta={meta} title="Bone is living tissue" />
      <div className="s-rm__lbl s-rm__lbl--l">
        <p className="s-rm__k" data-a="lblL"><span className="dot dot--risk" />Osteoclasts</p>
        <p className="s-rm__v" data-a="lblL">break down and resorb old bone</p>
      </div>
      <div className="s-rm__lbl s-rm__lbl--r">
        <p className="s-rm__k" data-a="lblR"><span className="dot dot--bone" />Osteoblasts</p>
        <p className="s-rm__v" data-a="lblR">lay down new bone</p>
      </div>
      <svg className="s-rm__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <clipPath id={`${id}c`}><path data-p="clipold" /></clipPath>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe4cf" />
            <stop offset="1" stopColor="#dccbab" />
          </linearGradient>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f6f3ee" />
            <stop offset="0.08" stopColor="#f6f3ee" stopOpacity="0" />
            <stop offset="0.92" stopColor="#f6f3ee" stopOpacity="0" />
            <stop offset="1" stopColor="#f6f3ee" />
          </linearGradient>
        </defs>
        <g data-a="strip">
          <rect x={RM.x0} y="476" width={RM.x1 - RM.x0} height={RM.top - 476} className="s-rm__marrow" />
          <path data-p="old" fill={`url(#${id}g)`} className="s-rm__old" />
          <g clipPath={`url(#${id}c)`}>
            {lam.map((y) => (
              <path key={y} className="s-rm__lam" d={`M ${RM.x0} ${y} C 500 ${y - 10} 800 ${y + 12} 1100 ${y - 4} S 1600 ${y + 8} ${RM.x1} ${y}`} />
            ))}
            {OCYTES.map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`} className="s-rm__ocyte">
                <path d="M -14 0 Q 0 -8 14 0 Q 0 8 -14 0 Z" />
                <path d="M -14 0 L -30 -8 M 14 0 L 30 6 M -4 -4 L -10 -20 M 4 4 L 10 20 M 8 -3 L 20 -16" className="s-rm__dend" />
              </g>
            ))}
          </g>
          <path data-p="new" className="s-rm__new" />
          <path data-p="gap" className="s-rm__gapline" d={`M ${RM.cx - RM.w / 2} ${RM.top} H ${RM.cx + RM.w / 2}`} />
          <rect x={RM.x0} y="460" width={RM.x1 - RM.x0} height="520" fill={`url(#${id}f)`} />
          <g data-p="cyte" className="s-rm__ocyte s-rm__ocyte--new">
            <path d="M -16 0 Q 0 -9 16 0 Q 0 9 -16 0 Z" />
            <path d="M -16 0 L -34 -10 M 16 0 L 34 8 M -4 -5 L -12 -24 M 4 5 L 12 24 M 9 -4 L 22 -18" className="s-rm__dend" />
          </g>
          {OB_X.map((x) => (
            <g key={x} data-p="ob" className="s-rm__ob">
              <rect x="-28" y="-22" width="56" height="44" rx="12" />
              <circle cx="0" cy="-2" r="8" className="s-rm__obn" />
            </g>
          ))}
          <g data-p="oc" className="s-rm__oc">
            <path d={OC_SHAPE} />
            {[-70, -24, 22, 66].map((x, i) => <ellipse key={x} cx={x} cy={-18 + (i % 2) * 10} rx="14" ry="10" className="s-rm__ocn" data-a="nuc" />)}
          </g>
        </g>
        <text x={RM.x0 + 24} y="512" className="s-rm__tag" data-a="tagY">YOUNGER ADULT</text>
        <text x={RM.x0 + 24} y="512" className="s-rm__tag s-rm__tag--o" data-a="tagO">OLDER ADULT</text>
        <g data-a="scale" className="s-rm__scale">
          <path d="M 1580 316 L 1556 364 H 1604 Z" className="s-rm__fulcrum" />
          <g data-p="beam"><path d="M 1390 316 H 1770" className="s-rm__beam" /></g>
          <g data-p="panL"><path d="M -54 0 L -40 34 H 40 L 54 0" className="s-rm__pan s-rm__pan--l" /></g>
          <g data-p="panR"><path d="M -54 0 L -40 34 H 40 L 54 0" className="s-rm__pan s-rm__pan--r" /></g>
        </g>
      </svg>
      <p className="s-rm__sl c-risk" data-a="scaleL">Resorption</p>
      <p className="s-rm__sr c-bone" data-a="scaleL">Formation</p>
      <p className="s-rm__loss t-micro c-risk" data-a="lossL">Net bone loss</p>
      <p className="s-rm__cyl t-small" data-a="lblC">Some osteoblasts are buried in new bone and become osteocytes</p>
      <p className="s-rm__shift" data-a="shift">
        <Words text="With age, resorption *outpaces* formation" />
      </p>
    </div>
  );
}
RemodelSlide.beats = RM_CFG.beats.length;

/* ── 6. Healthy → osteopenia → osteoporosis ──────────────────────────────── */

const LAT = buildLattice({ cx: 520, cy: 650, r: 318, step: 60, seed: 23, drop: 0.34, w: 13 });
const TS = { x0: 1010, x1: 1790, y: 760, min: -4, max: 1 };
const tsX = (v) => TS.x0 + ((TS.max - v) / (TS.max - TS.min)) * (TS.x1 - TS.x0);
const STAGES = [
  { name: 'Normal', def: 'Thick, well-connected struts', t: 0, cls: '' },
  { name: 'Osteopenia', def: 'Lower-than-normal bone mineral density', t: -1.8, cls: '' },
  { name: 'Osteoporosis', def: 'Much lower density and strength: a higher risk of fragility fracture', t: -3.1, cls: 'c-risk' },
];

const SP_CFG = {
  state: (el) => ({ lat: new Lattice(el.querySelector('[data-lat]'), LAT), s: 0, stub: 0, grow: 0, mk: 0 }),
  render: (S, el) => {
    S.lat.set(S.s, S.stub, S.grow);
    const m = el.querySelector('[data-p="marker"]');
    if (m) m.setAttribute('transform', `translate(${f1(tsX(S.mk))} 0)`);
  },
  beats: [
    (t, q, S) => {
      frameIn(t, q);
      draw(t, q('[data-a="lens"]'), 0.2, { d: 1.4 });
      t.fromTo(S, { grow: 0 }, { grow: 1, duration: 1.8, ease: 'power2.out' }, 0.5);
      fade(t, q('[data-a="lenscap"]'), 1.2);
      t.fromTo(q('[data-st="0"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: E.out }, 0.6);
      fade(t, q('[data-a="ts"]'), 1.0, { d: 0.6 });
      grow(t, q('[data-a="zone"]'), 1.1, { stagger: 0.12 });
      rise(t, q('[data-a="tslbl"]'), 1.3, { y: 8, stagger: 0.04 });
      t.fromTo(S, { mk: 1 }, { mk: 0, duration: 1, ease: 'power3.out' }, 1.6);
      pop(t, q('[data-p="marker"] [data-a="mk"]'), 1.6);
    },
    (t, q, S) => {
      t.to(q('[data-st="0"]'), { autoAlpha: 0, y: -20, duration: 0.5 }, 0);
      t.fromTo(q('[data-st="1"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: E.out }, 0.35);
      t.fromTo(S, { s: 0, mk: 0 }, { s: 1, mk: STAGES[1].t, duration: 2, ease: 'power2.inOut' }, 0.2);
    },
    (t, q, S) => {
      t.to(q('[data-st="1"]'), { autoAlpha: 0, y: -20, duration: 0.5 }, 0);
      t.fromTo(q('[data-st="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: E.out }, 0.35);
      t.fromTo(S, { s: 1, mk: STAGES[1].t }, { s: 2, mk: STAGES[2].t, duration: 2.2, ease: 'power2.inOut' }, 0.2);
    },
    (t, q, S) => {
      t.fromTo(S, { stub: 0 }, { stub: 1, duration: 1, ease: 'power2.out' }, 0.2);
      grow(t, q('[data-a="archrule"]'), 0, { d: 0.9 });
      wordsIn(t, q('[data-a="arch"] .cs-wi'), 0.2, { stagger: 0.035 });
      rise(t, q('[data-a="arch2"]'), 1.1, { y: 14 });
      fade(t, q('[data-a="stubkey"]'), 0.6);
    },
  ],
};

export function SpectrumSlide({ ctx, meta }) {
  const root = useSlide(ctx, SP_CFG);
  const id = `sp${meta.n}`;
  const ticks = [1, 0, -1, -2, -2.5, -3, -4];
  return (
    <div className="cs-stage s-sp" ref={root}>
      <Frame meta={meta} title="When loss outpaces formation" foot="T-score thresholds: World Health Organization. Lattice is a schematic, not histology." />
      <svg className="s-sp__lat" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <clipPath id={`${id}c`}><circle cx={LAT.cx} cy={LAT.cy} r={LAT.r} /></clipPath>
          <radialGradient id={`${id}g`} cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#fbf3e4" />
            <stop offset="1" stopColor="#efe2c9" />
          </radialGradient>
        </defs>
        <circle cx={LAT.cx} cy={LAT.cy} r={LAT.r} fill={`url(#${id}g)`} data-a="lensfill" />
        <g clipPath={`url(#${id}c)`} data-lat="" />
        <circle cx={LAT.cx} cy={LAT.cy} r={LAT.r} className="s-sp__lens" data-a="lens" />
        <circle cx={LAT.cx} cy={LAT.cy} r={LAT.r + 18} className="s-sp__lens2" data-a="lens" />
      </svg>
      <p className="t-micro s-sp__cap" data-a="lenscap">Trabecular (spongy) bone · schematic</p>
      {STAGES.map((s, i) => (
        <div className="s-sp__stage" data-st={i} key={s.name}>
          <p className={`s-sp__name ${s.cls}`}>{s.name}</p>
          <p className="s-sp__def">{s.def}</p>
        </div>
      ))}
      <svg className="s-sp__ts" width="1920" height="1080" viewBox="0 0 1920 1080" data-a="ts">
        <rect x={tsX(1)} y={TS.y - 26} width={tsX(-1) - tsX(1)} height="52" className="s-sp__z0" data-a="zone" />
        <rect x={tsX(-1)} y={TS.y - 26} width={tsX(-2.5) - tsX(-1)} height="52" className="s-sp__z1" data-a="zone" />
        <rect x={tsX(-2.5)} y={TS.y - 26} width={tsX(-4) - tsX(-2.5)} height="52" className="s-sp__z2" data-a="zone" />
        {ticks.map((v) => (
          <g key={v} data-a="tslbl">
            <path d={`M ${f1(tsX(v))} ${TS.y + 26} v 12`} className="s-sp__tick" />
            <text x={tsX(v)} y={TS.y + 66} className="s-sp__tickl" textAnchor="middle">{v > 0 ? `+${v}` : v === 0 ? '0' : `−${Math.abs(v)}`}</text>
          </g>
        ))}
        <text x={(tsX(1) + tsX(-1)) / 2} y={TS.y + 9} className="s-sp__zl" textAnchor="middle" data-a="tslbl">Normal</text>
        <text x={(tsX(-1) + tsX(-2.5)) / 2} y={TS.y + 9} className="s-sp__zl" textAnchor="middle" data-a="tslbl">Osteopenia</text>
        <text x={(tsX(-2.5) + tsX(-4)) / 2} y={TS.y + 9} className="s-sp__zl s-sp__zl--r" textAnchor="middle" data-a="tslbl">Osteoporosis</text>
        <text x={TS.x0} y={TS.y - 52} className="s-sp__axis" data-a="tslbl">BONE DENSITY · T-SCORE (DXA)</text>
        <g data-p="marker">
          <g data-a="mk">
            <path d={`M 0 ${TS.y - 34} L -14 ${TS.y - 58} H 14 Z`} className="s-sp__mk" />
            <path d={`M 0 ${TS.y - 30} V ${TS.y + 30}`} className="s-sp__mkline" />
          </g>
        </g>
      </svg>
      <span className="s-sp__archrule" data-a="archrule" />
      <p className="s-sp__arch" data-a="arch">
        <Words text="Density isn't everything: *architecture* and *quality* also set bone strength." />
      </p>
      <p className="s-sp__arch2 t-small" data-a="arch2">Mechanical loading can stimulate bone to adapt.</p>
      <p className="s-sp__stubkey t-micro" data-a="stubkey"><span className="dot dot--risk" />Lost connections</p>
    </div>
  );
}
SpectrumSlide.beats = SP_CFG.beats.length;

/* ── 7. Why this matters clinically ───────────────────────────────────────── */

const BODY = { cx: 470, head: 330 };
const LOOP = { cx: 1360, cy: 650, r: 236 };
const CYC = [
  { a: -90, label: 'Fall' },
  { a: -18, label: 'Fragility fracture' },
  { a: 54, label: 'Hospital stay' },
  { a: 126, label: 'Deconditioning, muscle loss' },
  { a: 198, label: 'Less strength & mobility' },
];
const onLoop = (deg, r = LOOP.r) => [LOOP.cx + r * Math.cos((deg * Math.PI) / 180), LOOP.cy + r * Math.sin((deg * Math.PI) / 180)];
const arc = (a0, a1, r = LOOP.r) => {
  const [x0, y0] = onLoop(a0, r);
  const [x1, y1] = onLoop(a1, r);
  return `M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}`;
};
const BREAKS = [
  { a: 234, cls: 'move', label: 'Strength + balance training', sub: 'fewer falls' },
  { a: -54, cls: 'bone', label: 'Resistance + impact loading', sub: 'stronger bone' },
];

const CL_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      fade(t, q('[data-a="body"]'), 0.2, { d: 0.8 });
      fade(t, q('[data-a="vert"]'), 0.6, { d: 0.3, stagger: 0.04 });
      q('[data-a="site"]').forEach((s, i) => {
        const at = 1.1 + i * 0.5;
        pop(t, s.querySelector('[data-a="ring"]'), at, { s: 0.2 });
        draw(t, s.querySelectorAll('[data-a="crack"]'), at + 0.1, { d: 0.4 });
        draw(t, s.querySelector('[data-a="lead"]'), at + 0.2, { d: 0.5 });
      });
      rise(t, q('[data-a="sitel"]'), 1.3, { y: 10, stagger: 0.5 });
    },
    (t, q) => {
      draw(t, q('[data-a="seg"]'), 0, { d: 0.6, stagger: 0.4, ease: 'power1.inOut' });
      pop(t, q('[data-a="cnode"]'), 0.05, { s: 0.2, stagger: 0.4 });
      rise(t, q('[data-a="clabel"]'), 0.15, { y: 10, stagger: 0.4 });
      fade(t, q('[data-a="arrowhead"]'), 0.5, { stagger: 0.4, d: 0.3 });
      fade(t, q('[data-a="core"]'), 2.2);
    },
    (t, q) => {
      q('[data-a="brk"]').forEach((b, i) => {
        const at = i * 0.8;
        t.fromTo(b.querySelector('[data-a="bar"]'), { scaleY: 0, transformOrigin: '50% 50%' }, { scaleY: 1, duration: 0.5, ease: 'back.out(3)' }, at);
        draw(t, b.querySelector('[data-a="blead"]'), at + 0.2, { d: 0.4 });
      });
      rise(t, q('[data-a="brkl"]'), 0.3, { y: 12, stagger: 0.8 });
      t.to(q('[data-a="seg"]'), { opacity: 0.35, duration: 0.6 }, 1.4);
      wordsIn(t, q('[data-a="both"] .cs-wi'), 1.6, { stagger: 0.03 });
    },
  ],
  ambient: ({ q, beat, delay }) => {
    if (beat < 1) {
      gsap.to(q('[data-a="ring"]'), { scale: 1.2, transformOrigin: '50% 50%', duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.3, delay });
      return;
    }
    const dot = q('[data-a="orbit"]')[0];
    if (!dot) return;
    gsap.set(dot, { autoAlpha: 1 });
    const o = { a: -90 };
    const stop = beat >= 2;
    const place = () => {
      const [x, y] = onLoop(o.a);
      dot.setAttribute('cx', f1(x));
      dot.setAttribute('cy', f1(y));
    };
    if (stop) {
      // the cycle runs up to the first break and stops there
      gsap.fromTo(o, { a: 126 }, { a: 228, duration: 2.2, ease: 'power2.out', onUpdate: place, delay, repeat: -1, repeatDelay: 1.2 });
    } else {
      gsap.to(o, { a: 270, duration: 6, ease: 'none', repeat: -1, onUpdate: place, delay });
    }
  },
};

export function ClinicalSlide({ ctx, meta }) {
  const root = useSlide(ctx, CL_CFG);
  const vert = Array.from({ length: 11 }, (_, i) => 412 + i * 22);
  const sites = [
    { key: 'vert', x: BODY.cx, y: 588, label: 'Vertebrae', lx: 680, ly: 520 },
    { key: 'hip', x: BODY.cx - 40, y: 676, label: 'Hip', lx: 680, ly: 680 },
    { key: 'wrist', x: BODY.cx - 124, y: 676, label: 'Wrist', lx: 200, ly: 800 },
  ];
  return (
    <div className="cs-stage s-cl" ref={root}>
      <Frame meta={meta} title="Why this matters clinically" />
      <svg className="s-cl__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <g data-a="body" className="s-cl__body">
          <circle cx={BODY.cx} cy={BODY.head} r="44" />
          <path d={`M ${BODY.cx} 400 V 640`} className="s-cl__torso" />
          <path d={`M ${BODY.cx - 54} 414 L ${BODY.cx - 96} 548 L ${BODY.cx - 124} 676`} className="s-cl__arm" />
          <path d={`M ${BODY.cx + 54} 414 L ${BODY.cx + 96} 548 L ${BODY.cx + 124} 676`} className="s-cl__arm" />
          <path d={`M ${BODY.cx - 34} 660 L ${BODY.cx - 44} 820 L ${BODY.cx - 46} 980`} className="s-cl__leg" />
          <path d={`M ${BODY.cx + 34} 660 L ${BODY.cx + 44} 820 L ${BODY.cx + 46} 980`} className="s-cl__leg" />
        </g>
        {vert.map((y, i) => (
          <rect key={y} x={BODY.cx - 15} y={y} width="30" height={i === 8 ? 12 : 17} rx="4" className={`s-cl__vert${i === 8 ? ' is-hit' : ''}`} data-a="vert" />
        ))}
        <g className="s-cl__femur" data-a="vert">
          <circle cx={BODY.cx - 40} cy="664" r="13" />
          <path d={`M ${BODY.cx - 34} 670 L ${BODY.cx - 22} 684`} />
        </g>
        {sites.map((s) => (
          <g key={s.key} data-a="site">
            <circle cx={s.x} cy={s.y} r="30" className="s-cl__ring" data-a="ring" />
            <path d={`M ${s.x - 9} ${s.y - 12} L ${s.x + 4} ${s.y - 3} L ${s.x - 5} ${s.y + 4} L ${s.x + 8} ${s.y + 13}`} className="s-cl__crack" data-a="crack" />
            <path d={s.lx > s.x ? `M ${s.x + 32} ${s.y} L ${s.lx - 16} ${s.ly - 10}` : `M ${s.x - 22} ${s.y + 24} L ${s.lx + 70} ${s.ly - 34}`} className="sv-leader" data-a="lead" />
          </g>
        ))}

        <circle cx={LOOP.cx} cy={LOOP.cy} r={LOOP.r} className="s-cl__loopghost" />
        {CYC.map((c, i) => {
          const a0 = c.a + 7;
          const a1 = CYC[(i + 1) % CYC.length].a + (i === CYC.length - 1 ? 360 : 0) - 7;
          const [hx, hy] = onLoop(a1);
          const ang = a1 + 90;
          return (
            <g key={c.label}>
              <path d={arc(a0, a1)} className="s-cl__seg" data-a="seg" />
              <path d="M -10 -8 L 3 0 L -10 8" className="s-cl__head" data-a="arrowhead" transform={`translate(${f1(hx)} ${f1(hy)}) rotate(${f1(ang)})`} />
            </g>
          );
        })}
        {CYC.map((c) => {
          const [x, y] = onLoop(c.a);
          return <circle key={c.label} cx={f1(x)} cy={f1(y)} r="13" className={`s-cl__node${c.a === -18 ? ' is-risk' : ''}`} data-a="cnode" />;
        })}
        <circle r="10" className="s-cl__orbit" data-a="orbit" cx={onLoop(-90)[0]} cy={onLoop(-90)[1]} />
        {BREAKS.map((b) => {
          const [x0, y0] = onLoop(b.a, LOOP.r - 34);
          const [x1, y1] = onLoop(b.a, LOOP.r + 34);
          const [lx, ly] = onLoop(b.a, LOOP.r + 86);
          return (
            <g key={b.label} data-a="brk" className={`s-cl__brk s-cl__brk--${b.cls}`}>
              <path d={`M ${f1(x0)} ${f1(y0)} L ${f1(x1)} ${f1(y1)}`} data-a="bar" />
              <path d={`M ${f1(x1)} ${f1(y1)} L ${f1(lx)} ${f1(ly)}`} className="s-cl__blead" data-a="blead" />
            </g>
          );
        })}
      </svg>
      {sites.map((s) => (
        <p key={s.key} className="t-label s-cl__sitel" style={{ left: s.lx, top: s.ly - 30 }} data-a="sitel">{s.label}</p>
      ))}
      <p className="t-micro s-cl__sitecap" data-a="sitel">Common fragility-fracture sites</p>
      {CYC.map((c) => {
        const [x, y] = onLoop(c.a, LOOP.r + 40);
        const right = Math.cos((c.a * Math.PI) / 180) > 0.2;
        const left = Math.cos((c.a * Math.PI) / 180) < -0.2;
        const style = { top: y - 20, ...(right ? { left: x } : left ? { right: 1920 - x } : { left: x - 160, width: 320, textAlign: 'center' }) };
        if (c.a === -90) style.top = y - 56;
        return <p key={c.label} className="t-label s-cl__clabel" style={style} data-a="clabel">{c.label}</p>;
      })}
      <p className="t-micro s-cl__core" data-a="core" style={{ left: LOOP.cx - 150, top: LOOP.cy - 12 }}>The cycle</p>
      {BREAKS.map((b) => {
        const [lx, ly] = onLoop(b.a, LOOP.r + 96);
        const right = lx > LOOP.cx;
        return (
          <div key={b.label} className={`s-cl__brkl c-${b.cls}`} style={right ? { left: lx, top: ly - 36 } : { right: 1920 - lx, top: ly - 36, textAlign: 'right' }} data-a="brkl">
            <p className="s-cl__brkk">{b.label}</p>
            <p className="s-cl__brkv">→ {b.sub}</p>
          </div>
        );
      })}
      <p className="s-cl__both" data-a="both">
        <Words text="Address *both* sides of the problem" />
      </p>
    </div>
  );
}
ClinicalSlide.beats = CL_CFG.beats.length;
