/* ============================================================================
   DL CODE LAB — data integrity of the cards
   ----------------------------------------------------------------------------
     node tools/dl-codelab/check-cards.mjs

   Checks the page's own data (src/…/codelab):
     · schema: required fields, unique ids and labels, ratings, provenance,
       sources, spec / cross-link / panel references
     · every budget: 10–12 tabs, ≤ 5 cards a tab (Labs & Projects ≤ 10),
       ≤ 40 cards, ≤ 16 lines a panel, why ≤ 25 words, ≤ 4 marks of ≤ 20
       words, exam move + what's it for ≤ 60 words, panel goals ≤ 30 words,
       check lines ≤ 50 words
     · marks: line ranges exist, tokens occur on their lines, numbered 1…n
       in line order
     · the print image never wraps a code line mid-word (panelImage.js)
     · slide receipts within each deck's slide count
     · verbatim: lecture cards against tools/dl-codelab/slides-verbatim (each
       kept line exact and in order, a '# …' line at every gap where non-blank
       lines were dropped, "verbatim" = whole blocks with no gaps); project
       cards against my notebooks' code cells; the Géron card against
       Géron's notebook; panel quotes against the notebooks' saved outputs
     · counts.js against tools/dl-codelab/keras-counts.json (written by
       verify_counts.py in TensorFlow), layer by layer
     · the NotebookLM prompts: the picks exist, are core, span ≥ 5 lectures,
       ≥ 2 Count it and ≥ 2 Draw it, are named verbatim, ≲ 1,000 characters
     · inventory.md: every card is there, every candidate a card draws on is
       there and not rated cut
   Prints one line per failure and a summary; exits 1 on any failure.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/codelab');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);
const { CARDS, CARD_BY_ID, fullLabel, words } = await imp('cards/index.js');
const { SECTIONS } = await imp('sections.js');
const { SPECS } = await imp('specs.js');
const { flow } = await imp('counts.js');
const { codeLines, tokenSpan } = await imp('panelModel.js');
const { LAB_PANELS } = await imp('labsProjects.js');
const { layoutPanel } = await imp('panelImage.js');
const { NLM_PROMPT, NLM_PARTS, NLM_PICKS } = await imp('exportPrompt.js');

const UNI = 'C:/Users/james/Documents/university/cits5017';
const NOTEBOOKS = {
  p1: `${UNI}/cits5017-project-1/Wigfield_James-proj1.ipynb`,
  p2: `${UNI}/cits5017-project-two/Wigfield_James-proj2.ipynb`,
  g10: `${UNI}/handson-ml3/10_neural_nets_with_keras.ipynb`,
  g11: `${UNI}/handson-ml3/11_training_deep_neural_networks.ipynb`,
};
const DECK_SLIDES = { 1: 64, 2: 68, 3: 53, 4: 52, 5: 27, 6: 32, 7: 32, 8: 51, 9: 69 };
const DECK_FILE = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6-7', 7: 'L6-7', 8: 'L8', 9: 'L9' };

let checks = 0;
const fails = [];
const ok = (cond, label) => {
  checks += 1;
  if (!cond) {
    fails.push(label);
    console.log(`FAIL ${label}`);
  }
};

const ELISION = /^\s*# …\s*$/;
const isBlank = (l) => l.trim() === '';

// ── sources of verbatim text ────────────────────────────────────────────────
const blocks = {};
fs.readdirSync(path.join(HERE, 'slides-verbatim')).forEach((f) => {
  const lines = fs.readFileSync(path.join(HERE, 'slides-verbatim', f), 'utf8').replace(/\r/g, '').split('\n');
  let cur = null;
  lines.forEach((l) => {
    const m = /^=== (L\d(?:-7)? s\d+(?: #\d+)?|Lab4 [^=]+) ===$/.exec(l);
    if (m) {
      cur = m[1];
      blocks[cur] = [];
    } else if (cur) blocks[cur].push(l);
  });
});
Object.values(blocks).forEach((b) => { while (b.length && isBlank(b[b.length - 1])) b.pop(); });

const nbCache = {};
function notebook(key) {
  if (!nbCache[key]) {
    const nb = JSON.parse(fs.readFileSync(NOTEBOOKS[key], 'utf8'));
    const cells = nb.cells.filter((c) => c.cell_type === 'code').map((c) => (Array.isArray(c.source) ? c.source.join('') : c.source).replace(/\r/g, '').split('\n'));
    const outputs = nb.cells.flatMap((c) => (c.outputs || []).map((o) => (o.text ? [].concat(o.text).join('') : [].concat(o.data?.['text/plain'] || []).join('')))).join('\n').replace(/\x1b\[[0-9;]*m/g, '');
    nbCache[key] = { cells, outputs };
  }
  return nbCache[key];
}

// Each kept line, in order, within the listed sources (arrays of lines);
// a jump over non-blank lines needs a '# …' line between the two kept lines.
function checkVerbatim(card, sources, label) {
  const kept = codeLines(card.code);
  let s = 0; // source index
  let i = -1; // line index in that source
  let sawElision = false;
  kept.forEach((line, k) => {
    if (ELISION.test(line)) { sawElision = true; return; }
    if (isBlank(line)) return;
    // find the line at or after the current position
    // a card's `rejoined` lines join a slide line with the next one (a wrapped comment)
    const join = (card.rejoined || []).includes(k + 1);
    let fs2 = s;
    let fi = -1;
    for (; fs2 < sources.length; fs2 += 1) {
      const src = sources[fs2];
      const start = fs2 === s ? i + 1 : 0;
      fi = src.findIndex((l, j) => j >= start && (join ? `${l} ${(src[j + 1] || '').trim()}` === line : l === line));
      if (fi >= 0) break;
    }
    if (fi < 0) {
      ok(false, `${label}: line ${k + 1} not found in order in its source: ${JSON.stringify(line)}`);
      return;
    }
    // what was skipped since the last kept line?
    const skipped = [];
    if (fs2 === s) skipped.push(...sources[s].slice(i + 1, fi));
    else {
      if (i >= 0) skipped.push(...sources[s].slice(i + 1));
      skipped.push(...sources[fs2].slice(0, fi));
    }
    const first = i < 0; // nothing kept yet: a leading trim
    if (!first && skipped.some((l) => !isBlank(l)) && !sawElision) {
      ok(false, `${label}: line ${k + 1} follows dropped lines with no '# …' before it`);
    }
    s = fs2;
    i = join ? fi + 1 : fi;
    sawElision = false;
  });
}

// ── tabs and budgets ────────────────────────────────────────────────────────
ok(SECTIONS.length >= 10 && SECTIONS.length <= 12, `10–12 tabs (${SECTIONS.length})`);
ok(CARDS.length <= 40, `≤ 40 cards (${CARDS.length})`);
SECTIONS.forEach((s, i) => {
  ok(s.n === i + 1, `tab ${s.id} is numbered ${i + 1}`);
  const n = CARDS.filter((c) => c.section === s.id).length;
  ok(n >= 1 && n <= (s.id === 'labs' ? 10 : 5), `tab ${s.id}: ${n} cards within its budget`);
});
ok(new Set(CARDS.map((c) => c.id)).size === CARDS.length, 'card ids are unique');
ok(new Set(CARDS.map((c) => c.label)).size === CARDS.length, 'card labels are unique');

// ── every card ──────────────────────────────────────────────────────────────
const LECTURES = new Set();
CARDS.forEach((c) => {
  const L = c.label;
  ok(/^[a-z0-9-]+$/.test(c.id), `${L}: id is a slug`);
  ['title', 'why', 'file', 'code', 'provenance'].forEach((k) => ok(typeof c[k] === 'string' && c[k].length > 0, `${L}: has ${k}`));
  ok(['core', 'useful'].includes(c.rating), `${L}: rating core/useful`);
  ok(['verbatim', 'trimmed', 'reconstructed', 'notebook', 'geron'].includes(c.provenance), `${L}: provenance is known`);
  ok(Array.isArray(c.sources) && c.sources.length > 0, `${L}: has sources`);
  ok(Array.isArray(c.inv) && c.inv.length > 0, `${L}: lists its inventory candidates`);
  const lines = codeLines(c.code);
  ok(lines.length <= 16, `${L}: ${lines.length} lines ≤ 16`);
  ok(words(c.why) <= 25, `${L}: why ${words(c.why)} words ≤ 25`);
  ok(c.marks.length >= 1 && c.marks.length <= 4, `${L}: 1–4 marks`);
  c.marks.forEach((m, k) => {
    ok(m.n === k + 1, `${L}: mark ${k + 1} is numbered ${k + 1}`);
    ok(words(m.say) <= 20, `${L} mark ${m.n}: ${words(m.say)} words ≤ 20`);
    if (m.lines) {
      ok(m.lines[0] >= 1 && m.lines[1] >= m.lines[0] && m.lines[1] <= lines.length, `${L} mark ${m.n}: lines ${m.lines.join('–')} exist`);
      if (m.quote) ok(lines.slice(m.lines[0] - 1, m.lines[1]).some((l) => l.includes(m.quote)), `${L} mark ${m.n}: quote occurs in its lines`);
    } else {
      ok(!!m.token && m.token.line >= 1 && m.token.line <= lines.length && !!tokenSpan(lines[m.token.line - 1], m.token), `${L} mark ${m.n}: token ${JSON.stringify(m.token?.text)} occurs on line ${m.token?.line}`);
    }
  });
  // ① ② ③ read down the code, so a video walking the marks in order never jumps back
  const at = c.marks.map((m) => (m.lines ? m.lines[0] : m.token.line));
  ok(at.every((x, k) => k === 0 || x >= at[k - 1]), `${L}: marks are numbered in line order (${at.join(', ')})`);
  if (c.slideCheck) ok(words(c.slideCheck) <= 50, `${L}: check line ${words(c.slideCheck)} words ≤ 50`);
  // the print image wraps long lines at a space, comma, bracket, dot or '=', never mid-word
  // (Consolas: a character is 0.5498 em)
  const { visual } = layoutPanel(c.code, c.marks, 0.5498);
  visual.forEach((v, k) => {
    if (!v.cont) return;
    const a = visual[k - 1].segs.map((g) => g.t).join('').slice(-1);
    const b = v.segs.map((g) => g.t).join('')[0];
    ok(!(/\w/.test(a) && /\w/.test(b)),`${L}: print wrap of line ${v.row.no} doesn't split a word (${a}|${b})`);
  });
  const mv = c.moves || {};
  const moveWords = words(mv.say) + words(mv.forWhat);
  ok(moveWords <= 60, `${L}: exam move ${moveWords} words ≤ 60`);
  ok(!!mv.forWhat, `${L}: says what it's for`);
  if (mv.draw) ok(!!SPECS[mv.draw], `${L}: draw spec ${mv.draw} exists`);
  [].concat(mv.count || []).forEach((id) => ok(!!SPECS[id], `${L}: count spec ${id} exists`));
  (mv.eq || []).forEach((e) => {
    ok(!!e.tex, `${L}: equation has TeX`);
    if (e.line) ok(e.line >= 1 && e.line <= lines.length, `${L}: equation's code line ${e.line} exists`);
  });
  (c.xref || []).forEach((x) => ok(!!CARD_BY_ID[x.to] && x.to !== c.id, `${L}: cross-link to ${x.to} exists`));

  // slide receipts
  c.sources.forEach((s) => {
    if (s.kind === 'lecture') {
      LECTURES.add(s.lec === 6 ? 'L6–7' : `L${s.lec}`);
      const nums = String(s.slides).split(/[–,-]/).map((x) => Number(x.trim()));
      ok(nums.every((x) => Number.isInteger(x) && x >= 1 && x <= DECK_SLIDES[s.lec]), `${L}: slides ${s.slides} within L${s.lec}'s ${DECK_SLIDES[s.lec]}`);
    } else if (s.kind === 'lab') ok([2, 3, 4].includes(s.n), `${L}: lab ${s.n} exists`);
    else if (s.kind === 'project') ok([1, 2].includes(s.n) && /^§\d/.test(s.sec), `${L}: project receipt ${s.n} ${s.sec}`);
    else if (s.kind === 'geron') ok([10, 11].includes(s.ch), `${L}: Géron chapter ${s.ch}`);
    else ok(false, `${L}: unknown source kind ${s.kind}`);
  });

  // verbatim
  if (c.provenance === 'verbatim' || c.provenance === 'trimmed') {
    ok(Array.isArray(c.blocks) && c.blocks.length > 0, `${L}: names its slide blocks`);
    const srcs = (c.blocks || []).map((b) => {
      ok(!!blocks[b], `${L}: slide block ${b} is transcribed`);
      const lec = Number(/^L(\d)/.exec(b)?.[1]);
      ok(c.sources.some((s) => s.kind === 'lecture' && (s.lec === lec || (s.lec === 6 && lec === 6))), `${L}: block ${b} matches a cited lecture`);
      return blocks[b] || [];
    });
    checkVerbatim(c, srcs, `${L} (${c.id})`);
    if (c.provenance === 'verbatim') {
      ok(!lines.some((l) => ELISION.test(l)), `${L}: "verbatim" has no '# …' cuts`);
      const keptNonBlank = lines.filter((l) => !isBlank(l)).length;
      const srcNonBlank = srcs.flat().filter((l) => !isBlank(l)).length;
      ok(keptNonBlank === srcNonBlank, `${L}: "verbatim" keeps every line of its blocks (${keptNonBlank}/${srcNonBlank}); otherwise call it trimmed`);
    }
  } else if (c.provenance === 'notebook' || c.provenance === 'geron') {
    ok(!!NOTEBOOKS[c.nb], `${L}: names its notebook`);
    if (NOTEBOOKS[c.nb]) checkVerbatim(c, notebook(c.nb).cells, `${L} (${c.id})`);
  } else {
    ok(c.sources.some((s) => s.kind === 'lab'), `${L}: a reconstruction cites its lab sheet`);
    ok(!!c.slideCheck, `${L}: a reconstruction says which choices are its own`);
  }
});

// ── panels ──────────────────────────────────────────────────────────────────
const labCards = CARDS.filter((c) => c.section === 'labs').map((c) => c.id);
const inPanels = LAB_PANELS.flatMap((lp) => lp.cards);
ok(JSON.stringify([...inPanels].sort()) === JSON.stringify([...labCards].sort()), 'every Labs & Projects card sits in exactly one panel');
ok(JSON.stringify(inPanels) === JSON.stringify(labCards), 'the panels list their cards in tab order');
ok(LAB_PANELS.map((lp) => lp.id).join() === 'lp-lab2,lp-lab3,lp-lab4,lp-p1,lp-p2', 'one panel each for Lab 2, Lab 3, Lab 4, Project 1, Project 2, in that order');
LAB_PANELS.forEach((lp) => {
  ok(words(lp.goal) <= 30, `${lp.id}: goal ${words(lp.goal)} words ≤ 30`);
  ['data', 'models', 'result'].forEach((k) => ok(Array.isArray(lp[k]) && lp[k].length > 0, `${lp.id}: has ${k}`));
  [...lp.data, ...lp.models, ...lp.result].filter((d) => typeof d === 'object').forEach((d) => {
    ok(notebook(d.nb).outputs.includes(d.q), `${lp.id}: quoted output is verbatim in ${d.nb}: ${d.q}`);
  });
  (lp.see || []).forEach((x) => ok(!!CARD_BY_ID[x.to], `${lp.id}: cross-link ${x.to} exists`));
});

// ── counts.js vs Keras ──────────────────────────────────────────────────────
const keras = JSON.parse(fs.readFileSync(path.join(HERE, 'keras-counts.json'), 'utf8'));
Object.values(SPECS).forEach((sp) => {
  const k = keras.specs[sp.id];
  ok(!!k, `spec ${sp.id} was built in TensorFlow (run export-specs + verify_counts.py)`);
  if (!k) return;
  const f = flow(sp);
  ok(f.tr === k.tr && f.nt === k.nt, `spec ${sp.id}: totals ${f.tr}/${f.nt} = Keras ${k.tr}/${k.nt}`);
  ok(f.rows.length === k.rows.length, `spec ${sp.id}: ${f.rows.length} layers = Keras ${k.rows.length}`);
  f.rows.forEach((r, i) => {
    const kr = k.rows[i];
    if (!kr) return;
    ok(JSON.stringify(r.out) === JSON.stringify(kr.out) && r.tr === kr.tr && r.nt === kr.nt, `spec ${sp.id} layer ${r.id}: ${JSON.stringify(r.out)} ${r.tr}/${r.nt} = Keras ${JSON.stringify(kr.out)} ${kr.tr}/${kr.nt}`);
  });
});
CARDS.filter((c) => c.provenance === 'reconstructed').forEach((c) => {
  const run = keras.labs[c.id];
  ok(!!run && run.fits >= 1, `${c.label}: the reconstruction ran a 1-epoch smoke fit in TensorFlow`);
  const sp = SPECS[c.moves?.count];
  if (run && sp) ok(run.tr === flow(sp).tr && run.nt === flow(sp).nt, `${c.label}: the card's own code builds its Count it model`);
});

// ── the NotebookLM prompts ──────────────────────────────────────────────────
const prompts = [NLM_PROMPT, ...NLM_PARTS.map((p) => p.text)];
prompts.forEach((p, i) => ok(p.length <= 1050, `prompt ${i}: ${p.length} characters (about 1,000 at most)`));
const picks = NLM_PICKS.map((id) => CARD_BY_ID[id]);
ok(picks.every(Boolean), 'every NotebookLM pick is a card');
ok(picks.length >= 6 && picks.length <= 8, `6–8 concept picks (${picks.length})`);
ok(picks.every((c) => c?.rating === 'core' && c.section !== 'labs'), 'the picks are core concept cards');
const pickLecs = new Set(picks.flatMap((c) => c.sources.filter((s) => s.kind === 'lecture').map((s) => s.lec === 6 ? 6 : s.lec)));
ok(pickLecs.size >= 5, `the picks span ≥ 5 lectures (${pickLecs.size})`);
ok(picks.filter((c) => c.moves?.count).length >= 2, 'at least 2 picks have Count it');
ok(picks.filter((c) => c.moves?.draw).length >= 2, 'at least 2 picks have Draw it');
picks.forEach((c) => ok(prompts.some((p) => p.includes(fullLabel(c))), `${fullLabel(c)} is named verbatim in a prompt`));
ok(prompts.every((p) => /Lab 2, Lab 3, Lab 4, Project 1, Project 2/.test(p) || !/Lab 2/.test(p)), 'labs and projects in the order Lab 2, Lab 3, Lab 4, Project 1, Project 2');
ok(/draw it, count it, say what it’s for/.test(NLM_PROMPT), 'the prompt ends with the three-step recipe');

// ── inventory.md ────────────────────────────────────────────────────────────
const inv = fs.readFileSync(path.join(HERE, 'inventory.md'), 'utf8');
const rows = {};
inv.split(/\r?\n/).filter((l) => l.startsWith('| ') && !l.startsWith('| id') && !l.startsWith('|---')).forEach((l) => {
  const cells = l.split('|').slice(1, -1).map((x) => x.trim());
  const rating = cells.find((x) => ['core', 'useful', 'cut'].includes(x));
  if (rating) rows[cells[0]] = { rating, card: cells[cells.length - 1] };
});
CARDS.forEach((c) => {
  ok(inv.includes(`\`${c.id}\``), `${c.label} (${c.id}) is in inventory.md's card list`);
  c.inv.forEach((id) => {
    ok(!!rows[id], `${c.label}: candidate ${id} is in inventory.md`);
    if (rows[id]) ok(rows[id].rating !== 'cut', `${c.label}: candidate ${id} isn't rated cut`);
  });
});
Object.entries(rows).filter(([, r]) => r.rating === 'cut').forEach(([id, r]) => {
  ok(!CARDS.some((c) => r.card.includes(c.id) && r.card === c.id), `cut candidate ${id} isn't on the page`);
});

console.log(`\n${checks} checks · ${CARDS.length} cards · ${SECTIONS.length} tabs · lectures ${[...LECTURES].join(', ')}`);
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
