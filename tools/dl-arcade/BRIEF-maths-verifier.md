# Brief: maths verifier (Keras truth + parameter/shape maths)

You own four things in the Gradient Arcade build (master brief: `Documents/temp/prompt-dumping/build_dl_arcade.md`,
sections "The TensorFlow environment", "Accuracy protocol" and the Param Sniper / Kernel Rush game descriptions):

1. `tools/dl-arcade/keras_truth.py` — builds a few hundred seeded random layer configs per layer type with REAL
   Keras and dumps, for each: the config, `count_params()`, trainable and non-trainable counts, and the output
   shape, to `tools/dl-arcade/keras-truth.json`. Record `tensorflow.__version__`, `keras.__version__`, the Python
   version and the date in the JSON. Deterministic (seed the config generator with `random.Random(5017)`).
2. `src/components/portal/modules/deep-learning/arcade/maths/params.js` — pure JS parameter-count functions, one
   per layer type, mirroring Keras's rules (trainable + non-trainable where relevant), plus a `layerParams(spec)`
   dispatcher and a `modelParams(specs, inputShape)` that walks a stack.
3. `src/components/portal/modules/deep-learning/arcade/maths/shapes.js` — pure JS output-shape functions, one per
   layer type, plus `layerShape(spec, inputShape)` and `modelShapes(specs, inputShape)`.
4. `tools/dl-arcade/check-maths.mjs` — a Node script that loads `keras-truth.json` and asserts the JS functions
   reproduce EVERY count and shape (100 %, prints the first mismatches and exits 1 otherwise). It also asserts
   the slide anchors listed below.

## Layer types and the spec shape

Use ONE plain-object spec format in JS, which the JSON also uses, so a game can hand a spec straight to both:

```js
// examples
{ type: 'Dense', units: 64, inputShape: [784] }                                  // use_bias default true
{ type: 'Dense', units: 10, useBias: false, inputShape: [64] }
{ type: 'Conv2D', filters: 32, kernel: [3, 3], strides: [1, 1], padding: 'same', inputShape: [28, 28, 1] }
{ type: 'Conv2DTranspose', filters: 16, kernel: [3, 3], strides: [2, 2], padding: 'valid', inputShape: [7, 7, 32] }
{ type: 'MaxPool2D', pool: [2, 2], strides: [2, 2], padding: 'valid', inputShape: [28, 28, 8] }   // strides default = pool
{ type: 'AvgPool2D', pool: [3, 3], strides: [2, 2], padding: 'same', inputShape: [...] }
{ type: 'GlobalAvgPool2D', inputShape: [7, 7, 64] }
{ type: 'Flatten', inputShape: [7, 7, 64] }
{ type: 'BatchNormalization', inputShape: [28, 28, 32] }    // axis −1; gamma, beta trainable; moving mean/var not
{ type: 'Dropout', rate: 0.5, inputShape: [...] }
{ type: 'SimpleRNN', units: 32, inputShape: [null, 5], returnSequences: false }     // time dim null = any length
{ type: 'LSTM', units: 32, inputShape: [50, 3], returnSequences: true }
{ type: 'GRU', units: 20, resetAfter: true, inputShape: [null, 1] }               // Keras 3 default reset_after=True
{ type: 'GRU', units: 20, resetAfter: false, inputShape: [null, 1] }              // the slides' one-bias form
{ type: 'Bidirectional', layer: { type: 'LSTM', units: 16 }, inputShape: [null, 2] }
{ type: 'Conv1D', filters: 32, kernel: 4, strides: 2, padding: 'valid' | 'same' | 'causal', inputShape: [56, 5] }
{ type: 'MultiHeadAttention', heads: 8, keyDim: 64, valueDim: null, inputShape: [null, 512] }  // query=key=value shape; valueDim defaults to keyDim
{ type: 'Embedding', inputDim: 1000, outputDim: 128, inputShape: [null] }
```

Shapes exclude the batch dimension. `null` means an unknown length (Keras prints `None`). Output shapes must
match what `model.summary()` / `layer.compute_output_shape` gives, including `None`s.

For every type generate ~200 random configs (fewer for the expensive ones; at least 60 each), spanning:
kernel 1–7 (square and non-square), strides 1–3, both paddings, channels 1–64, filters 1–128, units 1–128,
input sizes 5–64 (and 28, 32, 224 for the common ones), `use_bias` on and off for Dense/Conv, GRU with
`reset_after` True and False, RNNs with `return_sequences` on and off, Conv1D with all three paddings, MHA with
heads 1–8 and key_dim 4–64 (and some with value_dim ≠ key_dim). Build each with `keras.Sequential([keras.Input(shape), layer])`
(for MultiHeadAttention use the functional API: `x = keras.Input(shape); y = mha(x, x)`). Count via
`model.count_params()`; trainable via `sum(np.prod(w.shape) for w in model.trainable_weights)`.

## Running Keras (read this carefully; it was verified on 2026-10-22)

WSL distro `Ubuntu` (ignore `Ubuntu-22.04`), conda env `tf-2.20-gpu` = TensorFlow 2.21.0 + Keras 3.15.1.
Call Python by absolute path; bare `python`/`conda` are not found in non-interactive WSL shells. Force the CPU.
From Git Bash (the Bash tool here IS Git Bash) prefix with `MSYS_NO_PATHCONV=1`. Run from the repo root:

```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "C:\Users\james\Documents\personal-projects\wigfield-portfolio" \
  -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
  /home/james/miniconda3/envs/tf-2.20-gpu/bin/python tools/dl-arcade/keras_truth.py
```

A `cuInit … CUDA_ERROR_NO_DEVICE` / oneDNN line is expected and harmless. Use the env read-only: never
`pip install` into it, never touch its CUDA setup, and do not touch anything under
`C:\Users\james\Documents\university\` (graded submissions live there). Put real code in the `.py` file, not in `-c`.
If a full run is slow, keep the per-type counts modest (~100) and set `KERAS_BACKEND=tensorflow` explicitly.

## Slide anchors `check-maths.mjs` must also assert (from the lecture slides; builders will add more later)

- Lecture 4 slide 48/49 area: `SimpleRNN(20) on [None,1] + Dense(1)` → 461 ... VERIFY this one yourself with Keras,
  the slides print 685 for one model, 1401 for the GRU model and 1283 for an LSTM-ish one. Compute with Keras what
  these models are: `tf.keras.layers.GRU(20, input_shape=[None, 1])` + `Dense(1)` = 1,401 is confirmed. Determine
  (by reading `Documents/cits5017/markdown-lecs/lecture-4.md` around slides 23–29, 42–49 and the PDF
  `pdftotext -layout -f N -l N Documents/cits5017/lectures/cits5017-lect04-Processing-sequences.pdf -`)
  which printed models give 685 and 1283 and encode them as anchors with their slide numbers.
- Lecture 8 slide 9: `Bidirectional(SimpleRNN(16)) on 2 features + Dense(2)` = 674; slide 14's encoder–decoder
  total (read the slide). Lecture 6–7 slide 6: conv_decoder 13,873 and conv_ae 54,479 (read slide 5's model code
  in `Documents/cits5017/markdown-lecs/lecture-6-7.md` and reproduce the stack through `modelParams`).
- Lecture 2 BatchNormalization summary (transcript slide 27: read the printed `model.summary()` and encode its
  per-layer counts and the non-trainable total).
- Lecture 3 slide 22: `(5×5×3 + 1) × 200` and the slide-35 Fashion-MNIST CNN total if the slide prints it (the
  transcript stops at slide 16; use pdftotext on the PDF for slides 17–53).
- Lecture 5 slide 13 (stacked AE `model.summary()` if printed) and slides 19–22's tied-weight counts.
- Lecture 8 slide 46: ViT patch 16 × 16 × 3 = 768.
Cite each anchor with `{ lecture, slides }` in the test. If a printed number does NOT match Keras 3.15, do not
"fix" it: record both (`slide:` and `keras:`) with a note; the game will teach the slide's number and explain.

## Code style
- JS: ES modules, no React, no DOM, small pure functions, JSDoc one-liners. The repo lints with
  `npx eslint <path>` (flat config; `tools/**/*.mjs` has Node globals). Both files must lint clean.
- Formulae must be derivations, not look-ups: e.g. GRU `3·(units·nIn + units·units + (resetAfter ? 2 : 1)·units)`,
  Conv2DTranspose `kh·kw·filters·cin + filters`, MHA = `q/k/v kernels [d, heads, keyDim] + biases [heads, keyDim]`
  (value uses valueDim) `+ output kernel [heads, valueDim, d] + bias [d]`. Shapes: `same` → ⌈n/s⌉, `valid` →
  ⌊(n−k)/s⌋+1, Conv2DTranspose `same` → n·s, `valid` → n·s + max(k−s, 0) (Keras deconv_output_length), causal
  Conv1D → ⌈n/s⌉, pooling same as conv with k = pool.
- Export from `params.js`: `denseParams, conv2dParams, convTransposeParams, conv1dParams, bnParams (→ {total,
  trainable, nonTrainable}), simpleRnnParams, lstmParams, gruParams, bidirectionalParams, mhaParams,
  embeddingParams, layerParams(spec) (→ {total, trainable, nonTrainable}), modelParams(specs, inputShape)`.
  Export from `shapes.js`: `convOut(n, k, s, padding), convTransposeOut, poolOut, conv1dOut, layerShape(spec,
  inputShape), modelShapes(specs, inputShape) (→ [{ spec, in, out }])`, `fmtShape(shape)` → "(None, 28, 28, 1)" as
  Keras prints it (batch None first).

## Report back
- The Keras versions, how many configs per type, and the check result (must be 100 %).
- Each slide anchor: slide number, printed value, Keras value, match or mismatch.
- Anything you could not run, with the exact error.
