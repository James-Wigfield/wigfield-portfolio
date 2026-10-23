# Accuracy check: Param Sniper (`param-sniper`)

Date: 2026-10-23. Checker: a fresh agent with no stake in the build. I read every file in `games/param-sniper/`, plus `content/param-sniper.js`, `maths/paramSniper.js`, the concept entries in `content/lecture{1,2,3,4,5,67,8}.js` and `core/concepts.js` (where concepts are merged). I checked against the PDFs (rendered: L1 s36, s45; L2 s24, s27; L3 s21; L4 s49) and the transcripts' Quirks sections.
Blind sample: **73 generated items** (level 1: seeds 101, 202; level 2: seeds 303, 404, 505; level 3: seeds 606, 707, 808), **73/73 match**. I also swept seeds 1–399 at level 3 to reach all 12 slide models and all 14 model/ask combinations; every printed answer matches its slide.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Dense = n_in × units + units; weights (n_in, units), biases (units,) | content RULES.Dense, howParams Dense | L1 · 36 (shapes (784, 300), (300,); 235,500) | VERIFIED | — |
| 2 | Flatten has 0 params; 28 × 28 → (None, 784); h × w × c in a row | RULES/SHAPE_RULES.Flatten | L1 · 36 | VERIFIED | — |
| 3 | Conv2D = (f_h·f_w·f_c + 1)·f_n; image size, stride and padding change nothing | RULES.Conv2D, howParams | L3 · 16, 22 | VERIFIED | — |
| 4 | "valid": side = n − f + 1 (70 × 120 → 64 × 114) | howShape Conv2D | L3 · 17–18, 20 ("6 fewer pixels") | VERIFIED | Wording: "each side loses f − 1" can read as each edge. Say "each dimension loses f − 1". |
| 5 | "same", stride 1 keeps H × W; one map per filter | howShape / SHAPE_RULES.Conv2D | L3 · 20 | VERIFIED | — |
| 6 | "same", stride 2 ≈ half (10 → 5) | SHAPE_RULES.Conv2D, howShape | L3 · 21 (figure: 10 inputs → 5 outputs) | VERIFIED | Unreachable: the generator always uses strides=1 for Conv2D. |
| 7 | Pooling has no weights (max/mean, stateless window) | RULES.MaxPool2D/AvgPool2D | L3 · 25, 29 | VERIFIED | — |
| 8 | 2 × 2 pool, stride 2 halves H, W and keeps the depth | howShape pool | L3 · 26, 29 (+ L6–7 · 5) | VERIFIED | — |
| 9 | GlobalAvgPool2D: 0 params; each map → one number, (None, C) | RULES/SHAPE_RULES.GlobalAvgPool2D | L3 · 29, 31 | VERIFIED | — |
| 10 | BN = 4 × features; γ, β trainable (2n); moving mean/var non-trainable (2n) | RULES.BatchNormalization, howParams | L2 · 23, 24, 27 (3,136; 2,368) | VERIFIED | The "moving average" wording is only on slide 23. Add 23 to `src` (the receipt shows 24, 27). |
| 11 | BN after Conv2D counts 4 × **channels** (e.g. 64 for 16 maps) | stack items Conv2D+BN (#53, #54; seed 1 trainable) | none: L2 BN is only shown on Dense features; L6–7 · 29 has no count | NOT IN SLIDES | Mark these stacks `beyond` with a note (per-channel, Keras axis = −1), or drop `['Conv2D','BatchNormalization']` from L3_STACKS. |
| 12 | SimpleRNN = n_in·u + u·u + u (W_x, W_h, b_h) | RULES.SimpleRNN, howParams | L4 · 9, 25, 27, 29 | VERIFIED | — |
| 13 | LSTM = 4 × (n_in·u + u·u + u), four FC layers i, f, o, g | RULES.LSTM, howParams | L4 · 44–47 (four FC), 43 (685) | VERIFIED | — |
| 14 | GRU = 3 × (n_in·u + u·u + 2u), Keras reset_after=True; intro says the same | RULES.GRU, howParams, INTRO | L4 · 49 (equations: one bias per gate; printed 1,401: two) + L4 Quirks | AMBIGUOUS | Slide 49 contradicts itself. The game uses the printed 1,401 and names both readings, which is acceptable. A `beyond` note would be honest, since reset_after is only in the transcript. |
| 15 | Level-1 GRU distractor 3 × (n_in·u + u·u + u) | paramSniper.js `distractors` GRU case | L4 · 49 equations give exactly this count | WRONG | A distractor that is right under the slide's own equations (e.g. 600 vs 624; 3,936 vs 4,032). Remove it from the GRU distractors. |
| 16 | Conv1D = k·c_in·f + f (slide 50 prints only the total) | RULES.Conv1D (beyond) | L4 · 50 (1,283) | VERIFIED (beyond) | — |
| 17 | Conv2DTranspose counted like Conv2D (3 × 3 × 16 × 32 + 32 = 4,640) | howParams Conv2DTranspose | L6–7 · 6 | VERIFIED | Small: when the item is 16 → 32, the "e.g." just repeats the same sum. |
| 18 | "slide 6 prints 4,464 = 3 × 3 × 16 × 32 + 32, 4,640 and 4,624" | RULES.Conv2DTranspose.rule | L6–7 · 6 (4,464 is the Dense row) | WRONG | Should read "prints 4,640 = 3 × 3 × 16 × 32 + 32, 4,624 and 145". Not shown in the game today. |
| 19 | DenseTranspose "Param #" = its biases only (A) | singleItem DenseTranspose, RULES | L5 · 19 ("only W1, W2 and the bias terms"), 20 (bias shape), 21 (82,414) | AMBIGUOUS | The number is right for what the layer adds. But "Param #" names a summary column, and real Keras tracks the tied Dense inside that row. Ask "Trainable params this layer adds?" and add slide 19 to `src`. |
| 20 | Bidirectional = 2 × the wrapped layer | RULES.Bidirectional, howParams | L8 · 7, 9 (674) | VERIFIED | — |
| 21 | Bidirectional output = concat, 2u; `src` slides 8, 14 | SHAPE_RULES.Bidirectional | L8 · 7 says the outputs are concatenated; 8 is about the LSTM's four states | WRONG | Change `src` to [7, 14]. |
| 22 | RNN (None, units) shape for LSTM/GRU, citing slides 43/49 + 29 | SHAPE_RULES.LSTM/GRU | L4 · 27 is the only slide that prints (None, 32); 43 and 49 print no shape | WRONG | Change `src` to [27, 29] for LSTM and GRU. |
| 23 | return_sequences=True → one vector per step, (None, None, u) | howShape RNN, SHAPE_RULES.SimpleRNN | not on L4 · 27/29 (29 only says to set it); L4 · 28 Fig 15-10 and L8 · 26 imply it; no slide prints (None, None, u) | NOT IN SLIDES | Cite L4 · 28 and L8 · 26, and mark the (None, None, u) notation `beyond`. |
| 24 | MultiHeadAttention = 3(d·H·K + H·K) + H·K·d + d | RULES.MultiHeadAttention (beyond) | L8 · 39, 43 (no count) | VERIFIED (beyond) | — |
| 25 | Dropout "only switches neurons off during training", `src` L2 · 62, concept params.pool | RULES.Dropout (beyond) | L2 · 63 has the mechanism; 62 does not | WRONG | Change `src` to [63] and do not tag it `params.pool`. Unreachable: Dropout is never generated. |
| 26 | Concept receipts in the hub tooltip | core/concepts.js `merge` (unions slides across lectures under the first lecture) | params.dense shows "Lecture 1 · slides 5, 6, 12, 21, 23, 27, 29, 36, 45"; params.conv2d "L3 · 5, 6, 8, 16, 22"; shape.conv2d and shape.pool gain "L3 · 5" | WRONG | Key the slide lists by lecture. A plain union misattributes L4, L5 and L6–7 slides to L1 and L3. |
| 27 | "slide 27 prints 1 × 32 + 32 × 32 + 32 = 1,088" | RULES.SimpleRNN.rule | L4 · 27 prints only 1088 | WRONG | Reword to "prints 1,088 (= 1 × 32 + 32 × 32 + 32)". Not displayed. |
| 28 | Stack why on an "Total trainable params?" ask | stackItem why | — | VERIFIED | The why gives the total and the non-trainable count but never the trainable answer (e.g. 4,800). State it. |
| 29 | Fashion MNIST classifier 266,610 (0 / 235,500 / 30,100 / 1,010), all trainable | SLIDE_MODELS l1.fmnist | L1 · 35 (code), 36 (summary) | VERIFIED | — |
| 30 | BN MLP 271,346 / 268,978 trainable / 2,368 non-trainable; BN rows 3,136 / 1,200 / 400 | SLIDE_MODELS l2.bn | L2 · 26, 27 | VERIFIED | — |
| 31 | 200 5 × 5 filters on 150 × 100 RGB = 15,200 | SLIDE_MODELS l3.conv200 | L3 · 22 | VERIFIED | — |
| 32 | univar_model 1,121 (1,088 + 33) | SLIDE_MODELS l4.univar | L4 · 27 | VERIFIED | — |
| 33 | deep_model 5,281 (1,088 / 2,080 / 2,080 / 33) | SLIDE_MODELS l4.deep | L4 · 29 (image, per Quirks) | VERIFIED | — |
| 34 | lstm_model 685 (672 + 13) | SLIDE_MODELS l4.lstm | L4 · 43, 47 | VERIFIED | — |
| 35 | gru_model 1,401 (1,380 + 21; 1,341 with one bias) | SLIDE_MODELS l4.gru | L4 · 49 + Quirks | VERIFIED | — |
| 36 | cnn_gru_model 1,283 (32 + 400 + 840 + 11) | SLIDE_MODELS l4.cnnGru | L4 · 50 + Quirks | VERIFIED | The item is tagged `params.gru`. Tag it `params.conv1d`, whose title is this exact model. |
| 37 | stacked_ae 163,814 (78,500 + 3,030 + 3,100 + 79,184) | SLIDE_MODELS l5.stacked | L5 · 12 | VERIFIED | — |
| 38 | tied_ae 82,414 (78,500 + 3,030 + 100 + 784) | SLIDE_MODELS l5.tied | L5 · 20, 21 | VERIFIED | — |
| 39 | conv_decoder 13,873 (4,464 / 0 / 4,640 / 4,624 / 145 / 0) | SLIDE_MODELS l67.convDecoder | L6–7 · 5, 6 | VERIFIED | Small: the slide writes `Reshape([28, 28])`, the game writes `Reshape((28, 28))`. `Input(shape=[30])` is implied, not shown. |
| 40 | simple_biRNN 674 (2 × 304 + 66) | SLIDE_MODELS l8.biRnn | L8 · 9 | VERIFIED | — |
| 41 | Intro: "valid" padding is the default | ParamSniper.jsx INTRO | L3 · 20 | VERIFIED | — |

## Blind sample

I worked each answer by hand from the slides' rules before printing the game's answers. GRU uses the printed-1,401 (two-bias) reading.

| # | level/seed | kind | prompt | mine | game | match |
|---|---|---|---|---|---|---|
| 1 | L1/s101 | choice | Dense(50) on [128] · Param #? | 6,450 | 6,450 | yes |
| 2 | L1/s101 | choice | Flatten() on [7, 7] · Param #? | 0 | 0 | yes |
| 3 | L1/s101 | choice | Conv2D(8, kernel_size=7, padding="valid") on [28, 28, 1] · Param #? | 400 | 400 | yes |
| 4 | L1/s101 | choice | MaxPool2D(pool_size=2) on [64, 64, 128] · Param #? | 0 | 0 | yes |
| 5 | L1/s101 | choice | Dense(10) on [16] · Param #? | 170 | 170 | yes |
| 6 | L1/s101 | choice | BatchNormalization() on [32] · Param #? | 128 | 128 | yes |
| 7 | L1/s101 | choice | Conv2D(16, kernel_size=7, padding="valid") on [64, 64, 32] · Param #? | 25,104 | 25,104 | yes |
| 8 | L1/s101 | choice | SimpleRNN(8) on [None, 5] · Param #? | 112 | 112 | yes |
| 9 | L1/s101 | choice | Conv2DTranspose(32, kernel_size=3, strides=2, padding="same") on [14, 14, 16] · Param #? | 4,640 | 4,640 | yes |
| 10 | L1/s101 | choice | LSTM(32) on [None, 8] · Param #? | 5,248 | 5,248 | yes |
| 11 | L1/s202 | choice | Dense(16) on [784] · Param #? | 12,560 | 12,560 | yes |
| 12 | L1/s202 | choice | Flatten() on [7, 7] · Param #? | 0 | 0 | yes |
| 13 | L1/s202 | choice | Conv2D(8, kernel_size=7, padding="valid") on [64, 64, 8] · Param #? | 3,144 | 3,144 | yes |
| 14 | L1/s202 | choice | MaxPool2D(pool_size=2) on [28, 28, 64] · Param #? | 0 | 0 | yes |
| 15 | L1/s202 | choice | Dense(100) on [100] · Param #? | 10,100 | 10,100 | yes |
| 16 | L1/s202 | choice | BatchNormalization() on [784] · Param #? | 3,136 | 3,136 | yes |
| 17 | L1/s202 | choice | Conv2D(128, kernel_size=7, padding="same") on [96, 96, 16] · Param #? | 100,480 | 100,480 | yes |
| 18 | L1/s202 | choice | SimpleRNN(64) on [None, 8] · Param #? | 4,672 | 4,672 | yes |
| 19 | L1/s202 | choice | Conv2DTranspose(32, kernel_size=3, strides=2, padding="same") on [3, 3, 64] · Param #? | 18,464 | 18,464 | yes |
| 20 | L1/s202 | choice | LSTM(10) on [None, 16] · Param #? | 1,080 | 1,080 | yes |
| 21 | L2/s303 | number | Dense(64) on [50] · Param #? | 3,264 | 3,264 | yes |
| 22 | L2/s303 | number | SimpleRNN(16) on [None, 2] · Param #? | 304 | 304 | yes |
| 23 | L2/s303 | number | Conv2D(8, kernel_size=5, padding="same") on [224, 224, 8] · Param #? | 1,608 | 1,608 | yes |
| 24 | L2/s303 | number | dense = Dense(300) → DenseTranspose(dense) on [784] · Param # of the DenseTranspose layer? | 784 | 784 | yes |
| 25 | L2/s303 | number | LSTM(32) on [None, 5] · Param #? | 4,864 | 4,864 | yes |
| 26 | L2/s303 | number | GRU(64) on [None, 2] · Param #? | 13,056 | 13,056 | yes |
| 27 | L2/s303 | shape | LSTM(20) on [None, 16] · Output shape? | (None, 20) | (None, 20) | yes |
| 28 | L2/s303 | shape | MaxPool2D(pool_size=2) on [64, 64, 32] · Output shape? | (None, 32, 32, 32) | (None, 32, 32, 32) | yes |
| 29 | L2/s303 | number | Conv2D(128, kernel_size=7, padding="valid") → Flatten() → Dense(10) on [64, 64, 1] · Total params? | 4,312,330 | 4,312,330 | yes |
| 30 | L2/s404 | number | Dense(128) on [8] · Param #? | 1,152 | 1,152 | yes |
| 31 | L2/s404 | number | Conv2D(32, kernel_size=7, padding="same") on [32, 32, 16] · Param #? | 25,120 | 25,120 | yes |
| 32 | L2/s404 | number | SimpleRNN(20) on [None, 16] · Param #? | 740 | 740 | yes |
| 33 | L2/s404 | number | Conv1D(16, kernel_size=3, strides=2, padding="valid") on [None, 2] · Param #? | 112 | 112 | yes |
| 34 | L2/s404 | number | LSTM(10) on [None, 5] · Param #? | 640 | 640 | yes |
| 35 | L2/s404 | number | GRU(64) on [None, 16] · Param #? | 15,744 | 15,744 | yes |
| 36 | L2/s404 | shape | Flatten() on [28, 28, 1] · Output shape? | (None, 784) | (None, 784) | yes |
| 37 | L2/s404 | shape | Bidirectional(GRU(32)) on [None, 2] · Output shape? | (None, 64) | (None, 64) | yes |
| 38 | L2/s404 | number | SimpleRNN(32) → Dense(100) on [None, 32] · Total params? | 5,380 | 5,380 | yes |
| 39 | L2/s505 | number | Conv1D(16, kernel_size=5, strides=2, padding="valid") on [None, 1] · Param #? | 96 | 96 | yes |
| 40 | L2/s505 | number | Conv2D(64, kernel_size=3, padding="same") on [32, 32, 3] · Param #? | 1,792 | 1,792 | yes |
| 41 | L2/s505 | number | Conv2DTranspose(32, kernel_size=3, strides=2, padding="valid") on [3, 3, 32] · Param #? | 9,248 | 9,248 | yes |
| 42 | L2/s505 | number | Bidirectional(LSTM(16)) on [None, 1] · Param #? | 2,304 | 2,304 | yes |
| 43 | L2/s505 | number | LSTM(16) on [None, 8] · Param #? | 1,600 | 1,600 | yes |
| 44 | L2/s505 | number | BatchNormalization() on [10] · Non-trainable params? | 20 | 20 | yes |
| 45 | L2/s505 | shape | Flatten() on [14, 14, 1] · Output shape? | (None, 196) | (None, 196) | yes |
| 46 | L2/s505 | shape | Bidirectional(LSTM(8)) on [None, 1] · Output shape? | (None, 16) | (None, 16) | yes |
| 47 | L2/s505 | number | SimpleRNN(32) → Dense(32) on [None, 5] · Total params? | 2,272 | 2,272 | yes |
| 48 | L3/s606 | number | deep_model · Total params? | 5,281 | 5,281 | yes |
| 49 | L3/s606 | number | tied_ae · Total params? | 82,414 | 82,414 | yes |
| 50 | L3/s606 | number | the slide-22 convolutional layer · Total params? | 15,200 | 15,200 | yes |
| 51 | L3/s606 | number | lstm_model · Total params? | 685 | 685 | yes |
| 52 | L3/s606 | shape | GRU(16, return_sequences=True) on [None, 5] · Output shape? | (None, None, 16) | (None, None, 16) | yes |
| 53 | L3/s606 | number | Conv2D(16, kernel_size=5, padding="same") → BatchNormalization() on [224, 224, 64] · Total params? | 25,680 | 25,680 | yes |
| 54 | L3/s606 | number | Conv2D(64, kernel_size=7, padding="valid") → BatchNormalization() on [224, 224, 64] · Total params? | 201,024 | 201,024 | yes |
| 55 | L3/s606 | number | GRU(32) on [None, 8] · Param #? | 4,032 | 4,032 | yes |
| 56 | L3/s606 | number | MultiHeadAttention(num_heads=4, key_dim=4) on [None, 16] · Param #? | 1,088 | 1,088 | yes |
| 57 | L3/s707 | number | gru_model · Total params? | 1,401 | 1,401 | yes |
| 58 | L3/s707 | number | univar_model · Total params? | 1,121 | 1,121 | yes |
| 59 | L3/s707 | number | cnn_gru_model · Total params? | 1,283 | 1,283 | yes |
| 60 | L3/s707 | number | deep_model · Total params? | 5,281 | 5,281 | yes |
| 61 | L3/s707 | shape | Conv2D(8, kernel_size=7, padding="same") on [128, 128, 16] · Output shape? | (None, 128, 128, 8) | (None, 128, 128, 8) | yes |
| 62 | L3/s707 | number | Conv2D(16, kernel_size=7, padding="same") → MaxPool2D(pool_size=2) → Flatten() → Dense(20) on [64, 64, 3] · Total params? | 330,068 | 330,068 | yes |
| 63 | L3/s707 | number | Conv2D(32, kernel_size=3, padding="same") → Conv2D(128, kernel_size=5, padding="same") → Flatten() on [128, 128, 64] · Total trainable params? | 120,992 | 120,992 | yes |
| 64 | L3/s707 | number | Bidirectional(LSTM(32)) on [None, 2] · Param #? | 8,960 | 8,960 | yes |
| 65 | L3/s808 | number | univar_model · Total params? | 1,121 | 1,121 | yes |
| 66 | L3/s808 | number | cnn_gru_model · Total params? | 1,283 | 1,283 | yes |
| 67 | L3/s808 | number | gru_model · Total params? | 1,401 | 1,401 | yes |
| 68 | L3/s808 | number | deep_model · Total params? | 5,281 | 5,281 | yes |
| 69 | L3/s808 | shape | Bidirectional(LSTM(16)) on [None, 1] · Output shape? | (None, 32) | (None, 32) | yes |
| 70 | L3/s808 | number | LSTM(8) → Dense(16) on [None, 16] · Total params? | 944 | 944 | yes |
| 71 | L3/s808 | number | GRU(20, return_sequences=True) → GRU(8) on [None, 1] · Total trainable params? | 2,100 | 2,100 | yes |
| 72 | L3/s808 | number | dense = Dense(300) → DenseTranspose(dense) on [784] · Param # of the DenseTranspose layer? | 784 | 784 | yes |
| 73 | L3/s808 | number | MultiHeadAttention(num_heads=2, key_dim=32) on [None, 16] · Param #? | 4,304 | 4,304 | yes |

All 73 match. The counts and shapes in params.js and shapes.js reproduce. The problems are in distractors, citations, unflagged beyond-slide rules and the concept catalogue.

## Summary
- Verdicts (41 claims): **30 VERIFIED** (2 of them beyond), **7 WRONG**, **2 NOT IN SLIDES**, **2 AMBIGUOUS**. Blind sample: 73/73.
- Fix 1, `maths/paramSniper.js` `distractors()`: remove the GRU distractor 3·(n·u + u² + u). It is the count from slide 49's own equations, so a level-1 player who follows the slide gets marked wrong.
- Fix 2, `core/concepts.js` `merge()`: it unions slide numbers across lectures under the first lecture's number, so the hub tooltip misattributes slides (params.dense "L1 · 5, 6, 12, 21…"; params.conv2d and the shape concepts gain "L3 · 5"). Key the slide lists by lecture.
- Fix 3, unflagged beyond-slide rules: the Conv2D+BN stacks (per-channel BN) and the return_sequences (None, None, u) shapes need `beyond` notes or better receipts (L4 · 28, L8 · 26). Mark GRU reset_after `beyond` too, and state the trainable answer in stack why cards.
- Fix 4, citations and strings: Bidirectional shape `src` → [7, 14]; LSTM/GRU shape `src` → [27, 29]; Dropout `src` → L2 · 63; BN add slide 23; DenseTranspose add slide 19 and ask "Trainable params this layer adds?"; cnn_gru concept → params.conv1d; correct the RULES.Conv2DTranspose.rule string (4,464 is the Dense row) and the RULES.SimpleRNN.rule wording.
