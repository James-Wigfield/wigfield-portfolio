# Build: CITS5017 Tricky Topics: one growing page for the concepts I find hard (parameter counts, shapes, softmax, stride)

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning, and the final exam is close. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with one study module per lecture. Each one is a single page I work down in focus mode: **Read → Play → Write**.

This build is different. It isn't about a lecture. It's a page for **the concepts I keep tripping over**. They cut across many lectures, so I never get them properly explained in one place. Build **one new page, "Tricky Topics"**, with **four topics to start with**:

1. **Parameter counts:** how to count the parameters of every kind of model this unit covers.
2. **Shapes:** what "the shape" of an input, an output, a tensor or a weight actually means.
3. **Softmax:** what it really is and why it keeps turning up.
4. **Stride:** what it does and how it changes the output size.

**The page must be built to grow.** As I keep studying I'll find more topics hard, and I'll ask a Claude instance to add each one. Adding a topic must be a small, documented, mechanical job: copy a template folder, fill in data and labs, add one line to a topic list. It must never mean editing the page shell, the other topics, or the check scripts.

Three things matter above everything else:
1. **I actually understand it.** This is the main point. Assume I'm starting from zero on each topic. Make it very, very easy to follow, highly visual and nicely animated. It should be optimised for learning the key method fast, not for completeness. Show the picture first and the words second. Never give me a wall of text.
2. **Accuracy.** Every number, formula, shape and claim is right, and it says where it comes from. I'll memorise what this page says, so a wrong count is worse than a missing one.
3. **Scalability.** Topic five should take another instance one short session, following a doc this build writes.

**The template** is the newest study module, **"Lecture 9 · Reinforcement Learning (Study)"** (`/portal/dl-lecture-9-study`, folder `src/components/portal/modules/deep-learning/lecture9-study/`). It's a copy of the Lecture 8 shell and its stage-first lab kit, plus "Explain this code" cards. Copy its shell, lab kit, code cards, notebook-page format, PDF export and NotebookLM dropdown. Take the **measured one-page notebook format** from the Lectures 1–2 refresher (`lectures1-2-refresher/`, whose `SheetPage` counts its own ruled lines).

> **Saved preferences** (in your auto-memory; here's how they apply):
> - **No long-scroll pages: use top tabs.** Here that means **one tab per topic**. Inside a topic, the steps run as one Read → Play → Write flow, as in the study modules, with the index rail and focus mode.
> - **No walls of text:** every piece of prose has a word budget (below).
> - **No AI-callout styling:** no tone-coloured rounded left-border callout boxes and no filled pills. Show tone with a small labelled dot or an outlined label on a ruled, editorial layout.
> - **Code blocks look like VS Code** (the kit's dark editor panel).
> - **Visual labs, not number walls** (the Lecture 8 kit principles): one idea visible in five seconds, picture first with the maths in a drawer, at most 3 controls, story beats for processes.

---

## What I'm struggling with, topic by topic (in my words)

- **Parameter counts.** I can't reliably work out how many parameters a model has. Exam questions give me a model in some form and ask for the parameters, per layer and in total. The model might come as a diagram, a block of code, a `model.summary()` with gaps, a sentence ("200 filters of 5 × 5 on an RGB image…") or a set of equations. I want **one method that works for every source**, then the rule for each layer type the unit uses, practised until it's automatic.
- **Shapes.** I vaguely know that a shape is the shape of a tensor somewhere in the model, but I don't really get it. What do the numbers in `(2, 70, 120, 3)` mean? Why is there a `None`? Why do RNNs want 3D input? How does each layer change the shape? How do the shapes of the weights relate to the shapes of the data?
- **Softmax.** I've met it in output layers, in cross-entropy, in attention and in the transformer's last layer, and I still don't know what it actually does. I want to *see* it working.
- **Stride.** I roughly know it's how far a window moves, but not completely: what it does to the output size, how it interacts with padding, pooling's default stride, and why you'd choose a bigger one.

---

## The page: built to grow

### What I see
- **A compact hero:** the title "Tricky Topics", one line ("The concepts I find hard, one at a time, from every lecture"), and the topic count.
- **A sticky topic tab bar** under the portal topbar, one tab per topic. Each tab shows:
  - the topic title;
  - the lectures it draws on, as quiet outlined labels ("L1 L3 L4 …");
  - a small progress mark.

  At 390 px it becomes a select or scrolls inside itself, never sideways across the page.
- **Deep links:** `/portal/dl-tricky-topics/<topicId>` opens that topic. The portal already supports `/portal/:toolId/*` sub-routes through `usePortalRoute()` in `src/components/portal/portalRoute.js`; use it. With no sub-route, open the last topic I visited (stored under `dltt:`), or the first topic.
- **Inside a topic:** the study-module shell. That means the index rail of its steps, focus mode, "Resume at step N", and progress and done marks counted per topic.

### How it's built (the part that makes it scale)
- **Topic list:** `topics/index.js` is an ordered array of `{ id, title, lectures, blurb, load }`.
  - `load` is a lazy `import()` of the topic's folder, so the page stays fast as topics pile up.
  - The tab bar, deep links, progress and every check script read this list. Nothing else names topics.
- **One folder per topic:** `topics/<id>/` holds everything that topic owns:
  - `topic.js`: the opener, the steps' Read text and provenance, the "where it shows up" list and the exam links, all as data;
  - `labs/`: its lab components;
  - `drill.js`: its exam-drill generator;
  - `sheets/`: its notebook page(s);
  - `exportPrompt.js`: its NotebookLM prompts;
  - any maths it needs.
- **Shared engine:** the shell, lab kit, code card, notebook page, provenance labels, export and storage live at the page root and are shared by every topic. Topic folders import the shared engine. A topic never imports from another topic's folder; cross-topic links go through the shell by id.
- **Storage** is namespaced per topic: `dltt:<topicId>:…`. Every read and write goes in try/catch.
- **`topics/_template/`:** a complete, working, minimal topic, with one step, one lab, one drill and one notebook page, all clearly marked "replace me". It is **not** in `topics/index.js`. The scaffold copies it.
- **`tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"`:** copies `_template` to `topics/<id>/`, fills in the id and title, and appends the entry to `topics/index.js`.
- **`ADDING-A-TOPIC.md`** in the page folder. It covers:
  - the steps to add a topic;
  - the topic schema;
  - the budgets;
  - the provenance rules;
  - how to verify numbers (the TF script);
  - which checks run, and that they pick the new topic up automatically.

  It ends with a **ready-to-paste brief template**, "Add the topic *X* to Tricky Topics: read and follow `…/ADDING-A-TOPIC.md`; the topic is …". I'll hand that to a future Claude instance.
- **Every check iterates over `topics/index.js`**, so a new topic is checked without anyone editing the checks.

### Each topic: Read → Play → Write
1. **The opener**, the "information at the top". In order:
   - **What it is, in one sentence**, plain words.
   - **A hero animation** that shows the whole idea in about five seconds and replays on click. Examples: score bars turning into probability bars for softmax; a window hopping across a strip for stride; a cube of numbers labelling its axes for shapes; connections and biases ticking up a counter for parameters.
   - **"Where it shows up":** a ruled strip of every place the unit uses it, each with a receipt ("L8 · slide 38") and a quiet link to that lecture's study module.
   - **"What the exam asks":** the stimulus types, each linked to an Exam Practice part that uses it.
2. **Steps** (budgets per topic below). Each step has:
   - **Read:** one bold gist sentence, then ≤ 120 words of bullets or short sentences, with at most one table *or* one key formula.
   - **Play:** one lab.
3. **Exam drill**, the last Play block. It generates practice in the exam's own form, with instant feedback that shows the working. I can redo it endlessly.
4. **Write:** the notebook page(s) for the topic, at the end of it.

### Provenance: every number and claim says where it comes from
Use three quiet outlined labels, consistently, in Read, Play, drills, notebook pages and the PDF:
- **"L3 · slide 22"**: the slide states it, or prints it.
- **"this page's own · checked in TF"**: computed by this page and verified by `verify_counts.py` in the unit's TensorFlow environment (e.g. the Lecture 3 CNN's total, which no slide prints).
- **"beyond the slides"**: true and useful, but not in the lecture notes. Examples: the softmax formula itself, and the conv output-size formula. The exam note says textbook sections not in the lecture notes won't be examined, so I need to see what's support and what's syllabus.

"Slide check" notes (`slideNote`), as in every study module, record real discrepancies on the slides. **Never silently "correct" a slide.**

---

## Topic 1 · Parameter counts (the biggest topic: up to 12 steps, 2 notebook pages)

**The method I want to own:** it works on any source.
1. List the layers in order.
2. Track the size flowing *into* each layer. This is where shapes matter; link to topic 2.
3. Apply that layer type's rule.
4. Layers with nothing to learn score zero: Flatten, Reshape, Dropout, pooling, GlobalAvgPool, Concatenate, Activation, Sampling.
5. Split trainable from non-trainable.
6. Add up. In the exam, **write the working**: the marks are in it.

**Rule table:** one row per layer type. Pattern each rule on what the slides show; label anything not on the slides as beyond them.

| Layer | Rule | Where the unit shows it |
|---|---|---|
| Dense | (n_in + 1) × n_out: an n_in × n_out weight grid plus one bias per neuron | L1 s36 |
| Dense, `use_bias=False` | n_in × n_out | L2 s28 |
| Normalization | 2n + 1, all non-trainable (means, variances, count) | L1 s45 (17 = 8 + 8 + 1) |
| BatchNormalization | 4n: γ, β trainable; moving mean and variance non-trainable | L2 s27 |
| Conv2D / Conv1D / Conv2DTranspose | (k_h × k_w × c_in + 1) × filters. Independent of image size and of stride | L3 s16, s19, s22; L4 s50; L6–7 s6 |
| SimpleRNN | units × (units + n_in) + units: W_x, W_h, b, shared across every time step | L4 s9 shapes, s25–29 |
| Bidirectional | 2 × the wrapped layer | L8 s9 |
| LSTM | 4 × (units × (units + n_in) + units) | L4 s43 |
| GRU (Keras default `reset_after=True`) | 3 × (units × (units + n_in) + 2 × units) | L4 s49, s50 |
| Tied decoder (`DenseTranspose`) | biases only: it reuses the encoder's kernel | L5 s18–21 |
| Frozen layers | still counted, but as non-trainable | L2 s30–32; L3 s51 |

**Verified numbers** (I checked every one on 2026-10-25 in the WSL env `tf-2.20-gpu`; re-verify them all in your own `verify_counts.py`):

| Source | Model | Count | Provenance |
|---|---|---|---|
| L1 s36 | 784 → 300 → 100 → 10 MLP | 235,500 + 30,100 + 1,010 = **266,610** | slide |
| L1 s45 | Wide & Deep: Normalization(8), Dense(30) ×2, Concatenate(8 + 30 = 38), Dense(1) | **1,256** total = 1,239 trainable + 17 non-trainable | slide |
| L2 s27 | BN before and after the hidden layers | **271,346** = 268,978 + 2,368 (2 × (784 + 300 + 100)) | slide |
| L2 s28 | BN before activation, `use_bias=False` | **267,010** trainable + **800** non-trainable | this page's own |
| L3 s19 | `Conv2D(32, 7)` on RGB: kernels `(7, 7, 3, 32)`, biases `(32,)` | **4,736** | this page's own, from the slide's shapes |
| L3 s22 | 200 filters of 5 × 5, RGB 150 × 100 | (5 × 5 × 3 + 1) × 200 = **15,200**; the dense equivalent is 675 million | slide |
| L3 s35 | Fashion MNIST CNN | **1,413,834**: 3,200 / 73,856 / 147,584 / 295,168 / 590,080 / 295,040 / 8,256 / 650; Flatten 3 × 3 × 256 = 2,304 | this page's own |
| L4 s23 | linear model on 56 steps | **57** | slide |
| L4 s25 / s27 / s29 | SimpleRNN(1); SimpleRNN(32) + Dense(1); deep RNN | **3**; **1,121**; 1,088 + 2,080 + 2,080 + 33 = **5,281** | slide |
| L4 s43 | LSTM(12) + Dense(1) | **685** | slide |
| L4 s49 | GRU(20) + Dense(1) | **1,401** (1,341 if `reset_after=False`) | slide (1,341: this page's own) |
| L4 s50 | Conv1D(8) → Conv1D(16, strides=2) → GRU(10) → Dense(1) | 32 + 400 + 840 + 11 = **1,283** | slide |
| L5 s12 / s21 | stacked AE vs tied AE | **163,814** vs **82,414** | slide |
| L6–7 s5–6 | conv decoder; whole conv AE | **13,873** (4,464 / 4,640 / 4,624 / 145); `count_params()` **54,479** (encoder 40,606) | slide |
| L6–7 s23 | GAN, `codings_size = 30` | generator **136,634**, discriminator **132,951** | this page's own |
| L6–7 s29 | DCGAN | generator **840,321** + **384** non-trainable; discriminator **212,865** | this page's own |
| L8 s9 | Bidirectional(SimpleRNN(16)) + Dense(2) | 2 × 304 + 66 = **674** | slide (comment) |
| L9 s25 / s61 | policy net; DQN | **31**; **1,282** | this page's own (L9 study verified both) |
| Sample Q1(c) | Normalization(10) → Dense(20) → Concatenate(10 + 20 = 30) → Dense(3) | 220 + 93 = **313** trainable + **21** non-trainable | Exam Practice's answer |
| Practice A Q1(c) | small CNN | **5,418**; the Flatten variant's output layer is **20,490** | Exam Practice's answer |
| Practice A Q2(a) | memory cell: 3 inputs, 6 neurons, 1 output | 60 + 7 = **67** | Exam Practice's answer |

**Suggested steps** (merge or split if it teaches better):

| # | Step | Lab idea |
|---|---|---|
| 1 | What a parameter is: a number the model learns. Weights + biases, trainable vs non-trainable | **Connection loom:** two columns of neurons; drag either size; lines draw in, biases glow, the counter climbs; the weight grid fills beside it |
| 2 | Dense layers, and the MLP total (L1 s36) | **Stack the counts:** the 266,610 bar built layer by layer, showing where the parameters live |
| 3 | Counting from a diagram: arrows are weights, plus one bias per non-input neuron (unless a bias neuron is drawn) | Click arrows and neurons to tally; mismatches flash. Use the unit's own figures as models (an MLP, the memory cell) |
| 4 | Zero-parameter layers, and why `Concatenate` matters (L1 s45, sample Q1(c)) | **Wide & Deep:** the concatenated width visibly feeds the next Dense |
| 5 | Normalization and BatchNormalization; trainable vs non-trainable | Per-feature boxes: 4 per feature, 2 greyed as non-trainable; the L2 s27 totals add up live |
| 6 | Conv2D: one filter = k × k × c_in + 1; image size doesn't matter (L3 s19, s22) | **Filter brick:** a k × k × c_in brick plus a bias bead, cloned `filters` times; resizing the image changes nothing, which is the aha. L3 s22's 15,200 vs 675 million as a scale bar |
| 7 | A whole CNN (L3 s35); Flatten vs GlobalAvgPool before Dense (Practice A) | The CNN as a ribbon of blocks; switch Flatten ↔ GAP and watch the Dense count jump |
| 8 | SimpleRNN: W_x, W_h, b; the time steps add nothing (L4 s9, s25–29) | **Unrolled cell:** the same three weight blocks reused at every step; drag the time steps and the count stays put |
| 9 | LSTM ×4, GRU ×3 (+ Keras's extra bias); Bidirectional ×2 | Four (or three) gate copies of the SimpleRNN block, stacked; a `reset_after` toggle shows 1,401 vs 1,341 |
| 10 | Autoencoders, GANs, VAE branches, DCGAN; tied weights (L5, L6–7) | Tied vs untied: the decoder's kernels fade to "borrowed", leaving only biases (163,814 → 82,414) |
| 11 | Frozen layers and transfer learning (L2 s30–32, L3 s51) | A lock toggle per layer moves its count between trainable and non-trainable |
| 12 | **Same model, five disguises:** code ↔ diagram ↔ `model.summary()` ↔ a sentence ↔ equations | One small model shown five ways via a switcher; the per-layer table never changes |

**Exam drill:** a seeded random model generator using the unit's layer vocabulary (Dense, Conv2D/Conv1D, pooling, Flatten/GAP, BN, Normalization, Concatenate, SimpleRNN/LSTM/GRU, Dropout, Bidirectional). Each model is presented in one of the five forms (code in the VS Code block, a line-art diagram, a summary with blanks, a sentence, RNN equations with matrix sizes). I type the per-layer counts and the total, and get instant feedback: right or wrong per layer, with the rule and working shown. There's also a reverse mode: given the counts, find the units or filters. A small set of fixed "from the unit" questions sits beside the random ones.

**Notebook pages (2):**
- Page 1: the method and the rule table.
- Page 2: four worked examples, one per source type, plus the traps (Concatenate widens, BN's non-trainable half, GRU's extra bias, time steps don't add, image size doesn't matter, frozen ≠ removed).

## Topic 2 · Shapes (up to 7 steps, 1 notebook page)

| # | Step | Sources | Lab idea |
|---|---|---|---|
| 1 | A tensor is a box of numbers; its shape is how many along each axis; rank = number of axes. Scalar `()` → vector `(3,)` → matrix `(2, 3)` → 3D → 4D | — | **Tensor builder:** add an axis and the box grows a dimension; the tuple updates; hover a number to light its axis |
| 2 | The batch axis: always first, `None` in summaries, *m* on L3 s43 | L1 s36 summary; L3 s16, s43 | The same model fed 1, 2 or 32 examples: only the first number changes |
| 3 | Reading real tuples: `(2, 70, 120, 3)` = 2 images × 70 rows × 120 columns × 3 colours | L3 s16–20, s31, s48 | **Read the tuple:** hover each number to highlight that axis on a picture of the images |
| 4 | The unit's data shapes: tabular `[batch, features]`; images `[batch, h, w, c]`; sequences `[batch, time steps, dimensionality]`; attention's Q, K, V and score shapes | L1; L3 s16; L4 s19–24; L8 s38; L9; sample Q2(a), Lab 4 | **Shape gallery:** the same "box" picture for each data type, with axis colours consistent across the whole page |
| 5 | How layers change shapes: Flatten, Dense (last axis only), Conv2D (h, w via kernel/stride/padding; c → filters), pooling, GAP, Reshape, Concatenate, `return_sequences`, Conv2DTranspose | L3 s18–31; L4 s29; L6–7 s5 | **Shape tracer:** pick a unit model (L3 s35 CNN, L6–7 conv AE, L4 s50 CNN-GRU, DCGAN) and step through it while the block morphs layer by layer |
| 6 | Weight shapes vs data shapes: kernel `(7, 7, 3, 32)`, biases `(32,)`; a Dense kernel is `(n_in, n_out)`; parameters = the product of the weight shapes (link to topic 1) | L3 s16, s19; L4 s9 | Click a layer to see its data-in, data-out and weight blocks side by side |
| 7 | Exam move: a scenario → the shapes of X and y | sample Q2(a) (Lab 4 in disguise: `(200, 4, 2)`) | Built into the drill |

**Exam drill:**
- a model → each layer's output shape;
- a scenario → the shapes of X and y and what each axis means;
- a tuple → name the axes.

**Notebook page (1):**
- the shape conventions per data type;
- how each layer changes a shape;
- the batch-axis rule;
- two traced examples.

## Topic 3 · Softmax (up to 6 steps, 1 notebook page)

| # | Step | Sources | Lab idea |
|---|---|---|---|
| 1 | What it does: any list of scores → probabilities that are all positive and sum to 1; the biggest score gets the biggest share; the order is kept | L1 s29 ("ensure that all the output values are probabilities and they sum to 1") | **Scores to shares:** drag score bars; story beats: z → exp(z) → ÷ total → p, ending on a 100% stacked strip |
| 2 | The formula, with a hand-worked example using a calculator (the exam allows one) | **beyond the slides** (confirm no slide prints it) | Inside the lab's maths drawer; adding the same number to every score changes nothing (shown live) |
| 3 | Softmax vs sigmoid: binary (one sigmoid) vs multilabel (several sigmoids) vs multiclass (softmax); CartPole's one sigmoid for two actions | L1 s29–31; L4 s9; L9 s25 | A three-way switch over the same output layer |
| 4 | Softmax + cross-entropy, `sparse_categorical_crossentropy`, and `argmax` to get the class | L1 s29, Keras code; Lab Sheet 3's `np.argmax` pitfall | Push the true class's probability up and watch the loss fall |
| 5 | Softmax in attention: scores → weights α that sum to 1 → a weighted sum; scaled dot-product attention's rows each sum to 1; why divide by √d_keys (saturation → tiny gradients) | L8 s22–24, s37–38 | **Attention weights:** three encoder words, scores → α → context; a "scale" knob shows big scores saturating to near one-hot |
| 6 | The transformer's (and any classifier's) last layer: vocab-size or class-size probabilities; softmax has 0 parameters (link to topic 1) | L3 s33; L8 s26, s41 | Probability bars over a small vocabulary; the predicted word is the tallest |

**Exam drill:**
- given logits, compute or estimate the probabilities;
- which output changes, and how, when one score rises;
- softmax or sigmoid for a scenario;
- what the rows of an attention matrix sum to.

**Notebook page (1):**
- what it does;
- the formula (labelled beyond the slides) with one worked example;
- the softmax / sigmoid / multilabel table;
- where it appears in the unit;
- the √d_keys reason.

## Topic 4 · Stride (up to 6 steps, 1 notebook page)

| # | Step | Sources | Lab idea |
|---|---|---|---|
| 1 | Stride = the distance between consecutive receptive fields: how far the window jumps | L3 s9 | **Sliding window:** a window hops along a strip; drag the stride; ghost trails show every position; the output strip fills in |
| 2 | Stride + padding → output size. `valid` can ignore inputs; `same` pads with zeros, but stride > 1 still shrinks | L3 s20–21 (Figure 14-8: I count **10 inputs, kernel 7, stride 2** → `valid` gives **2 outputs with 1 input ignored**, `same` gives **5** with 2 zeros on the left and 3 on the right; verify from the image) | Recreate Figure 14-8 exactly, then let me change n, k, s and the padding |
| 3 | 2D: L3 s9's 5 × 7 input → 3 × 4 output with 3 × 3 fields and stride 2 | L3 s9 (Figure 14-4) | A 2D grid version with the h and w strides |
| 4 | Output-size rules: `same` → ⌈n / s⌉; `valid` → ⌊(n − k) / s⌋ + 1. **Beyond the slides**: derived from slide 9's index rule and checked in TF. Worked on the slides' own layers: L3 s18 70 × 120 → 64 × 114; AlexNet C1 227 → 55, S2 55 → 27 (L3 s39); LeNet-5 32 → 28 → 14 (L3 s37); L4 s50 56 → 54 → 26 | as listed | **Stride calculator:** the rule and the picture agree, side by side |
| 5 | Pooling's stride defaults to the pool size, so `MaxPool2D()` halves and rounds down (7 → 3); pooling vs strided convs (DCGAN); a big first-layer stride to save memory | L3 s24, s28, s34; L6–7 s5, DCGAN guidelines | Max pool 2 × 2 / stride 2 as a story, with the dropped values fading out |
| 6 | Transposed convs with stride 2 upsample: 3 → 7 (`valid`), 7 → 14, 14 → 28 (`same`). Stride changes the shape and the compute, **never the parameter count** (link to topic 1) | L6–7 s5; L3 s23 | The conv AE decoder growing back to 28 × 28 |

**Exam drill:**
- n, k, s and the padding → the output size, then the picture to check it;
- a CNN's code → every layer's spatial size;
- "why would you use a stride of 2 here?"

**Notebook page (1):**
- the definition;
- the two padding rules (labelled beyond the slides) with a sketch of Figure 14-8;
- pooling's default;
- three worked sizes from the slides;
- stride vs parameters.

---

## Labs: the Lecture 8/9 kit, one visual vocabulary for the whole page

Use the kit unchanged. Read the "new lab design" section of the vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md` and `03-Dev-Logs/2026-10-24-dl-lecture9-study.md`, and `lecture9-study/stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`, `useWidth.js` and `stage.css`. In short:
- one idea per lab, visible in five seconds, opening on its finished "aha" state;
- picture first, numbers on demand (hover, plus a "Show the maths" drawer);
- direct manipulation, at most 3 controls;
- story mode for processes;
- tiny honest numbers;
- a text budget of a title, a one-line "Try this" and at most two caption sentences;
- quiet optional challenges.

**Use one visual vocabulary across all topics**, because they interlock. Define these role colours as tokens per theme in `stage.css`:
- **parameters:** weights and biases, with biases a distinct shade;
- **data/activations;**
- **shape axes:** one fixed colour each for batch, height, width, channels, time steps and features, the *same* colour in every topic;
- **probability;**
- **window/kernel;**
- **stride jump;**
- **padding:** hatched zeros;
- **non-trainable:** greyed.

The axis colours matter most. If "channels" is teal in the shapes topic, it's teal in the stride and parameter labs too.

**Animation:**
- The kit's story beats and CSS transitions are the default. GSAP is already a dependency (`gsap`) and may be used for the topic openers.
- Respect `prefers-reduced-motion`: labs and openers jump to their end state.
- Print the end state.
- No animation runs while it's off screen.

**Numbers in labs** come from the same maths modules as the drills (e.g. `paramRules.js`, `shapeRules.js`, `softmax.js`, `strideRules.js`). Nothing is typed in by hand twice.

## Write: notebook pages I copy by hand

Use the refresher's format (`lectures1-2-refresher/SheetPage.jsx`, `sheet.css`, the `sheets/` schema, its hidden 760 px measuring copy and `onRules`). That means:
- layout by idea;
- proper short sentences, no handwriting font;
- **four pens:**
  - **blue:** headings and receipts;
  - **black:** body, formulas and numbers;
  - **red:** bullet markers and step numbers only;
  - **green:** sparing highlights;
- margin self-test questions;
- tick-as-you-copy with stable keys.

**Each page fits one real notebook page: ≤ 30 ruled lines at the 760 px reference.** Show the quiet "fits one page · n of 30 rules" indicator and assert it in the page check.
- Prefer tables and boxed formulas.
- Add diagrams only where a sketch beats words and fits the budget (Figure 14-8 for stride is worth it).
- End each page with the grey "Not on this page (see Read): …" line.

---

## Where things are

| What | Path |
|---|---|
| **Lecture decks** (the source of truth) | `Documents/cits5017/lectures/`. Slide counts: L1 64 · L2 68 · L3 53 · L4 52 · L5 27 · L6–7 32 · L8 51 · L9 69 |
| Transcripts with Quirks lists (verify against the images) | `Documents/cits5017/markdown-lecs/lecture-1.md` … `lecture-9.md`. **`lecture-3.md` stops at slide 16**: read L3 slides 17–53 (padding, stride, pooling, memory, architectures) from the images |
| Slide listings other modules already transcribed (handy; verify them) | `lecture4-study/slideData.js` … `lecture9-study/slideData.js` |
| **The template** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture9-study/`, plus `lectures1-2-refresher/` for the measured notebook page |
| Template tools (copy and adapt) | `tools/dl-lecture9-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`, `check-rl.mjs` as the pattern for a maths check), `tools/dl-lectures1-2-refresher/` (the rule-measuring check) |
| **Parameter-count verifier to copy** | `tools/dl-exam-practice/verify_counts.py` (how to build models in the WSL env and assert counts and shapes; its header has the exact `wsl.exe` command) |
| How the earlier builds went (rules, gotchas) | vault logs `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`, `2026-10-24-dl-lecture9-study.md`, `2026-10-24-dl-lectures-1-2-refresher.md`, `2026-10-24-dl-exam-practice.md` |
| **Exam information** | `Documents/temp/past-exam-info/exam-information.md` (closed book, calculator allowed, "given code → draw a diagram or explain"); the sample paper `sampleExam2026-s2.pdf` (read every page as an image) |
| Exam Practice (link targets for "What the exam asks"; **don't edit**) | `deep-learning/exam-practice/papers/` (`sample.js`, `paperA.js`, `paperB.js`), `tools/dl-exam-practice/coverage.md` |
| Lab sheets | `Documents/cits5017/labs/cits5017LabSheet2.pdf`, `…3.pdf`, `…4.pdf` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Deep-link helper | `src/components/portal/portalRoute.js` (`usePortalRoute`) |
| The unit's TensorFlow environment (read-only; for `verify_counts.py`) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` (WSL distro Ubuntu, conda env `tf-2.20-gpu`) |
| Obsidian vault | `C:\Users\james\Documents\james-claude-brain` (project note `01-Active-Projects/wigfield-portfolio-management-portal.md`) |

**Reading the slides:**
- Text: `pdftotext -layout -f N -l N <pdf> -`. It garbles maths (×, √, Greek letters and subscripts drop) and code indentation.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/p`, then look at them with the Read tool. Crop at a higher dpi for figures (Figure 14-8 needs it).
- Read every number, formula and figure you use from the image. Don't embed slide renders in the page; redraw them.

---

## Ground rules

- **What you may edit:**
  - create `src/components/portal/modules/deep-learning/tricky-topics/` and `tools/dl-tricky-topics/`;
  - add one entry (and its import) to `registry.js`;
  - edit `icons.jsx` only if you truly need a new icon.
- **What you must not edit:** any other module or its tools. That includes every `lecture*`, `exam-practice/`, `codelab/` (another instance may be refactoring it right now), `arcade/`, `game/` and `project2/`, plus `kit.jsx`, `kit.css`, `common.css`, `index.css` and `index.html`.
- **Imports:** you may import from the shared kit (`../kit`, `../common.css`). Don't import from another module's folder; copy what you need and rename it to this page's prefix.
- **Copy, don't refactor.**
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is merged into `main` (see "Git") and the final summary is written.
  - The only thing you must *not* do on your own is push to GitHub.

---

## Git: build in your own worktree, finish on `main`

I want the final result **on `main`, with no branch or worktree left behind**. Other Claude instances may be running builds in the main folder or in their own worktrees; the Code Lab refactor (`../wigfield-portfolio-dlc`, port 5182) may be one of them. Don't touch them. **Always build in your own worktree:**

1. **Create it:** `git worktree add ../wigfield-portfolio-dltt -b tmp/dltt-tricky-topics main`.
   - Run `npm install` there, and start its dev server on port **5184** (`npm run dev -- --port 5184`).
   - Point every check script at it (`SITE_URL`).
2. **Commit in your worktree** at sensible milestones: shell + topic engine · topic 1 · topics 2–4 · scaffold + doc · export · audit fixes · checks. Every commit must leave `npm run build` passing.
3. **At the end, merge into `main`:** `git merge --no-ff tmp/dltt-tricky-topics -m "Merge: Deep Learning Tricky Topics (parameter counts, shapes, softmax, stride)"`. Run it in the working tree that has `main` checked out (normally `C:\Users\james\Documents\personal-projects\wigfield-portfolio`).
   - **Only merge if that tree is clean**, apart from untracked `Documents/temp/` files and untracked deck PDFs.
   - **If it has someone else's uncommitted changes**, another instance is mid-build. **Wait and retry**: re-check about every 5 minutes for up to about 60 minutes (use a Monitor or an until-loop; don't spin), and merge as soon as it's clean. If it never comes clean, don't touch it, and put the exact merge command in the **first line** of your summary.
   - **Conflicts:** in `registry.js`, keep every entry. For any other conflict, run `git merge --abort` and report it in the first line of your summary.
4. **After merging:** run `npm run build` and your page check against a dev server serving `main`. If anything fails, fix it with a follow-up commit on `main`. Never force, reset or rewrite history.
5. **Clean up:** stop your dev server, then run `git worktree remove ../wigfield-portfolio-dltt` and `git branch -d tmp/dltt-tricky-topics`. Confirm with `git worktree list` and `git branch` that nothing from this build is left.
6. **Don't push.** End the summary with "`main` is N commits ahead of `origin/main`".

Don't commit anything from `Documents/temp/`. Only stage files you created or deliberately changed.

---

## Setup

- **Folder:** `src/components/portal/modules/deep-learning/tricky-topics/`.
  - CSS prefix: `.dltt-*`.
  - localStorage prefix: `dltt:` (per topic: `dltt:<topicId>:…`).
  - Print class: `html.dltt-printing`.
- **Registry:** add it directly after the `dl-exam-practice` entry:
  ```js
  { id: 'dl-tricky-topics', label: 'Tricky Topics', icon: 'notebook', group: 'Deep Learning', component: DeepLearningTrickyTopics },
  ```
  It will then be at `/portal/dl-tricky-topics`.
- **Suggested layout** (change it if you have a better one, but keep content as data, not JSX):
  - `TrickyTopics.jsx`: the hero, tab bar, deep links and topic loader;
  - `TopicShell.jsx`: rail, focus mode, opener, steps, drill, notebook pages;
  - the shared kit, copied from `lecture9-study/` and renamed: `stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`, `useWidth.js`, `stage.css`, `CodeCard.jsx`, `Rich.jsx`, `richToken.js`, `hooks.js`, `storage.js`, `context.js`, `ExportPdf.jsx`, `print.js`, `texText.js`;
  - `SheetPage.jsx` + `sheet.css` from `lectures1-2-refresher/`;
  - `Provenance.jsx` (the three labels);
  - `maths/` (`paramRules.js`, `shapeRules.js`, `softmax.js`, `strideRules.js`): shared, because topics use each other's maths;
  - `topics/index.js`, `topics/_template/`, `topics/param-count/`, `topics/shapes/`, `topics/softmax/`, `topics/stride/`;
  - `ADDING-A-TOPIC.md`.
- **Afterwards, grep the copies for leftovers:** `dl9s`, `dl12r`, RL role tokens, the Topic 9 hero, Lecture 9 prompts.
- **Tools:** create `tools/dl-tricky-topics/`. Copy `page-check.mjs`, `pdf.mjs` and `shot.mjs` from `tools/dl-lecture9-study/`, and set their default port to 5184.

---

## Export PDF and the NotebookLM prompt (per topic)

Copy Lecture 9's implementation and adapt it per topic, so new topics get it for free.
- **"Export PDF"** exports **the current topic**:
  - its opener, then every step's Read + Play, with labs in their finished state;
  - the drill as a short worked set with answers;
  - every formula with its plain-text twin (`texText.js`);
  - the provenance labels and Slide checks open.
- **Left out:** notebook pages, the tab bar and the chrome. Print on light paper, A4.
- **"NotebookLM video prompt ▾"**, directly under the button: that topic's prompt from `topics/<id>/exportPrompt.js`.
  - Each prompt is a short explainer for a student who finds the topic hard: start from zero, use the PDF's pictures, walk the worked examples, say clearly what's beyond the slides, and end with three self-test questions.
  - Offer one prompt per topic, plus a two-part variant for parameter counts.
  - Re-check NotebookLM's current Video Overview formats and any prompt limit with a web search. `exam-practice/exportPrompt.js` records the 2026-10-24 findings; reuse them if search isn't available, and say so. Keep each prompt under ~1,000 characters unless you confirm a higher limit.
- **Testing:** stub `window.print` before the page loads in every automated check, so a print dialog can't hang this unattended run. Then generate each topic's PDF headlessly and check with `pdftotext`:
  - every step title appears, in order;
  - every printed count matches `verify_counts.py`'s JSON;
  - no notebook text appears.

  Report each PDF's page count and size.

---

## Accuracy traps (verify each one; don't take my word for it)

- **Many counts in the unit are never printed.** Only present a count as the slide's if a slide prints it. Everything else is "this page's own", computed by `paramRules.js` and confirmed by `verify_counts.py`.
- **L3 slide 19's typo:** it says the output is `[2, 64, 114, 3]`, while slide 18's code prints `TensorShape([2, 64, 114, 32])`. Keep it as a Slide check; it's a lovely shapes lesson (the last axis is the filter count).
- **L3 slide 39 (AlexNet):** the table appears to skip a layer. S8 has 256 maps, while the conv below it, C6, has 384 (Géron's table has a C7 with 256 maps). Confirm from the image; add a Slide check; don't silently add C7. Its strides and sizes are still good stride examples.
- **L3 slide 37 (LeNet-5):** the slide doesn't say that the original C3 isn't fully connected or that its pooling layers have trainable coefficients. Use LeNet-5 for **shapes and strides only**. If you show any count, label it "this page's own, as if built in Keras".
- **GRU, L4 slide 49:** 1,401 is the slide's printed count (Keras's `reset_after=True`, two biases per gate). The slide's equations show one bias per gate, which would give 1,341. Show both and explain; never "fix" the slide.
- **L4 slides 21 vs 24:** the dataset's inputs are 2D `(32, 56)`, but the RNN expects 3D `[batch size, time steps, dimensionality]`, and no reshape is shown. Use it as a shapes trap, with a Slide check; don't present a reshape as the slides'.
- **L4 slide 50:** the sequence lengths 56 → 54 → 26 are derived, not stated.
- **Output-size formulas** for convolution, pooling and transposed convolution **aren't printed in the slides** (Exam Practice's coverage notes this too). Teach them as "beyond the slides", derived from L3 slide 9's index rule, and verify them in TF over a sweep. My sweep on a 7 × 7 input with k = 3 gave:

  | stride | 1 | 2 | 3 | 4 |
  |---|---|---|---|---|
  | `valid` | 5 | 3 | 2 | 2 |
  | `same` | 7 | 4 | 3 | 2 |

  The slides themselves state: `valid` gives "6 fewer pixels" for a 7 × 7 kernel (s20); stride > 1 shrinks even with `same` (s21); pooling strides default to the kernel size (s28).
- **L3 slide 21's Figure 14-8:** I counted 10 inputs, kernel 7, stride 2, `valid` → 2 outputs with the last input ignored, and `same` → 5 outputs with 2 zeros left and 3 right. Confirm it from a high-dpi crop before you recreate it.
- **Softmax:**
  - I couldn't find the exp/sum formula printed on any slide. L1 s29 only says the outputs "are probabilities and they sum to 1". Confirm; if it really isn't there, label the formula "beyond the slides".
  - **L8 slide 38's bullet says the factor is "1/d_keys", with no square root**, while its equation divides by √d_keys. It's already in `lecture-8.md`'s Quirks. Keep the equation, and add a Slide check.
  - "Sigmoid is a two-class softmax" is beyond the slides; label it.
  - L4 s9 calls softmax-with-cross-entropy an activation choice; cross-entropy is a loss. That's already a Quirk; keep it straight on the page.
- **Normalization:** 17 = 8 means + 8 variances + 1 count, all non-trainable (L1 s45). **BatchNormalization:** 4 per feature, 2 non-trainable (L2 s27). The DCGAN's BN layers make its generator's 384 non-trainable.
- **Stride never changes a parameter count**; image size never changes a conv count; time steps never change an RNN count. These three are what I get wrong, so make each visible in a lab.
- **MultiHeadAttention and Embedding counts aren't on the slides.** Leave them out, and list them in "Not on this page".
- Use the slides' notation and Keras names exactly (`filters`, `kernel_size`, `strides`, `padding="same"`, `return_sequences=True`, `d_keys`).

## Content rules
- **Accuracy over flair.** Intuition and analogies are welcome when they're true. New syllabus content isn't: label anything beyond the slides as such.
- Code is verbatim from the slides when it's the slides' (check it against the image); generated drill code says it's generated.
- Every "where it shows up" receipt points at a real slide.

## Design rules
- Same as the study modules: portal theme tokens; all three themes (Jade, Coral, Arcade/dark); pen colours tuned per theme (contrast of at least 4.5:1).
- No coloured left-border callouts and no filled pills (that includes the provenance labels, the lecture labels and the tabs).
- VS Code `Code` blocks; no emoji; everything keyboard-reachable; `prefers-reduced-motion` respected.
- It must work at laptop width, in fullscreen, and at 390 px wide with no horizontal page scroll.
- **Feel:** calm, editorial, and genuinely fun to poke at. Openers and labs should make me want to play.

---

## Subagents: use them for accuracy and for a fresh read, within a budget

Aim for about **8 agents**, with **10** as a hard ceiling.
- Use **fresh general-purpose agents, not forks**, so they aren't anchored on your reasoning.
- Give each one a self-contained brief: file paths, exactly what to return, and the output format.
- Launch independent agents in one message so they run in parallel.

| Phase | Agents | Job |
|---|---|---|
| Ground truth (start first) | **3 topic sourcers**: (1) parameter counts; (2) shapes + stride; (3) softmax | Sweep **all nine decks** (slides as images where maths, code or figures matter), the lab sheets, the sample paper and the Exam Practice papers for every appearance of their topic. Return a slide-receipted inventory: slide, verbatim quote, any number or shape printed, what it teaches, and any quirk. Also return a "most exam-likely" shortlist with reasons. Write to your scratchpad, not the repo |
| Build (optional) | **1 lab builder** | Only after you've built topic 1's first labs and fixed the visual vocabulary |
| Audit | **3 auditors**: (1) **accuracy**: blind first, it recomputes every count, shape, size and probability on the page from the slides *before* reading yours, then checks yours, the provenance labels and the Slide checks; (2) **learning + design**: screenshots of every topic in 3 themes × 1440/390, the five-second test for every opener and lab, the budgets, the saved preferences, "would a student who doesn't get softmax get it now?"; (3) **scalability**: given **only** `ADDING-A-TOPIC.md`, it scaffolds a throwaway topic in your worktree with `new-topic.mjs`, runs the checks, reports every unclear step or manual edit outside the topic folder, then deletes the throwaway topic | Verdicts: correct / wrong / misleading / confusing / overwhelming, with fixes |
| Re-audit | **1** | Only what changed |

Fix every **wrong**, **misleading**, **confusing** and **overwhelming** finding, or justify leaving it in the summary.

## Process

1. **Git check and orient** (see "Git").
   - Check the vault's project note, as the repo `CLAUDE.md` asks, and the dev logs listed above.
   - Read every file in `lecture9-study/` and the refresher's `SheetPage.jsx` and `sheet.css` yourself.
   - Start the three topic sourcers first, so they run while you read.
2. **Build the engine first:**
   - the topic list, lazy loading, tabs, deep links and the shell;
   - the provenance labels;
   - the measured notebook page;
   - the `_template` topic.

   Prove the engine by rendering `_template` as if it were a real topic.
3. **Build topic 1 (parameter counts) completely**, including its drill and both notebook pages.
   - Write `verify_counts.py` now and make it pass.
   - Screenshot it at 1440 and 390 in all three themes, and ask: is it easy? Is every lab readable in five seconds? Do the pages fit 30 rules?
   - Fix the format before going on.
4. **Build topics 2–4**, then the scaffold script, `ADDING-A-TOPIC.md`, the export and the prompts.
5. **Audit, fix, re-audit.**
6. **Verify** (below).
7. **Wrap-up, then finish on `main`** (see "Git").

## Verify

- **`tools/dl-tricky-topics/verify_counts.py`**, run in the **read-only** WSL env `tf-2.20-gpu`. Read `ENVIRONMENT_SETUP.md` first and **never install anything into that env**; the command is in `tools/dl-exam-practice/verify_counts.py`'s header. It:
  - builds every model the page shows and asserts the per-layer trainable and non-trainable counts and output shapes;
  - builds **~200 seeded drill models** exported from the drill generator (a JSON the JS writes) and compares them with `paramRules.js` / `shapeRules.js`;
  - sweeps Conv1D/Conv2D/pooling/Conv2DTranspose output sizes (n ≤ 40, k ≤ 7, s ≤ 4, both paddings) against `strideRules.js`;
  - checks `softmax.js` against `tf.nn.softmax`, including shift invariance.

  It writes `keras-truth.json`.
- **`check-maths.mjs`:** the JS rules against `keras-truth.json`; every number shown in any topic's data traces to a rule or a slide; provenance labels are present; every receipt is within its deck's slide count; and the budgets (Read words, steps per topic, controls per lab).
- **`page-check.mjs`**, iterating `topics/index.js`. Stub `window.print` before the page loads. It checks:
  - every topic renders via its deep link and its tab, and the last-visited topic reopens;
  - focus mode, ticks persisting across a reload, and "Resume at step N";
  - **every notebook page ≤ 30 rules at the reference width**;
  - pens, contrast and no handwriting font;
  - the page renders with localStorage throwing and with reduced motion;
  - keyboard operation of every lab and drill;
  - the stubbed export plus `afterprint`, and the NotebookLM dropdown;
  - 3 themes × 1440/390 with no page-level horizontal scroll;
  - **every other Deep Learning module in the registry still renders.**
- **Scalability proof:** run `new-topic.mjs` for a throwaway topic. Confirm the page and every check pick it up with no other edits, then delete it (and its `topics/index.js` line) before committing.
- **`pdf.mjs`:** each topic's PDF; render a few pages with `pdftoppm` and **look at them**.
- **Lint and build:** lint `tricky-topics/`, `registry.js` and `tools/dl-tricky-topics/` clean, and run `npm run build`.

## Wrap-up

- **Vault:**
  - create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`;
  - add the page to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`;
  - note how to add a topic.
- **Memory:** add one line to your auto-memory's Management Portal pointer, naming `ADDING-A-TOPIC.md` and `new-topic.mjs`.
- **Final summary:**
  - what was built, per topic: steps, labs, the drill, and each notebook page's measured height in rules;
  - every count, with its provenance, and confirmation that `verify_counts.py` passed;
  - every Slide check and "beyond the slides" label;
  - what you left out and why;
  - each PDF's page count and size;
  - **the NotebookLM prompts, pasted in full**;
  - **the ready-to-paste "add a topic" brief from `ADDING-A-TOPIC.md`, pasted in full**;
  - the scalability auditor's findings and what you changed;
  - decisions you made;
  - anything unverified;
  - the subagents used;
  - the final git state (`main` N commits ahead of `origin/main`, nothing left over).

### Known gotchas in this repo
- Bash heredocs, `python - <<EOF` and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- JSX attribute strings keep `\\` literally: use `text={'…'}`. `{…}` in JSX *text* is a parse error. A literal `$` in prose pairs with the next `$` as maths: write currency in words.
- Uppercase table heads reach into KaTeX (σ² became Σ²): maths wrappers must reset `text-transform`.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits. Files are CRLF (`core.autocrlf true`).
- Windows is case-insensitive: `labs/foo.js` and `labs/Foo.jsx` collide.
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks, timers or rAF), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-tricky-topics/`), not from a scratchpad folder.
- A lab that early-returns a loading state without its measured wrapper never gets a width from `useWidth(ref)`. Keep the measured element mounted in every branch.
- WSL from Git Bash needs `MSYS_NO_PATHCONV=1`; run TF on the CPU (`CUDA_VISIBLE_DEVICES=-1`).
- Port 8787 belongs to another project; 5173 and 5176–5182 are used by other builds.
