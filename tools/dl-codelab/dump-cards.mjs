/* ============================================================================
   DL CODE LAB — print the cards as Markdown (for reviewers)
   ----------------------------------------------------------------------------
     node tools/dl-codelab/dump-cards.mjs <outDir> [--only=labs,keras,…]

   Writes two files from the page's own data:
     cards-code.md  each card's label, sources, slide blocks and numbered
                    code only, so a reviewer can write their own marks and
                    answers blind first
     cards-full.md  everything the page and the PDF state: why, provenance,
                    numbered code, marks (with the quoted code), shapes,
                    equations (TeX + plain text), the exam move, what it's
                    for, the Count it table counts.js computes, the check
                    line, plus the Labs & Projects panels
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/codelab');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);
const { CARDS, sourceText, provenanceText, fullLabel } = await imp('cards/index.js');
const { SECTIONS } = await imp('sections.js');
const { SPECS } = await imp('specs.js');
const { flow, shapeStr, fmt } = await imp('counts.js');
const { markQuote, markWhere } = await imp('panelModel.js');
const { LAB_PANELS } = await imp('labsProjects.js');
const { texText } = await imp('texText.js');

const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const pick = (c) => !only.length || only.includes(c.section);

const numbered = (code) => code.split('\n').map((l, i) => `${String(i + 1).padStart(2)} | ${l}`).join('\n');
const head = (c) => `## ${fullLabel(c)}  [${c.id}]\n\n- Sources: ${c.sources.map(sourceText).join('; ')}${c.blocks ? `\n- Slide blocks (tools/dl-codelab/slides-verbatim): ${c.blocks.join(', ')}` : ''}${c.nb ? `\n- Notebook: ${c.nb}` : ''}\n- Provenance: ${provenanceText(c)} (${c.provenance})\n- File tab: ${c.file}\n`;

let codeMd = '# Code Lab cards: code only (write your own marks and answers first)\n\n';
let fullMd = '# Code Lab cards: everything the page states\n\n';

SECTIONS.forEach((s) => {
  const cards = CARDS.filter((c) => c.section === s.id && pick(c));
  if (!cards.length) return;
  codeMd += `# Tab ${s.n} · ${s.title}\n\n`;
  fullMd += `# Tab ${s.n} · ${s.title}\n\n`;
  if (s.id === 'labs') {
    LAB_PANELS.forEach((lp) => {
      const line = (d) => (typeof d === 'string' ? d : `\`${d.q}\` (verbatim output, ${d.nb})`);
      fullMd += `## Panel: ${lp.title}\n\n- Goal: ${lp.goal}\n${lp.spec ? `- Spec: ${lp.spec}\n` : ''}- Data: ${lp.data.map(line).join(' / ')}\n- Models: ${lp.models.map(line).join(' / ')}\n- ${lp.resultKind === 'target' ? 'Target' : 'Result'}: ${lp.result.map(line).join(' / ')}\n${lp.note ? `- Note: ${lp.note}\n` : ''}- Cards: ${lp.cards.join(', ')}\n\n`;
    });
  }
  cards.forEach((c) => {
    codeMd += `${head(c)}\n\`\`\`python\n${numbered(c.code)}\n\`\`\`\n\n`;
    const m = c.moves || {};
    let t = `${head(c)}- Rating: ${c.rating}\n- Why: ${c.why}\n\n\`\`\`python\n${numbered(c.code)}\n\`\`\`\n\n**Marks**\n\n`;
    c.marks.forEach((mk) => { t += `- (${mk.n}) ${markWhere(mk)} \`${markQuote(c.code, mk)}\`: ${mk.say}\n`; });
    if (m.shapes) t += `\n**Shapes**\n\n${m.shapes.map((x) => `- ${x.name} ${x.shape}: ${x.means}`).join('\n')}\n`;
    if (m.eq) t += `\n**Equation ↔ code**\n\n${m.eq.map((e) => `- ${e.name || ''}: $${e.tex}$\n  - as text: ${e.plain || texText(e.tex)}${e.line ? `\n  - ↔ line ${e.line}` : ''}`).join('\n')}\n`;
    if (m.say) t += `\n**Exam move**: ${m.say}\n`;
    if (m.forWhat) t += `\n**What's it for**: ${m.forWhat}\n`;
    [m.draw && `Draw it: spec ${m.draw}`].filter(Boolean).forEach((x) => { t += `\n**${x}**\n`; });
    const counts = Array.isArray(m.count) ? m.count : m.count ? [m.count] : [];
    counts.forEach((id) => {
      const f = flow(SPECS[id]);
      t += `\n**Count it (spec ${id})**\n\n| Layer | Output shape | Trainable | Non-trainable | Rule |\n|---|---|---|---|---|\n`;
      f.rows.forEach((r) => { t += `| ${r.name} | ${shapeStr(r.out)} | ${fmt(r.tr)} | ${fmt(r.nt)} | ${r.rule} |\n`; });
      t += `| **Total** | | **${fmt(f.tr)}** | **${fmt(f.nt)}** | |\n`;
    });
    if (c.slideCheck) t += `\n**Check**: ${c.slideCheck}\n`;
    if (c.xref?.length) t += `\n**Cross-links**: ${c.xref.map((x) => `${x.text} → ${x.to}`).join('; ')}\n`;
    fullMd += `${t}\n`;
  });
});

fs.writeFileSync(path.join(OUT, 'cards-code.md'), codeMd);
fs.writeFileSync(path.join(OUT, 'cards-full.md'), fullMd);
console.log(`wrote ${path.join(OUT, 'cards-code.md')} and cards-full.md (${CARDS.filter(pick).length} cards)`);
