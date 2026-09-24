/* ============================================================================
   FIXTURE — SegResMamba (MIDL 2025), a REAL paper, converted to the MCP payload
   ----------------------------------------------------------------------------
   Documents/honours-project/research-papers/seg-res-mamba.md is a faithful
   markdown transcription of the paper (two-column PDF already linearised).
   This converter plays the chat-side Claude's role mechanically: headings →
   sections, paragraphs → text blocks, `> **Figure N:**` → figure cards,
   markdown tables + `**Table N:**` → table cards with the full table as
   content, `$$…$$` → an equation card with the LaTeX, `**Algorithm N**` +
   numbered steps → an algorithm card, citations stripped, inline $math$ →
   readable Unicode, References dropped, appendix tagged.

   It is a fixture, not the product: captions are the paper's own words
   (trimmed), where the real chat Claude would write a summary.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../../Documents/honours-project/research-papers/seg-res-mamba.md');

// ── cleaning ─────────────────────────────────────────────────────────────────
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', n: 'ⁿ', d: 'ᵈ' };
const mapChars = (s, table) => (s.split('').every((c) => table[c]) ? s.split('').map((c) => table[c]).join('') : null);

export function texToUnicode(tex) {
  let s = tex;
  s = s.replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1');
  s = s.replace(/\\mathbb\{R\}/g, 'ℝ').replace(/\\mathbb\{N\}/g, 'ℕ');
  s = s.replace(/\\times/g, '×').replace(/\\leftarrow/g, '←').replace(/\\rightarrow/g, '→').replace(/\\in\b/g, '∈').replace(/\\approx/g, '≈').replace(/\\cdot/g, '·');
  s = s.replace(/\\,|\\;|\\ /g, ' ');
  s = s.replace(/_\{([^}]*)\}/g, (_, x) => mapChars(x, SUB) ?? (x.length > 1 ? `_(${x})` : `_${x}`));
  s = s.replace(/_([A-Za-z0-9])(?![A-Za-z0-9])/g, (_, x) => mapChars(x, SUB) ?? `_${x}`);
  s = s.replace(/\^\{([^}]*)\}/g, (_, x) => mapChars(x, SUP) ?? (x.length > 1 ? `^(${x})` : `^${x}`));
  s = s.replace(/\^([A-Za-z0-9])(?![A-Za-z0-9])/g, (_, x) => mapChars(x, SUP) ?? `^${x}`);
  s = s.replace(/[{}]/g, '').replace(/\\/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

const CITE = /\s?\((?:[A-Z][\w'’-]+(?:\s(?:and|&)\s[A-Z][\w'’-]+)?(?:\set\sal\.)?,?\s\d{4}[a-z]?(?:;\s?)?)+\)/g;

export function cleanText(s) {
  let t = s;
  t = t.replace(/\$([^$]+)\$/g, (_, m) => texToUnicode(m));
  t = t.replace(CITE, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*]+)\*(?=\s|$|[.,;:])/g, '$1$2');
  t = t.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return t;
}

const firstSentences = (s, n = 2, cap = 340) => {
  const parts = s.match(/[^.!?]+[.!?]+(\s|$)/g) || [s];
  let out = parts.slice(0, n).join(' ').trim();
  if (out.length > cap) out = out.slice(0, cap).replace(/\s\S*$/, '') + '…';
  return out;
};
const lastSentence = (s) => {
  const parts = s.match(/[^.!?]+[.!?]+(\s|$)/g);
  return parts ? parts[parts.length - 1].trim() : s;
};

// ── parse ────────────────────────────────────────────────────────────────────
export function segresmambaPaper() {
  const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);
  const paper = { title: '', authors: [], year: 2025, source: 'https://openreview.net/forum?id=SegResMamba-MIDL2025', sections: [] };

  let section = null;
  let part = 'main';
  let skipping = false;          // inside References
  let para = [];
  let quote = [];
  let table = [];
  let pendingTable = null;
  let algo = null;
  let eqCount = 0;

  const blocks = () => section.blocks;
  const flushPara = () => {
    if (!para.length) return;
    const raw = para.join(' ');
    para = [];
    const isKey = /^\*\*[^*]+\*\*$/.test(raw.trim());
    const text = cleanText(raw);
    if (text) blocks().push(isKey ? { type: 'text', text, key: true } : { type: 'text', text });
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const raw = quote.join(' ');
    quote = [];
    const label = (/\*\*(Figure\s+\d+)[:.]?\*\*/.exec(raw) || [])[1] || `Figure ${blocks().filter((b) => b.type === 'figure').length + 1}`;
    const body = cleanText(raw.replace(/\*\*Figure\s+\d+:\*\*\s*/, '').replace(/\s-\s/g, ' '));
    blocks().push({ type: 'figure', label, caption: firstSentences(body, 2) });
  };
  const flushTable = () => {
    if (!table.length) return;
    pendingTable = table.join('\n');
    table = [];
  };
  const flushAlgo = () => {
    if (!algo) return;
    blocks().push({ type: 'algorithm', label: algo.label, caption: algo.caption, content: algo.lines.join('\n') });
    algo = null;
  };
  const flushAll = () => { flushPara(); flushQuote(); flushTable(); flushAlgo(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── headings ───────────────────────────────────────────────────────
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      const text = cleanText(h[2]);
      if (level === 1) { paper.title = text; continue; }
      if (section) flushAll();
      if (/^References$/i.test(text)) { skipping = true; section = null; part = 'appendix'; continue; }
      skipping = false;
      if (/^Appendix/i.test(text)) part = 'appendix';
      section = { heading: text, level: level - 1, part, blocks: [] };
      paper.sections.push(section);
      continue;
    }
    if (skipping) continue;

    // ── front matter (before the first section) ────────────────────────
    if (!section) {
      const a = /^\*\*([^*]+)\*\*/.exec(trimmed);
      if (a) paper.authors.push(a[1].trim());
      continue;
    }

    // ── algorithm block: "**Algorithm 1** Title" then numbered steps ───
    if (algo) {
      if (/^\d+\.\s/.test(trimmed)) { algo.lines.push(`${algo.lines.length + 1}: ${cleanText(trimmed.replace(/^\d+\.\s*/, ''))}`); continue; }
      if (!trimmed || trimmed === '---') { if (algo.lines.length) { flushAlgo(); } continue; }
      flushAlgo();
    }
    const alg = /^\*\*(Algorithm\s+\d+)\*\*\s*(.*)$/.exec(trimmed);
    if (alg) {
      flushAll();
      algo = { label: alg[1], caption: `${cleanText(alg[2])}: the block's forward pass as a step-by-step recipe.`, lines: [] };
      continue;
    }

    // ── blank / rule ───────────────────────────────────────────────────
    if (!trimmed || trimmed === '---') { flushPara(); flushQuote(); flushTable(); continue; }
    if (/^\*\*Keywords:\*\*/.test(trimmed)) { continue; }

    // ── table caption line completes a pending table ───────────────────
    const tcap = /^\*\*(Table\s+\d+)[:.]?\*\*\s*(.*)$/.exec(trimmed);
    if (tcap) {
      flushPara(); flushTable();
      const caption = cleanText(tcap[2]);
      if (pendingTable) { blocks().push({ type: 'table', label: tcap[1], caption, content: pendingTable }); pendingTable = null; }
      else blocks().push({ type: 'text', text: `${tcap[1]}: ${caption}` });
      continue;
    }

    // ── display equation ───────────────────────────────────────────────
    if (trimmed.startsWith('$$')) {
      flushPara();
      const tex = trimmed.replace(/^\$\$|\$\$$/g, '').replace(/,$/, '').trim();
      eqCount += 1;
      const prev = [...blocks()].reverse().find((b) => b.type === 'text');
      const caption = prev ? `Defined by the preceding sentence: ${lastSentence(prev.text)}` : 'Display equation.';
      blocks().push({ type: 'equation', label: `Eq. ${eqCount}`, caption, content: tex });
      continue;
    }

    // ── figure blockquote ──────────────────────────────────────────────
    if (trimmed.startsWith('>')) { flushPara(); flushTable(); quote.push(trimmed.replace(/^>\s?/, '')); continue; }
    if (quote.length) flushQuote();

    // ── table rows ─────────────────────────────────────────────────────
    if (trimmed.startsWith('|')) { flushPara(); table.push(trimmed); continue; }
    if (table.length) flushTable();

    // ── ordinary paragraph line ────────────────────────────────────────
    para.push(trimmed);
  }
  if (section) flushAll();
  if (pendingTable && section) section.blocks.push({ type: 'table', label: 'Table', caption: 'Untitled table.', content: pendingTable });

  return paper;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const p = segresmambaPaper();
  const bytes = Buffer.byteLength(JSON.stringify(p));
  const kinds = {};
  for (const s of p.sections) for (const b of s.blocks) kinds[b.type] = (kinds[b.type] || 0) + 1;
  console.log(JSON.stringify({ title: p.title, authors: p.authors, sections: p.sections.length, appendix: p.sections.filter((s) => s.part === 'appendix').length, kinds, kb: Math.round(bytes / 1000) }, null, 2));
  for (const s of p.sections) console.log(`${s.part === 'appendix' ? 'A' : 'M'} L${s.level} ${s.heading}  [${s.blocks.map((b) => b.type[0]).join('')}]`);
  console.log(JSON.stringify(p.sections[1].blocks[0], null, 2).slice(0, 700));
  console.log(JSON.stringify(p.sections.find((s) => s.blocks.some((b) => b.type === 'algorithm')).blocks.find((b) => b.type === 'algorithm'), null, 2));
}
