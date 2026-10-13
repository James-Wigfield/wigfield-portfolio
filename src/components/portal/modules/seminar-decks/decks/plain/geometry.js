import { FACTS } from '../../shared/facts';
import { FAIR_POINTS } from './fair.gen';
import { OPTF_LAYERS, OPTF_VB } from './optf.gen';
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

/* ── Slides 7 and 8: the architecture figure (dissertation Figure 3.3) ─────
   Its layers (optf.gen.js, tools/seminar-decks/split_optf.mjs) are drawn at one
   scale, the figure's input cube at the slide's left margin. Slide 8 shows the
   same figure smaller (a CSS transform of the same layers, so it stays sharp). */
export const FIG = (() => {
  const L = OPTF_LAYERS;
  const s = 2.3; // px per figure unit on slide 7
  const left = L.input.x0;
  const top = L.input.y0;
  const ox = 96 - left * s;
  const oy = 280 - top * s;
  const at = (fx, fy) => ({ x: ox + fx * s, y: oy + fy * s });
  const box = (name) => {
    const b = L[name];
    const p = at(b.x0, b.y0);
    return { x: p.x, y: p.y, w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s };
  };
  // The layers draw nothing left of x 40 or below y 300 (figure units), so the
  // box that holds them stops there and stays inside the slide.
  const crop = { x0: 40, y1: 300 };
  const holder = { left: ox + crop.x0 * s, top: oy, w: (OPTF_VB.w - crop.x0) * s, h: crop.y1 * s, inset: -crop.x0 * s };
  // Slide 8: the same holder scaled by k about its top-left, the input cube at (96, 300).
  const s8 = 1.5;
  const k = s8 / s;
  const ox8 = 96 - left * s8;
  const oy8 = 300 - top * s8;
  const at8 = (fx, fy) => ({ x: ox8 + fx * s8, y: oy8 + fy * s8 });
  return {
    s,
    ox,
    oy,
    w: OPTF_VB.w * s,
    h: OPTF_VB.h * s,
    holder,
    at,
    box,
    pose8: { k, dx: ox8 + crop.x0 * s8 - holder.left, dy: oy8 - oy },
    at8,
    // the output cube's left edge (figure units)
    cubeX0: L.output.x0,
    // the network's blocks (the `body` composite), for thumbnails
    body: { x0: L.body.x0, y0: L.body.y0, w: L.body.x1 - L.body.x0, h: L.body.y1 - L.body.y0 },
    // The U's layers, in the order they are built.
    enc: ['enc1', 'enc2', 'enc3', 'enc4', 'enc5'],
    mamba: ['mb3', 'mb4', 'mb5'],
    dec: ['dec4', 'dec3', 'dec2', 'dec1'],
    skips: ['skip1', 'skip2', 'skip3', 'skip4'],
    // Each Mamba layer starts where its stage's convolution block sits.
    mambaFrom: { mb3: L.enc3.x0 - L.mb3.x0, mb4: L.enc4.x0 - L.mb4.x0, mb5: L.enc5.x0 - L.mb5.x0 },
  };
})();

/** All layers of the architecture figure that slides 7 and 8 draw (for the media list). */
export const FIG_MEDIA = ['input', 'output', 'headlab', 'skiplab1', 'organ', 'body', ...FIG.enc, ...FIG.mamba, ...FIG.dec, ...FIG.skips]
  .map((n) => `figures/optf/${n}.svg`);

/* ── Slide 7, right: sequence length per stage, to scale, and six directions ─ */
export const S7 = (() => {
  const x0 = 1080;
  const barX = 1276;
  const barMax = 1824 - barX;
  const keyY = 268; // the key: convolution and Mamba blocks
  const seqY = 384; // the title of the sequence lengths
  const len = ['net.tok2', 'net.tok3', 'net.tok4', 'net.tok5'].map((k) => v(k));
  const rows = len.map((n, i) => ({ y: seqY + 58 + i * 44, w: (barMax * n) / len[0], ratio: i ? len[i - 1] / n : 1 }));
  // Six small cubes, each read in one direction (screen vectors on an isometric view).
  const e = 22; // half the cube's edge
  const c30 = Math.cos(Math.PI / 6);
  const iso = (cx, cy) => (x, y, z) => [cx + (x - y) * c30, cy + (x + y) * 0.5 - z];
  const cubeY = 806;
  const dirs = [
    ['up', [0, -1]], ['down', [0, 1]], ['left', [-c30, -0.5]], ['right', [c30, 0.5]], ['front', [-c30, 0.5]], ['back', [c30, -0.5]],
  ];
  const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const cubeFaces = (cx, cy) => {
    const P = iso(cx, cy);
    return {
      top: `M ${pt(P(-e, -e, e))} L ${pt(P(e, -e, e))} L ${pt(P(e, e, e))} L ${pt(P(-e, e, e))} Z`,
      left: `M ${pt(P(-e, e, e))} L ${pt(P(e, e, e))} L ${pt(P(e, e, -e))} L ${pt(P(-e, e, -e))} Z`,
      right: `M ${pt(P(e, -e, e))} L ${pt(P(e, e, e))} L ${pt(P(e, e, -e))} L ${pt(P(e, -e, -e))} Z`,
      // grid lines on the three faces, a third of the edge apart
      grid: [-e / 3, e / 3].flatMap((g) => [
        `M ${pt(P(g, -e, e))} L ${pt(P(g, e, e))}`, `M ${pt(P(-e, g, e))} L ${pt(P(e, g, e))}`,
        `M ${pt(P(g, e, e))} L ${pt(P(g, e, -e))}`, `M ${pt(P(-e, e, g))} L ${pt(P(e, e, g))}`,
        `M ${pt(P(e, g, e))} L ${pt(P(e, g, -e))}`, `M ${pt(P(e, -e, g))} L ${pt(P(e, e, g))}`,
      ]).join(' '),
    };
  };
  const reach = 50; // the arrow runs through the cube, this far each side of its centre
  const cubes = dirs.map(([name, [ux, uy]], i) => {
    const cx = 1130 + i * 102;
    const cy = cubeY;
    const a = [cx - ux * reach, cy - uy * reach];
    const b = [cx + ux * reach, cy + uy * reach];
    const head = (() => {
      const [hx, hy] = b;
      const px = -uy;
      const py = ux;
      return `M ${pt([hx - ux * 12 + px * 7, hy - uy * 12 + py * 7])} L ${pt(b)} L ${pt([hx - ux * 12 - px * 7, hy - uy * 12 - py * 7])}`;
    })();
    return { name, cx, cy, faces: cubeFaces(cx, cy), line: `M ${pt(a)} L ${pt(b)}`, head };
  });
  const sum = { x: 1752, y: cubeY };
  return { x0, barX, barMax, keyY, seqY, rows, cubes, sum, cubeY };
})();

/* ── Slide 8: the earlier version's false alarms, and normal uptake ─────── */
export const S8 = (() => {
  const x0 = 720; // the middle column
  const marks = Array.from({ length: v('organ.fc3') }, (_, i) => ({ x: x0 + 8 + i * 21.4, y: 470, kept: i < v('organ.fc4') }));
  const k = 610 / SCANS.A.heightMm;
  const scan = placeScan(SCANS.A, { x: 1824 - SCANS.A.w * SCANS.A.dx * k, y: 330, k }); // right-aligned to the margin
  const a = SCANS.A.anchors;
  const organs = {
    sal: [scan.at(a.parotid), scan.at(a.submandibular)],
    kidney: [scan.at(a.kidney), scan.at(a.kidney_left)],
  };
  return { x0, marks, scan, organs };
})();

/* ── Slide 9: one tile per scan; the sealed test set and the five folds ─── */
export const S9 = (() => {
  const T = 12; // tile edge
  const P = 15; // tile pitch
  const nA = v('data.autopet');
  const nD = v('data.deeppsma');
  const folds = [0, 1, 2, 3, 4].map((k) => ({ pos: v(`data.fold${k}_pos`), neg: v(`data.fold${k}_neg`), dp: v(`data.fold${k}_dp`) }));
  const test = { dp: v('data.test_deeppsma'), neg: v('data.test_neg') };
  test.pos = v('data.test_autopet') - test.neg;
  // The fold and test counts must add up to the cohorts and the fold sizes.
  const sum = (key) => folds.reduce((t, f) => t + f[key], 0) + test[key];
  console.assert(sum('pos') + sum('neg') === nA && sum('neg') === v('data.autopet_neg') && sum('dp') === nD, 'slide 9 tile counts');
  console.assert(folds.every((f, k) => f.pos + f.neg + f.dp === (k ? v('data.fold_n') : v('data.fold0'))), 'slide 9 fold sizes');

  // Destinations, interleaved by a fixed hash so each cohort block looks mixed.
  const hash = (i) => {
    let h = (i + 1) * 2654435761;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  const destA = [];
  const destD = [];
  const groups = [{ dest: 'test', ...test }, ...folds.map((f, k) => ({ dest: k, ...f }))];
  groups.forEach((g) => {
    for (let i = 0; i < g.pos; i += 1) destA.push({ dest: g.dest, kind: 'pos' });
    for (let i = 0; i < g.neg; i += 1) destA.push({ dest: g.dest, kind: 'neg' });
    for (let i = 0; i < g.dp; i += 1) destD.push({ dest: g.dest, kind: 'dp' });
  });
  const shuffle = (arr, salt) => arr.map((d, i) => ({ d, r: hash(i + salt) })).sort((p, q) => p.r - q.r).map((o) => o.d);
  const a = shuffle(destA, 0);
  const d = shuffle(destD, 5000);

  // Phase 1: two cohort blocks. Final: the sealed box and five fold columns.
  const blockA = { x: 96, y: 476, cols: 30 };
  const blockD = { x: 600, y: 476, cols: 10 };
  // The box sits clear of the starting blocks, so it can appear before the folds form.
  const box = { x: 904, y: 498, cols: 10 };
  const fold = { x: 100, y: 498, cols: 8, gap: 150 };
  const counters = { test: 0, 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  // Within each destination: autoPET-III with lesions, then without, then DEEP-PSMA.
  const order = { pos: 0, neg: 1, dp: 2 };
  const all = [...a.map((t, i) => ({ ...t, from: { x: blockA.x + (i % blockA.cols) * P, y: blockA.y + Math.floor(i / blockA.cols) * P } })),
    ...d.map((t, i) => ({ ...t, from: { x: blockD.x + (i % blockD.cols) * P, y: blockD.y + Math.floor(i / blockD.cols) * P } }))];
  const placed = [...all].sort((p, q) => order[p.kind] - order[q.kind]).map((t) => {
    const n = counters[t.dest];
    counters[t.dest] += 1;
    const g = t.dest === 'test' ? box : { ...fold, x: fold.x + t.dest * fold.gap };
    return { ...t, to: { x: g.x + (n % g.cols) * P, y: g.y + Math.floor(n / g.cols) * P } };
  });
  const tiles = placed.map((t, i) => ({ ...t, i, r: hash(i + 9000) }));
  const boxRows = Math.ceil((test.pos + test.neg + test.dp) / box.cols);
  const foldRows = Math.ceil(Math.max(...folds.map((f) => f.pos + f.neg + f.dp)) / fold.cols);
  // The five versions: one row centred under the folds, not one under each fold
  // (each version trained on the other four folds).
  const thumb = 0.36; // px per figure unit
  const vw = FIG.body.w * thumb;
  const vgap = 22;
  const foldsMid = (fold.x + fold.x + 4 * fold.gap + fold.cols * P - (P - T)) / 2;
  const versions = Array.from({ length: v('inf.models') }, (_, k) => ({
    x: foldsMid - (5 * vw + 4 * vgap) / 2 + k * (vw + vgap),
    y: fold.y + foldRows * P + 22,
  }));
  return {
    T,
    P,
    tiles,
    box: { x: box.x - 22, y: box.y - 22, w: box.cols * P + 32, h: boxRows * P + 32 },
    folds: folds.map((f, k) => ({ x: fold.x + k * fold.gap, w: fold.cols * P - (P - T), y: fold.y })),
    foldBottom: fold.y + foldRows * P,
    thumb,
    versions,
    blockA,
    blockD,
    blockABottom: blockA.y + Math.ceil(nA / blockA.cols) * P,
  };
})();

/* ── Slide 10: the test scan (Figure 4.7 (b)) and the cohort bars ────────── */
export const S10 = (() => {
  const scan = placeScan(SCANS.C, { x: 96, y: 262, k: 680 / SCANS.C.heightMm });
  const bar = { x: 1392, max: 330 }; // 100% = max px
  const groups = [
    { name: 'autoPET-III', y: 268, keys: ['r5.ap_f1', 'r5.ap_sens', 'r5.ap_ppv'] },
    { name: 'DEEP-PSMA', y: 568, keys: ['r5.dp_f1', 'r5.dp_sens', 'r5.dp_ppv'] },
  ].map((g) => ({ ...g, rows: g.keys.map((k, i) => ({ k, y: g.y + 52 + i * 50, w: bar.max * v(k) })) }));
  return { scan, bar, groups };
})();

/* ── Slide 11: the comparison with PSMASegmentator ────────────────────────
   Left: the two models, then their pooled bars (100% = bar.max px). Right:
   one dot per scan, lesions in the scan on a log axis against the hybrid's
   per-scan F1 minus PSMASegmentator's, in points (fair.gen.js, from the two
   per-case result files). */
export const S11 = (() => {
  const col = { hyb: 96, psm: 560 };
  const bar = { label: 330, x: 350, max: 360, h: 26, gap: 8 };
  const rows = [
    { name: 'F1', keys: ['fair.r4_f1', 'fair.psm_f1'], y: 600 },
    { name: 'Found', keys: ['fair.r4_sens', 'fair.psm_sens'], y: 712 },
    { name: 'Flagged and real', keys: ['fair.r4_ppv', 'fair.psm_ppv'], y: 824 },
  ].map((r) => ({ ...r, w: r.keys.map((k) => bar.max * v(k)) }));
  const plot = { x0: 1160, x1: 1810, y0: 372, y1: 792 };
  const n0 = 1.6;
  const n1 = 260;
  const dMax = 50;
  const lx = (n) => plot.x0 + ((Math.log10(n) - Math.log10(n0)) / (Math.log10(n1) - Math.log10(n0))) * (plot.x1 - plot.x0);
  const ly = (d) => plot.y0 + ((dMax - d) / (2 * dMax)) * (plot.y1 - plot.y0);
  const r = 8;
  const pts = FAIR_POINTS.map(([n, d], i) => ({ i, n, d, x: lx(n), y: ly(d), kind: d > 0 ? 'up' : d < 0 ? 'down' : 'tie' }));
  // Scans with the same lesion count are spread sideways a little, so none hides another.
  const byN = new Map();
  pts.forEach((p) => {
    if (!byN.has(p.n)) byN.set(p.n, []);
    byN.get(p.n).push(p);
  });
  byN.forEach((g) => {
    g.sort((a, b) => a.y - b.y).forEach((p, j) => {
      p.x += (j - (g.length - 1) / 2) * 6;
    });
  });
  const count = (kind) => pts.filter((p) => p.kind === kind).length;
  console.assert(count('up') === v('fair.better') && count('down') === v('fair.worse') && count('tie') === v('fair.tied'), 'slide 11 dot counts');
  console.assert(pts.filter((p) => p.n < v('fair.lt20_cut')).length === v('fair.lt20_n') && pts.filter((p) => p.n >= v('fair.ge100_cut')).length === v('fair.ge100_n'), 'slide 11 bands');
  return {
    col,
    bar,
    rows,
    plot,
    r,
    zeroY: ly(0),
    pts: [...pts].sort((a, b) => a.x - b.x),
    xTicks: [2, 5, 10, 20, 50, 100, 200].map((n) => ({ n, x: lx(n) })),
    yTicks: [-40, -20, 0, 20, 40].map((d) => ({ d, y: ly(d) })),
    low: { x: lx(n0), w: lx(v('fair.lt20_cut') - 0.5) - lx(n0) },
    high: { x: lx(v('fair.ge100_cut') - 0.5), w: lx(n1) - lx(v('fair.ge100_cut') - 0.5) },
  };
})();

/* ── Slide 12: the hybrid and its CNN-only version, at two patch sizes ────
   Right: F1 on the 100 DEEP-PSMA scans for the four models (a slope from the
   final model's patch to the larger one), PSMASegmentator as a dashed line.
   Under each column, its patch drawn to scale (coronal view: left to right by
   head to toe, from the facts manifest; front to back is 391 mm for both). */
export const S12 = (() => {
  const plot = { x0: 960, x1: 1700, y0: 340, y1: 640 };
  const fMin = 75;
  const fMax = 83;
  const fy = (f) => plot.y1 - ((f - fMin) / (fMax - fMin)) * (plot.y1 - plot.y0);
  const cols = [1150, 1540];
  const pt = (k, c) => ({ k, x: cols[c], y: fy(v(k)) });
  const k = 0.3; // px per mm for the patches
  const top = 742; // the patches hang under their column labels
  const patch = (zKey, xKey, c) => {
    const w = v(xKey) * k;
    const h = v(zKey) * k;
    return { x: cols[c] - w / 2, y: top, w, h };
  };
  return {
    plot,
    cols,
    hyb: [pt('r6.h_small', 0), pt('r6.h_large', 1)],
    cnn: [pt('r6.c_small', 0), pt('r6.c_large', 1)],
    psmY: fy(v('fair.psm_f1') * 100),
    ticks: [76, 78, 80, 82].map((f) => ({ f, y: fy(f) })),
    small: patch('patch.small_z_mm', 'patch.small_x_mm', 0),
    large: patch('patch.large_z_mm', 'patch.large_x_mm', 1),
    top,
  };
})();

/* ── Slide 13: discussion, in three columns and a strip of limits ────────── */
export const S13 = (() => {
  const c = [96, 690, 1284]; // column left edges
  const div = [650, 1244]; // the dividers between them
  // Patch size and batch size: one training batch per frame, the patches to scale.
  const k = 0.36;
  const sw = v('patch.small_x_mm') * k;
  const sh = v('patch.small_z_mm') * k;
  const lw = v('patch.large_x_mm') * k;
  const lh = v('patch.large_z_mm') * k;
  const pad = 18;
  const base = 650; // the frames' bottom edge
  const f1 = { x: c[1], w: 2 * sw + 14 + 2 * pad, h: sh + 2 * pad };
  f1.y = base - f1.h;
  const f2 = { x: c[1] + f1.w + 62, w: lw + 2 * pad, h: lh + 2 * pad };
  f2.y = base - f2.h;
  const small = [0, 1].map((i) => ({ x: f1.x + pad + i * (sw + 14), y: f1.y + pad, w: sw, h: sh }));
  const large = { x: f2.x + pad, y: f2.y + pad, w: lw, h: lh };
  // Time per scan: 45 s = 360 px.
  const sec = 8;
  const time = { x: c[2], w: { h5: v('eff.h5') * sec, p40: v('eff.p40') * sec, p5: v('eff.p5') * sec } };
  return { c, div, f1, f2, small, large, base, time };
})();

/** The figure layers that slide 13's network pictures draw (for the media list). */
export const S13_MEDIA = [...FIG.skips, ...FIG.enc, ...FIG.dec, ...FIG.mamba].map((n) => `figures/optf/${n}.svg`);
