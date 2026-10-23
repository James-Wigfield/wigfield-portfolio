# Accuracy check: Forger (`forger`)

- Date: 2026-10-23 · checker: fresh agent, no part in the build
- Sources: `cits5017-lect06-07-AE-conv-var-GAN.pdf` slides 19–30. I rendered and read slides 21, 22, 23, 24, 25, 27, 28 and 29 at 110 dpi. For slides 19, 20, 26 and 30 I used pdftotext. I also used `lecture-6-7.md`: slides 4 and 19–30, and its Quirks section, including "Slide 28 vs slide 29" and "Slide 29 vs slide 23".
- Files read:
  - `games/forger/*`: Forger.jsx, stages.jsx, parts.jsx, pyTokens.js, glyph.jsx and index.js
  - `content/forger.js`, `maths/forger.js` and `maths/forgerStudio.js`
  - the ToyGan section of `lecture6-7-study/gen.js`
  - the 12 concept ids in `content/lecture67.js`
- Quote check: I normalised the slides' pdftotext and checked every `SLIDE_TEXT`, `FACTS[].quote` and `PHASES[].quotes` string against it. All of them appear verbatim. `SLIDE_TEXT[26]` joins two verbatim sentences that sit either side of Figure 17-15's caption. I also checked the 44 quoted fragments inside the why texts. The only differences are three sentence-final full stops where the slide continues (see rows 20, 21 and 28).
- Run check: I computed this page's toy runs with `maths/forgerStudio.js`:
  - **Collapse frames** (weak, iterations 400–1200): 96–100 % of the fakes are within 3σ of the −3 bump and 0 % of the +3 bump.
  - **Covered frames** (balanced, iterations 900–1200): 37–43 % / 45–46 %.
  - **Unstable frames** (weak, iterations 1800–2100): only 4–13 % of the fakes are on either bump, and 228–355 of the 400 are off the scale.
  - **Weak run's history:** at least 88 % of the fakes are on one bump from iteration 300 to 1500, then 0.55 at 1600 and 0.22 at 1700.
  - **Phase-1 demos** (t = 25, 50, 100): the generator's largest weight change is exactly 0, and the fakes' histogram is identical before and after.
  - **Phase-2 demos** (t = 200, 300, 400): the discriminator's largest weight change is exactly 0, and the P(real) curve is identical.
- Blind sample: **70 items**, all **70/70 match**:
  - L1, L2 and L3 with seeds 7 and 42 (54 items)
  - 16 extra L3 number/shape items from seeds 1–39: rows, zeros, y2, dense, and the GAN and DCGAN noise shapes
- Sweep: 6,000 rounds (seeds 1–2000 × 3 levels, 54,000 items). I recomputed the recipe, which, pair, diagnose, number and shape answers, checked the order permutations, and checked that every choice answer is among its choices. **0 mismatches.** The only flag was that `s.g2` has two identical choice labels, `BatchNormalization(),` (bn1/bn2). The stage shows those lines in place, so this is not a slide issue, but the feedback line cannot tell the two apart. No item is marked `beyond`.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | SLIDE_TEXT 21, 22, 24, 25, 27, 28 are verbatim | content SLIDE_TEXT | L6–7 · 21–28 | VERIFIED | — |
| 2 | SLIDE_TEXT[26] = the two sentences either side of Fig 17-15's caption | content SLIDE_TEXT[26] | L6–7 · 26 | VERIFIED | — |
| 3 | Phase 1 recipe: real + equal number of fakes · fake 0 / real 1 · discriminator only | PHASES[1], recipe-*-p1 | L6–7 · 21, 25 | VERIFIED | — |
| 4 | Phase 1 code: concat (fakes first), y1, `trainable = True  # ***…`, `discriminator.train_on_batch` | PHASES[1].code | L6–7 · 25 | VERIFIED | — |
| 5 | Phase 2 recipe: fakes only · all 1 (real) · generator only, D frozen | PHASES[2], recipe-*-p2 | L6–7 · 22, 25 | VERIFIED | — |
| 6 | Phase 2 code: noise, y2 all ones, `trainable = False  # ***…`, `gan.train_on_batch(noise, y2)` | PHASES[2].code | L6–7 · 25 | VERIFIED | — |
| 7 | Phase 2 labels row: "fake 1 · real 0" with a fakes-only batch gives every fake label 1, the same labelled batch as "all 1 (real)". The Tray draws the same picture, but it is marked wrong. | recipe-*-p2 / recipeOk | L6–7 · 22 | AMBIGUOUS | Judge the labels the batch's rows actually get: accept fake1real0 when batch = fakeOnly. Or give the fake-only answer its own wording. |
| 8 | Recipe distractors (real only, fake 1 · real 0, all 0, both networks) are all false for their phase | INGREDIENTS | L6–7 · 21, 22 | VERIFIED | — |
| 9 | Which phase ran: in phase 1 only P(real) moves (G change exactly 0); in phase 2 only the fakes move (D change exactly 0) | WHICH.why, which-* | L6–7 · 21, 22 | VERIFIED (run: gMax = 0, dMax = 0) | — |
| 10 | "both networks trained in the same step" is false | WHICH.choices | L6–7 · 21, 22 | VERIFIED | — |
| 11 | Order: trainable True → D.train_on_batch → trainable False → gan.train_on_batch | ORDER_SETS toggles | L6–7 · 25 | VERIFIED | — |
| 12 | Order: noise → generator(noise) → concat → D.train_on_batch | ORDER_SETS phase1 | L6–7 · 25 | VERIFIED | — |
| 13 | Order: fakes → D step (0 + equal real 1) → another batch of fakes → gan step (all 1, D frozen) | ORDER_SETS words | L6–7 · 21, 22, 25 | VERIFIED | — |
| 14 | Phase 1: completed with an equal number of fakes; distractors (half / more real) are false | f.p1.equal | L6–7 · 21 | VERIFIED | — |
| 15 | Labels 0 fake / 1 real, which agrees with concat order and y1 | f.p1.labels | L6–7 · 21, 25 | VERIFIED | — |
| 16 | Binary cross-entropy; slide 24 compiles with `binary_crossentropy` | f.p1.loss | L6–7 · 21, 24 | VERIFIED | — |
| 17 | Phase 1 backprop optimizes only the discriminator | f.p1.weights | L6–7 · 21 | VERIFIED | — |
| 18 | Phase 2 labels all 1 (real); y2 = `[[1.]] * batch_size` | f.p2.labels | L6–7 · 22, 25 | VERIFIED | — |
| 19 | D frozen in phase 2, so backprop only affects the generator | f.p2.frozen | L6–7 · 22 | VERIFIED | — |
| 20 | No real images in phase 2 (quote ends "batch." where the slide has "batch,") | f.p2.noreal | L6–7 · 22 | VERIFIED | Optional: end the quote with "…" |
| 21 | It cannot be trained like a regular network because it has two networks with different objectives (quote ends "phases." where the slide has "phases:") | f.regular | L6–7 · 21 | VERIFIED | Optional: "…" |
| 22 | The biggest difficulty is mode collapse; Nash equilibrium and oscillation are named but are not "the biggest" | f.mc.biggest | L6–7 · 27 | VERIFIED | — |
| 23 | Mode collapse = outputs gradually less diverse, one class only | f.mc.def | L6–7 · 27 | VERIFIED | — |
| 24 | Nash equilibrium definition | f.nash.def | L6–7 · 27 | VERIFIED | — |
| 25 | A GAN can only reach a single Nash equilibrium, and nothing guarantees it will be reached | f.nash.single | L6–7 · 27 | VERIFIED | — |
| 26 | Parameters may end up oscillating and becoming unstable | f.osc | L6–7 · 27 | VERIFIED | — |
| 27 | The images never get much better, and some epochs it seems to forget | f.forget | L6–7 · 26 | VERIFIED | — |
| 28 | No fit(): the loop is unusual, with two phases per iteration (quote cut at "iteration." before "in the code on the next slide") | f.fit | L6–7 · 24 | VERIFIED | Optional: complete the sentence |
| 29 | train_on_batch = a single gradient update on a single batch | f.tob | L6–7 · 25 | VERIFIED | — |
| 30 | Slide 24 compiles only discriminator and gan (BCE + rmsprop); the generator is never compiled alone | f.compile, g.gTrain why | L6–7 · 24 | VERIFIED | — |
| 31 | `trainable = False` so that training gan trains only the generator; both toggles are marked "# ***"; compile happens once, before the loop | f.falseWhy | L6–7 · 24, 25 | VERIFIED | — |
| 32 | Slide 29's discriminator has no BN and uses Dropout(0.4) after each Conv2D; dropout is not a guideline | f.dc.discBN | L6–7 · 28, 29 | VERIFIED | — |
| 33 | Generator BN after the Reshape and after the first Conv2DTranspose, none after the tanh output | f.dc.genBN | L6–7 · 28, 29 | VERIFIED | — |
| 34 | All four conv layers use kernel 5, strides 2, "same"; there are no pooling layers | f.dc.pool | L6–7 · 28, 29 | VERIFIED | — |
| 35 | "These guidelines will work in many cases, but not always." | f.dc.notalways | L6–7 · 28 | VERIFIED | — |
| 36 | Discriminator Conv2D activation = LeakyReLU(0.2); the 0.4 is the dropout rate | f.dc.leaky | L6–7 · 29 | VERIFIED | — |
| 37 | The answer (slide 23's generator ends in Dense(28 * 28, sigmoid) then Reshape) is right. But the item is tagged `dcgan.vsGuidelines` (slides 28–29), which does not teach slide 23. | f.dc.tanh concept | L6–7 · 23, 29 | WRONG (concept tag) | Tag it `gan.keras` (slides 23–24) |
| 38 | Loop body lines and their order, as slide 25 prints them (the "# ***" comments trimmed) | LOOP.lines | L6–7 · 25 | VERIFIED | — |
| 39 | The six gap answers (tTrue, tFalse, y1, y2, gTrain, dTrain); every distractor differs from the printed line | GAPS | L6–7 · 21, 22, 24, 25 | VERIFIED | — |
| 40 | Collapse verdict: the forgeries sit on one bump only ("only producing images in a specific class") | DIAG collapse, weak 400–1200 | L6–7 · 27 | VERIFIED (run: 96–100 % / 0 %) | — |
| 41 | Diverse verdict: the forgeries cover both bumps | DIAG covered, balanced 900–1200 | L6–7 · 27 | VERIFIED (run: 37–43 % / 45–46 %) | — |
| 42 | Unstable why: "sat on one bump for over a thousand iterations, then scattered off both bumps" | DIAG unstable, weak 1800–2100 | page's run | VERIFIED (300–1500 on one bump; 4–13 % on bumps) | — |
| 43 | Verdict wording "unstable: it is forgetting what it learned" equates slide 26's forgetting with slide 27's "oscillating and becoming unstable". The slides link the two only through "Why is that?", and the run diverges rather than oscillates. | DIAG.choices / why.unstable | L6–7 · 26, 27 | AMBIGUOUS (the game's reading is defensible) | Optional: "unstable: the forgeries scatter, as if forgetting what it learned" |
| 44 | Pair: the weak run (one bump) has collapsed; the balanced run covers both | DIAG.pair, pair-* | L6–7 · 27 | VERIFIED (run) | — |
| 45 | The five guidelines are verbatim and in slide order ("guideline n" = nth bullet; the slide does not number them) | GUIDELINES, SPOT prompts | L6–7 · 28 | VERIFIED | — |
| 46 | Generator up-samples with transposed convs; discriminator down-samples with strided convs; pooling is what they replace | BUILD g.sample / d.sample | L6–7 · 4, 28 | VERIFIED | — |
| 47 | BN in every layer except the generator's output / the discriminator's input; slide 29's discriminator has none | BUILD g.bn / d.bn | L6–7 · 28, 29 | VERIFIED | — |
| 48 | ReLU in the generator except a tanh output; leaky ReLU in every discriminator layer | BUILD g.hidden / g.out / d.act | L6–7 · 28 | VERIFIED | — |
| 49 | Remove fully connected hidden layers (for deeper nets) | BUILD g.fc / d.fc | L6–7 · 28 | VERIFIED | — |
| 50 | Slide 29 code lines (generator and discriminator), as printed | DCGAN | L6–7 · 29 | VERIFIED | — |
| 51 | Dense(7 * 7 * 128) has no activation (linear), so it breaks guideline 4 | SPOT s.g4 | L6–7 · 28, 29 (+ Quirks) | VERIFIED | — |
| 52 | The final Dense(1, sigmoid) breaks guideline 5; both Conv2D layers use LeakyReLU(0.2) | SPOT s.g5 | L6–7 · 28, 29 | VERIFIED | — |
| 53 | Dense(7 * 7 * 128) is the generator's fully connected line (6272 outputs, then Reshape) | SPOT s.g3 | L6–7 · 28, 29 | VERIFIED | — |
| 54 | The output layer = Conv2DTranspose(1, …, tanh), with no BN after it | SPOT s.g2 | L6–7 · 28, 29 | VERIFIED | — |
| 55 | X_fake_and_real rows = 2 × batch_size (64 at batch_size 32), using drop_remainder=True | NUMBERS.rows | L6–7 · 24, 25 | VERIFIED | — |
| 56 | y1 zeros = batch_size; y2 labels = batch_size (all ones) | NUMBERS.zeros / y2 | L6–7 · 21, 22, 25 | VERIFIED | — |
| 57 | Dense(7 * 7 * 128) = 6272 units | NUMBERS.dense | L6–7 · 29 | VERIFIED | — |
| 58 | GAN noise = [batch_size, 30] (codings_size = 30) | NUMBERS.noise gan | L6–7 · 23, 25 | VERIFIED | — |
| 59 | DCGAN noise = [batch_size, 100] (codings_size = 100; "training … similar to the code for GANs") | NUMBERS.noise dcgan | L6–7 · 25, 29 | VERIFIED | — |
| 60 | The DCGAN shape item's code box is captioned "slide 29 · python" over `noise = tf.random.normal(shape=[batch_size, codings_size])`, but that line is printed on slide 25. The caption uses the last entry of src.slides. | shape-*-dcgan (ShapeStage) | L6–7 · 25 | WRONG (misattribution) | Use `src: { slides: [29, 25] }`, or give the noise line its own `codeSlide: 25` |
| 61 | Toy GAN mechanics: phase 1 = fakes first, labelled 0, plus an equal number of real labelled 1, BCE, D only; phase 2 = fakes labelled 1, D frozen; RMSprop; phase 1 then phase 2 each iteration | gen.js ToyGan / forgerStudio | L6–7 · 21, 22, 24, 25 | VERIFIED | — |
| 62 | "slide 25's loop runs each phase once per batch" (demo caption) | UI.demo | L6–7 · 25 | VERIFIED | — |
| 63 | Concept slides for gan.idea / phase1 / phase2 / trainLoop / keras / nash / modeCollapse / instability, dcgan.guidelines / keras / vsGuidelines, bn.dcgan | lecture67.js | L6–7 · 19–29 | VERIFIED (except row 37) | — |

## Blind sample (my answer from the slides first, then the game's)

| # | item | prompt (short) | mine | game | match |
|---|---|---|---|---|---|
| 1 | L1 s7 which-0-p1 | studio t25, phase hidden | p1 (only P(real) moves) | p1 | ✓ |
| 2 | L1 s7 recipe-1-p1 | build phase 1's batch | realPlusFake · fake0real1 · disc | same | ✓ |
| 3 | L1 s7 f.p2.labels | phase 2 labels | all 1 | all1 | ✓ |
| 4 | L1 s7 recipe-3-p2 | build phase 2's batch | fakeOnly · all1 · gen | same | ✓ |
| 5 | L1 s7 order words | one iteration | fakes1, dStep, fakes2, gStep | same | ✓ |
| 6 | L1 s7 which-5-p2 | studio t300 | p2 | p2 | ✓ |
| 7 | L1 s7 f.p2.noreal | real images in phase 2? | No | no | ✓ |
| 8 | L1 s7 recipe-7-p2 | phase 2 batch | fakeOnly · all1 · gen | same | ✓ |
| 9 | L1 s7 order phase1 | phase 1 lines | noise, gen, concat, dTrain | same | ✓ |
| 10 | L1 s42 which-0-p1 | studio t25 | p1 | p1 | ✓ |
| 11 | L1 s42 recipe-1-p1 | phase 1 batch | realPlusFake · fake0real1 · disc | same | ✓ |
| 12 | L1 s42 f.p1.loss | phase 1 loss | BCE | bce | ✓ |
| 13 | L1 s42 recipe-3-p2 | phase 2 batch | fakeOnly · all1 · gen | same | ✓ |
| 14 | L1 s42 order toggles | toggle lines | tTrue, dTrain, tFalse, gTrain | same | ✓ |
| 15 | L1 s42 which-5-p2 | studio t300 | p2 | p2 | ✓ |
| 16 | L1 s42 f.regular | why not regular | two networks, different objectives | two | ✓ |
| 17 | L1 s42 recipe-7-p1 | phase 1 batch | realPlusFake · fake0real1 · disc | same | ✓ |
| 18 | L1 s42 order words | one iteration | fakes1, dStep, fakes2, gStep | same | ✓ |
| 19 | L2 s7 diagnose balanced t1100 | read the run | covered (42 % / 45 %) | covered | ✓ |
| 20 | L2 s7 f.fit | why no fit() | unusual loop, two phases | unusual | ✓ |
| 21 | L2 s7 pair B = weak t1100 | which collapsed | B | B | ✓ |
| 22 | L2 s7 gap tFalse | gap before gan.train_on_batch | `discriminator.trainable = False` | right | ✓ |
| 23 | L2 s7 f.forget | after epoch 1 | never much better, forgets | forget | ✓ |
| 24 | L2 s7 diagnose weak t400 | read the run | collapse (96 % / 0 %) | collapse | ✓ |
| 25 | L2 s7 gap gTrain | last line | `gan.train_on_batch(noise, y2)` | right | ✓ |
| 26 | L2 s7 f.compile | what is compiled | discriminator and gan | dg | ✓ |
| 27 | L2 s7 diagnose weak t1900 | read the run | unstable (6 % on bumps, 307 off-scale) | unstable | ✓ |
| 28 | L2 s42 diagnose weak t400 | read the run | collapse | collapse | ✓ |
| 29 | L2 s42 f.mc.biggest | biggest difficulty | mode collapse | mc | ✓ |
| 30 | L2 s42 pair A = weak t1200 | which collapsed | A | A | ✓ |
| 31 | L2 s42 gap y1 | y1 line | `[[0.]] * bs + [[1.]] * bs` | right | ✓ |
| 32 | L2 s42 f.tob | train_on_batch | single gradient update, single batch | one | ✓ |
| 33 | L2 s42 diagnose weak t1800 | read the run | unstable | unstable | ✓ |
| 34 | L2 s42 gap gTrain | last line | `gan.train_on_batch(noise, y2)` | right | ✓ |
| 35 | L2 s42 f.nash.single | Nash equilibrium | single, not guaranteed | single | ✓ |
| 36 | L2 s42 diagnose balanced t1100 | read the run | covered | covered | ✓ |
| 37 | L3 s7 build gen bn/hidden/out | slots | notOut · relu · tanh | same | ✓ |
| 38 | L3 s7 number dense | first-layer units | 6272 | 6272 | ✓ |
| 39 | L3 s7 build disc sample/bn/act | slots | strided · notIn · leaky | same | ✓ |
| 40 | L3 s7 spot s.g3 | still fully connected | Dense(7 * 7 * 128) | dense | ✓ |
| 41 | L3 s7 f.dc.leaky | discriminator Conv2D activation | LeakyReLU(0.2) | l02 | ✓ |
| 42 | L3 s7 shape gan b32 | noise shape | [32, 30] | [32, 30] | ✓ |
| 43 | L3 s7 build gen sample/bn/fc | slots | transposed · notOut · remove | same | ✓ |
| 44 | L3 s7 spot s.g4 | breaks guideline 4 | Dense (no activation) | dense | ✓ |
| 45 | L3 s7 number zeros b32 | y1 zeros | 32 | 32 | ✓ |
| 46 | L3 s42 build disc sample/bn/fc | slots | strided · notIn · remove | same | ✓ |
| 47 | L3 s42 number zeros b32 | y1 zeros | 32 | 32 | ✓ |
| 48 | L3 s42 build gen sample/hidden/out | slots | transposed · relu · tanh | same | ✓ |
| 49 | L3 s42 spot s.g5 | breaks guideline 5 | Dense(1, sigmoid) | dense1 | ✓ |
| 50 | L3 s42 f.dc.genBN | generator BN | after the Reshape and after ConvT64 | two | ✓ |
| 51 | L3 s42 shape gan b64 | noise shape | [64, 30] | [64, 30] | ✓ |
| 52 | L3 s42 build disc sample/bn/act | slots | strided · notIn · leaky | same | ✓ |
| 53 | L3 s42 spot s.g2 | output layer | Conv2DTranspose(1, …, tanh) | convT1 | ✓ |
| 54 | L3 s42 number dense | first-layer units | 6272 | 6272 | ✓ |
| 55–58 | L3 rows b32 / b64 / b16 / b128 | X_fake_and_real rows | 64 / 128 / 32 / 256 | same | ✓ |
| 59–62 | L3 y2 b32 / b16 / b128 / b64 | y2 labels | 32 / 16 / 128 / 64 | same | ✓ |
| 63–65 | L3 zeros b16 / b128 / b64 | y1 zeros | 16 / 128 / 64 | same | ✓ |
| 66–68 | L3 dcgan shape b32 / b16 / b64 | noise shape | [32, 100] / [16, 100] / [64, 100] | same | ✓ |
| 69–70 | L3 gan shape b128 / b16 | noise shape | [128, 30] / [16, 30] | same | ✓ |

## Summary
1. Verdicts (63 rows): **59 VERIFIED** (4 of them confirmed against this page's run), **2 WRONG**, **2 AMBIGUOUS**, **0 NOT IN SLIDES**. No item is marked beyond. Blind sample: 70/70. Sweep: 54,000 items with 0 mismatches.
2. Fix 1 (AMBIGUOUS, affects scoring): in phase-2 recipes, "fake 1 · real 0" with a fakes-only batch labels every fake 1, the same batch slide 22 describes, but it is marked wrong. Judge the labels the rows actually get.
3. Fix 2 (WRONG): the DCGAN noise-shape item captions slide 25's `noise = …` line as "slide 29 · python". Reorder src to `[29, 25]` or pin the caption to 25.
4. Fix 3 (WRONG, concept tag): `f.dc.tanh` is about slide 23's sigmoid generator. Tag it `gan.keras`, not `dcgan.vsGuidelines`.
5. Optional: reword the "unstable" verdict, which ties slide 26's forgetting to slide 27's instability. Close the three truncated quotes with "…" (f.p2.noreal, f.regular, f.fit).
