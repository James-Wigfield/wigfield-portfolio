"""
DL LECTURE 8 STUDY - tiny toy English->Spanish transformer (this page's own toy)
-------------------------------------------------------------------------------
  python -I tools/dl-lecture8-study/toy_mt.py --cache <dir> --train \
         [--d-model 32] [--heads 2] [--ffn 64] [--layers 1] [--dropout 0.0] \
         [--lr 0.001] [--epochs 400] [--tag NAME]
  python -I tools/dl-lecture8-study/toy_mt.py --cache <dir> --export [--tag NAME] \
         --out src/components/portal/modules/deep-learning/lecture8-study/data \
         --fixtures tools/dl-lecture8-study/toy-fixtures.json [--date YYYY-MM-DD]

NOT the slides' model: a tiny encoder-decoder transformer trained here so the page
can show every head's attention weights live in the browser
(lecture8-study/toyMT.js runs it in plain JS; tools/dl-lecture8-study/check-toy.mjs
checks the JS against the reference values this script dumps).

Task: a tiny English -> Spanish grammar that includes the slides' running example
"I like soccer" -> "me gusta el fútbol":
  subject {I->me, you->te, we->nos, they->les}
  + verb {like->gusta/gustan, love->encanta/encantan} (-n with a plural object)
  + object: mass noun {soccer->el fútbol, music->la música}
            or plural noun {books->los libros, cats->los gatos, dogs->los perros,
            movies->las películas, cars->los coches, houses->las casas}, optionally
            preceded by ONE adjective {red->rojos/rojas, big->grandes,
            old->viejos/viejas} that moves AFTER the noun and agrees in gender
            ("we love old movies" -> "nos encantan las películas viejas").
  4 x 2 x (2 + 6 x 4) = 208 pairs. HELD_OUT_N of them (never "I like soccer") are
  held out with numpy default_rng(SEED) and never trained on.

Model (Geron's Figure 16-8 shape, post-norm: sublayer -> Add -> LayerNormalization):
  token Embedding (no sqrt(d) scaling, as Geron's code) + sinusoidal positional
  encodings computed as Geron's PositionalEncoding class (base 10_000,
  PE[p, 2k] = sin(p / 10_000 ** (2k / d)), PE[p, 2k+1] = cos(same)),
  N encoder layers (self-attention, FFN Dense(ffn, relu) -> Dense(d)),
  N decoder layers (masked causal self-attention, cross-attention with queries from
  the decoder and keys/values from the encoder output, FFN), Dense(tgt vocab,
  softmax). Attention = tf.keras.layers.MultiHeadAttention(heads, key_dim=d/heads).
  LayerNormalization epsilon = Keras default 1e-3. Special tokens: <pad>=0, <sos>,
  <eos>. Source padding is masked in encoder self- and cross-attention.

Training: Adam, sparse categorical cross-entropy on the decoder outputs with the
padding weighted 0, batch 16, seeds tf.keras.utils.set_random_seed(SEED) + op
determinism. After training, every weight is rounded to float16 and written back;
accuracy and the fixtures are computed from those rounded weights, which is what
the browser gets (base64 float16, little-endian).

Published run (2026-10-22, CPU, tag "a"): d_model 32, 2 heads, FFN 64, N = 1, dropout 0,
Adam(1e-3), 300 epochs, 23,772 parameters; exact match 182/182 trained and 26/26 held
out, the same with float16 weights. Keras warns "You are using a softmax over axis 3 of a
tensor of shape (B, 2, 1, 1)" on the first decoding step (one decoder position, so the
causal self-attention has a single key and its weight is 1); that is expected.
"""
import argparse
import base64
import datetime as dt
import json
import os
import platform
import sys
import time
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

SEED = 42
HELD_OUT_N = 26          # 12.5 % of 208
MAX_LEN = 16             # positional-encoding table length (sentences are <= 6)
MAX_OUT = 8              # greedy decoding stops after this many tokens
SCRIPT_PATH = "tools/dl-lecture8-study/toy_mt.py"

SUBJECTS = [("I", "me"), ("you", "te"), ("we", "nos"), ("they", "les")]
VERBS = [("like", "gusta", "gustan"), ("love", "encanta", "encantan")]
MASS = [("soccer", "el", "fútbol"), ("music", "la", "música")]
PLURAL = [("books", "los", "libros", "m"), ("cats", "los", "gatos", "m"),
          ("dogs", "los", "perros", "m"), ("movies", "las", "películas", "f"),
          ("cars", "los", "coches", "m"), ("houses", "las", "casas", "f")]
ADJ = [("red", "rojos", "rojas"), ("big", "grandes", "grandes"), ("old", "viejos", "viejas")]

SRC_VOCAB = (["<pad>"] + [s[0] for s in SUBJECTS] + [v[0] for v in VERBS] + [a[0] for a in ADJ]
             + [m[0] for m in MASS] + [p[0] for p in PLURAL])
TGT_VOCAB = (["<pad>", "<sos>", "<eos>"] + [s[1] for s in SUBJECTS]
             + [w for v in VERBS for w in v[1:]] + ["el", "la", "los", "las"]
             + [m[2] for m in MASS] + [p[2] for p in PLURAL]
             + list(dict.fromkeys(w for a in ADJ for w in a[1:])))
SOS, EOS = TGT_VOCAB.index("<sos>"), TGT_VOCAB.index("<eos>")


# ------------------------------------------------------------- grammar -----
def all_pairs():
    pairs = []
    for s_en, s_es in SUBJECTS:
        for v_en, v_sg, v_pl in VERBS:
            for n_en, art, n_es in MASS:
                pairs.append(([s_en, v_en, n_en], [s_es, v_sg, art, n_es]))
            for n_en, art, n_es, g in PLURAL:
                pairs.append(([s_en, v_en, n_en], [s_es, v_pl, art, n_es]))
                for a_en, a_m, a_f in ADJ:
                    pairs.append(([s_en, v_en, a_en, n_en],
                                  [s_es, v_pl, art, n_es, a_m if g == "m" else a_f]))
    return pairs


def split_pairs(pairs):
    rng = np.random.default_rng(SEED)
    keep = [i for i, (en, _) in enumerate(pairs) if en != ["I", "like", "soccer"]]
    held = sorted(rng.choice(keep, size=HELD_OUT_N, replace=False).tolist())
    train = [i for i in range(len(pairs)) if i not in set(held)]
    return train, held


def encode(pairs, idx):
    S = max(len(pairs[i][0]) for i in idx)
    T = max(len(pairs[i][1]) for i in idx) + 1
    src = np.zeros((len(idx), S), np.int32)
    dec_in = np.zeros((len(idx), T), np.int32)
    dec_out = np.zeros((len(idx), T), np.int32)
    for r, i in enumerate(idx):
        en, es = pairs[i]
        src[r, :len(en)] = [SRC_VOCAB.index(w) for w in en]
        ids = [TGT_VOCAB.index(w) for w in es]
        dec_in[r, :len(ids) + 1] = [SOS] + ids
        dec_out[r, :len(ids) + 1] = ids + [EOS]
    return src, dec_in, dec_out


# --------------------------------------------------------------- model -----
def positional_encoding(max_length, embed_size):
    # Geron's PositionalEncoding class, ch.16 (3rd ed.)
    assert embed_size % 2 == 0, "embed_size must be even"
    p, i = np.meshgrid(np.arange(max_length), 2 * np.arange(embed_size // 2))
    pos_emb = np.empty((1, max_length, embed_size))
    pos_emb[0, :, ::2] = np.sin(p / 10_000 ** (i / embed_size)).T
    pos_emb[0, :, 1::2] = np.cos(p / 10_000 ** (i / embed_size)).T
    return pos_emb.astype(np.float32)


class ToyTransformer(tf.keras.Model):
    def __init__(self, n_src, n_tgt, d_model, heads, ffn, n_layers, dropout, **kw):
        super().__init__(**kw)
        L = tf.keras.layers
        self.cfg = dict(d_model=d_model, heads=heads, ffn=ffn, n_layers=n_layers, dropout=dropout)
        kd = d_model // heads
        self.src_emb = L.Embedding(n_src, d_model, name="src_emb")
        self.tgt_emb = L.Embedding(n_tgt, d_model, name="tgt_emb")
        self.pe = tf.constant(positional_encoding(MAX_LEN, d_model))
        mk = lambda n: L.MultiHeadAttention(heads, kd, dropout=dropout, name=n)  # noqa: E731
        ln = lambda n: L.LayerNormalization(name=n)  # noqa: E731  epsilon default 1e-3
        self.e_att = [mk(f"enc{i}_self") for i in range(n_layers)]
        self.e_ln1 = [ln(f"enc{i}_ln1") for i in range(n_layers)]
        self.e_ff1 = [L.Dense(ffn, activation="relu", name=f"enc{i}_ff1") for i in range(n_layers)]
        self.e_ff2 = [L.Dense(d_model, name=f"enc{i}_ff2") for i in range(n_layers)]
        self.e_ln2 = [ln(f"enc{i}_ln2") for i in range(n_layers)]
        self.d_att = [mk(f"dec{i}_self") for i in range(n_layers)]
        self.d_ln1 = [ln(f"dec{i}_ln1") for i in range(n_layers)]
        self.d_x = [mk(f"dec{i}_cross") for i in range(n_layers)]
        self.d_ln2 = [ln(f"dec{i}_ln2") for i in range(n_layers)]
        self.d_ff1 = [L.Dense(ffn, activation="relu", name=f"dec{i}_ff1") for i in range(n_layers)]
        self.d_ff2 = [L.Dense(d_model, name=f"dec{i}_ff2") for i in range(n_layers)]
        self.d_ln3 = [ln(f"dec{i}_ln3") for i in range(n_layers)]
        self.drop = L.Dropout(dropout)
        self.out = L.Dense(n_tgt, activation="softmax", name="out")

    def call(self, inputs, training=False, return_attention=False):
        src, tgt = inputs
        S, T = tf.shape(src)[1], tf.shape(tgt)[1]
        src_mask = tf.not_equal(src, 0)[:, tf.newaxis, :]                    # (B, 1, S)
        tgt_pad = tf.not_equal(tgt, 0)[:, tf.newaxis, :]                     # (B, 1, T)
        causal = tf.linalg.band_part(tf.ones((T, T), tf.bool), -1, 0)[tf.newaxis]
        dec_mask = tf.logical_and(causal, tgt_pad)
        enc_w, dself_w, cross_w = [], [], []
        Z = self.drop(self.src_emb(src) + self.pe[:, :S], training=training)
        for i in range(len(self.e_att)):
            skip = Z
            Z, w = self.e_att[i](Z, Z, attention_mask=src_mask, return_attention_scores=True,
                                 training=training)
            Z = self.e_ln1[i](Z + skip)
            skip = Z
            Z = self.drop(self.e_ff2[i](self.e_ff1[i](Z)), training=training)
            Z = self.e_ln2[i](Z + skip)
            enc_w.append(w)
        enc_out = Z
        Z = self.drop(self.tgt_emb(tgt) + self.pe[:, :T], training=training)
        for i in range(len(self.d_att)):
            skip = Z
            Z, w = self.d_att[i](Z, Z, attention_mask=dec_mask, return_attention_scores=True,
                                 training=training)
            Z = self.d_ln1[i](Z + skip)
            dself_w.append(w)
            skip = Z
            Z, w = self.d_x[i](Z, enc_out, attention_mask=src_mask, return_attention_scores=True,
                               training=training)
            Z = self.d_ln2[i](Z + skip)
            cross_w.append(w)
            skip = Z
            Z = self.drop(self.d_ff2[i](self.d_ff1[i](Z)), training=training)
            Z = self.d_ln3[i](Z + skip)
        probs = self.out(Z)
        if return_attention:
            return probs, enc_w, dself_w, cross_w
        return probs


def build(n_layers, d_model, heads, ffn, dropout):
    model = ToyTransformer(len(SRC_VOCAB), len(TGT_VOCAB), d_model, heads, ffn, n_layers, dropout)
    model((np.ones((1, 4), np.int32), np.ones((1, 6), np.int32)))
    return model


# -------------------------------------------------------------- decode -----
def greedy_batch(model, src):
    B = len(src)
    dec = np.full((B, 1), SOS, np.int32)
    done = np.zeros(B, bool)
    for _ in range(MAX_OUT):
        p = model((src, dec), training=False).numpy()
        nxt = p[:, -1].argmax(-1).astype(np.int32)
        nxt[done] = 0
        dec = np.concatenate([dec, nxt[:, None]], axis=1)
        done |= nxt == EOS
        if done.all():
            break
    outs = []
    for row in dec[:, 1:]:
        words = []
        for t in row:
            if t in (EOS, 0):
                break
            words.append(TGT_VOCAB[t])
        outs.append(words)
    return outs


def exact_match(model, pairs, idx):
    src, _, _ = encode(pairs, idx)
    outs = greedy_batch(model, src)
    ok = [o == pairs[i][1] for o, i in zip(outs, idx)]
    return float(np.mean(ok)), [(" ".join(pairs[i][0]), " ".join(o)) for o, i, k in zip(outs, idx, ok) if not k]


def greedy_single(model, en):
    src = np.array([[SRC_VOCAB.index(w) for w in en]], np.int32)
    dec = [SOS]
    for _ in range(MAX_OUT):
        p, ew, dw, cw = model((src, np.array([dec], np.int32)), training=False, return_attention=True)
        nxt = int(p.numpy()[0, -1].argmax())
        last = dict(probs=p.numpy()[0], enc=[w.numpy()[0] for w in ew],
                    dself=[w.numpy()[0] for w in dw], cross=[w.numpy()[0] for w in cw], dec=list(dec))
        if nxt == EOS:
            break
        dec.append(nxt)
    out = [TGT_VOCAB[t] for t in dec[1:]]
    return out, last


# --------------------------------------------------------------- train -----
def run_train(args, cache):
    tf.keras.utils.set_random_seed(SEED)
    tf.config.experimental.enable_op_determinism()
    pairs = all_pairs()
    tr, ho = split_pairs(pairs)
    print(f"{len(pairs)} pairs: train {len(tr)}, held out {len(ho)}; src vocab {len(SRC_VOCAB)}, "
          f"tgt vocab {len(TGT_VOCAB)}")
    for i in ho:
        print("  held out:", " ".join(pairs[i][0]), "->", " ".join(pairs[i][1]))
    model = build(args.layers, args.d_model, args.heads, args.ffn, args.dropout)
    n_params = int(model.count_params())
    print(f"params {n_params:,}")
    src, dec_in, dec_out = encode(pairs, tr)
    sw = (dec_out != 0).astype(np.float32)
    model.compile(optimizer=tf.keras.optimizers.Adam(args.lr),
                  loss=tf.keras.losses.SparseCategoricalCrossentropy())
    t0 = time.time()
    log = []
    every = 25
    for start in range(0, args.epochs, every):
        h = model.fit((src, dec_in), dec_out, sample_weight=sw, batch_size=16,
                      epochs=start + every, initial_epoch=start, verbose=0)
        tr_acc, _ = exact_match(model, pairs, tr)
        ho_acc, _ = exact_match(model, pairs, ho)
        log.append(dict(epoch=start + every, loss=float(h.history["loss"][-1]), train=tr_acc, heldOut=ho_acc))
        print(f"epoch {start + every:4d}: loss {h.history['loss'][-1]:.5f}  train EM {tr_acc:.3f}  "
              f"held-out EM {ho_acc:.3f}  ({time.time() - t0:.0f}s)", flush=True)
    wall = time.time() - t0
    float_tr, _ = exact_match(model, pairs, tr)
    float_ho, _ = exact_match(model, pairs, ho)
    # round every weight to float16 (what the browser gets) and re-evaluate
    for v in model.weights:
        v.assign(v.numpy().astype(np.float16).astype(np.float32))
    tr_acc, tr_err = exact_match(model, pairs, tr)
    ho_acc, ho_err = exact_match(model, pairs, ho)
    print(f"float32 weights: train EM {float_tr:.4f}, held-out EM {float_ho:.4f}")
    print(f"float16-rounded weights: train EM {tr_acc:.4f}, held-out EM {ho_acc:.4f}")
    for en, got in tr_err + ho_err:
        print("  wrong:", en, "->", got)
    tag = args.tag
    model.save_weights(cache / f"toy-{tag}.weights.h5")
    meta = dict(tag=tag, cfg=model.cfg, lr=args.lr, epochs=args.epochs, params=n_params,
                wallSeconds=wall, log=log, trainEM=tr_acc, heldOutEM=ho_acc,
                trainEMFloat32=float_tr, heldOutEMFloat32=float_ho, trainErrors=tr_err,
                heldOutErrors=ho_err, device=device_label(), versions=versions())
    (cache / f"toy-{tag}.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print("cached", cache / f"toy-{tag}.json")


def device_label():
    gpus = tf.config.list_physical_devices("GPU")
    return "GPU" if gpus else "CPU"


def versions():
    import keras
    return dict(python=platform.python_version(), tf=tf.__version__, keras=keras.__version__,
                numpy=np.__version__)


# -------------------------------------------------------------- export -----
def tensors_in_order(model):
    """(name, array) in the order the JS reads them."""
    out = [("src_emb", model.src_emb.get_weights()[0]), ("tgt_emb", model.tgt_emb.get_weights()[0])]

    def mha(prefix, layer):
        w = layer.get_weights()   # q kernel/bias, k kernel/bias, v kernel/bias, out kernel/bias
        names = ["wq", "bq", "wk", "bk", "wv", "bv", "wo", "bo"]
        assert len(w) == 8, [x.shape for x in w]
        paths = [v.path for v in layer.weights]
        want = {"q": "query", "k": "key", "v": "value", "o": "attention_output"}
        for nm, arr, p in zip(names, w, paths):
            part = p.split("/")[-2]   # e.g. enc0_self/query/kernel -> query
            if part != want[nm[1]] or p.split("/")[-1] != ("kernel" if nm[0] == "w" else "bias"):
                sys.exit(f"unexpected MHA weight order: {nm} <- {p}")
            out.append((f"{prefix}.{nm}", arr))
        return paths

    def ln(prefix, layer):
        g, b = layer.get_weights()
        out.append((f"{prefix}.gamma", g))
        out.append((f"{prefix}.beta", b))

    def dense(prefix, layer):
        k, b = layer.get_weights()
        out.append((f"{prefix}.w", k))
        out.append((f"{prefix}.b", b))

    paths = {}
    for i in range(len(model.e_att)):
        paths[f"enc{i}.self"] = mha(f"enc{i}.self", model.e_att[i])
        ln(f"enc{i}.ln1", model.e_ln1[i])
        dense(f"enc{i}.ff1", model.e_ff1[i])
        dense(f"enc{i}.ff2", model.e_ff2[i])
        ln(f"enc{i}.ln2", model.e_ln2[i])
    for i in range(len(model.d_att)):
        paths[f"dec{i}.self"] = mha(f"dec{i}.self", model.d_att[i])
        ln(f"dec{i}.ln1", model.d_ln1[i])
        paths[f"dec{i}.cross"] = mha(f"dec{i}.cross", model.d_x[i])
        ln(f"dec{i}.ln2", model.d_ln2[i])
        dense(f"dec{i}.ff1", model.d_ff1[i])
        dense(f"dec{i}.ff2", model.d_ff2[i])
        ln(f"dec{i}.ln3", model.d_ln3[i])
    dense("out", model.out)
    return out, paths


def run_export(args, cache):
    meta = json.loads((cache / f"toy-{args.tag}.json").read_text())
    c = meta["cfg"]
    model = build(c["n_layers"], c["d_model"], c["heads"], c["ffn"], c["dropout"])
    model.load_weights(cache / f"toy-{args.tag}.weights.h5")
    pairs = all_pairs()
    tr, ho = split_pairs(pairs)
    tr_acc, _ = exact_match(model, pairs, tr)
    ho_acc, ho_err = exact_match(model, pairs, ho)
    print(f"reloaded: train EM {tr_acc:.4f}, held-out EM {ho_acc:.4f}")
    if abs(tr_acc - meta["trainEM"]) > 1e-9 or abs(ho_acc - meta["heldOutEM"]) > 1e-9:
        sys.exit("reloaded accuracy differs from the cached run")

    tensors, paths = tensors_in_order(model)
    for k, p in paths.items():
        print(f"  {k}: {p}")
    blob = b""
    manifest = []
    for name, arr in tensors:
        a16 = np.asarray(arr, np.float32).astype("<f2")
        if not np.array_equal(a16.astype(np.float32), np.asarray(arr, np.float32)):
            sys.exit(f"{name} is not float16-exact (weights should already be rounded)")
        manifest.append((name, list(arr.shape)))
        blob += a16.tobytes()
    b64 = base64.b64encode(blob).decode("ascii")

    # fixtures (Python reference values, float16-rounded weights, unpadded batch of 1)
    fixture_src = [["I", "like", "soccer"]]
    ho_adj = [pairs[i][0] for i in ho if len(pairs[i][0]) == 4]
    ho_short = [pairs[i][0] for i in ho if len(pairs[i][0]) == 3]
    fixture_src += ho_adj[:2] + ho_short[:1]
    fixture_src += [["we", "love", "old", "movies"], ["they", "like", "red", "houses"],
                    ["you", "love", "music"], ["I", "love", "big", "dogs"]]
    seen = set()
    fixture_src = [f for f in fixture_src if not (tuple(f) in seen or seen.add(tuple(f)))]
    held_set = {tuple(pairs[i][0]) for i in ho}
    ref = {tuple(en): es for en, es in pairs}
    fixtures = []
    for en in fixture_src:
        out, last = greedy_single(model, en)
        fixtures.append(dict(
            src=en, heldOut=tuple(en) in held_set, expected=ref[tuple(en)], out=out,
            decIn=[TGT_VOCAB[t] for t in last["dec"]],
            lastProbs=[float(v) for v in last["probs"][-1]],
            encSelf=[w.tolist() for w in last["enc"]],
            decSelf=[w.tolist() for w in last["dself"]],
            cross=[w.tolist() for w in last["cross"]]))
        print(f"  fixture: {' '.join(en):<26} -> {' '.join(out):<36} "
              f"{'(held out)' if tuple(en) in held_set else ''}")
    fx = dict(generatedBy=f"{SCRIPT_PATH} --export", date=args.date, cfg=c,
              trainEM=tr_acc, heldOutEM=ho_acc, nTrain=len(tr), nHeldOut=len(ho),
              tolerance=1e-4, fixtures=fixtures)
    Path(args.fixtures).write_text(json.dumps(fx) + "\n", encoding="utf-8", newline="\n")
    print("wrote", args.fixtures)

    v = meta["versions"]
    held_sentences = [" ".join(pairs[i][0]) for i in ho]
    head = [
        "Tiny toy English -> Spanish transformer for the CITS5017 Lecture 8 study page.",
        "This page's own toy model, trained by this page's script: NOT the slides' model.",
        "",
        f"Generated by {SCRIPT_PATH} on {args.date}. Do not edit by hand: re-run the script.",
        f"Trained on {meta['device']} with TensorFlow {v['tf']}, Keras {v['keras']}, NumPy {v['numpy']};",
        f"  seeds tf.keras.utils.set_random_seed({SEED}) + op determinism; {meta['wallSeconds']:.0f} s.",
        "Grammar: subject {I, you, we, they} + verb {like, love} + mass noun {soccer, music} or",
        "  plural noun {books, cats, dogs, movies, cars, houses} with at most one adjective",
        "  {red, big, old}; 208 pairs, "
        f"{len(tr)} trained on, {len(ho)} held out (HELD_OUT), never \"I like soccer\".",
        f"Model: post-norm encoder-decoder (Geron Fig. 16-8 shape), N = {c['n_layers']}, d_model = "
        f"{c['d_model']}, {c['heads']} heads",
        f"  (key_dim {c['d_model'] // c['heads']}), FFN {c['ffn']} relu, dropout {c['dropout']}, "
        f"{meta['params']:,} parameters; sinusoidal",
        "  positional encodings as Geron's PositionalEncoding (base 10_000); Keras",
        "  MultiHeadAttention + LayerNormalization (epsilon 1e-3).",
        f"Training: Adam(lr={meta['lr']}), {meta['epochs']} epochs, batch 16, masked sparse CE.",
        "Weights: every tensor rounded to float16 after training; WEIGHTS = base64 of the",
        "  little-endian float16 values of TENSORS in order, each row-major in its Keras shape",
        "  (MHA kernels q/k/v [d_model, heads, key_dim], biases [heads, key_dim], output kernel",
        "  [heads, key_dim, d_model]; Dense kernels [in, out]).",
        f"Greedy exact match with these weights: train {tr_acc * 100:.1f}% ({len(tr)}), "
        f"held out {ho_acc * 100:.1f}% ({len(ho)}).",
    ]
    hdr = "".join(f"// {ln}\n" if ln else "//\n" for ln in head)
    js = (hdr + "\n"
          + "export const META = " + json.dumps(dict(
              date=args.date, dModel=c["d_model"], heads=c["heads"], keyDim=c["d_model"] // c["heads"],
              ffn=c["ffn"], layers=c["n_layers"], maxLen=MAX_LEN, maxOut=MAX_OUT, epsilon=1e-3,
              params=meta["params"], epochs=meta["epochs"], lr=meta["lr"],
              trainEM=tr_acc, heldOutEM=ho_acc, nTrain=len(tr), nHeldOut=len(ho),
              device=meta["device"], tf=v["tf"], keras=v["keras"]), ensure_ascii=False) + "\n\n"
          + "export const SRC_VOCAB = " + json.dumps(SRC_VOCAB, ensure_ascii=False) + "\n"
          + "export const TGT_VOCAB = " + json.dumps(TGT_VOCAB, ensure_ascii=False) + "\n\n"
          + "export const HELD_OUT = " + json.dumps(held_sentences, ensure_ascii=False, indent=2) + "\n\n"
          + "export const TENSORS = [\n" + "".join(f"  [{json.dumps(n)}, {json.dumps(s)}],\n"
                                                  for n, s in manifest) + "]\n\n"
          + "export const WEIGHTS =\n  '" + b64 + "'\n")
    out = Path(args.out) / "toyMT.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(js, encoding="utf-8", newline="\n")
    print(f"wrote {out} ({out.stat().st_size:,} bytes)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--train", action="store_true")
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--d-model", type=int, default=32)
    ap.add_argument("--heads", type=int, default=2)
    ap.add_argument("--ffn", type=int, default=64)
    ap.add_argument("--layers", type=int, default=1)
    ap.add_argument("--dropout", type=float, default=0.0)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--epochs", type=int, default=400)
    ap.add_argument("--tag", default="main")
    ap.add_argument("--out")
    ap.add_argument("--fixtures")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    args = ap.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    if args.train:
        run_train(args, cache)
    elif args.export:
        run_export(args, cache)
    else:
        ap.error("--train or --export")


if __name__ == "__main__":
    main()
