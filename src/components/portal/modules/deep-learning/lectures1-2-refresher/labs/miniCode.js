/* A tiny Python highlighter for the labs' mini listings (VS Code Dark+
   colours via .dl12r-mini .k/.s/.n/.c/.f in labsL1.css). Returns an array
   of [text, className] pieces for one line. */
const KW = new Set(['class', 'def', 'return', 'import', 'from', 'as', 'for', 'in', 'self', 'super', 'None', 'True', 'False']);
const RE = /(#.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)(?=\()|(\b[A-Za-z_]\w*\b)/g;

export function hlLine(line) {
  const out = [];
  let last = 0;
  line.replace(RE, (m, cm, st, nu, fn, id, i) => {
    if (i > last) out.push([line.slice(last, i), '']);
    if (cm) out.push([m, 'c']);
    else if (st) out.push([m, 's']);
    else if (nu) out.push([m, 'n']);
    else if (fn) out.push([m, KW.has(m) ? 'k' : 'f']);
    else out.push([m, KW.has(id) ? 'k' : '']);
    last = i + m.length;
    return m;
  });
  if (last < line.length) out.push([line.slice(last), '']);
  return out;
}
