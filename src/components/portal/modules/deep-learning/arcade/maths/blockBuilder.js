/* ============================================================================
   BLOCK BUILDER — THE ITEM GENERATOR (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items (kit/useRound.js shape), built
   from content/block-builder.js in ROUNDS order. Every item carries `view`,
   which tells the stage what to draw:

     level 1 · name the net
       claim     a slide claim → which architecture             (choice)
       exhibit   an architecture → its number / year            (choice)
       rows      2–3 rows of the LeNet-5 / AlexNet table → name (choice)
       figure    Figure 14-14 / 14-16 / a tower fragment → name (choice)
     level 2 · stack the blocks
       order     tap the missing blocks of a tower into place   (custom)
       branches  pick Figure 14-14's four branches out of six   (custom)
       wire      tap where the skip connection leaves and joins (custom)
       quick     a one-tap follow-up on Figure 14-14 / 14-16    (choice)
     level 3 · fill the spec
       cell      a blank LeNet-5 / AlexNet table cell           (number)
       sum       Figure 14-15's depth concat into "Max pool ?"  (number)
       steps     slide 51's fine-tuning steps in order          (custom)
       text      slides 33–34 / 49–51 in the slides' words      (choice)

   Table sizes come from maths/shapes.js (modelShapes, checked against
   Keras); tools/dl-arcade/check-block-builder.mjs checks them against the
   numbers the slides print.
   ========================================================================== */
import { modelShapes } from './shapes.js';
import {
  UI, ARCHS, DRAWN, LENET5, ALEXNET, GOOGLENET, IMAGENET, INCEPTION, RESIDUAL, CLAIMS, NUMBERS, YEARS, FRAGMENTS,
  QUICK, ORDERS, FINETUNE, RULES, CELL_TIERS, TYPICAL, TRANSFER, ROUNDS,
} from '../content/block-builder.js';

export const fill = (tpl, vars = {}) => String(tpl).replace(/%(\w+)%/g, (m, k) => (k in vars ? String(vars[k]) : m));
const L = 3;
const uniq = (xs) => [...new Set(xs)];
const srcOf = (...lists) => ({ lecture: L, slides: uniq(lists.flat()).sort((a, b) => a - b) });
/** 4096 → "4,096" (the slides print thousands with a comma). */
export const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export const TABLES = { lenet5: LENET5, alexnet: ALEXNET };

// ── table cells as text (what the stage prints) ─────────────────────────
export function cellText(row, col) {
  const v = row[col];
  if (v === null || v === undefined) return UI.dash;
  if (col === 'size') return Array.isArray(v) ? `${v[0]} × ${v[1]}` : commas(v);
  if (col === 'kernel') return `${v} × ${v}`;
  if (col === 'maps') return `${v}${row.mapsNote ?? ''}`;
  return String(v);
}

// ── shapes: the conv / pool rows through maths/shapes.js ────────────────
/** A table row as a maths/params.js spec (conv / pooling rows only). */
export function rowSpec(row) {
  const padding = row.padding ?? 'valid'; // LeNet-5's table has no padding column; 32 → 28 under a 5 × 5 kernel is "valid"
  if (row.type === 'Convolution') return { type: 'Conv2D', filters: row.maps, kernel: row.kernel, strides: row.stride, padding };
  if (row.type === 'Avg pooling') return { type: 'AvgPool2D', pool: row.kernel, strides: row.stride, padding };
  if (row.type === 'Max pooling') return { type: 'MaxPool2D', pool: row.kernel, strides: row.stride, padding };
  return null;
}
/** modelShapes over a table's conv / pool rows, fed the In row: [{ spec, in, out }] for rows 1 … k. */
export function tableShapes(table) {
  const [inRow, ...rest] = table.rows;
  const specs = [];
  for (const row of rest) {
    const sp = rowSpec(row);
    if (!sp) break;
    specs.push(sp);
  }
  return modelShapes(specs, [inRow.size[0], inRow.size[1], inRow.maps]);
}

/** Which rule sizes a row (the why card's wording). */
export function cellRule(row) {
  if (row.type === 'Convolution') return row.padding === 'same' ? 'same1' : row.stride === 1 ? 'valid1' : 'validS';
  return row.kernel === row.stride && (row.padding ?? 'valid') === 'valid' ? 'tile' : 'validS';
}

/** Every cell level 3 may blank out, with its answer (computed) and why. */
export function tableCells(table) {
  const shapes = tableShapes(table);
  const name = ARCHS[table.arch].name;
  const cells = [];
  shapes.forEach((r, k) => {
    const i = k + 1;
    const row = table.rows[i];
    const prev = table.rows[i - 1];
    const rule = cellRule(row);
    const n = r.in[0];
    const f = row.kernel;
    const s = row.stride;
    const vars = { layer: row.layer, n, f, s, out: r.out[0], pos: n - f + 1, sth: ordinal(s), slide: table.slide };
    cells.push({ key: `${table.key}.${row.layer}.size`, table: table.key, name, row: i, col: 'size', rule, answer: r.out[0], vars });
    if (row.type !== 'Convolution' && !row.noMapsCell) {
      cells.push({ key: `${table.key}.${row.layer}.maps`, table: table.key, name, row: i, col: 'maps', rule: 'pooledMaps', answer: r.out[2], vars: { layer: row.layer, prev: prev.layer, out: r.out[2] } });
    }
  });
  const last = table.rows.length - 1;
  if (table.rows[last].act === 'Softmax') {
    cells.push({ key: `${table.key}.Out.size`, table: table.key, name, row: last, col: 'size', rule: 'classes', answer: IMAGENET.classes, showAll: true, vars: {} });
  }
  return cells;
}
export const ALL_CELLS = [...tableCells(LENET5), ...tableCells(ALEXNET)];

// ── stacking: towers as blocks and cards ────────────────────────────────
function rowSub(row) {
  if (row.type === 'Input') return `${cellText(row, 'maps')} @ ${row.size[0]}×${row.size[1]}`;
  if (row.maps === null) return `${commas(row.size)} · ${row.act}`;
  const k = `${row.kernel}×${row.kernel}, stride ${row.stride}${row.padding ? `, ${row.padding}` : ''}`;
  return `${row.maps} @ ${row.size[0]}×${row.size[1]} · ${k}`;
}
/** A table as stack blocks, bottom → top; identical rows (table.merge) become one "2 ×" block. */
export function tableBlocks(table) {
  const blocks = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const group = table.merge.find((g) => g[0] === row.layer);
    if (table.merge.some((g) => g.slice(1).includes(row.layer))) continue;
    blocks.push({
      id: `${table.key}.${group ? group.join('-') : row.layer}`,
      name: group ? group.join(' · ') : row.layer,
      label: `${group ? `${group.length} × ` : ''}${row.type}`,
      sub: rowSub(row),
      tone: row.tone,
      fixed: row.type === 'Input',
    });
  }
  return blocks;
}
function towerBlocks(key) {
  if (key === 'googlenet') {
    const [a, b] = GOOGLENET.view;
    return GOOGLENET.tower.slice(a, b + 1).map((t) => ({ id: t.id, name: '', label: t.label, sub: t.sub ?? '', tone: t.tone, fixed: !GOOGLENET.orderable.includes(t.id) }));
  }
  if (key === 'finetune') return FINETUNE.map((s) => ({ id: s.id, name: '', label: s.label, sub: s.code, tone: 'step', fixed: !!s.fixed }));
  return tableBlocks(TABLES[key]);
}
const cardKey = (b) => `${b.label}|${b.sub}`;

/** One stacking item: k of the tower's movable blocks become shuffled cards. */
export function orderItem(rand, key, k, id) {
  const meta = ORDERS[key];
  const blocks = towerBlocks(key);
  const movable = blocks.map((b, i) => (b.fixed ? -1 : i)).filter((i) => i >= 0);
  const take = rand.shuffle(movable).slice(0, Math.min(k, movable.length)).sort((a, b) => a - b);
  const slots = blocks.map((b, i) => ({ ...b, slot: take.includes(i) }));
  const answer = take.map((i) => blocks[i].id);
  const cards = rand.shuffle(take.map((i) => ({ id: blocks[i].id, label: blocks[i].label, sub: blocks[i].sub, tone: blocks[i].tone })));
  const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
  const short = (bid) => `${byId[bid]?.label ?? bid}${byId[bid]?.sub ? ` (${byId[bid].sub})` : ''}`;
  const isSteps = key === 'finetune';
  const prompt = isSteps ? UI.finetunePrompt : fill(UI.orderPrompt, { name: meta.name });
  return {
    id,
    view: isSteps ? 'steps' : 'order',
    tower: key,
    concept: meta.concept,
    src: meta.src,
    kind: 'custom',
    answer,
    slots,
    cards,
    prompt,
    sub: isSteps ? UI.finetuneSub : UI.orderSub,
    promptText: prompt,
    why: meta.why,
    check: (g) => Array.isArray(g) && g.length === answer.length && g.every((x, i) => x === answer[i]),
    format: (v) => (Array.isArray(v) ? v.map(short).join(isSteps ? ' → ' : ' ↑ ') : String(v)),
    distinct: uniq(cards.map(cardKey)).length === cards.length,
  };
}

// ── level 1 helpers ─────────────────────────────────────────────────────
const archChoices = (rand, answer, pool) => {
  const others = rand.shuffle(pool.filter((a) => a !== answer)).slice(0, 3);
  return rand.shuffle([answer, ...others]).map((a) => ({ value: a, label: ARCHS[a].name }));
};
const textChoices = (rand, answer, wrong) => rand.shuffle([answer, ...wrong]).map((t) => ({ value: t, label: t }));
const choiceItem = (base, choices) => ({
  ...base,
  kind: 'choice',
  choices,
  format: (v) => choices.find((c) => c.value === v)?.label ?? String(v),
});

function claimItem(rand, c, id) {
  const pool = Object.keys(ARCHS).filter((a) => !(c.not ?? []).includes(a));
  return choiceItem({
    id, view: 'claim', concept: ARCHS[c.arch].concept, src: c.src, answer: c.arch,
    claim: c.text, prompt: UI.which, promptText: `“${c.text}” Which architecture?`, why: c.why,
  }, archChoices(rand, c.arch, pool));
}
function numberItem(rand, n, id) {
  return choiceItem({
    id, view: 'exhibit', concept: n.concept, src: n.src, answer: n.answer,
    exhibit: n.exhibit, prompt: n.q, promptText: `${n.exhibit}: ${n.q}`, why: n.why,
  }, textChoices(rand, n.answer, n.wrong));
}
function yearItem(rand, arch, id) {
  const a = ARCHS[arch];
  const years = uniq(Object.values(ARCHS).map((x) => x.year)).filter((y) => y !== a.year);
  const choices = rand.shuffle([a.year, ...rand.shuffle(years).slice(0, 3)]).map((y) => ({ value: String(y), label: String(y) }));
  const slide = YEARS.slideOf[arch];
  return choiceItem({
    id, view: 'exhibit', concept: a.concept, src: srcOf([slide]), answer: String(a.year),
    exhibit: a.name, prompt: YEARS.q, promptText: `${a.name}: ${YEARS.q}`, why: fill(YEARS.why, { slide, name: a.name, year: a.year }),
  }, choices);
}
/** 2–3 consecutive rows of a table (AlexNet's stay at or below S8, where its table is unmistakable). */
function rowsItem(rand, key, id) {
  const table = TABLES[key];
  const frag = FRAGMENTS[key === 'lenet5' ? 'lenetRows' : 'alexRows'];
  const len = rand.int(2, 3);
  const top = key === 'alexnet' ? 7 : table.rows.length - 1;
  const start = rand.int(0, top - len + 1);
  const rows = Array.from({ length: len }, (_, j) => start + j);
  return choiceItem({
    id, view: 'rows', table: key, rows, concept: frag.concept, src: frag.src, answer: frag.arch,
    prompt: UI.whichRows, promptText: `${UI.whichRows} (${rows.map((r) => table.rows[r].layer).join(', ')})`, why: frag.why,
  }, archChoices(rand, frag.arch, DRAWN.filter((a) => !(frag.not ?? []).includes(a))));
}
function figureItem(rand, fkey, id) {
  const frag = FRAGMENTS[fkey];
  const tower = fkey === 'vgg' ? 'vgg' : fkey === 'googStem' || fkey === 'googHead' ? fkey : null;
  return choiceItem({
    id, view: 'figure', figure: fkey, tower, concept: frag.concept, src: frag.src, answer: frag.arch,
    prompt: UI.whichPicture, promptText: `${UI.whichPicture} (${fkey === 'inception' ? UI.figInception : fkey === 'residual' ? UI.figResidual : fkey === 'vgg' ? UI.figVgg : UI.figGoogLeNet})`,
    why: frag.why,
  }, archChoices(rand, frag.arch, DRAWN.filter((a) => !(frag.not ?? []).includes(a))));
}

// ── level 2 helpers ─────────────────────────────────────────────────────
// "conv 1×1 → conv 3×3", "max pool 3×3 → conv 1×1" (a decoy's stride 2 spelled out)
const branchShort = (b) => b.parts.map((p) => `${p.type === 'Max pool' ? 'max pool' : 'conv'} ${p.spec.split(/\s*\+/)[0]}${/\+\s*2/.test(p.spec) ? ', stride 2' : ''}`).join(' → ');
function branchesItem(rand, id) {
  const decoys = rand.shuffle(INCEPTION.decoys).slice(0, 2);
  const all = [...INCEPTION.branches, ...decoys];
  const cards = rand.shuffle(all).map((b) => ({ id: b.id, parts: b.parts, short: branchShort(b) }));
  const answer = INCEPTION.branches.map((b) => b.id).sort();
  const byId = Object.fromEntries(all.map((b) => [b.id, b]));
  const prompt = UI.branchesPrompt;
  return {
    id, view: 'branches', concept: 'arch.inception', src: INCEPTION.src, kind: 'custom', answer, cards,
    prompt, sub: fill(UI.branchesSub, { d: decoys.length }), promptText: prompt,
    why: `${INCEPTION.why} Decoys: ${decoys.map((d) => `${branchShort(d)} (${d.note})`).join('; ')}.`,
    check: (g) => Array.isArray(g) && g.length === answer.length && [...g].sort().every((x, i) => x === answer[i]),
    format: (v) => (Array.isArray(v) ? v.map((x) => (byId[x] ? branchShort(byId[x]) : x)).join(' · ') : String(v)),
  };
}
function wireItem(id) {
  const answer = RESIDUAL.answer.slice();
  const label = (x) => RESIDUAL.blocks.find((b) => b.id === x)?.label ?? x;
  return {
    id, view: 'wire', concept: 'arch.resnet', src: RESIDUAL.src, kind: 'custom', answer,
    prompt: UI.wirePrompt, sub: UI.wireFrom, promptText: UI.wirePrompt, why: RESIDUAL.why,
    check: (g) => Array.isArray(g) && g.length === 2 && g[0] === answer[0] && g[1] === answer[1],
    format: (v) => (Array.isArray(v) ? v.map(label).join(' → ') : String(v)),
  };
}
function quickItem(rand, q, id) {
  return choiceItem({
    id, view: 'quick', figure: q.figure, hide: q.hide ?? null, concept: q.concept, src: q.src, answer: q.answer,
    prompt: q.q, promptText: q.q, why: q.why,
  }, textChoices(rand, q.answer, q.wrong));
}

// ── level 3 helpers ─────────────────────────────────────────────────────
function cellItem(cell, id) {
  const table = TABLES[cell.table];
  const rule = RULES[cell.rule];
  const layer = table.rows[cell.row].layer;
  const prompt = fill(UI.cellPrompt, { layer, col: UI.colWord[cell.col] });
  return {
    id, view: 'cell', table: cell.table, row: cell.row, col: cell.col, showAll: !!cell.showAll,
    concept: cell.rule === 'pooledMaps' ? 'shape.pool' : table.arch === 'lenet5' ? 'arch.lenet5' : 'arch.alexnet',
    src: srcOf(table.src.slides, rule.src.slides),
    kind: 'number', answer: cell.answer,
    prompt, sub: cell.showAll ? UI.cellSubAll : fill(UI.cellSub, { layer }), promptText: `${cell.name}: ${prompt}`,
    padLabel: fill(UI.keypadCell, { layer, col: UI.colWord[cell.col] }),
    why: fill(rule.text, cell.vars),
    maths: rule.maths.map((m) => fill(m, cell.vars)),
    cellKey: cell.key,
  };
}
export function sumOf(s) {
  return GOOGLENET.modules[s.module].top.reduce((a, b) => a + b, 0);
}
function sumItem(s, id) {
  const mod = GOOGLENET.modules[s.module];
  const calc = mod.top.join(' + ');
  const out = sumOf(s);
  const prompt = fill(UI.sumPrompt, { block: s.label.toLowerCase() });
  return {
    id, view: 'sum', sum: s, module: mod, concept: 'arch.inception', src: s.src,
    kind: 'number', answer: out,
    prompt, sub: UI.sumSub, promptText: `${prompt} (module ${mod.top.join(' ')} / ${mod.bottom.join(' ')})`,
    padLabel: UI.keypadSum,
    why: fill(RULES.sum.text, { calc, out, into: s.into }),
    maths: RULES.sum.maths.map((m) => fill(m, { calc })),
  };
}
function textItem(rand, t, concept, topic, id) {
  return choiceItem({
    id, view: 'text', topic, concept: t.concept ?? concept, src: t.src, answer: t.answer,
    prompt: t.q, promptText: t.q, why: t.why,
  }, textChoices(rand, t.answer, t.wrong));
}

// ── the round ───────────────────────────────────────────────────────────
/** Pick from `list` an entry not yet used (by `id`), preferring `pred`; marks it used. */
function take(rand, list, used, pred = () => true) {
  const fresh = list.filter((x) => !used.has(x.id ?? x.key));
  const pool = fresh.filter(pred);
  const pick = rand.pick(pool.length ? pool : fresh.length ? fresh : list);
  used.add(pick.id ?? pick.key);
  return pick;
}

export function makeItems(rand, level = 1) {
  const plan = ROUNDS[level] ?? ROUNDS[1];
  const used = new Set();
  const items = [];
  plan.forEach((step, i) => {
    const [kind, a, b] = step.split(':');
    const id = `bb${level}.${i + 1}.${kind}`;
    let item;
    switch (kind) {
      case 'claim': item = claimItem(rand, take(rand, CLAIMS, used, (c) => c.tier === Number(a)), id); break;
      case 'number': item = numberItem(rand, take(rand, NUMBERS, used, (n) => n.tier === Number(a)), id); break;
      case 'year': item = yearItem(rand, take(rand, Object.keys(ARCHS).map((k) => ({ id: `year.${k}`, k })), used).k, id); break;
      case 'rows': item = rowsItem(rand, rand.pick(['lenet5', 'alexnet']), id); used.add(`rows.${item.table}`); break;
      case 'figure': item = figureItem(rand, take(rand, [{ id: 'fig.inception' }, { id: 'fig.residual' }], used).id.slice(4), id); break;
      case 'picture': {
        const opts = [{ id: 'fig.vgg' }, { id: 'fig.googStem' }, { id: 'fig.googHead' }, ...['lenet5', 'alexnet'].map((t) => ({ id: `rows.${t}` }))];
        const p = take(rand, opts, used).id;
        item = p.startsWith('rows.') ? rowsItem(rand, p.slice(5), id) : figureItem(rand, p.slice(4), id);
        break;
      }
      case 'wire': item = wireItem(id); break;
      case 'branches': item = branchesItem(rand, id); break;
      case 'quick': item = quickItem(rand, take(rand, QUICK, used), id); break;
      case 'order': {
        const key = a === 'any' ? take(rand, [{ id: 'order.lenet5' }, { id: 'order.alexnet' }], used).id.slice(6) : a;
        used.add(`order.${key}`);
        item = orderItem(rand, key, Number(b), id);
        break;
      }
      case 'finetune': item = orderItem(rand, 'finetune', Number(a), id); break;
      case 'cell': {
        const cell = take(rand, ALL_CELLS, used, (c) => CELL_TIERS[c.rule] === Number(a));
        item = cellItem(cell, id);
        break;
      }
      case 'sum': item = sumItem(take(rand, GOOGLENET.sums, used), id); break;
      case 'typical': item = textItem(rand, take(rand, TYPICAL, used), 'arch.typical', UI.topicTypical, id); break;
      case 'transfer': item = textItem(rand, take(rand, TRANSFER, used), 'transfer.finetune', UI.topicTransfer, id); break;
      default: throw new Error(`blockBuilder: unknown step ${step}`);
    }
    items.push({ ...item, id: `${id}.${i}` });
  });
  return items;
}

// for the stage: Figure 14-15 blocks by id, and a tower fragment's blocks
export const GOOG_BY_ID = Object.fromEntries(GOOGLENET.tower.map((t) => [t.id, t]));
export function fragmentBlocks(tower) {
  if (tower === 'googStem' || tower === 'googHead') {
    return GOOGLENET.fragments[tower === 'googStem' ? 'stem' : 'head'].map((gid) => ({ id: gid, ...GOOG_BY_ID[gid], name: '' }));
  }
  return [];
}
