/* ============================================================================
   DL EXAM PRACTICE — print the papers as Markdown (for reviewers)
   ----------------------------------------------------------------------------
     node tools/dl-exam-practice/dump-papers.mjs [--paper=sample|A|B] [--answers]
          [--only=id,id…] [--out=file.md]

   Reads the page's own data (src/…/exam-practice/papers) and prints each
   question and part as Markdown: prompts with their TeX as written, code
   blocks, figure descriptions, prompt tables, marks, topics (lecture +
   slides). With --answers, each part's model answer follows (ink blocks with
   their [✓m] ticks, formulas as $$TeX$$, tables, figure descriptions, the
   common-slip line and the slide receipt) plus its difficulty and likelihood.
   --only limits the output to the listed leaf or part ids.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const DATA = path.join(ROOT, 'src/components/portal/modules/deep-learning/exam-practice/papers/index.js');
const { PAPERS, leafLabel, receiptOf, partMarks, questionMarks } = await import(pathToFileURL(DATA).href);
const { LEC, slideText } = await import(pathToFileURL(path.join(path.dirname(DATA), 'lectures.js')).href);

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const only = flags.only ? new Set(String(flags.only).split(',')) : null;

const topicLine = (ts) => ts.map((t) => `${LEC[t.lec]?.label ?? t.lec} ${slideText(t.slides)} (${t.name})`).join('; ');

function promptMd(blocks) {
  return blocks.map((b) => {
    if (typeof b === 'string') return b;
    if (b.code) return `\n\`\`\`python\n${b.code}\n\`\`\`\n`;
    if (b.eq) return `\n$$${b.eq}$$\n`;
    if (b.fig) return `\n[${b.desc || `figure ${b.fig}`}]\n`;
    if (b.table) {
      const { head, rows } = b.table;
      return `\n| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
    }
    return '';
  }).join('\n');
}

function inkMd(answer) {
  return answer.map((b) => {
    const tick = (m) => (m ? ` [✓${m}]` : '');
    if (b.t === 'w') return `- ${b.text}${tick(b.m)}`;
    if (b.t === 'h') return `- **${b.text}**`;
    if (b.t === 'eq') return `- $$${b.tex}$$${tick(b.m)}`;
    if (b.t === 'ul') return b.items.map((it) => `  - ${it.text}${tick(it.m)}`).join('\n');
    if (b.t === 'tbl') return `- table${tick(b.m)}:\n\n  | ${b.head.join(' | ')} |\n  |${b.head.map(() => '---').join('|')}|\n${b.rows.map((r) => `  | ${r.join(' | ')} |`).join('\n')}\n`;
    if (b.t === 'fig') return `- [sketch: ${b.desc}]${tick(b.m)}`;
    if (b.t === 'slip') return `- Common slip: ${b.text}`;
    return '';
  }).join('\n');
}

const out = [];
for (const paper of PAPERS) {
  if (flags.paper && paper.id !== flags.paper) continue;
  out.push(`# ${paper.name}\n`);
  for (const q of paper.questions) {
    const qOut = [`## Question ${q.n}. (${questionMarks(q)} marks)\n`];
    let any = false;
    for (const p of q.parts) {
      const leaves = p.subs ?? [p];
      const show = !only || only.has(p.id) || leaves.some((l) => only.has(l.id));
      if (!show) continue;
      any = true;
      qOut.push(`### ${p.label}  [${p.id}] ${p.subs ? `(${partMarks(p)} marks over ${p.subs.length} subparts)` : `(${p.marks} marks)`} · page ${p.page} · ${p.lines} ruled lines\n`);
      qOut.push(promptMd(p.prompt));
      if (!p.subs) qOut.push(`\n*Topics:* ${topicLine(p.topics)}\n`);
      for (const l of leaves) {
        if (only && !only.has(l.id) && !only.has(p.id)) continue;
        if (p.subs) {
          qOut.push(`\n**${l.label}** [${l.id}] ${promptMd(l.prompt)} (${l.marks} mark${l.marks === 1 ? '' : 's'})`);
          qOut.push(`\n*Topics:* ${topicLine(l.topics)}\n`);
        }
        if (flags.answers) {
          const leaf = { ...l, parent: p.subs ? p : null };
          qOut.push(`\n**Model answer — ${leafLabel(paper, q, leaf)}** (difficulty ${l.difficulty ?? '?'}, likelihood ${l.likelihood ?? '?'})\n`);
          qOut.push(inkMd(l.answer || []));
          qOut.push(`\n*Receipt:* ${receiptOf(l)}\n`);
        }
      }
      qOut.push('');
    }
    if (any) out.push(...qOut);
  }
}
const text = out.join('\n');
if (flags.out) {
  fs.writeFileSync(path.resolve(String(flags.out)), text);
  console.log(`wrote ${flags.out} (${text.length} chars)`);
} else process.stdout.write(text);
