# Accuracy check: Boundary Bash (`boundary-bash`)

Lecture 1 · checked 2026-10-23 · sources: `cits5017-lect01-IntroToANNs.pdf` (rendered 4, 5, 10, 11, 12, 13, 16, 17 at 110 dpi, and slide 17 again at 200 dpi; text of 9, 14 and 15 via pdftotext) + `lecture-1.md` (slides 4–17; the transcript has no Quirks section).
Sample: **58 generated items solved blind**. That is every item of seed 11 at L1, seeds 12, 13 and 15 at L2, and seeds 14 and 16 at L3: 6 dir, 3 rule, 1 tlu, 2 step, 3 z, 3 yhat, 15 upd (6 shown, 6 hidden, 3 trap), 6 L2 concept, 2 fix, 6 XOR forward, 6 XOR blank, 4 L3 concept. All 58 match.
Sweep: 43,500 items (seeds 1–1500 × L1–3). I recomputed ŷ = heaviside(wᵀx + b), the slide-10 update, the dir answer, the step / z / ŷ answers and the rule ghosts independently. Result: 0 failures. Every rule item has exactly one dashed candidate equal to the slide-10 update. Exactly one candidate per XOR blank solves XOR. The net outputs 0, 1, 1, 0.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | TLU: z = w₁x₁ + ⋯ + wₙxₙ + b = wᵀx + b, h_{w,b}(x) = step(z); Fig 10-4 draws 3 inputs | TLU, ZQ, `tluZ`, EQUATIONS.tluSum, NOTATION.text | 1 · 4 | VERIFIED | – |
| 2 | TLU distractors wᵀx + b, step(wᵀx), wᵀstep(x) + b are not the output | TLU.choices | 1 · 4 (Fig 10-4 "Output: step(wᵀx+b)") | VERIFIED | – |
| 3 | heaviside = 0 if z < 0, 1 if z ≥ 0, "the most common" | STEP.why.heaviside, `heaviside`, EQUATIONS.heaviside | 1 · 5 | VERIFIED | – |
| 4 | sign = −1 / 0 / +1; at z = 0 heaviside gives 1 and sign gives 0 | STEP.why.sign, STEP.zeroNote, YHAT.zeroNote, `sign` | 1 · 5 | VERIFIED | – |
| 5 | Tinted ŷ = 1 half-plane includes the boundary (≥ 0) | geometry `halfPlane`, LABELS.planeAria | 1 · 5 | VERIFIED | – |
| 6 | Fed one instance at a time; only neurons with a wrong prediction get reinforced | DIR.why.stay, CONCEPT_L2 `hebb`, UPD.whyStay | 1 · 9 | VERIFIED | – |
| 7 | `hebb` distractors (whole set as one matrix, one feature at a time) are false for training | CONCEPT_L2.a `hebb` | 1 · 9 (slide 8's matrix computes outputs, not training) | VERIFIED | – |
| 8 | Rule w_{i,j}^(next step) = w_{i,j} + η(y_j − ŷ_j)x_i (plus sign, target − output, times input x_i) | RULE.forms.s10, `ruleNext`, EQUATIONS.perceptronRule, MATHS.rule | 1 · 10 (also typeset atop 11) | VERIFIED | – |
| 9 | Handwritten boxed form w_{i,j} − η(ŷ_j − y_j)x_i is the same rule | RULE.forms.s11, RULE.why.s11, `ruleNext11`, MATHS.rule11 | 1 · 11 | VERIFIED | – |
| 10 | Distractors s10sign, s11sign, noX (no x_i), yhatX (× ŷ), targetX (× y) are not the rule; never numerically equal to it | RULE.forms, `ruleOptions` | 1 · 10–11 | VERIFIED | – (sweep: 4,500 rule items, 1 matching ghost each) |
| 11 | y − ŷ = +1 → w + ηx ("toward x"); −1 → w − ηx ("away"); 0 → stays | DIR, `dirItem` | 1 · 9–10 | VERIFIED | – ("toward/away" is the game's gloss of the rule) |
| 12 | Update by hand w_i + η(y − ŷ)x_i, η ∈ {1, 0.5, 2}; hidden ŷ = heaviside(z) | UPD, `updItem` | 1 · 4, 5, 10 | VERIFIED | – (9,000 swept) |
| 13 | Trap why cites "(slide 9)" but the item's src is [4, 5, 10] | UPD.whyStay, bb2-9-updtrap | 1 · 9 | VERIFIED | optional: add 9 to src when y = ŷ |
| 14 | "the slides give no update for the bias, so b stays fixed here" | NOTATION.text, MATHS.where, LABELS.fixed | 1 · 4–17 (slide 10 updates w_{i,j} only) | VERIFIED | – (game simplification, flagged; see #26) |
| 15 | Linear boundary per output neuron → incapable of complex patterns, like LogReg | CONCEPT_L2 `linear` | 1 · 12 | VERIFIED | – (distractor "fed one at a time" is a true fact but not the reason; "no bias" is false, slide 4) |
| 16 | Converges if linearly separable (Perceptron convergence theorem); solution generally not unique | CONCEPT_L2 `converge` + distractors | 1 · 12 + footnote | VERIFIED | – |
| 17 | Scikit-Learn Perceptron implements a single TLU network; the iris boundary is straight | CONCEPT_L2 `sklearnClass` | 1 · 13 | VERIFIED | – (MLP / LogReg distractors false) |
| 18 | ≡ SGDClassifier(loss="perceptron", learning_rate="constant", eta0=1 (learning rate), penalty=None (no regularization)) | CONCEPT_L2 `eta0`, `penalty` | 1 · 14 | VERIFIED | – |
| 19 | No class probability, hard threshold; a reason to prefer LogReg | CONCEPT_L2 `noProba` | 1 · 15 | VERIFIED | – ("curved boundary" distractor false by slide 12) |
| 20 | Minsky & Papert 1969 "Perceptrons" (XOR); Rosenblatt 1957; Hebb | CONCEPT_L3 `who` | 1 · 16, 4, 9 | VERIFIED | – |
| 21 | Any linear classification model (e.g. LogReg) fails XOR; the Fig 10-6b MLP solves it | CONCEPT_L3 `anyLinear`, XOR_FIX.why | 1 · 16–17 | VERIFIED | – |
| 22 | XOR: (0,1), (1,0) → 1 (squares); (0,0), (1,1) → 0 (triangles) | XOR.points, XorPlot, LABELS.xorAria | 1 · 16 (Fig 10-6a), 17 | VERIFIED | – |
| 23 | Fix = stack Perceptrons into an MLP; distractors (keep the rule, it converges / sign step / LogReg) are false | XOR_FIX | 1 · 5, 12, 16, 17 | VERIFIED | – (tries each get 1 point wrong) |
| 24 | Fig 10-6b: input→hidden weights all 1; hidden biases −3/2 (left) and −1/2 (right); output weights −1 (left) and 1 (right); output bias −1/2 | XOR.net/show/showTex, MlpNet, MATHS.xorTex | 1 · 17 (200 dpi) | VERIFIED | – |
| 25 | Net outputs 0, 1, 1, 0; exactly one candidate per blank (hb/ov/oc) gives XOR; counterfactuals in the whys hold | `mlpForward`, XOR_BLANKS, XOR_FWD | 1 · 17 | VERIFIED | – |
| 26 | "On XOR, the learning rule never settles" / "there is always a wrong prediction to update on (slides 9–10)" | CONCEPT_L3.b `converge` (bb3-8-converge) | cites 1 · 9, 10, 12, 16 | WRONG | No slide says it, and it fails under the game's own model (slide-10 weight-only rule, fixed b). With b = 1, w = (0, 0), η = 1, one update on (1,1) gives w = (−1, −1). After that only (0,0) is wrong, and its update η(y − ŷ)x = 0. Reword to "Why does the Perceptron convergence theorem not promise a solution on XOR?" and drop the "always a wrong prediction" clause |
| 27 | Hidden/output units use heaviside | NOTATION.xor, XOR_FWD.h why | 1 · 17 (step not named) + 5 | AMBIGUOUS | – (the game took heaviside, the only slide-5 step that gives slide 17's 0/1 outputs) |
| 28 | Stacked Perceptrons = MLP; TLU = one unit; dense layer = fully connected layer | CONCEPT_L3 `stack` | 1 · 17, 4, 6 | VERIFIED | – |
| 29 | Banner "separated · new batch" after a batch switch | LABELS.fresh, `newBatch` | mechanics (implies slide 12's separation) | WRONG | In 550 of 1,300 switches (seeds 1–1500, L1–2), the current w still misclassifies ≥ 1 point of the old batch: z = 0 or out-of-range points are skipped, and used points can flip back. Label it "new batch", or say "separated" only when `misCount(st.w, st.b, st.pool) === 0` |
| 30 | Concept ids → slides (tlu 4, step 5, hebb 9, rule 10–11, boundary 12, sklearn 13–14, vsLogistic 15, xor 16, mlp.xor 17); intro, level names and blurb copy | index.js, lecture1.js, INTRO, LEVEL_NAMES | 1 · 4–17 | VERIFIED | – |

## Blind sample (my answer = game answer in every row)

| seed·L | item | given | mine | game | ✓ |
|---|---|---|---|---|---|
| 11·1 | 1 dir | w (0,1), b 1, x (3,1), y 0, ŷ 1 | away | away | ✓ |
| 11·1 | 2 dir | w (−3,0), x (1,−3), y 1, ŷ 0 | toward | toward | ✓ |
| 11·1 | 3 tlu | TLU output | step(wᵀx+b) | step | ✓ |
| 11·1 | 4 dir | w (−2,−3), x (1,−1), y 1, ŷ 1 (z = 2) | stay | stay | ✓ |
| 11·1 | 5 rule10 | w (−2,−3), x (−2,2), y 1, ŷ 0 | s10 → (−4,−1) | s10 | ✓ |
| 11·1 | 6 step | sign(0), probe (0,1) on line | 0 | 0 | ✓ |
| 11·1 | 7 dir | w (−4,−1), x (1,−2), y 1, ŷ 0 | toward | toward | ✓ |
| 11·1 | 8 rule10 | w (−3,−3), x (0,2), y 1, ŷ 0 | s10 → (−3,−1) | s10 | ✓ |
| 11·1 | 9 step | heaviside(−5) | 0 | 0 | ✓ |
| 11·1 | 10 rule11 | w (−3,−1), x (0,3), y 1, ŷ 0 | s11 → (−3,2) | s11 | ✓ |
| 12·2 | 1 z | w (0,2), b −1, x (2,−2) | −5 | −5 | ✓ |
| 12·2 | 2 upd | w₁: w (0,2), x (−3,−2), y 1, ŷ 0 | −3 | −3 | ✓ |
| 12·2 | 3 upd | w₂: w (−3,0), x (−1,2), y 0, ŷ 1 | −2 | −2 | ✓ |
| 12·2 | 4 linear | why no complex patterns | linear | linear | ✓ |
| 12·2 | 5 upd hidden | w₁: w (−2,−2), x (−1,0), y 0 (z = 1) | −1 | −1 | ✓ |
| 12·2 | 6 upd hidden | w₁: w (−1,−2), x (2,−2), y 0 (z = 1) | −3 | −3 | ✓ |
| 12·2 | 7 sklearnClass | Perceptron class | single TLU | tlu | ✓ |
| 12·2 | 8 yhat | w (−3,0), b −1, x (−3,0): z = 8 | 1 | 1 | ✓ |
| 12·2 | 9 upd trap | w₁: w (−3,0), x (−1,−2), y 1 (z = 2) | −3 | −3 | ✓ |
| 12·2 | 10 upd hidden | w₂: w (−3,0), x (0,−3), y 1 (z = −1) | −3 | −3 | ✓ |
| 13·2 | 1 z | w (−2,−2), b −1, x (−1,0) | 1 | 1 | ✓ |
| 13·2 | 2 upd | w₂: η 0.5, x (0,−1), y 0, ŷ 1 | −1.5 | −1.5 | ✓ |
| 13·2 | 3 upd | w₂: w (−2,−1.5), x (0,3), y 1, ŷ 0 | 0 | 0 | ✓ |
| 13·2 | 4 hebb | how fed | one instance | one | ✓ |
| 13·2 | 5 upd hidden | w₁: w (−2,0), x (2,1), y 1 (z = −5) | −1 | −1 | ✓ |
| 13·2 | 6 upd hidden | w₁: w (−1,0.5), x (−3,2), y 0 (z = 3) | 0.5 | 0.5 | ✓ |
| 13·2 | 7 sklearnClass | Perceptron class | single TLU | tlu | ✓ |
| 13·2 | 8 yhat | w (0.5,−0.5), x (2,−3): z = 1.5 | 1 | 1 | ✓ |
| 13·2 | 9 upd trap | w₂: x (−2,−3), y 0 (z = −0.5) | −0.5 | −0.5 | ✓ |
| 13·2 | 10 upd hidden | w₁: w (0.5,−0.5), x (−3,3), y 1 (z = −4) | −1 | −1 | ✓ |
| 15·2 | 1 z | w (1,2), b −1, x (−3,−3) | −10 | −10 | ✓ |
| 15·2 | 2 upd | w₁: w (1,2), x (2,0), y 0, ŷ 1 | −1 | −1 | ✓ |
| 15·2 | 3 upd | w₂: w (−1,2), x (−3,2), y 0, ŷ 1 | 0 | 0 | ✓ |
| 15·2 | 4 linear | why no complex patterns | linear | linear | ✓ |
| 15·2 | 5 upd hidden | w₁: w (2,0), x (−3,−2), y 1 (z = −7) | −1 | −1 | ✓ |
| 15·2 | 6 upd hidden | w₂: w (−1,−2), x (0,−1), y 0 (z = 1) | −1 | −1 | ✓ |
| 15·2 | 7 penalty | penalty=None | no regularization | noReg | ✓ |
| 15·2 | 8 yhat | w (−1,−1), x (−3,2): z = 0 | 1 | 1 | ✓ |
| 15·2 | 9 upd trap | w₁: x (3,0), y 0 (z = −4) | −1 | −1 | ✓ |
| 15·2 | 10 upd hidden | w₁: w (−1,−1), x (−1,3), y 1 (z = −3) | −2 | −2 | ✓ |
| 14·3 | 1 fix | single lines fail | MLP | mlp | ✓ |
| 14·3 | 2 fwd z | right TLU, (0,0) | −0.5 | −0.5 | ✓ |
| 14·3 | 3 blank ov | output weights | −1, 1 | ov.slide | ✓ |
| 14·3 | 4 fwd h | right TLU, (1,0) | 1 | 1 | ✓ |
| 14·3 | 5 who | 1969 monograph | Minsky & Papert | mp | ✓ |
| 14·3 | 6 blank hb | hidden biases | −3/2, −1/2 | hb.slide | ✓ |
| 14·3 | 7 fwd out | (1,1) | 0 | 0 | ✓ |
| 14·3 | 8 converge | why never settles | separable (premise flawed, #26) | separable | ✓ |
| 14·3 | 9 blank oc | output bias | −1/2 | oc.slide | ✓ |
| 16·3 | 1 fix | single lines fail | MLP | mlp | ✓ |
| 16·3 | 2 fwd z | left TLU, (1,1) | 0.5 | 0.5 | ✓ |
| 16·3 | 3 blank ov | output weights | −1, 1 | ov.slide | ✓ |
| 16·3 | 4 fwd h | left TLU, (0,1) | 0 | 0 | ✓ |
| 16·3 | 5 who | 1969 monograph | Minsky & Papert | mp | ✓ |
| 16·3 | 6 blank hb | hidden biases | −3/2, −1/2 | hb.slide | ✓ |
| 16·3 | 7 fwd out | (0,0) | 0 | 0 | ✓ |
| 16·3 | 8 converge | why never settles | separable (premise flawed, #26) | separable | ✓ |
| 16·3 | 9 blank oc | output bias | −1/2 | oc.slide | ✓ |

## Summary
1. Counts: 30 claims checked: VERIFIED 27, WRONG 2, NOT IN SLIDES 0, AMBIGUOUS 1. Blind sample 58/58 match; the 43,500-item sweep found 0 arithmetic or answer failures.
2. Fix 1 (WRONG, #26): `CONCEPT_L3.b` `converge`. Its "never settles" premise is not on any slide and is false under the slide-10 weight-only rule with the game's fixed b (b = 1 settles at w = (−1, −1) with only (0,0) wrong, where the update is 0). Re-ask it as "why does the convergence theorem not promise a solution on XOR?" and drop "always a wrong prediction to update on".
3. Fix 2 (WRONG, #29): the `LABELS.fresh` banner says "separated", but in 42 % of batch switches the boundary still misclassifies part of the old batch. Rename it to "new batch", or gate it on `misCount === 0`.
4. Optional: add slide 9 to `src` on trap update items, whose why cites slide 9 (#13).
5. No change needed: rule (slides 10 and 11, sign and x_i), heaviside/sign at z = 0, z = wᵀx + b, the sklearn facts (eta0 = 1, penalty = None = no regularization, single TLU network), the weaknesses and Figure 10-6b's weights all match the slides. The heaviside reading of Fig 10-6b (#27) is justified.
