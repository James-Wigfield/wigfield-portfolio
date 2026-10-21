# Lecture 3 Study Module: a §12 summary page, a "Read + Play" PDF export and a NotebookLM video prompt

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a study module for Lecture 3. It's called **"Lecture 3 · CNNs (Study)"**, lives at `/portal/dl-lecture-3-study`, and its code is in `src/components/portal/modules/deep-learning/lecture3-study/`. It's one continuous page, and every section has three beats: **Read → Play → Write**. Write is a notebook page that I copy onto paper.

I want three additions to this module.

### 1. A single summary page for the classic architectures (§12)
§12 is currently three in-depth sections:
- **12.1** ILSVRC, LeNet-5 & AlexNet (slides 36–40)
- **12.2** GoogLeNet & VGGNet (slides 41–44)
- **12.3** ResNet & more recent architectures (slides 45–47)

I don't have time to study all three in depth, and I don't think the topic will matter much in my exam. Add **one new section** that summarises all of §12. It should cover only what matters: what each model is, its one key idea, and its result. It also gets **a single, short notebook page** covering all three sub-sections. The three in-depth sections stay where they are for reference.

### 2. A PDF export button at the top of the page
It exports **only the Read and Play parts of every section**, never the notebook (Write) pages. I'll upload the PDF to NotebookLM as a source.

### 3. A dropdown under that button that reveals a NotebookLM prompt
I'll paste that prompt into NotebookLM to generate a **Video Overview** of everything in the PDF. The prompt should make the video as useful as possible for understanding all the concepts in the PDF. It needs a copy button.

---

## Where things are

| What | Path |
|---|---|
| The module (this task changes it) | `src/components/portal/modules/deep-learning/lecture3-study/` |
| Section content, as data, in slide order | `.../lecture3-study/sections.js` (format documented at the top: `read`, `play`, `notes`, `draw`, `formulas`, `worked`, `check`, `group`) |
| Slide facts, incl. `ARCHS` (the seven architectures, with year, authors, result, idea and top-5 error) and `ROADMAP` / `OUTCOMES` (which sections cover which topics) | `.../lecture3-study/slideData.js` |
| Shell: hero, sticky bar, index rail, focus mode, ticks, progress | `.../lecture3-study/Lecture3Study.jsx` (labs are mapped in `LABS`; the index hard-codes the group heading as `§12 {groupHead}`; the hero actions sit at the "Enter focus mode" button) |
| The §12 labs (`classicTables`, `augment`, `inception`, `residual`, `timeline`) | `.../lecture3-study/labs/labsArch.jsx` |
| Line-art figures for "Draw this" | `.../lecture3-study/diagrams.jsx` |
| Shared kit (`Tex`, `Code`, `Note`, `Unfold`, `Fnote`, …) | `.../deep-learning/kit.jsx` (`Unfold` always renders its children and only collapses them with CSS) |
| The slides (source of truth) | `Documents/cits5017/lectures/cits5017-lect03-CNNs.pdf` |
| Slide transcript | `Documents/cits5017/markdown-lecs/lecture-3.md` |
| The brief that built this module (its content and design rules still apply) | `Documents/cits5017/build_lecture3_study_module.md` |
| Check-script precedent to copy from (puppeteer-core + local Edge, gets through the portal gate, per-section screenshots) | `tools/dl-lecture4-study/page-check.mjs`, `shot.mjs` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. It garbles some maths, so read every equation and figure from the rendered slide image.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then view them with the Read tool.

---

## Ground rules

- **This task deliberately changes `lecture3-study/`.** Your memory and vault may say "Lecture 3 is the reference implementation, don't edit it". That rule was for *building Lecture 4*, and it doesn't apply here.
- **Don't touch `lecture4-study/`** or any other module. At the end, `git diff main -- src/components/portal/modules/deep-learning/lecture4-study` must be empty. Don't port these features to Lecture 4. If you think they'd be worth having there, suggest it in your summary.
- **Don't break my progress.**
  - Existing ticks (`dl3s:ticks`, keyed by section id) and other `dl3s:` storage must keep working.
  - Give the new section a new id that doesn't collide with existing ones.
  - Every storage read and write goes in try/catch, as in `storage.js`.
- **Content fidelity, as in the original build.**
  - Every fact, number and name comes from the slides (36–47 for the summary), in the slides' own notation and wording.
  - A number is only presented as the slides' if it's quoted from them.
  - Existing "Slide check" notes (`slideNote`) in §12.1–12.3 stand. The summary may leave details out, but must not contradict them.
  - Don't add facts about these architectures from outside the slides, however well known.
- **Saved design rules still apply** (see your auto-memory):
  - No tone-coloured, rounded, left-border callout boxes; no filled badge pills.
  - Code blocks keep the VS Code look.
  - No walls of text.
- **The "use top tabs, no long scroll" memory rule doesn't apply.** This module is one continuous page by design.
- **Shared files.** Keep changes to `kit.jsx`, `kit.css`, `common.css`, `Portal.jsx` and `portal.css` to zero if you can. Scope everything, including print CSS, to this module.
- **Do the whole job in one go.** Don't stop partway to check in with me. Make sensible decisions and list them in your final summary.
- **This runs unattended.** I'm away from the computer for a few hours and nobody will answer questions.
  - Never ask me anything, and never wait for confirmation.
  - If something blocks you (a missing tool, a failed web search, an interactive prompt), make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is committed and the final summary is written.
  - The only things you must *not* do on your own are merging to `main` and pushing.

---

## Part 1: The §12 summary section

**Placement.** Put it **directly before §12.1**, so it's the quick path through §12. End its Read beat with a jump link to §13 (the next main topic) for when I'm skipping the deep dives.
- Choose a number and title that read naturally in the index rail, e.g. `12` / "Classic architectures in brief", with the deep dives staying 12.1–12.3.
- The index currently prints a group heading as the literal `§12 {groupHead}` above the first section of a group. Make sure the heading, the new section and the three deep dives read cleanly together, with no duplicated "§12 … §12" noise.
- Update `ROADMAP` / `OUTCOMES` mappings (and the hero's section count, if shown) so the new section is included.

**Recommended (small, and it fits my intent):** mark §12.1–12.3 as *optional deep dives*:
- a quiet "optional" label in the index rail, not a pill;
- they don't count against overall progress.

Ticking them should still work if I do them. If this turns out messy in the shell, skip it and say so.

**Read.** Short, scannable, no walls of text.
- One or two framing lines: ILSVRC and the top-5 error rate, and how far it fell over the years (slide 36).
- **A compact comparison table** of LeNet-5, AlexNet, GoogLeNet, VGGNet and ResNet. Columns: year · who · key idea (one line) · result (slide-quoted, e.g. the top-5 error where the slides give one).
  - `ARCHS` in `slideData.js` already holds this, so build from it rather than duplicating it.
  - Xception and SENet get one line each. The "other architectures" list gets one line at most.
- **One or two lines per main model** on *why it mattered*. Draw these from the existing §12.1–12.3 Read text, tightened:
  - LeNet-5: the classic conv/pool stack, MNIST.
  - AlexNet: bigger and deeper; conv layers stacked directly; dropout + data augmentation.
  - GoogLeNet: inception modules; far fewer parameters.
  - VGGNet: simple repeated 3×3 conv blocks.
  - ResNet: skip connections and residual learning, enabling very deep nets.
- Use the existing Read block types (paragraphs, `{ list }`, `{ note }`, `{ unfold }`, …). If a table needs a new block type, add it additively to `Rich.jsx`, the way Lecture 4 added a `{ fig }` block, and confirm the other sections render unchanged.

**Play.** Reuse one existing lab that gives the overview at a glance, such as `timeline` (the top-5 error, winner by winner). No new heavy labs. A second existing lab is fine only if it really helps a skim reader (e.g. `residual`).

**Write (the notebook page).** One page, deliberately light:
- **2–3 sub-headings, about 6–10 tickable lines in total**, covering all three sub-sections. It should be copyable in five minutes.
- **At most one small "Draw this"**: the single most useful sketch, e.g. a residual unit's skip connection or an inception module. Reuse an existing figure key from `diagrams.jsx`; don't build a new figure unless nothing fits.
- **No formulas block and no worked number**, unless a one-liner from the slides is genuinely central.
- **3–4 "Check yourself" questions**, e.g. one per main model ("What did ResNet add that let it go so deep?"), with answers from the slides.

---

## Part 2: PDF export (Read + Play only)

**The button.** Add an "Export PDF" button in the hero actions, next to "Enter focus mode". Style it like the existing secondary buttons and pick a fitting icon from `icons.jsx`.

**Recommended approach: a print mode plus the browser's "Save as PDF".** Don't rasterise the page with html2canvas or jsPDF. NotebookLM needs **real, selectable text**, and an image PDF would be useless to it. Printing also needs no new dependencies, always reflects the current page, and doesn't publish a PDF of course material as a public static asset. If you find a better approach that still produces real text, explain why in your summary.

On click:
1. Enter a **print mode**: put a class on `<html>` (e.g. `dl3s-printing`) so every print rule is scoped to this module and printing other pages is unaffected.
2. Leave focus mode if it's on.
3. Wait for fonts and KaTeX to settle.
4. Set `document.title` to a sensible default filename, e.g. `CITS5017 L3 CNNs — Read + Play`.
5. Call `window.print()`.
6. On `afterprint`, restore everything: title, class, and focus mode if you left it.

**What the PDF contains:**
- The hero title.
- Then **every section in order**, each with its § number, title and slide range, its **Read** beat and its **Play** beat.
- Read beats print in full: `Unfold` bodies expanded, footnote references included, "Slide check" notes kept.
- Play beats print as the labs' default state: the visual, its caption and its readouts.
- The new §12 summary is included.

**Recommended default for §12.1–12.3:** leave the in-depth sections *out* of the PDF and keep the summary in, so the video doesn't spend a third of its time on the topic I'm deprioritising. Add a quiet checkbox beside the button, "include §12.1–12.3 deep dives", unchecked by default.

**What it leaves out:**
- every notebook (Write) page;
- the portal's sidebar and topbar, the module's sticky bar, the index rail, "Resume", the hero's other buttons and the export UI itself;
- tick boxes;
- interactive controls that mean nothing on paper (sliders, steppers, play buttons). Their current values should still be readable as text where they matter. Use your judgement lab by lab.

**Print layout:**
- Always print on a light, paper palette, whatever the portal theme. The arcade theme is dark; don't print dark pages.
- Code blocks must be readable in print: either keep the VS Code look with `print-color-adjust: exact`, or use a light code palette for print only.
- Keep figures, tables, equations and code blocks from splitting across pages (`break-inside: avoid`), and start each section on a new page if that reads better.
- Use A4 margins.

**Check the output properly.** Generate the PDF headlessly by entering the same print mode, then calling `page.emulateMediaType('print')` and `page.pdf({ format: 'A4' })`.
- **In every automated check, stub out `window.print`** before the page loads, e.g. `page.evaluateOnNewDocument(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; })`. A real print dialog can hang an unattended run.
- Assert that the button called the stub once, and that `afterprint` cleanup restores the page. Dispatch `new Event('afterprint')` yourself to trigger it.

Then:
- Run `pdftotext` on it and confirm:
  - every section title is present, in order;
  - no notebook text appears ("Notebook page", "lines copied", "Check yourself", note lines);
  - the Read text is extractable as normal sentences;
  - **equations come out as something a reader (or NotebookLM) can understand**.
- If KaTeX extraction is garbled (duplicated characters, broken symbols), fix it for print. For example, include KaTeX's MathML or a print-only plain-text/LaTeX rendering of each equation, and hide the visual duplicate's text from extraction. Re-test after the fix.
- Render a few pages with `pdftoppm` and look at them for layout problems.
- Report the page count and file size.

---

## Part 3: The NotebookLM prompt dropdown

**UI.**
- Directly under the Export PDF button, add a disclosure: a quiet text button such as "NotebookLM video prompt ▾", with `aria-expanded`.
- It reveals the prompt in a readable block with a **Copy** button. Use `navigator.clipboard` with a try/catch and a select-the-text fallback, and show "Copied" feedback.
- Above the prompt, add two or three tiny steps: export the PDF → add it as a source in a NotebookLM notebook → Studio → Video Overview → customise → paste.
- Style it per the saved design rules: no filled pills, no callout boxes.
- Keep the prompt text in a data file (e.g. `slideData.js` or a new `exportPrompt.js`), not in layout code.

**Research first.** Use web search to confirm NotebookLM's *current* Video Overview options:
- where the custom-instructions box is and whether it has a character limit;
- which formats and styles exist (e.g. an "Explainer" vs a "Brief" format);
- any limit on video length.

Fit the prompt to what you find, and state in the dropdown which format to pick. If you can't confirm a limit, or web search isn't available, don't stop: keep the prompt compact (well under ~1,000 characters is a safe target) and say so in your summary.

**What the prompt must do.** Write it so the video is optimised for *understanding every concept in the PDF*:
- **Grounding:** use only the uploaded PDF. Follow its section order (§0 → §15). Use its notation and terms, and the slides' figure numbers when it refers to visuals.
- **Audience and goal:** a university student preparing for a test on this lecture, who knows basic neural networks but is new to CNNs.
- **Teaching style:** for each concept, build intuition first, then state it precisely. Walk through the PDF's diagrams and worked numbers (output-size calculations, parameter counts, memory estimates) step by step. Point out the confusions the PDF itself flags, including its "Slide check" notes.
- **Priorities:**
  - Give the core mechanics the most time: convolution, filters and feature maps, stacking, padding and stride, pooling, memory, and the typical architecture.
  - Keep classic architectures **brief**, as the summary does.
  - Cover pretrained models and transfer learning at a practical level.
- **Ending:** a short recap of the key formulas and ideas, plus a few quick self-test questions.

If the research shows that one video can't realistically cover the whole PDF well, add an optional **two-part variant** under the main prompt (e.g. part 1 = §0–§8, part 2 = §9–§15), each with its own copy button, and explain this in the dropdown in one line.

---

## Process

1. **Setup.** Run `git status`. The tree should be clean on `main`, apart from `Documents/temp/` (untracked; don't commit it). Create the branch from `main` explicitly: `git checkout -b feat/dl3s-summary-pdf main`.
   - **If the current branch isn't `main`, or there are uncommitted changes you didn't make**, another Claude instance may be working in this folder (e.g. on Lecture 4). Don't switch branches or touch its files. Instead, create a worktree: `git worktree add ../wigfield-portfolio-dl3s -b feat/dl3s-summary-pdf main`. Run `npm install` there if needed, start its dev server on another port (e.g. 5174), and point your check scripts at it (`SITE_URL`).
   - **Dev server.** If nothing answers on http://localhost:5173 (or your worktree's port), start `npm run dev` yourself as a background task.
2. **Orient.**
   - Read `sections.js` §12.1–12.3 in full, plus `ARCHS` and `ROADMAP`/`OUTCOMES` in `slideData.js`.
   - Read the shell's index, progress and hero code, `Rich.jsx`, and the §12 labs.
   - Read slides 36–47 as images.
3. **Build Part 1** and screenshot it at 1440 and 390 in all three themes (jade, coral, arcade).
4. **Build Part 2.** Generate the PDF headlessly, then check its text and pages as described above. Iterate until the PDF is clean.
5. **Research NotebookLM, then build Part 3.**
6. **Audit with fresh, read-only agents, in parallel:**
   - **Fidelity:** every claim in the summary and its notebook page traces to slides 36–47, and nothing contradicts a Slide check.
   - **PDF:** read the generated PDF's text and page images. Is everything from Read + Play there, is nothing from Write there, and are equations and code readable?
   - **Prompt:** does it fit NotebookLM's limits, and would it produce a video that teaches the PDF's concepts in order with the right priorities?
7. **Fix every wrong, misleading or missing finding, then verify.**
   - Lint the module and the tools folder.
   - Create `tools/dl-lecture3-study/page-check.mjs`, adapted from Lecture 4's. It should check:
     - the new section renders with its Read, Play and notebook page, and appears in the index;
     - existing ticks survive;
     - the export button produces a PDF (via the headless path) whose text includes every section and excludes notebook text;
     - the dropdown opens, and Copy works or falls back;
     - no console errors or warnings;
     - no horizontal scroll at 390 in every theme;
     - Lecture 4 still renders.
   - Run `npm run build`, and confirm the Lecture 4 diff is empty.
8. **Commit** on `feat/dl3s-summary-pdf` with the attribution line your environment specifies.
   - Stage only files you created or deliberately changed.
   - **Don't merge to `main` or push without asking me.**
   - If you used a worktree, say so and leave it in place.

### Known gotchas in this repo
- Bash heredocs on this machine strip backslashes, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body, and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/…`), not from a scratchpad folder.

## Wrap-up
- **Vault:** add a dev log in `03-Dev-Logs/` from the template, and update the Lecture 3 study entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
- **Memory:** update your auto-memory's Management Portal pointer with one line: the §12 summary section, the PDF print mode, and the NotebookLM prompt's location.
- **Final summary for me:**
  - what was built;
  - the summary section's content outline;
  - the PDF's page count and size, plus what's in and out of it;
  - the final NotebookLM prompt text (pasted in full) and the format to choose;
  - the NotebookLM facts you confirmed, with sources, and what you couldn't confirm;
  - decisions you made;
  - anything unverified;
  - screenshot paths, including two or three PDF page renders.
