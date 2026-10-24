import { SAMPLE } from './sample.js';
import { PAPER_A } from './paperA.js';
import { PAPER_B } from './paperB.js';
import { LEC, topicReceipt } from './lectures.js';

/* ============================================================================
   EXAM PRACTICE — THE PAPERS (schema, builders, derived facts)
   ----------------------------------------------------------------------------
   Content is data. One file per paper (sample.js, paperA.js, paperB.js); the
   page, the PDF and the checks (tools/dl-exam-practice/check-papers.mjs) all
   read it from here.

   Paper
     id         'sample' | 'A' | 'B'          (storage keys use it)
     name       'Sample Paper'                (prefix of every printed label)
     tab        'Sample paper'                (the top tab)
     head       'Sample Exam Paper 2026'      (the small-caps running head)
     pages      M in "Page N of M" (title page and the two blank pages count)
     cover      { contains, instructions: Rich[], materials: Rich[], note? }
     questions  Question[]

   Question     { id, n, parts: Part[] }      parts sum to 20 marks

   Part (a "leaf" when it has no subs)
     id         stable, e.g. 's-q1-c', 'a-q3-e-ii'
     label      '(a)' … ; subparts 'i.' 'ii.' 'iii.'
     page       the sheet it sits on (the sample keeps the PDF's own pages)
     lines      ruled answer lines (a part with subs: the shared space)
     prompt     Block[]: a Rich string, { code }, { eq }, { fig }
     marks      leaf only (a part with subs: the sum of its subs)
     topics     [{ lec: 'L3', slides: [7, 13], name: 'Convolutional layers' }]
     answer     Ink[] (below), leaf only
     receipt    optional override of the grey slide receipt
     difficulty 1–5 and likelihood 'high' | 'medium' | 'low' (validators)
     source     'sample' | 'new'
     subs       optional Part[]: one stimulus, several asks, one shared space

   Ink (the handwritten answer; `m` = the marks a marker ticks for it, and
   every leaf's ticks add up to its marks)
     w(text, m)          a line or short paragraph, Patrick Hand
     h(text)             a Caveat heading ("(i)", "Per layer")
     eq(tex, m)          a formula in ink (KaTeX, plain-text twin in print)
     ul([text | [text, m]])   a handwritten list
     tbl(head, rows, m)  a small table; cells are Rich strings
     fig(key, desc, m)   a hand-drawn SVG from ../figures.jsx + its one-line
                         description (printed, so the PDF text knows it)
     slip(text)          the one quiet "Common slip:" line, grey
   ========================================================================== */

export { w, h, eq, ul, tbl, fig, slip } from './ink.js';

export const PAPERS = [SAMPLE, PAPER_A, PAPER_B];
export const PAPER = Object.fromEntries(PAPERS.map((p) => [p.id, p]));

// the markable units of a question, in order (a part, or each of its subs)
export function leavesOf(question) {
  return question.parts.flatMap((p) => (p.subs ? p.subs.map((s) => ({ ...s, parent: p })) : [{ ...p, parent: null }]));
}
export function paperLeaves(paper) {
  return paper.questions.flatMap((q) => leavesOf(q).map((l) => ({ ...l, question: q })));
}

export const partMarks = (p) => (p.subs ? p.subs.reduce((a, s) => a + s.marks, 0) : p.marks);
export const questionMarks = (q) => q.parts.reduce((a, p) => a + partMarks(p), 0);
export const paperMarks = (paper) => paper.questions.reduce((a, q) => a + questionMarks(q), 0);

// ticks a marker would give for one ink block / a whole answer
export function inkMarks(block) {
  if (block.t === 'ul') return block.items.reduce((a, it) => a + (it.m || 0), 0);
  return block.m || 0;
}
export const answerTicks = (answer) => (answer || []).reduce((a, b) => a + inkMarks(b), 0);

// "Practice Paper A · Question 3 (c)" / "Sample Paper · Question 2 (a) iii." —
// the exact label printed in the PDF and named by the NotebookLM prompt
export function leafLabel(paper, question, leaf) {
  const part = leaf.parent ? `${leaf.parent.label} ${leaf.label}` : leaf.label;
  return `${paper.name} · Question ${question.n} ${part}`;
}

// every lecture a question touches, first appearance first
export function questionTopics(question) {
  const seen = new Map();
  leavesOf(question).forEach((l) => l.topics.forEach((t) => {
    const k = `${t.lec}|${t.name}`;
    if (!seen.has(k)) seen.set(k, t);
  }));
  return [...seen.values()];
}

export const leafLectures = (leaf) => [...new Set(leaf.topics.map((t) => t.lec))];
export const partLectures = (part) => [...new Set((part.subs ?? [part]).flatMap((s) => s.topics.map((t) => t.lec)))];

// the grey receipt under an answer: "L1 · slides 43–45 · L2 · slide 66"
export function receiptOf(leaf) {
  if (leaf.receipt) return leaf.receipt;
  const seen = new Set();
  return leaf.topics.map(topicReceipt).filter((r) => (seen.has(r) ? false : seen.add(r))).join(' · ');
}

export const lectureLabel = (code) => LEC[code]?.label ?? code;
