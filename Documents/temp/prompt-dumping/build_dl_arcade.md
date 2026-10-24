# Build: CITS5017 Deep Learning — Gradient Arcade (a set of mini games)

## Read this first: you are running unattended

I'm leaving my computer on overnight while you build this. **I will not be here to answer anything.**

- **Never stop to ask me a question.** Don't use AskUserQuestion, don't wait for plan approval, and don't pause between phases for a review. When something is ambiguous, choose the conservative option that keeps the slides accurate, write it down in the report's "Decisions I made" list (see the end), and keep going.
- **If something is blocked** (a tool fails, WSL won't start, a PixelLab job hangs), work around it or degrade gracefully, log it, and move on to the next piece of work. One broken game must not stop the other games.
- **Keep working until everything below is finished and verified,** or until you have genuinely run out of things that can be done.
- **Use subagents freely** (see "Subagents"). You are the lead: you own the plan, the shared kit, the registry entry, the git history and the final report.

---

## What you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section in the sidebar with interactive lecture modules, study modules and a 3D game.

I want a new module called **Gradient Arcade**. It's a hub of short, replayable **mini games**, and each one drills one of the unit's hardest concepts. The hub ties them together with spaced repetition, a daily mix, mastery per lecture, streaks and personal bests, so I keep coming back.

The goal is **exam revision**. A game earns its place by making me *produce* answers under light pressure: set the gate, size the output, count the parameters, pick the fix. Watching an idea is what the study modules are for. Every fact, number, formula and piece of feedback in this arcade must be **correct and traceable to a lecture slide**. Accuracy is the top priority, above polish and above game count.

---

## Where things are

| What | Path |
|---|---|
| Lecture slides (THE source of truth) | `Documents/cits5017/lectures/*.pdf` (lect01 … lect08; Lectures 6–7 share one deck) |
| Markdown transcripts (slide by slide, with figures and "Quirks" sections) | `Documents/cits5017/markdown-lecs/lecture-{1,2,3,4,5,6-7,8}.md`. **`lecture-3.md` stops at slide 16**: use the PDF for the rest of Lecture 3. |
| Portal shell (don't edit) | `src/components/portal/Portal.jsx` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Deep links | `src/components/portal/portalRoute.js`: `usePortalRoute()` gives `{ sub, setSub }` for `/portal/<toolId>/<sub>` |
| Themes (jade, coral, arcade) | `src/components/portal/themes.js` |
| Deep Learning modules | `src/components/portal/modules/deep-learning/` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css` (`Tex` via KaTeX, `Hook`, `Fact`, `Unfold`, `Note`, `Code` …), `common.css` (`--dlv-*` palette) |
| Stage-first lab kit (the current visual standard) | `.../deep-learning/lecture8-study/`: `stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`, `useWidth.js`, `stage.css` (role-colour tokens tuned for all 3 themes) |
| Existing 3D game (R3F precedent; leave it alone) | `.../deep-learning/game/` (vault note: `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\wigfield-portfolio-dl-game.md`) |
| Headless check precedent | `tools/dl-lecture8-study/page-check.mjs` (puppeteer-core + local Edge, seeded through the portal gate, `window.print` stubbed), `tools/dl-game-check.mjs` |

### Reusable maths and live models (import them; don't fork them unless you must)
These are pure, already checked, and run in the browser. If you need a change, copy the file into the arcade and adapt the copy. **Never edit the originals.**

| File | What it gives you |
|---|---|
| `lecture8-study/attn.js` | softmax, weighted sum, Bahdanau align score, Luong dot/general/concat, scaled dot-product attention with shapes, causal mask, split/concat heads, positional encoding (slide 32's base 1000 *and* slide 35's code base 10 000), ViT patches, Keras param counts |
| `lecture8-study/toyMT.js` + `data/toyMT.js` | a toy English→Spanish Transformer run in plain JS: `loadToyMT()`, `translate()`, real attention weights |
| `lecture8-study/data/busrail.js` | the bus/rail series |
| `lecture4-study/rnn.js` | SimpleRNN/LSTM/GRU steps in the slides' row-vector notation, Keras parameter counts, `timeseries_dataset_from_array` port, Conv1D, MAE/MAPE, naive forecast |
| `lecture5-study/ae.js`, `fashion.js` + `data/` | 3D point cloud + PCA, the linear AE, Dense/stack/tied-weight param counts, Fashion MNIST reconstructions + t-SNE map (lazy) |
| `lecture6-7-study/gen.js` + `data/` | Dense/Conv2D/Conv2DTranspose/BN/pooling params and shapes, transposed convolution by hand, VAE latent loss (σ and γ forms), `sampleCoding` (μ + exp(γ/2)·ε), the page's trained VAE decoder (int8, `makeDecoder`/`decode`), `ToyGan` (two-phase training) |
| `lecture3-study/cnn.js` | convolution/pooling maths for Lecture 3 |

### The TensorFlow environment (for the Keras truth checks)
Real Keras is used **only** by the checking tools, to confirm parameter counts and output shapes. The arcade itself runs in plain JS in the browser and never depends on TensorFlow. Full notes are in `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md`. **Read that file, but don't touch anything else in that project folder:** it's a graded submission.

- WSL distro **`Ubuntu`** (ignore `Ubuntu-22.04`), conda env **`tf-2.20-gpu`**. Despite the name, it's TensorFlow 2.21.0 with Keras 3.15.1. Nothing on the Windows side has TensorFlow.
- Call the env's Python **by absolute path**. Bare `python`/`conda` aren't found in non-interactive WSL shells, and `python3` there is the system Python without TF. From Git Bash, prefix with `MSYS_NO_PATHCONV=1` or the `/home/...` path gets mangled. Force the CPU (the counts don't need a GPU, and it avoids the harmless CUDA/PTX warnings). Run it from this repo:
  ```bash
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "C:\Users\james\Documents\personal-projects\wigfield-portfolio" \
    -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
    /home/james/miniconda3/envs/tf-2.20-gpu/bin/python tools/dl-arcade/keras_truth.py
  ```
  This was verified on 2026-10-22: `keras.Sequential([keras.Input((None, 1)), keras.layers.GRU(20)]).count_params()` → 1380. Adding the `Dense(1)` output's 21 gives the **1401** printed on Lecture 4's GRU slide. A `cuInit … CUDA_ERROR_NO_DEVICE` line is expected with the CPU forced, so ignore it.
- Put real code in the `.py` file rather than fighting quoting with `-c`. Use the env read-only: never `pip install` into it, and don't try to "fix" its CUDA setup.

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`
- Figures: render to PNG in your scratchpad (`pdftoppm -png -r 90 -f N -l N <pdf> <scratch>/slide`) and look at them with the Read tool. Many slides are figure-led. Read the slides behind every concept you use; don't rely on memory of the textbook.

---

## Setup

1. Branch off `main`: `feat/dl-arcade`.
2. Put everything in one folder, `src/components/portal/modules/deep-learning/arcade/`. Scope CSS with the prefix `.dla-` and localStorage keys with `dla:`.
3. Register it directly after the `dl-game` entry in `registry.js`:
   ```js
   { id: 'dl-arcade', label: 'Gradient Arcade', icon: 'network', group: 'Deep Learning', component: DeepLearningArcade },
   ```
   The hub lives at `/portal/dl-arcade` and each game at `/portal/dl-arcade/<gameId>` (use `usePortalRoute`). Browser back/forward must work.
4. Dev server: `npm run dev` (Vite, port 5173), run in the background. Stop it when you finish.
5. Don't change any existing module. Small, additive, backwards-compatible changes to shared files (`kit.jsx`) are allowed only if genuinely shared; prefer not to.

Suggested layout (adjust if you find better):
```
arcade/
  Arcade.jsx            module entry: hub ↔ game routing via usePortalRoute, error boundary per game
  hub/                  hub screens: cabinets grid, Daily Mix, Exam, profile/mastery
  kit/                  shared game kit: RoundShell, timer, score/streak/combo, results screen,
                        "why" card (slide receipt), keypad/choice inputs, sfx (WebAudio synth), useSeed
  core/                 concepts catalogue, scheduler (spaced repetition), storage, progress, rng
  content/              PURE DATA with slide citations (see Accuracy protocol)
  maths/                pure functions behind generated questions (param counts, shapes, update rules…)
  games/<gameId>/       index.js (manifest) + component(s) + game CSS
  arcade.css
tools/dl-arcade/        checks, Keras truth script, accuracy reports, screenshots go to scratchpad
```

---

## The hub and the shared kit

### Game contract (freeze this early so builders can work in parallel)
```js
// games/<gameId>/index.js
export default {
  id: 'param-sniper',
  title: 'Param Sniper',
  lectures: [1, 2, 3, 4, 5, 6, 8],      // which lectures it drills (6 = Lectures 6–7)
  concepts: ['params.dense', 'params.lstm', /* … */], // ids from core/concepts.js
  blurb: 'One line.',
  load: () => import('./ParamSniper.jsx'), // lazy: three.js etc. only load when opened
};
// The component receives:
//   { seed, level, mode: 'free' | 'mix' | 'exam', durationMs, onRoundEnd, onExit }
// and calls onRoundEnd({ score, maxScore, outcomes: [{ concept, correct, src }] }) exactly once.
```

### Round lifecycle (every game)
1. **Intro:** one line and the controls, skippable once seen.
2. **Play:** 60–120 s, or a fixed number of items. Difficulty ramps within the round and across levels.
3. **Results:** score, personal best, streak. Then a **"why" card for every mistake**: the correct answer, a one- or two-sentence explanation in the slides' notation, and a receipt (`Lecture 4 · slide 43`). This card is the learning moment, so it must be accurate and short.

### Spaced repetition and the addictive layer
- **Concept catalogue** (`core/concepts.js`): every drillable concept has an id, lecture, title and slide refs. Mastery and scheduling work per concept, not per game.
- **Scheduler:** Leitner boxes (1–5, review intervals of roughly 0/1/2/4/8 days). Each round's `outcomes` promote or demote concepts. Keep it simple, pure and unit-tested.
- **Daily Mix:** about 5 minutes, 4–5 short rounds chosen to cover the concepts that are due, weighted towards weak ones. It's the one big button on the hub.
- **Exam mode:** a longer mixed run across all games, weighted to weak concepts, with a final grade per lecture.
- **Profile:** XP and levels, a daily streak, a mastery ring per lecture, a personal best per game, and unlocks (harder levels and new modes as mastery grows).
- **Storage:** all of it behind `core/storage.js` (versioned schema, `dla:` keys, every read and write in try/catch, renders fine if localStorage throws). Keep the API shaped so it could move to Supabase later.

### Design rules (these come from how I've reacted to past modules; follow them)
- **One idea per game, readable in 5 seconds.** At most 2–3 visible controls. Picture first; numbers appear on interaction or in a collapsed "Show the maths" drawer, in the slides' notation.
- **Never walls of text.** No long scrolling pages: the hub is a grid of cabinets plus panels, not an article.
- **No AI-looking callouts:** no coloured rounded boxes with a thick left border, no filled pill badges. Tone markers are a labelled dot on ruled, editorial layouts.
- **Make it exciting:** arcade cabinets or marquee cards on the hub, juicy feedback (combo counters, screen shake, synth SFX via WebAudio with a mute toggle), and progress you can see.
- **Use one visual language across all games:** reuse the L8 role-colour tokens (`stage.css`) and check every game in all three portal themes (jade, coral, arcade).
- **Mobile is first-class.** A daily-mix habit mostly happens on a phone, so every game must work at 390 px wide with touch: big tap targets, an on-screen keypad for numeric answers, and no horizontal page scroll. Keyboard must work on desktop.
- **Respect `prefers-reduced-motion`** (no shake or flashing; state changes instant) and give every interactive element a label.
- **Pixel art (optional):** the PixelLab MCP is connected. You may generate a small, consistent set (hub mascot, cabinet marquees, a few sprites) into `public/dl-arcade/`. Check `get_balance` first and keep generation modest. **Every game must work with zero assets** (procedural SVG/canvas fallback), so the art is polish, not a dependency.

---

## The games

**Batch 1 is required.** Build all 8. **Batch 2 is stretch:** start it only after every Batch 1 game has passed its accuracy audit and the checks, and build it in the order listed.

The slide ranges below come from the transcript headings. Confirm them against the PDFs, and cite exact slides in `content/`.

### Batch 1

**1. Param Sniper** · all lectures · *build first (pilot)*
- Layer specs fly in, e.g. `Conv2D(32, 3, padding="same")` on `(28, 28, 1)`. You enter the **parameter count** (and on higher levels the **output shape**) before the spec reaches the line. Numeric keypad; 4-choice mode on the easiest level.
- Ramp: single layers, then stacks, then a whole `model.summary()` total.
- **Layer types:** Dense, Conv2D, Conv2DTranspose, pooling, BatchNormalization (trainable vs non-trainable), SimpleRNN, LSTM, GRU, Conv1D, tied-weight decoders (biases only), MultiHeadAttention. Only include a layer type if the slides cover it.
- **Accuracy hotspots:** GRU's extra bias in Keras (`reset_after`); BN's non-trainable parameters; tied weights; MHA. Anchor to the counts printed on the slides (e.g. Lecture 4's 685, 1401 and 1283) and to the Keras truth file (see Accuracy protocol).

**2. The Exchange** · Lecture 8 (+ Lecture 4/8 encoder–decoder) · *build second (pilot)*
- **A 1940s telephone switchboard.** Act 1: one cable carries the whole sentence as the encoder's final state, and long sentences come out garbled (the bottleneck; L8 slides 4–6, 12–17). Act 2: you get a patch board. Patch each **query** into **keys**; each plug's brightness is its softmax weight, and the output is the weighted sum of **values**.
- **Scoring:** your patching is compared with the **real cross-attention weights of the toy Transformer** (`toyMT.js`) as it translates.
- **Later shifts unlock:**
  - Bahdanau (additive/concatenative) vs Luong (dot / general / concat) desks
  - the √d_keys scaling
  - the causal mask (future sockets locked)
  - multi-head attention (several operators at once)
  - self- vs cross-attention
- Slides 18–28 and 29–43.

**3. Descent** · Lecture 2 · 3D (three.js / react-three-fiber, lazy-loaded)
- **Optimiser golf.** A ball on a loss surface; each hole is a landscape designed so that one optimiser's characteristic behaviour decides par: a long narrow ravine, a plateau, a saddle, a cliff. Your clubs are SGD, Momentum, NAG, AdaGrad, RMSProp and Adam, with AdaMax, Nadam and AdamW unlockable. Controls: club, learning-rate dial, swing.
- **The ball moves by the slides' exact update rules**, with their hyperparameter names.
- **Before each hole you predict** which club will make par; that's the answer you produce. Power-ups are the learning-rate schedules (power, exponential, piecewise constant, performance, 1cycle). Exploding-gradient cliffs are tamed by gradient clipping (`clipvalue` vs `clipnorm`, slide 29).
- **Accuracy hotspots:** every update equation and every default value. Don't add anything the slides don't state.

**4. Kernel Rush** · Lecture 3
- **The input tensor is a block;** a conv or pooling layer spec drops in (filters, kernel, stride, padding). You size the output block (drag or type H × W × C) before it lands. Then a bonus: the parameter count.
- **Ramp:** valid vs same padding, then stride, then multi-channel filters (each filter spans all input channels; slide 15's equation), then pooling, then stacked layers and receptive field.
- **Accuracy hotspots:** the output-size rules for `same` vs `valid` with stride (verify against Keras), bias counts, and pooling having no parameters.

**5. The Long Short-Term Line** · Lecture 4
- **You're a memory cell running a train** (the Chicago bus/rail theme, as in the lecture dataset). The cargo car is the cell state; levers are the gates. At each station you set the forget, input and output gates so that cargo loaded early is delivered where it's needed many stations later.
- **Modes in order:**
  - **SimpleRNN:** only the hidden state, and cargo degrades over the steps; show the unrolled-through-time view (slides 5–14, 40–41)
  - **LSTM:** slides 42–47
  - **GRU:** merged gates, slides 48–49
- **The gate maths is the slides' equations exactly**, in the slides' row-vector notation (reuse `rnn.js`). A drawer shows the equations with the current values.
- **Accuracy hotspots:** which gate uses which activation, and the GRU's z convention (follow the slides' version, not memory).

**6. Bottleneck** · Lecture 5
- **Stage 1:** rotate a plane through the 3D point cloud to minimise reconstruction error; the target is the linear autoencoder ≈ PCA (slides 8–9; reuse `ae.js`).
- **Stage 2:** build a symmetric stacked autoencoder that fits a parameter budget, then **tie the weights** (decoder kernel = encoder kernelᵀ, only biases remain) and count what's saved (slides 10–13, 18–22).
- **Stage 3:** order the steps of training one autoencoder at a time and stacking them (slides 23–25), plus unsupervised pretraining (16–17).
- **Stage 4:** drop a Fashion MNIST item onto the t-SNE map (slides 14–15, using the existing data).

**7. Latent Surfer** · Lectures 6–7
- **Steer through the latent space of the page's own trained VAE decoder** (`gen.js` `makeDecoder`/`decode` + `data/vae.js`) and watch the decoded item change. Check the coding size in `data/vae.js`; if it's more than 2, steer in a 2D slice and label it honestly.
- **Targets:**
  - "find a sneaker"
  - **sampling:** set μ and γ (= log σ²) and catch the sampled coding, μ + exp(γ/2)·ε
  - **semantic interpolation** between two codings (slides 17–18)
  - a **latent-loss vs reconstruction "heat" meter** using the slides' latent-loss formula (slides 12–13)
- **Accuracy hotspots:** the γ form, the sampling formula, the latent-loss formula, and which numbers are this page's own run (label them as such, as the study modules do).

**8. Chain Reaction** · Lecture 1
- **A tiny MLP as a computation graph.** The forward pass lights it up; then you fill the gradients backwards, node by node, before the fuse burns out; then you apply the gradient-descent step (slides 18–23).
- **Extra levels:**
  - pick the output layer and loss for a task card (regression vs binary vs multiclass vs multilabel; slides 24–31)
  - "remove the activations" and watch the stack collapse to one linear layer (slide 23)
- **Accuracy hotspot:** the slides describe backprop mostly in words. Any derivative formula you show that the slides don't state must be standard, correct, and marked "beyond the slides" in its citation.

### Batch 2 (stretch, in this order)

9. **Boundary Bash** · L1 slides 4–17. Apply the perceptron learning rule to keep the decision boundary separating incoming points; the XOR level can't be solved until you add a hidden layer.
10. **Signal Keeper** · L2 slides 5–29. Keep per-layer activation/gradient histograms healthy through a deep stack by choosing the init (Glorot / He / LeCun), the activation (including SELU's conditions for self-normalisation, exactly as the slides list them), BatchNorm and clipping.
11. **Forger** · L6–7 slides 19–30. Run a GAN's two training phases in the right order: discriminator on real + fake, then generator through a **frozen** discriminator. Mode collapse appears if you repeat yourself. Includes a DCGAN-guidelines build puzzle. Reuse `ToyGan`.
12. **Forecast Desk** · L4 slides 15–39. Bus/rail forecasting: naive/seasonal baseline, MAE/MAPE, windowing, linear vs SimpleRNN vs deep RNN, multivariate, and multi-step strategies (seq-to-vector vs seq-to-seq). Score = beat the baseline.
13. **Block Builder** · L3 architecture slides (PDF). Assemble or identify LeNet-5, AlexNet, GoogLeNet's inception module, VGG, the ResNet residual unit, Xception and SENet from parts, as far as the slides cover them.
14. **Wave Stamp** · L8 slides 32–36, 44–48. Match sinusoidal positional-encoding barcodes to positions (mind the base-1000 vs base-10 000 quirk). Bonus stage: ViT patching (16 × 16 × 3 = 768).
15. **Overfit Clinic** · all lectures. Diagnose a sick model from its curves, summary or samples and prescribe the fix. It works as the hub's exam boss. Cases come from failure modes the slides name (unstable gradients, overfitting → ℓ1/ℓ2/dropout, transfer learning's freeze → unfreeze → recompile, mode collapse, the missing causal mask, …).

---

## Accuracy protocol (the most important section)

**Sources of truth, in order:** the lecture PDFs, then the markdown transcripts (including their "Quirks" sections). That's it. The textbook, the internet, your own memory and the existing study modules are **not** sources. You may reuse their *code*, but anything it produces must be verified against the slides here.

1. **No facts hard-coded in components.** Every fact, label, formula, question, answer, distractor and "why" text lives in `content/` or is produced by a function in `maths/`. Every content item carries `src: { lecture, slides: [...] }`, plus `beyond: true` if it isn't in the slides (keep those rare and clearly marked).
2. **Use the slides' notation and terms**, e.g. γ = log σ² in Lectures 6–7, row vectors in Lecture 4, the slides' names for Bahdanau and Luong attention. Where slides disagree with each other or with the code on another slide, follow the slide being drilled and mention the quirk in the "why" card.
3. **Generated questions come from pure functions in `maths/`**, verified three ways:
   - **Slide anchors:** every number printed on the slides that a function can reproduce (e.g. Lecture 4's 685 / 1401 / 1283, the Lecture 2 BN summary, Lecture 8's slide 9/14 counts) is a test case.
   - **Real Keras:** write `tools/dl-arcade/keras_truth.py`, which builds a few hundred seeded random layer configs per layer type and dumps parameter counts (trainable and non-trainable) and output shapes to `tools/dl-arcade/keras-truth.json`. Record the TF/Keras versions in the JSON. Run it with the exact command under "The TensorFlow environment" above. `tools/dl-arcade/check-maths.mjs` must match 100 %. Where Keras 3.15 defaults differ from what the slides show (e.g. GRU `reset_after`), the game teaches the slides' number and the "why" card explains the difference. If WSL or the env is unusable, fall back to slide anchors plus an independent second implementation, and say so in the report.
   - **Simulation fidelity:** optimiser updates (Descent), gate equations (Long Short-Term Line), attention (The Exchange) and the VAE formulas (Latent Surfer) each get a check script comparing the game's code with a hand-worked example taken from the slide equations.
4. **Accuracy checker (mandatory subagent, one per game).** Run a fresh agent with no stake in the build. It must:
   - extract **every claim** the game makes: content files, UI strings, question templates, distractors, "why" cards, maths-drawer lines, and what the mechanics imply (e.g. an animation implying a gate is a sigmoid);
   - verify each claim against the slide PDF pages, rendering the figure-led ones to PNG and looking at them;
   - **solve a sample of generated questions on its own without seeing the answer key** (at least 30 per game, more for Param Sniper and Kernel Rush) and compare;
   - write `tools/dl-arcade/accuracy/<gameId>.md` as a table: claim · source (lecture, slide) · verdict (VERIFIED / WRONG / NOT IN SLIDES / AMBIGUOUS) · fix.

   You fix everything and re-run the checker until there are **zero WRONG** and every NOT IN SLIDES item is either removed or marked `beyond`.
5. **Final re-audit.** When everything is built, run a *second*, independent accuracy agent over the whole arcade (hub copy, concepts catalogue, every game), as earlier modules did with an audit and then a re-audit. Fix and re-run until it's clean.

---

## Subagents

Spin up whatever helps. Suggested roles:

- **Slide readers** (one per lecture, run in parallel at the start): extract each lecture's hard concepts, equations, printed numbers and quirks into `content/` with slide citations, plus the concept catalogue entries.
- **Game builders:** once the kit and the two pilot games are done and the contract is frozen, build the remaining Batch 1 games **in parallel**, one agent per game. Each builder works only inside `games/<gameId>/` (and its own `content/` and `maths/` files). You alone edit shared files (`core/`, `kit/`, the games index, `registry.js`), so parallel work doesn't collide. Give each builder this whole document plus the frozen contract.
- **Accuracy checkers:** see the protocol above. Always fresh agents, never the builder checking its own work.
- **Maths verifier:** owns `keras_truth.py`, `check-maths.mjs` and the fidelity scripts. Give it the TensorFlow environment section verbatim.
- **QA / design reviewer:** runs the headless checks, looks at every screenshot with the Read tool, critiques it against the design rules, and files fixes.

---

## Order of work

1. **Read:** run the slide readers, build the concepts catalogue, and skim the reusable files above. Write your plan to `tools/dl-arcade/PLAN.md` (for the record; don't wait for anyone).
2. **Kit and pilots:** build the hub, core, kit, Param Sniper and The Exchange. Screenshot them, critique them, and fix the kit. **Freeze the game contract.** Commit.
3. **The rest of Batch 1:** build the other six games in parallel, then commit each game as it lands.
4. **Audit Batch 1:** run the per-game accuracy checkers, the maths/Keras checks and QA. Fix everything and commit.
5. **Batch 2 (stretch):** same pipeline (build, then audit, then QA), committing as you go.
6. **Final pass:** run the full re-audit and the full headless check, fix what they find, write the report and update the docs (below). Final commit.

---

## Verification (must pass before you call anything done)

`tools/dl-arcade/arcade-check.mjs`, adapted from `tools/dl-lecture8-study/page-check.mjs` (puppeteer-core + local Edge, through the portal gate). Scenarios:

- the hub renders; every game opens from its cabinet **and** from its deep link; back/forward works
- **a scripted bot plays one full round of every game** with right and wrong answers (give each game a deterministic `seed` and a dev-only test hook behind `import.meta.env.DEV`). `onRoundEnd` fires once; the results screen and the "why" cards render with slide receipts
- the Daily Mix and Exam run end to end; the scheduler moves concepts between boxes as expected (plus unit tests for the scheduler)
- progress persists across a reload; with localStorage throwing, everything still renders and plays
- under reduced motion, games render and play
- **screenshots of the hub and every game in all three themes (jade, coral, arcade) at 1440 and 390**, with no horizontal page scroll. **Look at them** and fix what looks wrong
- **zero console errors or warnings** across all runs
- the other Deep Learning modules (Lectures 3–8 study pages, Scrolls · 3D) still render

Also:
- `npm run build` passes.
- `npx eslint src/components/portal/modules/deep-learning/arcade` is clean. The rest of the repo has many pre-existing lint errors; leave them alone.
- `check-maths.mjs` and the fidelity scripts pass.

---

## Git

- Commit on `feat/dl-arcade` after each phase and each game, with clear messages.
- **Do not push, deploy, or merge into `main`.** I'll review in the morning.
- Don't commit screenshots or scratch files.

---

## When you finish

1. **Report:** write `Documents/cits5017/dl-arcade-report.md`, containing:
   - what was built and how to play each game (one line each)
   - the accuracy summary per game (claims checked, wrong found and fixed, anything marked `beyond`)
   - the Keras-truth result
   - **Decisions I made**: everything you decided without me
   - known issues
   - what's left
2. **Obsidian vault:** follow `CLAUDE.md`. Create or update notes in `C:\Users\james\Documents\james-claude-brain`: a project note for the arcade under `01-Active-Projects/` (linked to `[[wigfield-portfolio-management-portal]]`, `[[wigfield-portfolio-learning-hub]]` and `[[wigfield-portfolio-dl-game]]`) and a dev-log entry under `03-Dev-Logs/`.
3. **Claude memory:** update the project memory with one line on where the arcade lives, how to add a game, and how to run its checks.
