import { useEffect, useRef } from 'react';
import { decodeImg } from '../fashion';
import { fmt } from '../ae';

/* ============================================================================
   LECTURE 5 STUDY — SHARED PARTS FOR THE FASHION MNIST LABS (§6, §8, §9)
     FashionImg   one 28 × 28 image on a canvas, drawn as the slides draw
                  them: dark ink on white (255 − v), crisp pixels
     ReconGrid    originals over reconstructions (Figure 17-4's layout), with
                  an optional third row of what was lost |original − recon|
     LossCurve    per-epoch loss lines (train / valid) with end labels
   All data here is this page's own run (./data), never the slides' figures.
   ========================================================================== */

export function FashionImg({ b64, diffFrom, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !b64) return;
    const px = decodeImg(b64);
    const base = diffFrom ? decodeImg(diffFrom) : null;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const v = base ? Math.abs(px[i] - base[i]) : px[i];
      const g = 255 - v;
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [b64, diffFrom]);
  return <canvas ref={ref} width={28} height={28} className="dl5s-fimg" role="img" aria-label={label} />;
}

export function ReconGrid({ data, model, n = 5, diff = false }) {
  const items = data.RECON.items.slice(0, n);
  const names = data.RECON.classNames;
  return (
    <figure className="dl5s-rgrid" style={{ '--n': n }}>
      <div className="dl5s-rgrid__rows">
        <span className="dl5s-rgrid__k">originals</span>
        {items.map((it) => (
          <span key={it.index} className="dl5s-rgrid__cell">
            <FashionImg b64={it.original} label={`original ${it.index + 1}: ${names[it.label]}`} />
            <span className="dl5s-rgrid__name">{names[it.label]}</span>
          </span>
        ))}
        <span className="dl5s-rgrid__k">reconstructions</span>
        {items.map((it) => (
          <span key={it.index} className="dl5s-rgrid__cell">
            <FashionImg b64={it[model]} label={`reconstruction of ${names[it.label]}`} />
            <span className="dl5s-rgrid__mse">MSE {fmt(it.mse[model], 4)}</span>
          </span>
        ))}
        {diff && <span className="dl5s-rgrid__k">what was lost</span>}
        {diff && items.map((it) => (
          <span key={it.index} className="dl5s-rgrid__cell">
            <FashionImg b64={it[model]} diffFrom={it.original} label={`difference for ${names[it.label]}`} />
          </span>
        ))}
      </div>
    </figure>
  );
}

const WC = 360;
const HC = 170;
export function LossCurve({ series, label, mark }) {
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
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 11) ends[k].y = ends[k - 1].y + 11;
  const endY = Object.fromEntries(ends.map((e) => [e.i, e.y]));
  return (
    <svg viewBox={`0 0 ${WC} ${HC}`} className="dl5s-svg dl5s-lcurve" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} y1={sy(t)} x2={WC - m.r} y2={sy(t)} className="dl5s-gridline" />
          <text x={m.l - 5} y={sy(t) + 3} textAnchor="end" className="dl5s-tick">{fmt(t, 4)}</text>
        </g>
      ))}
      {[1, Math.ceil(n / 2), n].map((e) => <text key={e} x={sx(e)} y={HC - 8} textAnchor="middle" className="dl5s-tick">{e}</text>)}
      {mark && <line x1={sx(mark.at)} y1={m.t} x2={sx(mark.at)} y2={HC - m.b} className="dl5s-marker"><title>{mark.label}</title></line>}
      {series.map((s, si) => (
        <g key={s.label}>
          <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${sx(i + 1).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ')} className={`dl5s-lcurve__line dl5s-lcurve__line--${s.tone}`} />
          {s.values.map((v, i) => <circle key={i} cx={sx(i + 1)} cy={sy(v)} r={6} className="dl5s-lcurve__hit"><title>{`${s.label}, epoch ${i + 1}: ${fmt(v, 5)}`}</title></circle>)}
          <text x={sx(s.values.length) + 6} y={endY[si]} className="dl5s-svg__label">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}
