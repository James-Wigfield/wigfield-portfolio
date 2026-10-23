# Accuracy check: The Long Short-Term Line (`long-line`)

Date: 2026-10-23. Checker: a fresh agent with no stake in the build. I read every file in `games/long-line/` (LongLine.jsx, scene.jsx, index.js, glyph.jsx), `content/long-line.js`, `maths/longLine.js`, the cell maths it imports (`lecture4-study/rnn.js`: `rnnStep`, `lstmStep`, `gruStep`), the 11 concept ids and 3 EQUATIONS (`rnn.layer`, `lstm.all`, `gru.all`) it uses in `content/lecture4.js`, and the `useRound.js` header. Sources: the Lecture 4 PDF (text for slides 5–10, 14 and 40–49; rendered s5, s9, s14, s44 (220 dpi), s45, s46, s47, s48 (Figure 15-13 zoomed to 260 dpi), s49) and `lecture-4.md`, including its Quirks section.

Every symbol in the equations was checked on the renders:
- **Slide 47:** i, f, o use σ and g uses tanh, each of x⊤W_x· + h⊤(t−1)W_h· + b⊤. c(t) = f ⊗ c(t−1) + i ⊗ g. y(t) = h(t) = o ⊗ tanh(c(t)).
- **Slide 49:** z and r use σ. g = tanh(x⊤W_xg + (r⊤W_hg ⊗ h⊤(t−1)) + b⊤_g). h(t) = z ⊗ h(t−1) + (1 − z) ⊗ g.
- **Figure 15-13:** z feeds the ⊗ on the h(t−1) line, a 1−z box feeds the ⊗ on g, and r ⊗ h(t−1) enters the g FC layer. r and z have the Logistic band and g has the Tanh band.

The game and `rnn.js` match all of these.

**Blind sample: 85 generated items, 85/85 match.**
- 46 stations: level 2 seeds 11 and 42 (20 LSTM stations); level 3 seeds 11, 42 and 7 (26 GRU stations).
- 15 signal stops.
- 22 level-1 items (seeds 11 and 42) plus 2 more slide-9 steps (seed 5).

**Sweep: seeds 1–2000 at levels 2 and 3.**
- No card fallback ever fired: every route is one of the 4 LSTM and 2 GRU plans.
- 0 stations have a gate in the 0.01–0.15 grey zone.
- Every "due" label points at a delivery stop.
- The graded gates per card are always the same: LSTM load i,o; keep, deliver, swap, topup and loadDeliver f,i,o; dump f,i. GRU load, keep and deliver z; replace and blend z,r.

**Fade check: seeds 1–2000 at level 1.** The first crate is the weakest trace in **0/2000** runs (see row 26).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Lever = gate bias ±6, gate weights 0, so gate = σ(±6) = 0.998 / 0.002; σ outputs 0 to 1 | TOY.lever, note (beyond: true); COPY.controls | L4 · 46 (σ, 0–1), 47, 49 | VERIFIED (beyond) | — |
| 2 | Toy weights: RNN W_h 0.5, W_x 1, b 0; LSTM W_xg 1, W_hg 0; GRU W_xg 1, W_hg 1.5; crates; c(0) = h(0) = 0 | TOY, buildRoute start state | L4 · 9, 10 (h(0) zero), 47, 49 | VERIFIED (beyond) | — |
| 3 | f: which parts of the long-term state to erase; i: which parts of g to add; o: what to read and output (to h and y) | GATES.lstm roles | L4 · 46 | VERIFIED | — |
| 4 | z: one gate controller for both the forget gate and the input gate; on = keep h(t−1), off = take g | GATES.gru z | L4 · 48, 49, Fig 15-13 | VERIFIED | — |
| 5 | "gate r" (not named "reset"): gates only the previous-state term inside g | GATES.gru r, SCENE.gru.rOn/rOff | L4 · 49, Fig 15-13 (r ⊗ h(t−1) → g FC) | VERIFIED | — |
| 6 | LSTM load: i = 1 adds g, o = 0, f is free because c(t−1) = 0 | CARDS.lstm.load (care i,o) | L4 · 47 | VERIFIED | — |
| 7 | LSTM keep: f = 1 keeps c(t−1) (f ≈ 0 erases it), i = 0, o = 0 | CARDS.lstm.keep | L4 · 46, 47 | VERIFIED | — |
| 8 | LSTM topup {1,1,0}, swap {0,1,0}, loadDeliver {1,1,1}; their whys | CARDS.lstm.topup/swap/loadDeliver | L4 · 47 | VERIFIED | — |
| 9 | LSTM deliver {f1,i0,o1}: y = h = o ⊗ tanh(c(t)) reads the NEW c(t), so erasing here delivers nothing | CARDS.lstm.deliver why | L4 · 45, 47 | VERIFIED | — |
| 10 | LSTM deliver line "deliver it, and keep it aboard" never says to leave the crate, but i is graded (= 0). Its sub "add nothing" never shows, because a deliver stop is never among the first 3 (hinted) stations | CARDS.lstm.deliver.line (ll2 t = 4/5 and 8/9) | L4 · 47 | AMBIGUOUS | Append "Leave the crate." as the keep card does. |
| 11 | LSTM dump {0,0,o free}: c ≈ 0, so o has nothing to read (o sensitivity ≈ 0.006) | CARDS.lstm.dump (care f,i) | L4 · 47 | VERIFIED | — |
| 12 | GRU load {z0, r free}: 1 − z lets g in; r has nothing to gate when h(t−1) = 0 | CARDS.gru.load (care z) | L4 · 49 | VERIFIED | — |
| 13 | GRU keep / deliver {z1, r free}: z multiplies the previous state, so with g shut out r changes nothing | CARDS.gru.keep, deliver (care z) | L4 · 49, Fig 15-13 | VERIFIED | — |
| 14 | GRU deliver: no output gate, the full state vector is output at every step | CARDS.gru.deliver, SCENE.gru.board, TrainScene readOn = true | L4 · 48 | VERIFIED | — |
| 15 | GRU replace {z0,r0}: g ≈ tanh(x⊤W_xg + b⊤_g), the crate alone | CARDS.gru.replace (care z,r) | L4 · 49 | VERIFIED | — |
| 16 | GRU blend {z0,r1}: r ≈ 1 keeps the previous-state term in g, folding old cargo into the new | CARDS.gru.blend (care z,r) | L4 · 49 (toy W_hg > 0) | VERIFIED | — |
| 17 | Unrolled = the neuron drawn once per step along a Time axis, each step fed x(t) and the previous output; left/right picture | QUESTIONS.rnn unrolled, PairScene, SCENE.pair | L4 · 5 (Fig 15-1) | VERIFIED | — |
| 18 | A time step is also called a frame (distractors: epoch, batch, layer) | frame | L4 · 5 | VERIFIED | The quote stops before ", ŷ(t−1)". Cosmetic. |
| 19 | h(t) = f(x(t), h(t−1)) (distractors: x only, h only, x and h(t+1)) | depends | L4 · 8 | VERIFIED | — |
| 20 | y(t) is a function of all inputs since t = 0 | allInputs | L4 · 7 | VERIFIED | — |
| 21 | h(0) of each training instance is usually a zero vector | h0 | L4 · 10 | VERIFIED | — |
| 22 | Previous state enters via h⊤(t−1)W_h, with W_h n_neurons × n_neurons; h⊤(t)W_y is the output line | carry | L4 · 9 | VERIFIED | — |
| 23 | Information is lost at each step through the transformations; distractors "reset every step", "different weights per step", "only last input" are false | lost | L4 · 42, 14, 10 | VERIFIED | — |
| 24 | tanh is the default because a saturating activation reduces the risk of exploding outputs; ReLU may not help because the same weights are used every step | tanh, relu | L4 · 40 | VERIFIED | — |
| 25 | BPTT = unroll through time, then regular backprop; every unrolled cell shares W, b | bptt, shared, SCENE.unrolled.shared | L4 · 14 (Fig 15-5), 40 | VERIFIED | — |
| 26 | "At the end of this run, which crate leaves the weakest trace in h(t)?" → the first crate. In the game's own run the second crate always leaves a weaker trace (0/2000 seeds have the first weakest; seed 1 traces at t = 6: crate 1 0.0060, crate 2 0.0039), because crate 1 is 1.2 and the later crates are 0.2–0.4 | QUESTIONS.rnn fade (ll1 item 7) + TOY.fadeFirst/fadeLater | L4 · 40, 42 (the slides' words are right; the superlative fails on the drawn run) | WRONG | Ask "Which leaves the weaker trace in h(t) at the end of the run: the first crate or the last?" (choices unchanged). Or make all fade crates equal. |
| 27 | f, i, o use σ (0 to 1); g uses tanh ("only the main layer g uses tanh") | act.f, act.i, act.o, act.g | L4 · 46, 47, Fig 15-12 on 44 (bands) | VERIFIED | Optional: "of the four FC layers, only g uses tanh", since c(t) is also passed through tanh (slide 45). act.o's why already says so. |
| 28 | c(t) = f ⊗ c(t−1) + i ⊗ g (distractors swapped / o gate / tanh-wrapped are all false) | cLine | L4 · 47, 44 | VERIFIED | — |
| 29 | y(t) = h(t) = o ⊗ tanh(c(t)) with the new c(t) (distractors: no tanh / c(t−1) / f gate) | yLine | L4 · 45, 47 | VERIFIED | — |
| 30 | c(t) is the long-term state, h(t) the short-term | states | L4 · 43 | VERIFIED | — |
| 31 | New c(t) "sent straight out, without any further transformation" (correct). But distractors "passed through tanh before it leaves the cell" and "multiplied by the output gate before it leaves" echo slide 45: "the result c(t) is also passed through the tanh function and then filtered by the output gate" | straight (L2 signal stop) | L4 · 44 vs 45 | AMBIGUOUS | Game reads "it" as the c(t) passed on. Reword the prompt to "The new c(t) passed on to the next time step is …", or the distractors to "replaced by tanh(c(t)) before being passed on". |
| 32 | Gate roles by name (erase = f, add g = i, read out = o; g offered as a distractor) | roleErase, roleAdd, roleRead | L4 · 46 | VERIFIED | — |
| 33 | z multiplies h(t−1) and 1 − z multiplies g; z = 1 keeps h(t−1); r acts only on the previous-state term inside g | zMult, zOne, rWhere | L4 · 49, Fig 15-13 on 48 | VERIFIED | — |
| 34 | GRU: states merged into h(t); one controller z for forget + input; no output gate | merged, oneCtrl, noOut | L4 · 48 | VERIFIED | — |
| 35 | z, r use σ; GRU g uses tanh (Fig 15-13 Logistic / Tanh bands) | act.z, act.r, act.gg | L4 · 49, 48 | VERIFIED | — |
| 36 | One step of slide 9: h = tanh(h(t−1)W_h + x W_x + b_h); slips noPhi / noH / noX | STEP, stepItem (6 items reproduced) | L4 · 9 (tanh listed as an example φ_h) | VERIFIED | — |
| 37 | Drawer equations: lstm.all = slide 47 (all 6 lines), gru.all = slide 49 (all 4 lines), rnn.layer = slide 9 (both lines) | COPY.drawer + EQUATIONS (lecture4.js) | L4 · 9, 47, 49 | VERIFIED | — |
| 38 | Drawer toy lines (gates σ(x·0 + h·0 ± 6); g, c, h, fade lines) reproduce the cell's numbers | lstmMaths, gruMaths, fadeMaths, COPY.drawer.toy/fade | L4 · 9, 47, 49 | VERIFIED (beyond) | — |
| 39 | With one unit, slide 49's typesetting (r⊤W_hg ⊗ h⊤) and Fig 15-13's order (r ⊗ h, then FC) give the same number | COPY.drawer.gruOrder; rnn.js gruStep uses the figure's order | L4 · 48, 49; transcript Quirk "slide 49 g equation" | VERIFIED | — |
| 40 | Scene labels: LSTM board y(t) = h(t), reads tanh(c(t)), o(t), crane i(t) ⊗ g(t), hatch f(t) ⊗ c(t−1); GRU crane (1 − z) ⊗ g(t), hatch z ⊗ h(t−1) | SCENE.lstm, SCENE.gru, TrainScene | L4 · 44–49 | VERIFIED | — |
| 41 | Intro, controls, level names ("SimpleRNN · the fade", "LSTM · f, i, o", "GRU · z, r"), model src lists | COPY, index.js | L4 · 5, 9, 14, 43, 47, 48, 49 | VERIFIED | — |
| 42 | Concept slides: rnn.neuron 5, memoryCell 7–8, equations 9, discardedOutputs 10, longSeq 40, bptt 14, lstm.cell 42–43, lstm.gates 44–46, lstm.equations 47, gru.cell 48, gru.update 49 | lecture4.js CONCEPTS; index.js concepts (all 11 used, none missing) | L4 · as listed | VERIFIED | — |
| 43 | gru.update summary says "the reset gate"; the slides never name r (transcript Quirk, slide 48) | lecture4.js CONCEPTS gru.update.summary (shared file) | L4 · 48, 49 | NOT IN SLIDES | Write "the gate r", as this game does. |

## Blind sample (85 items, 85/85 match)
How I solved it: from the card, x(t) and the car's state, I worked out which gates must be set using slide 47 (c = f c(t−1) + i g, h = o tanh c, toy g = tanh x) or slide 49 (h = z h(t−1) + (1 − z) g, toy g = tanh(x + 1.5 r h(t−1))). A gate is "free" when the equations make it irrelevant. I then compared my result with `answer` + `care`, where free = not in `care`.

**Level 2, seed 11 (LSTM, f i o):** 10/10 match.

| t | card | x | c(t−1) | my answer | game | match |
|---|---|---|---|---|---|---|
| 1 | load | 1 | 0 | free 1 0 | 1 1 0, care io | ✓ |
| 2 | keep | .3 | .760 | 1 0 0 | 1 0 0 | ✓ |
| 3 | keep | .4 | .759 | 1 0 0 | 1 0 0 | ✓ |
| 4 | keep | .6 | .758 | 1 0 0 | 1 0 0 | ✓ |
| 5 | deliver | .3 | .757 | 1 0 1 (i read from "deliver it") | 1 0 1 | ✓ |
| 6 | swap | 1.2 | .756 | 0 1 0 | 0 1 0 | ✓ |
| 7 | keep | .6 | .833 | 1 0 0 | 1 0 0 | ✓ |
| 8 | topup | .4 | .833 | 1 1 0 | 1 1 0 | ✓ |
| 9 | loadDeliver | .8 | 1.210 | 1 1 1 | 1 1 1 | ✓ |
| 10 | dump | .8 | 1.869 | 0 0 free | 0 0 0, care fi | ✓ |

**Level 2, seed 42 (LSTM):** 10/10 match.

| t | card | x | c(t−1) | my answer | game | match |
|---|---|---|---|---|---|---|
| 1 | load | .6 | 0 | free 1 0 | care io | ✓ |
| 2 | keep | .6 | .536 | 1 0 0 | 1 0 0 | ✓ |
| 3 | keep | .8 | .536 | 1 0 0 | 1 0 0 | ✓ |
| 4 | keep | 1.2 | .536 | 1 0 0 | 1 0 0 | ✓ |
| 5 | deliver | 1.2 | .537 | 1 0 1 | 1 0 1 | ✓ |
| 6 | swap | 1.2 | .538 | 0 1 0 | 0 1 0 | ✓ |
| 7 | keep | 1.2 | .833 | 1 0 0 | 1 0 0 | ✓ |
| 8 | topup | .8 | .833 | 1 1 0 | 1 1 0 | ✓ |
| 9 | deliver | .3 | 1.493 | 1 0 1 | 1 0 1 | ✓ |
| 10 | dump | .6 | 1.490 | 0 0 free | care fi | ✓ |

**Level 3, seed 11 (GRU, z r):** 9/9 match.

| t | card | x | h(t−1) | my answer | game | match |
|---|---|---|---|---|---|---|
| 1 | load | .3 | 0 | z0, r free | care z | ✓ |
| 2 | keep | .8 | .291 | z1, r free | z1, care z | ✓ |
| 3 | keep | .8 | .292 | z1, r free | z1, care z | ✓ |
| 4 | keep | .6 | .292 | z1, r free | z1, care z | ✓ |
| 5 | deliver | 1.2 | .293 | z1, r free | z1, care z | ✓ |
| 6 | replace | .6 | .294 | z0 r0 | z0 r0 | ✓ |
| 7 | keep | .4 | .537 | z1, r free | z1, care z | ✓ |
| 8 | blend | .3 | .537 | z0 r1 | z0 r1 | ✓ |
| 9 | deliver | .6 | .801 | z1, r free | z1, care z | ✓ |

**Level 3, seed 42 (GRU):** 9/9 match.

| t | card | x | h(t−1) | my answer | game | match |
|---|---|---|---|---|---|---|
| 1 | load | .8 | 0 | z0, r free | care z | ✓ |
| 2 | keep | .3 | .662 | z1, r free | z1, care z | ✓ |
| 3 | keep | .3 | .661 | z1, r free | z1, care z | ✓ |
| 4 | keep | 1.2 | .661 | z1, r free | z1, care z | ✓ |
| 5 | deliver | .4 | .661 | z1, r free | z1, care z | ✓ |
| 6 | replace | .3 | .660 | z0 r0 | z0 r0 | ✓ |
| 7 | keep | 1 | .294 | z1, r free | z1, care z | ✓ |
| 8 | blend | .8 | .296 | z0 r1 (r moves g by 0.18) | z0 r1 | ✓ |
| 9 | deliver | .3 | .845 | z1, r free | z1, care z | ✓ |

**Level 3, seed 7 (GRU):** 8/8 match.

| t | card | x | h(t−1) | my answer | game | match |
|---|---|---|---|---|---|---|
| 1 | load | .8 | 0 | z0, r free | care z | ✓ |
| 2 | keep | .3 | .662 | z1, r free | z1, care z | ✓ |
| 3 | keep | .4 | .661 | z1, r free | z1, care z | ✓ |
| 4 | deliver | .3 | .661 | z1, r free | z1, care z | ✓ |
| 5 | replace | .4 | .660 | z0 r0 | z0 r0 | ✓ |
| 6 | keep | 1 | .383 | z1, r free | z1, care z | ✓ |
| 7 | blend | .3 | .384 | z0 r1 | z0 r1 | ✓ |
| 8 | deliver | .6 | .703 | z1, r free | z1, care z | ✓ |

**Signal stops (15):** 15/15 match.
- L2 s11: roleAdd → i ✓; act.o → σ ✓; cLine → right ✓.
- L2 s42: roleAdd → i ✓; straight → straight ✓ (see row 31); cLine → right ✓.
- L3 s11: merged ✓; act.r → σ ✓; rWhere → prevInG ✓.
- L3 s42: oneCtrl → both ✓; act.z → σ ✓; rWhere ✓.
- L3 s7: merged ✓; act.r ✓; rWhere ✓.

**Level 1, seeds 11 and 42 (22):** 22/22 match.
- unrolled → right (drawn right) ✓✓.
- frame ✓✓; depends → xh ✓✓; h0 → zero ✓✓.
- shared → same ✓; carry → hWh ✓.
- fade → first ✓✓. This is the slides' answer, but the claim is false on the drawn run (row 26).
- allInputs → all ✓; bptt → unroll ✓; lost → transform ✓✓; relu → same ✓✓.
- Steps:

| seed | inputs | working | game | match |
|---|---|---|---|---|
| 11 | h .4, x 1, W_h .8, W_x 1, b 0 | tanh(1.32) = 0.87 | 0.87 | ✓ |
| 11 | h .8, x 1, W_h .5, W_x .5, b .1 | tanh(1.00) = 0.76 | 0.76 | ✓ |
| 42 | h .8, x .5, W_h .5, W_x .5, b 0 | tanh(0.65) = 0.57 | 0.57 | ✓ |
| 42 | h .8, x 1, W_h .5, W_x .5, b .1 | 0.76 | 0.76 | ✓ |

**Level 1, seed 5 (2 steps):** 2/2 match.

| inputs | working | game | match |
|---|---|---|---|
| h .4, x .5, W_h .8, W_x 1, b 0 | tanh(0.82) = 0.68 | 0.68 | ✓ |
| h .6, x .5, W_h .8, W_x .5, b .1 | tanh(0.83) = 0.68 | 0.68 | ✓ |

Seed 5's second-step distractors also reproduce: noPhi 0.83, noH tanh(0.35) = 0.34, noX tanh(0.58) = 0.52.

## Summary
1. 43 claims: 39 VERIFIED (3 of them beyond), 1 WRONG, 1 NOT IN SLIDES, 2 AMBIGUOUS. Blind sample 85/85; all 46 station gate settings agree with slides 47/49.
2. Fix 1 (row 26, WRONG): the fade prompt "which crate leaves the weakest trace" fails on the game's own run (crate 2 is weaker in 2000/2000 seeds). Ask "the first crate or the last?", or use equal crates.
3. Fix 2 (row 10, AMBIGUOUS): the LSTM deliver card grades i = 0 but its line never says to leave the crate, and its hint never shows. Append "Leave the crate."
4. Fix 3 (row 31, AMBIGUOUS): the `straight` distractors (tanh, output gate) echo slide 45's "c(t) is also passed through tanh … filtered by the output gate". Ask about "the c(t) passed on to the next time step".
5. Fix 4 (row 43, NOT IN SLIDES, shared lecture4.js): change "reset gate" to "gate r" in the gru.update summary. Optional (row 27): "of the four FC layers, only g uses tanh". No slide citation is off.
