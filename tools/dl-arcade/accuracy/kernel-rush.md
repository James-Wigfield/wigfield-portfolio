# Accuracy check: Kernel Rush (`kernel-rush`)

Date: 2026-10-23. Checker: a fresh agent with no stake in the build. I read every file in `games/kernel-rush/` (KernelRush.jsx, Stage.jsx, geometry.js, glyph.jsx, index.js), `content/kernel-rush.js`, `maths/kernelRush.js`, the shape and count rules it calls in `maths/shapes.js` and `maths/params.js`, and the 8 concept ids plus 4 EQUATIONS it uses in `content/lecture3.js`. Sources: the Lecture 3 PDF (text for slides 7–9, 12–22, 25–31, 33, 37, 39, 42, 43, 51; rendered s9, s15, s20, s21 (zoomed), s26, s42) and `lecture-3.md` (slides 1–16; it has no Quirks section).
Blind sample: **68 generated items** (level 1: seeds 11, 22; level 2: seeds 33, 44; level 3: seeds 55, 66, 77, 88). **68/68 match.** I also swept seeds 1–400 at every level (1,200 rounds, 10,800 items) against my own solver built from the slides' rules ("valid": n − f + 1 window positions, "same": all n, a stride s keeps every s-th; params (f_h·f_w·f_c + 1)·f_n; pooling 0). **0 disagreements.** All four slide-table stacks came up, and every receptive-field answer falls inside the drawn grid.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Keras defaults: padding="valid"; pooling strides = pool size | content INTRO.controls | L3 · 20, 28 | VERIFIED | — |
| 2 | "valid" keeps the window inside, each axis loses f − 1; 70 × 120 → 64 × 114 with kernel_size=7 | RULES.valid1 (kr1 valid items) | L3 · 17–18 (shapes), 20 ("6 fewer pixels"), 37 (f = 5: 32→28, 14→10, 5→1) | VERIFIED | Slide 18 prints only the 64 × 114 output. The 70 × 120 input is on slide 17 (and 19), so add 17 to `src`. |
| 3 | "valid" means no padding (the window stays inside the image) | RULES.valid1, MATHS.valid | L3 · 20 says "valid … means zero-padding"; L3 · 28 says "no padding at all" | AMBIGUOUS | Slide 20 contradicts itself and slide 28. The game takes the correct reading (slide 20's parenthetical plus slide 28). Cite 28 beside 20 in MATHS.valid. |
| 4 | "same" zero-pads; at stride 1, H × W stays (70 × 120 → 70 × 120) | RULES.same1 | L3 · 20 | VERIFIED | — |
| 5 | Stride > 1 shrinks even with "same"; keeps every s-th of n; Figure 14-8 10 → 5 | RULES.same2, STEP_RULE.same2 | L3 · 21 (rendered: 2 + 10 + 3 cells → 5 outputs), 9 | VERIFIED | — |
| 6 | "valid" + stride: n − f + 1 positions, every s-th kept; Figure 14-8 10 − 7 + 1 = 4 → 2 | RULES.valid2, STEP_RULE.valid2 | L3 · 21 (rendered: 9 used + 1 "Ignored" = 10 → 2), 9, 20 | VERIFIED | — |
| 7 | Depth = number of filters | RULES.depth, MATHS.depth | L3 · 13 | VERIFIED | — |
| 8 | Each filter spans all c input channels (n_h × n_w × N_channels) and makes one output channel z_k | RULES.multiChannel, MATHS.filterSize | L3 · 15 | VERIFIED | — |
| 9 | Pooling: strides default to the pool size, padding "valid"; p × p windows tile the map; depth kept | RULES.pool, STEP_RULE.pool, MATHS.pool | L3 · 28, 26 (2 × 2, stride 2), 29 | VERIFIED | — |
| 10 | Inline "(slides 26, 29)" attached to "each channel is pooled on its own, so the depth stays c" | RULES.pool text | L3 · 26 says nothing about channels or depth | WRONG (minor) | Cite 26 on the tiling clause and 29 on the depth clause. |
| 11 | strides=1 + "same" keeps H × W, like GoogLeNet's "3 × 3 + 1(S)" max pool | RULES.poolSame (kr2 poolSame) | L3 · 42 (rendered: Max pool 3×3+1(S) in Fig. 14-14), 29 | VERIFIED | — |
| 12 | Global average pooling: one number per map, h × w × c → (c,); [2, 70, 120, 3] → (2, 3) | RULES.gap, MATHS.gap | L3 · 31 | VERIFIED | — |
| 13 | GlobalAvgPool2D bonus = 0 ("a pooling neuron has no weights") | paramsItem → RULES.poolParams (kr2 gap) | L3 · 25, 29; slide 31 puts GAP under Pooling ("Similar to AveragePooling2D") | VERIFIED | Add 31 to `src` on the GAP bonus so the receipt names the layer. |
| 14 | Conv2D params: kernels [f_h, f_w, f_c, f_n] + one bias per filter = (f_h·f_w·c + 1)·k; H and W don't enter | RULES.convParams | L3 · 16, 22 | VERIFIED | — |
| 15 | Pooling params = 0 (max/mean only) | RULES.poolParams, MATHS.poolParams | L3 · 25, 29 | VERIFIED | — |
| 16 | Stack params: sum of the Conv2D counts, each with its own input's f_c; pooling adds 0 | RULES.stackParams | L3 · 16, 22, 25 | VERIFIED | — |
| 17 | Stack why says "(slides 13, 29)" but the receipt has no 29 when the stack has no pooling | RULES.stack.src = [13] (kr3 #41, #55, #62) | L3 · 29 | WRONG (minor) | Set RULES.stack.src to [13, 29], or drop "pooling keeps it (… 29)" when the stack has no pooling layer. |
| 18 | LeNet-5 C1 → S2: 32 × 32 × 1 → 28 × 28 × 6 → 14 × 14 × 6 (5 × 5, s1; 2 × 2 avg, s2) | TABLE_STACKS lenet-c1s2 | L3 · 37 | VERIFIED | — |
| 19 | LeNet-5 C3 → S4 → C5: 14 × 14 × 6 → 10 × 10 × 16 → 5 × 5 × 16 → 1 × 1 × 120 | TABLE_STACKS lenet-c3c5 | L3 · 37 | VERIFIED | — |
| 20 | AlexNet C1 → S2: 227 × 227 × 3 → 55 × 55 × 96 (11 × 11, s4, valid) → 27 × 27 × 96 (3 × 3 max, s2, valid) | TABLE_STACKS alexnet-c1s2 | L3 · 39 | VERIFIED | — |
| 21 | AlexNet why: "Max pooling keeps the 96 maps (slide 29)", but `src` is [39] only | TABLE_STACKS alexnet-c1s2.src | L3 · 29 | WRONG (minor) | Use `src` [29, 39]. |
| 22 | AlexNet C3 → S4 → C5: 27 × 27 × 96 → 27 × 27 × 256 (same) → 13 × 13 × 256 (3 × 3, s2) → 13 × 13 × 384 (same) | TABLE_STACKS alexnet-c3c5 | L3 · 39 | VERIFIED | — |
| 23 | Drawer for the AlexNet C3 → S4 → C5 item: its only pooling rule is "strides default to the pool size … tile", which gives 27/3 = 9, not 13. The n − f + 1 and every-s-th lines are missing because rule `poolOther` adds neither | kernelRush.js `shapeMaths` (kr3 table, alexnet-c3c5) | L3 · 9, 20, 21 (the rule that does reproduce: 27 − 3 + 1 = 25 positions, every 2nd → 13) | WRONG | In `shapeMaths`, push MATHS.valid and MATHS.stride when `rules.has('poolOther')`. Optionally add the slide-terms working to both AlexNet whys (217 → 55, 53 → 27, 25 → 13), as the LeNet whys do. |
| 24 | Level-1 opener (the slide-18 layer): 70 × 120 × 3 → Conv2D(32, 7) → 64 × 114 × 32; bonus (7·7·3 + 1)·32 = 4,736 | SLIDE18, paramsItem | L3 · 17, 18, 19 (kernels (7, 7, 3, 32), biases (32,)) | VERIFIED | Add 19 to the bonus `src`, since it prints this layer's weight shapes. Slide 19's "[2, 64, 114, 3]" is a slide typo for 32; the game cites 18, so it is unaffected. |
| 25 | Neuron (i, j) sees rows i·s_h … i·s_h + f_h − 1, columns j·s_w … j·s_w + f_w − 1, across all maps | RULES.rf, MATHS.rf, EQUATIONS.receptiveFieldIndices | L3 · 9 (rendered), 14 | VERIFIED | — |
| 26 | "Count from 0, as on slide 9" | PROMPTS.rfSub | L3 · 9 (the formula puts row 0's field at rows 0 … f_h − 1) | VERIFIED | Slide 9's grid is zero-padded. Every rf layer here is "valid", so input row 0 is a real row and the formula applies directly. |
| 27 | "valid": n − f + 1 positions per axis (the deck prints no general formula) | MATHS.valid | L3 · 18, 20 (Fig. 14-7: 10 → 4 brackets), 37 | VERIFIED | Not printed as a formula, but every slide example reproduces it. Add 37 as the f = 5 anchor. |
| 28 | "same" keeps all n positions | MATHS.same | L3 · 20 | VERIFIED | — |
| 29 | strides=s keeps every s-th position; the stride is the distance between consecutive receptive fields | MATHS.stride | L3 · 9, 21 | VERIFIED | — |
| 30 | z_k = b_k + Σ_{c=0}^{N_channels − 1} x_c ∗ f_{c,k} | EQUATIONS.convOutputChannel in drawer | L3 · 15 (rendered) | VERIFIED | — |
| 31 | [f_h, f_w, f_c, f_n], [f_n]; (5 × 5 × 3 + 1) × 200 = 15,200 | MATHS.params + EQUATIONS in drawer | L3 · 16, 22 | VERIFIED | — |
| 32 | Stage: conv kernel drawn as deep as the input ("kernel k × k × c"); pooling window flat; GAP window = whole map | Stage.jsx BlockStage, KernelRush kernelLabel | L3 · 15, 29, 31 | VERIFIED | — |
| 33 | Generated stacks get deeper as the map shrinks | kernelRush.js stackDrop (filters 8/16 → 32 → 64) | L3 · 33 | VERIFIED | — |
| 34 | Concept slide lists: cnn.stride [9, 14], cnn.padding [20, 21], cnn.featureMaps [12–15], params.conv2d [8, 16, 22], params.pool [25, 29], shape.conv2d [18–21, 37, 39], pool.global [31, 43, 51] | index.js concepts → lecture3.js | L3 · as listed (43: "Global avg pool"; 51: GlobalAveragePooling2D) | VERIFIED | — |
| 35 | Concept shape.pool slides [26, 29, 37, 39] | lecture3.js shape.pool | L3 · 28 (the defaults the pool items use), 42 | VERIFIED | Add 28 (and 42 for the "same" pool), the slides the game's pool whys cite most. |
| 36 | Nothing `beyond`; the beyond-flagged EQUATIONS.outputSize (⌊(n−f)/s⌋+1, ⌈n/s⌉) is never shown | content header; kernelRush.js imports | L3 Quirk l3.quirk.noOutputSizeFormula | VERIFIED | — |

## Blind sample
My working: "valid" n − f + 1 then ÷ s; "same" n ÷ s; depth = filters; pool p: n ÷ p (default strides); params (f_h·f_w·c_in + 1)·f_n; rf: first = idx·s, last = first + f − 1.

| # | run | prompt (no answer shown) | mine | game | match |
|---|---|---|---|---|---|
| 1 | L1/s11 | 70×96×3 → Conv2D(8, k5) | 66×92×8 | 66×92×8 | yes |
| 2 | L1/s11 | same · Param # | 608 | 608 | yes |
| 3 | L1/s11 | 96×96×1 → Conv2D(16, k7, same) | 96×96×16 | 96×96×16 | yes |
| 4 | L1/s11 | same · Param # | 800 | 800 | yes |
| 5 | L1/s11 | 100×100×1 → Conv2D(16, k3, same) | 100×100×16 | 100×100×16 | yes |
| 6 | L1/s11 | same · Param # | 160 | 160 | yes |
| 7 | L1/s11 | 96×96×3 → Conv2D(16, k5, s2) | 46×46×16 | 46×46×16 | yes |
| 8 | L1/s11 | same · Param # | 1,216 | 1,216 | yes |
| 9 | L1/s11 | 120×56×3 → Conv2D(8, k3, s2, same) | 60×28×8 | 60×28×8 | yes |
| 10 | L1/s11 | same · Param # | 224 | 224 | yes |
| 11 | L1/s22 | 48×48×1 → Conv2D(64, k5) | 44×44×64 | 44×44×64 | yes |
| 12 | L1/s22 | same · Param # | 1,664 | 1,664 | yes |
| 13 | L1/s22 | 100×28×1 → Conv2D(8, k3, same) | 100×28×8 | 100×28×8 | yes |
| 14 | L1/s22 | same · Param # | 80 | 80 | yes |
| 15 | L1/s22 | 32×32×1 → Conv2D(64, k5) | 28×28×64 | 28×28×64 | yes |
| 16 | L1/s22 | same · Param # | 1,664 | 1,664 | yes |
| 17 | L1/s22 | 32×64×1 → Conv2D(32, k3, s2, same) | 16×32×32 | 16×32×32 | yes |
| 18 | L1/s22 | same · Param # | 320 | 320 | yes |
| 19 | L1/s22 | 70×70×1 → Conv2D(8, k7, s2, valid) | 32×32×8 | 32×32×8 | yes |
| 20 | L1/s22 | same · Param # | 400 | 400 | yes |
| 21 | L2/s33 | 56×14×32 → Conv2D(32, k5) | 52×10×32 | 52×10×32 | yes |
| 22 | L2/s33 | same · Param # | 25,632 | 25,632 | yes |
| 23 | L2/s33 | 64×64×96 → AvgPool2D(2) | 32×32×96 | 32×32×96 | yes |
| 24 | L2/s33 | same · Param # | 0 | 0 | yes |
| 25 | L2/s33 | 16×64×32 → Conv2D(32, k3, same) | 16×64×32 | 16×64×32 | yes |
| 26 | L2/s33 | same · Param # | 9,248 | 9,248 | yes |
| 27 | L2/s33 | 36×36×32 → MaxPool2D(3) | 12×12×32 | 12×12×32 | yes |
| 28 | L2/s33 | same · Param # | 0 | 0 | yes |
| 29 | L2/s33 | 32×32×32 → Conv2D(128, k5, s2, same) | 16×16×128 | 16×16×128 | yes |
| 30 | L2/s33 | same · Param # | 102,528 | 102,528 | yes |
| 31 | L2/s44 | 14×14×64 → Conv2D(64, k3) | 12×12×64 | 12×12×64 | yes |
| 32 | L2/s44 | same · Param # | 36,928 | 36,928 | yes |
| 33 | L2/s44 | 32×16×32 → MaxPool2D(2) | 16×8×32 | 16×8×32 | yes |
| 34 | L2/s44 | same · Param # | 0 | 0 | yes |
| 35 | L2/s44 | 64×56×16 → Conv2D(64, k3, same) | 64×56×64 | 64×56×64 | yes |
| 36 | L2/s44 | same · Param # | 9,280 | 9,280 | yes |
| 37 | L2/s44 | 28×28×64 → MaxPool2D(3, s1, same) | 28×28×64 | 28×28×64 | yes |
| 38 | L2/s44 | same · Param # | 0 | 0 | yes |
| 39 | L2/s44 | 14×14×64 → Conv2D(128, k3, s2, same) | 7×7×128 | 7×7×128 | yes |
| 40 | L2/s44 | same · Param # | 73,856 | 73,856 | yes |
| 41 | L3/s55 | 32×32×3 → Conv2D(16, k3, s2, valid) → Conv2D(32, k5, same) | 15×15×32 | 15×15×32 | yes |
| 42 | L3/s55 | same · total Param # | 448 + 12,832 = 13,280 | 13,280 | yes |
| 43 | L3/s55 | 8×8 · Conv2D(k2, s3) · neuron (2, 1) · columns | 3 to 4 | 3 to 4 | yes |
| 44 | L3/s55 | AlexNet C1 → S2 (227×227×3) | 27×27×96 | 27×27×96 | yes |
| 45 | L3/s55 | 56×56×3 → Conv2D(16, k5, s2, same) → Conv2D(32, k3) → MaxPool2D(2) | 13×13×32 | 13×13×32 | yes |
| 46 | L3/s55 | same · total Param # | 1,216 + 4,640 + 0 = 5,856 | 5,856 | yes |
| 47 | L3/s55 | 6×11 · Conv2D(k(4,5), s(1,3)) · neuron (1, 2) · columns | 6 to 10 | 6 to 10 | yes |
| 48 | L3/s66 | 16×16×1 → Conv2D(16, k3, s2, same) → MaxPool2D(2) | 4×4×16 | 4×4×16 | yes |
| 49 | L3/s66 | same · total Param # | 160 | 160 | yes |
| 50 | L3/s66 | 11×11 · Conv2D(k5, s2) · neuron (2, 3) · rows | 4 to 8 | 4 to 8 | yes |
| 51 | L3/s66 | LeNet-5 C1 → S2 (32×32×1) | 14×14×6 | 14×14×6 | yes |
| 52 | L3/s66 | 56×56×3 → Conv2D(8, k3, same) → Conv2D(32, k5) → AvgPool2D(2) | 26×26×32 | 26×26×32 | yes |
| 53 | L3/s66 | same · total Param # | 224 + 6,432 = 6,656 | 6,656 | yes |
| 54 | L3/s66 | 11×11 · Conv2D(k(5,2), s(2,3)) · neuron (2, 1) · rows | 4 to 8 | 4 to 8 | yes |
| 55 | L3/s77 | 32×32×1 → Conv2D(8, k3) → Conv2D(32, k3, s2, valid) | 14×14×32 | 14×14×32 | yes |
| 56 | L3/s77 | same · total Param # | 80 + 2,336 = 2,416 | 2,416 | yes |
| 57 | L3/s77 | 11×11 · Conv2D(k3, s2, valid) · neuron (1, 1) · rows | 2 to 4 | 2 to 4 | yes |
| 58 | L3/s77 | LeNet-5 C1 → S2 | 14×14×6 | 14×14×6 | yes |
| 59 | L3/s77 | 28×28×1 → Conv2D(16, k5, valid) → Conv2D(32, k3, same) → AvgPool2D(2) | 12×12×32 | 12×12×32 | yes |
| 60 | L3/s77 | same · total Param # | 416 + 4,640 = 5,056 | 5,056 | yes |
| 61 | L3/s77 | 9×8 · Conv2D(k(3,5), s(2,1)) · neuron (2, 2) · rows | 4 to 6 | 4 to 6 | yes |
| 62 | L3/s88 | 28×28×1 → Conv2D(16, k5, valid) → Conv2D(32, k5, s2, same) | 12×12×32 | 12×12×32 | yes |
| 63 | L3/s88 | same · total Param # | 416 + 12,832 = 13,248 | 13,248 | yes |
| 64 | L3/s88 | 14×14 · Conv2D(k5, s3) · neuron (3, 2) · rows | 9 to 13 | 9 to 13 | yes |
| 65 | L3/s88 | LeNet-5 C3 → S4 → C5 (14×14×6) | 1×1×120 | 1×1×120 | yes |
| 66 | L3/s88 | 28×28×1 → Conv2D(16, k5, same) → AvgPool2D(2) → MaxPool2D(2) | 7×7×16 | 7×7×16 | yes |
| 67 | L3/s88 | same · total Param # | 416 | 416 | yes |
| 68 | L3/s88 | 6×14 · Conv2D(k(4,2), s(1,3)) · neuron (2, 4) · columns | 12 to 13 | 12 to 13 | yes |

All 68 match, and so does the 10,800-item sweep. Every shape, count and receptive-field range reproduces from the slides' rules. The problems are one drawer gap and a few citations.

## Summary
- Verdicts (36 claims): **31 VERIFIED** (0 beyond), **4 WRONG** (3 of them minor citations), **0 NOT IN SLIDES**, **1 AMBIGUOUS** (slide 20 calls "valid" zero-padding; the game correctly uses slide 28's "no padding"). Blind sample: 68/68; sweep: 10,800/10,800.
- Fix 1, `maths/kernelRush.js` `shapeMaths`: when the drop has rule `poolOther` (AlexNet's overlapping 3 × 3, stride 2 pool), add MATHS.valid and MATHS.stride. Today the AlexNet C3 → S4 → C5 drawer offers only "strides = pool size, tile", which gives 9, not 13. Optionally add the slide-terms working (217 → 55, 53 → 27, 25 → 13) to both AlexNet whys.
- Fix 2, citations: RULES.stack.src → [13, 29] (the text cites 29 even for conv-only stacks). alexnet-c1s2.src → [29, 39]. In RULES.pool, move "26" onto the tiling clause, since slide 26 says nothing about depth.
- Fix 3, receipts to strengthen (not wrong): valid1 add 17 (where 70 × 120 is printed), MATHS.valid cite 28 and 37, GAP bonus add 31, slide-18 bonus add 19, concept shape.pool add 28 (and 42).
- Fix 4: none needed in the maths. Clean sizes keep the "every s-th position" rule exact, and the table stacks ask no Param # bonus, which wisely sidesteps LeNet C3's sparse connections and AlexNet's grouping, neither of which is on the slides.
