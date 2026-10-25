/* ============================================================================
   CODE LAB — KERAS SHAPE AND PARAMETER RULES
   ----------------------------------------------------------------------------
   flow(spec) walks a layer spec (./specs.js) from its input(s) to its
   output(s) and returns, for every layer, its output shape, its trainable
   and non-trainable parameter counts and the rule that gives them, plus the
   totals. The "Count it" table and the "Draw it" diagram are both drawn from
   this, so nobody types a count by hand; tools/dl-codelab/verify_counts.py
   builds the same specs in TensorFlow and check-cards.mjs compares the two.

   Shapes leave out the batch axis: [28, 28] means (None, 28, 28).
   The rules are TF 2.20 / Keras 3's:
     Dense               (in + 1) × units                (in × units, no bias)
     Conv2D / Conv1D     (k_h · k_w · c_in + 1) × filters
     Conv2DTranspose     (k_h · k_w · c_in + 1) × filters
     SimpleRNN           units × (in + units + 1)
     Bidirectional       2 × the wrapped layer; outputs concatenated (2 × units)
     LSTM                4 × units × (in + units + 1)
     GRU                 3 × units × (in + units + 2)    reset_after=True adds
                                                         a second bias vector
     BatchNormalization  4 × c: γ, β trainable; the moving mean and variance
                         (2 × c) non-trainable
     LayerNormalization  2 × c (γ, β)
     Normalization       2 × c + 1 non-trainable (mean, variance, count);
                         0 when the mean and variance are passed in (constants)
     Conv1DTranspose     (k · c_in + 1) × filters
     a frozen layer      its parameters count as non-trainable
     a pretrained base   its count from Keras (BASES below; verify_counts.py
                         builds it with weights=None to check)
     Embedding           input_dim × output_dim
     MultiHeadAttention  per projection (d · h · k + h · k), output
                         (h · v · d_out + d_out)
   ========================================================================== */

const fmt = (n) => n.toLocaleString('en-US');

// Pretrained bases at their input size: output shape and parameter count, as
// Keras reports them (Project 1's notebook prints 4,269,716 for NASNetMobile;
// verify_counts.py rebuilds it). Not a rule: a lookup.
const BASES = {
  NASNetMobile: { input: [224, 224, 3], out: [7, 7, 1056], params: 4269716 },
};
const prod = (a) => a.reduce((x, y) => x * y, 1);
const pair = (v, d) => (v === undefined ? [d, d] : Array.isArray(v) ? v : [v, v]);

// output length of a convolution or pooling window along one axis
function convLen(n, k, s, pad) {
  if (n === null) return null;
  return pad === 'same' ? Math.ceil(n / s) : Math.floor((n - k) / s) + 1;
}
function deconvLen(n, k, s, pad) {
  if (n === null) return null;
  return pad === 'same' ? n * s : n * s + Math.max(k - s, 0);
}

// One layer: its output shape and parameters from its input shape(s).
// Returns { out, tr, nt, rule } (rule = the arithmetic, '' when it has none).
function apply(layer, ins) {
  const x = ins[0];
  const last = x ? x[x.length - 1] : 0;
  const t = layer.type;
  switch (t) {
    case 'Flatten':
      return { out: [prod(x)], tr: 0, nt: 0, rule: x.length > 1 ? `${x.join(' × ')} = ${fmt(prod(x))}` : '' };
    case 'Dense': {
      const bias = layer.bias !== false;
      const tr = last * layer.units + (bias ? layer.units : 0);
      return { out: [...x.slice(0, -1), layer.units], tr, nt: 0, rule: bias ? `(${fmt(last)} + 1) × ${fmt(layer.units)}` : `${fmt(last)} × ${fmt(layer.units)} (no bias)` };
    }
    case 'Normalization':
      if (layer.fixed) return { out: x, tr: 0, nt: 0, rule: 'mean, variance given: no weights' };
      return { out: x, tr: 0, nt: 2 * last + 1, rule: `2 × ${last} + 1: mean, variance, count` };
    case 'Resizing':
      return { out: [layer.height, layer.width, last], tr: 0, nt: 0, rule: '' };
    case 'Pretrained': {
      const b = BASES[layer.base];
      return { out: b.out, tr: b.params, nt: 0, rule: 'include_top=False, from Keras' };
    }
    case 'BatchNormalization':
      return { out: x, tr: 2 * last, nt: 2 * last, rule: `4 × ${last}: γ, β; moving μ, σ²` };
    case 'LayerNormalization':
      return { out: x, tr: 2 * last, nt: 0, rule: `2 × ${last} (γ, β)` };
    case 'Dropout':
    case 'GaussianNoise':
    case 'Activation':
    case 'Rescaling':
    case 'LeakyReLU':
    case 'Lambda':
      return { out: x, tr: 0, nt: 0, rule: '' };
    case 'Concatenate': {
      const w = ins.reduce((s, sh) => s + sh[sh.length - 1], 0);
      return { out: [...x.slice(0, -1), w], tr: 0, nt: 0, rule: `${ins.map((sh) => sh[sh.length - 1]).join(' + ')} = ${w}` };
    }
    case 'Add':
      return { out: x, tr: 0, nt: 0, rule: '' };
    case 'Reshape':
      return { out: layer.target, tr: 0, nt: 0, rule: '' };
    case 'Conv2D':
    case 'Conv2DTranspose': {
      const [kh, kw] = pair(layer.kernel);
      const [sh, sw] = pair(layer.strides, 1);
      const pad = layer.padding || 'valid';
      const len = t === 'Conv2D' ? convLen : deconvLen;
      const out = [len(x[0], kh, sh, pad), len(x[1], kw, sw, pad), layer.filters];
      return { out, tr: (kh * kw * last + 1) * layer.filters, nt: 0, rule: `(${kh}·${kw}·${last} + 1) × ${layer.filters}` };
    }
    case 'Conv1D':
    case 'Conv1DTranspose': {
      const k = layer.kernel;
      const s = layer.strides || 1;
      const pad = layer.padding || 'valid';
      const len = t === 'Conv1D' ? convLen(x[0], k, s, pad) : deconvLen(x[0], k, s, pad);
      return { out: [len, layer.filters], tr: (k * last + 1) * layer.filters, nt: 0, rule: `(${k}·${last} + 1) × ${layer.filters}` };
    }
    case 'MaxPool2D':
    case 'AvgPool2D': {
      const [ph, pw] = pair(layer.pool, 2);
      const [sh, sw] = pair(layer.strides ?? layer.pool, 2);
      const pad = layer.padding || 'valid';
      return { out: [convLen(x[0], ph, sh, pad), convLen(x[1], pw, sw, pad), last], tr: 0, nt: 0, rule: '' };
    }
    case 'MaxPool1D': {
      const p = layer.pool || 2;
      return { out: [convLen(x[0], p, layer.strides ?? p, layer.padding || 'valid'), last], tr: 0, nt: 0, rule: '' };
    }
    case 'GlobalAvgPool2D':
    case 'GlobalAvgPool1D':
      return { out: [last], tr: 0, nt: 0, rule: '' };
    case 'SimpleRNN':
    case 'LSTM':
    case 'GRU': {
      const u = layer.units;
      const out = layer.returnSeq ? [x[0], u] : [u];
      if (t === 'SimpleRNN') return { out, tr: u * (last + u + 1), nt: 0, rule: `${u} × (${last} + ${u} + 1)` };
      if (t === 'LSTM') return { out, tr: 4 * u * (last + u + 1), nt: 0, rule: `4 × ${u} × (${last} + ${u} + 1)` };
      return { out, tr: 3 * u * (last + u + 2), nt: 0, rule: `3 × ${u} × (${last} + ${u} + 2)` };
    }
    case 'Bidirectional': {
      const inner = apply(layer.layer, ins);
      const out = [...inner.out.slice(0, -1), inner.out[inner.out.length - 1] * 2];
      return { out, tr: 2 * inner.tr, nt: 2 * inner.nt, rule: `2 × ${inner.rule}` };
    }
    case 'TimeDistributed': {
      const inner = apply(layer.layer, [x.slice(1)]);
      return { out: [x[0], ...inner.out], tr: inner.tr, nt: inner.nt, rule: inner.rule };
    }
    case 'RepeatVector':
      return { out: [layer.n, last], tr: 0, nt: 0, rule: '' };
    case 'Embedding':
      return { out: [...x, layer.dim], tr: layer.vocab * layer.dim, nt: 0, rule: `${fmt(layer.vocab)} × ${layer.dim}` };
    case 'MultiHeadAttention': {
      const h = layer.heads;
      const k = layer.keyDim;
      const q = ins[0][ins[0].length - 1];
      const v = (ins[1] || ins[0])[(ins[1] || ins[0]).length - 1];
      const proj = (d) => d * h * k + h * k;
      const tr = proj(q) + proj(v) + proj(v) + (h * k * q + q);
      return { out: ins[0], tr, nt: 0, rule: `3 × (${q}·${h}·${k} + ${h}·${k}) + (${h}·${k}·${q} + ${q})` };
    }
    case 'Sampling':
      return { out: x, tr: 0, nt: 0, rule: '' };
    default:
      throw new Error(`counts.js: no rule for layer type ${t}`);
  }
}

// The layer's display name, e.g. "Dense 300, relu" or "Conv2D 64, 7×7, same".
export function layerName(l) {
  const act = l.act ? `, ${l.act}` : '';
  switch (l.type) {
    case 'Dense': return `Dense ${l.units}${act}`;
    case 'Conv2D':
    case 'Conv2DTranspose': {
      const [kh, kw] = pair(l.kernel);
      const s = l.strides && l.strides !== 1 ? `, stride ${Array.isArray(l.strides) ? l.strides.join('×') : l.strides}` : '';
      return `${l.type} ${l.filters}, ${kh}×${kw}${s}${l.padding === 'same' ? ', same' : ''}${act}`;
    }
    case 'Conv1D': return `Conv1D ${l.filters}, k=${l.kernel}${l.strides && l.strides !== 1 ? `, stride ${l.strides}` : ''}${l.padding === 'same' ? ', same' : ''}${act}`;
    case 'MaxPool2D':
    case 'AvgPool2D': return `${l.type}${l.pool ? ` ${Array.isArray(l.pool) ? l.pool.join('×') : `${l.pool}×${l.pool}`}` : ''}`;
    case 'SimpleRNN':
    case 'LSTM':
    case 'GRU': return `${l.type} ${l.units}${l.returnSeq ? ', seq' : ''}${act}`;
    case 'Dropout': return `Dropout ${l.rate}`;
    case 'GaussianNoise': return `GaussianNoise ${l.stddev}`;
    case 'TimeDistributed': return `TimeDistributed(${layerName(l.layer)})`;
    case 'Bidirectional': return `Bidirectional(${layerName(l.layer)})`;
    case 'RepeatVector': return `RepeatVector ${l.n}`;
    case 'Embedding': return `Embedding ${l.vocab}→${l.dim}`;
    case 'MultiHeadAttention': return `MultiHeadAttention ${l.heads}×${l.keyDim}`;
    case 'Rescaling': return `Rescaling ×${l.scale}${l.offset ? `, ${l.offset > 0 ? '+' : '−'}${Math.abs(l.offset)}` : ''}`;
    case 'Resizing': return `Resizing ${l.height}×${l.width}`;
    case 'Pretrained': return `${l.base}${l.frozen ? ' (frozen)' : ''}`;
    case 'Conv1DTranspose': return `Conv1DTranspose ${l.filters}, k=${l.kernel}${l.strides && l.strides !== 1 ? `, stride ${l.strides}` : ''}${l.padding === 'same' ? ', same' : ''}${act}`;
    case 'BatchNormalization': return 'BatchNorm';
    case 'Reshape': return `Reshape [${l.target.join(', ')}]`;
    case 'Activation': return `Activation ${l.act}`;
    default: return `${l.type}${act}`;
  }
}

export const shapeStr = (sh) => `(None, ${sh.map((d) => (d === null ? 'None' : d)).join(', ')})`;

// Walk the spec. Layers run in order; a layer reads `from` (an id or a list
// of ids), or the previous layer when it has none.
export function flow(spec) {
  const shapes = {};
  const rows = [];
  (spec.inputs || []).forEach((inp) => {
    shapes[inp.id] = inp.shape;
    rows.push({ id: inp.id, name: inp.label || 'Input', type: 'Input', group: inp.group, from: [], out: inp.shape, tr: 0, nt: 0, rule: '' });
  });
  let prev = spec.inputs?.[spec.inputs.length - 1]?.id;
  spec.layers.forEach((l, i) => {
    const id = l.id || `l${i}`;
    const from = l.from === undefined ? [prev] : Array.isArray(l.from) ? l.from : [l.from];
    const ins = from.map((f) => {
      if (!(f in shapes)) throw new Error(`counts.js: ${spec.id} layer ${id} reads unknown ${f}`);
      return shapes[f];
    });
    const r = apply(l, ins);
    if (l.frozen) {
      r.nt += r.tr;
      r.rule = `${r.rule}${r.rule ? ', ' : ''}frozen`;
      r.tr = 0;
    }
    shapes[id] = r.out;
    rows.push({ id, name: l.label || layerName(l), type: l.type, group: l.group, from, state: l.state, frozen: !!l.frozen, out: r.out, tr: r.tr, nt: r.nt, rule: r.rule, act: l.act });
    prev = id;
  });
  const tr = rows.reduce((s, r) => s + r.tr, 0);
  const nt = rows.reduce((s, r) => s + r.nt, 0);
  const outputs = spec.outputs || [prev];
  return { rows, tr, nt, total: tr + nt, outputs, shapes };
}

export { fmt };
