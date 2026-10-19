import { useMemo } from 'react';
import Scene from '../../scene/Scene';
import { lin, pathOf, fmt } from '../../scene/geom';

/* ============================================================================
   SCENE — test MAE against prediction horizon (real numbers, passed in)
   series: [{ key, label, cls, fill, values: [mae@h0, mae@h1, …], beat,
              style: 'solid' | 'dashed' | 'dotted' (+ stroke for the last two),
              marker: 'filled' | 'hollow' (dashed/dotted only; seasonal naive
              is filled grey, climatology hollow — decisions.md),
              note, labelDy,
              marks: { [index]: 'above' | 'below' | 'left' }, rise: { text, x },
              ('left' sits beside its own point, for a value whose label
              above or below would land on another series' marker),
              shape: 'square' (model 2, as in 9·3 and 13·1; default circle),
              nudge: { [index]: dy } — a marker drawn dy px off its value where
              two series' markers would sit on each other (the line and the
              value label keep the true value) }]
   point:  optional single point { label, note, h, value, cls, fill, beat }
           (model 1, which only ever outputs 12 months), drawn on its own
           column with a leader to its label
   Lines reveal through a clip rect, so the dashed baselines keep their dash
   (a dash-offset line draw would take the dasharray over). Values are
   labelled selectively: the marks a series asks for, plus its end label.
   A rise's dotted start-level guide breaks wherever another series' value
   label crosses it.
   ========================================================================== */

const W = 800;
const H = 392;
const X0 = 96;
const X1 = 560;
const Y0 = 58;
const Y1 = 318;
const DASH = { dashed: '6 4', dotted: '1.5 4' };
const LX = X1 + 50; // end labels, right of the rise bars
const HORIZONS = [12, 15, 18, 21, 24];
const NUM_W = 6.6; // mono advance of an 11 px value label
// a value label's anchor point: centred above or below its marker, or ending just left of it
const markAt = (cx, yv, pos) =>
  pos === 'left' ? { x: cx - 9, y: yv + 4, anchor: 'end' } : { x: cx, y: yv + (pos === 'below' ? 19 : -11), anchor: 'middle' };

/* x ranges [a, b] of a horizontal guide at gy, minus the value labels that cross it */
function guideSegments(a, b, gy, boxes) {
  const cuts = boxes.filter((k) => gy >= k.y0 && gy <= k.y1).map((k) => [k.x0, k.x1]).sort((p, q) => p[0] - q[0]);
  const out = [];
  let from = a;
  cuts.forEach(([c0, c1]) => {
    if (c1 <= from || c0 >= b) return;
    if (c0 > from) out.push([from, c0]);
    from = Math.max(from, c1);
  });
  if (from < b) out.push([from, b]);
  return out;
}

function makeArt({ horizons, series, point, lo, hi, step: tickStep, unit }) {
  const x = lin(horizons[0], horizons[horizons.length - 1], X0 + 34, X1); // inset: first labels clear the y axis
  const y = lin(lo, hi, Y1, Y0);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += tickStep) ticks.push(Number(v.toFixed(3)));
  // every value label's box, so other series' guides can break around it
  const boxes = series.flatMap((s) =>
    Object.entries(s.marks || {}).map(([i, pos]) => {
      const w = fmt(s.values[i], 3).length * NUM_W;
      const m = markAt(x(horizons[i]), y(s.values[i]), pos);
      const x0 = m.anchor === 'end' ? m.x - w : m.x - w / 2;
      return { key: s.key, x0: x0 - 4, x1: x0 + w + 4, y0: m.y - 10, y1: m.y + 4 };
    }),
  );
  return function art(stepNo, uid) {
    const on = (b) => (stepNo >= b ? 1 : 0);
    return (
      <>
        <defs>
          {series.map((s) => (
            <clipPath key={s.key} id={`${uid}hz${s.key}`}>
              <rect className={`hz-clip hz-clip-${s.key}`} x={X0 - 12} y={Y0 - 30} width={X1 - X0 + 24} height={Y1 - Y0 + 60} />
            </clipPath>
          ))}
        </defs>
        <text className="sv-cap" x={24} y={24}>Test MAE ({unit}) against prediction horizon · Bickley</text>
        <text className="sv-lab" x={24} y={40}>y axis starts at {fmt(lo, 1)} {unit}, not zero</text>
        {ticks.map((t) => (
          <g key={t}>
            <line className="sv-grid" x1={X0 - 10} x2={X1 + 10} y1={y(t)} y2={y(t)} />
            <text className="sv-lab" x={X0 - 16} y={y(t) + 4} textAnchor="end">{fmt(t, 1)}</text>
          </g>
        ))}
        <line className="sv-axis" x1={X0 - 10} x2={X1 + 10} y1={Y1 + 10} y2={Y1 + 10} />
        {horizons.map((h) => (
          <g key={h}>
            <line className="sv-axis" x1={x(h)} x2={x(h)} y1={Y1 + 10} y2={Y1 + 15} />
            <text className="sv-lab" x={x(h)} y={Y1 + 28} textAnchor="middle">{h}</text>
          </g>
        ))}
        <text className="sv-lab" x={(X0 + X1) / 2} y={Y1 + 48} textAnchor="middle">horizon h · MAE averaged over lead months 1…h</text>

        {series.map((s) => {
          const last = s.values[s.values.length - 1];
          const solid = !s.style || s.style === 'solid';
          const filled = s.marker === 'filled';
          const gy = y(s.values[0]);
          return (
            <g key={s.key} className={`hz-s hz-s-${s.key}`} opacity={on(s.beat)}>
              {s.rise && (
                <g className={`hz-rise hz-rise-${s.key}`}>
                  {guideSegments(x(horizons[0]), X1 + s.rise.x + 4, gy, boxes.filter((k) => k.key !== s.key)).map(([a, b]) => (
                    <line key={a} className="sv-faint" x1={a} x2={b} y1={gy} y2={gy} strokeWidth="1" strokeDasharray="2 3" />
                  ))}
                  <line className={s.cls} x1={X1 + s.rise.x} x2={X1 + s.rise.x} y1={y(s.values[0])} y2={y(last)} strokeWidth="2" />
                  <line className={s.cls} x1={X1 + s.rise.x - 3} x2={X1 + s.rise.x + 3} y1={y(last)} y2={y(last)} strokeWidth="2" />
                </g>
              )}
              <g clipPath={`url(#${uid}hz${s.key})`}>
                <path
                  className={solid ? `sv-line ${s.cls}` : 'sv-line'}
                  d={pathOf(s.values.map((v, i) => [x(horizons[i]), y(v)]))}
                  strokeWidth={solid ? 2 : 1.6}
                  style={solid ? undefined : { stroke: s.stroke, strokeDasharray: DASH[s.style] }}
                />
                {s.values.map((v, i) => {
                  const cx = x(horizons[i]);
                  const cy = y(v) + ((s.nudge && s.nudge[i]) || 0);
                  if (solid && s.shape === 'square') {
                    return <rect key={i} className={s.fill} x={cx - 4.5} y={cy - 4.5} width={9} height={9} style={{ stroke: 'var(--surface)' }} strokeWidth={2} />;
                  }
                  return (
                    <circle
                      key={i}
                      className={solid ? s.fill : undefined}
                      cx={cx}
                      cy={cy}
                      r={solid ? 4.5 : filled ? 4 : 3.2}
                      style={solid || filled ? { fill: solid ? undefined : s.stroke, stroke: 'var(--surface)' } : { fill: 'var(--surface)', stroke: s.stroke }}
                      strokeWidth={solid ? 2 : 1.5}
                    />
                  );
                })}
              </g>
              {Object.entries(s.marks || {}).map(([i, pos]) => {
                const m = markAt(x(horizons[i]), y(s.values[i]), pos);
                return (
                  <text key={i} className={`sv-num hz-mark hz-mark-${s.key}`} x={m.x} y={m.y} textAnchor={m.anchor} style={{ fontSize: 11 }}>
                    {fmt(s.values[i], 3)}
                  </text>
                );
              })}
              <text className="sv-lab-strong hz-end" x={LX} y={y(last) + 4 + (s.labelDy || 0)}>{s.label}</text>
              {s.note && <text className="sv-lab hz-end" x={LX + s.label.length * 6.9 + 6} y={y(last) + 4 + (s.labelDy || 0)}>{s.note}</text>}
            </g>
          );
        })}

        {point && (() => {
          const px = x(point.h);
          const py = y(point.value);
          return (
            <g className="hz-pt" opacity={on(point.beat)}>
              <circle className={point.fill} cx={px} cy={py} r="5" style={{ stroke: 'var(--surface)' }} strokeWidth="2" />
              {/* the leader leaves from the dot's right so it clears a marker just below */}
              <path className="sv-faint" d={`M${px + 6} ${py + 2} L${px + 22} ${py + 38}`} strokeWidth="1" fill="none" />
              <text className="sv-lab-strong" x={px + 26} y={py + 46}>{point.label}</text>
              <text className="sv-num" x={px + 26 + point.label.length * 6.9 + 8} y={py + 46} style={{ fontSize: 11 }}>{fmt(point.value, 3)}</text>
              <text className="sv-lab" x={px + 26} y={py + 60}>{point.note}</text>
            </g>
          );
        })()}
      </>
    );
  };
}

const makeBuild = ({ series, point, nBeats }) => function build(tl, { q, beat }) {
  tl.set(q('.hz-s, .hz-pt'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.hz-clip'), { attr: { width: 0 }, immediateRender: true }, 0);
  for (let b = 0; b < nBeats; b++) {
    beat(b, b === 0 ? 0 : '+=0.6');
    // one offset per position: GSAP reads only the first offset of 'b1+=a+=b'
    const pos = (t) => `b${b}+=${t.toFixed(3)}`;
    series.filter((s) => s.beat === b).forEach((s, k) => {
      const off = k * 0.35;
      tl.fromTo(q(`.hz-s-${s.key}`), { opacity: 0 }, { opacity: 1, duration: 0.2 }, pos(off));
      tl.fromTo(q(`.hz-clip-${s.key}`), { attr: { width: 0 } }, { attr: { width: X1 - X0 + 24 }, duration: 1.3, ease: 'power1.inOut' }, pos(off));
      tl.fromTo(q(`.hz-mark-${s.key}, .hz-s-${s.key} .hz-end`), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, pos(off + 1.1));
      if (s.rise) tl.fromTo(q(`.hz-rise-${s.key}`), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4 }, pos(off + 1.3));
    });
    if (point && point.beat === b) {
      tl.fromTo(q('.hz-pt'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, `b${b}`);
    }
  }
  tl.to({}, { duration: 1.4 });
};

export default function HorizonScene({ id = 'horizons', horizons = HORIZONS, series, point, beats, unit = '°C', lo = 0.9, hi = 1.5, step = 0.1, keyframes }) {
  const p = useMemo(() => ({ horizons, series, point, lo, hi, step, unit, nBeats: beats.length }), [horizons, series, point, lo, hi, step, unit, beats.length]);
  const art = useMemo(() => makeArt(p), [p]);
  const build = useMemo(() => makeBuild(p), [p]);
  return (
    <Scene
      id={id}
      label={`Line chart of test MAE against prediction horizon for ${series.map((s) => s.label).join(', ')}${point ? `, with ${point.label} at ${point.h} months only` : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      beats={beats}
      art={art}
      build={build}
      keyframes={keyframes || [beats.length - 1]}
    />
  );
}
