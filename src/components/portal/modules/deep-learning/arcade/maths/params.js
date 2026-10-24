/* ============================================================================
   GRADIENT ARCADE — KERAS PARAMETER COUNTS
   ----------------------------------------------------------------------------
   Pure functions, one per layer type, that reproduce Keras 3's count_params()
   (trainable + non-trainable). Every formula is a derivation from the layer's
   weight shapes; tools/dl-arcade/check-maths.mjs verifies them against a real
   Keras run (tools/dl-arcade/keras-truth.json, TF 2.21.0 / Keras 3.15.1) and
   against the counts printed on the lecture slides. No React, no DOM.

   Spec format (shared with shapes.js and keras-truth.json). Shapes exclude the
   batch axis; `null` is an unknown length (Keras prints None).
     { type: 'Dense', units, useBias?, inputShape: [nIn] }
     { type: 'Conv2D' | 'Conv2DTranspose', filters, kernel, strides?, padding?, useBias?, inputShape: [h, w, c] }
     { type: 'Conv1D', filters, kernel, strides?, padding?: 'valid'|'same'|'causal', useBias?, inputShape: [t, c] }
     { type: 'MaxPool2D' | 'AvgPool2D', pool, strides?, padding?, inputShape: [h, w, c] }
     { type: 'GlobalAvgPool2D' | 'Flatten' | 'Dropout' | 'BatchNormalization', inputShape }
     { type: 'Reshape', target: [...], inputShape }
     { type: 'SimpleRNN' | 'LSTM' | 'GRU', units, returnSequences?, resetAfter? (GRU), inputShape: [t, nIn] }
     { type: 'Bidirectional', layer: { type, units, ... }, mergeMode?, inputShape: [t, nIn] }
     { type: 'MultiHeadAttention', heads, keyDim, valueDim?, useBias?, inputShape: [t, d] }
     { type: 'Embedding', inputDim, outputDim, inputShape: [t] }
     { type: 'DenseTranspose', units, inputShape: [nIn] }   // Lecture 5's tied-weight decoder layer
   ========================================================================== */

import { layerShape } from './shapes.js';

/** [a, b] from a number or a pair. */
const pair = (v) => (Array.isArray(v) ? v : [v, v]);
/** Last entry of a shape: Keras's feature / channel axis. */
const last = (shape) => shape[shape.length - 1];
/** A count where every weight is trainable. */
const all = (n) => ({ total: n, trainable: n, nonTrainable: 0 });

// ── one function per layer type ─────────────────────────────────────────────
/** Dense: kernel [nIn, units] + bias [units]. */
export const denseParams = (nIn, units, useBias = true) => nIn * units + (useBias ? units : 0);
/** Conv2D: kernel [kh, kw, cin, filters] + bias [filters]; `kernel` is k or [kh, kw]. */
export function conv2dParams(kernel, cin, filters, useBias = true) {
  const [kh, kw] = pair(kernel);
  return kh * kw * cin * filters + (useBias ? filters : 0);
}
/** Conv2DTranspose: kernel [kh, kw, filters, cin] + bias [filters] (the kernel's channel axes are swapped). */
export function convTransposeParams(kernel, cin, filters, useBias = true) {
  const [kh, kw] = pair(kernel);
  return kh * kw * filters * cin + (useBias ? filters : 0);
}
/** Conv1D: kernel [k, cin, filters] + bias [filters]. */
export const conv1dParams = (kernel, cin, filters, useBias = true) => kernel * cin * filters + (useBias ? filters : 0);
/** BatchNormalization (axis −1): gamma + beta are trainable, moving mean + variance are not; all four are [channels]. */
export const bnParams = (channels) => ({ total: 4 * channels, trainable: 2 * channels, nonTrainable: 2 * channels });
/** SimpleRNN: kernel [nIn, units] + recurrent kernel [units, units] + bias [units]. */
export const simpleRnnParams = (units, nIn) => units * nIn + units * units + units;
/** LSTM: four gates (i, f, o, g), each one SimpleRNN-sized block. */
export const lstmParams = (units, nIn) => 4 * (units * nIn + units * units + units);
/** GRU: three blocks (z, r, g). Keras's default reset_after=True keeps an input AND a recurrent bias per block; the slides' equations have one. */
export const gruParams = (units, nIn, resetAfter = true) => 3 * (units * nIn + units * units + (resetAfter ? 2 : 1) * units);
/** Bidirectional: a forward and a backward copy of the wrapped layer. */
export const bidirectionalParams = (inner) => 2 * inner;
/** MultiHeadAttention on query = key = value of width d: q, k kernels [d, heads, keyDim] + biases [heads, keyDim]; v kernel [d, heads, valueDim] + bias [heads, valueDim]; output kernel [heads, valueDim, d] + bias [d]. */
export function mhaParams(d, heads, keyDim, valueDim = null, useBias = true) {
  const vd = valueDim ?? keyDim;
  const q = d * heads * keyDim + (useBias ? heads * keyDim : 0);
  const k = q;
  const v = d * heads * vd + (useBias ? heads * vd : 0);
  const out = heads * vd * d + (useBias ? d : 0);
  return q + k + v + out;
}
/** Embedding: one lookup table [inputDim, outputDim], no bias. */
export const embeddingParams = (inputDim, outputDim) => inputDim * outputDim;
/** Tied-weight DenseTranspose (Lecture 5 slide 20): the kernel is borrowed from the encoder's Dense, only a bias [units] is new. */
export const denseTransposeParams = (units) => units;

// ── dispatcher ──────────────────────────────────────────────────────────────
/** { total, trainable, nonTrainable } for one spec (its inputShape must be set). */
export function layerParams(spec) {
  const nIn = spec.inputShape ? last(spec.inputShape) : undefined;
  const useBias = spec.useBias !== false;
  switch (spec.type) {
    case 'Dense': return all(denseParams(nIn, spec.units, useBias));
    case 'Conv2D': return all(conv2dParams(spec.kernel, nIn, spec.filters, useBias));
    case 'Conv2DTranspose': return all(convTransposeParams(spec.kernel, nIn, spec.filters, useBias));
    case 'Conv1D': return all(conv1dParams(spec.kernel, nIn, spec.filters, useBias));
    case 'BatchNormalization': return bnParams(nIn);
    case 'SimpleRNN': return all(simpleRnnParams(spec.units, nIn));
    case 'LSTM': return all(lstmParams(spec.units, nIn));
    case 'GRU': return all(gruParams(spec.units, nIn, spec.resetAfter !== false));
    case 'Bidirectional': {
      const inner = layerParams({ ...spec.layer, inputShape: spec.inputShape });
      return {
        total: bidirectionalParams(inner.total),
        trainable: bidirectionalParams(inner.trainable),
        nonTrainable: bidirectionalParams(inner.nonTrainable),
      };
    }
    case 'MultiHeadAttention': return all(mhaParams(nIn, spec.heads, spec.keyDim, spec.valueDim, useBias));
    case 'Embedding': return all(embeddingParams(spec.inputDim, spec.outputDim));
    case 'DenseTranspose': return all(denseTransposeParams(spec.units));
    case 'MaxPool2D':
    case 'AvgPool2D':
    case 'GlobalAvgPool2D':
    case 'Flatten':
    case 'Reshape':
    case 'Dropout':
      return all(0);
    default:
      throw new Error(`layerParams: unknown layer type "${spec.type}"`);
  }
}

/** Walk a stack: each layer's input is the previous output. → { total, trainable, nonTrainable, layers: [{ spec, in, out, total, trainable, nonTrainable }] }. */
export function modelParams(specs, inputShape = specs[0]?.inputShape) {
  let shape = inputShape;
  const layers = specs.map((spec) => {
    const full = { ...spec, inputShape: shape };
    const counts = layerParams(full);
    const out = layerShape(full, shape);
    const row = { spec: full, in: shape, out, ...counts };
    shape = out;
    return row;
  });
  const sum = (key) => layers.reduce((a, l) => a + l[key], 0);
  return { total: sum('total'), trainable: sum('trainable'), nonTrainable: sum('nonTrainable'), layers };
}
