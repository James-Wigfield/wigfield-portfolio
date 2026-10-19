import Scene from '../../scene/Scene';
import { lin, pathOf, fmt } from '../../scene/geom';
import fig from '../../figures/cell38_0.png';

/* ============================================================================
   SCENE 9·3 — lead months against horizons, on the notebook's own figure
   The real Out [19] figure (cell38_0.png, 689×390) with overlays calibrated
   to its axes, measured from the PNG: x ticks 0…25 at px 65…671, y ticks
   1.0…1.7 at px 306…62 (spines x 62–674, y 31–336, grey line at 12.5 = px 368).
   Overlay values are only the notebook's readings in cell 39 (1.10, 1.19,
   about 1.75 at lead month 22, worse from lead month 19). Every month on
   this scene is a lead month (lead month 1 = month 73, plate 9·1). The
   figure also shows model 3 below model 2 over lead months 14–18, so the
   last caption says the lead was banked before lead month 19, not in the
   first year alone (cell 39's looser sentence is quoted on the plate). The
   strip underneath plots
   the horizon MAEs of Out [18] at the same x positions: horizon h = the mean
   of lead months 1…h, so the shaded band and the strip move together.
   Overlays on the white figure use a fixed dark ink so they read in every
   theme, each label on a white backing rather than a stroked halo (a stroked
   text prints twice in the PDF's text layer). The figure's four lines get
   direct labels at their right ends, read from the PNG, and the header names
   all four matplotlib colours (model 2 blue, model 3 orange, seasonal naive
   green dashed, climatology red dashed), so they are never taken for the
   page's own. The strip below sits on the
   theme surface in the page's model colours (model 2 aqua, model 3 violet,
   as in 9·2 and 13·1), with its own key and a different marker shape per
   model (square, circle), so identity never rests on hue alone.
   ========================================================================== */

const W = 800;
const H = 646;
const FX = 56;
const FY = 46;
const FW = 689;
const FH = 390;
const px = (m) => FX + 65 + (m * (671 - 65)) / 25; // lead month → viewBox x
const py = (v) => FY + 306 - ((v - 1.0) * (306 - 62)) / 0.7; // MAE → viewBox y
const PLOT = { top: FY + 31, bottom: FY + 336 };
const INK = '#1d1d1d';
const CW = 6.6; // mono advance at 11 px, for the label backings

/* a label on the white figure: dark ink on a white backing */
function Tag({ x, y, text, anchor = 'start', bold = false }) {
  const w = text.length * CW;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <>
      <rect x={x0 - 3} y={y - 10} width={w + 6} height={14} fill="#ffffff" fillOpacity="0.94" />
      <text x={x} y={y} textAnchor={anchor} style={{ fill: INK, fontSize: 11, fontWeight: bold ? 600 : 400 }}>{text}</text>
    </>
  );
}

// the figure's lines at month 24, read from the PNG: model 3 1.72, model 2 1.47,
// seasonal naive 1.25, climatology 0.95 — labels sit just clear of each line
const ENDS = [
  { text: 'model 3', v: 1.655 },
  { text: 'model 2', v: 1.405 },
  { text: 'seasonal naive', v: 1.29 },
  { text: 'climatology', v: 1.0 },
];

// strip: horizon MAE (Out [18]) at x = px(h)
const HS = [12, 15, 18, 21, 24];
const M2 = [1.407, 1.422, 1.452, 1.468, 1.47];
const M3 = [1.321, 1.343, 1.374, 1.417, 1.457];
const SY0 = 486;
const SY1 = 576;
const sy = lin(1.25, 1.5, SY1, SY0);
// the page's model colours; model 2 square markers, model 3 round ones
const LINES = [
  { key: 'm2', label: 'model 2', cls: 'sv-m2', fill: 'sv-fm2', shape: 'square', vals: M2, mark: -11, dy: -6 },
  { key: 'm3', label: 'model 3', cls: 'sv-m3', fill: 'sv-fm3', shape: 'circle', vals: M3, mark: 18, dy: 9 },
];
const KEY_Y = SY0 - 14;
// at h = 24 the two values (1.470, 1.457) sit under 5 px apart, so their markers are
// drawn 2.5 px further apart; the lines and the printed values keep the true values
const NUDGE = { m2: -2.5, m3: 2.5 };

function Marker({ s, x, y }) {
  if (s.shape === 'square') return <rect className={s.fill} x={x - 4.5} y={y - 4.5} width={9} height={9} style={{ stroke: 'var(--surface)' }} strokeWidth="1.5" />;
  return <circle className={s.fill} cx={x} cy={y} r="4.6" style={{ stroke: 'var(--surface)' }} strokeWidth="1.5" />;
}
const bandW = (h) => px(h + 0.5) - px(0.5);
const clipW = (h) => px(h) - px(12) + 16;

function art(step, uid) {
  const on = (b) => (step >= b ? 1 : 0);
  const hatch = `${uid}hatch`;
  const clip = `${uid}strip`;
  const hNow = step >= 2 ? 24 : 0;
  return (
    <>
      <defs>
        <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeOpacity="0.28" strokeWidth="1.2" />
        </pattern>
        <clipPath id={clip}>
          <rect className="lm-clip" x={px(12) - 8} y={SY0 - 30} width={hNow ? clipW(hNow) : 0} height={SY1 - SY0 + 60} />
        </clipPath>
      </defs>

      <text className="sv-cap" x={24} y={24}>The notebook’s figure · Out [19] · in its own colours</text>
      <text className="sv-lab" x={24} y={38}>model 2 blue · model 3 orange · seasonal naive green, dashed · climatology red, dashed</text>

      {/* the figure */}
      <g className="lm-fig">
        <rect x={FX} y={FY} width={FW} height={FH} fill="#ffffff" />
        <image href={fig} x={FX} y={FY} width={FW} height={FH} preserveAspectRatio="xMidYMid meet" />
        {ENDS.map((e) => (
          <Tag key={e.text} x={px(24) + 4} y={py(e.v)} text={e.text} anchor="end" bold />
        ))}
      </g>

      {/* beat 1: one month out */}
      <g className="lm-b1" opacity={on(1)}>
        <circle cx={px(1)} cy={py(1.1)} r="7" fill="none" stroke={INK} strokeWidth="1.5" />
        <circle cx={px(1)} cy={py(1.19)} r="7" fill="none" stroke={INK} strokeWidth="1.5" />
        {/* two lines, so a narrow stage at its left edge frames all of it */}
        <Tag x={px(1) - 8} y={py(1.045) + 4} text="lead month 1:" />
        <Tag x={px(1) - 8} y={py(1.045) + 18} text="model 3 1.10 · model 2 1.19" />
      </g>

      {/* beat 2: the shaded months 1…h */}
      <rect className="lm-band" x={px(0.5)} y={PLOT.top} width={hNow ? bandW(hNow) : 0} height={PLOT.bottom - PLOT.top} fill={INK} fillOpacity="0.075" />
      <line className="lm-edge" x1={px(0.5) + (hNow ? bandW(hNow) : 0)} x2={px(0.5) + (hNow ? bandW(hNow) : 0)} y1={PLOT.top} y2={PLOT.bottom} stroke={INK} strokeWidth="1.3" opacity={on(2)} />
      {HS.map((h) => (
        <text key={h} className={`sv-lab lm-hl lm-hl-${h}`} x={px(h + 0.5) - 3} y={FY + FH + 14} textAnchor="end" opacity={step >= 2 && h === 24 ? 1 : 0}>
          lead months 1–{h} shaded
        </text>
      ))}

      {/* beat 3: worse from lead month 19 */}
      <g className="lm-b3" opacity={on(3)}>
        <rect x={px(18.5)} y={PLOT.top} width={px(24.5) - px(18.5)} height={PLOT.bottom - PLOT.top} fill={`url(#${hatch})`} />
        <line x1={px(18.5)} x2={px(18.5)} y1={PLOT.top} y2={PLOT.bottom} stroke={INK} strokeWidth="1" strokeDasharray="3 3" />
        <Tag x={px(21.5)} y={py(1.11)} text="model 3 worse" anchor="middle" bold />
        <Tag x={px(21.5)} y={py(1.07)} text="from lead month 19" anchor="middle" />
        <circle cx={px(22)} cy={py(1.75)} r="7" fill="none" stroke={INK} strokeWidth="1.5" />
        <line x1={px(22)} x2={px(22)} y1={FY + 22} y2={py(1.75) - 8} stroke={INK} strokeWidth="1" />
        <Tag x={px(22)} y={FY + 18} text="about 1.75" anchor="middle" />
      </g>

      {/* ── the strip: horizon MAE at the same x ── */}
      <g className="lm-b2" opacity={on(2)}>
        <text className="sv-cap" x={FX} y={KEY_Y}>Horizon MAE · Out [18]</text>
        {/* the strip's own key: the document's colours, one marker shape per model */}
        {LINES.map((s, k) => {
          const kx = 252 + k * 92;
          return (
            <g key={s.key}>
              <line className={`sv-line ${s.cls}`} x1={kx} x2={kx + 22} y1={KEY_Y - 4} y2={KEY_Y - 4} strokeWidth="2" />
              <Marker s={s} x={kx + 11} y={KEY_Y - 4} />
              <text className="sv-lab-strong" x={kx + 28} y={KEY_Y}>{s.label}</text>
            </g>
          );
        })}
        <text className="sv-lab" x={444} y={KEY_Y}>in this document’s colours, as in plate 9·2</text>
        <text className="sv-lab" x={FX} y={SY0 + 16}>each point is the mean of the</text>
        <text className="sv-lab" x={FX} y={SY0 + 30}>shaded lead months 1 … h</text>
        <text className="sv-lab" x={FX} y={SY1 + 22}>axis from 1.25 °C</text>
        {[1.3, 1.4, 1.5].map((t) => (
          <g key={t}>
            <line className="sv-grid" x1={px(11.4)} x2={px(24.6)} y1={sy(t)} y2={sy(t)} />
            <text className="sv-lab" x={px(11.4) - 6} y={sy(t) + 4} textAnchor="end">{fmt(t, 1)}</text>
          </g>
        ))}
        <line className="sv-axis" x1={px(11.4)} x2={px(24.6)} y1={SY1 + 6} y2={SY1 + 6} />
        {HS.map((h) => (
          <g key={h}>
            <line className="sv-axis" x1={px(h)} x2={px(h)} y1={SY1 + 6} y2={SY1 + 10} />
            <text className="sv-lab" x={px(h)} y={SY1 + 22} textAnchor="middle">{h}</text>
          </g>
        ))}
        <text className="sv-lab" x={px(11.4) - 6} y={SY1 + 22} textAnchor="end">h =</text>
      </g>
      <g clipPath={`url(#${clip})`} className="lm-b2" opacity={on(2)}>
        {LINES.map((s) => (
          <path key={s.key} className={`sv-line ${s.cls}`} d={pathOf(HS.map((h, i) => [px(h), sy(s.vals[i])]))} strokeWidth="2" />
        ))}
      </g>
      {HS.map((h, i) => (
        <g key={h} className={`lm-mp lm-mp-${i}`} opacity={on(2)}>
          {LINES.map((s) => (
            <Marker key={s.key} s={s} x={px(h)} y={sy(s.vals[i]) + (i === 4 ? NUDGE[s.key] : 0)} />
          ))}
          {(i === 0 || i === 4) &&
            LINES.map((s) => (
              <text key={s.key} className="sv-num" x={px(h)} y={sy(s.vals[i]) + s.mark} textAnchor="middle" style={{ fontSize: 11 }}>
                {fmt(s.vals[i], 3)}
              </text>
            ))}
          {/* the line names arrive with the lines' last points */}
          {i === 4 &&
            LINES.map((s) => (
              <text key={s.key} className="sv-lab-strong" x={px(24) + 28} y={sy(s.vals[4]) + 4 + s.dy}>{s.label}</text>
            ))}
        </g>
      ))}

      <g className="lm-b3" opacity={on(3)}>
        {/* under the strip, so a narrow stage that ends on the right half frames them with the data */}
        <text className="sv-lab-strong" x={px(12)} y={SY1 + 44}>per lead month: model 3 worse from 19</text>
        <text className="sv-lab-strong" x={px(12)} y={SY1 + 60}>on average: model 3 still ahead</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  tl.set(q('.lm-b1, .lm-b2, .lm-b3, .lm-mp, .lm-hl, .lm-edge'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.lm-band'), { attr: { width: 0 }, immediateRender: true }, 0);
  tl.set(q('.lm-edge'), { attr: { x1: px(0.5), x2: px(0.5) }, immediateRender: true }, 0);
  tl.set(q('.lm-clip'), { attr: { width: 0 }, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.lm-fig'), { opacity: 0 }, { opacity: 1, duration: 0.8 }, 'b0');

  beat(1, '+=1.4');
  tl.fromTo(q('.lm-b1'), { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.3)' }, 'b1');

  beat(2, '+=1.2');
  tl.fromTo(q('.lm-b2'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  tl.fromTo(q('.lm-edge'), { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, 'b2');
  // band, edge, clip and labels each take several tweens: t=0 is set above, so none may render early
  const later = { immediateRender: false };
  let prev = 0;
  // positions are 'b2+=<one number>': GSAP reads only the first offset of 'b2+=a+=b'
  const pos = (t) => `b2+=${t.toFixed(3)}`;
  HS.forEach((h, i) => {
    const off = i === 0 ? 0.3 : 0.3 + 1.1 + (i - 1) * 1.0;
    const at = pos(off);
    const dur = i === 0 ? 1.1 : 0.7;
    const w0 = prev ? bandW(prev) : 0;
    tl.fromTo(q('.lm-band'), { attr: { width: w0 } }, { attr: { width: bandW(h) }, duration: dur, ease: 'power1.inOut', ...later }, at);
    tl.fromTo(q('.lm-edge'), { attr: { x1: px(0.5) + w0, x2: px(0.5) + w0 } }, { attr: { x1: px(0.5) + bandW(h), x2: px(0.5) + bandW(h) }, duration: dur, ease: 'power1.inOut', ...later }, at);
    tl.fromTo(q('.lm-clip'), { attr: { width: prev ? clipW(prev) : 0 } }, { attr: { width: clipW(h) }, duration: i === 0 ? 0.2 : dur, ease: 'power1.inOut', ...later }, i === 0 ? pos(off + 0.9) : at);
    tl.fromTo(q(`.lm-mp-${i}`), { opacity: 0 }, { opacity: 1, duration: 0.25 }, pos(off + dur - 0.1));
    // the label names months 1–h only once the band has reached h
    if (prev) tl.fromTo(q(`.lm-hl-${prev}`), { opacity: 1 }, { opacity: 0, duration: 0.15, ...later }, at);
    tl.fromTo(q(`.lm-hl-${h}`), { opacity: 0 }, { opacity: 1, duration: 0.15, ...later }, pos(off + dur - 0.08));
    prev = h;
  });

  beat(3, '+=1.0');
  tl.fromTo(q('.lm-b3'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.4 }, 'b3');
  tl.to({}, { duration: 1.6 });
}

const BEATS = [
  {
    t: 'Error at each lead month',
    c: 'The notebook’s own figure. Point k is the error at lead month k alone (its “months ahead”), averaged over the 297 test windows and both channels.',
    fx: 0,
  },
  {
    t: 'Lead month 1',
    c: 'Model 3’s decoder starts lower: 1.10 °C at lead month 1, against 1.19 for model 2.',
    fx: 0,
  },
  {
    t: 'A horizon is a running average',
    c: 'The mean of the shaded lead months 1 to h is the horizon MAE (Out [18]). Each step adds three lead months; the early ones stay in the mean.',
    fx: 1,
  },
  {
    t: 'Worse per month, ahead on average',
    c: 'From lead month 19 model 3 is worse, yet averages 1.457 against 1.470, a lead banked before then: mostly in the first year and again over lead months 14–18.',
    fx: 1,
  },
];

export default function LeadMonthsScene() {
  return (
    <Scene
      id="lead-months"
      label="The notebook's error-by-lead-month figure with lead months 1 to h shaded for h from 12 to 24, and the matching horizon MAEs of models 2 and 3 plotted underneath at the same positions"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[3]}
    />
  );
}
