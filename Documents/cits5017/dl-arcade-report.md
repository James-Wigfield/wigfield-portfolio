# Gradient Arcade — build report (2026-10-22 → 2026-10-23)

Branch `feat/dl-arcade` (not pushed, not merged). Module: Deep Learning → **Gradient Arcade** (`dl-arcade`), `src/components/portal/modules/deep-learning/arcade/`. Routes `/portal/dl-arcade`, `/portal/dl-arcade/mix`, `/portal/dl-arcade/exam`, `/portal/dl-arcade/<gameId>`. Build brief: `Documents/temp/prompt-dumping/build_dl_arcade.md`.

## What was built

**The hub.** A marquee, a profile strip (level + XP bar, daily streak, concepts due today, overall mastery ring), two big cabinets (Daily Mix, Exam), one cabinet per game (marquee colour, procedural glyph, lectures, level pips, personal best, mastery ring, "n due"), and a mastery panel with a ring per lecture and a concept list behind a toggle. Progress is in localStorage under `dla:*` (versioned, every read/write in try/catch, renders with storage throwing) behind `core/storage.js`, shaped as a repository so it can move to Supabase.

**Spaced repetition.** `core/concepts.js` merges the slide readers' catalogues: 253 concepts across the seven decks, each with lecture and slides. `core/scheduler.js` is a Leitner scheduler (boxes 1–5, intervals 0/1/2/4/8 days, unit-tested: 12 tests). Daily Mix = 4 rounds of 60 s seeded by the date, weighted to due/weak concepts, resumable. Exam = 8 rounds of 75 s across every game, graded per lecture (HD/D/CR/P/N), unlocked after 3 different games. XP, levels, streaks, personal bests per game and level, level unlocks at ≥ 70 %.

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

Each game: `games/<id>/` (manifest, component, CSS), `content/<id>.js` (pure data, every item with `src`), `maths/<id>*.js` (pure, seeded generators), `tools/dl-arcade/check-<id>.mjs` (fidelity + 30 seeded rounds per level).

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

Nothing numerical was wrong in any game; the wrongs were distractors that were true, wording, citations and one scenario that contradicted a slide's claim.

## Keras-truth result

`tools/dl-arcade/keras_truth.py` (TensorFlow 2.21.0, Keras 3.15.1, Python 3.12, WSL `Ubuntu` env `tf-2.20-gpu`, CPU forced) → `keras-truth.json`: **2,330 seeded configs** across Dense, Conv2D, Conv2DTranspose, Max/AvgPool2D, GlobalAvgPool2D, Flatten, Reshape, BatchNormalization, Dropout, SimpleRNN, LSTM, GRU (both `reset_after`), Bidirectional, Conv1D (valid/same/causal), MultiHeadAttention, Embedding, DenseTranspose. `check-maths.mjs`: **2,330/2,330 counts and shapes match (100 %)**, 21/21 slide anchors, 0 slide-vs-Keras disagreements. Every number printed on the slides (266,610; 271,346/268,978/2,368; 15,200; 3; 1,121; 685; 1,401; 1,283; 163,814; 82,414; 13,873; 54,479; 674; 768) is reproduced. GRU: 1,401 needs Keras's two biases per block; the slide's one-bias equations give 1,341; the game teaches 1,401 and says so.

## Verification

`node tools/dl-arcade/arcade-check.mjs` (puppeteer-core + local Edge, seeded through the gate): unit tests; hub; every cabinet opens its game and back/forward work; every deep link; a scripted bot plays one round of every game at every level with right and wrong answers (onRoundEnd once, why cards with receipts, no KaTeX errors); Daily Mix and Exam end to end (grade per lecture); the scheduler promotes concepts; persistence; broken localStorage; reduced motion; 54 screenshots (hub + 8 games × jade/coral/arcade × 1440/390, no horizontal scroll); Lectures 3–8 study pages and Scrolls · 3D still render; zero console errors or warnings. `npm run build` passes; `npx eslint src/components/portal/modules/deep-learning/arcade tools/dl-arcade` is clean; every `check-*.mjs` passes.

## Decisions I made

- **Agents.** Slide readers and the maths verifier ran on the default model; after the owner's mid-run note, builders, checkers and fixers ran on Opus 5.5 and the six cut-off builders were relaunched fresh (they had only read, not written).
- **No pixel art.** Everything is procedural SVG/canvas; the PixelLab budget was left untouched. Art remains optional polish.
- **Descent is 2D SVG,** not three.js: a contour map with the slides' update rules is verifiable and works at 390 px; the R3F game precedent was left alone.
- **Contract extras, all additive:** `host` carries `onLevelChange`, `levels`, `unlocked`, `onReplay`, `onContinue`, `exitLabel`; DEV-only `window.__dla` (round hook) and `window.__dlaGames`; `?seed=&level=&ms=` on a game route in DEV.
- **Scoring:** 10 + 2·min(combo − 1, 5) per right answer; maxScore = a perfect run; items not reached are not recorded; feedback window 0.52 s.
- **Scheduler:** per round, a concept with any wrong answer drops one box (never below 1), all right rises one; weights 4/4/3/2/1/0.5 by box, ×2 when due; mastery = mean (box − 1)/4. XP = round(100·accuracy·(1 + 0.5·(level − 1))) + 25 for a best; level n at 50·n·(n − 1) XP; next game level at ≥ 70 %; Exam after 3 distinct games; mix seeded by the date so it is the same mix all day and can be replayed when done.
- **Mix/Exam flow:** a round shows its results and why cards; Continue advances; the header's "arcade" pauses the run (resumable).
- **Concept ids:** readers' ids were kept (e.g. `bn.params`, not `params.bn`); the catalogue keeps per-lecture slide lists and records a concept's other lectures under `also`.
- **Param Sniper:** Keras 3 defaults are stated in the intro; MHA and single-layer Conv1D items are marked beyond (no slide prints their rule); Dropout only appears inside marked stacks; BN inside stacks follows the slides' flattened placement.
- **The Exchange:** patch grading = brightest plug on the real argmax and L1 ≤ 0.6 over three brightness levels; the toy's single layer, head-averaged; every board says the weights are the page's own toy; the causal-mask answer includes the word itself with distractors wrong under either slide reading.
- **Per-game builder decisions** (details in each audit and the builders' notes): Descent par = fewest steps into the cup with a ≥ 20 % margin, clubs limited per hole so the slides' stories hold, AdaMax/Nadam/AdamW are question items not clubs, ε = 10⁻¹⁰ reused from slide 38; Kernel Rush only generates sizes the slides' examples explain and skips the slide-35 Fashion stack (default pool size unstated); Long Line levers reset at each station, one unit, "gate r" (the slides never name it); Bottleneck plane controls are tilts along x1/x2, map items are the ten validation images; Latent Surfer steers the two most relevant of ten dimensions with the rest held at the target's μ; Chain Reaction uses a linear output with the slide-11 loss so ŷ − y is slide-backed, and marks chain-rule steps beyond.
- **Dev server:** a Vite server was already running on 5173 from an earlier session; I used it and left it running rather than kill another session's process.

## Known issues

- The kit's 0.52 s feedback window cuts some stage reveals short (Kernel Rush receptive-field comparison, Latent Surfer reveals, Long Line); the why cards carry the explanation.
- At 390 px: Kernel Rush's two-row stage pushes the keypad below the fold; some SVG labels in Chain Reaction, Long Line and Descent's dial are about 10 px.
- Descent's RMSProp step count on long-valley holes is numerically fragile (the winner never changes).
- Bottleneck's map pool covers six of the ten classes; two images are reasonably readable as another class (graded by the dataset label).
- The hub's concept panel does not yet show a concept's `also` lectures.
- Visual QA (`tools/dl-arcade/QA-visual.md`, 54 screenshots): fixed afterwards — kit styles now load with the hub (buttons were unstyled on a cold load), cabinet marquees are tinted with ink titles (contrast in all themes), the round bar wraps into two rows at 390 px, the keypad sticks to the bottom at 390 px, The Exchange's board no longer shrinks its labels, Param Sniper's firing-line label moved off the line, in-game level badge reads "lvl n" (L1–L8 are lectures on the hub). Still open from that review: Bottleneck's map uses the study page's four colour groups for ten classes and its item thumbnail is tinted; Long Line's level-1 loop arc has a loose end; Chain Reaction's weight labels sit on their lines; Kernel Rush's small kernel cube at the top-left is unlabelled; some stages are tall at 390 px so game-specific controls (Lock in, Depart, Swing) can sit below the first screen; games pick some of their own in-stage colours rather than only the L8 role tokens.
- See `accuracy/re-audit.md` for the final re-audit.

## What's left

- **Batch 2 (stretch, not started):** Boundary Bash, Signal Keeper, Forger, Forecast Desk, Block Builder, Wave Stamp, Overfit Clinic. The kit, contract, checker brief and builder brief (`tools/dl-arcade/BRIEF-*.md`) are ready for them; add a manifest line in `core/games.js`.
- Optional pixel-art marquees/mascot into `public/dl-arcade/`.
- Moving `core/storage.js` to Supabase.
