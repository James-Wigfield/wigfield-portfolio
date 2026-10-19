import Scene from '../../scene/Scene';
import { lin, seriesPath } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — one channel, one scale  (plate 10·1)
   train_seq as two stacked sheets (channel 0 min, channel 1 max), six real
   training rows drawn on each. train_seq[:, :, 1] slides the max sheet out:
   (1522, 84). The six rows' values pooled into one histogram, with the
   notebook's single mean and std (24.70, 5.11 — Out [20]) over all of them;
   a z-score ruler beside the °C ruler; then a ledger against part (i)'s
   per-channel pair (MEAN [12.22, 24.69], STD [3.8, 5.1] — Out [7]).
   The histogram is of the six rows shown; the statistics are the notebook's.
   ========================================================================== */

const W = 800;
const H = 482;
const ROWS = ['0', '500', '566', '1000', '1101', '1474'].map((k) => SERIES.trainSeqs[k]);
const MAX_MEAN = 24.7;
const MAX_STD = 5.11;

// sheets: 18px header + 144px body; 6 rows of 24px
const SW = 200;
const HD = 18;
const BODY = 144;
const MINS = { x: 36, y: 86 };
const MAXS = { x: 54, y: 68 };
const SLIDE = { x: 276, y: 18 }; // max sheet → (330, 86)
const rowY = (i) => HD + i * 24;
const mx = lin(1, 84, 8, SW - 8);

// pooled values on the right, °C ruler aligned with the sheet body after the slide
const VY = lin(14, 37, MINS.y + HD + BODY, MINS.y + HD);
const AX = 572; // °C axis
const ZX = 740; // z ruler
const BINS = Array.from({ length: 23 }, (_, i) => 14 + i);
const COUNTS = BINS.map((b) => ROWS.reduce((n, r) => n + r.filter((m) => m[1] >= b && m[1] < b + 1).length, 0));
const CMAX = Math.max(...COUNTS);
const barW = (c) => (c / CMAX) * 74;

function Sheet({ x, y, ch, label, dom }) {
  const ry = lin(dom[0], dom[1], 22, 2);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="sv-box-strong" x={0} y={0} width={SW} height={HD + BODY} />
      <rect className="sv-fill-ground2" x={0.5} y={0.5} width={SW - 1} height={HD - 1} />
      <line className="sv-axis" x1={0} x2={SW} y1={HD} y2={HD} />
      {label && <text className="sv-lab-strong" x={6} y={13}>{label}</text>}
      {ROWS.map((r, i) => (
        <g key={i} transform={`translate(0 ${rowY(i)})`}>
          {i > 0 && <line className="sv-grid" x1={4} x2={SW - 4} y1={0} y2={0} />}
          <path className={`${ch ? 'sv-max' : 'sv-min'} mc-spark`} d={seriesPath(r.map((m) => m[ch]), mx, ry)} strokeWidth="1.2" fill="none" />
        </g>
      ))}
    </g>
  );
}

const TABLE = [
  ['channels', 'min and max, one pair each', 'max only'],
  ['mean', '[12.22, 24.69]', '24.70'],
  ['std', '[3.8, 5.1]', '5.11'],
  ['computed over', 'X_train: months 1–72 of each window', 'x_train_max: all 84 months'],
  ['applied', 'inside each model (Normalization)', 'once, before training: z_train'],
  ['loss measured in', '°C² (MSE after invert=True)', 'z-score units'],
];
const TX = [36, 176, 470];
const TY0 = 318;
const TR = 22;

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Part (ii) data · In [20]</text>
      <text className="sv-lab-strong" x={MINS.x} y={44}>train_seq · (1522, 84, 2)</text>
      <text className="sv-lab" x={MINS.x} y={58}>six of the 1522 rows drawn</text>

      {/* the block: min in front, max behind; the max sheet slides out. The
          left-behind min sheet fades, but its label stays at full opacity (ink-2:
          it sits on the sheet's header band) so it keeps its contrast */}
      <g className="mc-min" opacity={step >= 1 ? 0.35 : 0}>
        <Sheet x={MINS.x} y={MINS.y} ch={0} label={null} dom={[2, 23]} />
      </g>
      <text className="sv-lab mc-minlab" x={MINS.x + 6} y={MINS.y + 13} style={{ fill: 'var(--ink-2)' }} opacity={on(1)}>[:, :, 0] · min</text>
      <g className="mc-maxwrap" transform={step >= 1 ? `translate(${SLIDE.x} ${SLIDE.y})` : undefined}>
        <Sheet x={MAXS.x} y={MAXS.y} ch={1} label="[:, :, 1] · max" dom={[14, 37]} />
      </g>
      {/* the front sheet is drawn again on top until the slide, so the max sheet sits behind it */}
      <g className="mc-front" opacity={step >= 1 ? 0 : 1}>
        <Sheet x={MINS.x} y={MINS.y} ch={0} label="[:, :, 0] · min" dom={[2, 23]} />
      </g>
      <text className="sv-lab" x={MINS.x} y={MINS.y + HD + BODY + 16}>84 months →</text>

      {/* beat 1: the slice */}
      <g className="mc-b1" opacity={on(1)}>
        <text className="sv-lab-strong" x={MAXS.x + SLIDE.x} y={MINS.y - 14}>x_train_max = train_seq[:, :, 1]</text>
        <text className="sv-lab-strong" x={MAXS.x + SLIDE.x} y={MINS.y + HD + BODY + 16}>(1522, 84)</text>
        <text className="sv-lab" x={MAXS.x + SLIDE.x} y={MINS.y + HD + BODY + 30}>validation: x_val_max (313, 84)</text>
        <path className="sv-faint" d={`M${MINS.x + SW + 22} ${MINS.y + HD + BODY / 2}H${MAXS.x + SLIDE.x - 12}`} strokeWidth="1.3" />
        <path className="sv-faint" d={`M${MAXS.x + SLIDE.x - 18} ${MINS.y + HD + BODY / 2 - 4}L${MAXS.x + SLIDE.x - 12} ${MINS.y + HD + BODY / 2}L${MAXS.x + SLIDE.x - 18} ${MINS.y + HD + BODY / 2 + 4}`} strokeWidth="1.3" />
      </g>

      {/* beat 2: every value pooled, one mean, one std */}
      <g className="mc-b2" opacity={on(2)}>
        <text className="sv-lab-strong" x={AX + 10} y={MINS.y - 14}>pooled</text>
        <rect className="sv-fill-ground2" x={AX} y={VY(MAX_MEAN + MAX_STD)} width={ZX - AX - 24} height={VY(MAX_MEAN - MAX_STD) - VY(MAX_MEAN + MAX_STD)} />
        <line className="sv-axis" x1={AX} x2={AX} y1={VY(37)} y2={VY(14)} />
        {[15, 20, 25, 30, 35].map((t) => (
          <g key={t}>
            <line className="sv-axis" x1={AX - 4} x2={AX} y1={VY(t)} y2={VY(t)} />
            <text className="sv-lab" x={AX - 7} y={VY(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <text className="sv-lab" x={AX - 7} y={VY(37) - 6} textAnchor="end">°C</text>
        {BINS.map((b, i) => (
          <rect key={b} className="sv-fmax mc-bar" x={AX + 1} y={VY(b + 1) + 0.6} width={barW(COUNTS[i])} height={VY(b) - VY(b + 1) - 1.2} opacity={0.7} />
        ))}
        <line className="sv-ink" x1={AX} x2={ZX - 24} y1={VY(MAX_MEAN)} y2={VY(MAX_MEAN)} strokeWidth="1.6" />
        <text className="sv-lab-strong" x={AX + 92} y={VY(MAX_MEAN) - 5}>mean 24.70</text>
        {/* on the ± std band: ink-2, not ink-3, for contrast */}
        <text className="sv-lab" x={AX + 92} y={VY(MAX_MEAN + MAX_STD) + 13} style={{ fill: 'var(--ink-2)' }}>± std 5.11</text>
      </g>

      {/* beat 3: a z-score ruler beside the °C ruler */}
      <g className="mc-b3" opacity={on(3)}>
        <text className="sv-lab-strong" x={ZX + 6} y={MINS.y - 14} textAnchor="middle">z</text>
        <line className="sv-ink2" x1={ZX} x2={ZX} y1={VY(MAX_MEAN + 2 * MAX_STD) - 4} y2={VY(MAX_MEAN - 2 * MAX_STD) + 4} />
        {[-2, -1, 0, 1, 2].map((z) => (
          <g key={z}>
            <line className="sv-ink2" x1={ZX} x2={ZX + 5} y1={VY(MAX_MEAN + z * MAX_STD)} y2={VY(MAX_MEAN + z * MAX_STD)} />
            <text className="sv-lab-strong" x={ZX + 9} y={VY(MAX_MEAN + z * MAX_STD) + 4}>{z < 0 ? `−${-z}` : z}</text>
          </g>
        ))}
        <text className="sv-num" x={(AX + ZX) / 2 + 10} y={MINS.y + HD + BODY + 16} textAnchor="middle">z = (x − 24.70) / 5.11</text>
        <text className="sv-lab" x={(AX + ZX) / 2 + 10} y={MINS.y + HD + BODY + 30} textAnchor="middle">same shape, new ruler</text>
      </g>

      {/* beat 4: against part (i) */}
      <g className="mc-b4" opacity={on(4)}>
        <line className="sv-axis" x1={TX[0]} x2={W - 30} y1={TY0 - 16} y2={TY0 - 16} />
        <text className="sv-cap" x={TX[1]} y={TY0}>Part (i) · GRU models · In/Out [7]</text>
        <text className="sv-cap" x={TX[2]} y={TY0}>Part (ii) · VAE · In/Out [20]</text>
        <line className="sv-axis" x1={TX[0]} x2={W - 30} y1={TY0 + 8} y2={TY0 + 8} />
        {TABLE.map((r, i) => (
          <g key={r[0]} className="mc-row">
            <text className="sv-lab" x={TX[0]} y={TY0 + 26 + i * TR}>{r[0]}</text>
            <text className="sv-lab-strong" x={TX[1]} y={TY0 + 26 + i * TR}>{r[1]}</text>
            <text className="sv-lab-strong" x={TX[2]} y={TY0 + 26 + i * TR}>{r[2]}</text>
            <line className="sv-grid" x1={TX[0]} x2={W - 30} y1={TY0 + 33 + i * TR} y2={TY0 + 33 + i * TR} />
          </g>
        ))}
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  tl.set(q('.mc-b1, .mc-b2, .mc-b3, .mc-b4'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.mc-min, .mc-minlab'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.mc-maxwrap'), { x: 0, y: 0, immediateRender: true }, 0);
  tl.set(q('.mc-bar'), { attr: { width: 0 }, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.mc-maxwrap, .mc-front'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.2 }, 'b0');
  q('.mc-front .mc-spark, .mc-maxwrap .mc-spark').forEach((p, i) => {
    const L = p.getTotalLength();
    tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1, ease: 'power1.inOut', immediateRender: true }, `b0+=${0.3 + (i % 6) * 0.12}`);
  });

  beat(1, '+=0.6');
  tl.fromTo(q('.mc-front'), { opacity: 1 }, { opacity: 0, duration: 0.5, immediateRender: false }, 'b1');
  tl.fromTo(q('.mc-min'), { opacity: 0 }, { opacity: 0.35, duration: 0.5 }, 'b1');
  tl.fromTo(q('.mc-minlab'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b1');
  tl.fromTo(q('.mc-maxwrap'), { x: 0, y: 0 }, { x: SLIDE.x, y: SLIDE.y, duration: 1.1, ease: 'power3.inOut' }, 'b1+=0.1');
  tl.fromTo(q('.mc-b1'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1+=1');

  beat(2, '+=0.8');
  tl.fromTo(q('.mc-b2'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  q('.mc-bar').forEach((el, i) => {
    tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: barW(COUNTS[i]) }, duration: 0.6, ease: 'power2.out' }, `b2+=${0.2 + i * 0.03}`);
  });

  beat(3, '+=1.2');
  tl.fromTo(q('.mc-b3'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');

  beat(4, '+=1.2');
  tl.fromTo(q('.mc-b4'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b4');
  tl.fromTo(q('.mc-row'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.18 }, 'b4');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'Two channels in one block', fx: 0,
    c: 'train_seq holds 1522 sequences × 84 months × 2 channels: index 0 is the monthly mean minimum, index 1 the maximum. Six of the rows are drawn on each sheet.',
  },
  {
    t: 'Keep channel 1', fx: 0.4,
    c: 'train_seq[:, :, 1] keeps the maximum and drops the channel axis: x_train_max is (1522, 84) and x_val_max (313, 84), full 84-month sequences with no input/target split.',
  },
  {
    t: 'One mean, one standard deviation', fx: 0.9,
    c: 'Every value in x_train_max is pooled into a single mean and standard deviation, 24.70 and 5.11 °C. The histogram is of the six rows shown; the two numbers use all of them.',
  },
  {
    t: 'A z-score ruler', fx: 1,
    c: 'z = (x − 24.70) / 5.11 relabels the axis without changing any shape: 24.70 °C becomes 0 and each 5.11 °C one unit. The VAE takes z_train in and must give z_train back.',
  },
  {
    // the two value columns side by side (the row labels are the cut side at 390 px)
    t: 'Not part (i)’s pair', fx: 0.36,
    c: 'Part (i) scaled each channel inside its models, using X_train’s 72 input months. Here one channel is scaled once, before training, over all 84 months: mean 24.70, not 24.69.',
  },
];

export default function MaxChannelScene({ id = 'max-channel' }) {
  return (
    <Scene
      id={id}
      label="The training tensor as two sheets, minimum and maximum; the maximum sheet is sliced out as a 1522 by 84 array, its values pooled into one mean of 24.70 and standard deviation of 5.11, shown on a z-score ruler, and compared with part one's per-channel statistics"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[4]}
    />
  );
}
