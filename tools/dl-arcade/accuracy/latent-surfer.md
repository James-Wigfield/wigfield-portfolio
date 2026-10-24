# Accuracy check: Latent Surfer (`latent-surfer`)

Lectures 6–7 · checked 2026-10-23 · sources: `cits5017-lect06-07-AE-conv-var-GAN.pdf` slides 10–18 (rendered 11 incl. a 300 dpi crop of Figure 17-11, 12, 14, 18) + `lecture-6-7.md` (slides 11–18 and Quirks).
Sample: **75 generated items solved blind** (30 sampling, 25 latent loss, 5 interpT, 10 slot, 5 mid; seeds 1–5 × levels 1–3, model = `lecture6-7-study/data/vae.js`), all 18 FACTS (answer and every distractor) against the slide text, and 920 items over seeds 1–40 × 3 levels scanned (0 generator fallbacks; 120/120 find items: the answer passes `check`, the start fails it).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Sampling returns μ + exp(γ/2)·ε (= μ + σ·ε, σ = exp(γ/2)) | SAMPLING.why, `sampleOne` → gen.js `sampleCoding` | 6 · 11, 12, 14 | VERIFIED | – |
| 2 | Traps: μ + exp(γ)·ε "exp(γ) = σ² is the variance"; σ·ε "then adds Codings μ"; μ + (γ/2)·ε | SAMPLING.traps, `samplingValues` | 6 · 11, 12, 14 | VERIFIED | – |
| 3 | ε is the game's own name for one Gaussian-noise draw; "the slides give it no symbol" | SAMPLING.draw, UI.noiseVal | 6 · 11, 14 | VERIFIED | – |
| 4 | Maths drawer writes the sampled coding as `z = μ + exp(γ/2)·ε = …` | maths `samplingLine` | 6 · 14 | NOT IN SLIDES | slides never call the coding z, and slide 14 uses `Z` for the encoder's hidden activations: write `\text{codings} = …` |
| 5 | Wiring diagram: Codings σ × Gaussian noise → + Codings μ → codings | parts `SampleWire`, UI.diagramAria | 6 · 11 (Fig 17-11), 14 | VERIFIED | – |
| 6 | Noise is "multiplied by Codings σ, then Codings μ is added"; the sum feeds Hidden 4; all 3 distractors false | FACTS.wiring | 6 · 11 | VERIFIED | – |
| 7 | "that sum feeds Hidden 4" | FACTS.wiring why | 6 · 11 vs 12 | AMBIGUOUS | slide 12 names the decoder layers Hidden 3 and Hidden 4, Figure 17-11 names them Hidden 4 and Hidden 5 (Quirks). The game follows the figure, which is fine; optionally add "(slide 12 calls them Hidden 3/4)" |
| 8 | γ form: ℒ = −½ Σᵢ₌₁ⁿ [1 + γᵢ − exp(γᵢ) − μᵢ²] (−½ outside, sum over i, signs) | LOSS.why, gen.js `latentTermGamma`, EQUATIONS.vaeLatentLossGamma | 6 · 12 | VERIFIED | – |
| 9 | σ form: ℒ = −½ Σᵢ₌₁ⁿ [1 + log(σᵢ²) − σᵢ² − μᵢ²] | EQ.sigma, FACTS.half prompt | 6 · 12 | VERIFIED | – |
| 10 | Loss traps: no −½ (= −2ℒ), sign flipped (= −ℒ), +μᵢ² (= ℒ − Σμᵢ²), plus their texts | LOSS.traps, `lossValues` | 6 · 12 | VERIFIED | – |
| 11 | Trap feedback names one cause | `lossTrap` (all level-1 loss items, γ = 0) | 6 · 12 | AMBIGUOUS | when γ = 0, ℒ − Σμ² = −ℒ, so the "sign" and "muSign" traps give the same number and the card always says "sign flipped". When both match, show both texts |
| 12 | Substituted bracket writes exp(γᵢ) as the variance; "log 1 = 0" | `lossSub`, LOSS prompts | 6 · 12 | VERIFIED | – |
| 13 | Dashed bell drawn as N(0, 1): "Beyond the slides…" (beyond: true + note) | LOSS.bellsNote, UI.bellTarget | 6 · 12, 13, 16 | VERIFIED (beyond) | – |
| 14 | γ is log(σ²) (distractors log σ, σ², exp σ are false); codings_log_var / logvar | FACTS.gammaDef | 6 · 12, 14 | VERIFIED | – |
| 15 | ▢ = tf.exp(logvar / 2); tf.exp(logvar) would be σ² | FACTS.scale | 6 · 14 | VERIFIED | why cites Figure 17-11: add 11 to src |
| 16 | Encoder learns a mean coding μ and a standard deviation coding σ | FACTS.outputs | 6 · 11 | VERIFIED | – |
| 17 | Semantic interpolation interpolates the codings, then decodes them | FACTS.codingsLevel | 6 · 17 | VERIFIED | – |
| 18 | Loss = reconstruction loss + latent loss; slide 15 minimises the total | FACTS.twoParts | 6 · 13, 15 | VERIFIED | – |
| 19 | exp(γᵢ) takes the place of σᵢ² | FACTS.gammaTerm | 6 · 12 | VERIFIED | – |
| 20 | γᵢ takes the place of log(σᵢ²) | FACTS.logTerm | 6 · 12 | VERIFIED | – |
| 21 | ▢ = −½; slide 14 writes -0.5 * tf.reduce_sum | FACTS.half | 6 · 12, 14 | VERIFIED | why cites slide 14: add 14 to src |
| 22 | KL divergence between the target (Gaussian) and the actual distribution of the codings | FACTS.kl | 6 · 13 | VERIFIED | – |
| 23 | Step 1 can be replaced by random samples from the normal distribution (slide 18 does it) | FACTS.step1 | 6 · 17, 18 | VERIFIED | why cites slide 18: add 18 to src |
| 24 | γ instead of σ: more numerically stable, faster training | FACTS.gammaWhy | 6 · 12 | VERIFIED | – |
| 25 | Codings migrate in the latent space to a cloud of Gaussian points | FACTS.cloud | 6 · 12 | VERIFIED | – |
| 26 | Moving μᵢ from 0 makes ℒ larger (−½·(−μᵢ²) = +½μᵢ²) | FACTS.muSign | 6 · 12 (arithmetic) | VERIFIED | – |
| 27 | 784 = 28*28, the output image dimension. Distractors false: batch size 128 (s15), coding dims 10 (s16), epochs 25 (s15) | FACTS.addLoss | 6 · 14, 15 | VERIFIED | – |
| 28 | axis=-1 sums over all the features (the n coding dimensions); the minibatch mean is in add_loss | FACTS.sumAxis, EQUATIONS.vaeLatentLossCode | 6 · 12, 14 | VERIFIED | – |
| 29 | codings_log_var (# gamma) outputs γ = log(σ²); the sampled codings are the encoder's 3rd output | FACTS.logvarName | 6 · 12, 14 | VERIFIED | – |
| 30 | inter_codings = np.linspace(codings[0], codings[1], 10): 10 codings, decoded | INTERP.code / promptSlot / promptT, `stripPx` | 6 · 18 | VERIFIED | – |
| 31 | np.linspace includes both ends, so images[k] is at t = k/9 (not k/10); "slide 18's strip begins and ends on the two codings' images"; images[0]/[9] decode codings[0]/[1] themselves | INTERP.whySlot, INTERP.whyT, FACTS.ends, interpT answer key | 6 · 18 | NOT IN SLIDES | slide 18 says only "linearly interpolate 10 elements from the 2 codings", and its strip never shows codings[0] and codings[1] decoded on their own (the same strip would appear with endpoint=False). Mark beyond: true (note: NumPy's default endpoint=True) and reword the receipt to "consistent with slide 18's strip going from T-shirt to Sneaker" |
| 32 | Slide 18's strip goes from T-shirt to Sneaker | INTERP.whySlot, FACTS.ends | 6 · 18 | VERIFIED | – |
| 33 | Slide 17's three steps, verbatim | INTERP.steps | 6 · 17 | VERIFIED | – |
| 34 | Pixel-level interpolation "would look as if the two images were overlaid" (overlay trap) | INTERP.whyMid, kinds.overlay, `overlayPx` | 6 · 17 | VERIFIED | (overlays this page's decoded endpoints; labelled by choicesCaption) |
| 35 | Each interpolated coding is codings[0] + t(codings[1] − codings[0]), with t from 0 to 1 | INTERP.general, promptT | 6 · 18 ("linearly interpolate") | VERIFIED | – |
| 36 | Item pairs use μ (codings_mean) as codings[0]/codings[1] for step 1 | INTERP.pairs, pairText | 6 · 14, 15, 17 | AMBIGUOUS | slide 17 says "run both images through the encoder to get their codings" but does not say which output; slide 15 passes the sampled `codings`. The game takes μ and labels it ("μ of X_valid[a] … from this page's encoder"). Optional: add "(codings_mean, no noise)" |
| 37 | The slide18 pair is this page's run of `tf.random.set_seed(123)` + `tf.random.normal(shape=[2, codings_size])` | INTERP.pairText.slide18, vae.js samples.slide18 | 6 · 18 | VERIFIED | – |
| 38 | Decoder Dense 10→100→150→784 (linear output, clipped to show); codings_size = 10 | maths header, LatentSurfer.jsx header, UI.sliderLabel | 6 · 14, 16 | VERIFIED | (10 comes from slide 16's "10-dimensional"; the slides never assign codings_size) |
| 39 | Find is graded by pixel MSE (slide 15's loss="mse"); 2 of 10 dims steered, the other 8 held at the target's μ, decoder fed μ (no noise) | FIND.why / held, `findItem` | 6 · 12, 15, 16 | VERIFIED | (the game's own mechanic, worded as such) |
| 40 | Every decoded image and target is labelled "this page's own run" (map, your decode, target, strip, cells, choice thumbs) | stages.jsx Find/InterpStage, UI.own | – | VERIFIED | – |
| 41 | Find heat = ℒ of the steered μ with the target's γ, summed over n = 10 | `findLines`, UI.heatFind | 6 · 12 | VERIFIED | – |
| 42 | Natural-log values in the prompts (ln 9 = 2.197, ln 16 = 2.773, ln 0.25 = −1.386, ln 0.04 = −3.219, ln 6.25 = 1.833, ln 2.25 = 0.811, ln 0.36 = −1.022) | SAMPLING/LOSS prompts | 6 · 12, 14 (tf.exp) | VERIFIED | – |
| 43 | The 7 manifest concepts; each concept's `slides` teach it | index.js, lecture67.js | 6 · 11–18 | VERIFIED | – |
| 44 | Blurb, INTRO, LEVEL_NAMES (L1 find a sneaker = targets 8, 11, both Sneaker; L3 n = 2, no map) | index.js, content | – | VERIFIED | – |

## Blind sample

All worked from slide 12/14: z = μ + √(σ²)·ε, ℒ = −½Σ[1 + γ − σ² − μ²], images[k] → t = k/9. The game's answer is in brackets only where it differs (it never does). For slot and mid items, "match" means the answer choice is `decode` at t = k/9 (or ½) and the other choices are the overlay, reversed or off-grid t.

| item | prompt (short) | mine | game | ok |
|---|---|---|---|---|
| L1 s1 sample-1 | μ 1, σ² 9, ε 0.5 | 2.5 | 2.5 | ✓ |
| L1 s1 sample-4 | μ 1, σ² 4, ε 2 | 5 | 5 | ✓ |
| L1 s1 loss-5 | μ −2, σ² 1 | 2 | 2 | ✓ |
| L1 s1 mid-3 | X_valid[2]↔[11] midpoint | decode t=½ | C = decode ½ | ✓ |
| L1 s2 sample-1 | μ 0, σ² 9, ε 0.5 | 1.5 | 1.5 | ✓ |
| L1 s2 sample-4 | μ 1, σ² 4, ε −1 | −1 | −1 | ✓ |
| L1 s2 loss-5 | μ −1, σ² 1 | 0.5 | 0.5 | ✓ |
| L1 s2 mid-3 | [7]↔[11] | decode ½ | D | ✓ |
| L1 s3 sample-1 | μ 1, σ² 4, ε 0.5 | 2 | 2 | ✓ |
| L1 s3 sample-4 | μ −1, σ² 9, ε 2 | 5 | 5 | ✓ |
| L1 s3 loss-5 | μ −2, σ² 1 | 2 | 2 | ✓ |
| L1 s3 mid-3 | [2]↔[11] | decode ½ | D | ✓ |
| L1 s4 sample-1 | μ 0, σ² 4, ε 1 | 2 | 2 | ✓ |
| L1 s4 sample-4 | μ −1, σ² 4, ε 2 | 3 | 3 | ✓ |
| L1 s4 loss-5 | μ −2, σ² 1 | 2 | 2 | ✓ |
| L1 s4 mid-3 | [1]↔[7] | decode ½ | A | ✓ |
| L1 s5 sample-1 | μ 0, σ² 9, ε 1 | 3 | 3 | ✓ |
| L1 s5 sample-4 | μ 1, σ² 4, ε 0.5 | 2 | 2 | ✓ |
| L1 s5 loss-5 | μ −1, σ² 1 | 0.5 | 0.5 | ✓ |
| L1 s5 mid-3 | [7]↔[11] | decode ½ | B | ✓ |
| L2 s1 sample-1 | μ 1, σ² 16, ε −0.5 | −1 | −1 | ✓ |
| L2 s1 sample-6 | μ 0.5, σ² 4, ε −2 | −3.5 | −3.5 | ✓ |
| L2 s1 loss-3 | μ 0.5, σ² 0.25 | 0.443 | 0.443 | ✓ |
| L2 s1 loss-7 | μ −1, σ² 9 | 3.401 | 3.401 | ✓ |
| L2 s1 slot-2 | images[6] | t = 6/9 | B | ✓ |
| L2 s1 interpT-5 | images[2] | 2/9 | B = 2/9 | ✓ |
| L2 s2 sample-1 | μ −0.5, σ² 0.25, ε −0.5 | −0.75 | −0.75 | ✓ |
| L2 s2 sample-6 | μ −0.5, σ² 9, ε 1.5 | 4 | 4 | ✓ |
| L2 s2 loss-3 | μ 1, σ² 9 | 3.401 | 3.401 | ✓ |
| L2 s2 loss-7 | μ 0, σ² 0.25 | 0.318 | 0.318 | ✓ |
| L2 s2 slot-2 | images[6] | 6/9 | C | ✓ |
| L2 s2 interpT-5 | images[7] | 7/9 | A | ✓ |
| L2 s3 sample-1 | μ 1, σ² 4, ε 0.5 | 2 | 2 | ✓ |
| L2 s3 sample-6 | μ 1, σ² 0.25, ε −1.5 | 0.25 | 0.25 | ✓ |
| L2 s3 loss-3 | μ 1, σ² 9 | 3.401 | 3.401 | ✓ |
| L2 s3 loss-7 | μ 1, σ² 9 | 3.401 | 3.401 | ✓ |
| L2 s3 slot-2 | images[6] | 6/9 | A | ✓ |
| L2 s3 interpT-5 | images[7] | 7/9 | A | ✓ |
| L2 s4 sample-1 | μ −0.5, σ² 4, ε 1.5 | 2.5 | 2.5 | ✓ |
| L2 s4 sample-6 | μ −0.5, σ² 9, ε −1.5 | −5 | −5 | ✓ |
| L2 s4 loss-3 | μ −1, σ² 0.25 | 0.818 | 0.818 | ✓ |
| L2 s4 loss-7 | μ 1, σ² 0.25 | 0.818 | 0.818 | ✓ |
| L2 s4 slot-2 | images[6] | 6/9 | A | ✓ |
| L2 s4 interpT-5 | images[7] | 7/9 | A | ✓ |
| L2 s5 sample-1 | μ −0.5, σ² 0.25, ε −1.5 | −1.25 | −1.25 | ✓ |
| L2 s5 sample-6 | μ 0.5, σ² 16, ε 1.5 | 6.5 | 6.5 | ✓ |
| L2 s5 loss-3 | μ 0, σ² 9 | 2.901 | 2.901 | ✓ |
| L2 s5 loss-7 | μ 1, σ² 4 | 1.307 | 1.307 | ✓ |
| L2 s5 slot-2 | images[6] | 6/9 | A | ✓ |
| L2 s5 interpT-5 | images[3] | 3/9 | B | ✓ |
| L3 s1 sample-0 | μ 2.4, σ² 0.25, ε 2.5 | 3.65 | 3.65 | ✓ |
| L3 s1 sample-6 | μ −1.2, σ² 6.25, ε −0.8 | −3.2 | −3.2 | ✓ |
| L3 s1 loss-1 | (2, 0.25), (1, 4) | 3.625 | 3.625 | ✓ |
| L3 s1 loss-5 | (−1, 0.25), (0, 0.25) | 1.136 | 1.136 | ✓ |
| L3 s1 slot-2 | images[3] | 3/9 | C | ✓ |
| L3 s2 sample-0 | μ 2.4, σ² 0.04, ε 0.4 | 2.48 | 2.48 | ✓ |
| L3 s2 sample-6 | μ −0.7, σ² 0.04, ε 0.4 | −0.62 | −0.62 | ✓ |
| L3 s2 loss-1 | (−1, 0.25), (−1, 4) | 2.125 | 2.125 | ✓ |
| L3 s2 loss-5 | (0, 0.25), (1, 4) | 1.625 | 1.625 | ✓ |
| L3 s2 slot-2 | images[6] | 6/9 | C | ✓ |
| L3 s3 sample-0 | μ 2.4, σ² 0.25, ε 0.4 | 2.6 | 2.6 | ✓ |
| L3 s3 sample-6 | μ −0.7, σ² 2.25, ε 2.5 | 3.05 | 3.05 | ✓ |
| L3 s3 loss-1 | (0, 0.25), (1, 4) | 1.625 | 1.625 | ✓ |
| L3 s3 loss-5 | (0, 0.25), (1, 0.25) | 1.136 | 1.136 | ✓ |
| L3 s3 slot-2 | images[7] | 7/9 | A | ✓ |
| L3 s4 sample-0 | μ −0.7, σ² 0.04, ε −1.2 | −0.94 | −0.94 | ✓ |
| L3 s4 sample-6 | μ −1.2, σ² 0.25, ε 0.4 | −1 | −1 | ✓ |
| L3 s4 loss-1 | (0, 1), (−1, 1) | 0.5 | 0.5 | ✓ |
| L3 s4 loss-5 | (1, 0.25), (−1, 4) | 2.125 | 2.125 | ✓ |
| L3 s4 slot-2 | images[6] | 6/9 | B | ✓ |
| L3 s5 sample-0 | μ 2.4, σ² 6.25, ε −1.2 | −0.6 | −0.6 | ✓ |
| L3 s5 sample-6 | μ 0.3, σ² 2.25, ε −0.8 | −0.9 | −0.9 | ✓ |
| L3 s5 loss-1 | (−1, 1), (−1, 0.25) | 1.318 | 1.318 | ✓ |
| L3 s5 loss-5 | (0, 0.25), (0, 1) | 0.318 | 0.318 | ✓ |
| L3 s5 slot-2 | images[7] | 7/9 | B | ✓ |

75/75 match. The why-card substitutions also reproduce. Where μ = 0, the noMu and muSign traps equal the answer, and the code correctly skips them.

## Summary

- Verdicts over 44 rows: VERIFIED 39 (1 of them beyond), WRONG 0, NOT IN SLIDES 2, AMBIGUOUS 3. Blind sample: 75/75. The 18 FACTS have 0 wrong answers and 0 true distractors.
- Fix 1 (row 31): "np.linspace includes both ends → t = k/9" is not on any slide. Mark it beyond (NumPy's endpoint=True default) in whySlot, whyT and FACTS.ends. Reword the claim "strip begins and ends on the two codings' images" as "consistent with slide 18's T-shirt → Sneaker strip".
- Fix 2 (row 4): the maths drawer's `z = …` names the coding z, which is not slide notation and clashes with slide 14's `Z` (the hidden activations). Write `codings = …`.
- Fix 3 (row 11): at γ = 0 the "sign" and "muSign" traps give the same value, and the card always blames the sign. When both match, show both texts.
- Fix 4 (receipts, rows 15/21/23): add slide 11 to FACTS.scale, 14 to FACTS.half and 18 to FACTS.step1. Optional notes: rows 7 (Hidden 3/4 vs 4/5) and 36 (μ used as the codings).
