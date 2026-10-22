/* ============================================================================
   Toy English → Spanish transformer, run in plain JS (no dependencies)
   ----------------------------------------------------------------------------
   This page's own toy, NOT the slides' model. The weights in ./data/toyMT.js
   come from tools/dl-lecture8-study/toy_mt.py (Keras); this file reproduces
   that Keras model's forward pass exactly (checked against Python reference
   values by tools/dl-lecture8-study/check-toy.mjs):

     token Embedding + sinusoidal positional encoding (Géron's PositionalEncoding:
       PE[p, 2k] = sin(p / 10000^(2k/d)), PE[p, 2k+1] = cos(p / 10000^(2k/d)))
     encoder layer × N:  self-attention → Add → LayerNorm → Dense(relu) → Dense
                         → Add → LayerNorm                              (post-norm)
     decoder layer × N:  masked (causal) self-attention → Add → LayerNorm →
                         cross-attention (queries = decoder, keys/values =
                         encoder output) → Add → LayerNorm → FFN → Add → LayerNorm
     Dense(target vocab, softmax)

   Keras MultiHeadAttention: q/k/v kernels [d_model, heads, key_dim] + biases
   [heads, key_dim]; q is scaled by 1/sqrt(key_dim); scores softmaxed over keys;
   output kernel [heads, key_dim, d_model] + bias [d_model]. LayerNormalization
   uses the biased variance and epsilon 1e-3 (Keras default).

   API
     SRC_VOCAB, TGT_VOCAB, SPECIAL, GRAMMAR
     allSentences()            → every grammar sentence as English word arrays
     isValidSentence(words)    → true if the grammar can produce it
     referenceTranslation(words) → the grammar's correct Spanish (word array)
     loadToyMT()               → Promise<model> (lazy-loads ./data/toyMT.js)
     buildModel(data)          → model from an imported data module
     translate(model, words)   → greedy decoding from <sos> until <eos> (max 8):
       { out, decIn, eos, encSelf, decSelf, cross, confidence, lastProbs }
         out        Spanish words (no <sos>/<eos>)
         decIn      the decoder's input tokens in the final pass: ['<sos>', ...out]
                    (row t of decSelf / cross predicts out[t], or <eos> for the last)
         encSelf    [layer][head][query src word][key src word]
         decSelf    [layer][head][query decIn pos][key decIn pos] (0 above the diagonal)
         cross      [layer][head][query decIn pos][key src word]
         confidence [decIn pos] softmax probability of the token chosen there
         lastProbs  softmax over TGT_VOCAB at the last decoder position
       All attention weights come from the final decoding pass.
   ========================================================================== */

export const SRC_VOCAB = [
  '<pad>', 'I', 'you', 'we', 'they', 'like', 'love', 'red', 'big', 'old',
  'soccer', 'music', 'books', 'cats', 'dogs', 'movies', 'cars', 'houses',
];
export const TGT_VOCAB = [
  '<pad>', '<sos>', '<eos>', 'me', 'te', 'nos', 'les', 'gusta', 'gustan', 'encanta',
  'encantan', 'el', 'la', 'los', 'las', 'fútbol', 'música', 'libros', 'gatos', 'perros',
  'películas', 'coches', 'casas', 'rojos', 'rojas', 'grandes', 'viejos', 'viejas',
];
export const SPECIAL = { pad: 0, sos: 1, eos: 2 };

export const GRAMMAR = {
  subjects: [
    { en: 'I', es: 'me' }, { en: 'you', es: 'te' },
    { en: 'we', es: 'nos' }, { en: 'they', es: 'les' },
  ],
  // the verb takes -n when the object is plural
  verbs: [
    { en: 'like', sg: 'gusta', pl: 'gustan' },
    { en: 'love', sg: 'encanta', pl: 'encantan' },
  ],
  // singular, no adjective
  massNouns: [
    { en: 'soccer', article: 'el', es: 'fútbol' },
    { en: 'music', article: 'la', es: 'música' },
  ],
  // plural; may take ONE adjective, which goes after the noun in Spanish
  pluralNouns: [
    { en: 'books', article: 'los', es: 'libros', gender: 'm' },
    { en: 'cats', article: 'los', es: 'gatos', gender: 'm' },
    { en: 'dogs', article: 'los', es: 'perros', gender: 'm' },
    { en: 'movies', article: 'las', es: 'películas', gender: 'f' },
    { en: 'cars', article: 'los', es: 'coches', gender: 'm' },
    { en: 'houses', article: 'las', es: 'casas', gender: 'f' },
  ],
  adjectives: [
    { en: 'red', m: 'rojos', f: 'rojas' },
    { en: 'big', m: 'grandes', f: 'grandes' },
    { en: 'old', m: 'viejos', f: 'viejas' },
  ],
};

const find = (list, en) => list.find((x) => x.en === en);

/** Every sentence of the grammar, in the training script's order (208). */
export function allSentences() {
  const out = [];
  for (const s of GRAMMAR.subjects) {
    for (const v of GRAMMAR.verbs) {
      for (const n of GRAMMAR.massNouns) out.push([s.en, v.en, n.en]);
      for (const n of GRAMMAR.pluralNouns) {
        out.push([s.en, v.en, n.en]);
        for (const a of GRAMMAR.adjectives) out.push([s.en, v.en, a.en, n.en]);
      }
    }
  }
  return out;
}

function toWords(words) {
  return Array.isArray(words) ? words.slice() : String(words).trim().split(/\s+/);
}

function parse(words) {
  const w = toWords(words);
  if (w.length < 3 || w.length > 4) return null;
  const s = find(GRAMMAR.subjects, w[0]);
  const v = find(GRAMMAR.verbs, w[1]);
  if (!s || !v) return null;
  if (w.length === 3) {
    const m = find(GRAMMAR.massNouns, w[2]);
    if (m) return { s, v, m };
    const p = find(GRAMMAR.pluralNouns, w[2]);
    return p ? { s, v, p } : null;
  }
  const a = find(GRAMMAR.adjectives, w[2]);
  const p = find(GRAMMAR.pluralNouns, w[3]);
  return a && p ? { s, v, a, p } : null;
}

export function isValidSentence(words) {
  return parse(words) !== null;
}

/** The grammar's correct Spanish for an English sentence (word array), or null. */
export function referenceTranslation(words) {
  const x = parse(words);
  if (!x) return null;
  if (x.m) return [x.s.es, x.v.sg, x.m.article, x.m.es];
  const out = [x.s.es, x.v.pl, x.p.article, x.p.es];
  if (x.a) out.push(x.p.gender === 'm' ? x.a.m : x.a.f);
  return out;
}

/* ---------------------------------------------------------------- weights */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Bytes(s) {
  const lut = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) lut[B64.charCodeAt(i)] = i;
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const n = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(n);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lut[clean.charCodeAt(i)];
    const b = lut[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? lut[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? lut[clean.charCodeAt(i + 3)] : 0;
    const v = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < n) out[o++] = (v >> 16) & 255;
    if (o < n) out[o++] = (v >> 8) & 255;
    if (o < n) out[o++] = v & 255;
  }
  return out;
}

function half(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return sign * f * 2 ** -24;
  if (e === 31) return f ? NaN : sign * Infinity;
  return sign * (1 + f / 1024) * 2 ** (e - 15);
}

function positionalEncoding(maxLen, d) {
  const pe = [];
  for (let p = 0; p < maxLen; p++) {
    const row = new Float64Array(d);
    for (let k = 0; k < d / 2; k++) {
      const angle = p / 10000 ** ((2 * k) / d);
      row[2 * k] = Math.sin(angle);
      row[2 * k + 1] = Math.cos(angle);
    }
    pe.push(row);
  }
  return pe;
}

function sameList(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Build a model from the imported data module (./data/toyMT.js). */
export function buildModel(data) {
  if (!sameList(data.SRC_VOCAB, SRC_VOCAB) || !sameList(data.TGT_VOCAB, TGT_VOCAB)) {
    throw new Error('toyMT: data vocabularies differ from toyMT.js');
  }
  const bytes = base64Bytes(data.WEIGHTS);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = {};
  let off = 0;
  for (const [name, shape] of data.TENSORS) {
    const n = shape.reduce((a, b) => a * b, 1);
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = half(view.getUint16(off + 2 * i, true));
    off += 2 * n;
    t[name] = { shape, data: arr };
  }
  if (off !== bytes.length) throw new Error(`toyMT: read ${off} of ${bytes.length} weight bytes`);
  const m = data.META;
  return {
    meta: m,
    heldOut: new Set(data.HELD_OUT),
    t,
    pe: positionalEncoding(m.maxLen, m.dModel),
  };
}

let loading = null;
export function loadToyMT() {
  if (!loading) loading = import('./data/toyMT.js').then((data) => buildModel(data));
  return loading;
}

/* ---------------------------------------------------------------- forward */
function embed(model, table, ids) {
  const d = model.meta.dModel;
  const W = model.t[table].data;
  return ids.map((id, p) => {
    const row = new Float64Array(d);
    for (let c = 0; c < d; c++) row[c] = W[id * d + c] + model.pe[p][c];
    return row;
  });
}

function dense(X, W, b, relu) {
  const [nIn, nOut] = W.shape;
  return X.map((x) => {
    const y = new Float64Array(nOut);
    for (let j = 0; j < nOut; j++) {
      let s = b.data[j];
      for (let i = 0; i < nIn; i++) s += x[i] * W.data[i * nOut + j];
      y[j] = relu && s < 0 ? 0 : s;
    }
    return y;
  });
}

function addNorm(X, Y, gamma, beta, eps) {
  return X.map((x, r) => {
    const n = x.length;
    const z = new Float64Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) { z[i] = x[i] + Y[r][i]; mean += z[i]; }
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (z[i] - mean) ** 2;
    v /= n;
    const inv = 1 / Math.sqrt(v + eps);
    for (let i = 0; i < n; i++) z[i] = (z[i] - mean) * inv * gamma.data[i] + beta.data[i];
    return z;
  });
}

// project X (rows of d) with kernel [d, H, K] + bias [H, K] → [row][h][k]
function project(X, W, b, H, K) {
  const d = W.shape[0];
  return X.map((x) => {
    const out = [];
    for (let h = 0; h < H; h++) {
      const v = new Float64Array(K);
      for (let k = 0; k < K; k++) {
        let s = b.data[h * K + k];
        for (let c = 0; c < d; c++) s += x[c] * W.data[(c * H + h) * K + k];
        v[k] = s;
      }
      out.push(v);
    }
    return out;
  });
}

function mha(model, prefix, Xq, Xkv, causal) {
  const { heads: H, keyDim: K, dModel: d } = model.meta;
  const T = model.t;
  const q = project(Xq, T[`${prefix}.wq`], T[`${prefix}.bq`], H, K);
  const k = project(Xkv, T[`${prefix}.wk`], T[`${prefix}.bk`], H, K);
  const v = project(Xkv, T[`${prefix}.wv`], T[`${prefix}.bv`], H, K);
  const scale = 1 / Math.sqrt(K);
  const weights = [];   // [h][i][j]
  for (let h = 0; h < H; h++) {
    const rows = [];
    for (let i = 0; i < Xq.length; i++) {
      const s = new Array(Xkv.length).fill(-Infinity);
      let max = -Infinity;
      for (let j = 0; j < Xkv.length; j++) {
        if (causal && j > i) continue;
        let dot = 0;
        for (let c = 0; c < K; c++) dot += q[i][h][c] * scale * k[j][h][c];
        s[j] = dot;
        if (dot > max) max = dot;
      }
      let sum = 0;
      const w = s.map((x) => (x === -Infinity ? 0 : Math.exp(x - max)));
      for (const x of w) sum += x;
      rows.push(w.map((x) => x / sum));
    }
    weights.push(rows);
  }
  const Wo = T[`${prefix}.wo`].data;
  const bo = T[`${prefix}.bo`].data;
  const out = Xq.map((_, i) => {
    const y = new Float64Array(d);
    for (let e = 0; e < d; e++) y[e] = bo[e];
    for (let h = 0; h < H; h++) {
      for (let c = 0; c < K; c++) {
        let ctx = 0;
        for (let j = 0; j < Xkv.length; j++) ctx += weights[h][i][j] * v[j][h][c];
        for (let e = 0; e < d; e++) y[e] += ctx * Wo[(h * K + c) * d + e];
      }
    }
    return y;
  });
  return { out, weights };
}

function encode(model, srcIds) {
  const T = model.t;
  const eps = model.meta.epsilon;
  let Z = embed(model, 'src_emb', srcIds);
  const att = [];
  for (let l = 0; l < model.meta.layers; l++) {
    const p = `enc${l}`;
    const a = mha(model, `${p}.self`, Z, Z, false);
    att.push(a.weights);
    Z = addNorm(Z, a.out, T[`${p}.ln1.gamma`], T[`${p}.ln1.beta`], eps);
    const f = dense(dense(Z, T[`${p}.ff1.w`], T[`${p}.ff1.b`], true), T[`${p}.ff2.w`], T[`${p}.ff2.b`], false);
    Z = addNorm(Z, f, T[`${p}.ln2.gamma`], T[`${p}.ln2.beta`], eps);
  }
  return { enc: Z, att };
}

function decode(model, enc, decIds) {
  const T = model.t;
  const eps = model.meta.epsilon;
  let Z = embed(model, 'tgt_emb', decIds);
  const self = [];
  const cross = [];
  for (let l = 0; l < model.meta.layers; l++) {
    const p = `dec${l}`;
    const a = mha(model, `${p}.self`, Z, Z, true);
    self.push(a.weights);
    Z = addNorm(Z, a.out, T[`${p}.ln1.gamma`], T[`${p}.ln1.beta`], eps);
    const c = mha(model, `${p}.cross`, Z, enc, false);
    cross.push(c.weights);
    Z = addNorm(Z, c.out, T[`${p}.ln2.gamma`], T[`${p}.ln2.beta`], eps);
    const f = dense(dense(Z, T[`${p}.ff1.w`], T[`${p}.ff1.b`], true), T[`${p}.ff2.w`], T[`${p}.ff2.b`], false);
    Z = addNorm(Z, f, T[`${p}.ln3.gamma`], T[`${p}.ln3.beta`], eps);
  }
  const logits = dense(Z, T['out.w'], T['out.b'], false);
  const probs = logits.map((z) => {
    let max = -Infinity;
    for (const x of z) if (x > max) max = x;
    const e = Array.from(z, (x) => Math.exp(x - max));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / s);
  });
  return { probs, self, cross };
}

const argmax = (a) => a.reduce((best, x, i) => (x > a[best] ? i : best), 0);

/**
 * Greedy translation of an English sentence (word array or string).
 * Throws on a word that is not in SRC_VOCAB.
 */
export function translate(model, srcWords, { maxOut } = {}) {
  const words = toWords(srcWords);
  const srcIds = words.map((w) => {
    const id = SRC_VOCAB.indexOf(w);
    if (id <= 0) throw new Error(`toyMT: unknown source word "${w}"`);
    return id;
  });
  const limit = maxOut ?? model.meta.maxOut;
  const { enc, att: encSelf } = encode(model, srcIds);
  const dec = [SPECIAL.sos];
  let last;
  let eos = false;
  for (let step = 0; step < limit; step++) {
    last = decode(model, enc, dec);
    const next = argmax(last.probs[last.probs.length - 1]);
    if (next === SPECIAL.eos) { eos = true; break; }
    dec.push(next);
  }
  // when no <eos> came, the final pass is the one that produced the last word
  const passIn = eos ? dec : dec.slice(0, -1);
  return {
    out: dec.slice(1).map((id) => TGT_VOCAB[id]),
    decIn: passIn.map((id) => TGT_VOCAB[id]),
    eos,
    encSelf,
    decSelf: last.self,
    cross: last.cross,
    confidence: last.probs.map((p) => Math.max(...p)),
    lastProbs: last.probs[last.probs.length - 1],
  };
}
