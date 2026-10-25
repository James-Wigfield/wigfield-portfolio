# Build: CITS5017 Exam Practice: the sample paper + two practice papers, on paper, with handwritten answers

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning, and the final exam is close. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section: lecture modules, one study module per lecture, the Gradient Arcade, Code Lab and Project 2. Build a new page in that section: **Exam Practice**.

**How I'll use it.** I sit with my own paper notebook and work through a question part by part. When I'm ready to check a part, I reveal its answer to see what a real, full-mark answer would have looked like, and I mark myself. The whole design should serve that loop: *read the question → write my answer in my notebook → reveal → compare → mark*.

**What goes on it:**
1. **The official sample paper** (`sampleExam2026-s2.pdf`): **every question and every part**, verbatim, each with a real model answer.
2. **Two new practice papers (A and B)**, each a full mock of the real exam (4 questions × 20 marks, 2 hours). Together with the sample, they should cover far more of the unit's lecture content. Every question follows the sample paper's format exactly, because that's the format the real exam uses.

Three things matter above everything else:
1. **Every answer is accurate to the lecture slides.** Every claim, number, equation and term in a model answer comes from the slides, in the slides' notation. A wrong model answer is far worse than a missing question, because I'll memorise it.
2. **The questions are exam-realistic.** They follow the sample paper's format and the exam-information note, and they're the kind of question this lecturer would actually set.
3. **It looks and feels like the old CITS5508 Sample Exam, which I liked a lot.** The paper looked printed on actual paper, each question had a reveal button, the answers looked like handwritten notes, and each question clearly showed which topics it covered.

> **Note on saved preferences.** Your auto-memory has rules from earlier builds. Here's how they apply to this page:
> - **"No handwriting font" does NOT apply here.** That rule was for the study modules' notebook pages, which I copy by hand. On this page I explicitly want the answers to look like handwritten notes, as in CITS5508. Use the handwriting faces the portal already loads: `--font-hand` (Caveat) for answer headings and mark annotations, and `--font-hand2` (Patrick Hand) for the answer body. Keep them legible: a generous size, and contrast of at least 4.5:1 on the paper.
> - **Two things from the old page must NOT be copied:** the lecture-coloured left border on each question card, and the tinted, filled topic-tag pills. The saved rule is: no tone-coloured left-border callout boxes and no filled pills. Show tone with a small labelled dot or an outlined label on a ruled layout.
> - **"No long-scroll pages, use top tabs" applies:** use one tab per paper, and show one question at a time inside a paper (see "The page").
> - **"Code blocks look like VS Code":** on the paper, code uses VS Code's **Light+** palette in a monospace face, the way the study modules print code. Don't use the dark editor chrome, because it would break the printed-paper illusion.
> - **"No walls of text":** model answers are exam answers, sized to the marks. They aren't lecture notes.

---

## Where things are

Read every file in this table before you start. Re-read the sample paper as images, not just as text.

| What | Path |
|---|---|
| **Where the new page goes** | `src/components/portal/modules/deep-learning/` (new folder `exam-practice/`, see Setup) |
| **Exam information** (official) | `Documents/temp/past-exam-info/exam-information.md` |
| **The sample exam** (10 pages; the format reference) | `Documents/temp/past-exam-info/sampleExam2026-s2.pdf` |
| **The aesthetic reference** (the old Sample Exam I liked) | `src/components/modules/CITS5508.jsx`: handwritten blocks `HSec/HF/HBox/HUL/HNote/HFlow/Hi/Pen` + `CHEAT_INK` (~lines 4859–4916), `HandPaperModal` (~5268), `SAMPLE_EXAM` data (~5371), `SolutionModal`, `ExamQuestionCard`, `SampleExam` (~6050–6240). CSS: `src/index.css` `.cheat-*` (~3090–3230) and `.exq-*` / `.exam-light` (~3320–3470). It runs at `/hub/cits5508` → **Sample Exam** tab; switch on "Exam-paper mode" and open a worked solution |
| How the old page was built | vault log `03-Dev-Logs/2026-06-02-cits5508-sample-exam-tab.md` |
| **The source of truth for every answer** (all lecture decks) | `Documents/cits5017/lectures/` (see the slide counts below) |
| Lecture transcripts (verify against the slide images) | `Documents/cits5017/markdown-lecs/lecture-1.md` … `lecture-8.md` (`lecture-6-7.md` covers the combined deck). There's no `lecture-9.md` on `main` yet (see "Lecture 9") |
| Lab sheets (examinable: "including lab exercises") | `Documents/cits5017/labs/cits5017LabSheet2.pdf`, `…3.pdf`, `…4.pdf` |
| The two projects (examinable) | Project 1 spec: `C:\Users\james\Documents\university\cits5017\cits5017-project-1\documents\project1.pdf`. Project 2: `C:\Users\james\Documents\university\cits5017\cits5017-project-two\README.md`, plus the portal's Project 2 explainer `deep-learning/project2/` |
| **Handover: how the earlier briefs, Export PDF and NotebookLM features were built** | `Documents/temp/how-the-study-module-prompts-were-built.md` |
| **The Export PDF + NotebookLM implementation to copy** | `deep-learning/lecture8-study/`: `ExportPdf.jsx`, `print.js`, `texText.js`, `exportPrompt.js`, `Rich.jsx`, `storage.js` (and the matching CSS in `lecture8-study.css`) |
| The template's check tools (copy and adapt) | `tools/dl-lecture8-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`) |
| How Lecture 8 was built (gotchas, PDF/NotebookLM notes) | vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`; brief `Documents/temp/prompt-dumping/build_lecture8_study_module.md` |
| Index of Topics 1–3 code blocks (handy for code-stimulus questions; verify against slides) | `deep-learning/codelab/entries.js` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared Deep Learning kit | `deep-learning/kit.jsx`, `kit.css`, `common.css` |
| The unit's TensorFlow environment (read-only; used to verify parameter counts and shapes) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

**Deck slide counts** (use these to validate every slide receipt): L1 64 · L2 68 · L3 53 · L4 52 · L5 27 · L6–7 32 · L8 51 · L9 69.

### Reading the PDFs
- Text: `pdftotext -layout -f N -l N <pdf> -`. **It garbles the maths in both the sample paper and the decks.** It drops θ, η, ∇, γ, σ, Σ, max/argmax with their subscripts, primes, stars, arrows and bold vectors. For example, sample page 8's value-iteration question reads as "Vk(s)" in pdftotext, but the image shows V_k(s′).
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/p`, then view them with the Read tool. **Read all 10 sample pages as images**, plus every slide you quote an equation, figure or code block from.
- Don't embed renders of the sample paper or the slides. Rebuild every figure (the star diagrams, the gated module, any diagram in a new question or answer) as SVG.

### Lecture 9
The Lecture 9 deck (`cits5017-lect09-Reinforcement-learning.pdf`) is **untracked** in the main folder. Another Claude instance is building the Lecture 9 study module right now, in `../wigfield-portfolio-dl9s` on branch `tmp/dl9s-rl`, and it writes `lecture-9.md`.
- Read the L9 deck from the main folder by absolute path. **Don't commit the PDF**; the Lecture 9 build commits it.
- If `lecture-9.md` exists on `main`, or in that worktree, you may *read* it (never write there). Still verify everything you use against the slide images.

---

## Ground rules

- **Don't modify any other module or its tools.** That covers `lecture1/`, `lecture2/`, `lecture3/`, every `lecture*-study/` folder, `lectures1-2-refresher/`, `arcade/`, `codelab/`, `game/`, `project2/` and `CITS5508.jsx`.
  - The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon.
  - Don't add global CSS to `index.css` or new fonts to `index.html`. The handwriting fonts are already loaded.
- **Copy, don't refactor.** Copy what you need from `lecture8-study/` and `CITS5508.jsx` into the new folder, and rename it to this module's prefix. Don't import across modules.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is merged into `main` (see "Git") and the final summary is written.
  - The only thing you must *not* do on your own is push to GitHub.

---

## Git: build in your own worktree, finish on `main`

I want the final result **on `main`, with no branch or worktree left behind**. Two other instances may be running:
- the **Lectures 1–2 refresher** build, possibly working directly in the main folder (there may be uncommitted changes there that aren't yours);
- the **Lecture 9 study** build in `../wigfield-portfolio-dl9s`.

Don't touch either of them. **Always build in your own worktree:**

1. **Create the worktree:** `git worktree add ../wigfield-portfolio-dlxp -b tmp/dlxp-exam main`.
   - Run `npm install` there, and start its dev server on port **5181** (`npm run dev -- --port 5181`).
   - Point every check script at it (`SITE_URL`).
2. **Commit in your worktree** at sensible milestones: shell + sample paper · practice papers · export · audit fixes · checks. Every commit must leave `npm run build` passing.
3. **At the end, merge into `main`** with `git merge --no-ff tmp/dlxp-exam -m "Merge: Deep Learning Exam Practice (sample paper + practice papers A/B)"`. Run it in the working tree that has `main` checked out (normally the main folder `C:\Users\james\Documents\personal-projects\wigfield-portfolio`).
   - **Only merge if that tree is clean**, apart from untracked `Documents/temp/` files and the untracked Lecture 9 PDF.
   - **If it has someone else's uncommitted changes**, another instance is mid-build. **Wait and retry**: re-check about every 5 minutes for up to about 60 minutes (use a Monitor or an until-loop; don't spin). Merge as soon as it's clean.
   - If it never comes clean, don't touch it. Put the exact merge command in the **first line** of your summary.
   - **Conflicts:** in `registry.js`, keep every entry, with the lecture study modules in lecture order and this page after the last of them. For any other conflict, run `git merge --abort` and report it in the first line of your summary.
4. **After merging:** run `npm run build` and your page check against a dev server serving `main`. If anything fails, fix it with a follow-up commit on `main`. Never force, reset or rewrite history.
5. **Clean up:** stop your dev server, then run `git worktree remove ../wigfield-portfolio-dlxp` and `git branch -d tmp/dlxp-exam`. Confirm with `git worktree list` and `git branch` that nothing from this build is left.
6. **Don't push.** End the summary with "`main` is N commits ahead of `origin/main`".

Don't commit anything from `Documents/temp/`. The sample PDF and the exam note stay where they are, untracked. Only stage files you created or deliberately changed.

---

## Setup

1. **New folder:** `src/components/portal/modules/deep-learning/exam-practice/`.
   - CSS prefix: `.dlxp-*`.
   - localStorage prefix: `dlxp:`. Wrap every storage read and write in try/catch.
   - Print class: `html.dlxp-printing`.
2. **Register it directly after the last lecture study module** (after `dl-lecture-9-study` if that exists on `main` by then, otherwise after `dl-lecture-8-study`), so it sits before `dl-game`:
   ```js
   { id: 'dl-exam-practice', label: 'Exam Practice', icon: 'notebook', group: 'Deep Learning', component: DeepLearningExamPractice },
   ```
   It will then be at `/portal/dl-exam-practice`.
3. **Where things live:**
   - **Content is data, not JSX.** Put one file per paper in `papers/` (`sample.js`, `paperA.js`, `paperB.js`), with a schema in `papers/index.js`.
   - Each part needs:
     - a stable id, its label (`(a)`, `i.`) and its marks;
     - the prompt (rich text with KaTeX, and code or a figure where needed);
     - **topics**: lecture code + slide range + a short topic name;
     - the number of ruled answer lines;
     - the model answer as handwritten blocks: lines, formulas, lists, small tables, diagrams, plus mark annotations;
     - a `difficulty` (1–5) and a `likelihood` (high/medium/low) from the validators;
     - `source: 'sample' | 'new'`.
   - Use a small rich-text renderer (copy `Rich.jsx` from Lecture 8) so prose stays in `.js` files.
   - Figures go in `figures.jsx`, referenced by key.
   - Plain-text twins for print go in `texText.js` (copied and extended).
   - The NotebookLM prompt goes in `exportPrompt.js`.
4. **Copy and adapt**:
   - from Lecture 8: `ExportPdf.jsx`, `print.js`, `texText.js`, `exportPrompt.js`, `Rich.jsx`, `storage.js`;
   - from CITS5508: the paper and handwriting styling, rewritten under the `.dlxp-` prefix.

   Grep the copies for leftovers (`dl8s`, Topic 8 wording, Lecture 8 prompts, `cheat-`/`exq-` class names).
5. **Tools:** create `tools/dl-exam-practice/`. Copy `page-check.mjs`, `pdf.mjs` and `shot.mjs` from `tools/dl-lecture8-study/`, and set their default port to 5181. You'll add `check-papers.mjs` and `verify_counts.py` (see Verify).

---

## Step 1: work out the exam format yourself, and write it down

**Study the sample paper and the exam-information note, and work out the full format yourself.** Don't rely on memory or assumptions. The mid-semester test the note mentions isn't in the repo, so the sample paper is your format reference.

Write what you find to `tools/dl-exam-practice/format-spec.md`. It's the rulebook you write the practice papers against, and the one the validators check them against. It must answer at least:
- **Paper structure:** how many questions, the marks per question and in total, and the time. From those, work out the minutes per mark.
- **Question structure:** how many parts per question, the range of marks per part, and how parts sum to the question total. When are subparts (i., ii., iii.) used, and how are their marks shown?
- **Topic mix:** does a question stay within one lecture or mix several? In what order do topics appear across a paper?
- **Stimulus types:** given code, diagrams, equations, scenarios with figures. What is asked about each one (draw, compute, explain each term, write the equations, state ranges, choose shapes or losses)?
- **Command words** ("explain", "briefly explain", "list two", "draw", "compute", "what are…") and how they relate to marks and answer depth. The exam note says the marks and these words signal depth.
- **What is never asked.** The note says there will be no large block of Python coding; instead you'll be given a block of code and asked to draw a diagram or give an explanation.
- **Typesetting and layout conventions** you'll reproduce on screen: bold vectors, time-step subscripts, italic key terms, the code font, the running header and footer, marks aligned right, the ruled answer space, and how much space each part gets relative to its marks.

Quote the exam note wherever it settles a point.

---

## Content

### The sample paper (every question, verbatim, each with a real answer)
- **Reproduce every question and part exactly**, including the instructions/cover page, the code block, the equations and both figures (rebuilt as SVG: the two star sketches with corner 4 in red, and the gated FC module with its legend).
- **Keep the wording verbatim, typos included.** For example: "Explain what are involved in a Convolutional layer", "Given below are the update of the variable θ", "Explain yur answer". Don't fix them and don't add "[sic]". List them in your summary.
- **Write a full-mark model answer for every part**, built from the slides (see "What a model answer looks like").

**Accuracy traps I found while scoping the sample. Verify each one; don't take my word for it:**
- **Q1(c), parameter counts.** Lecture 1 slide 45's `model.summary()` shows a `Normalization` layer's parameters as **non-trainable**: 2n + 1, made up of the means, the variances and a count. With `shape=[10]`, that's 21 non-trainable and 0 trainable.
  - My arithmetic: hidden `Dense(20)` = 10 × 20 + 20 = **220**; `Concatenate` = 0 params, with output width 10 + 20 = 30; output `Dense(3)` = 30 × 3 + 3 = **93**.
  - That gives **313 trainable** in total (334 including the 21 non-trainable).
  - **Confirm it** by building the model in the unit's environment (see `verify_counts.py`).
  - This is the "wide & deep" topology from L1 slides 43–45, with one hidden layer instead of two. Draw it the way slide 43 draws it.
  - A 3-unit softmax output means 3-class classification of 10-feature structured data. Say that, using the slides' wording.
- **Q1(e), the gated module.**
  - g(t) uses the logistic function, so its range is (0, 1). h(t) uses ReLU, so its range is [0, ∞). z(t) = g(t) ⊗ h(t), element-wise.
  - The FC blocks take **only x(t)**. Don't add an h(t−1) term.
  - Write the equations in the notation Lecture 4 uses for its gate equations (check the slides for transposes and subscripts).
- **Q1(d):** use Lecture 2's notation and wording for gradient descent (θ, η, ∇θJ(θ)).
- **Q1(a), Q1(b), Q2(c):** build the answers from the slides' own statements (L3's convolutional-layer and filter slides, L3's stated advantages of CNNs, and L8's transformer components), not from general knowledge.
- **Q2(a), the RNN star question.**
  - Lab Sheet 4 uses the same idea: sequences of 2D vertices with shape `(200, 4, 2)`.
  - L4 slide 24 says recurrent layers expect 3D inputs `[batch size, time steps, dimensionality]`.
  - For (iii), build the answer from L4's "forecasting several time steps ahead" slides (about 34–41). Present the approach or approaches *those slides* give, with the X/y shapes and the loss, not a generic answer.
- **Q2(b), VAEs:** use L6–7's notation for the encoder's outputs and the two-part loss (reconstruction + latent loss). Check exactly how the slides define the codings and the latent loss.
- **Q2(d) and Q2(e):** take the Markov chain, MDP and value-iteration wording and notation from L9 (around slides 38–44). The question asks about V_k(s′) (read it from the image).

### Practice papers A and B (new questions)
Write **two full practice papers**. Each has **4 questions × 20 marks**, a cover page in the sample's style, and every question built to `format-spec.md`. That's 8 new questions in total.

- **Coverage:**
  - Plan it first in `tools/dl-exam-practice/coverage.md`: a matrix of lectures against question parts across all three papers.
  - **Every lecture (1, 2, 3, 4, 5, 6–7, 8, 9) appears in each practice paper.**
  - Across the three papers, the unit's learning outcomes (in the exam note) are all exercised.
  - GANs are absent from the sample, so they must appear.
  - Weight topics by how much the decks emphasise them (their summary slides are a good signal).
- **Scope:**
  - Every question must be answerable from the lecture slides. The exam note says "Sections in the textbook that are not covered in the lecture notes won't be examined."
  - Skip anything a slide marks as not examined or not covered. For example, Lecture 8 slide 47 says "Materials from this slide onward are not covered in the exam" (the DeiT/Perceiver/DINO papers and the Hugging Face slides), and L2 slide 66 says alpha dropout is "not covered in CITS5017". Find any others.
  - Labs and projects are examinable. A few parts may use a lab- or project-flavoured scenario, as the sample's star question echoes Lab Sheet 4 (for example, transfer learning from Project 1, or GRU forecasting and a VAE for sequences from Project 2). Even then, the *answer* must still come from lecture content.
- **Make them realistic, not clones.**
  - Reuse the sample's *types* of part with fresh content. For example: a different Keras code block to diagram and count (a CNN, an RNN, an autoencoder, a GAN), a different update rule or equation to explain term by term, a different gated or attention diagram to turn into equations, or a different sequence-design scenario.
  - Don't repeat any sample part's actual ask.
  - Include calculator-friendly calculations where the slides support them: parameter counts, output shapes, discounted returns, a value or Q-value iteration step, attention shapes.
- **Write the questions first, validate them, then write the answers** (see Process). Don't write answers for questions the validators may replace.

### What a model answer looks like
- **A real, full-mark exam answer, sized to the marks.** It's what a strong student would write in the space on the paper; it isn't a lecture summary.
  - Use short, proper sentences, formulas, a small labelled diagram where the question says "draw", and working for calculations.
  - Match the depth to the command word and the marks: "briefly explain (1 mark)" means one or two sentences.
- **Show where the marks are.** Annotate each mark-earning point like a marker would, with a small red-pen tick and mark in the margin (e.g. "✓ 1"), so I can mark myself against it. The ticks must add up to the part's marks.
- **Optional, one line at most:** a quiet "Common slip:" note in grey, only where there's a real trap (e.g. counting the Normalization layer's statistics as trainable).
- **Slide receipts:** a small grey "L1 · slides 43–45" under each answer, so I can go back to the source.
- **Diagrams** are hand-drawn-looking SVG in pen colours (a subtle wobble is fine), accurate to the slides' figures. Each one gets a one-line text description that prints, so the PDF's text layer and NotebookLM know what it shows.
- Every formula is KaTeX in the ink colour, with a plain-text twin for print.

---

## The page

### Look and feel: the CITS5508 Sample Exam, rebuilt properly
Screenshot the old page first (`/hub/cits5508` → Sample Exam, with Exam-paper mode on and a worked solution open), so you know what I liked. Then build:

- **The exam paper looks printed on actual paper.**
  - Use an off-white sheet with a soft shadow and A4-like proportions.
  - Match the sample PDF's own typography and furniture: a serif face, the small-caps running head ("SAMPLE EXAM PAPER 2026 · CITS5017 Deep Learning") above a rule, "Question 1. (20 marks)" headings, hanging part labels, marks right-aligned, and "Page N of M" at the foot.
  - Add grey ruled answer lines under each part, with the space proportional to the marks as your format spec describes.
  - Don't add a web font. KaTeX's bundled `KaTeX_Main` face gives a LaTeX look if its glyph coverage holds up; otherwise use a serif stack.
  - The paper stays paper in all three portal themes (Jade, Coral, Arcade/dark). Only the page around it follows the theme.
- **Each part has a reveal button** (quiet and outlined, in the margin or under the ruled lines).
  - Revealing writes the handwritten answer **onto the paper, in that part's answer space**, as if a tutor had filled it in. Use a short ink-in animation; with reduced motion, it just appears.
  - Each question also has "Reveal all parts" and "Hide answers".
- **The answers look like handwritten notes.**
  - Patrick Hand body in blue-black ink; Caveat for headings and the marker's ticks; red pen for marks only; green for sparing highlights.
  - Take the pen palette and the ink feel from CITS5508 and the study modules' `--pen-*` tokens, and tune contrast to at least 4.5:1 on the paper.
- **Each question clearly shows its topics.**
  - Under each question heading, add a quiet line listing every topic it covers with its lecture (e.g. "L3 Convolutional layers · L1 Functional API · L2 Gradient descent · L4 Gates").
  - In the margin of each part, add a small label: lecture + slide range.
  - Use outlined labels or labelled dots, never filled pills.

### Workflow features
- **Top tabs, one per paper:** Sample paper · Practice paper A · Practice paper B.
  - Inside a paper, show **one question at a time** with a quiet question stepper (Q1 Q2 Q3 Q4, each with its status: not started / revealed / marked) and previous/next controls that feel like turning a page.
  - Each paper opens on its short cover page (the instructions, as on the real paper).
- **Self-marking:** after a part is revealed, show "Your mark: 0 1 2 … / max" as outlined numerals. The selected numeral gets an ink ring, not a fill.
  - Show the totals per question (/20) and per paper (/40 for the sample, /80 for A and B).
  - Persist reveals and marks under `dlxp:`, with a per-paper "Reset (hide answers, clear marks)".
- **A lecture filter**, as the old page had: "show only parts on L9" dims or hides the others and shows a count per lecture.
- **Optional, only if it stays quiet:** a "Sit it timed" mode with a 2-hour countdown for a practice paper.
- **The NotebookLM picks:** parts chosen for the NotebookLM video get a small grey "in the NotebookLM video" label.
- No emoji (a typographic ✓ is fine). Everything is keyboard-reachable. Respect `prefers-reduced-motion`. It must work at laptop width, in fullscreen and at 390 px wide with no horizontal page scroll; margin labels move inline on narrow screens.

---

## Export PDF and the NotebookLM prompt (top of the page)

Read the handover doc and Lecture 8's `ExportPdf.jsx`, `print.js`, `texText.js` and `exportPrompt.js`, and stay consistent with them:
- the same component shape and copy behaviour;
- the "NotebookLM video prompt ▾" disclosure **directly under** the **Export PDF** button;
- the numbered steps;
- a Copy button with a character count.

### Export PDF
- It uses print mode (`html.dlxp-printing`) plus `window.print()`, so the text stays real and selectable for NotebookLM. A4 portrait, light paper.
- **Contents, paper by paper** (the sample, then A, then B):
  1. the cover page, then every question in exam layout (with topics and marks, but no big ruled answer space);
  2. then a **"Model answers"** section for that paper, with every answer labelled with the same question and part label, e.g. "Practice Paper A · Question 3 (c)".

  Answers are included because the NotebookLM video needs them. Putting them after each paper's questions means a printout still works as a mock exam.
- Every formula prints its plain-text twin (extend `texText.js` for every symbol you use). Every figure prints its one-line description.
- **Left out:** tabs, steppers, reveal buttons, self-marks, the filter, the export UI and portal chrome.
- **Page breaks:** each paper starts on a new page, and a part never splits from its label.

### The NotebookLM prompt
This prompt is for a NotebookLM **Video Overview** that feels like **my lecturer working through a few sample questions with me**, with the exported PDF as the only source.
- **It must not cover every question.** It must **explicitly name a select few parts**: about 4–6, in the order to cover them, using the **exact labels printed in the PDF** (e.g. "Practice Paper B, Question 2 (d)").
- **Choose mainly the hardest.** Rank by the validators' difficulty ratings, and at least 4 of the picks should come from the top band. Spread them over at least three lectures, and include at least one "given code or diagram → draw or explain" part and one calculation.
- **The style it asks for:** a lecturer at the whiteboard in a revision session. For each named part:
  1. read it out, with its marks;
  2. say what the marks and command word signal about the expected depth;
  3. think aloud through the approach;
  4. give the **model answer exactly as in the PDF** (no alternative answers, no outside facts, the PDF's notation and numbers);
  5. point out where the marks are and one common slip.

  It should explicitly say to skip all other questions, and to end with a short recap of exam technique (marks guide depth, minutes per mark).
- Re-check NotebookLM's current Video Overview formats and any prompt-length limit with web search; Lecture 8's `exportPrompt.js` records what was true on 2026-10-22. Pick the right format and say why in the file header.
  - Keep the prompt under about 1,000 characters unless you confirm a larger limit.
  - If web search isn't available, reuse Lecture 8's findings and say so.
- Explain your picks in `exportPrompt.js`'s header comment, with each part's difficulty rating and the reason it's hard.
- **Testing:** stub `window.print` in every automated check, before the page loads, so a print dialog can't hang this unattended run. Then generate the PDF headlessly (adapt `pdf.mjs`) and check its text with `pdftotext`:
  - every paper heading, question and part label, in order;
  - every model answer is present;
  - **every part the NotebookLM prompt names appears verbatim in the PDF text**;
  - the formulas read correctly;
  - no UI text ("Reveal", "Your mark", tab names).

  Report the page count and file size.

---

## Subagents: validators and accuracy checkers are required; spend the rest sensibly

Use subagents wherever they make the papers more realistic or the answers more accurate. Aim for about **10 agents in total**, and treat **13** as a hard ceiling.
- Use **fresh general-purpose agents, not forks**, for every validator and checker, so they aren't anchored on your reasoning.
- Give each one a self-contained brief: file paths, the format spec, exactly what to return, and the output format.
- Launch independent agents in one message so they run in parallel.
- Don't re-check unchanged content.

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **3 syllabus inventories**: L1–L3 (+ Lab Sheets 2–3, Project 1) · L4–L6/7 (+ Lab Sheet 4, Project 2) · L8–L9 | They read the decks as images (and transcripts where they exist), then return per lecture: the examinable concepts with slide ranges; every equation in LaTeX as typeset; every code block that would make a good "draw/explain/count" stimulus (with its slide); every worked number; what the summary slides emphasise; anything marked not examined; and what the sample already covers. They write to your scratchpad, not the repo. Start them first, so they run while you study the format |
| Validate questions | **2 question validators** (Paper A, Paper B) | Give them the **questions without the answers**, plus `format-spec.md`, the exam note and the sample PDF. Per part, they judge: format fidelity (marks, structure, command words, stimulus types, marks sum to 20, no large code writing); scope (answerable from the slides; not textbook-only; not marked as not examined); realism and **exam likelihood (high/medium/low, with a reason)**; clarity (one clear expected answer, calculator-solvable); duplication against the sample and each other; and a **difficulty rating of 1–5** with a reason. Verdict per part: keep / revise (with the fix) / replace |
| Check answers | **3 accuracy checkers** (L1–L3 · L4–L6/7 · L8–L9), covering the sample paper and both practice papers, with each part routed by its lectures | **Blind first:** for each part, write their own answer from the slides *before* reading the model answer, then compare. They check every claim, number, equation and term against the slides (cite slide numbers), in the slides' notation; that the ticks add up to the marks and the answer would earn them; that it isn't padded; that receipts are right; and that the sample text is verbatim against the page images. They **verify every parameter count and shape** by building the model in the unit's environment (`verify_counts.py`). Verdict per part: correct / wrong / misleading / incomplete for the marks / padded, with fixes |
| Re-check | **1 re-checker** | Only the parts that changed after validation or checking |
| Design and workflow | **1 auditor** | Screenshots of the new page (3 themes × 1440/390) beside the old CITS5508 Sample Exam, plus the PDF and the prompt. Checks: the four look-and-feel features; the saved rules (no left-border callouts or filled pills, legible handwriting, contrast); that the notebook → reveal → mark loop is smooth; that the prompt follows every rule in "The NotebookLM prompt" |

Fix every **wrong**, **misleading**, **incomplete** and **replace** finding, or justify leaving it in the summary.

---

## Process

1. **Git and setup** (see "Git"). Start the three inventory agents straight away.
2. **Orient.**
   - Check the vault's project note `01-Active-Projects/wigfield-portfolio-management-portal.md`, as the repo `CLAUDE.md` asks.
   - Read the handover doc, the CITS5508 sample-exam dev log, the Lecture 8 dev log, and every file listed in "Where things are".
   - Screenshot the old CITS5508 Sample Exam.
3. **Format:** render all 10 sample pages and write `format-spec.md`.
4. **Prototype with the sample paper.**
   - Transcribe both questions verbatim, write their model answers, and build the page shell around them: the paper, the reveal, the handwriting, the topics, self-marking, tabs and the stepper.
   - Screenshot at 1440 and 390 in all three themes. Critique the result against the four features I liked and the saved rules, and iterate until it clearly feels like a real exam paper with a tutor's handwriting on it.
   - Commit.
5. **Practice papers.**
   - Write `coverage.md`, then all 8 questions (questions only).
   - Run the 2 validators, then revise or replace parts.
   - Write every model answer. Run `verify_counts.py` on every count and shape.
   - Run the 3 accuracy checkers (they also cover the sample), then fix.
6. **Export PDF and the NotebookLM prompt**, using the validators' difficulty ratings.
7. **Re-check** what changed (1 agent), then the **design and workflow audit** (1 agent). Fix what they find.
8. **Verify** (below), then **wrap up and merge** (see "Git").

## Verify

- **`tools/dl-exam-practice/check-papers.mjs`** (data integrity):
  - the sample has 2 questions; A and B have 4 each;
  - every question's parts sum to 20, and every part's ticks sum to its marks;
  - part labels are consecutive; ids are unique and stable;
  - every part has topics whose slide ranges are within that deck's slide count;
  - every part has a model answer, a difficulty and a likelihood;
  - every lecture appears in each practice paper (`coverage.md` matches the data);
  - the sample's text matches your stored verbatim transcription;
  - every part the NotebookLM prompt names exists.
- **`tools/dl-exam-practice/verify_counts.py`**: builds every Keras model that appears in a question or answer, in the unit's **read-only** `tf-2.20-gpu` environment, and asserts the trainable and non-trainable parameter counts and output shapes that the answers state. It only builds the models; it never trains them.
  - Read `ENVIRONMENT_SETUP.md` first, and **never install into that env**.
  - Call its Python by absolute path through `wsl.exe` (`MSYS_NO_PATHCONV=1` from Git Bash).
  - If WSL fails, use a Windows venv with `tensorflow==2.21.0` (as in `tools/dl-lecture5-study/requirements.txt`), and say so.
- **`page-check.mjs`** (adapted). It checks:
  - the page renders at `/portal/dl-exam-practice`, with the tabs, the stepper and the cover pages;
  - every part has a working reveal, and Reveal all / Hide answers work;
  - the handwriting fonts are applied to the answers, and the ink contrast is at least 4.5:1;
  - no question card has a coloured left border, and no topic label is a filled pill;
  - self-marks and reveals persist across a reload, and Reset works;
  - the lecture filter works;
  - the page renders with localStorage throwing and with reduced motion;
  - keyboard operation of the reveal, mark and stepper controls;
  - the stubbed export plus `afterprint`, and the PDF text checks above;
  - the NotebookLM dropdown opens directly under Export PDF, and its Copy button works;
  - 3 themes × 1440/390 with no horizontal scroll;
  - **every other Deep Learning module still renders**.
- Lint the new folder, `registry.js` and the tools folder clean, and run `npm run build`.

## Wrap-up
- **Vault:**
  - create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`;
  - add the page to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]` (e.g. to the CITS5508 sample-exam log and the Lecture 8 log).
- **Memory:** add one line to your auto-memory's Management Portal pointer.
- **Final summary:**
  - the format you derived (short) and the coverage matrix;
  - every question in all three papers, with its marks and topics;
  - the validators' verdicts (kept / revised / replaced) and the difficulty and likelihood spread;
  - the accuracy checkers' results (blind agreement x/y, what was fixed);
  - the `verify_counts.py` results;
  - the sample's verbatim quirks and any slide discrepancies;
  - the PDF's page count and size;
  - **the NotebookLM prompt pasted in full**, with the chosen parts and why;
  - decisions you made, and anything unverified;
  - the subagents used;
  - **the final git state**: merged, "`main` is N commits ahead of `origin/main`", and no worktree or branch left.

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint:
  - react-hooks forbids `setState` directly in an effect body (do it in callbacks, timers or rAF);
  - react-refresh allows only component exports from `.jsx` files (put helpers and data in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-exam-practice/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, so every formula needs a plain-text twin in print (`texText.js`).
- The old CITS5508 page's plain `<strong>` text was nearly invisible on white paper, because of a global `strong` colour rule. Scope dark-ink overrides to your paper (see the comment above `.cheat-paper strong` in `index.css`).
- **WSL from Windows:**
  - bare `python`/`conda` aren't found in non-interactive WSL shells, so use absolute binary paths;
  - put non-trivial code in `.py` files;
  - prefix the command with `MSYS_NO_PATHCONV=1` from Git Bash;
  - don't try to "fix" the expected CUDA warnings.
- **Ports:** 8787 belongs to another project. 5173 is the main folder's dev server, 5179–5180 may be used by the other builds, and yours is 5181.
