/* ============================================================================
   DL PROJECT 2 — PYTHON TOKENIZER (Dark+ colour classes)
   ----------------------------------------------------------------------------
   A copy of the Deep Learning kit's tokenizer (kit.jsx → pyTokens), widened
   for whole notebook cells: it scans the cell in one pass, so triple-quoted
   docstrings that span lines stay one string, string prefixes (f"…", r'…')
   colour with their string, and a `def` / `class` name gets its own colour.
   Returns lines of { t, cls } spans; cls maps to the kit's `.tok-*` classes
   plus `.dlp2-tok-*` for the two additions (class names, decorators).
   ========================================================================== */

const CONTROL = new Set([
  'import', 'from', 'as', 'for', 'while', 'if', 'elif', 'else', 'return', 'try', 'except', 'finally',
  'with', 'break', 'continue', 'pass', 'raise', 'yield', 'assert', 'del', 'global', 'nonlocal', 'async', 'await',
]);
const STORAGE = new Set(['def', 'class', 'lambda', 'and', 'or', 'not', 'in', 'is']);
const CONSTS = new Set(['True', 'False', 'None', 'self']);

const RE = new RegExp(
  [
    '(#[^\\n]*)', // 1 comment
    '((?:[rRbBuUfF]{1,2})?(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)|"(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?))', // 2 string
    '(\\b\\d+(?:\\.\\d*)?(?:[eE][+-]?\\d+)?\\b|\\.\\d+\\b)', // 3 number
    '(@[A-Za-z_][\\w.]*)', // 4 decorator
    '([A-Za-z_]\\w*)', // 5 identifier
  ].join('|'),
  'g',
);

export function pyLines(src) {
  const text = src.replace(/\r\n?/g, '\n');
  const flat = [];
  let last = 0;
  let prevWord = '';
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    if (m.index > last) flat.push({ t: text.slice(last, m.index) });
    if (m[1] !== undefined) flat.push({ t: m[1], cls: 'tok-cm' });
    else if (m[2] !== undefined) flat.push({ t: m[2], cls: 'tok-st' });
    else if (m[3] !== undefined) flat.push({ t: m[3], cls: 'tok-nu' });
    else if (m[4] !== undefined) flat.push({ t: m[4], cls: 'dlp2-tok-dec' });
    else {
      const w = m[5];
      const callAhead = /^\s*\(/.test(text.slice(RE.lastIndex, RE.lastIndex + 40));
      let cls;
      if (prevWord === 'def') cls = 'tok-fn';
      else if (prevWord === 'class') cls = 'dlp2-tok-cls';
      else if (CONTROL.has(w)) cls = 'tok-kw';
      else if (STORAGE.has(w) || CONSTS.has(w)) cls = 'tok-ct';
      else if (callAhead) cls = 'tok-fn';
      flat.push(cls ? { t: w, cls } : { t: w });
      prevWord = w;
      last = RE.lastIndex;
      continue;
    }
    prevWord = '';
    last = RE.lastIndex;
  }
  if (last < text.length) flat.push({ t: text.slice(last) });

  // split spans on newlines so every line renders as its own row
  const lines = [[]];
  for (const tok of flat) {
    const parts = tok.t.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push(tok.cls ? { t: p, cls: tok.cls } : { t: p });
    });
  }
  if (lines.length > 1 && lines[lines.length - 1].length === 0 && text.endsWith('\n')) lines.pop();
  return lines;
}
