import { FACTS } from './facts';
import { Num } from './Num';

/* ============================================================================
   SEMINAR DECKS — CHART PRIMITIVES (SVG; one message per chart)
   ----------------------------------------------------------------------------
   Plain bars, dots and intervals with big labels, themed by the deck's CSS
   variables (--sd-ink, --sd-muted, --sd-rule, --sd-hybrid, --sd-psm,
   --sd-twin, --sd-accent ...). Every value label is a <Num> bound to the
   manifest; axis ticks carry data-tick (scale marks, allow-listed by gate G1).
   Labels are 28 px or larger on the 1920 x 1080 canvas (gate G4).
   `reveal` (0..1 or boolean) lets a deck build a chart in steps; transitions
   are CSS, so reduced motion and export render the end state.
   ========================================================================== */

const val = (k) => {
  const v = FACTS[k]?.value;
  if (typeof v !== 'number') return 0;
  return Math.abs(v) <= 1 && !k.includes('df1') && !k.startsWith('r6.') ? v * 100 : v;
};


/**
 * Grouped vertical bars.
 * groups: [{ label, bars: [{ k, series, name? }] }]   series: 'hybrid' | 'psm' | 'twin' | 'a' | 'b'
 */
export function BarGroups({ groups, width = 1100, height = 520, max = 100, min = 0, reveal = true, labelSize = 32, valueSize = 34, legend, className = '' }) {
  const padB = labelSize * 2.2;
  const padT = valueSize * 1.6;
  const plotH = height - padB - padT;
  const gw = width / groups.length;
  const nb = Math.max(...groups.map((g) => g.bars.length));
  const bw = Math.min(150, (gw * 0.72) / nb);
  const y = (v) => padT + plotH * (1 - (v - min) / (max - min));
  const show = reveal === true ? 1 : reveal === false ? 0 : reveal;
  return (
    <svg className={`sd-chart sd-bars ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1="0" x2={width} y1={y(min)} y2={y(min)} className="sd-chart__axis" />
      {groups.map((g, gi) => {
        const x0 = gi * gw + (gw - bw * g.bars.length) / 2;
        return (
          <g key={g.label}>
            {g.bars.map((b, bi) => {
              const v = val(b.k);
              const h = (y(min) - y(v)) * show;
              const x = x0 + bi * bw;
              return (
                <g key={b.k} className={`sd-bars__bar is-${b.series}`}>
                  <rect x={x + 6} width={bw - 12} y={y(min) - h} height={h} className="sd-bars__rect" />
                  <text x={x + bw / 2} y={y(v) - valueSize * 0.45} textAnchor="middle" className="sd-chart__value" style={{ fontSize: valueSize, opacity: show }} data-role="chart">
                    <Num k={b.k} svg />
                  </text>
                  {b.name && (
                    <text x={x + bw / 2} y={y(min) + labelSize * 1.15} textAnchor="middle" className="sd-chart__label" style={{ fontSize: labelSize * 0.9 }} data-role="chart">{b.name}</text>
                  )}
                </g>
              );
            })}
            <text x={gi * gw + gw / 2} y={height - labelSize * 0.35} textAnchor="middle" className="sd-chart__label sd-chart__label--group" style={{ fontSize: labelSize }} data-role="chart">{g.label}</text>
          </g>
        );
      })}
      {legend}
    </svg>
  );
}

/** A legend row as HTML (easier to wrap than SVG text). items: [{ series, label }] */
export function Legend({ items, className = '' }) {
  return (
    <ul className={`sd-legend ${className}`}>
      {items.map((it) => (
        <li key={it.series} className={`is-${it.series}`} data-role="chart">
          <span className="sd-legend__swatch" aria-hidden="true" />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

const LOG_TICKS = [2, 5, 10, 20, 50, 100, 200];

/**
 * Per-case dots on a log x axis (lesion count) against a difference (points).
 * data: [[n_gt, diff], ...]; sign shown by shape as well as colour.
 * collapse (0..1) slides every dot to the zero line (for a "collapse into the
 * pooled answer" build); split marks the n < 20 and n >= 100 bands.
 */
export function DotLog({ data, width = 1200, height = 560, yMin = -60, yMax = 60, collapse = 0, bands = false, labelSize = 28, xLabel = 'Lesions in the scan (log scale)', yLabel = 'F1 difference, points', className = '' }) {
  const padL = 120;
  const padR = 30;
  const padT = 20;
  const padB = labelSize * 3;
  const pw = width - padL - padR;
  const ph = height - padT - padB;
  const lx0 = Math.log10(1.6);
  const lx1 = Math.log10(260);
  const x = (n) => padL + ((Math.log10(n) - lx0) / (lx1 - lx0)) * pw;
  const y = (d) => padT + ph * (1 - (d - yMin) / (yMax - yMin));
  const r = 9;
  return (
    <svg className={`sd-chart sd-dots ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {bands && (
        <g className="sd-dots__bands">
          <rect x={x(1.6)} width={x(19.5) - x(1.6)} y={padT} height={ph} className="sd-dots__band is-low" />
          <rect x={x(99.5)} width={x(260) - x(99.5)} y={padT} height={ph} className="sd-dots__band is-high" />
        </g>
      )}
      <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} className="sd-chart__zero" />
      {[yMin, yMin / 2, yMax / 2, yMax].map((t) => (
        <g key={t}>
          <line x1={padL - 10} x2={padL} y1={y(t)} y2={y(t)} className="sd-chart__axis" />
          <text x={padL - 16} y={y(t) + labelSize * 0.35} textAnchor="end" className="sd-chart__tick" style={{ fontSize: labelSize }} data-tick="" data-role="chart">{t > 0 ? `+${t}` : t}</text>
        </g>
      ))}
      <text x={padL - 16} y={y(0) + labelSize * 0.35} textAnchor="end" className="sd-chart__tick" style={{ fontSize: labelSize }} data-tick="" data-role="chart">0</text>
      {LOG_TICKS.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={padT + ph} y2={padT + ph + 10} className="sd-chart__axis" />
          <text x={x(t)} y={padT + ph + labelSize * 1.3} textAnchor="middle" className="sd-chart__tick" style={{ fontSize: labelSize }} data-tick="" data-role="chart">{t}</text>
        </g>
      ))}
      <text x={padL + pw / 2} y={height - 6} textAnchor="middle" className="sd-chart__label" style={{ fontSize: labelSize }} data-role="chart">{xLabel}</text>
      <text transform={`translate(${labelSize}, ${padT + ph / 2}) rotate(-90)`} textAnchor="middle" className="sd-chart__label" style={{ fontSize: labelSize }} data-role="chart">{yLabel}</text>
      <g className="sd-dots__pts">
        {(data ?? []).map(([n, d], i) => {
          const cx = x(n) + ((i % 5) - 2) * 1.2;
          const cy = y(0) + (y(Math.max(yMin, Math.min(yMax, d))) - y(0)) * (1 - collapse);
          const cls = d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-tie';
          if (d > 0) return <circle key={i} cx={cx} cy={cy} r={r} className={`sd-dots__pt ${cls}`} />;
          if (d < 0) return <rect key={i} x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} className={`sd-dots__pt ${cls}`} />;
          return <path key={i} d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} className={`sd-dots__pt ${cls}`} />;
        })}
      </g>
    </svg>
  );
}

/**
 * Forest plot of effects with 95% intervals against a decision rule.
 * rows: [{ label, k, lo, hi, real }]  (k, lo, hi are manifest keys, in points)
 */
export function Intervals({ rows, width = 1300, height = 420, dMin = -6, dMax = 3, rule = 1, labelSize = 30, labelW = 520, className = '' }) {
  const padT = 20;
  const padB = labelSize * 2.4;
  const pw = width - labelW - 40;
  const x = (v) => labelW + ((v - dMin) / (dMax - dMin)) * pw;
  const rowH = (height - padT - padB) / rows.length;
  const ticks = [];
  for (let t = Math.ceil(dMin); t <= dMax; t += 1) ticks.push(t);
  const n = (k) => FACTS[k]?.value ?? 0;
  return (
    <svg className={`sd-chart sd-ints ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <rect x={x(-rule)} width={x(rule) - x(-rule)} y={padT} height={height - padT - padB} className="sd-ints__rule" />
      <line x1={x(0)} x2={x(0)} y1={padT} y2={height - padB} className="sd-chart__zero" />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={height - padB + labelSize * 1.2} textAnchor="middle" className="sd-chart__tick" style={{ fontSize: labelSize * 0.9 }} data-tick="" data-role="chart">{t > 0 ? `+${t}` : t}</text>
      ))}
      {rows.map((r, i) => {
        const cy = padT + rowH * (i + 0.5);
        return (
          <g key={r.label} className={`sd-ints__row${r.real ? ' is-real' : ''}`}>
            <text x={labelW - 24} y={cy + labelSize * 0.35} textAnchor="end" className="sd-chart__label" style={{ fontSize: labelSize }} data-role="chart">{r.label}</text>
            <line x1={x(n(r.lo))} x2={x(n(r.hi))} y1={cy} y2={cy} className="sd-ints__ci" />
            {r.real
              ? <circle cx={x(n(r.k))} cy={cy} r="13" className="sd-ints__pt is-real" />
              : <circle cx={x(n(r.k))} cy={cy} r="13" className="sd-ints__pt" />}
          </g>
        );
      })}
    </svg>
  );
}
