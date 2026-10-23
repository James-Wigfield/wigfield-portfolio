import { useRef } from 'react';
import { useWidth } from '../../../lecture8-study/useWidth.js';
import { CHART, UI } from '../../content/overfit-clinic.js';
import { lin, logScale, niceTicks, decadeTicks, decadeLabel, tickLabel, pathOf, heatFill, heatStrong } from './plot.js';

/* ============================================================================
   OVERFIT CLINIC — THE CHARTS (procedural SVG, drawn from the case's data)
   ----------------------------------------------------------------------------
   One renderer per chart kind (maths/overfitClinic.js makes the data):
     line · panels (two stacked lines) · bars · heat · code · encdec
   The SVG is drawn at the container's real width (useWidth), so text stays
   at its real size on a phone instead of shrinking with a viewBox.
   ========================================================================== */

const ROLE = { train: 'train', valid: 'valid', truth: 'truth', pred: 'pred', aux: 'aux', gen: 'gen', disc: 'disc' };

export function ChartView({ chart }) {
  const ref = useRef(null);
  const w = useWidth(ref, 560);
  const W = Math.max(280, Math.min(Math.round(w), 760));
  const aria = CHART[chart.type]?.aria ?? CHART.code.aria;
  let body = null;
  if (chart.kind === 'line') body = <LineChart spec={chart} W={W} aria={aria} />;
  else if (chart.kind === 'panels') {
    body = (
      <>
        <LineChart spec={chart.panels[0]} W={W} aria={aria} />
        <LineChart spec={chart.panels[1]} W={W} aria={aria} short />
      </>
    );
  } else if (chart.kind === 'bars') body = <BarChart spec={chart} W={W} aria={aria} />;
  else if (chart.kind === 'heat') body = <HeatChart spec={chart} W={W} aria={aria} />;
  else if (chart.kind === 'encdec') body = <EncDec spec={chart} W={W} aria={aria} />;
  else if (chart.kind === 'code') body = <CodeCard code={chart} aria={aria} />;
  const series = chart.kind === 'line' ? chart.series : chart.kind === 'panels' ? chart.panels.flatMap((p) => p.series) : [];
  return (
    <div ref={ref} className="dla-oc__chart">
      {body}
      {series.length > 1 && (
        <p className="dla-oc__legend">
          {series.map((s) => (
            <span key={s.key}><span className={`dla-oc__key dla-oc__key--${ROLE[s.role] ?? 'aux'}`} aria-hidden="true" />{s.label}</span>
          ))}
        </p>
      )}
      {chart.code && <CodeCard code={chart.code} aria={CHART.code.aria} />}
    </div>
  );
}

/* ── line charts ────────────────────────────────────────────────────────── */
function LineChart({ spec, W, aria, short = false }) {
  const H = short ? 128 : W < 460 ? 204 : 236;
  const m = { l: 46, r: 14, t: 24, b: 32 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const { x, y } = spec;
  const X = x.log ? logScale(x.from, x.to, m.l, m.l + iw) : lin(x.from, x.to, m.l, m.l + iw);
  const Y = y.log ? logScale(y.min, y.max, m.t + ih, m.t) : lin(y.min, y.max, m.t + ih, m.t);
  const yTicks = y.log
    ? decadeTicks(y.min, y.max).map((e) => ({ v: 10 ** e, label: decadeLabel(e) }))
    : niceTicks(y.min, y.max, short ? 2 : 4).map((v) => ({ v, label: tickLabel(v) }));
  const xTicks = x.log
    ? decadeTicks(x.from, x.to).map((e) => ({ v: 10 ** e, label: decadeLabel(e) }))
    : niceTicks(x.from, x.to, W < 460 ? 4 : 6).filter((v) => Number.isInteger(v)).map((v) => ({ v, label: tickLabel(v) }));
  const paths = spec.series.map((s) => {
    const xs = s.xs ?? s.values.map((_, i) => x.from + i);
    const cut = spec.clipTop ? s.values.findIndex((v) => v > y.max) : -1;
    const last = cut < 0 ? s.values.length : cut + 1;
    const pts = s.values.slice(0, last).map((v, i) => [X(xs[i]), Y(Math.max(y.min, Math.min(y.max, v)))]);
    return { key: s.key, role: ROLE[s.role] ?? 'aux', d: pathOf(pts), off: cut < 0 ? null : pts[pts.length - 1] };
  });
  const off = paths.find((p) => p.off)?.off ?? null;
  return (
    <svg className="dla-svg dla-oc__svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      {yTicks.map((t) => (
        <g key={`y${t.v}`}>
          <line className="dla-oc__grid" x1={m.l} x2={m.l + iw} y1={Y(t.v)} y2={Y(t.v)} />
          <text className="dla-t dla-t--xs" x={m.l - 6} y={Y(t.v) + 3.5} textAnchor="end">{t.label}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t.v}`} className="dla-t dla-t--xs" x={X(t.v)} y={m.t + ih + 14} textAnchor="middle">{t.label}</text>
      ))}
      <line className="dla-oc__axis" x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} />
      <line className="dla-oc__axis" x1={m.l} x2={m.l} y1={m.t} y2={m.t + ih} />
      <text className="dla-t dla-t--s" x={m.l} y={m.t - 9}>{y.label}</text>
      <text className="dla-t dla-t--s" x={m.l + iw} y={H - 3} textAnchor="end">{x.label}</text>
      {(spec.guides ?? []).map((g) => (
        <g key={`g${g.y}`}>
          <line className={`dla-oc__guide dla-oc__guide--${g.role}`} x1={m.l} x2={m.l + iw} y1={Y(g.y)} y2={Y(g.y)} />
          {g.role !== 'zero' && <text className="dla-t dla-t--xs dla-halo" x={m.l + iw - 2} y={Y(g.y) - 5} textAnchor="end">{g.label}</text>}
        </g>
      ))}
      {paths.map((p) => <path key={p.key} className={`dla-oc__ln dla-oc__ln--${p.role}`} d={p.d} pathLength={p.role === 'pred' ? undefined : 1} />)}
      {off && (
        <g className="dla-oc__off">
          <path d={`M${off[0] - 6} ${off[1] + 4}L${off[0]} ${off[1] - 5}L${off[0] + 6} ${off[1] + 4}Z`} />
          <text className="dla-t dla-t--xs dla-halo" x={off[0] - 9} y={off[1] + 12} textAnchor="end">{UI.offChart}</text>
        </g>
      )}
    </svg>
  );
}

/* ── bar charts ─────────────────────────────────────────────────────────── */
function BarChart({ spec, W, aria }) {
  const wide = !!spec.wide;
  const H = W < 460 ? 196 : 224;
  const m = { l: 50, r: 10, t: 24, b: wide ? 46 : 32 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = spec.bars.map((b) => b.value);
  const pos = vals.filter((v) => v > 0);
  const lo = spec.y.log ? 10 ** Math.floor(Math.log10(Math.min(...pos))) : spec.y.min ?? 0;
  const hi = spec.y.log ? 10 ** Math.ceil(Math.log10(Math.max(...pos))) : spec.y.max ?? Math.max(...vals) * 1.1;
  const Y = spec.y.log ? logScale(lo, hi, m.t + ih, m.t) : lin(lo, hi, m.t + ih, m.t);
  const yTicks = spec.y.log
    ? decadeTicks(lo, hi).filter((e, i, a) => a.length <= 6 || i % Math.ceil(a.length / 5) === 0).map((e) => ({ v: 10 ** e, label: decadeLabel(e) }))
    : niceTicks(lo, hi, 4).map((v) => ({ v, label: tickLabel(v) }));
  const n = spec.bars.length;
  const band = iw / n;
  const bw = Math.max(3, band * (wide ? 0.42 : 0.68));
  const every = spec.tickEvery ?? 1;
  const base = m.t + ih;
  return (
    <svg className="dla-svg dla-oc__svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      {yTicks.map((t) => (
        <g key={`y${t.v}`}>
          <line className="dla-oc__grid" x1={m.l} x2={m.l + iw} y1={Y(t.v)} y2={Y(t.v)} />
          <text className="dla-t dla-t--xs" x={m.l - 6} y={Y(t.v) + 3.5} textAnchor="end">{t.label}</text>
        </g>
      ))}
      <text className="dla-t dla-t--s" x={m.l} y={m.t - 9}>{spec.y.label}</text>
      {spec.bars.map((b, i) => {
        const cx = m.l + band * (i + 0.5);
        const top = b.value > 0 ? Y(b.value) : base;
        return (
          <g key={i} className="dla-oc__bargrp" style={{ '--i': i }}>
            {b.value > 0 && <rect className={`dla-oc__bar${b.flag ? ' dla-oc__bar--flag' : ''}`} x={cx - bw / 2} y={top} width={bw} height={Math.max(0, base - top)} rx={Math.min(3, bw / 4)} />}
            {b.flag && b.value === 0 && <path className="dla-oc__zero" d={`M${cx - 3.5} ${base - 9.5}l7 7M${cx + 3.5} ${base - 9.5}l-7 7`} />}
            {wide && <text className="dla-t dla-t--xs dla-t--m" x={cx} y={top - 6} textAnchor="middle">{b.value.toLocaleString('en-AU')}</text>}
            {(wide || i % every === 0 || i === n - 1) && (
              <text className={`dla-t ${wide ? 'dla-t--s' : 'dla-t--xs'}`} x={cx} y={base + 14} textAnchor="middle">{b.label}</text>
            )}
            {wide && b.sub && <text className="dla-t dla-t--xs" x={cx} y={base + 28} textAnchor="middle">{b.sub}</text>}
          </g>
        );
      })}
      <line className="dla-oc__axis" x1={m.l} x2={m.l + iw} y1={base} y2={base} />
      {!wide && <text className="dla-t dla-t--s" x={m.l + iw} y={H - 3} textAnchor="end">{spec.x.label}</text>}
      {spec.flagLabel && (
        <g>
          <path className="dla-oc__zero" d={`M${m.l + iw - spec.flagLabel.length * 5.6 - 16} ${m.t - 16}l7 7m0 -7l-7 7`} />
          <text className="dla-t dla-t--xs" x={m.l + iw} y={m.t - 9} textAnchor="end">{spec.flagLabel}</text>
        </g>
      )}
    </svg>
  );
}

/* ── heat maps ──────────────────────────────────────────────────────────── */
function HeatChart({ spec, W, aria }) {
  const { rows, cols, values, signed } = spec;
  const labW = signed ? Math.min(150, Math.round(W * 0.38)) : 66;
  const cell = Math.max(18, Math.min(56, Math.floor((W - labW - 6) / cols.length)));
  const top = 40;
  const H = top + rows.length * cell + 6;
  const showVals = !signed && cell >= 34;
  const SW = Math.min(W, labW + cols.length * cell + 6);
  return (
    <svg className="dla-svg dla-oc__svg" width={SW} height={H} viewBox={`0 0 ${SW} ${H}`} style={{ width: SW }} role="img" aria-label={aria}>
      <text className="dla-t dla-t--s" x={labW - 8} y={12} textAnchor="end">{spec.rowsLabel}</text>
      <text className="dla-t dla-t--s" x={labW} y={12}>{spec.colsLabel}</text>
      {cols.map((c, j) => (
        <text key={`c${j}`} className="dla-t dla-t--xs" x={labW + j * cell + cell / 2} y={top - 8} textAnchor="middle">{signed || cell >= 44 || c.length <= 4 ? c : c.replace(/^\D+/, '')}</text>
      ))}
      {rows.map((r, i) => (
        <g key={`r${i}`}>
          <text className="dla-t dla-t--xs" x={labW - 8} y={top + i * cell + cell / 2 + 4} textAnchor="end">{r}</text>
          {values[i].map((v, j) => (
            <g key={j}>
              <rect className="dla-oc__cell" x={labW + j * cell + 1} y={top + i * cell + 1} width={cell - 2} height={cell - 2} rx="3" style={{ fill: heatFill(v, signed) }} />
              {showVals && <text className={`dla-t dla-t--m dla-oc__hv${heatStrong(v, signed) ? ' dla-oc__hv--strong' : ''}`} x={labW + j * cell + cell / 2} y={top + i * cell + cell / 2 + 4} textAnchor="middle">{v.toFixed(2)}</text>}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ── code cards (summaries, case notes, model code) ─────────────────────── */
export function CodeCard({ code, aria }) {
  const numbered = code.lines.some((l) => l.n);
  if (numbered) {
    return (
      <div className="dla-oc__code dla-oc__code--grid" role="group" aria-label={aria}>
        <div className="dla-oc__grid-code">
          <span className="dla-oc__gl dla-oc__gl--title">{code.title}</span>
          {code.lines.map((l) => (
            <span key={l.n} className="dla-oc__gl">
              <span className="dla-oc__ln-n" aria-hidden="true">{l.n}</span>
              <span className="dla-oc__gt">{l.text}</span>
              {l.comment && <span className="dla-oc__cm">{l.comment}</span>}
            </span>
          ))}
          {code.close && <span className="dla-oc__gl dla-oc__gl--title">{code.close}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="dla-oc__code" role="group" aria-label={aria}>
      <pre>
        <span className="dla-oc__codeline dla-oc__codeline--title">{code.title}</span>
        {code.lines.map((l, i) => (
          <span key={i} className="dla-oc__codeline">{l.text}</span>
        ))}
        {code.close && <span className="dla-oc__codeline">{code.close}</span>}
      </pre>
    </div>
  );
}

/* ── the encoder–decoder diagram (Figure 16-3's network, own drawing) ──── */
function EncDec({ spec, W, aria }) {
  const C = CHART.encdec;
  const ne = spec.src.length;
  const nd = spec.din.length;
  const gapMid = 22;
  const pad = 8;
  const pitch = (W - 2 * pad - gapMid) / (ne + nd);
  const cell = Math.min(30, pitch * 0.62);
  const yC = 52;
  const H = yC + cell + 44;
  const cx = (k) => pad + pitch * (k + 0.5) + (k >= ne ? gapMid : 0);
  const mid = yC + cell / 2;
  // the highlighted path: x(from) → … → last encoder cell → decoder 0 → … → decoder `to`
  const hops = [];
  for (let k = spec.from; k < ne + spec.to; k++) hops.push([cx(k) + cell / 2, cx(k + 1) - cell / 2]);
  return (
    <svg className="dla-svg dla-oc__svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      <text className="dla-t dla-t--s" x={cx(0) - cell / 2} y={12}>{C.enc}</text>
      <text className="dla-t dla-t--s" x={cx(ne) - cell / 2} y={12}>{C.dec}</text>
      {Array.from({ length: ne + nd - 1 }, (_, k) => (
        <line key={`l${k}`} className={`dla-oc__link${k === ne - 1 ? ' dla-oc__link--state' : ''}`} x1={cx(k) + cell / 2} x2={cx(k + 1) - cell / 2} y1={mid} y2={mid} />
      ))}
      {hops.map(([a, b], k) => <line key={`h${k}`} className="dla-oc__hop" x1={a} x2={b} y1={mid} y2={mid} />)}
      <text className="dla-t dla-t--xs dla-halo" x={(cx(ne - 1) + cx(ne)) / 2} y={yC - 6} textAnchor="middle">{C.state}</text>
      {Array.from({ length: ne + nd }, (_, k) => {
        const enc = k < ne;
        const on = (enc && k === spec.from) || (!enc && k - ne === spec.to);
        return (
          <g key={`c${k}`}>
            <rect className={`dla-oc__rcell dla-oc__rcell--${enc ? 'enc' : 'dec'}${on ? ' dla-oc__rcell--on' : ''}`} x={cx(k) - cell / 2} y={yC} width={cell} height={cell} rx="6" />
            <text className={`dla-t dla-t--xs${on && enc ? ' dla-t--b' : ''}`} x={cx(k)} y={yC + cell + 15} textAnchor="middle">{enc ? spec.src[k] : spec.din[k - ne]}</text>
            {!enc && <text className={`dla-t dla-t--xs${on ? ' dla-t--b' : ''}`} x={cx(k)} y={yC - 22} textAnchor="middle">{spec.dout[k - ne]}</text>}
          </g>
        );
      })}
      <text className="dla-t dla-t--s dla-t--b" x={W - pad} y={H - 4} textAnchor="end">{C.path.replace('%n%', spec.facts.path)}</text>
    </svg>
  );
}
