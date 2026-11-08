/* Small isometric SVG pictures for the plan page: the three render "lanes"
   (diorama · scan · generated). Pure, deterministic, no state. */

const S = 15;
const OX = 100;
const OY = 48;
const C30 = Math.cos(Math.PI / 6);

/** metres (x east, y up, z south) → svg point */
const iso = (x, y, z) => [OX + (x - z) * C30 * S, OY + (x + z) * 0.5 * S - y * S];
const pts = (list) => list.map((p) => iso(...p).map((v) => v.toFixed(1)).join(',')).join(' ');

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** An iso box: footprint (x0,z0) w×d, from y0 up h. Draws the 3 visible faces. */
export function IsoBox({ x0, z0, w, d, y0 = 0, h, color }) {
  const yt = y0 + h;
  return (
    <g>
      <polygon points={pts([[x0, y0, z0 + d], [x0 + w, y0, z0 + d], [x0 + w, yt, z0 + d], [x0, yt, z0 + d]])} fill={shade(color, 0.86)} />
      <polygon points={pts([[x0 + w, y0, z0], [x0 + w, y0, z0 + d], [x0 + w, yt, z0 + d], [x0 + w, yt, z0]])} fill={shade(color, 0.72)} />
      <polygon points={pts([[x0, yt, z0], [x0 + w, yt, z0], [x0 + w, yt, z0 + d], [x0, yt, z0 + d]])} fill={shade(color, 1.08)} />
    </g>
  );
}

const ROOM = { w: 4, d: 4, h: 2.6 };
const FURNITURE = [
  { x0: 2.1, z0: 1.6, w: 1.5, d: 2.1, h: 0.5, color: '#d9d1c2' }, // bed
  { x0: 2.1, z0: 1.6, w: 1.5, d: 0.25, h: 0.95, color: '#6e5038' }, // headboard
  { x0: 2.15, z0: 2.4, w: 1.4, d: 1.25, y0: 0.5, h: 0.1, color: '#56677f' }, // duvet
  { x0: 0.15, z0: 0.15, w: 1.2, d: 0.55, h: 0.75, color: '#7a5a3c' }, // desk
  { x0: 0.15, z0: 1.5, w: 0.35, d: 0.9, h: 1.8, color: '#8a6a4a' }, // shelf
];

function Shell() {
  const { w, d, h } = ROOM;
  const floor = pts([[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]]);
  const north = pts([[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]]);
  const west = pts([[0, 0, 0], [0, 0, d], [0, h, d], [0, h, 0]]);
  return (
    <g>
      <polygon points={floor} fill="#b08259" />
      <polygon points={north} fill="#ece5d7" />
      <polygon points={west} fill="#dcd3c2" />
      <polygon points={pts([[1.2, 1.0, 0], [2.8, 1.0, 0], [2.8, 2.1, 0], [1.2, 2.1, 0]])} fill="#bcd6df" />
      <polygon points={pts([[0.9, 0, 2.6], [2.4, 0, 2.6], [2.4, 0, 3.7], [0.9, 0, 3.7]])} fill="#c8a46a" />
    </g>
  );
}

export function DioramaArt() {
  return (
    <svg viewBox="0 0 200 124" className="mrp-art" aria-hidden="true">
      <ellipse cx="100" cy="110" rx="70" ry="9" className="mrp-art__shadow" />
      <Shell />
      {FURNITURE.map((f, i) => <IsoBox key={i} {...f} />)}
    </svg>
  );
}

// deterministic pseudo-random
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cloud(seed, count, keep = () => true) {
  const r = rng(seed);
  const out = [];
  const { w, d, h } = ROOM;
  const surfaces = [
    { n: 0.34, f: () => [r() * w, 0, r() * d], c: '#b08259' },
    { n: 0.2, f: () => [r() * w, r() * h, 0], c: '#e4dccb' },
    { n: 0.16, f: () => [0, r() * h, r() * d], c: '#d3c8b4' },
    { n: 0.16, f: () => [2.1 + r() * 1.5, 0.5 + r() * 0.12, 1.6 + r() * 2.1], c: '#56677f' },
    { n: 0.08, f: () => [0.15 + r() * 1.2, 0.75, 0.15 + r() * 0.55], c: '#7a5a3c' },
    { n: 0.06, f: () => [0.15 + r() * 0.35, r() * 1.8, 1.5 + r() * 0.9], c: '#8a6a4a' },
  ];
  for (const s of surfaces) {
    for (let i = 0; i < count * s.n; i++) {
      const p = s.f();
      if (!keep(p)) continue;
      const [x, y] = iso(...p);
      out.push({ x: x + (r() - 0.5) * 1.6, y: y + (r() - 0.5) * 1.6, r: 0.9 + r() * 1.5, c: s.c, o: 0.45 + r() * 0.5 });
    }
  }
  return out;
}

const SCAN = cloud(7, 900);
export function ScanArt() {
  return (
    <svg viewBox="0 0 200 124" className="mrp-art" aria-hidden="true">
      <ellipse cx="100" cy="110" rx="70" ry="9" className="mrp-art__shadow" />
      {SCAN.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.r.toFixed(2)} fill={p.c} opacity={p.o.toFixed(2)} />)}
    </svg>
  );
}

const GEN_SEEN = cloud(11, 700, ([x, , z]) => x + z < 4.6);
const star = (cx, cy, r) => `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;
export function GeneratedArt() {
  const { w, d, h } = ROOM;
  return (
    <svg viewBox="0 0 200 124" className="mrp-art" aria-hidden="true">
      <ellipse cx="100" cy="110" rx="70" ry="9" className="mrp-art__shadow" />
      {GEN_SEEN.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.r.toFixed(2)} fill={p.c} opacity={p.o.toFixed(2)} />)}
      <polygon points={pts([[w, 0, 0], [w, 0, d], [0, 0, d]])} className="mrp-art__ghost" />
      <polyline points={pts([[w, h, 0], [w, 0, 0]])} className="mrp-art__ghost" />
      <polyline points={pts([[0, h, d], [0, 0, d]])} className="mrp-art__ghost" />
      {[[150, 52, 6], [128, 98, 4.5], [168, 80, 3.5]].map(([x, y, r], i) => (
        <path key={i} d={star(x, y, r)} className="mrp-art__spark" />
      ))}
    </svg>
  );
}
