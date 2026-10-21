# Refactor: Lecture 4 Study Module, "student notes" notebook pages (legacy kept behind a tab)

## What I want and why

I'm a uni student working through my CITS5017 study modules in my React portal (this repo: Vite + React 19). The one to change is **"Lecture 4 · RNNs (Study)"**: route `/portal/dl-lecture-4-study`, folder `src/components/portal/modules/deep-learning/lecture4-study/`. Each of its 18 sections has three beats: **Read → Play → Write**. **Only the Write beat changes.** That's the notebook page I copy onto paper, rendered by `NotebookPage.jsx`.

The *content* of the notebook pages is almost perfect. The *layout* isn't. Every page runs in the same fixed order:

> Notes → Draw this → Formulas to copy → Worked number → Check yourself

That feels too systematic. I write the notes, then scroll down to a diagram that belongs to a bullet I wrote three minutes ago, then the numbers, then a quiz at the end. **If a diagram, formula or worked number belongs to a part of the notes, it should sit in that part of the page,** next to the bullets it explains.

I want each notebook page to feel like the notes of **a student who takes particularly neat notes**: still structured, but with a more creative layout that helps me memorise. Think of:
- a heading with its bullets and the little diagram right beside them;
- a boxed key formula with a worked example under it;
- a margin with "remember" asides and quick self-test questions;
- an arrow linking cause to effect;
- a small comparison table where two things are being contrasted.

**Nothing too crazy:** no gimmicks (no fake tape, coffee stains, rotated sticky notes, scribbly animations or messy handwriting). Neat, calm, and easy to copy.

### Keep the old version

Each section's notebook page becomes **tabbed**:
- **Tab 1 (selected by default):** the new student-notes page.
- **Tab 2, "Legacy":** today's notebook page, unchanged in content, look and behaviour.

### My pens (this drives the colours)

I copy these pages with four pens. The new page should use exactly these inks, so what I see is what I write:

| Pen | Used for |
|---|---|
| **Blue** | All headings (page title, sub-headings) |
| **Black** | All body text, diagram line-work, formula text, worked numbers |
| **Red** | Bullet points (the bullet markers and list numbers, not the text) |
| **Green** | Sparing highlights: key terms or results in the text, and highlighted parts of diagrams (e.g. the path a bullet is talking about) |

No other ink colours in the notes content. Page furniture is fine in the UI's neutral greys, clearly not "ink": the tabs, tick boxes, the lines-copied counter, reveal buttons and the paper's rules.

---

## Where things are

| What | Path |
|---|---|
| The module (only this folder changes, plus its checks) | `src/components/portal/modules/deep-learning/lecture4-study/` |
| Today's notebook page (becomes the Legacy tab, **don't change it**) | `.../lecture4-study/NotebookPage.jsx` + the `.dl4s-nb*` rules in `lecture4-study.css` |
| All section content, as data (legacy notes come from here) | `.../lecture4-study/sections.js`: each section's `notes`, `draw`, `formulas`, `worked`, `check` |
| Line-art figures used by "Draw this" | `.../lecture4-study/diagrams.jsx` (17 figures, `Diagram fig="…"`) |
| Inline markup renderer | `.../lecture4-study/Rich.jsx` (`**bold**`, `*italic*`, `` `code` ``, `$tex$`, `[label](#id)`, `[^n]`) |
| Shell: renders each section, owns ticks and progress | `.../lecture4-study/Lecture4Study.jsx` (`StudySection` renders `<NotebookPage>`; ticks persist under `dl4s:ticks` via `storage.js`; a jump-to-notebook uses the `${domId(id)}-nb` anchor) |
| Slide transcript (fact-check against this) | `Documents/cits5017/markdown-lecs/lecture-4.md` |
| The slides themselves | `Documents/cits5017/lectures/cits5017-lect04-Processing-sequences.pdf` |
| The brief that built this module (rules on fidelity, slide checks and design still apply) | `Documents/temp/prompt-dumping/build_lecture4_study_module.md` |
| Existing checks | `tools/dl-lecture4-study/check-rnn.mjs`, `page-check.mjs` (puppeteer-core + local Edge, gets through the portal gate), `shot.mjs` (per-section screenshots, `--part=nb`) |
| Shared kit (`Tex`, `Code`, `Note`, `Unfold`, …) | `.../deep-learning/kit.jsx` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

---

## Ground rules

- **Lecture 4 only.** Don't touch `lecture3-study/` or any other module. At the end, `git diff main -- src/components/portal/modules/deep-learning/lecture3-study` must be empty.
- **The Legacy tab must be today's page, exactly.** Leave `NotebookPage.jsx` and the existing `.dl4s-nb*` CSS untouched if you can; wrap them rather than edit them. If you truly must touch them, the legacy page must still render pixel-identically. Before you change anything, screenshot a few legacy pages on `main` (e.g. §3, §6, §13.1, §14 at 1440 in the jade theme) and compare them with the Legacy tab at the end.
- **Don't lose my progress.** Existing `dl4s:ticks` data must keep working for the Legacy tab. The new page's ticks get their own storage key. Every storage read and write goes in try/catch, as in `storage.js`.
- **Content fidelity is unchanged from the original build.**
  - Every fact, number, equation and piece of notation comes from the slides, in the slides' own notation.
  - A number the page computes itself is labelled as this page's own.
  - Where the slides disagree with themselves, the existing "Slide check" notes (`slideNote` in `sections.js`) already handle it. Don't silently "fix" the slides in the new notes either.
  - Memory hooks or mnemonics you add must be clearly the page's own and must not introduce new facts.
- **Reuse, don't rewrite, the substance.** The new page is a re-layout of the existing `notes`, `draw`, `formulas`, `worked` and `check` content for that section.
  - You may tighten wording into a neat student's phrasing: short phrases, "→" for "leads to", "∴", "e.g.", "vs".
  - You may merge duplicates and add structure: boxes, tables, numbered steps, margin asides.
  - Don't drop anything that matters, and don't make the page longer to copy. Aim for no more writing than the legacy page; somewhat less is better.
- **Do the whole job in one go.** Don't stop partway to check in with me. Make sensible decisions and list them in your final summary.
- **Assume this runs unattended.** I'm likely away from the computer.
  - Never ask me anything, and never wait for confirmation.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is committed and the final summary is written.
  - The only things you must *not* do on your own are merging to `main` and pushing.
- **My saved design rules still apply** (see your auto-memory):
  - No tone-coloured, rounded, left-border callout boxes; no filled badge pills.
  - Code blocks keep the VS Code look.
  - No walls of text.
- **The "use top tabs, no long scroll" memory rule doesn't apply.** This module is deliberately one continuous page. The only new tabs are the two per notebook page.
- A thin black pen-drawn box around a key formula, or a hand-ruled table, is fine: that's what a neat student draws. It is not the forbidden callout style.

---

## The new page: what it should be like

### Structure
Organise each section's page **by idea, not by content type.** A typical page:
1. **Title** in blue (§ number + title), with the slide range written small at the top right, as a student dates a page. Optionally, one "big idea" line under it with a green highlight on its key phrase. It must come from the slides.
2. **Two to four topic blocks**, roughly the legacy sub-headings. Each block holds everything about that idea:
   - a blue sub-heading and red-bulleted black lines;
   - **its diagram right beside or under those bullets** (not in a separate "Draw this" block), with the part being discussed highlighted green;
   - **its formula** drawn in a thin pen box, with its one-line reading under it;
   - **its worked number** directly under the formula it uses, with the result in green;
   - **its self-test question(s)** in the margin, next to the lines they test.
3. **A narrow margin column**, on wide screens, for short asides: "remember", "≠" contrasts, a mnemonic, a "Q:" with click-to-reveal. On narrow screens it folds in under its block.
4. Where the content compares things, use a **small ruled table** instead of parallel bullet lists. Good candidates: the sequence modes in §4, BN vs LN in §12, LSTM vs GRU in §14, Keras parameter counts.
5. Where the content is a process, use **numbered steps** (red numbers). Good candidates: the data prep in §7, the slide-34 loop in §11, the LSTM long-term path in §13.

Vary the layout per section to suit its content. Some pages want bullets-left/diagram-right, some want a diagram first with numbered callouts, some want a table. That variety is the point, but keep the same pen system and the same neat hand throughout.

### Illustrative sketch (shape only; colours in brackets; content taken from §13.1's existing notes)

```
§13.1 LSTM cells  [blue]                                  slides 42–47
Big idea: an LSTM adds a long-term state, [green: c(t)], alongside h(t).

Why LSTM?  [blue]                                     │ margin
 [red]•  basic RNN loses info at each step            │ remember: after a while,
          → no trace of the first inputs              │ no trace of the first
 [red]•  LSTM (1997): converges faster,               │ inputs
          detects long-term dependencies              │ Q: which state is the
                                                      │ long-term one? (reveal)
The long-term path  [blue]        ┌ Figure 15-12, black line-work,
 [red]1. forget gate ⊗ drops       │ [green] on the c line
       some memories               │  c(t−1) ─⊗────(+)────────▶ c(t)
 [red]2. (+) adds new memories     │            │     │
       chosen by the input gate    │       f   g   i       o
 [red]3. c(t) leaves unchanged     │  …
 [red]4. tanh(c(t)) → output gate  └
       → h(t) = y(t)

In Keras: LSTM(12) → 685 params · val MAE [green: 30,262] (slide 43)
```

### Look and feel
- **Paper.** Keep the notebook-paper feel of the legacy page (ruled lines, a faint margin line), but quieter so the inks stand out. Make the faint margin rule clearly not "red pen".
- **Inks.**
  - Define the four as tokens on the sheet, e.g. `--pen-blue`, `--pen-black`, `--pen-red`, `--pen-green`. They should look like real ballpoint colours, not neon UI colours.
  - Tune them for **every portal theme** (jade, coral and the dark arcade theme). In arcade the paper is dark (see the `.portal[data-portal-theme='arcade'] .dl4s-nb` rules), so "black" becomes the page's main light ink there. Keep the mapping obvious, and keep body text at a contrast of at least 4.5:1.
- **Type.** Body text must stay very easy to read, including next to KaTeX.
  - A neat, print-style handwriting face for headings is fine, if it's legible and loaded the way the repo already loads fonts.
  - Try it on the body too, but drop it if it makes maths or small text harder to read.
  - Never a messy or cursive hand.
- **Highlights.** Green is used sparingly: a few key terms per block, plus the highlighted path in a diagram. If everything is green, nothing is.
- **Diagrams.**
  - Reuse `diagrams.jsx`. Add *additive* hooks so a figure can render in "sheet" mode: black line-work, with the relevant part in green, sized to sit beside text.
  - Legacy rendering must not change. If a sheet needs a smaller or simpler version of a figure, add a variant rather than editing the legacy one.
  - Diagrams should still be copyable by hand in a minute or two.
- **Ticks.**
  - Keep tick-as-you-copy on the new page: each line is clickable, a small tick appears in the margin, and the state persists under a new key such as `dl4s:sheetTicks`.
  - Block-level or line-level ticking is your call. Give ticks stable keys (e.g. `blockId:n`) so later edits don't shift them.
  - "Tick every line" / "clear ticks" tools stay, styled as quiet page furniture.
- **Progress.** A section counts as done in the index rail and header progress when **either** its new page **or** its legacy page is fully ticked. The "n/m lines copied" counter shows the active tab's numbers.
- **Self-test.** Check questions move to the margin next to what they test, each with its own click-to-reveal. They aren't tickable lines.
- **Tabs.**
  - Two tabs at the top of each notebook page: the new one first and selected by default, then "Legacy".
  - Style them like notebook divider tabs or a quiet underlined tab row, **not** filled pills.
  - Use proper `role="tablist"`, `tab` and `tabpanel`, `aria-selected`, and arrow-key navigation.
  - The tab choice doesn't need to persist: each page opens on the new tab.
  - The jump-to-notebook anchor (`${domId(id)}-nb`) must still land on the notebook page.
- **Narrow screens (390px).** The margin column folds into the flow, diagrams fit or scroll inside their own frame, and there is no horizontal page scroll.

---

## Suggested implementation (adjust if you find a better cut)

- **New content file(s):** `sheets/` with one file per section (`sheets/s00.js` … `sheets/s16.js`) plus `sheets/index.js`. That lets section ranges be written in parallel without conflicts.
  - Each sheet is an ordered list of blocks. A possible schema: `{ kind: 'title' | 'topic' | 'table' | 'steps' | 'formula' | 'recap', … }`, where a topic block can hold `h`, `bullets`, an optional `fig` (+ which part to highlight, + side/below placement), `formula`, `worked` and `margin` items (`remember` / `q` + `a`).
  - Design the schema around what the pages need; don't force every page into the same shape.
  - Prose stays in data files, never in layout code (the same rule `sections.js` follows).
- **Green highlight markup:** if you add an inline token to `Rich.jsx`, make it additive.
  - `sections.js` already contains `==` twice, so check where before choosing a token. Something like `!!text!!` or `{g|text}` is safer.
  - Confirm that legacy rendering is unaffected.
- **New components:** a `SheetPage.jsx` renderer + `sheet.css` (prefix `.dl4s-sh*`), and a small `NotebookTabs.jsx` wrapper that renders the tab row, `SheetPage` (default) and the untouched `NotebookPage` (Legacy).
- **Shell:** `Lecture4Study.jsx` swaps `<NotebookPage>` for `<NotebookTabs>` and gains sheet-tick state and the either-page-done progress rule. `storage.js` gains the new key (additive).

### Known gotchas in this repo (from the original build)
- Bash heredocs on this machine strip backslashes, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body, and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lecture4-study/`), not from a scratchpad folder.

---

## Process

1. **Orient.**
   - Read `NotebookPage.jsx`, the notebook CSS, `sections.js` (all 18 sections' `notes`, `draw`, `formulas`, `worked`, `check`), `diagrams.jsx`, `Rich.jsx` and the shell's tick/progress code.
   - Take the "before" screenshots of legacy pages on `main`.
   - Branch from `main` explicitly: `git checkout -b feat/dl4s-student-notes main`. If nothing answers on http://localhost:5173, start `npm run dev` yourself as a background task.
   - **If the current branch isn't `main`, or `git status` shows uncommitted changes you didn't make**, another Claude instance may be working in this folder (e.g. on Lecture 3). Don't switch branches or touch its files. Instead, create a worktree: `git worktree add ../wigfield-portfolio-dl4s -b feat/dl4s-student-notes main`. Run `npm install` there if needed, start its dev server on another port (e.g. 5175), and point the check scripts at it (`SITE_URL`). Say so in your summary.
2. **Prototype one page yourself:** §13.1 (LSTM cells) is a good test, since it has a big diagram, a process and a Keras number.
   - Build the tabs, the renderer, the pen tokens, sheet-mode diagrams and ticks.
   - Screenshot it at 1440 and 390 in all three themes and critique it honestly: does it look like a neat student's page? Can I copy it in four pens without guessing which colour each thing is? Is it no harder to copy than the legacy page?
   - Iterate until it's good before scaling out.
3. **Write the remaining 17 sheets.** Parallel subagents by section range are fine (each owns its own `sheets/sNN.js`). Give them the prototype, the schema and these rules, and review everything they write.
4. **Audit with fresh, read-only agents, in parallel:**
   - **Coverage and fidelity:** for each section, everything that mattered in the legacy page is on the new page; no new claims beyond the slides; notation matches the slides; numbers trace to the transcript; nothing contradicts a Slide check.
   - **Visual and design:** the pen mapping is consistent, nothing overlaps, diagrams sit next to the right bullets, it works at 390, the arcade theme reads well, the legacy tab is unchanged, and no forbidden callout or pill styling.
   - **Learning design:** does the layout actually help memorising? Is the page copyable in a few minutes? Too much green? Too dense?
5. **Fix every wrong, misleading or missing finding, then verify.**
   - Lint the module, `registry.js` and the tools folder.
   - Run `node tools/dl-lecture4-study/check-rnn.mjs`.
   - Extend and run `page-check.mjs`. It should check:
     - the new tab is selected by default and the Legacy tab shows the old page;
     - both pages' ticks persist across reload;
     - existing `dl4s:ticks` data still shows on Legacy;
     - progress marks a section done from either page;
     - keyboard tab navigation works;
     - no console errors or warnings;
     - no horizontal scroll at 390 in every theme;
     - Lecture 3 still renders.
   - Run `npm run build`, and confirm the Lecture 3 diff is empty.
6. **Commit** on `feat/dl4s-student-notes` with the attribution line your environment specifies.
   - Stage only files you created or deliberately changed. `Documents/temp/` stays untracked.
   - **Don't merge to `main` or push without asking me.**

## Wrap-up
- **Vault:** add a dev log in `03-Dev-Logs/` from the template, and update the Lecture 4 study entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
- **Memory:** update your auto-memory's Management Portal pointer with one line: the new sheets, the tab, the pen tokens and the new tick key.
- **Final summary for me:**
  - what changed;
  - the pen mapping as implemented, including the arcade values;
  - how the layout varies across sections, with two or three examples;
  - anything from the legacy pages you deliberately dropped or merged, and why;
  - decisions you made;
  - anything unverified;
  - before/after screenshots (paths) for §13.1 and two other sections.
