# Build: CITS5017 Lectures 1–2 Refresher (Intro to ANNs + Training DNNs): one combined study module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with a study module for each later lecture. Each is one continuous page that I work down in focus mode: **Read → Play → Write**.

Build **one combined refresher module for the first two lectures**:
- `Documents/cits5017/lectures/cits5017-lect01-IntroToANNs.pdf`: Topic 1, "Introduction to Artificial Neural Networks", 64 slides, Géron Chapter 10;
- `Documents/cits5017/lectures/cits5017-lect02-Training-DNNs.pdf`: Topic 2, "Training Deep Neural Networks", 68 slides, Géron Chapter 11.

**What's different about this one:** I've already studied both lectures and know them well. This module is a **refresher**: quick, optimised and effective. It should:
- **heavily summarise**, focusing only on the key concepts and getting straight to the point;
- still **briefly cover all the content of both lectures**, so nothing is silently dropped;
- **say clearly, everywhere, which lecture each piece of content comes from** (Lecture 1 or Lecture 2);
- **cram all the note-taking into at most 3 notebook pages for the whole module**, not one page per section.

**The template is the Lecture 8 study module**, the best one so far: "Lecture 8 · Transformers (Study)", `/portal/dl-lecture-8-study`, `src/components/portal/modules/deep-learning/lecture8-study/`. Copy its shell, its lab design and kit, its notebook-page format, and its PDF export with the NotebookLM prompt. Only the content and the changes below differ.

Accuracy still matters as much as ever.
- Every claim, number, equation and code line comes from the slides, in the slides' own notation.
- Summarising means *leaving detail out*, never paraphrasing a fact into something the slides don't say.

> **Note on a saved preference:** your auto-memory has an older rule: "no long-scroll pages, use top tabs". **It doesn't apply here.** Study modules are deliberately one continuous page worked through in focus mode. The other saved rules still apply:
> - no tone-coloured callout boxes or filled pills;
> - VS-Code-style code blocks;
> - no walls of text.

---

## Structure: two parts, short sections, three notebook pages

Organise the page as **Part 1 · Lecture 1** and **Part 2 · Lecture 2**. Each section has a short Read and (usually) one Play lab. The **Write beat moves to the end of each group of sections** as a single notebook page, giving **three notebook pages in total**:

| Notebook page | Covers | Placed |
|---|---|---|
| **Page 1 · Lecture 1** | Perceptrons → MLPs → Keras → hyperparameters | after the last Lecture 1 section |
| **Page 2 · Lecture 2: stable training** | Vanishing/exploding gradients, initialisation, activations, batch norm, clipping, transfer learning | after the Lecture 2 transfer-learning section |
| **Page 3 · Lecture 2: faster and regularised training** | Optimisers, learning-rate schedules, ℓ1/ℓ2, dropout, practical guidelines | after the last Lecture 2 section |

Adjust the page boundaries if the content balances better another way, but **never more than three pages**. The index rail lists the three notebook pages as their own items, so I can jump straight to them.

### Making the source lecture obvious
- The rail and the page are grouped under **"Lecture 1 · Introduction to ANNs"** and **"Lecture 2 · Training DNNs"** headings.
- Every section header and slide receipt names its lecture, e.g. **"L1 · slides 9–17"** or **"L2 · slides 33–47"**.
- Give each lecture a quiet, consistent marker: an outlined "L1"/"L2" label or a ruled edge mark, not a filled pill. Tune it for all three themes.
- On the notebook pages, every block's slide range is written as **"L1 · 18–23"**.
- The PDF and the NotebookLM prompt keep the same labels.

---

## Read: heavily summarised, straight to the point

For each section:
- **Open with one bold "gist" sentence:** the single thing to remember.
- **Then 2–5 tight bullets or short sentences**, plus at most **one** compact table or key formula where it carries the idea. Aim for roughly **≤ 120 words of prose per section**.
- **Verbatim code** goes in an `Unfold` and is only included when a line of it is itself a key concept: `model.compile(loss="sparse_categorical_crossentropy", …)`, `kernel_initializer="he_normal"`, `BatchNormalization()`, `Dropout(rate=0.2)`, the optimiser constructors, etc. Everything else is a one-line mention.
- **Minor slides get a one-line mention**, so coverage is complete without padding: TensorBoard usage, saving/restoring, the Scikit-Learn perceptron demo, the subclassing API's details, the learning-rate schedule implementations.
- Use tables wherever they compress a comparison, e.g. activation functions, initialisations, optimisers, schedules, and the Sequential vs Functional vs Subclassing APIs.
- Keep "Slide check" notes (`slideNote`) for real discrepancies, as every earlier module does. **Never silently "correct" the slides.**
- Add an optional quiet **"Go deeper"** link per section to the full interactive lecture modules already in the portal: `/portal/dl-lecture-1` and `/portal/dl-lecture-2`. Don't edit those modules.

## Play: Lecture 8's lab design, but fewer and quicker

Use Lecture 8's lab principles and kit unchanged. Read the "new lab design" section of the vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`, and `lecture8-study/stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`, `useWidth.js` and `stage.css`. In short:
- one idea per lab, visible in five seconds, opening on its "aha" state;
- picture first, numbers on demand (hover, plus a "Show the maths" drawer in the slides' notation);
- direct manipulation, at most 3 controls;
- story mode for processes;
- one running example per lecture;
- tiny honest numbers;
- a text budget of a title, a one-line "Try this" and at most two caption sentences;
- quiet optional challenges;
- one visual vocabulary of role colours defined as tokens per theme.

**For a refresher:**
- **Aim for about one lab per section, roughly 12–16 in total**, each one quick.
- A section that's a list of facts (saving/restoring, TensorBoard) may have no lab.
- No offline model training is needed; everything runs live in the browser on tiny toy problems.

Lab ideas (suggestions):

| Lecture | Lab ideas |
|---|---|
| **L1** | **Perceptron:** drag points or weights and watch the decision line and the learning rule's update, with η and (y − ŷ) highlighted · **XOR:** no single line separates it; add a hidden layer and it's solved · **Backprop story:** forward → loss → backward → update on a tiny 2-2-1 net · **Activation gallery:** step, sigmoid, tanh, ReLU and their derivatives, with saturation shaded · **Output layers:** regression (MSE/MAE/Huber) vs classification (softmax + cross-entropy) as a switch · **Keras APIs:** the Sequential vs Functional (wide & deep) vs Subclassing shapes · **Learning rate:** the slide-60 loss-vs-learning-rate sweep, with its heuristics marked |
| **L2** | **Gradient flow through depth:** bars per layer for random init vs Glorot/He and sigmoid vs ReLU, computed live · **Activation shoot-out:** leaky ReLU, ELU, SELU, GELU, Swish; hover to see where each saturates or dies · **Batch norm:** a layer's input distribution before and after normalising, scaling and shifting · **Gradient clipping:** clip by value vs clip by norm, showing that by-value can change the gradient's direction · **Transfer learning:** freeze and unfreeze layers · **Optimiser race:** SGD, momentum, NAG, AdaGrad, RMSProp and Adam on one 2D loss surface (the classic, very visual) · **LR schedules:** power, exponential, piecewise, performance and 1cycle on one chart · **ℓ1 vs ℓ2:** weights shrinking (ℓ1 to zero) · **Dropout:** neurons dropping each step during training, none at test |

## Write: at most 3 notebook pages for the whole module

Use Lecture 8's notebook-page format (`lecture8-study/SheetPage.jsx`, `sheet.css`, `sheets/index.js` schema). That means:
- layout by idea;
- proper, short sentences, with no student shorthand and no handwriting font;
- **the four pens:**

  | Pen | Used for |
  |---|---|
  | **Blue** | headings and the "L1/L2 · slides" receipts |
  | **Black** | body, line-work, formulas and numbers |
  | **Red** | bullet markers and step numbers only |
  | **Green** | sparing highlights |

- self-test questions in the margin;
- tick-as-you-copy with stable keys.

**Each page must fit one real notebook page.** I copy them by hand, so a "page" means one side of a ruled notebook page.
- **Budget: 30 ruled lines of height per page, everything included**: text lines, table rows, formula boxes and diagrams, measured in the sheet's own rule units.
- **Make it measurable.** The sheet already sits on ruled lines, so compute its height in rules at a fixed reference width (e.g. the sheet at 760 px). Show a quiet "fits one page" indicator, and **assert ≤ 30 rules per page in the page check**.

**What earns a place on these pages:** only the key concepts, as dense as clarity allows.
- **Prefer tables** for comparisons (they compress best), e.g.:
  - activation functions: formula/shape · saturates? · when to use;
  - Glorot vs He (vs LeCun for SELU): which activations, fan-in/fan-out idea;
  - optimisers: the idea in one line · key hyperparameters;
  - learning-rate schedules: the shape in a few words;
  - slide 65's practical-guidelines defaults table.
- **Prefer a few boxed formulas** only where the formula *is* the concept. Likely: the perceptron learning rule, Glorot/He variance, the momentum and Adam updates (if they fit), the BN transform.
- **Diagrams** only where a sketch beats words and fits the budget, e.g. XOR, a tiny MLP with backprop arrows, wide & deep, dropout.
- **Margin questions:** a few per page, for recall.
- **The grey "Not in these notes (see Read): …" line** at the bottom of each page names what was deliberately left out.

---

## Where things are

| What | Path |
|---|---|
| **The sources of truth** | `Documents/cits5017/lectures/cits5017-lect01-IntroToANNs.pdf` (64 slides), `…/cits5017-lect02-Training-DNNs.pdf` (68 slides) |
| **Existing transcripts** (from an earlier build; no Quirks list; verify them, see Process) | `Documents/cits5017/markdown-lecs/lecture-1.md`, `lecture-2.md` |
| **The template module** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture8-study/` |
| The template's tools (copy and adapt) | `tools/dl-lecture8-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`, `check-attn.mjs` as the pattern for a maths check) |
| How Lecture 8 was built (lab design rules, gotchas) | vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`; brief `Documents/temp/prompt-dumping/build_lecture8_study_module.md` |
| The full interactive Lecture 1 and 2 modules (reference for ideas, link targets; **don't edit**) | `src/components/portal/modules/deep-learning/lecture1/`, `lecture2/` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css`, `common.css` |
| The unit's TensorFlow environment (only if you choose to verify a Keras number; not needed for the build) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md`. **Read-only: install nothing in it.** |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. It garbles the maths: ℓ1/ℓ2 come out as "1 and 2", and σ, η, ∇, β, ε and subscripts drop.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then look at them with the Read tool. **Read every equation and figure from the image.** Don't embed slide renders in the page.

---

## Ground rules

- **Don't modify any other module or its tools**: `lecture1/`, `lecture2/`, `lecture3/`, `lecture3-study/` … `lecture8-study/`, `arcade/`, `codelab/`, `game/`, `project2/`. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon.
  - The one exception: you may **append a "Quirks" section and make minimal, clearly noted corrections** to `lecture-1.md` / `lecture-2.md` when the slide images prove a transcript wrong. List every correction in your summary.
- **Copy, don't refactor.** Copy what you need from `lecture8-study/` into the new folder; don't import across modules.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at the start or at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is on `main` (see "Git") and the final summary is written.
  - The only thing you must *not* do on your own is push to GitHub.

---

## Git: the final result must be on `main`

I'm tired of builds ending on unmerged branches. **When you finish, all of this work is committed on `main`**, and no branch or worktree for this build is left behind.

1. **Check the state first:** `git status`, `git branch --show-current`, `git worktree list`.
2. **Normal case: the main working tree is on `main` and clean** (untracked files in `Documents/temp/` don't count). **Work directly on `main`; don't create a feature branch.**
   - Commit at sensible milestones: shell + first sections · all sections · export · audit fixes · checks.
   - **Every commit must leave `npm run build` passing.**
   - Use the dev server on 5173, or start `npm run dev` yourself as a background task if nothing answers.
3. **Only if the main tree is on another branch or has uncommitted changes you didn't make** (another Claude instance may be working there):
   - Don't touch that tree. Build in a worktree instead: `git worktree add ../wigfield-portfolio-dl12r -b tmp/dl12r-refresher main`, with `npm install` and a dev server on port 5179.
   - At the end, merge into `main` with `git merge --no-ff tmp/dl12r-refresher -m "Merge: Lectures 1–2 refresher study module"`. Do it in whichever working tree has `main` checked out, if that tree is clean; otherwise check out `main` in your worktree if `main` isn't checked out anywhere.
   - Resolve a `registry.js` conflict by keeping every entry in lecture order. For any other conflict, run `git merge --abort` and report it.
   - Then run `npm run build` and the page check on `main`, stop your dev server, run `git worktree remove ../wigfield-portfolio-dl12r`, and run `git branch -d tmp/dl12r-refresher`.
   - If `main` is checked out in a tree **with someone else's uncommitted changes**, don't touch it. Say so in the **first line** of your summary, with the exact command for me to run.
4. **Final verification:** `git log --oneline -5 main` shows the work, `git status` is clean, `git branch` and `git worktree list` show nothing left over from this build. **Don't push.** End the summary with "`main` is N commits ahead of `origin/main`".

`Documents/temp/` holds my prompt files: don't commit anything new from it. Only stage files you created or deliberately changed.

---

## Setup

1. **New folder:** `src/components/portal/modules/deep-learning/lectures1-2-refresher/`. CSS prefix `.dl12r-*`. localStorage prefix `dl12r:`. Print class `html.dl12r-printing`. Every storage read and write goes in try/catch.
2. **Register it directly before the `dl-lecture-3-study` entry**, so the study modules run in lecture order:
   ```js
   { id: 'dl-lectures-1-2-refresher', label: 'Lectures 1–2 · Refresher (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLectures12Refresher },
   ```
   It will then be at `/portal/dl-lectures-1-2-refresher`.
3. **Copy and adapt Lecture 8's module.**
   - Take the shell, the stage/story/svg lab kit, `SheetPage.jsx`, `sheet.css`, the `sheets/` schema + `keys.js`, `Rich.jsx`, `ui.jsx` (if used), `hooks.js`, `storage.js`, `context.js`, `ExportPdf.jsx`, `print.js`, `texText.js` and the CSS.
   - **Grep the copies for Lecture 8 leftovers**: `dl8s`, attention/role tokens you don't need, the Topic 8 hero, the 51-slide footer, the Lecture 8 outcomes and NotebookLM prompt.
   - Copy `tools/dl-lecture8-study/` to `tools/dl-lectures1-2-refresher/`, and check the scripts' default port.
4. **Adapt the shell to the two-part structure:**
   - the lecture groups in the rail and on the page;
   - the "L1/L2 · slides" receipts;
   - Write pages that belong to a *group of sections* instead of one section;
   - progress and done marks that count each notebook page once;
   - "Resume at §N" still working.
5. **Where things live.**
   - Maths goes in `nn.js`: the perceptron step and learning rule, activations and their derivatives, a tiny MLP forward/backward pass, per-layer gradient magnitudes under different inits and activations, the BN transform, clipping by value and by norm, the optimiser update rules, the schedule formulas, the ℓ1/ℓ2 penalties, and a dropout mask.
   - Slide facts go in `slideData.js`, Read/Play prose in `sections.js`, and the three notebook pages in `sheets/`.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

**Part 1 · Lecture 1 (L1, slides 1–64)**

| § | Section | L1 slides |
|---|---|---|
| 1.0 | Intro: how to use this refresher; slide 3's topics | 1–3 |
| 1.1 | Perceptrons and TLUs: computing the outputs | 4–8 |
| 1.2 | Training a perceptron (Hebb's rule), the decision boundary, Scikit-Learn, vs logistic regression, the XOR weakness | 9–17 |
| 1.3 | Multi-layer perceptrons, backpropagation, activation functions | 18–23 |
| 1.4 | Regression and classification MLPs (output layers, losses) | 24–31 |
| 1.5 | Keras Sequential API: the image classifier and the regression MLP | 32–42 |
| 1.6 | Functional and Subclassing APIs | 43–49 |
| 1.7 | Saving/restoring, callbacks, TensorBoard | 50–56 |
| 1.8 | Fine-tuning hyperparameters, and the Lecture 1 summary | 57–64 |
| | **Notebook page 1 · Lecture 1** | |

**Part 2 · Lecture 2 (L2, slides 1–68)**

| § | Section | L2 slides |
|---|---|---|
| 2.0 | Slide 3's topics | 1–3 |
| 2.1 | Problems in training DNNs; vanishing/exploding gradients; Glorot and He initialisation | 4–9 |
| 2.2 | Nonsaturating activation functions, and which to use | 10–22 |
| 2.3 | Batch normalisation | 23–28 |
| 2.4 | Gradient clipping | 29 |
| 2.5 | Transfer learning with Keras | 30–32 |
| | **Notebook page 2 · Lecture 2: stable training** | |
| 2.6 | Faster optimisers: momentum, NAG, AdaGrad, RMSProp, Adam and its variants | 33–47 |
| 2.7 | Learning-rate scheduling | 48–59 |
| 2.8 | Avoiding overfitting: ℓ1/ℓ2 regularisation and dropout | 60–64 |
| 2.9 | Summary and practical guidelines | 65–68 |
| | **Notebook page 3 · Lecture 2: faster and regularised training** | |

Every slide of both decks must land in exactly one section; the page check verifies coverage of L1 1–64 and L2 1–68. Use plain numbering if the "1.x / 2.x" scheme doesn't suit the copied shell, as long as the lecture is always visible.

---

## PDF export and the NotebookLM prompt

Copy Lecture 8's implementation and adapt it.
- **"Export PDF"** uses a print mode plus `window.print()`.
- **Contents:** every section's **Read + Play** only, labs in their finished state, and every formula with its plain-text twin (extend `texText.js` for η, σ, ∇, β, ε, ℓ1/ℓ2 and the optimiser updates).
- **Left out:** no notebook pages and no chrome. The PDF prints on light paper, A4, with the "L1/L2 · slides" receipts.
- **The "NotebookLM video prompt ▾" dropdown:** a **refresher video** prompt for a student who has already studied both lectures and wants a brisk, accurate recap of the key concepts in order. It names the lecture each part comes from, uses the PDF's notation, makes the comparison tables vivid (activations, initialisations, optimisers, schedules), and ends with quick self-test questions.
  - Also offer a **two-part variant** (part 1 = Lecture 1, part 2 = Lecture 2), each with its own Copy button.
  - Re-check NotebookLM's current Video Overview options with web search; Lecture 8's `exportPrompt.js` records what was true on 2026-10-22. Keep each prompt under ~1,000 characters unless you confirm a larger limit. If web search isn't available, reuse Lecture 8's findings and say so.
- **Testing:** stub `window.print` in every automated check, before the page loads, so a print dialog can't hang this unattended run. Then generate the PDF headlessly and check with `pdftotext`:
  - every section title is present, in order, with its L1/L2 receipt;
  - no notebook text appears;
  - the formulas are readable.

  Report the page count and file size.

---

## Accuracy traps I noticed while scoping (verify each, don't take my word for it)

- **The existing transcripts weren't built with this pipeline** and have no Quirks lists. Treat the slide images as the truth (see Process).
- **L1 slide 5's title** reads "The Perception (cont.)", a typo for Perceptron. Record it; don't propagate it.
- **L1 slide 60** gives two learning-rate heuristics: the optimal rate is "about half of the maximum learning rate", and, from a sweep (e.g. 10⁻⁵ to 10 over 500 iterations), it's "about 10 times lower" than where the loss shoots up. Keep both as stated.
- **L1 slide 61's batch-size advice is deliberately two-sided** (small batches 2–32 vs large batches with learning-rate warmup). Don't collapse it into one recommendation.
- **L1 slides 35–36 (Fashion MNIST):** 60,000 / 10,000 images and a 784 → 300 → 100 → 10 model. Re-derive any parameter count you show from the slides' own layers, and only present a count as the slides' if a slide prints it.
- **L2 slide 63 (dropout):** the slide says that after training "you simply use the connection weights that have been learned". It says nothing about rescaling. Don't add inverted-dropout scaling unless you label it as beyond the slides.
- **L2 slide 64:** comparing training and validation loss is misleading with dropout on, so evaluate the training loss without dropout. Keep this; it's examinable-style.
- **L2 slides 65–66:** two default-configuration tables, kept verbatim:
  - general: He init · ReLU if shallow, Swish if deep · BN if deep · early stopping, weight decay if needed · NAG or AdamW · performance scheduling or 1cycle;
  - self-normalising: LeCun init · SELU · none · "Alpha dropout if needed (not covered in CITS5017)" · NAG · performance or 1cycle.

  Mark alpha dropout as not covered, as the slide does.
- **Read every optimiser update rule (L2 slides 33–47) and every schedule formula (slides 48–59) from the images.** pdftotext drops the Greek letters and subscripts, and these are the easiest places to introduce an error when summarising.
- **ℓ1/ℓ2** appear as "1 and 2" in pdftotext output. Always render them as ℓ1/ℓ2.
- Use `slideNote` ("Slide check") for every real discrepancy you find. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair, summary over detail.** Every claim, number, equation and code snippet comes from the slides. Summarising means choosing what to keep, not rewording facts into new ones. Short intuition that explains a slide is welcome; new syllabus content isn't.
- Keep the deck's names, Keras calls and notation exactly as written. Code is verbatim (fix pdftotext's wrapping against the image).

## Design rules
- Same as Lecture 8: portal theme tokens; all three themes (Jade, Coral, Arcade/dark); pen colours tuned per theme (contrast of at least 4.5:1); no coloured left-border callouts and no filled pills (that includes the L1/L2 markers); VS Code `Code` blocks; `prefers-reduced-motion` respected (story labs jump to their end state); everything keyboard-reachable; no emoji.
- It must work at laptop width, in fullscreen, and at 390px wide with no horizontal page scroll.

---

## Subagents: a lean budget (this is a refresher)

Use subagents where they make the result more accurate. Aim for about **7 in total**, and treat **9** as a hard ceiling.
- Launch independent agents in one message so they run in parallel.
- Give each a self-contained brief.
- Use fresh general-purpose agents (not forks) for audits.

A sensible allocation:

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **2 transcript verifiers** (L1 and L2) | Render every slide, compare it with `lecture-N.md`, and report errors with slide numbers. They append a Quirks list and make only minimal, listed corrections. They also return a one-page "key concepts" digest per lecture, which helps you choose what goes on the three notebook pages |
| Build (optional) | **1 lab builder** | Only after you've built the first two or three labs and fixed the visual language |
| Audit | **3 auditors** | Fidelity + coverage (every slide of both decks in Read or Play; every L1/L2 label correct; nothing summarised into something the slides don't say) · numbers + maths (every formula, update rule, schedule and count re-derived against the images) · design + learning (labs vs Lecture 8's principles, the five-second test, the **three-page budget measured**, the PDF and the NotebookLM prompts) |
| Re-audit | **1 re-auditor** | Only on what changed |

## Process

1. **Git check and orient** (see "Git").
   - Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks, and the Lecture 8 dev log.
   - Read every file in `lecture8-study/` and `tools/dl-lecture8-study/` yourself.
   - Start the two transcript verifiers first, so they run while you read.
2. **Build the shell:** two parts, lecture markers, group-level notebook pages, the page-fit measurement.
3. **Build Part 1** completely, including **notebook page 1**. Screenshot it at 1440 and 390 in all three themes, and check:
   - Does it read as a fast refresher?
   - Does the notebook page fit 30 rules?
   - Is the lecture always obvious?

   Fix the format before going on.
4. **Build Part 2** and notebook pages 2 and 3, then the PDF export and the NotebookLM prompts.
5. **Audit, fix, re-audit.** Fix every **wrong**, **misleading**, **missing** and **overwhelming** finding, or justify it in the summary.
6. **Verify.**
   - Adapt `page-check.mjs`. It checks:
     - coverage of L1 1–64 and L2 1–68;
     - every section shows its L1/L2 receipt;
     - **exactly 3 notebook pages, each ≤ 30 rules at the reference width**;
     - pens, contrast and no handwriting font;
     - focus mode;
     - ticks persist across a reload, and "Resume at §N" works;
     - the page renders with localStorage throwing and with reduced motion;
     - the stubbed export plus `afterprint`, and the PDF's text;
     - the NotebookLM dropdown;
     - 3 themes × 1440/390 with no horizontal scroll;
     - **every other Deep Learning module still renders**.
   - Add `check-nn.mjs` for `nn.js` (the learning rule, activations and derivatives, the BN transform, clipping, the optimiser steps on a known gradient, the schedules, the penalties).
   - Lint the new folder, `registry.js` and the tools folder clean, and run `npm run build`.
7. **Wrap-up, then finish on `main`** (see "Git").
   - **Vault:** create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and add the module to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
   - **Memory:** add one line to your auto-memory's Management Portal pointer.
   - **Final summary:**
     - what was built: sections per lecture, lab count;
     - **each notebook page's measured height in rules** and what it covers;
     - what you left out of the notes and why;
     - every Slide check, plus every transcript correction;
     - the PDF's page count and size;
     - **the NotebookLM prompts, pasted in full**;
     - decisions you made;
     - anything unverified;
     - the subagents used;
     - the final git state (`main` N commits ahead of `origin/main`, nothing left over).

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks/timers/rAF), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lectures1-2-refresher/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, so every formula needs a plain-text twin in print (`texText.js`).
- From Lecture 8: a lab that early-returns a loading state without its measured wrapper never gets a width from `useWidth(ref)`. Keep the measured element mounted in every branch.
- Port 8787 belongs to another project.
