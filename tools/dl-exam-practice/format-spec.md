# CITS5017 exam format: the rulebook for the practice papers

Derived on 2026-10-24 from the two official sources, read as page images:

- **the exam note**: `Documents/temp/past-exam-info/exam-information.md` (quoted as *Note*);
- **the sample paper**: `Documents/temp/past-exam-info/sampleExam2026-s2.pdf`, 10 pages (quoted as *Sample p.N*).

The mid-semester test the note points to ("similar (in format) as those in the mid-semester test") isn't in the repo, so the sample paper is the format reference. Practice papers A and B are written to this file, and the question validators check them against it.

---

## 1. Paper structure

| | Sample paper | Real exam (and practice papers A, B) |
|---|---|---|
| Questions | 2 | **4** (*Note*: "The exam paper contains 4 questions") |
| Marks per question | 20 | **20** (*Note*: "Each question is worth 20 marks") |
| Total | 40 | **80** (*Note*: "The total mark is **80**") |
| Time | (none given) | **2 hours** (*Note*: "The duration of the exam is: **2 hours**") |
| Book | | **closed book**; "1 UWA approved calculator with sticker" (*Note*; *Sample p.1*) |
| Choice | | none: "**You should attempt all the questions.**" (*Note*); "Candidate should attempt ALL questions." (*Sample p.1*) |

**Minutes per mark: 120 min / 80 marks = 1.5 minutes per mark.** A 1-mark part is about 90 seconds of writing; a 6-mark part about 9 minutes; a 20-mark question about 30 minutes.

Pages: a title page (p.1), the questions (each page carries one to two parts), then **two blank ruled pages** "for extra writing if needed" (*Sample pp.9–10*; *Note*: "use the two extra pages at the end of the exam paper"). The last page ends with a rule broken by "END OF EXAMINATION PAPER" (*Sample p.10*). The sample is 10 pages for 2 questions; a 4-question paper runs to about 16–18 pages.

## 2. Question structure

*Note*: "Each question will consist of parts and sometimes subparts. … You should see the mark for each part (or each subpart)."

| | Sample Q1 | Sample Q2 |
|---|---|---|
| Parts | (a) 4 · (b) 4 · (c) 6 · (d) 3 · (e) [i. 2, ii. 1] = 3 | (a) [i. 1, ii. 1, iii. 2] = 4 · (b) 5 · (c) 4 · (d) 4 · (e) 3 |
| Count | 5 parts, 2 subparts | 5 parts, 3 subparts |

- **5 parts per question, (a)–(e)**, summing to exactly 20. A practice question may use 4–6 parts, but 5 is the norm.
- **Marks per part: 3–6.** Subparts: **1–2 marks each**. No part above 6 marks; no stand-alone part below 3 marks.
- **Subparts (i., ii., iii.)** appear only when **one stimulus serves several asks**: the gated-module diagram (Q1(e)) and the star scenario (Q2(a)). The stimulus and its sentence ("Based on the given diagram,") come first, then the subparts, each with **its own mark** right-aligned; the part carries **no separate total**. All subparts share **one ruled answer space below the last subpart**.
- Marks are printed as "(4 marks)" or "(1 mark)", right-aligned on the last line of the prompt.

## 3. Topic mix and order

- **A question mixes several lectures.** Sample Q1 = L3, L3, L1, L2, L4 (conv layers, CNN advantages, functional-API model, gradient descent, a gated module). Sample Q2 = L4, L6–7, L8, L9, L9 (RNN sequence design, VAEs, transformers, Markov chains/MDPs, value iteration).
- **Order across the paper roughly follows the lectures**: Q1 draws on the early topics (L1–L4), Q2 on the later ones (L4–L9). Inside a question the order is loose (Q1 goes L3 → L1 → L2 → L4).
- **Every lecture is fair game** (*Note*: "covers **all the topics (1 to 9), including lab exericises and the two projects**"), but only what the slides cover (*Note*: "Sections in the textbook that are not covered in the lecture notes won't be examined.").
- **A lab or project can flavour a scenario.** The star question (*Sample p.6*) is Lab Sheet 4's star sequences (shape `(200, 4, 2)`); the answer still comes from the lecture slides.
- For a 4-question paper: Q1 ≈ L1–L3, Q2 ≈ L3–L4 (+ L5), Q3 ≈ L5–L6/7 (+ L8), Q4 ≈ L8–L9, each still mixing 3–5 lectures.

## 4. Stimulus types and what is asked of each

| Stimulus | Sample instance | What is asked |
|---|---|---|
| **Given Keras code** (functional API, 4 layer objects then their calls, then `tf.keras.Model`) | Q1(c) | **draw** the architecture, **compute** trainable parameters per layer and in total, **say what problem** it suits |
| **Given equation** (an update rule, an algorithm) | Q1(d) gradient descent; Q2(e) value iteration | **explain what each term means**, and how the method works / what it is used for |
| **Given diagram** (a small module with a legend) | Q1(e) gated FC module | **write down the equations** for each node, then the output; **state the ranges** of values |
| **Scenario with figures** (a data set described in words + sketches) | Q2(a) hand-sketched stars | **shapes** of X and y, a suitable **loss** (briefly explain), **how to set up** the layers for a variant |
| **No stimulus: recall + explain** | Q1(a), Q1(b), Q2(b), Q2(c), Q2(d) | explain what is involved / list two advantages / what are … and how to train them + an application / list two components and explain each / define + two differences |

Calculations are calculator-friendly integer arithmetic (Q1(c): 10 × 20 + 20 = 220; 30 × 3 + 3 = 93). Practice papers may add the same kind: parameter counts, output shapes, a discounted return, one value- or Q-value-iteration step, attention shapes.

## 5. Command words, marks and depth

*Note*: "Use the mark given to each part as a guide to assess how long/deep your answer should be. Words such as "briefly explain" or "explain" also give you an idea how long/deep your answer is expected to be."

| Command | Sample use | Depth expected |
|---|---|---|
| **briefly explain** (1 mark) | Q2(a) i., ii. | a phrase or one sentence of reason after the answer |
| **briefly explain** (3–5 marks) | Q1(d), Q2(b) | one sentence per term or idea; roughly one mark per idea |
| **explain** | Q1(a) (4), Q2(a) iii. (2) | full sentences with the reasoning; the listed items (e.g. "the parameters that define the layer") each carry marks |
| **list two … and briefly explain each** | Q1(b) (4), Q2(c) (4) | 2 items × (name 1 + explanation 1) |
| **what are … ? what are the two differences** | Q2(d) (4) | definition (1–2) + one mark per difference |
| **draw a diagram** | Q1(c) | a labelled box-and-arrow sketch with shapes; ~2 marks |
| **compute** | Q1(c) | working shown, per-layer then total; ~1 mark per layer |
| **write down the equations** | Q1(e) i. (2) | the equations only, in the diagram's notation |
| **what are the ranges** | Q1(e) ii. (1) | intervals, no prose |
| **briefly state** | Q2(e) (3) | a phrase per item |
| **give an application** | Q2(b) | one concrete example (1 mark) |

Rule of thumb: **one mark ≈ one distinct, correct point**, and 1.5 minutes of writing.

## 6. What is never asked

- *Note*: "There won't any large block of Python coding in any questions. Instead, you are likely to be given a block of code and you need to draw a diagram or give explanation." So: **no "write the code" parts**. Code appears only as a **given stimulus** (≤ about 15 lines, like Q1(c)'s 12).
- No multiple choice, no true/false, no essay questions (no part above 6 marks).
- Nothing outside the slides (*Note*: textbook-only sections "won't be examined"), and nothing a slide marks as not examined (e.g. L8 slide 47 onward; L2 slide 66's alpha dropout, "not covered in CITS5017").
- No derivations or proofs; equations are given to be explained, or written for a small given diagram.
- No questions that need a computer (calculator only).

## 7. Typesetting and layout (reproduced on screen and in print)

- **Face:** LaTeX article (Computer Modern / Times-like serif). On screen: KaTeX's bundled `KaTeX_Main`, falling back to a serif stack.
- **Running head** on every page after the title page: small caps "SAMPLE EXAM PAPER 2026" on the left, "CITS5017 Deep Learning" on the right, above a full-width rule. **Footer:** "Page N of M", right-aligned.
- **Question heading:** "**Question 1.** (20 marks)", bold "Question 1." then the marks in plain type.
- **Parts:** hanging labels "(a)" with the text indented; subparts "i.", "ii.", "iii." right-aligned in a narrower hanging column.
- **Marks** right-aligned at the end of the prompt's last line, in parentheses: "(4 marks)", "(1 mark)". When the prompt fills the line, the marks drop to their own line, right-aligned (Q1(b), Q2(a) ii.).
- **Maths:** bold vectors and parameter vectors (**θ**, **x**₍ₜ₎, **g**₍ₜ₎, **z**₍ₜ₎), time-step subscripts in parentheses (₍ₜ₎), italic scalars (η, γ, J, T, R, V_k), primes for the next state (s′). Display equations centred on their own line (Q1(d), Q2(e)).
- **Italic key terms:** *variational autoencoders*, *transformer*, *Markov chains*, *Markov decision processes*, *value iteration algorithm*.
- **Code:** a typewriter face, indented as a block, no line numbers, no frame (Q1(c)). This page prints it in VS Code's Light+ palette on the paper.
- **Figures:** centred line art in black, with red only where the question needs it (the corner to predict, Q2(a)); a legend at the side (Q1(e)).
- **Answer space:** grey ruled lines spanning the text width below each part (or below the last subpart). The sample's counts: Q1 (a) 11 · (b) 10 · (c) 16 · (d) 20 · (e) 14; Q2 (a) 11 · (b) 10 · (c) 10 · (d) 10 · (e) 9. That is **about 2.5–3 lines per mark with a floor of about 9**, plus extra space where a part ends a page (*Note*: "sometimes extra spaces are reserved for short questions when there is not enough space to fit the next part of the question on the same page"); Q1(d) gets 20 lines for 3 marks for exactly that reason.
- **Practice papers use:** lines = max(9, round(2.7 × marks)), plus 3–5 lines for any part that asks for a drawing, plus page-end padding where a part closes its page.

## 8. Checklist for every practice question (the validators use this)

1. Five parts (a)–(e) (4–6 allowed), marks 3–6 per part, subparts 1–2 each, **summing to 20**.
2. At least one stimulus part per question (code, equation, diagram or scenario); across a paper at least one of each of: given code → draw/count, given equation → explain each term, given diagram → write equations, scenario → shapes/loss/setup.
3. Command words from §5, depth matching the marks.
4. Mixes 3–5 lectures; questions ordered roughly by lecture across the paper; **every lecture (1, 2, 3, 4, 5, 6–7, 8, 9) appears in each paper**.
5. Answerable from the slides alone, in the slides' notation; nothing marked not examined; no code writing.
6. One clear expected answer per part; calculations need only a calculator.
7. Doesn't repeat any sample part's actual ask (a new *instance* of a sample *type* is fine).
