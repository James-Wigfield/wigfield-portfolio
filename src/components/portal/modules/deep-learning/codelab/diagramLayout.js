import { flow } from './counts.js';

/* ============================================================================
   CODE LAB — "DRAW IT" LAYOUT
   ----------------------------------------------------------------------------
   Places a spec's layers for diagrams.jsx: one box per layer, input at the
   top, output at the bottom. A layer's row is its depth (1 + the deepest
   layer it reads), so a functional model's branches sit side by side and
   merge where they meet; an edge that skips rows (a Wide & Deep shortcut)
   runs down a side lane. A long plain chain can fold into columns
   (spec.diagram.fold = layers per column).
   ========================================================================== */

export const BOX_W = 196;
export const BOX_H = 42;
const VG = 20; // vertical gap
const HG = 26; // horizontal gap
const LANE = 26; // side-lane offset
const PAD = 10;
const COL_GAP = 46;

export function layoutDiagram(spec) {
  const f = flow(spec);
  const byId = Object.fromEntries(f.rows.map((r) => [r.id, r]));
  const depth = {};
  f.rows.forEach((r) => {
    depth[r.id] = r.from.length ? 1 + Math.max(...r.from.map((s) => depth[s])) : 0;
  });
  const isChain = f.rows.every((r, i) => (i === 0 ? r.from.length === 0 : r.from.length === 1 && r.from[0] === f.rows[i - 1].id));
  const fold = isChain && spec.diagram?.fold ? spec.diagram.fold : 0;

  const nodes = [];
  const edges = [];
  let width;
  let height;

  if (fold) {
    const cols = Math.ceil(f.rows.length / fold);
    f.rows.forEach((r, i) => {
      const c = Math.floor(i / fold);
      const k = i % fold;
      nodes.push({ ...r, x: PAD + c * (BOX_W + COL_GAP), y: PAD + k * (BOX_H + VG), col: c });
    });
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1];
      const b = nodes[i];
      if (a.col === b.col) edges.push({ kind: 'down', a, b });
      else edges.push({ kind: 'fold', a, b });
    }
    width = PAD * 2 + cols * BOX_W + (cols - 1) * COL_GAP;
    height = PAD * 2 + Math.min(fold, f.rows.length) * (BOX_H + VG) - VG;
  } else {
    const maxD = Math.max(...Object.values(depth));
    const rowsAt = Array.from({ length: maxD + 1 }, () => []);
    f.rows.forEach((r) => rowsAt[depth[r.id]].push(r));
    const widest = Math.max(...rowsAt.map((rs) => rs.length));
    const inner = widest * BOX_W + (widest - 1) * HG;
    // a side lane for edges that skip a row
    const needLane = f.rows.some((r) => r.from.some((s) => depth[r.id] - depth[s] > 1));
    const left = PAD + (needLane ? LANE + 8 : 0);
    rowsAt.forEach((rs, d) => {
      const rowW = rs.length * BOX_W + (rs.length - 1) * HG;
      const x0 = left + (inner - rowW) / 2;
      rs.forEach((r, i) => nodes.push({ ...r, x: x0 + i * (BOX_W + HG), y: PAD + d * (BOX_H + VG) }));
    });
    const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const mid = left + inner / 2;
    nodes.forEach((b) => b.from.forEach((s) => {
      const a = at[s];
      if (depth[b.id] - depth[s] > 1) {
        const side = a.x + BOX_W / 2 <= mid ? 'left' : 'right';
        edges.push({ kind: 'lane', a, b, side, laneX: side === 'left' ? left - LANE : left + inner + LANE });
      } else {
        edges.push({ kind: 'down', a, b });
      }
    }));
    width = left + inner + PAD + (needLane ? LANE + 8 : 0);
    height = PAD * 2 + (maxD + 1) * (BOX_H + VG) - VG;
  }

  // group brackets (encoder / decoder …): contiguous runs per column
  const groups = [];
  nodes.forEach((n, i) => {
    if (!n.group) return;
    const prev = nodes[i - 1];
    const g = groups[groups.length - 1];
    if (g && prev && prev.group === n.group && (prev.col ?? 0) === (n.col ?? 0)) {
      g.y1 = n.y + BOX_H;
      g.x0 = Math.min(g.x0, n.x);
      g.x1 = Math.max(g.x1, n.x + BOX_W);
    } else {
      groups.push({ label: n.group, x0: n.x, x1: n.x + BOX_W, y0: n.y, y1: n.y + BOX_H });
    }
  });

  return { nodes, edges, groups, width, height, totals: { tr: f.tr, nt: f.nt }, byId };
}
