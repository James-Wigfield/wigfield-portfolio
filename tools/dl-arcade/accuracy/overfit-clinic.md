# Accuracy check: Overfit Clinic (`overfit-clinic`)

Date 2026-10-23 · checker: fresh agent · sources: lect01 s52, 59–62 · lect02 s4–8, 10–12, 22, 23, 25, 29–31, 33, 38, 40–42, 48, 49, 60–64 · lect03 s34, 39, 40 · lect04 s24–26, 29, 40–42, 48 · lect05 s10 · lect06-07 s26–29 · lect08 s5–7, 18–20, 31, 37, 38 (pdftotext; L2 s6, 7, 11, 38, 41 and L8 s18, 37, 38 rendered at 110 dpi). Transcript checked for the L2 s60 `l1(...)` misprint and the L8 s38 `1/d_keys` quirk.
Files read: `games/overfit-clinic/*` (OverfitClinic, charts, plot, glyph, index), `content/overfit-clinic.js`, `maths/overfitClinic.js`, the 38 concept ids in `content/lecture{1,2,3,4,5,67,8}.js`, drawer equations in `lecture2.js` / `lecture8.js`.
Blind sample: **91 items** (L1 seed 12 · L2 seeds 4, 11 · L3 seeds 3, 6, 7, 9, 10, 11, 12), covering all 23 cases and all 12 follow-up types. **91 / 91 match.** Extra checks: a Keras-style EarlyStopping simulation on 3,000 generated runs agrees with the game's stop epoch every time (and never lands past the last epoch). Every Rx case's distractor pool was listed and judged. The game's `check-overfit-clinic.mjs` passes (26,427 checks).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Overfitting (deep model, few instances); "insufficient labelled data" | `DIAGNOSES.overfit`, `.fewLabels` | L2 · 4 | VERIFIED | – |
| 2 | LR too high → diverges; too low → converges but takes very long | `DIAGNOSES.lrHigh`, `.lrLow` | L2 · 48 | VERIFIED | – |
| 3 | Large batch → instabilities esp. at start; warmup suggested | `DIAGNOSES.bigBatch`, `FIXES.warmup`, `l1-big-batch` | L1 · 61 | VERIFIED | – |
| 4 | Vanishing / exploding wording; logistic + N(0,1) as the cause | `DIAGNOSES.vanishing/.exploding`, `l2-vanishing` complaint + dxWhy | L2 · 5, 6 (rendered) | VERIFIED | – |
| 5 | Dying ReLUs: stop outputting anything but 0; input to ReLU negative | `DIAGNOSES.deadRelu`, `l2-dying-relu` dxWhy | L2 · 10 | VERIFIED | – |
| 6 | AdaGrad stops too early, before the global optimum; `Adagrad(learning_rate=0.001)` | `DIAGNOSES.adagrad`, `l2-adagrad` | L2 · 40 | VERIFIED | – |
| 7 | Kernels too large: "a common mistake" | `DIAGNOSES.bigKernel` | L3 · 34 | VERIFIED | – |
| 8 | SimpleRNN(1): tanh range −1…+1 vs series 0…1.4; 1 neuron, 3 params, memory extremely limited; MAE > 100,000 | `DIAGNOSES.tanhRange/.tinyMemory`, `l4-rnn1*` | L4 · 24, 25, 26 | VERIFIED | – |
| 9 | deep_model 5,281 params, MAE ≈ 29,672 > 27,703: "a bit too large for our task" | `DIAGNOSES.tooBig`, `l4-deep` | L4 · 26, 29 | VERIFIED | – |
| 10 | ReLU in RNNs → exploding outputs; long sequences → first inputs forgotten | `DIAGNOSES.rnnExplode/.shortMemory`, `l4-relu-rnn`, `l4-forget` | L4 · 40, 42 | VERIFIED | (the term "short-term memory" comes from L8 · 19; the L4 slides say "forget the first inputs") |
| 11 | AE too powerful: maps each input to one number, reconstructs training data, won't generalize | `DIAGNOSES.aeCopy`, `l5-too-powerful` | L5 · 10 | VERIFIED | – |
| 12 | Mode collapse = biggest difficulty, one class only; oscillating unstable params; GAN "forgets"; no better after epoch 1 | `DIAGNOSES.modeCollapse/.ganUnstable`, `l67-*` | L6–7 · 26, 27 | VERIFIED | – |
| 13 | Masked MHA doesn't attend to later words; causal; done by the masking op | `DIAGNOSES.noMask`, `FIXES.mask`, `l8-no-mask` | L8 · 31 | VERIFIED | – |
| 14 | Only the final state reaches the decoder; the path soccer→fútbol is "quite long" | `DIAGNOSES.finalState`, `l8-bottleneck` | L8 · 18, 20 | VERIFIED | – |
| 15 | Unscaled scores saturate the softmax → tiny gradients | `DIAGNOSES.saturatedSoftmax` | L8 · 38 (rendered) | VERIFIED | – |
| 16 | A regular recurrent layer is causal; "the right arm / person / to criticize" | `DIAGNOSES.causalEncoder`, `l8-causal-encoder` | L8 · 6 | VERIFIED | – |
| 17 | `EarlyStopping(patience=10, restore_best_weights=True)`; grow until it overfits, then early stop; no need to tune iterations | `FIXES.earlyStop`, `l1-overfit` rx why | L1 · 52, 59, 62 | VERIFIED | – |
| 18 | `kernel_regularizer=l2(0.01)`; reg. loss added each step; `l1_l2` for both (the transcript misprints the ℓ1 line, the PDF prints `l1(...)`) | `FIXES.l2`, `l2-overfit` rx + `fuBy.l2` | L2 · 60 | VERIFIED | – |
| 19 | Dropout p 10–50 %, output neurons never dropped; `Dropout(rate=0.2)` before each Dense; evaluate training loss without dropout; no dropping at test | `FIXES.dropout`, `fuBy.dropout` | L2 · 62, 63, 64 | VERIFIED | – |
| 20 | Data augmentation: realistic variants; shift/rotate/resize; AlexNet flips + lighting; counts as regularization | `FIXES.augment`, `l3-overfit` | L3 · 39, 40 | VERIFIED | – |
| 21 | Optimal LR ≈ half the max (divergence) LR | `FIXES.lrLower`, `l1-lr-high` | L1 · 60 | VERIFIED | – |
| 22 | Too-small LR → "start high, then reduce" (a learning schedule) | `FIXES.lrSchedule`, `l2-lr-low` rx | L2 · 48, 49 | VERIFIED | (s49 frames it as reaching a good solution faster; s48 opens the scheduling section) |
| 23 | Glorot: mean 0, σ² = 1/fan_avg for logistic; Table 11-1 Glorot / He 2/fan_in / LeCun 1/fan_in | `FIXES.init`, `l2-vanishing` rx + fu | L2 · 7, 8 (rendered) | VERIFIED | – |
| 24 | Nonsaturating activations (ReLU and variants) for vanishing gradients; logistic saturates at 0/1 | `FIXES.nonsat`, `rx.nonsat` | L2 · 6, 10, 11 | VERIFIED | (concept `act.which` is s22; `act.relu` s10 would match the src better) |
| 25 | BN in each hidden layer, mean 0 / var 1; vanishing so reduced that tanh became usable; treats vanishing + exploding | `FIXES.bn`, `rx.bn` | L2 · 23, 25 | VERIFIED | – |
| 26 | Clipping lessens exploding gradients; `SGD(clipvalue=1.0)` clips each component to [−1, 1]; clipnorm keeps the orientation | `FIXES.clip`, `l2-exploding` rx + fu | L2 · 29 | VERIFIED | – |
| 27 | Leaky ReLU max(αz, z), e.g. α = 0.01, 0.2 better; Keras default 0.3; `negative_slope=0.2` | `FIXES.leaky`, `l2-dying-relu` rx + fu | L2 · 11 (rendered), 12 | VERIFIED | – |
| 28 | AdaGrad s ← s + ∇J⊗∇J, θ ← θ − η∇J⊘√(s+ε); RMSProp ρs + (1−ρ)∇J⊗∇J with ρ = 0.9; `RMSprop(learning_rate=0.001, rho=0.9)` | `FIXES.rmsprop`, `l2-adagrad` rx + fu, chart sim, drawer TeX | L2 · 38, 41 (rendered), 42 | VERIFIED | – |
| 29 | Transfer: reuse lower layers, replace the output layer; model_A 8 classes (not sandal/shirt), 200 images, 91.85 %; `layers[:-1]` + Dense(1, sigmoid) | `FIXES.transfer`, `l2-transfer`, `CODE.fewLabels` | L2 · 30, 31 | VERIFIED | – |
| 30 | Step order freeze → compile → fit 4 → unfreeze → recompile → fit 16; SGD(0.001) both times | `l2-transfer` fu `order` | L2 · 31 | VERIFIED | – |
| 31 | Two 3×3 instead of one 5×5: fewer params, less compute, usually better; the first conv may keep 5×5 with stride ≥ 2 | `FIXES.stack3`, `l3-big-kernel` rx + `keepLayer` fu | L3 · 34 | VERIFIED | – |
| 32 | Param comments and drawer arithmetic (e.g. 25·128·128+128 = 409,728 vs 2×(9·128·128+128) = 295,168) | `bigKernel()`, `DRAWER.bigKernel` | L3 · 34 (rule) | VERIFIED | – |
| 33 | Slide 26's joint fix ("to fix these two issues": 32 neurons AND Dense(1), no activation) is split as Dense(1) → range, 32 neurons → memory; the other half is always a distractor (100 % of l4-rnn1 Rx, l4-rnn1-memory Rx and the rx2 follow-up) | `FIXES.denseOut/.biggerRnn`, `l4-rnn1` rx/fu, `l4-rnn1-memory` rx | L4 · 25, 26 | AMBIGUOUS | The logic holds (tanh caps the layer however wide it is), but the slide never says which fix answers which reason. Say so in the why: "slide 26 makes both changes together; the Dense(1) is the part that lifts the range" (and the reverse for memory) |
| 34 | Smaller LR or a saturating activation (tanh, hence the default); ReLU may not help in RNNs | `FIXES.rnnTanh`, `l4-relu-rnn` rx | L4 · 40 | VERIFIED | – |
| 35 | Layer norm works better for RNNs and normalizes across the features dimension; BN at each time step doesn't do well | `l4-relu-rnn` fu | L4 · 41 | VERIFIED | – |
| 36 | LSTM: converges faster, detects long-term dependencies; GRU: merged state, z(t) controls forget + input, no output gate | `FIXES.lstm`, `l4-forget` rx + fu | L4 · 42, 48 | VERIFIED | – |
| 37 | An autoencoder that is "not so powerful" | `FIXES.lessPowerful` | L5 · 10 | VERIFIED | – |
| 38 | DCGAN guidelines (strided/transposed convs, BN except G-out/D-in, no FC hidden layers, ReLU + tanh output in G, leaky ReLU in D; "not always"); slots ReLU / tanh / leaky ReLU; s29's D ends in a sigmoid Dense | `FIXES.dcgan`, `l67-unstable` rx + slots fu | L6–7 · 28, 29 | VERIFIED | nit: the why drops "for deeper architectures" from the FC rule |
| 39 | Attention: all encoder outputs are sent; the decoder's memory cell computes a weighted sum at each step; shorter path; > 30 words | `FIXES.attention`, `l8-bottleneck` rx + fu | L8 · 19, 20 | VERIFIED | – |
| 40 | "Path: 4 steps" from x(2) "soccer" → final state → decoder cells 0…3 → "fútbol" | `encdec()`, `l8-bottleneck` dxWhy | L8 · 18 (Figure 16-3 rendered) | VERIFIED | (the count is the page's own; the slide says "quite long") |
| 41 | softmax(QKᵀ/√d_keys)V; QKᵀ shape [n_queries, n_keys], the softmax keeps it, rows sum to 1; quirk "s38's bullet prints 1/d_keys, the equations on s37 and s38 have √" | `FIXES.scale`, `l8-unscaled` rx + `shape` fu, drawer TeX | L8 · 37, 38 (rendered) | VERIFIED | – |
| 42 | Bidirectional layer: two layers, L→R and R→L, outputs concatenated at each step | `FIXES.bidir` | L8 · 7 | VERIFIED | – |
| 43 | Causal mask: "el" may attend to <sos>, Me, gusta, el (itself and earlier words) | `l8-no-mask` `maskSet` fu, `causalMask` | L8 · 31 | VERIFIED | – |
| 44 | Stop epoch = argmin(validation) + 10 | `overfit()` facts, `stopEpoch` fu | L1 · 52 | VERIFIED | re-simulated with Keras semantics on 3,000 runs: 3,000 / 3,000 agree, never beyond E |
| 45 | Sweep from 10⁻⁵ to 10 in 500 iterations; optimal ≈ 10× lower than where the loss starts to shoot up | `sweep()`, `l1-lr-high` sweep fu | L1 · 60 | VERIFIED | – |
| 46 | **"A nonsaturating activation: ReLU or one of its variants" is offered as a WRONG Rx for oscillating GAN parameters** (≈ 16 % of l67-unstable Rx items), though slide 28's stable-GAN guidelines prescribe ReLU (G) and leaky ReLU (D). `leaky` already avoids `ganUnstable`; `nonsat` does not | `FIXES.nonsat.avoid` | L6–7 · 28 | WRONG | add `'ganUnstable'` to `FIXES.nonsat.avoid` |
| 47 | "A smaller learning rate or a saturating activation (tanh)" is offered as a wrong Rx for big-batch instability (≈ 11 %) and GAN instability (≈ 15 %), while `lrLower` already avoids both cases as arguably helpful | `FIXES.rnnTanh.avoid` | L1 · 61; L6–7 · 27, 28 | AMBIGUOUS | add `'bigBatch'`, `'ganUnstable'` to `FIXES.rnnTanh.avoid` (matching `lrLower`) |
| 48 | "Dropout" is offered as a wrong Rx for GAN instability (≈ 16 %); slide 29's DCGAN discriminator uses `Dropout(0.4)` (it is not one of slide 28's guidelines) | `FIXES.dropout.avoid` | L6–7 · 28, 29 | AMBIGUOUS | optional: add `'ganUnstable'` to `FIXES.dropout.avoid` |
| 49 | All other Rx distractor pools (22 cases enumerated): never a fix the cited slide allows (e.g. init / faster optimizer / dropout / clip / lower LR are all kept off ReLU-RNN per L4 s40; BN/init off exploding; attention/bidir off forgetting; BN off lrHigh/lrLow per L2 s25) | `eligibleWrongFixes`, `treats`/`avoid` | as cited | VERIFIED | – |
| 50 | Dx distractor pools avoid the close calls (vanishing/AdaGrad off slow LR; overfit off too-big RNN / AE; range vs memory; exploding vs RNN-explode vs lrHigh; finalState vs forgetting/causal) | `DIAGNOSES.*.avoid`, `avoidSet` | as cited | VERIFIED | – |
| 51 | The L3 follow-up says "This network keeps its logistic activation…", but the case card has already recorded Rx = "A nonsaturating activation: ReLU…" (`fuRx` includes `nonsat`) | `l2-vanishing` `fuRx`, `fu.prompt` | L2 · 8 | AMBIGUOUS | reword to "Had it kept its logistic activation, which initialization…?" or set `fuRx: ['bn']` |
| 52 | rx2 follow-up: "Slide 25 gives a **second** reason" (slide 25's reason is numbered 1; the case's tanh reason is slide 26's no. 2) | `l4-rnn1` `fu.prompt` | L4 · 25, 26 | AMBIGUOUS | "Slide 25 gives the other reason (reason 1)…" |
| 53 | Chart provenance: maeBars (27,703 / 29,672), rnn1Summary (s25 summary, 3 params), fewLabels (s31 numbers) are captioned "drawn from the numbers printed on the slides"; all others "this page's own illustration" | `fromSlides`, `UI.fromSlides/own` | L4 · 25, 26, 29; L2 · 31 | VERIFIED | – |
| 54 | Intro: every patient brings a chart "(this page's own illustration of the failure)", but 3 chart types are drawn from slide numbers (the maths header comment likewise names only maeBars) | `INTRO.controls[0]` | – | AMBIGUOUS | "(mostly this page's own illustration; a few are drawn from the slides' numbers)" |
| 55 | Drawer TeX (AdaGrad, logistic, Glorot normal, ReLU, leaky ReLU, SDPA) and `rnn1Summary` 1·1 + 1·1 + 1 = 3 | `TEX`, `DRAWER` | L2 · 6, 7, 10, 11, 38; L4 · 25; L8 · 37, 38 | VERIFIED | – |
| 56 | All 38 concept ids exist and their `slides` teach them; SLIDE_COUNTS 64/68/53/52/27/32/51 match the PDFs | `index.js` concepts, `SLIDE_COUNTS` | lecture content files | VERIFIED | – |

## Blind sample (91 items; worked from the chart data and the slides first, then compared)

Working for the numeric and ordering follow-ups (row numbers refer to the table below):
- Row 40, stop epoch: the validation loss is lowest (0.25) at epoch 21 (19: 0.27, 20: 0.28, 22–31 ≥ 0.27), so the wait reaches 10 after epoch 31.
- Row 46, AdaGrad s: 0 + 5² = 25, then 25 + 4² = 41 (RMSProp would give 0.9·2.5 + 1.6 = 3.85, which is one of the distractors).
- Row 52, clipvalue: [−1.72, −3.05, 0.83] → [−1.00, −1.00, 0.83] (each component clipped to [−1, 1]).
- Row 79, sweep: the loss is flat at ≈ 0.33 up to index 82 and reads 0.38 at index 83 (η = 10^(−5 + 6·83/124) ≈ 0.10), then 0.62, 0.96 … So it shoots up at η ≈ 0.1 and the optimal rate is ≈ 0.01.
- Rows 34 and 43, QKᵀ: [4, 6] and [3, 5] ([n_queries, n_keys]; d_keys is summed out).
- Rows 64 and 91, the mask for "el" (index 3): <sos>, Me, gusta, el.
- Rows 31 and 70, step order: freeze → compile → fit 4 → unfreeze → recompile → fit 16. Rows 49 and 88, slots: ReLU / tanh / leaky ReLU.
- Param checks (rows 5, 13, 23, 65): 5·5·3·64 + 64 = 4,864; 9·64·128 + 128 = 73,856; 25·128·128 + 128 = 409,728; 75·32 + 32 = 2,432; 9·32·64 + 64 = 18,496; 25·64·64 + 64 = 102,464; 9·32·128 + 128 = 36,992.

| # | round | case | prompt | my answer | game's answer | match |
|---|---|---|---|---|---|---|
| 1 | L1·s12 | l67-mode-collapse | Dx · A GAN on Fashion MNIST: 100 generated images, sorted by cla… | Mode collapse | Mode collapse | yes |
| 2 | L1·s12 | l1-big-batch | Dx · Batch size: the largest that fits in the GPU RAM. | Large batch size: unstable at the start of training | Large batch size: unstable at the start of training | yes |
| 3 | L1·s12 | l2-transfer | Dx · model_B: the T-shirt and pullover classes of Fashion MNIST … | Insufficient labelled data | Insufficient labelled data | yes |
| 4 | L1·s12 | l5-too-powerful | Dx · A stacked autoencoder whose coding layer is a single number. | An autoencoder that is too powerful | An autoencoder that is too powerful | yes |
| 5 | L1·s12 | l3-big-kernel | Dx · A CNN for 3-channel images, as built (the comments give eac… | Convolution kernels that are too large | Convolution kernels that are too large | yes |
| 6 | L1·s12 | l4-rnn1-memory | Dx · model.summary() of slide 24’s SimpleRNN(1) forecaster; its … | One recurrent neuron: extremely limited memory | One recurrent neuron: extremely limited memory | yes |
| 7 | L1·s12 | l4-deep | Dx · deep_model: three stacked SimpleRNN(32) layers + Dense(1), … | A deep RNN a bit too large for the task | A deep RNN a bit too large for the task | yes |
| 8 | L1·s12 | l8-unscaled | Dx · Attention weights softmax(QKᵀ) with d_keys = 128, computed … | Unscaled scores saturating the softmax | Unscaled scores saturating the softmax | yes |
| 9 | L2·s4 | l1-big-batch | Dx · Batch size: the largest that fits in the GPU RAM. | Large batch size: unstable at the start of training | Large batch size: unstable at the start of training | yes |
| 10 | L2·s4 | l1-big-batch | Rx · Large batch size: unstable at the start of traini… | Learning rate warmup | Learning rate warmup | yes |
| 11 | L2·s4 | l5-too-powerful | Dx · A stacked autoencoder whose coding layer is a single number. | An autoencoder that is too powerful | An autoencoder that is too powerful | yes |
| 12 | L2·s4 | l5-too-powerful | Rx · An autoencoder that is too powerful | An autoencoder that is not so powerful | An autoencoder that is not so powerful | yes |
| 13 | L2·s4 | l3-big-kernel | Dx · A CNN for 3-channel images, as built (the comments give eac… | Convolution kernels that are too large | Convolution kernels that are too large | yes |
| 14 | L2·s4 | l3-big-kernel | Rx · Convolution kernels that are too large | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | yes |
| 15 | L2·s4 | l4-rnn1-memory | Dx · model.summary() of slide 24’s SimpleRNN(1) forecaster; its … | One recurrent neuron: extremely limited memory | One recurrent neuron: extremely limited memory | yes |
| 16 | L2·s4 | l4-rnn1-memory | Rx · One recurrent neuron: extremely limited memory | A larger recurrent layer, say 32 recurrent neurons | A larger recurrent layer, say 32 recurrent neurons | yes |
| 17 | L2·s4 | l8-causal-encoder | Dx · A one-directional recurrent encoder for translation; its ou… | A causal encoder that cannot look ahead | A causal encoder that cannot look ahead | yes |
| 18 | L2·s4 | l8-causal-encoder | Rx · A causal encoder that cannot look ahead | A bidirectional recurrent layer | A bidirectional recurrent layer | yes |
| 19 | L2·s11 | l1-overfit | Dx · An MLP’s learning curves, one point per epoch. | Overfitting the training set | Overfitting the training set | yes |
| 20 | L2·s11 | l1-overfit | Rx · Overfitting the training set | Early stopping: EarlyStopping(patience=10, restore_best_wei… | Early stopping: EarlyStopping(patience=10, restore_best_wei… | yes |
| 21 | L2·s11 | l2-lr-low | Dx · Training loss after many epochs of gradient descent. | Learning rate too small: training is slow | Learning rate too small: training is slow | yes |
| 22 | L2·s11 | l2-lr-low | Rx · Learning rate too small: training is slow | Start with a high learning rate, then reduce it (a learning… | Start with a high learning rate, then reduce it (a learning… | yes |
| 23 | L2·s11 | l3-big-kernel | Dx · A CNN for 3-channel images, as built (the comments give eac… | Convolution kernels that are too large | Convolution kernels that are too large | yes |
| 24 | L2·s11 | l3-big-kernel | Rx · Convolution kernels that are too large | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | yes |
| 25 | L2·s11 | l8-no-mask | Dx · Decoder self-attention while translating “I like soccer” (d… | The decoder attends to later words: no causal mask | The decoder attends to later words: no causal mask | yes |
| 26 | L2·s11 | l8-no-mask | Rx · The decoder attends to later words: no causal mask | The masking operation: masked multi-head attention | The masking operation: masked multi-head attention | yes |
| 27 | L2·s11 | l4-relu-rnn | Dx · SimpleRNN(32, activation="relu") trained on long sequences. | Unstable gradients in an RNN: exploding outputs | Unstable gradients in an RNN: exploding outputs | yes |
| 28 | L2·s11 | l4-relu-rnn | Rx · Unstable gradients in an RNN: exploding outputs | A smaller learning rate or a saturating activation (tanh) | A smaller learning rate or a saturating activation (tanh) | yes |
| 29 | L3·s3 | l2-transfer | Dx · model_B: the T-shirt and pullover classes of Fashion MNIST … | Insufficient labelled data | Insufficient labelled data | yes |
| 30 | L3·s3 | l2-transfer | Rx · Insufficient labelled data | Transfer learning: reuse a similar model’s layers, new outp… | Transfer learning: reuse a similar model’s layers, new outp… | yes |
| 31 | L3·s3 | l2-transfer | FU · Put slide 31’s training steps for model_B_on_A in order. | freeze → compile → fit4 → unfreeze → recompile → fit16 | freeze → compile → fit4 → unfreeze → recompile → fit16 | yes |
| 32 | L3·s3 | l8-unscaled | Dx · Attention weights softmax(QKᵀ) with d_keys = 128, computed … | Unscaled scores saturating the softmax | Unscaled scores saturating the softmax | yes |
| 33 | L3·s3 | l8-unscaled | Rx · Unscaled scores saturating the softmax | Scale the similarity scores by 1/√d_keys | Scale the similarity scores by 1/√d_keys | yes |
| 34 | L3·s3 | l8-unscaled | FU · Q holds 4 queries and K holds 6 keys, each of size d_keys = 128. What is the sh… | [4, 6] | [4, 6] | yes |
| 35 | L3·s3 | l4-relu-rnn | Dx · SimpleRNN(32, activation="relu") trained on long sequences. | Unstable gradients in an RNN: exploding outputs | Unstable gradients in an RNN: exploding outputs | yes |
| 36 | L3·s3 | l4-relu-rnn | Rx · Unstable gradients in an RNN: exploding outputs | A smaller learning rate or a saturating activation (tanh) | A smaller learning rate or a saturating activation (tanh) | yes |
| 37 | L3·s3 | l4-relu-rnn | FU · You also want normalization in this RNN. Which has been reported to work better? | Layer normalization, across the features dimension | Layer normalization, across the features dimension | yes |
| 38 | L3·s9 | l1-overfit | Dx · An MLP’s learning curves, one point per epoch. | Overfitting the training set | Overfitting the training set | yes |
| 39 | L3·s9 | l1-overfit | Rx · Overfitting the training set | Early stopping: EarlyStopping(patience=10, restore_best_wei… | Early stopping: EarlyStopping(patience=10, restore_best_wei… | yes |
| 40 | L3·s9 | l1-overfit | FU · Train this run again with EarlyStopping(patience=10). After which epoch is trai… | epoch 31 | epoch 31 | yes |
| 41 | L3·s9 | l8-unscaled | Dx · Attention weights softmax(QKᵀ) with d_keys = 256, computed … | Unscaled scores saturating the softmax | Unscaled scores saturating the softmax | yes |
| 42 | L3·s9 | l8-unscaled | Rx · Unscaled scores saturating the softmax | Scale the similarity scores by 1/√d_keys | Scale the similarity scores by 1/√d_keys | yes |
| 43 | L3·s9 | l8-unscaled | FU · Q holds 3 queries and K holds 5 keys, each of size d_keys = 256. What is the sh… | [3, 5] | [3, 5] | yes |
| 44 | L3·s9 | l2-adagrad | Dx · optimizer = tf.keras.optimizers.Adagrad(learning_rate=0.001) | AdaGrad stopping too early | AdaGrad stopping too early | yes |
| 45 | L3·s9 | l2-adagrad | Rx · AdaGrad stopping too early | RMSProp: RMSprop(learning_rate=0.001, rho=0.9) | RMSProp: RMSprop(learning_rate=0.001, rho=0.9) | yes |
| 46 | L3·s9 | l2-adagrad | FU · One weight’s gradients are 5 and then 4, with s starting at 0. What is AdaGrad’… | 41 | 41 | yes |
| 47 | L3·s10 | l67-unstable | Dx · A GAN whose images never really get much better after the f… | Oscillating, unstable GAN parameters | Oscillating, unstable GAN parameters | yes |
| 48 | L3·s10 | l67-unstable | Rx · Oscillating, unstable GAN parameters | Follow the DCGAN guidelines for stable convolutional GANs | Follow the DCGAN guidelines for stable convolutional GANs | yes |
| 49 | L3·s10 | l67-unstable | FU · Set the activations the DCGAN guidelines name. | relu → tanh → leaky | relu → tanh → leaky | yes |
| 50 | L3·s10 | l2-exploding | Dx · A deep network; the size of the gradient reaching each laye… | Exploding gradients | Exploding gradients | yes |
| 51 | L3·s10 | l2-exploding | Rx · Exploding gradients | Gradient clipping: SGD(clipvalue=1.0) | Gradient clipping: SGD(clipvalue=1.0) | yes |
| 52 | L3·s10 | l2-exploding | FU · With SGD(clipvalue=1.0), what becomes of the gradient vector [-1.72, -3.05, 0.8… | [-1.00, -1.00, 0.83] | [-1.00, -1.00, 0.83] | yes |
| 53 | L3·s10 | l8-bottleneck | Dx · Figure 16-3’s encoder–decoder, translating “I like soccer” … | Only the encoder’s final state reaches the decoder | Only the encoder’s final state reaches the decoder | yes |
| 54 | L3·s10 | l8-bottleneck | Rx · Only the encoder’s final state reaches the decoder | Attention: a weighted sum of all the encoder outputs at eac… | Attention: a weighted sum of all the encoder outputs at eac… | yes |
| 55 | L3·s10 | l8-bottleneck | FU · With attention added, what does the decoder’s memory cell compute at each time … | A weighted sum of all the encoder outputs | A weighted sum of all the encoder outputs | yes |
| 56 | L3·s12 | l2-vanishing | Dx · A deep MLP: logistic (sigmoid) activations, weights drawn f… | Vanishing gradients | Vanishing gradients | yes |
| 57 | L3·s12 | l2-vanishing | Rx · Vanishing gradients | A nonsaturating activation: ReLU or one of its variants | A nonsaturating activation: ReLU or one of its variants | yes |
| 58 | L3·s12 | l2-vanishing | FU · This network keeps its logistic activation. Which initialization does Table 11-… | Glorot · σ² = 1/fan_avg | Glorot · σ² = 1/fan_avg | yes |
| 59 | L3·s12 | l4-rnn1 | Dx · model = Sequential([InputLayer(shape=[None, 1]), SimpleRNN(… | tanh output: only values between −1 and +1 | tanh output: only values between −1 and +1 | yes |
| 60 | L3·s12 | l4-rnn1 | Rx · tanh output: only values between −1 and +1 | A Dense(1) output layer with no activation | A Dense(1) output layer with no activation | yes |
| 61 | L3·s12 | l4-rnn1 | FU · Slide 25 gives a second reason, and this summary shows it. Which fix answers th… | A larger recurrent layer, say 32 recurrent neurons | A larger recurrent layer, say 32 recurrent neurons | yes |
| 62 | L3·s12 | l8-no-mask | Dx · Decoder self-attention while translating “I like soccer” (d… | The decoder attends to later words: no causal mask | The decoder attends to later words: no causal mask | yes |
| 63 | L3·s12 | l8-no-mask | Rx · The decoder attends to later words: no causal mask | The masking operation: masked multi-head attention | The masking operation: masked multi-head attention | yes |
| 64 | L3·s12 | l8-no-mask | FU · With the mask in place, which words may “el” attend to? | <sos>, Me, gusta, el | <sos>, Me, gusta, el | yes |
| 65 | L3·s7 | l3-big-kernel | Dx · A CNN for 3-channel images, as built (the comments give eac… | Convolution kernels that are too large | Convolution kernels that are too large | yes |
| 66 | L3·s7 | l3-big-kernel | Rx · Convolution kernels that are too large | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | Two stacked 3 × 3 convolutional layers instead of one 5 × 5 | yes |
| 67 | L3·s7 | l3-big-kernel | FU · One convolutional layer may keep its large kernel. Which? | line 2: Conv2D(32, 5, strides=2) | line 2: Conv2D(32, 5, strides=2) | yes |
| 68 | L3·s7 | l2-transfer | Dx · model_B: the T-shirt and pullover classes of Fashion MNIST … | Insufficient labelled data | Insufficient labelled data | yes |
| 69 | L3·s7 | l2-transfer | Rx · Insufficient labelled data | Transfer learning: reuse a similar model’s layers, new outp… | Transfer learning: reuse a similar model’s layers, new outp… | yes |
| 70 | L3·s7 | l2-transfer | FU · Put slide 31’s training steps for model_B_on_A in order. | freeze → compile → fit4 → unfreeze → recompile → fit16 | freeze → compile → fit4 → unfreeze → recompile → fit16 | yes |
| 71 | L3·s7 | l4-forget | Dx · A simple RNN reading a long sequence. | Short-term memory: the first inputs are forgotten | Short-term memory: the first inputs are forgotten | yes |
| 72 | L3·s7 | l4-forget | Rx · Short-term memory: the first inputs are forgotten | LSTM cells (or GRU cells): long-term memory | LSTM cells (or GRU cells): long-term memory | yes |
| 73 | L3·s7 | l4-forget | FU · You pick the GRU, a simplified LSTM. Which gate does it not have? | The output gate | The output gate | yes |
| 74 | L3·s11 | l2-overfit | Dx · A deep MLP with many parameters and not many training insta… | Overfitting the training set | Overfitting the training set | yes |
| 75 | L3·s11 | l2-overfit | Rx · Overfitting the training set | ℓ2 regularization: kernel_regularizer=l2(0.01) | ℓ2 regularization: kernel_regularizer=l2(0.01) | yes |
| 76 | L3·s11 | l2-overfit | FU · You want ℓ1 and ℓ2 regularization together. Which regularizer? | tf.keras.regularizers.l1_l2(...) | tf.keras.regularizers.l1_l2(...) | yes |
| 77 | L3·s11 | l1-lr-high | Dx · Training loss of an MLP, one point per epoch. | Learning rate way too high: training diverges | Learning rate way too high: training diverges | yes |
| 78 | L3·s11 | l1-lr-high | Rx · Learning rate way too high: training diverges | Lower the learning rate (best: about half the rate where tr… | Lower the learning rate (best: about half the rate where tr… | yes |
| 79 | L3·s11 | l1-lr-high | FU · To find a good rate you sweep it from 10⁻⁵ to 10 over 500 iterations. Reading t… | η = 0.01 | η = 0.01 | yes |
| 80 | L3·s11 | l4-rnn1 | Dx · model = Sequential([InputLayer(shape=[None, 1]), SimpleRNN(… | tanh output: only values between −1 and +1 | tanh output: only values between −1 and +1 | yes |
| 81 | L3·s11 | l4-rnn1 | Rx · tanh output: only values between −1 and +1 | A Dense(1) output layer with no activation | A Dense(1) output layer with no activation | yes |
| 82 | L3·s11 | l4-rnn1 | FU · Slide 25 gives a second reason, and this summary shows it. Which fix answers th… | A larger recurrent layer, say 32 recurrent neurons | A larger recurrent layer, say 32 recurrent neurons | yes |
| 83 | L3·s6 | l2-dying-relu | Dx · A Dense(…, activation="relu") hidden layer, measured over t… | Dying ReLUs | Dying ReLUs | yes |
| 84 | L3·s6 | l2-dying-relu | Rx · Dying ReLUs | Leaky ReLU: LeakyReLU(negative_slope=0.2) | Leaky ReLU: LeakyReLU(negative_slope=0.2) | yes |
| 85 | L3·s6 | l2-dying-relu | FU · Which leak α did researchers find tends to give better performance? | α = 0.2 | α = 0.2 | yes |
| 86 | L3·s6 | l67-unstable | Dx · A GAN whose images never really get much better after the f… | Oscillating, unstable GAN parameters | Oscillating, unstable GAN parameters | yes |
| 87 | L3·s6 | l67-unstable | Rx · Oscillating, unstable GAN parameters | Follow the DCGAN guidelines for stable convolutional GANs | Follow the DCGAN guidelines for stable convolutional GANs | yes |
| 88 | L3·s6 | l67-unstable | FU · Set the activations the DCGAN guidelines name. | relu → tanh → leaky | relu → tanh → leaky | yes |
| 89 | L3·s6 | l8-no-mask | Dx · Decoder self-attention while translating “I like soccer” (d… | The decoder attends to later words: no causal mask | The decoder attends to later words: no causal mask | yes |
| 90 | L3·s6 | l8-no-mask | Rx · The decoder attends to later words: no causal mask | The masking operation: masked multi-head attention | The masking operation: masked multi-head attention | yes |
| 91 | L3·s6 | l8-no-mask | FU · With the mask in place, which words may “el” attend to? | <sos>, Me, gusta, el | <sos>, Me, gusta, el | yes |

## Summary
1. VERIFIED 49 · WRONG 1 · NOT IN SLIDES 0 · AMBIGUOUS 6 (0 beyond-marked). Blind sample 91/91 match. EarlyStopping stop epoch agrees with a Keras-style simulation on 3,000/3,000 runs. Own check passes (26,427).
2. Fix 1 (WRONG, ≈ 16 % of GAN-instability Rx items): add `'ganUnstable'` to `FIXES.nonsat.avoid`. Slide 28's stable-GAN guidelines prescribe ReLU / leaky ReLU, so "a nonsaturating activation" cannot be a wrong answer there.
3. Fix 2 (AMBIGUOUS, consistency): add `'bigBatch'` and `'ganUnstable'` to `FIXES.rnnTanh.avoid` ("a smaller learning rate" is what `lrLower` already avoids for those cases). Optionally add `'ganUnstable'` to `FIXES.dropout.avoid` (slide 29's DCGAN uses Dropout).
4. Fix 3 (AMBIGUOUS, wording): the `l2-vanishing` L3 follow-up says "keeps its logistic activation" right after a ReLU prescription (reword it, or set `fuRx: ['bn']`). Change the `l4-rnn1` rx2 prompt's "a second reason" to "the other reason (reason 1)".
5. Fix 4 (AMBIGUOUS, low): say in the l4-rnn1 / l4-rnn1-memory whys that slide 26 makes both changes together, and make the intro's "own illustration" line admit the three charts drawn from slide numbers. Nits: the dcgan why should keep "for deeper architectures", and `nonsat`'s concept fits `act.relu` better than `act.which`.
