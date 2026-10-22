# Build: CITS5017 Lecture 8 (Attention Mechanisms, Transformers and Vision Transformers): Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with one study module per lecture. Each module is one continuous page that I work down in focus mode, in slide order:

> I read a short explanation, play with an interactive visual until the idea clicks, then copy a page of notes into my paper notebook, and move on.

Build **the module for the final lecture**: `Documents/cits5017/lectures/cits5017-lect08-Transformers.pdf`. It has 51 slides, covers Chapter 16 of Géron's *Hands-On Machine Learning* (3rd ed.), and its title is "Topic 8: Attention Mechanisms, Transformers, and Vision Transformers".

**This is the most important module of the unit for me.** The lecture is content-heavy, and I have to learn it well in a short time. Take the care it needs.

**The template is the Lecture 5 study module** ("Lecture 5 · Autoencoders (Study)", `/portal/dl-lecture-5-study`, `src/components/portal/modules/deep-learning/lecture5-study/`). Follow its general structure:
- the shell and focus mode;
- Read → Play → Write per section;
- the notebook-page format and the notes budget;
- the PDF export with its NotebookLM prompt;
- the checks.

There are **two deliberate changes** from the earlier modules, explained in full below:
1. **The Play labs must be much more visual, interactive and inviting**, a clear break from how the recent labs were built.
2. **The notebook pages may include more diagrams and tables** where a concept benefits from one.

Three things matter above everything else:

1. **Every piece of content in the lecture is covered, and all of it is accurate.**
   - Every slide lands in a section, in deck order.
   - Every claim, number, equation, code line and figure comes from the slides, in the slides' own notation.
   - I prepare for tests from these modules, so a wrong formula or a made-up number is worse than a missing lab.
2. **The labs make the ideas click quickly and pleasantly.** See "Play".
3. **The notebook pages are fast to copy** and carry exactly what's worth memorising.

> **Note on a saved preference:** your auto-memory has an older rule: "no long-scroll pages, use top tabs". **It doesn't apply here.** Study modules are deliberately one continuous page worked through in focus mode. The other saved rules still apply:
> - no tone-coloured callout boxes or filled pills;
> - VS-Code-style code blocks;
> - no walls of text.

---

## Change 1: Play labs that are genuinely visual, interactive and inviting

**What went wrong recently, in my words:** the labs in the last few modules felt overwhelming and content-heavy. I felt like I was trying to decode a complex problem rather than *seeing* the idea, so they didn't make me want to use them. For this module, **branch away from that pattern.** Don't copy the lab style of Lectures 4–5 (dense numeric readouts, rows of stat cards, many chips and sliders, paragraphs of caption).

Design every lab by these principles:

1. **One idea per lab, visible in five seconds.** The opening state already shows the "aha". For example, attention beams from the decoder's "el" already light up "soccer". **Test it:** from a screenshot alone, without reading, could I tell what the lab shows?
2. **Picture first, numbers on demand.** The default view is shapes, colour, position, motion and connections.
   - Numbers appear when I hover or tap, or in a collapsed **"Show the maths"** drawer that walks through the slide's equation with the lab's current values, in the slides' exact notation.
   - No walls of numbers, no big numeric tables, and no stat-card rows as the main view.
3. **Direct manipulation over form controls.** Act on the thing itself: click a word to make it the query, drag a vector's arrow, scrub along the position axis, drag a score handle. **At most 2–3 visible controls per lab.**
4. **Story mode for processes.** A ▶ play / step-through with 3–6 named beats animates the data flowing, e.g. "1 · score  2 · softmax  3 · weighted sum". Each beat has one short sentence. Under `prefers-reduced-motion`, beats jump straight to their end state.
5. **One running example.** Wherever possible use the slides' own sentence, **"I like soccer" → "me gusta el fútbol"**, so I'm never decoding a new example. For the time-series part, use the bus/rail data I already know from Lecture 4.
6. **Tiny, honest numbers.** When numbers do show, use small sizes (e.g. 3–4 tokens, d = 4), so a vector is a strip of four coloured cells. Toy values are labelled as the page's own.
7. **Text budget per lab:** a title, a one-line "Try this" (*predict → change → notice*), and at most one or two short caption sentences. Explanation belongs in Read.
8. **Light challenges (optional).** For example: "Make the decoder attend mostly to 'soccer'", or "Find a d_keys where the unscaled softmax saturates". Show a quiet ✓ when one is achieved. No points, scores or gamification clutter.
9. **One visual vocabulary across the module**, defined once in CSS tokens and used everywhere:
   - one colour per role: queries, keys, values, positional signal, mask, encoder vs decoder;
   - words as outlined token boxes (not filled pills);
   - attention as beams or ribbons whose thickness or opacity is the weight;
   - matrices as heatmaps.

   Tune the colours for all three portal themes, including the dark arcade theme.
10. **Accuracy is still non-negotiable.** Every visual's meaning must match the slides. For example, slide 31 says the first two arrows into each multi-head attention layer are the keys and values and the third is the queries. "Show the maths" uses the slides' notation exactly.

**You have freedom here.**
- You may design a **new lab frame for this module**: stage-first layout, controls in context, a maths drawer, a story-mode stepper. You don't have to use the `Lab`/`Chips`/`Range`/`Stat` pattern from earlier modules.
- Build new components inside `lecture8-study/`, and don't edit the shared kit.
- SVG + CSS transitions are the default. Canvas is fine for heatmaps or images. `gsap` is already a dependency of the repo if a sequence genuinely needs it.
- Don't add new dependencies.

**Prototype before scaling.** Build two labs first: the attention-beams lab (§6) and the scaled dot-product story lab (§11).
- Screenshot them at 1440 and 390 in all three themes.
- Critique them honestly against the ten principles, including the five-second test.
- Iterate until they're clearly better than the Lecture 5 labs, then build the rest in the same visual language.

---

## Change 2: notebook pages, the Lecture 5 format with more freedom for diagrams

Build the notebook pages the way Lecture 5's are built. Read `lecture5-study/SheetPage.jsx`, `sheet.css`, `sheets/index.js` (the schema) and every `sheets/sNN.js` first. That means:
- **Layout by idea.** Each block has a blue sub-heading with its slide range, its lines, and *right there* the diagram, boxed formula, worked number, table or numbered steps that belong to it.
- **Proper sentences:** short and complete, no student shorthand.
- **No handwriting font.**
- **The four pens:** blue headings · black body, line-work, formulas and numbers · red bullet markers and step numbers only · green sparing highlights.
- **The margin** carries self-test questions (click to reveal), the occasional "remember" note, and Slide-check pointers.
- Tick-as-you-copy on every line and diagram, with stable keys.
- The grey **"Not in these notes (see Read): …"** line where a page deliberately leaves things out.
- No notebook page for the intro and summary sections.

**What's different this time:** if a concept is easier to remember as a **diagram or a table**, include it. You don't have to hold back to one diagram per section as Lecture 5 did.
- That isn't licence to add a diagram everywhere. Add one when drawing it would genuinely help me remember the idea, and keep each copyable in a minute or two.
- Typical good candidates:
  - a bidirectional layer (forward and backward readers, concatenation);
  - the encoder–decoder with attention (decoder state → scores → softmax → weighted sum);
  - Bahdanau vs Luong as a **table**, and the three Luong score functions as a **table**;
  - the scaled dot-product attention pipeline with shapes;
  - multi-head split → attend → concatenate;
  - the transformer block (Figure 16-8, simplified) with where Q, K and V come from;
  - the causal mask as a triangle;
  - self- vs cross-attention as a **table**;
  - a positional-encoding wave sketch;
  - ViT patching (16 × 16 × 3 = 768).

**Notes budget.** I'm short on time.
- **Read and Play cover every concept in the deck; the notebook carries what's worth memorising.**
- Aim for roughly **3–8 lines per content section** and **under ~100 lines across the module**. Diagrams and tables don't count against the line budget, but each must earn its place.
- **Core (in the notes):**
  - why encoder–decoders suit NMT, and why a causal RNN can't look ahead;
  - bidirectional RNNs and the four-states → two-states concatenation;
  - the training- vs testing-stage difference for the bus/rail encoder–decoder;
  - the attention idea (shorter path, weighted sum of encoder outputs, the alignment model);
  - Bahdanau (additive/concatenative) vs Luong (multiplicative), and Luong's three score functions;
  - Keras's `Attention`/`AdditiveAttention` and `return_sequences=True`;
  - queries, keys and values;
  - the transformer's overall structure and why it isn't recurrent;
  - positional encodings and their formula;
  - scaled dot-product attention (the formula, the shapes, why we scale);
  - multi-head attention;
  - self- vs cross-attention;
  - masking, and the SOS → EOS generation loop;
  - visual attention;
  - the ViT recipe and why it needs so much data (inductive biases).
- **Light (one line at most):**
  - the bus/rail Keras code and training logs;
  - the `PositionalEncoding` class's implementation;
  - the slide-43 Keras snippet (beyond `MultiHeadAttention(num_heads, key_dim, dropout)`);
  - Hugging Face.
- **Not in the notes at all:**
  - **slides 47–49**. Slide 47 says "*Materials from this slide onward are not covered in the exam*". Cover them briefly in Read, clearly flagged as not examined, with no lab needed beyond perhaps a small timeline, and no notebook page;
  - full code listings, `tf-models-official` installation, plotting code, and the reading list on slide 51.

---

## Where things are

| What | Path |
|---|---|
| **The source of truth** (51 slides) | `Documents/cits5017/lectures/cits5017-lect08-Transformers.pdf` |
| **The template module** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture5-study/` (on `main`) |
| The template's tools (copy and adapt) | `tools/dl-lecture5-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`, `check-ae.mjs`, `fashion_pipeline.py`) |
| The briefs behind Lectures 5 and 6–7 (same requirements, different decks) | `Documents/temp/prompt-dumping/build_lecture5_study_module.md`, `build_lecture6-7_study_module.md` |
| How Lecture 5 turned out (decisions, gotchas) | vault log `03-Dev-Logs/2026-10-21-dl-lecture5-study.md` |
| **Lecture 4 module** (RNNs and the bus/rail story, which this deck refers back to) | `src/components/portal/modules/deep-learning/lecture4-study/` (its `data/ridership.js`, `tools/dl-lecture4-study/build_ridership.py`, and its transcript `Documents/cits5017/markdown-lecs/lecture-4.md`) |
| Transcript format to match | `Documents/cits5017/markdown-lecs/lecture-5.md` |
| **The unit's TensorFlow environment** (read before running any Python) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css`, `common.css` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. **Warning:** pdftotext badly garbles this deck.
  - It drops α, ⊤, √, Σ, subscripts and the hats in the attention and positional-encoding maths (slides 22, 25, 32, 37–38).
  - It loses code indentation (slides 17, 35, 43).
  - It turns the **handwritten annotations** on slides 12, 13 and 42 into nonsense ("Digged", "thickened").
  - It mangles the charts on slides 11, 16 and 33.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then look at them with the Read tool. **Read every slide as an image.** Figures 15-4, 16-3, 16-5, 16-7, 16-8, 16-9, 16-10 and 16-12, the N = 2 diagram on slide 42 and the stage diagrams on slides 12–13 carry content the text doesn't.
- Don't embed slide renders or the figures' photos in the page. Rebuild figures as SVG and labs. For visual attention and ViT, draw your own simple scene (SVG or canvas); don't use external photos.

---

## Ground rules

- **Don't modify any other study module or its tools**: `lecture3-study/`, `lecture4-study/`, `lecture5-study/`, and `lecture6-7-study/` if it exists. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon. At the end, `git diff main` on those folders must be empty on your branch.
- **Copy, don't refactor.** Copy what you need into the new folder, including the ridership data from Lecture 4 (with a header saying where it came from), rather than importing across modules. Suggest a shared kit in your summary if you think it's worth it.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at the start or at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is committed and the final summary is written.
  - **When the build is finished and every gate passes, merge it into `main` yourself** (see Phase 8). The only thing you must *not* do on your own is push to GitHub.

---

## Setup

1. **Branch and working tree.**
   - Run `git status` and `git worktree list`. Another Claude instance may be building Lectures 6–7 in this folder on `feat/dl-lecture-6-7-study`.
   - **If the main working tree isn't on `main`, or has uncommitted changes you didn't make, don't switch its branch or touch its files.** Create your own worktree: `git worktree add ../wigfield-portfolio-dl8s -b feat/dl-lecture-8-study main`. Run `npm install` there, start its dev server on port **5178**, and point every check script at it (`SITE_URL`).
   - Otherwise, run `git checkout -b feat/dl-lecture-8-study main` in place, and use 5173 (start `npm run dev` yourself if nothing answers).
   - Don't commit anything new from `Documents/temp/`. Only stage files you created or deliberately changed.
2. **New folder:** `src/components/portal/modules/deep-learning/lecture8-study/`. CSS prefix `.dl8s-*`. localStorage prefix `dl8s:`. Print class `html.dl8s-printing`. Every storage read and write goes in try/catch.
3. **Register it** directly after the last existing Deep Learning lecture entry (`dl-lecture-6-7-study` if it's on `main` when you start, otherwise `dl-lecture-5-study`):
   ```js
   { id: 'dl-lecture-8-study', label: 'Lecture 8 · Transformers (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture8Study },
   ```
   It will then be at `/portal/dl-lecture-8-study`.
4. **Copy and adapt Lecture 5's module.**
   - Take the shell, `SheetPage.jsx`, `sheet.css`, `sheets/` schema + `keys.js`, `Rich.jsx`, `ui.jsx`, `hooks.js`, `storage.js`, `context.js`, `ExportPdf.jsx`, `print.js`, `texText.js`, the lazy data-loader pattern, the CSS and the diagram sheet-mode pattern.
   - **Grep the copies for Lecture 5 leftovers**: `dl5s`, `ae.js`/`aeRun.js`, the Topic 5 hero, the 27-slide footer, the Lecture 5 outcomes and NotebookLM prompt.
   - Copy `tools/dl-lecture5-study/` to `tools/dl-lecture8-study/`. **Its scripts default to port 5176**; change the default to yours.
5. **Where things live.**
   - Maths goes in `attn.js`: softmax, the attention weighted sum, Bahdanau's additive score, Luong's dot/general/concat scores, scaled dot-product attention with shapes, the head split/concatenate, the causal mask, the positional-encoding matrix (both the slide-32 formula and the slide-35 code, see the traps), ViT patch arithmetic, and parameter counts for the slides' small models.
   - Slide facts go in `slideData.js`, Read/Play prose in `sections.js`, and notebook pages in `sheets/sNN.js`.

---

## The page experience

Same as Lecture 5:
- focus mode;
- the sticky header with the current section and progress;
- one continuous scroll in slide order;
- the section rail with done marks;
- "Resume at §N";
- persisted ticks.

There are three beats per section:
- **Read:** short, with slide receipts, the slides' notation, and verbatim code in `Unfold`.
- **Play:** 1–2 labs, built to the principles in Change 1.
- **Write:** the notebook page in Change 2.

Two more things:
- **Link back to Lecture 4** where this deck does (slides 10–11 refer to Topic 4's slides 33–34): a quiet link to `/portal/dl-lecture-4-study`.
- **Never present a number or picture as the slides' result unless it's quoted or shown on them.** Anything the page trains or computes itself is labelled as this page's own.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

| § | Section | Slides | Lab ideas (suggestions, built to Change 1's principles) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | Slide 3's seven topics as a visual map linking to their sections |
| 1 | Encoder–decoder networks for NMT | 4–6 | **"The long path":** Figure 16-3 animated, with "soccer" squeezed through every encoder step into one state before "fútbol" comes out, and a path-length counter. **"The right ___":** hover "the right arm / person / to criticize" to see that a left-to-right reader can't tell what "right" means until it looks ahead |
| 2 | Bidirectional RNNs and LSTMs | 7–8 | Two readers sweep in opposite directions over the sentence; at each word their states join as two coloured halves. Then the four final states (h and c, forward and backward) fold into two (`encoder_state[::2]`, `[1::2]`), animated |
| 3 | A bidirectional RNN on the bus/rail data | 9–11 | The page's own run: drag a horizon handle from 1 to 14 days and watch the forecast drift from the truth and the error grow (slide 11's idea). "Show the maths" builds slide 9's 674 parameters from the pieces |
| 4 | An encoder–decoder for bus/rail: training vs testing | 12–13 | One diagram with a Training / Testing switch. In training, the decoder's inputs are real (day 55 + `y_train` shifted). In testing, only the first input is real; the rest start as zeros and fill in one by one as the 14-step loop runs (animated) |
| 5 | Implementing and evaluating `rnn_ed` | 14–17 | The page's own 14-day forecasts for a chosen validation window, next to the slides' printed MAEs (27,936 and 34,863.8857, labelled as the slides'); the learning-curve shape |
| 6 | Attention: a shorter path (Bahdanau) | 18–23 | **The prototype lab.** Pick a decoder step (me · gusta · el · fútbol); beams run to the encoder outputs y(0), y(1), y(2); drag score handles e(t,i) and watch softmax turn them into weights α(t,i) and the weighted sum blend. The alignment model as a tiny one-neuron scorer fed [h(2); y(i)] |
| 7 | Luong (multiplicative) attention | 24–25 | Two arrows, h and y, on a plane: drag them and watch the three scores (dot, general, concat) as bars. Trying vectors of different lengths is blocked, which shows slide 24's constraint |
| 8 | Attention in Keras; keys, values and queries | 26–28 | **Soft dictionary lookup:** keys as labelled drawers, the query as a search beam, a sharpness control from soft to hard lookup, and the values blending. The `Attention()([decoder_outputs, encoder_outputs])` line lights up the matching parts |
| 9 | The transformer: overview | 29–31 | Figure 16-8 as an explorer: hover a block for its one-sentence role; a token travels through while its shape [batch, sequence length, embedding size] stays the same; toggle N = 6 (paper) / N = 2 (slide 43) |
| 10 | Positional encodings | 32–36 | **The wave organ:** the P heatmap (Figure 16-9) with a position scrubber, the i = 100 / 101 waves, and "each position has its own fingerprint". A small switch shows slide 32's formula (1000) vs slide 35's code (10_000); see the traps |
| 11 | Scaled dot-product and multi-head attention | 37–39 | **The prototype lab.** Story mode over tiny Q, K, V heatmaps (4 tokens, d = 4): QKᵀ → ÷ √d_keys → softmax (each row sums to 1) → × V. A d_keys handle shows the unscaled softmax saturating. Then multi-head: split into H heads, each head's map differs, concatenate |
| 12 | Self- vs cross-attention; training and inference | 40–42 | A causal-mask triangle that fills in as words are generated, SOS → … → EOS, one word at a time (slides 41–42); a self/cross switch showing where Q comes from vs K and V |
| 13 | Implementing the transformer in Keras | 43 | Slide 43's code beside the block diagram: hover a line, its block lights up. **Optional, recommended:** a tiny transformer trained offline on a toy task (see "Data"), running live: type an input and watch each head's attention |
| 14 | Visual attention and the vision transformer | 44–46 | **Patch chopper:** a simple drawn scene cut into 16 × 16 patches that fly into a sequence, flatten to 768 numbers, get a position added, and enter the transformer. **Visual attention:** a caption generated word by word, with an attention glow on the drawn scene for each word (illustrative, labelled as the page's own; not a trained model) |
| 15 | Beyond the exam: later papers and Hugging Face | 47–49 | **Flagged "not examined (slide 47)".** A small timeline (DeiT, Perceiver, DINO, scaled ViTs, Flamingo, GATO) and one line on Hugging Face. No notebook page |
| 16 | Summary | 50–51 | Slide 50's six outcomes as a persisted self-check, each linking to its section; slide 51's next reading |

---

## Data and real computation

**Use the unit's TensorFlow environment for anything trained offline.** Read `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` first. In short:
- **Where it lives:** the conda env **`tf-2.20-gpu`** in the WSL distro **`Ubuntu`**. It has TensorFlow 2.21.0, Keras 3.15.1, numpy, scikit-learn, pandas and matplotlib, and it can use the RTX 5070 Ti.
- **How to call it from Windows:** use absolute paths through `wsl.exe`, e.g.:

  ```
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo or worktree path>" -e env TF_CPP_MIN_LOG_LEVEL=2 MPLBACKEND=Agg /home/james/miniconda3/envs/tf-2.20-gpu/bin/python -I tools/dl-lecture8-study/<script>.py …
  ```

- **Paths:** inside WSL, pass Linux paths (`/mnt/c/…`).
- **Use it read-only.** Don't install or upgrade anything in it, and don't touch anything else in `cits5017-project-two`. If something is genuinely missing, use a separate env or venv and say so.
- **GPU warnings** listed in the doc are expected; **don't try to "fix" CUDA**. Small models may be just as fast on the CPU (`CUDA_VISIBLE_DEVICES=-1`).

What to build:
- **Bus/rail (slides 9–17).**
  - Copy Lecture 4's ridership data, or regenerate it with `tools/dl-lecture4-study/build_ridership.py`.
  - Rebuild the windows the slides use: `X_train.shape = (1027, 56, 2)` on slide 9, which matches Lecture 4's 1,027 seventy-day training windows. Then train **`simple_biRNN`** (slide 9) and **`rnn_ed`** (slides 14–15) as written, with the early stopping shown.
  - `PrintEpochLossCallback` isn't defined on the slides, and slide 17's `predict()` loop body is elided. Implement both as the page's own and label them.
  - **Gate:** `simple_biRNN` has **674** trainable parameters (slide 9).
  - Export small, lazy-loaded files: per-horizon validation MAE (slide 11's idea), a few validation windows with 14-day forecasts, and learning curves. Label everything as this page's own run. Your MAEs won't equal the slides' 27,936 / 34,863.8857; show those as the slides' and yours as yours.
- **A tiny toy transformer (optional, recommended, time-boxed to ~30 min).**
  - Train a very small encoder–decoder transformer (e.g. N = 1–2, a few heads, small d) on a clean toy task whose attention is easy to read: reversing or sorting a short sequence of digits or letters, or a tiny vocabulary "translation".
  - Ship the weights (aim under ~250 KB), run inference in JS, and show each head's self- and cross-attention for an input I type.
  - Label it clearly as the page's own toy, not the slides' model. If it doesn't train cleanly in the time-box, drop it and say so.
- **Everything else is live in the browser** on tiny, deterministic toy values: attention weights, the three Luong scores, scaled dot-product attention, multi-head splits, masks, the positional-encoding matrix, ViT patch arithmetic.
- **Data budget:** keep the shipped data under ~500 KB in total, lazy-loaded.
- **Fallback:** if WSL or training isn't usable unattended, build the bus/rail labs from Lecture 4's data with the page's own simple stand-ins (labelled), and skip the toy transformer. Say so in your summary.

---

## PDF export and the NotebookLM prompt

Copy Lecture 5's implementation (`ExportPdf.jsx`, `print.js`, `texText.js`, `exportPrompt.js`) and adapt it.
- **"Export PDF"** goes next to "Enter focus mode". It uses a print mode plus `window.print()` (Save as PDF), so the text is real.
- **Contents:** every section's **Read + Play** only.
  - `Unfold`s expanded; footnotes and Slide checks kept.
  - Labs print a **finished, deterministic, informative state**. A story-mode lab prints its final beat, or a compact strip of its beats; an attention lab prints with a decoder step selected.
  - Every formula prints its plain-text twin. **Extend `texText.js`** for this deck's maths: α, softmax, √, ᵀ, Σ with limits, the cases brace in slide 32, and subscripts like d_keys.
- **Left out:** the notebook pages and page chrome. The PDF prints on light paper, A4.
- **§15 (not examined)** stays in the PDF but is visibly flagged.
- **The "NotebookLM video prompt ▾" dropdown:** the prompt, a Copy button with a fallback, and the three steps.

**The prompt itself, written for this deck:**
- **Grounding:** use only the PDF and follow its sections in order.
- **Audience:** a student revising for a test who knows RNNs/LSTMs (Lecture 4) and Keras but is new to attention and transformers.
- **Teaching style:** intuition first, then precise statements in the PDF's notation. Use the running example "I like soccer → me gusta el fútbol".
- **Priorities:** the attention idea → Bahdanau vs Luong → queries/keys/values → scaled dot-product attention (shapes, why we scale) → multi-head → positional encodings → masking and generation → self- vs cross-attention → the transformer's data flow → visual attention and ViT. Keep the bus/rail code light, and **skip §15 (slides 47–49, not examined)**. Point out the PDF's Slide checks.
- **Ending:** a recap plus a few self-test questions.

**Length:** the deck is long. **Plan for a two-part variant** (e.g. part 1 = §0–§8, RNN encoder–decoders to attention in Keras; part 2 = §9–§16, transformers and ViT), each with its own Copy button, alongside a single-video prompt. Re-check NotebookLM's current Video Overview options and any length limits with web search first. Lecture 5's `exportPrompt.js` records what was true on 2026-10-21. Keep each prompt under ~1,000 characters unless you confirm a larger limit. If web search isn't available, reuse Lecture 5's findings and say so.

**Testing:** stub `window.print` in every automated check, before the page loads, so a print dialog can never hang this unattended run. Then generate the PDF headlessly (`page.emulateMediaType('print')` + `page.pdf`) and check its text with `pdftotext`:
- every section title is present, in order;
- no notebook text appears;
- the attention and positional-encoding equations read correctly.

Look at a few page renders. Report the page count and file size.

---

## Accuracy traps I found while scoping (verify each, don't take my word for it)

- **Positional encodings, formula vs code.**
  - Slide 32 typesets **P_{p,i} = sin(p / 1000^{i/d})** if i is even and **cos(p / 1000^{(i−1)/d})** if i is odd.
  - Slide 35's `PositionalEncoding` code uses **`10_000 ** (i / embed_size)`**.
  - These disagree: 1000 vs 10,000. Add a **Slide check**, keep both verbatim, and make the lab's default follow the code with the formula's value as a visible switch. Don't claim which one the original paper uses; that isn't on the slides.
- **Slide 27's example is inconsistent.** It talks about translating "I like soccer", then gives the dictionary `{"subject": "They", "verb": "played", ...}`. Add a Slide check. Keep the dictionary-lookup idea, which is the point.
- **Slide 28 vs the Keras API.** The slide reads `attention_layer([decoder_outputs, encoder_outputs])` as `[queries, keys]` and says "if the values input is not provided, then it is treated as equal to the keys input".
  - Check the installed Keras's `Attention` docstring for its documented input order (it may describe the second input as the *value*, with the *key* defaulting to it).
  - If the wording differs, add a Slide check saying that with two inputs the effect is the same (keys = values = encoder outputs).
- **Slides 21–23 notation.** The weights are α(t,i) and the scores e(3,i) / e₃,ᵢ. The slide switches between subscript and parenthesis forms, so keep each as typeset. Slide 22's "the three cores" is a typo for "scores".
  - Footnote 5: h(2) is the decoder's previous hidden state; y(0), y(1), y(2) are the encoder outputs.
  - Bahdanau = concatenative = additive (slide 23).
- **Slide 25's Luong equations.** Read them from the image:
  - h̃(t) = Σᵢ α(t,i) y(i);
  - α(t,i) = exp(e(t,i)) / Σᵢ′ exp(e(t,i′));
  - e(t,i) = h(t)ᵀ y(i) (dot), h(t)ᵀ W y(i) (general), vᵀ tanh(W[h(t); y(i)]) (concat).

  The slide says the concat variant was outperformed by the two dot-product variants.
- **Slide 26 (Keras):**
  - `Attention` is Luong's (default `score_mode="dot"`; `"concat"` for the concat variant) and `AdditiveAttention` is Bahdanau's.
  - The encoder needs `return_sequences=True` (with `return_state=True`).
  - It passes the decoder's *outputs*, not its states.
- **Slides 37–38:** Attention(Q, K, V) = softmax(QKᵀ / √d_keys) V, with Q [n_queries, d_keys], K [n_keys, d_keys], V [n_keys, d_values], QKᵀ [n_queries, n_keys] and the output [n_queries, d_values]. The factor 1/√d_keys avoids saturating the softmax. Read the √ and ᵀ from the images (pdftotext drops them).
- **Slide 31:** the first two arrows into each multi-head attention layer are the **keys and values**, and the third is the **queries**. Every diagram and lab must match this.
- **Slide 9's `simple_biRNN`:**
  - 674 trainable parameters. By my arithmetic: 2 × (16·(16+2) + 16) = 608 for the bidirectional layer, plus 32·2 + 2 = 66 for the Dense layer. Re-derive it.
  - It uses `InputLayer(input_shape=[None, 2])`, while earlier decks use `shape=`. Keep it verbatim; note any Keras deprecation warning your run shows.
  - The comment says `y_train_1.shape = (1027,2)`, but `fit` uses `y_train` and `validation_data=(X_valid, y_valid_1)`, and slide 10 evaluates against `y_valid`. That's a naming quirk to record.
- **Slide 10:** "This MAE (27, 936) is slightly worse than 27,855 from the RNN in topic 4 (slide 33/52)". Check the 27,855 against `lecture-4.md` (slide 33's multi-output model with 5 input features).
- **Slides 12–14:** the encoder sees **55** days (0–54). The decoder's training inputs are day 55 plus `y_train` shifted by one step, and its outputs are `y_train` (14 days, 56–69).
  - Slide 14's comment says "14 days after the input 56 days". Record that as a quirk.
  - At test time, only the decoder's first input is real (`X_test[:,-1,:]`); the rest are zeros, and `predict` runs 14 times (slide 13).
  - If you call the training set-up "teacher forcing", label the term as beyond the slides.
- **Slide 17:** the `predict()` body is elided, `out_seq_length` vs `outseq_len` and `model` vs `rnn_ed` don't match, and "Validation set MAE = 34,863.8857" is "the lowest validation MAE so far for multi-task predictions for 14 days ahead". Don't compare it like-for-like with Lecture 4's rail-only `ahead_model` (33,887).
- **Slide 11's chart and slide 16's learning curves** print no exact values. Describe their shape; don't read numbers off them as the slides'.
- **Slide 43:** `N=2` (instead of 6), `num_heads=8`, `dropout_rate=0.1`, `n_units=128`, `key_dim=embed_size`, and `encoder_pad_mask = tf.math.not_equal(encoder_input_ids, 0)[:, tf.newaxis]`. The code is a partial sketch ("# ... add in other layers as shown in Figure 16-8"); keep it verbatim and don't complete it as if it were the slides'.
- **Slide 46 (ViT):** 16 × 16 squares → 16 × 16 × 3 = 768-dimensional vectors → a linear layer that keeps the dimensionality → positional embeddings → the transformer. It "required over 300 million additional images", because transformers lack CNNs' inductive biases. The slides give no input image size, so if a lab assumes one (e.g. 224 × 224 → 196 patches), label it as the page's own.
- **Slide 47:** "(Materials from this slide onward are not covered in the exam)", covering slides 47–49. Slide 48 prints "10, 000 images", 90.4% and 84.8%.
- **Wording quirks to record, not fix:**
  - "Chapters 16." (slide 2);
  - slide 18's sentence with a missing clause ("along with all needs to be carried");
  - footnote 7's "Attention Is All You Nee";
  - slide 30's "multi-header attention";
  - slide 39's "done efficiently in Python";
  - slide 41's "The green softmax layer have".
- **The handwritten annotations** on slides 12, 13 and 42 carry content ("55 days", "y_train has 14 days' ground truth data", "X_train has 56 days' data", the N = 2 figure). Transcribe them from the images.
- **Footnotes** go in `REFS` with `Fnote`: Word2Vec/GloVe/fastText (2), Bahdanau 2014 (4), Luong 2015 (6), Vaswani 2017 (7), `tf-models-official` (8), Xu 2015 (9), Dosovitskiy 2020 (10), and 11–16 (the not-examined papers).
- Use the `slideNote` ("Slide check") block for every real discrepancy. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. Short intuition that explains a slide is welcome; new syllabus content isn't. Use the textbook only to interpret a figure. Common transformer knowledge that isn't on the slides stays out, or is clearly labelled as beyond the slides when a lab genuinely needs it.
- Keep the deck's names (`simple_biRNN`, `rnn_ed`, `encoder_state`, `attention_layer`, `PositionalEncoding`, `pos_embed_layer`, `encoder_pad_mask`, …) and Keras calls exactly as written. Code blocks are verbatim: fix pdftotext's wrapping and indentation against the images.

## Design rules
- Theme everything from the portal tokens. Check all three portal themes (Jade, Coral, Arcade/dark).
- The notebook keeps its paper feel, with the pen colours tuned per theme (contrast of at least 4.5:1).
- No coloured rounded left-border callout boxes and no filled badge pills. That includes token boxes and tabs: use outlined or ruled shapes. Code uses the kit's VS Code `Code` block.
- Respect `prefers-reduced-motion` everywhere, which matters a lot with story-mode labs. Everything is keyboard reachable: story steps, draggable handles (arrow keys) and token selection. No emoji.
- It must work at laptop width, in fullscreen, and at 390px wide with no horizontal page scroll. On narrow screens, labs simplify rather than shrink into illegibility.

---

## Subagents: use them for accuracy, coverage and lab quality, within a sensible budget

You may spawn subagents wherever they make the result more accurate or better to learn from. **Don't drain my usage:**
- Aim for about **10 agents in total** for this larger deck, and treat ~13 as a hard ceiling.
- Prefer one well-briefed agent over several overlapping ones.
- Don't re-run audits on content that hasn't changed.
- Launch independent agents in one message so they run in parallel.
- Give each agent a self-contained brief.
- Use fresh general-purpose agents (not forks) for audits.

A sensible allocation:

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **2 transcribers** | Slides 1–25 and 26–51 |
| Ground truth | **1 training/data agent** | Bus/rail models + the toy transformer |
| Build (optional) | **Up to 2 lab builders** | Only *after* you've built the two prototype labs yourself and fixed the visual language. Each owns one or two `labs/*.jsx` files and follows the principles and tokens exactly. Review everything they write |
| Audit | **3 auditors** | Content fidelity + coverage · numbers + maths (re-derive every shape, parameter count, score and formula; check every "page's own" label) · learning design + visuals |
| Re-audit | **1–2 re-auditors** | Only on sections changed by the fixes |

**The learning-design + visuals auditor** checks every lab against Change 1's ten principles:
- the five-second test from screenshots;
- number walls, more than 3 controls, text over budget;
- whether the opening state shows the idea;
- the running example and the visual vocabulary;
- reduced motion;
- 390px.

It also checks:
- the notebook pages against Change 2 (diagrams that earn their place, the budget, no notes for slides 47–49);
- the generated PDF;
- the NotebookLM prompts.

## Process

### Phase 1: Ground truth (start first; do Phase 2 while it runs)
- **The transcribers** write `Documents/cits5017/markdown-lecs/lecture-8.md` in the format of `lecture-5.md`, which you merge:
  - `## Slide N — title`, prose verbatim;
  - every equation in LaTeX **exactly as typeset**;
  - code verbatim with correct indentation;
  - **the handwritten annotations transcribed**;
  - every figure described precisely: arrows, which inputs feed which layer, labels, colours that carry meaning;
  - a closing **Quirks** list.

  Commit this transcript.
- **The training/data agent** reads `ENVIRONMENT_SETUP.md`, then builds and runs the pipeline. It reports the 674 gate, what ran verbatim and what was implemented as the page's own, the epochs and device, the toy transformer's result, and the export sizes.

### Phase 2: Orient (you, while Phase 1 runs)
- Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks, and the Lecture 5 dev log.
- Read every file in `lecture5-study/` and `tools/dl-lecture5-study/`.
- Read Lecture 4's §1–§11 sections and labs (this deck builds on them), and **look at two or three Lecture 5 labs in the browser**, so you can see the dense pattern I want you to move away from.

### Phase 3: Visual language and prototypes (you)
- Define the module's visual vocabulary: role colours as tokens per theme, token boxes, beams, heatmaps, the story-mode stepper, the "Show the maths" drawer.
- Build §6 and §11 completely (Read → Play → Write).
- Screenshot them, critique them against the ten principles, and iterate. **Don't move on until those two labs are clearly inviting.**

### Phase 4: Remaining sections, then the PDF export
- Build the rest in the same visual language. Delegate up to two builders' worth of labs if it helps.
- `sections.js` and `sheets/` stay yours, so the voice is consistent.
- Then build the export, both NotebookLM prompts, and the PDF checks.

### Phase 5: Audit (parallel, read-only, fresh agents)
Each auditor returns findings as: slide N · file:line · what the slide says (quoted) · what the page says · severity (**wrong** / **misleading** / **missing** / **polish**). The learning-design auditor may also report **"overwhelming"** as a severity, with the principle it breaks.

### Phase 6: Fix, re-audit, verify (you)
- Fix every **wrong**, **misleading**, **missing** and **overwhelming** finding, or justify it in the summary. Re-audit only what changed.
- Adapt `tools/dl-lecture8-study/page-check.mjs` from Lecture 5's. It checks:
  - render and coverage of slides 1–51;
  - pens and contrast, and no handwriting font;
  - focus mode;
  - ticks persist across a reload, and "Resume at §N" works;
  - the page renders with localStorage throwing, and with reduced motion (story labs jump to their end state);
  - keyboard operation of at least the §6 and §11 labs;
  - the stubbed export plus `afterprint`, and the PDF's text;
  - the NotebookLM dropdown;
  - 3 themes × 1440/390 with no horizontal scroll;
  - **Lectures 3, 4, 5 (and 6–7 if present) still render**.
- Add `check-attn.mjs` assertions for `attn.js`:
  - softmax rows sum to 1;
  - scaled dot-product attention output shapes for the slide-37/38 shapes;
  - the three Luong scores on known vectors;
  - Bahdanau's additive score;
  - the causal mask;
  - the head split/concatenate round trip;
  - the positional-encoding matrix vs slide 35's code;
  - 674;
  - 16 × 16 × 3 = 768.
- Gates:
  - lint the new folder, `registry.js` and the tools folder clean (report pre-existing repo-wide errors, don't fix them);
  - `npm run build` passes;
  - the page check passes;
  - the diffs on the other modules are empty.

### Phase 7: Wrap-up
- **Commit** on `feat/dl-lecture-8-study` with the attribution line your environment specifies. Then merge into `main` as described in Phase 8.
- **Vault** (repo `CLAUDE.md`): create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and add the module to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`. Record the new lab design approach, so future modules can reuse it.
- **Memory:** update your auto-memory's Management Portal pointer with one line about this module and its lab-design principles.
- **Final summary:**
  - what was built: sections, lab count, notebook line and diagram counts;
  - **how the labs differ from Lectures 4–5**, with two or three screenshot paths;
  - what you left out of the notes and why;
  - every Slide check note and why;
  - the 674 gate and the training results (real vs page's own);
  - whether the toy transformer shipped;
  - the PDF's page count and size;
  - **the NotebookLM prompts, pasted in full**, plus the format to choose;
  - decisions you made;
  - anything unverified;
  - how many subagents you used;
  - follow-ups.

### Phase 8: Merge into `main` (required; this is the last thing you do)
I've been annoyed that recent builds were left on unmerged branches. **This build must end merged into `main`.** Do this after the commit, the vault and memory updates, and all gates have passed. Write the final summary *after* the merge.

1. **Find where `main` is checked out:** run `git worktree list`.
2. **Merge.** Use a merge commit: `git merge --no-ff feat/dl-lecture-8-study -m "Merge feat/dl-lecture-8-study: Lecture 8 (Transformers) study module"`.
   - If `main` isn't checked out anywhere (e.g. the main tree is on another instance's branch), run `git checkout main` in **your** working tree and merge there.
   - If `main` is checked out in another working tree, and that tree is clean apart from untracked `Documents/temp/` files, merge there with `git -C <that path> merge --no-ff …`.
   - If `main` is checked out somewhere **with uncommitted changes you didn't make**, don't touch that tree. Leave the branch unmerged and say so in the **first line** of your summary, with the one command I need to run.
3. **Conflicts.** The only expected conflict is `registry.js`, if another lecture's entry landed on `main` meanwhile. Resolve it by keeping both entries in lecture order. For any other conflict, run `git merge --abort`, leave the branch unmerged, and report it in the first line of your summary.
4. **Verify on `main`.** After the merge, run `npm run build` and the page check (`tools/dl-lecture8-study/page-check.mjs` against a dev server serving `main`). If something fails, fix it with a follow-up commit on `main`. Never use force, reset or rewrite history.
5. **Tidy up**, so nothing is left dangling:
   - stop your dev server;
   - if you built in a worktree, remove it with `git worktree remove ../wigfield-portfolio-dl8s` (run from the main repo);
   - delete the merged branch with `git branch -d feat/dl-lecture-8-study`.
6. **Don't push.** Pushing to GitHub stays my call. End the summary with `main` is N commits ahead of `origin/main`.

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data files with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks/timers/rAF), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lecture8-study/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, so every formula needs a plain-text twin in print (`texText.js`).
- Lecture 5's contrast check resolved `color-mix()` paper colours through a 1×1 canvas pixel; reuse that.
- **WSL from Windows.**
  - Bare `python`/`conda` aren't found in non-interactive WSL shells, so always use the env's absolute binary path.
  - Put non-trivial code in `.py` files.
  - Set `MPLBACKEND=Agg` for plotting.
  - Prefix the command with `MSYS_NO_PATHCONV=1` from Git Bash.
- Port 8787 belongs to another project. Ports 5174–5177 may be in use by other worktrees.
