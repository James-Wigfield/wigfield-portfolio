/* ============================================================================
   markdownLite — a tiny markdown → React renderer for deck text boxes
   ----------------------------------------------------------------------------
   Deliberately from-scratch (like the pixel-GIF encoder / SVG art), and it
   returns REACT ELEMENTS rather than an HTML string — so there is no
   dangerouslySetInnerHTML and no HTML-injection surface to sanitise, even though
   deck text arrives from the MCP and is stored + re-rendered.

   Supported subset (enough for slides):
     • headings         # .. ######
     • unordered lists  - item   /  * item
     • ordered lists    1. item
     • blockquotes      > quote
     • horizontal rule  ---
     • paragraphs       (blank line separates)
     • inline           **bold**  *italic* / _italic_  `code`  [text](url)

   Anything else renders as literal text. Unknown/link protocols are constrained
   to http(s)/mailto so a stored deck can't smuggle a javascript: URL.
   ========================================================================== */

import { createElement as h, Fragment } from 'react';

const SAFE_URL = /^(https?:|mailto:)/i;

// Parse inline markup within a single line/segment into an array of React nodes.
function parseInline(text, keyBase) {
  const nodes = [];
  let rest = text;
  let k = 0;
  // Earliest-match tokeniser: bold, italic(*), italic(_), code, link.
  const RE = /(\*\*([^*]+?)\*\*)|(\*([^*\n]+?)\*)|(_([^_\n]+?)_)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)\s]+?)\))/;

  while (rest) {
    const m = RE.exec(rest);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const key = `${keyBase}-${k++}`;

    if (m[1]) nodes.push(h('strong', { key }, parseInline(m[2], key)));
    else if (m[3]) nodes.push(h('em', { key }, parseInline(m[4], key)));
    else if (m[5]) nodes.push(h('em', { key }, parseInline(m[6], key)));
    else if (m[7]) nodes.push(h('code', { key }, m[8]));
    else if (m[9]) {
      const href = SAFE_URL.test(m[11]) ? m[11] : undefined;
      nodes.push(
        href
          ? h('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, parseInline(m[10], key))
          : parseInline(m[10], key),
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

// Render a markdown string into an array of block-level React elements.
export function renderMarkdown(src) {
  if (!src) return [];
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  const isBlank = (s) => s.trim() === '';

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i += 1; continue; }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) { blocks.push(h('hr', { key: key++ })); i += 1; continue; }

    // Heading
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      const tag = `h${hm[1].length}`;
      blocks.push(h(tag, { key: key++ }, parseInline(hm[2].trim(), `h${key}`)));
      i += 1;
      continue;
    }

    // Blockquote (consecutive `>` lines)
    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(h('blockquote', { key: key++ }, parseInline(quote.join(' '), `bq${key}`)));
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push(h('li', { key: items.length }, parseInline(item, `uli${key}-${items.length}`)));
        i += 1;
      }
      blocks.push(h('ul', { key: key++ }, items));
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push(h('li', { key: items.length }, parseInline(item, `oli${key}-${items.length}`)));
        i += 1;
      }
      blocks.push(h('ol', { key: key++ }, items));
      continue;
    }

    // Paragraph (gather consecutive plain lines; single newlines → <br/>)
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^\s*(#{1,6}\s|>|[-*]\s|\d+\.\s|---+\s*$)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    const inner = [];
    para.forEach((p, idx) => {
      if (idx > 0) inner.push(h('br', { key: `br${idx}` }));
      inner.push(h(Fragment, { key: `l${idx}` }, parseInline(p, `p${key}-${idx}`)));
    });
    blocks.push(h('p', { key: key++ }, inner));
  }

  return blocks;
}
