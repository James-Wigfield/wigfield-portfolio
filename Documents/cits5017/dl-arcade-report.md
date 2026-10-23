# Gradient Arcade — build report (2026-10-22 → 2026-10-23)

Branch `feat/dl-arcade` (not pushed, not merged). Module: Deep Learning → **Gradient Arcade** (`dl-arcade`), `src/components/portal/modules/deep-learning/arcade/`. Routes `/portal/dl-arcade`, `/portal/dl-arcade/mix`, `/portal/dl-arcade/exam`, `/portal/dl-arcade/<gameId>`. Build brief: `Documents/temp/prompt-dumping/build_dl_arcade.md`.

## What was built

**The hub.** A marquee, a profile strip (level + XP bar, daily streak, concepts due today, overall mastery ring), two big cabinets (Daily Mix, Exam), one cabinet per game (marquee colour, procedural glyph, lectures, level pips, personal best, mastery ring, "n due"), and a mastery panel with a ring per lecture and a concept list behind a toggle. Progress is in localStorage under `dla:*` (versioned, every read/write in try/catch, renders with storage throwing) behind `core/storage.js`, shaped as a repository so it can move to Supabase.

**Spaced repetition.** `core/concepts.js` merges the slide readers' catalogues: 253 concepts across the seven decks, each with lecture and slides. `core/scheduler.js` is a Leitner scheduler (boxes 1–5, intervals 0/1/2/4/8 days, unit-tested: 12 tests). Daily Mix = 4 rounds of 60 s seeded by the date, weighted to due/weak concepts, resumable. Exam = one 75 s round per game (15 rounds now; never fewer than 6), graded per lecture (HD/D/CR/P/N), unlocked after 3 different games. XP, levels, streaks, personal bests per game and level, level unlocks at ≥ 70 %.

**The kit.** `kit/useRound.js` (intro → play → results, combo scoring, a dev-only bot hook), `RoundShell` (bar with timer/score/combo/mute, intro with level switcher, juice, results), `Keypad`/`ShapePad`, `Choice`, `Results` + `WhyCard` (correct answer, one or two sentences in the slides' notation, receipt "Lecture 4 · slide 43", a "beyond the slides" marker), `Maths` drawer, WebAudio synth SFX with a mute toggle. Reduced motion disables every animation.

**Batch 1 — all eight games, one line each (how to play):**

| Game | Lecture(s) | How to play |
|---|---|---|
| **Param Sniper** | 1–8 | A layer spec slides towards the firing line; enter its Param # (4 choices at level 1, keypad after) or its output shape; level 3 is the slides' own `model.summary()` totals and trainable vs non-trainable. |
| **The Exchange** | 8 | A switchboard: choice items on the one-cable bottleneck, then patch the decoder's query into the English keys (plug brightness = weight) graded against the toy transformer's real cross-attention; level 2 Bahdanau vs Luong arithmetic; level 3 √d_keys, the causal mask, the multi-head pipeline, self vs cross. |
| **Descent** | 2 | Optimiser golf: predict which club makes par on a contour map, then swing by the slides' update rules against the par club's ghost; equation, clipping and schedule items between holes. |
| **Kernel Rush** | 3 | A conv or pooling spec drops onto the input block: size the output H × W × C on the ShapePad before it lands, then the bonus parameter count; stacks and receptive fields at level 3. |
| **The Long Short-Term Line** | 4 | Run a memory cell as a cargo train: set f/i/o (LSTM) or z/r (GRU) at each station so cargo loaded early arrives many stations later; SimpleRNN at level 1 shows the fade. |
| **Bottleneck** | 5 | Tilt a plane through the point cloud to the PCA plane; build a sandwich within a budget then tie the weights and count; order the training phases; drop an item on the t-SNE map. |
| **Latent Surfer** | 6–7 | Steer two of the page's own VAE decoder's ten coding dimensions to match a target; catch μ + exp(γ/2)·ε; pick the interpolation midpoint; compute the γ-form latent loss. |
| **Chain Reaction** | 1 | A 2 → 2 → 1 MLP graph: fill forward-pass values, collapse the activations to one linear layer, fill the backprop gradients before the fuse burns out, pick output layer + loss for task cards. |

**Batch 2 — all seven stretch games, built in the brief's order after Batch 1 was closed out:**

| Game | Lecture(s) | How to play |
|---|---|---|
| **Boundary Bash** | 1 | One TLU's boundary against incoming points: say which way the Perceptron rule moves it, then apply the update by hand (shown, hidden and trap values); level 3 runs XOR forward and shows why it needs a hidden layer. |
| **Signal Keeper** | 2 | A deep stack with a live forward/backward signal: pick the init, the activation, then SELU/ELU/leaky ReLU, BatchNorm by hand (counts, normalisation) and clipping so the layer-1 gradient stays healthy. |
| **Forger** | 6–7 | A GAN's two training phases in the right order on the page's own toy GAN, spot mode collapse or instability in a live run, build a DCGAN by the slide-28 rules; shapes and counts at level 3. |
| **Forecast Desk** | 4 | Bus/rail forecasting: copy last week, score MAE and MAPE from the table, window the series into batches and shapes, then choose the model that beats the 7-day baseline; multivariate and multi-step at level 3. |
| **Block Builder** | 3 | Name a CNN from its parts, stack its blocks bottom-up, fill the gaps in the slides' tables: LeNet-5, AlexNet, GoogLeNet, VGG, ResNet, SENet, Xception and the fine-tuning order. |
| **Wave Stamp** | 8 | Match sinusoidal positional-encoding barcodes to positions (slide 32), then base 1000 vs 10,000 and the code's embed_size, then chop an image into ViT patches. |
| **Overfit Clinic** | 1–6, 8 | The exam boss: diagnose a sick model from its curves, summary or samples, prescribe the fix the slides name, then answer the follow-up; 23 cases, 12 follow-up types. |

Each game: `games/<id>/` (manifest, component, CSS), `content/<id>.js` (pure data, every item with `src`), `maths/<id>*.js` (pure, seeded generators), `tools/dl-arcade/check-<id>.mjs` (fidelity + 30 seeded rounds per level).

**Pixel art (PixelLab, trial plan).** 24 sprites in `public/dl-arcade/`: a hub mascot, one 48 px icon per cabinet (15) and eight in-game pieces (train loco, wagon and crate for The Long Short-Term Line; golf ball and flag for Descent; spec card and sight for Param Sniper; the surfer for Latent Surfer). `core/art.js` exposes `useSprite(name)`: it probes the PNG once, caches the result and returns the URL only after the image has loaded, so every component keeps its procedural SVG while loading or when a file is missing. Sprites render with `image-rendering: pixelated`; the mascot bobs unless reduced motion is on. Generation used `create_image_pixen` (1 generation each; Pro Flash costs 5), one job at a time, with the prompt skeleton "pixel art game icon … flat shading, single colour dark outline, limited palette of teal, orange, navy and cream; centred, clean silhouette; no machine, no text" and `no_background: true`. 28 of the trial's 40 generations are used (12 remain); two cabinet icons were regenerated after the words "arcade cabinet" produced machines instead of symbols.

## Accuracy summary

Per-game audits by fresh agents (`tools/dl-arcade/accuracy/<id>.md`), then a whole-arcade re-audit (`accuracy/re-audit.md`). Every WRONG was fixed and re-checked; every NOT IN SLIDES was removed, re-cited or marked `beyond`.

| Game | Claims checked | Wrong found → fixed | Not in slides → fixed | Blind-solved items | Marked `beyond` |
|---|---|---|---|---|---|
| Param Sniper | 41 | 7 (unfair GRU distractor; citation slips; catalogue merge) | 2 | 73/73 | MHA count; Conv1D per-layer rule; Dropout |
| The Exchange | 42 | 0 | 0 | 32/32 | none |
| Kernel Rush | 36 | 4 (a drawer gap for stride-2 pooling; 3 citations) | 0 | 68/68 (+10,800 by solver) | none |
| The Long Short-Term Line | 43 | 1 (a fade question false on the game's own run) | 1 | 85/85 | the toy cell's ±6 biases |
| Bottleneck | 38 | 3 (a true "distractor"; t-SNE wording; diagram colour) | 1 | 84/90 (6 = label ambiguity on the map) | MSE formula, plane pinned to the mean, t-SNE axes |
| Latent Surfer | 44 | 0 | 2 (linspace end-points → marked beyond) | 75/75 | linspace end-points; the N(0, 1) target reading |
| Chain Reaction | 43 | 0 | 2 (wording) | 62/62 | chain-rule steps and tanh/ReLU derivatives (4 item types) |
| Descent | 71 | 3 (bowls where momentum lost to SGD; the slide-58 curve; a citation) | 3 | 82/82 | the six-club bowl ranking |
| Boundary Bash | 30 | 2 (a "never settles" premise false under the game's own rule; a "separated" banner true in only 58 % of batch switches) | 0 | 58/58 (+43,500 by solver) | none |
| Signal Keeper | 45 | 1 (a clipnorm why for ‖g‖ ≤ 1 said "scaled" for an unchanged g) | 1 ("only if" → "if" for SELU) | 68/68 (+90,000 by solver) | clipnorm by hand |
| Forger | 63 | 2 (a concept tag; a code caption citing slide 29 for slide 25's line) | 0 | 70/70 (+54,000 by solver) | none |
| Forecast Desk | 38 | 2 (a 3-D input drawer line shown on target shapes; a `valid_ds` claim) | 0 | 73/73 (+48,000 by solver) | none |
| Block Builder | 49 | 2 (a slide 41/42 citation; "as slide 39 prints it" with a hidden column) | 1 (the four-branch reading of inception's top numbers → marked beyond) | 58/58 (+17 table cells) | GoogLeNet depth-concat sums |
| Wave Stamp | 44 | 1 (the caption items showed the ViT patch picture) | 1 (radians) | 72/72 (+54,000 by solver) | ViT patch counts |
| Overfit Clinic | 56 | 1 (ReLU offered as a wrong fix for GAN instability) | 0 | 91/91 (+3,000 EarlyStopping runs) | none |

Nothing numerical was wrong in any game; the wrongs were distractors that were true, wording, citations and one scenario that contradicted a slide's claim. The checkers' AMBIGUOUS rows that affected scoring were fixed too (Forger's phase-2 recipe is graded by the labels the rows actually get; Forecast Desk's "batch k" says it counts from 0 like slide 21; Overfit Clinic's avoid lists keep "a smaller learning rate" and Dropout out of the GAN and big-batch distractor pools). The whole-arcade re-audit (`accuracy/re-audit.md`) predates Batch 2: those seven games carry their per-game audit only.

## Keras-truth result

`tools/dl-arcade/keras_truth.py` (TensorFlow 2.21.0, Keras 3.15.1, Python 3.12, WSL `Ubuntu` env `tf-2.20-gpu`, CPU forced) → `keras-truth.json`: **2,330 seeded configs** across Dense, Conv2D, Conv2DTranspose, Max/AvgPool2D, GlobalAvgPool2D, Flatten, Reshape, BatchNormalization, Dropout, SimpleRNN, LSTM, GRU (both `reset_after`), Bidirectional, Conv1D (valid/same/causal), MultiHeadAttention, Embedding, DenseTranspose. `check-maths.mjs`: **2,330/2,330 counts and shapes match (100 %)**, 21/21 slide anchors, 0 slide-vs-Keras disagreements. Every number printed on the slides (266,610; 271,346/268,978/2,368; 15,200; 3; 1,121; 685; 1,401; 1,283; 163,814; 82,414; 13,873; 54,479; 674; 768) is reproduced. GRU: 1,401 needs Keras's two biases per block; the slide's one-bias equations give 1,341; the game teaches 1,401 and says so.

## Verification

`node tools/dl-arcade/arcade-check.mjs` (puppeteer-core + local Edge, seeded through the gate): unit tests; hub; every cabinet opens its game and back/forward work; every deep link; a scripted bot plays one round of every game (15) at every level with right and wrong answers (onRoundEnd once, why cards with receipts, no KaTeX errors); Daily Mix and Exam end to end (15 exam rounds, a grade over 7 lectures); the scheduler promotes concepts; persistence; broken localStorage; reduced motion; 96 screenshots (hub + 15 games × jade/coral/arcade × 1440/390, no horizontal scroll); Lectures 3–8 study pages and Scrolls · 3D still render; zero console errors or warnings. `npm run build` passes; `npx eslint src/components/portal/modules/deep-learning/arcade tools/dl-arcade` is clean; every `check-*.mjs` passes.

## Decisions I made

- **Agents.** Slide readers and the maths verifier ran on the default model; after the owner's mid-run note, builders, checkers and fixers ran on Opus 5.5 and the six cut-off builders were relaunched fresh (they had only read, not written).
- **Pixel art is polish, never a dependency.** Batch 1 shipped fully procedural; after the owner chose "hub and in-game" art, sprites were added behind `useSprite` with the SVG kept as the fallback (a missing or slow PNG changes nothing). The trial plan's budget set the scope: cabinet icons and a mascot first, in-game pieces only where a sprite reads better than the SVG at 48 px.
- **Descent is 2D SVG,** not three.js: a contour map with the slides' update rules is verifiable and works at 390 px; the R3F game precedent was left alone.
- **Contract extras, all additive:** `host` carries `onLevelChange`, `levels`, `unlocked`, `onReplay`, `onContinue`, `exitLabel`; DEV-only `window.__dla` (round hook) and `window.__dlaGames`; `?seed=&level=&ms=` on a game route in DEV.
- **Scoring:** 10 + 2·min(combo − 1, 5) per right answer; maxScore = a perfect run; items not reached are not recorded; feedback window 0.52 s.
- **Scheduler:** per round, a concept with any wrong answer drops one box (never below 1), all right rises one; weights 4/4/3/2/1/0.5 by box, ×2 when due; mastery = mean (box − 1)/4. XP = round(100·accuracy·(1 + 0.5·(level − 1))) + 25 for a best; level n at 50·n·(n − 1) XP; next game level at ≥ 70 %; Exam after 3 distinct games; mix seeded by the date so it is the same mix all day and can be replayed when done.
- **Mix/Exam flow:** a round shows its results and why cards; Continue advances; the header's "arcade" pauses the run (resumable).
- **Concept ids:** readers' ids were kept (e.g. `bn.params`, not `params.bn`); the catalogue keeps per-lecture slide lists and records a concept's other lectures under `also`.
- **Param Sniper:** Keras 3 defaults are stated in the intro; MHA and single-layer Conv1D items are marked beyond (no slide prints their rule); Dropout only appears inside marked stacks; BN inside stacks follows the slides' flattened placement.
- **The Exchange:** patch grading = brightest plug on the real argmax and L1 ≤ 0.6 over three brightness levels; the toy's single layer, head-averaged; every board says the weights are the page's own toy; the causal-mask answer includes the word itself with distractors wrong under either slide reading.
- **Per-game builder decisions** (details in each audit and the builders' notes): Descent par = fewest steps into the cup with a ≥ 20 % margin, clubs limited per hole so the slides' stories hold, AdaMax/Nadam/AdamW are question items not clubs, ε = 10⁻¹⁰ reused from slide 38; Kernel Rush only generates sizes the slides' examples explain and skips the slide-35 Fashion stack (default pool size unstated); Long Line levers reset at each station, one unit, "gate r" (the slides never name it); Bottleneck plane controls are tilts along x1/x2, map items are the ten validation images; Latent Surfer steers the two most relevant of ten dimensions with the rest held at the target's μ; Chain Reaction uses a linear output with the slide-11 loss so ŷ − y is slide-backed, and marks chain-rule steps beyond.
- **Batch 2 builder decisions:** Boundary Bash uses slide 10's weight-only rule with a fixed bias and heaviside units for XOR (the only slide-5 step that gives slide 17's outputs), and its batch banner says "new batch" rather than "separated"; Signal Keeper's verdicts come from a real forward/backward simulation (`maths/signalKeeperSim.js`) and sigmoid is kept out of every stack scene because the sim's sigmoid-on-Glorot ratio would contradict Table 11-1 on screen; Forger grades the recipe by the labels each row actually receives and runs the page's own toy GAN for the collapse/diverse/unstable verdicts; Forecast Desk reproduces slide 18's four printed numbers to 6 dp and takes slide 24's 3-D input reading over slide 21's 2-D minibatch (a transcript quirk); Block Builder fills cells only from the printed tables (slides 37, 39, 43), infers LeNet's "valid" padding from 32 → 28 and marks the inception depth-concat sums beyond; Wave Stamp reads the code's `embed_size` as slide 32's d and marks the ViT patch counts beyond; Overfit Clinic's distractor pools are built from per-fix `treats`/`avoid` lists so no slide-allowed fix is ever a wrong answer, and its EarlyStopping stop epoch (argmin validation + 10, slide 52) agrees with a Keras-style simulation on 3,000 runs.
- **Dev server:** a Vite server was already running on 5173 from an earlier session; I used it and left it running rather than kill another session's process.

## Known issues

- The kit's 0.52 s feedback window cuts some stage reveals short (Kernel Rush receptive-field comparison, Latent Surfer reveals, Long Line); the why cards carry the explanation.
- At 390 px: Kernel Rush's two-row stage pushes the keypad below the fold; some SVG labels in Chain Reaction, Long Line and Descent's dial are about 10 px.
- Descent's RMSProp step count on long-valley holes is numerically fragile (the winner never changes).
- Bottleneck's map pool covers six of the ten classes; two images are reasonably readable as another class (graded by the dataset label).
- The hub's concept panel does not yet show a concept's `also` lectures.
- Visual QA (`tools/dl-arcade/QA-visual.md`, 54 screenshots): fixed afterwards — kit styles now load with the hub (buttons were unstyled on a cold load), cabinet marquees are tinted with ink titles (contrast in all themes), the round bar wraps into two rows at 390 px, the keypad sticks to the bottom at 390 px, The Exchange's board no longer shrinks its labels, Param Sniper's firing-line label moved off the line, in-game level badge reads "lvl n" (L1–L8 are lectures on the hub). Still open from that review: Bottleneck's map uses the study page's four colour groups for ten classes and its item thumbnail is tinted; Long Line's level-1 loop arc has a loose end; Chain Reaction's weight labels sit on their lines; Kernel Rush's small kernel cube at the top-left is unlabelled; some stages are tall at 390 px so game-specific controls (Lock in, Depart, Swing) can sit below the first screen; games pick some of their own in-stage colours rather than only the L8 role tokens.
- Final re-audit (`accuracy/re-audit.md`, independent second pass over the whole arcade): 126 claims, 110 VERIFIED, 6 WRONG, 1 NOT IN SLIDES, 9 AMBIGUOUS; blind samples 80/80 (10 per game); 61 sampled catalogue concepts all correct. All six wrongs and the hub findings were then fixed and re-checked: Chain Reaction's tanh step is graded against two keys at ±0.01 (the exact z-based value and the shown-h value) and never at z = 0; The Exchange's mask distractors are wrong under both slide readings; Descent's six-club note quotes Table 11-2 (slide 47), its performance chart matches slide 58 exactly and valley holes are kept only if the par club survives gradient noise; Param Sniper's return_sequences shapes are marked beyond and the GRU wording names Keras's two-bias GRU; Bottleneck's duplicate distractor and φ(XW + bᵀ) wording; Latent Surfer's wiring citation; the hub counts due and mastery over the 86 concepts the games drill (the catalogue's other 167 are not yet drilled), says "Lectures 6–7", and the exam grades each answer under the lecture of its slide receipt.
- Batch 2, from the builders' notes and screenshots: 60 s is tight for Overfit Clinic's chart items (read a curve, diagnose, prescribe, follow up); Block Builder's AlexNet table is tight at 390 px; Wave Stamp's ViT patch labels are small at 390 px; Boundary Bash level 2 asks for the hidden update, which needs scratch arithmetic within the timer. A full Exam is now 15 × 75 s, about 19 minutes.
- Pixel art: the trial plan has 12 generations left, so Bottleneck, Kernel Rush, Chain Reaction, The Exchange and the Batch 2 games have cabinet icons only (no in-game pieces); the sprites were reviewed on screen but not by a fresh visual QA pass.

## What's left

- All fifteen games from the brief are built, audited and verified; nothing is pushed or merged (`feat/dl-arcade`, 50 commits, James reviews).
- A whole-arcade re-audit over Batch 2 (the Batch 1 one is in `accuracy/re-audit.md`); a fresh visual QA pass over the 96 screenshots with the sprites in place.
- The hub's concept panel could show a concept's `also` lectures, and the 167 catalogue concepts no game drills yet are a pool for future games or a flash-card mode.
- Moving `core/storage.js` to Supabase; the remaining 12 PixelLab generations (in-game pieces for the games that have cabinet icons only).
