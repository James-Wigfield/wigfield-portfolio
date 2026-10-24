# Accuracy check: Bottleneck (`bottleneck`)

Lecture 5 · checked 2026-10-23 · sources: `cits5017-lect05-AE-dimension-reduction.pdf` (rendered 8, 9, 11, 12, 17, 19, 20, 21, 23, 24 at 110 dpi) + `lecture-5.md` (slides 6–25 and Quirks).
Sample: **90 generated items solved blind** (every item of seeds 11/22/33/44/55 × levels 1–3: 15 plane, 15 build, 15 tie, 10 index, 15 order, 20 drop). Plane items were re-solved by my own brute-force MSE search over the two tilts. Map items were classified from an ASCII render of each image, and the `near` lists were recomputed from `data/tsne.js`. I also scanned 720 items (seeds 1–40 × 3 levels): 0 failures (every answer passes `check`, every `wrong` fails, no plane start passes, every answer is among its choices, no duplicate choices).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Linear activations + MSE cost → the AE "ends up performing Principal Component Analysis" | PLANE.why; concept `pca.linearAe` | 5 · 8 | VERIFIED | – |
| 2 | Slide 9: points projected onto a plane; right plot = "the approximate PCA performed by the undercomplete linear autoencoder" | PLANE.why | 5 · 9 | VERIFIED | – |
| 3 | The lowest-MSE plane is the PCA plane; target = exact PCA normal, tol 10/7/5° | PLANE.why, `makeCloud`, `gradePlane` | 5 · 8 | VERIFIED | – (15/15 plane items match my own search; floor = λ₃/3) |
| 4 | Bright/light red = above/below, blue = projections; axes x1, x2, x3; x′ = reconstruction | PLANE.legend/axes/sub, CSS | 5 · 9; 5 · 6–7 (Fig 17-1 x′) | VERIFIED | – |
| 5 | Dense(2) → Dense(3), no activation (all linear), 3 outputs = 3 inputs, loss="mse" | PLANE.drawer[0–1] | 5 · 8 (notes ii–iii) | VERIFIED | – |
| 6 | MSE = 1/(3m) Σ‖x − x′‖², m = 60 (Keras mse) | PLANE.drawer[2] (beyond) | 5 · 8–9 | VERIFIED (beyond) | – (ae.js `mse` matches) |
| 7 | Plane pinned to the points' mean | PLANE.drawer[3] (beyond) | – | VERIFIED (beyond) | – |
| 8 | "this page's own 60 points (slide 9 elides its X_train as [...])" | PLANE.own | 5 · 9 | VERIFIED | – |
| 9 | Symmetric about the coding layer: 784→100→30→100→784; Fig 17-3 labels and colours (green io, blue hidden, pink coding) | BUILD.drawer[0], BUILD.sub, SANDWICH, `Sandwich` | 5 · 11 | VERIFIED | – |
| 10 | stacked_ae has 163,814 trainable parameters | BUILD.drawer[1], BUILD.whySlide, TIE.anchor | 5 · 12 | VERIFIED | – |
| 11 | "A Dense layer costs inputs × units + units"; drawer rows "W_ℓ is i × u" | BUILD.sub, BUILD.why, TIE.rowOwn | cites 5 · 10–12; stated on 1 · 8 | NOT IN SLIDES (L5) | cite Lecture 1 slide 8 (W: one row per input, one column per neuron; b: one per neuron), or mark beyond with "reproduces slide 12's 163,814" |
| 12 | Build answers, budgets, "next bigger sandwich" totals | `buildItem` (15 items) | arithmetic | VERIFIED | – |
| 13 | W_{N−ℓ+1} = W_ℓᵀ, ℓ = 1…N/2; N excludes the input layer; layer 1 = first hidden, N/2 = coding, N = output | TIE.drawer[0–1], INDEX.pair/coding.why | 5 · 19 | VERIFIED | – |
| 14 | N = 4: "only W₁, W₂, and the bias terms need to be learned"; decoder labelled W₂ᵀ, W₁ᵀ | INDEX.learn, TIE.choice.why, `Sandwich` 'tied' | 5 · 19 | VERIFIED | – |
| 15 | DenseTranspose build() adds only a bias of shape [self.dense.input.shape[-1]]; call() uses weights[0], transpose_b=True | TIE.drawer[2], keypad whys | 5 · 20 | VERIFIED | – |
| 16 | tied_ae: 78,500 + 3,030 + 100 + 784 = 82,414, "almost halved" | TIE.choice.why | 5 · 21 | VERIFIED | – |
| 17 | Distractors 81,530 (no decoder biases), 81,400 (the saving), 163,814 (untied) are all false | TIE.choice.choices | 5 · 12, 21 | VERIFIED | – |
| 18 | "almost halved because the biases are not tied" / "the biases stay (slide 20), which is why…" | TIE.choice.why, TIE.keypad.saved.why | 5 · 19–21 | VERIFIED | – (82,414 − 163,814/2 = 507 = half the 1,014 biases) |
| 19 | Tied counts (left / saved) for any symmetric stack | `tieKeypadItem`, `tieCounts` (10 items) | 5 · 19–20 | VERIFIED | – |
| 20 | "Which weights does layer L use?": the W_L choice (e.g. W₃ for layer 3) is graded wrong | `indexItem` pair, choice `W${L}` (bn2-5-index s11/s22/s55, bn3-4-index s11/s55) | 5 · 19 | WRONG | slide 19 defines W_ℓ as "the connection weights of the ℓth layer", so W₃ *is* layer 3's weights (= W₂ᵀ): the distractor is true. Replace `W${L}` with the untransposed `W${l}` (wrong shape), or ask "…is tied to which encoder kernel?" |
| 21 | Learn distractor "W₃, W₄ and the bias terms" is wrong | INDEX.learn.choices `w34b` | 5 · 19 | AMBIGUOUS | by slide 19's own equation W₃ = W₂ᵀ and W₄ = W₁ᵀ, so learning W₃ and W₄ fixes W₁ and W₂. The game takes the slide's sentence. Swap the distractor for "the bias terms only" |
| 22 | Coding layer = layer N/2 (2 for N = 4, 3 for N = 6) | INDEX.coding | 5 · 19 | VERIFIED | – (UX only: the pink coding box in the picture gives the answer away) |
| 23 | Fig 17-7: P1 first AE (Target=inputs) → X₍₁₎; P2 second AE on X₍₁₎ → X₍₂₎; P3 stack into a big sandwich | ORDERS.fig177 / fig177long / fig177decoy | 5 · 23 | VERIFIED | – |
| 24 | Decoy "train the second AE on the original inputs, not on X₍₁₎" is false | ORDERS.fig177decoy x1 | 5 · 23 | VERIFIED | – |
| 25 | If needed, keep training the full stack for a few epochs (epochs=5) | fig177long p4, code c5 | 5 · 25 | VERIFIED | – |
| 26 | Slide 24 order: Flatten → train_autoencoder(100, X_train_flat…) → train_autoencoder(30, X_train_enc1…, output_activation="relu") → Sequential([Flatten(), enc1, enc2, dec2, dec1, Reshape]) → fit(epochs=5) | ORDERS.code | 5 · 24–25 | VERIFIED | – |
| 27 | enc1 Dense(100, relu), enc2 Dense(30, relu), dec2 Dense(100, relu), dec1 Dense(784) | ORDERS.layers cards | 5 · 24 | VERIFIED | – |
| 28 | Fig 17-6: train the AE on all the data (no labels) → copy Hidden 1 and Hidden 2 into a classifier with Output + Softmax → train it on labelled data; decoy "copy Hidden 3 and Output" is false | ORDERS.pretrain / pretraindecoy | 5 · 16–17 | VERIFIED | – |
| 29 | "The slides say 'reuse' and 'copy'; they never say the copied layers are frozen" | ORDERS.pretrain.why, pretraindecoy.why | 5 · 16–17 | AMBIGUOUS | literally true, but slide 16 says the new network "has fewer layers that require training", so the reused layers need no training. The line can read as "they are fine-tuned". Add slide 16's sentence |
| 30 | Mini-stacks in "the figures' colours": Phase 2's Output (Fig 17-7) and the classifier's Output (Fig 17-6) drawn wide green | OrderStage `MiniStack` / `tone` (cards p2, b) | 5 · 17, 23 | WRONG (cosmetic) | both figures draw those Output boxes light blue (and Fig 17-7's Phase 2 Input narrow). Tone them 'hid' |
| 31 | Slide 14: stacked_encoder.predict(X_valid) → TSNE().fit_transform | MAP.drawer[0], MAP.why | 5 · 14 | VERIFIED | – |
| 32 | t-SNE "keeps similar instances close and dissimilar instances apart" | MAP.why | 5 · 14 (footnote: "while **trying to** keep") | WRONG (wording) | "which tries to keep similar instances close…" (this page's own map shows the overlap) |
| 33 | 784 px → 30 codings → 2D; t-SNE axes mean nothing | MAP.drawer[1] (beyond) | 5 · 12, 14 | VERIFIED (beyond) | – |
| 34 | Fig 17-5 colours each class and has no legend; this map uses four family colours | MAP.drawer[2] | 5 · 15 | VERIFIED | – |
| 35 | Own-run labels: "this page's own run · t-SNE of stacked_encoder's 30 codings of 5,000 … validation images", X_valid[i], class names (the slides name none) | MAP.own, itemLabel, classNames | 5 · 14–15 + data/tsne.js, recon.js | VERIFIED | – (labels 0–9 match both data files; map point i = X_valid[i]) |
| 36 | `near` classes of the 10 items (k = 25, ≥ 8) | MAP.items[].near | data/tsne.js | VERIFIED | – (all 10 recomputed) |
| 37 | X_valid[0] (dark long-sleeved top, label T-shirt/top; its coding sits among Dress 14/25) is a "medium" item; the why says "the tops overlap" when it landed among Dresses | MAP.items[0], MAP.tailMixed | 5 · 13, 15 | AMBIGUOUS | a long-sleeved top reads as Pullover/Shirt to a player. Move it to tier 'hard'; tailMixed → "tops, dresses and coats overlap on this map" (also covers X_valid[7], Coat/Dress) |
| 38 | Stage / item receipts (8–9, 10–12, 12+19–21, 19, 16–17, 23, 23+25, 24–25, 14–15) and the 8 concept ids' slides in lecture5.js | STAGES, item `src`, content/lecture5.js | 5 · as cited | VERIFIED | – (every cited slide teaches its claim; no off-by-one) |

## Blind sample

My answer first, then the game's. ✓ = match.

**Build** (the biggest symmetric sandwich ≤ budget; my totals: N = 4 → 1570h + 2hc + c + 784; N = 6 → 1570a + 2ab + 62b + 814)
- L1 s11 N=4, budget 246,000 → 784–150–30–150–784 (245,314) · game same ✓
- L1 s22 / L2 s22, 160,000 → 784–100–10–100–784 (159,794) ✓ ×2
- L1 s33, 165,000 → 784–100–30–100–784 (163,814) ✓
- L1 s44 / L2 s44, 485,000 → 784–300–20–300–784 (483,804) ✓ ×2
- L1 s55 / L2 s55, 245,000 → 784–150–20–150–784 (242,304; 245,314 is over) ✓ ×2
- L2 s11, 325,000 → 784–200–20–200–784 (322,804) ✓
- L2 s33, 340,000 → 784–200–40–200–784 (330,824) ✓
- L3 s11 / s22 N=6, 540,000 → 784–300–100–30–100–300–784 (538,014) ✓ ×2
- L3 s33, 690,000 → 784–400–60–30–60–400–784 (680,534) ✓
- L3 s44, 370,000 → 784–200–100–30–100–200–784 (361,014) ✓
- L3 s55, 520,000 → 784–300–60–30–60–300–784 (511,534) ✓

**Tie** (left = encoder kernels + all biases; saved = decoder kernels)
- choice, slide 12's sandwich (L1 s11–s55) → 82,414 ✓ ×5
- saved 784–200–20–200–784 → 20·200 + 200·784 = 160,800 ✓
- left 784–100–10–100–784 → 79,400 + 994 = 80,394 ✓
- left 784–200–40–200–784 → 164,800 + 1,224 = 166,024 ✓
- left 784–300–20–300–784 → 241,200 + 1,404 = 242,604 ✓
- left 784–150–20–150–784 → 120,600 + 1,104 = 121,704 ✓
- saved 784–300–100–30–… → 3,000 + 30,000 + 235,200 = 268,200 ✓
- left 784–300–100–30–… → 268,200 + 1,614 = 269,814 ✓
- left 784–400–60–30–… → 339,400 + 1,734 = 341,134 ✓
- saved 784–200–100–30–… → 3,000 + 20,000 + 156,800 = 179,800 ✓
- left 784–300–60–30–… → 255,000 + 1,534 = 256,534 ✓

**Index**
- N=4, layer 3 (L2 s11, s22) → W₂ᵀ ✓ ×2 (W₃ is also true: row 20)
- N=4, layer 4 (L2 s55) → W₁ᵀ ✓ (W₄ is also true)
- N=6, layer 5 (L3 s11, s55) → W₂ᵀ ✓ ×2 (W₅ is also true)
- coding layer N=4 → 2 ✓; N=6 (L3 s22, s33, s44) → 3 ✓ ×3
- N=4, what is learned → W₁, W₂ and the bias terms ✓

**Order**
- fig177 (L1 ×5) → Phase 1, 2, 3 ✓ ×5
- fig177long (L2 s11, s33, s55) → Phase 1, 2, 3, then fine-tune ✓ ×3
- pretrain (L2 s22, s44) → train AE, copy H1 and H2, train classifier ✓ ×2
- layers (L3 s11, s22, s33, s55) → enc1, enc2, dec2, dec1 ✓ ×4
- fig177decoy (L3 s44) → Phase 1, 2, 3; leave out "second AE on raw inputs" ✓

**Plane** (my brute-force argmin of the MSE, in degrees, vs the game's answer; all within tolerance, every start fails)
- (−51.6, 40.4) vs (−52, 40) ✓ · (−13.8, −14.1) vs (−14, −14) ✓ ×2 · (−21.2, −31.5) vs (−21, −31) ✓ · (−24.7, 42.5) vs (−25, 42) ✓ ×2 · (6.3, 11.9) vs (6, 12) ✓ · (2.0, −32.8) vs (2, −33) ✓ · (5.7, −23.5) vs (6, −23) ✓ ×2 · (−9.9, 38.9) vs (−10, 39) ✓ ×2 · (21.3, 13.9) vs (21, 14) ✓ · (36.6, −1.1) vs (37, −1) ✓ · (−10.8, 31.7) vs (−11, 32) ✓

**Drop** (class from the image alone)
- [5] rectangular bag → Bag ✓ ×3; [9] bag with a handle loop → Bag ✓
- [2] grey V-neck T-shirt → T-shirt/top ✓ ×6; [6] strappy top → T-shirt/top ✓ ×2; [8] low shoe → Sneaker ✓
- not drawn in this sample, checked by eye anyway: [1] bag with logo and handle → Bag ✓; [4] strappy high-heeled sandal → Sandal ✓
- [3] pale long-sleeved top → Shirt ✓ (could be Pullover; tier hard)
- [0] dark long-sleeved top → I said Pullover · game T-shirt/top ✗ ×2 (row 37)
- [7] long garment, no visible sleeves → I said Dress · game Coat ✗ ×4 (tier hard; the why names the Coat/Dress mix)

Result: **84/90 match**. All 6 disagreements are on two images that a person could reasonably read as another class. The game grades by the dataset's label, and that label is correct per the data.

## Summary

- Verdicts over 38 rows: VERIFIED 31 (3 of them beyond), WRONG 3, NOT IN SLIDES 1, AMBIGUOUS 3. Blind sample: 84/90; every count, ordering and W item matches, and the 6 misses are human-ambiguous map images.
- Fix 1 (row 20): the "which weights does layer L use?" item offers W_L as a wrong answer, but slide 19 defines W_ℓ as layer ℓ's weights, so W_L is true. Replace it with the untransposed W_ℓ.
- Fix 2 (rows 32, 29, 21): MAP.why "keeps" → "tries to keep" (slide 14 footnote). Quote slide 16's "fewer layers that require training" next to "never say frozen". Swap the learn item's "W₃, W₄ and the bias terms" for "the bias terms only".
- Fix 3 (row 11): the Dense count rule (inputs × units + units) is not on any Lecture 5 slide. Cite Lecture 1 slide 8, or mark it beyond with "reproduces slide 12's 163,814".
- Fix 4 (rows 37, 30): move X_valid[0] to tier 'hard' and make tailMixed say "tops, dresses and coats"; colour the Phase 2 / classifier Output mini-boxes light blue as in Figures 17-6 and 17-7.
