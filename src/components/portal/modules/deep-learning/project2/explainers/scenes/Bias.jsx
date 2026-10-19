import Scene from '../../scene/Scene';
import { lin, fmt, bracket } from '../../scene/geom';

/* ============================================================================
   SCENE 9·4 — why every model loses at Bickley (real numbers only)
   Station means per split (Out [3]), then a diverging dot plot of the test
   bias per channel — mean signed error, predicted − actual, over every test
   window and month (Out [19]) — for models 1–3 and both baselines, against
   the 2.1 °C gap between the training stations' and Bickley's maximums
   (cell 39). The last beat is the notebook's named next step (cell 39),
   which was not run: it is drawn as words in boxes, not as a result, stacked
   as a sum with each note under its box, so a narrow stage that ends on the
   left half frames all of it.
   The models' maximum-side dots carry their row's name as well, left of the
   dot on a surface backing (clear of the grid and of the dashed 2.1 °C line),
   because on a narrow screen the stage scrolls to them and the row labels are
   off-frame. Model 2's marks are squares and model 3's circles, as on every
   chart that shows both, so the aqua/violet pair never rests on hue alone.
   ========================================================================== */

const W = 800;
const H = 636;

// station means (Out [3])
const MEANS = [
  { k: 'train', label: 'training stations', short: 'training', fill: 'sv-ftrain', min: 12.2, max: 24.7 },
  { k: 'val', label: 'Swanbourne · val', short: 'Swanbourne', fill: 'sv-fval', min: 14.0, max: 24.1 },
  { k: 'test', label: 'Bickley · test', short: 'Bickley', fill: 'sv-ftest', min: 11.3, max: 22.6 },
];
const SMIN = lin(10, 15, 176, 386);
const SMAX = lin(21, 26, 520, 730);
const SROW = [58, 78, 98];
const SAX = 112;

// test bias, °C (Out [19])
const ROWS = [
  { k: 'm1', label: 'model 1', fill: 'sv-fm1', min: -0.08, max: 0.81 },
  { k: 'm2', label: 'model 2', fill: 'sv-fm2', min: 0.47, max: 1.14, shape: 'square' },
  { k: 'm3', label: 'model 3', fill: 'sv-fm3', min: -0.08, max: 1.2 },
  { k: 'sn', label: 'seasonal naive', base: 'sn', min: -0.05, max: -0.06 },
  { k: 'cl', label: 'climatology', base: 'cl', min: -0.1, max: -0.11 },
];
const BMIN = lin(-0.5, 2.5, 176, 446);
const BMAX = lin(-0.5, 2.5, 500, 770);
const BTICKS = [-0.5, 0, 0.5, 1, 1.5, 2, 2.5];
const RY = (i) => 262 + i * 27;
const BTOP = 246;
const BBOT = 392;
const GAP = 2.1;
const sgn = (v) => (v > 0 ? `+${fmt(v, 2)}` : v < 0 ? `−${fmt(-v, 2)}` : '0.00');
const tickLab = (t) => (t === 0 ? '0' : `${t > 0 ? '+' : '−'}${String(Math.abs(t))}`);

// model 2 is a square and model 3 a circle, as on every chart that shows both
function Dot({ r, cx, cy, cls }) {
  if (r.base === 'sn') return <circle className={cls} cx={cx} cy={cy} r="5.5" style={{ fill: 'var(--dlp2-base)', stroke: 'var(--surface)' }} strokeWidth="2" />;
  if (r.base === 'cl') return <circle className={cls} cx={cx} cy={cy} r="4.6" style={{ fill: 'var(--surface)', stroke: 'var(--ink-2)' }} strokeWidth="1.8" />;
  if (r.shape === 'square') return <rect className={`${r.fill} ${cls || ''}`} x={cx - 5.5} y={cy - 5.5} width={11} height={11} style={{ stroke: 'var(--surface)' }} strokeWidth="2" />;
  return <circle className={`${r.fill} ${cls || ''}`} cx={cx} cy={cy} r="6" style={{ stroke: 'var(--surface)' }} strokeWidth="2" />;
}

function Val({ v, cx, cy }) {
  return (
    <text className="sv-num" x={cx + (v >= 0 ? 11 : -11)} y={cy + 4} textAnchor={v >= 0 ? 'start' : 'end'} style={{ fontSize: 11 }}>
      {sgn(v)}
    </text>
  );
}

// a model's name left of its maximum-side dot, on a surface backing
function NameLeft({ name, cx, cy }) {
  const w = name.length * 6.9;
  return (
    <>
      <rect x={cx - 11 - w - 3} y={cy - 8} width={w + 6} height={15} style={{ fill: 'var(--surface)' }} />
      <text className="sv-lab" x={cx - 11} y={cy + 4} textAnchor="end">{name}</text>
    </>
  );
}

function Panel({ s, title }) {
  return (
    <g>
      <text className="sv-lab-strong" x={(s(-0.5) + s(2.5)) / 2} y={BTOP - 8} textAnchor="middle">{title}</text>
      {BTICKS.map((t) => (
        <g key={t}>
          {t !== 0 && <line className="sv-grid" x1={s(t)} x2={s(t)} y1={BTOP} y2={BBOT} />}
          <line className="sv-axis" x1={s(t)} x2={s(t)} y1={BBOT} y2={BBOT + 4} />
          <text className="sv-lab" x={s(t)} y={BBOT + 16} textAnchor="middle">{tickLab(t)}</text>
        </g>
      ))}
      {ROWS.map((r, i) => <line key={r.k} className="sv-grid" x1={s(-0.5)} x2={s(2.5)} y1={RY(i)} y2={RY(i)} strokeOpacity="0.6" />)}
      <line className="sv-axis" x1={s(-0.5)} x2={s(2.5)} y1={BBOT} y2={BBOT} />
      <line className="sv-ink2" x1={s(0)} x2={s(0)} y1={BTOP - 2} y2={BBOT} strokeWidth="1.4" />
    </g>
  );
}

// the next step as a sum (cell 39), one note per line
const EQ = [
  { box: 'the window’s own average year', note: 'the climatology baseline, same 72 input months' },
  { op: '+', box: 'GRU forecast of the deviation', note: 'so the GRU need not infer the station’s level' },
  { op: '=', box: 'level-invariant forecast', note: 'the first thing the notebook would try next' },
];
const EQ_Y = (k) => 484 + k * 48;

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      {/* ── beat 0: station means ── */}
      <g className="bs-b0">
        <text className="sv-cap" x={24} y={24}>Mean temperature per set, °C · Out [3]</text>
        <text className="sv-lab-strong" x={(SMIN(10) + SMIN(15)) / 2} y={40} textAnchor="middle">minimum</text>
        <text className="sv-lab-strong" x={(SMAX(21) + SMAX(26)) / 2} y={40} textAnchor="middle">maximum</text>
        {MEANS.map((m, i) => (
          <g key={m.k}>
            <text className="sv-lab" x={24} y={SROW[i] + 4}>{m.label}</text>
            <line className="sv-grid" x1={SMIN(10)} x2={SMIN(15)} y1={SROW[i]} y2={SROW[i]} strokeOpacity="0.6" />
            <line className="sv-grid" x1={SMAX(21)} x2={SMAX(26)} y1={SROW[i]} y2={SROW[i]} strokeOpacity="0.6" />
            <circle className={`${m.fill} bs-sd`} cx={SMIN(m.min)} cy={SROW[i]} r="5" style={{ stroke: 'var(--surface)' }} strokeWidth="2" />
            <circle className={`${m.fill} bs-sd`} cx={SMAX(m.max)} cy={SROW[i]} r="5" style={{ stroke: 'var(--surface)' }} strokeWidth="2" />
            <text className="sv-num" x={SMIN(m.min) + 10} y={SROW[i] + 4} style={{ fontSize: 11 }}>{fmt(m.min, 1)}</text>
            <text className="sv-num" x={SMAX(m.max) - 10} y={SROW[i] + 4} textAnchor="end" style={{ fontSize: 11 }}>
              <tspan className="sv-lab">{m.short}</tspan>
              <tspan dx="6">{fmt(m.max, 1)}</tspan>
            </text>
          </g>
        ))}
        {[[SMIN, 10, 15], [SMAX, 21, 26]].map(([s, a, b]) => (
          <g key={a}>
            <line className="sv-axis" x1={s(a)} x2={s(b)} y1={SAX} y2={SAX} />
            {Array.from({ length: b - a + 1 }, (_, j) => a + j).map((t) => (
              <g key={t}>
                <line className="sv-axis" x1={s(t)} x2={s(t)} y1={SAX} y2={SAX + 4} />
                <text className="sv-lab" x={s(t)} y={SAX + 16} textAnchor="middle">{t}</text>
              </g>
            ))}
          </g>
        ))}
        <line className="sv-faint" x1={SMAX(24.7)} x2={SMAX(24.7)} y1={SROW[0] + 7} y2={SAX + 26} strokeWidth="0.8" strokeDasharray="2 2" />
        <line className="sv-faint" x1={SMAX(22.6)} x2={SMAX(22.6)} y1={SROW[2] + 7} y2={SAX + 26} strokeWidth="0.8" strokeDasharray="2 2" />
        <path className="sv-ink2" d={bracket(SMAX(22.6), SMAX(24.7), SAX + 32, -5)} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={(SMAX(22.6) + SMAX(24.7)) / 2} y={SAX + 46} textAnchor="middle">Bickley’s maximums 2.1 °C cooler</text>
      </g>

      {/* ── beat 1: the bias axes and the baselines ── */}
      <g className="bs-b1" opacity={on(1)}>
        <line className="sv-axis" x1={24} x2={W - 24} y1={180} y2={180} />
        <text className="sv-cap" x={24} y={198}>Test bias = mean of (predicted − actual), every window and month · Out [19]</text>
        <text className="sv-lab" x={24} y={214}>a signed error, not the Dense layer’s bias · above 0 = forecasts too warm</text>
        <Panel s={BMIN} title="minimum channel" />
        <Panel s={BMAX} title="maximum channel" />
        {ROWS.map((r, i) => (
          <text key={r.k} className="sv-lab" x={24} y={RY(i) + 4}>{r.label}</text>
        ))}
        {ROWS.filter((r) => r.base).map((r) => {
          const i = ROWS.indexOf(r);
          return (
            <g key={r.k}>
              <Dot r={r} cx={BMIN(r.min)} cy={RY(i)} />
              <Val v={r.min} cx={BMIN(r.min)} cy={RY(i)} />
              <Dot r={r} cx={BMAX(r.max)} cy={RY(i)} />
              <Val v={r.max} cx={BMAX(r.max)} cy={RY(i)} />
              <text className="sv-lab" x={BMAX(r.max) + 13} y={RY(i) + 4}>{r.label}</text>
            </g>
          );
        })}
      </g>

      {/* ── beat 2: min channel, models ── */}
      <g className="bs-b2" opacity={on(2)}>
        {ROWS.filter((r) => !r.base).map((r, i) => (
          <g key={r.k}>
            <Dot r={r} cx={BMIN(r.min)} cy={RY(i)} />
            <Val v={r.min} cx={BMIN(r.min)} cy={RY(i)} />
          </g>
        ))}
      </g>

      {/* ── beat 3: max channel, models (slide out from zero) ── */}
      {ROWS.filter((r) => !r.base).map((r, i) => (
        <g key={r.k} className="bs-b3" opacity={on(3)}>
          <g className={`bs-mx bs-mx-${i}`}>
            <Dot r={r} cx={BMAX(r.max)} cy={RY(i)} />
          </g>
          <g className="bs-mxv">
            <NameLeft name={r.label} cx={BMAX(r.max)} cy={RY(i)} />
            <Val v={r.max} cx={BMAX(r.max)} cy={RY(i)} />
          </g>
        </g>
      ))}

      {/* ── beat 4: the 2.1 °C gap ── */}
      <g className="bs-b4" opacity={on(4)}>
        {/* the value labels end before it (+1.20 is the widest, ending near 1.8 on this axis) */}
        <line className="sv-ink" x1={BMAX(GAP)} x2={BMAX(GAP)} y1={BTOP} y2={BBOT} strokeWidth="1.2" strokeDasharray="4 3" />
        <path className="sv-ink2" d={bracket(BMAX(0), BMAX(GAP), BBOT + 30, -5)} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={(BMAX(0) + BMAX(GAP)) / 2} y={BBOT + 44} textAnchor="middle">2.1 °C gap · models about half way on average</text>
      </g>

      {/* ── beat 5: the next step named in cell 39 (not run) ── */}
      <g className="bs-b5" opacity={on(5)}>
        <line className="sv-axis" x1={24} x2={W - 24} y1={456} y2={456} />
        <text className="sv-cap" x={24} y={474}>Next step named in cell 39 · not run</text>
        {EQ.map((e, k) => (
          <g key={e.box}>
            {/* sv-big's own 22 px, on the page's type scale */}
            {e.op && <text className="sv-big" x={33} y={EQ_Y(k) + 20} textAnchor="middle">{e.op}</text>}
            <rect className={k === 2 ? 'sv-box-strong' : 'sv-box'} x={48} y={EQ_Y(k)} width={240} height={26} />
            <text className="sv-lab-strong" x={168} y={EQ_Y(k) + 17} textAnchor="middle">{e.box}</text>
            <text className="sv-lab" x={48} y={EQ_Y(k) + 40}>{e.note}</text>
          </g>
        ))}
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  tl.set(q('.bs-b1, .bs-b2, .bs-b3, .bs-b4, .bs-b5, .bs-mxv'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.bs-b0'), { opacity: 1, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.bs-b0'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b0');
  tl.fromTo(q('.bs-sd'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, stagger: 0.07, ease: 'back.out(1.3)' }, 'b0+=0.2');

  beat(1, '+=1.2');
  tl.fromTo(q('.bs-b1'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b1');

  beat(2, '+=1.2');
  tl.fromTo(q('.bs-b2'), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.5 }, 'b2');

  beat(3, '+=1.2');
  tl.fromTo(q('.bs-b3'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b3');
  ROWS.filter((r) => !r.base).forEach((r, i) => {
    tl.fromTo(q(`.bs-mx-${i}`), { x: BMAX(0) - BMAX(r.max) }, { x: 0, duration: 1.1, ease: 'power2.out' }, `b3+=${0.1 + i * 0.25}`);
  });
  tl.fromTo(q('.bs-mxv'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.15 }, 'b3+=1.2');

  beat(4, '+=1.0');
  tl.fromTo(q('.bs-b4'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b4');

  beat(5, '+=1.4');
  tl.fromTo(q('.bs-b5'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6 }, 'b5');
  tl.to({}, { duration: 1.6 });
}

const BEATS = [
  {
    t: 'Bickley runs cooler',
    c: 'From Out [3]: Bickley’s maximums average 22.6 °C against 24.7 at the three training stations, 2.1 °C cooler. Its minimums are cooler too, by 0.9 °C.',
    fx: 1,
  },
  {
    t: 'Bias, not MAE',
    c: 'Bias here is the mean signed error, predicted minus actual, over every test month. The baselines only copy Bickley’s own past, so they sit within 0.11 of zero.',
    fx: 0,
  },
  {
    t: 'Minimums: close to zero',
    c: 'Models 1 and 3 are off by only −0.08 °C on the minimums. Model 2 runs +0.47 warm; the notebook puts it down to its errors compounding through the recursion.',
    fx: 0,
  },
  {
    t: 'Maximums: about a degree warm',
    c: 'All three models over-predict Bickley’s maximums, by +0.81, +1.14 and +1.20 °C.',
    fx: 1,
  },
  {
    t: 'About half the gap',
    c: 'Averaged over the year, the lean is about half the 2.1 °C gap. It is uneven: summer peaks come out about right, but Bickley’s winters stay too warm.',
    fx: 1,
  },
  {
    t: 'The fix the notebook names',
    c: 'Forecast each month’s deviation from the window’s own average year, then add that year back, so a cooler station only shifts the starting point. It was not run.',
    fx: 0,
  },
];

export default function BiasScene() {
  return (
    <Scene
      id="bias"
      label="Station means per set, then a dot plot of each model's and baseline's test bias on the minimum and maximum channels, with the 2.1 degree gap between the training stations' and Bickley's maximums"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
    />
  );
}
