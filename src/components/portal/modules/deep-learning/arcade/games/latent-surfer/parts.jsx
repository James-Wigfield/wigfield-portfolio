import { useEffect, useRef } from 'react';
import { useSprite } from '../../core/art.js';

/* ============================================================================
   LATENT SURFER — DRAWN PARTS (components only; the numbers come in as props
   from maths/latentSurfer.js, the words from content/latent-surfer.js)
     Px          one decoded 28 × 28 image on a canvas, dark ink on white as
                 the slides draw Fashion MNIST (255 − v), crisp pixels
     SliceMap    tiles × tiles decodes over the 2D slice, with the cursor
                 (the surfer sprite once it loads, core/art.js; else a dot)
     Meter       a horizontal bar (MSE to target, the find stage's ℒ)
     SampleWire  Figure 17-11's sampling wiring with this item's numbers
     NumberLine  where the sampled coding lands (after the answer)
     Bells       N(μ, σ²) per coding dimension against N(0, 1)
     Heat        the latent-loss heat meter (vertical)
   ========================================================================== */

function paint(ctx, px, ox = 0, oy = 0) {
  const img = ctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const g = 255 - Math.round(Math.min(1, Math.max(0, px[i])) * 255);
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, ox, oy);
}

export function Px({ px, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !px) return;
    paint(c.getContext('2d'), px);
  }, [px]);
  return <canvas ref={ref} width={28} height={28} className={`dla-ls__px ${className}`} role="img" aria-label={label} />;
}

// tiles: decodes, row-major, top row = largest b; value → [a, b] on pick
export function SliceMap({ tiles, n, range, a, b, onPick, label, axisA, axisB }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !tiles.length) return;
    const ctx = c.getContext('2d');
    tiles.forEach((px, i) => paint(ctx, px, (i % n) * 28, Math.floor(i / n) * 28));
  }, [tiles, n]);
  const [lo, hi] = range;
  const fx = (v) => ((v - lo) / (hi - lo)) * 100;
  const surfer = useSprite('surfer.png');
  const pos = { left: `${fx(a)}%`, top: `${100 - fx(b)}%` };
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onPick(lo + x * (hi - lo), hi - y * (hi - lo));
  };
  return (
    <div className="dla-ls__map">
      <div
        className="dla-ls__mapbox"
        role="img"
        aria-label={label}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons & 1) pick(e); }}
      >
        <canvas ref={ref} width={n * 28} height={n * 28} className="dla-ls__mapc" />
        {surfer
          ? <img className="dla-sprite dla-ls__surfer" src={surfer} alt="" width={32} height={32} style={pos} aria-hidden="true" />
          : <span className="dla-ls__cursor" style={pos} aria-hidden="true" />}
      </div>
      <span className="dla-ls__axis dla-ls__axis--a" aria-hidden="true">{axisA} →</span>
      <span className="dla-ls__axis dla-ls__axis--b" aria-hidden="true">{axisB} →</span>
    </div>
  );
}

// value in [0, 1] → fill; mark (optional) in [0, 1] → a tick (e.g. the threshold)
export function Meter({ frac, mark = null, ok = false, label, value, sub }) {
  return (
    <div className={`dla-ls__meter${ok ? ' dla-ls__meter--ok' : ''}`}>
      <span className="dla-ls__lab">{label}</span>
      <span className="dla-ls__meterbar" aria-hidden="true">
        <span className="dla-ls__meterfill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} />
        {mark !== null && <span className="dla-ls__metermark" style={{ left: `${mark * 100}%` }} />}
      </span>
      <span className="dla-ls__meterv">{value}</span>
      {sub && <span className="dla-ls__meters">{sub}</span>}
    </div>
  );
}

// Figure 17-11's wiring: Codings σ × noise → + Codings μ → codings
export function SampleWire({ muText, sigmaText, noiseText, outText, gammaText, reveal, words }) {
  const box = (x, y, w, title, val, cls = '') => (
    <g transform={`translate(${x} ${y})`} className={cls}>
      <rect width={w} height="46" rx="7" className="dla-ls__box" />
      <text x={w / 2} y="18" textAnchor="middle" className="dla-t dla-t--s">{title}</text>
      <text x={w / 2} y="37" textAnchor="middle" className="dla-t dla-t--m dla-t--b">{val}</text>
    </g>
  );
  const op = (x, y, s) => (
    <g transform={`translate(${x} ${y})`}>
      <circle r="15" className="dla-ls__op" />
      <text y="6" textAnchor="middle" className="dla-t dla-t--b">{s}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 520 254" className="dla-svg dla-ls__wire" role="img" aria-label={words.aria}>
      <defs>
        <marker id="dla-ls-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="dla-ls__arrowhead" />
        </marker>
      </defs>
      {/* wires */}
      <path d="M95 168 V92" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      <path d="M284 168 V92" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      <path d="M392 76 H304" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      <path d="M268 76 H115" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      <path d="M95 60 V52" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      <path d="M284 234 V218" className="dla-ls__wirepath" markerEnd="url(#dla-ls-arr)" />
      {op(95, 76, '+')}
      {op(284, 76, '×')}
      {box(10, 168, 170, words.mu, muText, 'dla-ls__g-mu')}
      {box(196, 168, 176, words.sigma, sigmaText, 'dla-ls__g-sigma')}
      {box(392, 53, 124, words.noise, noiseText, 'dla-ls__g-noise')}
      {box(10, 4, 170, words.out, outText, `dla-ls__g-out${reveal ? ' dla-ls__g-out--on' : ''}`)}
      <text x="284" y="249" textAnchor="middle" className="dla-t dla-t--m dla-t--s">{gammaText}</text>
    </svg>
  );
}

// a number line: markers [{ v, label, cls, ring? }]; each marker's label sits
// on its own row above the axis, so close values never overprint
export function NumberLine({ lo, hi, markers, aria }) {
  const W = 520;
  const AX = 58;
  const x = (v) => 20 + ((v - lo) / (hi - lo)) * (W - 40);
  const ticks = [];
  for (let t = Math.ceil(lo); t <= Math.floor(hi); t++) ticks.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${AX + 26}`} className="dla-svg dla-ls__line" role="img" aria-label={aria}>
      <line x1="20" x2={W - 20} y1={AX} y2={AX} className="dla-ls__axisline" />
      {ticks.map((t) => (
        <g key={t} transform={`translate(${x(t)} ${AX})`}>
          <line y1="-4" y2="4" className="dla-ls__axisline" />
          <text y="20" textAnchor="middle" className="dla-t dla-t--xs">{String(t).replace('-', '−')}</text>
        </g>
      ))}
      {markers.map((m, i) => {
        const mx = x(Math.min(hi, Math.max(lo, m.v)));
        return (
          <g key={i} className={m.cls}>
            <line x1={mx} x2={mx} y1={AX - 12 - 15 * i} y2={AX} className="dla-ls__mkstem" />
            <circle cx={mx} cy={AX} r={m.ring ? 7 : 5.5} className="dla-ls__mk" />
            <text x={mx} y={AX - 15 - 15 * i} textAnchor={mx > W - 70 ? 'end' : mx < 70 ? 'start' : 'middle'} className="dla-t dla-t--s dla-halo">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const pdf = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
function bellPath(mu, s, lo, hi, W, H, peak, closed = false) {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const v = lo + ((hi - lo) * i) / 120;
    const px = (i / 120) * W;
    const py = H - (Math.min(pdf(v, mu, s), peak) / peak) * (H - 6);
    pts.push(`${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return closed ? `${pts.join(' ')} L${W} ${H} L0 ${H} Z` : pts.join(' ');
}

// dims: [{ mu, sigma, label }]
export function Bells({ dims, aria, words }) {
  const lo = -4.5;
  const hi = 4.5;
  const W = 240;
  const H = 96;
  return (
    <div className={`dla-ls__bells dla-ls__bells--${dims.length}`} role="img" aria-label={aria}>
      {dims.map((d, i) => {
        const peak = Math.max(pdf(0, 0, 1), pdf(d.mu, d.mu, d.sigma));
        return (
          <svg key={i} viewBox={`-6 -14 ${W + 12} ${H + 34}`} className="dla-svg dla-ls__bell">
            <text x="0" y="-2" className="dla-t dla-t--s">{d.label}</text>
            <line x1="0" x2={W} y1={H} y2={H} className="dla-ls__axisline" />
            <line x1={W / 2} x2={W / 2} y1={H} y2={H + 5} className="dla-ls__axisline" />
            <text x={W / 2} y={H + 16} textAnchor="middle" className="dla-t dla-t--xs">0</text>
            <path d={bellPath(0, 1, lo, hi, W, H, peak)} className="dla-ls__bell0" />
            <path d={bellPath(d.mu, d.sigma, lo, hi, W, H, peak, true)} className="dla-ls__bell1f" />
            <path d={bellPath(d.mu, d.sigma, lo, hi, W, H, peak)} className="dla-ls__bell1" />
          </svg>
        );
      })}
      <p className="dla-ls__legend">
        <span className="dla-ls__key dla-ls__key--0" aria-hidden="true" />{words.target}
        <span className="dla-ls__key dla-ls__key--1" aria-hidden="true" />{words.coding}
      </p>
    </div>
  );
}

export function Heat({ value, given = null, max, label, aria, reveal, unknown }) {
  const f = (v) => Math.max(0, Math.min(1, v / max));
  return (
    <div className={`dla-ls__heat${reveal ? ' dla-ls__heat--on' : ''}`} role="img" aria-label={aria}>
      <span className="dla-ls__heattube" aria-hidden="true">
        <span className="dla-ls__heatfill" style={{ transform: `scaleY(${reveal ? f(value) : 0})` }} />
        {reveal && given !== null && Number.isFinite(given) && <span className="dla-ls__heatyou" style={{ bottom: `${f(given) * 100}%` }} />}
      </span>
      <span className="dla-ls__lab">{label}</span>
      <span className="dla-ls__heatv">{reveal ? value : unknown}</span>
    </div>
  );
}
