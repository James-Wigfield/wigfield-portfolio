import { traceShapes, prod } from './shapeRules.js';

/* ============================================================================
   TRICKY TOPICS — COUNTING PARAMETERS (shared maths)
   ----------------------------------------------------------------------------
   One rule per layer type, written the way the slides show it, with the
   weight shapes Keras creates. countModel() walks a model (shapeRules.js
   vocabulary) and returns, per layer, its output shape, its weights and its
   trainable / non-trainable counts. Every count the page shows comes from
   here; tools/dl-tricky-topics/verify_counts.py builds the same models in
   Keras and asserts the same numbers.

     Dense              (n_in + 1) × units   (n_in × units without bias)
     Normalization      2n + 1, all non-trainable (means, variances, count)
     BatchNormalization 4n: γ, β trainable; moving mean, variance not
     Conv2D / Conv1D    (k_h × k_w × c_in + 1) × filters — no image size,
     Conv2DTranspose    no stride anywhere in it
     SimpleRNN          units × (units + n_in) + units (W_x, W_h, b), shared
                        by every time step: the sequence length never enters
     LSTM               4 × that
     GRU                3 × (units × (units + n_in) + 2 × units) with Keras's
                        default reset_after=True (two biases per gate);
                        3 × (units × (units + n_in) + units) without it
     Bidirectional      2 × the wrapped layer
     DenseTranspose     biases only (it borrows the encoder's kernel)
     everything else    0 (Flatten, Reshape, Dropout, pooling, GAP,
                        Concatenate, Activation)
   frozen: true moves a layer's whole count to non-trainable.
   ========================================================================== */

const pair = (k) => (Array.isArray(k) ? k : [k, k]);
const W = (name, shape, trainable = true) => ({ name, shape, n: prod(shape), trainable });

function rnnWeights(t, nIn, u, resetAfter = true) {
  if (t === 'simplernn') return [W('W_x (kernel)', [nIn, u]), W('W_h (recurrent)', [u, u]), W('b (bias)', [u])];
  if (t === 'lstm') return [W('kernel', [nIn, 4 * u]), W('recurrent', [u, 4 * u]), W('bias', [4 * u])];
  return [W('kernel', [nIn, 3 * u]), W('recurrent', [u, 3 * u]), resetAfter ? W('bias', [2, 3 * u]) : W('bias', [3 * u])];
}

// The weights one layer creates, given its input shapes.
export function layerWeights(L, ins) {
  const x = ins[0];
  const cin = x[x.length - 1];
  switch (L.t) {
    case 'dense':
      return L.bias === false ? [W('kernel', [cin, L.units])] : [W('kernel', [cin, L.units]), W('bias', [L.units])];
    case 'denseT':
      return [W('bias', [L.units])];
    case 'conv2d': {
      const [kh, kw] = pair(L.k);
      const k = [W('kernel', [kh, kw, cin, L.filters])];
      return L.bias === false ? k : [...k, W('bias', [L.filters])];
    }
    case 'conv1d':
      return [W('kernel', [L.k, cin, L.filters]), W('bias', [L.filters])];
    case 'conv2dT': {
      const [kh, kw] = pair(L.k);
      // Keras stores a transposed conv's kernel as (k_h, k_w, filters, c_in)
      return [W('kernel', [kh, kw, L.filters, cin]), W('bias', [L.filters])];
    }
    case 'norm':
      return [W('mean', [cin], false), W('variance', [cin], false), W('count', [], false)];
    case 'bn':
      return [W('gamma', [cin]), W('beta', [cin]), W('moving_mean', [cin], false), W('moving_variance', [cin], false)];
    case 'simplernn':
    case 'lstm':
    case 'gru':
      return rnnWeights(L.t, cin, L.units, L.resetAfter !== false);
    case 'bidir': {
      const w = rnnWeights(L.layer.t, cin, L.layer.units, L.layer.resetAfter !== false);
      return [...w.map((v) => ({ ...v, name: `forward ${v.name}` })), ...w.map((v) => ({ ...v, name: `backward ${v.name}` }))];
    }
    default:
      return [];
  }
}

export function layerCounts(L, ins) {
  const weights = layerWeights(L, ins).map((w) => (L.frozen ? { ...w, trainable: false } : w));
  const trainable = weights.filter((w) => w.trainable).reduce((a, w) => a + w.n, 0);
  const nonTrainable = weights.filter((w) => !w.trainable).reduce((a, w) => a + w.n, 0);
  return { weights, trainable, nonTrainable, total: trainable + nonTrainable };
}

// Per layer: { i, L, ins, out, weights, trainable, nonTrainable, total }, and totals.
export function countModel(model) {
  const rows = traceShapes(model).map((r) => ({ ...r, ...layerCounts(r.L, r.ins) }));
  const trainable = rows.reduce((a, r) => a + r.trainable, 0);
  const nonTrainable = rows.reduce((a, r) => a + r.nonTrainable, 0);
  return { rows, trainable, nonTrainable, total: trainable + nonTrainable };
}

/* The working for one layer, in words and numbers, the way the exam wants it
   written: "(784 + 1) × 300 = 235,500". `n` = toLocaleString. */
const n = (v) => Number(v).toLocaleString('en-US');
export function working(L, ins) {
  const x = ins[0];
  const cin = x[x.length - 1];
  switch (L.t) {
    case 'dense':
      return L.bias === false ? `${n(cin)} × ${n(L.units)} = ${n(cin * L.units)} (no biases)` : `(${n(cin)} + 1) × ${n(L.units)} = ${n((cin + 1) * L.units)}`;
    case 'denseT':
      return `biases only: ${n(L.units)} (the kernel is borrowed)`;
    case 'conv2d': {
      const [kh, kw] = pair(L.k);
      return `(${kh} × ${kw} × ${cin} + 1) × ${L.filters} = ${n((kh * kw * cin + 1) * L.filters)}`;
    }
    case 'conv1d':
      return `(${L.k} × ${cin} + 1) × ${L.filters} = ${n((L.k * cin + 1) * L.filters)}`;
    case 'conv2dT': {
      const [kh, kw] = pair(L.k);
      return `(${kh} × ${kw} × ${cin} + 1) × ${L.filters} = ${n((kh * kw * cin + 1) * L.filters)}`;
    }
    case 'norm':
      return `2 × ${cin} + 1 = ${n(2 * cin + 1)}, all non-trainable`;
    case 'bn':
      return `4 × ${cin} = ${n(4 * cin)} (${n(2 * cin)} trainable γ, β + ${n(2 * cin)} non-trainable)`;
    case 'simplernn': {
      const u = L.units;
      return `${u} × (${u} + ${cin}) + ${u} = ${n(u * (u + cin) + u)}`;
    }
    case 'lstm': {
      const u = L.units;
      return `4 × (${u} × (${u} + ${cin}) + ${u}) = ${n(4 * (u * (u + cin) + u))}`;
    }
    case 'gru': {
      const u = L.units;
      return L.resetAfter === false
        ? `3 × (${u} × (${u} + ${cin}) + ${u}) = ${n(3 * (u * (u + cin) + u))}`
        : `3 × (${u} × (${u} + ${cin}) + 2 × ${u}) = ${n(3 * (u * (u + cin) + 2 * u))}`;
    }
    case 'bidir': {
      const inner = layerCounts(L.layer, ins).total;
      return `2 × ${n(inner)} = ${n(2 * inner)}`;
    }
    case 'concat':
      return `0 (but the next layer sees ${ins.map((s) => s[s.length - 1]).join(' + ')} = ${ins.reduce((a, s) => a + s[s.length - 1], 0)} inputs)`;
    default:
      return '0: nothing to learn';
  }
}

// Short Keras-style names: "Dense(300)", "Conv2D(32, 7)", "GRU(20)"
export function layerName(L) {
  const k = (v) => (Array.isArray(v) ? `(${v.join(', ')})` : v);
  switch (L.t) {
    case 'dense': return `Dense(${L.units}${L.bias === false ? ', use_bias=False' : ''})`;
    case 'denseT': return `DenseTranspose(${L.units})`;
    case 'conv2d': return `Conv2D(${L.filters}, ${k(L.k)}${L.s && L.s !== 1 ? `, strides=${k(L.s)}` : ''}${L.pad === 'same' ? ', padding="same"' : ''})`;
    case 'conv1d': return `Conv1D(${L.filters}, ${L.k}${L.s && L.s !== 1 ? `, strides=${L.s}` : ''}${L.pad === 'same' ? ', padding="same"' : ''})`;
    case 'conv2dT': return `Conv2DTranspose(${L.filters}, ${k(L.k)}${L.s && L.s !== 1 ? `, strides=${k(L.s)}` : ''}${L.pad === 'same' ? ', padding="same"' : ''})`;
    case 'maxpool2d': return `MaxPool2D(${L.p && L.p !== 2 ? L.p : ''})`;
    case 'avgpool2d': return `AvgPool2D(${L.p && L.p !== 2 ? L.p : ''})`;
    case 'maxpool1d': return `MaxPool1D(${L.p && L.p !== 2 ? L.p : ''})`;
    case 'gap2d': return 'GlobalAvgPool2D()';
    case 'gap1d': return 'GlobalAvgPool1D()';
    case 'flatten': return 'Flatten()';
    case 'reshape': return `Reshape(${JSON.stringify(L.to)})`;
    case 'dropout': return `Dropout(${L.rate ?? 0.5})`;
    case 'activation': return `Activation("${L.fn ?? 'relu'}")`;
    case 'norm': return 'Normalization()';
    case 'bn': return 'BatchNormalization()';
    case 'simplernn': return `SimpleRNN(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'lstm': return `LSTM(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'gru': return `GRU(${L.units}${L.seq ? ', return_sequences=True' : ''}${L.resetAfter === false ? ', reset_after=False' : ''})`;
    case 'bidir': return `Bidirectional(${layerName(L.layer)})`;
    case 'concat': return 'Concatenate()';
    default: return L.t;
  }
}

// Which layer types have nothing to learn (the method's step 4)
export const ZERO_LAYERS = ['flatten', 'reshape', 'dropout', 'maxpool2d', 'avgpool2d', 'maxpool1d', 'gap2d', 'gap1d', 'concat', 'activation'];
