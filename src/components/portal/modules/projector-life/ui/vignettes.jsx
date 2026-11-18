/* ============================================================================
   PROJECTOR LIFE — Applications vignettes: tiny animated dark scenes, one per
   use. Pure SVG + CSS keyframes (ui/apps.css, all `pjl-v-*`); every
   animation stops under prefers-reduced-motion and the still frame still
   reads. viewBox 240 × 150 for all of them.
   ========================================================================== */

function Frame({ label, children }) {
  return (
    <svg viewBox="0 0 240 150" className="pjl-vig" role="img" aria-label={label}>
      <rect width="240" height="150" className="pjl-v-bg" />
      {children}
    </svg>
  );
}

/* 01 — ceiling ecosystem night-light: creatures swing under a pitched roof */
export function VNight() {
  return (
    <Frame label="Creatures swinging under a pitched roof above a bed">
      <polyline points="14,62 120,16 226,62" className="pjl-v-line" />
      <line x1="14" y1="62" x2="14" y2="150" className="pjl-v-line pjl-v-dim" />
      <line x1="226" y1="62" x2="226" y2="150" className="pjl-v-line pjl-v-dim" />
      {[
        [62, 40, 0],
        [120, 22, 0.8],
        [176, 42, 1.6],
      ].map(([x, y, d]) => (
        <g key={x} className="pjl-v-swing" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `-${d}s` }}>
          <line x1={x} y1={y} x2={x} y2={y + 26} className="pjl-v-thread" />
          <circle cx={x} cy={y + 30} r="4.5" className="pjl-v-violet pjl-v-glow" />
        </g>
      ))}
      {[[40, 30], [88, 26], [150, 24], [200, 36]].map(([x, y], i) => (
        <circle key={x} cx={x} cy={y + 8} r="1.3" className="pjl-v-star" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <rect x="40" y="122" width="96" height="16" rx="3" className="pjl-v-solid" />
      <rect x="40" y="114" width="26" height="12" rx="4" className="pjl-v-solid pjl-v-lift" />
      <path d="M66 122 q30 -12 64 -2" className="pjl-v-line pjl-v-dim" />
    </Frame>
  );
}

/* 02 — bar ambience: Gray-Scott drips down the back wall */
export function VBar() {
  const drips = [22, 50, 78, 108, 136, 164, 194, 220];
  return (
    <Frame label="Coloured patterns dripping down a bar's back wall">
      {drips.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="8" x2={x} y2={40 + (i % 3) * 18} className="pjl-v-streak" style={{ animationDelay: `${i * 0.35}s` }} />
          <circle cx={x} cy="20" r={2.6 + (i % 2)} className={`pjl-v-drip ${i % 2 ? 'pjl-v-coral' : 'pjl-v-amber'}`} style={{ animationDelay: `${i * 0.45}s` }} />
        </g>
      ))}
      <rect x="0" y="104" width="240" height="46" className="pjl-v-solid" />
      <line x1="0" y1="104" x2="240" y2="104" className="pjl-v-line" />
      {[60, 92, 170].map((x) => (
        <path key={x} d={`M${x} 92 h12 l-3 12 h-6z`} className="pjl-v-line" />
      ))}
      {[34, 128, 206].map((x) => (
        <circle key={x} cx={x} cy="128" r="9" className="pjl-v-head" />
      ))}
    </Frame>
  );
}

/* 03 — gallery: slime-mould veins grow across a room corner */
export function VGallery() {
  return (
    <Frame label="Slime-mould veins growing across the corner of a gallery">
      <polygon points="0,10 120,26 120,128 0,146" className="pjl-v-wall" />
      <polygon points="120,26 240,10 240,146 120,128" className="pjl-v-wall pjl-v-wall2" />
      {[
        'M10 120 C 40 90, 60 96, 80 70 S 110 40, 118 46',
        'M30 140 C 50 110, 90 120, 116 96',
        'M122 60 C 150 50, 170 80, 200 60 S 230 40, 236 30',
        'M124 110 C 150 96, 180 120, 230 100',
        'M80 70 C 90 90, 100 104, 118 112',
      ].map((d, i) => (
        <path key={i} d={d} pathLength="100" className="pjl-v-vein" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
      <circle cx="118" cy="46" r="3" className="pjl-v-bio pjl-v-glow" />
      <circle cx="200" cy="60" r="3" className="pjl-v-bio pjl-v-glow" />
      {[78, 168].map((x) => (
        <g key={x}>
          <circle cx={x} cy="104" r="7" className="pjl-v-head" />
          <rect x={x - 9} y="113" width="18" height="37" rx="7" className="pjl-v-head" />
        </g>
      ))}
    </Frame>
  );
}

/* 04 — teaching: one gravity, three habitats, histograms splitting */
export function VTeach() {
  const cols = [
    { x: 40, k: 'floor', cls: 'pjl-v-amber' },
    { x: 120, k: 'wall', cls: 'pjl-v-teal' },
    { x: 200, k: 'roof', cls: 'pjl-v-violet' },
  ];
  return (
    <Frame label="Floor, wall and roof habitats under one gravity, with trait histograms splitting apart">
      <line x1="10" y1="62" x2="70" y2="62" className="pjl-v-line" />
      <circle cx="26" cy="57" r="4" className="pjl-v-amber pjl-v-crawl" />
      <line x1="120" y1="12" x2="120" y2="66" className="pjl-v-line" />
      <circle cx="124" cy="40" r="4" className="pjl-v-teal pjl-v-climb" />
      <line x1="170" y1="14" x2="230" y2="14" className="pjl-v-line" />
      <g className="pjl-v-swing" style={{ transformOrigin: '200px 14px' }}>
        <line x1="200" y1="14" x2="200" y2="34" className="pjl-v-thread" />
        <circle cx="200" cy="38" r="4" className="pjl-v-violet" />
      </g>
      {cols.map((c) => (
        <g key={c.k}>
          <path d={`M${c.x + 26} 74 v14`} className="pjl-v-arrow" />
          <path d={`M${c.x + 22} 84 l4 6 l4 -6`} className="pjl-v-arrow" />
          {[0, 1, 2, 3].map((b) => (
            <rect key={b} x={c.x - 22 + b * 11} y="104" width="8" height="36" className={`pjl-v-bar ${c.cls}`} style={{ animationDelay: `${b * 0.25 + c.x / 200}s` }} />
          ))}
          <text x={c.x} y="99" textAnchor="middle" className="pjl-v-text">
            {c.k}
          </text>
        </g>
      ))}
    </Frame>
  );
}

/* 05 — haunted house: something descends, then drops */
export function VHaunt() {
  return (
    <Frame label="A creature lowering itself from a dark ceiling, then dropping">
      <polygon points="0,0 240,0 180,38 60,38" className="pjl-v-wall" />
      <polygon points="0,150 240,150 180,112 60,112" className="pjl-v-wall pjl-v-wall2" />
      <line x1="60" y1="38" x2="60" y2="112" className="pjl-v-line pjl-v-dim" />
      <line x1="180" y1="38" x2="180" y2="112" className="pjl-v-line pjl-v-dim" />
      <rect x="104" y="52" width="32" height="60" className="pjl-v-door" />
      <g className="pjl-v-drop">
        <line x1="150" y1="0" x2="150" y2="40" className="pjl-v-thread" />
        <circle cx="150" cy="44" r="6" className="pjl-v-coral pjl-v-glow" />
        <circle cx="148" cy="43" r="1.1" className="pjl-v-eye" />
        <circle cx="152" cy="43" r="1.1" className="pjl-v-eye" />
      </g>
      <circle cx="84" cy="96" r="1.4" className="pjl-v-eye pjl-v-blink" />
      <circle cx="89" cy="96" r="1.4" className="pjl-v-eye pjl-v-blink" />
    </Frame>
  );
}

/* 06 — calm room: slow blooms breathing on the ceiling */
export function VCalm() {
  return (
    <Frame label="Soft rings of light slowly breathing on a ceiling over someone lying down">
      {[
        [70, 46, 0],
        [150, 36, 2],
        [196, 64, 4],
      ].map(([x, y, d]) => (
        <g key={x}>
          {[22, 14, 7].map((r) => (
            <circle key={r} cx={x} cy={y} r={r} className="pjl-v-ring" style={{ animationDelay: `-${d + r / 10}s`, transformOrigin: `${x}px ${y}px` }} />
          ))}
        </g>
      ))}
      <path d="M40 130 q30 -16 70 -6 q30 6 60 -2" className="pjl-v-line pjl-v-dim" />
      <ellipse cx="80" cy="134" rx="46" ry="10" className="pjl-v-solid" />
      <circle cx="54" cy="122" r="7" className="pjl-v-head" />
      <rect x="60" y="120" width="56" height="10" rx="5" className="pjl-v-head" />
    </Frame>
  );
}

/* 07 — room-scale evolution game: three lineages fight over the room net */
export function VGame() {
  const oct = (cx, cy, r) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4 - Math.PI / 8;
      return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
    }).join(' ');
  return (
    <Frame label="Three coloured lineages spreading and shrinking over an unfolded room, with a live score">
      <polygon points={oct(92, 76, 52)} className="pjl-v-line" />
      <polygon points={oct(92, 76, 30)} className="pjl-v-line pjl-v-dim" />
      <circle cx="72" cy="60" r="18" className="pjl-v-blob pjl-v-amber" style={{ transformOrigin: '72px 60px' }} />
      <circle cx="112" cy="66" r="16" className="pjl-v-blob pjl-v-teal" style={{ transformOrigin: '112px 66px', animationDelay: '-1.3s' }} />
      <circle cx="90" cy="98" r="15" className="pjl-v-blob pjl-v-violet" style={{ transformOrigin: '90px 98px', animationDelay: '-2.6s' }} />
      {[
        ['A', 'pjl-v-amber', 40],
        ['B', 'pjl-v-teal', 72],
        ['C', 'pjl-v-violet', 104],
      ].map(([k, cls, y], i) => (
        <g key={k}>
          <circle cx="170" cy={y} r="4" className={cls} />
          <text x="182" y={y + 4} className="pjl-v-text pjl-v-score">
            {k}
          </text>
          <rect x="196" y={y - 3} width="30" height="6" className={`pjl-v-meter ${cls}`} style={{ animationDelay: `-${i * 1.3}s` }} />
        </g>
      ))}
    </Frame>
  );
}

/* 08 — shop window: life circles the product through the glass */
export function VShop() {
  return (
    <Frame label="Glowing creatures circling a product in a shop window at night">
      <rect x="20" y="10" width="200" height="108" className="pjl-v-glass" />
      <line x1="120" y1="10" x2="120" y2="118" className="pjl-v-line pjl-v-dim" />
      <rect x="98" y="72" width="44" height="34" rx="2" className="pjl-v-solid" />
      <path d="M104 72 q16 -18 32 0" className="pjl-v-line" />
      <g className="pjl-v-orbit" style={{ transformOrigin: '120px 80px' }}>
        {[0, 72, 144, 216, 288].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={120 + 62 * Math.cos(r)} cy={80 + 30 * Math.sin(r)} r="3.2" className={a % 144 ? 'pjl-v-bio pjl-v-glow' : 'pjl-v-coral pjl-v-glow'} />;
        })}
      </g>
      <line x1="0" y1="134" x2="240" y2="134" className="pjl-v-line pjl-v-dim" />
      <g className="pjl-v-walk">
        <circle cx="0" cy="112" r="6" className="pjl-v-head" />
        <rect x="-7" y="119" width="14" height="22" rx="6" className="pjl-v-head" />
      </g>
    </Frame>
  );
}
