import { flow } from './counts.js';

/* ============================================================================
   CODE LAB — "DRAW IT" LAYOUT
   ----------------------------------------------------------------------------
   Places a spec's layers for diagrams.jsx, one box per layer.

   layoutDiagram (screen): input at the top, output at the bottom. A layer's
   row is its depth (1 + the deepest layer it reads), so a functional
   model's branches sit side by side and merge where they meet; an edge
   that skips rows (a Wide & Deep shortcut) runs down a side lane, and an
   RNN state handed across (initial_state) is a dashed side edge. A long
   plain chain folds into columns (spec.diagram.fold layers per column).

   layoutAcross (print): the same graph turned on its side to fit the A4
   column in a short band: input on the left, depth as the column, branches
   stacked; a shortcut runs along a lane above the row, a state hand-over is
   a dashed drop between stacked boxes, and a long chain wraps onto further
   rows, left to right.
   ========================================================================== */

export const SCREEN = { BW: 196, BH: 42, VG: 20, HG: 26, LANE: 26, PAD: 10, COL_GAP: 46, NAME_Y: 16, SHAPE_Y: 33, NAME: 11.5, SHAPE: 10.5, CHARS: 27 };

function depthsOf(f) {
  const depth = {};
  f.rows.forEach((r) => {
    depth[r.id] = r.from.length ? 1 + Math.max(...r.from.map((s) => depth[s])) : 0;
  });
  return depth;
}

const isChainOf = (f) => f.rows.every((r, i) => (i === 0 ? r.from.length === 0 : r.from.length === 1 && r.from[0] === f.rows[i - 1].id));

function groupRuns(nodes, BW, BH, key) {
  const groups = [];
  nodes.forEach((nd, i) => {
    if (!nd.group) return;
    const prev = nodes[i - 1];
    const g = groups[groups.length - 1];
    if (g && prev && prev.group === nd.group && prev[key] === nd[key]) {
      g.x0 = Math.min(g.x0, nd.x);
      g.x1 = Math.max(g.x1, nd.x + BW);
      g.y0 = Math.min(g.y0, nd.y);
      g.y1 = Math.max(g.y1, nd.y + BH);
    } else {
      groups.push({ label: nd.group, x0: nd.x, x1: nd.x + BW, y0: nd.y, y1: nd.y + BH });
    }
  });
  return groups;
}

export function layoutDiagram(spec, G = SCREEN) {
  const { BW, BH, VG, HG, LANE, PAD, COL_GAP } = G;
  const f = flow(spec);
  const depth = depthsOf(f);
  const n = f.rows.length;
  const fold = isChainOf(f) && spec.diagram?.fold ? spec.diagram.fold : 0;

  const nodes = [];
  const edges = [];
  let width;
  let height;

  if (fold) {
    const cols = Math.ceil(n / fold);
    f.rows.forEach((r, i) => {
      const c = Math.floor(i / fold);
      const k = i % fold;
      nodes.push({ ...r, x: PAD + c * (BW + COL_GAP), y: PAD + k * (BH + VG), col: c });
    });
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1];
      const b = nodes[i];
      edges.push({ kind: a.col === b.col ? 'down' : 'fold', a, b });
    }
    width = PAD * 2 + cols * BW + (cols - 1) * COL_GAP;
    height = PAD * 2 + Math.min(fold, n) * (BH + VG) - VG;
  } else {
    const maxD = Math.max(...Object.values(depth));
    const rowsAt = Array.from({ length: maxD + 1 }, () => []);
    f.rows.forEach((r) => rowsAt[depth[r.id]].push(r));
    const widest = Math.max(...rowsAt.map((rs) => rs.length));
    const inner = widest * BW + (widest - 1) * HG;
    const needLane = f.rows.some((r) => r.from.some((s) => depth[r.id] - depth[s] > 1));
    const left = PAD + (needLane ? LANE + 8 : 0);
    rowsAt.forEach((rs, d) => {
      const rowW = rs.length * BW + (rs.length - 1) * HG;
      const x0 = left + (inner - rowW) / 2;
      rs.forEach((r, i) => nodes.push({ ...r, x: x0 + i * (BW + HG), y: PAD + d * (BH + VG), col: 0 }));
    });
    const at = Object.fromEntries(nodes.map((nd) => [nd.id, nd]));
    const mid = left + inner / 2;
    nodes.forEach((b) => b.from.forEach((s) => {
      const a = at[s];
      if (depth[b.id] - depth[s] > 1) {
        const side = a.x + BW / 2 <= mid ? 'left' : 'right';
        edges.push({ kind: 'lane', a, b, side, laneX: side === 'left' ? left - LANE : left + inner + LANE });
      } else {
        edges.push({ kind: 'down', a, b });
      }
    }));
    nodes.forEach((b) => {
      if (b.state && at[b.state]) edges.push({ kind: 'state', a: at[b.state], b });
    });
    width = left + inner + PAD + (needLane ? LANE + 8 : 0);
    height = PAD * 2 + (maxD + 1) * (BH + VG) - VG;
  }

  return { nodes, edges, groups: groupRuns(nodes, BW, BH, 'col'), width, height, G };
}

// ── print: across the page ──────────────────────────────────────────────────
export const ACROSS_W = 718; // the A4 content width in CSS px (190 mm)
const A = { BH: 42, HG: 16, VG: 12, PAD: 3, LANE: 10, MAXBW: 150, PER_ROW: 8, GROUP_TOP: 12 };

export function layoutAcross(spec) {
  const f = flow(spec);
  const depth = depthsOf(f);
  const n = f.rows.length;
  const nodes = [];
  const edges = [];

  if (isChainOf(f)) {
    const rows = Math.ceil(n / A.PER_ROW);
    const perRow = Math.ceil(n / rows);
    const BW = Math.min(A.MAXBW, Math.floor((ACROSS_W - 2 * A.PAD - (perRow - 1) * A.HG) / perRow));
    const groupGap = f.rows.some((r) => r.group) ? A.GROUP_TOP : 0;
    const rowH = A.BH + A.VG + groupGap;
    f.rows.forEach((r, i) => {
      const row = Math.floor(i / perRow);
      const k = i % perRow;
      nodes.push({ ...r, x: A.PAD + k * (BW + A.HG), y: A.PAD + groupGap + row * rowH, row });
    });
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1];
      const b = nodes[i];
      edges.push({ kind: a.row === b.row ? 'right' : 'wrap', a, b });
    }
    const width = A.PAD * 2 + perRow * BW + (perRow - 1) * A.HG;
    const height = A.PAD * 2 + rows * rowH - A.VG;
    return { nodes, edges, groups: groupRuns(nodes, BW, A.BH, 'row'), width, height, BW, BH: A.BH, VG: A.VG };
  }

  // a functional graph: depth = column, branches stacked in each column
  const maxD = Math.max(...Object.values(depth));
  const cols = Array.from({ length: maxD + 1 }, () => []);
  f.rows.forEach((r) => cols[depth[r.id]].push(r));
  const tallest = Math.max(...cols.map((c) => c.length));
  const BW = Math.min(A.MAXBW, Math.floor((ACROSS_W - 2 * A.PAD - maxD * A.HG) / (maxD + 1)));
  const skips = f.rows.reduce((k, r) => k + r.from.filter((s) => depth[r.id] - depth[s] > 1).length, 0);
  const top = A.PAD + skips * A.LANE;
  const inner = tallest * A.BH + (tallest - 1) * A.VG;
  cols.forEach((c, d) => {
    const colH = c.length * A.BH + (c.length - 1) * A.VG;
    const y0 = top + (inner - colH) / 2;
    c.forEach((r, i) => nodes.push({ ...r, x: A.PAD + d * (BW + A.HG), y: y0 + i * (A.BH + A.VG), row: 0 }));
  });
  const at = Object.fromEntries(nodes.map((nd) => [nd.id, nd]));
  let lane = 0;
  nodes.forEach((b) => b.from.forEach((s) => {
    const a = at[s];
    if (depth[b.id] - depth[s] > 1) {
      lane += 1;
      edges.push({ kind: 'over', a, b, laneY: top - lane * A.LANE + 3 });
    } else {
      edges.push({ kind: 'right', a, b });
    }
  }));
  nodes.forEach((b) => {
    if (b.state && at[b.state]) edges.push({ kind: 'drop', a: at[b.state], b });
  });
  const width = A.PAD * 2 + (maxD + 1) * BW + maxD * A.HG;
  const height = top + inner + A.PAD;
  return { nodes, edges, groups: [], width, height, BW, BH: A.BH, VG: A.VG };
}
