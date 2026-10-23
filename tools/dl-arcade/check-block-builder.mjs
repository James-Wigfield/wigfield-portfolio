#!/usr/bin/env node
/* check-block-builder.mjs — Block Builder (Lecture 3, slides 33–51) fidelity and round checks.

   1. FIDELITY against the slides:
      - slide 37 (LeNet-5) and slide 39 (AlexNet): every conv / pooling row's printed
        size is reproduced by maths/shapes.js modelShapes, fed the In row, and every
        pooling row keeps its input's maps (slide 29) — except AlexNet's S8, whose
        256 maps cannot follow C6's 384 because the slide has no C7 row (lecture3.js
        QUIRKS l3.quirk.alexnetC7): modelShapes gives 384, the slide prints 256, and
        the game never asks S8's maps;
      - the AlexNet 227 → 55 rounding: with padding="valid" an 11 × 11 kernel fits
        227 − 11 + 1 = 217 positions; stride 4 keeps the 1st and every 4th one after
        it: positions 1, 5, …, 217 → 55. As a formula ⌊(227 − 11)/4⌋ + 1 = 54 + 1 = 55
        (216/4 = 54 exactly, so the floor does nothing) and ⌈217/4⌉ = ⌈54.25⌉ = 55; the
        game's why card uses the "positions, every s-th kept" wording, which is the
        ceiling of a non-integer here. Asserted for every stride > 1 "valid" row
        (C1 227 → 55, S2 55 → 27, S4 27 → 13, S8 13 → 6);
      - the tables agree with lecture3.js ANCHORS (l3.lenet.*, l3.alexnet.*) row by row;
      - Figure 14-15 (slide 43): the three printed depths 480, 832 and 1024 are the sums
        of the top four numbers of the module right below them; 9 modules, drawn 2 + 5 + 2;
        the sums agree with lecture3.js ANCHORS l3.googlenet.concat480 / concat832 and
        the 8 × 8 × 1024 global-avg-pool input;
      - level 3's table cells: each answer equals the number the slide prints in that cell.
   2. ORDERS: every tower's movable blocks (LeNet-5, AlexNet with C5–C6 and F9–F10
      merged, GoogLeNet's top, slide 51's steps) are pairwise distinct, so no two cards
      can swap places; Figure 14-14's four branches and the decoys are distinct; each
      generated stacking answer is the only accepted order.
   3. ROUNDS: 30 seeded rounds per level. Every item has a unique id, a concept in the
      catalogue (and in the manifest), a Lecture 3 src citing slides 33–51 (a table cell
      also cites the slide whose rule sizes it: 9, 20, 21, 26 or 29), a why, a
      promptText, no unfilled %tokens%; its answer is JSON-serialisable and grades true;
      a mutated answer and a skip grade false; choices are unique and hold the answer;
      a claim's distractors avoid its `not` list; every TeX renders.

   Run:  node tools/dl-arcade/check-block-builder.mjs        (exit 1 on any failure) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const arcade = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const M = await imp('maths/blockBuilder.js');
const C = await imp('content/block-builder.js');
const L3 = await imp('content/lecture3.js');
const { modelShapes } = await imp('maths/shapes.js');
const { rng } = await imp('core/rng.js');
const { CONCEPTS } = await imp('core/concepts.js');
const { grade } = await imp('kit/grade.js');
const katex = (await import(pathToFileURL(path.join(root, 'node_modules', 'katex', 'dist', 'katex.mjs')).href)).default;

const failures = [];
let passed = 0;
function expect(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}
const eq = (name, got, want) => expect(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
function texOk(text, where) {
  for (const m of String(text).matchAll(/\$([^$]+)\$/g)) {
    try {
      katex.renderToString(m[1], { throwOnError: true, strict: 'error' });
      passed++;
    } catch (e) {
      failures.push(`${where}: TeX "${m[1]}" fails: ${e.message}`);
    }
  }
}
const anchor = (id) => L3.ANCHORS.find((a) => a.id === id)?.value;

// ── 1. fidelity: the tables through modelShapes ─────────────────────────
for (const table of [C.LENET5, C.ALEXNET]) {
  const name = table.key;
  const inRow = table.rows[0];
  const specs = [];
  for (const row of table.rows.slice(1)) {
    const sp = M.rowSpec(row);
    if (!sp) break;
    specs.push(sp);
  }
  const shapes = modelShapes(specs, [inRow.size[0], inRow.size[1], inRow.maps]);
  eq(`${name}: tableShapes = modelShapes over the conv/pool rows`, M.tableShapes(table).map((r) => r.out), shapes.map((r) => r.out));
  shapes.forEach((r, k) => {
    const row = table.rows[k + 1];
    const prev = table.rows[k];
    eq(`${name} ${row.layer}: modelShapes reproduces the printed ${row.size.join(' × ')}`, r.out.slice(0, 2), row.size);
    if (row.type === 'Convolution') eq(`${name} ${row.layer}: conv depth = filters`, r.out[2], row.maps);
    else if (row.noMapsCell) {
      // AlexNet S8: the slide has no C7 row
      expect(`${name} ${row.layer}: the C7 gap — modelShapes keeps ${prev.layer}'s ${prev.maps} maps, the slide prints ${row.maps}`, r.out[2] === prev.maps && row.maps !== prev.maps);
    } else eq(`${name} ${row.layer}: pooling keeps the maps (slide 29)`, [r.out[2], row.maps], [prev.maps, prev.maps]);
    // "valid", stride > 1: positions n − f + 1, keep the 1st and every s-th → ⌈(n − f + 1)/s⌉ = ⌊(n − f)/s⌋ + 1
    const n = r.in[0];
    const f = row.kernel;
    const s = row.stride;
    if ((row.padding ?? 'valid') === 'valid') {
      const positions = n - f + 1;
      const kept = Array.from({ length: positions }, (_, i) => i).filter((i) => i % s === 0).length;
      eq(`${name} ${row.layer}: positions ${n} − ${f} + 1 = ${positions}, every ${s} kept → ${row.size[0]}`, [kept, Math.ceil(positions / s), Math.floor((n - f) / s) + 1], [row.size[0], row.size[0], row.size[0]]);
    }
  });
  // the rows agree with lecture3.js ANCHORS
  for (const row of table.rows) {
    const a = anchor(`l3.${name === 'lenet5' ? 'lenet' : 'alexnet'}.${row.layer === 'In' ? 'in' : row.layer === 'Out' ? 'out' : row.layer.toLowerCase()}`);
    if (!a) continue;
    if (typeof a === 'number') eq(`${name} ${row.layer}: size matches lecture3.js ANCHORS`, row.size, a);
    else eq(`${name} ${row.layer}: maps and size match lecture3.js ANCHORS`, [row.maps, row.size], [a.maps, a.size]);
  }
  for (const row of table.rows) expect(`${name} ${row.layer}: row has src`, row.src?.lecture === 3 && row.src.slides.includes(table.slide));
}
// the 227 → 55 rounding, spelled out
eq('AlexNet C1: (227 − 11)/4 is exactly 54, so ⌊·⌋ + 1 = 55', [(227 - 11) / 4, Math.floor((227 - 11) / 4) + 1], [54, 55]);
eq('AlexNet C1: 217 positions / 4 = 54.25 → the 1st and every 4th kept = 55', [217 / 4, Math.ceil(217 / 4)], [54.25, 55]);
eq('AlexNet F9/F10 and Out sizes as printed', [C.ALEXNET.rows[8].size, C.ALEXNET.rows[9].size, C.ALEXNET.rows[10].size], [anchor('l3.alexnet.f9'), anchor('l3.alexnet.f9'), anchor('l3.alexnet.out')]);
eq('AlexNet Out = ImageNet classes (slide 43)', [C.IMAGENET.classes, anchor('l3.googlenet.input').classes], [C.ALEXNET.rows[10].size, 1000]);

// level 3's cells: answers are what the slide prints
for (const cell of M.ALL_CELLS) {
  const row = M.TABLES[cell.table].rows[cell.row];
  const printed = cell.col === 'size' ? (Array.isArray(row.size) ? row.size[0] : row.size) : row.maps;
  eq(`cell ${cell.key}: answer = printed`, cell.answer, printed);
  expect(`cell ${cell.key}: never S8's maps`, !(cell.table === 'alexnet' && row.layer === 'S8' && cell.col === 'maps'));
  expect(`cell ${cell.key}: has a tier`, C.CELL_TIERS[cell.rule] >= 1);
}
expect('cells: every tier 1–3 has at least 3 cells', [1, 2, 3].every((t) => M.ALL_CELLS.filter((c) => C.CELL_TIERS[c.rule] === t).length >= 3));

// Figure 14-15
eq('GoogLeNet: 9 inception modules (slide 43)', C.GOOGLENET.modules.length, anchor('l3.googlenet.modules'));
const groups = C.GOOGLENET.tower.filter((t) => t.tone === 'inc').map((t) => Number(t.label.split(' ')[0]));
eq('GoogLeNet: modules drawn 2 + 5 + 2', groups, [2, 5, 2]);
eq('GoogLeNet: depth sums 480 / 832 / 1024', C.GOOGLENET.sums.map((s) => M.sumOf(s)), C.GOOGLENET.sums.map((s) => s.printed));
eq('GoogLeNet: sums match lecture3.js ANCHORS', C.GOOGLENET.sums.map((s) => s.printed), [anchor('l3.googlenet.concat480'), anchor('l3.googlenet.concat832'), anchor('l3.googlenet.gapInput').single[2]]);
for (const s of C.GOOGLENET.sums) {
  const label = C.GOOGLENET.tower.find((t) => (t.sub ?? '').startsWith(String(s.printed)));
  expect(`GoogLeNet: the tower prints ${s.printed} on "${s.into}"`, !!label && s.into.includes(String(s.printed)));
}

// ── 2. orders ────────────────────────────────────────────────────────────
const sig = (b) => `${b.label}|${b.sub}`;
for (const key of ['lenet5', 'alexnet', 'googlenet', 'finetune']) {
  const it = M.orderItem(rng(1), key, 99, `probe.${key}`);
  const movable = it.slots.filter((s) => s.slot);
  expect(`${key}: movable blocks pairwise distinct`, new Set(movable.map(sig)).size === movable.length, movable.map(sig).join(' / '));
  eq(`${key}: the full answer is the slide's order`, it.answer, movable.map((s) => s.id));
}
eq('AlexNet: C5–C6 and F9–F10 merged into one block each', M.tableBlocks(C.ALEXNET).map((b) => b.name), ['In', 'C1', 'S2', 'C3', 'S4', 'C5 · C6', 'S8', 'F9 · F10', 'Out']);
eq('slide 51: steps in the code’s order', C.FINETUNE.map((s) => s.id), ['ft.load', 'ft.head', 'ft.freeze', 'ft.compile1', 'ft.fit1', 'ft.unfreeze', 'ft.compile2', 'ft.fit2']);
const branchSig = (b) => b.parts.map((p) => `${p.type} ${p.spec}`).join(' → ');
const allBranches = [...C.INCEPTION.branches, ...C.INCEPTION.decoys];
expect('Figure 14-14: branches and decoys pairwise distinct', new Set(allBranches.map(branchSig)).size === allBranches.length);
eq('Figure 14-14: the second-set kernels are 1×1, 3×3, 5×5', C.INCEPTION.branches.map((b) => b.parts[b.parts.length - 1].spec.split(/\s*\+/)[0]), ['1×1', '3×3', '5×5', '1×1']);
expect('Figure 14-14: every real layer is "+1(S)"', C.INCEPTION.branches.every((b) => b.parts.every((p) => /\+\s*1\(S\)$/.test(p.spec))));
expect('Figure 14-14: every decoy breaks the figure', C.INCEPTION.decoys.every((d) => !C.INCEPTION.branches.some((b) => branchSig(b) === branchSig(d)) && d.note));

// ── 3. rounds ────────────────────────────────────────────────────────────
const manifestText = fs.readFileSync(path.join(arcade, 'games', 'block-builder', 'index.js'), 'utf8');
const manifestConcepts = [...manifestText.matchAll(/'([a-z]+\.[A-Za-z0-9]+)'/g)].map((m) => m[1]);
for (const c of manifestConcepts) expect(`manifest concept ${c} in the catalogue`, !!CONCEPTS[c]);

function mutate(item) {
  if (item.kind === 'number') return item.answer + 1;
  if (item.kind === 'choice') return item.choices.find((c) => c.value !== item.answer)?.value;
  if (item.view === 'wire') return ['l1', 'add'];
  if (item.view === 'branches') return [...item.answer.slice(0, 3), item.cards.find((c) => !item.answer.includes(c.id)).id];
  if (Array.isArray(item.answer) && item.answer.length > 1) return [...item.answer.slice(1), item.answer[0]];
  return null;
}
const counts = { 1: {}, 2: {}, 3: {} };
const sizes = { 1: 10, 2: 8, 3: 8 };
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = M.makeItems(rng(seed * 7919 + level), level);
    const where = `L${level} seed ${seed}`;
    eq(`${where}: round length`, items.length, sizes[level]);
    expect(`${where}: ids unique`, new Set(items.map((i) => i.id)).size === items.length);
    const cellTiers = items.filter((i) => i.view === 'cell').map((i) => C.CELL_TIERS[M.ALL_CELLS.find((c) => c.key === i.cellKey).rule]);
    if (cellTiers.length) eq(`${where}: cells ramp by tier`, cellTiers, [...cellTiers].sort((a, b) => a - b));
    for (const it of items) {
      const w = `${where} ${it.id}`;
      counts[level][it.view] = (counts[level][it.view] ?? 0) + 1;
      expect(`${w}: concept in the catalogue`, !!CONCEPTS[it.concept], it.concept);
      expect(`${w}: concept in the manifest`, manifestConcepts.includes(it.concept), it.concept);
      // architecture slides 33–51; a table cell also cites the earlier slide whose rule sizes it (9, 20, 21, 26, 29)
      expect(`${w}: src is Lecture 3, an architecture slide (33–51) plus any rule slide`, it.src?.lecture === 3 && it.src.slides.some((s) => s >= 33 && s <= 51) && it.src.slides.every((s) => s >= 9 && s <= 51), JSON.stringify(it.src));
      expect(`${w}: why`, typeof it.why === 'string' && it.why.length > 20);
      expect(`${w}: promptText`, typeof it.promptText === 'string' && it.promptText.length > 5);
      for (const t of [it.why, it.prompt, it.promptText, it.sub ?? '', ...(it.maths ?? [])]) expect(`${w}: no unfilled %token%`, !/%\w+%/.test(t), t);
      texOk(it.why, w);
      for (const m of it.maths ?? []) texOk(m, `${w} maths`);
      expect(`${w}: answer JSON-serialisable`, JSON.stringify(JSON.parse(JSON.stringify(it.answer))) === JSON.stringify(it.answer));
      expect(`${w}: answer grades true`, grade(it, JSON.parse(JSON.stringify(it.answer))));
      const bad = mutate(it);
      expect(`${w}: a mutated answer grades false`, bad !== null && bad !== undefined && !grade(it, bad), JSON.stringify(bad));
      expect(`${w}: a skip grades false`, !grade(it, null));
      expect(`${w}: format works`, typeof (it.format ? it.format(it.answer) : String(it.answer)) === 'string');
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        expect(`${w}: choices unique and hold the answer`, new Set(vals).size === vals.length && vals.includes(it.answer) && new Set(it.choices.map((c) => c.label)).size === vals.length);
        expect(`${w}: 4 choices`, vals.length === 4);
        if (it.view === 'claim') {
          const claim = C.CLAIMS.find((c) => c.text === it.claim);
          expect(`${w}: claim distractors avoid its not-list`, vals.every((v) => !(claim.not ?? []).includes(v)));
        }
        if (it.view === 'rows' || it.view === 'figure') expect(`${w}: picture distractors are drawn architectures`, vals.every((v) => C.DRAWN.includes(v)));
      }
      if (it.view === 'order' || it.view === 'steps') {
        expect(`${w}: cards distinct`, it.distinct && new Set(it.cards.map(sig)).size === it.cards.length);
        eq(`${w}: answer = the slots' ids bottom → top`, it.answer, it.slots.filter((s) => s.slot).map((s) => s.id));
        expect(`${w}: answer is a permutation of the cards`, [...it.answer].sort().join() === it.cards.map((c) => c.id).sort().join());
        // only the slide's order is accepted
        if (it.answer.length <= 6) {
          const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
          const ok = perms(it.answer).filter((p) => grade(it, p));
          expect(`${w}: exactly one accepted order`, ok.length === 1, `${ok.length}`);
        }
      }
      if (it.view === 'branches') {
        eq(`${w}: the four real branches`, it.answer, ['b1', 'b3', 'b5', 'bp']);
        expect(`${w}: any order of the four is accepted`, grade(it, [...it.answer].reverse()));
        expect(`${w}: 6 cards, 2 decoys`, it.cards.length === 6 && it.cards.filter((c) => c.id.startsWith('x')).length === 2);
      }
      if (it.view === 'wire') expect(`${w}: from Input to +`, grade(it, ['in', 'add']) && !grade(it, ['add', 'in']) && !grade(it, ['l1', 'add']));
      if (it.view === 'cell') {
        const cell = M.ALL_CELLS.find((c) => c.key === it.cellKey);
        eq(`${w}: cell answer`, it.answer, cell.answer);
      }
      if (it.view === 'sum') eq(`${w}: sum answer`, it.answer, it.sum.printed);
    }
  }
}
for (const level of [1, 2, 3]) console.log(`  L${level} views over 30 rounds: ${Object.entries(counts[level]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

// every content item has a src in range (pure data)
const contentItems = [...C.CLAIMS, ...C.NUMBERS, ...C.QUICK, ...C.TYPICAL, ...C.TRANSFER, ...Object.values(C.FRAGMENTS), ...Object.values(C.ORDERS), ...C.GOOGLENET.sums, C.INCEPTION, C.RESIDUAL, C.VGG, C.IMAGENET];
for (const c of contentItems) expect(`content src ${c.id ?? c.name ?? ''}`, c.src?.lecture === 3 && c.src.slides.length > 0 && c.src.slides.every((s) => s >= 33 && s <= 51));
for (const [k, r] of Object.entries(C.RULES)) expect(`rule ${k}: src`, r.src?.lecture === 3 && r.src.slides.length > 0 && r.src.slides.every((s) => s >= 9 && s <= 51));
for (const c of [...C.NUMBERS, ...C.QUICK, ...C.TYPICAL, ...C.TRANSFER]) expect(`${c.id}: wrong options differ from the answer`, c.wrong.length === 3 && !c.wrong.includes(c.answer) && new Set(c.wrong).size === 3);
expect('nothing marked beyond', !JSON.stringify(Object.values(C)).includes('"beyond":true'));

console.log(failures.length ? `\nFAIL ${failures.length} (passed ${passed})\n  ${failures.slice(0, 40).join('\n  ')}` : `\nOK — ${passed} checks passed`);
process.exit(failures.length ? 1 : 0);
