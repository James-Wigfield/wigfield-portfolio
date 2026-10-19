/* ============================================================================
   DL PROJECT 2 — NOTEBOOK MARKDOWN RENDERER
   ----------------------------------------------------------------------------
   A copy of ../../markdownLite.js (the decks depend on the original, so it is
   never edited), extended until a Jupyter markdown cell renders the way
   JupyterLab shows it:

     • soft line breaks join into one paragraph; two trailing spaces (or a
       trailing backslash) are a hard break — Jupyter's rule, not the decks'
     • headings carry the DOM ids the extractor assigned (consumed in order),
       so the contents rail and deep links point at them
     • GFM pipe tables with column alignment
     • $…$ inline and $$…$$ display maths through the kit's KaTeX <Tex>
     • `_` emphasis never fires inside a word (restore_best_weights stays put)
     • fenced code blocks, nested lists (by indentation), escapes, <br>

   Still React elements all the way down: no dangerouslySetInnerHTML, and link
   protocols are limited to http(s)/mailto.
   ========================================================================== */

import { createElement as h, Fragment } from 'react';
import { Tex } from '../kit';

const SAFE_URL = /^(https?:|mailto:|#)/i;

// Earliest-match inline tokeniser. Alternation order breaks ties at one index.
const INLINE = new RegExp(
  [
    '(``?)([^`]+?)\\1(?!`)', // 1,2 code span
    '\\\\([\\\\`*_{}\\[\\]()#+\\-.!$|<>~])', // 3 escape
    '\\$([^$\\n]+?)\\$', // 4 inline maths
    '<br\\s*/?>', // (no group) explicit break
    '\\*\\*([^*\\n]+?)\\*\\*', // 5 bold *
    '(?<![A-Za-z0-9])__([^_\\n]+?)__(?![A-Za-z0-9])', // 6 bold _
    '\\*([^*\\n]+?)\\*', // 7 italic *
    '(?<![A-Za-z0-9])_([^_\\n]+?)_(?![A-Za-z0-9])', // 8 italic _
    '\\[([^\\]]+?)\\]\\(([^)\\s]+?)\\)', // 9,10 link
  ].join('|'),
);

function parseInline(text, keyBase) {
  const nodes = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      nodes.push(rest);
      break;
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[2] !== undefined) nodes.push(h('code', { key }, m[2]));
    else if (m[3] !== undefined) nodes.push(m[3]);
    else if (m[4] !== undefined) nodes.push(h(Tex, { key, src: m[4] }));
    else if (m[5] !== undefined) nodes.push(h('strong', { key }, parseInline(m[5], key)));
    else if (m[6] !== undefined) nodes.push(h('strong', { key }, parseInline(m[6], key)));
    else if (m[7] !== undefined) nodes.push(h('em', { key }, parseInline(m[7], key)));
    else if (m[8] !== undefined) nodes.push(h('em', { key }, parseInline(m[8], key)));
    else if (m[9] !== undefined) {
      const href = SAFE_URL.test(m[10]) ? m[10] : undefined;
      nodes.push(
        href
          ? h('a', { key, href, ...(href.startsWith('#') ? {} : { target: '_blank', rel: 'noopener noreferrer' }) }, parseInline(m[9], key))
          : h(Fragment, { key }, parseInline(m[9], key)),
      );
    } else nodes.push(h('br', { key }));
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

// A paragraph's lines: soft breaks become spaces, hard breaks become <br>.
function paragraphInline(lines, keyBase) {
  const out = [];
  lines.forEach((ln, idx) => {
    const hard = / {2,}$/.test(ln) || /\\$/.test(ln);
    const body = ln.replace(/\\$/, '').replace(/\s+$/, '');
    out.push(h(Fragment, { key: `${keyBase}-l${idx}` }, parseInline(idx > 0 ? body.replace(/^\s+/, '') : body, `${keyBase}-${idx}`)));
    if (idx < lines.length - 1) out.push(hard ? h('br', { key: `${keyBase}-br${idx}` }) : ' ');
  });
  return out;
}

const isBlank = (s) => s.trim() === '';
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '`') inCode = !inCode;
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (ch === '|' && !inCode) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const startsBlock = (line) =>
  /^\s*(#{1,6}\s|>|---+\s*$|\*\*\*+\s*$|\$\$)/.test(line) || BULLET.test(line) || NUMBER.test(line) || FENCE.test(line);

/**
 * Render a Jupyter markdown string into React block elements.
 * headingIds: ids for the cell's headings in source order (from the extractor).
 */
export function renderMarkdown(src, { headingIds = [], keyPrefix = 'md' } = {}) {
  const hIds = [...headingIds];
  return parseBlocks(String(src || '').replace(/\r\n?/g, '\n').split('\n'), keyPrefix, hIds);
}

function parseBlocks(lines, keyPrefix, hIds) {
  const blocks = [];
  let i = 0;
  let key = 0;
  const k = () => `${keyPrefix}-${key++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    // fenced code
    const fm = FENCE.exec(line);
    if (fm) {
      const body = [];
      i += 1;
      while (i < lines.length && !new RegExp(`^\\s*${fm[1]}\\s*$`).test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push(h('pre', { key: k(), className: 'dlp2-md__pre' }, h('code', null, body.join('\n'))));
      continue;
    }

    // display maths: $$ … $$ (one line or several)
    if (/^\s*\$\$/.test(line)) {
      const body = [line.replace(/^\s*\$\$/, '')];
      let closed = /\$\$\s*$/.test(body[0]) && body[0].trim() !== '';
      if (closed) body[0] = body[0].replace(/\$\$\s*$/, '');
      i += 1;
      while (!closed && i < lines.length) {
        const ln = lines[i++];
        if (/\$\$\s*$/.test(ln)) {
          body.push(ln.replace(/\$\$\s*$/, ''));
          closed = true;
        } else body.push(ln);
      }
      blocks.push(h('div', { key: k(), className: 'dlp2-md__math' }, h(Tex, { src: body.join('\n').trim(), block: true })));
      continue;
    }

    // horizontal rule
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(h('hr', { key: k() }));
      i += 1;
      continue;
    }

    // heading
    const hm = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (hm) {
      const id = hIds.shift();
      blocks.push(h(`h${hm[1].length}`, { key: k(), id, tabIndex: -1 }, parseInline(hm[2], `${keyPrefix}-h${key}`)));
      i += 1;
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(h('blockquote', { key: k() }, parseBlocks(quote, `${keyPrefix}-q${key}`, hIds)));
      continue;
    }

    // table: a row line followed by a separator line
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : undefined));
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const tk = k();
      blocks.push(
        h('div', { key: tk, className: 'dlp2-md__tablewrap' },
          h('table', { className: 'dlp2-md__table' },
            h('thead', null, h('tr', null, head.map((c, j) => h('th', { key: j, style: align[j] ? { textAlign: align[j] } : undefined }, parseInline(c, `${tk}-th${j}`))))),
            h('tbody', null, rows.map((r, ri) => h('tr', { key: ri }, head.map((_, j) => h('td', { key: j, style: align[j] ? { textAlign: align[j] } : undefined }, parseInline(r[j] ?? '', `${tk}-${ri}-${j}`)))))),
          ),
        ),
      );
      continue;
    }

    // lists (nested by indentation)
    const lm = BULLET.exec(line) || NUMBER.exec(line);
    if (lm) {
      const ordered = !BULLET.exec(line);
      const baseIndent = lm[1].length;
      const items = [];
      while (i < lines.length) {
        const cur = lines[i];
        const im = ordered ? NUMBER.exec(cur) : BULLET.exec(cur);
        if (im && im[1].length === baseIndent) {
          items.push([im[3]]);
          i += 1;
          continue;
        }
        if (!isBlank(cur) && /^\s/.test(cur) && (cur.match(/^\s*/)[0].length > baseIndent) && items.length) {
          items[items.length - 1].push(cur.slice(Math.min(cur.match(/^\s*/)[0].length, baseIndent + 2)));
          i += 1;
          continue;
        }
        if (isBlank(cur) && i + 1 < lines.length && items.length) {
          const next = lines[i + 1];
          const nm = ordered ? NUMBER.exec(next) : BULLET.exec(next);
          if ((nm && nm[1].length === baseIndent) || (/^\s/.test(next) && next.match(/^\s*/)[0].length > baseIndent && !isBlank(next))) {
            i += 1;
            continue;
          }
        }
        break;
      }
      const lk = k();
      const start = ordered ? Number(lm[2]) : undefined;
      blocks.push(
        h(ordered ? 'ol' : 'ul', { key: lk, ...(start && start !== 1 ? { start } : {}) },
          items.map((itemLines, j) => {
            const [first, ...more] = itemLines;
            const nestedAt = more.findIndex((l) => BULLET.test(l) || NUMBER.test(l));
            const textLines = nestedAt < 0 ? [first, ...more] : [first, ...more.slice(0, nestedAt)];
            const nested = nestedAt < 0 ? [] : more.slice(nestedAt);
            return h('li', { key: j },
              paragraphInline(textLines, `${lk}-${j}`),
              nested.length ? parseBlocks(nested, `${lk}-${j}n`, hIds) : null,
            );
          }),
        ),
      );
      continue;
    }

    // paragraph
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines[i]))) {
      if (para.length && lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) break;
      para.push(lines[i++]);
    }
    const pk = k();
    blocks.push(h('p', { key: pk }, paragraphInline(para, pk)));
  }
  return blocks;
}
