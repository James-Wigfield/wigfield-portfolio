/* ============================================================================
   DL PROJECT 2 — NOTEBOOK EXTRACTOR
   ----------------------------------------------------------------------------
   Turns the executed .ipynb into the portal module's data file plus its
   figures. Nothing in the notebook is ever copied by hand: re-run this after
   the notebook changes and the page follows.

     node tools/dl-project2/extract.mjs                  # the real notebook
     node tools/dl-project2/extract.mjs --nb <x.ipynb> --out <dir>

   Writes, under --out (default: the module folder):
     data/notebook.js     NB_META (filename, sha256, extraction date, kernel,
                          cell counts, run checks) + SECTIONS + CELLS
     figures/cellNN_k.png every image/png output, NN = cell index, k = the
                          image's position among that cell's images (from 0)

   Per cell: index, type, execution count, verbatim source, the headings it
   carries (with the DOM ids the page uses), and its outputs. Outputs keep
   Jupyter's own kinds (stream / execute_result / display_data / error); text
   is ANSI-stripped and carriage-return progress lines are collapsed; text/html
   is never kept when a text/plain sibling exists (and never rendered as HTML).
   The notebook file itself is only ever read.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DEFAULT_NB = 'C:/Users/james/Documents/university/cits5017/cits5017-project-two/Wigfield_James-proj2.ipynb';
const DEFAULT_OUT = path.join(REPO, 'src/components/portal/modules/deep-learning/project2');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const NB_PATH = path.resolve(opt('--nb', DEFAULT_NB));
const OUT = path.resolve(opt('--out', DEFAULT_OUT));

const raw = fs.readFileSync(NB_PATH);
const nb = JSON.parse(raw.toString('utf8'));
const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
const mtime = fs.statSync(NB_PATH).mtime.toISOString();

const joinSrc = (s) => (Array.isArray(s) ? s.join('') : s || '');

// ── text clean-up ───────────────────────────────────────────────────────────
// ANSI CSI / OSC escapes out; a carriage return keeps only what was printed
// last on that line (progress bars), exactly as a terminal would show it.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
function clean(text) {
  return text
    .replace(ANSI, '')
    .split('\n')
    .map((line) => {
      if (!line.includes('\r')) return line;
      const parts = line.split('\r').filter((p) => p !== '');
      return parts.length ? parts[parts.length - 1] : '';
    })
    .join('\n');
}

// TensorFlow / XLA / absl log lines (and their indented continuations).
const TF_LOG = [
  /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+: [IWEF] /, // 2026-10-17 12:00:00.123456: I tensorflow/...
  /^[IWEF]\d{4} \d\d:\d\d:\d+\.\d+\s+\d+ /, // I0000 00:00:1789012657.531744  3679 gpu_device.cc:2043]
  /^WARNING: All log messages before absl::InitializeLog\(\)/,
  /^To enable the following instructions/,
  /^WARNING:tensorflow:/,
  /^Please upgrade to CUDA /, // second line of the ptxas version warning
];
const isTfLog = (line) => TF_LOG.some((re) => re.test(line));

// ── headings → DOM ids (the page's markdown renderer consumes these in order)
const usedIds = new Set();
function slug(text) {
  const base = `dlp2-h-${text
    .toLowerCase()
    .replace(/[`*_$\\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section'}`;
  let id = base;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}
function headingsOf(md) {
  const out = [];
  let fence = false;
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2], id: slug(m[2]) });
  }
  return out;
}

// ── PNG size from the IHDR chunk ────────────────────────────────────────────
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ── outputs ─────────────────────────────────────────────────────────────────
const figDir = path.join(OUT, 'figures');
fs.mkdirSync(figDir, { recursive: true });
for (const f of fs.readdirSync(figDir)) if (/^cell\d+_\d+\.png$/.test(f)) fs.unlinkSync(path.join(figDir, f));
const pad = (n) => String(n).padStart(2, '0');
let imageCount = 0;

function mimeText(data, key) {
  return data[key] === undefined ? undefined : clean(joinSrc(data[key]));
}

function convertOutputs(cell, ci) {
  let k = 0;
  return (cell.outputs || []).map((o) => {
    if (o.output_type === 'stream') {
      const text = clean(joinSrc(o.text));
      const lines = text.replace(/\n$/, '').split('\n');
      const nonEmpty = lines.filter((l) => l.trim() !== '');
      const tfLines = nonEmpty.filter(isTfLog).length;
      return {
        kind: 'stream',
        name: o.name,
        text,
        lines: lines.length,
        // the whole block is TF log noise: indented continuations ride along
        noise: o.name === 'stderr' && tfLines > 0 && nonEmpty.every((l) => isTfLog(l) || /^\s/.test(l)),
        tfLines,
      };
    }
    if (o.output_type === 'error') {
      return { kind: 'error', ename: o.ename, evalue: clean(o.evalue || ''), traceback: clean((o.traceback || []).join('\n')) };
    }
    if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
      const data = o.data || {};
      const out = { kind: o.output_type };
      if (o.output_type === 'execute_result') out.ec = o.execution_count ?? null;
      if (data['image/png']) {
        const buf = Buffer.from(joinSrc(data['image/png']).replace(/\s+/g, ''), 'base64');
        const name = `cell${pad(ci)}_${k++}.png`;
        fs.writeFileSync(path.join(figDir, name), buf);
        imageCount += 1;
        out.png = name;
        const size = pngSize(buf);
        if (size) Object.assign(out, size);
        const meta = o.metadata?.['image/png'];
        if (meta?.width) out.dispW = meta.width;
      }
      const plain = mimeText(data, 'text/plain');
      if (plain !== undefined) out.text = plain;
      else if (data['text/html'] !== undefined) {
        // last resort: an html-only output becomes its visible text, flagged
        out.text = clean(joinSrc(data['text/html']).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
        out.fromHtml = true;
      }
      out.mimes = Object.keys(data);
      return out;
    }
    return { kind: 'unknown', type: o.output_type };
  });
}

// ── cells ───────────────────────────────────────────────────────────────────
const CELLS = nb.cells.map((c, i) => {
  const src = joinSrc(c.source);
  const cell = { i, type: c.cell_type, src };
  if (c.cell_type === 'code') {
    cell.ec = c.execution_count ?? null;
    cell.outputs = convertOutputs(c, i);
  }
  if (c.cell_type === 'markdown') {
    const hs = headingsOf(src);
    if (hs.length) cell.headings = hs;
  }
  return cell;
});

// ── sections: a markdown cell whose FIRST line is an h1/h2 opens one ─────────
// key: 'title' for cell 0's h1, 's<N>' for "## N. Title", 'part-<x>' for
// "# Part (x)", otherwise the heading id. An explainer attaches to a key and
// renders after the section's last cell.
const SECTIONS = [];
CELLS.forEach((c) => {
  const first = c.headings?.[0];
  if (!first || first.level > 2) return;
  if (!/^\s*#{1,2}\s/.test(c.src.replace(/^\s*\n/, ''))) return;
  let key = first.id;
  const num = /^(\d+)\.\s/.exec(first.text);
  const part = /^Part \(([^)]+)\)/i.exec(first.text);
  if (c.i === 0 && first.level === 1) key = 'title';
  else if (num) key = `s${num[1]}`;
  else if (part) key = `part-${part[1].toLowerCase()}`;
  SECTIONS.push({ key, level: first.level, no: num ? Number(num[1]) : null, title: first.text, id: first.id, start: c.i });
});
SECTIONS.forEach((s, j) => {
  s.end = (SECTIONS[j + 1]?.start ?? CELLS.length) - 1;
});

// ── run checks ──────────────────────────────────────────────────────────────
const codeCells = CELLS.filter((c) => c.type === 'code');
const ecs = codeCells.map((c) => c.ec);
const executed = codeCells.filter((c) => c.ec !== null);
const sequential = executed.length === codeCells.length && ecs.every((e, j) => e === j + 1);
const errors = codeCells.reduce((n, c) => n + c.outputs.filter((o) => o.kind === 'error').length, 0);

const NB_META = {
  filename: path.basename(NB_PATH),
  sha256,
  sha12: sha256.slice(0, 12),
  bytes: raw.length,
  notebookModified: mtime,
  extractedAt: new Date().toISOString(),
  nbformat: `${nb.nbformat}.${nb.nbformat_minor}`,
  kernel: nb.metadata?.kernelspec?.display_name || null,
  kernelName: nb.metadata?.kernelspec?.name || null,
  language: nb.metadata?.language_info?.name || null,
  languageVersion: nb.metadata?.language_info?.version || null,
  cells: CELLS.length,
  markdownCells: CELLS.filter((c) => c.type === 'markdown').length,
  codeCells: codeCells.length,
  images: imageCount,
  executionCounts: { sequential, first: ecs[0] ?? null, last: ecs[ecs.length - 1] ?? null, unexecuted: codeCells.length - executed.length },
  errors,
};

// ── write the module data file ──────────────────────────────────────────────
const dataDir = path.join(OUT, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const body = [
  '/* GENERATED by tools/dl-project2/extract.mjs from the executed notebook.',
  '   Do not edit by hand: re-run the extractor and the page follows. */',
  `export const NB_META = ${JSON.stringify(NB_META, null, 2)};`,
  '',
  `export const SECTIONS = ${JSON.stringify(SECTIONS, null, 1)};`,
  '',
  'export const CELLS = [',
  ...CELLS.map((c) => `  ${JSON.stringify(c)},`),
  '];',
  '',
].join('\n');
fs.writeFileSync(path.join(dataDir, 'notebook.js'), body);

console.log(`notebook   ${NB_PATH}`);
console.log(`sha256     ${sha256}`);
console.log(`cells      ${CELLS.length} (${NB_META.markdownCells} markdown, ${NB_META.codeCells} code)`);
console.log(`counts     sequential=${sequential} first=${NB_META.executionCounts.first} last=${NB_META.executionCounts.last} unexecuted=${NB_META.executionCounts.unexecuted}`);
console.log(`errors     ${errors}`);
console.log(`images     ${imageCount} → ${figDir}`);
console.log(`sections   ${SECTIONS.map((s) => `${s.key}[${s.start}-${s.end}]`).join(' ')}`);
console.log(`wrote      ${path.join(dataDir, 'notebook.js')} (${(body.length / 1024).toFixed(1)} KB)`);
