/* ============================================================================
   DL TRICKY TOPICS — the maths and content check (no browser, no TensorFlow)
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/check-maths.mjs

   Iterates src/…/tricky-topics/topics/index.js, so a new topic is checked
   with no edit here. Topic files a node script imports must be plain JS:
   topic.js, drill.js, sheets/*.js, exportPrompt.js (ADDING-A-TOPIC.md).

     truth      the JS rules against keras-truth.json (written by
                verify_counts.py): every named model and every drill model
                (per-layer trainable / non-trainable / output shape), every
                drill `verify` item, the output-size sweep, softmax; and every
                count a slide prints (models.js `printed`) equals the rule's.
                A model the truth file doesn't have = stale: re-run
                export-specs.mjs + verify_counts.py
     content    per topic: id/title/lectures match its index line; the step
                budget; a one-sentence gist; Read ≤ 120 words with at most one
                table or formula; one lab per step; provenance on every step;
                every number of 100 or more in the Read text, the opener and
                the notebook pages either comes out of the maths modules or
                sits next to a provenance label (or under a receipted
                notebook heading)
     receipts   every "L3 · slide 22" anywhere in a topic is inside its deck
     labs       every <Stage> has a `prov`; a topic imports only from its own
                folder and the shared engine, never another topic
     prompts    NotebookLM prompts < 1,000 characters, each with self-test
                questions
     units      drillCheck.js (answers), richToken.js (provenance tokens)
   Placeholder text ("REPLACE ME") in a listed topic fails, unless
   ALLOW_PLACEHOLDERS=1 (while a new topic is being written).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/tricky-topics');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const N_SEEDS = Number(process.env.SEEDS || 200);
const ALLOW_PLACEHOLDERS = process.env.ALLOW_PLACEHOLDERS === '1';

const { TOPICS } = await imp('topics/index.js');
const { MODELS } = await imp('maths/models.js');
const { countModel } = await imp('maths/paramRules.js');
const { prod } = await imp('maths/shapeRules.js');
const { convOut, poolOut, convTOut } = await imp('maths/strideRules.js');
const { softmax } = await imp('maths/softmax.js');
const { LECTURES, parseReceipt } = await imp('lectures.js');
const { TOKEN, RECEIPT_RE, provOf } = await imp('richToken.js');
const { checkField, parseNumber, normText } = await imp('drillCheck.js');
const { sheetKeys } = await imp('sheetKeys.js');
const { NLM_LIMIT } = await imp('nlm.js');

let pass = 0;
const fails = [];
const ok = (cond, label, extra = '') => {
  if (cond) pass += 1;
  else {
    fails.push(label);
    console.log(`FAIL  ${label}${extra ? `  — ${extra}` : ''}`);
  }
};
const section = (name) => console.log(`\n── ${name}`);

/* ── 1. the JS rules against Keras ───────────────────────────────────────── */
section('truth: JS rules vs keras-truth.json');
const truthPath = path.join(HERE, 'keras-truth.json');
const truth = fs.existsSync(truthPath) ? JSON.parse(fs.readFileSync(truthPath, 'utf8')) : null;
ok(!!truth, 'keras-truth.json exists (run export-specs.mjs, then verify_counts.py in WSL)');
ok(truth && truth.fails.length === 0, 'verify_counts.py reported no failures', truth ? truth.fails.slice(0, 3).join('; ') : '');

const sameRows = (C, k) => k && k.rows.length === C.rows.length && C.rows.every((r, i) => r.trainable === k.rows[i].trainable && r.nonTrainable === k.rows[i].nonTrainable && JSON.stringify(r.out) === JSON.stringify(k.rows[i].out)) && C.trainable === k.trainable && C.nonTrainable === k.nonTrainable;

// the same iteration as export-specs.mjs, so the ids line up
const modelIds = [];
let named = 0;
for (const [id, m] of Object.entries(MODELS)) {
  const C = countModel(m.model);
  const k = truth?.models?.[id];
  ok(!!k, `truth has the named model ${id}`, 'stale: re-run export-specs.mjs + verify_counts.py');
  if (k) { ok(sameRows(C, k), `named model ${id}: every layer's counts and shape equal Keras's`); named += 1; }
  const pr = m.printed || {};
  if (pr.total !== undefined) ok(pr.total === C.total, `${id}: the slide's printed total ${pr.total} = the rule's ${C.total}`);
  if (pr.trainable !== undefined) ok(pr.trainable === C.trainable, `${id}: printed trainable ${pr.trainable} = ${C.trainable}`);
  if (pr.nonTrainable !== undefined) ok(pr.nonTrainable === C.nonTrainable, `${id}: printed non-trainable ${pr.nonTrainable} = ${C.nonTrainable}`);
  if (pr.perLayer) ok(JSON.stringify(pr.perLayer) === JSON.stringify(C.rows.map((r) => r.total)), `${id}: printed per-layer counts = the rule's`);
  modelIds.push(id);
}
const seen = new Set(Object.values(MODELS).map((m) => JSON.stringify(m.model)));
const checks = [];
const drills = {};
let drillModels = 0;
for (const t of TOPICS) {
  let drill;
  try { drill = await imp(`topics/${t.id}/drill.js`); } catch { drill = null; }
  drills[t.id] = drill;
  if (!drill) continue;
  const modes = drill.MODES ? drill.MODES.map((m) => m.value) : [undefined];
  const qs = [];
  for (const mode of modes) for (let seed = 1; seed <= N_SEEDS; seed++) qs.push(drill.make(seed, mode));
  (drill.FIXED ?? []).forEach((q) => qs.push(q));
  for (const q of qs) {
    if (q.model) {
      const key = JSON.stringify(q.model);
      if (!seen.has(key)) {
        seen.add(key);
        const id = `${t.id}:${q.id}`;
        const k = truth?.models?.[id];
        const C = countModel(q.model);
        if (!k) ok(false, `truth has drill model ${id}`, 'stale: re-run export-specs.mjs + verify_counts.py');
        else if (!sameRows(C, k)) ok(false, `drill model ${id} equals Keras`);
        else { pass += 1; drillModels += 1; }
      }
    }
    (Array.isArray(q.verify) ? q.verify : q.verify ? [q.verify] : []).forEach((v) => checks.push({ id: `${t.id}:${q.id}`, ...v }));
    // a question's fields must be answerable: every field has an answer, choices include it
    q.fields.forEach((f) => {
      if (f.type === 'choice' && !f.options.some((o) => o.value === f.answer)) ok(false, `${t.id}:${q.id} field ${f.key}: the answer is one of the options`);
      if (f.type === 'number' && !Number.isFinite(Number(f.answer))) ok(false, `${t.id}:${q.id} field ${f.key}: a numeric answer`);
    });
  }
}
console.log(`  ${named} named models and ${drillModels} drill models agree with Keras`);
ok(truth && truth.checks.length === checks.length, `truth has every drill verify item (${checks.length})`, truth ? `${truth.checks.length} in the file` : '');
checks.forEach((c, i) => {
  const k = truth?.checks?.[i];
  if (!k || k.id !== c.id) { ok(false, `verify item ${c.id} is in the truth file`, 'stale'); return; }
  if (c.kind === 'softmax') ok(k.ok && Math.max(...softmax(c.z).map((p, j) => Math.abs(p - c.p[j]))) < 1e-12, `${c.id}: softmax ${JSON.stringify(c.z)} = tf.nn.softmax`);
  else ok(k.ok && k.keras === c.out, `${c.id}: ${c.layer} n=${c.n} k=${c.k} s=${c.s} ${c.pad} → ${c.out} = Keras ${k.keras}`);
});
let sweepBad = 0;
(truth?.sweep ?? []).forEach((p) => {
  const good = convOut(p.n, p.k, p.s, p.pad) === p.conv1d && p.conv2d.every((v) => v === convOut(p.n, p.k, p.s, p.pad)) && p.pool.every((v) => v === poolOut(p.n, p.k, p.s, p.pad)) && p.convT.every((v) => v === convTOut(p.n, p.k, p.s, p.pad));
  if (!good) sweepBad += 1;
});
ok(truth && truth.sweep.length >= 2000 && sweepBad === 0, `strideRules.js = Keras on ${truth?.sweep?.length ?? 0} sweep points (Conv1D, Conv2D, MaxPool2D, Conv2DTranspose)`, `${sweepBad} disagree`);
(truth?.softmax ?? []).forEach((v) => ok(Math.max(...softmax(v.z).map((p, j) => Math.abs(p - v.p[j]))) < 1e-12, `softmax.js = tf.nn.softmax for ${JSON.stringify(v.z)}`));
ok(truth && truth.shiftInvariance < 1e-12, 'softmax shift invariance (Keras)');

/* ── 2. the numbers the maths modules can produce ────────────────────────── */
const computed = new Set();
const addNum = (v) => { if (Number.isFinite(v)) computed.add(Math.round(v * 1000) / 1000); };
for (const m of Object.values(MODELS)) {
  const C = countModel(m.model);
  [C.total, C.trainable, C.nonTrainable].forEach(addNum);
  C.rows.forEach((r) => {
    [r.total, r.trainable, r.nonTrainable, prod(r.out), ...r.out, ...r.ins.flat()].forEach(addNum);
    r.weights.forEach((w) => { addNum(w.n); w.shape.forEach(addNum); });
  });
  m.model.input.forEach(addNum);
  addNum(prod(m.model.input));
}
const numsIn = (s) => (String(s).replace(RECEIPT_RE, '').replace(/\[[^\]]*\]\([^)]*\)/g, '').match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, '')));
const hasProv = (s) => /\{(?:s\|[^{}]+|own|beyond)\}/.test(String(s));

/* ── 3. per topic ────────────────────────────────────────────────────────── */
const STEP_BUDGET = { 'param-count': 12, shapes: 7, softmax: 6, stride: 6 };
const DEFAULT_STEPS = 8;
const wordsOf = (s) => String(s)
  .replace(/\{(?:s\|[^{}]+|own|beyond)\}/g, '')
  .replace(/\$[^$]*\$/g, 'x')
  .replace(/`[^`]*`/g, 'x')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[*_]/g, '')
  .split(/\s+/)
  .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? filesUnder(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

const ids = new Set();
for (const t of TOPICS) {
  section(`topic ${t.id}`);
  ok(!ids.has(t.id), `${t.id}: id is unique in topics/index.js`);
  ids.add(t.id);
  ok(t.id !== '_template', `${t.id}: the template is not listed`);
  ok(typeof t.load === 'function' && String(t.load).includes(`./${t.id}/index.js`), `${t.id}: load() imports ./${t.id}/index.js`);
  ok(Array.isArray(t.lectures) && t.lectures.length > 0 && t.lectures.every((l) => LECTURES[l]), `${t.id}: lectures are real decks (${t.lectures?.join(' ')})`);
  ok(t.blurb && !/REPLACE ME/.test(t.blurb), `${t.id}: index line has a blurb`);
  const dir = path.join(ROOT, 'topics', t.id);
  let topic;
  try { topic = (await imp(`topics/${t.id}/topic.js`)).default; } catch (e) { ok(false, `${t.id}: topic.js imports in node`, e.message); continue; }
  ok(topic.id === t.id, `${t.id}: topic.js id matches the index`);
  ok(topic.title === t.title, `${t.id}: topic.js title matches the index ("${topic.title}" vs "${t.title}")`);
  ok(JSON.stringify(topic.lectures) === JSON.stringify(t.lectures), `${t.id}: topic.js lectures match the index line`);
  ok(topic.oneLine && wordsOf(topic.oneLine) <= 40, `${t.id}: the one-sentence opener (≤ 40 words)`, `${wordsOf(topic.oneLine ?? '')} words`);
  ok(topic.hero?.lab, `${t.id}: a hero animation`);
  ok(topic.showsUp?.length > 0, `${t.id}: "where it shows up" has rows`);
  ok(topic.examAsks?.length > 0, `${t.id}: "what the exam asks" has rows`);
  (topic.examAsks ?? []).forEach((r) => ok(/^(Sample|Practice [AB]) Q[1-4]\([a-e]\)/.test(r.part), `${t.id}: exam link "${r.part}" names an Exam Practice part`));
  (topic.showsUp ?? []).forEach((r) => {
    const rc = parseReceipt(r.at);
    ok(rc && rc.slides.length && rc.slides.every((n) => n >= 1 && n <= LECTURES[rc.lec].slides), `${t.id}: shows-up receipt "${r.at}" is inside its deck`);
  });
  const budget = STEP_BUDGET[t.id] ?? DEFAULT_STEPS;
  ok(topic.steps.length >= 1 && topic.steps.length <= budget, `${t.id}: ${topic.steps.length} steps (budget ${budget})`);
  const labsSrc = fs.readFileSync(path.join(dir, 'labs/index.js'), 'utf8');
  const hasLab = (key) => new RegExp(`(^|[\\s{,])${key}\\s*:`, 'm').test(labsSrc);
  ok(hasLab(topic.hero?.lab ?? 'hero'), `${t.id}: labs/index.js has the hero "${topic.hero?.lab}"`);
  ok(hasLab(topic.drill?.lab ?? 'drill'), `${t.id}: labs/index.js has the drill "${topic.drill?.lab}"`);
  const stepIds = new Set();
  topic.steps.forEach((s) => {
    ok(s.id && !stepIds.has(s.id) && !['open', 'drill', 'write'].includes(s.id) && !/^p\d+$/.test(s.id), `${t.id}/${s.id}: a unique step id`);
    stepIds.add(s.id);
    ok(s.title && s.short, `${t.id}/${s.id}: title and short label`);
    ok(s.prov && hasProv(s.prov), `${t.id}/${s.id}: provenance labels on the step`);
    const g = String(s.gist ?? '').replace(/\$[^$]*\$/g, 'x').replace(/`[^`]*`/g, 'x');
    ok(g && !/[.!?]\s+[A-Z“]/.test(g.trim().slice(0, -1)), `${t.id}/${s.id}: the gist is one sentence`);
    const prose = [];
    let tables = 0;
    s.read.forEach((b) => {
      if (typeof b === 'string') prose.push(b);
      else if (b.list) prose.push(...b.list);
      else if (b.table || b.eq) tables += 1;
    });
    const words = prose.reduce((a, p) => a + wordsOf(p), 0);
    ok(words <= 120, `${t.id}/${s.id}: Read ≤ 120 words`, `${words} words`);
    ok(tables <= 1, `${t.id}/${s.id}: at most one table or formula`, `${tables}`);
    ok(s.play?.length === 1 && hasLab(s.play[0]), `${t.id}/${s.id}: one lab, listed in labs/index.js (${s.play?.join(', ')})`);
    // numbers ≥ 100 come from the maths or sit next to a provenance label
    const segs = [];
    s.read.forEach((b) => {
      if (typeof b === 'string') segs.push(b);
      else if (b.list) segs.push(...b.list);
      else if (b.table) b.table.rows.forEach((r) => segs.push(r.join(' | ')));
      else if (b.eq) segs.push(`${b.eq.tex} ${b.eq.prov ?? ''}`);
      else if (b.note) segs.push(b.note);
    });
    segs.forEach((seg) => {
      const loose = numsIn(seg).filter((n) => n >= 100 && !computed.has(n));
      if (loose.length && !hasProv(seg)) ok(false, `${t.id}/${s.id}: numbers ${loose.join(', ')} trace to a rule or a label`, seg.slice(0, 80));
      else pass += 1;
    });
  });
  // the opener's rows: every number traces too
  (topic.showsUp ?? []).forEach((r) => pass += 1);
  // receipts anywhere in the topic's files are inside their decks
  const files = filesUnder(dir).filter((f) => /\.(js|jsx)$/.test(f));
  let receipts = 0;
  files.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\{s\|(L\d[^{}]*?)\}/g)) {
      const rc = parseReceipt(m[1]);
      receipts += 1;
      ok(rc && rc.slides.every((n) => n >= 1 && n <= LECTURES[rc.lec].slides), `${t.id}: receipt "${m[1]}" (${path.basename(f)}) is inside its deck`);
    }
    if (!ALLOW_PLACEHOLDERS) ok(!/REPLACE ME|__TOPIC_(ID|TITLE)__/.test(src), `${t.id}: no placeholder text left in ${path.relative(dir, f)}`);
    // isolation: imports stay in this folder or the shared engine
    for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(f), m[1]);
      const rel = path.relative(path.join(ROOT, 'topics'), target);
      const inOther = !rel.startsWith('..') && rel.split(path.sep)[0] !== t.id && rel.split(path.sep)[0] !== 'index.js';
      ok(!inOther, `${t.id}: ${path.basename(f)} imports nothing from another topic (${m[1]})`);
    }
    // every lab frame carries provenance
    const stages = (src.match(/<Stage\b/g) || []).length;
    const provs = (src.match(/<Stage\b[\s\S]*?\bprov=/g) || []).length;
    if (stages) ok(provs === stages, `${t.id}: every <Stage> in ${path.basename(f)} has prov`, `${provs}/${stages}`);
  });
  console.log(`  ${receipts} slide receipts checked`);
  // notebook pages
  let sheets;
  try { sheets = (await imp(`topics/${t.id}/sheets/index.js`)).SHEETS; } catch (e) { ok(false, `${t.id}: sheets/index.js imports`, e.message); sheets = []; }
  ok(sheets.length >= 1, `${t.id}: at least one notebook page`);
  sheets.forEach(({ page, sheet }) => {
    const keys = sheetKeys(sheet);
    ok(new Set(keys).size === keys.length, `${t.id}/${page.id}: tick keys are unique`);
    ok(new Set(sheet.blocks.map((b) => b.id)).size === sheet.blocks.length, `${t.id}/${page.id}: block ids are unique`);
    ok(!!sheet.skip, `${t.id}/${page.id}: ends with a "Not on this page" line`);
    sheet.blocks.forEach((b) => {
      const text = JSON.stringify(b.items);
      const loose = numsIn(text.replace(/\\\\[a-z]+/g, ' ')).filter((n) => n >= 100 && !computed.has(n));
      ok(!loose.length || !!b.at, `${t.id}/${page.id}/${b.id}: numbers sit under a receipted heading`, loose.join(', '));
    });
  });
  // prompts
  let prompts;
  try { prompts = (await imp(`topics/${t.id}/exportPrompt.js`)).PROMPTS; } catch (e) { ok(false, `${t.id}: exportPrompt.js imports`, e.message); prompts = null; }
  if (prompts) {
    [prompts.single, ...(prompts.parts ?? [])].forEach((p, i) => {
      ok(p.text.length < NLM_LIMIT, `${t.id}: prompt ${i === 0 ? 'single' : `part ${i}`} < ${NLM_LIMIT} characters`, `${p.text.length}`);
      ok(/self-test question/.test(p.text), `${t.id}: prompt ${i === 0 ? 'single' : `part ${i}`} ends with self-test questions`);
      ok(/beyond the slides/.test(p.text), `${t.id}: prompt ${i === 0 ? 'single' : `part ${i}`} says what is beyond the slides`);
    });
  }
}

/* ── 4. the template stays a template ────────────────────────────────────── */
section('template');
const tplDir = path.join(ROOT, 'topics/_template');
ok(fs.existsSync(tplDir), 'topics/_template exists');
ok(filesUnder(tplDir).some((f) => /REPLACE ME/.test(fs.readFileSync(f, 'utf8'))), 'the template is marked REPLACE ME');
ok(filesUnder(tplDir).some((f) => /__TOPIC_ID__/.test(fs.readFileSync(f, 'utf8'))), 'the template carries the __TOPIC_ID__ token the scaffold fills in');

/* ── 5. units ────────────────────────────────────────────────────────────── */
section('units');
ok(parseNumber('235,500') === 235500 && parseNumber(' 1 401 ') === 1401 && Number.isNaN(parseNumber('12a')), 'parseNumber: commas and spaces');
ok(checkField({ type: 'number', answer: 0.66, tol: 0.011 }, '0.659') && !checkField({ type: 'number', answer: 0.66, tol: 0.011 }, '0.64'), 'checkField: tolerance');
ok(normText('(None, 14, 14, 64)') === normText('none,14,14,64') && normText('[None, 14,14, 64]') === normText('(None,14,14,64)'), 'normText: shapes ignore spaces, brackets, case');
ok(checkField({ type: 'text', answer: '(200,)', accept: [] }, '(200, )'), 'checkField: (200, ) = (200,)');
const tok = (s) => { const m = TOKEN.exec(s); return m ? m[0] : null; };
ok(tok('see {s|L3 · slide 22} here') === '{s|L3 · slide 22}' && provOf('{s|L3 · slide 22}').text === 'L3 · slide 22', 'richToken: slide receipts');
ok(tok('a {own} b') === '{own}' && tok('a {beyond} b') === '{beyond}' && provOf('{own}').kind === 'own', 'richToken: own / beyond labels');
ok(tok('[shapes](@shapes)') === '[shapes](@shapes)' && tok('[x](@param-count#conv)') === '[x](@param-count#conv)', 'richToken: cross-topic links');
ok(tok('***bold it*** x') === '***bold it***', 'richToken: bold italic first');
ok(parseReceipt('L4 · slides 25, 27, 29')?.slides.join() === '25,27,29' && parseReceipt('L6–7 · slides 5–6')?.lec === 'L6–7', 'parseReceipt: lists and ranges');

console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASSED'} · ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
