// Fact check for /skippers: every "Numbers to know" row and every question
// carries a printed workbook page, and each fact's figure (its numbers, or
// its key word) appears in the workbook text on that page (± 1 page, since
// tables and figures sit beside their prose).
//   node tools/skippers/fact-check.mjs [--sample 20]
// Needs Documents/skippers/source/MAC_P_RST_Workbook2026.pdf (download link in
// src/skippers/README.md) and pdftotext on PATH. The extracted text is cached
// next to the PDF (the source folder is git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'Documents/skippers/source');
const pdf = path.join(src, 'MAC_P_RST_Workbook2026.pdf');
const txt = path.join(src, 'workbook-pages.txt');
if (!fs.existsSync(txt)) {
  if (!fs.existsSync(pdf)) {
    console.error(`Missing ${pdf} — download it first (see src/skippers/README.md).`);
    process.exit(2);
  }
  execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, txt]);
}
// printed page n = PDF page n + 2; pdftotext separates PDF pages with \f
const pdfPages = fs.readFileSync(txt, 'utf8').split('\f');
const printed = (n) => (pdfPages[n + 1] ?? '').replace(/\s+/g, ' ');
const near = (n) => [n - 1, n, n + 1].map(printed).join(' ');

const { FACTS } = await import(pathToFileURL(path.join(root, 'src/skippers/content/facts.js')).href);
const { QUESTIONS } = await import(pathToFileURL(path.join(root, 'src/skippers/content/questions/index.js')).href);

const KEYWORDS = { Red: 'red', Q: 'Quick', VQ: 'Very quick', Yellow: 'yellow', '∞': 'continuous', '3 Ps': 'people', 'Nov–Apr': 'November', '0718': '0718' };
const fails = [];
let factRows = 0;
for (const [level, rows] of Object.entries(FACTS)) {
  for (const f of rows) {
    factRows += 1;
    const pages = Array.isArray(f.page) ? f.page : [f.page];
    if (!pages.length || pages.some((p) => !Number.isInteger(p))) { fails.push(`${level} "${f.big}": no page`); continue; }
    const hay = pages.map(near).join(' ').toLowerCase();
    const nums = (String(f.big).match(/\d+(\.\d+)?/g) ?? []).filter((n) => n !== '0' || f.big === '0.05');
    const want = f.check ? [f.check] : nums.length ? nums : [KEYWORDS[f.big] ?? f.big];
    const missing = want.filter((w) => !hay.includes(String(w).toLowerCase()));
    if (missing.length) fails.push(`${level} "${f.big}" p.${pages.join(',')}: not found on page: ${missing.join(', ')}`);
  }
}
for (const q of QUESTIONS) {
  const pages = Array.isArray(q.page) ? q.page : [q.page];
  if (!pages.length || pages.some((p) => !Number.isInteger(p) || p < 1 || p > 121)) fails.push(`${q.id}: bad page ${q.page}`);
  if (!q.why?.trim()) fails.push(`${q.id}: no explanation`);
}
console.log(`${factRows} fact rows and ${QUESTIONS.length} questions checked.`);

const si = process.argv.indexOf('--sample');
if (si > 0) {
  const n = Number(process.argv[si + 1] ?? 20);
  const pool = [...Object.values(FACTS).flat().map((f) => ({ id: `fact ${f.big}`, page: f.page, text: f.text })), ...QUESTIONS.map((q) => ({ id: q.id, page: q.page, text: `${q.q} → ${q.options[q.answer]}` }))];
  for (let i = 0; i < n; i += 1) {
    const x = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const p = Array.isArray(x.page) ? x.page[0] : x.page;
    console.log(`\n[${x.id}] p.${x.page}: ${x.text}\n    page text: ${printed(p).slice(0, 220)}…`);
  }
}
if (fails.length) {
  console.log(`\nFAILED (${fails.length}):`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log('fact check passed');
