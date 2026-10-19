import Scene from '../../scene/Scene';
import { lin, seriesPath, pathOf, bracket, range } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE 9·1 — the two parameter-free baselines, built from a real test window
   Test sequence 95 (one of SHOW, real data from SERIES): its 72 input months,
   then the notebook's two functions applied to them —
     seasonal_naive   X[:, -12:] tiled → months 73–84 and 85–96 repeat 61–72
     climatology      reshape (6, 12) → mean over the six years → tiled
   Both forecasts are computed here from the real input months (they are pure
   copies and averages, no model). The MAEs quoted at the end are the
   notebook's, over all 297 test sequences (Out [18]); nothing per-sequence.
   Recorded months keep the channel colours (solid); the baselines take the
   page's reference styles from decisions.md (seasonal naive grey dashed with
   filled markers, climatology ink-2 dotted with hollow markers), as in 9·2,
   9·4 and 13·1, so in the forecast zone a baseline never shares a hue with
   the recorded line it is judged against. Max always sits above min, and
   each block is direct-labelled, so the grey pairs stay readable.
   ========================================================================== */

const W = 800;
const H = 506;
const X0 = 64;
const X1 = 690;
const MW = (X1 - X0) / 95; // one month
const x = lin(1, 96, X0, X1); // month centre
const xe = (m) => x(m) - MW / 2; // left edge of month m
const R1 = { top: 60, h: 110 };
const R2 = { top: 282, h: 110 };
const yOf = (p) => lin(34, 4, p.top, p.top + p.h);
const y1 = yOf(R1);
const y2 = yOf(R2);
const sx = lin(1, 12, 96, 402); // calendar slot in the stacked-years chart
const MX = 414; // left edge of the score block (beat 4)

const SEQ = SERIES.testSeqs['95'];
const IN = SEQ.slice(0, 72);
const TRUTH = SEQ.slice(72, 96);
const col = (rows, c) => rows.map((r) => r[c]);
const LAST12 = IN.slice(60, 72);
const YEARS = range(6).map((k) => IN.slice(12 * k, 12 * k + 12));
const AVG = range(12).map((j) => [0, 1].map((c) => YEARS.reduce((s, yr) => s + yr[j][c], 0) / 6));
const CH = [
  { c: 1, cls: 'sv-max', name: 'max' },
  { c: 0, cls: 'sv-min', name: 'min' },
];
// the two reference styles (decisions.md): never a data hue
const STYLE = {
  sn: { line: { stroke: 'var(--dlp2-base)', strokeDasharray: '6 4' }, dot: { fill: 'var(--dlp2-base)', stroke: 'var(--surface)' }, dw: 0.8 },
  cl: { line: { stroke: 'var(--ink-2)', strokeDasharray: '1.5 4' }, dot: { fill: 'var(--surface)', stroke: 'var(--ink-2)' }, dw: 1.3 },
};

/* one 12-month forecast block (both channels) in a baseline's style */
function Block({ rows, m0, y, cls, kind, opacity }) {
  const st = STYLE[kind];
  return (
    <g className={cls} opacity={opacity}>
      {CH.map(({ c }) => (
        <g key={c}>
          <path className="sv-line" d={seriesPath(col(rows, c), x, y, m0)} strokeWidth="1.7" style={st.line} />
          {rows.map((r, i) => (
            <circle key={i} cx={x(m0 + i)} cy={y(r[c])} r="2.4" style={st.dot} strokeWidth={st.dw} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Grid({ p, y, a, b, right }) {
  return (
    <g>
      {[10, 20, 30].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={a} x2={b} y1={y(t)} y2={y(t)} />
          {right && <text className="sv-lab" x={b + 6} y={y(t) + 4}>{t}°</text>}
        </g>
      ))}
      <line className="sv-axis" x1={a} x2={b} y1={p.top + p.h} y2={p.top + p.h} />
    </g>
  );
}

function Ticks({ p, ms }) {
  return ms.map((m) => (
    <g key={m}>
      <line className="sv-axis" x1={x(m)} x2={x(m)} y1={p.top + p.h} y2={p.top + p.h + 4} />
      <text className="sv-lab" x={x(m)} y={p.top + p.h + 15} textAnchor="middle">{m}</text>
    </g>
  ));
}

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const clip = `${uid}meanclip`;
  const zoneX = xe(73);
  const zoneW = xe(97) - xe(73);
  const arrowY = y2(20);
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect className="bl-meanclip" x={sx(1) - 8} y={R2.top - 10} width={sx(12) - sx(1) + 16} height={R2.h + 20} />
        </clipPath>
      </defs>

      {/* ── row 1: the input window, and seasonal naive ── */}
      <text className="sv-cap" x={24} y={24}>Test sequence 95 · Bickley · two channels</text>
      <text className="sv-lab" x={W - 16} y={24} textAnchor="end">solid colour = recorded · grey = baseline forecast</text>

      <rect className="sv-fill-ground2" x={zoneX} y={R1.top - 4} width={zoneW} height={R1.h + 4} />
      <Grid p={R1} y={y1} a={X0 - 6} b={xe(97)} right />
      <Ticks p={R1} ms={[1, 12, 24, 36, 48, 60, 72, 84, 96]} />
      <line className="sv-ink" x1={zoneX} x2={zoneX} y1={R1.top - 8} y2={R1.top + R1.h + 4} strokeWidth="1.3" strokeDasharray="3 3" />
      <line className="sv-faint" x1={xe(85)} x2={xe(85)} y1={R1.top - 4} y2={R1.top + R1.h + 4} strokeWidth="0.8" />
      {/* backed in the zone's own fill: the month-84 line and the 20° gridline run through here */}
      <g className="bl-hidden" opacity={step < 1 ? 1 : 0}>
        <rect className="sv-fill-ground2" x={zoneX + zoneW / 2 - 70} y={R1.top + R1.h / 2 - 8} width={140} height={16} />
        <text className="sv-lab" x={zoneX + zoneW / 2} y={R1.top + R1.h / 2 + 4} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>
          months 73–96 hidden
        </text>
      </g>

      <g className="b0">
        {CH.map(({ c, cls, name }) => (
          <g key={c}>
            <path className={`sv-line ${cls} bl-in`} d={seriesPath(col(IN, c), x, y1)} strokeWidth="1.6" />
            <text className="sv-lab-strong bl-inlab" x={x(1) - 7} y={y1(IN[0][c]) + 4} textAnchor="end">{name}</text>
          </g>
        ))}
      </g>

      {/* seasonal naive */}
      <g className="b1" opacity={on(1)}>
        <text className="sv-lab-strong" x={zoneX + 4} y={R1.top - 12}>seasonal naive</text>
        <path className="sv-ink2" d={bracket(xe(61) + 1.5, xe(73) - 1.5, R1.top + R1.h + 22, -6)} strokeWidth="1.2" />
        <text className="sv-lab" x={x(66.5)} y={R1.top + R1.h + 36} textAnchor="middle">
          last 12 input months, copied to 73–84 and again to 85–96
        </text>
      </g>
      <Block rows={LAST12} m0={73} y={y1} cls="bl-sn bl-sn-1" kind="sn" opacity={on(1)} />
      <Block rows={LAST12} m0={85} y={y1} cls="bl-sn bl-sn-2" kind="sn" opacity={on(1)} />

      {/* the six years, labelled on the timeline (beat 2) */}
      <g className="b2" opacity={on(2)}>
        {range(6).map((k) => (
          <text key={k} className="sv-lab" x={x(12 * k + 6.5)} y={R1.top - 8} textAnchor="middle">year {k + 1}</text>
        ))}
      </g>
      <rect className="bl-hi" x={step >= 2 ? xe(61) : xe(1)} y={R1.top - 4} width={MW * 12} height={R1.h + 4} style={{ fill: 'var(--dlp2-mark)' }} opacity="0" />

      {/* ── row 2: climatology ── */}
      <g className="b2" opacity={on(2)}>
        <text className="sv-cap" x={sx(1) - 12} y={R2.top - 14}>The six input years, stacked</text>
        <Grid p={R2} y={y2} a={sx(1) - 10} b={sx(12) + 10} />
        {range(12, 1).map((j) => (
          <g key={j}>
            <line className="sv-axis" x1={sx(j)} x2={sx(j)} y1={R2.top + R2.h} y2={R2.top + R2.h + 4} />
            <text className="sv-lab" x={sx(j)} y={R2.top + R2.h + 15} textAnchor="middle">{j}</text>
          </g>
        ))}
        <text className="sv-lab" x={sx(1) - 12} y={R2.top + R2.h + 34}>
          slot 1 = months 1, 13, 25, 37, 49 and 61: the same calendar month
        </text>
        {CH.map(({ c, name }) => (
          <text key={c} className="sv-lab-strong" x={sx(1) - 10} y={y2(YEARS[0][0][c]) + 4} textAnchor="end">{name}</text>
        ))}
      </g>
      {range(6).map((k) => (
        <g key={k} className={`b2 bl-yr bl-yr-${k}`} opacity={on(2)}>
          {CH.map(({ c, cls }) => (
            <path
              key={c}
              className={`sv-line ${cls} bl-yrline-${k}`}
              d={pathOf(YEARS[k].map((r, j) => [sx(j + 1), y2(r[c])]))}
              strokeWidth="1.1"
              strokeOpacity="0.5"
            />
          ))}
        </g>
      ))}
      <g className="b3" opacity={on(3)}>
        <g clipPath={`url(#${clip})`}>
          {CH.map(({ c }) => (
            <g key={c}>
              <path className="sv-line" d={pathOf(AVG.map((r, j) => [sx(j + 1), y2(r[c])]))} strokeWidth="2.2" style={STYLE.cl.line} />
              {AVG.map((r, j) => (
                <circle key={j} cx={sx(j + 1)} cy={y2(r[c])} r="2.9" style={STYLE.cl.dot} strokeWidth="1.5" />
              ))}
            </g>
          ))}
        </g>
        <text className="sv-lab-strong" x={sx(12) + 8} y={y2(AVG[11][1]) - 8}>average year</text>
        <text className="sv-lab" x={sx(12) + 8} y={y2(AVG[11][1]) + 6}>mean of 6</text>
        <path className="sv-ink2 bl-arrow" d={`M${sx(12) + 22} ${arrowY} H${zoneX - 12}`} strokeWidth="1.3" />
        <path className="sv-ink2" d={`M${zoneX - 18} ${arrowY - 4} L${zoneX - 12} ${arrowY} L${zoneX - 18} ${arrowY + 4}`} strokeWidth="1.3" fill="none" />
        <text className="sv-lab" x={(sx(12) + zoneX) / 2 + 4} y={arrowY + 17} textAnchor="middle">tile ×2</text>
      </g>

      <g className="b2" opacity={on(2)}>
        <rect className="sv-fill-ground2" x={zoneX} y={R2.top - 4} width={zoneW} height={R2.h + 4} />
        <Grid p={R2} y={y2} a={zoneX} b={xe(97)} right />
        <Ticks p={R2} ms={[73, 84, 96]} />
        <line className="sv-faint" x1={xe(85)} x2={xe(85)} y1={R2.top - 4} y2={R2.top + R2.h + 4} strokeWidth="0.8" />
        <text className="sv-lab-strong" x={zoneX + 4} y={R2.top - 12}>climatology</text>
      </g>
      <Block rows={AVG} m0={73} y={y2} cls="bl-cl bl-cl-1" kind="cl" opacity={on(3)} />
      <Block rows={AVG} m0={85} y={y2} cls="bl-cl bl-cl-2" kind="cl" opacity={on(3)} />

      {/* ── beat 4: what happened, and the notebook's scores ── */}
      <g className="b4" opacity={on(4)}>
        {CH.map(({ c, cls }) => (
          <g key={c}>
            <path className={`sv-line ${cls}`} d={seriesPath([IN[71][c], ...col(TRUTH, c)], x, y1, 72)} strokeWidth="1.4" />
            <path className={`sv-line ${cls}`} d={seriesPath(col(TRUTH, c), x, y2, 73)} strokeWidth="1.4" />
          </g>
        ))}
        {/* under the forecast zone, so a narrow stage that ends on the right half frames the scores with it */}
        <line className="sv-axis" x1={MX} x2={W - 16} y1={444} y2={444} />
        <text className="sv-cap" x={MX} y={462}>Test MAE, all 297 Bickley windows · Out [18]</text>
        <text className="sv-lab" x={MX} y={481}>seasonal naive</text>
        <text className="sv-num" x={MX + 112} y={481}>1.235 °C</text>
        <text className="sv-lab" x={MX + 182} y={481}>at 12 months · 1.234 at 24</text>
        <text className="sv-lab" x={MX} y={498}>climatology</text>
        <text className="sv-num" x={MX + 112} y={498}>0.958 °C</text>
        <text className="sv-lab" x={MX + 182} y={498}>at 12 months · 0.957 at 24</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const draw = (sel, at, dur) =>
    q(sel).forEach((p) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, at);
    });
  const shift = MW * 12;
  tl.set(q('.b1, .b2, .b3, .b4, .bl-sn, .bl-cl, .bl-inlab'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.bl-hidden'), { opacity: 1, immediateRender: true }, 0);
  tl.set(q('.bl-meanclip'), { attr: { width: 0 }, immediateRender: true }, 0);
  tl.set(q('.bl-hi'), { opacity: 0, attr: { x: xe(1) }, immediateRender: true }, 0);
  const later = { immediateRender: false }; // several tweens share .bl-hi: only t=0 may render early

  beat(0, 0);
  draw('.bl-in', 'b0', 1.8);
  tl.fromTo(q('.bl-inlab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=0.2');

  beat(1, '+=0.6');
  tl.fromTo(q('.bl-hidden'), { opacity: 1 }, { opacity: 0, duration: 0.3 }, 'b1');
  tl.fromTo(q('.b1'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  tl.fromTo(q('.bl-sn-1'), { opacity: 0, x: -shift }, { opacity: 1, x: 0, duration: 1.1, ease: 'power2.inOut' }, 'b1+=0.5');
  tl.fromTo(q('.bl-sn-2'), { opacity: 0, x: -shift }, { opacity: 1, x: 0, duration: 1.1, ease: 'power2.inOut' }, 'b1+=1.7');

  beat(2, '+=0.8');
  tl.fromTo(q('.b2:not(.bl-yr)'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  tl.fromTo(q('.bl-hi'), { opacity: 0 }, { opacity: 0.1, duration: 0.25, ...later }, 'b2+=0.3');
  range(6).forEach((k) => {
    const at = `b2+=${0.4 + k * 0.55}`;
    if (k > 0) tl.fromTo(q('.bl-hi'), { attr: { x: xe(12 * (k - 1) + 1) } }, { attr: { x: xe(12 * k + 1) }, duration: 0.3, ease: 'power2.inOut', ...later }, at);
    tl.fromTo(q(`.bl-yr-${k}`), { opacity: 0 }, { opacity: 1, duration: 0.05 }, at);
    draw(`.bl-yrline-${k}`, at, 0.5);
  });
  tl.fromTo(q('.bl-hi'), { opacity: 0.1 }, { opacity: 0, duration: 0.3, ...later }, `b2+=${0.4 + 6 * 0.55}`);

  beat(3, '+=0.6');
  tl.fromTo(q('.b3'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3');
  tl.fromTo(q('.bl-meanclip'), { attr: { width: 0 } }, { attr: { width: sx(12) - sx(1) + 16 }, duration: 1.1, ease: 'power1.inOut' }, 'b3');
  draw('.bl-arrow', 'b3+=1.1', 0.5);
  tl.fromTo(q('.bl-cl-1'), { opacity: 0, x: -36 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }, 'b3+=1.5');
  tl.fromTo(q('.bl-cl-2'), { opacity: 0, x: -shift }, { opacity: 1, x: 0, duration: 1.0, ease: 'power2.inOut' }, 'b3+=2.3');

  beat(4, '+=0.8');
  tl.fromTo(q('.b4'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b4');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'Seventy-two months in',
    c: 'Test sequence 95 from Bickley. A baseline gets exactly what the models get: the 72 input months. Months 73–96 stay hidden.',
    fx: 0,
  },
  {
    t: 'Seasonal naive',
    c: 'Copy the last 12 input months and tile them: months 73–84 repeat 61–72, and 85–96 repeat them again, two years back. The grey dashes are the copy.',
    fx: 1,
  },
  {
    t: 'Stack the six years',
    c: 'Because 72 = 6 × 12, reshaping the input to six rows of 12 lines up the same calendar month in each column, whatever month the window starts in.',
    fx: 0,
  },
  {
    t: 'Average, then tile',
    c: 'Climatology takes each column’s mean over the six years, the station’s smooth average year (dotted), and tiles it across the forecast.',
    fx: 0.75,
  },
  {
    t: 'Against what happened',
    c: 'Recorded months are drawn solid. A copied year carries its own weather; an average of six mostly cancels it. All 297 test windows, 12 months: seasonal naive 1.235, climatology 0.958 °C.',
    fx: 1,
  },
];

export default function BaselinesScene() {
  return (
    <Scene
      id="baselines"
      label="Seasonal naive and climatology baselines built from test sequence 95: the last 12 input months tiled, and the six input years averaged into one year and tiled, compared with the recorded months 73 to 96"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
    />
  );
}
