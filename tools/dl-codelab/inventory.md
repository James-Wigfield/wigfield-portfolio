# Code Lab inventory: every candidate, rated for the exam

Built 2026-10-25 for the refactored Code Lab (`/portal/dl-code-lab`). Three inventory passes read every slide of the eight CITS5017 decks as images (code transcribed column-exact from the PDF text layer and checked against 200–300 dpi renders), plus Lab Sheets 2–4, Géron's Ch 10/11 notebooks and both project notebooks. The verbatim slide code lives in `slides-verbatim/` (`L1.txt` … `L9.txt`, `Lab4.txt`), one block per `=== Ln sN ===` header; `check-cards.mjs` checks every lecture card against it.

## Evidence used for the ratings (strongest first)

1. **Sample paper stimulus types.** Q1(c) gives a functional model (Normalization + Concatenate) and asks for a diagram, trainable parameters per layer and in total, and what problem it suits (it is L1 s44 with the sizes changed). Q2(a) is Lab 4 with stars: shapes of X and y, a loss, and how to set up an RNN to predict two steps. Q1(d) and Q2(e) give an equation and ask what each term means.
2. **`exam-information.md`.** Topics 1–9 plus the labs and both projects; "There won't any large block of Python coding … you are likely to be given a block of code and you need to draw a diagram or give explanation"; textbook sections not in the lecture notes are not examined.
3. **Deck summary slides and exclusions.** L2 s66 alpha dropout, L5 s27 sparse autoencoders, L8 s41 beam search and L8 s47 onward are marked not examined.
4. **Exam-practice papers** (`exam-practice/papers/`, likelihood per part) and `tools/dl-exam-practice/coverage.md`. Topics no practice paper covers (CNN architectures, ℓ1/ℓ2, LR schedules, visual attention, policy search) are still examinable.

**Ratings.** `core` = likely to be a question's stimulus, or the heart of an answer. `useful` = supports a core card, or a likely short-answer part. `cut` = not worth the space (plotting, downloads, printed logs, pure Python utilities, duplicates). **Angles:** draw · count · shapes · explain · eq (equation ↔ code).

**Card** = the Code Lab card the candidate feeds (its id), or `—` when it is not on the page. A `useful` item with `—` was left out for the budget (≤ 40 cards; the PDF ≤ 30 pages), with the reason given. No `cut` item is on the page (checked).

## The cards on the page (38, in 10 tabs)

| Tab | Cards (id → main sources) |
|---|---|
| 1 Labs & Projects | `lab2-lr-search` (Géron Ch 10 Ex 10) · `lab3-wine` (Lab 3 T1) · `lab4-clockwise` (Lab 4 T2) · `lab4-next-vertex` (Lab 4 T3) · `p1-cnn` (P1 §2.1, §2.3) · `p1-nasnet` (P1 §3.1–3.2) · `p2-gru` (P2 §5–7) · `p2-encdec` (P2 §8) · `p2-vae` (P2 §11) |
| 2 Keras models | `fashion-mlp` (L1 s35–37) · `wide-deep` (L1 s44–45) |
| 3 Training deep nets | `batch-norm` (L2 s26–28) · `dropout-l2` (L2 s60, s64) · `transfer-b-on-a` (L2 s31–32) |
| 4 Optimizers & LR schedules | `momentum-adam` (L2 s34–44) · `lr-schedules` (L2 s53, s56, s57) |
| 5 CNNs | `conv-shapes` (L3 s18–20) · `fashion-cnn` (L3 s35) |
| 6 RNNs & time series | `deep-rnn` (L4 s27, s29) · `forecast-ahead` (L4 s34–38) · `lstm-gru` (L4 s43, s49) · `conv1d-gru` (L4 s50) |
| 7 Autoencoders | `linear-ae` (L5 s8–9) · `stacked-ae` (L5 s12, s21) · `conv-ae` (L6–7 s5–6) |
| 8 VAEs & GANs | `vae-sampling` (L6–7 s14–15) · `gan-build` (L6–7 s23–24) · `gan-train` (L6–7 s25) · `dcgan` (L6–7 s29) |
| 9 Attention & transformers | `attention` (L8 s26, s43) · `positional-encoding` (L8 s32, s35–36) |
| 10 Reinforcement learning | `gym-loop` (L9 s17–22) · `policy-net` (L9 s25, s32) · `discount-rewards` (L9 s34) · `q-iteration` (L9 s46–49) · `dqn-model` (L9 s61) · `dqn-step` (L9 s60, s63) |

The starting section plan had 11 tabs. Transfer learning joined Training deep nets (L2's own deck covers it, and the L3 pretrained-model pattern is Project 1's NASNetMobile card), and the RL tab keeps all six L9 cards, so 10 tabs.

## Lecture 1 · Intro to ANNs (29 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l1-perceptron-iris | L1 s13 | sklearn `Perceptron` on two iris petal features | single TLU | useful | s63 "train a Perceptron"; sklearn, explain-only; the XOR weakness is prose (B Q1(a)) | explain | — (budget; quirk `np.int` noted below) |
| l1-mlpregressor-housing | L1 s26 | sklearn `MLPRegressor` in a scaler pipeline | regression MLP | cut | not Keras; the Keras regression MLP covers it | explain | — |
| l1-tf-versions | L1 s33 | version check | setup | cut | boilerplate | — | — |
| l1-fashion-mlp-add | L1 s35 | load Fashion MNIST, split, scale, 300-100-10 with `.add()` | Sequential classifier | core | classic draw/count stimulus; s63 Sequential API | draw, count, shapes | fashion-mlp |
| l1-fashion-mlp-list | L1 s35 #2 | the same model as one `Sequential([...])` | Sequential classifier | core | the form shown on the card | draw, count | fashion-mlp |
| l1-summary-prompt | L1 s36 | `>>> model.summary()` | — | cut | prompt only | — | — |
| l1-fashion-mlp-summary | L1 s36 #2 | summary screenshot: 235,500 / 30,100 / 1,010 = 266,610 | counting | core | the count answer key | count | fashion-mlp (Slide check) |
| l1-dense-weights-shape | L1 s36 #3 | `get_weights()`: kernel (784, 300), bias (300,) | weight shapes | useful | kernel = inputs × units | shapes | fashion-mlp (legend) |
| l1-compile-classifier | L1 s37 | `compile(loss="sparse_categorical_crossentropy", …)` | loss choice | core | integer labels → sparse CE; recurs in Lab 3, P1 | explain | fashion-mlp |
| l1-fit | L1 s37 #2 | `model.fit(..., epochs=30, validation_data=...)` | training | useful | 1,719 steps = ⌈55,000/32⌉ | explain | — (budget; fit is on every lab card) |
| l1-fit-log | L1 s37 #3 | training log screenshot | log | cut | printed output | — | — |
| l1-learning-curves-plot | L1 s38 | pandas plot of history | plotting | cut | plotting | — | — |
| l1-evaluate | L1 s39 | `model.evaluate(X_test, y_test)` → [loss, accuracy] | evaluation | useful | returns [loss, metric] | explain | — (budget) |
| l1-predict-argmax | L1 s40 | `predict` then `argmax(axis=-1)` to class IDs | probabilities → IDs | useful | Lab 3's `np.argmax` pitfall | shapes, explain | lab3-wine (same move) |
| l1-regression-mlp-seq | L1 s41 | Sequential regression MLP with `Normalization` | regression head | useful | Normalization + Dense(1) are on the Wide & Deep card | count | — (covered by wide-deep) |
| l1-wide-deep-functional | L1 s44 | Wide & Deep with the Functional API | non-sequential model | core | sample Q1(c) is this code with the sizes changed | draw, count, explain | wide-deep |
| l1-summary-prompt-func | L1 s45 | `>>> model.summary()` | — | cut | prompt only | — | — |
| l1-wide-deep-summary | L1 s45 #2 | summary: 17 non-trainable, 270, 930, 0, 39 | counting | core | answer key for Q1(c)-style counts | count | wide-deep (Slide check) |
| l1-wide-deep-multi-input | L1 s46 | two inputs, wide 0–4 / deep 2–7 | multi-input model | useful | a two-input draw is plausible; budget | draw, count | — (budget) |
| l1-wide-deep-aux-output | L1 s47 | auxiliary output, `loss_weights=(0.9, 0.1)` | multi-output | useful | short answer: aux output regularises | explain | — (budget) |
| l1-subclassing-wide-deep | L1 s48 | Wide & Deep as a `tf.keras.Model` subclass | subclassing API | useful | s63 mentions subclassing; `self.output` fails in Keras 3 | explain | — (budget) |
| l1-save-model | L1 s50 | `model.save("…keras")` | saving | cut | one line, no exam angle | — | — |
| l1-load-model | L1 s50 #2 | `load_model` | loading | cut | one line | — | — |
| l1-checkpoint-callback | L1 s51 | `ModelCheckpoint(..., save_best_only=True)` | callbacks | useful | EarlyStopping is shown on the lab cards | explain | — (budget) |
| l1-early-stopping | L1 s52 | `EarlyStopping(patience=10, restore_best_weights=True)` | callbacks | useful | used by Lab 3, Lab 4, P1, P2; on those cards | explain | lab4-clockwise (same callback) |
| l1-tensorboard-logdir | L1 s53 | timestamped log dir | utility | cut | pure Python | — | — |
| l1-tensorboard-callback | L1 s54 | `TensorBoard(run_logdir, …)` | TensorBoard | cut | one line; no exam angle | — | — |
| l1-tensorboard-magic | L1 s55 | `%tensorboard` magics | tooling | cut | not code to explain | — | — |
| l1-tensorboard-cli | L1 s55 #2 | `tensorboard --logdir` | tooling | cut | shell command | — | — |

## Lecture 2 · Training DNNs (28 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l2-he-init | L2 s9 | `kernel_initializer="he_normal"` | initialisation | useful | one line; He vs Glorot is prose | explain | dropout-l2 (the `he_normal` line) |
| l2-variance-scaling | L2 s9 #2 | `VarianceScaling(…)` | initialisation | cut | API detail | — | — |
| l2-leaky-relu | L2 s12 | three ways to attach LeakyReLU | activations | useful | one-liners; nonsaturating activations are prose | explain | — (budget) |
| l2-leaky-relu-layer | L2 s12 #2 | Dense, then a `LeakyReLU` layer | activations | useful | same pattern as BN-before-activation | explain | — (budget) |
| l2-bn-after-activation | L2 s26 | Fashion MLP with BatchNormalization | batch norm | core | L2 summary; s27 prints its counts | draw, count | batch-norm |
| l2-summary-prompt | L2 s27 | `>>> model.summary()` | — | cut | prompt only | — | — |
| l2-bn-summary | L2 s27 #2 | summary: BN 3,136 / 1,200 / 400; 2,368 non-trainable | BN counts | core | classic count question | count | batch-norm (Slide check) |
| l2-bn-before-activation | L2 s28 | BN between a bias-free Dense and `Activation` | batch norm | useful | "why `use_bias=False`?"; folded into the batch-norm legend | explain | batch-norm (legend) |
| l2-gradient-clipping | L2 s29 | `SGD(clipvalue=1.0)` | clipping | useful | clipvalue vs clipnorm short answer; one line | explain | — (budget) |
| l2-transfer-learning | L2 s31 | reuse model A, freeze, train, unfreeze, recompile | transfer learning | core | Lab 2 Task 2; B Q1(d) transfer code | explain, count | transfer-b-on-a |
| l2-transfer-evaluate | L2 s32 | `evaluate` → 93.85% | transfer result | useful | the error-rate arithmetic | explain | transfer-b-on-a (legend) |
| l2-momentum | L2 s35 | `SGD(..., momentum=0.9)` | momentum | core | equation ↔ code; sample Q1(d) | eq | momentum-adam |
| l2-nesterov | L2 s37 | `nesterov=True` | NAG | useful | one argument | eq | momentum-adam |
| l2-nesterov-dup | L2 s39 | the NAG line again | — | cut | duplicate | — | — |
| l2-adagrad | L2 s40 | `Adagrad(...)` | AdaGrad | useful | "stops too early" is prose | explain | — (budget) |
| l2-rmsprop | L2 s42 | `RMSprop(rho=0.9)` | RMSProp | useful | ρ ↔ β₂ | eq | momentum-adam (legend) |
| l2-adam | L2 s44 | `Adam(beta_1=0.9, beta_2=0.999)` | Adam | core | B Q1(b) Adam equations; P1 uses Adam | eq | momentum-adam |
| l2-adamax | L2 s46 | `Adamax(...)` | variant | cut | minor variant | — | — |
| l2-nadam | L2 s46 #2 | `Nadam(...)` | variant | useful | one line | — | — (budget) |
| l2-adamw | L2 s46 #3 | `tf.optimizers.AdamW(...)` | variant | useful | one line | — | — (budget) |
| l2-power-schedule | L2 s51 | `InverseTimeDecay(...)` | power scheduling | useful | equation ↔ code; schedules card shows the exponential form | eq | — (budget) |
| l2-exponential-schedule | L2 s53 | `ExponentialDecay(...)` | exponential scheduling | core | eq ↔ code on the slide; P1 uses it | eq | lr-schedules |
| l2-custom-scheduler-callback | L2 s54 | `LearningRateScheduler` callback | per-epoch schedule | useful | step vs epoch | explain | — (budget) |
| l2-piecewise-schedule | L2 s56 | `PiecewiseConstantDecay(...)` | piecewise schedule | useful | read the boundaries | explain | lr-schedules |
| l2-reduce-lr-on-plateau | L2 s57 | `ReduceLROnPlateau(factor=0.5, patience=5)` | performance schedule | useful | s65 default recommendation | explain | lr-schedules |
| l2-l2-regularizer | L2 s60 | `kernel_regularizer=tf.keras.regularizers.l2(0.01)` | ℓ2 | core | no practice paper covers ℓ1/ℓ2, still examinable | explain | dropout-l2 |
| l2-partial-regularized-dense | L2 s61 | `functools.partial` RegularizedDense | ℓ2 everywhere | useful | idiom reused by L3 `DefaultConv2D` | explain | — (budget) |
| l2-dropout-mlp | L2 s64 | `Dropout(rate=0.2)` before every Dense | dropout | core | L2 summary; A Q1(e); P1 needs dropout | draw, count, explain | dropout-l2 |

## Lecture 3 · CNNs (12 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l3-sample-images | L3 s17 | load, `CenterCrop`, `Rescaling`; shape [2, 70, 120, 3] | 4-D image batch | useful | the input shape the next slides use | shapes | conv-shapes (legend) |
| l3-conv2d-valid | L3 s18 | `Conv2D(filters=32, kernel_size=7)` → [2, 64, 114, 32] | conv shapes | core | sample Q1(a) conv parameters; shape arithmetic | shapes, count | conv-shapes |
| l3-conv-weights-shape | L3 s19 | kernels (7, 7, 3, 32), biases (32,) | conv weights | core | [f_h, f_w, f_c, f_n] rule | shapes, count | conv-shapes |
| l3-conv2d-same | L3 s20 | `padding="same"` → [2, 70, 120, 32] | padding | core | valid vs same | shapes | conv-shapes |
| l3-maxpool | L3 s28 | `MaxPooling2D(pool_size=2)` | pooling | useful | halves H, W; 0 params; on the CNN card | shapes | fashion-cnn (MaxPool lines) |
| l3-avgpool | L3 s28 #2 | `AveragePooling2D(pool_size=2)` | pooling | cut | duplicate of max pooling's shape rule | — | — |
| l3-global-avg-pool | L3 s31 | `GlobalAvgPool2D()` → (2, 3) | GAP | useful | P1 uses GAP; on the P1 cards | shapes | p1-cnn (GAP line) |
| l3-fashion-cnn | L3 s35 | full Fashion-MNIST CNN with `DefaultConv2D` | CNN model | core | s52 "implement a simple CNN"; best L3 count stimulus | draw, count, shapes | fashion-cnn |
| l3-resnet50-pretrained | L3 s48 | ResNet50 with ImageNet weights, predict | pretrained models | useful | preprocessing idea is on the P1 NASNet card | explain | — (budget) |
| l3-resnet50-output | L3 s49 | printed top-3 predictions | output | cut | printed output | — | — |
| l3-xception-data | L3 s50 | tf_flowers split + preprocess pipeline | data pipeline | cut | data plumbing | — | — |
| l3-xception-transfer | L3 s51 | Xception base, GAP head, freeze then unfreeze `[56:]` | transfer learning | useful | the same pattern as P1's NASNetMobile card, which is examinable too | explain | — (P1 card's cross-reference) |

## Lecture 4 · Processing sequences (30 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l4-load-ridership | L4 s15 | download and tidy the CTA ridership CSV | data prep | cut | pandas wrangling | — | — |
| l4-plot-ridership | L4 s16 | plot Mar–May 2019 | plotting | cut | plotting | — | — |
| l4-diff7-plot | L4 s17 | 7-day differencing and plot | plotting | cut | plotting | — | — |
| l4-naive-mae | L4 s18 | naive forecast MAE 42,143 | baseline | useful | baseline idea is prose | explain | — (budget) |
| l4-naive-mape | L4 s18 #2 | naive MAPE | metric | useful | MAE vs MAPE | explain | — (budget) |
| l4-windowing-toy | L4 s19 | `timeseries_dataset_from_array` on 0…5 | windowing | useful | shapes are on the Lab 4, P2 and forecast cards | shapes | — (budget) |
| l4-split-windows | L4 s20 | 56-day windows, chronological split | windowing | useful | shapes | shapes | — (budget) |
| l4-inspect-batches | L4 s21 | batch shapes (32, 56), (32,) | shapes | useful | printed shapes | shapes | — (budget) |
| l4-plot-windows | L4 s22 | plot windows | plotting | cut | plotting | — | — |
| l4-linear-baseline | L4 s23 | `Dense(1)` on a flat window (57 params) | baseline model | useful | smallest count | count | — (budget) |
| l4-simplernn-1 | L4 s24 | `SimpleRNN(1)` (3 params) | memory cell | useful | why it fails (tanh range, 1 unit) | count, explain | — (covered by deep-rnn) |
| l4-fit-and-evaluate | L4 s24 #2 | `fit_and_evaluate` helper (Huber, SGD momentum) | training recipe | useful | Lab 4's momentum hint | explain | — (budget) |
| l4-simplernn-summary | L4 s25 | summary, 3 params | counting | cut | Keras 2 printout | — | — |
| l4-univar-model | L4 s27 | `SimpleRNN(32)` + `Dense(1)`, summary 1,121 | sequence-to-vector | core | the deck's base RNN with printed counts | count, draw | deep-rnn (Slide check) |
| l4-deep-rnn | L4 s29 | three SimpleRNN(32) + Dense(1), 5,281 | deep RNN | core | `return_sequences` rule; counts printed | draw, count, explain | deep-rnn |
| l4-mulvar-frame | L4 s30 | 5-column multivariate frame | features | useful | why the input is [None, 5] | shapes | forecast-ahead (legend) |
| l4-mulvar-datasets | L4 s31 | multivariate windows, rail target | windowing | useful | shapes | shapes | — (budget) |
| l4-mulvar-model | L4 s31 #2 | `SimpleRNN(32)` on 5 features | counting | useful | only W_x grows | count | — (budget) |
| l4-multitask | L4 s32 | `Dense(2)` for bus and rail | multi-output | useful | Q2(a)iii two outputs | shapes | — (budget) |
| l4-multitask-mae | L4 s33 | per-output MAE | evaluation | cut | utility | — | — |
| l4-multitask-mae-out | L4 s33 #2 | printed MAEs | output | cut | printed output | — | — |
| l4-rollout-loop | L4 s34 | predict one day, append, 14 times | recursive forecast | core | P2 model 2 spec; Q2(a)iii alternative | explain, shapes | forecast-ahead |
| l4-ahead-datasets | L4 s35 | 70-step windows split into 56 inputs and 14 targets | multi-step targets | core | Q2(a)iii pattern; shapes printed on s36 | shapes | forecast-ahead |
| l4-ahead-inspect | L4 s36 | batch shapes (32, 56, 5), (32, 14) | shapes | useful | answer key for s35 | shapes | forecast-ahead (Shapes) |
| l4-ahead-plot | L4 s36 #2 | plot two windows | plotting | cut | plotting | — | — |
| l4-ahead-model | L4 s38 | `SimpleRNN(32)` + `Dense(14)` | sequence-to-vector, 14 outputs | core | Q2(a)iii analogue; P2 model 1 | shapes, count | forecast-ahead |
| l4-layernorm-rnn | L4 s41 | `SimpleRNNCell` + LayerNormalization | layer norm | useful | the code doesn't build as printed | explain | — (budget) |
| l4-lstm-model | L4 s43 | `LSTM(12)` + `Dense(1)`, 685 | LSTM | core | 4-gate count printed | count, eq | lstm-gru |
| l4-gru-model | L4 s49 | `GRU(20)` + `Dense(1)`, 1,401 | GRU | core | `reset_after` count trap; P2's layer | count, eq | lstm-gru |
| l4-cnn-gru | L4 s50 | two `Conv1D` + `GRU(10)` + `Dense(1)`, 1,283 | Conv1D front end | core | B Q2(b) Conv1D + LSTM code (likelihood high) | draw, count, shapes | conv1d-gru |

## Lecture 5 · Autoencoders (8 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l5-linear-ae-pca | L5 s8 | linear AE 3 → 2 → 3 with MSE | AE ≈ PCA | core | summary outcome verbatim; B Q3(d) (likelihood high) | draw, count, explain | linear-ae |
| l5-linear-ae-fit | L5 s9 | fit on (X, X), `encoder.predict` | self-supervised | useful | input = target | shapes | linear-ae |
| l5-stacked-ae | L5 s12 | 784 → 100 → 30 → 100 → 784, 163,814 | stacked AE | core | summary outcome; count printed | draw, count | stacked-ae |
| l5-tsne | L5 s14 | encode then t-SNE | visualisation | useful | encoder used alone | explain | — (budget) |
| l5-dense-transpose | L5 s20 | `DenseTranspose` custom layer | tied weights | useful | A Q2(d) tied weights (likelihood medium); folded into the stacked-ae Slide check | explain | — (stacked-ae notes the 82,414) |
| l5-tied-ae | L5 s21 | tied stacked AE, 82,414 | tied weights | useful | count printed; the card states it | count | stacked-ae (legend) |
| l5-greedy-layerwise | L5 s24 | greedy layer-wise training | pretraining | useful | prose answer (A Q3(d)) | explain | — (budget) |
| l5-finetune-1by1 | L5 s25 | fine-tune and plot | plotting | cut | plotting | — | — |
| (L5 s27) | L5 s27 | sparse autoencoders | — | cut | marked not examined ("excluding the Sparse Autoencoders section") | — | — |

## Lectures 6–7 · Conv, denoising, variational AEs, GANs (12 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l67-conv-ae | L6–7 s5 | conv encoder (Conv2D + MaxPool) and transposed-conv decoder | conv AE | useful | shape arithmetic; B Q3(c) is prose | shapes, count | conv-ae |
| l67-conv-decoder-summary | L6–7 s6 | decoder summary 13,873; `count_params()` 54,479 | counting | useful | answer key | count | conv-ae (Slide check) |
| l67-dropout-dae | L6–7 s9 | denoising AE with `Dropout(0.5)` on the input | denoising AE | useful | A Q2(e) prose; budget | explain | — (budget; conv-ae notes it) |
| l67-vae-sampling | L6–7 s14 | `Sampling` layer with the KL loss; encoder [μ, γ, z] | VAE | core | sample Q2(b); B Q3(a) Sampling code | eq, explain | vae-sampling |
| l67-vae-train | L6–7 s15 | join, compile (mse + KL via `add_loss`), fit | VAE training | useful | "how would you train them" | explain | vae-sampling |
| l67-vae-generate | L6–7 s16 | sample N(0, I) codings, decode | generation | useful | the application | shapes | — (budget) |
| l67-vae-interp | L6–7 s18 | semantic interpolation | generation | cut | not in the summary | — | — |
| l67-gan-build | L6–7 s23 | dense generator + discriminator, `gan = Sequential([...])` | GAN | core | A Q3(a) GAN code → draw, count (likelihood high) | draw, count | gan-build |
| l67-gan-compile | L6–7 s24 | compile both with BCE | GAN | useful | why BCE | explain | gan-build |
| l67-gan-dataset | L6–7 s24 #2 | `tf.data` pipeline | data | cut | plumbing | — | — |
| l67-train-gan | L6–7 s25 | two-phase training loop | GAN training | core | A Q3(b) two phases (likelihood high) | explain, shapes | gan-train |
| l67-dcgan | L6–7 s29 | DCGAN generator and discriminator | DCGAN | core | B Q3(b) DCGAN generator code (likelihood high) | shapes, count, explain | dcgan |

## Lecture 8 · Attention and transformers (15 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l8-bilstm-encoder | L8 s8 | bidirectional LSTM encoder with states | bidirectional RNN | useful | B Q2(e) is prose | explain | — (budget) |
| l8-bilstm-states-concat | L8 s8 #2 | 4 states → 2 | state hand-off | useful | explain-the-lines | explain | — (budget) |
| l8-simple-birnn | L8 s9 | `Bidirectional(SimpleRNN(16))` + Dense(2), 674 | bidirectional RNN | useful | count printed; budget | count | — (budget) |
| l8-birnn-log | L8 s10 | training log | output | cut | printed | — | — |
| l8-birnn-eval-mae | L8 s10 #2 | MAE | evaluation | cut | boilerplate | — | — |
| l8-rnn-ed-functional | L8 s14 | functional RNN encoder–decoder, `initial_state` | encoder–decoder | useful | P2's encoder–decoder card shows the same mechanism in GRUs | draw, count | — (p2-encdec covers it) |
| l8-rnn-ed-fit | L8 s15 | fit with two inputs | teacher forcing | useful | as above | explain | — (budget) |
| l8-learning-curves | L8 s16 | plot | plotting | cut | plotting | — | — |
| l8-rnn-ed-predict | L8 s17 | predict loop sketch (not valid Python) | inference | useful | not runnable as printed | explain | — (budget) |
| l8-attn-encoder-seq | L8 s26 | encoder with `return_sequences=True` | attention input | useful | supports the attention card | explain | attention (legend) |
| l8-keras-attention-layer | L8 s26 #2 | `tf.keras.layers.Attention()` + softmax Dense | Luong attention | core | the only "implement attention in Keras" code; A Q3(e), Q4(a) | eq, explain | attention |
| l8-attn-call-line | L8 s28 | `attention_layer([queries, keys])` | — | cut | duplicate of s26's line | — | — |
| l8-positional-encoding | L8 s35 | `PositionalEncoding` layer | positional encoding | core | sample Q2(c) key component; eq ↔ code with s32 | eq, explain | positional-encoding |
| l8-pos-encoding-use | L8 s36 | apply it to both embeddings | positional encoding | useful | where it sits | explain | positional-encoding |
| l8-mha-encoder-loop | L8 s43 | padding mask + `MultiHeadAttention` self-attention | multi-head attention | core | sample Q2(c) second component; A Q4(a) Q/K/V | count, explain | attention |
| (L8 s41, s47–51) | L8 | beam search; s47 onward | — | cut | marked not examined; no code | — | — |

## Lecture 9 · Reinforcement learning (26 blocks)

| id | source | what | concept | rating | reason | angle | card |
|---|---|---|---|---|---|---|---|
| l9-install-gymnasium | L9 s16 | `%pip install gymnasium` | setup | cut | boilerplate | — | — |
| l9-install-gymnasium-local | L9 s16 #2 | `pip install gymnasium` | setup | cut | boilerplate | — | — |
| l9-gym-make-reset | L9 s17 | `gym.make`, `env.reset(seed=42)` | Gym API | useful | s68 Gym outcome; `reader_mode` quirk | explain | gym-loop |
| l9-gym-render | L9 s18 | `env.render()` | rendering | cut | rendering | — | — |
| l9-action-space | L9 s19 | `Discrete(2)` | actions | useful | 0 = left, 1 = right | explain | gym-loop (legend) |
| l9-gym-step | L9 s20 | `env.step(1)`, five return values | Gym API | useful | the 5-tuple used everywhere | explain | gym-loop |
| l9-basic-policy | L9 s21 | hard-coded policy from the pole angle | policy | useful | needed for s22 | explain | gym-loop |
| l9-gym-episode-loop | L9 s22 | 500 episodes, totals statistics | episode loop | useful | the loop shape every RL card reuses; s68 outcome | explain | gym-loop |
| l9-policy-net | L9 s25 | 4 → Dense(5, relu) → Dense(1, sigmoid) | policy network | core | A Q4(e) is this code (draw, why one sigmoid) | draw, count | policy-net |
| l9-pg-play-one-step | L9 s32 | sample the action, `y_target = 1 − action`, gradients | REINFORCE step 1 | core | B Q4(e) REINFORCE steps (likelihood high) | explain, shapes | policy-net |
| l9-y-target-line | L9 s32 #2 | the `y_target` line again | — | cut | duplicate | — | — |
| l9-pg-play-multiple | L9 s33 | collect rewards and gradients per episode | REINFORCE | useful | data structure | explain | — (budget) |
| l9-discount-normalize | L9 s34 | `discount_rewards`, normalise into advantages | returns, advantages | core | A Q4(b) returns (likelihood high); −22 example | eq, explain | discount-rewards |
| l9-pg-hyperparams | L9 s35 | γ = 0.95, BCE, Nadam | hyperparameters | useful | why BCE | explain | — (budget) |
| l9-pg-training-loop | L9 s36 | weight gradients by advantage, average, apply | REINFORCE loop | useful | B Q4(e) is prose; the steps are on the discount card | explain | discount-rewards (legend, steps 3–4) |
| l9-pg-print-output | L9 s36 #2 | printed output | output | cut | printed | — | — |
| l9-show-episode | L9 s37 | animation helper | rendering | cut | undefined helpers | — | — |
| l9-mdp-arrays | L9 s47 | T, R and possible actions as lists | MDP | core | draw the MDP from the arrays; B Q4(b) | draw, explain | q-iteration |
| l9-q-value-iteration | L9 s48 | Q-value iteration, γ = 0.90 | Q-value iteration | core | sample Q2(e) value iteration (likelihood high); eq ↔ code | eq, explain | q-iteration |
| l9-q-values-argmax | L9 s49 | converged Q-values, `argmax` → [0, 0, 1] | optimal policy | useful | B Q4(c) | explain | q-iteration (legend) |
| l9-q-values-gamma095 | L9 s49 #2 | γ = 0.95 → [0, 2, 1] | effect of γ | useful | short answer | explain | q-iteration (legend) |
| l9-dqn-model-eps-greedy | L9 s61 | DQN 4 → 32 → 32 → 2, ε-greedy, replay deque | DQN | core | B Q4(d)i count 1,282; A Q4(d) ε-greedy (likelihood high) | draw, count, explain | dqn-model |
| l9-replay-buffer-sample | L9 s62 | sample experiences; play one step | replay buffer | useful | supports the training step | explain | — (budget) |
| l9-dqn-training-step | L9 s63 | targets r + γ max Q′, mask, MSE | DQN training | core | B Q4(d)ii–iii quote these lines | eq, explain, shapes | dqn-step |
| l9-dqn-training-loop | L9 s64 | 600 episodes, ε decay | DQN loop | useful | ε schedule line | explain | — (budget) |
| l9-dqn-plot | L9 s65 | printed output and plot | plotting | cut | plotting | — | — |

## Lab sheets (no official solutions; only Lab 4's `load_data` is printed)

| id | source | what | rating | reason | angle | card |
|---|---|---|---|---|---|---|
| lab1-playground | Lab Sheet 1 / Lab 2 T1 | TensorFlow Playground, spiral needs ~4×8 hidden | useful | no code; one line in the Lab 2 panel (vanishing gradients) | explain | Lab 2 panel |
| lab2-t2-geron-model-b-on-a | Lab 2 T2 + Géron Ch 11 cells 66–72 | `model_B_on_A`, clone, freeze, recompile | core | same procedure as L2 s31 | explain, count | transfer-b-on-a (cross-link; Géron's clone step in its Slide check) |
| lab2-t2-optimizer-table | Lab 2 T2 + Géron Ch 11 cells 78–104 | val accuracy per optimizer, 10 epochs | useful | evidence only; SGD and momentum outputs are identical in the saved notebook | — | — |
| lab2-t3-mnist-lr-search | Lab 2 T3 + Géron Ch 10 cells 192–206 | `ExponentialLearningRate` callback, MNIST MLP, callbacks | useful | the LR-search rule (L1 s60); the MLP is L1 s35's | explain | lab2-lr-search |
| lab3-t1-wine-mlp | Lab 3 T1 | 13 features → 3×Dense(5, GELU) → 3 softmax, IDs 1–3 → 0–2, argmax | core | sample-Q2(a)-style shapes/loss/head; the sheet's pitfall | draw, count, shapes | lab3-wine (reconstructed) |
| lab3-t2-winequality | Lab 3 T2 | 11 features → 8×Dense(5) → tanh + `Rescaling` to 3…9, mse/mae | useful | bounded regression head; cut from the cards for the 30-page PDF budget (the largest useful card); the Lab 3 panel keeps the model and the Rescaling(scale=3, offset=6) mapping | count, explain | — (Lab 3 panel) |
| lab4-load-data | Lab 4 p1 | `load_data` (verbatim on the sheet) | useful | its four arrays are Q2(a)i's shapes | shapes | lab4-clockwise |
| lab4-task1-geron | Lab 4 T1 | read Géron Ch 15 | cut | a read-through; the slides carry the code | — | — |
| lab4-task2-clockwise | Lab 4 T2 | SimpleRNN(16) → sigmoid, X (200, 4, 2), y (200,) | core | sample Q2(a) is this lab with stars | shapes, draw, count | lab4-clockwise (reconstructed) |
| lab4-task3-fourth-vertex | Lab 4 T3 | X[:, :3, :] (200, 3, 2) → X[:, 3, :] (200, 2), regression | core | sample Q2(a)i–iii | shapes, draw, count | lab4-next-vertex (reconstructed) |

## Project 1 (tuned CNN < 30k parameters vs retrained NASNetMobile)

| id | source | what | rating | reason | angle | card |
|---|---|---|---|---|---|---|
| p1-load-data | P1 §1 cell 3 | shapes (3700, 64, 64, 3) … | useful | the shapes line goes in the panel | shapes | P1 panel |
| p1-shuffle | P1 §1.1 cell 7 | shuffle class-ordered data | useful | why shuffle | explain | — (panel note) |
| p1-build-cnn | P1 §2.1 cell 15 | `build_cnn`: 4 × (Conv3x3 + MaxPool) → GAP → Dropout → Dense → softmax | core | the spec's architecture; GAP keeps it under 30k | draw, count | p1-cnn |
| p1-optimizer-es | P1 §2.2 cell 18 | Adam + ExponentialDecay (halve every 20 epochs), EarlyStopping | useful | eq ↔ code with L2 s53 | eq | — (lr-schedules cross-links it) |
| p1-search-space | P1 §2.3 cell 21 | `hp.Int` / `hp.Float` ranges, 972 combinations | core | the tuner's six hyperparameters (spec) | explain | p1-cnn |
| p1-tuner-run | P1 §2.4 cell 24 | `BayesianOptimization(max_trials=15)`, best summary 16,570 | core | the best CNN's counts | count | p1-cnn (Count it + Slide check) |
| p1-nasnet-base | P1 §3.1 cell 31 | NASNetMobile 224×224, `include_top=False`, frozen | core | spec: frozen pretrained base | explain | p1-nasnet |
| p1-nasnet-preprocess | P1 §3.1 cell 32 | Rescaling(1/127.5, −1) == `preprocess_input` | useful | why [−1, 1] | explain | p1-nasnet (legend) |
| p1-nasnet-head | P1 §3.2 cell 34 | Resizing → Rescaling → base → GAP → Dense(64) → Dense(10) | core | spec head ≤ 80 neurons; 68,298 trainable | draw, count | p1-nasnet |
| p1-nasnet-train | P1 §3.3 cell 38 | compile + fit, 2.2 minutes, 17 epochs | useful | result in the panel | — | P1 panel |
| p1-results | P1 §4.3 cell 48 | classification reports; 0.620 vs 0.860 | useful | the comparison result, verbatim | — | P1 panel |

## Project 2 (Perth temperatures: three GRU forecasters + a VAE)

| id | source | what | rating | reason | angle | card |
|---|---|---|---|---|---|---|
| p2-load-data | P2 §2 cell 4 | shapes (1522, 84, 2), (313, 84, 2), (297, 96, 2) | useful | the panel's Data line | shapes | P2 panel |
| p2-data-stats | P2 §2 cell 5 | per-split means and stds | cut | analysis | — | — |
| p2-split-sequences | P2 §3 cell 9 | X = first 72 months, y = next 12 | core | the project's shapes question | shapes | p2-gru (Shapes) |
| p2-display-temperatures | P2 §4 cells 11–12 | plotting helper | cut | plotting | — | — |
| p2-helpers-build-gru | P2 §5 cell 15 | `scaling_layers`, `build_gru_model`, `train_model` | core | models 1 and 2's architecture | draw, count, explain | p2-gru |
| p2-model1 | P2 §6 cell 17 | model 1 summary: 960 / 1,632 / 408 = 3,000 | core | GRU count with in = 2 | count | p2-gru (Count it + Slide check) |
| p2-model1-results | P2 §6 cells 18, 20 | test MAE 1.250 | useful | panel result | — | P2 panel |
| p2-model2 | P2 §7 cell 23 | `build_gru_model(1)`, Dense(2), 2,626 | core | "change only the output layer" | count | p2-gru (legend) |
| p2-model2-train | P2 §7 cells 24, 26 | trained on y[:, :1]; test MAE 1.188 (1 month) | useful | shapes (1522, 1, 2) | shapes | p2-gru (legend) |
| p2-predict-recursively | P2 §7 cell 28 | slide a 72-month window, 12 times | core | the spec's for loop; vs L4 s34 | explain, shapes | p2-gru |
| p2-encoder-decoder | P2 §8 cell 31 | two-layer GRU encoder–decoder, states handed over, teacher forcing | core | model 3 (22 % of the mark); `initial_state` | draw, count, explain | p2-encdec |
| p2-model3-train-test | P2 §8 cells 32, 34 | two inputs; test MAE 1.321 | useful | panel result | — | P2 panel |
| p2-horizons | P2 §9 cell 37 | MAE for horizons 12…24 | useful | the comparison the spec asks for | — | P2 panel |
| p2-per-channel | P2 §9 cell 38 | per-channel MAE and bias | cut | analysis | — | — |
| p2-vae-data | P2 §10 cell 42 | max channel, z-scores (1522, 84) | useful | VAE input shape | shapes | p2-vae (Shapes) |
| p2-vae | P2 §11 cell 44 | `Sampling` with KL, Conv1D encoder, Conv1DTranspose decoder | core | the project's VAE (sample Q2(b)); encoder 8,072 | eq, count, explain | p2-vae |
| p2-vae-train | P2 §11 cell 45 | trained 43 epochs; reconstruction MAE 0.940 | useful | panel result | — | P2 panel |
| p2-vae-synthesis | P2 §12 cell 48 | 6 codings from N(0, I) → decode | useful | the spec's "randomly sampling 6 codings" | explain | p2-vae (legend) |

## Slide and version quirks seen on candidates that are not on the page

- **L1 s13** `astype(np.int)` raises AttributeError on NumPy ≥ 1.24 (use `int`). Not carded: the perceptron code is sklearn.
- **L9 s17** prints `gym.make("CartPole-v1", reader_mode="rgb_array")`; Gymnasium 1.3.0 raises TypeError; the argument is `render_mode`. On the page as the gym-loop card's Slide check.
- **L1 s48** `self.output = ...` fails in Keras 3 (read-only property). **L2 s31** omits Géron's clone step and wraps a comment without `#`. **L3 s51** typesets `base_model =` alone on a line. **L4 s41** puts a `SimpleRNNCell` straight into `Sequential`. **L8 s17** has a `for` loop whose body is only a comment. **L9 s63** `tf.keras.losses.mean_squared_error` doesn't exist in Keras 3.15.1 (use `mse`).
