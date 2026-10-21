# Build: CITS5017 Lecture 5 (Representation Learning and Dimension Reduction Using Autoencoders): Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with one study module per lecture. Each module is one continuous page that I work down in focus mode, in slide order:

> I read a short explanation, play with an interactive visual until the idea clicks, then copy a page of notes (with diagrams) into my paper notebook, and move on.

Build **the same kind of module for Lecture 5**: the deck `Documents/cits5017/lectures/cits5017-lect05-AE-dimension-reduction.pdf` (27 slides, Chapter 17 of Géron's *Hands-On Machine Learning*, 3rd ed., autoencoders only; the slides say diffusion models aren't covered).

Three things matter above everything else:

1. **Every piece of content in the lecture is covered, and all of it is accurate.** Every slide lands in a section, in deck order. Every claim, number, equation, code line and figure comes from the slides, in the slides' own notation. I prepare for tests from these modules, so a wrong formula or a made-up number is worse than a missing lab.
2. **It works for learning.** The Read → Play → Write rhythm, with labs that show the mechanism really working (real computation, not decoration).
3. **It feels like the Lecture 4 module**, with the notebook page built the way described below.

It also gets a **PDF export of the Read and Play parts**, with a **NotebookLM video-overview prompt** in a dropdown under the button. See "PDF export and the NotebookLM prompt" below.

> **Note on a saved preference:** your auto-memory has an older rule: "no long-scroll pages, use top tabs". **It doesn't apply here.** Study modules are deliberately one continuous page worked through in focus mode. The other saved rules still apply:
> - no tone-coloured callout boxes or filled pills;
> - VS-Code-style code blocks;
> - no walls of text.

---

## The notebook page (Write): what to keep from Lecture 4, and what to change

Lecture 4's module has just had its notebook pages rebuilt as "student notes". They're on the branch `feat/dl4s-student-notes`, which may not be merged into `main` yet:
- `lecture4-study/SheetPage.jsx` and `sheet.css`;
- the content in `sheets/sNN.js`, with the schema in `sheets/index.js`;
- the vault log `03-Dev-Logs/2026-10-21-dl4s-student-notes.md`.

I like most of it. Build Lecture 5's notebook pages from that design, with these changes.

**Keep (this is what's better than the old fixed-order page):**
- **Layout by idea, not by content type.** Each block is one idea: a sub-heading with its slide range, its lines, and *right there* the diagram, boxed formula, worked number, table or numbered steps that belong to it. No fixed "Notes → Draw → Formulas → Worked → Check" order.
- **Tables** where things are compared, and **numbered steps** where the content is a process.
- **Diagrams placed beside or under the lines they explain**, with the part being discussed highlighted.
- **Self-test questions in the margin**, next to what they test, with click-to-reveal answers. Plus an occasional short "remember" note, and pointers to Slide checks.
- **The four-pen colour system**, because I copy with four pens: **blue** headings, **black** body text, diagram line-work, formulas and numbers, **red** bullet markers and step numbers only, **green** sparing highlights (a few key terms, the highlighted part of a diagram).
- Tick-as-you-copy on every line and diagram, with stable tick keys, and the quiet ruled-paper feel.

**Change (Lecture 4 went a bit overkill making it look like a student wrote it):**
- **No handwriting font.** Use the page's normal typefaces for everything (headings, body, slide ranges). Lecture 4 uses `Patrick Hand` via `--sh-hand`; don't carry that over.
- **Write in proper sentences, like Lecture 4's legacy notes.** I like the sentence structure of the legacy notebook pages (`NotebookPage.jsx` + the `notes` arrays in Lecture 4's `sections.js`): one idea per line, a short complete sentence, plain words.
  - Not student shorthand: avoid "&", "info", "w/", "∴", or arrow chains standing in for verbs.
  - Arrows are fine where they show an actual flow, e.g. `784 → 100 → 30 → 100 → 784`.
- **Fewer margin gimmicks.** Drop the "memory hook" and "≠ contrast" asides, unless one is genuinely the clearest way to say something. Keep the questions and the occasional "remember" note.
- An optional one-line "big idea" under the title is fine, as a plain sentence in the normal font.
- **No Legacy tab.** Lecture 5 has no old page to keep, so each section has just this one notebook page. Don't copy `NotebookTabs.jsx` or the legacy `NotebookPage.jsx`.

### Notes budget: I'm short on time
Writing notes is the slow part of studying, and I'm running out of time for this unit.
- **The Read and Play beats must cover every concept in the lecture.**
- **The notebook pages should only carry what's worth writing down.** For each section, decide what's core enough to copy. If a concept doesn't need notes, leave it out of the notebook: it's still in Read and Play.

**My starting priorities** (adjust them if the slides suggest otherwise):

| Priority | Concepts |
|---|---|
| **Core (in the notes)** | What an autoencoder is: encoder, codings/latent representation, decoder, reconstructions, reconstruction loss · undercomplete · linear activations + MSE ⇒ PCA · stacked autoencoder architecture (the symmetric "sandwich", coding layer) and why it must not be too powerful · parameter counting for `stacked_ae` · tying weights: the rule, what's learned, why it roughly halves the parameters · unsupervised pretraining: the procedure and why it helps with little labelled data · training one autoencoder at a time: the phases |
| **Light (one line at most)** | The memorising-sequences / chess-player motivation · autoencoders as generative models (fuzzy outputs) · t-SNE as a visualisation step (what it does, not the code) · visualising reconstructions as a sanity check |
| **Leave out of the notes (Read and Play only)** | Full code listings (keep only a key line or two where they carry the concept, e.g. `fit(X_train, X_train)`) · `DenseTranspose`'s implementation details beyond "uses the encoder layer's transposed weights plus its own biases" · plotting code · the reading list on slide 27 |

**Budget:**
- Aim for roughly **3–7 lines per content section** and **under ~60 lines across the whole module**.
- Use at most one diagram per section, and only where drawing it helps memory.
- The intro and summary sections can have a tiny notebook page or none at all. If a section has none, make sure progress and done-marks still behave sensibly.
- At the bottom of a page that left something out, add one quiet line, e.g. "Not in these notes (see Read): …", so I know it was a deliberate choice.

---

## Where things are

| What | Path |
|---|---|
| **The source of truth** (27 slides) | `Documents/cits5017/lectures/cits5017-lect05-AE-dimension-reduction.pdf` |
| **The template module** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture4-study/`: take it from `feat/dl4s-student-notes` if that branch isn't merged into `main` (see Setup) |
| The brief that built Lecture 4 (same requirements, different deck; read it) | `Documents/temp/prompt-dumping/build_lecture4_study_module.md` |
| The brief for Lecture 4's student-notes refactor | `Documents/temp/prompt-dumping/refactor_lecture4_student_notes.md` |
| Lecture 3's module and brief (the original reference) | `.../deep-learning/lecture3-study/`, `Documents/cits5017/build_lecture3_study_module.md` |
| Transcript format to match | `Documents/cits5017/markdown-lecs/lecture-4.md` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css` (`Tex`, `Eq`, `Code` (VS Code look), `Note`, `Unfold`, `Fnote`/`RefsProvider`, …), `common.css` (`--dlv-*` palette) |
| Check-script precedents | `tools/dl-lecture4-study/` (`page-check.mjs`, `check-rnn.mjs`, `shot.mjs`; and on the student-notes branch, `check-sheets.mjs` and `compare-shots.mjs`) |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. **Warning:** pdftotext garbles this deck's maths and code.
  - It drops ℓ, ⊤ and subscripts in slide 19's tied-weights rule.
  - It loses the indentation of slide 20's `DenseTranspose` class, which is indented correctly on the slide.
  - It writes "Géron" as "G�eron".
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then look at them with the Read tool. **Read every slide as an image**, not just the text. Several are figure-led: Figure 17-1, 17-3, 17-4, 17-5, 17-6, 17-7, slide 9's 3D/PCA plots, slide 19's tied-weights diagram, and the reconstruction grids on slides 13, 22 and 25.
- Don't embed slide renders in the page. Rebuild figures as SVG line-art and labs.

---

## Ground rules

- **Don't modify `lecture3-study/` or `lecture4-study/`** or any other module. At the end, `git diff main -- src/components/portal/modules/deep-learning/lecture3-study src/components/portal/modules/deep-learning/lecture4-study` must be empty on your branch. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon.
- **Copy, don't refactor.** Don't pull the shared shell out into a framework in this task. Copy the files into the new folder and adapt the copies. Suggest a shared kit in your summary if you think it's worth it.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at the start or at any point.
  - Never ask me anything, and never wait for confirmation.
  - If something blocks you (a failed download, a missing Python package, a failed web request, an interactive prompt), make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is committed and the final summary is written.
  - The only things you must *not* do on your own are merging to `main` and pushing.

---

## Setup

1. **Branch and working tree.**
   - Run `git status` and `git worktree list`. Other Claude instances may be working in this repo: Lecture 4's refactor and Lecture 3's summary/PDF work have used `feat/dl4s-student-notes` and a worktree at `../wigfield-portfolio-dl3s`.
   - **If the main working tree isn't on `main`, or has uncommitted changes you didn't make, don't switch its branch or touch its files.** Create your own worktree instead: `git worktree add ../wigfield-portfolio-dl5s -b feat/dl-lecture-5-study main`. Run `npm install` there, start its dev server on port **5176**, and point every check script at it (`SITE_URL`).
   - Otherwise, run `git checkout -b feat/dl-lecture-5-study main` in place, and start `npm run dev` yourself if nothing answers on 5173.
   - `Documents/temp/` holds my prompt files: don't commit anything new from it. Only stage files you created or deliberately changed.
2. **Getting the template.**
   - Check whether `feat/dl4s-student-notes` is merged into `main` (`git branch --merged main`).
   - If it isn't, read and copy the Lecture 4 files from that branch without checking it out: `git show feat/dl4s-student-notes:<path> > <your copy>`. Redirected `git show` output is byte-exact; the backslash problem in the gotchas below only affects heredocs.
   - Your branch still starts from `main`, so Lecture 5 doesn't depend on that branch being merged.
3. **New folder:** `src/components/portal/modules/deep-learning/lecture5-study/`. CSS prefix `.dl5s-*`. localStorage prefix `dl5s:`. Every storage read and write goes in try/catch, as in `storage.js`.
4. **Register it directly after the `dl-lecture-4-study` entry:**
   ```js
   { id: 'dl-lecture-5-study', label: 'Lecture 5 · Autoencoders (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture5Study },
   ```
   It will then be at `/portal/dl-lecture-5-study`.
5. **Copy and adapt the Lecture 4 shell.**
   - Copy `Lecture4Study.jsx` → `Lecture5Study.jsx`, plus `SheetPage.jsx`, `sheet.css`, `sheets/index.js`, `sheets/keys.js`, `Rich.jsx` (with its `{g|…}` green token), `ui.jsx`, `hooks.js`, `storage.js`, `context.js`, the CSS, and the sheet-mode pattern in `diagrams.jsx`.
   - Then **grep the copies for Lecture 4 leftovers**: `dl4s` class names, ids and storage keys, `rnn.js` imports, the scoreboard, ridership data, the "Topic 4 · Chapter 15 · slides 1–52" hero, the "52 slides" footer, slide-51 outcome references, and `NotebookTabs`/legacy imports.
   - When you're done, nothing in the new folder should mention Lecture 4 content.
6. **Where things live.**
   - Maths goes in its own helper, `ae.js`: dense forward passes, MSE, PCA via the covariance eigendecomposition, parameter counts (dense, tied), and a small trainer for the linear autoencoder.
   - Slide facts (numbers, code listings, figure captions, footnotes, outcomes) go in `slideData.js`.
   - Read/Play prose goes in `sections.js`; notebook pages go in `sheets/sNN.js`.
   - Sections no longer carry legacy `notes`/`draw`/`formulas`/`worked`/`check` fields. Update the header comments so they describe the actual shape.

---

## The page experience: same as Lecture 4

Everything about the page experience in Lecture 4 applies unchanged:
- focus mode (Fullscreen API with the overlay fallback; Esc exits);
- the sticky header with the current section and progress;
- one continuous scroll in slide order;
- the section rail/dropdown with slide ranges and done marks;
- "Resume at §N";
- persisted ticks.

There are three beats per section:
- **Read:** short, with slide receipts, the slides' notation, and long verbatim code in `Unfold`.
- **Play:** 1–2 live labs, each with a one-line "Try this" phrased *predict → change → notice*, direct labels, and defaults set to the slide's own example.
- **Write:** the notebook page described above.

### Making it good for learning (for this deck in particular)
- **Lab defaults reproduce the slides' examples:**
  - the 3 → 2 → 3 autoencoder (Figure 17-1, slides 6–9) with `Dense(2)`/`Dense(3)`, no activation, MSE, `SGD(learning_rate=0.5)`, 500 epochs, a (60, 3) training set;
  - the 784 → 100 → 30 → 100 → 784 sandwich (Figure 17-3, slides 11–12);
  - `stacked_ae` = 163,814 parameters, `tied_ae` = 82,414 (slides 12 and 21);
  - `N = 4`, so W₃ = W₂ᵀ and W₄ = W₁ᵀ (slide 19).
- **Label every layer with its size and every weight matrix with its shape.** Parameter counting is where this deck's numbers come from, so let me see the arithmetic.
- **Real computation, honestly labelled.** Train the 3D linear autoencoder live in the browser and compare it with PCA computed in the browser. Count parameters live.
  - **Never present a number as the slides' result unless it's quoted from them.** The slides give no reconstruction-error values. Anything the page trains or computes itself is labelled as this page's own run.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

| § | Section | Slides | Play ideas (suggestions, not requirements) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | Slide 3's topic list mapped to the sections that cover them (like Lecture 4's `RoadmapLab`); note that diffusion models are out of scope |
| 1 | What are autoencoders? | 4 | A three-way card: dimensionality reduction · feature detectors / unsupervised pretraining · generative models (with the slide's caveat that generated images are fuzzy); each links forward to its section |
| 2 | Efficient data representations: encoder, decoder, undercomplete | 5–7 | Slide 5's two sequences: show the second encoded by its pattern (start, step, length) and reconstructed (the page's illustration of the slide's point). Then Figure 17-1's 3 → 2 → 3 network: pick an input, see its 2-number coding, its reconstruction and the reconstruction loss. Show why a 2D bottleneck can't just copy a 3D input |
| 3 | PCA with an undercomplete linear autoencoder | 8–9 | Live: train the linear autoencoder on a 60-point 3D set with the slide's settings, watch the loss fall and the learned plane settle onto PCA's plane. Show the 2D codings beside PCA's 2D projection. See the trap below about "same subspace, not identical axes" |
| 4 | Stacked autoencoders | 10–11 | Sandwich builder: symmetric layers around the coding layer, each layer's size and parameters; a "too powerful" toggle that shows slide 10's thought experiment (each input mapped to one arbitrary number: perfect training reconstruction, nothing useful learned) |
| 5 | Implementing a stacked autoencoder in Keras | 12 | Layer-by-layer parameter table that sums to slide 12's 163,814; the code with each line linked to its layer; `fit(X_train, X_train)` highlighted (inputs = targets) |
| 6 | Visualising: reconstructions and t-SNE | 13–15 | Originals vs reconstructions (see "Data"); a t-SNE scatter of validation codings by class (Figure 17-5's idea); the slide's three remedies for lossy reconstructions as labels |
| 7 | Unsupervised pretraining | 16–17 | Figure 17-6 as a stepper: lots of unlabelled data → train the autoencoder → reuse its lower (encoder) layers → add a classifier head → train with the few labelled examples; show which layers are reused vs trained, and how many parameters still need training |
| 8 | Tying the weights | 18–22 | The rule W_{N−ℓ+1} = W_ℓᵀ on the slide-19 diagram (pick ℓ, see which decoder layer it fills); the 163,814 vs 82,414 breakdown (what's shared, which biases remain); `DenseTranspose` with the slide's `# ***` line explained |
| 9 | Training one autoencoder at a time | 23–25 | Figure 17-7's three phases as a stepper with the data shapes at each phase (784 → 100, then 100 → 30, then the full stack); `train_autoencoder`'s calls mapped to the phases |
| 10 | Summary and what's next | 26–27 | Slide 26's outcomes as a persisted self-check, each linking to its section (like Lecture 4's `OutcomesLab`); slide 27's reading (pp. 647–667, excluding Sparse Autoencoders) |

---

## Data and real computation

- **The 3D PCA example (slides 8–9).** The slide elides the data (`X_train = [...]`, "the same 3D data used in Chapter 8"). Generate your own 60-point 3D set lying near a plane, with a fixed seed, and label it as the page's own. Don't claim to reproduce the slide's figure exactly. Train the linear autoencoder in the browser with plain gradient descent on MSE (the slide's lr = 0.5 and 500 epochs as defaults; check it converges on your data) and compute PCA in JS (3×3 covariance, eigenvectors).
- **Fashion MNIST (slides 12–25).** Real reconstructions and a real t-SNE plot would make §6 much better, but nothing must be presented as the slides' figures.
  - **Preferred:** a reproducible script in `tools/dl-lecture5-study/` downloads Fashion MNIST into its own empty scratchpad directory (run Python with `-I`) and trains `stacked_ae` as on slide 12. Use TensorFlow/Keras if it installs cleanly in a venv; otherwise use a faithful numpy implementation (ReLU, MSE, Nadam, the slide's epochs).
  - The script then exports a handful of originals and reconstructions, plus 2D t-SNE coordinates and class labels for a validation subset (scikit-learn's `TSNE`), into `lecture5-study/data/*.js`.
  - The file headers record the source, seeds and date.
  - Keep the shipped data small (aim under ~300 KB in total), and lazy-load it if it's over ~100 KB, as `project2/Project2.jsx` does.
  - **Gate:** the trained model's parameter count must equal 163,814 (and 82,414 for the tied version, if you train it).
  - **Fallback:** if the download or training isn't possible unattended, build §6 without real images. A clear diagram of the comparison and a labelled synthetic 2D scatter are fine. Say so in the summary.

---

## PDF export and the NotebookLM prompt

I'll upload the PDF to NotebookLM as a source and generate a **Video Overview** from it. A similar feature is being built for Lecture 3 on `feat/dl3s-summary-pdf` (files `print.js`, `NotebookLmPrompt.jsx`, `exportPrompt.js` in `lecture3-study/`).
- If that branch has a commit with those files, read them as a reference and follow their approach where it fits.
- It may still be uncommitted work in the worktree `../wigfield-portfolio-dl3s`. **Never edit that worktree**, and don't copy unfinished files from it.
- Either way, the requirements below are what counts.

### The button
Add an "Export PDF" button in the hero actions, next to "Enter focus mode". Style it like the existing secondary buttons and give it an icon from `icons.jsx`.

### Approach: a print mode plus the browser's "Save as PDF"
Don't rasterise the page with html2canvas or jsPDF. NotebookLM needs **real, selectable text**. Printing also needs no new dependencies, always matches the current page, and doesn't publish course material as a public static file.

On click:
1. Put a class on `<html>` (e.g. `dl5s-printing`) so every print rule is scoped to this module.
2. Leave focus mode if it's on.
3. Make sure any lazy-loaded data (e.g. the Fashion MNIST files) has loaded, and wait for fonts and KaTeX to settle.
4. Set `document.title` to a sensible default filename, e.g. `CITS5017 L5 Autoencoders — Read + Play`.
5. Call `window.print()`.
6. On `afterprint`, restore everything: title, class, and focus mode if you left it.

### What the PDF contains
- The hero title.
- Then **every section in order**, each with its § number, title and slide range, its **Read** beat and its **Play** beat.
- **Read** beats print in full: `Unfold` bodies expanded, footnote references and Slide check notes included.
- **Play** beats print as a meaningful state: the visual, its caption and its readouts.
  - A lab that trains live (the linear autoencoder vs PCA) should print its **trained** result, not epoch 0.
  - Use the page's own deterministic run, computed before printing.

### What it leaves out
- every notebook (Write) page;
- the portal's sidebar and topbar, the module's sticky bar, the index rail, "Resume", the hero's other buttons and the export UI itself;
- tick boxes;
- controls that mean nothing on paper (sliders, steppers, play buttons). Keep their current values readable as text where they matter.

### Print layout
- Always print on a light, paper palette, whatever the portal theme.
- Code blocks must stay readable: either keep the VS Code look with `print-color-adjust: exact`, or use a light code palette for print only.
- Use `break-inside: avoid` on figures, tables, equations and code. Start each section on a new page if that reads better.
- Use A4 margins.

### Check the PDF properly
1. **Stub `window.print` in every automated check**, before the page loads, e.g. `page.evaluateOnNewDocument(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; })`. A real print dialog would hang this unattended run.
2. Assert that the button called the stub once. Dispatch `new Event('afterprint')` and assert the page is restored.
3. Generate the PDF by entering the same print mode, then calling `page.emulateMediaType('print')` and `page.pdf({ format: 'A4' })`.
4. Run `pdftotext` on it and confirm:
   - every section title is present, in order;
   - no notebook text appears;
   - the Read text is extractable as normal sentences;
   - **equations come out as something a reader (or NotebookLM) can understand**.

   If KaTeX extraction is garbled, fix it for print (e.g. include KaTeX's MathML, or a print-only plain-text/LaTeX rendering of each equation) and re-test.
5. Render a few pages with `pdftoppm` and look at them for layout problems.
6. Report the page count and file size.

### The NotebookLM dropdown
- Directly under the Export PDF button, add a quiet disclosure, "NotebookLM video prompt ▾", with `aria-expanded`.
- It reveals the prompt in a readable block with a **Copy** button. Use `navigator.clipboard` inside try/catch, fall back to selecting the text, and show "Copied" feedback.
- Above the prompt, add two or three tiny steps: export the PDF → add it as a source in a NotebookLM notebook → Studio → Video Overview → customise → paste.
- No filled pills, no callout boxes.
- Keep the prompt text in a data file (e.g. `exportPrompt.js`), not in layout code.

**Research first.** Use web search to confirm NotebookLM's *current* Video Overview options:
- where the custom-instructions box is and whether it has a character limit;
- which formats and styles exist (e.g. "Explainer" vs "Brief");
- any limit on video length.

Fit the prompt to what you find and state in the dropdown which format to pick. If web search isn't available, or a limit can't be confirmed, don't stop: keep the prompt compact (well under ~1,000 characters) and say so in your summary.

**What the prompt must do.** Write it so the video is optimised for *understanding every concept in the PDF*:
- **Grounding:** use only the uploaded PDF. Follow its section order (§0 → §10). Use its notation and Keras names, and the slides' figure numbers when it refers to visuals.
- **Audience and goal:** a university student preparing for a test on this lecture, who knows MLPs and Keras basics but is new to autoencoders.
- **Teaching style:** for each concept, build intuition first, then state it precisely. Walk through the PDF's diagrams and numbers step by step, including the 163,814 and 82,414 parameter arithmetic and the tied-weights rule. Make the linear-autoencoder/PCA connection clear, including the PDF's note that the learned subspace matches but the axes needn't. Point out what the PDF's Slide check notes flag.
- **Priorities:**
  - the encoder/decoder/codings idea and the undercomplete bottleneck;
  - autoencoder ≈ PCA;
  - stacked autoencoders and parameter counting;
  - tying weights;
  - unsupervised pretraining;
  - training one autoencoder at a time;
  - t-SNE and the reconstruction plots kept brief.
- **Ending:** a short recap of the key ideas, plus a few quick self-test questions.

The deck is short, so one video should cover it. Add a two-part variant only if the research shows one video can't.

---

## Accuracy traps I found while scoping (verify each, don't take my word for it)

- **Slide 8, "it ends up performing PCA".**
  - A linear autoencoder with MSE learns the same *subspace* as PCA's top components. Its codings needn't equal the principal components themselves: they can be rotated, scaled and non-orthogonal. The slide's own caption says "approximate PCA".
  - The lab will make this visible. Explain it as the page's own clarification, beyond the slides, and keep the slide's claim intact.
- **Slide 12's 163,814:** 784·100 + 100 = 78,500 · 100·30 + 30 = 3,030 · 30·100 + 100 = 3,100 · 100·784 + 784 = 79,184. Re-derive it yourself. Note that the slide typesets it as "163, 814".
- **Slide 21's 82,414:** `dense_1` 78,500 + `dense_2` 3,030 + the two `DenseTranspose` bias vectors. Their size is `self.dense.input.shape[-1]`, so 100 and 784. Re-derive it.
  - Slide 21 also says `tied_ae` "achieves a slightly lower reconstruction error" while being trained for 10 epochs vs `stacked_ae`'s 20. The slides give no error values: don't invent any.
- **Slide 19's rule:** W_{N−ℓ+1} = W_ℓᵀ for ℓ = 1, 2, ⋯, N/2. Layer 1 is the first hidden layer, layer N/2 the coding layer and layer N the output layer, with N = 4 in the example. "Only W₁, W₂, and the bias terms need to be learned." Read the symbols from the image.
- **Slide 20:** the "(Note the modification (line # ***) to Géron's code)" line refers to `shape=[self.dense.input.shape[-1]]` in `build`. Explain what that shape is (the tied layer's input size). Don't speculate about why it was changed beyond what's visible.
- **Slide 24:**
  - The second `train_autoencoder` call uses `output_activation="relu"`; the slides don't say why. If you explain it (its targets are the first encoder's ReLU outputs, so they're non-negative), label it as the page's reasoning.
  - `plot_reconstructions` (slide 25) is from the author's notebook and isn't defined on the slides.
- **Slide wording quirks to record, not fix:**
  - slide 2's "Chapters 17.";
  - slide 4's "latent representations codings" (a word seems missing);
  - slide 5's "then spits out something that (hopefully) look very close";
  - slide 14's "datset's" and "T-SNE" vs the footnote's "t-distributed stochastic neighbour embedding";
  - slide 26's "an way".

  Typos don't need a Slide check note unless they change meaning. Grammar may be tidied in your prose. **Quote code and terms verbatim.**
- **Slide 3's topic list vs slide 26's outcomes:** "Training one autoencoder at a time" has no matching outcome. Map outcomes to sections honestly in the summary lab.
- **Footnote** (slide 14): t-SNE, proposed by van der Maaten and Hinton in 2008. It goes in `REFS` with `Fnote`, as in Lecture 4.
- Use the `slideNote` ("Slide check") block for every real discrepancy you find. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. Short intuition that explains a slide is welcome; new syllabus content isn't. Use the textbook only to interpret a figure, never as a source of extra content.
- Keep the deck's names (`stacked_encoder`, `stacked_decoder`, `stacked_ae`, `tied_ae`, `DenseTranspose`, `train_autoencoder`, `stacked_ae_1_by_1`, …) and Keras calls exactly as on the slides. Code blocks are verbatim: fix pdftotext's wrapping and indentation against the image.
- There's no lab sheet for this topic in `Documents/cits5017/labs/`. Don't go looking for outside material.

## Design rules (same as Lecture 4)
- Theme everything from the portal tokens and `.dl` styles. Check all three portal themes (Jade, Coral, Arcade/dark). Use `--dlv-*` for series colours. The notebook keeps its paper feel in every theme, with the pen colours tuned per theme (contrast of at least 4.5:1).
- Show tone or status as small labelled dots on ruled layouts. Don't use coloured rounded left-border callout boxes or filled badge pills. Code uses the kit's VS Code `Code` block.
- Respect `prefers-reduced-motion`. Everything is keyboard reachable. No emoji (use icons from `icons.jsx`).
- It must work at laptop width, in fullscreen on a large monitor, and at 390px wide with no horizontal page scroll.

---

## Subagents: use them for accuracy and coverage, within a sensible budget

You may spawn subagents wherever they make the result more accurate or the build faster, especially to **check accuracy and make sure every piece of content is covered**. Use as many as you judge necessary, but **don't drain my usage**:
- Aim for about **8 agents in total** across the build, and treat ~12 as a hard ceiling.
- Prefer one well-briefed agent over several overlapping ones.
- Don't re-run an audit on content that hasn't changed.
- Launch independent agents **in one message so they run in parallel**.
- Give every agent a **self-contained brief**: paths, the exact task, the output format, and "read-only" where it applies.
- Use **fresh general-purpose agents (not forks) for every audit**, so reviewers don't inherit your assumptions.

A sensible allocation:

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **1 transcriber** | Writes the whole 27-slide transcript |
| Ground truth (optional) | **1 data agent** | The Fashion MNIST pipeline |
| Audit | **3 auditors** | Content fidelity + coverage · numbers · visual + learning design |
| Re-audit | **1–2 re-auditors** | Only on sections changed by the fixes |

## Process

### Phase 1: Ground truth (start first; do Phase 2 while it runs)
- **The transcriber** renders every slide as an image *and* extracts its text, then writes `Documents/cits5017/markdown-lecs/lecture-5.md` in the format of `lecture-4.md`:
  - `## Slide N — title`, prose verbatim;
  - every equation in LaTeX **exactly as typeset** (read from the image);
  - code verbatim in fenced blocks, with correct indentation;
  - every figure described precisely: layers, unit counts, labels, arrows, what's shown in each panel;
  - a closing **Quirks** list of anything wrong, inconsistent or ambiguous, with the reason. Quirks are recorded, not fixed.

  Commit this transcript. It's what you and every auditor check against.
- **The data agent** (if you use one) builds the Fashion MNIST pipeline and reports the parameter-count gate.

### Phase 2: Orient (you, while Phase 1 runs)
- Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks, and the vault logs for the Lecture 4 study module and its student-notes refactor.
- Read `build_lecture4_study_module.md` and `refactor_lecture4_student_notes.md`.
- Read the Lecture 4 module's shell, `SheetPage.jsx`, `sheet.css`, `sheets/index.js` and two or three `sheets/sNN.js`, plus Lecture 4's legacy `notes` for the same sections, so you can see the sentence style I want next to the layout I want.
- Read `kit.jsx`, `kit.css` and `common.css`. Don't delegate this reading.

### Phase 3: Plan and first sections (you)
- Confirm the section plan against the transcript. Every slide 1–27 must land in exactly one section.
- Build the shell, then §2 and §3 completely (Read → Play → Write).
- Screenshot their notebook pages at 1440 and 390 in all three themes, and check them against "The notebook page" above:
  - no handwriting font;
  - proper sentences;
  - layout by idea;
  - four pens;
  - within the notes budget.

  Fix the format before repeating it.

### Phase 4: Remaining sections, then the PDF export (you)
- Build §0, §1 and §4–§10.
- Once every section exists, build the PDF export and the NotebookLM dropdown. Generate the PDF headlessly, check it as described above, and iterate until it's clean.
- Writing labs yourself is fine for a deck this size. If you delegate a lab, the builder owns exactly one `labs/<name>.jsx` + CSS partial, uses `../ui` and `../ae.js`, takes facts only from `slideData.js` and the transcript, and touches nothing else. Review it before wiring it in.
- `sections.js` and `sheets/` (all prose) stay yours, so the voice is consistent.

### Phase 5: Audit (parallel, read-only, fresh agents)
Each auditor returns findings as: slide N · file:line · what the slide says (quoted) · what the page says · severity (**wrong** / **misleading** / **missing** / **polish**).
- **Content fidelity + coverage:**
  - Every slide's content appears in Read or Play.
  - Every sentence, notes line, formula, code block, worked number and check answer matches the slide images and the transcript.
  - No invented content, and no notation drift.
- **Numbers:** independently re-derive every parameter count, shape and layer size. Confirm each lab's default state shows the slide's values, and that every number presented as the slides' is actually on a slide.
- **Visual + learning design:**
  - Screenshot the labs and notebook diagrams and compare them with the matching slide figures (17-1, 17-3, 17-6, 17-7 and the slide-19 diagram).
  - Check the notebook pages against the format and the notes budget (core concepts present, light ones short, skipped ones flagged with the "Not in these notes" line).
  - Check that every check question is answerable from its page.
  - Check that the page feels like the Lecture 4 module.
  - **Also review the generated PDF and the NotebookLM prompt**, rather than spawning extra agents for them:
    - read the PDF's text and a few page renders: is everything from Read and Play there, nothing from Write, and are equations and code readable?
    - does the prompt fit NotebookLM's limits, and would it teach the PDF's concepts in order with the right priorities?

### Phase 6: Fix, re-audit, verify (you)
- Fix every **wrong**, **misleading** and **missing** finding, or justify it in the summary. Re-run an auditor only on the sections you changed.
- Write `tools/dl-lecture5-study/page-check.mjs`, adapted from Lecture 4's. It checks:
  - zero console errors or warnings;
  - every section rendered with its slide receipt and every lab mounted;
  - slide coverage 1–27 from the section data;
  - focus mode;
  - ticks persist across a reload, and "Resume at §N" works;
  - the page renders with localStorage throwing and with reduced motion;
  - the notebook pages use the pen tokens and no handwriting font;
  - the export button calls the stubbed `window.print` once and `afterprint` restores the page;
  - the headless PDF's text includes every section title and no notebook text;
  - the NotebookLM dropdown opens, and Copy works or falls back;
  - 3 themes × 1440/390 screenshots with no horizontal scroll;
  - `/portal/dl-lecture-3-study` and `/portal/dl-lecture-4-study` still render.
- Add `check-ae.mjs` assertions for `ae.js`: 163,814; 82,414; Figure 17-1's shapes; and that the linear autoencoder's learned subspace matches PCA's on the page's data (e.g. principal angles under a small tolerance).
- Gates:
  - lint the new folder, `registry.js` and the tools folder clean (repo-wide lint has pre-existing errors elsewhere: report them, don't fix them);
  - `npm run build` passes;
  - the page check passes;
  - the Lecture 3 and Lecture 4 diffs against `main` are empty.

### Phase 7: Wrap-up
- **Commit** on `feat/dl-lecture-5-study` with the attribution line your environment specifies. **Don't merge to `main` or push without asking me.** If you used a worktree, say so and leave it in place.
- **Vault** (repo `CLAUDE.md`): create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and add the Lecture 5 study module to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
- **Memory:** update your auto-memory's Management Portal pointer with one line about this module.
- **Final summary:**
  - what was built: sections, lab count, notebook line count;
  - **what you left out of the notes and why**, section by section;
  - every Slide check note and why;
  - the parameter counts reproduced, and whether real Fashion MNIST data was used;
  - the PDF's page count and size, plus what's in and out of it, with two or three page-render paths;
  - **the final NotebookLM prompt text, pasted in full**, the format to choose, and the NotebookLM facts you confirmed (with sources) or couldn't confirm;
  - decisions you made on your own;
  - anything you couldn't verify;
  - **how many subagents you used**;
  - follow-ups, e.g. Lecture 5's code in Code Lab · Search (`codelab/entries.js`), or a shared study kit.

### Known gotchas in this repo
- Bash heredocs on this machine strip backslashes, which breaks KaTeX strings. Write scripts and data files with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks/timers), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lecture5-study/`), not from a scratchpad folder.
- Port 8787 belongs to another project. Ports 5174/5175 may be in use by other worktrees.
