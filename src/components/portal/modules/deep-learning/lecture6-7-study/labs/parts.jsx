import { useEffect, useRef } from 'react';
import { decodeImg } from '../fashion';
import { fmt } from '../gen';
import './parts.css';

/* ============================================================================
   LECTURES 6–7 STUDY — SHARED PARTS FOR THE FASHION MNIST LABS
     FashionImg   one 28 × 28 image on a canvas, drawn as the slides draw
                  them: dark ink on white (255 − v), crisp pixels. Takes the
                  data files' base64 (`b64`) or bytes the page made (`px`)
     ImgRow       a labelled row of images (originals, noisy, reconstructions…)
     ImgGrid      rows × cols of images (the slides' 3 × 7 and 4 × 8 grids)
     LossCurve    per-epoch loss lines (train / valid) with end labels
   Data here is this page's own (./data or computed live), never the slides'.
   ========================================================================== */

export function FashionImg({ b64, px, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || (!b64 && !px)) return;
    const v = px ?? decodeImg(b64);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const g = 255 - v[i];
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [b64, px]);
  return <canvas ref={ref} width={28} height={28} className={`dl67s-fimg ${className}`} role="img" aria-label={label} />;
}

// rows: [{ key, label, cells: [{ b64 | px, label, note? }] }]
export function ImgRows({ rows, cols, min = 3.2, max = 5.5 }) {
  const n = cols ?? Math.max(...rows.map((r) => r.cells.length));
  return (
    <figure className="dl67s-rgrid" style={{ '--n': n, '--cmin': `${min}rem`, '--cmax': `${max}rem` }}>
      <div className="dl67s-rgrid__rows">
        {rows.map((r) => (
          <div key={r.key} className="dl67s-rgrid__row">
            <span className="dl67s-rgrid__k">{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} className="dl67s-rgrid__cell">
                <FashionImg b64={c.b64} px={c.px} label={c.label} />
                {c.note && <span className="dl67s-rgrid__note">{c.note}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

// a plain grid of images, `cols` wide (no row labels)
export function ImgGrid({ cells, cols, label, max = 3.6 }) {
  return (
    <div className="dl67s-igrid" style={{ '--cols': cols, '--imax': `${max}rem` }} role="group" aria-label={label}>
      {cells.map((c, i) => <FashionImg key={i} b64={c.b64} px={c.px} label={c.label} />)}
    </div>
  );
}

const WC = 360;
const HC = 170;
export function LossCurve({ series, label, mark, xLabel = 'epoch' }) {
  const m = { l: 50, r: 64, t: 12, b: 24 };
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 0.001;
  const n = Math.max(...series.map((s) => s.values.length));
  const sx = (e) => m.l + ((e - 1) / Math.max(1, n - 1)) * (WC - m.l - m.r);
  const sy = (v) => m.t + ((hi + pad - v) / (hi - lo + 2 * pad)) * (HC - m.t - m.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  // end labels, pushed apart so two lines ending close together stay legible
  const ends = series.map((s, i) => ({ i, y: sy(s.values[s.values.length - 1]) + 3 })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
  const dec = hi - lo > 0.5 ? 2 : 4;
  const endY = Object.fromEntries(ends.map((e) => [e.i, e.y]));
  return (
    <svg viewBox={`0 0 ${WC} ${HC}`} className="dl67s-svg dl67s-lcurve" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} y1={sy(t)} x2={WC - m.r} y2={sy(t)} className="dl67s-gridline" />
          <text x={m.l - 5} y={sy(t) + 3} textAnchor="end" className="dl67s-tick">{fmt(t, dec)}</text>
        </g>
      ))}
      {[1, Math.ceil(n / 2), n].map((e) => <text key={e} x={sx(e)} y={HC - 8} textAnchor="middle" className="dl67s-tick">{e}</text>)}
      {mark && <line x1={sx(mark.at)} y1={m.t} x2={sx(mark.at)} y2={HC - m.b} className="dl67s-marker"><title>{mark.label}</title></line>}
      {series.map((s, si) => (
        <g key={s.label}>
          <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${sx(i + 1).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ')} className={`dl67s-lcurve__line dl67s-lcurve__line--${s.tone}`} />
          {s.values.map((v, i) => <circle key={i} cx={sx(i + 1)} cy={sy(v)} r={6} className="dl67s-lcurve__hit"><title>{`${s.label}, ${xLabel} ${i + 1}: ${fmt(v, 5)}`}</title></circle>)}
          <text x={sx(s.values.length) + 6} y={endY[si]} className={`dl67s-svg__label dl67s-lcurve__end--${s.tone}`}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function Pending() {
  return <p className="dl67s-readout dl67s-fwait">Loading this page’s Fashion MNIST run…</p>;
}
