/* ============================================================================
   LECTURE 5 STUDY — MATHS AS PLAIN TEXT (for print)
   ----------------------------------------------------------------------------
   KaTeX's HTML comes out of a PDF's text layer as scattered glyphs. Every
   formula on this page also prints a plain-text twin built here, in the
   usual linear notation:  W_(N−ℓ+1) = W_ℓᵀ,  X_(1),  N/2,  ℓ = 1, 2, …, N/2.
   It covers the small set of commands this module uses; anything else falls
   back to its bare argument rather than leaking a backslash.
   ========================================================================== */

const SYMBOLS = {
  ell: 'ℓ', top: 'ᵀ', cdots: '…', ldots: '…', dots: '…', times: '×', cdot: '·', to: '→', rightarrow: '→', approx: '≈',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', in: '∈', mid: '|', infty: '∞', minus: '−', pm: '±', quad: ' ', qquad: '  ',
  alpha: 'α', beta: 'β', theta: 'θ', sigma: 'σ', phi: 'φ', varphi: 'φ', mu: 'μ', lambda: 'λ', Sigma: 'Σ', sum: 'Σ',
  ',': ' ', ';': ' ', '!': '', '{': '{', '}': '}', '%': '%', '#': '#',
};
const STYLE = new Set(['mathbf', 'mathrm', 'mathit', 'boldsymbol', 'text', 'textbf', 'textit', 'texttt', 'operatorname', 'mathsf', 'bm']);

// read one argument: a {…} group or a single token, from position i
function arg(s, i) {
  while (s[i] === ' ') i += 1;
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth += 1;
      else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    return [s.slice(i + 1), s.length];
  }
  if (s[i] === '\\') {
    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
    return [m[0], i + m[0].length];
  }
  return [s[i] ?? '', i + 1];
}

const wrap = (t) => (/^[\w′ℓ…]$|^\(.*\)$|^[\p{L}\p{N}]$/u.test(t) ? t : `(${t})`);

// digits and brackets have Unicode sub/superscripts: x₁, X₍₁₎, N²
const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '(': '₍', ')': '₎', '+': '₊', '−': '₋', '=': '₌' };
const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '(': '⁽', ')': '⁾', '+': '⁺', '−': '⁻' };
const script = (t, map) => ([...t].every((ch) => map[ch]) ? [...t].map((ch) => map[ch]).join('') : null);

export function texText(src) {
  const s = String(src);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const name = m[1];
      i += m[0].length;
      if (STYLE.has(name)) {
        const [a, j] = arg(s, i);
        out += texText(a);
        i = j;
      } else if (name === 'frac') {
        const [a, j] = arg(s, i);
        const [b, k] = arg(s, j);
        out += `${wrap(texText(a))}/${wrap(texText(b))}`;
        i = k;
      } else if (name === 'hat') {
        const [a, j] = arg(s, i);
        out += `${texText(a)}̂`;
        i = j;
      } else if (name === 'mathbb') {
        const [a, j] = arg(s, i);
        out += { R: 'ℝ', N: 'ℕ', Z: 'ℤ' }[a] ?? a;
        i = j;
      } else if (name === 'left' || name === 'right' || name === 'big' || name === 'Big' || name === 'bigl' || name === 'bigr') {
        // the delimiter that follows prints as itself
      } else if (name === 'begin' || name === 'end') {
        const [, j] = arg(s, i);
        i = j;
      } else if (name === '\\') {
        out += '; ';
      } else {
        out += SYMBOLS[name] ?? name;
      }
    } else if (c === '_' || c === '^') {
      const [a, j] = arg(s, i + 1);
      const t = texText(a);
      const uni = script(t, c === '_' ? SUBS : SUPS);
      if (c === '^' && (t === 'ᵀ' || t === '⊤' || a.trim() === '\\top')) out += 'ᵀ';
      else if (c === '^' && t === '′') out += '′';
      else if (c === '^' && /^\\text/.test(a.trim())) out += t;
      else if (uni) out += uni;
      else out += `${c}${wrap(t)}`;
      i = j;
    } else if (c === '{' || c === '}') {
      i += 1;
    } else if (c === '&') {
      i += 1;
    } else if (c === '-') {
      out += '−';
      i += 1;
    } else if (c === '~') {
      out += ' ';
      i += 1;
    } else if (c === "'") {
      out += '′';
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}
