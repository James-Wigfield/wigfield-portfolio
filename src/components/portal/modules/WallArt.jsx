import { useRef, useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   WALL ART — a small collection of print-ready computer-science art
   ----------------------------------------------------------------------------
   A switchable gallery of original A4 pieces. Each piece is ONE resolution-
   independent SVG (so it prints sharp at any DPI) drawn with its own committed
   palette inline as presentation attributes — the export is byte-for-byte what
   you see on screen. Only the surrounding chrome (intro, switcher, toolbar,
   legend) uses the portal's themed .wa-* classes.

   Pieces share one layout grammar so they read as a set: the same A4 frame
   inset + corner brackets, the same eyebrow / "FIG. 0N" / bottom museum-plate
   typography, the same J. WIGFIELD signature — only the concept and palette
   change (light vs dark).

     FIG. 01 · "Forward Pass"   — a feed-forward net resolving to one decision.
     FIG. 02 · "Selective Scan" — my honours model: a 3D CNN–Mamba selective
                                  state-space net reading a whole-body PSMA PET
                                  volume, its state igniting only on cancer.
   ========================================================================== */

// ── Shared A4 canvas (10 user-units per mm → exact 1 : √2 portrait) ──────────
const VW = 2100;   // 210 mm
const VH = 2970;   // 297 mm
const M = 130;     // 13 mm print-safe frame inset
const FX1 = M, FY1 = M, FX2 = VW - M, FY2 = VH - M;
const CX = VW / 2;

// Corner brackets that mark the print-safe area (shared framing device).
const BL = 58;
const BRACKETS = [
  `M${FX1},${FY1 + BL} L${FX1},${FY1} L${FX1 + BL},${FY1}`,
  `M${FX2 - BL},${FY1} L${FX2},${FY1} L${FX2},${FY1 + BL}`,
  `M${FX1},${FY2 - BL} L${FX1},${FY2} L${FX1 + BL},${FY2}`,
  `M${FX2 - BL},${FY2} L${FX2},${FY2} L${FX2},${FY2 - BL}`,
];

// ── Shared helpers ───────────────────────────────────────────────────────────
// Deterministic 0..1 hash → stable geometry/weights (no Math.random flicker).
function hash(a, b, c) {
  let h = (2166136261 ^ Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263) ^ Math.imul(c + 7, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
// Linear colour interpolation between two #rrggbb hexes → rgb() string.
function lerpHex(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Closed Catmull-Rom spline through points → smooth SVG path.
function smoothClosedPath(pts) {
  const n = pts.length;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d + 'Z';
}

/* ════════════════════════════════════════════════════════════════════════════
   FIG. 01 — "FORWARD PASS"  (light)
   A feed-forward neural network drawn as fine art: a whisper-faint weight
   lattice, a single bold teal forward path, resolving to one haloed decision.
   ════════════════════════════════════════════════════════════════════════════ */
const FP_PAPER = '#F3F1E9', FP_INK = '#16222C', FP_INK_SOFT = '#5B6B73', FP_ACCENT = '#0FA08E', FP_ACCENT_DEEP = '#0A5F53';
const FP_LAYER_N = [8, 12, 6, 3, 1];
const FP_LAYER_LABEL = ['INPUT', 'HIDDEN', 'HIDDEN', 'HIDDEN', 'OUTPUT'];
const FP_PATH_IDX = [3, 6, 2, 1, 0];
const FP_PITCH = 138, FP_R = 24, FP_Y_TOP = 770, FP_Y_GAP = 320;
const FP_LAYER_Y = FP_LAYER_N.map((_, i) => FP_Y_TOP + i * FP_Y_GAP);

function fpLayerNodes(li) {
  const n = FP_LAYER_N[li], w = (n - 1) * FP_PITCH, x0 = CX - w / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * FP_PITCH, y: FP_LAYER_Y[li], li, i }));
}
const FP_NODES = FP_LAYER_N.map((_, li) => fpLayerNodes(li));
const FP_OUTPUT = FP_NODES[FP_NODES.length - 1][0];

const FP_EDGES = [];
for (let li = 0; li < FP_NODES.length - 1; li++) {
  const A = FP_NODES[li], B = FP_NODES[li + 1];
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    const w = hash(li, i, j);
    FP_EDGES.push({
      x1: A[i].x, y1: A[i].y, x2: B[j].x, y2: B[j].y,
      op: 0.05 + w * 0.15, sw: 1 + w * 1.3,
      hot: FP_PATH_IDX[li] === i && FP_PATH_IDX[li + 1] === j,
    });
  }
}
const FP_COLD = FP_EDGES.filter((e) => !e.hot);
const FP_HOT = FP_EDGES.filter((e) => e.hot);
const FP_TICK = (dx, dy) => `M${FP_OUTPUT.x + dx * 80},${FP_OUTPUT.y + dy * 80} L${FP_OUTPUT.x + dx * 106},${FP_OUTPUT.y + dy * 106}`;

function ForwardPassArt({ svgRef }) {
  return (
    <svg ref={svgRef} className="wa-art" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${VW} ${VH}`}
         role="img" aria-label="Forward Pass — a minimalist feed-forward neural network, sized for A4 print"
         shapeRendering="geometricPrecision">
      <rect x="0" y="0" width={VW} height={VH} fill={FP_PAPER} />
      <rect x={FX1} y={FY1} width={FX2 - FX1} height={FY2 - FY1} fill="none" stroke={FP_INK} strokeWidth="1.4" strokeOpacity="0.28" />
      {BRACKETS.map((d, i) => <path key={`bk${i}`} d={d} fill="none" stroke={FP_INK} strokeWidth="2.6" strokeLinecap="square" />)}

      <text x={FX1} y={252} fill={FP_INK_SOFT} fontFamily="'IBM Plex Mono', monospace" fontSize="24" letterSpacing="5">NEURAL ARCHITECTURE</text>
      <text x={FX2} y={252} fill={FP_INK_SOFT} fontFamily="'IBM Plex Mono', monospace" fontSize="24" letterSpacing="3" textAnchor="end">FIG. 01</text>
      <line x1={FX1} y1={300} x2={FX2} y2={300} stroke={FP_INK} strokeWidth="1.4" strokeOpacity="0.3" />

      <g strokeLinecap="round">
        {FP_COLD.map((e, i) => <line key={`c${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={FP_INK} strokeOpacity={e.op} strokeWidth={e.sw} />)}
      </g>
      <g strokeLinecap="round">
        {FP_HOT.map((e, i) => <line key={`h${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={FP_ACCENT} strokeWidth="4.6" />)}
      </g>

      {FP_LAYER_N.map((n, li) => (
        <g key={`lab${li}`}>
          <text x={FX1} y={FP_LAYER_Y[li] - 6} fill={FP_INK_SOFT} fontFamily="'IBM Plex Mono', monospace" fontSize="23" letterSpacing="2">{FP_LAYER_LABEL[li]}</text>
          <text x={FX1} y={FP_LAYER_Y[li] + 26} fill={FP_ACCENT_DEEP} fontFamily="'IBM Plex Mono', monospace" fontSize="19" letterSpacing="1" opacity="0.8">{`×${n}`}</text>
        </g>
      ))}

      {FP_NODES.flat().map((nd) => {
        const onPath = FP_PATH_IDX[nd.li] === nd.i;
        if (nd.li === FP_NODES.length - 1) return null;
        if (onPath) return (
          <g key={`n${nd.li}-${nd.i}`}>
            <circle cx={nd.x} cy={nd.y} r={FP_R} fill={FP_PAPER} stroke={FP_ACCENT} strokeWidth="3.4" />
            <circle cx={nd.x} cy={nd.y} r="8.5" fill={FP_ACCENT} />
          </g>
        );
        return <circle key={`n${nd.li}-${nd.i}`} cx={nd.x} cy={nd.y} r={FP_R} fill={FP_PAPER} stroke={FP_INK} strokeWidth="2.2" strokeOpacity="0.88" />;
      })}

      <g>
        <circle cx={FP_OUTPUT.x} cy={FP_OUTPUT.y} r="74" fill={FP_ACCENT} opacity="0.1" />
        {[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy], i) => (
          <path key={`t${i}`} d={FP_TICK(dx, dy)} stroke={FP_ACCENT} strokeWidth="2.4" strokeOpacity="0.55" strokeLinecap="round" />
        ))}
        <circle cx={FP_OUTPUT.x} cy={FP_OUTPUT.y} r="46" fill={FP_PAPER} stroke={FP_ACCENT} strokeWidth="4" />
        <circle cx={FP_OUTPUT.x} cy={FP_OUTPUT.y} r="23" fill={FP_ACCENT} />
        <text x={FP_OUTPUT.x + 132} y={FP_OUTPUT.y + 14} fill={FP_ACCENT_DEEP} fontFamily="'Fraunces', Georgia, serif" fontStyle="italic" fontSize="44">ŷ</text>
      </g>

      <line x1={FX1} y1={2330} x2={FX2} y2={2330} stroke={FP_INK} strokeWidth="2" strokeOpacity="0.55" />
      <text x={FX1} y={2496} fill={FP_INK} fontFamily="'Fraunces', Georgia, serif" fontWeight="600" fontSize="170" letterSpacing="3">FORWARD PASS</text>
      <text x={FX1} y={2582} fill={FP_INK_SOFT} fontFamily="'Fraunces', Georgia, serif" fontStyle="italic" fontSize="46">Many signals enter — a single decision leaves.</text>
      <text x={FX1} y={2782} fill={FP_INK_SOFT} fontFamily="'IBM Plex Mono', monospace" fontSize="23" letterSpacing="2">8 → 12 → 6 → 3 → 1&#8194;&#8194;·&#8194;&#8194;σ(Wx + b)</text>
      <text x={FX2} y={2782} fill={FP_INK_SOFT} fontFamily="'IBM Plex Mono', monospace" fontSize="23" letterSpacing="2" textAnchor="end">J. WIGFIELD</text>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FIG. 02 — "SELECTIVE SCAN"  (dark) · the honours model
   A whole-body PSMA PET figure rendered as a dark field. A selective state-space
   scan sweeps the body as glowing teal scanlines whose brightness is the model's
   *retained state* — dim over healthy tissue, igniting on PSMA-avid lesions
   (amber hotspots). The dominant pelvic focus carries the predicted segmentation
   mask. Cool computation, warm disease: the temperature contrast IS the concept,
   and mirrors how a clinician reads PET. Authentic detail from HonoursTracker:
   3D CNN–Mamba · ⁶⁸Ga-PSMA-11 PET/CT · hₜ=Ahₜ₋₁+Bxₜ · multi-directional scan.
   ════════════════════════════════════════════════════════════════════════════ */
const SS_GROUND = '#070A0F', SS_BODYFILL = '#0C1218';
const SS_FRAME = '#2A3C44', SS_BRACKET = '#5E7C84';
const SS_DIM = '#7FA0A4', SS_MATH = '#9FE9DE', SS_CREAM = '#ECE9E0', SS_EVOC = '#90AAB0', SS_SPEC = '#6E8C90';
const SS_SCAN_DIM = '#2E8C84', SS_SCAN_HOT = '#EAFFF9';
const SS_CYAN = '#62E8D6', SS_AMBER = '#FFB23E';

// Whole-body silhouette (arms-down pictogram), absolute coords, centred on CX.
const SS_BODY_PTS = [
  [1006, 712], [1094, 712], [1238, 762], [1264, 860], [1256, 1030], [1240, 1212],
  [1224, 1334], [1202, 1520], [1162, 1744], [1120, 2092], [1160, 2140], [1078, 2150],
  [1082, 2092], [1098, 1748], [1092, 1500], [1050, 1372], [1008, 1500], [1002, 1748],
  [1018, 2092], [1022, 2150], [940, 2140], [980, 2092], [938, 1744], [898, 1520],
  [876, 1334], [860, 1212], [844, 1030], [836, 860], [862, 762],
];
const SS_BODY_PATH = smoothClosedPath(SS_BODY_PTS);
const SS_HEAD = { cx: CX, cy: 648, r: 70 };

// PSMA-avid lesions (sites typical of metastatic prostate cancer). `r` = glow
// radius; `sigma` = how far that lesion ignites the scan state around it.
const SS_LESIONS = [
  { x: 1050, y: 1436, r: 124, sigma: 150, focal: true }, // dominant pelvic focus (prostate bed)
  { x: 1132, y: 1352, r: 58, sigma: 76 },               // pelvic node
  { x: 1050, y: 1180, r: 56, sigma: 74 },               // para-aortic node / spine
  { x: 1096, y: 966, r: 50, sigma: 68 },                // thoracic spine / rib
  { x: 980, y: 1704, r: 54, sigma: 74 },                // proximal femur (bone)
  { x: 1100, y: 792, r: 40, sigma: 58 },                // supraclavicular node
];
const SS_FOCAL = SS_LESIONS[0];

// Raster "selective scan" — horizontal sweep lines, each split into segments
// whose brightness = retained state ∝ proximity to PSMA uptake. Clipped to body.
const SS_SCAN = [];
for (let y = 726; y <= 2086; y += 44) {
  for (let x = CX - 250; x < CX + 250; x += 32) {
    const mx = x + 16;
    let t = 0;
    for (const L of SS_LESIONS) {
      const d = Math.hypot(mx - L.x, y - L.y);
      t = Math.max(t, Math.exp(-(d * d) / (2 * L.sigma * L.sigma)));
    }
    SS_SCAN.push({ x1: x, y1: y, x2: x + 32, y2: y, t });
  }
}

// Irregular predicted-mask contour around a lesion (the segmentation output).
function ssContour(cx, cy, baseR, seed) {
  const pts = [];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2;
    const rr = baseR * (0.8 + 0.36 * hash(seed, k, 3));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.08]);
  }
  return smoothClosedPath(pts);
}
const SS_CONTOURS = [
  ssContour(SS_FOCAL.x, SS_FOCAL.y, 150, 11),
  ssContour(1050, 1180, 74, 23),
  ssContour(980, 1704, 78, 37),
];

// subscript helpers for the SSM equation (font-independent baseline shift)
const Sub = ({ children }) => <tspan dy="9" fontSize="20">{children}</tspan>;
const Res = ({ children }) => <tspan dy="-9">{children}</tspan>;

function SelectiveScanArt({ svgRef }) {
  return (
    <svg ref={svgRef} className="wa-art" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${VW} ${VH}`}
         role="img" aria-label="Selective Scan — a 3D CNN–Mamba state-space model reading a whole-body PSMA PET volume, sized for A4 print"
         shapeRendering="geometricPrecision">
      <defs>
        <radialGradient id="ssLesion">
          <stop offset="0%" stopColor="#FFE0A0" stopOpacity="0.95" />
          <stop offset="42%" stopColor={SS_AMBER} stopOpacity="0.42" />
          <stop offset="100%" stopColor="#FF9A2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ssFocal">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="22%" stopColor="#FFE7B0" stopOpacity="0.72" />
          <stop offset="58%" stopColor={SS_AMBER} stopOpacity="0.32" />
          <stop offset="100%" stopColor="#FF8A2B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ssAura">
          <stop offset="0%" stopColor="#15605C" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#15605C" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ssBody">
          <path d={SS_BODY_PATH} />
          <circle cx={SS_HEAD.cx} cy={SS_HEAD.cy} r={SS_HEAD.r} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width={VW} height={VH} fill={SS_GROUND} />
      <ellipse cx={CX} cy={1360} rx="560" ry="940" fill="url(#ssAura)" />

      <rect x={FX1} y={FY1} width={FX2 - FX1} height={FY2 - FY1} fill="none" stroke={SS_FRAME} strokeWidth="1.4" />
      {BRACKETS.map((d, i) => <path key={`bk${i}`} d={d} fill="none" stroke={SS_BRACKET} strokeWidth="2.6" strokeLinecap="square" />)}

      <text x={FX1} y={252} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="24" letterSpacing="4">SELECTIVE STATE-SPACE MODEL</text>
      <text x={FX2} y={252} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="24" letterSpacing="3" textAnchor="end">FIG. 02</text>
      <line x1={FX1} y1={300} x2={FX2} y2={300} stroke={SS_FRAME} strokeWidth="1.4" />

      {/* body mass (subtle), then the selective scan filling it, then the edge */}
      <path d={SS_BODY_PATH} fill={SS_BODYFILL} />
      <circle cx={SS_HEAD.cx} cy={SS_HEAD.cy} r={SS_HEAD.r} fill={SS_BODYFILL} />
      <g clipPath="url(#ssBody)" strokeLinecap="round">
        {SS_SCAN.map((s, i) => {
          const t = s.t;
          const col = lerpHex(SS_SCAN_DIM, SS_SCAN_HOT, Math.min(1, t * 1.1));
          const w = 1.4 + 3.2 * t;
          return (
            <g key={i}>
              {t > 0.4 && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={col} strokeWidth={w * 2.6} strokeOpacity={0.16 * t} />}
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={col} strokeWidth={w} strokeOpacity={0.12 + 0.82 * t} />
            </g>
          );
        })}
      </g>
      <path d={SS_BODY_PATH} fill="none" stroke="#3C6E70" strokeWidth="1.7" strokeOpacity="0.6" strokeLinejoin="round" />
      <circle cx={SS_HEAD.cx} cy={SS_HEAD.cy} r={SS_HEAD.r} fill="none" stroke="#3C6E70" strokeWidth="1.7" strokeOpacity="0.6" />

      {/* predicted segmentation masks */}
      {SS_CONTOURS.map((d, i) => (
        <path key={`ct${i}`} d={d} fill="none" stroke={SS_CYAN} strokeWidth={i === 0 ? 2.6 : 1.8}
              strokeOpacity={i === 0 ? 0.9 : 0.6} strokeDasharray="9 9" />
      ))}

      {/* lesions — soft PSMA-uptake glow + bright core */}
      {SS_LESIONS.map((L, i) => (
        <g key={`les${i}`}>
          <circle cx={L.x} cy={L.y} r={L.r} fill={`url(#${L.focal ? 'ssFocal' : 'ssLesion'})`} />
          <circle cx={L.x} cy={L.y} r={L.focal ? 13 : 6.5} fill={L.focal ? '#FFFFFF' : '#FFE2A0'} />
          {!L.focal && <circle cx={L.x} cy={L.y} r="6.5" fill="none" stroke={SS_AMBER} strokeWidth="1.4" strokeOpacity="0.7" />}
        </g>
      ))}

      {/* focal target: ring + crosshair (echoes FIG.01's decision marker) */}
      <circle cx={SS_FOCAL.x} cy={SS_FOCAL.y} r="40" fill="none" stroke={SS_CYAN} strokeWidth="1.6" strokeOpacity="0.55" strokeDasharray="4 7" />
      {[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy], i) => (
        <line key={`ft${i}`} x1={SS_FOCAL.x + dx * 48} y1={SS_FOCAL.y + dy * 48} x2={SS_FOCAL.x + dx * 70} y2={SS_FOCAL.y + dy * 70}
              stroke={SS_CYAN} strokeWidth="2" strokeOpacity="0.7" strokeLinecap="round" />
      ))}

      {/* annotation · state-space core (right of the figure) */}
      <line x1={1300} y1={968} x2={1486} y2={905} stroke={SS_DIM} strokeWidth="1.2" strokeOpacity="0.45" />
      <circle cx={1300} cy={968} r="3.4" fill={SS_DIM} />
      <text x={1486} y={862} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="21" letterSpacing="3">STATE-SPACE CORE</text>
      <text x={1486} y={912} fill={SS_MATH} fontFamily="'IBM Plex Mono', monospace" fontSize="30">h<Sub>t</Sub><Res> = A·h</Res><Sub>t−1</Sub><Res> + B·x</Res><Sub>t</Sub></text>
      <text x={1486} y={958} fill={SS_MATH} fontFamily="'IBM Plex Mono', monospace" fontSize="30">y<Sub>t</Sub><Res> = C·h</Res><Sub>t</Sub></text>
      <text x={1486} y={1010} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="21">Δ, B, C ← fn(x<Sub>t</Sub><Res>)  — selective</Res></text>

      {/* annotation · the input volume + scan (left of the figure) */}
      <line x1={800} y1={1196} x2={612} y2={1262} stroke={SS_DIM} strokeWidth="1.2" strokeOpacity="0.45" />
      <circle cx={800} cy={1196} r="3.4" fill={SS_DIM} />
      <text x={612} y={1224} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="21" letterSpacing="3" textAnchor="end">MULTI-DIRECTIONAL SCAN</text>
      <text x={612} y={1274} fill={SS_MATH} fontFamily="'IBM Plex Mono', monospace" fontSize="26" textAnchor="end">3D → 1D&#8194;·&#8194;↑ ↓ ↔ ⤡</text>
      <text x={612} y={1320} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="21" textAnchor="end">x ∈ (2, 64, 128, 64)</text>

      {/* focal-lesion label */}
      <line x1={SS_FOCAL.x - 70} y1={SS_FOCAL.y + 64} x2={760} y2={1648} stroke={SS_AMBER} strokeWidth="1.2" strokeOpacity="0.5" />
      <text x={744} y={1640} fill={SS_AMBER} fontFamily="'IBM Plex Mono', monospace" fontSize="21" letterSpacing="2" textAnchor="end" opacity="0.92">DOMINANT FOCUS</text>
      <text x={744} y={1672} fill={SS_DIM} fontFamily="'IBM Plex Mono', monospace" fontSize="18" textAnchor="end">predicted lesion mask</text>

      {/* bottom museum plate */}
      <line x1={FX1} y1={2330} x2={FX2} y2={2330} stroke={SS_FRAME} strokeWidth="2" />
      <text x={FX1} y={2496} fill={SS_CREAM} fontFamily="'Fraunces', Georgia, serif" fontWeight="600" fontSize="168" letterSpacing="3">SELECTIVE SCAN</text>
      <text x={FX1} y={2582} fill={SS_EVOC} fontFamily="'Fraunces', Georgia, serif" fontStyle="italic" fontSize="46">One state, sweeping the whole body — taught to miss no light.</text>
      <text x={FX1} y={2782} fill={SS_SPEC} fontFamily="'IBM Plex Mono', monospace" fontSize="23" letterSpacing="2">3D CNN–MAMBA&#8194;·&#8194;⁶⁸Ga-PSMA-11 PET/CT&#8194;·&#8194;β &gt; α</text>
      <text x={FX2} y={2782} fill={SS_SPEC} fontFamily="'IBM Plex Mono', monospace" fontSize="23" letterSpacing="2" textAnchor="end">J. WIGFIELD · CITS4010</text>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   GALLERY
   ════════════════════════════════════════════════════════════════════════════ */
const PIECES = [
  {
    id: 'forward-pass', fig: 'FIG. 01', label: 'Forward Pass', paper: FP_PAPER, Component: ForwardPassArt,
    caption: 'A feed-forward neural network — a whisper-faint weight lattice and one bright path, resolving to a single decision.',
    legend: [
      { kind: 'line', color: FP_ACCENT, label: 'Forward pass', note: 'the active signal path' },
      { kind: 'line', color: 'rgba(22,34,44,0.34)', label: 'Weights', note: 'every learned connection' },
      { kind: 'dot', color: FP_ACCENT, label: 'Decision', note: 'σ activation → ŷ' },
    ],
  },
  {
    id: 'selective-scan', fig: 'FIG. 02', label: 'Selective Scan', paper: SS_GROUND, Component: SelectiveScanArt,
    caption: 'My honours model — a 3D CNN–Mamba selective state-space net sweeping a whole-body PSMA PET volume, its state igniting only on cancer.',
    legend: [
      { kind: 'line', color: SS_CYAN, label: 'Selective scan', note: 'state retained where it matters' },
      { kind: 'dot', color: SS_AMBER, label: 'PSMA uptake', note: 'metastatic lesions' },
      { kind: 'ring', color: SS_CYAN, label: 'Segmentation', note: 'the predicted lesion mask' },
    ],
  },
];

// Standalone, self-contained SVG document string sized to A4.
function serialize(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '210mm');
  clone.setAttribute('height', '297mm');
  clone.removeAttribute('class');
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + new XMLSerializer().serializeToString(clone);
}

export default function WallArt() {
  const svgRef = useRef(null);
  const [activeId, setActiveId] = useState('selective-scan');
  const piece = PIECES.find((p) => p.id === activeId) ?? PIECES[0];
  const Active = piece.Component;

  const handleDownload = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([serialize(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${piece.id}-a4.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Print only the artwork at true A4 (handled by the @media print block in
  // portal.css, which hides the chrome and sizes .wa-art to 210 × 297 mm).
  const handlePrint = () => window.print();

  return (
    <div className="pt-module wa">
      {/* ── Intro ─────────────────────────────────────────────────────────── */}
      <header className="pt-card wa-intro">
        <p className="wa-intro__eyebrow">// PERSONAL · PRINT-READY VECTOR</p>
        <h2 className="wa-intro__title">Wall Art</h2>
        <p className="wa-intro__desc">
          A small, growing collection of original computer-science art — each piece designed as a crisp,
          resolution-independent A4 vector, restrained to a committed palette with strong negative space.
          Switch between pieces, then download the SVG or send it straight to a printer.
        </p>
      </header>

      {/* ── Piece switcher ────────────────────────────────────────────────── */}
      <div className="wa-switch" role="tablist" aria-label="Art pieces">
        {PIECES.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === activeId}
                  className={`wa-switch__tab${p.id === activeId ? ' wa-switch__tab--active' : ''}`}
                  onClick={() => setActiveId(p.id)}>
            <span className="wa-switch__fig">{p.fig}</span>
            <span className="wa-switch__label">{p.label}</span>
          </button>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="wa-toolbar">
        <span className="wa-toolbar__spec">A4 PORTRAIT · 210 × 297 MM · VECTOR</span>
        <div className="wa-toolbar__actions">
          <button type="button" className="wa-btn" onClick={handlePrint}>
            <Icon name="printer" size={15} /> Print
          </button>
          <button type="button" className="wa-btn wa-btn--primary" onClick={handleDownload}>
            <Icon name="download" size={15} /> Download SVG
          </button>
        </div>
      </div>

      {/* ── The piece ─────────────────────────────────────────────────────── */}
      <div className="wa-stage">
        <div className="wa-frame" style={{ background: piece.paper }}>
          <Active svgRef={svgRef} />
        </div>
      </div>

      <p className="wa-caption">{piece.caption}</p>

      {/* ── Legend (reads the active piece's visual language; hidden in print) ─ */}
      <ul className="wa-legend">
        {piece.legend.map((l) => (
          <li className="wa-legend__item" key={l.label}>
            <span
              className={`wa-legend__sw wa-legend__sw--${l.kind}`}
              style={l.kind === 'line' ? { borderTopColor: l.color } : l.kind === 'ring' ? { borderColor: l.color } : { background: l.color }}
              aria-hidden="true"
            />
            <span className="wa-legend__text"><b>{l.label}</b> — {l.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
