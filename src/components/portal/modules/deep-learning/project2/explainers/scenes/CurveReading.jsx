import Scene from '../../scene/Scene';
import { range } from '../../scene/geom';
import fig18 from '../../figures/cell18_0.png';

/* ============================================================================
   SCENE — reading a learning curve  (plate 5·3)
   Top: one epoch as a mechanism — 48 batches, the weights changing after each,
   the training loss as the epoch average of the batch losses, then one validation
   pass with the end-of-epoch weights (the batch losses are illustrative).
   The schematic is drawn in neutral inks (batch bars ink-3, training loss
   ink-2, validation ink), so the only colours on the stage are the notebook
   figure's own blue (training) and orange (validation).
   Bottom: the notebook's own model 1 figure (Out [9]) with rings and tags at
   the points the text reads: epoch 1, the dotted best-epoch line, the values
   printed for that epoch (val_loss 1.5473, val MAE 0.988).
   Marks over the figure use fixed colours, never theme tokens: the figure stays
   white in every theme, so rings and leaders are near-black #1d1d1d on a white
   halo and tags are #1d1d1d text on a white backing (decisions.md; the label
   style of LeadMonths.jsx).
   ========================================================================== */

const W = 800;
const H = 568;

// ── one epoch ──
const BX0 = 66;
const BX1 = 540;
const BY = 170; // bar baseline
const BH = 100; // bar height for loss 1
const NB = 48;
const SW = (BX1 - BX0) / NB;
const bxc = (k) => BX0 + (k - 0.5) * SW; // centre of batch k (1-based)
// illustrative batch losses for an early epoch: fast fall, then noise
const LOSS = range(NB, 1).map((k) => 0.15 + 0.82 * Math.exp(-(k - 1) / 9) + 0.025 * Math.sin(k * 2.7) + 0.015 * Math.cos(k * 5.1));
const MEAN = LOSS.reduce((a, b) => a + b, 0) / NB;
const VAL = 0.13;
const ly = (v) => BY - v * BH;
const VX = 668; // validation dot
const BAR_O = 0.42; // batch bars: a light neutral under the ink-2 training line

// ── the notebook's figure (1090 × 377 px), placed at FX, FY, scale S ──
const FX = 20;
const FY = 242;
const FW = 760;
const S = FW / 1090;
const FH = 377 * S;
const fx = (px) => FX + px * S;
const fy = (py) => FY + py * S;
// read off the figure: left axes 58–531 × 50–323, right axes 607–1080;
// epoch e at x = 73 + 6.6·e (left) and 622 + 6.6·e (right)
const EP = (e, right = false) => fx((right ? 622 : 73) + 6.6 * e);
const P = {
  trainE1: [EP(1), fy(62)],
  valE1: [EP(1), fy(236.5)],
  bestLoss: [EP(46), fy(308.5)],
  bestMae: [EP(46, true), fy(305.6)],
};

const INK = '#1d1d1d';
const CW = 6.6; // mono advance at 11 px, for the tag backings

function Ring({ at, r = 7, cls = '' }) {
  return (
    <g className={cls}>
      <circle cx={at[0]} cy={at[1]} r={r} fill="none" stroke="#ffffff" strokeWidth="4" />
      <circle cx={at[0]} cy={at[1]} r={r} fill="none" stroke={INK} strokeWidth="1.6" />
    </g>
  );
}

/* a label on the white figure: dark ink on a white backing, first line bold */
function Tag({ x, y, lines, cls = '' }) {
  const w = Math.max(...lines.map((t) => t.length)) * CW;
  return (
    <g className={cls}>
      <rect x={x} y={y} width={w + 14} height={8 + lines.length * 14} fill="#ffffff" fillOpacity="0.94" />
      {lines.map((t, i) => (
        <text key={t} x={x + 7} y={y + 16 + i * 14} style={{ fill: INK, fontSize: 11, fontWeight: i === 0 ? 600 : 400 }}>{t}</text>
      ))}
    </g>
  );
}

function Leader({ from, to, cls = '' }) {
  const d = `M${from[0]} ${from[1]}L${to[0]} ${to[1]}`;
  return (
    <g className={cls}>
      <path d={d} stroke="#ffffff" strokeWidth="3.5" fill="none" />
      <path d={d} stroke={INK} strokeWidth="1.2" fill="none" />
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      {/* ── one epoch ── */}
      <text className="sv-cap" x={24} y={24}>One epoch · 48 batches, then validation</text>
      <text className="sv-lab" x={BX0 - 8} y={ly(1) + 4} textAnchor="end">loss</text>
      <line className="sv-axis" x1={BX0 - 4} x2={BX1 + 4} y1={BY} y2={BY} />
      <line className="sv-axis" x1={BX0 - 4} x2={BX0 - 4} y1={ly(1.05)} y2={BY} />
      {[1, 12, 24, 36, 48].map((k) => (
        <text key={k} className="sv-lab" x={bxc(k)} y={BY + 15} textAnchor="middle">{k}</text>
      ))}
      <text className="sv-lab" x={BX1 + 4} y={BY + 30} textAnchor="end">batch</text>
      {LOSS.map((v, i) => (
        <rect key={i} className="cr-bar" x={bxc(i + 1) - SW * 0.32} y={ly(v)} width={SW * 0.64} height={v * BH} style={{ fill: 'var(--ink-3)' }} opacity={BAR_O} />
      ))}
      <line className="cr-head" x1={BX1} x2={BX1} y1={ly(1.05)} y2={BY} style={{ stroke: 'var(--ink-2)' }} strokeWidth="1.2" />
      <text className="sv-lab cr-headlab" x={BX1 - 6} y={ly(1.05) + 2} textAnchor="end">weights after batch 48</text>
      <text className="sv-lab cr-b0t" x={bxc(2)} y={ly(1.05) - 8} opacity={on(0)}>Adam changes the weights after every batch</text>

      {/* beat 1: the epoch's training loss = the average over its windows */}
      <g className="cr-b1" opacity={on(1)}>
        <line className="sv-ink2" x1={BX0} x2={BX1} y1={ly(MEAN)} y2={ly(MEAN)} strokeWidth="2.2" />
        <text className="sv-lab-strong" x={bxc(17)} y={ly(MEAN) - 8}>training loss = epoch average</text>
      </g>

      {/* beat 2: one validation pass with the end-of-epoch weights */}
      <g className="cr-b2" opacity={on(2)}>
        <path className="sv-faint" d={`M${BX1 + 8} ${ly(0.47)}H${VX - 50}`} strokeWidth="1.3" />
        <path className="sv-faint" d={`M${VX - 56} ${ly(0.47) - 4}L${VX - 50} ${ly(0.47)}L${VX - 56} ${ly(0.47) + 4}`} strokeWidth="1.3" />
        <text className="sv-lab-strong" x={VX} y={ly(1.02)} textAnchor="middle">then validation</text>
        <text className="sv-lab" x={VX} y={ly(1.02) + 14} textAnchor="middle">end-of-epoch weights</text>
        <text className="sv-lab" x={VX} y={ly(1.02) + 28} textAnchor="middle">313 Swanbourne windows</text>
        <text className="sv-lab" x={VX} y={ly(1.02) + 42} textAnchor="middle">no weight updates</text>
        <line className="sv-axis" x1={VX - 54} x2={VX + 54} y1={BY} y2={BY} />
        <line className="sv-ink2" x1={VX - 54} x2={VX + 54} y1={ly(MEAN)} y2={ly(MEAN)} strokeWidth="1.2" strokeDasharray="3 3" />
        <text className="sv-lab" x={VX + 60} y={ly(MEAN) + 4}>training</text>
        <line className="sv-ink" x1={VX - 30} x2={VX + 30} y1={ly(VAL)} y2={ly(VAL)} strokeWidth="2.2" />
        <circle cx={VX} cy={ly(VAL)} r={4.5} style={{ fill: 'var(--ink)' }} />
        <text className="sv-lab-strong" x={VX + 36} y={ly(VAL) + 4}>val_loss</text>
        <path className="sv-ink2" d={`M${VX - 46} ${ly(MEAN) + 3}V${ly(VAL) - 3}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M${VX - 50} ${ly(VAL) - 8}L${VX - 46} ${ly(VAL) - 3}L${VX - 42} ${ly(VAL) - 8}`} strokeWidth="1.2" fill="none" />
        <text className="sv-lab" x={VX - 54} y={BY + 15}>lower, in epoch 1</text>
      </g>

      {/* ── the notebook's two-panel figure ── */}
      <g className="cr-b3" opacity={on(3)}>
        <text className="sv-lab-strong" x={fx(294.5)} y={FY - 14} textAnchor="middle">left · MSE loss · °C²</text>
        <text className="sv-lab-strong" x={fx(843.5)} y={FY - 14} textAnchor="middle">right · MAE · °C</text>
        <rect x={FX} y={FY} width={FW} height={FH} style={{ fill: '#fff' }} />
        <image href={fig18} x={FX} y={FY} width={FW} height={FH} preserveAspectRatio="xMidYMid meet" />
        <rect className="sv-axis" x={FX} y={FY} width={FW} height={FH} />
        <text className="sv-lab" x={FX} y={FY + FH + 16}>The notebook’s figure, Out [9]: training is blue and validation orange here (matplotlib’s defaults).</text>
      </g>
      <g className="cr-b3k" opacity={on(3)}>
        <Ring at={[fx(376.6), fy(52)]} r={5} />
        <Tag x={fx(386)} y={fy(126)} lines={['best epoch', 'dotted · 46']} />
      </g>

      {/* beat 4: epoch 1, the axis, and the two numbers */}
      <g className="cr-b4" opacity={on(4)}>
        <Ring at={P.trainE1} r={6} />
        <Ring at={P.valE1} r={6} />
        <Leader from={[P.valE1[0] + 6, P.valE1[1] - 4]} to={[fx(150), fy(220)]} />
        <Tag x={fx(150)} y={fy(194)} lines={['epoch 1: validation', 'below training']} />
        <Tag x={fx(94)} y={fy(130)} lines={['y axis runs to 12', 'for epoch 1 alone']} />
        <Ring at={P.bestLoss} r={5} />
        <Ring at={P.bestMae} r={5} />
        <text className="sv-lab-strong" x={FX} y={FY + FH + 36}>Epoch 46: val_loss 1.5473 °C² (left) but val MAE 0.988 °C (right).</text>
        <text className="sv-lab" x={FX} y={FY + FH + 52}>MSE squares each error first, so it is in °C² and its square root, 1.24 °C, sits above the MAE.</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const bars = q('.cr-bar');
  tl.set(q('.cr-b0t, .cr-b1, .cr-b2, .cr-b3, .cr-b3k, .cr-b4, .cr-headlab'), { opacity: 0, immediateRender: true }, 0);
  tl.set(bars, { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.cr-b0t'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0');
  tl.fromTo(q('.cr-head'), { attr: { x1: BX0, x2: BX0 } }, { attr: { x1: BX1, x2: BX1 }, duration: 2.6, ease: 'none' }, 'b0+=0.2');
  bars.forEach((el, i) => {
    const v = LOSS[i];
    tl.fromTo(el, { opacity: 0, attr: { y: BY, height: 0 } }, { opacity: BAR_O, attr: { y: ly(v), height: v * BH }, duration: 0.25, ease: 'power2.out' }, `b0+=${0.2 + (2.6 * i) / NB}`);
  });
  tl.fromTo(q('.cr-headlab'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b0+=2.7');

  beat(1, '+=0.5');
  tl.fromTo(q('.cr-b1'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1');
  const m = q('.cr-b1 line')[0];
  tl.fromTo(m, { attr: { x2: BX0 } }, { attr: { x2: BX1 }, duration: 0.9, ease: 'power2.out' }, 'b1');

  beat(2, '+=1.1');
  tl.fromTo(q('.cr-b2'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b2');

  beat(3, '+=1.4');
  tl.fromTo(q('.cr-b3'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b3');
  tl.fromTo(q('.cr-b3k'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3+=0.8');

  beat(4, '+=1.4');
  tl.fromTo(q('.cr-b4 > g, .cr-b4 > text'), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.25 }, 'b4');
  tl.fromTo(q('.cr-b4'), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 'b4');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: '48 batches, weights moving', fx: 0,
    c: 'Each epoch runs through the 1522 training windows in 48 batches of 32 (the last one 18). After every batch Adam changes the weights, so each batch is scored by a slightly different model.',
  },
  {
    t: 'Training loss: the epoch’s average', fx: 0.15,
    c: 'Keras records the average over the epoch’s 1522 windows: the 48 batch losses, weighted by batch size. Epoch 1’s still carries the large errors made before the weights moved.',
  },
  {
    t: 'Validation: once, at the end', fx: 1,
    c: 'After the last batch the end-of-epoch weights are scored once on the 313 Swanbourne windows, with no updates. That is how a validation loss can start below the training loss.',
  },
  {
    t: 'The notebook’s two panels', fx: 0,
    c: 'plot_learning_curve puts the MSE loss (°C²) on the left and the MAE (°C) on the right, training blue and validation orange, with a dotted line at the epoch whose weights were kept.',
  },
  {
    t: 'Two units, two numbers', fx: 0,
    c: 'At model 1’s best epoch the validation loss is 1.5473 °C² and the validation MAE 0.988 °C: different quantities. Epoch 1’s training loss stretches the loss axis to 12, flattening everything after it.',
  },
];

export default function CurveReadingScene({ id = 'curves' }) {
  return (
    <Scene
      id={id}
      label="One training epoch: 48 batch losses while the weights change, their average as the training loss, then one validation pass with the end-of-epoch weights; below, the notebook's model 1 learning curve with epoch 1, the best-epoch line and the printed values marked"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
      schematic="batch losses illustrative"
    />
  );
}
