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
   FIG. 03 — "NEURAL NET"  (risograph / screen-print technical plate)
   A dark, tactile field-manual poster: warm near-black with SVG grain
   (feTurbulence) + a hand-printed edge wobble (feDisplacementMap), a two-ink
   look (bone cream + a single burnt orange spent only on focal hubs & signal),
   a massive condensed Anton title justified edge-to-edge (textLength), a
   bordered network "specimen", a fake instrument readout, latent + signal
   sub-diagrams, a left legend of glyphs, and a footer stat band. All linework
   is deterministic (shared hash) so it prints identically.
   ════════════════════════════════════════════════════════════════════════════ */
const RG_BG = '#17120B', RG_CREAM = '#E8E0CF', RG_DIM = '#988F79', RG_ORANGE = '#C5562A', RG_ORANGE_HOT = '#E2733A';
const RG_HAIR = 'rgba(232,224,207,0.4)';
const RG_FONT_DISPLAY = "'Anton', 'Arial Narrow', Impact, sans-serif";
const RG_FONT_MONO = "'Space Mono', ui-monospace, monospace";
const RG_FONT_GROT = "'Space Grotesk', 'Helvetica Neue', sans-serif";

const RG_SP = { x1: 300, y1: 1110, x2: 1970, y2: 1748 }; // specimen panel
const RG_LT = { x1: 300, y1: 1986, x2: 1095, y2: 2432 }; // latent field
const RG_SG = { x1: 1145, y1: 1986, x2: 1970, y2: 2432 };// signal field
const RG_SCX = (RG_SG.x1 + RG_SG.x2) / 2, RG_SCY = (RG_SG.y1 + RG_SG.y2) / 2 + 10;
const RG_RINGS = [46, 96, 150, 206];
const RG_GLYPHS = ['square', 'ring', 'cross', 'tri', 'wave', 'dots', 'arrow', 'bracket', 'diamond'];
const RG_READOUT = [
  { k: 'CYCLES', v: '04 096' }, { k: 'LOSS', v: '0.0173' }, { k: 'PARAMS', v: '1.24 B' },
  { k: 'ENTROPY', v: '0.681' }, { k: 'DEPTH', v: '48' },
];
const RG_STATS = ['REV 02.6', 'INK ×2 — BONE / BURNT', 'PLATE A4', 'EST. MMXXVI', 'J. WIGFIELD'];

// Constellation: nodes + nearest-neighbour edges; the highest-degree nodes are
// the orange focal hubs.
function genNetwork(p, n, seed) {
  const padX = 90, padTop = 110, padBot = 70;
  const nodes = Array.from({ length: n }, (_, i) => ({
    x: p.x1 + padX + hash(seed, i, 1) * (p.x2 - p.x1 - 2 * padX),
    y: p.y1 + padTop + hash(seed, i, 2) * (p.y2 - p.y1 - padTop - padBot),
    i,
  }));
  const seen = new Set(), edges = [], deg = new Array(n).fill(0);
  nodes.forEach((nd, i) => {
    nodes.map((o, j) => ({ j, d: (o.x - nd.x) ** 2 + (o.y - nd.y) ** 2 }))
      .filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2)
      .forEach(({ j }) => {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(k)) { seen.add(k); edges.push([i, j]); deg[i]++; deg[j]++; }
      });
  });
  const focalSet = new Set([...deg.keys()].sort((a, b) => deg[b] - deg[a]).slice(0, 4));
  return { nodes, edges, focalSet };
}
function genScatter(p, n, seed) {
  const pad = 64;
  const nodes = Array.from({ length: n }, (_, i) => ({
    x: p.x1 + pad + hash(seed, i, 1) * (p.x2 - p.x1 - 2 * pad),
    y: p.y1 + pad + hash(seed, i, 2) * (p.y2 - p.y1 - pad - 84),
    i,
  }));
  const edges = [];
  nodes.forEach((nd, i) => {
    if (hash(seed, i, 5) > 0.55) return;
    let best = -1, bd = Infinity;
    nodes.forEach((o, j) => { if (j !== i) { const d = (o.x - nd.x) ** 2 + (o.y - nd.y) ** 2; if (d < bd) { bd = d; best = j; } } });
    if (best >= 0) edges.push([i, best]);
  });
  return { nodes, edges, orange: new Set([3, 12, 21].filter((k) => k < n)) };
}
const RG_NET = genNetwork(RG_SP, 24, 3);
const RG_SCAT = genScatter(RG_LT, 30, 9);

// One small legend glyph (no fill unless noted) centred at (cx,cy).
function glyphMark(type, cx, cy, c) {
  const s = 15;
  switch (type) {
    case 'square': return <rect x={cx - s} y={cy - s} width={2 * s} height={2 * s} fill="none" stroke={c} strokeWidth="2" />;
    case 'ring': return <circle cx={cx} cy={cy} r={s} fill="none" stroke={c} strokeWidth="2" />;
    case 'cross': return <g stroke={c} strokeWidth="2"><line x1={cx - s} y1={cy} x2={cx + s} y2={cy} /><line x1={cx} y1={cy - s} x2={cx} y2={cy + s} /></g>;
    case 'tri': return <path d={`M${cx},${cy - s} L${cx + s},${cy + s} L${cx - s},${cy + s} Z`} fill="none" stroke={c} strokeWidth="2" />;
    case 'wave': return <path d={`M${cx - s},${cy} Q${cx - s / 2},${cy - s} ${cx},${cy} T${cx + s},${cy}`} fill="none" stroke={c} strokeWidth="2" />;
    case 'dots': return <g fill={c}>{[-s, 0, s].map((d, k) => <circle key={k} cx={cx + d} cy={cy} r="2.6" />)}</g>;
    case 'arrow': return <g stroke={c} strokeWidth="2" fill="none"><line x1={cx} y1={cy + s} x2={cx} y2={cy - s} /><path d={`M${cx - 6},${cy - s + 8} L${cx},${cy - s} L${cx + 6},${cy - s + 8}`} /></g>;
    case 'bracket': return <g stroke={c} strokeWidth="2" fill="none"><path d={`M${cx - s + 5},${cy - s} L${cx - s},${cy - s} L${cx - s},${cy + s} L${cx - s + 5},${cy + s}`} /><path d={`M${cx + s - 5},${cy - s} L${cx + s},${cy - s} L${cx + s},${cy + s} L${cx + s - 5},${cy + s}`} /></g>;
    case 'diamond': return <path d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`} fill="none" stroke={c} strokeWidth="2" />;
    default: return null;
  }
}
// A thin register rule with end + quarter ticks.
function rgRule(y, x1 = FX1, x2 = FX2, c = RG_HAIR) {
  const xs = [x1, x1 + (x2 - x1) / 4, (x1 + x2) / 2, x2 - (x2 - x1) / 4, x2];
  return (
    <g stroke={c} strokeWidth="1.4">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      {xs.map((x, i) => <line key={i} x1={x} y1={y - 6} x2={x} y2={y + 6} />)}
    </g>
  );
}

function NeuralNetPoster({ svgRef }) {
  return (
    <svg ref={svgRef} className="wa-art" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${VW} ${VH}`}
         role="img" aria-label="Neural Net — a risograph-style technical poster of a neural network, sized for A4 print"
         shapeRendering="geometricPrecision">
      <defs>
        <filter id="rgGrainA" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="3" seed="14" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <filter id="rgGrainB" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="29" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <filter id="rgRough" x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.018" numOctaves="2" seed="5" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="rgGlow">
          <stop offset="0%" stopColor={RG_ORANGE_HOT} stopOpacity="0.9" />
          <stop offset="42%" stopColor={RG_ORANGE} stopOpacity="0.34" />
          <stop offset="100%" stopColor={RG_ORANGE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rgVig">
          <stop offset="58%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
        </radialGradient>
        {/* worn ink — erode edges (displace) + knock speckle holes out of the fill */}
        <filter id="rgTitleWorn" x="-3%" y="-22%" width="106%" height="144%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="8" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" seed="9" result="sp" />
          <feComponentTransfer in="sp" result="speck"><feFuncA type="discrete" tableValues="0 0 0 1" /></feComponentTransfer>
          <feComposite in="rough" in2="speck" operator="out" />
        </filter>
        <filter id="rgPhraseWorn" x="-3%" y="-34%" width="106%" height="168%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="6" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" seed="12" result="sp" />
          <feComponentTransfer in="sp" result="speck"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 1" /></feComponentTransfer>
          <feComposite in="rough" in2="speck" operator="out" />
        </filter>
      </defs>

      <rect x="0" y="0" width={VW} height={VH} fill={RG_BG} />

      {/* ── all linework, hand-printed wobble ─────────────────────────────── */}
      <g filter="url(#rgRough)">
        <rect x={FX1} y={FY1} width={FX2 - FX1} height={FY2 - FY1} fill="none" stroke={RG_CREAM} strokeWidth="2" strokeOpacity="0.6" />
        {rgRule(288)}
        {rgRule(1052)}

        {/* legend glyph column (left gutter) */}
        {RG_GLYPHS.map((g, i) => {
          const cy = 1188 + i * 150;
          const c = i === 6 ? RG_ORANGE : RG_CREAM;
          return <g key={g}>{glyphMark(g, 205, cy, c)}</g>;
        })}

        {/* specimen panel */}
        <rect x={RG_SP.x1} y={RG_SP.y1} width={RG_SP.x2 - RG_SP.x1} height={RG_SP.y2 - RG_SP.y1} fill="none" stroke={RG_CREAM} strokeWidth="1.8" strokeOpacity="0.7" />
        {[[RG_SP.x1, RG_SP.y1, 1, 1], [RG_SP.x2, RG_SP.y1, -1, 1], [RG_SP.x1, RG_SP.y2, 1, -1], [RG_SP.x2, RG_SP.y2, -1, -1]].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x + sx * 26},${y} L${x},${y} L${x},${y + sy * 26}`} fill="none" stroke={RG_ORANGE} strokeWidth="2.4" />
        ))}
        {RG_NET.edges.map(([a, b], i) => {
          const A = RG_NET.nodes[a], B = RG_NET.nodes[b];
          const both = RG_NET.focalSet.has(a) && RG_NET.focalSet.has(b);
          return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={both ? RG_ORANGE : RG_CREAM} strokeOpacity={both ? 0.62 : 0.32} strokeWidth={both ? 2 : 1.4} />;
        })}
        {RG_NET.nodes.map((nd) => {
          if (RG_NET.focalSet.has(nd.i)) return (
            <g key={nd.i}>
              <circle cx={nd.x} cy={nd.y} r="46" fill="url(#rgGlow)" />
              <circle cx={nd.x} cy={nd.y} r="13" fill="none" stroke={RG_ORANGE} strokeWidth="2" />
              <circle cx={nd.x} cy={nd.y} r="6" fill={RG_ORANGE_HOT} />
            </g>
          );
          return hash(3, nd.i, 8) > 0.5
            ? <circle key={nd.i} cx={nd.x} cy={nd.y} r="6" fill="none" stroke={RG_CREAM} strokeWidth="1.8" strokeOpacity="0.85" />
            : <circle key={nd.i} cx={nd.x} cy={nd.y} r="4.6" fill={RG_CREAM} fillOpacity="0.9" />;
        })}

        {/* readout rules + dividers */}
        {rgRule(1788, RG_SP.x1, RG_SP.x2)}
        {rgRule(1872, RG_SP.x1, RG_SP.x2)}
        {RG_READOUT.map((_, i) => i > 0 && (
          <line key={i} x1={RG_SP.x1 + i * ((RG_SP.x2 - RG_SP.x1) / 5)} y1={1800} x2={RG_SP.x1 + i * ((RG_SP.x2 - RG_SP.x1) / 5)} y2={1860} stroke={RG_HAIR} strokeWidth="1.4" />
        ))}

        {/* latent panel + scatter */}
        <rect x={RG_LT.x1} y={RG_LT.y1} width={RG_LT.x2 - RG_LT.x1} height={RG_LT.y2 - RG_LT.y1} fill="none" stroke={RG_CREAM} strokeWidth="1.6" strokeOpacity="0.6" />
        {RG_SCAT.edges.map(([a, b], i) => {
          const A = RG_SCAT.nodes[a], B = RG_SCAT.nodes[b];
          return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={RG_CREAM} strokeOpacity="0.22" strokeWidth="1.2" />;
        })}
        {RG_SCAT.nodes.map((nd) => RG_SCAT.orange.has(nd.i)
          ? <circle key={nd.i} cx={nd.x} cy={nd.y} r="5.5" fill={RG_ORANGE_HOT} />
          : <circle key={nd.i} cx={nd.x} cy={nd.y} r="3.4" fill={RG_CREAM} fillOpacity="0.8" />)}
        {[0, 1, 2, 3, 4].map((i) => <line key={`ax${i}`} x1={RG_LT.x1 + 30 + i * 26} y1={RG_LT.y2 - 40} x2={RG_LT.x1 + 30 + i * 26} y2={RG_LT.y2 - 30} stroke={RG_HAIR} strokeWidth="1.4" />)}

        {/* signal panel + concentric rings */}
        <rect x={RG_SG.x1} y={RG_SG.y1} width={RG_SG.x2 - RG_SG.x1} height={RG_SG.y2 - RG_SG.y1} fill="none" stroke={RG_CREAM} strokeWidth="1.6" strokeOpacity="0.6" />
        {RG_RINGS.map((r, i) => <circle key={i} cx={RG_SCX} cy={RG_SCY} r={r} fill="none" stroke={RG_CREAM} strokeOpacity={0.5 - i * 0.09} strokeWidth="1.5" />)}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2, r0 = 206, r1 = 218;
          return <line key={`rt${i}`} x1={RG_SCX + Math.cos(a) * r0} y1={RG_SCY + Math.sin(a) * r0} x2={RG_SCX + Math.cos(a) * r1} y2={RG_SCY + Math.sin(a) * r1} stroke={RG_CREAM} strokeOpacity="0.5" strokeWidth="1.5" />;
        })}
        {[[-1, 0], [0, -1], [1, 0]].map(([dx, dy], i) => {
          const a = Math.atan2(dy, dx);
          const ex = RG_SCX + dx * 150, ey = RG_SCY + dy * 150;
          const sx = RG_SCX + dx * 240, sy = RG_SCY + dy * 240;
          const ah1 = `M${ex},${ey} L${ex - 12 * Math.cos(a - 0.5)},${ey - 12 * Math.sin(a - 0.5)}`;
          const ah2 = `M${ex},${ey} L${ex - 12 * Math.cos(a + 0.5)},${ey - 12 * Math.sin(a + 0.5)}`;
          return <g key={i} stroke={RG_ORANGE} strokeWidth="2"><line x1={sx} y1={sy} x2={ex} y2={ey} /><path d={ah1} /><path d={ah2} /></g>;
        })}
        <circle cx={RG_SCX} cy={RG_SCY} r="40" fill="url(#rgGlow)" />
        <circle cx={RG_SCX} cy={RG_SCY} r="17" fill="none" stroke={RG_ORANGE} strokeWidth="2.2" />
        <circle cx={RG_SCX} cy={RG_SCY} r="7" fill={RG_ORANGE_HOT} />

        {/* footer rules + dividers */}
        {rgRule(2520)}
        {rgRule(2712)}
        {RG_STATS.map((_, i) => i > 0 && (
          <line key={i} x1={FX1 + i * ((FX2 - FX1) / 5)} y1={2762} x2={FX1 + i * ((FX2 - FX1) / 5)} y2={2790} stroke={RG_HAIR} strokeWidth="1.4" />
        ))}
      </g>

      {/* ── type (kept crisp, outside the wobble) ─────────────────────────── */}
      <text x={FX1} y={250} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="23" letterSpacing="4">PLATE 03 · FIG. III</text>
      <text x={FX2} y={250} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="23" letterSpacing="2" textAnchor="end">FORMAT A4 · 210 × 297</text>

      <text x={FX1} y={626} fill={RG_CREAM} fontFamily={RG_FONT_DISPLAY} fontSize="296" textLength={FX2 - FX1} lengthAdjust="spacingAndGlyphs" filter="url(#rgTitleWorn)">NEURAL</text>
      <text x={FX1} y={922} fill={RG_CREAM} fontFamily={RG_FONT_DISPLAY} fontSize="296" textLength={FX2 - FX1} lengthAdjust="spacingAndGlyphs" filter="url(#rgTitleWorn)">NETWORK</text>
      <text x={FX1} y={1014} fill={RG_DIM} fontFamily={RG_FONT_GROT} fontSize="33" fontWeight="500" letterSpacing="7">AN ILLUSTRATED STUDY OF MACHINE COGNITION</text>

      {/* specimen labels */}
      <text x={RG_SP.x1 + 30} y={RG_SP.y1 + 56} fill={RG_CREAM} fontFamily={RG_FONT_MONO} fontSize="26" letterSpacing="3">SPECIMEN A — NETWORK TOPOLOGY</text>
      <text x={RG_SP.x2 - 30} y={RG_SP.y1 + 56} fill={RG_ORANGE} fontFamily={RG_FONT_MONO} fontSize="24" letterSpacing="2" textAnchor="end">fig. A</text>

      {/* readout values */}
      {RG_READOUT.map((d, i) => {
        const cw = (RG_SP.x2 - RG_SP.x1) / 5, x = RG_SP.x1 + i * cw + 24;
        return (
          <g key={d.k}>
            <text x={x} y={1828} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19" letterSpacing="2">{d.k}</text>
            <text x={x} y={1853} fill={i === 1 ? RG_ORANGE : RG_CREAM} fontFamily={RG_FONT_MONO} fontSize="20">{d.v}</text>
          </g>
        );
      })}

      {/* subsystem labels */}
      <text x={RG_LT.x1 + 26} y={RG_LT.y1 + 52} fill={RG_CREAM} fontFamily={RG_FONT_MONO} fontSize="23" letterSpacing="3">LATENT FIELD</text>
      <text x={RG_LT.x2 - 26} y={RG_LT.y1 + 52} fill={RG_ORANGE} fontFamily={RG_FONT_MONO} fontSize="22" textAnchor="end">fig. B</text>
      <text x={RG_LT.x2 - 26} y={RG_LT.y2 - 30} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="20" textAnchor="end">z₁ →</text>
      <text x={RG_SG.x1 + 26} y={RG_SG.y1 + 52} fill={RG_CREAM} fontFamily={RG_FONT_MONO} fontSize="23" letterSpacing="3">SIGNAL PROPAGATION</text>
      <text x={RG_SG.x2 - 26} y={RG_SG.y1 + 52} fill={RG_ORANGE} fontFamily={RG_FONT_MONO} fontSize="22" textAnchor="end">fig. C</text>
      <text x={RG_SCX} y={RG_SCY - 232} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19" textAnchor="middle">INPUT</text>
      <text x={RG_SCX + 250} y={RG_SCY + 6} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19">GAIN</text>
      <text x={RG_SCX - 250} y={RG_SCY + 6} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19" textAnchor="end">BIAS</text>
      <text x={RG_SCX} y={RG_SCY + 250} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19" textAnchor="middle">OUTPUT</text>

      {/* footer: phrase + stats */}
      <text x={CX} y={2632} fill={RG_CREAM} fontFamily={RG_FONT_GROT} fontSize="40" fontWeight="500" letterSpacing="4" textAnchor="middle" filter="url(#rgPhraseWorn)">
        THOUGHT IS STRUCTURE, BRIEFLY <tspan fill={RG_ORANGE}>LIT</tspan>.
      </text>
      {RG_STATS.map((s, i) => {
        const cw = (FX2 - FX1) / 5;
        return <text key={i} x={FX1 + i * cw + cw / 2} y={2768} fill={RG_DIM} fontFamily={RG_FONT_MONO} fontSize="19" letterSpacing="1" textAnchor="middle">{s}</text>;
      })}

      {/* ── grain + vignette overlays (on top of everything) ──────────────── */}
      <rect x="0" y="0" width={VW} height={VH} filter="url(#rgGrainA)" opacity="0.5" style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width={VW} height={VH} filter="url(#rgGrainB)" opacity="0.32" style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width={VW} height={VH} fill="url(#rgVig)" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FIG. 04 — "CORE MEMORY"  (1970s CS-textbook jacket)
   Deep near-black cloth with a faint woven grain + wear (understated
   feTurbulence), and a single signal-red technical schematic over a calm
   cream title block. The hero is a plausible core-memory read path: a ferrite
   core plane (vertical X-drive lines × horizontal word/sense lines, cores at
   the intersections) feeding sense amplifiers → strobed AND gates → an OR
   decode tree → one data output. Strictly two inks (red + cream) on black;
   everything routes orthogonally on a fixed grid with consistent gate glyphs.
   ════════════════════════════════════════════════════════════════════════════ */
const CM_BG = '#0C0C0E', CM_RED = '#C8341F', CM_CREAM = '#E9E2D0';
const CM_FD = "'Roboto Slab', Rockwell, Georgia, serif"; // heavy slab display
const CM_FM = "'Space Mono', ui-monospace, monospace";   // mono caption / eyebrow
const CM_FI = "'Fraunces', Georgia, serif";              // serif italic annotations
const CM_LX = 200, CM_RX = 1900;

const STUB = 16, BW = 58, BH = 52, GW = 80, GH = 92;
const CM_VX = Array.from({ length: 9 }, (_, i) => 320 + i * 60); // X-drive lines
const CM_WY = [1560, 1740, 1920, 2100];                          // word / sense lines
const CM_PLANE_TOP = 1480, CM_DRIVE_BUS = 2240;
const STROBEX = 1140, OUTX = 1880;
const cBuf = 1000, cAnd = 1250, cOr = 1490, cOc = 1710;
const CM_GATES = [
  ...CM_WY.map((y, i) => ({ id: 'b' + i, kind: 'buf', cx: cBuf, cy: y })),
  ...CM_WY.map((y, i) => ({ id: 'a' + i, kind: 'and', cx: cAnd, cy: y })),
  { id: 'oa', kind: 'or', cx: cOr, cy: 1650 },
  { id: 'ob', kind: 'or', cx: cOr, cy: 2010 },
  { id: 'oc', kind: 'or', cx: cOc, cy: 1830 },
  { id: 'xd', kind: 'buf', cx: 250, cy: CM_DRIVE_BUS },
];
const CM_GMAP = Object.fromEntries(CM_GATES.map((g) => [g.id, g]));
function cmPins(g) {
  const { kind, cx, cy } = g;
  if (kind === 'buf') return { in: [[cx - BW / 2 - STUB, cy]], out: [cx + BW / 2 + STUB, cy] };
  return { in: [[cx - GW / 2 - STUB, cy - 20], [cx - GW / 2 - STUB, cy + 20]], out: [cx + GW / 2 + STUB, cy] };
}

// Build the orthogonal trace paths + junction dots once (deterministic).
const CM_TRACE = [], CM_DOT = [];
const cmZ = (x1, y1, x2, y2, jx) => {
  if (y1 === y2) { CM_TRACE.push(`M${x1},${y1} L${x2},${y2}`); return; }
  const j = jx ?? Math.round((x1 + x2) / 2);
  CM_TRACE.push(`M${x1},${y1} L${j},${y1} L${j},${y2} L${x2},${y2}`);
};
CM_WY.forEach((y) => CM_TRACE.push(`M${CM_VX[0]},${y} L800,${y}`));               // word lines
CM_VX.forEach((x) => CM_TRACE.push(`M${x},${CM_PLANE_TOP} L${x},${CM_DRIVE_BUS}`)); // drive lines
CM_TRACE.push(`M${CM_VX[0]},${CM_DRIVE_BUS} L800,${CM_DRIVE_BUS}`);               // drive bus
CM_VX.forEach((x) => CM_DOT.push([x, CM_DRIVE_BUS]));
cmZ(cmPins(CM_GMAP.xd).out[0], CM_DRIVE_BUS, CM_VX[0], CM_DRIVE_BUS);              // driver → bus
CM_WY.forEach((y, i) => { const b = cmPins(CM_GMAP['b' + i]); cmZ(800, y, b.in[0][0], b.in[0][1]); CM_DOT.push([800, y]); });
CM_WY.forEach((y, i) => { const b = cmPins(CM_GMAP['b' + i]), a = cmPins(CM_GMAP['a' + i]); cmZ(b.out[0], b.out[1], a.in[0][0], a.in[0][1], a.in[0][0] - 24); });
CM_TRACE.push(`M${STROBEX},1520 L${STROBEX},2120`);                               // read-strobe bus
CM_WY.forEach((_, i) => { const a = cmPins(CM_GMAP['a' + i]); cmZ(STROBEX, a.in[1][1], a.in[1][0], a.in[1][1]); CM_DOT.push([STROBEX, a.in[1][1]]); });
const cmOa = cmPins(CM_GMAP.oa), cmOb = cmPins(CM_GMAP.ob), cmOc = cmPins(CM_GMAP.oc);
cmZ(cmPins(CM_GMAP.a0).out[0], 1560, cmOa.in[0][0], cmOa.in[0][1], cmOa.in[0][0] - 24);
cmZ(cmPins(CM_GMAP.a1).out[0], 1740, cmOa.in[1][0], cmOa.in[1][1], cmOa.in[1][0] - 24);
cmZ(cmPins(CM_GMAP.a2).out[0], 1920, cmOb.in[0][0], cmOb.in[0][1], cmOb.in[0][0] - 24);
cmZ(cmPins(CM_GMAP.a3).out[0], 2100, cmOb.in[1][0], cmOb.in[1][1], cmOb.in[1][0] - 24);
cmZ(cmOa.out[0], cmOa.out[1], cmOc.in[0][0], cmOc.in[0][1], cmOc.in[0][0] - 24);
cmZ(cmOb.out[0], cmOb.out[1], cmOc.in[1][0], cmOc.in[1][1], cmOc.in[1][0] - 24);
CM_TRACE.push(`M${cmOc.out[0]},${cmOc.out[1]} L${OUTX},${cmOc.out[1]}`);          // → data out
const CM_CORES = [];
CM_VX.forEach((x) => CM_WY.forEach((y) => CM_CORES.push([x, y])));

// One gate glyph (path + input/output stubs) — consistent across the diagram.
function cmGateEl(g) {
  const { kind, cx, cy } = g, p = cmPins(g);
  const st = { stroke: CM_RED, strokeWidth: 2.6, fill: 'none', strokeLinejoin: 'round' };
  let path, tipX;
  if (kind === 'buf') { path = `M${cx - BW / 2},${cy - BH / 2} L${cx - BW / 2},${cy + BH / 2} L${cx + BW / 2},${cy} Z`; tipX = cx + BW / 2; }
  else if (kind === 'and') { const r = GH / 2, bw = GW - r, x = cx - GW / 2, y = cy - GH / 2; path = `M${x},${y} L${x + bw},${y} A${r},${r} 0 0 1 ${x + bw},${y + GH} L${x},${y + GH} Z`; tipX = cx + GW / 2; }
  else { const w = GW, h = GH, x = cx - w / 2, y = cy - h / 2; path = `M${x},${y} Q${x + 0.62 * w},${y} ${x + w},${cy} Q${x + 0.62 * w},${y + h} ${x},${y + h} Q${x + 0.18 * w},${cy} ${x},${y} Z`; tipX = cx + GW / 2; }
  const bodyL = kind === 'buf' ? cx - BW / 2 : (kind === 'or' ? cx - GW / 2 + 8 : cx - GW / 2);
  return (
    <g key={g.id}>
      <path d={path} {...st} />
      <line x1={tipX} y1={cy} x2={p.out[0]} y2={cy} {...st} />
      {p.in.map(([ix, iy], k) => <line key={k} x1={ix} y1={iy} x2={bodyL} y2={iy} {...st} />)}
    </g>
  );
}

function CoreMemoryPoster({ svgRef }) {
  return (
    <svg ref={svgRef} className="wa-art" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${VW} ${VH}`}
         role="img" aria-label="Core Memory — a vintage two-colour circuit schematic poster, sized for A4 print"
         shapeRendering="geometricPrecision">
      <defs>
        <filter id="cmCloth" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="11" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <filter id="cmFine" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="22" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <radialGradient id="cmVig">
          <stop offset="62%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
        </radialGradient>
        {/* worn ink (refined) — gentle edge erosion + sparse speckle ink-loss */}
        <filter id="cmTitleWorn" x="-3%" y="-20%" width="106%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.13" numOctaves="3" seed="15" result="sp" />
          <feComponentTransfer in="sp" result="speck"><feFuncA type="discrete" tableValues="0 0 0 0 0 1" /></feComponentTransfer>
          <feComposite in="rough" in2="speck" operator="out" />
        </filter>
      </defs>

      <rect x="0" y="0" width={VW} height={VH} fill={CM_BG} />

      {/* faint wear (very subtle light scuffs) */}
      <g stroke={CM_CREAM} strokeOpacity="0.05" strokeWidth="1.5" strokeLinecap="round">
        <line x1="280" y1="560" x2="1760" y2="612" />
        <line x1="240" y1="2360" x2="1500" y2="2300" />
      </g>

      {/* ── Title block (cream, calm) ─────────────────────────────────────── */}
      <text x={CM_LX} y={300} fill={CM_RED} fontFamily={CM_FM} fontSize="26" letterSpacing="7">MACHINE MEMORY — A PRIMER</text>
      <line x1={CM_LX} y1={332} x2={CM_LX + 232} y2={332} stroke={CM_RED} strokeWidth="3" />
      <text x={CM_LX} y={642} fill={CM_CREAM} fontFamily={CM_FD} fontWeight="900" fontSize="360" filter="url(#cmTitleWorn)">core</text>
      <text x={CM_LX} y={878} fill={CM_CREAM} fontFamily={CM_FD} fontWeight="900" fontSize="360" filter="url(#cmTitleWorn)">memory</text>
      <text x={CM_LX} y={972} fill={CM_CREAM} fontFamily={CM_FD} fontWeight="500" fontSize="46" filter="url(#cmTitleWorn)"><tspan fill={CM_RED}>— </tspan>james wigfield</text>
      <line x1={760} y1={957} x2={CM_RX} y2={957} stroke={CM_RED} strokeWidth="1.4" strokeOpacity="0.7" />

      {/* ── Schematic (single red ink) ────────────────────────────────────── */}
      {/* word lines, drive lines, drive bus, traces */}
      <g stroke={CM_RED} strokeWidth="2.4" fill="none" strokeLinejoin="round">
        {CM_TRACE.map((d, i) => <path key={i} d={d} />)}
      </g>
      {/* ferrite cores at every intersection (threaded at 45°) */}
      {CM_CORES.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="8.5" ry="4" fill="none" stroke={CM_RED} strokeWidth="2"
                 transform={`rotate(-45 ${x} ${y})`} />
      ))}
      {/* gates */}
      {CM_GATES.map((g) => cmGateEl(g))}
      {/* junction dots */}
      {CM_DOT.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={CM_RED} />)}
      {/* driver input arrow + output arrow */}
      <line x1="168" y1={CM_DRIVE_BUS} x2={cmPins(CM_GMAP.xd).in[0][0]} y2={CM_DRIVE_BUS} stroke={CM_RED} strokeWidth="2.4" />
      <polygon points={`${cmPins(CM_GMAP.xd).in[0][0]},${CM_DRIVE_BUS} ${cmPins(CM_GMAP.xd).in[0][0] - 13},${CM_DRIVE_BUS - 7} ${cmPins(CM_GMAP.xd).in[0][0] - 13},${CM_DRIVE_BUS + 7}`} fill={CM_RED} />
      <polygon points={`${OUTX},1830 ${OUTX - 16},1822 ${OUTX - 16},1838`} fill={CM_RED} />

      {/* italic annotations (red serif) */}
      <text x={560} y={1452} fill={CM_RED} fontFamily={CM_FI} fontStyle="italic" fontSize="27" textAnchor="middle">core plane</text>
      <text x={840} y={1540} fill={CM_RED} fontFamily={CM_FI} fontStyle="italic" fontSize="26">sense lines</text>
      <text x={STROBEX} y={1498} fill={CM_RED} fontFamily={CM_FI} fontStyle="italic" fontSize="26" textAnchor="middle">read strobe</text>
      <text x={560} y={2298} fill={CM_RED} fontFamily={CM_FI} fontStyle="italic" fontSize="27" textAnchor="middle">x-drive lines</text>
      <text x={OUTX + 18} y={1838} fill={CM_RED} fontFamily={CM_FM} fontSize="28" letterSpacing="2">Q</text>

      {/* ── Bottom caption ────────────────────────────────────────────────── */}
      <line x1={CM_LX} y1={2700} x2={CM_RX} y2={2700} stroke={CM_RED} strokeWidth="1.4" strokeOpacity="0.6" />
      <text x={CM_LX} y={2748} fill={CM_RED} fontFamily={CM_FM} fontSize="20" letterSpacing="3">PLATE IV · CORE-MEMORY READ PATH</text>
      <text x={CM_RX} y={2748} fill={CM_RED} fontFamily={CM_FM} fontSize="20" letterSpacing="2" textAnchor="end">210 × 297 MM</text>

      {/* ── Texture overlays (understated) ────────────────────────────────── */}
      <rect x="0" y="0" width={VW} height={VH} filter="url(#cmCloth)" opacity="0.05" style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width={VW} height={VH} filter="url(#cmFine)" opacity="0.035" style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width={VW} height={VH} fill="url(#cmVig)" />
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
  {
    id: 'neural-net', fig: 'FIG. 03', label: 'Neural Net', paper: RG_BG, Component: NeuralNetPoster,
    caption: 'A risograph-style field plate — a screen-printed diagram of a network’s topology, signal and latent space, in bone and burnt orange with SVG grain.',
    legend: [
      { kind: 'dot', color: RG_ORANGE, label: 'Focal node', note: 'hubs where signal gathers' },
      { kind: 'line', color: RG_CREAM, label: 'Topology', note: 'weighted connections' },
      { kind: 'ring', color: RG_ORANGE, label: 'Signal field', note: 'concentric propagation' },
    ],
  },
  {
    id: 'core-memory', fig: 'FIG. 04', label: 'Core Memory', paper: CM_BG, Component: CoreMemoryPoster,
    caption: 'A 1970s textbook-jacket plate — a two-ink ferrite core-memory read path on dark cloth: drive lines, sense amps, a strobed gate decode tree, one data output.',
    legend: [
      { kind: 'ring', color: CM_RED, label: 'Ferrite core', note: 'one bit, threaded at 45°' },
      { kind: 'line', color: CM_RED, label: 'Orthogonal traces', note: 'drive · word · sense lines' },
      { kind: 'dot', color: CM_RED, label: 'Junction', note: 'a connected node' },
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
  const [activeId, setActiveId] = useState('core-memory');
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
