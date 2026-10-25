/* ============================================================================
   CODE LAB — PYTHON TOKENS (Dark+)
   ----------------------------------------------------------------------------
   A copy of the kit's `pyTokens` (../kit.jsx keeps it private), so the code
   panel on screen and the panel image drawn for print colour every token
   the same way. One line of Python → [{ t, cls }], where cls is one of the
   Dark+ classes below (or undefined for plain text).
   ========================================================================== */

const PY_KEYWORDS = new Set([
  'import', 'from', 'as', 'for', 'in', 'if', 'elif', 'else', 'while', 'return', 'def', 'class',
  'with', 'try', 'except', 'finally', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not',
  'is', 'assert', 'yield', 'global', 'del', 'raise',
]);
const PY_CONSTS = new Set(['True', 'False', 'None', 'self']);

const TOKEN_RE = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

export function pyTokens(line) {
  const out = [];
  let rest = line;
  if (rest.startsWith('>>>')) {
    out.push({ t: '>>>', cls: 'pr' });
    rest = rest.slice(3);
  }
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(rest))) {
    if (m.index > last) out.push({ t: rest.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], cls: 'cm' });
    else if (m[2] !== undefined) out.push({ t: m[2], cls: 'st' });
    else if (m[3] !== undefined) out.push({ t: m[3], cls: 'nu' });
    else {
      const w = m[4];
      const callAhead = /^\s*\(/.test(rest.slice(TOKEN_RE.lastIndex));
      if (PY_KEYWORDS.has(w)) out.push({ t: w, cls: 'kw' });
      else if (PY_CONSTS.has(w)) out.push({ t: w, cls: 'ct' });
      else if (callAhead) out.push({ t: w, cls: 'fn' });
      else out.push({ t: w });
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < rest.length) out.push({ t: rest.slice(last) });
  return out;
}

// The Dark+ palette, shared by the screen CSS (codelab.css .dlc-tok-*) and
// the print image (panelImage.js). Keep the two in step.
export const DARK = {
  bar: '#252526',
  barLine: '#1a1a1a',
  bg: '#1e1e1e',
  text: '#d4d4d4',
  file: '#cccccc',
  meta: '#9a9a9a',
  gutter: '#6e7681',
  gutterOn: '#c6c6c6',
  band: '#1f2e40', // rgba(56,139,253,0.13) over #1e1e1e, made opaque
  bandBar: '#388bfd',
  markLine: '#79b8ff',
  markTok: '#e2c08d',
  dots: ['#ff5f56', '#ffbd2e', '#27c93f'],
  tok: { cm: '#6a9955', st: '#ce9178', nu: '#b5cea8', kw: '#c586c0', ct: '#569cd6', fn: '#dcdcaa', pr: '#6e7681' },
};

export const CIRCLED = ['⓪', '①', '②', '③', '④', '⑤', '⑥'];
