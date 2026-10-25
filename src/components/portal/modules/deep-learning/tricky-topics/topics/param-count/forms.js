import { countModel, layerName, working } from '../../maths/paramRules.js';
import { showShape, prod } from '../../maths/shapeRules.js';

/* ============================================================================
   TOPIC 1 · ONE MODEL, FIVE DISGUISES — the text forms
   ----------------------------------------------------------------------------
   The exam hands over a model as code, a diagram, a model.summary() with
   gaps, a sentence or a set of equations. These turn one model (the
   shapeRules.js vocabulary) into each text form; FormView.jsx draws them
   (the diagram is drawn there). Used by the "five disguises" lab and the
   drill, so the per-layer table underneath is always the same countModel().
   ========================================================================== */

const fmt = (v) => Number(v).toLocaleString('en-US');
const kArg = (k) => (Array.isArray(k) ? `(${k.join(', ')})` : String(k));

function kerasLayer(L) {
  const p = 'tf.keras.layers.';
  switch (L.t) {
    case 'dense': return `${p}Dense(${L.units}${L.act ? `, activation="${L.act}"` : ''}${L.bias === false ? ', use_bias=False' : ''})`;
    case 'conv2d': return `${p}Conv2D(${L.filters}, kernel_size=${kArg(L.k)}${L.s && L.s !== 1 ? `, strides=${kArg(L.s)}` : ''}${L.pad === 'same' ? ', padding="same"' : ''}, activation="relu")`;
    case 'conv1d': return `${p}Conv1D(filters=${L.filters}, kernel_size=${L.k}${L.s && L.s !== 1 ? `, strides=${L.s}` : ''}${L.pad === 'same' ? ', padding="same"' : ''}, activation="relu")`;
    case 'conv2dT': return `${p}Conv2DTranspose(${L.filters}, kernel_size=${kArg(L.k)}${L.s && L.s !== 1 ? `, strides=${kArg(L.s)}` : ''}${L.pad === 'same' ? ', padding="same"' : ''})`;
    case 'maxpool2d': return `${p}MaxPool2D(${L.p && L.p !== 2 ? `pool_size=${L.p}` : ''})`;
    case 'avgpool2d': return `${p}AvgPool2D(${L.p && L.p !== 2 ? `pool_size=${L.p}` : ''})`;
    case 'maxpool1d': return `${p}MaxPool1D(${L.p && L.p !== 2 ? `pool_size=${L.p}` : ''})`;
    case 'gap2d': return `${p}GlobalAvgPool2D()`;
    case 'gap1d': return `${p}GlobalAvgPool1D()`;
    case 'flatten': return `${p}Flatten()`;
    case 'reshape': return `${p}Reshape(${JSON.stringify(L.to)})`;
    case 'dropout': return `${p}Dropout(${L.rate ?? 0.5})`;
    case 'activation': return `${p}Activation("${L.fn ?? 'relu'}")`;
    case 'norm': return `${p}Normalization()`;
    case 'bn': return `${p}BatchNormalization()`;
    case 'simplernn': return `${p}SimpleRNN(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'lstm': return `${p}LSTM(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'gru': return `${p}GRU(${L.units}${L.seq ? ', return_sequences=True' : ''}${L.resetAfter === false ? ', reset_after=False' : ''})`;
    case 'bidir': return `${p}Bidirectional(${kerasLayer(L.layer)})`;
    default: return `${p}${layerName(L)}`;
  }
}

const isSeq = (model) => model.input.length === 2 && model.layers.some((L) => ['simplernn', 'lstm', 'gru', 'bidir', 'conv1d'].includes(L.t));

// Python a student would be shown (Sequential, or the functional API when a
// Concatenate needs it). `name` labels it as generated.
export function kerasCode(model) {
  const shape = isSeq(model) ? `[None, ${model.input[1]}]` : `[${model.input.join(', ')}]`;
  if (!model.layers.some((L) => L.t === 'concat')) {
    const lines = model.layers.map((L) => `    ${kerasLayer(L)},`);
    return ['model = tf.keras.Sequential([', `    tf.keras.layers.InputLayer(shape=${shape}),`, ...lines, '])'].join('\n').replace(/,\n\]\)$/, '\n])');
  }
  // functional: name each layer by its id (or l1, l2 …)
  const names = model.layers.map((L, i) => L.id ?? `x${i + 1}`);
  const out = [`input_ = tf.keras.layers.Input(shape=${shape})`];
  let prev = 'input_';
  model.layers.forEach((L, i) => {
    if (L.t === 'concat') out.push(`${names[i]} = tf.keras.layers.Concatenate()([${L.in.join(', ')}])`);
    else out.push(`${names[i]} = ${kerasLayer(L)}(${prev})`);
    prev = names[i];
  });
  out.push(`model = tf.keras.Model(inputs=[input_], outputs=[${prev}])`);
  return out.join('\n');
}

// summary() rows: [name, output shape, params] (params = trainable + non-trainable)
export function summaryRows(model) {
  const { rows, trainable, nonTrainable, total } = countModel(model);
  return {
    rows: rows.map((r) => ({ name: layerName(r.L), out: showShape(r.out), params: r.total, trainable: r.trainable, nonTrainable: r.nonTrainable, L: r.L, ins: r.ins })),
    trainable,
    nonTrainable,
    total,
  };
}

function describeInput(model) {
  const s = model.input;
  if (s.length === 1) return `vectors of ${s[0]} features`;
  if (isSeq(model)) return `sequences of ${s[1]}-dimensional inputs`;
  if (s.length === 2) return `${s[0]} × ${s[1]} grayscale images`;
  return `${s[0]} × ${s[1]} images with ${s[2] === 3 ? '3 colour channels (RGB)' : `${s[2]} channel${s[2] > 1 ? 's' : ''}`}`;
}

function describeLayer(L) {
  const k = Array.isArray(L.k) ? `${L.k[0]} × ${L.k[1]}` : `${L.k} × ${L.k}`;
  switch (L.t) {
    case 'dense': return `a dense layer of ${L.units} neuron${L.units > 1 ? 's' : ''}${L.bias === false ? ' with no biases' : ''}`;
    case 'conv2d': return `${L.filters} filters of ${k}${L.s && L.s !== 1 ? ` with stride ${L.s}` : ''}${L.pad === 'same' ? ' and “same” padding' : ''}`;
    case 'conv1d': return `a 1D convolution with ${L.filters} kernels of size ${L.k}${L.s && L.s !== 1 ? `, stride ${L.s}` : ''}`;
    case 'conv2dT': return `a transposed convolution with ${L.filters} filters of ${k}${L.s && L.s !== 1 ? `, stride ${L.s}` : ''}`;
    case 'maxpool2d': case 'avgpool2d': return `${L.p && L.p !== 2 ? `${L.p} × ${L.p}` : '2 × 2'} ${L.t === 'maxpool2d' ? 'max' : 'average'} pooling`;
    case 'maxpool1d': return 'max pooling over pairs of time steps';
    case 'gap2d': case 'gap1d': return 'global average pooling';
    case 'flatten': return 'a flatten step';
    case 'dropout': return `dropout (rate ${L.rate ?? 0.5})`;
    case 'bn': return 'batch normalization';
    case 'norm': return 'a normalization layer';
    case 'simplernn': return `a simple RNN layer of ${L.units} neurons${L.seq ? ' (returning every time step)' : ''}`;
    case 'lstm': return `an LSTM layer of ${L.units} units${L.seq ? ' (returning every time step)' : ''}`;
    case 'gru': return `a GRU layer of ${L.units} units${L.seq ? ' (returning every time step)' : ''}`;
    case 'bidir': return `a bidirectional ${describeLayer(L.layer).replace(/^an? /, '')}`;
    case 'concat': return 'a concatenation of the normalized inputs with the hidden layer’s outputs';
    default: return layerName(L);
  }
}

export function sentence(model) {
  const parts = model.layers.map(describeLayer);
  const last = parts.pop();
  return `The network takes ${describeInput(model)}. It applies ${parts.length ? `${parts.join(', then ')}, and finally ` : ''}${last}.`;
}

/* Equations (Lecture 4's row-vector notation for a recurrent layer; the
   same notation for Dense layers). Only for models made of Dense and one
   SimpleRNN — the drill asks for this form only then. */
export function equationsOk(model) {
  const ts = model.layers.map((L) => L.t);
  if (ts[0] === 'simplernn') return isSeq(model) && ts.slice(1).every((t) => t === 'dense');
  return model.input.length === 1 && ts.every((t) => t === 'dense');
}

// Row vectors throughout, as the slides write them (L1 slide 8: XW + bᵀ;
// L4 slide 9: hᵀ₍ₜ₎ = φ(hᵀ₍ₜ₋₁₎W_h + xᵀ₍ₜ₎W_x + b_hᵀ)). Only the vector sizes
// are given, as on L4 slide 10: the matrix sizes are for the student.
export function equations(model) {
  const rows = countModel(model).rows;
  const lines = [];
  let prev = '\\mathbf{x}';
  rows.forEach((r, i) => {
    const nIn = r.ins[0][r.ins[0].length - 1];
    const last = i === rows.length - 1;
    if (r.L.t === 'simplernn') {
      lines.push(`\\mathbf{h}_{(t)}^{\\top} = \\tanh\\left(\\mathbf{h}_{(t-1)}^{\\top}\\mathbf{W}_h + \\mathbf{x}_{(t)}^{\\top}\\mathbf{W}_x + \\mathbf{b}_h^{\\top}\\right), \\quad \\mathbf{x}_{(t)} \\in \\mathbb{R}^{${nIn}}, \\; \\mathbf{h}_{(t)} \\in \\mathbb{R}^{${r.L.units}}`);
      prev = '\\mathbf{h}_{(t)}';
      return;
    }
    const out = last ? '\\hat{\\mathbf{y}}' : `\\mathbf{h}_{${i + 1}}`;
    const W = prev === '\\mathbf{h}_{(t)}' && last ? '\\mathbf{W}_y' : `\\mathbf{W}_{${i + 1}}`;
    const b = prev === '\\mathbf{h}_{(t)}' && last ? '\\mathbf{b}_y' : `\\mathbf{b}_{${i + 1}}`;
    const body = `${prev}^{\\top}${W} + ${b}^{\\top}`;
    lines.push(`${out}^{\\top} = ${last ? body : `\\text{ReLU}\\left(${body}\\right)`}, \\quad ${prev} \\in \\mathbb{R}^{${nIn}}, \\; ${out} \\in \\mathbb{R}^{${r.L.units}}`);
    prev = out;
  });
  return lines;
}

// The working, one line per layer with parameters, and the total line.
export function workingLines(model) {
  const { rows, trainable, nonTrainable } = countModel(model);
  const lines = rows.map((r) => `\`${layerName(r.L)}\`: ${working(r.L, r.ins)}`);
  lines.push(`**Total: ${fmt(trainable + nonTrainable)}**${nonTrainable ? ` = ${fmt(trainable)} trainable + ${fmt(nonTrainable)} non-trainable` : ''}`);
  return lines;
}

export const inputSize = (model) => prod(model.input);
