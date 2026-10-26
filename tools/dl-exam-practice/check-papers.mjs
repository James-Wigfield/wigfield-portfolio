/* ============================================================================
   DL EXAM PRACTICE — data integrity of the four papers
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/check-papers.mjs

   Reads the page's own data (src/…/exam-practice/papers) and checks:
     structure   the sample has 2 questions, A, B and C have 4; part labels run
                 (a), (b), … and subparts i., ii., …; ids are unique and follow
                 <paper>-q<n>-<letter>[-<roman>]; pages climb and fit the paper
     marks       every question's parts sum to 20; every leaf's red ticks sum
                 to its marks; ruled lines ≥ 9
     topics      every leaf cites ≥ 1 lecture, with slide ranges inside that
                 deck (L1 64 · L2 68 · L3 53 · L4 52 · L5 27 · L6–7 32 ·
                 L8 51 · L9 69) and nothing from L8 slides 47–51
     answers     every leaf has a model answer, a difficulty 1–5 and a
                 likelihood high/medium/low; source is 'sample' / 'new'
     coverage    every lecture appears in each practice paper, and
                 coverage.md's matrix matches the data exactly
     verbatim    the sample's prompts match sample-verbatim.txt (an independent
                 transcription from the PDF's page images)
     figures     every figure key exists in figures.jsx
     maths       every TeX string's plain-text twin has no stray backslash
     NotebookLM  every part the prompt picks exists and is named verbatim
   Exits 1 on any failure.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '../..');
const MOD = path.join(ROOT, 'src/components/portal/modules/deep-learning/exam-practice');
const imp = (p) => import(pathToFileURL(path.join(MOD, p)).href);
const { PAPERS, leavesOf, paperLeaves, questionMarks, answerTicks, leafLabel, leafLectures } = await imp('papers/index.js');
const { LEC, LECTURES } = await imp('papers/lectures.js');
const { plainText } = await imp('plain.js');
const { texText } = await imp('texText.js');
const { NLM_PICKS, NLM_PROMPT } = await imp('exportPrompt.js');

let fails = 0;
let checks = 0;
const ok = (cond, msg) => {
  checks += 1;
  if (!cond) {
    fails += 1;
    console.log(`FAIL ${msg}`);
  }
};
const LETTERS = 'abcdefgh';
const ROMAN = ['i.', 'ii.', 'iii.', 'iv.', 'v.'];
const ROMAN_ID = ['i', 'ii', 'iii', 'iv', 'v'];

// ── structure, marks, topics, answers ──────────────────────────────────────
const ids = new Set();
const figKeys = new Set([...fs.readFileSync(path.join(MOD, 'figures.jsx'), 'utf8').matchAll(/^\s+(\w+): \w+,$/gm)].map((m) => m[1]));
const allTex = [];
const collectTex = (text) => [...String(text).matchAll(/\$([^$]+)\$/g)].forEach((m) => allTex.push(m[1]));

for (const paper of PAPERS) {
  const want = paper.id === 'sample' ? 2 : 4;
  ok(paper.questions.length === want, `${paper.name}: ${paper.questions.length} questions (want ${want})`);
  const prefix = paper.id === 'sample' ? 's' : paper.id.toLowerCase();
  let lastPage = 1;
  paper.questions.forEach((q, qi) => {
    ok(q.n === qi + 1, `${paper.name} question numbering at ${q.id}`);
    ok(q.id === `${prefix}-q${q.n}`, `${q.id}: id should be ${prefix}-q${q.n}`);
    ok(questionMarks(q) === 20, `${q.id}: parts sum to ${questionMarks(q)} (want 20)`);
    q.parts.forEach((p, pi) => {
      ok(p.label === `(${LETTERS[pi]})`, `${p.id}: label ${p.label} (want (${LETTERS[pi]}))`);
      ok(p.id === `${q.id}-${LETTERS[pi]}`, `${p.id}: id should be ${q.id}-${LETTERS[pi]}`);
      ok(!ids.has(p.id), `${p.id}: duplicate id`);
      ids.add(p.id);
      ok(Number.isInteger(p.page) && p.page >= lastPage && p.page >= 2 && p.page <= paper.pages - 2, `${p.id}: page ${p.page} out of order or outside 2…${paper.pages - 2}`);
      lastPage = p.page;
      ok(Number.isInteger(p.lines) && p.lines >= 9, `${p.id}: ${p.lines} ruled lines (want ≥ 9)`);
      p.prompt.forEach((b) => {
        if (typeof b === 'string') collectTex(b);
        else if (b.eq) allTex.push(b.eq);
        else if (b.fig) ok(figKeys.has(b.fig), `${p.id}: figure "${b.fig}" missing from figures.jsx`);
        else if (b.table) b.table.head.concat(...b.table.rows).forEach(collectTex);
      });
      if (p.subs) {
        ok(p.marks === undefined, `${p.id}: a part with subparts carries no marks of its own`);
        p.subs.forEach((s, si) => {
          ok(s.label === ROMAN[si], `${s.id}: label ${s.label} (want ${ROMAN[si]})`);
          ok(s.id === `${p.id}-${ROMAN_ID[si]}`, `${s.id}: id should be ${p.id}-${ROMAN_ID[si]}`);
          ok(!ids.has(s.id), `${s.id}: duplicate id`);
          ids.add(s.id);
          ok(s.marks >= 1 && s.marks <= 3, `${s.id}: subpart marks ${s.marks}`);
        });
      } else ok(p.marks >= 3 && p.marks <= 6, `${p.id}: part marks ${p.marks} outside 3–6`);
    });
  });
  for (const leaf of paperLeaves(paper)) {
    const id = leaf.id;
    ok(leaf.source === (paper.id === 'sample' ? 'sample' : 'new'), `${id}: source ${leaf.source}`);
    ok(Array.isArray(leaf.topics) && leaf.topics.length > 0, `${id}: no topics`);
    for (const t of leaf.topics || []) {
      const lec = LEC[t.lec];
      const [a, b] = Array.isArray(t.slides) ? t.slides : [t.slides, t.slides];
      ok(!!lec, `${id}: unknown lecture ${t.lec}`);
      ok(lec && Number.isInteger(a) && Number.isInteger(b) && a >= 1 && a <= b && b <= lec.slides, `${id}: ${t.lec} slides ${a}–${b} outside 1–${lec?.slides}`);
      ok(!(t.lec === 'L8' && b >= 47), `${id}: cites L8 slides 47+ (not examined)`);
      ok(typeof t.name === 'string' && t.name.length > 2, `${id}: topic without a name`);
    }
    ok(Array.isArray(leaf.answer) && leaf.answer.length > 0, `${id}: no model answer`);
    ok(answerTicks(leaf.answer) === leaf.marks, `${id}: ticks sum to ${answerTicks(leaf.answer)} (marks ${leaf.marks})`);
    ok(Number.isInteger(leaf.difficulty) && leaf.difficulty >= 1 && leaf.difficulty <= 5, `${id}: difficulty ${leaf.difficulty}`);
    ok(['high', 'medium', 'low'].includes(leaf.likelihood), `${id}: likelihood ${leaf.likelihood}`);
    leaf.prompt.forEach((b) => (typeof b === 'string' ? collectTex(b) : b.eq && allTex.push(b.eq)));
    (leaf.answer || []).forEach((b) => {
      if (b.t === 'eq') allTex.push(b.tex);
      if (b.t === 'w' || b.t === 'h' || b.t === 'slip') collectTex(b.text);
      if (b.t === 'ul') b.items.forEach((it) => collectTex(it.text));
      if (b.t === 'tbl') b.head.concat(...b.rows).forEach(collectTex);
      if (b.t === 'fig') {
        ok(figKeys.has(b.key), `${id}: answer figure "${b.key}" missing from figures.jsx`);
        ok(typeof b.desc === 'string' && b.desc.length > 20, `${id}: answer figure without a printed description`);
      }
    });
  }
}

// ── maths twins ─────────────────────────────────────────────────────────────
for (const tex of allTex) {
  const twin = texText(tex);
  ok(!/\\/.test(twin), `texText leaves a backslash: ${tex} → ${twin}`);
}

// ── coverage: every lecture in each practice paper; coverage.md matches ────
const codeOf = { L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4', L5: 'L5', 'L6–7': 'L67', L8: 'L8', L9: 'L9' };
const leafKey = (q, l) => `Q${q.n}${l.parent ? `${l.parent.label} ${l.label}` : l.label}`;
const derived = {};
for (const paper of PAPERS) {
  derived[paper.id] = Object.fromEntries(LECTURES.map((L) => [L.code, new Set()]));
  for (const q of paper.questions) {
    for (const l of leavesOf(q)) for (const c of leafLectures(l)) derived[paper.id][c].add(leafKey(q, l));
  }
  if (paper.id !== 'sample') LECTURES.forEach((L) => ok(derived[paper.id][L.code].size > 0, `${paper.name}: no part on ${L.label}`));
}
const cov = fs.readFileSync(path.join(HERE, 'coverage.md'), 'utf8');
const matrix = cov.split('## Matrix')[1]?.split('\n## ')[0] ?? '';
const rows = matrix.split('\n').filter((r) => codeOf[r.split('|')[1]?.trim()]);
ok(rows.length === 8, `coverage.md matrix has ${rows.length} lecture rows (want 8)`);
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map((c) => c.trim());
  const code = codeOf[cells[0]];
  ['sample', 'A', 'B', 'C'].forEach((pid, k) => {
    const listed = new Set(cells[k + 1] === '—' ? [] : cells[k + 1].split(/,\s*/).map((s) => s.trim()).filter(Boolean));
    const have = derived[pid][code];
    const missing = [...have].filter((x) => !listed.has(x));
    const extra = [...listed].filter((x) => !have.has(x));
    ok(missing.length === 0 && extra.length === 0, `coverage.md ${cells[0]} / ${pid}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  });
}

// ── the sample's text is verbatim ──────────────────────────────────────────
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const verb = fs.readFileSync(path.join(HERE, 'sample-verbatim.txt'), 'utf8').replace(/\r/g, '');
const blocks = Object.fromEntries(verb.split(/^## /m).slice(1).map((b) => {
  const [id, ...rest] = b.split('\n');
  return [id.trim(), norm(rest.join('\n'))];
}));
const sample = PAPERS.find((p) => p.id === 'sample');
const promptPlain = (prompt) => norm(prompt.map((b) => {
  if (typeof b === 'string') return plainText(b);
  if (b.code) return b.code.split('\n').filter((l) => l.trim()).join('\n');
  if (b.eq) return texText(b.eq);
  return '';
}).filter(Boolean).join('\n'));
let compared = 0;
for (const q of sample.questions) {
  for (const p of q.parts) {
    for (const unit of [p, ...(p.subs ?? [])]) {
      const want = blocks[unit.id];
      ok(want !== undefined, `sample-verbatim.txt has no block for ${unit.id}`);
      if (want === undefined) continue;
      const got = promptPlain(unit.prompt);
      compared += 1;
      // words must match exactly; maths only up to notation (V_k+1 = Vₖ₊₁, spacing)
      const canon = (s) => s.normalize('NFKC').replace(/[\s_^]/g, '');
      ok(canon(got) === canon(want), `${unit.id}: prompt differs from the transcription\n   page: ${got}\n   PDF:  ${want}`);
    }
  }
}
ok(compared === Object.keys(blocks).length, `sample-verbatim.txt has ${Object.keys(blocks).length} blocks, compared ${compared}`);

// ── NotebookLM picks ────────────────────────────────────────────────────────
const leafById = {};
for (const paper of PAPERS) for (const l of paperLeaves(paper)) leafById[l.id] = { paper, l };
ok(NLM_PICKS.length >= 4 && NLM_PICKS.length <= 6, `NotebookLM picks: ${NLM_PICKS.length} (want 4–6)`);
for (const pick of NLM_PICKS) {
  const hit = leafById[pick.id];
  ok(!!hit, `NotebookLM pick ${pick.id} does not exist`);
  if (!hit) continue;
  const label = leafLabel(hit.paper, hit.l.question, hit.l);
  ok(NLM_PROMPT.includes(label), `NotebookLM prompt doesn't name "${label}" verbatim`);
  ok((hit.l.answer || []).some((b) => b.t === 'slip'), `NotebookLM pick ${pick.id} prints no "Common slip:" line (the prompt asks for it)`);
}

console.log(`${checks - fails}/${checks} checks passed${fails ? ` · ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);
