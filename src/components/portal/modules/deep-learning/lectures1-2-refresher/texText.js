/* ============================================================================
   LECTURE 8 STUDY — MATHS AS PLAIN TEXT (for print)
   ----------------------------------------------------------------------------
   KaTeX's HTML comes out of a PDF's text layer as scattered glyphs. Every
   formula on this page also prints a plain-text twin built here, in the
   usual linear notation, e.g.
     Attention(Q, K, V) = softmax((QKᵀ)/(√d_keys)) V
     α_(t,i) = exp(e_(t,i)) / Σ_i′ exp(e_(t,i′))
     h̃_(t) = Σᵢ α_(t,i) y_(i)
     P_p,i = sin(p/1000^(i/d)) if i is even; cos(p/1000^((i−1)/d)) if i is odd
   It covers the commands this module uses (√, ᵀ, Σ with limits, the cases
   brace, wide tilde, ⟨SOS⟩, underbraces, \text…); anything else falls back to
   its bare argument rather than leaking a backslash.
   ========================================================================== */

const SYMBOLS = {
  ell: 'ℓ', top: 'ᵀ', cdots: '…', ldots: '…', dots: '…', times: '×', cdot: '·', to: '→', rightarrow: '→', approx: '≈',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', in: '∈', mid: '|', infty: '∞', minus: '−', pm: '±', quad: ' ', qquad: '  ',
  alpha: 'α', beta: 'β', theta: 'θ', sigma: 'σ', phi: 'φ', varphi: 'φ', mu: 'μ', lambda: 'λ', Sigma: 'Σ', sum: 'Σ',
  langle: '⟨', rangle: '⟩', div: '÷', pi: 'π', exp: 'exp', tanh: 'tanh', sin: 'sin', cos: 'cos', log: 'log', max: 'max',
  limits: '', nolimits: '', displaystyle: '', ',': ' ', ';': ' ', ':': ' ', '!': '', '{': '{', '}': '}', '%': '%', '#': '#', '_': '_',
};
const STYLE = new Set(['mathbf', 'mathrm', 'mathit', 'boldsymbol', 'text', 'textbf', 'textit', 'texttt', 'textsf', 'operatorname', 'mathsf', 'bm']);
const SIZES = new Set(['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr']);

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

// a token prints bare when it is one simple run (QKᵀ, √d_keys, x₍₁₎), else in brackets
const SIMPLE = /^(?:[\p{L}\p{N}ᵀ′ℓ…√_₀-ₜᵢⱼ]|̂|̃)+$/u;
const wrap = (t) => (SIMPLE.test(t) || (/^\(.*\)$/.test(t) && !/^\(.*\).*\(.*\)$/.test(t)) ? t : `(${t})`);

// Unicode sub/superscripts where every character has one: x₁, X₍₁₎, N², Σᵢ
const SUBS = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '(': '₍', ')': '₎', '+': '₊', '−': '₋', '=': '₌',
  i: 'ᵢ', j: 'ⱼ', t: 'ₜ', k: 'ₖ', n: 'ₙ', p: 'ₚ',
};
const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '(': '⁽', ')': '⁾', '+': '⁺', '−': '⁻' };
const script = (t, map) => (t.length <= 3 && [...t].every((ch) => map[ch]) ? [...t].map((ch) => map[ch]).join('') : null);

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
        // text styles keep their words as typed (hyphens stay hyphens)
        out += /^text|^operatorname/.test(name) && !a.includes('\\') ? a.replace(/[{}]/g, '') : texText(a);
        i = j;
      } else if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, j] = arg(s, i);
        const [b, k] = arg(s, j);
        out += `${wrap(texText(a))}/${wrap(texText(b))}`;
        i = k;
      } else if (name === 'sqrt') {
        const [a, j] = arg(s, i);
        const t = texText(a);
        out += /^[\w_]+$/.test(t) ? `√${t}` : `√(${t})`;
        i = j;
      } else if (name === 'hat' || name === 'tilde' || name === 'widetilde' || name === 'widehat') {
        const [a, j] = arg(s, i);
        out += `${texText(a)}${name.endsWith('hat') ? '̂' : '̃'}`;
        i = j;
      } else if (name === 'underbrace') {
        // \underbrace{x}_{note} → "x [note]"
        const [a, j] = arg(s, i);
        out += texText(a);
        i = j;
        while (s[i] === ' ') i += 1;
        if (s[i] === '_') {
          const [b, k] = arg(s, i + 1);
          out += ` [${texText(b)}]`;
          i = k;
        }
      } else if (name === 'mathbb') {
        const [a, j] = arg(s, i);
        out += { R: 'ℝ', N: 'ℕ', Z: 'ℤ' }[a] ?? a;
        i = j;
      } else if (SIZES.has(name)) {
        // the delimiter that follows prints as itself ("\left." prints nothing)
        if (s[i] === '.') i += 1;
      } else if (name === 'begin' || name === 'end') {
        const [env, j] = arg(s, i);
        // a matrix keeps its brackets; a cases brace prints as its rows
        if (/matrix/.test(env)) out += name === 'begin' ? '[' : ']';
        i = j;
      } else if (name === '\\') {
        out += '; ';
      } else {
        out += SYMBOLS[name] ?? name;
      }
    } else if (c === '_' || c === '^') {
      const [a, j] = arg(s, i + 1);
      const t = texText(a).trim();
      const uni = script(t, c === '_' ? SUBS : SUPS);
      if (c === '^' && (t === 'ᵀ' || t === '⊤' || a.trim() === '\\top')) out += 'ᵀ';
      else if (c === '^' && t === '′') out += '′';
      else if (c === '^' && /^\\text/.test(a.trim())) out += t;
      else if (uni) out += uni;
      // a bare word or an unbracketed index list prints as typed: d_keys, e_3,i, P_p,i
      else if (/^[\w′]+(?:,[\w′]+)*$/u.test(t)) out += `${c}${t}`;
      else out += `${c}${wrap(t)}`;
      i = j;
    } else if (c === '{' || c === '}') {
      i += 1;
    } else if (c === '&') {
      out += ' ';
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
  return out.replace(/\s+/g, ' ').replace(/\s+([,;)\]])/g, '$1').replace(/([([])\s+/g, '$1').trim();
}
