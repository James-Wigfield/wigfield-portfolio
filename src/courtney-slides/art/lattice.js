/* ============================================================================
   LATTICE — a procedural trabecular (spongy) bone network inside a circle.
   A jittered triangular mesh with a share of its edges removed reads as
   irregular rods and pores. One parameter moves it through three states:

     s = 0  healthy        thick, well-connected struts
     s = 1  osteopenia     thinner struts, a few perforated
     s = 2  osteoporosis   thin struts, many lost, pores merge

   Schematic only: the widths and loss fractions are drawn for clarity, not
   measured from histology.
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';

export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLattice({ cx, cy, r, step = 56, seed = 11, drop = 0.36, w = 11 }) {
  const rnd = mulberry32(seed);
  const pts = [];
  const at = new Map();
  const rowH = step * 0.866;
  const rows = Math.ceil((2 * r) / rowH) + 3;
  const cols = Math.ceil((2 * r) / step) + 3;
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const x = cx - r + i * step + (j % 2 ? step / 2 : 0) + (rnd() - 0.5) * step * 0.55;
      const y = cy - r + j * rowH + (rnd() - 0.5) * step * 0.55;
      at.set(`${i},${j}`, pts.length);
      pts.push({ x, y, deg: 0 });
    }
  }
  const inside = (p) => Math.hypot(p.x - cx, p.y - cy) < r + step * 0.7;
  const cand = [];
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const a = at.get(`${i},${j}`);
      const nb = j % 2
        ? [[i + 1, j], [i, j + 1], [i + 1, j + 1]]
        : [[i + 1, j], [i - 1, j + 1], [i, j + 1]];
      nb.forEach(([ni, nj]) => {
        const b = at.get(`${ni},${nj}`);
        if (b === undefined) return;
        if (!inside(pts[a]) || !inside(pts[b])) return;
        cand.push([a, b]);
      });
    }
  }
  cand.forEach(([a, b]) => { pts[a].deg++; pts[b].deg++; });
  const struts = [];
  cand.forEach(([a, b]) => {
    // drop some edges for irregular pores, never leaving a node with fewer than 3
    if (rnd() < drop && pts[a].deg > 3 && pts[b].deg > 3) {
      pts[a].deg--;
      pts[b].deg--;
      return;
    }
    struts.push({ a, b, w: w * (0.72 + rnd() * 0.56), k: rnd() });
  });
  return { pts, struts, cx, cy, r };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lossAt = (s) => (s <= 1 ? 0.12 * s : 0.12 + 0.27 * (s - 1));
const widthAt = (s) => 1 - 0.27 * s;

export class Lattice {
  constructor(g, model) {
    g.replaceChildren();
    this.m = model;
    this.lines = model.struts.map((st) => {
      const A = model.pts[st.a];
      const B = model.pts[st.b];
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', A.x.toFixed(1));
      l.setAttribute('y1', A.y.toFixed(1));
      l.setAttribute('x2', B.x.toFixed(1));
      l.setAttribute('y2', B.y.toFixed(1));
      l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('class', 'lat-strut');
      g.appendChild(l);
      return l;
    });
    // stubs of lost struts, shown when the architecture beat marks them
    this.stubs = [];
    const finalLoss = lossAt(2);
    model.struts.forEach((st) => {
      if (st.k >= finalLoss) return;
      const A = model.pts[st.a];
      const B = model.pts[st.b];
      [[A, B], [B, A]].forEach(([P, Q]) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', P.x.toFixed(1));
        l.setAttribute('y1', P.y.toFixed(1));
        l.setAttribute('x2', (P.x + (Q.x - P.x) * 0.24).toFixed(1));
        l.setAttribute('y2', (P.y + (Q.y - P.y) * 0.24).toFixed(1));
        l.setAttribute('stroke-linecap', 'round');
        l.setAttribute('class', 'lat-stub');
        l.setAttribute('opacity', '0');
        g.appendChild(l);
        this.stubs.push(l);
      });
    });
  }

  /** s: 0..2 (see header). stubs: 0..1 opacity of the lost-strut marks. grow: 0..1 entrance. */
  set(s, stubs = 0, grow = 1) {
    const loss = lossAt(s);
    const wf = widthAt(s);
    this.m.struts.forEach((st, i) => {
      const alive = clamp((st.k - loss) / 0.035 + 1, 0, 1);
      const l = this.lines[i];
      const g = Math.max(0, Math.min(1, grow * 1.6 - st.k * 0.6));
      l.setAttribute('stroke-width', (st.w * wf * (0.25 + 0.75 * alive) * g).toFixed(2));
      l.setAttribute('opacity', (alive * Math.min(1, g * 3)).toFixed(3));
    });
    const sw = (6 * widthAt(2)).toFixed(2);
    this.stubs.forEach((l) => {
      l.setAttribute('opacity', stubs.toFixed(3));
      l.setAttribute('stroke-width', sw);
    });
  }
}
