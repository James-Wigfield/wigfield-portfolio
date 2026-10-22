# Build: CITS5017 Lectures 6–7 (Convolutional AEs, Denoising AEs, Variational AEs, GANs and DCGANs): Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with one study module per lecture. Each module is one continuous page that I work down in focus mode, in slide order:

> I read a short explanation, play with an interactive visual until the idea clicks, then copy a page of notes into my paper notebook, and move on.

Build **the same kind of module for Topics 6 & 7**. They're one combined deck: `Documents/cits5017/lectures/cits5017-lect06-07-AE-conv-var-GAN.pdf`, 32 slides, Chapter 17 of Géron's *Hands-On Machine Learning*, 3rd ed. Its title slide reads "Topics 6&7: Convolutional AEs, Denoising AEs, Variational AEs, GANs, and DCGANs".

**The template is the Lecture 5 study module** ("Lecture 5 · Autoencoders (Study)", `/portal/dl-lecture-5-study`, `src/components/portal/modules/deep-learning/lecture5-study/`). I like exactly how it's built: its content, its labs, its notebook pages, its PDF export. Copy its shell and conventions, and only the content should differ.

Three things matter above everything else:

1. **Every piece of content in the lecture is covered, and all of it is accurate.**
   - Every slide lands in a section, in deck order.
   - Every claim, number, equation, code line and figure comes from the slides, in the slides' own notation.
   - I prepare for tests from these modules, so a wrong formula or a made-up number is worse than a missing lab.
2. **It works for learning.** The Read → Play → Write rhythm, with labs that show the mechanism really working (real computation, not decoration). This deck is about *generative* models, so I most want to see things being generated, sampled and interpolated.
3. **It's the Lecture 5 module in look and behaviour**, including the notebook pages, the notes budget, and the PDF export with its NotebookLM prompt.

> **Note on a saved preference:** your auto-memory has an older rule: "no long-scroll pages, use top tabs". **It doesn't apply here.** Study modules are deliberately one continuous page worked through in focus mode. The other saved rules still apply:
> - no tone-coloured callout boxes or filled pills;
> - VS-Code-style code blocks;
> - no walls of text.

---

## The notebook page (Write): build it exactly as Lecture 5 does

Lecture 5's pages are the model. Read `lecture5-study/SheetPage.jsx`, `sheet.css`, `sheets/index.js` (the schema) and every `sheets/sNN.js` before you write one. That means:
- **Layout by idea.** Each block is one idea: a blue sub-heading with its slide range, its lines, and *right there* the diagram, boxed formula, worked number, table or numbered steps that belong to it.
- **Proper sentences:** one idea per line, short and complete. No student shorthand ("&", "info", "∴", arrow chains standing in for verbs); arrows only where they show a real flow.
- **No handwriting font**: the page's normal typefaces.
- **The four pens:**

  | Pen | Used for |
  |---|---|
  | **Blue** | headings |
  | **Black** | body text, line-work, formulas and numbers |
  | **Red** | bullet markers and step numbers only |
  | **Green** | sparing highlights: a few key terms, the highlighted part of a diagram |

- **The margin** carries self-test questions (click to reveal) and the occasional "remember" note, plus pointers to Slide checks. No memory hooks and no "≠" asides.
- Tick-as-you-copy on every line and diagram, with stable keys.
- The grey **"Not in these notes (see Read): …"** line where a page deliberately leaves things out.
- Sections with nothing worth copying (the intro and the summary) have no notebook page, as in Lecture 5.

### Notes budget: I'm short on time
Writing notes is the slow part of studying, and I'm running out of time for this unit.
- **The Read and Play beats must cover every concept in the deck.**
- **The notebook pages carry only what's worth writing down.**

**My starting priorities** (adjust them if the slides suggest otherwise):

| Priority | Concepts |
|---|---|
| **Core (in the notes)** | **Convolutional AE:** the encoder is a CNN that shrinks height/width and grows depth; the decoder reverses it with transposed convolutions · undercomplete vs **overcomplete** · **denoising AE:** add noise (Gaussian or dropout) and train it to recover the clean input · **VAE:** probabilistic and generative; the encoder outputs a mean coding μ and a standard-deviation coding σ (in practice γ = log(σ²)); codings are *sampled*; loss = reconstruction loss + latent loss · **the latent-loss formula**, in its γ form (a boxed formula worth copying) · **generating** new images and **semantic interpolation** (the three steps) · **GAN:** generator vs discriminator · **the two training phases:** what's in each batch, the labels, and which network's weights are frozen · **the difficulties:** Nash equilibrium, mode collapse, oscillating parameters · **the DCGAN guidelines**, as a small table |
| **Light (one line at most)** | Why plain dense autoencoders don't suit images · the `Sampling` layer's job · why `fit()` can't train a GAN (a custom loop instead) · generated-image quality after training (fuzzy VAE images, noisy GAN images) |
| **Leave out of the notes (Read and Play only)** | Full code listings and the `conv_decoder.summary()` table (keep at most a key line, e.g. `fit(X_train, X_train)`) · the `tf.data` pipeline · the `train_on_batch` note · plotting code · the reading list on slide 32 |

**Budget:**
- Aim for roughly **3–7 lines per content section** and **under ~70 lines across the whole module**.
- Use at most one diagram per section, and only where drawing it helps memory. Good candidates: Figure 17-11's VAE, Figure 17-14's GAN, the two training phases.
- Parameter counting was examinable in earlier lectures. If you include a worked number, make it a single small one (e.g. one `Conv2DTranspose` layer's count), not the whole table.

---

## Where things are

| What | Path |
|---|---|
| **The source of truth** (32 slides) | `Documents/cits5017/lectures/cits5017-lect06-07-AE-conv-var-GAN.pdf` |
| **The template module** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture5-study/` |
| The template's tools (copy and adapt) | `tools/dl-lecture5-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`, `check-ae.mjs`, `fashion_pipeline.py`, `requirements.txt`) |
| The brief that built Lecture 5 (same requirements, different deck; read it) | `Documents/temp/prompt-dumping/build_lecture5_study_module.md` |
| How Lecture 5 actually turned out (decisions, gotchas) | vault log `03-Dev-Logs/2026-10-21-dl-lecture5-study.md` |
| Lecture 5's transcript (the format to match, and the background for this deck's "so far we have seen…" slide) | `Documents/cits5017/markdown-lecs/lecture-5.md` |
| **The unit's TensorFlow environment** (read before running any Python; see "Data") | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css`, `common.css` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. **Warning:** pdftotext garbles this deck.
  - It drops μ, σ, γ, Σ, ×, ⊤ and "𝓛" (slides 11–12, 5–6).
  - It loses code indentation (slide 14's `Sampling` class is indented correctly on the slide).
  - It breaks the `summary()` table on slide 6.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then look at them with the Read tool. **Read every slide as an image**, including Figures 17-8, 17-9, 17-11, 17-12, 17-14, 17-15 and 17-16, and the interpolation strip on slide 18.
- Don't embed slide renders in the page. Rebuild figures as SVG line-art and labs.

---

## Ground rules

- **Don't modify `lecture3-study/`, `lecture4-study/`, `lecture5-study/`** or any other module, or their tools folders. At the end, `git diff main -- src/components/portal/modules/deep-learning/lecture3-study src/components/portal/modules/deep-learning/lecture4-study src/components/portal/modules/deep-learning/lecture5-study tools/dl-lecture5-study` must be empty on your branch. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon.
- **Copy, don't refactor.** Don't pull the shared shell out into a framework in this task. Suggest it in your summary if you think it's worth doing.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at the start or at any point.
  - If something blocks you (a failed download, a package that won't install, a failed web request, an interactive prompt), make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is committed and the final summary is written.
  - The only things you must *not* do on your own are merging to `main` and pushing.

---

## Setup

1. **Branch and working tree.**
   - Run `git status` and `git worktree list`.
   - If the main working tree is on `main` with no uncommitted changes besides `Documents/temp/`, run `git checkout -b feat/dl-lecture-6-7-study main`. Use the dev server on 5173, or start `npm run dev` yourself as a background task if nothing answers there.
   - **If the tree is on another branch, or has uncommitted changes you didn't make**, another Claude instance may be working in this folder. Don't switch its branch or touch its files. Create a worktree instead: `git worktree add ../wigfield-portfolio-dl67s -b feat/dl-lecture-6-7-study main`. Run `npm install` there, start its dev server on port **5177**, and point every check script at it (`SITE_URL`).
   - `Documents/temp/` holds my prompt files: don't commit anything new from it. Only stage files you created or deliberately changed.
2. **New folder:** `src/components/portal/modules/deep-learning/lecture6-7-study/`. CSS prefix `.dl67s-*`. localStorage prefix `dl67s:`. Print class `html.dl67s-printing`. Every storage read and write goes in try/catch.
3. **Register it directly after the `dl-lecture-5-study` entry:**
   ```js
   { id: 'dl-lecture-6-7-study', label: 'Lectures 6–7 · AEs & GANs (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture67Study },
   ```
   It will then be at `/portal/dl-lecture-6-7-study`.
4. **Copy and adapt the Lecture 5 module**: the shell, `SheetPage.jsx`, `sheet.css`, `sheets/index.js` + `keys.js`, `Rich.jsx`, `ui.jsx`, `hooks.js`, `storage.js`, `context.js`, `ExportPdf.jsx`, `print.js`, `texText.js`, the lazy data loader pattern in `fashion.js`, the CSS and the diagram sheet-mode pattern.
   - Then **grep the copies for Lecture 5 leftovers**: `dl5s` class names, ids and storage keys; `ae.js`/`aeRun.js` imports; the "Topic 5 · Chapter 17 · slides 1–27" hero; the "27 slides" footer; slide-26 outcome references; the Lecture 5 NotebookLM prompt.
   - When you're done, nothing in the new folder should mention Lecture 5 content.
   - Copy `tools/dl-lecture5-study/` to `tools/dl-lecture6-7-study/` and adapt it. **Its scripts default to port 5176** (Lecture 5's old worktree), so change the default to 5173, or your worktree's port.
5. **Where things live.**
   - Maths in its own helper, `gen.js`: dense/conv shape and parameter counting (including `Conv2DTranspose`), MSE, the latent loss in both its σ and γ forms, the sampling step, linear interpolation, and a small MLP + optimiser for the in-browser toy GAN (see Play).
   - Slide facts (numbers, code listings, figure captions, footnotes, outcomes) go in `slideData.js`.
   - Read/Play prose goes in `sections.js`; notebook pages go in `sheets/sNN.js`.

---

## The page experience: same as Lecture 5

Everything about Lecture 5's page experience applies unchanged:
- focus mode (Fullscreen API with the overlay fallback; Esc exits);
- the sticky header with the current section and progress;
- one continuous scroll in slide order;
- the section rail/dropdown with slide ranges and done marks;
- "Resume at §N";
- persisted ticks.

There are three beats per section:
- **Read:** short, with slide receipts, the slides' notation, and long verbatim code in `Unfold`.
- **Play:** 1–2 live labs, each with a one-line "Try this" phrased *predict → change → notice*, direct labels, and defaults set to the slide's own example.
- **Write:** the notebook page above.

### Making it good for learning (for this deck in particular)
- **Lab defaults reproduce the slides' examples:**
  - `conv_encoder`/`conv_decoder` exactly as on slide 5;
  - `dropout_ae` with `Dropout(0.5)` (slide 9);
  - the VAE's 150 → 100 → codings (μ, γ) → 100 → 150 → 784 (slide 14), with 10-dimensional codings per slide 16;
  - the GAN's generator and discriminator (slide 23, `codings_size = 30`, batch 32);
  - the DCGAN (slide 29, `codings_size = 100`).
- **Label every layer with its output shape and parameter count.** That's where this deck's numbers come from: 4,464 / 4,640 / 4,624 / 145 → 13,873 for `conv_decoder`, and 54,479 for `conv_ae` (slide 6).
- **Real computation, honestly labelled.** Count parameters and shapes live. Compute the latent loss live. Sample and decode live where you can (see "Data"). Train a tiny toy GAN live in the browser.
  - **Never present a number or image as the slides' result unless it's quoted or shown on them.** Anything the page trains, samples or computes itself is labelled as this page's own run.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

The slides never say where Topic 6 ends and Topic 7 begins, so **don't label sections "Topic 6" or "Topic 7"**. If you group sections (e.g. VAE sub-sections, GAN sub-sections, like Lecture 4's §13.1/13.2), group them by content.

| § | Section | Slides | Play ideas (suggestions, not requirements) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | Slide 3's five topics mapped to the sections that cover them |
| 1 | Convolutional autoencoders | 4–6 | Shape flow through `conv_encoder` and `conv_decoder`, layer by layer (28×28×1 → … → 30 → 3×3×16 → … → 28×28×1), with live parameter counts reproducing slide 6's 13,873 and 54,479; a transposed-convolution visualiser showing how stride 2 upsamples 3 → 7 (`"valid"`) and 7 → 14 (`"same"`) |
| 2 | Other types of autoencoders; denoising autoencoders | 7–9 | A noise lab on real Fashion MNIST images: Gaussian noise vs dropout (switched-off pixels, rate 0.5 as slide 9), with the page's own trained `dropout_ae` reconstructions (see "Data"); undercomplete vs overcomplete coding layers shown by size |
| 3 | Variational autoencoders: what's different | 10–11 | Figure 17-11 live: an instance goes through the encoder to μ and σ, a Gaussian sample is drawn, and the decoder reconstructs. "Resample" shows the output changing even after training (probabilistic), next to a plain autoencoder that never changes |
| 4 | The VAE's loss: reconstruction + latent loss | 12–13 | Latent-loss calculator: sliders for μᵢ and σᵢ (or γᵢ) showing each term, the per-dimension loss, its minimum at μ = 0, σ = 1 (γ = 0), and that the σ and γ forms give the same number; the total loss as reconstruction + latent |
| 5 | Implementing a VAE in Keras | 14–15 | Code walk with shapes: inputs → 150 → 100 → μ, γ (10 each) → `Sampling` → 100 → 150 → 784. The `Sampling` line `tf.random.normal(…) * tf.exp(logvar / 2) + mean` explained term by term. Parameter counts are *this page's* (the slide leaves them as an exercise) |
| 6 | Generating images and semantic interpolation | 16–18 | Live generation from the page's own trained decoder: draw 21 codings (slide 16's 3 × 7), then interpolate two codings in 10 steps (slide 18), shown beside pixel-level blending of the same two images (the slide's "overlaid" contrast) |
| 7 | GANs: generator and discriminator | 19–20 | Figure 17-14 with the two roles; the generator compared with the VAE's decoder (slide 20) |
| 8 | Training a GAN: two phases per iteration | 21–22 | Phase stepper: phase 1's batch (32 fake labelled 0 + 32 real labelled 1; only the discriminator learns), phase 2's batch (32 fake labelled 1; discriminator frozen). Show which weights update in each phase |
| 9 | Implementing a GAN in Keras | 23–25 | The code mapped onto the two phases line by line; shapes and parameter counts (this page's); the `# ***` lines and what they toggle. **Toy GAN:** a tiny generator and discriminator trained live in the browser on a 1D or 2D target distribution, alternating the slides' two phases, with the discriminator's decision curve and the generated samples updating |
| 10 | GAN results and the difficulties of training | 26–27 | The toy GAN on a two-mode target: show mode collapse (samples gathering on one mode) and oscillation; explain the Nash equilibrium as the slide does |
| 11 | Deep convolutional GANs (DCGANs) | 28–30 | The five guidelines as a checklist mapped to slide 29's code. Mark where the code follows a guideline and where it doesn't (see the traps). Shape flow 100 → 7×7×128 → 14×14×64 → 28×28×1. The page's own generated samples (see "Data") |
| 12 | Summary and what's next | 31–32 | Slide 31's five outcomes as a persisted self-check, each linking to its section; slide 32's reading (Chapter 16, pp. 595–629) |

---

## Data and real computation

Lecture 5's `tools/dl-lecture5-study/fashion_pipeline.py` trained real Keras models offline and exported small, lazy-loaded data files. **Do the same here** with `tools/dl-lecture6-7-study/pipeline.py`.

### Where to run it: the unit's existing TensorFlow environment
**Read `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` first.** In short:
- **Where it lives:** the unit's environment is the conda env **`tf-2.20-gpu`** inside the WSL distro **`Ubuntu`**.
- **What's in it:** TensorFlow **2.21.0** and Keras **3.15.1** (the same versions Lecture 5's pipeline pinned), plus numpy, scikit-learn, scipy, pandas and matplotlib.
- **GPU:** it can use the **RTX 5070 Ti**.
- **How to call it from Windows:** use absolute paths through `wsl.exe`, e.g.:

  ```
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "C:\Users\james\Documents\personal-projects\wigfield-portfolio" -e env TF_CPP_MIN_LOG_LEVEL=2 MPLBACKEND=Agg /home/james/miniconda3/envs/tf-2.20-gpu/bin/python -I tools/dl-lecture6-7-study/pipeline.py --data-dir <dir> --out <dir>
  ```

  `MSYS_NO_PATHCONV=1` is needed from Git Bash; PowerShell doesn't need it.
- **Paths:** inside WSL, pass Linux paths for files. `C:\…` is `/mnt/c/…`, e.g. `/mnt/c/Users/james/Documents/personal-projects/wigfield-portfolio/src/components/portal/modules/deep-learning/lecture6-7-study/data`.

Rules for using it:
- **Use it read-only.**
  - Don't `pip install`, `conda install` or upgrade anything in `tf-2.20-gpu`. It belongs to my university project.
  - Don't touch anything else in `cits5017-project-two` (don't run its notebook).
  - If something you need is genuinely missing, create a *separate* env or venv and say so in your summary. Lecture 5's `tools/dl-lecture5-study/requirements.txt` is the fallback recipe if WSL isn't usable at all.
- **GPU.** The setup doc lists warnings that are expected and harmless (no native kernels for compute capability 12.0, PTX JIT fallback, "upgrade to CUDA 12.6.3"). **Don't try to "fix" CUDA.**
  - The GPU should speed up the convolutional models (`conv_ae`, the DCGAN) a lot.
  - The doc found no speedup for small models, so you can run the dense ones (`dropout_ae`, the VAE, the dense GAN) on the CPU with `CUDA_VISIBLE_DEVICES=-1` if that's simpler or faster.
  - If the GPU path misbehaves, fall back to the CPU.
- Record in each exported file's header which device trained it, plus the TF/Keras versions.

### What to train
- Download Fashion MNIST the way Lecture 5's pipeline does, into its own scratchpad directory.
- **Train the slides' models as written:** `conv_ae` (slide 5, 10 epochs), `dropout_ae` (slide 9, 10 epochs), the VAE (slides 14–15, 25 epochs, batch 128, `codings_size = 10`), the GAN (slides 23–25, 50 epochs) and the DCGAN (slide 29, 50 epochs).
  - Time-box the whole run to about an hour.
  - With the GPU, the slides' full epoch counts may fit. **Prefer the slides' exact epochs where they fit.**
  - Where they don't (most likely the GAN's Python-level `train_on_batch` loop or the DCGAN), train fewer epochs and say so on the page ("this page's run: N epochs; the slide's figure is after 50").
- **Gates:** `conv_decoder` = 13,873 and `conv_ae` = 54,479 parameters (slide 6). Record the VAE, GAN and DCGAN counts as this page's own.
- **Run the slides' code verbatim first.** If a listing fails or misbehaves under the installed Keras, record the exact error or behaviour for a Slide check, then apply the smallest fix for the page's own run and label it. This matters most for the `trainable` toggling in the GAN loop and the latent loss added inside `Sampling.call`.
- **What to export** (aim under ~400 KB in total, all lazy-loaded):
  - a few originals, noisy versions and `dropout_ae` reconstructions;
  - **the VAE decoder's weights**, quantised (e.g. int8 with per-layer scales), so the page can decode new codings live: generation, interpolation and latent sliders;
  - a handful of GAN and DCGAN samples.

  File headers record the source, seeds, versions, epochs and date.
- **Fallback:** if the download, install or training isn't possible unattended, build those labs from clearly labelled synthetic stand-ins (e.g. a tiny decoder trained in the browser on simple shapes), and say so in the summary.
- **The toy GAN in the browser** is always the page's own: a small MLP generator and discriminator, binary cross-entropy, alternating the slides' two phases, deterministic seeds, and respect for reduced motion.

---

## PDF export and the NotebookLM prompt

Copy Lecture 5's implementation (`ExportPdf.jsx`, `print.js`, `texText.js`, `exportPrompt.js`) and adapt it. The behaviour is the same:
- **"Export PDF"** in the hero actions, next to "Enter focus mode". It uses a print mode (`html.dl67s-printing`) and `window.print()` (Save as PDF), so NotebookLM gets real, selectable text.
- **Contents:** every section's **Read and Play** only.
  - `Unfold`s expanded, footnotes and Slide checks kept.
  - Labs print a finished, deterministic state: trained and sampled, not empty.
  - Every formula prints its plain-text twin, so the latent-loss equations read correctly in the PDF's text layer.
- **Left out:** notebook pages and page chrome. The PDF prints on a light paper palette, on A4.
- **The "NotebookLM video prompt ▾" dropdown** under the button: the prompt, a Copy button with a fallback, and the three steps.

**The prompt itself** is written for this deck:
- **Grounding:** use only the PDF; follow its sections in order; use its notation (μ, σ, γ = log(σ²)) and Keras names.
- **Audience:** a student revising for a test who knows MLPs, CNNs, Keras and basic autoencoders (Lecture 5) but is new to VAEs and GANs.
- **Teaching style:** intuition first, then precise statements. Walk through the shape flows and the latent-loss formula term by term. Make the *probabilistic* and *generative* differences clear. Explain the two GAN training phases and why each freezes what it does. Cover the difficulties and the DCGAN guidelines. Point out the PDF's Slide checks.
- **Ending:** a short recap plus a few self-test questions.

Before writing it, re-check NotebookLM's current Video Overview options with web search; Lecture 5's `exportPrompt.js` records what was true on 2026-10-21. Keep it under ~1,000 characters unless you confirm a larger limit, and say which format to pick. If web search isn't available, don't stop: reuse Lecture 5's findings and say so.

**Testing:** stub `window.print` in every automated check, before the page loads, so a print dialog can never hang this unattended run. Then generate the PDF headlessly (`page.emulateMediaType('print')` + `page.pdf`) and check its text with `pdftotext`:
- every section title is present, in order;
- no notebook text appears;
- the equations are readable.

Look at a few page renders. Report the page count and file size.

---

## Accuracy traps I found while scoping (verify each, don't take my word for it)

- **Slide 6's counts** come from `conv_decoder.summary()`: Dense 4,464 · Conv2DTranspose 4,640 / 4,624 / 145 · total 13,873; `conv_ae.count_params()` = 54,479.
  - By my arithmetic the encoder is 160 + 4,640 + 18,496 + 17,310 = 40,606, and 40,606 + 13,873 = 54,479. Re-derive all of it.
  - The summary's layer-type column is truncated ("Conv2DTra nspose"). That's Keras's column width, not a typo to fix.
- **Slide 5's shape comments:** 28 → 14 → 7 → **3** after the third `MaxPool2D` (7/2 rounded down), and the first `Conv2DTranspose` (stride 2, `"valid"`) takes 3 → 7. A transposed-convolution output-size rule isn't on the slides; if you show one, label it as the page's own.
- **The VAE's `codings_size` is never defined on slides 14–18.** Slide 16 says "the codings are only 10-dimensional", so use 10 and say where it comes from. (`codings_size = 30` on slide 23 and `100` on slide 29 belong to the GAN and the DCGAN.)
- **Slide 12** says the decoder reconstructs "using the two hidden layers Hidden 3 and Hidden 4", while Figure 17-11 (slide 11) appears to label the decoder's layers **Hidden 4 and Hidden 5**. Check this at high resolution. If it's a real mismatch, add a Slide check. The sentence also has an unclosed parenthesis.
- **Slide 12's formulas:** 𝓛 = −½ Σᵢ₌₁ⁿ [1 + log(σᵢ²) − σᵢ² − μᵢ²], then with γ = log(σ²): 𝓛 = −½ Σᵢ₌₁ⁿ [1 + γᵢ − exp(γᵢ) − μᵢ²]. Read them from the image and keep the slide's symbols.
- **Slide 14 vs Géron:** the slide notes "quite a few changes to Géron's code" (the `# ***` lines). The latent loss is added *inside* `Sampling.call` and divided by 784 (the comment says 784 = 28 × 28 is the output dimension), and `variational_encoder` outputs `[codings_mean, codings_log_var, codings]`.
  - The sampling line computes μ + exp(γ/2) · ε with ε ~ N(0, 1). The slides don't name it; if you call it the "reparameterisation trick", label that name as beyond the slides.
  - `class Sampling(tf.keras.Layer)` uses `tf.keras.Layer`, not `tf.keras.layers.Layer`. Check that it runs in the installed Keras before saying anything about it.
- **Slide 13's footnote** ends "arXiv:1606.05908, 2016 (2016)" (the year appears twice). That's a quirk, not something to fix.
- **Slide 25's GAN loop:**
  - The slide marks `discriminator.trainable = True` / `False` "# *** this line is missing in the author's code". Keep it verbatim.
  - Whether toggling `trainable` *after* `compile()` behaves as intended depends on the Keras version. Report what the pipeline actually observed; don't assert either way without evidence.
  - Phase 1's labels are 0 for fake and 1 for real (slide 21); phase 2's are all 1 (slide 22).
- **Slide 29's DCGAN vs slide 28's guidelines.** Check each guideline against the code and record mismatches as Slide checks, not fixes. Candidates:
  - the discriminator has **no BatchNormalization** (it uses `Dropout(0.4)`), though the guidelines say to use BN in both networks;
  - the generator *starts* with a `Dense(7 * 7 * 128)` layer with no activation.

  Slide 28 itself says the guidelines "will work in many cases, but not always".
- **The DCGAN generator's `tanh` output** lies in [−1, 1], while the GAN on slide 23 uses `sigmoid` ([0, 1]). "Compilation and training are similar to the code for GANs" (slide 29), but the slides show no rescaling of the training images or reshape to 28×28×1. If your run rescales them, label that as the page's own step beyond the slides.
- **Slide 27** says the GAN paper's authors "demonstrated that a GAN can only reach a single Nash equilibrium". Don't add the textbook's explanation of what that equilibrium looks like; it isn't on the slides.
- **Slide wording quirks to record, not fix:**
  - slide 2's "Chapters 17.";
  - slide 7's "train them :";
  - slide 20's unclosed "(just feed it some Gaussian noise, and it outputs a new image.".

  Quote code and terms verbatim.
- **Footnotes** go in `REFS` with `Fnote`, as in Lecture 5: Vincent et al. 2010 (slide 8), Kingma & Welling 2013 (slide 10), Doersch 2016 (slide 13), Goodfellow et al. 2014 (slide 19), Radford et al. 2015 (slide 28).
- Use the `slideNote` ("Slide check") block for every real discrepancy. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. Short intuition that explains a slide is welcome; new syllabus content isn't. Use the textbook only to interpret a figure, never as a source of extra content.
- Keep the deck's names (`conv_encoder`, `conv_decoder`, `conv_ae`, `dropout_ae`, `Sampling`, `variational_encoder`, `variational_decoder`, `variational_ae`, `codings_mean`, `codings_log_var`, `generator`, `discriminator`, `gan`, `train_gan`, …) and Keras calls exactly as on the slides. Code blocks are verbatim: fix pdftotext's wrapping and indentation against the image.
- Slide 7 recaps Lecture 5 ("basic, stacked, and convolutional…"). You may link to the Lecture 5 module for background, but don't re-teach it.

## Design rules (same as Lecture 5)
- Theme everything from the portal tokens and `.dl` styles. Check all three portal themes (Jade, Coral, Arcade/dark).
- The notebook keeps its paper feel, with the pen colours tuned per theme (contrast of at least 4.5:1).
- Show tone or status as small labelled dots on ruled layouts. Don't use coloured rounded left-border callout boxes or filled badge pills. Code uses the kit's VS Code `Code` block.
- Respect `prefers-reduced-motion`, especially in the live toy GAN and the generation labs. Everything is keyboard reachable. No emoji.
- It must work at laptop width, in fullscreen, and at 390px wide with no horizontal page scroll.

---

## Subagents: use them for accuracy and coverage, within a sensible budget

You may spawn subagents wherever they make the result more accurate or the build faster, especially to **check accuracy and make sure every piece of content is covered**. Don't drain my usage:
- Aim for about **8 agents in total**, and treat ~12 as a hard ceiling. Lecture 5 used 6.
- Prefer one well-briefed agent over several overlapping ones.
- Don't re-run an audit on content that hasn't changed.
- Launch independent agents in one message so they run in parallel.
- Give every agent a self-contained brief: paths, task, output format, and "read-only" where it applies.
- Use fresh general-purpose agents (not forks) for audits.

A sensible allocation:

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **1 transcriber** | The whole 32-slide transcript |
| Ground truth | **1 training/data agent** | The pipeline above |
| Audit | **3 auditors** | Content fidelity + coverage · numbers · visual + learning design (including the PDF and the NotebookLM prompt) |
| Re-audit | **1–2 re-auditors** | Only on sections changed by the fixes |

## Process

### Phase 1: Ground truth (start first; do Phase 2 while it runs)
- **The transcriber** renders every slide as an image *and* extracts its text, then writes `Documents/cits5017/markdown-lecs/lecture-6-7.md` in the format of `lecture-5.md`:
  - `## Slide N — title`, prose verbatim;
  - every equation in LaTeX **exactly as typeset**;
  - code verbatim with correct indentation;
  - the `summary()` table rebuilt;
  - every figure described precisely: layers and their labels, arrows, the noise source, which images are shown;
  - a closing **Quirks** list.

  Commit this transcript.
- **The training/data agent** reads `ENVIRONMENT_SETUP.md`, then builds and runs the pipeline in the `tf-2.20-gpu` env without modifying it. It reports:
  - the parameter gates;
  - what ran verbatim and what needed a fix (with exact errors);
  - the epochs used and which device ran each model;
  - the export sizes.

### Phase 2: Orient (you, while Phase 1 runs)
- Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks, and the Lecture 5 dev log.
- Read `build_lecture5_study_module.md`.
- Read **every file** in `lecture5-study/` (shell, sheets, print/export, `texText.js`, labs) and `tools/dl-lecture5-study/`. Don't delegate this reading.

### Phase 3: Plan and first sections (you)
- Confirm the section plan against the transcript. Every slide 1–32 must land in exactly one section.
- Build the shell, then §3 and §4 (VAE) completely (Read → Play → Write).
- Screenshot their notebook pages at 1440 and 390 in all three themes and compare them with Lecture 5's pages. Fix the format before repeating it.

### Phase 4: Remaining sections, then the PDF export (you)
- Build the rest.
- If you delegate a lab, the builder owns exactly one `labs/<name>.jsx` + CSS partial, uses `../ui` and `../gen.js`, takes facts only from `slideData.js` and the transcript, and touches nothing else. Review it before wiring it in.
- `sections.js` and `sheets/` stay yours, so the voice is consistent.
- Then build the export and the dropdown, generate the PDF headlessly, and iterate until it's clean.

### Phase 5: Audit (parallel, read-only, fresh agents)
Each auditor returns findings as: slide N · file:line · what the slide says (quoted) · what the page says · severity (**wrong** / **misleading** / **missing** / **polish**).
- **Content fidelity + coverage:**
  - Every slide's content appears in Read or Play.
  - Every sentence, notes line, formula, code block, worked number and check answer matches the slide images and the transcript.
  - Every "page's own" label is present where needed.
  - No invented content.
- **Numbers:** independently re-derive every shape and parameter count (slide 6's especially), confirm the lab defaults show the slides' values, and confirm that nothing presented as the slides' is actually the page's own.
- **Visual + learning design:**
  - Compare the labs and diagrams with Figures 17-8, 17-11 and 17-14 and the DCGAN code.
  - Check the notebook pages against Lecture 5's format and the notes budget.
  - Check that every check question is answerable from its page.
  - **Review the generated PDF and the NotebookLM prompt** (Read + Play all present, no Write, equations readable, the prompt fits the limits and has the right priorities).

### Phase 6: Fix, re-audit, verify (you)
- Fix every **wrong**, **misleading** and **missing** finding, or justify it in the summary. Re-run an auditor only on the sections you changed.
- Adapt `tools/dl-lecture6-7-study/page-check.mjs` from Lecture 5's. It covers everything Lecture 5's covers:
  - render and coverage of slides 1–32;
  - pens and contrast, and no handwriting font;
  - focus mode;
  - ticks persist across a reload, and "Resume at §N" works;
  - the page renders with localStorage throwing and with reduced motion;
  - the stubbed export plus `afterprint`, and the PDF's text;
  - the NotebookLM dropdown;
  - 3 themes × 1440/390 with no horizontal scroll;
  - **Lectures 3, 4 and 5 still render**.
- Add `check-gen.mjs` assertions for `gen.js`:
  - 13,873 and 54,479;
  - every shape in slide 5's comments;
  - the σ and γ latent-loss forms agree;
  - the loss is minimised at μ = 0, σ = 1;
  - interpolation endpoints;
  - the toy GAN's two phases update only the intended weights.
- Gates:
  - lint the new folder, `registry.js` and the tools folder clean (report pre-existing repo-wide lint errors, don't fix them);
  - `npm run build` passes;
  - the page check passes;
  - the Lecture 3/4/5 diffs against `main` are empty.

### Phase 7: Wrap-up
- **Commit** on `feat/dl-lecture-6-7-study` with the attribution line your environment specifies. **Don't merge to `main` or push without asking me.** If you used a worktree, say so and leave it in place.
- **Vault** (repo `CLAUDE.md`): create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and add the module to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
- **Memory:** update your auto-memory's Management Portal pointer with one line about this module.
- **Final summary:**
  - what was built: sections, lab count, notebook line count;
  - **what you left out of the notes and why**, section by section;
  - every Slide check note and why;
  - the parameter gates;
  - what the training pipeline ran: verbatim or fixed, epochs, and what's real vs synthetic;
  - the PDF's page count and size;
  - **the final NotebookLM prompt, pasted in full**, plus the format to choose;
  - decisions you made;
  - anything unverified;
  - how many subagents you used;
  - follow-ups (Code Lab · Search entries, a shared study kit).

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data files with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks/timers), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lecture6-7-study/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, which is why Lecture 5 prints a plain-text twin of every formula (`texText.js`). Extend its symbol table for γ, μ, σ, 𝓛, Σ with limits, exp and log.
- Lecture 5's contrast check had to resolve `color-mix()` paper colours through a 1×1 canvas pixel; reuse that approach.
- Port 8787 belongs to another project.
- **WSL from Windows.**
  - Bare `python`/`conda` aren't found in non-interactive WSL shells (`.bashrc` exits early), and `python3` there is the system Python without TensorFlow. Always use the env's absolute binary path with `wsl.exe -d Ubuntu --cd … -e …`.
  - Put non-trivial code in a `.py` file rather than fighting quoting with `-c`.
  - Set `MPLBACKEND=Agg` for any plotting and save with `savefig`.
