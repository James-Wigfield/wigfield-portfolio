import { convOut, poolOut, convTOut } from './strideRules.js';

/* ============================================================================
   TRICKY TOPICS — SHAPES THROUGH A MODEL (shared maths)
   ----------------------------------------------------------------------------
   A model here is plain data — the same vocabulary for the labs, the drills
   and tools/dl-tricky-topics/verify_counts.py (which builds each one in
   Keras and compares):

     { input: [..shape without the batch axis..], layers: [layer, …] }

   A layer is { t, …args, id?, in? } — `in` names earlier layers' ids when
   the model isn't a straight line (Concatenate); otherwise a layer takes the
   previous layer's output.

     t            args                                   Keras
     dense        units, bias=true                       Dense
     conv2d       filters, k (n or [kh, kw]), s=1,       Conv2D
                  pad='valid', bias=true
     conv1d       filters, k, s=1, pad='valid'           Conv1D
     conv2dT      filters, k, s=1, pad='valid'           Conv2DTranspose
     maxpool2d    p=2, s=p, pad='valid'  (avgpool2d)     MaxPool2D / AvgPool2D
     maxpool1d    p=2, s=p, pad='valid'                  MaxPool1D
     gap2d / gap1d                                       GlobalAvgPool2D / 1D
     flatten · reshape (to) · dropout · activation       (no parameters)
     norm                                                Normalization
     bn                                                  BatchNormalization
     simplernn / lstm / gru   units, seq=false,          SimpleRNN / LSTM / GRU
                              resetAfter=true (gru)
     bidir        layer: {simplernn|lstm|gru …}          Bidirectional
     concat       in: [idA, idB]                         Concatenate
     denseT       units, tied: id of the Dense it        DenseTranspose (L5)
                  borrows its kernel from
   Any layer may carry frozen: true (layer.trainable = False).

   Shapes never include the batch axis; printing adds None (as summary()
   does) — see showShape().
   ========================================================================== */

export const prod = (xs) => xs.reduce((a, b) => a * b, 1);
const pair = (k) => (Array.isArray(k) ? k : [k, k]);

// The output shape of one layer, given the shapes of its inputs.
export function layerOut(L, ins) {
  const x = ins[0];
  const last = x[x.length - 1];
  switch (L.t) {
    case 'dense':
    case 'denseT':
      return [...x.slice(0, -1), L.units];
    case 'flatten':
      return [prod(x)];
    case 'reshape':
      return [...L.to];
    case 'dropout':
    case 'activation':
    case 'bn':
    case 'norm':
      return [...x];
    case 'conv2d': {
      const [kh, kw] = pair(L.k);
      const [sh, sw] = pair(L.s ?? 1);
      return [convOut(x[0], kh, sh, L.pad ?? 'valid'), convOut(x[1], kw, sw, L.pad ?? 'valid'), L.filters];
    }
    case 'conv1d':
      return [convOut(x[0], L.k, L.s ?? 1, L.pad ?? 'valid'), L.filters];
    case 'conv2dT': {
      const [kh, kw] = pair(L.k);
      const [sh, sw] = pair(L.s ?? 1);
      return [convTOut(x[0], kh, sh, L.pad ?? 'valid'), convTOut(x[1], kw, sw, L.pad ?? 'valid'), L.filters];
    }
    case 'maxpool2d':
    case 'avgpool2d': {
      const [ph, pw] = pair(L.p ?? 2);
      const [sh, sw] = pair(L.s ?? L.p ?? 2);
      return [poolOut(x[0], ph, sh, L.pad ?? 'valid'), poolOut(x[1], pw, sw, L.pad ?? 'valid'), last];
    }
    case 'maxpool1d':
      return [poolOut(x[0], L.p ?? 2, L.s ?? L.p ?? 2, L.pad ?? 'valid'), last];
    case 'gap2d':
    case 'gap1d':
      return [last];
    case 'concat':
      return [...x.slice(0, -1), ins.reduce((a, s) => a + s[s.length - 1], 0)];
    case 'simplernn':
    case 'lstm':
    case 'gru':
      return L.seq ? [x[0], L.units] : [L.units];
    case 'bidir': {
      const inner = layerOut(L.layer, ins);
      return [...inner.slice(0, -1), inner[inner.length - 1] * 2];
    }
    default:
      throw new Error(`shapeRules: unknown layer type ${L.t}`);
  }
}

// Walk a model: every layer's input and output shape, in order.
export function traceShapes(model) {
  const byId = {};
  let prev = [...model.input];
  return model.layers.map((L, i) => {
    const ins = L.in ? (Array.isArray(L.in) ? L.in : [L.in]).map((id) => (id === 'input' ? model.input : byId[id])) : [prev];
    const out = layerOut(L, ins);
    if (L.id) byId[L.id] = out;
    prev = out;
    return { i, L, ins, out };
  });
}

// (None, 28, 28, 1) — the batch axis written as None, the way summary() does
export const showShape = (shape, batch = 'None') => `(${[batch, ...shape].join(', ')})`;
export const showTuple = (shape) => (shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`);

/* The unit's data conventions (the shapes topic draws them; receipts in its
   topic.js). Axis roles match the page's axis colours (stage.css). */
export const AXES = {
  batch: { role: 'batch', name: 'batch' },
  h: { role: 'h', name: 'height (rows)' },
  w: { role: 'wd', name: 'width (columns)' },
  c: { role: 'c', name: 'channels' },
  t: { role: 't', name: 'time steps' },
  f: { role: 'f', name: 'features' },
};
