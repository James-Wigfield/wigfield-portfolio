import Scene from '../../scene/Scene';
import { lin, pathOf, range } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — scaling inside the model  (plate 5·1)
   Real data and real statistics: the 72 input months of training sequence 566
   (shown in Out [6]) as 144 dots, and the per-channel MEAN [12.22, 24.69] and
   STD [3.8, 5.1] that In [7] prints. Schematic part: tanh is drawn as if it saw
   the temperature itself; in the GRU it sees x·W + h·U + b.
   Raw °C land on tanh's flat top (slope ≈ 0); x̃ = (x − mean)/std moves them
   onto the bend; the Normalization pair does this inside every model, so
   everything outside stays in °C.
   ========================================================================== */

const W = 800;
const H = 478;
const MEAN = [12.22, 24.69];
const STD = [3.8, 5.1];
const SEQ = SERIES.trainSeqs['566'].slice(0, 72);
const tanh = Math.tanh;

const PA = { x0: 56, x1: 356, y0: 72, y1: 212 };
const PB = { x0: 444, x1: 744, y0: 72, y1: 212 };
const axA = lin(-10, 40, PA.x0, PA.x1);
const axB = lin(-3, 3, PB.x0, PB.x1);
const ayA = lin(-1.2, 1.2, PA.y1, PA.y0);
const ayB = lin(-1.2, 1.2, PB.y1, PB.y0);
const curve = (ax, ay, d0, d1) => pathOf(range(241).map((i) => d0 + ((d1 - d0) * i) / 240).map((v) => [ax(v), ay(tanh(v))]));
const CURVE_A = curve(axA, ayA, -10, 40);
const CURVE_B = curve(axB, ayB, -3, 3);
const LEG = { x: axB(1.45), y: ayB(-0.7) }; // panel B's min / max key

// 144 dots: [channel, raw °C, x̃]
const DOTS = [0, 1].flatMap((c) => SEQ.map((r) => [c, r[c], (r[c] - MEAN[c]) / STD[c]]));
const posA = ([, v]) => [axA(v), ayA(tanh(v))];
const posB = ([, , z]) => [axB(z), ayB(tanh(z))];

// pipeline boxes
const BOX_W = 136;
const BOX_H = 66;
const BOX_Y = 338;
const bx = (i) => 20 + i * 156;
const BOXES = [
  { l: ['°C in', 'X  (N, 72, 2)'] },
  { l: ['Normalization', '(x − mean) / √var', '0 params'] },
  { l: ['GRU · GRU · Dense', 'work in z-scores'] },
  { l: ['Normalization', 'invert=True', 'mean + x·√var', '0 params'] },
  { l: ['°C out', 'ŷ  (N, 12, 2)'] },
];

function Axes({ p, ax, ay, ticks, title, sub }) {
  return (
    <g>
      <text className="sv-lab-strong" x={p.x0} y={p.y0 - 22}>{title}</text>
      <text className="sv-lab" x={p.x0} y={p.y0 - 9}>{sub}</text>
      {[1, -1].map((v) => (
        <line key={v} className="sv-grid" x1={p.x0} x2={p.x1} y1={ay(v)} y2={ay(v)} strokeDasharray="2 3" />
      ))}
      <line className="sv-axis" x1={p.x0} x2={p.x1} y1={ay(0)} y2={ay(0)} />
      <line className="sv-axis" x1={ax(0)} x2={ax(0)} y1={p.y0} y2={p.y1} />
      {[1, 0, -1].map((v) => (
        <text key={v} className="sv-lab" x={p.x0 - 6} y={ay(v) + 4} textAnchor="end">{v > 0 ? '+1' : v < 0 ? '−1' : '0'}</text>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line className="sv-axis" x1={ax(t)} x2={ax(t)} y1={p.y1} y2={p.y1 + 4} />
          <text className="sv-lab" x={ax(t)} y={p.y1 + 16} textAnchor="middle">{t < 0 ? `−${-t}` : t}</text>
        </g>
      ))}
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Training sequence 566 into tanh</text>

      {/* ── panel A: raw °C ── */}
      <Axes p={PA} ax={axA} ay={ayA} ticks={[-10, 0, 10, 20, 30, 40]} title="Raw °C into tanh" sub="the value tanh sees, if it were the temperature" />
      <path className="sv-line sv-ink2 sc-curveA" d={CURVE_A} strokeWidth="1.6" />
      <text className="sv-lab" x={PA.x1} y={PA.y1 + 30} textAnchor="end">°C</text>
      <g className="sc-b0t" opacity={on(0)}>
        <text className="sv-lab-strong" x={axA(12)} y={ayA(1) + 18} textAnchor="middle">min</text>
        <text className="sv-lab-strong" x={axA(28)} y={ayA(1) + 18} textAnchor="middle">max</text>
      </g>

      {/* beat 1: the slope out there */}
      <g className="sc-b1" opacity={on(1)}>
        <path className="sv-accent sc-tan" d={`M${axA(-0.85)} ${ayA(-0.85)}L${axA(0.85)} ${ayA(0.85)}`} strokeWidth="2" />
        <text className="sv-lab" x={axA(-1.6)} y={ayA(0.62)} textAnchor="end">slope 1</text>
        <text className="sv-lab" x={axA(-1.6)} y={ayA(0.62) + 13} textAnchor="end">at 0</text>
        <path className="sv-accent" d={`M${axA(4)} ${ayA(1) - 8}H${axA(36)}`} strokeWidth="2" />
        <text className="sv-lab-strong" x={axA(9)} y={ayA(-0.3)}>slope below 0.0002</text>
        <text className="sv-lab" x={axA(9)} y={ayA(-0.3) + 14}>for every value past 5</text>
        <text className="sv-lab" x={axA(9)} y={ayA(-0.3) + 28}>so almost no gradient</text>
      </g>

      {/* ── between: the move ── */}
      <g className="sc-b2" opacity={on(2)}>
        <path className="sv-faint" d={`M${PA.x1 + 14} ${ayA(0)}H${PB.x0 - 18}`} strokeWidth="1.3" />
        <path className="sv-faint" d={`M${PB.x0 - 24} ${ayA(0) - 5}L${PB.x0 - 17} ${ayA(0)}L${PB.x0 - 24} ${ayA(0) + 5}`} strokeWidth="1.3" />
        <text className="sv-lab" x={(PA.x1 + PB.x0) / 2 - 2} y={ayA(0) - 8} textAnchor="middle">scale</text>
      </g>

      {/* ── panel B: z-scores ── */}
      <g className="sc-b2" opacity={on(2)}>
        <Axes p={PB} ax={axB} ay={ayB} ticks={[-3, -2, -1, 0, 1, 2, 3]} title="z-scores into tanh" sub="x̃ = (x − mean) / std, per channel" />
        <text className="sv-lab" x={PB.x1} y={PB.y1 + 30} textAnchor="end">x̃</text>
        {/* key in the empty lower right, out of the dots' path along the top */}
        <circle className="sv-fmin" cx={LEG.x} cy={LEG.y - 4} r={3} />
        <text className="sv-lab" x={LEG.x + 7} y={LEG.y}>min</text>
        <circle className="sv-fmax" cx={LEG.x + 44} cy={LEG.y - 4} r={3} />
        <text className="sv-lab" x={LEG.x + 51} y={LEG.y}>max</text>
      </g>
      <path className="sv-line sv-ink2 sc-curveB" d={CURVE_B} strokeWidth="1.6" opacity={on(2)} />

      {/* the dots: ghosts stay behind in A, the live dots travel to B */}
      {DOTS.map((d, i) => {
        const [x, y] = posA(d);
        return <circle key={`g${i}`} className={`${d[0] ? 'sv-fmax' : 'sv-fmin'} sc-ghost`} cx={x} cy={y} r={2.6} opacity={step >= 2 ? 0.3 : 0} />;
      })}
      {DOTS.map((d, i) => {
        const [x, y] = step >= 2 ? posB(d) : posA(d);
        return <circle key={`d${i}`} className={`${d[0] ? 'sv-fmax' : 'sv-fmin'} sc-dot`} cx={x} cy={y} r={2.6} opacity={0.85} />;
      })}

      {/* the formula band */}
      <g className="sc-b2" opacity={on(2)}>
        <text className="sv-lab-strong" x={W / 2} y={258} textAnchor="middle">x̃ = (x − mean) / std for each channel, with the statistics of X_train</text>
        <circle className="sv-fmin" cx={190} cy={274} r={3.2} />
        <text className="sv-num" x={200} y={278}>min  (x − 12.22) / 3.8</text>
        <circle className="sv-fmax" cx={444} cy={274} r={3.2} />
        <text className="sv-num" x={454} y={278}>max  (x − 24.69) / 5.1</text>
        <text className="sv-lab" x={W / 2} y={298} textAnchor="middle">5 °C minimum → (5 − 12.22) / 3.8 = −1.9   ·   36 °C maximum → (36 − 24.69) / 5.1 = 2.2</text>
      </g>

      {/* ── the Normalization pair, inside every model ── */}
      <g className="sc-b3" opacity={on(3)}>
        {BOXES.map((b, i) => (
          <g key={i} className="sc-box">
            <rect className={i === 0 || i === 4 ? 'sv-box' : 'sv-box-strong'} x={bx(i)} y={BOX_Y} width={BOX_W} height={BOX_H} rx={2} />
            {b.l.map((t, j) => (
              <text
                key={t}
                className={j === 0 ? 'sv-lab-strong' : 'sv-lab'}
                x={bx(i) + BOX_W / 2}
                y={BOX_Y + BOX_H / 2 + 4 + (j - (b.l.length - 1) / 2) * 14}
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {i < 4 && (
              <>
                <path className="sv-faint" d={`M${bx(i) + BOX_W + 3} ${BOX_Y + BOX_H / 2}H${bx(i + 1) - 4}`} strokeWidth="1.3" />
                <path className="sv-faint" d={`M${bx(i + 1) - 9} ${BOX_Y + BOX_H / 2 - 4}L${bx(i + 1) - 4} ${BOX_Y + BOX_H / 2}L${bx(i + 1) - 9} ${BOX_Y + BOX_H / 2 + 4}`} strokeWidth="1.3" />
              </>
            )}
          </g>
        ))}
        <path className="sv-ink2" d={`M${bx(1)} ${BOX_Y - 8}V${BOX_Y - 14}H${bx(3) + BOX_W}V${BOX_Y - 8}`} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={(bx(1) + bx(3) + BOX_W) / 2} y={BOX_Y - 20} textAnchor="middle">inside the model: z-score units</text>
      </g>

      {/* ── everything outside stays in °C ── */}
      <g className="sc-b4" opacity={on(4)}>
        {[0, 4].map((i) => (
          <rect key={i} className="sv-accent" x={bx(i) - 3} y={BOX_Y - 3} width={BOX_W + 6} height={BOX_H + 6} rx={3} strokeWidth="1.6" fill="none" />
        ))}
        <text className="sv-lab-strong" x={bx(0) + BOX_W / 2} y={BOX_Y + BOX_H + 20} textAnchor="middle">°C</text>
        <text className="sv-lab-strong" x={bx(4) + BOX_W / 2} y={BOX_Y + BOX_H + 20} textAnchor="middle">°C</text>
        <text className="sv-lab" x={W / 2} y={BOX_Y + BOX_H + 44} textAnchor="middle">
          targets, predictions, MSE loss in °C², MAE in °C · a forecast month can go straight back into the input
        </text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const draw = (el, at, dur) => {
    const L = el.getTotalLength();
    tl.fromTo(el, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, at);
  };
  const dots = q('.sc-dot');
  tl.set(q('.sc-b0t, .sc-b1, .sc-b2, .sc-ghost, .sc-b3, .sc-b4, .sc-curveB'), { opacity: 0, immediateRender: true }, 0);
  tl.set(dots, { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  draw(q('.sc-curveA')[0], 'b0', 1.1);
  dots.forEach((el, i) => {
    const [x, y] = posA(DOTS[i]);
    tl.fromTo(el, { opacity: 0, attr: { cx: x, cy: y - 34 } }, { opacity: 0.85, attr: { cx: x, cy: y }, duration: 0.45, ease: 'power2.in' }, `b0+=${0.9 + (i % 72) * 0.012 + (i >= 72 ? 0.25 : 0)}`);
  });
  tl.fromTo(q('.sc-b0t'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=2.2');

  beat(1, '+=0.5');
  tl.fromTo(q('.sc-b1'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  draw(q('.sc-tan')[0], 'b1', 0.6);

  beat(2, '+=1.4');
  tl.fromTo(q('.sc-b2'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.15 }, 'b2');
  tl.fromTo(q('.sc-curveB'), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 'b2+=0.3');
  draw(q('.sc-curveB')[0], 'b2+=0.3', 0.9);
  tl.fromTo(q('.sc-ghost'), { opacity: 0 }, { opacity: 0.3, duration: 0.3 }, 'b2+=1');
  // the dots travel as one group along the top (they start on tanh's flat top),
  // clear of the slope note and the "scale" arrow, then drop onto the bend
  dots.forEach((el, i) => {
    const [x0, y0] = posA(DOTS[i]);
    const [x1, y1] = posB(DOTS[i]);
    const at = `b2+=${1 + (i % 72) * 0.003 + (i >= 72 ? 0.12 : 0)}`;
    tl.fromTo(el, { attr: { cx: x0 } }, { attr: { cx: x1 }, duration: 1.1, ease: 'power2.inOut' }, at);
    tl.fromTo(el, { attr: { cy: y0 } }, { attr: { cy: y1 }, duration: 1.1, ease: 'power3.in' }, at);
  });

  beat(3, '+=1');
  tl.fromTo(q('.sc-b3'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b3');
  tl.fromTo(q('.sc-box'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.2 }, 'b3');

  beat(4, '+=1.2');
  tl.fromTo(q('.sc-b4'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b4');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  {
    t: 'Raw temperatures meet tanh', fx: 0,
    c: 'Training sequence 566’s 72 input months, 144 values in °C, all land on tanh’s flat top. Schematic: in the GRU tanh sees x·W + h·U + b, and raw temperatures push that far out too.',
  },
  {
    t: 'Flat means almost no gradient', fx: 0.05,
    c: 'Each weight’s update is scaled by this slope: 1 at zero, below 0.0002 past 5. On raw temperatures a tanh GRU stalled at validation MAE 3.5 °C.',
  },
  {
    t: 'Shift and scale each channel', fx: 1,
    c: 'Subtracting the training mean and dividing by the training standard deviation, per channel, maps 5–36 °C to about −1.9 to 2.2, where tanh bends. These scaled values are called z-scores.',
  },
  {
    t: 'Two fixed layers inside the model', fx: 0.5,
    c: 'A Normalization layer applies (x − mean)/√var going in (var = STD²); one with invert=True applies mean + x·√var going out. Neither is trained: 0 parameters.',
  },
  {
    t: 'Everything outside stays in °C', fx: 0,
    c: 'Targets, predictions, the MSE loss (°C²) and the MAE (°C) all stay in real units, so models 2 and 3 can append a forecast month to their input without rescaling.',
  },
];

export default function ScalingScene({ id = 'scaling' }) {
  return (
    <Scene
      id={id}
      label="Raw temperatures from training sequence 566 sit on the flat top of tanh; after per-channel z-scoring with mean 12.22 and 24.69 and standard deviation 3.8 and 5.1 they spread over the bend; two Normalization layers do this inside each model so inputs, outputs and loss stay in degrees"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
      schematic="tanh input simplified · data and statistics real"
    />
  );
}
