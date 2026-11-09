import { Frame, Words } from '../engine/Words';
import { E, draw, fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';
import { POSES, Rig, sitOn } from '../art/rig';
import { mulberry32 } from '../art/lattice';

/* ============================================================================
   CHAPTER 5 — EVIDENCE & IDEAS: mechanotransduction, the two meta-analyses
   (numbers checked against the abstracts, see notes.js), the two levers
   against fragility fracture, and what GER360 could add.
   ========================================================================== */

const f1 = (v) => v.toFixed(1);

/* ── 15. Bone responds to load ────────────────────────────────────────────── */

const BLK = { x: 150, y: 340, w: 330, h: 580 };
const NET = (() => {
  const rnd = mulberry32(7);
  const pts = [];
  let guard = 0;
  while (pts.length < 26 && guard++ < 4000) {
    const p = [BLK.x + 34 + rnd() * (BLK.w - 68), BLK.y + 34 + rnd() * (BLK.h - 68)];
    if (pts.every((o) => Math.hypot(o[0] - p[0], o[1] - p[1]) > 74)) pts.push(p);
  }
  const edges = [];
  const seen = new Set();
  pts.forEach((p, i) => {
    const near = pts.map((o, j) => [j, Math.hypot(o[0] - p[0], o[1] - p[1])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
    near.forEach(([j]) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    });
  });
  // breadth-first depth from the top (where the load arrives)
  const depth = pts.map(() => Infinity);
  const queue = pts.map((p, i) => [i, p[1]]).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([i]) => i);
  queue.forEach((i) => { depth[i] = 0; });
  while (queue.length) {
    const i = queue.shift();
    edges.forEach(([a, b]) => {
      const j = a === i ? b : b === i ? a : -1;
      if (j >= 0 && depth[j] === Infinity) {
        depth[j] = depth[i] + 1;
        queue.push(j);
      }
    });
  }
  return { pts, edges, depth: depth.map((d) => (d === Infinity ? 6 : d)) };
})();
const MAXD = Math.max(...NET.depth);
const OBL = Array.from({ length: 7 }, (_, i) => BLK.y + 50 + i * 80);
const STEPS = [
  'Load passes through the bone',
  'Osteocytes sense the strain',
  'They signal the remodelling process',
  'Osteoblasts add bone where it is loaded',
];

const MC_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      fade(t, q('[data-a="blk"]'), 0.2, { d: 0.7 });
      fade(t, q('[data-a="dend"]'), 0.5, { d: 0.6 });
      pop(t, q('[data-a="cyte"]'), 0.5, { s: 0.3, stagger: 0.02, d: 0.4 });
      // 1 load
      t.fromTo(q('[data-a="load"]'), { autoAlpha: 0, y: -80 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'back.out(2)' }, 1.0);
      t.fromTo(q('[data-a="squash"]'), { scaleY: 1 }, { scaleY: 0.985, transformOrigin: '50% 100%', duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 1.7);
      t.fromTo(q('[data-a="wave"]'), { y: -60, autoAlpha: 0.9 }, { y: BLK.h + 40, autoAlpha: 0.2, duration: 1.6, ease: 'power1.in', stagger: 0.25 }, 1.7);
      // 2 osteocytes light up in order of depth
      q('[data-a="cyte"]').forEach((c, i) => {
        t.fromTo(c, { fill: '#8c7b5c' }, { fill: '#0072b2', duration: 0.35 }, 2.0 + (NET.depth[i] / MAXD) * 1.4);
      });
      q('[data-a="dend"]').forEach((d, i) => {
        const [a, b] = NET.edges[i];
        t.fromTo(d, { stroke: '#a8987a' }, { stroke: '#7fb0d6', duration: 0.35 }, 2.1 + (Math.min(NET.depth[a], NET.depth[b]) / MAXD) * 1.4);
      });
      // 3 signal reaches the surface: osteoblasts glow
      pop(t, q('[data-a="obl"]'), 3.5, { s: 0.2, stagger: 0.06 });
      // 4 new bone on the loaded surface
      t.fromTo(q('[data-a="newlayer"]'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.2, ease: 'power2.out' }, 4.2);
      q('[data-a="step"]').forEach((s, i) => {
        const at = [1.0, 2.0, 3.3, 4.2][i];
        rise(t, s.querySelectorAll('[data-a="stxt"]'), at, { y: 12, stagger: 0.06 });
        pop(t, q(`[data-a="tag${i + 1}"]`), at, { s: 0.3 });
      });
    },
    (t, q) => {
      q('[data-a="kind"]').forEach((k, i) => {
        const at = i * 0.9;
        grow(t, k.querySelector('[data-a="krule"]'), at, { d: 0.8 });
        rise(t, k.querySelectorAll('[data-a="ktxt"]'), at + 0.1, { y: 14, stagger: 0.08 });
      });
      fade(t, q('[data-a="kviz"]'), 0.3, { d: 0.6 });
      fade(t, q('[data-a="kviz2"]'), 1.1, { d: 0.4 });
      draw(t, q('[data-a="kline2"]'), 1.3, { d: 1.2, stagger: 0.35 });
      fade(t, q('[data-a="legend"]'), 1.8);
    },
  ],
  ambient: ({ q, beat, delay }) => {
    gsap.fromTo(q('[data-a="wave"]'), { y: -60, autoAlpha: 0.8 }, { y: BLK.h + 40, autoAlpha: 0.1, duration: 2.2, ease: 'power1.in', stagger: 0.35, repeat: -1, repeatDelay: 1.2, delay });
    gsap.fromTo(q('[data-a="load"]'), { y: 0 }, { y: 10, duration: 0.3, yoyo: true, repeat: -1, repeatDelay: 2.9, ease: 'power2.in', delay });
    if (beat >= 1) {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay });
      tl.to(q('[data-a="muscle"]'), { scaleX: 0.86, scaleY: 1.28, svgOrigin: '1420 462', duration: 0.6, ease: 'power2.inOut' })
        .to(q('[data-a="pull"]'), { autoAlpha: 1, duration: 0.2 }, '<0.2')
        .to(q('[data-a="muscle"]'), { scaleX: 1, scaleY: 1, svgOrigin: '1420 462', duration: 0.8, ease: 'power2.inOut' }, '+=0.5')
        .to(q('[data-a="pull"]'), { autoAlpha: 0.25, duration: 0.3 }, '<');
    }
  },
};

export function MechanismSlide({ ctx, meta }) {
  const root = useSlide(ctx, MC_CFG);
  const id = `mc${meta.n}`;
  return (
    <div className="cs-stage s-mc" ref={root}>
      <Frame meta={meta} title="Bone responds to load" />
      <svg className="s-mc__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <clipPath id={`${id}c`}><rect x={BLK.x} y={BLK.y} width={BLK.w} height={BLK.h} rx="18" /></clipPath>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e7d9be" />
            <stop offset="0.5" stopColor="#f2e8d6" />
            <stop offset="1" stopColor="#e2d2b2" />
          </linearGradient>
          <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0072b2" stopOpacity="0" />
            <stop offset="0.5" stopColor="#0072b2" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0072b2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g data-a="squash">
          <g data-a="blk">
            <rect x={BLK.x} y={BLK.y} width={BLK.w} height={BLK.h} rx="18" fill={`url(#${id}g)`} className="s-mc__blk" />
            <g clipPath={`url(#${id}c)`}>
              {Array.from({ length: 9 }, (_, i) => BLK.x + 20 + i * 36).map((x) => (
                <path key={x} d={`M ${x} ${BLK.y} C ${x + 8} ${BLK.y + 200} ${x - 8} ${BLK.y + 400} ${x} ${BLK.y + BLK.h}`} className="s-mc__lam" />
              ))}
              {[0, 1, 2].map((k) => <rect key={k} x={BLK.x} y={BLK.y} width={BLK.w} height="120" fill={`url(#${id}w)`} data-a="wave" />)}
            </g>
          </g>
          {NET.edges.map(([a, b], i) => (
            <path key={i} d={`M ${f1(NET.pts[a][0])} ${f1(NET.pts[a][1])} L ${f1(NET.pts[b][0])} ${f1(NET.pts[b][1])}`} className="s-mc__dend" data-a="dend" />
          ))}
          {NET.pts.map(([x, y], i) => (
            <ellipse key={i} cx={f1(x)} cy={f1(y)} rx="13" ry="8" className="s-mc__cyte" data-a="cyte" />
          ))}
        </g>
        <rect x={BLK.x + BLK.w} y={BLK.y + 30} width="26" height={BLK.h - 60} rx="8" className="s-mc__new" data-a="newlayer" />
        {OBL.map((y) => <rect key={y} x={BLK.x + BLK.w + 30} y={y} width="30" height="30" rx="8" className="s-mc__obl" data-a="obl" />)}
        <g data-a="load" className="s-mc__load">
          <path d={`M ${BLK.x + BLK.w / 2} 236 V 316 M ${BLK.x + BLK.w / 2 - 22} 292 L ${BLK.x + BLK.w / 2} 318 L ${BLK.x + BLK.w / 2 + 22} 292`} />
        </g>
        <text x={BLK.x + BLK.w / 2 + 40} y="276" className="s-mc__tag" data-a="tag1">1</text>
        <text x={BLK.x - 44} y="560" className="s-mc__tag" data-a="tag2">2</text>
        <text x={BLK.x - 44} y="700" className="s-mc__tag" data-a="tag3">3</text>
        <text x={BLK.x + BLK.w + 74} y="880" className="s-mc__tag" data-a="tag4">4</text>

        <g data-a="kviz">
          <rect x="1200" y="500" width="440" height="36" rx="18" className="s-mc__bone" />
          <g data-a="muscle"><ellipse cx="1420" cy="462" rx="150" ry="34" className="s-mc__muscle" /></g>
          <path d="M 1270 462 L 1236 500 M 1570 462 L 1604 500" className="s-mc__tendon" />
          <g data-a="pull" className="s-mc__pull" opacity="0.25">
            <path d="M 1226 560 H 1266 M 1254 550 L 1268 560 L 1254 570" />
            <path d="M 1614 560 H 1574 M 1586 550 L 1572 560 L 1586 570" />
          </g>
        </g>
        <g className="s-mc__chart" data-a="kviz2">
          <path d="M 1200 960 H 1640 M 1200 960 V 780" className="s-mc__axis" />
          <path d="M 1210 960 C 1250 960 1250 912 1290 912 C 1320 912 1320 928 1340 928 C 1360 928 1370 914 1400 914 C 1440 914 1450 960 1480 960 H 1640" className="s-mc__walk" data-a="kline2" />
          <path d="M 1210 960 H 1478 C 1490 960 1494 800 1504 800 C 1514 800 1518 960 1530 960 H 1640" className="s-mc__impact" data-a="kline2" />
          <text x="1640" y="990" textAnchor="end" className="s-mc__ax">time →</text>
          <text x="1190" y="796" textAnchor="end" className="s-mc__ax">force</text>
        </g>
      </svg>
      {STEPS.map((s, i) => (
        <div className="s-mc__step" key={s} style={{ top: 350 + i * 150 }} data-a="step">
          <p className="s-mc__sn t-mono" data-a="stxt">{i + 1}</p>
          <p className="s-mc__st" data-a="stxt">{s}</p>
        </div>
      ))}
      <div className="s-mc__kind" style={{ top: 268 }} data-a="kind">
        <span className="s-mc__krule" data-a="krule" />
        <p className="s-mc__kh c-bone" data-a="ktxt">Progressive resistance training</p>
        <p className="s-mc__kt" data-a="ktxt">Contracting muscles pull on bone. Increasing the resistance over time drives adaptation.</p>
      </div>
      <div className="s-mc__kind" style={{ top: 604 }} data-a="kind">
        <span className="s-mc__krule" data-a="krule" />
        <p className="s-mc__kh c-bone" data-a="ktxt">Weight-bearing impact</p>
        <p className="s-mc__kt" data-a="ktxt">Rapid forces through the skeleton: stamping, heel drops, and hopping or jumping in selected people.</p>
      </div>
      <p className="s-mc__legend t-small" data-a="legend"><span className="s-mc__lw" />walking <span className="s-mc__li" />heel drop / stamp <span className="t-mono">(schematic)</span></p>
    </div>
  );
}
MechanismSlide.beats = MC_CFG.beats.length;

/* ── 16. Evidence: a forest plot ──────────────────────────────────────────── */

const SX = (v) => 600 + ((v + 0.2) / 1.8) * 560;
const ROWS_E = [
  { y: 404, label: 'Muscle strength', est: 1.10, lo: 0.73, hi: 1.47, sig: true, who: 0 },
  { y: 594, label: 'Bone health, overall', est: 0.15, lo: 0.05, hi: 0.25, sig: true, who: 1 },
  { y: 664, label: 'Lumbar spine BMD', est: 0.17, lo: 0.04, hi: 0.30, sig: true, who: 1 },
  { y: 734, label: 'Femoral neck BMD', est: 0.09, lo: -0.03, hi: 0.21, sig: false, who: 1 },
];
const PX2 = (v) => 1330 + ((v + 2) / 8) * 460;
const ROWS_P = [
  { y: 474, label: 'Femur / hip', est: 2.77, lo: 0.44, hi: 5.10, sig: true },
  { y: 580, label: 'Lumbar spine', est: 1.60, lo: -1.44, hi: 4.63, sig: false },
];
const fmt = (v, d = 2) => (v < 0 ? `−${Math.abs(v).toFixed(d)}` : v.toFixed(d));

const signed = (v, unit) => (unit === '%' && v > 0 ? `+${fmt(v)}` : fmt(v));

function CIRow({ r, X, unit = '', above = false }) {
  return (
    <g data-a="ci">
      <path d={`M ${f1(X(r.lo))} ${r.y} H ${f1(X(r.hi))}`} className="s-ev__ci" data-a="ciline" />
      <path d={`M ${f1(X(r.lo))} ${r.y - 10} v 20 M ${f1(X(r.hi))} ${r.y - 10} v 20`} className="s-ev__ci" data-a="cicap" />
      <rect x={f1(X(r.est) - 11)} y={r.y - 11} width="22" height="22" className={`s-ev__pt${r.sig ? '' : ' is-ns'}`} data-a="pt" />
      {above ? (
        <text x={f1(X(r.est))} y={r.y - 24} textAnchor="middle" className="s-ev__val" data-a="val">{signed(r.est, unit)}{unit}{r.sig ? '' : ' · n.s.'}</text>
      ) : (
        <text x={f1(X(r.hi) + 18)} y={r.y + 7} className="s-ev__val" data-a="val">{signed(r.est, unit)}{unit}{r.sig ? '' : ' · n.s.'}</text>
      )}
    </g>
  );
}

function evRows(t, q, who, base) {
  q(`svg [data-who="${who}"]`).forEach((g, i) => {
    const at = base + i * 0.3;
    t.fromTo(g.querySelectorAll('[data-a="ciline"]'), { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: 0.8, ease: E.out }, at + 0.3);
    fade(t, g.querySelectorAll('[data-a="cicap"]'), at + 0.8, { d: 0.3 });
    pop(t, g.querySelectorAll('[data-a="pt"]'), at + 0.3, { s: 0.2 });
    fade(t, g.querySelectorAll('[data-a="val"]'), at + 0.9);
  });
  rise(t, q(`div[data-who="${who}"] [data-a="lbl"]`), base, { y: 10, stagger: 0.08 });
}

const EV_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      draw(t, q('[data-a="axis"]'), 0.2, { d: 0.8 });
      fade(t, q('[data-a="tick"]'), 0.4, { stagger: 0.04 });
      fade(t, q('[data-a="ref"]'), 0.6, { stagger: 0.1 });
      evRows(t, q, 0, 0.8);
      draw(t, q('[data-a="paxis"]'), 1.0, { d: 0.8 });
      fade(t, q('[data-a="ptick"]'), 1.2, { stagger: 0.04 });
    },
    (t, q) => {
      evRows(t, q, 1, 0);
    },
    (t, q) => {
      grow(t, q('[data-a="takerule"]'), 0, { d: 0.8 });
      wordsIn(t, q('[data-a="take"] .cs-wi'), 0.15, { stagger: 0.03 });
      rise(t, q('[data-a="take2"]'), 0.9, { y: 10 });
    },
  ],
};

export function EvidenceSlide({ ctx, meta }) {
  const root = useSlide(ctx, EV_CFG);
  return (
    <div className="cs-stage s-ev" ref={root}>
      <Frame meta={meta} title="What the evidence says" foot="O'Bryan et al. (2022), Sports Medicine · Pinheiro et al. (2020), IJBNPA. Points = estimate; lines = 95% confidence interval; n.s. = not significant." />
      <svg className="s-ev__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        {[0.2, 0.5, 0.8].map((v, i) => (
          <g key={v} data-a="ref">
            <path d={`M ${f1(SX(v))} 352 V 780`} className="s-ev__ref" />
            <text x={f1(SX(v))} y="862" textAnchor="middle" className="s-ev__refl">{['small', 'medium', 'large'][i]}</text>
          </g>
        ))}
        <path d={`M ${f1(SX(0))} 352 V 780`} className="s-ev__zero" data-a="axis" />
        <path d={`M ${f1(SX(-0.2))} 790 H ${f1(SX(1.6))}`} className="s-ev__axis" data-a="axis" />
        {[0, 0.2, 0.5, 0.8, 1.0, 1.5].map((v) => (
          <g key={v} data-a="tick">
            <path d={`M ${f1(SX(v))} 790 v 10`} className="s-ev__axis" />
            <text x={f1(SX(v))} y="830" textAnchor="middle" className="s-ev__tl">{v.toFixed(1)}</text>
          </g>
        ))}
        <text x={f1(SX(-0.2))} y="896" className="s-ev__axl" data-a="tick">SMD · dashed = Cohen&apos;s benchmarks</text>
        {ROWS_E.map((r) => (
          <g key={r.label} data-who={r.who}><CIRow r={r} X={SX} /></g>
        ))}

        <path d={`M ${f1(PX2(0))} 420 V 604`} className="s-ev__zero" data-a="paxis" />
        <path d={`M ${f1(PX2(-2))} 610 H ${f1(PX2(6))}`} className="s-ev__axis" data-a="paxis" />
        {[-2, 0, 2, 4, 6].map((v) => (
          <g key={v} data-a="ptick">
            <path d={`M ${f1(PX2(v))} 610 v 10`} className="s-ev__axis" />
            <text x={f1(PX2(v))} y="650" textAnchor="middle" className="s-ev__tl">{v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0'}%</text>
          </g>
        ))}
        {ROWS_P.map((r) => (
          <g key={r.label} data-who="0"><CIRow r={r} X={PX2} unit="%" above /></g>
        ))}
      </svg>
      <div data-who="0">
        <p className="t-micro s-ev__study" style={{ top: 300 }} data-a="lbl"><span className="dot dot--bone" />O&apos;Bryan et al. 2022 · resistance training · 14 studies, 1,130 people</p>
        <p className="s-ev__rl" style={{ top: ROWS_E[0].y - 20 }} data-a="lbl">{ROWS_E[0].label}</p>
        <p className="t-micro s-ev__pstudy" data-a="lbl">Same review: bone density change</p>
        {ROWS_P.map((r) => <p key={r.label} className="s-ev__prl" style={{ top: r.y - 64 }} data-a="lbl">{r.label}</p>)}
      </div>
      <div data-who="1">
        <p className="t-micro s-ev__study" style={{ top: 490 }} data-a="lbl"><span className="dot dot--ink" />Pinheiro et al. 2020 · activity, 65+ · 37 controlled trials, 20 pooled</p>
        {ROWS_E.slice(1).map((r) => <p key={r.label} className="s-ev__rl" style={{ top: r.y - 20 }} data-a="lbl">{r.label}</p>)}
      </div>
      <span className="s-ev__takerule" data-a="takerule" />
      <p className="s-ev__take" data-a="take">
        <Words text="Large gains in *strength;* small, site-dependent gains in *bone.*" />
      </p>
      <p className="t-small s-ev__take2" data-a="take2">Bone effects of 0.15 to 0.17 sit below Cohen&apos;s &quot;small&quot; benchmark, but they are statistically significant.</p>
    </div>
  );
}
EvidenceSlide.beats = EV_CFG.beats.length;

/* ── 17. Two levers ───────────────────────────────────────────────────────── */

const LV = { x: 300, y: 900, W: 800, H: 540 };

const LV_CFG = {
  state: (el) => ({ el, w: 0, h: 0 }),
  render: (S) => {
    const r = S.el.querySelector('[data-p="risk"]');
    if (!r) return;
    const w = LV.W * S.w;
    const h = LV.H * S.h;
    r.setAttribute('width', f1(Math.max(0, w)));
    r.setAttribute('height', f1(Math.max(0, h)));
    r.setAttribute('y', f1(LV.y - h));
    const lbl = S.el.querySelector('[data-p="rlbl"]');
    if (lbl) lbl.setAttribute('transform', `translate(${f1(LV.x + w / 2)} ${f1(LV.y - h / 2)})`);
    const ar = S.el.querySelector('[data-p="armove"]');
    if (ar) ar.setAttribute('transform', `translate(${f1(LV.x + w)} ${f1(LV.y - h / 2)})`);
    const ab = S.el.querySelector('[data-p="arbone"]');
    if (ab) ab.setAttribute('transform', `translate(${f1(LV.x + w / 2)} ${f1(LV.y - h)})`);
  },
  beats: [
    (t, q, S) => {
      frameIn(t, q);
      draw(t, q('[data-a="ax"]'), 0.2, { d: 0.9, stagger: 0.15 });
      rise(t, q('[data-a="axl"]'), 0.6, { y: 10, stagger: 0.1 });
      t.fromTo(S, { w: 0, h: 0 }, { w: 1, h: 1, duration: 1.4, ease: 'power3.inOut' }, 0.7);
      fade(t, q('[data-p="rlbl"]'), 1.6);
      grow(t, q('[data-a="r0rule"]'), 0.4, { d: 0.8 });
      rise(t, q('[data-a="r0"]'), 0.5, { y: 12, stagger: 0.1 });
    },
    (t, q, S) => {
      fade(t, q('[data-a="ghost"]'), 0, { d: 0.3 });
      fade(t, q('[data-p="armove"]'), 0.1, { d: 0.3 });
      t.fromTo(S, { w: 1 }, { w: 0.52, duration: 1.6, ease: 'power3.inOut' }, 0.3);
      grow(t, q('[data-a="r1rule"]'), 0.2, { d: 0.8 });
      rise(t, q('[data-a="r1"]'), 0.3, { y: 12, stagger: 0.1 });
    },
    (t, q, S) => {
      fade(t, q('[data-p="arbone"]'), 0, { d: 0.3 });
      t.fromTo(S, { h: 1 }, { h: 0.56, duration: 1.6, ease: 'power3.inOut' }, 0.2);
      grow(t, q('[data-a="r2rule"]'), 0.1, { d: 0.8 });
      rise(t, q('[data-a="r2"]'), 0.2, { y: 12, stagger: 0.1 });
      wordsIn(t, q('[data-a="both"] .cs-wi'), 1.4, { stagger: 0.04 });
    },
  ],
};

export function LeversSlide({ ctx, meta }) {
  const root = useSlide(ctx, LV_CFG);
  return (
    <div className="cs-stage s-lv" ref={root}>
      <Frame meta={meta} title="Two ways to prevent a fragility fracture" foot="A conceptual picture, not a risk model." />
      <svg className="s-lv__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <rect x={LV.x} y={LV.y - LV.H} width={LV.W} height={LV.H} className="s-lv__ghost" data-a="ghost" />
        <rect x={LV.x} y={LV.y - LV.H} width={LV.W} height={LV.H} className="s-lv__risk" data-p="risk" />
        <g data-p="rlbl" className="s-lv__rlbl">
          <text textAnchor="middle" y="-6" className="s-lv__rt">Fracture</text>
          <text textAnchor="middle" y="40" className="s-lv__rt">risk</text>
        </g>
        <path d={`M ${LV.x} ${LV.y} H ${LV.x + LV.W + 60} M ${LV.x + LV.W + 44} ${LV.y - 12} L ${LV.x + LV.W + 62} ${LV.y} L ${LV.x + LV.W + 44} ${LV.y + 12}`} className="s-lv__ax" data-a="ax" />
        <path d={`M ${LV.x} ${LV.y} V ${LV.y - LV.H - 60} M ${LV.x - 12} ${LV.y - LV.H - 44} L ${LV.x} ${LV.y - LV.H - 62} L ${LV.x + 12} ${LV.y - LV.H - 44}`} className="s-lv__ax" data-a="ax" />
        <g data-p="armove" className="s-lv__push s-lv__push--move">
          <path d="M 70 0 H 14 M 30 -16 L 12 0 L 30 16" />
        </g>
        <g data-p="arbone" className="s-lv__push s-lv__push--bone">
          <path d="M 0 -70 V -14 M -16 -30 L 0 -12 L 16 -30" />
        </g>
      </svg>
      <p className="s-lv__axl s-lv__axl--x" data-a="axl">Chance of a fall →</p>
      <p className="s-lv__axl s-lv__axl--y" data-a="axl">Bone fragility →</p>
      <span className="s-lv__rule" style={{ top: 300 }} data-a="r0rule" />
      <p className="s-lv__h" style={{ top: 318 }} data-a="r0">Most fragility fractures need two things</p>
      <p className="s-lv__t" style={{ top: 366 }} data-a="r0">a fall, and a bone that can&apos;t tolerate it. (Vertebral fractures often happen without a fall.)</p>
      <span className="s-lv__rule" style={{ top: 480 }} data-a="r1rule" />
      <p className="s-lv__h c-move" style={{ top: 498 }} data-a="r1">Strength + balance training</p>
      <p className="s-lv__t" style={{ top: 546 }} data-a="r1">Fewer falls. Balance work doesn&apos;t load bone much, but it is essential for reducing falls risk.</p>
      <span className="s-lv__rule" style={{ top: 690 }} data-a="r2rule" />
      <p className="s-lv__h c-bone" style={{ top: 708 }} data-a="r2">Resistance + impact loading</p>
      <p className="s-lv__t" style={{ top: 756 }} data-a="r2">Stronger bone that better tolerates a fall.</p>
      <p className="s-lv__both" data-a="both">
        <Words text="Together, they address *both* contributors." />
      </p>
    </div>
  );
}
LeversSlide.beats = LV_CFG.beats.length;

/* ── 18. What could we add ────────────────────────────────────────────────── */

const SEAT_A = 766;
const A_BASE = sitOn({ ...POSES.sit, x: 830, g: 930, u: 14, f: 40 }, SEAT_A);
const B_BASE = { ...POSES.stand, x: 0, g: 0, u: 4, f: 6, t2: 0, s2: 0 };
const LEFT_EX = ['Seated abdominal bracing', 'Seated pelvic tilts', 'Seated forward reaching (hinge at the hips, long spine)', 'Sitting tall: back extension, shoulder-blade squeezes'];
const RIGHT_EX = ['Heel raises, progressing to heel drops', 'Controlled foot stamping', 'Purposeful stepping'];

const AD_CFG = {
  state: (el) => ({
    el,
    a: (() => {
      const r = new Rig(el.querySelector('[data-rig="a"]'));
      Object.values(r.band).forEach((b) => b.classList.add('is-move'));
      return r;
    })(),
    b: new Rig(el.querySelector('[data-rig="b"]')),
    pa: { ...A_BASE },
    pb: { ...B_BASE },
    figA: 0,
    figB: 0,
    rip: 0,
  }),
  render: (S) => {
    const JA = S.a.set(S.pa);
    S.b.set(S.pb);
    S.a.g.style.opacity = String(S.figA);
    S.b.g.style.opacity = String(S.figB);
    const brace = S.el.querySelector('[data-p="brace"]');
    if (brace) {
      const x = JA.hip[0] + (JA.shoulder[0] - JA.hip[0]) * 0.4 + 70;
      const y = JA.hip[1] + (JA.shoulder[1] - JA.hip[1]) * 0.4;
      brace.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
    }
  },
  beats: [
    (t, q, S) => {
      frameIn(t, q);
      grow(t, q('[data-a="arule"]'), 0.3, { d: 0.9 });
      rise(t, q('[data-a="ah"]'), 0.4, { y: 14, stagger: 0.08 });
      fade(t, q('[data-a="seat"]'), 0.5, { d: 0.5 });
      t.fromTo(S, { figA: 0 }, { figA: 1, duration: 0.6 }, 0.5);
      rise(t, q('[data-a="aex"]'), 0.8, { y: 12, stagger: 0.12 });
      rise(t, q('[data-a="aben"]'), 1.4, { y: 10 });
    },
    (t, q, S) => {
      grow(t, q('[data-a="brule"]'), 0, { d: 0.9 });
      rise(t, q('[data-a="bh"]'), 0.1, { y: 14, stagger: 0.08 });
      t.fromTo(S, { figB: 0 }, { figB: 1, duration: 0.6 }, 0.2);
      fade(t, q('[data-a="bfloor"]'), 0.2);
      rise(t, q('[data-a="bex"]'), 0.5, { y: 12, stagger: 0.12 });
      grow(t, q('[data-a="meter"]'), 1.0, { d: 1, stagger: 0.25 });
      rise(t, q('[data-a="meterl"]'), 1.0, { y: 8, stagger: 0.1 });
    },
    (t, q) => {
      grow(t, q('[data-a="saferule"]'), 0, { d: 1 });
      rise(t, q('[data-a="safe"]'), 0.15, { y: 12 });
    },
  ],
  ambient: ({ q, S, beat, draw: redraw, delay }) => {
    const exA = q('[data-a="aex"]');
    const on = (list, i) => list.forEach((el, k) => gsap.set(el, { opacity: k === i ? 1 : 0.4 }));
    const a = gsap.timeline({ repeat: -1, delay, onUpdate: redraw });
    a.call(() => on(exA, 0))
      .to(S.a.band.abs, { opacity: 1, duration: 0.3 })
      .to(q('[data-p="brace"]'), { autoAlpha: 1, duration: 0.3 }, '<')
      .to(q('[data-a="bracearrow"]'), { x: -16, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<')
      .to(S.a.band.abs, { opacity: 0, duration: 0.3 })
      .to(q('[data-p="brace"]'), { autoAlpha: 0, duration: 0.3 }, '<')
      .call(() => on(exA, 1))
      .to(S.pa, { k: -4, duration: 0.7, ease: 'sine.inOut' })
      .to(S.pa, { k: 16, duration: 0.9, ease: 'sine.inOut' })
      .to(S.pa, { k: -4, duration: 0.9, ease: 'sine.inOut' })
      .to(S.pa, { k: A_BASE.k, duration: 0.6, ease: 'sine.inOut' })
      .call(() => on(exA, 2))
      .to(S.pa, { k: 38, u: 92, f: 96, duration: 1.2, ease: 'power2.inOut' })
      .to(S.pa, { k: 38, duration: 0.5 })
      .to(S.pa, { k: A_BASE.k, u: A_BASE.u, f: A_BASE.f, duration: 1.1, ease: 'power2.inOut' })
      .call(() => on(exA, 3))
      .to(S.a.band.back, { opacity: 1, duration: 0.3 })
      .to(S.pa, { k: -6, u: -10, f: -6, duration: 0.9, ease: 'power2.inOut' }, '<')
      .to(S.pa, { k: -6, duration: 0.9 })
      .to(S.pa, { k: A_BASE.k, u: A_BASE.u, f: A_BASE.f, duration: 0.9, ease: 'power2.inOut' })
      .to(S.a.band.back, { opacity: 0, duration: 0.3 }, '<')
      .to(S.pa, { k: A_BASE.k, duration: 0.4 });
    if (beat < 1) return;
    const exB = q('[data-a="bex"]');
    const rip = q('[data-a="rip"]');
    const b = gsap.timeline({ repeat: -1, delay: delay + 0.3, onUpdate: redraw });
    b.call(() => on(exB, 0))
      .to(S.pb, { r: 18, duration: 1, ease: 'power2.inOut' })
      .to(S.pb, { r: 18, duration: 0.4 })
      .to(S.pb, { r: 0, duration: 1.4, ease: 'power1.inOut' })
      .to(S.pb, { r: 18, duration: 0.7, ease: 'power2.out' })
      .to(S.pb, { r: 0, duration: 0.12, ease: 'power3.in' })
      .fromTo(rip, { attr: { rx: 14, ry: 4 }, opacity: 0.9 }, { attr: { rx: 110, ry: 18 }, opacity: 0, duration: 0.6, stagger: 0.07 })
      .to(S.pb, { r: 18, duration: 0.7, ease: 'power2.out' })
      .to(S.pb, { r: 0, duration: 0.12, ease: 'power3.in' })
      .fromTo(rip, { attr: { rx: 14, ry: 4 }, opacity: 0.9 }, { attr: { rx: 110, ry: 18 }, opacity: 0, duration: 0.6, stagger: 0.07 })
      .call(() => on(exB, 1))
      .to(S.pb, { t2: -42, s2: -6, duration: 0.6, ease: 'power2.out' })
      .to(S.pb, { t2: 0, s2: 0, duration: 0.14, ease: 'power3.in' })
      .fromTo(rip, { attr: { rx: 14, ry: 4 }, opacity: 0.9 }, { attr: { rx: 110, ry: 18 }, opacity: 0, duration: 0.6, stagger: 0.07 })
      .call(() => on(exB, 2))
      .to(S.pb, { t2: -30, s2: -20, duration: 0.5, ease: 'power2.out' })
      .to(S.pb, { t2: 0, s2: 0, duration: 0.14, ease: 'power3.in' })
      .fromTo(rip, { attr: { rx: 14, ry: 4 }, opacity: 0.9 }, { attr: { rx: 110, ry: 18 }, opacity: 0, duration: 0.6, stagger: 0.07 })
      .to(S.pb, { t2: 0, duration: 0.6 });
  },
};

export function AdditionsSlide({ ctx, meta }) {
  const root = useSlide(ctx, AD_CFG);
  return (
    <div className="cs-stage s-ad" ref={root}>
      <Frame meta={meta} title="Small additions, not a redesign" />
      <span className="s-ad__rule" style={{ left: 112 }} data-a="arule" />
      <p className="s-ad__k t-mono c-move" style={{ left: 112 }} data-a="ah">01</p>
      <p className="s-ad__h" style={{ left: 112 }} data-a="ah">Seated core & trunk</p>
      <div className="s-ad__list" style={{ left: 112 }}>
        {LEFT_EX.map((e) => (
          <p key={e} className="s-ad__ex" data-a="aex"><span className="dot dot--move" />{e}</p>
        ))}
      </div>
      <p className="s-ad__ben" data-a="aben">Builds trunk strength and postural control while seated: suits people with poor balance or low standing tolerance. Builds on the marching we already do.</p>
      <span className="s-ad__rule" style={{ left: 1000 }} data-a="brule" />
      <p className="s-ad__k t-mono c-bone" style={{ left: 1000 }} data-a="bh">02</p>
      <p className="s-ad__h" style={{ left: 1000 }} data-a="bh">Targeted weight-bearing & impact</p>
      <div className="s-ad__list" style={{ left: 1000 }}>
        {RIGHT_EX.map((e) => (
          <p key={e} className="s-ad__ex" data-a="bex"><span className="dot dot--bone" />{e}</p>
        ))}
      </div>
      <svg className="s-ad__svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <g data-a="seat">
          <path d={`M ${A_BASE.x - 300} ${SEAT_A} H ${A_BASE.x - 150} M ${A_BASE.x - 290} ${SEAT_A} L ${A_BASE.x - 286} ${A_BASE.g} M ${A_BASE.x - 160} ${SEAT_A} L ${A_BASE.x - 164} ${A_BASE.g}`} className="g-chair--one" />
        </g>
        <g data-rig="a" />
        <g data-p="brace" className="s-ad__brace" opacity="0">
          <g data-a="bracearrow"><path d="M 40 0 H 0 M 14 -14 L 0 0 L 14 14" /></g>
        </g>
        <g transform="translate(1700 930) scale(0.72)">
          <path d="M -230 2 H 230" className="g-floor" data-a="bfloor" />
          {[0, 1, 2].map((k) => <ellipse key={k} cx="-40" cy="2" rx="14" ry="4" className="s-ad__rip" data-a="rip" />)}
          <g data-rig="b" />
        </g>
        <g transform="translate(1000 700)">
          <text x="0" y="0" className="s-ad__ml" data-a="meterl">LOADING STIMULUS (SCHEMATIC)</text>
          <rect x="0" y="22" width="120" height="16" rx="8" className="s-ad__mlow" data-a="meter" />
          <text x="136" y="36" className="s-ad__mt" data-a="meterl">walking, marching</text>
          <rect x="0" y="58" width="300" height="16" rx="8" className="s-ad__mhigh" data-a="meter" />
          <text x="316" y="72" className="s-ad__mt" data-a="meterl">heel drops, stamping</text>
        </g>
      </svg>
      <span className="s-ad__saferule" data-a="saferule" />
      <p className="s-ad__safe" data-a="safe"><span className="dot dot--risk" />Many participants may have had a fragility fracture or have low bone density. Introduce impact carefully, especially for anyone with vertebral fractures.</p>
    </div>
  );
}
AdditionsSlide.beats = AD_CFG.beats.length;
