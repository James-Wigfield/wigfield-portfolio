import { FACTS } from '../../shared/facts';
import { SCANS } from './scans.gen';

/* ============================================================================
   PLAIN DECK — GEOMETRY (computed, never typed)
   ----------------------------------------------------------------------------
   Canvas px on the 1920 x 1080 slide. Scan layers come from scans.gen.js
   (tools/seminar-decks/make_plain_scans.py): projection pixels are dx mm
   across and dz mm head to toe, so a display scale k (px per mm) gives each
   layer its true aspect. Patch sizes and the Dice overlap come from the fact
   manifest.
   ========================================================================== */

const v = (k) => FACTS[k].value;

/** A scan layer placed on the canvas: box, and a mapper from projection px to canvas px. */
export function placeScan(scan, { x, y, k }) {
  const sx = scan.dx * k;
  const sz = scan.dz * k;
  return {
    x,
    y,
    w: scan.w * sx,
    h: scan.h * sz,
    sx,
    sz,
    at: ([px, pz]) => ({ x: x + px * sx, y: y + pz * sz }),
  };
}

/* ── Slide 2: study A (Figure 2.1 (a)), PET and CT side by side, then fused ── */
export const S2 = (() => {
  const k = 0.76;
  const fused = placeScan(SCANS.A, { x: 1250, y: 262, k });
  const petSide = 1000; // x of the PET panel while the two sit side by side
  const ctSide = 1420;
  const a = SCANS.A.anchors;
  const ctxLesion = SCANS.A.lesions[SCANS.A.contextLesion];
  return {
    k,
    fused,
    petShift: petSide - fused.x,
    ctShift: ctSide - fused.x,
    organs: {
      parotid: fused.at(a.parotid),
      submandibular: fused.at(a.submandibular),
      liver: fused.at(a.liver),
      kidney: fused.at(a.kidney),
    },
    lesionLabel: fused.at([SCANS.A.lesions[0].cx, SCANS.A.lesions[0].cy]),
    ring: { ...fused.at([ctxLesion.cx, ctxLesion.cy]), r: 100 }, // clear of the nearest other outline (112 px)
  };
})();

/* ── Slide 3: study B, the over-100-lesion scan ────────────────────────────── */
export const S3 = (() => {
  const H = 650;
  const k = H / SCANS.B.heightMm;
  const scan = placeScan(SCANS.B, { x: 96, y: 262, k });
  // Dice of two equal circles of radius r whose centres are d apart is
  // (2/pi)(acos u - u sqrt(1 - u^2)) with u = d / 2r. Solve for the mean
  // inter-observer Dice (lit.obs_dsc) by bisection.
  const target = v('lit.obs_dsc') / 100;
  const dice = (u) => (2 / Math.PI) * (Math.acos(u) - u * Math.sqrt(1 - u * u));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const m = (lo + hi) / 2;
    if (dice(m) > target) lo = m;
    else hi = m;
  }
  const r = 78;
  const d = 2 * r * ((lo + hi) / 2);
  // The lens where the two circles overlap (centres at -d/2 and +d/2).
  const hx = 0;
  const hy = Math.sqrt(r * r - (d / 2) * (d / 2));
  const lens = `M ${hx} ${-hy} A ${r} ${r} 0 0 1 ${hx} ${hy} A ${r} ${r} 0 0 1 ${hx} ${-hy} Z`;
  return { scan, k, r, d, lens, check: dice(d / (2 * r)) };
})();

// Ten of the first expert's lesions, seven found by the second (lit.obs_found_speech:
// about 7 out of 10, from 66 of 92). Which three are missed is illustrative.
export const MARKERS = Array.from({ length: 10 }, (_, i) => ({ i, found: ![2, 5, 8].includes(i) }));

/* ── Slide 4: PSMASegmentator's patch to scale on study A ──────────────────── */
export const S4 = (() => {
  const k = 0.75;
  const scan = placeScan(SCANS.A, { x: 0, y: 266, k });
  const cx = 1440;
  scan.x = cx - scan.w / 2;
  const pw = v('psm.patch_x_mm') * k;
  const ph = v('psm.patch_z_mm') * k;
  // nnU-Net-style sliding positions along the head-to-toe axis: as few as cover
  // the scan, spread evenly from the top to the bottom.
  const travel = scan.h - ph;
  return {
    k,
    scan,
    patch: { x: cx - pw / 2, y: scan.y, w: pw, h: ph },
    travel,
    coverage: v('psm.patch_z_mm') / SCANS.A.heightMm,
  };
})();

/* ── Slide 5: the token lane, the 3D feature block and the chart ──────────── */
export const S5 = (() => {
  const laneY = 368; // centre line of the token lane
  // Phase 1: a short sequence.
  const row = { n: 16, size: 56, pitch: 76 };
  row.x0 = 960 - ((row.n - 1) * row.pitch) / 2; // centre of token 0
  // The 3D block: n x n x n cells, drawn isometric.
  const n = 4;
  const s = 40; // cell edge
  const cos = Math.cos(Math.PI / 6);
  const sin = 0.5;
  const origin = { x: 160 + n * s * cos, y: 920 - n * s * 2 * sin }; // the block's bottom-front corner sits at y 920
  const iso = (x, y, z) => ({ x: origin.x + (x - y) * s * cos, y: origin.y + (x + y) * s * sin - z * s });
  // Phase 2: the long lane, one token per cell.
  const N = n * n * n;
  const lane = { size: 20, pitch: 27 }; // spans the 96 px margins
  lane.x0 = 960 - ((N - 1) * lane.pitch) / 2;
  // Deterministic "feature values" and keep/ignore picks (illustrative only).
  const hash = (i) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const cells = [];
  for (let z = n - 1, i = 0; z >= 0; z -= 1) {
    // flatten order: top layer first, each layer front row to back, left to right
    for (let row2 = n - 1; row2 >= 0; row2 -= 1) {
      for (let col = 0; col < n; col += 1, i += 1) {
        const x = col;
        const y = row2;
        const c = iso(x + 0.5, y + 0.5, z + 0.5);
        cells.push({ i, x, y, z, cx: c.x, cy: c.y, v: hash(i), keep: hash(i + 101) < 0.45 });
      }
    }
  }
  // Painter's order for the block: low z first, then far (small x + y) first.
  const paint = [...cells].sort((a, b) => (a.z - b.z) || ((a.x + a.y) - (b.x + b.y)) || (a.x - b.x));
  const rowKeep = Array.from({ length: row.n }, (_, i) => hash(i + 301) < 0.45);
  const front = { x: origin.x, y: origin.y + 2 * n * s * sin }; // the bottom-front corner
  const hull = (m) => {
    // outline of an m x m x m block sharing the bottom-front corner, so a bigger
    // block grows upwards and outwards, never down into the footer
    const P = (x, y, z) => {
      const q = { x: front.x + (x - y) * s * cos, y: front.y + (x + y - 2 * m) * s * sin - z * s };
      return `${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    };
    // the silhouette and the three front edges, as a solid block is drawn;
    // and its three visible faces, for a filled block
    return {
      silhouette: `M ${P(0, 0, m)} L ${P(m, 0, m)} L ${P(m, 0, 0)} L ${P(m, m, 0)} L ${P(0, m, 0)} L ${P(0, m, m)} Z`,
      faces: {
        top: `M ${P(0, 0, m)} L ${P(m, 0, m)} L ${P(m, m, m)} L ${P(0, m, m)} Z`,
        left: `M ${P(0, m, m)} L ${P(m, m, m)} L ${P(m, m, 0)} L ${P(0, m, 0)} Z`,
        right: `M ${P(m, 0, m)} L ${P(m, m, m)} L ${P(m, m, 0)} L ${P(m, 0, 0)} Z`,
      },
      outer: `M ${P(0, 0, m)} L ${P(m, 0, m)} L ${P(m, 0, 0)} L ${P(m, m, 0)} L ${P(0, m, 0)} L ${P(0, m, m)} Z M ${P(m, m, m)} L ${P(m, 0, m)} M ${P(m, m, m)} L ${P(0, m, m)} M ${P(m, m, m)} L ${P(m, m, 0)}`,
    };
  };
  return {
    laneY,
    row,
    rowKeep,
    n,
    s,
    cos,
    sin,
    iso,
    cells,
    paint,
    lane,
    N,
    ghost: hull(n).outer,
    ghostFaces: hull(n).faces,
    bigger: hull(n * 1.25).silhouette,
    front,
    chart: { x: 1404, y: 610, w: 420, h: 250 },
    chipEnd: Math.min(lane.x0 + (N - 1) * lane.pitch, 1824 - 38), // the memory chip stops inside the margin
  };
})();
