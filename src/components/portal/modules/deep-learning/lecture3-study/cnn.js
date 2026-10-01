/* ============================================================================
   LECTURE 3 STUDY — CNN MATHS
   ----------------------------------------------------------------------------
   The pure functions behind every lab: convolution, padding and output sizes,
   pooling, parameter / multiplication / memory counts, and the slide-35
   Fashion-MNIST model's shape flow. No React, no DOM.

   Conventions: grids are row-major 2-D arrays (grid[row][col]); "x" in the
   slide-6 formula is the column, "y" the row.
   ========================================================================== */

// ── Formatting ──────────────────────────────────────────────────────────────
export const fmtInt = (n) => Math.round(n).toLocaleString('en-AU');

// Decimal units, as the slides use them (150×100×200×4 B = 12 MB).
export function fmtBytes(b) {
  if (b >= 1e9) return `${trim(b / 1e9)} GB`;
  if (b >= 1e6) return `${trim(b / 1e6)} MB`;
  if (b >= 1e3) return `${trim(b / 1e3)} kB`;
  return `${Math.round(b)} B`;
}

// 225,000,000 → "225 million"; small numbers stay as digits.
export function fmtBig(n) {
  if (n >= 1e9) return `${trim(n / 1e9)} billion`;
  if (n >= 1e6) return `${trim(n / 1e6)} million`;
  return fmtInt(n);
}

function trim(v) {
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

// ── Output sizes ────────────────────────────────────────────────────────────
// Keras padding: "valid" never leaves the image; "same" pads with zeros so that
// out = ceil(n / s). (The counting rule behind Figures 14-7 and 14-8.)
export function outSize(n, k, s, padding) {
  if (padding === 'same') return Math.ceil(n / s);
  return n >= k ? Math.floor((n - k) / s) + 1 : 0;
}

// How "same" splits its zeros: the extra one (if any) goes on the right.
export function samePad(n, k, s) {
  const out = Math.ceil(n / s);
  const total = Math.max((out - 1) * s + k - n, 0);
  const before = Math.floor(total / 2);
  return { out, total, before, after: total - before };
}

// Slide-9 style: an explicit ring of p zeros on every side.
export function outSizePad(n, k, s, p) {
  const m = n + 2 * p;
  return m >= k ? Math.floor((m - k) / s) + 1 : 0;
}

// ── Convolution ─────────────────────────────────────────────────────────────
// The slide-6 operation over every position where the filter fits ("valid").
export function convValid(grid, kernel, stride = 1) {
  const H = grid.length;
  const W = grid[0].length;
  const kh = kernel.length;
  const kw = kernel[0].length;
  const oh = H >= kh ? Math.floor((H - kh) / stride) + 1 : 0;
  const ow = W >= kw ? Math.floor((W - kw) / stride) + 1 : 0;
  const out = [];
  for (let r = 0; r < oh; r++) {
    const row = [];
    for (let c = 0; c < ow; c++) {
      let s = 0;
      for (let u = 0; u < kh; u++) for (let v = 0; v < kw; v++) s += grid[r * stride + u][c * stride + v] * kernel[u][v];
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

// Flat Float32 version for the larger feature-map images.
export function convValidFlat(img, n, k, kn) {
  const m = n - kn + 1;
  const out = new Float32Array(m * m);
  let max = 0;
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < m; x++) {
      let s = 0;
      for (let j = 0; j < kn; j++) for (let i = 0; i < kn; i++) s += img[(y + j) * n + (x + i)] * k[j * kn + i];
      out[y * m + x] = s;
      if (s > max) max = s;
    }
  }
  return { data: out, n: m, max };
}

// ── Pooling ─────────────────────────────────────────────────────────────────
// "valid" pooling: windows that don't fit are dropped (Figure 14-9's crossed
// column). Returns the outputs plus each window's cells for the labs.
export function pool2d(grid, size, stride, mode) {
  const H = grid.length;
  const W = grid[0].length;
  const oh = H >= size ? Math.floor((H - size) / stride) + 1 : 0;
  const ow = W >= size ? Math.floor((W - size) / stride) + 1 : 0;
  const out = [];
  for (let r = 0; r < oh; r++) {
    const row = [];
    for (let c = 0; c < ow; c++) {
      const vals = [];
      for (let u = 0; u < size; u++) for (let v = 0; v < size; v++) vals.push(grid[r * stride + u][c * stride + v]);
      row.push(mode === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    out.push(row);
  }
  return out;
}

// Which input cells no window ever reads (rows/cols beyond the last window).
export function coveredExtent(n, size, stride) {
  const o = n >= size ? Math.floor((n - size) / stride) + 1 : 0;
  return o > 0 ? (o - 1) * stride + size : 0;
}

// Shift a grid by dx columns (right is +), filling with zeros.
export function shiftGrid(grid, dx) {
  return grid.map((row) => row.map((_, c) => (c - dx >= 0 && c - dx < row.length ? row[c - dx] : 0)));
}

// ── Counting ────────────────────────────────────────────────────────────────
// Slide 22: (5×5×3 + 1) × 200 — weights per filter plus one bias, per filter.
export const convParams = (fh, fw, fc, fn) => (fh * fw * fc + 1) * fn;
export const denseParams = (nin, nout) => nin * nout + nout;

// ── The slide-35 Fashion-MNIST CNN, layer by layer ──────────────────────────
// `line` = the 1-indexed line(s) of the slide-35 code each layer comes from.
export function fashionModel() {
  const layers = [];
  let shape = [28, 28, 1];
  const push = (l) => layers.push({ ...l, out: l.out ?? shape });

  push({ id: 'in', name: 'InputLayer', kind: 'input', label: 'Input', lines: [5], params: 0, calc: 'shape=[28, 28, 1]' });

  const conv = (filters, k, line) => {
    const c = shape[2];
    const p = convParams(k, k, c, filters);
    shape = [shape[0], shape[1], filters]; // "same" padding, stride 1
    push({
      id: `c${layers.length}`,
      name: k === 3 ? `DefaultConv2D(filters=${filters})` : `DefaultConv2D(filters=${filters}, kernel_size=${k})`,
      kind: 'conv',
      label: `Conv ${filters}`,
      lines: [line],
      params: p,
      calc: `(${k}×${k}×${c} + 1) × ${filters} = ${fmtInt(p)}`,
    });
  };
  const pool = (line) => {
    const prev = shape;
    shape = [Math.floor(shape[0] / 2), Math.floor(shape[1] / 2), shape[2]];
    push({
      id: `p${layers.length}`,
      name: 'MaxPool2D()',
      kind: 'pool',
      label: 'Pool',
      lines: [line],
      params: 0,
      calc: `default 2×2 pool, stride 2, "valid": ${prev[0]} → ${shape[0]} (no weights)`,
    });
  };

  conv(64, 7, 6);
  pool(7);
  conv(128, 3, 8);
  conv(128, 3, 9);
  pool(10);
  conv(256, 3, 11);
  conv(256, 3, 12);
  pool(13);

  const flat = shape[0] * shape[1] * shape[2];
  const flatFrom = shape;
  shape = [flat];
  push({ id: 'flat', name: 'Flatten()', kind: 'flat', label: 'Flatten', lines: [14], params: 0, calc: `${flatFrom[0]}×${flatFrom[1]}×${flatFrom[2]} = ${fmtInt(flat)} numbers in a row` });

  const dense = (units, lines, act) => {
    const nin = shape[0];
    const p = denseParams(nin, units);
    shape = [units];
    push({ id: `d${layers.length}`, name: `Dense(units=${units}, activation="${act}")`, kind: 'dense', label: `Dense ${units}`, lines, params: p, calc: `${fmtInt(nin)} × ${units} + ${units} = ${fmtInt(p)}` });
  };
  const drop = (line) => push({ id: `x${layers.length}`, name: 'Dropout(0.5)', kind: 'drop', label: 'Dropout', lines: [line], params: 0, calc: 'no weights; drops 50% of the units while training' });

  dense(128, [15, 16], 'relu');
  drop(17);
  dense(64, [18, 19], 'relu');
  drop(20);
  dense(10, [21], 'softmax');

  const total = layers.reduce((a, l) => a + l.params, 0);
  return { layers, total };
}
