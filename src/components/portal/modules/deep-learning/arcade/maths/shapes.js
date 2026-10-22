/* ============================================================================
   GRADIENT ARCADE — KERAS OUTPUT SHAPES
   ----------------------------------------------------------------------------
   Pure functions that reproduce what model.summary() prints for each layer
   type. Shapes exclude the batch axis; `null` is an unknown length (None).
   Verified against a real Keras run by tools/dl-arcade/check-maths.mjs.
   The spec format is documented in params.js. No React, no DOM.
   ========================================================================== */

/** [a, b] from a number or a pair. */
const pair = (v) => (Array.isArray(v) ? v : [v, v]);

// ── length rules ────────────────────────────────────────────────────────────
/** Convolution length: "same" → ⌈n/s⌉, "valid" → ⌊(n−k)/s⌋+1 (Keras raises when n < k); unknown stays unknown. */
export function convOut(n, k, s = 1, padding = 'valid') {
  if (n == null) return null;
  return padding === 'valid' ? Math.floor((n - k) / s) + 1 : Math.ceil(n / s);
}
/** Transposed convolution length (Keras's deconv rule): "same" → n·s, "valid" → n·s + max(k − s, 0). */
export function convTransposeOut(n, k, s = 1, padding = 'valid') {
  if (n == null) return null;
  return padding === 'same' ? n * s : n * s + Math.max(k - s, 0);
}
/** Pooling: the convolution rule with k = pool size; strides default to the pool size. */
export const poolOut = (n, pool, s = pool, padding = 'valid') => convOut(n, pool, s, padding);
/** Conv1D: as convOut; "causal" pads on the left only and still gives ⌈n/s⌉. */
export const conv1dOut = (n, k, s = 1, padding = 'valid') => convOut(n, k, s, padding === 'causal' ? 'same' : padding);

// ── one layer ───────────────────────────────────────────────────────────────
/** Output shape of one spec on inputShape (defaults to spec.inputShape). */
export function layerShape(spec, inputShape = spec.inputShape) {
  const s = inputShape;
  switch (spec.type) {
    case 'Dense':
    case 'DenseTranspose':
      return [...s.slice(0, -1), spec.units]; // acts on the last axis only
    case 'Conv2D': {
      const [kh, kw] = pair(spec.kernel);
      const [sh, sw] = pair(spec.strides ?? 1);
      const p = spec.padding ?? 'valid';
      return [convOut(s[0], kh, sh, p), convOut(s[1], kw, sw, p), spec.filters];
    }
    case 'Conv2DTranspose': {
      const [kh, kw] = pair(spec.kernel);
      const [sh, sw] = pair(spec.strides ?? 1);
      const p = spec.padding ?? 'valid';
      return [convTransposeOut(s[0], kh, sh, p), convTransposeOut(s[1], kw, sw, p), spec.filters];
    }
    case 'MaxPool2D':
    case 'AvgPool2D': {
      const [ph, pw] = pair(spec.pool);
      const [sh, sw] = pair(spec.strides ?? spec.pool);
      const p = spec.padding ?? 'valid';
      return [poolOut(s[0], ph, sh, p), poolOut(s[1], pw, sw, p), s[2]];
    }
    case 'GlobalAvgPool2D':
      return [s[2]];
    case 'Flatten':
      if (s.length === 0) return [1];
      return [s.some((d) => d == null) ? null : s.reduce((a, b) => a * b, 1)];
    case 'Reshape':
      return [...spec.target];
    case 'BatchNormalization':
    case 'Dropout':
    case 'MultiHeadAttention': // output_shape defaults to the query's feature size
      return [...s];
    case 'SimpleRNN':
    case 'LSTM':
    case 'GRU':
      return spec.returnSequences ? [s[0], spec.units] : [spec.units];
    case 'Bidirectional': {
      const inner = layerShape(spec.layer, s);
      const width = inner[inner.length - 1];
      const mode = spec.mergeMode ?? 'concat';
      return [...inner.slice(0, -1), mode === 'concat' ? 2 * width : width];
    }
    case 'Conv1D':
      return [conv1dOut(s[0], spec.kernel, spec.strides ?? 1, spec.padding ?? 'valid'), spec.filters];
    case 'Embedding':
      return [...s, spec.outputDim];
    default:
      throw new Error(`layerShape: unknown layer type "${spec.type}"`);
  }
}

// ── a stack ─────────────────────────────────────────────────────────────────
/** Walk a stack: → [{ spec, in, out }], each layer fed the previous output. */
export function modelShapes(specs, inputShape = specs[0]?.inputShape) {
  let shape = inputShape;
  return specs.map((spec) => {
    const full = { ...spec, inputShape: shape };
    const out = layerShape(full, shape);
    const row = { spec: full, in: shape, out };
    shape = out;
    return row;
  });
}

/** "(None, 28, 28, 1)" as Keras prints it: the batch None first, unknown lengths as None. */
export const fmtShape = (shape) => `(${['None', ...shape.map((d) => (d == null ? 'None' : d))].join(', ')})`;
