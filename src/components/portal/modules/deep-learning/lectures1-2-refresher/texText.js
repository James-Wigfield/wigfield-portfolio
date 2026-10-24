/* ============================================================================
   LECTURES 1–2 REFRESHER — MATHS AS PLAIN TEXT (for print; copied from
   the Lecture 8 module and extended)
   ----------------------------------------------------------------------------
   KaTeX's HTML comes out of a PDF's text layer as scattered glyphs. Every
   formula on this page also prints a plain-text twin built here, in the
   usual linear notation, e.g.
     w_i,j^(next step) = w_i,j + η(yⱼ − ŷⱼ)xᵢ
     x̂⁽ⁱ⁾ = (x⁽ⁱ⁾ − μ_B)/√(σ_B² + ϵ)
     m̂ ← m/(1 − β₁ᵗ)      s ← ρs + (1 − ρ)∇_θ J(θ) ⊗ ∇_θ J(θ)
     J(θ) = −(1/m) Σᵢ₌₁^m Σₖ₌₁^K yₖ⁽ⁱ⁾ log(p̂ₖ⁽ⁱ⁾)      Huber_δ(z) = ½z² if |z| ≤ δ; …
   It covers the commands this module uses (√, ᵀ, Σ with its limits, ½, the
   cases brace, hats, Greek letters incl. η, σ, ∇, β, ε, ρ, γ, ⊗, ⊘, ←, ℓ,
   \text…); anything else falls back to its bare argument rather than
   leaking a backslash.
   ========================================================================== */

const SYMBOLS = {
  ell: 'ℓ', top: 'ᵀ', cdots: '…', ldots: '…', dots: '…', times: '×', cdot: '·', to: '→', rightarrow: '→', approx: '≈',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', in: '∈', mid: '|', infty: '∞', minus: '−', pm: '±', quad: ' ', qquad: '  ',
  alpha: 'α', beta: 'β', theta: 'θ', sigma: 'σ', phi: 'φ', varphi: 'φ', mu: 'μ', lambda: 'λ', Sigma: 'Σ', sum: 'Σ',
  langle: '⟨', rangle: '⟩', div: '÷', pi: 'π', exp: 'exp', tanh: 'tanh', sin: 'sin', cos: 'cos', log: 'log', max: 'max',
  eta: 'η', rho: 'ρ', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', Phi: 'Φ', nabla: '∇', partial: '∂', '|': '‖',
  otimes: '⊗', oslash: '⊘', leftarrow: '←', gets: '←', Rightarrow: '⇒', prime: '′', sqrt: '√', min: 'min', abs: 'abs',
  limits: '', nolimits: '', displaystyle: '', ',': ' ', ';': ' ', ':': ' ', '!': '', '{': '{', '}': '}', '%': '%', '#': '#', '_': '_',
};
const STYLE = new Set(['mathbf', 'mathrm', 'mathit', 'boldsymbol', 'text', 'textbf', 'textit', 'texttt', 'textsf', 'operatorname', 'mathsf', 'bm', 'mathcal']);
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
const SIMPLE = /^(?:[\p{L}\p{N}ᵀ′ℓ…√_₀-ₜᵢⱼ∂‖]|̂|̃)+$/u;
const wrap = (t) => (SIMPLE.test(t) || /^√\([^()]*(?:\([^()]*\)[^()]*)*\)$/.test(t) || (/^\(.*\)$/.test(t) && !/^\(.*\).*\(.*\)$/.test(t)) ? t : `(${t})`);

// Unicode sub/superscripts where every character has one: x₁, X₍₁₎, N², Σᵢ
const SUBS = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '(': '₍', ')': '₎', '+': '₊', '−': '₋', '=': '₌',
  i: 'ᵢ', j: 'ⱼ', t: 'ₜ', k: 'ₖ', n: 'ₙ', p: 'ₚ',
};
const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '(': '⁽', ')': '⁾', '+': '⁺', '−': '⁻', i: 'ⁱ', n: 'ⁿ', t: 'ᵗ' };
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
        const ta = texText(a);
        const tb = texText(b);
        const fr = ta === '1' && tb === '2' ? '½' : `${wrap(ta)}/${wrap(tb)}`;
        // a fraction followed by more of its term is grouped: (1/m) Σ …
        out += fr !== '½' && /^\s*(?:\\(?:sum|left|log|exp)(?![A-Za-z])|[(\p{L}])/u.test(s.slice(k)) ? `(${fr})` : fr;
        i = k;
      } else if (name === 'sum') {
        // Σ with its limits, then a space before the summand: Σᵢ₌₁^m_B x⁽ⁱ⁾
        if (out && !/[\s(]$/.test(out)) out += ' ';
        out += 'Σ';
        for (let n = 0; n < 3; n++) {
          while (s[i] === ' ') i += 1;
          if (s.startsWith('\\limits', i)) { i += 7; continue; }
          if (s[i] !== '_' && s[i] !== '^') break;
          const c2 = s[i];
          const [a, j] = arg(s, i + 1);
          const t = texText(a).trim();
          out += script(t, c2 === '_' ? SUBS : SUPS) ?? `${c2}${/^[\p{L}\p{N}′]+$/u.test(t) ? t : `(${t})`}`;
          i = j;
        }
        out += ' ';
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
      } else if (name === 'qquad') {
        // a wide gap between two equations reads as a separator, not a product
        out = out.replace(/\s+$/, '');
        out += /[,;:]$/.test(out) ? ' ' : '; ';
      } else if (name === '\\') {
        out += '; ';
      } else {
        // operator names get a space after a preceding term: yₖ⁽ⁱ⁾ log(p̂ₖ⁽ⁱ⁾)
        if (/^(exp|log|tanh|sin|cos|max|min|abs)$/.test(name) && out && !/[\s(−+=/]$/.test(out)) out += ' ';
        out += SYMBOLS[name] ?? name;
      }
    } else if (c === '_' || c === '^') {
      const [a, j] = arg(s, i + 1);
      const t = texText(a).trim();
      // \text{…} subscripts stay as words (fan_in and fan_out alike)
      const uni = /^\\text/.test(a.trim()) && t.length > 1 ? null : script(t, c === '_' ? SUBS : SUPS);
      if (c === '^' && (t === 'ᵀ' || t === '⊤' || t === 'T' || a.trim() === '\\top')) out += 'ᵀ';
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
  return out.replace(/\s+/g, ' ').replace(/\s+([,;)\]])/g, '$1').replace(/([([])\s+/g, '$1').replace(/∂ /g, '∂').trim();
}
