# Accuracy check: Block Builder (`block-builder`)

Date 2026-10-23 · checker: fresh agent · source: `cits5017-lect03-CNNs.pdf` slides 9, 20, 21, 26, 29, 33–51 (pdftotext; slides 37, 39, 42, 43, 46 rendered at 200 dpi, Figure 14-15's module numbers re-rendered at 600 dpi; 34, 41, 44, 45, 47, 49, 50, 51 at 110 dpi). Transcript stops at 16, so it was not used.
Files read: `games/block-builder/*` (BlockBuilder, Stages, Figures, geom, glyph, index), `content/block-builder.js`, `maths/blockBuilder.js`, concept ids in `content/lecture3.js`.
Blind sample: **58 items** (L1 seeds 11, 12 · L2 seeds 21, 22 · L3 seeds 31, 32, 33), plus all 17 blankable table cells checked by hand. **58 / 58 match.** The game's own `check-block-builder.mjs` passes (13,907 checks).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | LeNet-5 table, all 8 rows (type, maps, size, kernel, stride, tanh on S2/S4, RBF Out) | content `LENET5` | L3 · 37 | VERIFIED | – |
| 2 | AlexNet table, all 11 rows (3(RGB), 227, 11×11 s4 valid, 3×3 s2 valid pools, same convs, 4,096 ×2, 1,000 Softmax) | content `ALEXNET` | L3 · 39 | VERIFIED | – |
| 3 | No C7 row; S8's maps never asked; order why explains the gap | `ALEXNET.rows[S8].noMapsCell`, `ORDERS.alexnet` | L3 · 39 | VERIFIED | – |
| 4 | All 17 computed cells reproduce the printed numbers (28, 14, 6, 10, 5, 16, 1; 55, 27, 96, 27, 13, 256, 13, 13, 6, 1000) | `ALL_CELLS` / `tableCells` | L3 · 37, 39 | VERIFIED | – |
| 5 | LeNet-5 convs are "valid" ("stays inside the map") | `RULES.valid1` why on LeNet cells | L3 · 20, 37 (37 has no padding column) | AMBIGUOUS | Only valid reproduces 32→28; say it is inferred: "the table prints no padding; 32 → 28 means none ('valid', slide 20)" |
| 6 | 2×2 stride-2 pools tile the map, "like slide 26's" | `RULES.tile` | L3 · 26 | VERIFIED | – |
| 7 | "same" at stride 1 keeps height and width | `RULES.same1` | L3 · 20 (21 for stride > 1) | VERIFIED | – |
| 8 | valid window: n − f + 1 positions; stride keeps the 1st and every s-th | `RULES.validS` | L3 · 9, 20, 21 | VERIFIED | – |
| 9 | Pooling works on every channel independently, depth out = depth in | `RULES.pooledMaps` | L3 · 29 | VERIFIED | nit: slide says "typically"; keep the word |
| 10 | Out = softmax, one probability per class; ImageNet has 1000 classes | `RULES.classes` | L3 · 33, 43 | VERIFIED | – |
| 11 | "The whole table, as slide 39 prints it." (Stages hides the Activation column on every cell item) | `UI.cellSubAll` + `NumberStage` columns filter | L3 · 39 | WRONG (low) | Say "The whole table (activations hidden)" or keep `act` when `showAll` |
| 12 | GoogLeNet stem: Conv 64 7×7+2(S), MP 64 3×3+2(S), LRN, Conv 64 1×1+1(S), Conv 192 3×3+1(S), LRN, MP 192 3×3+2(S) | `GOOGLENET.tower[0..7]`, `fragments.stem` | L3 · 43 | VERIFIED | – |
| 13 | 2 modules → MP 480 → 5 modules → MP 832 → 2 modules → GAP 1024 → Dropout 40% → FC 1000 units → Softmax | `GOOGLENET.tower`, `ORDERS.googlenet`, `fragments.head` | L3 · 43 | VERIFIED | (2/5/2 is by max pools; the figure's columns draw 2 · 4+1 · 2) |
| 14 | Nine modules' printed numbers, top 4 / bottom 2 (incl. 96 12 on module 1) | `GOOGLENET.modules` | L3 · 43 (600 dpi) | VERIFIED | – |
| 15 | Depth-concat totals 128+192+96+64 = 480, 256+320+128+128 = 832, 384+384+128+128 = 1024 | `GOOGLENET.sums`, `sumOf` | L3 · 43 | VERIFIED | – |
| 16 | A module's top four numbers are the four branches' maps that the depth concat stacks (why text + DepthBar segments) | `RULES.sum`, `sumItem`, `Figures.DepthBar` | L3 · 42–43 (numbers unlabelled) | NOT IN SLIDES | Hedged in the why ("the slide does not label…") but asserted by the DepthBar; mark sum items `beyond: true` with that note, or word it as "the top four add up to the printed depth" |
| 17 | 256×256 images, 1000 classes, 9 modules, 32×32×192 in, 8×8×1024 (m×8×8×1024) into GAP | `GOOGLENET.facts`, `CLAIMS.googNine`, `NUMBERS.googModules` | L3 · 43 | VERIFIED | – |
| 18 | Inception: input copied to 4 branches: 1×1; 1×1→3×3; 1×1→5×5; MP 3×3+1(S)→1×1; all +1(S) | `INCEPTION.branches/why`, `InceptionFigure` | L3 · 42 | VERIFIED | – |
| 19 | Decoys (3×3→1×1, MP stride 2, 1×1→7×7, lone 5×5) are all false; notes correct | `INCEPTION.decoys` | L3 · 42 | VERIFIED | – |
| 20 | Concat along depth, axis=3 (distractors axis 0/1/2) | `QUICK.axis`, `UI.sumBar` | L3 · 42, 43 | VERIFIED | – |
| 21 | "same" padding → same-size maps for the concat; 1×1/3×3/5×5 → different scales; distractors false | `QUICK.same`, `QUICK.scales` | L3 · 42 | VERIFIED | – |
| 22 | "…input copied to four branches and joined by a depth concat (slide 41)" | `FRAGMENTS.inception.why` | L3 · 41 (no concat), 42 | WRONG (low) | Move the cite: "GoogLeNet's inception module (slide 41): … depth concat (slide 42)" |
| 23 | Skip leaves Input, joins +; + adds x and Layer 2's output; unit outputs h(x) | `RESIDUAL`, `wireItem`, `QUICK.add`, `QUICK.unitOut` | L3 · 46 | VERIFIED | – |
| 24 | Layers forced to model f(x) = h(x) − x (distractors h(x), h(x)+x, x−h(x)) | `QUICK.fx`, `RESIDUAL.fx` | L3 · 46 | VERIFIED | – |
| 25 | VGG: 2 or 3 conv + pool repeated, only 3×3 filters but many, 16 or 19 conv layers, dense net with 2 hidden + output | `VGG`, `FRAGMENTS.vgg`, `CLAIMS.vgg33/vggDepth`, `NUMBERS.vggDepthN` | L3 · 44 | VERIFIED | – |
| 26 | VGG 2014 runner-up, Simonyan & Zisserman, Oxford VGG | `CLAIMS.vggRunner` | L3 · 44 | VERIFIED | – |
| 27 | Top-5: AlexNet 17% (2nd best 26%), GoogLeNet below 7%, ResNet under 3.6%, SENet 2.25% | `CLAIMS`, `NUMBERS.*Err` | L3 · 38, 41, 45, 47 | VERIFIED | – |
| 28 | ResNet winner 152 layers; variants 34, 50, 101 | `CLAIMS.res152`, `NUMBERS.resDepth` | L3 · 45 | VERIFIED | – |
| 29 | Years 1998, 2012, 2014, 2014, 2015, 2016, 2017 and the slide each comes from | `ARCHS`, `YEARS.slideOf` | L3 · 37, 38, 41, 44, 45, 47 | VERIFIED | – |
| 30 | GoogLeNet 10× fewer params than AlexNet (≈6 M vs 60 M); distractors false | `CLAIMS.goog10x`, `NUMBERS.googParams` | L3 · 41 | VERIFIED | – |
| 31 | People: LeCun; Krizhevsky, Sutskever, Hinton; Szegedy et al. (Google Research); Kaiming He et al.; Chollet (Keras) | `CLAIMS.*Who`, `lecun`, `xcChollet` | L3 · 37, 38, 41, 45, 47 | VERIFIED | – |
| 32 | AlexNet first to stack conv layers directly; like LeNet-5 but larger and deeper | `CLAIMS.alexStack` | L3 · 38 | VERIFIED | – |
| 33 | AlexNet: 50% dropout on F9/F10 outputs; augmentation by shifts, flips, lighting | `CLAIMS.alexReg` | L3 · 39 | VERIFIED | – |
| 34 | LeNet-5 tanh/RBF; today ReLU/softmax | `CLAIMS.tanhRbf` | L3 · 37 | VERIFIED | – |
| 35 | GoogLeNet much deeper thanks to inception modules; skip (shortcut) connections are ResNet's key | `CLAIMS.googInception`, `resSkip` | L3 · 41, 46 | VERIFIED | – |
| 36 | Xception: GoogLeNet variant (2016), beat Inception-v3 on 350 M images / 17,000 classes. SENet: ILSVRC 2017, Squeeze-and-Excitation, extends inception nets and ResNets. No player text claims depthwise separable convs or an SE block | `CLAIMS.xc*`, `se*` | L3 · 47 | VERIFIED | – |
| 37 | Header comment "slide 47: no depthwise separable convolution" | content file header (comment only) | L3 · 47 fn 11 (paper title names it) | AMBIGUOUS | Comment only: write "not explained" instead of "no" |
| 38 | Top-5 error definition; ">26% to <3% in just six years"; distractors false | `NUMBERS.top5`, `sixYears` | L3 · 36 | VERIFIED | – |
| 39 | Claim `not` lists drop every option the slides make true (VGG for alexStack; Xception/SENet for inception, skip, 9 modules) | `CLAIMS[].not` | L3 · 38, 41, 43, 46, 47 | VERIFIED | – |
| 40 | AlexNet row windows of 3×3 conv/pool rows only (S4…S8) can offer VGGNet as a choice; slide 44's recipe fits them, and only the word "table" separates them | `rowsItem`, `FRAGMENTS.alexRows` (e.g. L1 seed 11 #5: S4, C5) | L3 · 39, 44 | AMBIGUOUS (low) | Drop VGG from the choices when every kernel in the window is 3×3 |
| 41 | LeNet / AlexNet fragment why texts (tanh, avg 2×2 s2, 32×32, RBF / ReLU, 3×3 s2 max, padding column, 11×11 s4, 227 RGB) | `FRAGMENTS.lenetRows/alexRows` | L3 · 37, 39 | VERIFIED | – |
| 42 | LRN appears only as two blocks in Figure 14-15 and is never explained | `FRAGMENTS.googStem` | L3 · 43 (no LRN text in deck) | VERIFIED | – |
| 43 | Two 3×3 > one 5×5 (fewer params, less computation, usually better); first layer may use a large kernel with stride ≥ 2 to shrink the image without losing too much; too-large kernels are a common mistake | `TYPICAL.replace5/why33/first/firstWhy/mistake` | L3 · 34 | VERIFIED | – |
| 44 | Typical stack conv(+ReLU)…pool…; smaller but deeper; FC(+ReLU) head then softmax | `TYPICAL.stack/shape/head` | L3 · 33 | VERIFIED | – |
| 45 | Fine-tune order: load Xception → GAP + Dense softmax → freeze → compile SGD(0.1, 0.9) → fit 3 → unfreeze layers[56:] → compile SGD(0.01, 0.9) → fit 10 | `FINETUNE`, `ORDERS.finetune` | L3 · 51 | VERIFIED | – |
| 46 | Second compile lr 0.01; GAP + Dense(n_classes, softmax) on top; phase 1 frozen, 3 epochs, lr 0.1; distractors false | `TRANSFER.lr2/top/firstPhase` | L3 · 51 | VERIFIED | – |
| 47 | ResNet50 says vase 32.66%; dahlia is not one of the 1,000 classes; distractors (resize, preprocess, top=3) false | `TRANSFER.dahlia` | L3 · 48, 49 | VERIFIED | – |
| 48 | LeNet order why cites "(slide 33)" in its text | `ORDERS.lenet5` (src [37]) | L3 · 33, 37 | VERIFIED | nit: add 33 to `src` |
| 49 | Concept ids and their slide lists (13 concepts) | `index.js`, `lecture3.js` | L3 · 26–51 | VERIFIED | – |

## Blind sample (58 items; my answer worked from the slides first, then compared)

| item | prompt (short) | mine | game | ok |
|---|---|---|---|---|
| L1s11#1 | "inception modules let it go much deeper" | GoogLeNet | GoogLeNet | ✓ |
| L1s11#2 | Figure 14-16 → net | ResNet | ResNet | ✓ |
| L1s11#3 | "only 3×3 filters, 2 or 3 conv + pool" | VGGNet | VGGNet | ✓ |
| L1s11#4 | ResNet top-5 | under 3.6% | under 3.6% | ✓ |
| L1s11#5 | rows S4 (MP 256 13×13), C5 (conv 384 13×13 same) | AlexNet (VGG plausible, see #40) | AlexNet | ✓ |
| L1s11#6 | beat Inception-v3, 350 M / 17,000 | Xception | Xception | ✓ |
| L1s11#7 | LeNet-5 year | 1998 | 1998 | ✓ |
| L1s11#8 | VGG block picture | VGGNet | VGGNet | ✓ |
| L1s11#9 | "16 or 19 conv layers + 2 hidden dense" | VGGNet | VGGNet | ✓ |
| L1s11#10 | 26% → <3% in … | just six years | just six years | ✓ |
| L1s12#1 | ILSVRC 2014, below 7% | GoogLeNet | GoogLeNet | ✓ |
| L1s12#2 | Figure 14-16 → net | ResNet | ResNet | ✓ |
| L1s12#3 | 2014 runner-up, Oxford VGG | VGGNet | VGGNet | ✓ |
| L1s12#4 | AlexNet top-5 | 17% | 17% | ✓ |
| L1s12#5 | rows C1 (6@28, 5×5), S2 (avg 6@14) | LeNet-5 | LeNet-5 | ✓ |
| L1s12#6 | 9 modules; 8×8×1024 into GAP | GoogLeNet | GoogLeNet | ✓ |
| L1s12#7 | LeNet-5 year | 1998 | 1998 | ✓ |
| L1s12#8 | GAP 1024 → Dropout 40% → FC 1000 → Softmax | GoogLeNet | GoogLeNet | ✓ |
| L1s12#9 | tanh + RBF output | LeNet-5 | LeNet-5 | ✓ |
| L1s12#10 | how many inception modules | 9 | 9 | ✓ |
| L2s21#1 | wire skip | Input → + | Input → + | ✓ |
| L2s21#2 | LeNet slots 2, 7, 8 | C1, F6, Out | C1, F6, Out | ✓ |
| L2s21#3 | 4 branches of 6 (decoys x31, x5) | b1 b3 b5 bp | b1 b3 b5 bp | ✓ |
| L2s21#4 | why "same" padding | same-size maps for concat | same | ✓ |
| L2s21#5 | AlexNet slots 2, 6, 7, 8 | C1, C5·C6, S8, F9·F10 | same | ✓ |
| L2s21#6 | concat axis | axis=3 | axis=3 | ✓ |
| L2s21#7 | GoogLeNet slots 2, 8, 9 | MP 480, FC 1000, Softmax | same | ✓ |
| L2s21#8 | AlexNet slots 3, 4, 5, 7, 9 | S2, C3, S4, S8, Out | same | ✓ |
| L2s22#1 | wire skip | Input → + | Input → + | ✓ |
| L2s22#2 | LeNet slots 4, 5, 8 | C3, S4, Out | same | ✓ |
| L2s22#3 | 4 branches of 6 (decoys xp2, x5) | b1 b3 b5 bp | same | ✓ |
| L2s22#4 | why "same" padding | same-size maps | same | ✓ |
| L2s22#5 | AlexNet slots 3, 6, 7, 9 | S2, C5·C6, S8, Out | same | ✓ |
| L2s22#6 | what leaves above + | h(x) | h(x) | ✓ |
| L2s22#7 | GoogLeNet slots 6, 7, 9 | GAP, Dropout, Softmax | same | ✓ |
| L2s22#8 | LeNet slots 2, 3, 4, 6, 8 | C1, S2, C3, C5, Out | same | ✓ |
| L3s31#1 | LeNet C5 size | 5−5+1 = 1 | 1 | ✓ |
| L3s31#2 | typical CNN head | FC(+ReLU) then softmax | same | ✓ |
| L3s31#3 | concat 256 320 128 128 → MP | 832 | 832 | ✓ |
| L3s31#4 | LeNet S2 size | 28/2 = 14 | 14 | ✓ |
| L3s31#5 | fine-tune slots 3–6 | freeze, compile 0.1, fit 3, unfreeze | same | ✓ |
| L3s31#6 | AlexNet C1 size | ⌊216/4⌋+1 = 55 | 55 | ✓ |
| L3s31#7 | phase 1 | frozen, 3 epochs, lr 0.1 | same | ✓ |
| L3s31#8 | concat 384 384 128 128 → GAP | 1024 | 1024 | ✓ |
| L3s32#1 | LeNet C3 size | 14−5+1 = 10 | 10 | ✓ |
| L3s32#2 | typical CNN head | FC(+ReLU) then softmax | same | ✓ |
| L3s32#3 | concat → MP 832 | 832 | 832 | ✓ |
| L3s32#4 | LeNet S2 size | 14 | 14 | ✓ |
| L3s32#5 | fine-tune slots 3, 4, 5, 7 | freeze, compile 0.1, fit 3, compile 0.01 | same | ✓ |
| L3s32#6 | AlexNet S2 size | ⌊52/2⌋+1 = 27 | 27 | ✓ |
| L3s32#7 | head on Xception | GAP, Dense(n_classes, softmax) | same | ✓ |
| L3s32#8 | concat 128 192 96 64 → MP | 480 | 480 | ✓ |
| L3s33#1 | LeNet S4 maps | 16 (pooling keeps depth) | 16 | ✓ |
| L3s33#2 | image through a CNN gets… | smaller, deeper | same | ✓ |
| L3s33#3 | concat → GAP | 1024 | 1024 | ✓ |
| L3s33#4 | LeNet S4 size | 10/2 = 5 | 5 | ✓ |
| L3s33#5 | fine-tune slots 3, 4, 5, 7 | freeze, compile 0.1, fit 3, compile 0.01 | same | ✓ |
| L3s33#6 | AlexNet S4 size | ⌊24/2⌋+1 = 13 | 13 | ✓ |

Plus the cells the sample did not reach: LeNet C1 = 28, S2 maps = 6; AlexNet C3/C5/C6 = 27/13/13 (same), S2 maps = 96, S4 maps = 256, S8 = ⌊10/2⌋+1 = 6, Out = 1000. All match `ALL_CELLS`.

## Summary
1. VERIFIED 43 · WRONG 2 · NOT IN SLIDES 1 · AMBIGUOUS 3 (0 beyond-marked); blind sample 58/58 match, all 17 table cells reproduce the printed tables.
2. Fix 1 (NOT IN SLIDES, every L3 round has 2 sum items): the "top four numbers = the four branches' maps" reading (why text + DepthBar). Mark sum items `beyond: true` with a note, or word it only as "the top four add up to the printed depth".
3. Fix 2 (WRONG): `FRAGMENTS.inception.why` attaches "(slide 41)" to the depth concat. Cite 41 for "GoogLeNet's inception module" and 42 for the concat.
4. Fix 3 (WRONG): `UI.cellSubAll` says "as slide 39 prints it" but the Activation column is hidden. Reword it, or show `act` when `showAll`.
5. Fix 4–5 (AMBIGUOUS): drop VGGNet from AlexNet row windows that hold only 3×3 rows (S4–S8); say LeNet's "valid" is inferred from 32 → 28. Nits: add 33 to `ORDERS.lenet5.src`, keep "typically" in the pooling rule, and change the header comment from "no depthwise separable convolution" to "not explained" (slide 47's footnote names it).
