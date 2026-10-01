# Build: CITS5017 Lecture 3 (CNNs) — Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. I have a personal React portal (this repo, Vite + React 19) with a **Deep Learning** section in the sidebar that already holds interactive lecture modules. I want a **new** module for Lecture 3 (CNNs) that's built around how I actually study:

> I go full screen, work down the page in slide order, read a short explanation, play with an interactive visual until the idea clicks, then copy a page of notes (with diagrams) into my paper notebook. Then I move on to the next part.

It should feel like **one continuous learning module I work down from top to bottom**. It is not a tabbed reference page and not a quiz app.

**Don't delete or change the existing Lecture 3 module.** Add this one as a new, separate tab.

---

## Where things are

| What | Path |
|---|---|
| Lecture slides (the source of truth, 53 slides) | `Documents/cits5017/lectures/cits5017-lect03-CNNs.pdf` |
| Partial markdown transcript (slides 1–16 only) | `Documents/cits5017/markdown-lecs/lecture-3.md` |
| Portal shell (don't edit) | `src/components/portal/Portal.jsx` |
| Module registry (add one entry here) | `src/components/portal/registry.js` |
| Existing DL modules | `src/components/portal/modules/deep-learning/` |
| Existing Lecture 3 (tabbed, slides 1–16 only; leave it alone) | `.../deep-learning/lecture3/` (`Lecture3.jsx`, `labs.jsx`, `labs2.jsx`, `quiz.js`, `lecture3.css`) |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css` (`Tex` via KaTeX, `Eq`, `Sub`, `Jot`, `Fnote`/`RefsProvider`, `Code`, `Unfold`, `Note`, …) |
| Shared page styles + series palette | `.../deep-learning/common.css` (`.dl-*`, `--dlv-*` colours, dark-stepped for the arcade theme) |
| Plot helpers | `.../deep-learning/plots.jsx` (`FnPlot`, `LayerFlowChart`), `mathfns.js` |
| Fullscreen precedent | `src/components/portal/modules/paper-reader/Reader.jsx` (~lines 85–95) and `Presentations.jsx` (~620–640) |

The lab sheets in `Documents/cits5017/labs/` (2, 3, 4) cover Topics 1, 2 and 4. None of them is about CNNs, so ignore them for this module.

### Reading the slides
- Text: `pdftotext -layout -f N -l N Documents/cits5017/lectures/cits5017-lect03-CNNs.pdf -`
- Figures: render pages to PNG in your scratchpad (`pdftoppm -png -r 90 -f N -l N <pdf> <scratch>/slide`) and look at them with the Read tool. Many slides are figure-led (Figures 14-1 to 14-x, LeNet/AlexNet/GoogLeNet/ResNet diagrams). Read **every** slide, not just the markdown, because the markdown stops at slide 16.

---

## Setup

1. Branch off `main`: `feat/dl-lecture-3-study`.
2. New folder: `src/components/portal/modules/deep-learning/lecture3-study/`. Put everything for this module there (component, section content, labs, CSS). Scope all new CSS classes with a unique prefix (e.g. `.dl3s-*`).
3. Register it in `registry.js`, directly after the existing `dl-lecture-3` entry:
   ```js
   { id: 'dl-lecture-3-study', label: 'Lecture 3 · CNNs (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture3Study },
   ```
   It will then be reachable at `/portal/dl-lecture-3-study`.
4. Reuse is encouraged: import from `kit.jsx`, `plots.jsx`, `mathfns.js` and `common.css`. You may import an existing Lecture 3 lab (`ConvolutionLab`, `StrideLab`, `ParamShareLab`, `FeatureMapLab`, `StackingLab`, `KerasShapesLab`) unchanged if it fits the flow. If one needs changes, **copy it into the new folder and adapt the copy**. Never edit the originals. Small, additive, backwards-compatible changes to `kit.jsx` are fine if they're genuinely shared.

---

## The page experience

### Full screen
- A clear **"Enter focus mode"** button at the top. It uses the Fullscreen API on the module's root element (follow the `Reader.jsx` pattern: `requestFullscreen`, `fullscreenchange` listener, `Esc` exits).
- In fullscreen the root must be its own scroll container (`height: 100vh; overflow-y: auto`) with an **explicit background** from the portal theme tokens. The default fullscreen backdrop is black.
- In focus mode, use a comfortable reading measure (~70ch for prose; labs and diagrams can go wider) and slightly larger type.
- Keep a slim sticky header in both modes: module title, the current section (updates on scroll), overall progress, and the fullscreen toggle.

### One continuous scroll, in slide order
- No tabs. Sections stack vertically in the order of the deck.
- A collapsible **section index** (a side rail on wide screens, a dropdown on narrow ones) shows every section with its slide range, lets me jump to any section, and marks sections whose notes I've finished.
- Remember my place: persist which notes lines I've ticked and the last section I was on in `localStorage` (prefix `dl3s:`, every read and write wrapped in try/catch). When I come back, offer "Resume at §N".

### Every section has the same three beats

**1. Read.** A short explanation of the slides it covers, kept as close to the slide content and order as possible. Show slide receipts (e.g. "slides 12–15"). Keep it tight: a few short paragraphs, key terms in bold, equations via `Tex`/`Eq` using the **same notation as the slides**. Long verbatim detail can go in an `Unfold`.

**2. Play.** One or two interactive, visual pieces that let me manipulate the concept and *see* it. They should be real, live computation, not just animations. Each lab should have:
- a one-line "try this" prompt telling me what to change and what to notice,
- direct labels on the visual (don't rely on colour alone),
- sensible defaults that match the slide's own example where the slide has one.

**3. Write — the notebook page.** This is the core of the module, so get it right. After each section, a visually distinct panel styled like a sheet of notebook paper (ruled lines, margin), titled with the section number and name. It holds **about one notebook page** of material I copy straight onto paper:
- **Notes:** written as normal, complete-but-short sentences, semi-summarised. No walls of text and no fragment soup. Roughly 6–12 lines, grouped under 2–4 small sub-headings. Each line is tickable (□ → ✓) like the existing `Jot`, and the ticks persist.
- **Draw this:** 1–2 diagrams worth drawing by hand. Render each as a **simple, monochrome, line-art SVG** that's hand-drawable in about 2 minutes: boxes, grids, arrows, short labels, no gradients or 3D. These are deliberately simpler than the interactive visuals. Under each one, add a one-line caption saying what to label.
- **Formulas to copy:** the section's key equations, each with a one-line plain-English reading.
- **Worked number (when the section has one):** a tiny worked example to copy, e.g. an output-size calculation or a parameter count.
- **Check yourself:** 1–2 one-line questions I should be able to answer from my notes, with the answer hidden behind a click.

A section doesn't need every block. Leave out a block when it isn't useful there, but keep the order fixed so the rhythm is predictable.

---

## Section plan (confirm against the PDF; merge or split if the slides suggest a better cut)

| § | Section | Slides | Play ideas (suggestions, not requirements) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | The chapter outline from slide 3 as the section index |
| 1 | Origins: visual cortex → neocognitron | 4–5 | Receptive fields: neurons that fire only for lines at a given angle in a small region; deeper layers = bigger fields |
| 2 | Convolution: a brief introduction | 6 | Step a 3×3 filter across a small image one position at a time, showing every multiply-add; preset kernels plus a drawable input |
| 3 | Convolutional layers & connections between layers | 7–9 | Hover an output neuron to light up its receptive field; sliders for f_h, f_w, stride and zero padding with the output size updating live |
| 4 | Filters & feature maps | 10–11 | Apply the slide's vertical- and horizontal-line filters to an image and see the two feature maps |
| 5 | Stacking multiple feature maps | 12–15 | 3D view: input channels → kernel volume → one output neuron; click a neuron to see its z_{i,j,k} sum expanded term by term (the slide-14 index ranges) |
| 6 | Implementing Conv2D in Keras | 16–19 | A live `Conv2D(...)` code snippet whose output shape, kernel shape and bias shape update as you change the arguments |
| 7 | Padding options ("valid" vs "same") | 20–21 | Toggle valid/same and stride, see which input cells get dropped or zero-padded, and see the output-size formula |
| 8 | Memory requirements of CNNs | 22–24 | Recreate the slide example (200 feature maps, 150×100, …): params, multiplications and RAM for one instance vs a mini-batch, training vs inference |
| 9 | Pooling layers | 25–31 | Max vs average pooling on a grid; shift the input by 1 px to show translation invariance; depthwise pooling; global average pooling |
| 10 | Hyperparameters in a CNN | 32 | A compact interactive table/checklist of what you'd tune |
| 11 | Typical CNN architecture + Fashion-MNIST example | 33–35 | Layer-by-layer shape flow of the slide-35 model (`LayerFlowChart` may help); click a layer to see its output shape and param count |
| 12 | Classic architectures: LeNet-5, AlexNet (+ data augmentation, LRN), GoogLeNet (inception module, 1×1 convs), VGGNet, ResNet (residual/skip connections), more recent | 36–47 | A timeline/side-by-side comparison; an inception-module diagram with clickable branches plus a 1×1-bottleneck param-savings calculator; a residual block with a skip toggle showing f(x)+x. Split into sub-parts with their own notebook pages if it's too much for one |
| 13 | Using pretrained models from Keras | 48–49 | The predict → top-k decode pipeline as an interactive flow |
| 14 | Transfer learning with a pretrained model | 50–51 | A freeze/unfreeze toggle on the base model stack plus the two-phase training timeline (train the head, then unfreeze and fine-tune with a lower learning rate) |
| 15 | Summary | 52 | The slide-52 learning outcomes as a final checklist, each linking back to its section and its notebook page |

---

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. You may add short intuition to explain a slide, but don't add new syllabus content. Where you're unsure what a figure shows, look at the rendered slide image.
- Keep the deck's notation (f_h, f_w, s_h, s_w, z_{i,j,k}, b_k, etc.) and Keras API calls exactly as written on the slides.
- Store the section content as data (e.g. `sections.js` holding the read text, notes lines, formulas and questions), with the labs and diagrams as components. That way the notes are easy to edit later without touching layout code.

## Design rules
- Match the portal: theme everything off the existing portal tokens and `.dl` styles, and check all three portal themes (Jade, Coral, Arcade/dark). Use the `--dlv-*` palette for series colours.
- The notebook-page panel should look different from everything else (paper feel, ruled lines) but still respect dark mode, e.g. as a dark "notebook" in Arcade.
- Respect `prefers-reduced-motion`. Make everything keyboard reachable. No emoji (the portal uses single-colour SVG icons from `icons.jsx`).
- It must work at laptop width, in fullscreen on a large monitor, and degrade sensibly on a narrow window.

---

## Process
**Do the whole build in one go.** Don't stop partway to check in with me or ask for feedback. Make sensible decisions yourself and list them in your final summary.

1. Read the whole PDF (text plus rendered figures) and the existing DL modules/kit first.
2. Build the page shell (fullscreen, sticky header, section index, persistence), then every section from 0 to 15, each fully done (Read → Play → Write). Finish sections 0–2 first and review them against the brief above before repeating the pattern, so the notebook-page format is consistent across all sections.
3. Verify: `npm run lint` and `npm run build` pass. Run `npm run dev`, open `/portal/dl-lecture-3-study` (the portal gate password is the mock one in `src/components/portal/auth.js`), and check: no console errors, fullscreen enter/exit and scrolling inside fullscreen, all three themes, resume-from-last-section, ticks persisting across reload, and that the original `dl-lecture-3` tab is unchanged.
   Fix anything that fails and re-check. Only finish once every section is built and everything passes.
4. Commit on the feature branch. Don't commit the lecture/lab PDFs in `Documents/cits5017/lectures` and `labs`, and don't merge to `main` or push without asking me.

`CLAUDE.md` asks you to document major features in an Obsidian vault at a Windows path (`C:\Users\james\Documents\james-claude-brain`). This machine is a Mac. If you can't find the vault, say so in your final summary instead of inventing a location.
