# DL Project 2 explainer — plan and storyboard

Source of truth: the executed notebook `Wigfield_James-proj2.ipynb` (sha256 7c7d7078…, MD5 d9f7370b…, extracted
2026-10-17 21:29) → `project2/data/notebook.js` via `tools/dl-project2/extract.mjs`. Receipts below use
`Out [n]` = the output of the code cell with execution count n; `cell k` = notebook cell index k (markdown);
`log` = `experiments/log.md`; `hand` = the handover.

## 1. Cell map

| Cell | Type | In | Section | Content |
|---|---|---|---|---|
| 0 | md | | title | Title, name, student number, intro, software/hardware |
| 1 | md | | s1 | ## 1. Setup |
| 2 | code | 1 | s1 | imports, TF_CPP_MIN_LOG_LEVEL=3, versions, seed 42, op determinism |
| 3 | md | | s2 | ## 2. Loading the data |
| 4 | code | 2 | s2 | load_data → shapes |
| 5 | code | 3 | s2 | per-split mean/std; val/test windows overlap: True |
| 6 | md | | s2 | split statistics + sliding-window discussion (904 + 309 + 309 = 1522) |
| 7 | md | | part-i | # Part (i) |
| 8 | md | | s3 | ## 3. Splitting |
| 9 | code | 4 | s3 | split_sequences; X/y shapes |
| 10 | md | | s4 | ## 4. Visualising |
| 11 | code | 5 | s4 | display_temperatures |
| 12 | code | 6 | s4 | train / val / test displays (3 figures) |
| 13 | md | | s4 | what the plots show |
| 14 | md | | s5 | ## 5. Shared helpers: scaling, activation, training, jit_compile |
| 15 | code | 7 | s5 | constants, MEAN/STD, scaling_layers, build_gru_model, train_model, plot_learning_curve, evaluate_mae, SHOW |
| 16 | md | | s6 | ## 6. Model 1 |
| 17 | code | 8 | s6 | model1 summary (3,000) |
| 18 | code | 9 | s6 | train + curve (66 / 46) |
| 19 | md | | s6 | curve discussion |
| 20 | code | 10 | s6 | test MAE 1.250 + display |
| 21 | md | | s6 | test discussion |
| 22 | md | | s7 | ## 7. Model 2 |
| 23 | code | 11 | s7 | model2 summary (2,626) |
| 24 | code | 12 | s7 | train at lr 1e-2 + curve (40 / 20) |
| 25 | md | | s7 | curve discussion (overfitting after 20, dropout tried) |
| 26 | code | 13 | s7 | 1-month test MAE 1.188 + display |
| 27 | md | | s7 | 1-month results, recursion, sliding window |
| 28 | code | 14 | s7 | predict_recursively; 12-month test MAE 1.407 + display |
| 29 | md | | s7 | recursive results |
| 30 | md | | s8 | ## 8. Model 3 (architecture, teacher forcing, inference) |
| 31 | code | 15 | s8 | build_encoder_decoder, decoder_inputs, predict_encoder_decoder; 3 summaries (5,218 / 2,592 / 2,626) |
| 32 | code | 16 | s8 | train (teacher-forced) + curve (50 / 30) |
| 33 | md | | s8 | curve: mild overfitting, teacher-forcing optimism 0.962 vs 1.178 |
| 34 | code | 17 | s8 | free-running test MAE 1.321 + display |
| 35 | md | | s8 | results |
| 36 | md | | s9 | ## 9. Horizons: what the cells do, the two baselines |
| 37 | code | 18 | s9 | seasonal_naive, climatology; MAE by horizon; plot |
| 38 | code | 19 | s9 | lead-month plot; val vs test, per-channel MAE and bias table |
| 39 | md | | s9 | ### Discussion |
| 40 | md | | part-ii | # Part (ii) |
| 41 | md | | s10 | ## 10. Data preparation + VAE assumptions |
| 42 | code | 20 | s10 | max channel, scalar z-score 24.70 / 5.11 |
| 43 | md | | s11 | ## 11. VAE model: codings size, architecture, sampling + loss, KL weight |
| 44 | code | 21 | s11 | CODINGS_SIZE 4, KL_WEIGHT 0.5/84, Sampling, build_vae; summaries (8,072 / 6,017) |
| 45 | code | 22 | s11 | train (43 / 23) + curve; KL per dim; val recon MAE 0.940 |
| 46 | md | | s11 | curve + KL discussion |
| 47 | md | | s12 | ## 12. Synthesised sequences |
| 48 | code | 23 | s12 | plot_sequences; 6 samples; 6 real; 500-sample statistics |
| 49 | md | | s12 | ### Discussion: realism (table) |
| 50 | md | | s13 | ## 13. Summary (table + closing) |

Sections (extractor keys): title[0] s1[1-2] s2[3-6] part-i[7] s3[8-9] s4[10-13] s5[14-15] s6[16-21] s7[22-29]
s8[30-35] s9[36-39] part-ii[40] s10[41-42] s11[43-46] s12[47-49] s13[50].

## 2. Numbers the page may show (all verified against the dump)

| Number | Value | Receipt |
|---|---|---|
| shapes | train (1522, 84, 2), val (313, 84, 2), test (297, 96, 2) | Out [2] |
| split stats °C | train min 12.2±3.8, max 24.7±5.1; val 14.0±3.3 / 24.1±4.4; test 11.3±3.2 / 22.6±5.7 | Out [3] |
| windows overlap | val True, test True | Out [3] |
| records | Swanbourne 396, Bickley 392 months; train 904 + 309 + 309 = 1522; ~1770 distinct months | cell 6 |
| X/y shapes | (N, 72, 2) / (N, 12, 2), N = 1522 / 313 / 297 | Out [4] |
| display draws | train 566, 1101, 1474; val 182, 56, 86; test 240, 257, 220; SHOW = 95, 259, 140 | figure titles Out [6], Out [10] |
| scaling | MEAN [12.22, 24.69], STD [3.8, 5.1] | Out [7] |
| constants | lr 3e-3 (M1, M3, VAE), 1e-2 (M2); patience 20; batch 32; 16 units; 48 steps/epoch | cell 15 code, cell 14 |
| tanh raw | val MAE 3.5 (log 3.531); ReLU+scaling ≈1.0; ReLU raw 1.5; ReLU 20 s/epoch vs 1 s | cell 14; log stage 1 |
| M1 | 3,000 params (960 + 1,632 + 408); stopped 66 (66 s), best 46, val_loss 1.5473, val MAE 0.988; test 1.250; min 0.79 / −0.08, max 1.71 / +0.81 | Out [8], Out [9], Out [10], Out [19] |
| M2 | 2,626 params (dense 34); stopped 40 (40 s), best 20, val_loss 1.2393, val MAE 0.882; 1-month test 1.188; 12-month 1.407; val 12-month 0.982; min 0.97 / +0.47, max 1.84 / +1.14 | Out [11]–[14], Out [19] |
| M2 tuning | lr 1e-3 0.958/1.145; 3e-3 0.896/1.042; 1e-2 0.855/0.974 (1-month / rollout); M1 1e-3 1.037, 3e-3 1.009, 1e-2 1.110 | log stage 2 |
| M2 recursion | window = grow to 3 dp for tanh; ReLU raw grow 3.44 vs window 1.122 (cell 27: "3.4 against 1.1") | log stage 1, cell 27 |
| M3 | 5,218 = 2,592 + 2,626; stopped 50 (64 s), best 30, val_loss 1.4601, TF val MAE 0.962; free val 1.178; test 1.321; min 0.87 / −0.08, max 1.77 / +1.20 | Out [15]–[17], Out [19] |
| M3 checks | stopping epoch within 0.04 of best free-running epoch; copy-encoder 1.19 / 1.18 vs 1.16 | cell 33, cell 30 |
| horizons | M2 1.407 1.422 1.452 1.468 1.470; M3 1.321 1.343 1.374 1.417 1.457; SN 1.235 1.233 1.231 1.232 1.234; clim 0.958 0.959 0.958 0.958 0.957 | Out [18] |
| horizon deltas | M3 +0.136, M2 +0.063 | cell 39 |
| lead months | M3 1.10 → ~1.4 by 12 → ~1.75 at 22; M2 1.19 → ~1.48 at 6, wobble ~1.4–1.6; level ~11–13; M3 worse from month 19 | cell 39 (readings of Out [19] figure) |
| baselines 12-mo | SN val 1.226 test 1.235 (min 1.04 / −0.05, max 1.43 / −0.06); clim val 0.967 test 0.958 (0.82 / −0.10, 1.10 / −0.11) | Out [19] |
| transfer | Bickley max 2.1 °C cooler than training; models take "about half" | cell 39 |
| VAE data | (1522, 84), (313, 84); mean 24.70, std 5.11 | Out [20] |
| VAE model | codings 4, KL weight 0.5/84; encoder 8,072 (conv 96, 2,592; z_mean/z_log_var 2,692 each); decoder 6,017 (3,360; 2,576; 81) | Out [21] |
| VAE training | stopped 43 (32 s), best 23, val_loss 0.0950, val MSE 0.067; KL/dim [0, 2, 0.75, 1.88]; recon MAE 0.940 | Out [22] |
| VAE tuning | codings 2–16 → 2–5 active; β=1 2 active; 0.5 3 active; 0.25 4 active but 26% flat; dense recon 0.95 vs 0.93 | cell 43, log |
| samples | 500: mean 24.5, std of means 0.62, range 12.6 (min 1.8), 21% <10, step 2.03; real: 24.7, 0.56, 17.2 (min 14.4), 0%, 2.48 | Out [23] |
| run | 51 cells, 23 code, counts 1–23; TF 2.21.0, Keras 3.15.1, NumPy 2.5.2; RTX 5070 Ti; 3 min 49 s; seed 42 + op determinism | Out [1], hand §1 |

## 3. Storyboards (plate per row; beats → what moves → caption gist; data; print key frames)

Colour mapping is fixed (decisions.md). All scenes 800-wide viewBox.

### title — Overview
- **0·1 The project in one picture** (`ProjectFlow`, builder A). Beats: (1) an 84-month window slides along a real
  Bickley record, splits into 72 | 12; (2) three lanes light in turn — model 1 "12 at once", model 2 "1 month ×12",
  model 3 "encoder → decoder" — each ending in its 12-month test MAE chip-free number (1.250 / 1.407 / 1.321,
  Out [10], [14], [17]); (3) horizon showdown: 12 → 24 months for M2 1.407 → 1.470 and M3 1.321 → 1.457 with the
  climatology line at 0.958 (Out [18]); (4) part (ii): the max channel peels off (orange), goes through a VAE
  bottleneck "4 codings", six thin sinusoids appear (drawn as the notebook figure thumbnail, Out [23]). Print: beats 2, 4.
- **0·2 Five stations, three splits** (`StationMap`, done; builder A wires counts from Out [2] and adds the
  split means Out [3] to the ledger). Print: last frame.

### s1 — Setup
- **1·1 Same seed, same numbers** (builder A). Beats: seed 42 fans out to three random sources (initial weights,
  shuffle order, VAE ε and display draws); determinism off → two runs differ in the 6th digit (log: 1.591829 vs
  1.591826); on → identical; the log-level line silences GPU warnings. Caption cites cell 1's caveat (other
  hardware drifts; hand: VAE 49/29 on CPU). Schematic. Print: last.

### s2 — Loading
- **2·1 One block of numbers** (builder A): three tensor blocks (sequences × months × channels) assemble with
  their shapes (Out [2]); slice to channel 0 = min (blue) / 1 = max (orange). Print: last.
- **2·2 Windows that overlap** (builder A): the real Bickley 392-month record (SERIES.bickley) as one ribbon;
  windows 1, 2, 3 … slide one month at a time; counter 392 − 96 + 1 = 297; "overlap: True" (Out [3]);
  Swanbourne 396 − 84 + 1 = 313; train 904 + 309 + 309 = 1522 (cell 6). Lesson: not 297 independent cases.
  Print: 2, last.
- **2·3 Three climates** (builder A): dot ± std per split per channel (Out [3]); Bickley cooler on both,
  Swanbourne warmer minimums, smaller spread. Sets up section 9. Print: last.

### s3 — Splitting
- **3·1 Cutting a sequence into input and target** (done, lead): reference explainer, shapes Out [4].

### s4 — Visualising
- **4·1 Reading a display_temperatures panel** (builder B): build one panel from real test sequence 95
  (SERIES.testSeqs['95']): input solid (min blue, max red-as-orange), target dashed + dots, the grey line at the
  end of the input, shared y; then the 1-month case (one dot + cross) for model 2; then `indices=SHOW` locks
  sequences 95, 259, 140 for every model. Show the real cell12/cell20 figure as reference in the ledger.
  Print: 1, last.

### s5 — Shared helpers
- **5·1 Scaling inside the model** (builder B): real temperatures (a sequence's months as dots) on a tanh curve
  — 5–36 °C sits on the flat tails; z = (x − 12.22)/3.8 and (x − 24.69)/5.1 (Out [7]) moves them into −2…2
  where tanh bends; Normalization in, invert=True out, so tensors outside stay in °C, loss in °C². Numbers: tanh
  raw 3.5 (cell 14), ReLU 20 s vs 1 s/epoch (cell 14). Print: 2, last.
- **5·2 Early stopping and the rewind** (builder B): EarlyStop scene behind a 4-way toggle (model 1 66/46,
  model 2 40/20, model 3 50/30, VAE 43/23; patience 20; Out [9], [12], [16], [22]). Print: all four last frames.

### s6 — Model 1
- **6·1 Inside a GRU cell** (builder C): GruCell (units 16, tanh) + ledger: where 960 comes from
  (3 gates × (16·2 + 16·16 + 2·16) = 960, Keras reset_after; then 1,632 and 408; Out [8]). Concept checker must
  confirm the formula. Print: 1, 2, 4, 5.
- **6·2 Seventy-two steps, two layers, one Dense** (builder C): unrolled stack with shapes:
  (N, 72, 2) → norm → GRU(16, return_sequences) (N, 72, 16) → GRU(16) (N, 16) → Dense(24) → Reshape (N, 12, 2) →
  denorm °C; param counts per layer. "What came out": Out [9] curve facts, test 1.250, per-channel bias,
  sequence 95's winter trough (cell 21). Print: 2, last.

### s7 — Model 2
- **7·1 Why model 2 wants a faster learning rate** (builder C): slope chart over lr 1e-3, 3e-3, 1e-2:
  model 1 1.037 → 1.009 → 1.110 (U-shape), model 2 one-month 0.958 → 0.896 → 0.855 and rollout 1.145 → 1.042 →
  0.974 (log, 2-seed means). Then the cost: model 2's curve overfits after epoch 20 (Out [12], cell 25) and
  dropout made it worse (cell 25). Print: last.
- **7·2 Twelve months, one month at a time** (builder C): Recursion (mode slide) + ledger: 1.188 → 1.407,
  window vs grow, ReLU 3.4 vs 1.1 (cell 27). Print: 1, 2, last.

### s8 — Model 3
- **8·1 What a GRU layer hands back** (builder D): return_sequences vs return_state: encoder_gru1 returns
  [(N, 72, 16), (N, 16)], encoder_gru2 [(N, 16), (N, 16)] (Out [15] summary shapes); the "Connected to" column
  (decoder_gru1 ← encoder_gru1[0][1], decoder_gru2 ← encoder_gru2[0][1]); 5,218 = 2,592 + 2,626. Print: last.
- **8·2 Teacher forcing vs free running** (builder D): EncDec toggle (start = month 72; decoder_inputs =
  concat(X[:, −1:], y[:, :−1])). Print: train 1, 3; test 2, 3, 4.
- **8·3 Why the curves flatter model 3** (builder D): a ruler of three real numbers: teacher-forced val 0.962
  (Out [16]) → free-running val 1.178 (Out [19]) → free-running test 1.321 (Out [17]); gaps labelled exposure
  bias (+0.216) and station shift (+0.143); stopping-epoch check within 0.04 (cell 33). Print: last.

### s9 — Horizons
- **9·1 Two baselines from the input alone** (builder E): a real test sequence's 72 input months; seasonal naive
  copies the last 12 and tiles; climatology averages each calendar month over 6 years (stacked years → mean) and
  tiles — drawn from SERIES data (mechanism, real data). Print: 2, last.
- **9·2 MAE against horizon** (builder E): Horizon scene with Out [18] series (M2, M3, SN dashed, clim dashed);
  deltas +0.063 / +0.136 (cell 39). Print: last.
- **9·3 Averages hide the last months** (builder E): the real lead-month figure (figures/cell38_0.png as an SVG
  `<image>`) with animated overlays at month 1 (1.10 vs 1.19), month 12.5 line, crossover month 19, model 3 ~1.75
  at 22 (cell 39); a small "running mean" beat explaining why the horizon MAE rises slowly. Print: last.
- **9·4 Why every model loses at Bickley** (builder E): diverging dot plot of test bias per channel for M1–M3,
  SN, clim (Out [19]); Bickley max 2.1 °C cooler (cell 39), models take "about half"; next step: anomaly
  formulation (cell 39). Print: last.

### s10 — VAE data
- **10·1 One channel, one scale** (builder B): train_seq[:, :, 1] peels the orange max channel off the block →
  (1522, 84); scalar z-score 24.70 / 5.11 (Out [20]) — one number pair, unlike part (i)'s per-channel pair.
  Print: last.

### s11 — VAE model
- **11·1 Squeezing 84 months into 4 numbers** (builder F): conv path with stride-2 halving: 84 → (84, 1) →
  Conv1D(16, 5, s2) (42, 16) → Conv1D(32) (21, 32) → 672 → μ(4), γ(4) → z(4) → Dense 672 → (21, 32) →
  Conv1DTranspose (42, 16) → (84, 1) → 84; param counts Out [21]. Print: last.
- **11·2 The reparameterisation trick** (builder F): Reparam (codings 4). Print: 1, 3, 5.
- **11·3 The KL pull, and one dead dimension** (builder F): four latent dims: prior N(0, 1) vs per-sequence
  posteriors (schematic); KL per dim bars with the real values [0, 2.00, 0.75, 1.88] (Out [22]); weight 0.5/84
  explained (per month like the MSE, then halved; cell 43); β sweep from log (1 → 2 active, 0.5 → 3, 0.25 → 4 but
  more flat samples). Print: last.

### s12 — Synthesised sequences
- **12·1 Six draws from the prior** (builder F): six z ~ N(0, I) points → decoder → the real six-sample figure
  (cell48_0.png) revealed panel by panel; then the statistics table (Out [23]). Print: last.
- **12·2 Smooth waves and flat lines** (builder F): why an MSE decoder blurs (average of plausible sequences);
  the phase ring hypothesis (cell 49: "I have not checked this"; hand: results critic found r = 0.93/0.92 with
  sin/cos of start month, flat samples at small radius) — schematic, labelled as the notebook's hypothesis.
  Print: last.

### s13 — Summary
- **13·1 Swanbourne to Bickley** (builder E): slope chart val → test for M1–M3 and both baselines (Out [19]):
  models climb, baselines stay flat; the 24-month column for M2/M3/SN/clim (Out [18]). Then "what worked /
  what didn't / what limited it" ledger from cell 50 + cell 39. Print: last.

## 4. NotebookLM prompt (draft — final text in `project2/notebooklm.js`)

Lead with: source = this PDF only; audience James (Python + basic neural nets); walk sections in notebook order
naming them; per section task → what was done → how it works → why → actual results → problems; most time on the
hard parts (scaling + tanh, recursive forecasting and error build-up, the encoder–decoder's state hand-over and
teacher forcing vs free running, horizon/lead-month reading, the Bickley bias and why models lose to the
baselines, the VAE's KL weighting / dead dimension / blur and flat samples); show the PDF's plots and plates while
discussing them; numbers exactly as printed, schematic diagrams called schematic; end with what worked, what
didn't, what limited the results. Compact variant ≤ ~500 characters.

## 5. File layout and the builder split

`explainers/` — one plate file per section, scenes in `explainers/scenes/`. Lead owns the registry, shell,
CSS, print, data, nbutil, Scene/Plate, and `S03Split.jsx`.

| Builder | Files (exclusive) | Plates |
|---|---|---|
| A | `S00Overview.jsx`, `S01Setup.jsx`, `S02Loading.jsx`, `scenes/ProjectFlow.jsx`, `scenes/Seed.jsx`, `scenes/TensorBlock.jsx`, `scenes/Windows.jsx`, `scenes/Climates.jsx` (+ edits to `scenes/StationMap.jsx`) | 0·1, 0·2, 1·1, 2·1, 2·2, 2·3 |
| B | `S04Visualise.jsx`, `S05Helpers.jsx`, `S10VaeData.jsx`, `scenes/PanelAnatomy.jsx`, `scenes/Scaling.jsx`, `scenes/CurveReading.jsx`, `scenes/MaxChannel.jsx` (+ `scenes/EarlyStop.jsx`) | 4·1, 5·1, 5·2, 5·3, 10·1 |
| C | `S06Model1.jsx`, `S07Model2.jsx`, `scenes/Unroll.jsx`, `scenes/LearningRate.jsx` (+ `scenes/GruCell.jsx`, `scenes/Recursion.jsx`) | 6·1, 6·2, 7·1, 7·2 |
| D | `S08Model3.jsx`, `scenes/ReturnState.jsx`, `scenes/Optimism.jsx` (+ `scenes/EncDec.jsx`) | 8·1, 8·2, 8·3 |
| E | `S09Horizons.jsx`, `S13Summary.jsx`, `scenes/Baselines.jsx`, `scenes/LeadMonths.jsx`, `scenes/Bias.jsx`, `scenes/Transfer.jsx` (+ `scenes/Horizon.jsx`) | 9·1–9·4, 13·1 |
| F | `S11Vae.jsx`, `S12Samples.jsx`, `scenes/ConvPath.jsx`, `scenes/KlPull.jsx`, `scenes/Prior.jsx`, `scenes/Blur.jsx` (+ `scenes/Reparam.jsx`) | 11·1–11·3, 12·1, 12·2 |

## 6. Storyboard changes from the cold-learner review (2026-10-17)

The fresh "cold learner" agent read the notebook, figures and handover. Its five hardest ideas, ranked, map onto
plates as follows (each builder must address its rows):

1. Teacher forcing vs free running, three Keras models sharing one set of layers → 8·1 adds a beat showing the
   same layer objects wired into `model3` (training), `encoder` and `decoder` (inference); 8·2 toggle; 8·3 ruler
   0.962 → 1.178 → 1.321. 8·2 text contrasts model 2 (re-reads a 72-month window every step) with model 3 (reads
   one month + carried states), and explains `decoded1, _` (training throws the states away, inference keeps them).
2. Level with climatology on Swanbourne, behind it on Bickley → 9·4 shows the model output pulled back towards
   training-station warmth: max bias +0.81 … +1.20 against a 2.1 °C cooler station ("about half", cell 39);
   "bias" here = mean signed error, not the Dense bias. 13·1 slope chart shows the val→test rank flip (model 3
   worst on Swanbourne, ahead of model 2 on Bickley).
3. Horizon (running average) vs lead month → 9·3 shades lead months 1…h on the real lead-month figure and shows
   the matching horizon value from Out [18] (h = 12 → 24), so "model 3 better at every horizon" and "model 3 worse
   from month 19" are visibly both true. Note that model 1 can only output 12 months (no horizon curve).
4. The VAE latent space → 12·2 ring hypothesis (cell 49 "not checked"; handover: results critic found r = 0.93 /
   0.92 with sin/cos of start month and flat samples at small radius), schematic. 11·3 reconciles the numbers:
   val_loss − val_mse = 0.0950 − 0.067 ≈ 0.028 ≈ (0.5/84) × (0 + 2.00 + 0.75 + 1.88) = 0.0276 (Out [22]), and says the
   loss and the metric differ because add_loss adds the KL to the loss only.
5. Stride-1 windows → 2·2 (as planned) plus: shuffling reorders rows, never the months inside a row; "sequence 566"
   is a row index, not a date; the x axis is position in the window, not calendar month.

Other confusions to answer in plate text (owner in brackets):
- (A) why the same seed can still differ on a GPU (non-deterministic op order); "kernel" means three things.
- (A/2·2) 396 − 84 + 1 = 313, 392 − 96 + 1 = 297, 904 + 309 + 309 = 1522; ~1770 distinct months; overlap check drawn.
- (lead/3·1) months 85–96 of window i turn up as input months of later test windows — harmless, since nothing is
  trained on the test set; "no model sees them" holds per window.
- (B/5·1) saturation → tiny gradients; z-scores; Normalization has 0 params (fixed, not trained), variance = STD²,
  invert computes x·std + mean; MEAN/STD from X_train's 72 months (hence 24.69 here vs the VAE's 24.70 over 84).
- (B/5·2) every run stops exactly 20 epochs after its best (46→66, 20→40, 30→50, 23→43).
- (B/5·3 NEW "Reading a learning curve") training loss is averaged over the epoch's 48 batches while the weights
  change, validation is measured once at the end on Swanbourne; why validation starts below training; MSE in °C²
  vs MAE in °C (model 1: val_loss 1.5473 vs val MAE 0.988); the loss axis running to 12 hides the detail.
- (C/6·1) 960 = 3 × (16·2 + 16·16 + 2·16) (concept checker to confirm); (C/6·2) "(None, None, 2)" = batch, time;
  144 numbers → 16; Dense(24) → Reshape(12, 2) puts min/max in alternating slots; MSE vs MAE units.
- (C/7·x) Reshape (1, 2) keeps a time axis so the prediction can be concatenated onto the window; one-month test
  1.188 vs model 1's 1.250 (why one month ahead is not much easier: noise floor); validation vs test ordering.
- (D/8·1) "Connected to" notation: encoder_gru1[0][1] = first call, second output = the state; for a GRU the last
  output equals the final state; what a GRU starts from without initial_state (zeros).
- (E/9·1) climatology works because 72 = 6 × 12, so position i lines up with i + 12; ceil-division idiom; tile.
- (F/10·1) why max only (the brief) and why the VAE scales outside the model.
- (F/11·x) input = target (`train_model(vae, z_train, z_train, …)`); why log-variance; "nats"; KL per month then halved.
- (F/12·1) "sequence k" in the VAE figures is a plot index, not a data row; samples' spread of means is 0.62 vs
  0.56 (slightly MORE spread, not less); the flattest sample (range 1.8) is described but not plotted.

## 7. Corrections from the concept checker (Keras 3.15.1 source + tiny runs; slides)

No blocking errors. Builders must apply these where they touch their plates:

- GRU (6·1): Keras default `reset_after=True`: g(t) = tanh(x(t)·Wxg + bxg + r(t) ⊗ (h(t−1)·Whg + bhg)) — r scales the
  recurrent product, two biases per block. Parameter count = 3 × (units·input_dim + units² + 2·units): 960, 1,632;
  Dense(24) 408, Dense(2) 34 (verified by building the layers). Say "3 blocks (z, r, g)", not "3 gates". z weights
  the OLD state (gru.py: `h = z * h_tm1 + (1 - z) * hh`), as on slide 49. reset_after=False would give 912.
- return_state (8·1): with return_sequences=True and return_state=True a GRU returns (sequence (N, T, 16), state
  (N, 16)) and `seq[:, -1] == state`; with only return_state it returns (out, state) with out == state. Summaries
  print (None, None, 16); with 72 input months that is (N, 72, 16) — say both. `encoder_gru1[0][1]` = first call,
  second output = the state.
- 8·3 label: "teacher-forcing optimism (+0.216)", not "exposure bias" — the gap mixes exposure bias with the plain
  difficulty of forecasting months 74–84 without knowing 73–83 (cell 33: "optimistic by about 0.2 degrees").
  +0.143 (1.321 − 1.178) = the Swanbourne → Bickley shift. "Within 0.04" (cell 33) is 0.04 °C of MAE, not epochs.
- 7·1: use the notebook's own five-seed figures (cell 22: one-month ≈ 0.88 vs 0.90, rolled out ≈ 1.01 vs 1.04, and
  model 1 "fell apart at 0.01"); if the log's two-seed grid is drawn, label it "tuning log, two-seed means".
- 5·1: don't reuse "z" for z-scores (z is the GRU update gate and the VAE codings) — use x̃ or "z-score". It is the
  pre-activation x·W + h·U + b that tanh (and the sigmoid gates) see; with raw °C inputs it saturates. Label that
  part "schematic". Normalization: forward (x − mean)/√var, invert = mean + x·√var; 0 weights; 5–36 °C → about
  −1.9…2.2 (checker's round trip).
- 5·2: pass `what="teacher-forced validation loss"` for model 3 and `what="total validation loss (reconstruction +
  weighted KL)"` for the VAE. stop = best + patience for all four (66/46, 40/20, 50/30, 43/23); Keras 3 restores the
  best weights in on_train_end (would also apply at the epoch cap, which no model hit).
- 9·1: seasonal naive = "copies the last 12 input months and tiles them" — the "same month one year earlier" wording
  (cell 36) only holds for lead months 1–12; for leads 13–24 it is two years earlier.
- 11·3: say "×1, ×½, ×¼ the per-month weight" rather than "β" (against a unit-variance Gaussian likelihood the
  notebook's 1/84 would itself be β = 0.5). Call the encoder's N(μ, σ²) "the encoder's distribution (approximate
  posterior q(z|x))". Dead dimension = KL 0 = that distribution equals the prior for every input (KL ≥ 0).
  0.067 + (0.5/84) × 4.63 = 0.0946 ≈ val_loss 0.0950 (the checker's reconciliation).
- 12·2: the results critic's r = 0.93/0.92 check is NOT in the notebook (cell 49: "I have not checked this") —
  either leave it out or label it "a later check, not part of the submitted notebook (handover)".
- 1·1: list four random sources (initial weights, shuffle order, VAE ε, NumPy display draws), not "three".
- Already applied by the lead before handing over: GruCell (z-scores, reset_after note, candidate caption, z
  computed alongside r), EncDec (one forward pass, exposure-bias wording, "passed to the decoder"), Reparam (whisker
  and gradient-path wording), EarlyStop ("but not validation loss"), StationMap ("never used for training or model
  choices").
