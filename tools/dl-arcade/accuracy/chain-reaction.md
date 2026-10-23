# Accuracy check: Chain Reaction (`chain-reaction`)

- Date: 2026-10-23 · checker: fresh agent, no part in the build
- Sources: `cits5017-lect01-IntroToANNs.pdf` slides 4, 5, 8, 10, 11, 18–31 (text), slides 11, 19, 20, 21, 22, 23, 27, 31 rendered at 110 dpi, plus a 220 dpi crop of Figure 10-8. Transcript `lecture-1.md` (Figure 10-8 description, slide 5 heaviside).
- Files read: `games/chain-reaction/*` (ChainReaction, Scenes, Inputs, layout, glyph, index), `content/chain-reaction.js`, `maths/chainReaction.js`, and the concepts, equations and quirks the game uses in `content/lecture1.js`.
- Blind sample: **62 items** (L1 seeds 11 and 12, L2 seeds 21–23, L3 seeds 31–33), covering every item kind. **62/62 match.**
- Sweep: 9,000 rounds (seeds 1–3000 × 3 levels, 69,000 items). The arithmetic was recomputed independently and `backward()` was checked against a central finite difference (max error 1.5e-9). The `HAND_NET` fallback was never hit. ReLU was never asked at z = 0. The only disagreement is row 29.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | w_{i,j} is the weight from input i to neuron j; W has one row per input feature and one column per neuron | NOTATION, layout EDGES | L1 · 8 (and 10) | VERIFIED | — |
| 2 | v₁, v₂, c are the game's own names; the slides don't name a second layer's weights | NOTATION, T.yhat.maths | L1 · 8, 18 | VERIFIED | — |
| 3 | Loss ℒ = ½(ŷ − y)², the output neuron has no activation | NOTATION.loss | L1 · 11, 24 | VERIFIED | — |
| 4 | z = w₁x₁ + … + b = wᵀx + b, the weighted sum plus bias (slide 8 does a layer) | T.z / cr1-z1, cr1-z2 | L1 · 4, 8 | VERIFIED | — |
| 5 | σ(z) = 1/(1 + exp(−z)) | ACTIVATIONS.sigmoid, T.h.whySigmoid / cr1-h1 | L1 · 20 | VERIFIED | — |
| 6 | tanh(z) = 2σ(2z) − 1, range −1 to +1 (the code's `tanh()` uses this identity) | ACTIVATIONS.tanh, T.h.whyTanh, maths `tanh` | L1 · 21 | VERIFIED | — |
| 7 | tanh is "the **same** S shape as the logistic function" | ACTIVATIONS.tanh.curve (curve why) | L1 · 21 says "a **similar** S shape" | NOT IN SLIDES | change "same" to "similar" |
| 8 | ReLU(z) = max(0, z); it has no maximum output value | ACTIVATIONS.relu, T.h.whyRelu | L1 · 21 | VERIFIED | — |
| 9 | heaviside(z) = 0 if z < 0, 1 if z ≥ 0 | ACTIVATIONS.heaviside, curve-item maths | L1 · 5 | VERIFIED | — |
| 10 | Heaviside derivative is flat 0 with a marker at 0; "the step function has no gradient to work with" | ACTIVATIONS.heaviside.deriv | L1 · 20, 22 | VERIFIED | — |
| 11 | Sigmoid runs 0→1 through 0.5 at z = 0; its derivative is a low bell peaking at 0.25 | ACTIVATIONS.sigmoid | L1 · 22 | VERIFIED | — |
| 12 | Tanh derivative is a taller, narrower bell peaking at 1.0 | ACTIVATIONS.tanh.deriv | L1 · 22 | VERIFIED | — |
| 13 | ReLU derivative is 0 then 1, with the jump at z = 0 marked (magenta × at (0, 1)) | ACTIVATIONS.relu.deriv, `curve()` | L1 · 22 | VERIFIED | — |
| 14 | Legend order: Heaviside, ReLU, Sigmoid, Tanh | CURVE_ID.options | L1 · 22 | VERIFIED | — |
| 15 | Figure 10-8 shows the derivatives as curves only; slide 20 gives a formula for the sigmoid's alone | CURVE_ID.deriv.why / cr3-curve | L1 · 20, 22 | VERIFIED | — |
| 16 | Left panel: Heaviside is drawn with a × marker at (0, 1); the code says "as the figure marks it" | maths `curve()` (panel act) → CurveScene / cr1-curve | L1 · 22: the left panel has no markers (a 220 dpi crop shows only the vertical jump line) | NOT IN SLIDES (cosmetic) | drop the left-panel marker and keep the jump line |
| 17 | Slide 19's four steps, their wording and their order | STEPS.list / cr2-order, cr2-which | L1 · 19 | VERIFIED | — |
| 18 | "Gradient Descent using reverse-mode autodiff", for each training instance | STEPS.order.why | L1 · 19 | VERIFIED | — |
| 19 | GD scene: weights nudged against the gradient (slide 11's w ← w − η∂ℒ/∂w) | STEPS.which.scene.gd | L1 · 11, 19 | VERIFIED | — |
| 20 | The forward pass computes every neuron's output; a regression output usually needs no activation | T.yhat / cr1-yhat | L1 · 19, 24 | VERIFIED | — |
| 21 | Output error is ŷ − y as in slide 11; slide 10's +η(y − ŷ)xᵢ is the same rule (sign convention) | T.error / cr2-error | L1 · 10, 11, 19 | VERIFIED | — |
| 22 | ∂ℒ/∂v_k = (ŷ − y)h_k, which is slide 11's (ŷⱼ − yⱼ)xᵢ with xᵢ → h_k (not marked beyond) | T.dv / cr2-dv | L1 · 11 | VERIFIED | — (direct substitution; the output bias c, which slide 11 lacks, does not enter ∂ŷ/∂v_k) |
| 23 | σ′(z) = σ(z)(1 − σ(z)); it peaks at 0.25 at z = 0 (Figure 10-8) | T.dsig / cr2-dsig | L1 · 20 (+22 for the peak) | VERIFIED | optional: add 22 to `T.dsig.src` (the why quotes Figure 10-8) |
| 24 | ∂ℒ/∂z_k = (ŷ − y)·v_k·σ′(z_k) | T.dz / cr2-dz | beyond (L1 · 19 is words only) | VERIFIED (beyond) | — (correct; finite difference agrees) |
| 25 | ∂ℒ/∂w_{i,k} = (∂ℒ/∂z_k)·x_i | T.dw / cr2-dw | beyond (L1 · 11 analogue) | VERIFIED (beyond) | — |
| 26 | w ← w − η∂ℒ/∂w, "negative error gradient scaled by the learning rate"; slide 19 calls it the GD step | T.update / cr2-update | L1 · 11, 19 | VERIFIED | — |
| 27 | Through tanh: (ŷ − y)·v_k·(1 − h_k²), with tanh′ = 1 − tanh² | T.dzOther.tanh / cr3-dz | beyond (L1 · 22 is a curve only) | VERIFIED (beyond) | — |
| 28 | Through ReLU: ReLU′ = 0 (z < 0), 1 (z > 0); never asked at z = 0 | T.dzOther.relu / cr3-dz | beyond (L1 · 21, 22) | VERIFIED (beyond) | — |
| 29 | cr3-dz tanh key uses h rounded to 2 dp, but the graph also shows z. In 167 of 1,504 tanh items (11%) the exact (ŷ − y)v(1 − tanh²z) is more than the ±0.02 tolerance away from the key (max 0.033; e.g. seed 31: key 0.69, exact 0.72) | maths `dzOtherItem` | — | AMBIGUOUS (the game uses the shown h, as its prompt formula says) | widen the tolerance to 0.04, or show h to 3 dp, or hide z on this stage |
| 30 | f(z) = 2z + 3, g(z) = 5z − 1, f(g(z)) = 2(5z − 1) + 3 = 10z + 1; without nonlinearity a deep stack equals one layer | COLLAPSE (slideExample, maths line) / cr1-collapse | L1 · 23 | VERIFIED | — |
| 31 | Collapsed slope = product of the slopes, intercept = the value at z = 0 (2- and 3-layer stacks) | COLLAPSE.slope/intercept, `compose()` | L1 · 23 (its substitution, generalised) | VERIFIED | — |
| 32 | Regression (one value or multivariate): 1 neuron per prediction dimension, no output activation, MSE | TASKS reg.one, reg.multi | L1 · 24, 27 | VERIFIED | — |
| 33 | Always-positive output: ReLU or softplus(z) = log(1 + exp(z)) | TASKS reg.positive | L1 · 24, 27 | VERIFIED | — |
| 34 | Bounded output: logistic or tanh, then scale to the range | TASKS reg.bounded | L1 · 24, 27 | VERIFIED | — |
| 35 | Outliers: Huber ("MSE, or Huber if outliers"); Huber combines MSE and MAE | TASKS reg.outliers | L1 · 27 | VERIFIED | — |
| 36 | Regression cards without outliers reject Huber | TASKS `loss: ['mse']` (reg.one/multi/positive/bounded) | L1 · 27: the table says "MSE, or Huber if outliers", but the prose says "Alternatively, the Huber loss … can also be used" | AMBIGUOUS (the game follows the table) | accept Huber on every regression card, or say in the why that the table keeps Huber for outliers |
| 37 | Binary: 1 neuron, Sigmoid, X-entropy | TASKS cls.binary | L1 · 29, 31 | VERIFIED | — |
| 38 | Multilabel: 1 neuron per binary label, Sigmoid, X-entropy | TASKS cls.multilabel | L1 · 29, 31 | VERIFIED | — |
| 39 | Multiclass: 1 neuron per class, Softmax (outputs are probabilities that sum to 1), cross-entropy (log loss); MNIST K = 10 | TASKS cls.multiclass | L1 · 29, 30, 31 | VERIFIED | — |
| 40 | Card picture: hidden layer drawn as ReLU, softmax as one band across the outputs | Scenes HeadPicture | L1 · 27 (hidden: ReLU), 30 (Fig 10-9) | VERIFIED | — |
| 41 | "Slides 24–31’s tables are the answer key" | INTRO[3] | L1 · 27, 31 hold the tables (24 and 29 are prose) | VERIFIED (loose) | optional: "slides 24–31 (tables on 27 and 31)" |
| 42 | Each manifest concept's slides teach it (tlu 4, sigmoid 20, tanh 21, relu 21, backprop 19, ruleGradient 11, derivatives 22, why 23, regression 24/27, classification 29/31) | index.js, lecture1.js CONCEPTS | as listed | VERIFIED | — |
| 43 | Every slide number quoted in a why or receipt (T.*, TASKS, CURVE_ID, COLLAPSE, STEPS) | content/chain-reaction.js | L1 · 4, 5, 8, 10, 11, 19–24, 27, 29–31 | VERIFIED | — (no off-by-one found) |

Other note (robustness, not a claim): `HAND_NET` (the `makeNet` fallback) gives z₁ = 2·0.5 + (−1)·1 + 0 = 0. If it were ever used for a ReLU net, cr3-dz could ask ReLU′(0), which slide 21 says is undefined (the code returns 0). It was never reached in 9,000 rounds. Cheap guard: nudge `b[0]` in the fallback when `act === 'relu'`.

## Blind sample (62 items; I worked each from the prompt before reading the key)

| # | item | prompt (short) | mine | game | match |
|---|---|---|---|---|---|
| 1 | L1 s11 z1 | x=(1,1), w=1,1, b=0 | 2 | 2 | ✓ |
| 2 | L1 s11 h1 | σ(2) | 0.88 | 0.88 | ✓ |
| 3 | L1 s11 z2 | x=(1,1), w=2,−1, b=0.5 | 1.5 | 1.5 | ✓ |
| 4 | L1 s11 ŷ | −1·0.88 − 1·0.82 + 1 | −0.70 | −0.7 | ✓ |
| 5 | L1 s11 curve | 0 for z<0, slope 1 after, no marker | ReLU | relu | ✓ |
| 6 | L1 s11 slope | f=−2z−2, g=4z−3 | −8 | −8 | ✓ |
| 7 | L1 s11 intercept | same | 4 | 4 | ✓ |
| 8 | L1 s12 z1 | x=(−1,−1), w=0.5,−0.5, b=−0.5 | −0.5 | −0.5 | ✓ |
| 9 | L1 s12 h1 | ReLU(−0.5) | 0 | 0 | ✓ |
| 10 | L1 s12 z2 | x=(−1,−1), w=−1,−0.5, b=−1 | 0.5 | 0.5 | ✓ |
| 11 | L1 s12 ŷ | 1·0 + 1·0.5 − 0.5 | 0 | 0 | ✓ |
| 12 | L1 s12 curve | 0.27 at −1, 0.73 at 1, smooth | Sigmoid | sigmoid | ✓ |
| 13 | L1 s12 slope | f=4z−3, g=−2z−1 | −8 | −8 | ✓ |
| 14 | L1 s12 intercept | same | −7 | −7 | ✓ |
| 15 | L2 s21 which | signals flow forward, outputs appear | forward | forward | ✓ |
| 16 | L2 s21 order | shuffled | F, E, R, GD | same | ✓ |
| 17 | L2 s21 ŷ − y | −0.37 − 0.13 | −0.5 | −0.5 | ✓ |
| 18 | L2 s21 ∂ℒ/∂v₂ | −0.5 × 0.68 | −0.34 | −0.34 | ✓ |
| 19 | L2 s21 σ′ | 0.68 × 0.32 | 0.22 | 0.22 | ✓ |
| 20 | L2 s21 ∂ℒ/∂z₂ (beyond) | −0.5 × 2 × 0.22 | −0.22 | −0.22 | ✓ |
| 21 | L2 s21 ∂ℒ/∂w₁,₂ (beyond) | −0.22 × 0.5 | −0.11 | −0.11 | ✓ |
| 22 | L2 s21 update | 0.5 − 0.1 × (−0.11) | 0.51 | 0.51 | ✓ |
| 23 | L2 s22 which | forward scene | forward | forward | ✓ |
| 24 | L2 s22 order | shuffled | F, E, R, GD | same | ✓ |
| 25 | L2 s22 ŷ − y | −0.97 − 1.03 | −2 | −2 | ✓ |
| 26 | L2 s22 ∂ℒ/∂v₁ | −2 × 0.27 | −0.54 | −0.54 | ✓ |
| 27 | L2 s22 σ′ | 0.27 × 0.73 | 0.20 | 0.2 | ✓ |
| 28 | L2 s22 ∂ℒ/∂z₁ (beyond) | −2 × 1 × 0.2 | −0.4 | −0.4 | ✓ |
| 29 | L2 s22 ∂ℒ/∂w₁,₁ (beyond) | −0.4 × 1 | −0.4 | −0.4 | ✓ |
| 30 | L2 s22 update | −0.5 − 0.1 × (−0.4) | −0.46 | −0.46 | ✓ |
| 31 | L2 s23 which | gradients flow backwards | reverse | reverse | ✓ |
| 32 | L2 s23 order | shuffled | F, E, R, GD | same | ✓ |
| 33 | L2 s23 ŷ − y | −0.5 − 0.5 | −1 | −1 | ✓ |
| 34 | L2 s23 ∂ℒ/∂v₁ | −1 × 0.38 | −0.38 | −0.38 | ✓ |
| 35 | L2 s23 σ′ | 0.38 × 0.62 | 0.24 | 0.24 | ✓ |
| 36 | L2 s23 ∂ℒ/∂z₁ (beyond) | −1 × 2 × 0.24 | −0.48 | −0.48 | ✓ |
| 37 | L2 s23 ∂ℒ/∂w₂,₁ (beyond) | −0.48 × (−1) | 0.48 | 0.48 | ✓ |
| 38 | L2 s23 update v₁ | 2 − 0.5 × (−0.38) | 2.19 | 2.19 | ✓ |
| 39 | L3 s31 card | multivariate, 2 values | 2 · None · MSE | same | ✓ |
| 40 | L3 s31 card | multiclass, 10 | 10 · Softmax · X-ent | same | ✓ |
| 41 | L3 s31 deriv curve | 0.42 at ±1, 0.79 at ±0.5 | Tanh | tanh | ✓ |
| 42 | L3 s31 slope | f=2z+2, g=3z+1, k=2z−2 | 12 | 12 | ✓ |
| 43 | L3 s31 intercept | same | −8 | −8 | ✓ |
| 44 | L3 s31 card | regression, any value | 1 · None · MSE (Huber arguable, row 36) | 1 · None · MSE | ✓ |
| 45 | L3 s31 tanh step (beyond) | 2 × 2 × (1 − 0.91²) | 0.69 | 0.69 | ✓ (exact from z = 0.72, row 29) |
| 46 | L3 s31 card | binary | 1 · Sigmoid · X-ent | same | ✓ |
| 47 | L3 s32 card | always positive | 1 · ReLU/softplus · MSE | same | ✓ |
| 48 | L3 s32 card | multiclass, 3 | 3 · Softmax · X-ent | same | ✓ |
| 49 | L3 s32 deriv curve | peak ≈ 0.25, 0.20 at ±1 | Sigmoid | sigmoid | ✓ |
| 50 | L3 s32 slope | f=−2z+2, g=−2z−3, k=3z+3 | 12 | 12 | ✓ |
| 51 | L3 s32 intercept | same | 20 | 20 | ✓ |
| 52 | L3 s32 card | regression with outliers | 1 · None · Huber | same | ✓ |
| 53 | L3 s32 ReLU step (beyond) | z=2.5: (−1)(−1)(1) | 1 | 1 | ✓ |
| 54 | L3 s32 card | binary | 1 · Sigmoid · X-ent | same | ✓ |
| 55 | L3 s33 card | bounded range | 1 · Sigmoid/tanh · MSE | same | ✓ |
| 56 | L3 s33 card | binary | 1 · Sigmoid · X-ent | same | ✓ |
| 57 | L3 s33 deriv curve | peak ≈ 0.25 | Sigmoid | sigmoid | ✓ |
| 58 | L3 s33 slope | f=−2z+2, g=−2z+2, k=3z+3 | 12 | 12 | ✓ |
| 59 | L3 s33 intercept | same | 10 | 10 | ✓ |
| 60 | L3 s33 card | regression, any value | 1 · None · MSE | same | ✓ |
| 61 | L3 s33 ReLU step (beyond) | z=0.5: (−2)(−2)(1) | 4 | 4 | ✓ |
| 62 | L3 s33 card | multiclass, 3 | 3 · Softmax · X-ent | same | ✓ |

The why texts I checked (items 2, 4, 6, 9, 17–22, 27, 38, 41, 42, 45, 52, 53) reproduce their numbers and cite the right slides.

## Summary
1. Counts: VERIFIED 39 (4 of them beyond: ∂ℒ/∂z and ∂ℒ/∂w through σ, and the tanh and ReLU reverse steps, all correctly flagged and mathematically right) · WRONG 0 · NOT IN SLIDES 2 · AMBIGUOUS 2. Blind sample: 62/62 match.
2. Fix 1 (AMBIGUOUS, highest): cr3-dz through tanh is graded on h rounded to 2 dp while z is on screen. 11% of these items reject the exact chain-rule value (off by up to 0.033 against ±0.02). Widen the tolerance to 0.04, show h to 3 dp, or hide z.
3. Fix 2 (AMBIGUOUS): regression cards without outliers reject Huber, but slide 27's prose says Huber "can also be used". Accept it, or say in the why that the table keeps Huber for outliers.
4. Fix 3 (NOT IN SLIDES, wording): ACTIVATIONS.tanh.curve "the same S shape" should be slide 21's "a similar S shape".
5. Fix 4 (NOT IN SLIDES, cosmetic) and optional tidy-ups: drop the Heaviside × marker from the left-panel curve (the figure marks only the right panel). Add 22 to `T.dsig.src`. INTRO[3]: "tables on 27 and 31". Guard the `HAND_NET` ReLU fallback (z₁ = 0).
