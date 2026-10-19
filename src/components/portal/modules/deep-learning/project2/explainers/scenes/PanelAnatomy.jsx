import Scene from '../../scene/Scene';
import { lin, seriesPath, bracket } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — reading one display_temperatures panel  (plate 4·1)
   Real data: test sequence 95 (the first of SHOW), months 1–84, drawn the way
   the notebook's function draws it — input solid, target dashed with a dot per
   month (targets are drawn from month 73, not joined to month 72), a thin grey
   line at 72.5, the y axis in °C. Then model 2's one-month case, then
   indices=SHOW: the same three test sequences (95, 259, 140) for every model.
   No predictions are drawn: those exist only in the notebook's own figures.
   ========================================================================== */

const W = 800;
const H = 490;
const SEQ = SERIES.testSeqs['95'].slice(0, 84);
const col = (s, c) => s.map((r) => r[c]);
const MIN = col(SEQ, 0);
const MAX = col(SEQ, 1);

// main panel (matplotlib-like box; x limits as matplotlib pads 1…84)
const A = { x0: 64, x1: 548, y0: 58, y1: 262 };
const ax = lin(-3.15, 88.15, A.x0, A.x1);
const ay = lin(3, 34, A.y1, A.y0);
const GREY_X = ax(72.5);

// model 2 inset: months 61–73
const I = { x0: 604, x1: 786, y0: 250, y1: 322 };
const ix = lin(60.2, 74.2, I.x0, I.x1);
const iy = lin(3, 34, I.y1, I.y0);

// SHOW thumbnails
const SHOW = ['95', '259', '140'];
const TH = SHOW.map((k, i) => {
  const x0 = 40 + i * 255;
  return { k, x0, x1: x0 + 230, y0: 392, y1: 452, seq: SERIES.testSeqs[k].slice(0, 84) };
});

const KEY = [
  { k: 'min input', cls: 'sv-min', kind: 'in', b: 0 },
  { k: 'min target', cls: 'sv-min', f: 'sv-fmin', kind: 'tg', b: 2 },
  { k: 'min predicted', cls: 'sv-min', kind: 'pr', b: 3 },
  { k: 'max input', cls: 'sv-max', kind: 'in', b: 0 },
  { k: 'max target', cls: 'sv-max', f: 'sv-fmax', kind: 'tg', b: 2 },
  { k: 'max predicted', cls: 'sv-max', kind: 'pr', b: 3 },
];
const KX = 584;
const KY = (j) => 84 + j * 19;

function Cross({ x, y, cls, r = 3.4 }) {
  return <path className={cls} d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`} strokeWidth="1.5" />;
}

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const clip = `${uid}tclip`;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect className="pa-tclip" x={GREY_X} y={A.y0 - 4} width={step >= 2 ? A.x1 - GREY_X : 0} height={A.y1 - A.y0 + 8} />
        </clipPath>
      </defs>

      {/* ── the panel frame, as matplotlib draws it ── */}
      <text className="sv-cap" x={24} y={24}>One panel, as the model figures draw it · Bickley</text>
      <text className="sv-lab-strong" x={(A.x0 + A.x1) / 2} y={A.y0 - 9} textAnchor="middle">sequence 95</text>
      <rect className="sv-axis" x={A.x0} y={A.y0} width={A.x1 - A.x0} height={A.y1 - A.y0} />
      {[5, 10, 15, 20, 25, 30].map((t) => (
        <g key={t}>
          <line className="sv-grid" x1={A.x0} x2={A.x1} y1={ay(t)} y2={ay(t)} />
          <line className="sv-axis" x1={A.x0 - 4} x2={A.x0} y1={ay(t)} y2={ay(t)} />
          <text className="sv-lab" x={A.x0 - 8} y={ay(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {[0, 20, 40, 60, 80].map((m) => (
        <g key={m}>
          <line className="sv-axis" x1={ax(m)} x2={ax(m)} y1={A.y1} y2={A.y1 + 4} />
          <text className="sv-lab" x={ax(m)} y={A.y1 + 16} textAnchor="middle">{m}</text>
        </g>
      ))}
      <text className="sv-lab" x={(A.x0 + A.x1) / 2} y={A.y1 + 31} textAnchor="middle">month of the window</text>
      <text className="sv-lab" transform={`translate(22 ${(A.y0 + A.y1) / 2}) rotate(-90)`} textAnchor="middle">temperature (°C)</text>

      {/* ── beat 0: the 72 input months ── */}
      <path className="sv-line sv-max pa-in" d={seriesPath(MAX.slice(0, 72), ax, ay, 1)} strokeWidth="1.6" />
      <path className="sv-line sv-min pa-in" d={seriesPath(MIN.slice(0, 72), ax, ay, 1)} strokeWidth="1.6" />
      <g className="pa-b0t" opacity={on(0)}>
        <text className="sv-lab-strong" x={ax(2)} y={ay(30.3) - 9}>max</text>
        <text className="sv-lab-strong" x={ax(8)} y={ay(6.6) + 15}>min</text>
      </g>

      {/* ── beat 1: where the input ends ── */}
      <g className="pa-b1" opacity={on(1)}>
        <line className="pa-grey" x1={GREY_X} x2={GREY_X} y1={A.y0} y2={A.y1} style={{ stroke: 'var(--ink-3)' }} strokeWidth="1.2" />
        <text className="sv-lab" x={GREY_X - 6} y={A.y1 - 6} textAnchor="end">72</text>
        <text className="sv-lab" x={GREY_X + 6} y={A.y1 - 6}>73</text>
        <text className="sv-lab-strong" x={GREY_X} y={A.y0 - 9} textAnchor="middle">input ends · 72.5</text>
      </g>

      {/* ── beat 2: the 12 target months, dashed, a dot per month ── */}
      <g clipPath={`url(#${clip})`}>
        <path className="sv-line sv-max" d={seriesPath(MAX.slice(72), ax, ay, 73)} strokeWidth="1.4" strokeDasharray="4 3" />
        <path className="sv-line sv-min" d={seriesPath(MIN.slice(72), ax, ay, 73)} strokeWidth="1.4" strokeDasharray="4 3" />
      </g>
      {MAX.slice(72).map((v, j) => (
        <circle key={`x${j}`} className="sv-fmax pa-dot" cx={ax(73 + j)} cy={ay(v)} r={2.6} opacity={on(2)} />
      ))}
      {MIN.slice(72).map((v, j) => (
        <circle key={`n${j}`} className="sv-fmin pa-dot" cx={ax(73 + j)} cy={ay(v)} r={2.6} opacity={on(2)} />
      ))}
      <g className="pa-b2" opacity={on(2)}>
        <path className="sv-ink2" d={bracket(ax(1) - 2, GREY_X - 3, A.y1 + 46, -6)} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={(ax(1) + GREY_X) / 2} y={A.y1 + 60} textAnchor="middle">X_test[95] · months 1–72 · solid</text>
        <path className="sv-ink2" d={bracket(GREY_X + 3, ax(84) + 3, A.y1 + 46, -6)} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={(GREY_X + ax(84)) / 2} y={A.y1 + 60} textAnchor="middle">y_test[95]</text>
        <text className="sv-lab" x={(GREY_X + ax(84)) / 2} y={A.y1 + 73} textAnchor="middle">73–84 · dashed</text>
      </g>

      {/* ── the key, built up like the notebook's legend ── */}
      <text className="sv-cap" x={KX} y={64}>Legend, as in the notebook</text>
      {KEY.map((r, j) => (
        <g key={r.k} className={`pa-key-${r.b} ${r.b === 0 ? 'pa-b0t' : r.b === 2 ? 'pa-b2' : 'pa-b3'}`} opacity={on(r.b)}>
          {r.kind === 'in' && <line className={r.cls} x1={KX} x2={KX + 26} y1={KY(j) - 4} y2={KY(j) - 4} strokeWidth="1.6" />}
          {r.kind === 'tg' && (
            <>
              <line className={r.cls} x1={KX} x2={KX + 26} y1={KY(j) - 4} y2={KY(j) - 4} strokeWidth="1.4" strokeDasharray="4 3" />
              <circle className={r.f} cx={KX + 13} cy={KY(j) - 4} r={2.6} />
            </>
          )}
          {r.kind === 'pr' && (
            <>
              <line className={r.cls} x1={KX} x2={KX + 26} y1={KY(j) - 4} y2={KY(j) - 4} strokeWidth="1.4" strokeDasharray="1.5 2.5" />
              <Cross x={KX + 13} y={KY(j) - 4} cls={r.cls} />
            </>
          )}
          <text className="sv-lab" x={KX + 34} y={KY(j)}>{r.k}</text>
        </g>
      ))}
      <text className="sv-lab pa-b0t" x={KX} y={KY(6) + 4} opacity={on(0)}>max: red in the notebook</text>
      <text className="sv-lab pa-b3" x={KX} y={KY(6) + 20} opacity={on(3)}>predicted: only with y_pred</text>

      {/* ── beat 3: model 2's one-month target ── */}
      <g className="pa-b3" opacity={on(3)}>
        <text className="sv-lab-strong" x={I.x0 - 20} y={I.y0 - 12}>model 2 · y_test[:, :1]</text>
        <rect className="sv-axis" x={I.x0} y={I.y0} width={I.x1 - I.x0} height={I.y1 - I.y0} />
        {[10, 20, 30].map((t) => (
          <g key={t}>
            <line className="sv-grid" x1={I.x0} x2={I.x1} y1={iy(t)} y2={iy(t)} />
            <text className="sv-lab" x={I.x0 - 5} y={iy(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path className="sv-line sv-max pa-in3" d={seriesPath(MAX.slice(60, 72), ix, iy, 61)} strokeWidth="1.5" />
        <path className="sv-line sv-min pa-in3" d={seriesPath(MIN.slice(60, 72), ix, iy, 61)} strokeWidth="1.5" />
        <line x1={ix(72.5)} x2={ix(72.5)} y1={I.y0} y2={I.y1} style={{ stroke: 'var(--ink-3)' }} strokeWidth="1.2" />
        <circle className="sv-fmax pa-dot3" cx={ix(73)} cy={iy(MAX[72])} r={3.2} />
        <circle className="sv-fmin pa-dot3" cx={ix(73)} cy={iy(MIN[72])} r={3.2} />
        <text className="sv-lab" x={ix(61)} y={I.y1 + 14}>61</text>
        <text className="sv-lab" x={ix(73)} y={I.y1 + 14} textAnchor="middle">73</text>
        <text className="sv-lab" x={I.x0 - 20} y={I.y1 + 30}>one month: only the dot shows</text>
      </g>

      {/* ── beat 4: indices=SHOW ── */}
      <g className="pa-b4" opacity={on(4)}>
        <text className="sv-lab-strong" x={40} y={364}>indices=SHOW · drawn once in In [7] · the same three rows for every model</text>
        {TH.map((t, i) => {
          const tx = lin(-3.15, 88.15, t.x0, t.x1);
          const ty = lin(3, 34, t.y1, t.y0);
          const mn = col(t.seq, 0);
          const mx = col(t.seq, 1);
          return (
            <g key={t.k}>
              <text className="sv-lab-strong" x={(t.x0 + t.x1) / 2} y={t.y0 - 8} textAnchor="middle">sequence {t.k}</text>
              <rect className="sv-axis" x={t.x0} y={t.y0} width={t.x1 - t.x0} height={t.y1 - t.y0} />
              <path className="sv-max pa-th" d={seriesPath(mx.slice(0, 72), tx, ty, 1)} strokeWidth="1.2" fill="none" />
              <path className="sv-min pa-th" d={seriesPath(mn.slice(0, 72), tx, ty, 1)} strokeWidth="1.2" fill="none" />
              <path className="sv-max" d={seriesPath(mx.slice(72), tx, ty, 73)} strokeWidth="1.1" strokeDasharray="3 2" fill="none" />
              <path className="sv-min" d={seriesPath(mn.slice(72), tx, ty, 73)} strokeWidth="1.1" strokeDasharray="3 2" fill="none" />
              <line x1={tx(72.5)} x2={tx(72.5)} y1={t.y0} y2={t.y1} style={{ stroke: 'var(--ink-3)' }} strokeWidth="1" />
              {i === 0 && (
                <>
                  <text className="sv-lab" x={t.x0 - 5} y={ty(27) + 4} textAnchor="end">max</text>
                  <text className="sv-lab" x={t.x0 - 5} y={ty(11) + 4} textAnchor="end">min</text>
                </>
              )}
            </g>
          );
        })}
        <text className="sv-lab" x={40} y={474}>used by Out [10], Out [13], Out [14] and Out [17]: models 1, 2 (one month and recursive) and 3</text>
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
  tl.set(q('.pa-b0t, .pa-b1, .pa-b2, .pa-dot, .pa-b3, .pa-b4'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.pa-tclip'), { attr: { width: 0 }, immediateRender: true }, 0);

  beat(0, 0);
  draw('.pa-in', 'b0', 2);
  tl.fromTo(q('.pa-b0t'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12 }, 'b0+=1.4');

  beat(1, '+=0.5');
  tl.fromTo(q('.pa-b1'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b1');
  tl.fromTo(q('.pa-grey'), { attr: { y2: A.y0 } }, { attr: { y2: A.y1 }, duration: 0.7, ease: 'power2.out' }, 'b1');

  beat(2, '+=0.8');
  tl.fromTo(q('.pa-tclip'), { attr: { width: 0 } }, { attr: { width: A.x1 - GREY_X }, duration: 1.2, ease: 'none' }, 'b2');
  q('.pa-dot').forEach((d, j) => {
    const k = j % 12;
    tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2 }, `b2+=${0.05 + k * 0.085}`);
  });
  tl.fromTo(q('.pa-b2'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.1 }, 'b2+=0.9');

  beat(3, '+=0.9');
  tl.fromTo(q('.pa-b3'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12 }, 'b3');
  draw('.pa-in3', 'b3+=0.2', 0.8);
  tl.fromTo(q('.pa-dot3'), { attr: { r: 0 } }, { attr: { r: 3.2 }, duration: 0.35, ease: 'back.out(1.3)', stagger: 0.1 }, 'b3+=1');

  beat(4, '+=1');
  tl.fromTo(q('.pa-b4'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4');
  draw('.pa-th', 'b4+=0.2', 1.2);
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  {
    t: 'Input: 72 months, solid', fx: 0,
    c: 'Test sequence 95: 72 input months as solid lines, minimum blue, maximum orange (red in the notebook). The x axis counts positions in the window: not a date, and not a calendar month.',
  },
  { t: 'A grey line where the input ends', fx: 0.45, c: 'axvline(72.5) puts a thin grey line between month 72, the last month the model is given, and month 73, the first it has to forecast.' },
  {
    t: 'Target: 12 months, dashed with dots', fx: 0.75,
    c: 'The 12 target months are dashed, with a dot per month: the real future the model is scored against. Predictions, when y_pred is passed, are dotted with crosses.',
  },
  {
    t: 'Model 2: a single target month', fx: 1,
    c: 'Model 2’s plot passes y_test[:, :1], so each channel’s target is one month. A dashed line needs two points, so only the dot shows, which is why the function gives targets markers.',
  },
  {
    t: 'The same three sequences for every model', fx: 0,
    c: 'Left to itself the function picks three rows at random. In [7] draws SHOW (95, 259, 140) once and every model’s test plot passes indices=SHOW, so the four prediction figures compare month for month.',
  },
];

export default function PanelAnatomyScene({ id = 'panel' }) {
  return (
    <Scene
      id={id}
      label="Test sequence 95 drawn as a display_temperatures panel: 72 input months solid, a grey line at month 72.5, 12 target months dashed with dots; then model 2's one-month target; then the three SHOW sequences 95, 259 and 140 used for every model"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
    />
  );
}
