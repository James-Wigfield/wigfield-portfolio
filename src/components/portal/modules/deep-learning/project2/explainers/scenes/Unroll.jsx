import Scene from '../../scene/Scene';
import { lin, seriesPath, range } from '../../scene/geom';
import { SERIES } from '../../data/series';
import fig20 from '../../figures/cell20_0.png';

/* ============================================================================
   SCENE — model 1 unrolled over one 72-month window  (§6 Model 1)
   Bottom to top, the way the data flows: the real input months of test
   sequence 95 (SERIES), the Normalization layer, GRU layer 1 run once per
   month and handing every month's state up (return_sequences=True), GRU
   layer 2 keeping only its last state, then the head on the right: the
   16-number state → Dense(24) → Reshape(12, 2) → inverted Normalization.
   The cells are the mechanism (no activations drawn); the shapes and
   parameter counts are the ones model1.summary() prints (Out [8]).

   Seq95Scene (m1-unroll-b): what came out for that same window — the
   notebook's own test panel for sequence 95 (Out [10], first panel, shown at
   its native size) with the two regions cell 21 discusses outlined. Overlay
   positions come from the figure's axes: month m at x 72 + 4.6875·m, °C t at
   y 334 − 9·(t − 5).
   ========================================================================== */

const W = 800;
const H = 456;
const TOP = 24; // the viewBox starts above y = 0 so the schematic badge clears the reshape grid's labels
// month 1 starts far enough right that the left labels (return_sequences=True,
// the Normalization lines) end clear of the stems
const XA = 196; // left edge of month 1
const PM = 4.7; // one month
const cx = (m) => XA + (m - 1) * PM + 1.8; // centre of month m
const XEND = XA + 72 * PM;
const CY1 = 200; // GRU layer 1 row
const CY2 = 118; // GRU layer 2 row
const CELL = { w: 3.6, h: 20 };
const NORM_Y = 250;
const L2_DIM = 0.35; // layer 2's inner states stay inside the layer
const yT = lin(5, 33, 352, 272); // °C on the input plot
const SEQ = SERIES.testSeqs['95'].slice(0, 72);
const MINS = SEQ.map((r) => r[0]);
const MAXS = SEQ.map((r) => r[1]);
const MONTHS = range(72, 1);

// head
const STATE = { x: 556, y0: CY2 - 56, pitch: 7, w: 8, h: 5.5 };
const SLOT = { x: 624, y0: 34, pitch: 7, w: 10, h: 5 };
const GRID = { x: [672, 700], y0: 34, pitch: 14, w: 20, h: 10 };
const slotY = (j) => SLOT.y0 + j * SLOT.pitch;
const gridX = (j) => GRID.x[j % 2];
const gridY = (j) => GRID.y0 + Math.floor(j / 2) * GRID.pitch;
const TX = 572; // head text column

function LeftLabel({ y, name, lines, cls }) {
  return (
    <g className={cls}>
      <text className="sv-lab-strong" x={24} y={y}>{name}</text>
      {lines.map((l, i) => (
        <text key={i} className={`sv-lab ${l.cls || ''}`} x={24} y={y + 14 * (i + 1)} opacity={l.op ?? 1}>{l.t}</text>
      ))}
    </g>
  );
}

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Model 1 · one window, unrolled over 72 months</text>

      {/* ── input: sequence 95, months 1–72 (real data) ── */}
      <LeftLabel y={292} name="x · test sequence 95" lines={[{ t: '(None, None, 2)' }, { t: 'here (N, 72, 2) · °C' }]} />
      {[1, 12, 24, 36, 48, 60, 72].map((m) => (
        <g key={m}>
          <line className="sv-axis" x1={cx(m)} x2={cx(m)} y1={358} y2={362} />
          <text className="sv-lab" x={cx(m)} y={375} textAnchor="middle">{m}</text>
        </g>
      ))}
      <line className="sv-axis" x1={XA} x2={XEND} y1={358} y2={358} />
      <path className="sv-line sv-max ur-x" d={seriesPath(MAXS, cx, yT)} strokeWidth="1.5" />
      <path className="sv-line sv-min ur-x" d={seriesPath(MINS, cx, yT)} strokeWidth="1.5" />
      <g className="ur-xlab">
        <text className="sv-lab-strong" x={XEND + 6} y={yT(MAXS[71]) + 4}>max</text>
        <text className="sv-lab-strong" x={XEND + 6} y={yT(MINS[71]) + 4}>min</text>
      </g>

      {/* ── normalization ── */}
      <g className="ur-norm">
        <line className="sv-faint" x1={XA - 4} x2={XEND + 4} y1={NORM_Y} y2={NORM_Y} strokeDasharray="2 3" />
        {/* two short lines, so the label ends well clear of the month stems */}
        <LeftLabel y={NORM_Y - 4} name="normalization" lines={[{ t: '°C → z-scores' }, { t: '0 params' }]} />
      </g>

      {/* ── GRU layer 1 ── */}
      <LeftLabel
        y={CY1 - 10}
        name="gru · 960"
        lines={[{ t: 'return_sequences=True' }, { t: '→ (N, 72, 16)', cls: 'ur-s1', op: on(1) }]}
      />
      <line className="sv-faint ur-rec1" x1={XA - 4} x2={XEND + 2} y1={CY1} y2={CY1} strokeWidth="1" opacity={on(1)} />
      {MONTHS.map((m) => (
        <g key={m}>
          <line className="sv-grid ur-in" x1={cx(m)} x2={cx(m)} y1={268} y2={CY1 + CELL.h / 2 + 1} opacity={on(1)} />
          <line className="sv-faint ur-up" x1={cx(m)} x2={cx(m)} y1={CY1 - CELL.h / 2 - 1} y2={CY2 + CELL.h / 2 + 1} strokeWidth="0.8" opacity={on(1) * 0.7} />
          <rect className="sv-box" x={cx(m) - CELL.w / 2} y={CY1 - CELL.h / 2} width={CELL.w} height={CELL.h} />
          <rect className="sv-fm1 ur-on1" x={cx(m) - CELL.w / 2} y={CY1 - CELL.h / 2} width={CELL.w} height={CELL.h} opacity={on(1)} />
        </g>
      ))}

      {/* ── GRU layer 2 ── */}
      <LeftLabel y={CY2 - 10} name="gru_1 · 1,632" lines={[{ t: 'last state only' }, { t: '→ (N, 16)', cls: 'ur-s2', op: on(2) }]} />
      <line className="sv-faint ur-rec2" x1={XA - 4} x2={XEND + 2} y1={CY2} y2={CY2} strokeWidth="1" opacity={on(2)} />
      {MONTHS.map((m) => (
        <g key={m}>
          <rect className="sv-box" x={cx(m) - CELL.w / 2} y={CY2 - CELL.h / 2} width={CELL.w} height={CELL.h} />
          <rect className="sv-fm1 ur-on2" x={cx(m) - CELL.w / 2} y={CY2 - CELL.h / 2} width={CELL.w} height={CELL.h} opacity={on(2) * (m === 72 ? 1 : L2_DIM)} />
        </g>
      ))}

      {/* layer 2's last state → the head */}
      <g className="ur-out" opacity={on(2)}>
        <path className="sv-ink" d={`M${XEND + 1} ${CY2} H ${STATE.x - 5}`} strokeWidth="1.4" />
        <path className="sv-ink" d={`M${STATE.x - 10} ${CY2 - 4} L ${STATE.x - 4} ${CY2} L ${STATE.x - 10} ${CY2 + 4}`} strokeWidth="1.4" />
        <text className="sv-lab-strong" x={STATE.x + STATE.w / 2} y={STATE.y0 - 10} textAnchor="middle">h(72)</text>
        {range(16).map((i) => (
          <rect key={i} className="ur-st" x={STATE.x} y={STATE.y0 + i * STATE.pitch} width={STATE.w} height={STATE.h} style={{ fill: 'var(--ink-2)' }} />
        ))}
      </g>
      <g className="ur-big" opacity={on(2)}>
        <text className="sv-big" x={XA} y={420}>144 → 16</text>
        <text className="sv-lab" x={XA + 118} y={414}>72 months × 2 channels in one window,</text>
        <text className="sv-lab" x={XA + 118} y={428}>16 numbers in the state the Dense layer sees</text>
      </g>

      {/* ── Dense(24) ── */}
      <g className="ur-dense" opacity={on(3)}>
        <path
          className="sv-fill-ground2"
          d={`M${STATE.x + 12} ${STATE.y0} L ${SLOT.x - 4} ${SLOT.y0} L ${SLOT.x - 4} ${slotY(23) + SLOT.h} L ${STATE.x + 12} ${STATE.y0 + 15 * STATE.pitch + STATE.h} Z`}
          style={{ stroke: 'var(--line)' }}
        />
        {/* text on a band takes --ink-2 (--ink-3 on ground-2 is 4.0:1 in jade) */}
        <text className="sv-lab" x={(STATE.x + SLOT.x) / 2 + 4} y={CY2 + 4} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>×W</text>
        <text className="sv-lab" x={TX} y={224}>dense · 16 × 24 + 24 = 408</text>
      </g>
      {range(24).map((j) => (
        <rect key={j} className="ur-slot" x={SLOT.x} y={slotY(j)} width={SLOT.w} height={SLOT.h} style={{ fill: 'var(--ink-3)' }} opacity={on(3)} />
      ))}

      {/* ── Reshape(12, 2) ── */}
      <g className="ur-grid" opacity={on(4)}>
        <text className="sv-lab-strong" x={GRID.x[0] + GRID.w / 2} y={26} textAnchor="middle">min</text>
        <text className="sv-lab-strong" x={GRID.x[1] + GRID.w / 2} y={26} textAnchor="middle">max</text>
        {range(12).map((i) => (
          <g key={i}>
            <rect className="sv-box" x={GRID.x[0]} y={GRID.y0 + i * GRID.pitch} width={GRID.w} height={GRID.h} />
            <rect className="sv-box" x={GRID.x[1]} y={GRID.y0 + i * GRID.pitch} width={GRID.w} height={GRID.h} />
            <text className="sv-lab" x={GRID.x[1] + GRID.w + 8} y={GRID.y0 + i * GRID.pitch + 9}>{73 + i}</text>
          </g>
        ))}
        <text className="sv-lab" x={TX} y={240}>reshape · (N, 12, 2)</text>
      </g>
      {range(24).map((j) => (
        <rect key={j} className={`ur-tint ${j % 2 ? 'sv-fmax' : 'sv-fmin'}`} x={SLOT.x} y={slotY(j)} width={SLOT.w} height={SLOT.h} opacity={on(4)} />
      ))}
      {range(24).map((j) => (
        <rect
          key={j}
          className={`ur-fly ${j % 2 ? 'sv-fmax' : 'sv-fmin'}`}
          x={step >= 4 ? gridX(j) : SLOT.x}
          y={step >= 4 ? gridY(j) : slotY(j)}
          width={step >= 4 ? GRID.w : SLOT.w}
          height={step >= 4 ? GRID.h : SLOT.h}
          opacity={step >= 5 ? 0.9 : step >= 4 ? 0.45 : 0}
        />
      ))}

      {/* ── back to °C ── */}
      <g className="ur-denorm" opacity={on(5)}>
        <path className="sv-ink2" d={`M${GRID.x[1] + GRID.w + 30} ${GRID.y0} h 5 V ${gridY(23) + GRID.h} h -5`} strokeWidth="1.2" />
        <text className="sv-lab-strong" x={GRID.x[1] + GRID.w + 42} y={(GRID.y0 + gridY(23) + GRID.h) / 2 + 4}>°C</text>
        <text className="sv-lab" x={TX} y={256}>normalization_1 · invert=True</text>
        <text className="sv-lab" x={TX} y={272}>x · std + mean, per channel</text>
        <text className="sv-lab" x={TX} y={288}>min 3.8, 12.22 · max 5.1, 24.69</text>
        <text className="sv-lab-strong" x={TX} y={312}>out (N, 12, 2) in °C</text>
        <text className="sv-lab" x={TX} y={328}>MSE loss in °C² · MAE in °C</text>
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
  // one summed offset per position: GSAP reads 'b1+=0.05+=0.03' as 'b1+=0.05'
  const sweep = (els, label, start, per, to = 1) =>
    els.forEach((el, i) => tl.fromTo(el, { opacity: 0 }, { opacity: to, duration: 0.18 }, `${label}+=${(start + i * per).toFixed(3)}`));

  tl.set(q('.ur-xlab, .ur-norm, .ur-in, .ur-up, .ur-on1, .ur-on2, .ur-out, .ur-big, .ur-dense, .ur-slot, .ur-grid, .ur-tint, .ur-fly, .ur-denorm'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.ur-s1, .ur-s2'), { opacity: 0, immediateRender: true }, 0);
  q('.ur-fly').forEach((el, j) => tl.set(el, { attr: { x: SLOT.x, y: slotY(j), width: SLOT.w, height: SLOT.h }, immediateRender: true }, 0));

  // 0 · the window comes in, through the Normalization layer
  beat(0, 0);
  draw('.ur-x', 'b0', 1.6);
  tl.fromTo(q('.ur-xlab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=1.3');
  tl.fromTo(q('.ur-norm'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b0+=1.5');

  // 1 · layer 1 runs month by month and hands every state up
  beat(1, '+=0.5');
  const per = 0.03;
  draw('.ur-rec1', 'b1', 72 * per + 0.2);
  sweep(q('.ur-in'), 'b1', 0, per);
  sweep(q('.ur-on1'), 'b1', 0.05, per);
  sweep(q('.ur-up'), 'b1', 0.12, per, 0.7);
  tl.fromTo(q('.ur-s1'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, `b1+=${72 * per}`);

  // 2 · layer 2 keeps only its last state
  beat(2, '+=0.6');
  draw('.ur-rec2', 'b2', 72 * per + 0.2);
  q('.ur-on2').forEach((el, i) => tl.fromTo(el, { opacity: 0 }, { opacity: i === 71 ? 1 : L2_DIM, duration: 0.18 }, `b2+=${(0.05 + i * per).toFixed(3)}`));
  tl.fromTo(q('.ur-out'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, `b2+=${72 * per + 0.1}`);
  tl.fromTo(q('.ur-s2'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, `b2+=${72 * per + 0.1}`);
  tl.fromTo(q('.ur-st'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.3, stagger: 0.02 }, `b2+=${72 * per + 0.2}`);
  tl.fromTo(q('.ur-big'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, `b2+=${72 * per + 0.6}`);

  // 3 · Dense(24): 16 numbers become 24, with no structure yet
  beat(3, '+=0.8');
  tl.fromTo(q('.ur-dense'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');
  tl.fromTo(q('.ur-slot'), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.03 }, 'b3+=0.3');

  // 4 · Reshape reads them two at a time: even slots → min, odd → max
  beat(4, '+=0.8');
  tl.fromTo(q('.ur-grid'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4');
  tl.fromTo(q('.ur-tint'), { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.04 }, 'b4+=0.2');
  q('.ur-fly').forEach((el, j) => {
    tl.fromTo(
      el,
      { opacity: 0, attr: { x: SLOT.x, y: slotY(j), width: SLOT.w, height: SLOT.h } },
      { opacity: 0.45, attr: { x: gridX(j), y: gridY(j), width: GRID.w, height: GRID.h }, duration: 0.55, ease: 'power2.inOut' },
      `b4+=${(0.5 + j * 0.07).toFixed(2)}`,
    );
  });

  // 5 · the inverted Normalization puts °C back
  beat(5, '+=0.8');
  tl.fromTo(q('.ur-fly'), { opacity: 0.45 }, { opacity: 0.9, duration: 0.5, stagger: 0.015, immediateRender: false }, 'b5');
  tl.fromTo(q('.ur-denorm'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b5+=0.2');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  {
    t: 'One window in',
    fx: 0,
    c: 'Test sequence 95: 72 months of min and max in °C. Keras prints the input as (None, None, 2): any batch, any length, two channels. Normalization turns both into z-scores.',
  },
  {
    t: 'Layer 1, month by month',
    fx: 0,
    c: 'The first GRU runs once per month with the same weights, carrying its 16-number state to the right. return_sequences=True hands every month’s state up: (N, 72, 16).',
  },
  {
    t: 'Layer 2 keeps the last',
    fx: 0.45,
    c: 'The second GRU reads those 72 states and returns only its final one, (N, 16). The 144 numbers in the window are now 16.',
  },
  {
    t: 'Dense(24)',
    fx: 1,
    c: 'One Dense layer maps the 16 numbers to 24 in a single step (16 × 24 weights + 24 biases = 408). No forecast month is fed into another.',
  },
  {
    t: 'Reshape to (12, 2)',
    fx: 1,
    c: 'Reshape reads the 24 numbers in order, two per row: even slots become minimums, odd slots maximums, for months 73–84. Training makes the Dense layer fill each slot to match.',
  },
  {
    t: 'Back to °C',
    fx: 1,
    c: 'The inverted Normalization multiplies each channel by its std and adds its mean, so the forecast comes out in °C and the MSE loss is in °C².',
  },
];

export default function UnrollScene({ id = 'm1-unroll' }) {
  return (
    <Scene
      id={id}
      label="Model 1 unrolled over 72 months of test sequence 95: GRU layer 1 hands every month's 16-number state to GRU layer 2, which passes only its final state to a Dense layer of 24 that is reshaped to 12 months of minimum and maximum and converted back to degrees"
      viewBox={`0 ${-TOP} ${W} ${H + TOP}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
      schematic="colours mark structure, not values"
    />
  );
}

/* ── what came out for sequence 95 (the notebook's figure) ─────────────── */

// the stage title sits at (24, 24) as on every stage; the figure starts 20 units under it
const H95 = 396;
const F95 = { x: 16, y: 36, sx: 0, sy: 40, sw: 492, sh: 352 };
const px = (sx) => F95.x + sx - F95.sx; // native scale
const py = (sy) => F95.y + sy - F95.sy;
const mx = (m) => px(72 + 4.6875 * m);
const ty = (t) => py(334 - 9 * (t - 5));
const SUMMER = { x0: mx(73.4), x1: mx(76.6), y0: ty(33.2), y1: ty(26.6) };
const TROUGH = { x0: mx(78.3), x1: mx(81.7), y0: ty(19.8), y1: ty(13.3) };
const TC95 = 528;
const F95X1 = F95.x + F95.sw; // the figure's right edge
// overlays on the notebook's (always white) figure use a fixed near-black, as on
// the lead-month plot; a leader switches to the theme ink where it leaves the figure
const INK = '#1d1d1d';
const ON_FIG = { stroke: INK, fill: 'none' };

function art95(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <defs>
        <clipPath id={`${uid}f95`}>
          <rect x={F95.x} y={F95.y} width={F95.sw} height={F95.sh} />
        </clipPath>
      </defs>
      <rect x={F95.x} y={F95.y} width={F95.sw} height={F95.sh} style={{ fill: '#fff', stroke: 'var(--line-2)' }} />
      <g clipPath={`url(#${uid}f95)`}>
        <image href={fig20} x={px(0)} y={py(0)} width={1390} height={425} preserveAspectRatio="none" />
      </g>
      <text className="sv-cap" x={24} y={24}>Notebook figure · test sequence 95</text>

      {/* the panel's encoding (its legend sits under all three panels) */}
      <g className="s95-key">
        <text className="sv-lab" x={TC95} y={316}>solid · input months 1–72</text>
        <text className="sv-lab" x={TC95} y={331}>dots, dashed · recorded 73–84</text>
        <text className="sv-lab" x={TC95} y={346}>crosses, dotted · model 1’s forecast</text>
        <text className="sv-lab" x={TC95} y={361}>blue = minimum · red = maximum</text>
      </g>

      <g className="s95-b1" opacity={on(1)}>
        <rect x={SUMMER.x0} y={SUMMER.y0} width={SUMMER.x1 - SUMMER.x0} height={SUMMER.y1 - SUMMER.y0} rx={3} style={{ ...ON_FIG, strokeWidth: 1.6 }} />
        <path d={`M${SUMMER.x1} ${(SUMMER.y0 + SUMMER.y1) / 2} H ${F95X1}`} strokeWidth="1.2" style={ON_FIG} />
        <path className="sv-accent" d={`M${F95X1} ${(SUMMER.y0 + SUMMER.y1) / 2} H ${TC95 - 6}`} strokeWidth="1.2" fill="none" />
        <text className="sv-lab-strong" x={TC95} y={(SUMMER.y0 + SUMMER.y1) / 2 + 4}>summer peak · months 74–76</text>
        <text className="sv-lab" x={TC95} y={(SUMMER.y0 + SUMMER.y1) / 2 + 19}>within two or three degrees</text>
      </g>

      <g className="s95-b2" opacity={on(2)}>
        <rect x={TROUGH.x0} y={TROUGH.y0} width={TROUGH.x1 - TROUGH.x0} height={TROUGH.y1 - TROUGH.y0} rx={3} style={{ ...ON_FIG, strokeWidth: 1.6 }} />
        <path d={`M${TROUGH.x1} ${TROUGH.y1 - 8} H ${F95X1}`} strokeWidth="1.2" style={ON_FIG} />
        <path className="sv-accent" d={`M${F95X1} ${TROUGH.y1 - 8} H ${TC95 - 6}`} strokeWidth="1.2" fill="none" />
        <text className="sv-lab-strong" x={TC95} y={TROUGH.y1 - 26}>winter trough · months 79–81</text>
        <text className="sv-lab" x={TC95} y={TROUGH.y1 - 4}>predicted about 17.5 to 19 °C</text>
        <text className="sv-lab" x={TC95} y={TROUGH.y1 + 11}>Bickley recorded 14 to 16 °C</text>
      </g>
    </>
  );
}

function build95(tl, { q, beat }) {
  tl.set(q('.s95-b1, .s95-b2'), { opacity: 0, immediateRender: true }, 0);
  beat(0, 0);
  tl.fromTo(q('.s95-key'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b0+=0.3');
  beat(1, '+=1');
  tl.fromTo(q('.s95-b1'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b1');
  tl.fromTo(q('.s95-b1 rect'), { scale: 1.6, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(1.3)' }, 'b1');
  beat(2, '+=1.4');
  tl.fromTo(q('.s95-b2'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b2');
  tl.fromTo(q('.s95-b2 rect'), { scale: 1.6, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(1.3)' }, 'b2');
  tl.to({}, { duration: 1.4 });
}

// narrow screens: keep the forecast months, the outlined regions and their labels in view
const FX95 = 1; // the right edge, so the key's longest line ends clear of an edge fade
const BEATS_95 = [
  {
    t: 'Sequence 95 at Bickley',
    fx: FX95,
    c: 'The notebook’s own test panel for sequence 95, the window drawn above: the 72 input months, then the 12 recorded months and model 1’s forecast of them.',
  },
  { t: 'The summer peak', fx: FX95, c: 'The shape of the year comes through, and the summer peaks of the maximum land within two or three degrees.' },
  {
    t: 'The winter trough',
    fx: FX95,
    c: 'In winter the model predicts about 17.5 to 19 °C where Bickley recorded 14 to 16: the forecast trough sits well above the real one.',
  },
];

export function Seq95Scene({ id = 'm1-unroll-b' }) {
  return (
    <Scene
      id={id}
      label="The notebook's test panel for sequence 95 with model 1's 12-month forecast: the summer peak lands within two or three degrees, the winter trough is predicted at about 17.5 to 19 degrees where Bickley recorded 14 to 16"
      viewBox={`0 0 ${W} ${H95}`}
      beats={BEATS_95}
      art={art95}
      build={build95}
      keyframes={[2]}
    />
  );
}
