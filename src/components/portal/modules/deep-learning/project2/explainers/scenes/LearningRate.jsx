import Scene from '../../scene/Scene';
import { lin, pathOf, fmt } from '../../scene/geom';
import fig24 from '../../figures/cell24_0.png';

/* ============================================================================
   SCENES — model 2's learning rate  (§7 Model 2)
   LearningRateScene  validation MAE against Adam's learning rate for model 1
                      (12 months) and model 2 (month 73, and rolled out to 12),
                      from the stage-2 tuning grid in experiments/log.md (MSE
                      rows, mean of seeds 42 and 1) — the notebook only quotes
                      these runs in words (cells 14, 22), so the chart says
                      where its numbers come from.
   CurveCostScene     the price of 0.01: the notebook's own learning-curve
                      figure for model 2 (Out [12], left panel) with overlays
                      placed from the figure's axes (epoch 0 at x 72, 11.1 px
                      per epoch; loss 1.5 at y 295, 63.43 px per °C²), and the
                      remedies cell 25 reports trying.
   ========================================================================== */

const W = 800;

/* ── 1 · the tuning grid ─────────────────────────────────────────────── */

const H1 = 296;
const LRS = [
  { v: 1e-3, t: '0.001' },
  { v: 3e-3, t: '0.003' },
  { v: 1e-2, t: '0.01' },
];
// the three rate columns sit 270 units apart (log scale), so their printed
// values (233–537) fit in what a 390 px screen shows between its edge fades
// (~335 of 800 units)
const C0 = 250;
const xl = (v) => C0 + (Math.log10(v) + 3) * 270;
const yv = lin(0.8, 1.2, 200, 50);
const LX = xl(1e-2) + 22; // line labels, two lines each
// narrow screens show about half the stage: FX_COLS frames the three columns'
// values, FX_RIGHT the last two columns with the line labels and both keys
const FX_COLS = 0.5;
const FX_RIGHT = 0.79;
// log.md stage 2, loss = mse: val MAE (°C), mean of 2 seeds; model 2 is drawn
// with squares (model 1 circles), hollow = month 73 only, filled = 12 months
const SERIES_LR = [
  { key: 'm1', name: 'model 1', sub: 'all 12 months', vals: [1.037, 1.009, 1.11], cls: 'sv-m1', fill: 'sv-fm1', w: 2.2, pos: [-1, 1, -1], beat: 0 },
  { key: 'm2a', name: 'model 2', sub: 'month 73 only', vals: [0.958, 0.896, 0.855], cls: 'sv-m2', fill: null, w: 1.4, pos: [1, 1, 1], beat: 1 },
  { key: 'm2r', name: 'model 2', sub: 'rolled out to 12', vals: [1.145, 1.042, 0.974], cls: 'sv-m2', fill: 'sv-fm2', w: 2.2, pos: [-1, -1, -1], beat: 2 },
];
const CHOSEN = [
  { s: 0, i: 1 },
  { s: 1, i: 2 },
  { s: 2, i: 2 },
];
const RING = { r: 7.5, cls: 'sv-accent', style: { fill: 'none', strokeWidth: 1.6 } };
const KEY_Y = 278;

// model 1 a circle, model 2 a square; filled = a 12-month score, hollow = month 73 only
function LrMarker({ m, x, y, fill, cls }) {
  const st = fill ? { stroke: 'var(--surface)', strokeWidth: 2 } : { fill: 'var(--surface)', strokeWidth: 1.6 };
  if (m === 'm1') return <circle cx={x} cy={y} r={4.5} className={fill || cls} style={st} />;
  const h = fill ? 4.2 : 3.5;
  return <rect x={x - h} y={y - h} width={2 * h} height={2 * h} className={fill || cls} style={st} />;
}

function artLr(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Validation MAE (°C) by learning rate · tuning log, two-seed means</text>
      {[0.8, 0.9, 1.0, 1.1, 1.2].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={C0 - 20} x2={xl(1e-2) + 16} y1={yv(t)} y2={yv(t)} />
          <text className="sv-lab" x={C0 - 30} y={yv(t) + 4} textAnchor="end">{fmt(t, 1)}</text>
        </g>
      ))}
      {LRS.map((l) => (
        <g key={l.t}>
          <line className="sv-axis" x1={xl(l.v)} x2={xl(l.v)} y1={206} y2={211} />
          <text className="sv-lab-strong" x={xl(l.v)} y={224} textAnchor="middle">{l.t}</text>
        </g>
      ))}
      <text className="sv-lab" x={C0 - 30} y={224} textAnchor="end">rate</text>

      {/* what hollow and filled mean on this chart (elsewhere hollow marks a prediction) */}
      <g className="lr-mk" opacity={on(1)}>
        <text className="sv-lab" x={LX} y={38}>hollow · month 73</text>
        <text className="sv-lab" x={LX} y={52}>filled · 12 months</text>
      </g>

      {SERIES_LR.map((s) => (
        <g key={s.key} className={`lr-s lr-s-${s.key}`} opacity={on(s.beat)}>
          <path className={`sv-line ${s.cls} lr-line lr-line-${s.key}`} d={pathOf(s.vals.map((v, i) => [xl(LRS[i].v), yv(v)]))} strokeWidth={s.w} />
          {s.vals.map((v, i) => (
            <g key={i} className={`lr-pt lr-pt-${s.key}`}>
              <LrMarker m={s.key === 'm1' ? 'm1' : 'm2'} x={xl(LRS[i].v)} y={yv(v)} fill={s.fill} cls={s.cls} />
              <text className="sv-num" x={xl(LRS[i].v)} y={yv(v) + (s.pos[i] > 0 ? 21 : -12)} textAnchor="middle" style={{ fontSize: 11 }}>
                {fmt(v, 3)}
              </text>
            </g>
          ))}
          <text className="sv-lab-strong" x={LX} y={yv(s.vals[2]) - 1}>{s.name}</text>
          <text className="sv-lab" x={LX} y={yv(s.vals[2]) + 12}>{s.sub}</text>
        </g>
      ))}

      {/* model 1's two failures, in the log's words */}
      <g className="lr-m1note" opacity={on(0)}>
        <text className="sv-lab" x={C0 - 16} y={244}>model 1 at 0.001 · still improving at epoch 100</text>
        <text className="sv-lab" x={C0 - 16} y={258}>model 1 at 0.01 · best epoch 9–14, then climbs</text>
      </g>

      {/* each model's rate: the key glyph is the chart's marker in the same ring */}
      <g className="lr-chosen" opacity={on(3)}>
        {CHOSEN.map(({ s, i }) => (
          <circle key={`${s}${i}`} cx={xl(LRS[i].v)} cy={yv(SERIES_LR[s].vals[i])} r={RING.r} className={RING.cls} style={RING.style} />
        ))}
        {/* each key starts under its own rate */}
        <LrMarker m="m1" x={xl(3e-3)} y={KEY_Y} fill="sv-fm1" />
        <circle cx={xl(3e-3)} cy={KEY_Y} r={RING.r} className={RING.cls} style={RING.style} />
        <text className="sv-lab-strong" x={xl(3e-3) + 13} y={KEY_Y + 4}>model 1’s rate</text>
        <LrMarker m="m2" x={xl(1e-2)} y={KEY_Y} fill="sv-fm2" />
        <circle cx={xl(1e-2)} cy={KEY_Y} r={RING.r} className={RING.cls} style={RING.style} />
        <text className="sv-lab-strong" x={xl(1e-2) + 13} y={KEY_Y + 4}>model 2’s rate</text>
      </g>
    </>
  );
}

function buildLr(tl, { q, beat }) {
  tl.set(q('.lr-s, .lr-m1note, .lr-chosen, .lr-mk'), { opacity: 0, immediateRender: true }, 0);
  SERIES_LR.forEach((s, j) => {
    beat(j, j === 0 ? 0 : '+=0.7');
    tl.fromTo(q(`.lr-s-${s.key}`), { opacity: 0 }, { opacity: 1, duration: 0.2 }, `b${j}`);
    const line = q(`.lr-line-${s.key}`)[0];
    const L = line.getTotalLength();
    tl.fromTo(line, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut', immediateRender: true }, `b${j}`);
    tl.fromTo(q(`.lr-pt-${s.key}`), { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.42 }, `b${j}+=0.05`);
    if (j === 0) tl.fromTo(q('.lr-m1note'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=1.1');
    if (j === 1) tl.fromTo(q('.lr-mk'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1+=0.6');
  });
  beat(3, '+=0.8');
  tl.fromTo(q('.lr-chosen'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');
  tl.fromTo(q('.lr-chosen circle.sv-accent'), { scale: 1.8, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, stagger: 0.15, ease: 'back.out(1.3)' }, 'b3');
  tl.to({}, { duration: 1.2 });
}

const BEATS_LR = [
  {
    t: 'Model 1 at three rates',
    fx: FX_COLS,
    c: 'At 0.001 model 1 was still improving when the 100-epoch cap stopped it; at 0.01 its best epoch came early, then the validation loss climbed. 0.003 sat in between.',
  },
  {
    t: 'Model 2, month 73 only',
    fx: FX_RIGHT,
    c: 'The one-month model improved as the rate rose, up to 0.01. Its MAE covers only the first month ahead, the easiest to forecast, so it sits below every 12-month number.',
  },
  {
    t: 'Rolled out to twelve',
    fx: FX_COLS,
    c: 'Rolled out to 12 months, the number that compares with model 1’s line, model 2 kept the same order: 1.145, 1.042, 0.974.',
  },
  {
    t: 'One rate per model',
    fx: FX_RIGHT,
    c: 'Each model gets the rate that scored best on validation: 0.003 for model 1, 0.01 for model 2. Two models with the same GRU layers need not share a step size.',
  },
];

export default function LearningRateScene({ id = 'm2-lr' }) {
  return (
    <Scene
      id={id}
      label="Validation MAE against learning rate 0.001, 0.003 and 0.01 from the tuning log: model 1 is best at 0.003, model 2 improves all the way to 0.01 for one month and when rolled out to 12 months"
      viewBox={`0 0 ${W} ${H1}`}
      beats={BEATS_LR}
      art={artLr}
      build={buildLr}
      keyframes={[3]}
    />
  );
}

/* ── 2 · the price: model 2's own learning curve ─────────────────────── */

const H2 = 356;
// crop of the left panel; it starts 20 units under the stage title at (24, 24)
const FIG = { x: 24, y: 44, w: 430, sx: 0, sy: 40, sw: 548, sh: 332 };
const S = FIG.w / FIG.sw;
const FH = FIG.sh * S;
const fx = (px) => FIG.x + (px - FIG.sx) * S;
const fy = (py) => FIG.y + (py - FIG.sy) * S;
const ex = (e) => fx(72 + 11.1 * e); // epoch → stage x
const ly = (v) => fy(295 - (v - 1.5) * 63.43); // loss (°C²) → stage y
const BEST = { x: ex(20), y: ly(1.2393) };
const V40 = { x: ex(40), y: ly(2.57) }; // read off the figure; cell 25 says "about 2.5"
const T40 = { x: ex(40), y: ly(1.45) }; // cell 25: "about 1.45"
const TC = 472; // text column right of the figure
const FX1 = FIG.x + FIG.w; // the figure's right edge
// overlays on the notebook's (always white) figure use a fixed near-black, as on
// the lead-month plot; a leader switches to the theme ink where it leaves the figure
const INK = '#1d1d1d';
const ON_FIG = { stroke: INK, fill: 'none' };
const xd = lin(0.84, 0.98, 634, 780); // one-month val MAE axis for the remedies (labels sit left of it)

function artCost(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <defs>
        <clipPath id={`${uid}fig`}>
          <rect x={FIG.x} y={FIG.y} width={FIG.w} height={FH} />
        </clipPath>
      </defs>
      <text className="sv-cap" x={24} y={24}>Model 2 at 0.01 · reading its curve</text>

      {/* the notebook's figure (Out [12], left panel) */}
      <rect x={FIG.x} y={FIG.y} width={FIG.w} height={FH} style={{ fill: '#fff', stroke: 'var(--line-2)' }} />
      <g clipPath={`url(#${uid}fig)`}>
        <image href={fig24} x={fx(0)} y={fy(0)} width={1090 * S} height={377 * S} preserveAspectRatio="none" />
      </g>
      <text className="sv-lab" x={FIG.x} y={FIG.y + FH + 18}>Notebook figure, Out [12] left panel · MSE loss (°C²) per epoch</text>

      {/* 1 · validation below training, then the best epoch */}
      <g className="cc-b1" opacity={on(1)}>
        <rect x={ex(1)} y={fy(49)} width={ex(20) - ex(1)} height={fy(323) - fy(49)} style={{ fill: INK, opacity: 0.075 }} />
        <text className="sv-lab-strong" x={TC} y={56}>epochs 1–20 · validation below training</text>
        <text className="sv-lab" x={TC} y={70}>Swanbourne’s maximums vary less</text>
        <text className="sv-lab" x={TC} y={84}>(std 4.4 against 5.1)</text>
        <path className="cc-lead" d={`M${BEST.x} ${BEST.y - 7} V 124 H ${FX1}`} strokeWidth="1.2" style={ON_FIG} />
        <path className="sv-accent cc-lead-out" d={`M${FX1} 124 H ${TC - 6}`} strokeWidth="1.2" fill="none" />
        <circle cx={BEST.x} cy={BEST.y} r={6} style={{ ...ON_FIG, strokeWidth: 1.8 }} />
        <text className="sv-lab-strong" x={TC} y={128}>epoch 20 · val_loss 1.2393 · MAE 0.882</text>
        <text className="sv-lab" x={TC} y={142}>the weights early stopping restores</text>
      </g>

      {/* 2 · then it turns up */}
      <g className="cc-b2" opacity={on(2)}>
        <path d={`M${V40.x + 6} ${V40.y} H ${FX1}`} strokeWidth="1.2" style={ON_FIG} />
        <path className="sv-accent" d={`M${FX1} ${V40.y} H ${TC - 6}`} strokeWidth="1.2" fill="none" />
        <circle cx={V40.x} cy={V40.y} r={6} style={{ ...ON_FIG, strokeWidth: 1.8 }} />
        <text className="sv-lab-strong" x={TC} y={V40.y + 4}>epoch 40 · validation about 2.5,</text>
        <text className="sv-lab" x={TC} y={V40.y + 18}>double its best</text>
        <path d={`M${T40.x + 6} ${T40.y} H ${FX1}`} strokeWidth="1.2" style={ON_FIG} />
        <path className="sv-accent" d={`M${FX1} ${T40.y} H ${TC - 6}`} strokeWidth="1.2" fill="none" />
        <circle cx={T40.x} cy={T40.y} r={5} style={{ ...ON_FIG, strokeWidth: 1.6 }} />
        <text className="sv-lab" x={TC} y={T40.y + 4}>training still falling, about 1.45</text>
      </g>

      {/* 3 · the remedies tried in tuning */}
      <g className="cc-b3" opacity={on(3)}>
        <text className="sv-cap" x={TC} y={270}>Tried in tuning · one-month val MAE</text>
        <rect x={xd(0.86)} y={282} width={xd(0.91) - xd(0.86)} height={7} style={{ fill: 'var(--ink-2)' }} />
        <text className="sv-lab" x={TC} y={289}>no dropout · 0.86–0.91</text>
        <rect x={xd(0.93)} y={300} width={xd(0.975) - xd(0.93)} height={7} style={{ fill: 'var(--ink-3)' }} />
        <path className="sv-faint" d={`M${xd(0.975)} 298 l 9 5.5 l -9 5.5`} fill="none" strokeWidth="1.4" />
        <text className="sv-lab" x={TC} y={307}>dropout 0.1–0.3 · 0.93+</text>
        <line className="sv-axis" x1={xd(0.84)} x2={xd(0.98)} y1={318} y2={318} />
        {[0.85, 0.9, 0.95].map((t) => (
          <g key={t}>
            <line className="sv-axis" x1={xd(t)} x2={xd(t)} y1={318} y2={322} />
            <text className="sv-lab" x={xd(t)} y={334} textAnchor="middle">{fmt(t, 2)}</text>
          </g>
        ))}
        <text className="sv-lab" x={TC} y={350}>rate 0.003: a flatter curve, a worse MAE</text>
      </g>
    </>
  );
}

function buildCost(tl, { q, beat }) {
  tl.set(q('.cc-b1, .cc-b2, .cc-b3'), { opacity: 0, immediateRender: true }, 0);
  beat(0, 0);
  tl.to({}, { duration: 1.2 }, 'b0');
  beat(1, '+=0.2');
  tl.fromTo(q('.cc-b1'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b1');
  [
    [q('.cc-lead')[0], 0.3, 0.8],
    [q('.cc-lead-out')[0], 1.1, 0.15],
  ].forEach(([p, at, dur]) => {
    const L = p.getTotalLength();
    tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: at > 1 ? 'none' : 'power2.in', immediateRender: true }, `b1+=${at}`);
  });
  beat(2, '+=1.4');
  tl.fromTo(q('.cc-b2'), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.5 }, 'b2');
  beat(3, '+=1.4');
  tl.fromTo(q('.cc-b3'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');
  tl.fromTo(q('.cc-b3 rect'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.6, stagger: 0.3, ease: 'power2.out' }, 'b3+=0.2');
  tl.to({}, { duration: 1.4 });
}

const BEATS_COST = [
  { t: 'Model 2 at 0.01', fx: 0, c: 'The notebook’s own plot of model 2’s training and validation loss in °C², with the best epoch marked at 20.' },
  {
    t: 'Below training, then the best',
    fx: 1,
    c: 'Up to epoch 20 validation loss sits below training: Swanbourne’s maximums vary less than the training stations’, and each training value averages an epoch of changing weights.',
  },
  {
    t: 'Doubled by epoch 40',
    fx: 1,
    c: 'After epoch 20 the validation loss turns up and reaches about 2.5 by epoch 40 while training keeps falling to about 1.45: a wobble at the high rate, then plain overfitting.',
  },
  {
    t: 'Remedies that lost',
    fx: 1,
    c: 'Input dropout made the one-month validation MAE worse every time, and 0.003 gave a flatter curve with a worse MAE. So the notebook keeps 0.01 and lets early stopping restore epoch 20.',
  },
];

export function CurveCostScene({ id = 'm2-lr-b' }) {
  return (
    <Scene
      id={id}
      label="The notebook's learning-curve figure for model 2 at learning rate 0.01, annotated: validation loss below training until the best epoch 20, then doubling to about 2.5 by epoch 40, and the dropout runs that did worse"
      viewBox={`0 0 ${W} ${H2}`}
      beats={BEATS_COST}
      art={artCost}
      build={buildCost}
      keyframes={[3]}
    />
  );
}
