/* ============================================================================
   DL LECTURE 4 STUDY — check the student-notes sheets (data only, no browser)
   ----------------------------------------------------------------------------
     node tools/dl-lecture4-study/check-sheets.mjs [ids…] [--verbose]

   For every section's sheets/sNN.js, against the legacy content of the same
   section in sections.js:

   errors (exit 1)
     shape       only the documented block / item / aside kinds and fields;
                 unique block ids; unique tick keys; table rows as wide as
                 their head; balanced $…$ and {g|…}
     figures     every fig key exists, every hl part is one of the figure's
                 parts (sheets/figParts.js), and those agree with the
                 <P k> marks in diagrams.jsx
     coverage    every legacy "Draw this" figure is on the sheet; every
                 legacy check question is a margin Q; every number of 10 or
                 more (or with a decimal point) in the legacy notes, formulas
                 and worked number appears on the sheet
     new facts   every number on the sheet appears in the section's legacy
                 content (any field, including Read) or in the transcript
   warnings
     formulas    a legacy formula whose TeX isn't found verbatim on the sheet
     green       more than 4 green runs in a block, or > 22% of the text
     load        the sheet asks for more writing than the legacy page
                 (characters of copyable text, TeX commands stripped)
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOD = path.join(REPO, 'src/components/portal/modules/deep-learning/lecture4-study');
const TRANSCRIPT = fs.readFileSync(path.join(REPO, 'Documents/cits5017/markdown-lecs/lecture-4.md'), 'utf8');
const imp = (p) => import(pathToFileURL(path.join(MOD, p)).href);
const { SECTIONS } = await imp('sections.js');
const { sheetKeys } = await imp('sheets/keys.js');
const { FIG_PARTS } = await imp('sheets/figParts.js');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const only = args.filter((a) => !a.startsWith('--'));

let errors = 0;
let warnings = 0;
const err = (id, msg) => { errors += 1; console.log(`  ERROR ${id}: ${msg}`); };
const warn = (id, msg) => { warnings += 1; console.log(`  warn  ${id}: ${msg}`); };

// ── diagrams.jsx <P k> marks vs FIG_PARTS ─────────────────────────────────
{
  const src = fs.readFileSync(path.join(MOD, 'diagrams.jsx'), 'utf8');
  const literal = new Set([...src.matchAll(/<P (?:key=\{[^}]+\} )?k="([^"…]+)"/g)].map((m) => m[1]));
  const all = new Set(Object.values(FIG_PARTS).flat());
  // keys built in code (w${k}, s${s}, ternaries) are listed by hand in FIG_PARTS
  [...literal].filter((k) => !all.has(k)).forEach((k) => err('diagrams', `<P k="${k}"> is not listed in sheets/figParts.js`));
}

// ── text helpers ─────────────────────────────────────────────────────────
const NUM = /(?<![\w.])\d+(?:,\d{3})*(?:\.\d+)?/g;
const norm = (s) => String(s).replace(/\{,\}/g, ',').replace(/\\,/g, '');
const numbers = (s) => (norm(s).match(NUM) || []).map((n) => n.replace(/,/g, ''));
const big = (n) => n.includes('.') || Number(n) >= 10;
// approximate written length: drop markup and TeX commands
const ink = (s) => String(s)
  .replace(/\{g\|/g, '')
  .replace(/\\(?:mathbf|mathrm|text|texttt|mathscr|operatorname|left|right|big|Big|quad|qquad|underbrace|top|ldots|cdots|vdots|in|times|to|longrightarrow|lfloor|rfloor|lceil|rceil|frac|sum|otimes|varphi|sigma|tanh|hat|mathbb|begin|end|aligned|bmatrix)\b/g, ' ')
  .replace(/\\[a-zA-Z]+/g, 'x')
  .replace(/[{}$`*_^\\|]/g, '')
  .replace(/\s+/g, '').length;

const texts = (x) => {
  // every string inside a value, depth-first (a table's `cols` is CSS, not content)
  if (typeof x === 'string') return [x];
  if (Array.isArray(x)) return x.flatMap(texts);
  if (x && typeof x === 'object') return Object.entries(x).filter(([k]) => k !== 'cols').flatMap(([, v]) => texts(v));
  return [];
};

const ITEM_FIELDS = {
  line: ['line'],
  steps: ['steps'],
  sub: ['sub'],
  formula: ['formula', 'read', 'tag'],
  code: ['code', 'read', 'tag'],
  worked: ['worked', 'title'],
  table: ['table'],
  arrow: ['arrow'],
  fig: ['fig', 'hl', 'cap'],
};
const BLOCK_FIELDS = ['id', 'h', 'at', 'items', 'fig', 'margin'];
const ASIDES = ['nb', 'ne', 'hook', 'q', 'sc'];

function balanced(id, s) {
  const dollars = (s.replace(/\\\$/g, '').match(/\$/g) || []).length;
  if (dollars % 2) err(id, `unbalanced $ in “${s.slice(0, 60)}”`);
  let i = s.indexOf('{g|');
  while (i !== -1) {
    let depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth += 1;
      else if (s[j] === '}' && --depth === 0) { end = j; break; }
    }
    if (end === -1) { err(id, `unclosed {g| in “${s.slice(0, 60)}”`); break; }
    i = s.indexOf('{g|', end);
  }
}

function checkFig(id, key, hl) {
  if (!FIG_PARTS[key]) return err(id, `unknown figure "${key}"`);
  (hl || []).forEach((p) => { if (!FIG_PARTS[key].includes(p)) err(id, `figure ${key} has no part "${p}" (has ${FIG_PARTS[key].join(', ')})`); });
  return null;
}

const legacyCopy = (s) => [
  ...s.notes.flatMap((g) => [g.h, ...g.lines]),
  ...(s.formulas || []).flatMap((f) => [f.tex || f.code, f.read]),
  ...(s.worked ? [s.worked.title, ...s.worked.lines] : []),
];

function sheetCopy(sh) {
  const out = sh.big ? [sh.big] : [];
  sh.blocks.forEach((b) => {
    b.items.forEach((it) => {
      if (typeof it === 'string') out.push(it);
      else if (it.sub) out.push(it.sub);
      else if (it.table) out.push(...texts([it.table.head, it.table.rows]));
      else out.push(...texts({ ...it, hl: undefined, tag: undefined }));
    });
    if (b.h) out.push(b.h);
    if (b.fig?.cap) out.push(b.fig.cap);
    (b.margin || []).forEach((a) => { if (a.nb || a.ne || a.hook) out.push(a.nb || a.ne || a.hook); });
  });
  return out;
}

const overlap = (a, b) => {
  const toks = (s) => new Set(norm(s).toLowerCase().replace(/\$[^$]*\$/g, ' tex ').match(/[a-z0-9]+/g) || []);
  const A = toks(a);
  const B = toks(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
};

let report = [];
for (const s of SECTIONS) {
  if (only.length && !only.includes(s.id)) continue;
  const file = path.join(MOD, 'sheets', `${s.id}.js`);
  if (!fs.existsSync(file)) { err(s.id, 'no sheet file'); continue; }
  console.log(`§${s.no} ${s.id}`);
  const sh = (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default;
  const id = s.id;
  if (!sh || !Array.isArray(sh.blocks)) { err(id, 'default export needs a blocks array'); continue; }
  Object.keys(sh).filter((k) => !['big', 'blocks'].includes(k)).forEach((k) => err(id, `unknown sheet field "${k}"`));
  const ids = new Set();
  const figsUsed = new Set();
  const qs = [];
  sh.blocks.forEach((b, bi) => {
    const bid = `${id}/${b.id ?? `#${bi}`}`;
    if (!b.id || typeof b.id !== 'string' || /[:\s]/.test(b.id)) err(bid, 'block needs an id (no spaces or colons)');
    if (ids.has(b.id)) err(bid, 'duplicate block id');
    ids.add(b.id);
    Object.keys(b).filter((k) => !BLOCK_FIELDS.includes(k)).forEach((k) => err(bid, `unknown block field "${k}"`));
    if (!Array.isArray(b.items)) err(bid, 'items must be an array');
    (b.items || []).forEach((it, i) => {
      if (typeof it === 'string') return;
      const kind = Object.keys(ITEM_FIELDS).find((k) => it[k] !== undefined);
      if (!kind) return err(bid, `item ${i} has no known kind (${Object.keys(it).join(', ')})`);
      Object.keys(it).filter((k) => !ITEM_FIELDS[kind].includes(k)).forEach((k) => err(bid, `item ${i} (${kind}) has unknown field "${k}"`));
      if (kind === 'steps' && (!Array.isArray(it.steps) || !it.steps.length)) err(bid, `item ${i}: steps must be a non-empty array`);
      if (kind === 'worked' && (!Array.isArray(it.worked) || !it.worked.length)) err(bid, `item ${i}: worked must be a non-empty array`);
      if (kind === 'table') {
        const { head, rows } = it.table;
        if (!Array.isArray(head) || !Array.isArray(rows) || !rows.length) err(bid, `item ${i}: table needs head and rows`);
        else rows.forEach((r, j) => { if (r.length !== head.length) err(bid, `item ${i}: table row ${j} has ${r.length} cells, head has ${head.length}`); });
        Object.keys(it.table).filter((k) => !['head', 'rows', 'cols'].includes(k)).forEach((k) => err(bid, `table has unknown field "${k}"`));
      }
      if (kind === 'arrow' && (!Array.isArray(it.arrow) || it.arrow.length !== 2)) err(bid, `item ${i}: arrow needs [cause, effect]`);
      if (kind === 'fig') { checkFig(bid, it.fig, it.hl); figsUsed.add(it.fig); }
    });
    if (b.fig) {
      Object.keys(b.fig).filter((k) => !['key', 'hl', 'cap', 'place'].includes(k)).forEach((k) => err(bid, `fig has unknown field "${k}"`));
      if (b.fig.place && !['below', 'side', 'above'].includes(b.fig.place)) err(bid, `fig.place must be below, side or above`);
      checkFig(bid, b.fig.key, b.fig.hl);
      figsUsed.add(b.fig.key);
    }
    (b.margin || []).forEach((a, k) => {
      const kinds = Object.keys(a).filter((x) => ASIDES.includes(x));
      if (kinds.length !== 1 || Object.keys(a).some((x) => !ASIDES.includes(x) && x !== 'a')) err(bid, `margin ${k}: one of ${ASIDES.join(', ')} (and "a" with "q")`);
      if (a.q !== undefined && !a.a) err(bid, `margin ${k}: a question needs an answer`);
      if (a.q) qs.push(a.q);
    });
    const greens = texts(b).join(' ').split('{g|').length - 1;
    if (greens > 4) warn(bid, `${greens} green runs in one block`);
  });
  texts(sh).forEach((t) => balanced(id, t));
  const keys = sheetKeys(sh);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) err(id, `duplicate tick keys ${dup.join(', ')}`);

  // coverage
  (s.draw || []).forEach((d) => { if (!figsUsed.has(d.fig)) err(id, `legacy figure "${d.fig}" is not on the sheet`); });
  (s.check || []).forEach((c) => {
    const best = Math.max(0, ...qs.map((q) => overlap(c.q, q)));
    if (best < 0.6) err(id, `legacy check question missing from the margin: “${c.q.slice(0, 70)}”`);
  });
  const sheetText = texts(sh).join(' \n ');
  const sheetNums = new Set(numbers(sheetText));
  const legacyNums = [...new Set(legacyCopy(s).flatMap(numbers))];
  // a rounded legacy number is covered by a more precise one (42,143.3 by 42,143.27)
  const covered = (n) => sheetNums.has(n) || (n.includes('.') && [...sheetNums].some((m) => {
    const dp = n.split('.')[1].length;
    return m.includes('.') && m.split('.')[1].length > dp && Math.abs(Number(m) - Number(n)) <= 0.5 * 10 ** -dp + 1e-12;
  }));
  legacyNums.filter(big).filter((n) => !covered(n)).forEach((n) => err(id, `legacy number ${n} is not on the sheet`));
  const refNums = new Set([...numbers(texts(s).join(' ')), ...numbers(TRANSCRIPT)]);
  [...sheetNums].filter((n) => !refNums.has(n)).forEach((n) => err(id, `number ${n} on the sheet is in neither the legacy section nor the transcript`));
  (s.formulas || []).filter((f) => f.tex).forEach((f) => {
    const flat = (x) => x.replace(/\s+/g, '');
    if (!flat(sheetText).includes(flat(f.tex))) warn(id, `legacy formula not found verbatim: ${f.tex.slice(0, 60)}…`);
  });

  // green share + copy load
  const greenChars = [...sheetText.matchAll(/\{g\|([^}]*)\}/g)].reduce((a, m) => a + ink(m[1]), 0);
  const total = ink(sheetCopy(sh).join(' '));
  const legacy = ink(legacyCopy(s).join(' '));
  if (total && greenChars / total > 0.22) warn(id, `green is ${Math.round((greenChars / total) * 100)}% of the text`);
  if (total > legacy) warn(id, `copy load ${total} chars vs legacy ${legacy} (${Math.round((total / legacy) * 100)}%)`);
  report.push({ id, ticks: keys.length, legacyLines: s.notes.reduce((a, g) => a + g.lines.length, 0), chars: total, legacy, pct: Math.round((total / legacy) * 100), green: Math.round((greenChars / Math.max(1, total)) * 100), qs: qs.length });
}

if (verbose || only.length !== 1) {
  console.log('\nid     ticks  legacy-lines  chars / legacy   green  Qs');
  report.forEach((r) => console.log(`${r.id.padEnd(6)} ${String(r.ticks).padStart(5)}  ${String(r.legacyLines).padStart(12)}  ${String(r.chars).padStart(5)} / ${String(r.legacy).padEnd(5)} ${String(r.pct).padStart(4)}%  ${String(r.green).padStart(4)}%  ${r.qs}`));
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
