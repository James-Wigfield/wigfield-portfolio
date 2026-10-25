# Adding a topic to Tricky Topics

Tricky Topics (`/portal/dl-tricky-topics`) is one page with one tab per concept that cuts across the CITS5017 lectures. Each topic is a folder of data and labs; the page shell, the lab kit and the checks are shared and **never need editing** to add a topic.

This file is everything a new instance needs. Read it all once, then work through **Steps**.

---

## Steps

1. **Scaffold.** From the repo root:
   ```
   node tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"
   ```
   - `<id>` is kebab-case (`batch-norm`, `receptive-field`). It becomes the folder name and the deep link `/portal/dl-tricky-topics/<id>`.
   - The script copies `topics/_template/` to `topics/<id>/`, fills in the id and the title, and appends one line to `topics/index.js`. The tab appears straight away, with placeholder text marked `REPLACE ME`.
   - Made a mistake? `node tools/dl-tricky-topics/new-topic.mjs --remove <id>` deletes the folder and its index line. It refuses any topic already committed to git (so it can't delete a real topic); rebuild `dist/` afterwards if you built while the topic existed.
   - The scaffold leaves 30-odd `REPLACE ME`s. While you are drafting, `ALLOW_PLACEHOLDERS=1 node tools/dl-tricky-topics/check-maths.mjs` passes over all of them (the index blurb included); without the flag the check fails until every one is gone.
2. **Edit the index line** in `topics/index.js`: set `lectures` (the decks the topic draws on: `'L1'` … `'L9'`, with `'L6–7'` written with an en dash) and a one-line `blurb`. Nothing else in that file changes.
3. **Source it from the slides.** Read every deck slide you will cite as an image (see **Reading the slides**). Make a list of every slide that uses the concept, with the slide number, a verbatim quote and any number it prints. That list becomes your `showsUp` rows, your receipts and your Slide checks.
4. **Write `topic.js`** (the schema is below): the opener, the steps, the drill's title. Keep to the budgets.
5. **Build the labs** in `labs/`, one per step, plus `hero` and `drill`. Register each in `labs/index.js`. Copy the shape of an existing lab (see **Labs**).
6. **Write `drill.js`**: `make(seed, mode)` and `FIXED`. If its questions involve models, sizes or softmax, add `model` / `verify` so TensorFlow checks them.
7. **Write the notebook page(s)** in `sheets/` (≤ 30 ruled lines each) and list them in `sheets/index.js`. Add line art in a `figs.jsx` only where a sketch beats words, and list its components in `index.js`'s `figs`.
8. **Write `exportPrompt.js`**: the NotebookLM prompt(s), each under 1,000 characters.
9. **Verify the numbers** (see **Verifying numbers**), then **run the checks** (see **Checks**) until everything passes.
10. Look at your topic at 1440 px and 390 px in all three themes (`tools/dl-tricky-topics/shot.mjs`), fix what is hard to read, commit.

You should never need to edit `TrickyTopics.jsx`, `TopicShell.jsx`, the lab kit, another topic's folder, or any check script. If you think you must, stop and say why in your summary instead.

---

## What a topic folder holds

```
topics/<id>/
  index.js          what the shell loads: { topic, labs, sheets, figs, prompts }
  topic.js          the content, as data (plain JS — no JSX)
  drill.js          the exam drill's generator (plain JS)
  exportPrompt.js   the NotebookLM prompt(s) (plain JS)
  sheets/index.js   the notebook pages, in order (plain JS)
  sheets/p1.js …    one file per notebook page (plain JS)
  labs/index.js     { key: Component } for the hero, every step's lab, the drill
  labs/*.jsx        the lab components (one lab per file is easiest)
  labs/<id>.css     (optional) the labs' own styles, imported from each lab
                    (`import './<id>.css'`); prefix your classes, e.g. dltt-bn-*
  figs.jsx          (optional) line-art components for the notebook pages
  *.js              (optional) maths or text helpers only this topic needs
```

- **Plain-JS files stay plain JS.** The checks import `topic.js`, `drill.js`, `sheets/*.js` and `exportPrompt.js` in node, so they must not contain JSX, must not import `.jsx` files, and their relative imports must carry the `.js` extension (`'../../maths/softmax.js'`).
- **Imports.** A topic imports only from its own folder and from the shared engine. From `topics/<id>/*.js` the engine is `../../` (`'../../maths/softmax.js'`) and the lecture kit `../../../kit`; from `topics/<id>/labs/*.jsx` add one level (`'../../../stage'`, `'../../../maths/paramRules.js'`, `'../../../../kit'` for `Code`/`Tex`). It **never** imports from another topic's folder: link to another topic with `[label](@otherId)` or `[label](@otherId#stepId)` in any text instead. The check fails if it does.
- **Maths shared between topics** belongs in `../../maths/` (`paramRules.js`, `shapeRules.js`, `strideRules.js`, `softmax.js`, `models.js`). Adding a function there is fine; changing an existing one is not part of adding a topic.
- **Windows is case-insensitive:** `labs/foo.js` and `labs/Foo.jsx` collide. Give every file a distinct name.

---

## The topic schema (`topic.js`)

```js
export default {
  id: 'batch-norm',                 // = the folder and the index line
  title: 'Batch normalization',     // = the index line's title
  lectures: ['L2'],                 // = the index line's lectures
  oneLine: 'What it is, in one plain sentence (≤ 40 words).',
  printLead: 'The PDF’s opening paragraph: what the topic covers and how to read the three labels.',
  hero: { lab: 'hero', caption: 'One sentence on what the hero animation shows. Click to replay.' },
  showsUp: [                        // every place the unit uses it
    { at: 'L2 · slide 23', what: 'what that slide shows (Rich markup)' },
  ],
  examAsks: [                       // the stimulus types, each linked to an Exam Practice part
    { form: 'Equation', what: 'what is asked', part: 'Practice A Q1(b)' },
  ],                                // part = 'Sample Qn(x)' | 'Practice A Qn(x)' | 'Practice B Qn(x)'
  steps: [                          // budget: 8 steps for a new topic
    {
      id: 'idea',                   // unique; not open / drill / write / p1 …
      title: 'The full step title',
      short: 'Rail label',
      prov: '{s|L2 · slide 23}',    // provenance labels for the step header
      gist: 'One bold sentence.',
      read: [ /* blocks, below */ ],
      play: ['idea'],               // exactly one lab key from labs/index.js
      cards: [],                    // optional "Explain this code" cards
    },
  ],
  drill: { lab: 'drill', title: 'Exam drill: …', short: 'Exam drill', prov: '{own}', blurb: 'One line.' },  // short: optional rail label
  endNote: '…',                     // optional: replaces the default sources line
};
```

**Finding Exam Practice parts.** The parts live in `deep-learning/exam-practice/papers/sample.js`, `paperA.js`, `paperB.js` (a question id like `a-q1-e` is "Practice A Q1(e)"; subparts keep the part's label). Search them with `grep -n -i <concept> src/components/portal/modules/deep-learning/exam-practice/papers/*.js`, and `tools/dl-exam-practice/coverage.md` lists every part's stimulus. The check needs at least one row: if no part tests the concept directly, link the closest part whose answer uses it and say so in `what`.

**Read blocks** (rendered by `Rich.jsx`):

| Block | Use |
|---|---|
| `'a string'` | a short paragraph |
| `{ list: ['…', '…'] }` | bullets (the usual form) |
| `{ table: { head: [...], rows: [[...]] } }` | one ruled table (becomes stacked cards under 560 px) |
| `{ eq: { name, tex, read, prov } }` | one display formula with a plain-words reading |
| `{ slideNote: '…' }` | a **Slide check**: a real discrepancy on a slide (folds to its first sentence on screen, open in print) |
| `{ note: '…', label: 'Watch out' }` | an editorial aside (dot + label, never a coloured box) |
| `{ code: { src, label } }` | a VS Code block |
| `{ fig: 'key' }` | line art from the topic's `figs` |

**Inline markup** in any string: `**bold**`, `*italic*`, `` `code` ``, `$tex$`, `[label](#stepId)`, `[label](@topicId)`, `[label](/portal/…)`, and the provenance labels `{s|L3 · slide 22}`, `{own}`, `{beyond}`. On notebook pages, `{g|…}` is the green pen.

**Code cards** (optional, per step): `{ id, title, prov, code, label, prompt, answer: ['…'], fig? }`. Code from a slide is verbatim (check it against the image); code you wrote says "generated".

---

## Budgets (the checks enforce them)

| What | Budget |
|---|---|
| Steps per topic | ≤ 8 for a new topic (the four built-in topics: 12, 7, 6, 6) |
| A step's Read | one bold gist sentence + ≤ 120 words of bullets or short sentences, with **at most one** table **or** formula |
| Labs | exactly one per step; ≤ 3 controls (sliders, switches, selects, toggles); a title, a one-line "Try this", ≤ 2 caption sentences, an optional quiet challenge |
| Notebook page | ≤ 30 ruled lines at the 760 px reference width (the page measures itself: "fits one page · n of 30 rules") |
| NotebookLM prompt | < 1,000 characters; ends with three self-test questions; says what is beyond the slides |
| Opener | `oneLine` ≤ 40 words |

---

## Provenance (every number and claim says where it comes from)

Use exactly these three labels, the same way everywhere (Read, labs' `prov`, drills, notebook pages):

- **`{s|L3 · slide 22}`** — a slide states or prints it. Ranges and lists: `{s|L4 · slides 25, 27, 29}`, `{s|L3 · slides 20–21}`. Other sources: `{s|Sample Q1(c)}`, `{s|Lab Sheet 4}`, `{s|Practice A Q1(c)}`.
- **`{own}`** — *this page's own · checked in TF*: computed by this page **with the shared maths modules** (`maths/paramRules.js`, `shapeRules.js`, `strideRules.js`, `softmax.js`), which `verify_counts.py` checks against Keras — every named model and drill model one by one, sizes over a sweep, softmax over a set of vectors, sigmoid over a grid of scores. Use it only for numbers those modules produce (or a `model` / `verify` item you add). **Arithmetic that doesn't go through them** (a product of a printed shape, a percentage, a rate × a count) is not "checked in TF": write it as working next to the receipt of the slide whose numbers or rule it uses (e.g. "$2 \times 70 \times 120 \times 3 = 50{,}400$, from the shape {s|L3 · slide 17}"), or add a `verify` item / a named model so TensorFlow does check it. If unsure, say so in your summary.
- **`{beyond}`** — *beyond the slides*: true and useful but not in the lecture notes. The exam note says textbook material outside the lecture notes isn't examined, so the student must see what is support and what is syllabus.

Rules:
- Only call a number the slide's if the slide prints it. A count you derived is `{own}`, even if the slide prints the model.
- **Never silently "correct" a slide.** If a slide contradicts itself or Keras, keep its wording and add a `{ slideNote }` explaining the discrepancy.
- Every number of 100 or more in the Read text must come out of the maths modules or sit in a sentence that carries a label (the check enforces this).
- Every receipt must point inside its deck. Slide counts: L1 64 · L2 68 · L3 53 · L4 52 · L5 27 · L6–7 32 · L8 51 · L9 69 (`lectures.js`).
- Use the slides' notation and Keras's names exactly (`filters`, `kernel_size`, `strides`, `padding="same"`, `return_sequences=True`, `d_keys`).

---

## Labs

Copy the shape of an existing lab. Good models: `topics/param-count/labs/LoomLab.jsx` (direct manipulation, counter, maths drawer, narrow layout), `StackLab.jsx` (story beats), `GatesLab.jsx` (a switch), `topics/stride/labs/Fig148Lab.jsx` (a figure rebuilt), and `topics/_template/labs/IdeaLab.jsx` (the minimum).

The kit (`../../stage.jsx`, `../../svgParts.jsx`, `../../story.js`, `../../stage.css`):
- `Stage` — `title`, `prov`, `tryThis`, `story`, `caption`, `challenge`, `maths`; the picture is its child.
- `StoryBar` + `useStory(n)` — ▶ and 3–6 named beats; labs open on their last beat. If the Try this asks the student to predict first, open empty with `useStory(n, { start: -1 })` (beat −1 = nothing drawn yet) and don't print the answer anywhere on the stage until its beat. Print always shows the last beat.
- `Maths`, `MLine`, `MEq` — the "Show the maths" drawer (open in print).
- `Switch`, `Scrub`, `Knob` — keyboard-ready controls. `Box3`, `Neuron`, `Bead`, `Counter`, `Token`, `Grid`.
- `../../TensorGlyph.jsx` — any tensor drawn by its shape in the axis colours.
- `../../DrillFrame.jsx` — the drill UI; your `labs/Drill.jsx` is a few lines.
- `../../hero.js` — `useHeroBeats(n, { run, ref })` for the opener's animation.

The design rules:
- One idea per lab, visible in five seconds; open on the finished "aha" state.
- Picture first; numbers on hover and in the maths drawer. Anything that reacts to hover must also take keyboard focus, with `onFocus`/`onBlur` doing what `onPointerEnter`/`onPointerLeave` do, an `aria-label`, and a Try this that says “hover (or tab to)”. A set of hover targets (cells, segments, outputs) is **one** tab stop: spread `rove(group, i, n, cols, active)` from `rove.js` on each item, and the arrow keys move between them.
- ≤ 3 controls; story beats for processes.
- **Numbers come from a maths module, never typed twice.**
- `printing` (from `useStudy()`) pins a finished state; the PDF prints labs on their last beat.
- Works at 390 px: measure the stage with `useWidth(ref)` on a wrapper that is always mounted, and draw a simpler picture when narrow.
- One visual vocabulary: use the role tokens in `stage.css` (weights `--dltt-w`, biases `--dltt-b`, data `--dltt-data`, probability `--dltt-p`, window `--dltt-win`, stride jump `--dltt-jump`, frozen/padding `--dltt-nt`, and the six axis colours `--dltt-batch/h/wd/c/t/f`). Never hard-code colours; check jade, coral and arcade.
- No emoji, no filled pills, no coloured left-border boxes. Every control keyboard-reachable. `prefers-reduced-motion` turns transitions off.

Gotchas: in JSX attribute strings write TeX with single backslashes (`caption="$\hat{p}$"`), in JS strings and template literals with double (`'$\\hat{p}$'`). Never put a double-quoted word inside a double-quoted JSX attribute (`text="… "valid" …"` breaks the build): use curly quotes or `text={'…'}`. A literal `$` in prose pairs up as maths. ESLint forbids reassigning a variable during render (use `reduce` for running sums) and `setState` directly in an effect body; `.jsx` files export components only. Bash heredocs strip backslashes on this machine: edit TeX with the Edit/Write tools.

---

## The drill (`drill.js`)

```js
export function make(seed, mode) { /* deterministic in seed */ return question; }
export const MODES = [{ value: 'a', label: '…' }];   // optional
export const FIXED = [ /* questions from the unit, with receipts */ ];
```

A question: `{ id, title?, prov, prompt, show?, fields: [{ key, label, answer, type: 'number' | 'text' | 'choice', options?, tol?, accept? }], working: ['…'], model?, verify? }`. A `choice` field takes `options: [{ value, label }]` (plain-text labels: a `<select>` can't show maths) and its `answer` is the right option's `value`. Answers are marked forgivingly (`235,500` = `235500`; shapes ignore spaces and brackets). Add `model` (the `shapeRules.js` model vocabulary) when a question is about a model, and `verify` (`{ kind: 'softmax', z, p }` or `{ kind: 'size', layer: 'conv1d' | 'conv2d' | 'pool' | 'convT', n, k, s, pad, out }`) for other numbers: `verify_counts.py` checks every one in Keras. Copy `topics/_template/drill.js` for the seeded `rng`.

---

## Notebook pages (`sheets/pN.js`)

The schema is in `topics/_template/sheets/p1.js` and `../../sheetKeys.js`: `blocks: [{ id, h, at, items, fig?, margin? }]` (a block's `at` is a short receipt like `L2 · 63–64`; the page's own `at` in `sheets/index.js` is the line written top right, e.g. `L2 · slides 62–64`) and a closing `skip` line ("Not on this page (see Read): …"). Items: `'bullet'`, `{ line }`, `{ steps: [...] }`, `{ formula, read?, tag? }`, `{ worked: [...] }`, `{ table: { head, rows, cols? } }`, `{ fig }`. A table cell can be a list (`['$n$ features,', '$f$ filters']`) that wraps only between its entries, so a symbol stays with its name; `cols` sets the column tracks on wide pages (narrow pages size them to content), e.g. `param-count/sheets/p1.js`. Margin: `{ q, a }` self-tests, `{ nb }` reminders, `{ sc }` slide-check pointers. Four pens: blue headings and receipts, black body, red markers, `{g|green}` sparingly; no handwriting font. **≤ 30 ruled lines** at 760 px: prefer tables and boxed formulas, keep `tag` plain text (it isn't parsed for maths), and check the indicator above the page.

---

## Verifying numbers (TensorFlow)

**Needed only if** you added a named model to `maths/models.js` or a drill question with `model` / `verify`. `check-maths.mjs`'s first section fails ("stale: re-run …") when the truth file is missing something; if it passes and you added neither, skip this section and say so in your summary. If `keras-truth.json` comes out unchanged, there is nothing to commit.

```
node tools/dl-tricky-topics/export-specs.mjs
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo>/tools/dl-tricky-topics" \
  -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
  /home/james/miniconda3/envs/tf-2.20-gpu/bin/python verify_counts.py
```

- `export-specs.mjs` collects every named model (`maths/models.js`), every model and `verify` item your drill generates (200 seeds per mode, plus `FIXED`), the output-size sweep and softmax vectors into `specs.json`.
- `verify_counts.py` builds each one in Keras (never trains) in the read-only WSL environment `tf-2.20-gpu` and writes `keras-truth.json`. **Never install anything into that environment.** It must print `ALL OK`.
- New named model? Add it to `maths/models.js` with its slide receipt (`at`) and, if the slide prints counts, `printed` — the check then asserts the slide's numbers equal the rule's.
- Commit the new `keras-truth.json` (not `specs.json`).

---

## Checks (they pick a new topic up automatically)

Every check iterates `topics/index.js`; none needs editing.

```
node tools/dl-tricky-topics/check-maths.mjs
node tools/dl-tricky-topics/page-check.mjs [outDir]
node tools/dl-tricky-topics/pdf.mjs <outDir> [<id> …] [--pages=1,3,6]
node tools/dl-tricky-topics/fits.mjs          (each page's measured rules)
node tools/dl-tricky-topics/shot.mjs <outDir> <id> [ids… | all] [--width=1440|390] [--theme=jade|coral|arcade] [--part=all|play|read|nb|open|measure] [--full] [--reduce]
npx eslint src/components/portal/modules/deep-learning/tricky-topics tools/dl-tricky-topics
npm run build
```

- The browser tools default to the dev server at http://localhost:5184 (`SITE_URL=` to change it). Start one with `npm run dev -- --port 5184` if none is running.
- `pdf.mjs`'s first argument is the **output folder** (`pdf.mjs out my-topic`, not `pdf.mjs my-topic`). Output folders under `tools/dl-tricky-topics/out/` are gitignored; a scratch folder outside the repo is better.
- `page-check.mjs` takes `ONLY=` with any of `render, tabs, fits, pens, focus, persist, storage, reduced, keyboard, export, nlm, shots, others` to run part of it. The shell-feature groups (pens, focus, persist, storage) run on the first topic only; everything else runs on every topic.
- Look at your labs at 390 px while you build them (step 5), not only at the end.

- `check-maths.mjs`: JS rules vs `keras-truth.json` (stale truth = re-run the two commands above), budgets, gist, one lab per step, provenance, receipts inside their decks, numbers that trace, `<Stage prov>`, topic isolation, prompts, no `REPLACE ME` left (set `ALLOW_PLACEHOLDERS=1` while drafting).
- `page-check.mjs`: every topic via its deep link and its tab, the last topic reopening, focus mode, ticks and "got it" surviving a reload, "Resume at step N", every notebook page ≤ 30 rules (measured independently), pens and contrast, no handwriting font, broken storage, reduced motion, keyboard on every lab and the drill, ≤ 3 controls per lab, the stubbed export + afterprint, the NotebookLM dropdown, 3 themes × 1440/390 with no horizontal scroll, and every other Deep Learning module still rendering. `window.print` is stubbed before the page loads.
- `pdf.mjs`: each topic's PDF; checks with `pdftotext` that every step title appears in order, the counts match `keras-truth.json`, and no notebook text leaks in; reports page count and size.

---

## Reading the slides

- Decks: `Documents/cits5017/lectures/*.pdf` (one page per slide). Transcripts with Quirks lists: `Documents/cits5017/markdown-lecs/lecture-N.md` (handy, but verify against the images; `lecture-3.md` stops at slide 16).
- Text: `pdftotext -layout -f N -l N <pdf> -` (it garbles maths and code indentation).
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/p`, then look with the Read tool; crop at a higher dpi for figures. Read every number, formula and figure you use from the image. Don't embed slide renders: redraw.
- Exam context: `Documents/temp/past-exam-info/exam-information.md`; Exam Practice parts live in `deep-learning/exam-practice/papers/` (link to them by name in `examAsks`; don't edit them).

---

## Ready-to-paste brief

> Add the topic *X* to Tricky Topics: read and follow `src/components/portal/modules/deep-learning/tricky-topics/ADDING-A-TOPIC.md`; the topic is **X** — *what I find hard about it, in one or two sentences* — and it shows up in *the lectures/slides I remember (optional)*. Work in your own git worktree off `main` and merge back with `--no-ff` when every check passes; don't push. Start from `node tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"`, source every number from the slide images, verify the numbers in TensorFlow with `verify_counts.py`, keep to the budgets, and finish with a summary listing every count with its provenance, every Slide check, the notebook page's measured rules, the NotebookLM prompt in full, and anything unverified.
