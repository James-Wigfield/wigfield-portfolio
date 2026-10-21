# Follow-up: Lecture 4 Study Module, "Read + Play" PDF export and a NotebookLM video prompt

You've just finished the student-notes refactor of the Lecture 4 study module (`/portal/dl-lecture-4-study`, `src/components/portal/modules/deep-learning/lecture4-study/`, branch `feat/dl4s-student-notes`). Keep going in this same session and on this same branch: you already have the module's content and structure in context.

## What I want

1. **An "Export PDF" button at the top of the page** that exports a PDF of **only the Read and Play parts of every section**. Never the notebook (Write) pages: neither the student-notes tab nor the Legacy tab. I'll upload the PDF to NotebookLM as a source.
2. **A dropdown under that button** that reveals a prompt I can paste into NotebookLM to generate a **Video Overview** of everything in the PDF. The prompt should make the video as useful as possible for understanding every concept in the PDF. It needs a copy button.

I'm asking other Claude instances to build the same feature for Lecture 3 (`feat/dl3s-summary-pdf`, in the worktree `../wigfield-portfolio-dl3s`) and inside the new Lecture 5 module (`feat/dl-lecture-5-study`, in `../wigfield-portfolio-dl5s`).
- Use the same wording, so all three look and behave alike: an **"Export PDF"** button and a **"NotebookLM video prompt ▾"** disclosure.
- If the Lecture 3 branch has a commit with its `print.js`, `NotebookLmPrompt.jsx` and `exportPrompt.js`, you may read them as a reference. Its work may still be uncommitted in that worktree; don't copy unfinished files from it.
- The requirements below are what counts.

## Ground rules

- **Work unattended.** I may be away from the computer.
  - Start straight away. Don't present a plan for approval, don't enter plan mode, and don't ask questions at any point.
  - If something blocks you, make the safest reasonable choice, note it for the summary, and carry on.
  - Don't end your turn until everything is committed and the summary is written.
- **Only `lecture4-study/` and `tools/dl-lecture4-study/` change.**
  - Don't touch `lecture3-study/` or any other module.
  - Don't touch the other worktrees (`../wigfield-portfolio-dl3s`, `../wigfield-portfolio-dl5s`) or their dev servers (ports 5174 and 5176 may be in use).
  - Keep changes to shared files (`kit.jsx`, `kit.css`, `common.css`, `Portal.jsx`, `portal.css`) at zero, and scope all print CSS to this module.
- **Copy, don't refactor.** Don't build a shared export kit across lectures while the other instances are mid-build. If you think one is worth doing later, say so in your summary.
- **Nothing else on the page changes.** That covers the student-notes tab and the Legacy tab, ticks, progress, focus mode and the labs' normal behaviour. Existing `dl4s:` storage keeps working, and any new storage access goes in try/catch.
- **The saved design rules still apply:** no tone-coloured left-border callout boxes, no filled pills, VS-Code-style code blocks.

## The button and the approach

Add **"Export PDF"** to the hero actions, next to "Enter focus mode". Style it like the existing secondary buttons and give it an icon from `icons.jsx`.

**Use a print mode plus the browser's "Save as PDF".** Don't rasterise the page with html2canvas or jsPDF. NotebookLM needs **real, selectable text**. Printing also needs no new dependencies, always matches the current page, and doesn't publish course material as a public static file.

On click:
1. Put a class on `<html>` (e.g. `dl4s-printing`) so every print rule is scoped to this module.
2. Leave focus mode if it's on.
3. Wait for fonts and KaTeX to settle.
4. Set `document.title` to a sensible default filename, e.g. `CITS5017 L4 RNNs — Read + Play`.
5. Call `window.print()`.
6. On `afterprint`, restore everything: title, class, focus mode if you left it, and any lab state you changed for printing.

## What the PDF contains

- The hero title.
- Then **every section in order**, each with its § number, title and slide range, its **Read** beat and its **Play** beat.
- **Read** prints in full:
  - `Unfold` bodies expanded (the slide code listings);
  - `{ fig }` diagrams;
  - footnote references;
  - every Slide check note.
- **Play** prints each lab in a **meaningful state**: the visual, its caption and its readouts.
  - Where a lab's default shows little until it's stepped, print its completed or most informative state instead. Use a deterministic state, never a random one, and restore it after printing. Examples:
    - the slide-34 loop: all 14 rounds done;
    - the Conv1D stepper;
    - the LSTM/GRU sequence labs.
  - Interactive tables and matrices print as they are.
- **The validation-MAE scoreboard strips print**, since they're part of the forecasting story. So does the full scoreboard in §16.

## What it leaves out

- every notebook page (both tabs) and the tab row;
- the portal's sidebar and topbar, the module's sticky bar, the index rail, "Resume", the hero's other buttons and the export UI itself;
- tick boxes;
- controls that mean nothing on paper (sliders, chips, steppers, play buttons). Keep their current values readable as text where they matter.

## Print layout

- Always print on a light, paper palette, whatever the portal theme. Arcade is dark; don't print dark pages.
- Code blocks must stay readable: either keep the VS Code look with `print-color-adjust: exact`, or use a light code palette for print only.
- Wide labs that scroll horizontally on screen (`.dl4s-wide`) must fit the page width in print, not be clipped.
- Use `break-inside: avoid` on figures, tables, equations and code. Start each section on a new page if that reads better.
- Use A4 margins.

## Check the PDF properly

1. **Stub `window.print` in every automated check**, before the page loads, e.g. `page.evaluateOnNewDocument(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; })`. A real print dialog would hang an unattended run.
2. Assert that the button called the stub once. Dispatch `new Event('afterprint')` and assert the page is restored, including the notebook tab, focus mode and lab state.
3. Generate the PDF by entering the same print mode, then calling `page.emulateMediaType('print')` and `page.pdf({ format: 'A4' })`.
4. Run `pdftotext` on it and confirm:
   - all 18 section titles are present, in order;
   - no notebook text appears ("Notebook page", "lines copied", tab labels, note lines);
   - the Read text is extractable as normal sentences;
   - **equations come out as something a reader (or NotebookLM) can understand**. This deck is equation-heavy (slides 9, 47, 49), so check them specifically. If KaTeX extraction is garbled, fix it for print (e.g. include KaTeX's MathML, or a print-only plain-text/LaTeX rendering of each equation) and re-test.
5. Render several pages with `pdftoppm` (at least a code-heavy one, an equation-heavy one, a lab with a chart and a scoreboard page) and look at them for layout problems.
6. Report the page count and file size.

## The NotebookLM dropdown

- Directly under the Export PDF button, add a quiet disclosure, **"NotebookLM video prompt ▾"**, with `aria-expanded`.
- It reveals the prompt in a readable block with a **Copy** button. Use `navigator.clipboard` inside try/catch, fall back to selecting the text, and show "Copied" feedback.
- Above the prompt, add two or three tiny steps: export the PDF → add it as a source in a NotebookLM notebook → Studio → Video Overview → customise → paste.
- No filled pills, no callout boxes.
- Keep the prompt text in a data file (e.g. `exportPrompt.js`), not in layout code.

**Research first.** Use web search to confirm NotebookLM's *current* Video Overview options:
- where the custom-instructions box is and whether it has a character limit;
- which formats and styles exist (e.g. "Explainer" vs "Brief");
- any limit on video length.

Fit the prompt to what you find, and state in the dropdown which format to pick. If web search isn't available, or a limit can't be confirmed, don't stop: keep the prompt compact (well under ~1,000 characters) and say so in your summary.

**What the prompt must do.** Write it so the video is optimised for *understanding every concept in the PDF*:
- **Grounding:** use only the uploaded PDF. Follow its section order (§0 → §16). Use its notation (row vectors with transposes, the time subscripts, σ and ⊗) and Keras names (`univar_model`, `mulvar_model`, `ahead_model`, …), and the slides' figure numbers when it refers to visuals.
- **Audience and goal:** a university student preparing for a test on this lecture, who knows MLPs, CNNs and Keras basics but is new to RNNs.
- **Teaching style:** for each concept, build intuition first, then state it precisely. Walk through the PDF's diagrams, shapes and numbers step by step: matrix shapes, parameter counts, the windowing example, and the naive-forecast MAE. Tell the forecasting part as the PDF does, as one story of models scored by validation MAE. Point out what the PDF's Slide check notes flag.
- **Priorities:**
  - recurrent neurons, unrolling and memory cells;
  - the RNN equations with their shapes;
  - input/output sequence types;
  - BPTT;
  - the forecasting workflow (naive baseline, windows, linear vs RNN, deep RNNs, multivariate input, multi-step forecasts);
  - unstable gradients and layer normalisation;
  - LSTM and GRU cells, explained gate by gate;
  - Conv1D for sequences.

  Keep the code-listing details light.
- **Ending:** a short recap of the key ideas and formulas, plus a few quick self-test questions.

This deck is long (52 slides). If the research shows one video can't cover it well, add an optional **two-part variant** under the main prompt, each with its own copy button, and explain this in the dropdown in one line. Example split: part 1 = §0–§9, RNN fundamentals through the first forecasting models; part 2 = §10–§16.

## Verify and commit

- **Extend `tools/dl-lecture4-study/page-check.mjs`** to check:
  - the export button calls the stubbed `window.print` once and `afterprint` restores the page;
  - the headless PDF's text has all 18 section titles and no notebook text;
  - the dropdown opens, and Copy works or falls back;
  - everything the check already covered still passes (tabs, ticks, either-page progress, the legacy pixel comparison if you still have the baseline, 3 themes × 1440/390, no console errors, Lecture 3 still renders).
- Lint the module and the tools folder clean, run `node tools/dl-lecture4-study/check-rnn.mjs` (and `check-sheets.mjs`), and run `npm run build`. Confirm `git diff main -- src/components/portal/modules/deep-learning/lecture3-study` is empty.
- **Commit** on `feat/dl4s-student-notes` as a new commit, with the attribution line your environment specifies.
  - Stage only files you created or deliberately changed. `Documents/temp/` stays out of the commit.
  - **Don't merge to `main` or push without asking me.**

## Wrap-up

- **Vault:** add a short section to today's dev log for the student-notes work (`03-Dev-Logs/2026-10-21-dl4s-student-notes.md`), or create a new log if the date has changed. Add a mention to the Lecture 4 entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
- **Memory:** add one line to your auto-memory's Management Portal pointer: the Lecture 4 PDF print mode and where the NotebookLM prompt lives.
- **Final summary for me:**
  - what was built;
  - the PDF's page count and size, plus what's in and out of it, with paths to three or four page renders;
  - **the final NotebookLM prompt text, pasted in full** (and the two-part variant, if you made one), plus the format to choose;
  - the NotebookLM facts you confirmed, with sources, and what you couldn't confirm;
  - which labs print a different state from their on-screen default, and why;
  - decisions you made;
  - anything unverified.
