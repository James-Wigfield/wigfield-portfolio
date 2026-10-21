/* ============================================================================
   LECTURE 3 STUDY — MATHS AS PLAIN TEXT (for the PDF)
   ----------------------------------------------------------------------------
   KaTeX's typeset maths extracts from a PDF badly: limits land on other lines,
   matrices read column by column, and its hidden MathML copy doubles every
   symbol. For print, each rendered equation gets a print-only plain-text twin
   built from its own TeX source, and print.js hides the typeset version, so
   the PDF's text layer holds every equation once, in reading order:

     \sum_{i=-1}^{1} \mathcal{I}(x + i, y + j)   →  ∑_(i=−1)^1 I(x + i, y + j)
     \left\lfloor \frac{n - k}{s} \right\rfloor →  ⌊(n − k)/s⌋
     \begin{bmatrix} -1 & 0 \\ 2 & 1 \end{bmatrix} → [−1 0; 2 1]
     i\,s_h + f_h - 1                            →  i·s_h + f_h − 1

   Covers the TeX this module uses; an unknown command prints its own name.
   ========================================================================== */

const SYMBOLS = {
  times: '×', cdot: '·', sum: ' ∑', ell: 'ℓ', ldots: '…', cdots: '⋯', dots: '…',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', Longleftrightarrow: '⇔', Leftrightarrow: '⇔',
  rightarrow: '→', to: '→', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', approx: '≈', infty: '∞',
  quad: ' ', qquad: '  ', prime: '′',
};
const STYLE = new Set(['mathbf', 'boldsymbol', 'mathcal', 'mathrm', 'mathit', 'text', 'textrm', 'textbf', 'operatorname', 'mathbb']);
const DROP = new Set(['left', 'right', 'displaystyle', 'textstyle', 'big', 'Big', 'bigl', 'bigr']);
// placeholders for a matrix's & (next cell) and \\ (next row), from the
// private-use area so no real character can collide with them
const CELL = '';
const ROW = '';
// a thin space (\,) between two factors is a product (i\,s_h → i·s_h);
// anywhere else it is just a space
const THIN = '';
const PRODUCT = new RegExp(`([\\p{L}\\p{N}′])${THIN}(?=[\\p{L}\\p{N}])`, 'gu');

function tokenize(src) {
  const out = [];
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      out.push({ cmd: m[1] });
      i += m[0].length;
    } else {
      out.push({ ch: c });
      i += 1;
    }
  }
  return out;
}

// A simple argument reads without brackets: f_h, n^4, N_height.
const simple = (s) => /^[\p{L}\p{N}′.]+$/u.test(s);
const wrap = (s) => (simple(s) ? s : `(${s})`);

function parse(tokens, pos, stop) {
  let out = '';
  let i = pos;
  const arg = () => {
    if (tokens[i]?.ch === '{') {
      const [txt, next] = parse(tokens, i + 1, '}');
      i = next + 1;
      return txt;
    }
    while (tokens[i]?.ch === ' ') i += 1;
    const t = tokens[i];
    i += 1;
    if (!t) return '';
    if (t.cmd) return SYMBOLS[t.cmd] ?? t.cmd;
    return t.ch === '-' ? '−' : t.ch;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (stop && t.ch === stop) return [out, i];
    if (t.ch === '{') {
      const [txt, next] = parse(tokens, i + 1, '}');
      out += txt;
      i = next + 1;
    } else if (t.ch === '_' || t.ch === '^') {
      i += 1;
      out += t.ch + wrap(arg().trim());
    } else if (t.ch === '-') {
      out += '−';
      i += 1;
    } else if (t.ch === "'") {
      out += '′';
      i += 1;
    } else if (t.ch === '&') {
      out += CELL;
      i += 1;
    } else if (t.ch !== undefined) {
      out += t.ch;
      i += 1;
    } else if (t.cmd === '\\') {
      out += ROW;
      i += 1;
    } else if (t.cmd === 'begin' || t.cmd === 'end') {
      i += 1;
      const env = arg();
      if (t.cmd === 'begin' && /matrix/.test(env)) {
        const [body, next] = parseUntilEnd(tokens, i);
        i = next;
        const rows = body.split(ROW).map((r) => r.split(CELL).map((c) => c.trim()).join(' ').trim()).filter(Boolean);
        out += ` [${rows.join('; ')}]`;
      }
    } else if (t.cmd === 'frac' || t.cmd === 'tfrac' || t.cmd === 'dfrac') {
      i += 1;
      const a = arg().trim();
      const b = arg().trim();
      out += `${wrap(a)}/${wrap(b)}`;
    } else if (STYLE.has(t.cmd)) {
      i += 1;
      out += arg();
    } else if (DROP.has(t.cmd)) {
      i += 1;
    } else if (t.cmd === ',') {
      out += THIN;
      i += 1;
    } else if (t.cmd === ';' || t.cmd === ':' || t.cmd === ' ') {
      out += ' ';
      i += 1;
    } else if (t.cmd === '!') {
      i += 1;
    } else if (t.cmd === '{' || t.cmd === '}' || t.cmd === '%' || t.cmd === '$' || t.cmd === '#') {
      out += t.cmd;
      i += 1;
    } else {
      out += SYMBOLS[t.cmd] ?? t.cmd;
      i += 1;
    }
  }
  return [out, i];
}

// The body of a matrix environment, up to (and past) its \end{…}.
function parseUntilEnd(tokens, pos) {
  let depth = 0;
  let j = pos;
  for (; j < tokens.length; j++) {
    if (tokens[j].cmd === 'begin') depth += 1;
    if (tokens[j].cmd === 'end') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  const [body] = parse(tokens.slice(pos, j), 0, null);
  // skip "\end{name}"
  let k = j + 1;
  if (tokens[k]?.ch === '{') {
    while (k < tokens.length && tokens[k].ch !== '}') k += 1;
    k += 1;
  }
  return [body, k];
}

export function texToPlain(src) {
  const [out] = parse(tokenize(String(src)), 0, null);
  return out
    .replaceAll(CELL, ' ')
    .replaceAll(ROW, ' ')
    .replace(PRODUCT, '$1·')
    .replaceAll(THIN, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/ ,/g, ',')
    .replace(/([⌊⌈]) /g, '$1')
    .replace(/ ([⌋⌉])/g, '$1')
    .trim();
}

// Give every typeset equation under root a print-only plain-text twin (kept
// in step with its source; KaTeX re-rendering simply drops a stale twin).
export function annotateMath(root) {
  if (!root) return;
  root.querySelectorAll('.dlk-tex-inline, .dlk-tex-block').forEach((el) => {
    const src = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (src == null) return;
    const old = el.querySelector(':scope > .dl3s-texprint');
    if (old && old.dataset.src === src) return;
    old?.remove();
    const span = document.createElement('span');
    span.className = 'dl3s-texprint';
    span.dataset.src = src;
    span.textContent = texToPlain(src);
    el.appendChild(span);
  });
}
