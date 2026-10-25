# Build: CITS5017 Code Lab, refactored: the exam's code on one page, with an Export PDF and a NotebookLM video prompt

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning, and the final exam is close. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section. One page in it, **Code Lab · Search** (`/portal/dl-code-lab`, folder `src/components/portal/modules/deep-learning/codelab/`), is a searchable dump of every code block from the Topic 1–3 decks. **Refactor it completely** into the one place I go to learn how the unit's key concepts, models and architectures are actually implemented in code, as fast as possible.

What it becomes:
1. **One page** covering **all nine topics** (L1–L9), **the lab sheets** (2, 3, 4) and **both projects**. It shows **only the code likely to be examined**.
2. **Clear sections** (top tabs), each named for the model being built or the concept being covered, and tagged with the lecture(s), lab or project it comes from.
3. **Short.** There's a hard length budget (below). A card that doesn't earn its place gets cut.
4. An **Export PDF** button at the top that exports the whole page, with the code printed **exactly as the Code Lab shows it today**: the dark VS Code editor panel.
5. Directly under that button, a **"NotebookLM video prompt ▾"** dropdown holding a prompt I paste into NotebookLM's Video Overview, with the exported PDF as the only source.

**The video is the most important output.** It will probably be the only thing I watch to get the code into my head. It must:
- briefly say what each lab and each project was trying to achieve, and show the key code behind it;
- then go through the key concept code;
- bring up the code panels from the PDF on screen;
- while it talks about a piece of code, highlight or underline exactly that part.

Design the PDF to make that video good. See "The PDF is built for the video".

Three things matter above everything else:
1. **Accuracy.**
   - Lecture code is verbatim from the slides.
   - Project code is verbatim from my notebooks.
   - Anything reconstructed is labelled as reconstructed.
   - Every claim, parameter count and shape is right. A wrong annotation is worse than a missing card, because I'll memorise it.
2. **Exam focus and brevity.** Every card is on the page because the exam is likely to use it. The exam-information note says: *"There won't any large block of Python coding in any questions. Instead, you are likely to be given a block of code and you need to draw a diagram or give explanation."* So every card trains that move: read the code, then **draw it / count it / give the shapes / say what each key line does and what the model is for**.
3. **Clean and fast to navigate.** I should reach any model in two clicks, and the page should feel lighter than the one it replaces.

> **Saved preferences** (they're in your auto-memory; here's how they apply to this page):
> - **No long-scroll pages:** use top tabs, one per section. **No walls of text:** every piece of prose has a word budget (below).
> - **Code blocks look like VS Code:** keep the kit's dark editor panel (Dark+ tokens, title bar with traffic-light dots, filename tab, line numbers) on screen **and in the PDF**. This page deliberately does **not** copy the study modules' "Light+ on paper" print rule.
> - **No AI-callout styling:** no tone-coloured rounded left-border callout boxes, and no filled pills. Show tone with a small labelled dot or an outlined label on a ruled, editorial layout. VS Code's own line highlight *inside* the editor panel is fine, because that's the editor, not a callout.
> - **Visual labs principle (the L8 kit):** picture first. Here the picture is the "Draw it" architecture diagram. This page needs no interactive labs.

---

## Where things are

Read everything in this table before you build.

| What | Path |
|---|---|
| **The page to refactor** | `src/components/portal/modules/deep-learning/codelab/` (`CodeLab.jsx`, `entries.js`, `codelab.css`). Read all of it, open `/portal/dl-code-lab`, and screenshot it before you change anything |
| The VS Code panel it uses | `deep-learning/kit.jsx` → `Code` (~line 291) and `pyTokens`; CSS `kit.css` `.dlk-code*` (~line 357) and the `.tok-*` Dark+ colours |
| Registry entry (`dl-code-lab`) | `src/components/portal/registry.js` (~line 199) |
| **Exam information** (official) | `Documents/temp/past-exam-info/exam-information.md` |
| **The sample exam** | `Documents/temp/past-exam-info/sampleExam2026-s2.pdf`. Read every page as an image |
| Practice papers, with likelihood ratings | `deep-learning/exam-practice/papers/` (`sample.js`, `paperA.js`, `paperB.js`: every part has `topics`, `difficulty`, `likelihood`), plus `tools/dl-exam-practice/coverage.md` and `format-spec.md` |
| **Lecture decks** (the source of truth for lecture code) | `Documents/cits5017/lectures/`. Slide counts: L1 64 · L2 68 · L3 53 · L4 52 · L5 27 · L6–7 32 · L8 51 · L9 69 |
| Lecture transcripts (verify against the slide images) | `Documents/cits5017/markdown-lecs/lecture-1.md` … `lecture-9.md`. **`lecture-3.md` has no code blocks**, so read L3's code from the slide images. Today's `entries.js` has the L3 blocks; verify them too |
| Slide listings the study modules already transcribed (handy; verify them) | `lecture4-study/slideData.js`, `lecture5-study/slideData.js`, `lecture6-7-study/slideData.js`, `lecture8-study/slideData.js`, `lecture9-study/slideData.js`, plus L9's "Explain this code" cards in `lecture9-study/cards.js` |
| **Lab sheets** (examinable) | `Documents/cits5017/labs/cits5017LabSheet2.pdf` (1 page), `…3.pdf` (2 pages), `…4.pdf` (3 pages). **No official solutions exist anywhere** (see "Labs") |
| Géron's notebooks (Lab 2 points at them) | `C:\Users\james\Documents\university\cits5017\handson-ml3\`: `10_neural_nets_with_keras.ipynb` (Ch 10 exercise 10: the MNIST MLP and the exponential learning-rate search), `11_training_deep_neural_networks.ipynb` ("Reusing Pretrained Layers": `model_B_on_A`), `15_processing_sequences_using_rnns_and_cnns.ipynb` |
| **Project 1** (a tuned CNN vs a retrained NASNetMobile) | Spec `C:\Users\james\Documents\university\cits5017\cits5017-project-1\documents\project1.pdf`, with a verbatim markdown copy `project-brief.md` beside it. My notebook: `…\cits5017-project-1\Wigfield_James-proj1.ipynb` |
| **Project 2** (Perth temperatures: three GRU forecasters + a VAE) | Spec `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\marking\project2.pdf`, with the rubric beside it. Also `README.md`, my notebook `…\cits5017-project-two\Wigfield_James-proj2.ipynb`, and the portal's explainer `deep-learning/project2/` (its `data/notebook.js` is the extracted notebook) |
| **The Export PDF + NotebookLM implementation to copy** | `deep-learning/lecture9-study/`: `ExportPdf.jsx`, `print.js`, `exportPrompt.js`, `texText.js`, `Rich.jsx`, `storage.js`. Also `exam-practice/exportPrompt.js`, which has the latest NotebookLM research (2026-10-24) |
| Check tools to copy and adapt | `tools/dl-lecture9-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`) and `tools/dl-exam-practice/verify_counts.py` |
| How the previous builds went (gotchas, PDF and NotebookLM notes) | Vault dev logs `03-Dev-Logs/2026-10-24-dl-exam-practice.md` and `2026-10-24-dl-lecture9-study.md`; `Documents/temp/how-the-study-module-prompts-were-built.md` |
| The unit's TensorFlow environment (read-only; build models to verify counts) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` (WSL env `tf-2.20-gpu`) |
| Obsidian vault | `C:\Users\james\Documents\james-claude-brain` (project note `01-Active-Projects/wigfield-portfolio-management-portal.md`) |

**Reading PDFs:**
- Text: `pdftotext -layout -f N -l N <pdf> -`. It garbles maths and **drops code indentation**.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/p`, then view them with the Read tool.
- Check every code block you put on the page against its slide image.

---

## Ground rules

- **What you may edit:**
  - Rewrite `codelab/` freely. Delete anything you no longer use, after a grep confirms nothing else imports it.
  - In `registry.js`, change only the `dl-code-lab` entry: keep the id (links and other modules' checks depend on it) and set the label to `'Code Lab'`.
  - Add `tools/dl-codelab/`.
- **What you must not edit:** any other module or its tools, `kit.jsx`, `kit.css`, `common.css`, `index.css` and `index.html`.
- **Imports:** you may import from the shared kit (`../kit`, `../common.css`), as the page does today. Don't import from another module's folder; copy what you need in and rename it to this page's prefix.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is merged into `main` (see "Git") and the final summary is written.
  - The only thing you must *not* do on your own is push to GitHub.

---

## Git: build in your own worktree, finish on `main`

I want the final result **on `main`, with no branch or worktree left behind**. Other Claude instances may be running builds in the main folder or in their own worktrees. Don't touch them. **Always build in your own worktree:**

1. **Create it:** `git worktree add ../wigfield-portfolio-dlc -b tmp/dlc-codelab main`.
   - Run `npm install` there, and start its dev server on port **5182** (`npm run dev -- --port 5182`).
   - Point every check script at it (`SITE_URL`).
2. **Commit in your worktree** at sensible milestones: inventory · shell · cards · export · audit fixes · checks. Every commit must leave `npm run build` passing.
3. **At the end, merge into `main`:** `git merge --no-ff tmp/dlc-codelab -m "Merge: Code Lab refactor (exam code from L1–L9, labs and projects, PDF + NotebookLM prompt)"`. Run it in the working tree that has `main` checked out (normally `C:\Users\james\Documents\personal-projects\wigfield-portfolio`).
   - **Only merge if that tree is clean**, apart from untracked `Documents/temp/` files and untracked deck PDFs.
   - **If it has someone else's uncommitted changes**, another instance is mid-build. **Wait and retry**: re-check about every 5 minutes for up to about 60 minutes (use a Monitor or an until-loop; don't spin), and merge as soon as it's clean. If it never comes clean, don't touch it, and put the exact merge command in the **first line** of your summary.
   - **Conflicts:** in `registry.js`, keep every entry. For any other conflict, run `git merge --abort` and report it in the first line of your summary.
4. **After merging:** run `npm run build` and your page check against a dev server serving `main`. If anything fails, fix it with a follow-up commit on `main`. Never force, reset or rewrite history.
5. **Clean up:** stop your dev server, then run `git worktree remove ../wigfield-portfolio-dlc` and `git branch -d tmp/dlc-codelab`. Confirm with `git worktree list` and `git branch` that nothing from this build is left.
6. **Don't push.** End the summary with "`main` is N commits ahead of `origin/main`".

Don't commit anything from `Documents/temp/`. Only stage files you created or deliberately changed.

---

## Setup

- **Folder:** `codelab/` (rewritten).
  - CSS prefix: `.dlc-*` (keep it).
  - localStorage prefix: `dlc:`. Wrap every storage read and write in try/catch.
  - Print class: `html.dlc-printing`.
- **Suggested layout.** Change it if you have a better one, but keep content as data, not JSX:
  - `CodeLab.jsx`: the shell (hero, Export, tab bar, search, Core-only toggle).
  - `sections.js`: the tabs, in order.
  - `cards/`: one data file per section, with the schema and label assignment in `cards/index.js`.
  - `labsProjects.js`: the goal panels.
  - `CodePanel.jsx`: a copy of the kit's `Code`, extended with numbered marks (and the print image, if you take that route).
  - `specs.js` + `counts.js`: one layer spec per model card, and the Keras parameter and shape rules.
  - `diagrams.jsx`: draws an architecture from a spec.
  - `ExportPdf.jsx`, `print.js`, `exportPrompt.js`, `texText.js` (only if there are formulas), `Rich.jsx`, `storage.js`: copied from `lecture9-study/` and renamed. Afterwards, grep the copies for leftovers (`dl9s`, Topic 9 wording, Lecture 9 prompts).
- **Tools:** create `tools/dl-codelab/`. Copy `page-check.mjs`, `pdf.mjs` and `shot.mjs` from `tools/dl-lecture9-study/` and set their default port to 5182.

---

## Step 1: decide what's examinable (inventory first, page second)

Before you build anything, write `tools/dl-codelab/inventory.md`. It lists **every** candidate: every code block in L1–L9 (with its slide number and a one-line description), every lab task, and every project model or key cell. For each one, give:
- the concept or model, and its sources;
- an **exam rating**, with a one-line reason grounded in the evidence below:
  - `core`: likely to be a question's stimulus, or the heart of an answer;
  - `useful`: supports a core card, or a likely short-answer part;
  - `cut`: not worth the space;
- the **exam angle**: draw it / count it / shapes / explain the lines / equation ↔ code.

The evidence to rate against, strongest first:
1. **The sample paper's stimulus types.**
   - Q1(c) gives code (a functional model with `Normalization` + `Concatenate`) and asks for an architecture diagram, the trainable parameters per layer and in total, and what problem the network suits.
   - Q2(a) is **Lab 4 in disguise**: stars instead of noisy squares. It asks for the shapes of X and y, a suitable loss, and how to set up the RNN to predict two steps.
   - Labs and projects are explicitly examinable, so expect more questions like Q2(a).
2. **`exam-information.md`:** Topics 1–9 plus the labs and projects; textbook sections not in the lecture notes won't be examined; no large blocks of coding.
3. What each deck's summary slides emphasise, and anything the slides mark as not examined.
4. **The exam-practice papers:** their `likelihood` ratings and coverage. The exam-practice dev log also lists topics no practice paper covers (CNN architectures, ℓ1/ℓ2, LR schedules, visual attention, policy search). They're still examinable.

Then choose the cards within the budget. Every `cut` item stays in `inventory.md` with its reason, so nothing is dropped silently, but it doesn't appear on the page.

## The length budget (hard limits; `check-cards.mjs` enforces them)
- **10–12 tabs**, including Labs & Projects.
- **≤ 5 cards per tab** (Labs & Projects: ≤ 10). **≤ 40 code cards in total.** Aim for the low-to-mid 30s.
- **A code panel has ≤ 16 lines.** Trim to the lines that matter, and mark every gap with one elision line (`# …`) so the trim is honest. Every line you keep is verbatim.
- **Prose per card:**
  - the "why it's here" line: ≤ 25 words;
  - ≤ 4 marks, each explained in ≤ 20 words;
  - the exam move: ≤ 60 words, plus its diagram or table.
- **The PDF is ≤ 30 A4 pages**; aim for the mid-20s. If you're over, cut `useful` cards before you trim `core` ones.

## Section plan (a starting point; confirm it against the inventory)

Tabs are named for the model or concept, with lecture/lab/project tags shown as outlined labels.

| # | Tab | Covers (pick within the budget) | Sources |
|---|---|---|---|
| 1 | **Labs & Projects** | Each lab's and project's goal, data shapes, model and result, and its key code | Lab Sheets 2–4, Géron Ch 10/11, P1 and P2 notebooks and specs |
| 2 | **Keras models** | A Sequential classifier/regressor and `summary()` counting; compile / fit / evaluate / predict; softmax → `argmax`; Wide & Deep with the Functional API; multiple outputs; callbacks (EarlyStopping, ModelCheckpoint) | L1 |
| 3 | **Training deep nets** | He initialisation, LeakyReLU/GELU, BatchNormalization (and its counts), gradient clipping, ℓ2, dropout | L2 |
| 4 | **Optimizers & LR schedules** | Momentum, Nesterov, RMSProp, Adam (equation ↔ code); power, exponential, piecewise and ReduceLROnPlateau schedules | L2 |
| 5 | **Transfer learning** | Freeze, new head, recompile, unfreeze; pretrained Keras applications | L2, L3 |
| 6 | **CNNs** | Conv2D and pooling shapes and counts; a small CNN; a global-average-pooling head | L3 |
| 7 | **RNNs & time series** | Windowing; SimpleRNN; deep RNNs and `return_sequences`; sequence-to-vector vs sequence-to-sequence; multi-step forecasts; LSTM/GRU; a Conv1D front end | L4 |
| 8 | **Autoencoders** | A linear AE ≈ PCA; a stacked AE and its counts; tied weights; convolutional, denoising and sparse AEs | L5, L6–7 |
| 9 | **VAEs & GANs** | The Sampling layer, the latent loss and the VAE model; generator + discriminator, the two-phase training loop, DCGAN | L6–7 |
| 10 | **Transformers** | Positional encoding; attention / MultiHeadAttention; an encoder block; masking | L8 |
| 11 | **Reinforcement learning** | The Gym loop, a neural-network policy, REINFORCE, value / Q-value iteration, Q-learning / DQN | L9 |

## What a card looks like

A card = **code → understanding**. In order:
1. **Header:** the printed label and title (e.g. "Card 7.2 · Sequence-to-vector RNN"), the rating as a small labelled dot (`core` / `useful`), and outlined source labels ("L4 · slide 23", "Lab 4", "P2 §6").
2. **Why it's here** (≤ 25 words): what the exam would ask about this code.
3. **The code panel** (the dark VS Code look), with numbered marks.
4. **The marks legend:** ① ② ③. Each one quotes the marked code and says what it does, e.g. "① line 4 `return_sequences=True`: every step's output goes to the next RNN layer".
5. **The exam move(s)** (below).
6. Optional: a **Slide check** note (a slide quirk or a version difference, stated plainly), and a cross-link ("Applied in Lab 4 → Card 1.3").

A suggested schema (adapt it, but keep labels derived from order rather than hand-typed):
```js
{
  id: 'rnn-seq2vec',                 // stable slug: anchor, React key, prompt references
  section: 'rnn',
  title: 'Sequence-to-vector RNN',
  rating: 'core',                    // 'core' | 'useful'
  why: '…',                          // ≤ 25 words
  sources: [{ kind: 'lecture', lec: 4, slides: '23' }, { kind: 'lab', n: 4, task: 2 }],
  provenance: 'verbatim',            // 'verbatim' | 'trimmed' | 'reconstructed' (labs) | 'notebook' (projects)
  file: 'seq2vec.py',                // the editor-tab filename
  code: `…`,                         // ≤ 16 lines, verbatim apart from '# …' elisions
  marks: [{ n: 1, lines: [3, 4], say: '…' }, { n: 2, token: { line: 6, text: 'return_sequences=True' }, say: '…' }],
  moves: { draw: 'seq2vecSpec', count: 'seq2vecSpec', shapes: [...], eq: '…', forWhat: '…' },
  slideCheck: null,
}
```

### Marks: how a card points at code
- A mark is either a **line range**, drawn as a VS Code-style highlight band over those lines, or a **token span**, drawn as an underline under exact text on one line (e.g. `return_sequences=True`).
- Each mark has a number (① ② ③ ④). It appears in the gutter next to the first marked line (or straight after the token), and the same number starts its line in the legend.
- Don't dim unmarked lines. The kit's `hl` dims them; this page doesn't.
- **Marks are the bridge to the video.** NotebookLM will be told to "walk through marks ① ② ③ in order". Mark the lines an examiner would ask about.

### Exam moves
- **Draw it** (model cards): a clean line-art architecture diagram generated from the card's layer spec. It runs input → layers → output; each box shows the layer type, units or filters, activation and output shape; functional models draw their branches and merges. Use the same visual language across the page. This is exactly what the exam asks for.
- **Count it** (model cards): a compact table with one row per layer: output shape, parameters, and the rule that gives them (`(in + 1) × units`, `(k_h · k_w · c_in + 1) × filters`, the LSTM/GRU gate rules, BatchNormalization's 4 per feature with 2 non-trainable, Normalization's non-trainable statistics). Finish with total trainable and non-trainable. **`counts.js` computes the table from the spec; nobody types a count by hand.** Then verify it in TensorFlow (see "Verify").
- **Shapes** (data and sequence cards): the shapes of X and y, and what each axis means. Example: Lab 4's `(200, 4, 2)` = instances × time steps × coordinates.
- **Equation ↔ code** (optimizer, schedule and loss cards): the slide's equation (KaTeX plus a plain-text twin) next to the line that implements it.
- **What's it for:** one line answering "For what problem would this be suitable?"

---

## Labs & Projects (the first tab and the first section of the PDF)

One compact panel each for **Lab 2, Lab 3, Lab 4, Project 1 and Project 2**. Lab Sheet 1 (the TensorFlow Playground) has no code, so it gets one line at most, inside Lab 2's panel, because Lab 2's Task 1 continues it.

Each panel has:
- **Goal** (≤ 30 words): what the lab or project was trying to achieve by the end.
- **Data:** the shapes.
- **Model(s):** one line each.
- **Result:**
  - projects: my actual numbers, verbatim from my notebook's saved outputs;
  - labs: the target the sheet states, e.g. Lab 3's "validation accuracy above 90%" and Lab 4's "100% validation accuracy easily".
- **Key code:** the card(s), right there in the panel.

Lab and project cards live **only** in this tab. Where a model tab covers the same idea, it carries a one-line cross-link ("Applied in Lab 4 → Card 1.3") instead of repeating the code.

### Labs: there are no official solutions
- The lab sheets give specs, not code. The one exception is Lab 4's `load_data` function, which is printed on the sheet.
- For each lab card, write the **minimal code that follows the sheet exactly**, in the slides' Keras style: layer counts and sizes, activations, optimizer and learning rate, loss and metrics, epochs and early stopping, the `Rescaling` layer, `class_weight`, and the `np.argmax` pitfall the sheet warns about.
- Label these cards "Lab N · reconstructed from the sheet" (an outlined label). Never present them as the lecturer's solution.
- Lab 2's Tasks 2 and 3 point at Géron's notebooks. Take that code verbatim from the local `handson-ml3` notebooks, trim it, and cite the notebook and its section.
- The datasets (`noisy_squares.npy`, the wine files) aren't available locally. Verify each lab model by building it with dummy arrays of the sheet's shapes, plus a 1-epoch smoke fit on random data to prove the code runs. Don't claim trained results.

### Projects
- The code is **verbatim excerpts from my notebooks**, trimmed to the key lines, each citing its notebook section (e.g. "P1 §3.2").
- Show what each spec demanded:
  - **Project 1:**
    - a CNN under 30,000 trainable parameters (4 conv layers, 4 pooling layers, dropout, global average pooling, a dense layer, the output layer);
    - the Bayesian tuner's search space;
    - NASNetMobile with its base frozen and a new head (global average pooling → Dense ≤ 80 → a 10-way softmax);
    - how the two compared.
  - **Project 2:**
    - three GRU forecasters: 12 months at once, one month rolled out to 12, and an encoder–decoder;
    - the VAE that synthesises max-temperature sequences (sampling and the KL term).
- Check every project fact against the spec and my notebook's outputs, not my memory. If my notebook deviates from the spec, show what the notebook does and note the deviation.

---

## The page

- **Hero (compact):** the title, a one-line purpose, three stats (cards · tabs · lectures covered), the **Export PDF** button, and the dropdown directly under it.
- **Sticky tab bar** under the portal topbar: one tab per section, each with its outlined source tags. At 390 px it becomes a select or a scroller inside itself, never a page-level horizontal scroll.
- **Two light controls, nothing more:**
  - **Search:** keep today's behaviour (`/` focuses it from anywhere, Esc clears it, every term must match). Results come from every tab, with matches highlighted and each result showing its tab.
  - **"Core only":** hides `useful` cards for a fast pass.
- **Card layout:** on desktop, the code panel on the left and the legend + exam move on the right; at ≤ 760 px they stack. On screen, code panels scroll horizontally inside themselves; the page never does.
- Keep the **copy** button on every panel.
- **Persistence:** store the active tab and Core only under `dlc:`. If the portal's `/portal/:toolId/*` deep links make it easy (look at how other tools use them), support `/portal/dl-code-lab/<tab>`.
- **Feel:** clean, editorial, quiet, and noticeably lighter than today's page.

---

## Export PDF

### The PDF is built for the video
**What I found while scoping:** NotebookLM's Video Overviews make narrated slides and, per TechCrunch's launch coverage, "pull in images, diagrams, quotes, and numbers" from the sources. Nothing published says they screenshot regions of a PDF or draw highlights on them. Re-check this with a web search (Google's help page support.google.com/notebooklm/answer/16454555 and recent release notes) and record what you find in `exportPrompt.js`.

Either way, **put the highlighting in the PDF itself**:
1. **Every code panel prints exactly as it looks on screen:** the dark Dark+ editor, the title bar with its dots, the filename and the line numbers. Its marks are visible (highlight bands, underlines, circled numbers). **The card label sits inside the panel's title bar**, so any crop of the panel says which card it is.
2. **Make each code panel likely to be picked up as a visual.**
   - Print each panel as a crisp embedded image (at least 2× resolution), rendered from the same tokens and colours. For example, draw it on a `<canvas>` at print time from `pyTokens` output, with no new dependency.
   - Keep that panel's code as **real, selectable text** too, for example as an invisible text layer aligned over the image.
   - Prove both: `pdfimages -list` shows one image per panel, and `pdftotext` contains every code line.
   - If you can't make the text layer reliable in Chrome's PDF output, fall back to vector panels (real text with `print-color-adjust: exact`) and say so in the summary.
   - Whichever you choose, the export must look right from Chrome's normal print dialog **with "Background graphics" left at its default**. Verify this.
3. **The legend under each panel quotes the marked code**, so the narration can say exactly what's highlighted.
4. **Breaks:** a card never splits across pages, each section starts on a new page, and everything except the code panels is on light paper.

### Contents and order
1. **Cover:** the title, the date, a one-line purpose, and a contents list of every card label and title (a map for NotebookLM).
2. **Labs & Projects:** the goals and their code cards.
3. **Every other section in tab order**, with every card. Core only and search are ignored in print. Each card prints with its exam moves: the diagram, the count table, the shapes, and any equation with its plain-text twin.

**Left out:** the tab bar, search, toggles, copy buttons, the export UI and the portal chrome.

**Mechanics:**
- Copy them from `lecture9-study/`: `print.js` mounted as a `<style>` while exporting, `html.dlc-printing`, `window.print()`, and the afterprint cleanup.
- **Replace its "code = Light+ on paper, no line numbers" rule** with the dark-panel rule above. A4 portrait.
- **Long lines:** pick a print font size so the longest line of every panel fits the panel's width at no smaller than 7.5 pt. If a line still won't fit, soft-wrap it with a hanging indent and no new line number; line numbers must match the screen.

---

## The NotebookLM prompt

Stay consistent with Lecture 9's dropdown: numbered steps, and a Copy button showing the character count.
- **Format:** probably Explainer. Re-check the current Video Overview formats and any prompt-length limit, and say in `exportPrompt.js`'s header why you chose that format.
- **Length:** keep each prompt under about 1,000 characters unless you confirm a higher limit.
- If web search isn't available, reuse the 2026-10-24 findings in `exam-practice/exportPrompt.js` and say so.

The dropdown offers:
1. **The main prompt** (one video).
2. **A two-part variant:** Part 1, "Labs & projects", and Part 2, "Key concept code", each as its own prompt.

**What the prompt must ask for:**
- Use only the PDF. The style is a lecturer walking through code on screen in a brisk revision session.
- **Labs and projects first**, in this order: Lab 2, Lab 3, Lab 4, Project 1, Project 2. For each: state its goal in a sentence or two, as printed; then **show its code panel** and walk through its marks ① ② ③ in order.
- **Then a named handful of concept cards** (about 6–8, by exact printed label and title, in order). For each: show the code panel; **as each mark is explained, highlight or underline that marked code on screen**; and show the "Draw it" diagram or "Count it" table printed with it.
- Quote code exactly as printed. Never invent or "improve" code. Use the PDF's numbers.
- Skip every other card.
- End with a three-step recipe for "given this code" exam questions: draw it, count it, say what it's for.

**Choosing the cards:**
- `core` cards only, spread over at least 5 lectures.
- At least 2 with a "Count it" and at least 2 with a "Draw it", matching the sample paper's stimulus types.
- Explain every pick in `exportPrompt.js`'s header comment.

Every label the prompt names must appear verbatim in the PDF's text (checked).

---

## Accuracy traps (verify each one; don't take my word for it)

- **Keras 3 vs the slides.** Some parameter counts depend on version defaults. For example, Keras 3's GRU defaults to `reset_after=True`, which adds a second bias vector; Normalization's statistics are non-trainable; BatchNormalization has 4 parameters per feature, 2 of them non-trainable. Where a slide's printed number differs from what TF 2.20 / Keras 3 prints, show the slide's number and add a Slide check saying "Keras 3 prints …".
- **Slide code quirks stay verbatim, each with a Slide check.** From earlier builds (re-check each): L1 s13 `np.int` (removed in NumPy 1.24), L3 s19 `[2, 64, 114, 3]`, L8 s35 `10_000`, L9 s17 `reader_mode`.
- **Lab 4 shapes:** the sheet gives X_train `(200, 4, 2)` and y_train `(200,)`. Task 3's input is `X_train[:, :3, :]` → `(200, 3, 2)`, and its output is `X_train[:, 3, :]` → `(200, 2)`.
- **Lab 3:**
  - the class IDs have to be shifted from 1–3 to 0–2;
  - `Rescaling` maps tanh's (−1, 1) onto 3…9, so check the scale and offset you use;
  - the sheet's pitfall: Keras classifiers output probabilities, so you need `np.argmax`.
- **Project 1:** NASNetMobile's frozen base gives a large non-trainable count. Check how my notebook handled 64×64 inputs and preprocessing, rather than assuming.
- **Functional models:** a `Concatenate` widens the next layer's input (sample Q1(c)'s trap). Get it right in every count.
- No count, shape or result appears on the page unless it was computed or copied from a verified source.

---

## Verify

- **`tools/dl-codelab/verify_counts.py`:**
  - builds every model card's spec, and every lab reconstruction, in the unit's **read-only** WSL env `tf-2.20-gpu`;
  - asserts the trainable and non-trainable counts and the output shapes, writing them to `keras-counts.json`;
  - does the 1-epoch random-data smoke fit for each lab card.

  Read `ENVIRONMENT_SETUP.md` first, and **never install anything into that env**. Call its Python by absolute path through `wsl.exe` (`MSYS_NO_PATHCONV=1` from Git Bash). If WSL fails, use a Windows venv with `tensorflow==2.21.0`, and say so.
- **`tools/dl-codelab/check-cards.mjs`** (data integrity):
  - the schema; ids and labels are unique;
  - **every budget limit** (tabs, cards per tab, total cards, lines per panel, word counts, number of marks);
  - every mark points at lines that exist, or at a token that really occurs on its line;
  - every slide receipt is within its deck's slide count;
  - **verbatim:**
    - every lecture card's non-elided lines appear in the slide transcriptions you store in `tools/dl-codelab/slides-verbatim/` (transcribed from the slide images);
    - every project card's lines appear in the notebook JSON;
    - every Géron line appears in the Géron notebook;
  - `counts.js` agrees with `keras-counts.json`;
  - every label the NotebookLM prompts name exists;
  - every card is in `inventory.md`, and no `cut` item is on the page.
- **`page-check.mjs`** (adapted). Stub `window.print` before the page loads in every automated check, so a print dialog can't hang this unattended run. It checks:
  - the page renders at `/portal/dl-code-lab`, and every tab works;
  - search: `/`, Esc, highlights, results from every tab;
  - Core only;
  - persistence across a reload;
  - the page renders with localStorage throwing and with reduced motion;
  - keyboard operation;
  - the copy buttons;
  - the stubbed export plus `afterprint`;
  - the dropdown opens directly under Export PDF, its variants switch, and Copy works with a character count;
  - 3 themes × 1440/390 with no page-level horizontal scroll;
  - **every other Deep Learning module in the registry still renders.** The Lectures 1–2 refresher's page-check also visits this route; run it too.
- **`pdf.mjs`** (headless PDF, background printing off, as in the dialog's default). It checks:
  - the page count (≤ 30) and the file size;
  - `pdftotext`: every card label and title, in order; every lab and project goal; every label the prompts name, verbatim; the code lines; and no UI text (search placeholder, "copy", "Core only");
  - `pdfimages -list`: one image per panel, if you took the image route.

  Then render several PDF pages with `pdftoppm` and **look at them**: dark panels intact, marks visible, nothing clipped, nothing split.
- **Lint and build:** lint `codelab/`, `registry.js` and `tools/dl-codelab/` clean, and run `npm run build`.

---

## Subagents: use them for coverage, exam focus and accuracy, within a budget

Aim for about **8 agents**, with **11** as a hard ceiling.
- Use **fresh general-purpose agents, not forks**, so they aren't anchored on your reasoning.
- Give each one a self-contained brief: file paths, exactly what to return, and the output format.
- Launch independent agents in one message so they run in parallel. Don't re-check unchanged content.

| Phase | Agents | Job |
|---|---|---|
| Inventory | **3**, started first: (1) L1–L3 + Lab Sheets 2–3 + the Géron Ch 10/11 sections + Project 1; (2) L4–L6/7 + Lab Sheet 4 + Project 2; (3) L8–L9 | They read the slides as images. They return every code block verbatim as typeset (indentation kept), with its slide number and concept, plus a proposed rating with evidence, the exam angle, candidate marks and any quirks. For labs and projects: the goals, shapes, key code cells and results. They write to your scratchpad, not the repo |
| Exam focus | **1 likelihood reviewer** | Give it the inventory **without your ratings**, plus the exam note, the sample paper and the practice papers' likelihood data. It returns its own ratings and its top 40. Reconcile, and note the disagreements in the summary |
| Accuracy | **2 checkers**: (1) L1–L4 + Labs 2–4 + P1; (2) L5–L9 + P2 | **Blind first:** for each card, they read the code and write their own marks and answers from the slides *before* reading yours. Then they check: verbatim against the slide images and notebooks; every mark's claim; every count and shape against `keras-counts.json`; that provenance labels are honest; and that the Slide checks are right. Verdict per card: correct / wrong / misleading / not verbatim, with fixes |
| Re-check | **1** | Only the cards that changed after the accuracy check |
| Design, PDF and prompt | **1 auditor** | Screenshots of the old page beside the new one (3 themes × 1440/390), rendered PDF pages, and the prompts. Checks the saved preferences, that the page feels short and any model is two clicks away, that the PDF works as a video source (labels inside panels, visible marks, legends quoting code), and that the prompts follow every rule above |

Fix every **wrong**, **misleading** and **not verbatim** finding, or justify leaving it in the summary.

---

## Process

1. **Git and setup** (see "Git"). Start the three inventory agents straight away.
2. **Orient.**
   - Check the vault's project note, as the repo `CLAUDE.md` asks.
   - Read every file in "Where things are": screenshot today's page, read the sample paper as images, and read Lecture 9's export code and `exam-practice/exportPrompt.js`.
3. **Choose.** Merge the inventories, rate everything, run the likelihood reviewer, reconcile, and fix the card list and section plan inside the budget. Commit `inventory.md`.
4. **Prototype the shell with three real cards:** a model card with Draw it + Count it, a lab card, and an equation ↔ code card. Build the tabs, `CodePanel` with marks, the card layout, search and Core only. Screenshot at 1440 and 390 in all three themes, critique the result against the saved preferences and "lighter than today", and iterate. Commit.
5. **Fill every card:** specs, `counts.js`, diagrams, the Labs & Projects panels, then `verify_counts.py`. Commit.
6. **Export PDF and the NotebookLM prompts.** Commit.
7. **Audit:** run the accuracy checkers, fix, then the re-checker; then the design audit, and fix. Commit.
8. **Verify** (above), then **wrap up and merge** (see "Git").

## Wrap-up

- **Vault:**
  - create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`;
  - update the Code Lab line in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]` (e.g. to the exam-practice and Lecture 9 logs).
- **Memory:** update the Code Lab mention in your auto-memory's Management Portal pointer (one line).
- **Final summary:**
  - every tab and card (label, title, rating, sources);
  - what was cut (the count, plus the notable cuts and why);
  - the lab and project goals as printed;
  - the `verify_counts.py` results;
  - the accuracy checkers' results and what was fixed;
  - the Slide checks;
  - the PDF's page count and size, and which panel approach you used (image + text layer, or vector);
  - what your NotebookLM research found;
  - **every prompt pasted in full**, with the chosen cards and why;
  - decisions you made, and anything unverified;
  - the subagents used;
  - **the final git state**: merged, "`main` is N commits ahead of `origin/main`", and no worktree or branch left.

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings and regexes. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- **ESLint:**
  - react-hooks forbids `setState` directly in an effect body (do it in callbacks, timers or rAF);
  - react-refresh allows only component exports from `.jsx` files (put helpers and data in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-codelab/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, so every formula needs a plain-text twin in print.
- **Printing dark panels:**
  - Chrome drops background colours in print unless the element has `print-color-adjust: exact` (and the `-webkit-` form). Images always print.
  - Puppeteer's `page.pdf` needs `printBackground` set deliberately; test with it off, to match the dialog's default.
  - If you draw panels on a canvas, wait for `document.fonts.ready`, use the panel's computed monospace font, and scale by the device pixel ratio (×2 at least) so the panels stay sharp.
- **WSL from Windows:**
  - bare `python`/`conda` aren't found in non-interactive WSL shells, so use absolute binary paths;
  - put non-trivial code in `.py` files;
  - prefix the command with `MSYS_NO_PATHCONV=1` from Git Bash;
  - don't try to "fix" the expected CUDA warnings.
- **Ports:** 8787 belongs to another project. 5173 is the main folder's dev server, and 5179–5181 may be used by other builds. Yours is 5182.
