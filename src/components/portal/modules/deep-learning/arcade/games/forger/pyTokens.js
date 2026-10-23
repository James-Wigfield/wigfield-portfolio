/* One line of Python → [{ t, cls }] spans with the Dark+ colour classes the
   deep-learning kit's VS-Code block uses (tok-cm/st/nu/kw/ct/fn in
   deep-learning/kit.css). A copy of kit.jsx's private tokenizer, kept here
   so this game can make single lines tappable. */
const KW = new Set(['import', 'from', 'as', 'for', 'in', 'if', 'else', 'while', 'return', 'def', 'class', 'with', 'and', 'or', 'not', 'is']);
const CONST = new Set(['True', 'False', 'None', 'self']);
const RE = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

export function pyTokens(line) {
  const out = [];
  let last = 0;
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], cls: 'cm' });
    else if (m[2] !== undefined) out.push({ t: m[2], cls: 'st' });
    else if (m[3] !== undefined) out.push({ t: m[3], cls: 'nu' });
    else {
      const w = m[4];
      const call = /^\s*\(/.test(line.slice(RE.lastIndex));
      out.push({ t: w, cls: KW.has(w) ? 'kw' : CONST.has(w) ? 'ct' : call ? 'fn' : undefined });
    }
    last = RE.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}
