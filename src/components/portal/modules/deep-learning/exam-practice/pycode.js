/* ============================================================================
   EXAM PRACTICE — PYTHON TOKENS FOR THE PAPER'S CODE BLOCKS
   ----------------------------------------------------------------------------
   A copy of the shared kit's tokenizer (../kit.jsx keeps its own private), so
   a given code block can be set on the paper in VS Code's Light+ palette:
   the classes (tok-kw, tok-st, …) are coloured by .dlxp-code in the CSS.
   ========================================================================== */

const PY_KEYWORDS = new Set([
  'import', 'from', 'as', 'for', 'in', 'if', 'elif', 'else', 'while', 'return', 'def', 'class',
  'with', 'try', 'except', 'finally', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not',
  'is', 'assert', 'yield', 'global', 'del', 'raise',
]);
const PY_STORAGE = new Set(['def', 'class', 'lambda']);
const PY_CONSTS = new Set(['True', 'False', 'None', 'self']);

const TOKEN_RE = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_]\w*)/g;

// One line of Python → [{ t, cls }] (cls: cm comment, st string, nu number,
// kw control keyword, sk def/class/lambda, ct constant, fn call, va name)
export function pyTokens(line) {
  const out = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], cls: 'cm' });
    else if (m[2] !== undefined) out.push({ t: m[2], cls: 'st' });
    else if (m[3] !== undefined) out.push({ t: m[3], cls: 'nu' });
    else {
      const w = m[4];
      const callAhead = /^\s*\(/.test(line.slice(TOKEN_RE.lastIndex));
      if (PY_STORAGE.has(w)) out.push({ t: w, cls: 'sk' });
      else if (PY_KEYWORDS.has(w)) out.push({ t: w, cls: 'kw' });
      else if (PY_CONSTS.has(w)) out.push({ t: w, cls: 'ct' });
      else if (callAhead) out.push({ t: w, cls: 'fn' });
      else out.push({ t: w, cls: 'va' });
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}
