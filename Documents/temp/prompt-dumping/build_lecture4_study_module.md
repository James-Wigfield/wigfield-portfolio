# Build: CITS5017 Lecture 4 (Processing Sequences Using RNNs and CNNs): Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section in the sidebar. In it is **"Lecture 3 · CNNs (Study)"** (`/portal/dl-lecture-3-study`, folder `src/components/portal/modules/deep-learning/lecture3-study/`). That module is exactly how I study, and I'm very happy with every part of it:

> I go full screen and work down the page in slide order. I read a short explanation, then play with an interactive visual until the idea clicks, then copy a page of notes (with diagrams) into my paper notebook. Then I move on to the next part.

Build **the same kind of module for Lecture 4**, the deck `Documents/cits5017/lectures/cits5017-lect04-Processing-sequences.pdf` (52 slides, Chapter 15 of Géron's *Hands-On Machine Learning*, 3rd ed.).

Three things matter above everything else:

1. **It must match the lecture closely.** Every section follows the deck in order. Every claim, number, equation, code line and figure comes from the slides and uses the slides' own notation. This module is how I prepare for tests on this deck, so a wrong formula or a made-up number is worse than a missing lab.
2. **It must work well for learning.** The Read → Play → Write rhythm, with labs that let me see the mechanism working (real computation, not decoration), and notebook pages I can copy onto paper in a few minutes.
3. **It must feel identical to the Lecture 3 study module.** That module is the reference implementation. Copy its shell, rhythm, notebook page, look and behaviour. Only the content should differ. If you're unsure how something should look or behave, do what `lecture3-study` does.

> **Note on a saved preference:** your auto-memory has a rule from an older build ("no long-scroll pages, use top tabs"). **It doesn't apply here.** The study-module format is deliberately one continuous page worked through in focus mode, and I've confirmed that's what I want. The other saved rules still apply: no tone-coloured callout boxes or filled pills, VS-Code-style code blocks, and no walls of text.

---

## Where things are

| What | Path |
|---|---|
| **The source of truth** (52 slides) | `Documents/cits5017/lectures/cits5017-lect04-Processing-sequences.pdf` |
| **The reference implementation** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture3-study/` |
| The brief that produced Lecture 3 (read it: same requirements, different deck) | `Documents/cits5017/build_lecture3_study_module.md` |
| Existing slide-transcript format to match | `Documents/cits5017/markdown-lecs/lecture-3.md` |
| Topic 4 lab sheet (**context only**, see content rules) | `Documents/cits5017/labs/cits5017LabSheet4.pdf` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Portal shell (don't edit) | `src/components/portal/Portal.jsx` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css` (`Tex`, `Eq`, `Code` (VS Code look), `Note`, `Unfold`, `Fnote`/`RefsProvider`, …) |
| Shared page styles + series palette | `.../deep-learning/common.css` (`.dl-*`, `--dlv-*` colours, dark-stepped for the arcade theme) |
| Plot helpers | `.../deep-learning/plots.jsx`, `mathfns.js` |
| Headless page-check precedent (puppeteer-core + local Edge, gets through the portal gate) | `tools/dl-project2/page-check.mjs` |
| Portal gate password (mock) | `src/components/portal/auth.js` |
| Obsidian vault (see "Wrap-up") | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. **Warning:** pdftotext drops or garbles the maths on this deck (σ, φ, ⊗, ∈, ×, transposes and subscripts all come out wrong or missing). **Always read every equation from the rendered slide image.**
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide` and look at them with the Read tool. Many slides are figure-led (Figures 15-1 to 15-7, 15-10 to 15-13, and the custom slide-10/11 diagram). Read **every** slide as an image, not just the text.
- Don't embed slide renders in the page (the Lecture 3 module doesn't). Rebuild figures as SVG and labs.

---

## Ground rules

- **Don't modify `lecture3-study/`** or any other existing module. At the end, `git diff main -- src/components/portal/modules/deep-learning/lecture3-study` must be empty. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon. Small, additive, backwards-compatible changes to `kit.jsx` are fine only if they're genuinely shared.
- **Copy, don't refactor.** Don't pull the Lecture 3 shell out into a shared framework in this task. Copy the files into the new folder and adapt the copies. If you think a shared framework is worth doing later, suggest it in your summary.
- **Do the whole build in one go.** Don't stop partway to check in with me or ask for feedback. Make sensible decisions yourself and list them in your final summary.

---

## Setup

1. Run `git status`. The tree should be clean on `main`, apart from this brief in `Documents/temp/` (untracked; don't commit it). Branch: `feat/dl-lecture-4-study`. Only stage files you created or deliberately changed.
2. New folder: `src/components/portal/modules/deep-learning/lecture4-study/`. CSS prefix `.dl4s-*`. localStorage prefix `dl4s:`. Every storage read and write is wrapped in try/catch, as in `lecture3-study/storage.js`.
3. Register it directly after the `dl-lecture-3-study` entry:
   ```js
   { id: 'dl-lecture-4-study', label: 'Lecture 4 · RNNs (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture4Study },
   ```
   It will then be at `/portal/dl-lecture-4-study`.
4. Copy the Lecture 3 shell (`Lecture3Study.jsx` → `Lecture4Study.jsx`, `NotebookPage.jsx`, `Rich.jsx`, `ui.jsx`, `hooks.js`, `storage.js`, `context.js`, the CSS) and adapt it. Then **grep the copies for Lecture 3 leftovers**. Known ones:
   - `SectionIndex` hard-codes `§12` for the group heading; derive it from the section data instead.
   - `Rich.jsx` imports `SLIDE6_FILTERS`, `SLIDE17_CODE` and `FLOWERS_CODE`.
   - `NotebookPage` handles `f.filters`/`FilterMatrices`.
   - The hero says "Topic 3 · Chapter 14 · slides 1–53".
   - The footer says "53 slides".
   - `dl3s` appears in class names, ids, storage keys and the `html.dl3s-pseudo-on` class.
   - The outcomes context refers to "slide-52".

   After adapting, nothing in the new folder should mention Lecture 3 content.
5. Pure maths goes in its own helper (`rnn.js`, like `cnn.js`): SimpleRNN, LSTM and GRU step functions, parameter counts, a faithful port of `timeseries_dataset_from_array` windowing, Conv1D, MAE/MAPE. All slide facts (numbers, code, tables, footnotes, outcomes) go in `slideData.js`, and all prose in `sections.js`, using the same data shape as Lecture 3's `sections.js` (read its header comment).

---

## The page experience: same as Lecture 3

Everything in "The page experience" in `build_lecture3_study_module.md` applies unchanged:
- focus mode (Fullscreen API on the root, the overlay fallback, Esc exits)
- the sticky header with current section and progress
- one continuous scroll in slide order, no tabs
- the section rail/dropdown with slide ranges and done marks
- "Resume at §N"
- ticks that persist
- the three beats per section: **Read** (short, slide receipts, slide notation, long verbatim detail in `Unfold`), **Play** (1–2 live labs, each with a one-line "Try this", direct labels, defaults = the slide's own example), and **Write** (the ruled notebook page: Notes 6–12 tickable lines under 2–4 sub-headings written as short complete sentences · Draw this, monochrome line art you can copy in about 2 minutes, with a caption saying what to label · Formulas to copy, each with a plain-English reading · Worked number · Check yourself, 1–2 questions with click-to-reveal answers).

A section can leave out a block, but the order stays fixed.

### Making it good for learning (for this deck in particular)
- **Concept first, then the lab.** Phrase each "Try this" as *predict → change → notice* (e.g. "Before toggling `return_sequences`, predict the next layer's input shape").
- **Lab defaults reproduce the slide's own example**, for instance: 4 inputs, 5 neurons, 2 outputs and 3 time steps (slide 10); `my_series = [0..5]` with `sequence_length=3`, `batch_size=2` (slide 19); `seq_length = 56` and batch 32 (slides 20–21); `SimpleRNN(32)`, `LSTM(12)`, `GRU(20)`; `Conv1D(8, 3, strides=1)` then `Conv1D(16, 3, strides=2)` (slide 50).
- **Label every matrix with its shape.** Slide 9 defines the shapes and slides 10–11 instantiate them. Showing `W_x ∈ ℝ^{4×5}` next to the symbol is the easiest way to make the equations stick.
- **Use one running thread: the validation-MAE scoreboard.** Slides 18–50 are one forecasting story told as a sequence of models, each with a validation MAE. Show a compact scoreboard that grows section by section and is shown in full in the summary. It holds only numbers quoted from the slides, each with its slide receipt. Label the ones that aren't like-for-like (14-step forecasts, the bus+rail total, the second "2024 run" figures on slide 33).
- **Real computation, honestly labelled.** Forward passes, shapes, parameter counts, windowing, naive-forecast metrics and gate arithmetic can all be computed live. **Never present a number as the slides' result unless it is quoted from the slides.** Anything the page computes itself, such as a tiny model trained in the browser or a stand-in predictor used to show the autoregressive loop, is labelled as this page's own run.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

| § | Section | Slides | Play ideas (suggestions, not requirements) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | Slide 3's ten topics mapped to the sections that cover them (like Lecture 3's `RoadmapLab`) |
| 1 | What RNNs are for · recurrent neurons & unrolling | 4–6 | One recurrent neuron (Fig 15-1) with live weights stepping through an input sequence; a rolled ↔ unrolled toggle; the same weights handling sequences of any length; then a layer (Fig 15-2) with vector shapes |
| 2 | Memory cells: the hidden state h₍t₎ | 7–9 | "Who influenced y₍t₎?": pick an output and light up every input it depends on; change x₍0₎ and watch its effect through time; h vs y kept separate (Fig 15-3); slide 9's equations expanded term by term with shapes |
| 3 | Worked example: the weather RNN & minibatch shapes | 10–11 | Shape calculator seeded with the slide's example (n_inputs 4, n_neurons 5, n_outputs 2, 3 steps, minibatch m): every W, b, H₍t₎, X and Y shape, discarded outputs greyed, h₍0₎ = 0, the N×3×4 training tensor |
| 4 | Input and output sequences | 12–13 | Fig 15-4 four-way switcher (seq→seq, seq→vec, vec→seq, encoder–decoder) showing which inputs are real vs zeros and which outputs are used vs ignored; sort slide 12's four examples into the right mode |
| 5 | Training: backpropagation through time | 14 | Fig 15-5: forward pass, then gradients flowing back only from the outputs that are in the loss (the slide uses the last three); choose which outputs count and watch the gradient paths change; shared weights collect gradient from every step |
| 6 | Forecasting a time series: ridership, seasonality, naive baselines | 15–18 | The real Mar–May 2019 bus/rail series (see "Data") with the weekly pattern; overlay the lag-k series and its difference; live MAE and MAPE for any lag k, with k = 7 reproducing slide 18 exactly |
| 7 | Preparing the data with `timeseries_dataset_from_array` | 19–22 | Window builder: slide 19's toy example exactly (windows, targets, batches, shapes), editable; then the `seq_length=56`, batch-32 rail version: shapes (32, 56) and (32,), batch count, slide-22-style mini plots (input line + target star) |
| 8 | Linear model → simple RNN | 23–27 | A 57-parameter dot-product view of the linear model; the single-neuron RNN's 3 parameters; the **tanh ceiling** (series values up to ~1.4 that tanh can never output, slide 26); a SimpleRNN(32) + Dense(1) parameter breakdown → 1,088 + 33 = 1,121 |
| 9 | Deep RNNs | 28–29 | Stack builder (Fig 15-10): add/remove SimpleRNN layers and toggle `return_sequences` per layer, with each layer's output shape and parameter count (1,088 / 2,080 / 2,080 / 33 = 5,281), and a clear failure state when an inner layer drops the time axis |
| 10 | Multivariate input & multiple outputs | 30–33 | Feature builder: bus, rail, next-day type → one-hot → 5 columns (check the exact column names on the slide 30 image); `shape=[None, 5]`; Dense(1) vs Dense(2) targets; slide 33's per-series MAEs |
| 11 | Forecasting several steps ahead (+ the seq-to-seq pointer) | 34–39 | Two ways to get 14 days: (a) the slide-34 loop, step by step, each prediction appended to X with the loop line highlighted; (b) one window split 56 in / 14 out (`split_inputs_and_targets`, `target_col=1`), shapes (32, 56, 5) / (32, 14), 33 batches, Dense(14). Slide 39 as a short diagram-only preview; the slide defers encoder–decoders to Topic 8, so do the same |
| 12 | Handling long sequences | 40–41 | Gradient through time: a recurrent-weight slider plus tanh vs ReLU, showing gradient size over many steps (log scale) and ReLU outputs exploding because the same weights are reused every step; batch-norm vs layer-norm axis highlighter on a [batch × features] grid |
| 13 | LSTM cells | 42–47 | Fig 15-12 as a live cell: a short sequence with one "important" input; watch the gates (f, i, o) and c₍t₎ store it, keep it, then release it (slide 47's summary sentence, made visible); the six equations evaluated with the current step's numbers; parameter count → 685. Split into 13.1 / 13.2 if it's too much for one notebook page |
| 14 | GRU cells | 48–49 | The same sequence through a GRU (Fig 15-13): one state, z₍t₎ doing both forget and input, r₍t₎ inside g₍t₎, no output gate; side by side with the LSTM (states, gates, parameters → 1,401) |
| 15 | 1D convolution layers for sequences | 50 | Conv1D stepper (kernel 3, stride 1 vs 2, output length) → the `cnn_gru_model` shape flow and parameter count → 1,283; the slide's exercise shown as an at-home "Try this" |
| 16 | Summary | 51–52 | Slide 51's ten outcomes as a persisted self-check, each linking back to its section and notebook page (like Lecture 3's `OutcomesLab`); the full scoreboard; slide 52's next reading |

---

## Data: the real ridership series (preferred)

Slides 15–38 use the Chicago Transit Authority daily ridership data from `https://github.com/ageron/data/raw/main/ridership.tgz` (slide 15). Using the real data lets the labs reproduce the slides' own numbers, which is the strongest alignment check available.

- Download into its own empty scratchpad directory. Run slide 15's pandas steps **as written** (rename columns, sort, set the index, drop `total`, `drop_duplicates()`). Use Python + pandas if available (run Python with `-I`); otherwise write a faithful JS port.
- Generate `lecture4-study/data/ridership.js` with a reproducible script in `tools/dl-lecture4-study/`. Trim it to the range the page needs (2016-01 → 2019-05 covers train, validation and the slide-16/17 plots). The file's header should give the source URL, the archive's sha256 and the extraction date. If it's big, lazy-load it the way `project2/Project2.jsx` does.
- **Gate:** the 7-day naive forecast over 2019-03 → 2019-05 must reproduce slide 18 to the printed precision: MAE bus 43915.608696 / rail 42143.271739; MAPE bus 0.082938 / rail 0.089948. The 70-day windows over the training period must give slide 36's 33 batches for `ahead_train_ds`.
- If the download isn't possible, use a clearly labelled synthetic series with weekly seasonality and don't claim any slide number for it.

---

## Accuracy traps I found while scoping (verify each, don't take my word for it)

- **Notation:** slides 9, 47 and 49 use transposed row vectors with subscript time indices: `h_{(t)}^⊤ = φ_h(h_{(t-1)}^⊤ W_h + x_{(t)}^⊤ W_x + b_h^⊤)`, `σ` for gates, `⊗` for element-wise products. Slide 11 switches to uppercase minibatch matrices (H₍t₎, X₍t₎, B_h stacked biases). Keep each exactly as typeset.
- **Parameter counts on the slides** that labs must reproduce: linear 57 · SimpleRNN(1) 3 · SimpleRNN(32) 1,088 + Dense 33 = 1,121 · deep 1,088 + 2,080 + 2,080 + 33 = 5,281 · LSTM(12) model 685 · GRU(20) model 1,401 · cnn_gru 1,283.
  - Two of these need facts that aren't on the slides: GRU's 1,401 depends on Keras's default `reset_after=True` (two bias vectors per gate group), and the Conv1D/GRU breakdown needs the per-layer formula. If a worked number uses such a fact, mark it as an aside beyond the slides.
  - Counts the slides *don't* give (e.g. `mulvar_model`) may be shown only as computed by the page.
- **Slide 29:** the per-layer `# params` comments appear shifted one line up relative to the layers. Keep the code verbatim and add a "Slide check" note saying which count belongs to which layer.
- **Slide 41:** the example puts `SimpleRNNCell(32)` straight into a `Sequential`. Very likely this won't run as written (a cell needs wrapping in an `RNN` layer; the textbook builds a custom layer-norm cell). Confirm this, keep the slide code verbatim and add a "Slide check" note. Don't silently fix it.
- **Slide 12, item 1:** "the stock prices of N − 1 ago and of tomorrow" is garbled wording. Explain what it means (outputs shifted one step into the future) without changing the slide's claim.
- **Slide 33** gives two runs (27,855 total with bus 26,812 / rail 28,896, and a "2024 run" with 24,421 / 25,162 / 23,680). Keep both and label them.
- The figure numbers jump from 15-7 to 15-10. That's the deck, not a gap to fill.
- Use the existing `slideNote` ("Slide check") block for every discrepancy, as Lecture 3 does. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. Short intuition that explains a slide is welcome. New syllabus content isn't. Use the textbook only to interpret a figure, never as a source of extra content.
- Keep the deck's notation, variable names (`univar_model`, `mulvar_model`, `ahead_model`, …) and Keras calls exactly as written on the slides. Code blocks are verbatim (fix pdftotext wrapping against the image).
- Footnotes (Ba et al. 2016 on slide 41, Hochreiter & Schmidhuber 1997 on slide 42) go in `REFS` with `Fnote`, as in Lecture 3.
- **Lab Sheet 4** practises this topic (noisy-squares clockwise/anticlockwise RNN), but the module follows the slides. At most, add one line in §16 saying the lab sheet practises it. Don't build content from it.

## Design rules (same as Lecture 3)
- Theme everything from the portal tokens and `.dl` styles. Check all three portal themes (Jade, Coral, Arcade/dark). Use `--dlv-*` for series colours. The notebook page keeps its paper feel and its dark "notebook" look in Arcade.
- Show tone or status as small labelled dots on ruled layouts. Don't use coloured rounded left-border callout boxes or filled badge pills. Code uses the kit's VS Code `Code` block.
- Respect `prefers-reduced-motion`. Everything is keyboard reachable. No emoji (use icons from `icons.jsx`).
- It must work at laptop width, in fullscreen on a large monitor, and degrade sensibly on a narrow window.

---

## Process: use subagents

You may spawn subagents wherever they make the result more accurate or the build faster. Launch independent agents **in one message so they run in parallel**. Give every agent a **self-contained brief**: paths, the exact task, the output format, and "read-only" where it applies. Use **fresh general-purpose agents (not forks) for every audit**, so the reviewers don't inherit your assumptions.

### Phase 1: Ground truth (start these first, then do Phase 2 reading while they run)
- **3 slide transcribers** (slides 1–18, 19–38, 39–52). Each renders every slide in its range as an image *and* extracts its text, then writes a faithful transcript part to the scratchpad in the format of `markdown-lecs/lecture-3.md`: `## Slide N — title`, prose verbatim, every equation in LaTeX **exactly as typeset** (read from the image), code verbatim in fenced blocks, and every figure described precisely (boxes, labels, arrow directions, dashed vs solid, what's greyed out or labelled ignored/discarded, axis labels and plotted values). Each part ends with a **Quirks** list: anything on a slide that looks wrong, inconsistent or ambiguous, with the reason. Quirks are recorded, not fixed. You merge the three parts into `Documents/cits5017/markdown-lecs/lecture-4.md` (commit it; it's useful for future modules too). This transcript is what you and every auditor check against.
- **1 data agent:** the ridership pipeline and its slide-18 gate (see "Data"). It reports the reproduced numbers.

### Phase 2: Orient (you, while Phase 1 runs)
- Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks.
- Read `build_lecture3_study_module.md`.
- Read **every file** in `lecture3-study/`. You're cloning its experience, so you need it in your own context. Don't delegate this.
- Read `kit.jsx`, `kit.css` and `common.css`.

### Phase 3: Plan and first sections (you)
- Confirm the section plan against the merged transcript. Every slide 1–52 must land in exactly one section.
- Build the shell, then §0–§2 completely (Read → Play → Write). Review them against this brief before going on, so the notebook format is fixed before you repeat it.

### Phase 4: Remaining sections
- Build §3–§16. **Optionally** hand lab files to parallel builder subagents once you've written the first two lab files yourself as the model to copy.
- Each builder owns exactly one `labs/<name>.jsx` (plus its own CSS partial with `dl4s-<lab>-*` classes). It uses `Lab`/`Chips`/`Range`/`Stat` from `../ui` and maths from `../rnn.js`, takes facts only from `slideData.js` and the transcript, adds no new dependencies, and touches nothing else.
- Review every delegated lab yourself before wiring it in. `sections.js` (all prose, notes, formulas, check questions) stays yours, so the voice stays consistent.

### Phase 5: Audit (parallel, read-only, fresh agents)
Each auditor returns findings as: slide N · file:line · what the slide says (quoted) · what the page says · severity (**wrong** / **misleading** / **missing** / **polish**).
- **2–3 content-fidelity auditors**, split by section range. They check every sentence, notes line, formula, code block, worked number and check-question answer against the slide images and the transcript. They also flag invented content and any notation drift.
- **1 visual-alignment auditor.** It screenshots each section's labs and "Draw this" diagrams in a headless browser and compares them with the matching slide renders: Figs 15-1/15-2 (unrolling direction, where x and ŷ sit), 15-3 (h vs y), 15-4 (the four configurations, ignored outputs), 15-5 (which outputs feed the loss, forward vs gradient arrows), 15-10, 15-12 (where the forget/input/output gates and the four FC layers sit, σ vs tanh), 15-13, and the slide-10/11 diagram and slide-22/37/38 plots.
- **1 numbers auditor.** It independently re-derives every parameter count, shape, batch count, MAE, MAPE and scoreboard entry, and checks that each lab's default state shows the slide's values. It also confirms that every number the page presents as the slides' is actually on a slide.
- **1 learning-design auditor.** Checks:
  - every slide 1–52 is covered, and every slide-51 outcome maps to a section
  - every notebook page meets the format (6–12 lines, 2–4 sub-headings, sentences not fragments, no walls of text)
  - every check question is answerable from that page's notes
  - every lab has a "Try this" and defaults from the slide
  - the page feels like the Lecture 3 module

### Phase 6: Fix, re-audit, verify (you)
- Fix every **wrong**, **misleading** and **missing** finding, or justify it in the summary. Then re-run the relevant auditor on the changed sections until it finds nothing in those three categories.
- Write `tools/dl-lecture4-study/page-check.mjs` (follow `tools/dl-project2/page-check.mjs`). It checks:
  - zero console errors/warnings
  - every section rendered with its slide receipt and every lab mounted
  - slide coverage 1–52 from the section data
  - focus mode enter/exit, and scrolling inside it
  - ticks persist across a reload; "Resume at §N"
  - the page still renders with localStorage throwing, and with reduced motion
  - screenshots in jade, coral and arcade at 1440 and 390 wide
  - `/portal/dl-lecture-3-study` still renders without errors
- Add a small assertion script for `rnn.js`: the parameter counts, slide 19's exact batches, and slide 18's metrics.
- Gates: lint the new folder plus `registry.js` clean (if repo-wide `npm run lint` has pre-existing errors elsewhere, report them, don't fix them) · `npm run build` passes · the page check passes · the `lecture3-study` diff is empty. If the dev server is already running on 5173, use it.

### Phase 7: Wrap-up
- Commit on `feat/dl-lecture-4-study` with the attribution line your environment specifies. Don't merge to `main` or push without asking me.
- **Vault** (repo `CLAUDE.md`): create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and update the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`. The Lecture 3 study module (commit `23e392c`) has no vault entry yet, so add a one-line mention of it alongside.
- Update your auto-memory's Management Portal pointer with one line about this module.
- **Final summary:**
  - what was built: sections, lab count, notebook line count
  - every "Slide check" note you added and why
  - the reproduced slide-18 numbers
  - decisions you made on your own
  - anything you couldn't verify
  - follow-ups worth doing, e.g. adding Lecture 4's code blocks to Code Lab · Search (`codelab/entries.js`), which is out of scope here
