# Accuracy check: Forecast Desk (`forecast-desk`)

- Date: 2026-10-23 · checker: fresh agent, no part in the build
- Sources: `cits5017-lect04-Processing-sequences.pdf` slides 15–39. I rendered and read slides 18, 19, 30, 34 and 36 at 110 dpi. Slides 16, 17, 20–23, 29, 35, 38 and 39 were rendered too, but I checked those against `lecture-4.md` (body and Quirks for slides 15–39), not the images.
- Files read: `games/forecast-desk/*` (ForecastDesk.jsx, scene.jsx, index.js, glyph.jsx, css), `content/forecast-desk.js`, `maths/forecastDesk.js`, and the 16 concept ids, ANCHORS (l4.baseline.\*, l4.mae.\*) and EQUATIONS (forecast.mae, forecast.mape) in `content/lecture4.js`.
- Data check: the stitched `busrail.js` copy (151 days, 2019-01-01 to 2019-05-31, 0 conflicts, 0 holes) gives these over 2019-03 to 2019-05 (92 days): bus MAE 43915.608696, rail MAE 42143.271739, bus MAPE 0.082938, rail MAPE 0.089948. All four match slide 18 to 6 dp. Its Figure 15-7 extremes match the transcript's readings: rail diff_7 +244,017 on 16 Mar and −464,640 on 27 May, bus −482,074 on 27 May, rail max 770,006 on 25 Apr, rail min 215,007 on 14 Apr, and 1 Mar at bus 812k / rail 683k.
- Blind sample: **73 items**. L1 seeds 11 and 12, L2 seeds 21 and 22, L3 seeds 31 and 32 (48 items), plus 25 targeted items from seeds 100–116: toy variants, shapeX/Y variants, predict, aheadLen, loopSame, seq2seq, deepWhy, shuffle, anchors, rnn1Why (tanh), and the loop strategy. **73/73 match.**
- Sweep: 6,000 rounds (seeds 1–2000 × 3 levels, 48,000 items). I recomputed these from what the item shows: copyDay (t − 7, and the cell is pickable), diff7 from the calendar cells, maeHand and mapeHand from the table (and the table matches the cells), and toy count, target and batch shapes from n, L, B. I also checked every choice answer is among its choices with no duplicates. **0 mismatches.** No item is marked `beyond`.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | MAE = diff_7.abs().mean(): bus 43915.608696, rail 42143.271739 | anchorMaeRail/Bus, ANCHORS l4.baseline.mae* | L4 · 18 | VERIFIED | — |
| 2 | MAPE = (diff_7 / targets).abs().mean(): bus 0.082938, rail 0.089948, printed as fractions not % | anchorMapeRail, mapeHand, EQUATIONS forecast.mape | L4 · 18 | VERIFIED | — |
| 3 | MAE also called MAD. Drawer: "slide 18 defines both through pandas code"; the tex transliterates that code | COPY.drawerMae, EQUATIONS forecast.mae | L4 · 18 | VERIFIED | — |
| 4 | Bus MAE > rail (43,916 vs 42,143) but bus MAPE "actually lower" | busVsRail | L4 · 18 | VERIFIED | — (the "bigger targets" reason follows from the definition) |
| 5 | 7-days' shift = the baseline for benchmarking the RNN methods; slide 23 recalls 42,143 | whichBaseline, BOARD.baseline | L4 · 18, 23 | VERIFIED | — |
| 6 | Copying a past value = naive forecasting; often a good baseline, can be tricky to beat | naiveDef | L4 · 16 | VERIFIED | — |
| 7 | Weekly seasonality, so copy the same weekday a week earlier, y(t−7); "works better" | whyWeekly, copyDay | L4 · 16, 17 | VERIFIED | — |
| 8 | diff_7 = df.diff(7) = y(t) − y(t−7) over 2019-03 to 2019-05; its size is the baseline's error that day | diff7, COPY.legend, SPLITS.diff7 | L4 · 17, 18 | VERIFIED | — |
| 9 | The page's series reproduces slide 18 exactly and the Figure 15-6/15-7 readings | SERIES, slide18(), BaselineScene | L4 · 16–18 | VERIFIED | — |
| 10 | Hand-worked items use the displayed rounded thousands; MAE ±0.5 (inclusive), MAPE ±0.002 | calendarItem | L4 · 17, 18 | VERIFIED | — (sweep 0 mismatches) |
| 11 | Toy: [0,1,2]→3, [1,2,3]→4, [2,3,4]→5; batches (2,3)/(2,) then (1,3)/(1,); [3,4,5] dropped, short last batch kept | TOY.*, toyDataset | L4 · 19 (image) | VERIFIED | — |
| 12 | Toy variants (n 6–9, L 2–4, B 2–3): count = n − L, target = my_series[p + L], batch sizes | TOY.variants, toyItem | L4 · 19 | VERIFIED | — |
| 13 | toyMissing key ("targets run out"); distractors (drop remainder, no overlap, skips last index) are false | TOY.missing | L4 · 19 | VERIFIED | cosmetic: for L = 2 or 4 the why still says "Windows do overlap ([0, 1, 2] then [1, 2, 3])". Prefix it "slide 19:" |
| 14 | "Shape of batch {k}…" counts from 0, and the toy scene does not mark which batch (scene.batch is unused) | toyBatchX/Y prompts, ToyScene | L4 · 19 (slide 21 counts "Minibatch 0") | AMBIGUOUS | Reading "batch 1" as the first batch gives (2, 3), which is marked wrong. Say "(counting from 0, like slide 21's Minibatch 0)" or "first / last batch". Also fix "holds 1 windows" |
| 15 | rail_train 2016-01–2018-12, rail_valid 2019-01–2019-05, rail_test 2019-06 onward, all / 1e6 | SPLITS, split | L4 · 20 | VERIFIED | — |
| 16 | train_ds is built with shuffle=True, seed=42 and valid_ds is not | shuffle (key) | L4 · 20 | VERIFIED | — |
| 17 | "valid_ds passes only sequence_length and batch_size=32" | shuffle.why | L4 · 20 | WRONG (minor) | valid_ds also passes targets=rail_valid[seq_length:]. Say "valid_ds passes no shuffle or seed (just targets, sequence_length and batch_size=32)" |
| 18 | seq_length 56, batch_size 32 → xx (32, 56), yy (32,); variants (16 or 64, 56) | WINDOW.shapeX/Y | L4 · 20, 21 | VERIFIED | — |
| 19 | Input days 0–55, target day 56 | rule56, rule55 | L4 · 20, 22 | VERIFIED | — |
| 20 | Recurrent layers want [batch, time steps, dim], dim 1 for univariate → (32, 56, 1); "the deck shows no reshape" | input3d | L4 · 21, 24 | AMBIGUOUS | Slide 21's minibatch is 2-D, but slide 24 requires 3-D (a transcript quirk). The game takes slide 24's reading and says so. Optional: ask "…in the 3D form SimpleRNN expects?" |
| 21 | Drawer "Shapes are [batch size, time steps, dimensionality] (slide 24)" appears on shapeX/shapeY/aheadY/predict, whose answers are (B, 56), (B,), (32, 14), (1, 14) | COPY.drawerShapes (maths.lines) | L4 · 24 vs 21, 36, 38 | WRONG | Slide 24 says only that recurrent layers expect 3D inputs. Reword: "Recurrent layers expect inputs shaped [batch size, time steps, dimensionality] (slide 24). Targets have no time-step axis: (32,) on slide 21, (32, 14) on slide 36." |
| 22 | Printed MAEs: linear 38,245 (23), SimpleRNN(1) > 100,000 (24), univar 27,703 (26), deep 29,672 (29), mulvar 22,062 (31), multask 27,855 (33; bus 26,812, rail 28,896), loop 30,734 (34), ahead 33,887 rail (38) | BOARD, ANCHORS, multaskNote | L4 · 23–38 | VERIFIED | — |
| 23 | Board codes: Dense(1) on 56-day windows; one recurrent neuron; SimpleRNN(32)+Dense(1); 3×SimpleRNN(32)+Dense(1); 5 columns; Dense(2); 14 days 1 step at a time; Dense(14) | BOARD.rows | L4 · 23, 25, 27, 29, 31, 32, 34, 38 | VERIFIED | — |
| 24 | Only SimpleRNN(1) fails to beat 42,143; lowest rail-only MAE = univar; widest margin = mulvar (also the deck's best); loop beats ahead, "slightly worse" | notBeat, bestUnivariate, beatWidest, beatAhead | L4 · 18, 23–38 | VERIFIED | — |
| 25 | SimpleRNN(1) fails for two reasons: one neuron / 3 params (25), and tanh in [−1, 1] vs a series up to ~1.4 (26). Fix = SimpleRNN(32) + Dense(1), no activation | rnn1Why reasons + why | L4 · 24–26 | VERIFIED | — |
| 26 | Some distractors are true per the slides but not the asked reason or verdict: rnn1Why "its input layer is [None, 1]" (24) and "its training windows were shuffled" (20); deepWhy "tanh cannot output values above 1" (26) | rnn1Why.choices, deepWhy.choices | L4 · 20, 24, 26 | AMBIGUOUS | The keys stand, since none of these is a listed reason or the slide 29 verdict. Swap in plainly false claims, e.g. "shuffling scrambled each window's day order" or "Dense(1) needs a tanh to reach 1.4" |
| 27 | Deep RNN: return_sequences=True on every SimpleRNN except the last; 5,281 params; 29,672 is worse than the shallower RNN, "a bit too large" | returnSeq, returnSeq3, deepWhy, StackScene | L4 · 28, 29 | VERIFIED | — |
| 28 | df_mulvar = bus, rail / 1e6 + next_day_type = day_type.shift(-1), one-hot → A/U/W; the head() values; 2016-01-02 has U = 1 | TABLE30, nextDay, columns | L4 · 30 (image) | VERIFIED | — |
| 29 | mulvar_model reads all 5 columns, forecasts only rail, InputLayer [None, 5]; minibatch (32, 56, 5) | target, columns, mulvarShape | L4 · 24, 31 | VERIFIED | — (the shape follows from "the other 4 arguments are the same") |
| 30 | multask: targets [["bus", "rail"]], 2 per day, Dense(2) | multask | L4 · 32 | VERIFIED | — |
| 31 | Loop: the prediction at t−1 is the last input at t, ×14; univar was trained one step ahead only; works only when input and output have the same features | STRATEGIES.loop, loopSame | L4 · 34 (image) | VERIFIED | — (reads the slide's "at the same features" as "have", a quirk) |
| 32 | sequence_length = 56 + 14 = 70; days 0–55 in, 56–69 out; [:, :-ahead] / [:, -ahead:, target_col]; target_col 1 = rail; x (32, 56, 5), y (32, 14) | AHEAD.len/x/y, targetCol | L4 · 30, 35, 36 (image) | VERIFIED | — |
| 33 | ahead_model = SimpleRNN(32) + Dense(14); X [1, 56, 5] → Y_pred [1, 14]; all 14 at the last time step | predict, aheadWhere, STRATEGIES.ahead | L4 · 35, 38 | VERIFIED | — |
| 34 | Seq2seq forecasts at every time step: days 0–9 → 10–19, then 1–10 → 11–20; no code or MAE given | seq2seq, STRATEGIES.seq2seq | L4 · 39 | VERIFIED | — |
| 35 | Strategy distractor "two outputs per day (multask_model)" is not a multi-step strategy; the three pictures match their labels | STRATEGY_DISTRACTOR, StrategyScene | L4 · 32–39 | VERIFIED | — |
| 36 | All remaining choice distractors are false per the cited slides | QUESTIONS (naiveDef … beatAhead) | L4 · 16–39 | VERIFIED | — |
| 37 | All 16 concept ids teach on their listed slides, and every src cites a slide that says the claim | index.js, lecture4.js, all src | L4 · 15–39 | VERIFIED | — |
| 38 | Window and ahead charts draw rail_valid / mulvar_valid copies, captioned as such, while the prompts speak of train_ds / ahead_train_ds | COPY.windowCaption/aheadCaption | L4 · 22, 37 | VERIFIED | — (the captions are accurate) |

## Blind sample

Keys: L = level, s = seed. Calendar values are rail in thousands, as shown on the item.

| # | item | prompt (essentials) | mine | game | ✓ |
|---|---|---|---|---|---|
| 1 | whyWeekly (1/11) | why copy 7 days earlier | weekly seasonality | seasonality | ✓ |
| 2 | copyDay (1/11) | Fri 19 Apr | Fri 12 Apr | 2019-04-12 | ✓ |
| 3 | diff7 (1/11) | Thu 18 Apr 676, lag 747 | −71 | −71 | ✓ |
| 4 | diff7 (1/11) | Thu 11 Apr 747, lag 736 | 11 | 11 | ✓ |
| 5 | maeHand (1/11) | 673/693, 708/747, 729/759, 729/770 | (20+39+30+41)/4 = 32.5 | 32.5 | ✓ |
| 6 | anchorMapeRail (1/11) | rail MAPE | 0.089948 | mapeRail | ✓ |
| 7 | mapeHand (1/11) | 747/709, 759/699 | (38/747 + 60/759)/2 = 0.064961 | 0.064961 | ✓ |
| 8 | busVsRail (1/11) | bus MAPE vs rail | lower | lower | ✓ |
| 9 | naiveDef (1/12) | copy a past value | naive forecasting | naive | ✓ |
| 10 | copyDay (1/12) | Sat 2 Mar | Sat 23 Feb | 2019-02-23 | ✓ |
| 11 | diff7 (1/12) | Sun 28 Apr 289, lag 277 | 12 | 12 | ✓ |
| 12 | diff7 (1/12) | Tue 7 May 739, lag 708 | 31 | 31 | ✓ |
| 13 | maeHand (1/12) | 680/754, 709/747, 699/732, 676/747 | 216/4 = 54 | 54 | ✓ |
| 14 | anchorMapeRail (1/12) | rail MAPE | 0.089948 | mapeRail | ✓ |
| 15 | mapeHand (1/12) | 692/720, 668/696 | (28/692 + 28/668)/2 = 0.041189 | 0.041189 | ✓ |
| 16 | whichBaseline (1/12) | benchmark baseline | 7-days' shift | shift7 | ✓ |
| 17 | toyTarget (2/21) | slide 19, [0,1,2] | 3 | 3 | ✓ |
| 18 | toyBatchY (2/21) | slide 19, batch 1 targets | (1,) (0-indexed) | (1,) | ✓ (see row 14) |
| 19 | rule56 (2/21) | days 0–55 → target | 56 | 56 | ✓ |
| 20 | input3d (2/21) | 32 univariate 56-day windows | (32, 56, 1) | (32, 56, 1) | ✓ |
| 21 | split (2/21) | rail_valid | 2019-01 to 2019-05 | rail_valid | ✓ |
| 22 | board valueOf (2/21) | univar_model | 27,703 | univar | ✓ |
| 23 | returnSeq (2/21) | deep_model | all SimpleRNN but last | allButLast | ✓ |
| 24 | bestUnivariate (2/21) | lowest of 23–29 | univar_model | univar | ✓ |
| 25 | toyCount (2/22) | slide 19 | 6 − 3 = 3 | 3 | ✓ |
| 26 | toyBatchX (2/22) | slide 19, batch 1 | (1, 3) | (1, 3) | ✓ |
| 27 | rule55 (2/22) | target 56 → last input | 55 | 55 | ✓ |
| 28 | input3d (2/22) | as #20 | (32, 56, 1) | (32, 56, 1) | ✓ |
| 29 | split (2/22) | rail_train | 2016-01 to 2018-12 | rail_train | ✓ |
| 30 | board nameOf (2/22) | 27,703 | univar_model | univar | ✓ |
| 31 | rnn1Why (2/22) | one of two reasons | single neuron, 3 params | oneNeuron | ✓ |
| 32 | notBeat (2/22) | did not beat 42,143 | SimpleRNN(1) | rnn1 | ✓ |
| 33 | nextDay (3/31) | 2016-01-02 holds | 2016-01-03's type | tomorrow | ✓ |
| 34 | multask (3/31) | output layer | Dense(2) | d2 | ✓ |
| 35 | aheadX (3/31) | x.shape | (32, 56, 5) | (32, 56, 5) | ✓ |
| 36 | strategy (3/31) | seq2seq picture | every time step | seq2seq | ✓ |
| 37 | aheadY (3/31) | y.shape | (32, 14) | (32, 14) | ✓ |
| 38 | returnSeq3 (3/31) | 2 × SimpleRNN before Dense(14) | the new first | first | ✓ |
| 39 | board valueOf (3/31) | ahead_model | 33,887 | ahead | ✓ |
| 40 | beatWidest (3/31) | widest margin | mulvar_model | mulvar | ✓ |
| 41 | columns (3/32) | inputs per step | 5 | 5 | ✓ |
| 42 | targetCol (3/32) | target_col=1 | rail | rail | ✓ |
| 43 | mulvarShape (3/32) | 5 cols, 56, 32 | (32, 56, 5) | (32, 56, 5) | ✓ |
| 44 | strategy (3/32) | ahead picture | 14 at last step | ahead | ✓ |
| 45 | aheadY (3/32) | y.shape | (32, 14) | (32, 14) | ✓ |
| 46 | aheadWhere (3/32) | ahead_model forecasts… | only at the last step | last | ✓ |
| 47 | board nameOf (3/32) | 30,734 | univar_model looped | loop | ✓ |
| 48 | beatAhead (3/32) | lower 14-day MAE | loop | loop | ✓ |
| 49 | copyDay (1/100) | Fri 3 May | Fri 26 Apr | 2019-04-26 | ✓ |
| 50 | anchorMaeRail (1/100) | rail MAE | 42143.271739 | maeRail | ✓ |
| 51 | mapeHand (1/100) | 713/727, 720/727 | (14/713 + 7/720)/2 = 0.014679 | 0.014679 | ✓ |
| 52 | toyMissing (2/100) | n 8, L 2, B 3, [6, 7] | targets run out | targets | ✓ |
| 53 | deepWhy (2/100) | slide 29 verdict | a bit too large | tooLarge | ✓ |
| 54 | target (3/100) | mulvar forecasts | only rail | rail | ✓ |
| 55 | strategy (3/100) | loop picture | loop one step ×14 | loop | ✓ |
| 56 | seq2seq (3/100) | days 1–10 → | days 11–20 | 11to20 | ✓ |
| 57 | toyTarget (2/101) | n 8, L 3, [3, 4, 5] | 6 | 6 | ✓ |
| 58 | toyBatchY (2/101) | n 6, L 2, B 2, batch 0 | 4 windows → (2,) | (2,) | ✓ |
| 59 | predict (3/101) | X [1, 56, 5] | (1, 14) | (1, 14) | ✓ |
| 60 | toyCount (2/102) | n 9, L 4 | 5 | 5 | ✓ |
| 61 | toyMissing (2/102) | n 9, L 3, [6, 7, 8] | targets run out | targets | ✓ |
| 62 | shuffle (2/102) | shuffle=True, seed=42 | train_ds | train | ✓ (why: row 17) |
| 63 | aheadLen (3/102) | 56 + 14 | 70 | 70 | ✓ |
| 64 | anchorMaeBus (1/103) | bus MAE | 43915.608696 | maeBus | ✓ |
| 65 | toyTarget (2/103) | n 6, L 4, [0, 1, 2, 3] | 4 | 4 | ✓ |
| 66 | shapeX (2/103) | B 16 | (16, 56) | (16, 56) | ✓ |
| 67 | toyCount (2/104) | n 8, L 2 | 6 | 6 | ✓ |
| 68 | toyBatchX (2/104) | n 8, L 2, B 2, batch 1 | (2, 2) | (2, 2) | ✓ |
| 69 | shapeY (2/104) | B 16 | (16,) | (16,) | ✓ |
| 70 | shapeX (2/105) | B 64 | (64, 56) | (64, 56) | ✓ |
| 71 | loopSame (3/106) | loop works only when | same features | same | ✓ |
| 72 | rnn1Why (2/111) | one of two reasons | tanh ±1 vs 1.4 | tanhRange | ✓ |
| 73 | toyBatchX (2/116) | n 8, L 3, B 3, batch 0 | 5 windows → (3, 3) | (3, 3) | ✓ |

## Summary
1. Counts: VERIFIED 33 (none marked beyond) · WRONG 2 · NOT IN SLIDES 0 · AMBIGUOUS 3. Blind sample: 73/73 match. Sweep: 48,000 items, 0 mismatches. The page's data reproduces slide 18's four printed numbers to 6 dp, and every printed MAE is paired with the right model and slide.
2. Fix 1 (WRONG, row 21): `COPY.drawerShapes` is shown on target and prediction shape items, but those shapes have no time-step axis: (B,), (32, 14), (1, 14). Restrict the wording to recurrent-layer inputs (slide 24) and add the target shapes from slides 21 and 36.
3. Fix 2 (AMBIGUOUS, row 14): toy "batch {k}" counts from 0, and the scene gives no cue. Add "counting from 0 (slide 21's Minibatch 0)" or name the first and last batch. Fix "holds 1 windows".
4. Fix 3 (AMBIGUOUS, row 26): replace the slide-true distractors with plainly false ones: rnn1Why's "[None, 1]" and "windows were shuffled", and deepWhy's "tanh cannot output values above 1".
5. Fix 4 (minor): `shuffle.why` should say valid_ds also passes targets (row 17). Optionally reword the input3d prompt to the "3D form SimpleRNN expects" (row 20), and add a "slide 19:" prefix to the toyMissing overlap example for L ≠ 3 (row 13).
