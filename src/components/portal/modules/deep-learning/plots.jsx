import { useId, useMemo, useRef, useState } from 'react';
import { sup, fmtSci } from './mathfns';

/* ============================================================================
   DEEP LEARNING — PLOT PRIMITIVES (shared by every lecture page)
   ----------------------------------------------------------------------------
     FnPlot          continuous y = f(z) curves over a fixed window, with
                     recessive grid, zero axes, shaded x-zones, dotted
                     asymptotes, direct end-labels (de-collided), and a
                     crosshair + all-series tooltip (pointer AND keyboard).
     LayerFlowChart  a per-layer log₁₀ magnitude chart (lecture 2's
                     gradient-flow lab): discrete x = layer index, two
                     labelled series, crosshair snapping to the nearest layer.

   Series colours arrive as CSS custom properties (var(--dlv-*)) declared in
   common.css and re-stepped per portal theme — the palette was validated
   (light + dark) with the dataviz checks; identity is never colour-alone
   (every curve carries a visible direct label).
   ========================================================================== */

const W = 760;
const PAD = { l: 50, r: 12, t: 18, b: 34 };

const fmt2 = (v) => (Math.abs(v) < 1e-3 ? '0.00' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

// Integer-ish ticks across a range without crowding.
function ticks(min, max, maxCount = 12) {
  const span = max - min;
  const step = span <= maxCount ? 1 : span <= maxCount * 2 ? 2 : Math.ceil(span / maxCount);
  const out = [];
  for (let t = Math.ceil(min); t <= Math.floor(max); t += step) out.push(t);
  return out;
}

// Push overlapping direct labels apart (then clamp back into the plot).
function decollide(items, minGap, top, bottom) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].y > bottom) sorted[i].y = bottom;
    if (i < sorted.length - 1 && sorted[i + 1].y - sorted[i].y < minGap) {
      sorted[i].y = sorted[i + 1].y - minGap;
    }
    if (sorted[i].y < top) sorted[i].y = top;
  }
  return items;
}

/* ── FnPlot ──────────────────────────────────────────────────────────────
   series: [{ id, label, color, dash, width, f(z) }]
   zones:  [{ from, to, label }]           (shaded x-bands, label on top)
   asymptotes: [y, …]                      (dotted horizontal guides)
   ------------------------------------------------------------------------ */
export function FnPlot({
  series,
  xmin = -5,
  xmax = 5,
  ymin = -2,
  ymax = 3,
  height = 330,
  zones = [],
  asymptotes = [],
  caption,
}) {
  const H = height;
  const clip = useId();
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { z }

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const sx = (z) => PAD.l + ((z - xmin) / (xmax - xmin)) * plotW;
  const sy = (y) => PAD.t + (1 - (y - ymin) / (ymax - ymin)) * plotH;

  const paths = useMemo(() => {
    const n = 221;
    return series.map((s) => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const z = xmin + ((xmax - xmin) * i) / (n - 1);
        const y = s.f(z);
        if (!Number.isFinite(y)) continue;
        d += `${d ? 'L' : 'M'}${sx(z).toFixed(2)} ${sy(y).toFixed(2)}`;
      }
      return d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, xmin, xmax, ymin, ymax, H]);

  // Direct labels sit clear of the zone labels (which occupy the top 26px).
  const labelTop = PAD.t + (zones.length ? 30 : 10);
  const labels = useMemo(() => {
    const items = series.map((s) => {
      const yEnd = s.f(xmax - (xmax - xmin) * 0.005);
      const y = Math.min(Math.max(sy(Math.min(Math.max(yEnd, ymin), ymax)), labelTop), H - PAD.b - 4);
      return { id: s.id, label: s.label, color: s.color, y };
    });
    return decollide(items, 15, labelTop, H - PAD.b - 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, xmin, xmax, ymin, ymax, H, labelTop]);

  const setFromClientX = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const z = Math.min(Math.max(xmin + ((px - PAD.l) / plotW) * (xmax - xmin), xmin), xmax);
    setHover({ z });
  };

  const onKey = (e) => {
    const step = (e.shiftKey ? 0.5 : 0.1) * (xmax - xmin === 0 ? 1 : (xmax - xmin) / 10);
    const cur = hover?.z ?? (xmin + xmax) / 2;
    if (e.key === 'ArrowLeft') { setHover({ z: Math.max(xmin, cur - step) }); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setHover({ z: Math.min(xmax, cur + step) }); e.preventDefault(); }
    if (e.key === 'Escape') setHover(null);
  };

  const hz = hover?.z;
  const tipLeftPct = hz !== undefined ? (sx(hz) / W) * 100 : 0;
  const flip = hz !== undefined && sx(hz) > W * 0.62;

  return (
    <figure className="dl-plot">
      <div
        ref={wrapRef}
        className="dl-plot__stage"
        tabIndex={0}
        role="application"
        aria-label={caption || 'Function plot — arrow keys move the probe'}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="dl-plot__svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id={clip}>
              <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* zones */}
          {zones.map((zn, i) => (
            <g key={i}>
              <rect
                x={sx(Math.max(zn.from, xmin))}
                y={PAD.t}
                width={sx(Math.min(zn.to, xmax)) - sx(Math.max(zn.from, xmin))}
                height={plotH}
                className="dl-plot__zone"
              />
              <text x={(sx(Math.max(zn.from, xmin)) + sx(Math.min(zn.to, xmax))) / 2} y={PAD.t + 14} className="dl-plot__zonelabel" textAnchor="middle">
                {zn.label}
              </text>
            </g>
          ))}

          {/* grid + ticks */}
          {ticks(xmin, xmax).map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} y1={PAD.t} x2={sx(t)} y2={H - PAD.b} className="dl-plot__grid" />
              <text x={sx(t)} y={H - PAD.b + 16} textAnchor="middle" className="dl-plot__tick">{t}</text>
            </g>
          ))}
          {ticks(ymin, ymax, 8).map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} className="dl-plot__grid" />
              <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" className="dl-plot__tick">{t}</text>
            </g>
          ))}

          {/* zero axes */}
          {ymin < 0 && ymax > 0 && <line x1={PAD.l} y1={sy(0)} x2={W - PAD.r} y2={sy(0)} className="dl-plot__axis" />}
          {xmin < 0 && xmax > 0 && <line x1={sx(0)} y1={PAD.t} x2={sx(0)} y2={H - PAD.b} className="dl-plot__axis" />}

          {/* asymptotes */}
          {asymptotes.map((y, i) => (
            <line key={i} x1={PAD.l} y1={sy(y)} x2={W - PAD.r} y2={sy(y)} className="dl-plot__asym" />
          ))}

          {/* curves */}
          <g clipPath={`url(#${clip})`}>
            {series.map((s, i) => (
              <path
                key={s.id}
                d={paths[i]}
                className="dl-plot__curve"
                style={{ stroke: s.color, strokeDasharray: s.dash, strokeWidth: s.width ?? 2 }}
              />
            ))}
          </g>

          {/* direct labels */}
          {labels.map((l) => (
            <text key={l.id} x={W - PAD.r - 4} y={l.y + 3.5} textAnchor="end" className="dl-plot__dlabel" style={{ fill: l.color }}>
              {l.label}
            </text>
          ))}

          {/* crosshair */}
          {hz !== undefined && (
            <g>
              <line x1={sx(hz)} y1={PAD.t} x2={sx(hz)} y2={H - PAD.b} className="dl-plot__cross" />
              {series.map((s) => {
                const y = s.f(hz);
                if (!Number.isFinite(y) || y < ymin || y > ymax) return null;
                return <circle key={s.id} cx={sx(hz)} cy={sy(y)} r={4} className="dl-plot__dot" style={{ fill: s.color }} />;
              })}
            </g>
          )}

          {/* pointer capture */}
          <rect
            x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent"
            onPointerMove={(e) => setFromClientX(e.clientX)}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hz !== undefined && (
          <div
            className="dl-tip"
            style={{ left: `${tipLeftPct}%`, transform: flip ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}
          >
            <div className="dl-tip__head">z = {fmt2(hz)}</div>
            {series.map((s) => {
              const y = s.f(hz);
              return (
                <div key={s.id} className="dl-tip__row">
                  <span className="dl-tip__key" style={{ background: s.color }} data-dash={s.dash ? '1' : undefined} />
                  <span className="dl-tip__val">{Number.isFinite(y) ? fmt2(y) : '—'}</span>
                  <span className="dl-tip__name">{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {caption && <figcaption className="dl-plot__cap">{caption}</figcaption>}
    </figure>
  );
}

/* ── LayerFlowChart ──────────────────────────────────────────────────────
   layers: [{ layer, grad, act }] — magnitudes plotted on a log₁₀ axis.
   highlight: layer number to ring (the backprop replay), or null.
   ------------------------------------------------------------------------ */
export function LayerFlowChart({ layers, highlight = null, height = 330 }) {
  const H = height;
  const wrapRef = useRef(null);
  const [hoverL, setHoverL] = useState(null);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = layers.length;

  const { lo, hi } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    layers.forEach((d) => {
      [d.grad, d.act].forEach((v) => {
        const lv = Math.log10(Math.max(v, 1e-12));
        mn = Math.min(mn, lv);
        mx = Math.max(mx, lv);
      });
    });
    let lo2 = Math.floor(mn);
    let hi2 = Math.ceil(mx);
    if (hi2 - lo2 < 4) { const pad = Math.ceil((4 - (hi2 - lo2)) / 2); lo2 -= pad; hi2 += pad; }
    return { lo: Math.max(lo2, -12), hi: Math.min(hi2, 12) };
  }, [layers]);

  const sx = (l) => PAD.l + ((l - 1) / (n - 1)) * plotW;
  const sy = (v) => {
    const lv = Math.log10(Math.max(v, 1e-12));
    return PAD.t + (1 - (lv - lo) / (hi - lo)) * plotH;
  };

  const decades = useMemo(() => {
    const span = hi - lo;
    const step = span <= 8 ? 1 : span <= 16 ? 2 : 3;
    const out = [];
    for (let d = lo; d <= hi; d += step) out.push(d);
    return out;
  }, [lo, hi]);

  const seriesDefs = [
    { id: 'grad', label: 'gradient ‖∂L/∂z‖', color: 'var(--dlv-orange)', get: (d) => d.grad },
    { id: 'act', label: 'signal (activation std)', color: 'var(--dlv-blue)', get: (d) => d.act },
  ];

  const pathFor = (get) =>
    layers.map((d, i) => `${i ? 'L' : 'M'}${sx(d.layer).toFixed(1)} ${sy(get(d)).toFixed(1)}`).join('');

  const snap = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const l = Math.round(1 + ((px - PAD.l) / plotW) * (n - 1));
    setHoverL(Math.min(Math.max(l, 1), n));
  };

  const onKey = (e) => {
    const cur = hoverL ?? 1;
    if (e.key === 'ArrowLeft') { setHoverL(Math.max(1, cur - 1)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setHoverL(Math.min(n, cur + 1)); e.preventDefault(); }
    if (e.key === 'Escape') setHoverL(null);
  };

  const focusL = highlight ?? hoverL;
  const hovered = focusL ? layers[focusL - 1] : null;
  const tipLeftPct = focusL ? (sx(focusL) / W) * 100 : 0;
  const flip = focusL ? sx(focusL) > W * 0.62 : false;

  return (
    <figure className="dl-plot">
      <div
        ref={wrapRef}
        className="dl-plot__stage"
        tabIndex={0}
        role="application"
        aria-label="Per-layer magnitudes — arrow keys move between layers"
        onKeyDown={onKey}
        onBlur={() => setHoverL(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="dl-plot__svg" preserveAspectRatio="xMidYMid meet">
          {decades.map((d) => (
            <g key={d}>
              <line x1={PAD.l} y1={sy(10 ** d)} x2={W - PAD.r} y2={sy(10 ** d)} className={d === 0 ? 'dl-plot__axis' : 'dl-plot__grid'} />
              <text x={PAD.l - 8} y={sy(10 ** d) + 3.5} textAnchor="end" className="dl-plot__tick">10{sup(d)}</text>
            </g>
          ))}
          {layers.map((d) => (
            <text key={d.layer} x={sx(d.layer)} y={H - PAD.b + 16} textAnchor="middle" className="dl-plot__tick">{d.layer}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 4} textAnchor="middle" className="dl-plot__ax-title">layer (1 = closest to the input)</text>

          {seriesDefs.map((s) => (
            <g key={s.id}>
              <path d={pathFor(s.get)} className="dl-plot__curve" style={{ stroke: s.color, strokeWidth: 2 }} />
              {layers.map((d) => (
                <circle
                  key={d.layer}
                  cx={sx(d.layer)}
                  cy={sy(s.get(d))}
                  r={focusL === d.layer ? 5.5 : 4}
                  className="dl-plot__marker"
                  style={{ fill: s.color, opacity: highlight && highlight !== d.layer ? 0.35 : 1 }}
                />
              ))}
              <text
                x={W - PAD.r - 4}
                y={Math.min(Math.max(sy(s.get(layers[n - 1])) + (s.id === 'grad' ? -8 : 14), PAD.t + 8), H - PAD.b - 4)}
                textAnchor="end"
                className="dl-plot__dlabel"
                style={{ fill: s.color }}
              >
                {s.label}
              </text>
            </g>
          ))}

          {focusL && <line x1={sx(focusL)} y1={PAD.t} x2={sx(focusL)} y2={H - PAD.b} className="dl-plot__cross" />}

          <rect
            x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent"
            onPointerMove={(e) => snap(e.clientX)}
            onPointerLeave={() => setHoverL(null)}
          />
        </svg>

        {hovered && (
          <div className="dl-tip" style={{ left: `${tipLeftPct}%`, transform: flip ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}>
            <div className="dl-tip__head">layer {hovered.layer}</div>
            <div className="dl-tip__row">
              <span className="dl-tip__key" style={{ background: 'var(--dlv-orange)' }} />
              <span className="dl-tip__val">{fmtSci(hovered.grad)}</span>
              <span className="dl-tip__name">gradient RMS</span>
            </div>
            <div className="dl-tip__row">
              <span className="dl-tip__key" style={{ background: 'var(--dlv-blue)' }} />
              <span className="dl-tip__val">{fmtSci(hovered.act)}</span>
              <span className="dl-tip__name">activation std</span>
            </div>
          </div>
        )}
      </div>
      <figcaption className="dl-plot__cap">
        Log scale. A healthy network keeps both curves flat; watch what each recipe does instead.
      </figcaption>
    </figure>
  );
}
