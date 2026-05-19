import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── KaTeX Renderer ─────────────────────────────────────────────────────────────
function Tex({ src, block = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(src, ref.current, { throwOnError: false, displayMode: block });
    }
  }, [src, block]);
  return <span ref={ref} className={block ? 'm4-tex-block' : 'm4-tex-inline'} />;
}

// ── Vector text renderer ───────────────────────────────────────────────────────
// Defensive renderer for text that still contains the combining diacritic U+20D7
// (e.g. legacy "letter + arrow-above" sequences). Splits on the mark and wraps
// the preceding letter in a span styled by `.m4-vec`. The bulk of vector
// variables are now stored as single-codepoint Mathematical Bold letters (𝐱, 𝐲,
// 𝐳, 𝐰, 𝐯, 𝐩, 𝐟…) so the surrounding renderers can pass strings straight
// through. This helper stays in place as a safety net for any new content that
// uses the old `x⃗`-style combining mark.
function renderVecText(text, keyPrefix = 'v') {
  if (typeof text !== 'string' || !text.includes('⃗')) return text;
  const parts = [];
  let buf = '';
  let k = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (text[i + 1] === '⃗') {
      if (buf) { parts.push(buf); buf = ''; }
      parts.push(<span key={`${keyPrefix}-${k++}`} className="m4-vec">{ch}</span>);
      i++; // skip the combining mark itself
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

// Convenience component wrapper around renderVecText for use inside JSX.
function VecText({ children }) {
  return <>{renderVecText(String(children ?? ''))}</>;
}

// ── Variable Description Table ─────────────────────────────────────────────────
// vars: array of [latexSymbol, plainTextDescription]
function VarTable({ vars }) {
  return (
    <div className="m4-vartable">
      {vars.map(([sym, desc]) => (
        <div key={sym} className="m4-var-row">
          <span className="m4-var-sym"><Tex src={sym} /></span>
          <span className="m4-var-desc">{desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const CYBER_COLS = [
  '#22d3ee','#a78bfa','#34d399','#fb7185','#fbbf24',
  '#6366f1','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#eab308','#d946ef','#0ea5e9',
];

// ── Quiz Data (10 questions covering all lectures) ────────────────────────────
const QUIZ_DATA = [
  {
    lec: 'Lec 8 · Stochastic Optimisation',
    q: 'Given an LCG with seed X₀=1, multiplier a=3, increment c=1, modulus m=7 — what is X₁?',
    opts: ['X₁ = 3', 'X₁ = 4', 'X₁ = 7', 'X₁ = 1'],
    ans: 1,
    ok: 'Apply X₁ = (a·X₀ + c) mod m = (3×1 + 1) mod 7 = 4 mod 7 = 4.',
    ng: 'Formula: Xₙ₊₁ = (a·Xₙ + c) mod m. So X₁ = (3×1+1) mod 7 = 4. Multiply first, add increment, then modulo.',
  },
  {
    lec: 'Lec 8 · Stochastic Optimisation',
    q: 'FFD is "offline" while FF is "online". What is the key difference?',
    opts: [
      'FFD requires more memory',
      'FFD must know all item sizes before placing any (needs a global sort); FF places each item as it arrives',
      'FF can only be applied to sorted inputs',
      'FFD always uses fewer bins, regardless of input',
    ],
    ans: 1,
    ok: 'FFD pre-sorts all items in decreasing order — requires knowing every size before the first placement. Online algorithms (FF, NF, BF) place items immediately upon arrival.',
    ng: 'Key distinction is when sizes are known. FFD must see every item first (offline). Online algorithms place items immediately — perfect for the conveyor belt.',
  },
  {
    lec: 'Lec 4 · Job Shop Problem',
    q: 'For JSSP with n=4 jobs and m=3 machines, what is the solution space size (n!)ᵐ?',
    opts: ['64  (4³)', '13,824  ((4!)³)', '1,728  (12³)', '24  (4!)'],
    ans: 1,
    ok: 'Correct! (n!)ᵐ = (4!)³ = 24³ = 13,824. Each of the 3 machines independently orders 4 jobs.',
    ng: 'Solution space = (n!)ᵐ. With n=4, m=3: (4!)³ = 24³ = 13,824.',
  },
  {
    lec: 'Lec 3 · Optimisation Framework',
    q: 'In optimisation, what does the metric (evaluation function) f : H → ℝ measure?',
    opts: [
      'The size of the hypothesis space H',
      'How many candidate solutions exist',
      'How "good" a hypothesis is — its distance from the target/ideal',
      'The number of features in the representation language',
    ],
    ans: 2,
    ok: 'The metric maps each hypothesis in H to a real number indicating quality. Also called: error function, cost function, fitness function, objective function.',
    ng: 'f : H → ℝ maps a candidate solution (hypothesis) to a real number indicating how good it is. The argmin of f gives the best hypothesis.',
  },
  {
    lec: 'Lec 5 · Vector Calculus',
    q: 'What does the derivative f\'(x) = 0 tell us, and how do we confirm it is a minimum (not a maximum)?',
    opts: [
      'f\'(x) = 0 always means a minimum; no further check needed',
      'f\'(x) = 0 means a critical point; f\'\'(x) > 0 confirms a local minimum, f\'\'(x) < 0 confirms a local maximum',
      'f\'(x) = 0 means the function is undefined at that point',
      'f\'(x) = 0 means x is outside the domain',
    ],
    ans: 1,
    ok: 'Critical points occur where f\'(x) = 0. The second derivative test: f\'\'(x) > 0 → local min (concave up), f\'\'(x) < 0 → local max (concave down).',
    ng: 'f\'(x) = 0 gives critical points. Check f\'\'(x): positive → concave up → local min; negative → concave down → local max.',
  },
  {
    lec: 'Lec 5 · Vector Calculus',
    q: 'The gradient ∇f(x) of a scalar function f : ℝⁿ → ℝ is best described as:',
    opts: [
      'The second derivative of f with respect to all variables',
      'A vector of partial derivatives pointing in the direction of steepest ascent',
      'The dot product of f with itself',
      'A scalar value equal to the sum of all partial derivatives',
    ],
    ans: 1,
    ok: '∇f = [∂f/∂x₁, ∂f/∂x₂, ..., ∂f/∂xₙ]ᵀ. It\'s a vector field whose value at any point points in the direction of steepest ascent.',
    ng: 'The gradient is a vector of partial derivatives. Gradient descent moves opposite to ∇f (down the steepest slope); ascent moves along ∇f.',
  },
  {
    lec: 'Lec 6 · Gradient Methods',
    q: 'In gradient descent, the update rule is x ← x − α f\'(x). What role does α (the learning rate) play?',
    opts: [
      'It sets the stopping threshold for convergence',
      'It scales the step size — too small: slow convergence; too large: overshoot and oscillation',
      'It determines how many restarts are performed',
      'It is the initial value of x before the first iteration',
    ],
    ans: 1,
    ok: 'α is the learning rate (step-size tuning parameter). Small α → slow but stable convergence. Large α → fast but risks overshooting and oscillating around the minimum.',
    ng: 'α scales step size. x ← x − α f\'(x): sign of f\'(x) gives direction, magnitude gives size, α scales it. Too large causes oscillation; too small is inefficient.',
  },
  {
    lec: 'Lec 7 · Direct Methods',
    q: 'Newton-Raphson for optimisation uses the update x ← x − f\'(x)/f\'\'(x). Why is this faster than plain gradient descent?',
    opts: [
      'It uses randomness to escape local minima',
      'It approximates the function with a quadratic (using curvature), choosing the optimal step size automatically',
      'It evaluates f at multiple points in parallel',
      'It guarantees finding the global optimum',
    ],
    ans: 1,
    ok: 'N-R uses curvature (f\'\'(x)) to fit a local quadratic approximation. This naturally scales the step: large curvature → small step; flat region → large step. Solves quadratics in one step.',
    ng: 'N-R divides by f\'\'(x) — the curvature. This effectively matches the step to local geometry (like approximating with a quadratic), much faster than fixed-α gradient descent.',
  },
  {
    lec: 'Lec 9 · Single-State Global Optimisation',
    q: 'In Simulated Annealing, the acceptance probability for a worse solution R (where Quality(R) < Quality(S)) is:',
    opts: [
      'Always 0 — worse solutions are never accepted',
      'Always 0.5 regardless of temperature',
      'e^((Quality(R) − Quality(S)) / t), which decreases as t → 0 or as the quality gap increases',
      '1 / (Quality(S) − Quality(R))',
    ],
    ans: 2,
    ok: 'P = e^(ΔQ/t) where ΔQ = Quality(R) − Quality(S) < 0. As t → 0 (cooling), P → 0 (pure hill climb). As t → ∞, P → 1 (random walk). Controls exploration/exploitation.',
    ng: 'SA uses P = e^((Q(R)−Q(S))/t). With Q(R) < Q(S), the exponent is negative so 0 < P < 1. High temperature t → high P (exploration). Low t → low P (exploitation).',
  },
  {
    lec: 'Lec 8 · Stochastic Optimisation',
    q: 'The No Free Lunch theorem (Wolpert & Macready, 1997) states that:',
    opts: [
      'Gradient descent always outperforms random search',
      'There exists a single universally optimal optimisation algorithm',
      'Averaged across all possible problems, no algorithm outperforms any other — algorithm choice must be problem-specific',
      'Stochastic methods always beat deterministic methods on real-world problems',
    ],
    ans: 2,
    ok: 'NFL: any performance gain on one class of problems comes at the cost of worse performance on another. "The average performance of any pair of algorithms across all possible problems is identical." Algorithm selection must be informed by domain knowledge.',
    ng: 'NFL theorem: no universal champion. Performance gains on one problem class trade off against losses on others. Always choose algorithms informed by knowledge of your specific problem domain.',
  },
  {
    lec: 'Lec 10 · Population-based Methods',
    q: 'In a (μ, λ) Evolution Strategy, what is the key distinction compared to (μ + λ)?',
    opts: [
      'In (μ, λ), parents and offspring compete — only the best μ across both survive',
      'In (μ, λ), offspring replace parents entirely — parents never survive into the next generation',
      'In (μ, λ), λ offspring are produced but only one parent is used',
      'In (μ, λ), μ is always larger than λ',
    ],
    ans: 1,
    ok: 'In (μ, λ), Join() replaces parents with children — the μ best of the λ new offspring become the next generation. In (μ + λ), parents compete with offspring and can survive, making it more exploitative but risking premature convergence.',
    ng: '(μ, λ): offspring-only competition — the λ children form the candidate pool and only μ survive. (μ + λ): parents join the pool, so a good parent can persist indefinitely.',
  },
  {
    lec: 'Lec 10 · Population-based Methods',
    q: "Rechenberg's One-Fifth Rule says: if the fraction of children fitter than their parents pₛ > 1/5, you should:",
    opts: [
      'Decrease σ² to exploit the current region more',
      'Increase σ² to explore more broadly',
      'Reset the population to avoid premature convergence',
      'Switch from (μ, λ) to (μ + λ)',
    ],
    ans: 1,
    ok: 'pₛ > 1/5 means children are frequently beating parents — the mutation step is too small and you are over-exploiting a local region. Increase σ² to explore more. Conversely, pₛ < 1/5 → decrease σ² to exploit more.',
    ng: "One-Fifth Rule: pₛ > 1/5 → increase σ² (explore); pₛ < 1/5 → decrease σ² (exploit). Think of it as: if you're finding improvements easily, take bigger jumps to search further.",
  },
];

// ── LCG Visualizer ────────────────────────────────────────────────────────────
function LCGVisualizer() {
  const [p, setP] = useState({ seed: 1, a: 3, c: 1, m: 31 });
  const histRef = useRef(null);

  const result = useCallback(() => {
    const { seed, a, c, m } = p;
    const seq = [], seen = new Map();
    let x = seed, periodStart = -1;
    while (seq.length < 120) {
      if (seen.has(x)) { periodStart = seen.get(x); break; }
      seen.set(x, seq.length);
      seq.push(x);
      x = (a * x + c) % m;
    }
    const period = periodStart >= 0 ? seq.length - periodStart : seq.length;
    return { seq, period, unique: new Set(seq).size, isFull: period === m };
  }, [p]);

  const res = result();

  useEffect(() => {
    const canvas = histRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 150;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const { seq } = res;
    const { m } = p;
    const freq = Array(m).fill(0);
    seq.forEach(n => { if (n < m) freq[n]++; });
    const maxF = Math.max(...freq, 1);
    const PAD = 28;
    const barW = Math.max(2, (W - PAD) / m - 1);
    const cH = H - 22;
    ctx.strokeStyle = 'rgba(34,211,238,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, 0); ctx.lineTo(PAD, cH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD, cH); ctx.lineTo(W, cH); ctx.stroke();
    freq.forEach((f, i) => {
      const bh = (f / maxF) * (cH - 8);
      const bx = PAD + 2 + i * (barW + 1);
      ctx.fillStyle = f === 0 ? 'rgba(251,113,133,0.55)' : 'rgba(34,211,238,0.6)';
      ctx.fillRect(bx, cH - bh, barW, bh);
    });
    ctx.fillStyle = 'rgba(148,163,184,0.45)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', PAD + 2, H - 3);
    ctx.fillText(String(m - 1), PAD + 2 + (m - 1) * (barW + 1), H - 3);
    ctx.fillText('Output frequency (0 to m-1)', W / 2, H - 3);
  }, [res, p]);

  const set = (key, val) => setP(prev => ({ ...prev, [key]: +val }));
  const presets = {
    'a=3, m=7':  { seed: 1, a: 3, c: 1, m: 7  },
    'a=3, m=31': { seed: 1, a: 3, c: 1, m: 31 },
    'Poor m=12': { seed: 3, a: 6, c: 0, m: 12 },
  };

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Mathematical Foundation</div>
        <div className="m4-flabel">Core LCG Recurrence</div>
        <Tex src="X_{n+1} = (a \cdot X_n + c) \bmod m" block />
        <VarTable vars={[
          ['X_{n+1}', 'Next output value in the sequence'],
          ['X_n', 'Current value (state of the generator)'],
          ['a', 'Multiplier — scales the current state; must be chosen carefully to avoid short cycles'],
          ['c', 'Increment (additive constant) — c = 0 gives a purely multiplicative generator'],
          ['m', 'Modulus — sets the output range [0, m−1]; ideally a Mersenne prime'],
        ]} />
        <table className="m4-ptable">
          <tbody>
            <tr><td className="pk">X₀</td><td>Seed — initial value; determines reproducibility</td></tr>
            <tr><td className="pk">a</td><td>Multiplier — scales current state; choose carefully</td></tr>
            <tr><td className="pk">c</td><td>Increment — c=0 gives a multiplicative generator</td></tr>
            <tr><td className="pk">m</td><td>Modulus — output range [0, m-1]; ideally a Mersenne prime</td></tr>
          </tbody>
        </table>
        <div className="m4-hr"/>
        <div className="m4-flabel">Mersenne Primes (ideal moduli)</div>
        <Tex src="m = 2^n - 1 \quad n \in \{3, 5, 7, 13, 17, \ldots\}" block />
        <VarTable vars={[
          ['m', 'Modulus — the resulting Mersenne prime (e.g., 7, 31, 127, 8191…)'],
          ['n', 'Integer exponent — must itself be prime to guarantee a Mersenne prime'],
        ]} />
        <div className="m4-infobox">
          <strong>Why Mersenne primes?</strong> A modulus with many factors (e.g. 12 = 2²×3) causes short cycles — poor <em>equidistribution</em>. Mersenne primes have very few factors, maximising the period.
        </div>
        <div className="m4-hr"/>
        <div className="m4-flabel">Hull–Dobell Full-Period Theorem</div>
        <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
          Period = m ⟺ gcd(c,m)=1 AND (a−1) divisible by all prime factors of m AND if 4|m then 4|(a−1)
        </div>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">LCG Visualizer</div>
        <div className="m4-preset-row">
          {Object.entries(presets).map(([k, v]) => (
            <button key={k} className="m4-preset-btn" onClick={() => setP(v)}>{k}</button>
          ))}
        </div>
        {[
          { key: 'seed', label: 'Seed (X₀)', min: 0, max: 30 },
          { key: 'a',    label: 'Multiplier (a)', min: 1, max: 15 },
          { key: 'c',    label: 'Increment (c)', min: 0, max: 15 },
          { key: 'm',    label: 'Modulus (m)', min: 2, max: 50 },
        ].map(({ key, label, min, max }) => (
          <div className="m4-ctrl" key={key}>
            <div className="m4-ctrl-lbl"><span>{label}</span><span className="m4-ctrl-val">{p[key]}</span></div>
            <input type="range" min={min} max={max} value={p[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
        <div className="m4-stats-row">
          <div className="m4-stat"><span className="m4-stat-l">Period</span><span className="m4-stat-v" style={{color:'var(--cyan)'}}>{res.period}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Full?</span><span className="m4-stat-v" style={{color: res.isFull ? 'var(--emerald)' : 'var(--rose)'}}>{res.isFull ? '✓ Yes' : '✗ No'}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">Unique</span><span className="m4-stat-v" style={{color:'var(--violet)'}}>{res.unique}</span></div>
        </div>
        <div className="m4-seq-wrap">
          {res.seq.slice(0, 36).map((n, i) => (
            <div key={i} className={`m4-chip ${i===0?'chip-seed':''} ${i===res.period&&i>0?'chip-rep':''}`}>{n}</div>
          ))}
          {res.seq.length > 36 && <div className="m4-chip chip-end">…</div>}
        </div>
        <canvas ref={histRef} className="m4-canvas" height="150"/>
      </div>
    </div>
  );
}

// ── Bin Packing Visualizer ────────────────────────────────────────────────────
function BinPackingViz() {
  const [items, setItems] = useState([]);
  const [strat, setStrat] = useState('ff');
  const [n, setN] = useState(15);
  const [stats, setStats] = useState(null);
  const [cmpData, setCmpData] = useState(null);
  const bpRef = useRef(null);
  const cmpRef = useRef(null);

  const pack = useCallback((its, s) => {
    const boxes = [];
    const ordered = s === 'ffd' ? [...its].sort((a, b) => b - a) : [...its];
    ordered.forEach(item => {
      let placed = false;
      if (s === 'ff' || s === 'ffd') {
        for (let b = 0; b < boxes.length; b++) {
          if (boxes[b].rem >= item - 1e-9) { boxes[b].items.push(item); boxes[b].rem = Math.round((boxes[b].rem - item) * 100) / 100; placed = true; break; }
        }
      } else if (s === 'nf') {
        if (!boxes.length || boxes[boxes.length-1].rem < item - 1e-9) boxes.push({ items: [], rem: 1 });
        const last = boxes[boxes.length-1];
        last.items.push(item); last.rem = Math.round((last.rem - item) * 100) / 100; placed = true;
      } else if (s === 'bf') {
        let best = -1, bestR = Infinity;
        for (let b = 0; b < boxes.length; b++) { if (boxes[b].rem >= item - 1e-9 && boxes[b].rem < bestR) { bestR = boxes[b].rem; best = b; } }
        if (best >= 0) { boxes[best].items.push(item); boxes[best].rem = Math.round((boxes[best].rem - item) * 100) / 100; placed = true; }
      }
      if (!placed) boxes.push({ items: [item], rem: Math.round((1 - item) * 100) / 100 });
    });
    return boxes;
  }, []);

  const drawBins = useCallback((boxes, ref) => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500;
    const H = canvas.height = 270;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!boxes.length) return;
    const LH = 26, BH = H - LH - 6, GAP = 4;
    const maxB = Math.min(boxes.length, Math.floor(W / 24));
    const vis = boxes.slice(0, maxB);
    const bW = Math.min(50, (W - GAP) / vis.length - GAP);
    vis.forEach((box, bi) => {
      const bx = GAP + bi * (bW + GAP);
      ctx.strokeStyle = 'rgba(34,211,238,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(bx, 4, bW, BH);
      let y = 4 + BH;
      box.items.forEach((item, ii) => {
        const iH = Math.round(item * BH);
        y -= iH;
        ctx.fillStyle = CYBER_COLS[ii % CYBER_COLS.length] + 'cc';
        ctx.fillRect(bx + 1, y + 0.5, bW - 2, iH - 1);
        if (iH >= 14) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.min(10, iH * 0.42)}px monospace`; ctx.textAlign = 'center';
          ctx.fillText(item.toFixed(1), bx + bW / 2, y + iH / 2 + 4);
        }
      });
      ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
      ctx.fillText('B' + (bi+1), bx + bW/2, 4+BH+12);
      ctx.fillText(Math.round((1-box.rem)*100)+'%', bx + bW/2, 4+BH+22);
    });
    if (boxes.length > maxB) { ctx.fillStyle='rgba(148,163,184,0.4)'; ctx.font='9px monospace'; ctx.textAlign='left'; ctx.fillText(`+${boxes.length-maxB} more`,GAP,H-2); }
  }, []);

  const drawCmp = useCallback((data) => {
    const canvas = cmpRef.current;
    if (!canvas || !data) return;
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 110;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const labels = ['First Fit','Next Fit','Best Fit','FFD'];
    const colors = ['#22d3ee','#a78bfa','#fbbf24','#34d399'];
    const maxV = Math.max(...data, 1);
    const bW = (W - 20) / 4 - 8;
    data.forEach((v, i) => {
      const bh = (v / maxV) * (H - 28);
      const bx = 8 + i * (bW + 8);
      ctx.fillStyle = colors[i] + 'aa'; ctx.fillRect(bx, H-20-bh, bW, bh);
      ctx.fillStyle = colors[i]; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText(v, bx+bW/2, H-22-bh);
      ctx.fillStyle='rgba(148,163,184,0.6)'; ctx.font='7px monospace';
      ctx.fillText(labels[i], bx+bW/2, H-4);
    });
  }, []);

  const generate = useCallback(() => {
    const its = Array.from({ length: n }, () => Math.round((Math.random()*0.9+0.1)*10)/10);
    setItems(its); setCmpData(null); return its;
  }, [n]);

  const run = useCallback((its) => {
    const src = its || items;
    if (!src.length) return;
    const boxes = pack(src, strat);
    const avgFill = boxes.reduce((s, b) => s + (1-b.rem), 0) / boxes.length;
    setStats({ bins: boxes.length, packed: boxes.reduce((s,b)=>s+b.items.length,0), fill: (avgFill*100).toFixed(1) });
    setCmpData(null);
    requestAnimationFrame(() => drawBins(boxes, bpRef));
  }, [items, strat, pack, drawBins]);

  const compareAll = useCallback(() => {
    const src = items.length ? items : generate();
    const data = ['ff','nf','bf','ffd'].map(s => pack(src, s).length);
    setCmpData(data);
    run(src);
    requestAnimationFrame(() => drawCmp(data));
  }, [items, pack, generate, run, drawCmp]);

  useEffect(() => { if (cmpData) requestAnimationFrame(() => drawCmp(cmpData)); }, [cmpData, drawCmp]);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Strategies & Complexity</div>
        <div className="m4-infobox"><strong>Crest Packing Problem (Lab 2):</strong> Items of scale [0.1, 1.0] arrive on a conveyor. Pack into unit-capacity boxes. Items cannot be skipped or reordered.</div>
        <div className="m4-hr"/>
        {[
          { name:'First Fit (FF)', badge:'O(n²)', color:'var(--cyan)', desc:'Scan from start; place in first fitting bin. New bin only if none fits.' },
          { name:'Next Fit (NF)', badge:'O(n)', color:'var(--emerald)', desc:'Only check current bin. If full, open a new one. Fastest, but wastes space.' },
          { name:'Best Fit (BF)', badge:'O(n²)', color:'var(--amber)', desc:'Place in bin with least remaining space that still fits — tightest fit.' },
          { name:'FFD (offline)', badge:'O(n log n)', color:'var(--violet)', desc:'Pre-sort items decreasing, then apply First Fit. Requires all sizes upfront — cannot be used on the conveyor.' },
        ].map(s => (
          <div key={s.name} className="m4-strat" style={{'--sc':s.color}}>
            <div className="m4-strat-h">{s.name} <span className="m4-tag" style={{background:s.color+'1a',color:s.color,border:`1px solid ${s.color}44`}}>{s.badge}</span></div>
            <div className="m4-strat-d">{s.desc}</div>
          </div>
        ))}
        <div className="m4-hr"/>
        <div className="m4-flabel">Capacity Constraint</div>
        <Tex src="\sum_i s_i \leq C = 1.0 \quad \forall \text{ box } k" block />
        <VarTable vars={[
          ['s_i', 'Size of item i (value in [0.1, 1.0] for the Crest problem)'],
          ['C', 'Bin capacity (= 1.0, i.e., each bin holds items whose total size ≤ 1)'],
          ['k', 'Index over each bin — the constraint must hold for every bin'],
        ]} />
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Packing Visualizer</div>
        <div className="m4-radio-row">
          {[['ff','First Fit'],['nf','Next Fit'],['bf','Best Fit'],['ffd','FFD']].map(([v,l]) => (
            <label key={v} className={`m4-rpill ${strat===v?'m4-rpill--on':''}`}>
              <input type="radio" value={v} checked={strat===v} onChange={() => setStrat(v)} style={{display:'none'}}/>
              {l}
            </label>
          ))}
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Items</span><span className="m4-ctrl-val">{n}</span></div>
          <input type="range" min="5" max="28" value={n} onChange={e => setN(+e.target.value)}/>
        </div>
        <div className="m4-btn-row">
          <button className="m4-btn m4-btn-g" onClick={() => { const its=generate(); run(its); }}>🎲 New Items</button>
          <button className="m4-btn m4-btn-p" onClick={() => run()}>Pack!</button>
          <button className="m4-btn m4-btn-g" onClick={compareAll}>Compare All</button>
        </div>
        {stats && (
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Bins</span><span className="m4-stat-v" style={{color:'var(--cyan)'}}>{stats.bins}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Packed</span><span className="m4-stat-v" style={{color:'var(--emerald)'}}>{stats.packed}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Avg Fill</span><span className="m4-stat-v" style={{color:'var(--amber)'}}>{stats.fill}%</span></div>
          </div>
        )}
        <canvas ref={bpRef} className="m4-canvas" height="270"/>
        {cmpData && (
          <>
            <div className="m4-flabel" style={{marginTop:'0.75rem'}}>Strategy comparison (bins — lower is better)</div>
            <canvas ref={cmpRef} className="m4-canvas" height="110"/>
          </>
        )}
      </div>
    </div>
  );
}

// ── JSSP Visualizer ───────────────────────────────────────────────────────────
const DEFAULT_JOBS = [
  [[0,3],[1,2],[2,2]],
  [[1,2],[2,1],[0,4]],
  [[2,3],[0,1],[1,2]],
];
const JOB_COLS = ['#22d3ee','#a78bfa','#34d399','#fb7185','#fbbf24'];

function JSSPViz() {
  const [jobs, setJobs] = useState(DEFAULT_JOBS.map(j => j.map(op => [...op])));
  const ganttRef = useRef(null);
  const [res, setRes] = useState(null);

  const schedule = useCallback((jbs) => {
    const nJ = jbs.length, nM = jbs[0].length;
    const machT = Array(nM).fill(0), jobT = Array(nJ).fill(0), opIdx = Array(nJ).fill(0);
    const ops = [];
    let rem = nJ * nM, safety = rem * nJ + 10;
    while (rem > 0 && safety-- > 0) {
      for (let j = 0; j < nJ; j++) {
        const oi = opIdx[j];
        if (oi >= nM) continue;
        const [mi, pi] = jbs[j][oi];
        const start = Math.max(machT[mi], jobT[j]);
        ops.push({ j, oi, mi, start, end: start + pi });
        machT[mi] = start + pi; jobT[j] = start + pi; opIdx[j]++; rem--;
      }
    }
    return { ops, makespan: Math.max(...ops.map(o => o.end), 0), ok: ops.length === nJ * nM };
  }, []);

  const drawGantt = useCallback((r, nM) => {
    const canvas = ganttRef.current;
    if (!canvas || !r) return;
    const W = canvas.width = canvas.offsetWidth || 500, H = canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const LW = 28, cH = H - 18, rowH = cH / nM;
    const scaleX = (W - LW - 8) / (r.makespan || 1);
    for (let mi = 0; mi < nM; mi++) {
      const y = mi * rowH;
      ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
      ctx.strokeRect(LW, y, W - LW - 8, rowH);
      ctx.fillStyle = 'rgba(148,163,184,0.45)'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'right';
      ctx.fillText('M'+mi, LW-3, y+rowH/2+3);
    }
    r.ops.forEach(op => {
      const x = LW + op.start * scaleX, w = (op.end - op.start) * scaleX;
      const y = op.mi * rowH;
      ctx.fillStyle = JOB_COLS[op.j % JOB_COLS.length] + 'cc';
      ctx.fillRect(x+1, y+2, w-2, rowH-4);
      if (w > 18) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.min(10,rowH*0.35)}px monospace`; ctx.textAlign = 'center';
        ctx.fillText('J'+op.j, x+w/2, y+rowH/2+4);
      }
    });
    const msX = LW + r.makespan * scaleX;
    ctx.save(); ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(msX,0); ctx.lineTo(msX,cH); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#fb7185'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Cmax='+r.makespan, msX, cH+13);
  }, []);

  useEffect(() => {
    const r = schedule(DEFAULT_JOBS);
    requestAnimationFrame(() => {
      setRes(r);
      drawGantt(r, DEFAULT_JOBS[0].length);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const compute = () => {
    const r = schedule(jobs);
    setRes(r);
    requestAnimationFrame(() => drawGantt(r, jobs[0].length));
  };
  const reset = () => {
    const fresh = DEFAULT_JOBS.map(j => j.map(op => [...op]));
    setJobs(fresh);
    const r = schedule(fresh);
    setRes(r);
    requestAnimationFrame(() => drawGantt(r, fresh[0].length));
  };
  const updatePT = (ji, oi, val) => {
    setJobs(prev => {
      const next = prev.map(j => j.map(op => [...op]));
      next[ji][oi][1] = Math.max(1, Math.min(20, parseInt(val)||1));
      return next;
    });
  };

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Formal Formulation</div>
        <div className="m4-infobox"><strong>JSSP:</strong> n jobs, m machines. Each job Jᵢ requires m operations in fixed order. Each operation O(j,k) runs on machine μ(j,k) for p(j,k) time units. Minimise makespan.</div>
        <div className="m4-flabel">Objective — Minimise Makespan</div>
        <Tex src="C_{\max} = \max_{i,j}\,(s_{ij} + p_{ij})" block />
        <VarTable vars={[
          ['C_{\\max}', 'Makespan — the total time from start to when the last operation finishes (to be minimised)'],
          ['s_{ij}', 'Start time: the time at which job i begins its operation on machine j'],
          ['p_{ij}', 'Processing time: how long job i takes on machine j (given, fixed)'],
          ['\\max_{i,j}', 'Maximum taken over all jobs i and all machines j — the schedule ends when the last op ends'],
        ]} />
        <div className="m4-hr"/>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--text-1)',marginBottom:'0.5rem'}}>Feasibility Constraints</div>
        <ol style={{fontSize:'0.79rem',color:'var(--text-2)',paddingLeft:'1.2rem',display:'grid',gap:'0.35rem'}}>
          <li><strong style={{color:'var(--text-1)'}}>Machine capacity:</strong> No two ops on same machine overlap</li>
          <li><strong style={{color:'var(--text-1)'}}>Precedence:</strong> <Tex src="s_{j,k+1} \geq s_{j,k} + p_{j,k}" /></li>
          <li><strong style={{color:'var(--text-1)'}}>Assignment:</strong> Op O(j,k) must run on machine μ(j,k)</li>
          <li><strong style={{color:'var(--text-1)'}}>Non-negativity:</strong> <Tex src="s_{j,k} \geq 0" /></li>
        </ol>
        <div className="m4-hr"/>
        <div className="m4-flabel">Complexity</div>
        <Tex src="|H| \leq (n!)^m \quad \text{NP-hard even for } n=3,\,m=3" block />
        <VarTable vars={[
          ['|H|', 'Size of the hypothesis (solution) space — how many possible schedules exist'],
          ['n', 'Number of jobs'],
          ['m', 'Number of machines'],
          ['n!', 'Factorial of n — the number of ways to order n jobs on one machine (e.g., 4! = 24)'],
        ]} />
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Gantt Chart Visualizer</div>
        <p style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.75rem'}}>Edit processing times below. Greedy schedule: each job's next op starts at max(machine ready, job ready).</p>
        <div style={{overflowX:'auto',marginBottom:'0.75rem'}}>
          <table className="m4-jssp-tbl">
            <thead><tr>
              <th>Job</th>
              {jobs[0].map((_,i)=><th key={i}>Op {i+1}</th>)}
            </tr></thead>
            <tbody>
              {jobs.map((job,ji)=>(
                <tr key={ji}>
                  <td style={{fontWeight:700,color:JOB_COLS[ji],fontFamily:'var(--font-mono)',fontSize:'0.78rem',padding:'0.35rem 0.6rem'}}>Job {ji}</td>
                  {job.map((op,oi)=>(
                    <td key={oi} style={{padding:'0.25rem 0.4rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                        <span style={{background:JOB_COLS[op[0]%JOB_COLS.length],color:'#fff',borderRadius:3,padding:'1px 5px',fontSize:'0.7rem',fontWeight:700,fontFamily:'var(--font-mono)'}}>M{op[0]}</span>
                        <input type="number" min="1" max="9" value={op[1]}
                          onChange={e=>updatePT(ji,oi,e.target.value)}
                          style={{width:34,background:'var(--bg-2)',border:'1px solid var(--border)',color:'var(--text-0)',borderRadius:4,padding:'2px 4px',textAlign:'center',fontSize:'0.78rem',fontFamily:'var(--font-mono)'}}/>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="m4-btn-row">
          <button className="m4-btn m4-btn-g" onClick={reset}>Reset</button>
          <button className="m4-btn m4-btn-p" onClick={compute}>Compute &amp; Draw</button>
        </div>
        {res && (
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Cmax</span><span className="m4-stat-v" style={{color:'var(--rose)'}}>{res.makespan}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Feasible?</span><span className="m4-stat-v" style={{color:res.ok?'var(--emerald)':'var(--rose)'}}>{res.ok?'✓':'✗'}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">n×m</span><span className="m4-stat-v" style={{color:'var(--violet)'}}>{jobs.length}×{jobs[0].length}</span></div>
          </div>
        )}
        <canvas ref={ganttRef} className="m4-canvas" height="200"/>
        <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginTop:'0.5rem'}}>
          {jobs.map((_,ji)=>(
            <div key={ji} style={{display:'flex',alignItems:'center',gap:'0.3rem',fontSize:'0.73rem',color:'var(--text-2)'}}>
              <div style={{width:11,height:11,borderRadius:2,background:JOB_COLS[ji]}}/>Job {ji}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Solution Space ────────────────────────────────────────────────────────────
const BENCH = [
  {name:'ft06',n:6,m:6},{name:'abz5',n:10,m:10},{name:'la01',n:10,m:5},
  {name:'ta01',n:15,m:15},{name:'dmu01',n:20,m:20},
];

function SolutionSpaceViz() {
  const [maxN, setMaxN] = useState(6);
  const [maxM, setMaxM] = useState(5);
  const chartRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500, H = canvas.height = 250;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const PAD={l:44,r:40,t:16,b:28};
    const cW=W-PAD.l-PAD.r, cH=H-PAD.t-PAD.b;
    const ns = Array.from({length:maxN-1},(_,i)=>i+2);
    const allV=[];
    for(let m=2;m<=maxM;m++) ns.forEach(n=>{const v=m*Math.log10(factorial(n));if(isFinite(v))allV.push(v);});
    const maxV=Math.max(...allV,1);
    for(let i=0;i<=4;i++){
      const y=PAD.t+(i/4)*cH;
      ctx.strokeStyle='rgba(148,163,184,0.07)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(PAD.l+cW,y); ctx.stroke();
      ctx.fillStyle='rgba(148,163,184,0.4)'; ctx.font='8px monospace'; ctx.textAlign='right';
      ctx.fillText(((1-i/4)*maxV).toFixed(0), PAD.l-3, y+3);
    }
    for(let m=2;m<=maxM;m++){
      const color=CYBER_COLS[(m-2)%CYBER_COLS.length];
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
      ns.forEach((n,i)=>{
        const v=m*Math.log10(factorial(n));
        const x=PAD.l+(ns.length<2?cW/2:i/(ns.length-1)*cW);
        const y=PAD.t+(1-v/maxV)*cH;
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();
      const lastN=ns[ns.length-1];
      const lastV=m*Math.log10(factorial(lastN));
      ctx.fillStyle=color; ctx.font='8px monospace'; ctx.textAlign='left';
      ctx.fillText('m='+m, PAD.l+cW+3, PAD.t+(1-lastV/maxV)*cH+3);
    }
    ctx.fillStyle='rgba(148,163,184,0.5)'; ctx.font='8px monospace';
    ns.forEach((n,i)=>{
      const x=PAD.l+(ns.length<2?cW/2:i/(ns.length-1)*cW);
      ctx.textAlign='center'; ctx.fillText(n,x,H-5);
    });
    ctx.fillText('n (jobs)',PAD.l+cW/2,H-2);
    ctx.save(); ctx.translate(11,PAD.t+cH/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('log₁₀(|S|)',0,0); ctx.restore();
  }, [maxN, maxM]);

  useEffect(()=>{requestAnimationFrame(draw);},[draw]);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Combinatorial Explosion</div>
        <div className="m4-flabel">Solution Space Size</div>
        <Tex src="|H| = (n!)^m" block />
        <VarTable vars={[
          ['|H|', 'Number of distinct candidate schedules (the solution space size)'],
          ['n!', 'Orderings of n jobs on a single machine — grows super-exponentially'],
          ['m', 'Number of machines — each machine independently orders all n jobs, so we raise to the power m'],
        ]} />
        <div className="m4-infobox"><strong>Key insight:</strong> Each of the m machines independently orders n jobs → n! orderings per machine. Across m machines: (n!)ᵐ total candidates. For ft10 (10×10): (10!)¹⁰ ≈ 3.6×10⁶⁵.</div>
        <div className="m4-ctrl" style={{marginTop:'1rem'}}>
          <div className="m4-ctrl-lbl"><span>Jobs (n) up to</span><span className="m4-ctrl-val">{maxN}</span></div>
          <input type="range" min="2" max="8" value={maxN} onChange={e=>setMaxN(+e.target.value)}/>
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Machines (m) up to</span><span className="m4-ctrl-val">{maxM}</span></div>
          <input type="range" min="2" max="6" value={maxM} onChange={e=>setMaxM(+e.target.value)}/>
        </div>
        <canvas ref={chartRef} className="m4-canvas" height="250"/>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Benchmark Instances</div>
        <div className="m4-flabel">Random Search Success Rate</div>
        <Tex src="P(\text{find optimal}) \approx \frac{1}{(n!)^m}" block />
        <VarTable vars={[
          ['P', 'Probability of hitting the optimal schedule with one random guess'],
          ['(n!)^m', 'Total number of candidate schedules — the denominator grows astronomically fast'],
        ]} />
        <table className="m4-bench-tbl">
          <thead><tr><th>Instance</th><th>n</th><th>m</th><th>|S| ≈</th></tr></thead>
          <tbody>
            {BENCH.map(b=>{
              const exp=Math.floor(b.m*Math.log10(factorial(b.n)));
              return(<tr key={b.name}>
                <td style={{fontFamily:'var(--font-mono)',color:'var(--cyan)',fontWeight:700}}>{b.name}</td>
                <td>{b.n}</td><td>{b.m}</td>
                <td style={{fontFamily:'var(--font-mono)',color:'var(--rose)'}}>~10<sup>{exp}</sup></td>
              </tr>);
            })}
          </tbody>
        </table>
        <div className="m4-hr"/>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--text-1)',marginBottom:'0.5rem'}}>Beyond Exhaustive Search</div>
        {[['Greedy','SPT/LPT dispatching rules — fast but suboptimal'],['Local Search','Swap adjacent ops on critical path'],['Evolutionary','Crossover & mutation over permutations'],['Branch & Bound','Prune provably suboptimal subtrees'],['Tabu Search','Neighbourhood search with short-term memory']].map(([n,d])=>(
          <div key={n} style={{fontSize:'0.79rem',color:'var(--text-2)',marginBottom:'0.3rem'}}>
            → <strong style={{color:'var(--text-1)'}}>{n}:</strong> {d}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Derivative Visualizer ─────────────────────────────────────────────────────
const FNS = {
  'x²':   { f: x => x*x,                  df: x => 2*x,                   tex: 'f(x) = x^2',           dtex: "f'(x) = 2x" },
  'x³−3x':{ f: x => x*x*x - 3*x,          df: x => 3*x*x - 3,             tex: 'f(x) = x^3 - 3x',      dtex: "f'(x) = 3x^2 - 3" },
  'sin(x)':{ f: x => Math.sin(x),          df: x => Math.cos(x),           tex: 'f(x) = \\sin(x)',      dtex: "f'(x) = \\cos(x)" },
  'eˣ':   { f: x => Math.exp(x),           df: x => Math.exp(x),           tex: 'f(x) = e^x',           dtex: "f'(x) = e^x" },
  'x²−4x+3':{ f: x => x*x - 4*x + 3,     df: x => 2*x - 4,               tex: 'f(x) = x^2-4x+3',      dtex: "f'(x) = 2x-4" },
};

function DerivativeViz() {
  const [fnKey, setFnKey] = useState('x²−4x+3');
  const [xVal, setXVal] = useState(3);
  const canRef = useRef(null);
  const XMIN = -4, XMAX = 4;

  const fn = FNS[fnKey];

  useEffect(() => {
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500;
    const H = canvas.height = 260;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Map world → canvas
    const xs = Array.from({length: 200}, (_, i) => XMIN + (i / 199) * (XMAX - XMIN));
    const ys = xs.map(fn.f);
    const yMin = Math.min(...ys) - 1, yMax = Math.max(...ys) + 1;
    const toX = x => (x - XMIN) / (XMAX - XMIN) * W;
    const toY = y => H - (y - yMin) / (yMax - yMin) * H;

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
    for (let gx = Math.ceil(XMIN); gx <= XMAX; gx++) {
      ctx.beginPath(); ctx.moveTo(toX(gx), 0); ctx.lineTo(toX(gx), H); ctx.stroke();
    }
    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.lineWidth = 1;
    if (yMin < 0 && yMax > 0) {
      const ay = toY(0);
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();

    // Function curve
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
    xs.forEach((x, i) => {
      const px = toX(x), py = toY(fn.f(x));
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Tangent line at xVal
    const slope = fn.df(xVal);
    const y0 = fn.f(xVal);
    const TAN_RANGE = 1.5;
    const tx1 = xVal - TAN_RANGE, tx2 = xVal + TAN_RANGE;
    const ty1 = y0 + slope * (tx1 - xVal), ty2 = y0 + slope * (tx2 - xVal);
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(toX(tx1), toY(ty1)); ctx.lineTo(toX(tx2), toY(ty2)); ctx.stroke();
    ctx.setLineDash([]);

    // Point on curve
    ctx.fillStyle = '#fb7185';
    ctx.beginPath(); ctx.arc(toX(xVal), toY(y0), 5, 0, 2 * Math.PI); ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let gx = Math.ceil(XMIN); gx <= XMAX; gx++) {
      ctx.fillText(gx, toX(gx), H - 3);
    }
  }, [fn, xVal]); // eslint-disable-line react-hooks/exhaustive-deps

  const slope = fn.df(xVal).toFixed(3);
  const fv = fn.f(xVal).toFixed(3);

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Derivative Rules</div>
        <table className="m4-rule-tbl">
          <thead><tr><th>Rule</th><th>Formula</th></tr></thead>
          <tbody>
            <tr><td>Power</td><td><Tex src="\frac{d}{dx}x^n = nx^{n-1}" /></td></tr>
            <tr><td>Constant multiple</td><td><Tex src="\frac{d}{dx}cf(x) = c\,f'(x)" /></td></tr>
            <tr><td>Sum</td><td><Tex src="\frac{d}{dx}(f+g) = f'+g'" /></td></tr>
            <tr><td>Product</td><td><Tex src="\frac{d}{dx}(fg) = f'g + fg'" /></td></tr>
            <tr><td>Chain</td><td><Tex src="\frac{d}{dx}f(g(x)) = f'(g)\cdot g'" /></td></tr>
            <tr><td>Exponential</td><td><Tex src="\frac{d}{dx}e^x = e^x" /></td></tr>
          </tbody>
        </table>
        <div className="m4-hr"/>
        <div className="m4-flabel">Limit Definition</div>
        <Tex src="f'(x) = \lim_{\Delta x \to 0} \frac{f(x+\Delta x) - f(x)}{\Delta x}" block />
        <VarTable vars={[
          ["f'(x)", "Derivative of f at x — the instantaneous rate of change (slope of the tangent line)"],
          ['\\Delta x', 'A tiny step in x — the derivative is what the slope approaches as this step → 0'],
          ['f(x+\\Delta x) - f(x)', 'Change in y corresponding to the step Δx in x'],
        ]} />
        <div className="m4-hr"/>
        <div className="m4-flabel">Second Derivative Test</div>
        <Tex src="f'(c)=0,\;f''(c)<0 \Rightarrow \text{local max}" block />
        <Tex src="f'(c)=0,\;f''(c)>0 \Rightarrow \text{local min}" block />
        <VarTable vars={[
          ['c', 'The critical point — a value of x where f\'(c) = 0 (slope is zero, so possibly a max or min)'],
          ["f'(c)", "First derivative at c — must be 0 for c to be a candidate extremum"],
          ["f''(c)", "Second derivative at c — measures curvature: negative → concave down (peak), positive → concave up (valley)"],
        ]} />
        <div className="m4-warnbox" style={{marginTop:'0.5rem'}}>
          <strong>Key insight:</strong> Derivatives are the foundation of gradient methods. If we can compute f'(x), we know which way to step toward an optimum.
        </div>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Interactive Tangent Line</div>
        <div className="m4-radio-row" style={{flexWrap:'wrap'}}>
          {Object.keys(FNS).map(k => (
            <label key={k} className={`m4-rpill ${fnKey===k?'m4-rpill--on':''}`}>
              <input type="radio" checked={fnKey===k} onChange={()=>{setFnKey(k); setXVal(0);}} style={{display:'none'}}/>
              {k}
            </label>
          ))}
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>x value</span><span className="m4-ctrl-val">{xVal.toFixed(2)}</span></div>
          <input type="range" min={XMIN*10} max={XMAX*10} value={xVal*10} onChange={e=>setXVal(+e.target.value/10)}/>
        </div>
        <canvas ref={canRef} className="m4-canvas" height="260"/>
        <div className="m4-stats-row" style={{marginTop:'0.5rem'}}>
          <div className="m4-stat"><span className="m4-stat-l">f(x)</span><span className="m4-stat-v" style={{color:'var(--cyan)'}}>{fv}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">f'(x) = slope</span><span className="m4-stat-v" style={{color:'var(--violet)'}}>{slope}</span></div>
          <div className="m4-stat"><span className="m4-stat-l">f'(x)=0?</span><span className="m4-stat-v" style={{color:Math.abs(+slope)<0.1?'var(--emerald)':'var(--rose)'}}>{Math.abs(+slope)<0.1?'≈ Critical':'No'}</span></div>
        </div>
        <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.78rem'}}>
          <Tex src={fn.tex} /> &nbsp;&nbsp; <Tex src={fn.dtex} />
        </div>
      </div>
    </div>
  );
}

// ── Gradient Descent Visualizer ───────────────────────────────────────────────
const GD_FNS = {
  'x²−4x+3':  { f: x => x*x - 4*x + 3,            df: x => 2*x - 4,            xMin:-1, xMax:6 },
  'Rayleigh':  { f: x => x*Math.exp(-x*x/2),        df: x => Math.exp(-x*x/2)*(1-x*x), xMin:-1, xMax:4 },
  'Multimodal':{ f: x => Math.sin(2*x)*x + 0.5*x,  df: x => 2*Math.cos(2*x)*x + Math.sin(2*x) + 0.5, xMin:-3, xMax:5 },
};

function GradientDescentViz() {
  const [fnKey, setFnKey] = useState('x²−4x+3');
  const [alpha, setAlpha] = useState(0.2);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('descent');
  const canRef = useRef(null);
  const animRef = useRef(null);

  const fn = GD_FNS[fnKey];
  const { xMin, xMax } = fn;

  const drawState = useCallback((hist) => {
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500;
    const H = canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const xs = Array.from({length:300}, (_,i) => xMin + i/(299)*(xMax-xMin));
    const ys = xs.map(fn.f);
    const yMinV = Math.min(...ys) - 0.5, yMaxV = Math.max(...ys) + 0.8;
    const toX = x => (x-xMin)/(xMax-xMin)*W;
    const toY = y => H - (y-yMinV)/(yMaxV-yMinV)*H;

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.06)'; ctx.lineWidth = 1;
    for (let g = Math.ceil(xMin); g <= xMax; g++) {
      ctx.beginPath(); ctx.moveTo(toX(g),0); ctx.lineTo(toX(g),H); ctx.stroke();
    }
    // x-axis
    if (yMinV < 0 && yMaxV > 0) {
      const ay = toY(0);
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.beginPath(); ctx.moveTo(0,ay); ctx.lineTo(W,ay); ctx.stroke();
    }
    // Curve
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
    xs.forEach((x,i) => { i===0?ctx.moveTo(toX(x),toY(fn.f(x))):ctx.lineTo(toX(x),toY(fn.f(x))); });
    ctx.stroke();

    // History path
    if (hist.length > 1) {
      ctx.strokeStyle = 'rgba(167,139,250,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
      hist.forEach(({x},i) => {
        const px=toX(x), py=toY(fn.f(x));
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.stroke();
    }

    // Points
    hist.forEach(({x}, i) => {
      const px=toX(x), py=toY(fn.f(x));
      const isLast = i === hist.length-1;
      ctx.fillStyle = isLast ? '#fb7185' : 'rgba(167,139,250,0.4)';
      ctx.beginPath(); ctx.arc(px, py, isLast?5:3, 0, 2*Math.PI); ctx.fill();
    });

    // Labels
    ctx.fillStyle='rgba(148,163,184,0.5)'; ctx.font='9px monospace'; ctx.textAlign='center';
    for (let g = Math.ceil(xMin); g <= xMax; g++) ctx.fillText(g, toX(g), H-3);
  }, [fn, xMin, xMax]);

  const start = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const x0 = xMin + Math.random()*(xMax-xMin);
    const hist = [{x: x0}];
    setHistory([...hist]);
    setRunning(true);

    const step = (prev) => {
      const last = prev[prev.length-1];
      const grad = fn.df(last.x);
      const next = mode === 'descent' ? last.x - alpha*grad : last.x + alpha*grad;
      const clamped = Math.max(xMin, Math.min(xMax, next));
      const newHist = [...prev, {x: clamped}];
      setHistory(newHist);
      drawState(newHist);
      if (newHist.length < 60 && Math.abs(grad) > 0.001) {
        animRef.current = requestAnimationFrame(() => step(newHist));
      } else {
        setRunning(false);
      }
    };
    drawState(hist);
    animRef.current = requestAnimationFrame(() => step(hist));
  }, [fn, alpha, xMin, xMax, mode, drawState]);

  const reset = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setHistory([]); setRunning(false);
    const canvas = canRef.current;
    if (canvas) { const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }
    drawState([]);
  };

  useEffect(()=>{ drawState(history); },[fnKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ drawState([]); }, [drawState]);

  const last = history[history.length-1];

  return (
    <div className="m4-two-col">
      <div className="m4-card">
        <div className="m4-card-h">Gradient Descent / Ascent</div>
        <div className="m4-flabel">Update Rule</div>
        <Tex src="\vec{x} \leftarrow \vec{x} - \alpha\,\nabla f(\vec{x})" block />
        <VarTable vars={[
          ['\\vec{x}', 'Current position in the search space — a vector of parameter values'],
          ['\\alpha', 'Learning rate (step size) — scales how far we move each iteration; too large → overshoot, too small → slow convergence'],
          ['\\nabla f(\\vec{x})', 'Gradient at the current position — points in the direction of steepest ascent'],
          ['-\\,\\nabla f', 'Negative gradient — we subtract it to move downhill (descent); add it for ascent'],
        ]} />
        <div className="m4-hr"/>
        <div className="m4-flabel">Newton-Raphson (optimisation)</div>
        <Tex src="x_{n+1} = x_n - \frac{f'(x_n)}{f''(x_n)}" block />
        <VarTable vars={[
          ['x_n', 'Current estimate of the optimum'],
          ['x_{n+1}', 'Updated (next) estimate after applying the N-R step'],
          ["f'(x_n)", 'First derivative (slope) at the current point — numerator'],
          ["f''(x_n)", 'Second derivative (curvature) at the current point — dividing by curvature makes the step adaptive: large curvature → small step, flat region → large step'],
        ]} />
        <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
          Uses curvature f''(x) to choose optimal step size. Solves quadratics in <strong>one step</strong>. Requires C² smoothness.
        </div>
        <div className="m4-hr"/>
        <div className="m4-flabel">Smoothness Classes</div>
        <table className="m4-rule-tbl">
          <thead><tr><th>Class</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><Tex src="C^0" /></td><td>Continuous</td></tr>
            <tr><td><Tex src="C^1" /></td><td>Continuously differentiable</td></tr>
            <tr><td><Tex src="C^2" /></td><td>Twice differentiable (N-R requires this)</td></tr>
            <tr><td><Tex src="C^\infty" /></td><td>Infinitely differentiable (e.g. eˣ)</td></tr>
          </tbody>
        </table>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">Interactive Gradient Search</div>
        <div className="m4-radio-row" style={{flexWrap:'wrap',marginBottom:'0.5rem'}}>
          {Object.keys(GD_FNS).map(k=>(
            <label key={k} className={`m4-rpill ${fnKey===k?'m4-rpill--on':''}`}>
              <input type="radio" checked={fnKey===k} onChange={()=>{setFnKey(k); reset();}} style={{display:'none'}}/>
              {k}
            </label>
          ))}
        </div>
        <div className="m4-radio-row" style={{marginBottom:'0.5rem'}}>
          {[['descent','Descent (min)'],['ascent','Ascent (max)']].map(([v,l])=>(
            <label key={v} className={`m4-rpill ${mode===v?'m4-rpill--on':''}`}>
              <input type="radio" checked={mode===v} onChange={()=>setMode(v)} style={{display:'none'}}/>
              {l}
            </label>
          ))}
        </div>
        <div className="m4-ctrl">
          <div className="m4-ctrl-lbl"><span>Learning rate α</span><span className="m4-ctrl-val">{alpha.toFixed(2)}</span></div>
          <input type="range" min="1" max="50" value={alpha*100} onChange={e=>setAlpha(+e.target.value/100)}/>
        </div>
        <div className="m4-btn-row">
          <button className="m4-btn m4-btn-p" onClick={start} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run'}
          </button>
          <button className="m4-btn m4-btn-g" onClick={reset}>Reset</button>
        </div>
        <canvas ref={canRef} className="m4-canvas" height="280"/>
        {last && (
          <div className="m4-stats-row">
            <div className="m4-stat"><span className="m4-stat-l">Steps</span><span className="m4-stat-v" style={{color:'var(--cyan)'}}>{history.length}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">x</span><span className="m4-stat-v" style={{color:'var(--violet)'}}>{last.x.toFixed(3)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">f(x)</span><span className="m4-stat-v" style={{color:'var(--amber)'}}>{fn.f(last.x).toFixed(3)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">f'(x)</span><span className="m4-stat-v" style={{color:'var(--rose)'}}>{fn.df(last.x).toFixed(3)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function QuizSection() {
  const [answers, setAnswers] = useState({});
  const [showScore, setShowScore] = useState(false);

  const answer = (qi, chosen) => {
    if (answers[qi]!==undefined) return;
    const correct = chosen===QUIZ_DATA[qi].ans;
    const next = {...answers,[qi]:{chosen,correct}};
    setAnswers(next);
    if(Object.keys(next).length===QUIZ_DATA.length) setTimeout(()=>setShowScore(true),600);
  };
  const reset = () => { setAnswers({}); setShowScore(false); };
  const score = Object.values(answers).filter(a=>a.correct).length;
  const total = QUIZ_DATA.length;
  const msgs = [
    'Keep at it — revisit the core sections and redo the visualizers.',
    'A start. Work through the Calculus and Algorithms tabs.',
    'Getting there. Focus on gradient methods and SA.',
    'Solid — review the one or two you missed.',
    'Good work! Almost exam-ready.',
    'Great — just a couple to tighten up.',
    'Very strong! Nearly flawless.',
    'Excellent! Only a minor slip.',
    'Outstanding — almost perfect.',
    'Flawless! Comprehensive understanding across all topics.',
    'Perfect score! You have a firm grasp of every concept.',
  ];

  return (
    <div className="m4-quiz">
      {QUIZ_DATA.map((q,qi)=>{
        const ans=answers[qi];
        return(
          <div key={qi} className="m4-qcard">
            <div className="m4-qhead">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <div className="m4-qnum" style={{ margin: 0 }}>Question {qi+1} / {total}</div>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--violet)',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: '0.3rem',
                  padding: '0.1rem 0.45rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}>{q.lec}</span>
              </div>
              <div className="m4-qtext">{q.q}</div>
            </div>
            <div className="m4-qopts">
              {q.opts.map((opt,oi)=>{
                let cls='m4-qopt';
                if(ans){ cls+=' m4-qopt--done'; if(oi===q.ans) cls+=' m4-qopt--ok'; else if(oi===ans.chosen&&!ans.correct) cls+=' m4-qopt--ng'; }
                return(
                  <div key={oi} className={cls} onClick={()=>answer(qi,oi)}>
                    <span className="m4-qbadge">{String.fromCharCode(65+oi)}</span>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>
            {ans&&(
              <div className={`m4-qfb ${ans.correct?'m4-qfb--ok':'m4-qfb--ng'}`}>
                <strong>{ans.correct?'✓ Correct!':'✗ Incorrect'}</strong>
                <p>{ans.correct?q.ok:q.ng}</p>
              </div>
            )}
          </div>
        );
      })}
      {showScore&&(
        <div className="m4-score">
          <div className="m4-score-ring" style={{color:score>=8?'var(--emerald)':score>=6?'var(--amber)':'var(--rose)'}}>{score}/{total}</div>
          <div className="m4-score-msg">{msgs[score]}</div>
          <button className="m4-btn m4-btn-p" onClick={reset}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// ── Cyclic Coordinate Search Visualizer ──────────────────────────────────────
const CCS_FN = (x, y) => 2 * Math.pow(y - 0.8 * x, 2) + 0.1 * x * x;
const CCS_INIT = [3.5, -2.0];
const CCS_XR = [-4, 4];
const CCS_YR = [-4, 4];

function ccsLineSearch(p, dim) {
  let best = [...p], bestVal = CCS_FN(p[0], p[1]);
  for (let i = 0; i <= 500; i++) {
    const t = CCS_XR[0] + (CCS_XR[1] - CCS_XR[0]) * i / 500;
    const cand = [...p]; cand[dim] = t;
    const v = CCS_FN(cand[0], cand[1]);
    if (v < bestVal) { bestVal = v; best = [...cand]; }
  }
  return best;
}

function ccsLineSearchDir(p, u) {
  const len = Math.sqrt(u[0]*u[0] + u[1]*u[1]);
  if (len < 1e-10) return [...p];
  let best = [...p], bestVal = CCS_FN(p[0], p[1]);
  for (let t = -4; t <= 4; t += 0.005) {
    const cand = [p[0] + t*u[0], p[1] + t*u[1]];
    if (cand[0] < CCS_XR[0] || cand[0] > CCS_XR[1] || cand[1] < CCS_YR[0] || cand[1] > CCS_YR[1]) continue;
    const v = CCS_FN(cand[0], cand[1]);
    if (v < bestVal) { bestVal = v; best = [...cand]; }
  }
  return best;
}

function CCSViz() {
  // All mutable algorithm state lives in one ref so the interval callback never goes stale
  const sRef = useRef({
    pos: [...CCS_INIT],
    hist: [{ pos: [...CCS_INIT], type: 'start' }],
    cycleStart: [...CCS_INIT],   // x^0: position at start of current cycle
    dim: 0,                       // which coordinate is being searched next (0=x₁, 1=x₂)
    awaitingAccel: false,         // true after a full cycle, before the accel step
    cycleEnd: null,               // x^n: position at end of cycle (used for u = x^n - x^0)
    cycleCount: 0,
    iters: 0,
    accelEnabled: true,
  });
  const [tick, setTick] = useState(0); // just triggers re-render to sync display with sRef
  const [running, setRunning] = useState(false);
  const canRef = useRef(null);

  const drawCanvas = useCallback(() => {
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500;
    const H = canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const toX = x => (x - CCS_XR[0]) / (CCS_XR[1] - CCS_XR[0]) * W;
    const toY = y => H - (y - CCS_YR[0]) / (CCS_YR[1] - CCS_YR[0]) * H;

    // Heatmap
    const RES = 60;
    const cw = W/RES, ch = H/RES;
    let minV = Infinity, maxV = -Infinity;
    const grid = [];
    for (let i = 0; i < RES; i++) {
      grid[i] = [];
      for (let j = 0; j < RES; j++) {
        const x = CCS_XR[0] + (i+0.5)/RES*(CCS_XR[1]-CCS_XR[0]);
        const y = CCS_YR[0] + (j+0.5)/RES*(CCS_YR[1]-CCS_YR[0]);
        const v = CCS_FN(x, y);
        grid[i][j] = v;
        if (v < minV) minV = v; if (v > maxV) maxV = v;
      }
    }
    const rng = maxV - minV || 1;
    for (let i = 0; i < RES; i++) for (let j = 0; j < RES; j++) {
      const t = (grid[i][j] - minV) / rng;
      ctx.fillStyle = `rgba(${Math.floor(t*40)},${Math.floor(80+t*80)},${Math.floor(160-t*80)},0.45)`;
      ctx.fillRect(i*cw, H-(j+1)*ch, cw, ch);
    }

    // Axis guide lines
    ctx.strokeStyle = 'rgba(148,163,184,0.1)'; ctx.lineWidth = 0.5; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
    ctx.setLineDash([]);

    // Minimum crosshair at origin
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toX(0)-10,toY(0)); ctx.lineTo(toX(0)+10,toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0),toY(0)-10); ctx.lineTo(toX(0),toY(0)+10); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='8px monospace'; ctx.textAlign='left';
    ctx.fillText('min',toX(0)+4,toY(0)-5);

    // History path
    const s = sRef.current;
    for (let i = 1; i < s.hist.length; i++) {
      const from = s.hist[i].from || s.hist[i-1].pos;
      const to   = s.hist[i].pos;
      const type = s.hist[i].type;
      ctx.beginPath(); ctx.moveTo(toX(from[0]),toY(from[1])); ctx.lineTo(toX(to[0]),toY(to[1]));
      if (type === 'accel') {
        ctx.strokeStyle='#a78bfa'; ctx.lineWidth=3; ctx.setLineDash([]);
      } else if (type === 'dim0') {
        ctx.strokeStyle='#fb7185'; ctx.lineWidth=2; ctx.setLineDash([3,2]);
      } else {
        ctx.strokeStyle='#34d399'; ctx.lineWidth=2; ctx.setLineDash([3,2]);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Cycle-start marker (x⁰)
    const cs = s.cycleStart;
    ctx.beginPath(); ctx.arc(toX(cs[0]),toY(cs[1]),5,0,Math.PI*2);
    ctx.strokeStyle='#fbbf24'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='rgba(251,191,36,0.15)'; ctx.fill();
    ctx.fillStyle='#fbbf24'; ctx.font='bold 8px monospace'; ctx.textAlign='left';
    ctx.fillText('x⁰',toX(cs[0])+7,toY(cs[1])+3);

    // Current position
    const p = s.pos;
    ctx.beginPath(); ctx.arc(toX(p[0]),toY(p[1]),7,0,Math.PI*2);
    ctx.fillStyle='#fbbf24'; ctx.fill();
    ctx.fillStyle='#000'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
    ctx.fillText('x',toX(p[0]),toY(p[1])+3);

    // Show predicted u direction when awaiting accel
    if (s.awaitingAccel && s.cycleEnd) {
      const u = [s.cycleEnd[0]-s.cycleStart[0], s.cycleEnd[1]-s.cycleStart[1]];
      ctx.beginPath();
      ctx.moveTo(toX(s.cycleEnd[0]),toY(s.cycleEnd[1]));
      ctx.lineTo(toX(s.cycleEnd[0]+u[0]*1.5),toY(s.cycleEnd[1]+u[1]*1.5));
      ctx.strokeStyle='rgba(167,139,250,0.6)'; ctx.lineWidth=2; ctx.setLineDash([4,2]);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#a78bfa'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText('u',toX(s.cycleEnd[0]+u[0]*0.75),toY(s.cycleEnd[1]+u[1]*0.75)-6);
    }
  }, []); // reads sRef directly — stable, no deps needed

  const doStep = useCallback(() => {
    const s = sRef.current;
    if (s.awaitingAccel) {
      // Acceleration: line search in direction u = x^n − x^0
      const u = [s.cycleEnd[0]-s.cycleStart[0], s.cycleEnd[1]-s.cycleStart[1]];
      const newPos = ccsLineSearchDir(s.cycleEnd, u);
      s.hist = [...s.hist, { pos: newPos, type: 'accel', from: [...s.cycleEnd] }];
      s.pos = newPos; s.cycleStart = [...newPos]; s.awaitingAccel = false;
      s.cycleEnd = null; s.dim = 0; s.cycleCount++; s.iters++;
    } else {
      // Coordinate line search in dimension s.dim
      const newPos = ccsLineSearch(s.pos, s.dim);
      const type = s.dim === 0 ? 'dim0' : 'dim1';
      s.hist = [...s.hist, { pos: newPos, type, from: [...s.pos] }];
      s.pos = newPos; s.iters++;
      const nextDim = 1 - s.dim; s.dim = nextDim;
      if (nextDim === 0) {
        // Completed a full cycle
        s.cycleEnd = [...newPos];
        if (s.accelEnabled) { s.awaitingAccel = true; }
        else { s.cycleStart = [...newPos]; s.cycleCount++; }
      }
    }
    setTick(t => t+1);
    requestAnimationFrame(drawCanvas);
  }, [drawCanvas]);

  const reset = useCallback(() => {
    setRunning(false);
    const s = sRef.current;
    s.pos = [...CCS_INIT]; s.hist = [{pos:[...CCS_INIT],type:'start'}];
    s.cycleStart = [...CCS_INIT]; s.dim = 0; s.awaitingAccel = false;
    s.cycleEnd = null; s.cycleCount = 0; s.iters = 0;
    setTick(t => t+1);
    requestAnimationFrame(drawCanvas);
  }, [drawCanvas]);

  useEffect(() => { requestAnimationFrame(drawCanvas); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const id = setInterval(doStep, 500);
    return () => clearInterval(id);
  }, [running, doStep]);

  const s = sRef.current;
  const curF = CCS_FN(s.pos[0], s.pos[1]).toFixed(4);
  const nextName = s.awaitingAccel ? '→ Acceleration (u = xⁿ − x⁰)' : s.dim === 0 ? '→ x₁ line search (horizontal ↔)' : '→ x₂ line search (vertical ↕)';
  const nextCol  = s.awaitingAccel ? 'var(--violet)' : s.dim === 0 ? 'var(--rose)' : 'var(--emerald)';

  return (
    <div className="m4-two-col" style={{marginTop:'1.5rem'}}>
      {/* ── Left: algorithm state + equation explainer ── */}
      <div className="m4-card">
        <div className="m4-card-h">CCS Algorithm State</div>

        {/* Live variable readout */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',marginBottom:'0.75rem'}}>
          {[
            ['x (position)',    `[${s.pos[0].toFixed(2)}, ${s.pos[1].toFixed(2)}]`],
            ['f(x)',            curF],
            ['x⁰ (cycle start)',`[${s.cycleStart[0].toFixed(2)}, ${s.cycleStart[1].toFixed(2)}]`],
            ['Cycle',           s.cycleCount + (s.awaitingAccel ? ' → accel!' : '')],
          ].map(([lbl,val])=>(
            <div key={lbl} style={{background:'var(--bg-2)',borderRadius:5,padding:'0.35rem 0.5rem',border:'1px solid var(--border)',fontSize:'0.74rem'}}>
              <div style={{color:'var(--text-2)',marginBottom:2}}>{lbl}</div>
              <strong style={{color:'var(--cyan)',fontFamily:'monospace'}}>{val}</strong>
            </div>
          ))}
        </div>

        {/* Next step indicator */}
        <div style={{padding:'0.45rem 0.7rem',background:'rgba(15,23,42,0.6)',borderRadius:6,border:`1px solid ${nextCol}55`,marginBottom:'0.75rem'}}>
          <span style={{fontSize:'0.7rem',color:'var(--text-2)'}}>Next: </span>
          <span style={{fontSize:'0.84rem',color:nextCol,fontWeight:700,fontFamily:'monospace'}}>{nextName}</span>
        </div>

        {/* Contextual equation + variable explanations */}
        {!s.awaitingAccel ? (
          <>
            <div className="m4-flabel">Active equation</div>
            <Tex src={`\\vec{x}^{${s.iters+1}} = \\arg\\min_{x_${s.dim+1}}\\, f(x_1, x_2)`} block />
            <VarTable vars={[
              [`\\vec{x}^{${s.iters+1}}`, `New position — only x${s.dim+1} will move; the other coordinate stays locked`],
              [`x_${s.dim+1}`, `Coordinate being optimised — we sweep along the ${s.dim===0?'horizontal (x₁ axis)':'vertical (x₂ axis)'}`],
              [`x_${s.dim===0?2:1}`, `Fixed coordinate — held at ${(s.dim===0?s.pos[1]:s.pos[0]).toFixed(3)} for this step`],
              [`\\arg\\min`, `"The value that minimises f" — found by sampling 500 candidate values along the axis`],
              [`f`, `Objective function: f(x₁,x₂) = 2(x₂ − 0.8·x₁)² + 0.1·x₁² — minimum at origin`],
            ]} />
          </>
        ) : (
          <>
            <div className="m4-flabel">Acceleration equation</div>
            <Tex src={`\\vec{u} = \\vec{x}^n - \\vec{x}^0`} block />
            <VarTable vars={[
              [`\\vec{u}`, `Net direction: [${s.cycleEnd ? ((s.cycleEnd[0]-s.cycleStart[0]).toFixed(2)+', '+(s.cycleEnd[1]-s.cycleStart[1]).toFixed(2)) : '…'}] — the diagonal CCS actually traveled`],
              [`\\vec{x}^0`, `Cycle start (recorded before the first search): [${s.cycleStart[0].toFixed(2)}, ${s.cycleStart[1].toFixed(2)}]`],
              [`\\vec{x}^n`, `Cycle end (after both x₁ and x₂ searches): [${s.cycleEnd ? s.cycleEnd[0].toFixed(2) : '…'}, ${s.cycleEnd ? s.cycleEnd[1].toFixed(2) : '…'}]`],
              [`n`, `Number of dimensions = 2 (both x₁ and x₂ were searched this cycle)`],
            ]} />
            <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.78rem'}}>
              The next line search will travel along <strong>u</strong> — pointing diagonally toward the valley floor instead of zig-zagging axis by axis.
            </div>
          </>
        )}

        {/* Acceleration toggle */}
        <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',marginTop:'0.75rem',fontSize:'0.8rem'}}>
          <input type="checkbox" checked={s.accelEnabled}
            onChange={e => { sRef.current.accelEnabled = e.target.checked; reset(); }} />
          <span style={{color:s.accelEnabled?'var(--violet)':'var(--text-2)'}}>Enable acceleration step</span>
        </label>
      </div>

      {/* ── Right: canvas + controls ── */}
      <div className="m4-card">
        <div className="m4-card-h">Live Landscape — Diagonal Valley</div>
        <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.4rem'}}>
          f(x₁, x₂) = 2(x₂ − 0.8·x₁)² + 0.1·x₁² &nbsp;·&nbsp; minimum at origin ✕
        </div>
        <canvas ref={canRef} className="m4-canvas" height="300"/>
        <div style={{display:'flex',gap:'0.75rem',marginTop:'0.4rem',flexWrap:'wrap'}}>
          {[['#fb7185','x₁ search (horizontal)'],['#34d399','x₂ search (vertical)'],['#a78bfa','Acceleration (diagonal)'],['#fbbf24','Current position / x⁰']].map(([c,l])=>(
            <div key={l} style={{display:'flex',gap:'0.35rem',alignItems:'center',fontSize:'0.72rem',color:'var(--text-2)'}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:c}}/>{l}
            </div>
          ))}
        </div>
        <div className="m4-btn-row" style={{marginTop:'0.5rem'}}>
          <button className="m4-btn m4-btn-g" onClick={doStep}>Step →</button>
          <button className="m4-btn m4-btn-p" onClick={()=>setRunning(r=>!r)}>
            {running?'⏸ Pause':'▶ Auto-run'}
          </button>
          <button className="m4-btn m4-btn-g" onClick={reset}>Reset</button>
        </div>
        <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.78rem'}}>
          <strong>Without acceleration:</strong> watch the staircase zig-zag never leave the valley floor. <strong>Toggle acceleration on</strong> — after each full cycle, u = xⁿ − x⁰ points diagonally and escapes in one step.
        </div>
      </div>
    </div>
  );
}

// ── Nelder-Mead Simplex Visualizer ───────────────────────────────────────────
const NM_FNS = {
  'Bowl+Ridge':   (x,y) => 0.4*(x*x + y*y) + 1.2*Math.sin(x)*Math.cos(y),
  'Elliptical':   (x,y) => 0.3*x*x + 1.2*y*y,
  'Diagonal Valley': (x,y) => 0.05*(x+y)**2 + 2*(x-y)**2,
};

function NelderMeadViz() {
  const [fnKey, setFnKey] = useState('Bowl+Ridge');
  const [verts, setVerts] = useState([[2.5,2.5],[-2,1.5],[0.5,-2.5]]);
  const [lastOp, setLastOp] = useState(null);
  const [iters, setIters] = useState(0);
  const [running, setRunning] = useState(false);
  const canRef = useRef(null);
  const vertsRef = useRef([[2.5,2.5],[-2,1.5],[0.5,-2.5]]);

  const fn = NM_FNS[fnKey];
  const XR = [-4,4], YR = [-4,4];

  const drawCanvas = useCallback((v) => {
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 500;
    const H = canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const toX = x => (x-XR[0])/(XR[1]-XR[0])*W;
    const toY = y => H-(y-YR[0])/(YR[1]-YR[0])*H;

    // Heatmap
    const RES = 60;
    const cw = W/RES, ch = H/RES;
    let minV=Infinity, maxV=-Infinity;
    const grid = Array.from({length:RES},(_,i)=>Array.from({length:RES},(_,j)=>{
      const x=XR[0]+(i+0.5)/RES*(XR[1]-XR[0]);
      const y=YR[0]+(j+0.5)/RES*(YR[1]-YR[0]);
      const val=fn(x,y);
      if(val<minV) minV=val; if(val>maxV) maxV=val;
      return val;
    }));
    const rng = maxV-minV||1;
    for(let i=0;i<RES;i++) for(let j=0;j<RES;j++){
      const t=(grid[i][j]-minV)/rng;
      ctx.fillStyle=`rgba(${Math.floor(t*40)},${Math.floor(80+t*80)},${Math.floor(160-t*80)},0.4)`;
      ctx.fillRect(i*cw, H-(j+1)*ch, cw, ch);
    }

    if(!v||v.length!==3) return;
    const vals=v.map(([x,y])=>fn(x,y));
    const sorted=[0,1,2].sort((a,b)=>vals[a]-vals[b]);
    const LABELS=['','','']; LABELS[sorted[0]]='B'; LABELS[sorted[1]]='G'; LABELS[sorted[2]]='W';
    const VCOL={B:'#34d399',G:'#fbbf24',W:'#fb7185'};

    // Triangle fill
    ctx.beginPath();
    ctx.moveTo(toX(v[0][0]),toY(v[0][1]));
    ctx.lineTo(toX(v[1][0]),toY(v[1][1]));
    ctx.lineTo(toX(v[2][0]),toY(v[2][1]));
    ctx.closePath();
    ctx.fillStyle='rgba(167,139,250,0.18)'; ctx.fill();
    ctx.strokeStyle='rgba(167,139,250,0.75)'; ctx.lineWidth=1.8; ctx.stroke();

    v.forEach(([x,y],i)=>{
      const lbl=LABELS[i], col=VCOL[lbl];
      const px=toX(x), py=toY(y);
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(px,py,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 10px monospace'; ctx.textAlign='center';
      ctx.fillText(lbl,px,py+4);
    });
  }, [fn]); // eslint-disable-line react-hooks/exhaustive-deps

  const nmStep = useCallback((v) => {
    const vals=v.map(([x,y])=>fn(x,y));
    const sorted=[0,1,2].sort((a,b)=>vals[a]-vals[b]);
    const [bi,gi,wi]=sorted;
    const cx=(v[bi][0]+v[gi][0])/2, cy=(v[bi][1]+v[gi][1])/2;
    const rr=[cx+(cx-v[wi][0]), cy+(cy-v[wi][1])];
    const fr=fn(rr[0],rr[1]);
    let nv=v.map(p=>[...p]), op='';

    if(fr<vals[bi]){
      const ex=[cx+2*(rr[0]-cx), cy+2*(rr[1]-cy)];
      if(fn(ex[0],ex[1])<fr){ nv[wi]=ex; op='Expand'; }
      else{ nv[wi]=rr; op='Reflect'; }
    } else if(fr<vals[gi]){
      nv[wi]=rr; op='Reflect';
    } else {
      const cc=[cx+0.5*(v[wi][0]-cx), cy+0.5*(v[wi][1]-cy)];
      if(fn(cc[0],cc[1])<vals[wi]){ nv[wi]=cc; op='Contract'; }
      else{
        nv=[ v[bi],
          [v[bi][0]+0.5*(v[gi][0]-v[bi][0]), v[bi][1]+0.5*(v[gi][1]-v[bi][1])],
          [v[bi][0]+0.5*(v[wi][0]-v[bi][0]), v[bi][1]+0.5*(v[wi][1]-v[bi][1])],
        ]; op='Shrink';
      }
    }
    return {nv, op};
  }, [fn]);

  const doStep = useCallback(() => {
    const {nv, op} = nmStep(vertsRef.current);
    vertsRef.current=nv; setVerts([...nv]); setLastOp(op); setIters(i=>i+1);
    requestAnimationFrame(()=>drawCanvas(nv));
  }, [nmStep, drawCanvas]);

  const reset = useCallback(() => {
    setRunning(false);
    const init=[[2.5,2.5],[-2,1.5],[0.5,-2.5]];
    vertsRef.current=init; setVerts(init); setLastOp(null); setIters(0);
    requestAnimationFrame(()=>drawCanvas(init));
  }, [drawCanvas]);

  useEffect(()=>{ requestAnimationFrame(()=>drawCanvas(vertsRef.current)); }, [fnKey, drawCanvas]);
  useEffect(()=>{ requestAnimationFrame(()=>drawCanvas(vertsRef.current)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!running) return;
    const id=setInterval(()=>{ doStep(); }, 380);
    return ()=>clearInterval(id);
  }, [running, doStep]);

  const opCol={Reflect:'var(--cyan)',Expand:'var(--emerald)',Contract:'var(--amber)',Shrink:'var(--rose)'};
  const vals = verts.map(([x,y])=>fn(x,y));
  const bestF = Math.min(...vals).toFixed(3);

  return (
    <div className="m4-two-col" style={{marginTop:'1.5rem'}}>
      <div className="m4-card">
        <div className="m4-card-h">Nelder-Mead Operations</div>
        <div className="m4-infobox">The simplex (triangle in 2D, tetrahedron in 3D) "rolls downhill" via four operations. <strong>B</strong>=Best (lowest f), <strong>G</strong>=Good, <strong>W</strong>=Worst vertex.</div>
        <table className="m4-rule-tbl" style={{marginTop:'0.5rem'}}>
          <thead><tr><th>Op</th><th>Formula</th><th>Triggered when</th></tr></thead>
          <tbody>
            <tr><td style={{color:'var(--cyan)'}}>Reflect</td><td><Tex src="\vec{x}_r = \bar{x}+\alpha(\bar{x}-\vec{x}_W)" /></td><td>f(r) in [B, G]</td></tr>
            <tr><td style={{color:'var(--emerald)'}}>Expand</td><td><Tex src="\vec{x}_e = \bar{x}+\beta(\vec{x}_r-\bar{x})" /></td><td>f(r) better than B</td></tr>
            <tr><td style={{color:'var(--amber)'}}>Contract</td><td><Tex src="\vec{x}_c = \bar{x}+\gamma(\vec{x}_W-\bar{x})" /></td><td>f(r) worse than G</td></tr>
            <tr><td style={{color:'var(--rose)'}}>Shrink</td><td><Tex src="\vec{x}_i \leftarrow \vec{x}_B+\sigma(\vec{x}_i-\vec{x}_B)" /></td><td>Contract also fails</td></tr>
          </tbody>
        </table>
        <div style={{marginTop:'0.75rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.35rem'}}>
          {[['α','Reflection','1'],['β','Expansion','2'],['γ','Contraction','0.5'],['σ','Shrink','0.5']].map(([sym,name,val])=>(
            <div key={sym} style={{background:'var(--bg-2)',borderRadius:5,padding:'0.35rem 0.5rem',border:'1px solid var(--border)',fontSize:'0.75rem'}}>
              <Tex src={sym} /> <span style={{color:'var(--text-2)'}}>{name}</span> <strong style={{color:'var(--cyan)',fontFamily:'monospace'}}>{val}</strong>
            </div>
          ))}
        </div>
        {lastOp && (
          <div style={{marginTop:'0.75rem',padding:'0.45rem 0.75rem',background:'rgba(15,23,42,0.6)',borderRadius:6,border:`1px solid ${(opCol[lastOp]||'var(--violet)')}44`}}>
            <span style={{fontSize:'0.72rem',color:'rgba(148,163,184,0.5)'}}>Last op: </span>
            <strong style={{fontSize:'0.88rem',color:opCol[lastOp]||'var(--violet)',fontFamily:'monospace'}}>{lastOp}</strong>
            <span style={{fontSize:'0.72rem',color:'rgba(148,163,184,0.4)',marginLeft:'0.75rem'}}>iter {iters} · best f≈{bestF}</span>
          </div>
        )}
        <div className="m4-infobox" style={{marginTop:'0.75rem',fontSize:'0.79rem'}}>
          <strong>Why no derivatives?</strong> NM only calls f(x) — it doesn't compute slopes. This makes it applicable to any evaluable function: discrete, noisy, or black-box. It "foreshadows" population-based methods — the group's combined state drives the search.
        </div>
      </div>
      <div className="m4-card">
        <div className="m4-card-h">Live Simplex — 2D Landscape</div>
        <div className="m4-radio-row" style={{flexWrap:'wrap'}}>
          {Object.keys(NM_FNS).map(k=>(
            <label key={k} className={`m4-rpill ${fnKey===k?'m4-rpill--on':''}`}>
              <input type="radio" checked={fnKey===k} onChange={()=>{setFnKey(k);reset();}} style={{display:'none'}}/>
              {k}
            </label>
          ))}
        </div>
        <canvas ref={canRef} className="m4-canvas" height="300"/>
        <div style={{display:'flex',gap:'1rem',marginTop:'0.4rem',flexWrap:'wrap'}}>
          {[['#34d399','B = Best (lowest f)'],['#fbbf24','G = Good'],['#fb7185','W = Worst']].map(([c,l])=>(
            <div key={l} style={{display:'flex',gap:'0.4rem',alignItems:'center',fontSize:'0.72rem',color:'var(--text-2)'}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:c}}/>{l}
            </div>
          ))}
        </div>
        <div className="m4-btn-row" style={{marginTop:'0.5rem'}}>
          <button className="m4-btn m4-btn-g" onClick={doStep}>Step →</button>
          <button className="m4-btn m4-btn-p" onClick={()=>setRunning(r=>!r)}>
            {running?'⏸ Pause':'▶ Auto-run'}
          </button>
          <button className="m4-btn m4-btn-g" onClick={reset}>Reset</button>
        </div>
        <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.78rem'}}>
          Try <strong>Diagonal Valley</strong> — watch CCS struggle but NM converges by adapting its shape to the valley geometry.
        </div>
      </div>
    </div>
  );
}

// ── Simulated Annealing Interactive Visualizer ────────────────────────────────
function SAViz() {
  const XMIN=-5, XMAX=5;
  const saFn = x => Math.sin(2*x) + 0.7*Math.sin(3.5*x) - 0.08*x;

  const [tVal, setTVal] = useState(2.0);
  const [pos, setPos] = useState(-4.0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([{x:-4.0}]);
  const [info, setInfo] = useState(null);
  const canRef = useRef(null);
  const posRef = useRef(-4.0);
  const tRef = useRef(2.0);

  const drawLandscape = useCallback((hist, cur) => {
    const canvas = canRef.current;
    if(!canvas) return;
    const W = canvas.width = canvas.offsetWidth||500;
    const H = canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const xs = Array.from({length:300},(_,i)=>XMIN+i/299*(XMAX-XMIN));
    const ys = xs.map(saFn);
    const yMin=Math.min(...ys)-0.4, yMax=Math.max(...ys)+0.4;
    const toX = x=>(x-XMIN)/(XMAX-XMIN)*W;
    const toY = y=>H-(y-yMin)/(yMax-yMin)*H;

    ctx.strokeStyle='rgba(148,163,184,0.07)'; ctx.lineWidth=1;
    for(let g=Math.ceil(XMIN);g<=XMAX;g++){
      ctx.beginPath(); ctx.moveTo(toX(g),0); ctx.lineTo(toX(g),H); ctx.stroke();
    }

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'rgba(34,211,238,0.18)');
    grad.addColorStop(1,'rgba(34,211,238,0.01)');
    ctx.beginPath();
    xs.forEach((x,i)=>i===0?ctx.moveTo(toX(x),toY(saFn(x))):ctx.lineTo(toX(x),toY(saFn(x))));
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();

    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=2.5; ctx.beginPath();
    xs.forEach((x,i)=>i===0?ctx.moveTo(toX(x),toY(saFn(x))):ctx.lineTo(toX(x),toY(saFn(x))));
    ctx.stroke();

    // Trail
    if(hist.length>1){
      ctx.strokeStyle='rgba(167,139,250,0.35)'; ctx.lineWidth=1.5; ctx.beginPath();
      hist.slice(-40).forEach(({x},i)=>i===0?ctx.moveTo(toX(x),toY(saFn(x))):ctx.lineTo(toX(x),toY(saFn(x))));
      ctx.stroke();
    }

    // Current pos
    if(cur!==undefined){
      const cx=toX(cur), cy=toY(saFn(cur));
      ctx.shadowColor='#fb7185'; ctx.shadowBlur=10;
      ctx.fillStyle='#fb7185'; ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText('S',cx,cy+3);
    }
    ctx.fillStyle='rgba(148,163,184,0.4)'; ctx.font='8px monospace'; ctx.textAlign='center';
    for(let g=Math.ceil(XMIN);g<=XMAX;g++) ctx.fillText(g,toX(g),H-2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ drawLandscape(history, pos); }, [pos, history, drawLandscape]);
  useEffect(()=>{ drawLandscape([{x:-4}],-4); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!running) return;
    const id = setInterval(()=>{
      const cur = posRef.current, t = tRef.current;
      const step = (Math.random()-0.5)*2.5;
      const next = Math.max(XMIN, Math.min(XMAX, cur+step));
      const qCur=saFn(cur), qNext=saFn(next);
      const p = Math.exp((qNext-qCur)/t);
      const accepted = qNext>qCur || Math.random()<p;
      const newPos = accepted?next:cur;
      posRef.current=newPos; setPos(newPos);
      setHistory(h=>[...h.slice(-60),{x:newPos}]);
      setInfo({qCur:qCur.toFixed(3), qNext:qNext.toFixed(3),
               p: Math.min(1,p).toFixed(3), accepted, better:qNext>qCur});
      const newT = Math.max(0.01, t*0.985);
      tRef.current=newT; setTVal(newT);
    }, 140);
    return ()=>clearInterval(id);
  }, [running]);

  const resetSA = () => {
    setRunning(false);
    posRef.current=-4; tRef.current=2;
    setPos(-4); setHistory([{x:-4}]); setInfo(null); setTVal(2.0);
  };

  // P vs ΔQ curve points for SVG
  const curvePts = Array.from({length:50},(_,i)=>{
    const dq = -i/49*4;
    const p = Math.min(1,Math.exp(dq/tVal));
    const svgX = (1-i/49)*190+5;
    const svgY = 5+(1-p)*80;
    return `${svgX},${svgY}`;
  }).join(' ');

  return (
    <div className="m4-two-col" style={{marginTop:'1.5rem'}}>
      <div className="m4-card">
        <div className="m4-card-h">Acceptance Probability Explorer</div>
        <Tex src="P = e^{(Q(R)-Q(S))/t}" block />
        <div className="m4-ctrl" style={{marginTop:'0.5rem'}}>
          <div className="m4-ctrl-lbl">
            <span>Temperature t</span>
            <span className="m4-ctrl-val" style={{color:tVal>1?'var(--rose)':tVal>0.2?'var(--amber)':'var(--emerald)'}}>
              {tVal.toFixed(3)}
            </span>
          </div>
          <input type="range" min="1" max="500" value={Math.round(tVal*100)}
            onChange={e=>{const v=+e.target.value/100; setTVal(v); tRef.current=v;}}/>
        </div>
        <div className="m4-flabel" style={{marginTop:'0.5rem'}}>P vs ΔQ = Q(R)−Q(S) (ΔQ ≤ 0 means R is worse)</div>
        <div style={{background:'var(--bg-2)',borderRadius:6,padding:'0.5rem',border:'1px solid var(--border)',overflow:'hidden'}}>
          <svg viewBox="0 0 200 95" style={{width:'100%',display:'block'}}>
            <line x1="5" y1="5" x2="5" y2="85" stroke="rgba(148,163,184,0.2)" strokeWidth="0.5"/>
            <line x1="5" y1="85" x2="195" y2="85" stroke="rgba(148,163,184,0.2)" strokeWidth="0.5"/>
            {[0,0.25,0.5,0.75,1].map(p=>(
              <g key={p}>
                <line x1="5" y1={5+(1-p)*80} x2="195" y2={5+(1-p)*80} stroke="rgba(148,163,184,0.07)" strokeWidth="0.5"/>
                <text x="3" y={5+(1-p)*80+3} fill="rgba(148,163,184,0.45)" fontSize="5" textAnchor="end">{p}</text>
              </g>
            ))}
            {[0,-1,-2,-3,-4].map((dq,i)=>(
              <text key={dq} x={5+i/4*190} y="93" fill="rgba(148,163,184,0.4)" fontSize="5" textAnchor="middle">ΔQ={dq}</text>
            ))}
            <polyline points={curvePts} fill="none" stroke="#22d3ee" strokeWidth="1.8"/>
            <text x="110" y="14" fill="rgba(34,211,238,0.6)" fontSize="5.5">t={tVal.toFixed(2)}</text>
          </svg>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.35rem',marginTop:'0.5rem'}}>
          {[-0.5,-1,-2,-3].map(dq=>(
            <div key={dq} style={{background:'var(--bg-2)',borderRadius:4,padding:'0.3rem 0.6rem',border:'1px solid var(--border)',fontSize:'0.75rem',display:'flex',justifyContent:'space-between'}}>
              <span style={{color:'var(--rose)'}}>ΔQ={dq}</span>
              <span style={{color:'var(--emerald)',fontWeight:700,fontFamily:'monospace'}}>{Math.min(1,Math.exp(dq/tVal)).toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.79rem'}}>
          <strong>High t</strong> → curve flat → accepts almost any worse move → <em>random walk</em><br/>
          <strong>Low t</strong> → curve steep → only near-equal accepted → <em>pure hill climb</em>
        </div>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">SA Walker on Multimodal Landscape</div>
        <p style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.4rem'}}>
          f(x) = sin(2x) + 0.7sin(3.5x) − 0.08x · Maximising. Temperature auto-cools ×0.985 each step.
        </p>
        <canvas ref={canRef} className="m4-canvas" height="220"/>
        {info && (
          <div className="m4-stats-row" style={{marginTop:'0.4rem'}}>
            <div className="m4-stat"><span className="m4-stat-l">Q(S)</span><span className="m4-stat-v" style={{color:'var(--cyan)'}}>{info.qCur}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Q(R)</span><span className="m4-stat-v" style={{color:'var(--violet)'}}>{info.qNext}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">P</span><span className="m4-stat-v" style={{color:'var(--amber)'}}>{info.better?'—':info.p}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">Accept?</span>
              <span className="m4-stat-v" style={{color:info.accepted?'var(--emerald)':'var(--rose)'}}>
                {info.accepted?(info.better?'✓ Better':'✓ SA'):'✗ Reject'}
              </span>
            </div>
          </div>
        )}
        <div style={{marginTop:'0.4rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <span style={{fontSize:'0.75rem',color:'var(--text-2)'}}>t = </span>
          <div style={{flex:1,height:6,background:'var(--bg-2)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border)'}}>
            <div style={{height:'100%',width:`${Math.min(100,(tVal/2)*100)}%`,
              background:`linear-gradient(to right, var(--emerald), var(--amber), var(--rose))`,
              borderRadius:3,transition:'width 0.2s'}}/>
          </div>
          <span style={{fontSize:'0.75rem',fontFamily:'monospace',color:tVal>1?'var(--rose)':tVal>0.2?'var(--amber)':'var(--emerald)',minWidth:45}}>{tVal.toFixed(3)}</span>
        </div>
        <div className="m4-btn-row" style={{marginTop:'0.5rem'}}>
          <button className="m4-btn m4-btn-p" onClick={()=>setRunning(r=>!r)}>
            {running?'⏸ Pause':'▶ Run SA'}
          </button>
          <button className="m4-btn m4-btn-g" onClick={resetSA}>Reset</button>
        </div>
        <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.78rem'}}>
          Watch the walker <strong>escape local optima early</strong> (high t, accepts worse) then <strong>settle</strong> as it cools. The <span style={{color:'var(--rose)'}}>red dot</span> shows current S; the trail shows recent history.
        </div>
      </div>
    </div>
  );
}

// ── Intelligence Tab ──────────────────────────────────────────────────────────
function IntelligenceTab() {
  const [sel, setSel] = useState(null);
  const [hov, setHov] = useState(null);

  const quadrants = [
    { id:'TH', label:'Think Humanly', gx:1, gy:1, color:'var(--cyan)',
      quote:'"[The automation of] activities associated with human thinking: decision-making, problem-solving, learning…"', author:'Bellman, 1978',
      desc:'Focuses on machines that replicate human cognitive processes. Cognitive science approaches, computational models of mind.' },
    { id:'TR', label:'Think Rationally', gx:2, gy:1, color:'var(--violet)',
      quote:'"The study of mental faculties through the use of computational models"', author:'Charniak & McDermott, 1985',
      desc:'Uses logic and formal reasoning. The "laws of thought" approach — if-then rules, Prolog, expert systems, knowledge bases.' },
    { id:'AH', label:'Act Humanly', gx:1, gy:2, color:'var(--amber)',
      quote:'"The study of how to make computers do things at which, at the moment, people are better"', author:'Rich & Knight, 1991',
      desc:'Intelligence measured by passing for human. The Turing Test paradigm — if a machine fools you, it passes.' },
    { id:'AR', label:'Act Rationally', gx:2, gy:2, color:'var(--emerald)',
      quote:'"AI is concerned with intelligent behaviour in artifacts"', author:'Nilsson, 1998',
      desc:'Rational agents act to achieve best outcomes. Dominant modern approach — RL, decision theory, utility maximisation.' },
  ];

  const active = quadrants.find(q=>q.id===(sel||hov));

  return (
    <div>
      <div className="m4-quadrant-wrap">
        <div className="m4-quadrant-title">Four Quadrants of AI &nbsp;<span style={{fontSize:'0.72rem',color:'var(--text-2)',fontWeight:400}}>Russell &amp; Norvig, AIMA</span></div>
        <div className="m4-quadrant-grid">
          <div className="m4-ax m4-ax-top">Thinking ↑</div>
          <div className="m4-ax m4-ax-bottom">↓ Acting</div>
          <div className="m4-ax m4-ax-left">← Humanly</div>
          <div className="m4-ax m4-ax-right">Rationally →</div>
          {quadrants.map(q=>(
            <div key={q.id}
              className={`m4-quadrant ${sel===q.id?'m4-q--sel':''}`}
              style={{gridColumn:q.gx,gridRow:q.gy,'--qc':q.color}}
              onClick={()=>setSel(sel===q.id?null:q.id)}
              onMouseEnter={()=>setHov(q.id)} onMouseLeave={()=>setHov(null)}>
              <div className="m4-q-label">{q.label}</div>
              <div className="m4-q-auth">{q.author}</div>
            </div>
          ))}
        </div>
        {active&&(
          <div className="m4-q-detail" style={{'--qc':active.color}}>
            <div className="m4-q-dlabel">{active.label}</div>
            <blockquote className="m4-q-quote">"{active.quote}" <em>— {active.author}</em></blockquote>
            <p className="m4-q-ddesc">{active.desc}</p>
          </div>
        )}
      </div>

      <div className="m4-two-col" style={{marginTop:'2rem'}}>
        <div className="m4-card">
          <div className="m4-card-h">The Turing Test & Intelligence Tests</div>
          <div className="m4-infobox">Alan Turing (1950): If a machine can engage in conversation indistinguishable from a human, it is intelligent. The ultimate <em>performative</em> test.</div>
          <ul className="m4-bullets">
            <li>Modern LLMs arguably pass conversational Turing tests</li>
            <li>CNNs are named for "convolution" but actually use <strong>cross-correlation</strong> — the kernel is not flipped. An example of inconsistent AI terminology.</li>
            <li>MoCA cognitive tests applied to LLMs: GPT-4 scored ~26 (MCI threshold). Are LLMs "intelligent"?</li>
            <li>McCarthy: "Intelligence relates to the ability to do certain things, independently of whether the doer is human, Martian, or mechanism."</li>
          </ul>
          <div className="m4-hr"/>
          <div className="m4-flabel">Convolution vs Cross-Correlation</div>
          <Tex src="(f * g)[n] = \sum_k f[k]\,g[n-k] \quad\text{(convolution — flips g)}" block />
          <Tex src="(f \star g)[n] = \sum_k f[k]\,g[n+k] \quad\text{(cross-correlation — no flip)}" block />
          <div className="m4-warnbox">
            <strong>Think:</strong> Is "internal consistency" a valid test for intelligence? Google's Mayer: "brute force computation + data = <em>appear</em> intelligent" — note the word <em>appear</em>.
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">AGI Levels & A Short History</div>
          <div style={{overflowX:'auto',marginBottom:'0.75rem'}}>
            <table className="m4-rule-tbl">
              <thead><tr><th>Level</th><th>Narrow</th><th>General (AGI)</th></tr></thead>
              <tbody>
                {[
                  ['0 — No AI','Calculator, compiler','Amazon Mechanical Turk'],
                  ['1 — Emerging','GOFAI, SHRDLU','ChatGPT, Claude, Gemini'],
                  ['2 — Competent','Siri, Watson, PaLI','Not yet achieved'],
                  ['3 — Expert','Grammarly, DALL-E 2','Not yet achieved'],
                  ['4 — Virtuoso','Deep Blue, AlphaGo','Not yet achieved'],
                  ['5 — Superhuman','AlphaFold, AlphaZero','ASI — not yet'],
                ].map(([lvl,n,g])=>(
                  <tr key={lvl}><td style={{fontSize:'0.72rem',color:'var(--text-2)'}}>{lvl}</td><td style={{fontSize:'0.72rem',color:'var(--text-2)'}}>{n}</td><td style={{fontSize:'0.72rem',color:'var(--cyan)'}}>{g}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            {yr:'1950', c:'var(--cyan)', ev:'Turing proposes the Imitation Game.'},
            {yr:'1956', c:'var(--violet)', ev:'Dartmouth Workshop — birth of "AI". Symbolic AI & logic begin.'},
            {yr:'1980s', c:'var(--amber)', ev:'Expert Systems. "Purportedly saved millions." Sound familiar?'},
            {yr:'1990s', c:'var(--emerald)', ev:'AI Winter. Probabilistic & statistical methods emerge.'},
            {yr:'2012+', c:'var(--rose)', ev:'Deep Learning (ImageNet). Brute force + data = apparent intelligence.'},
            {yr:'2022+', c:'var(--cyan)', ev:'LLMs, GenAI. GPT-4, Claude, Gemini — "Emerging AGI" level.'},
          ].map(({yr,c,ev})=>(
            <div key={yr} style={{display:'flex',gap:'0.7rem',marginBottom:'0.5rem'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:c,fontWeight:700,minWidth:'55px',paddingTop:2}}>{yr}</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-2)',borderLeft:`2px solid ${c}`,paddingLeft:'0.7rem'}}>{ev}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Adaptation Tab ────────────────────────────────────────────────────────────
function AdaptationTab() {
  return (
    <div>
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Why "Adaptive Systems"?</div>
          <div className="m4-infobox">Traditional ("crisp") AI works great in well-defined artificial worlds — chess, logic puzzles, deterministic search. The real world is <em>messy</em>.</div>
          <div className="m4-strat" style={{'--sc':'var(--rose)'}}>
            <div className="m4-strat-h">Traditional AI requires:</div>
            <div className="m4-strat-d">Well-described states · well-defined actions · goal state · utility function · deterministic search</div>
          </div>
          <div className="m4-strat" style={{'--sc':'var(--emerald)','marginTop':'0.5rem'}}>
            <div className="m4-strat-h">The real world has:</div>
            <div className="m4-strat-d">Uncertainty · ambiguity · unknowns · changing environment · approximation · need for resilience · graceful degradation</div>
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">The Key Claim</div>
          <Tex src="\textbf{AI} = \textbf{optimisation}" block />
          <p style={{fontSize:'0.82rem',color:'var(--text-2)'}}>Optimisation is the <em>engine</em> — "what makes it tick". Searching for the optimal hypothesis within a hypothesis space, evaluated by a metric.</p>
          <div className="m4-hr"/>
          <div className="m4-flabel">Computational Intelligence taxonomy</div>
          {[
            ['Neural Networks','Inspired by brain — weights, connections, backprop'],
            ['Evolutionary Computing','Inspired by Darwinian evolution — selection, crossover, mutation'],
            ['Swarm Intelligence','Inspired by collective behaviour — ants, bees, PSO'],
            ['Fuzzy Logic','Inspired by vague human reasoning — degrees of truth'],
          ].map(([t,d])=>(
            <div key={t} style={{display:'flex',gap:'0.6rem',marginBottom:'0.4rem'}}>
              <span style={{color:'var(--violet)',fontFamily:'var(--font-mono)',fontSize:'0.7rem',fontWeight:700,minWidth:8}}>▸</span>
              <div><strong style={{fontSize:'0.8rem',color:'var(--text-1)'}}>{t}:</strong><span style={{fontSize:'0.78rem',color:'var(--text-2)'}}> {d}</span></div>
            </div>
          ))}
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Inspiration from Nature</div>
          <div className="m4-infobox">Nature handles uncertainty, ambiguity, change, and approximation. Key trait: ability to <strong>adapt</strong> to a changing environment.</div>
          <div className="m4-hr"/>
          {[
            { title:'Short-term (individual lifespan)', color:'var(--cyan)',
              items:['Learning — knowledge acquisition within a lifetime','Physical adaptation — body responds to diet, training, environment','Humans extend learning across lifespans via language & writing'] },
            { title:'Long-term (population/species)', color:'var(--violet)',
              items:['Evolution — genetic variation + natural selection over millennia','Gradual adaptation across populations, not just individuals'] },
            { title:'Short & long-term (collective)', color:'var(--emerald)',
              items:['Emergent behaviour — division of labour, formation flying','Social behaviour that outlives individuals — culture, institutions'] },
          ].map(({title,color,items})=>(
            <div key={title} style={{marginBottom:'1rem'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color,fontWeight:700,letterSpacing:'0.08em',marginBottom:'0.35rem'}}>{title}</div>
              <ul className="m4-bullets">{items.map(i=><li key={i}>{i}</li>)}</ul>
            </div>
          ))}
          <div className="m4-hr"/>
          <div className="m4-flabel">Nature's Adaptation Examples</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.4rem'}}>
            {[
              ['Antarctic fish','Antifreeze proteins in blood — genetic evolution'],
              ['Cuttlefish','Real-time camouflage — neural adaptation'],
              ['Kangaroo rats','Never drink water — metabolic adaptation'],
              ['Wood frogs','Freeze their bodies in winter — physiological'],
            ].map(([a,b])=>(
              <div key={a} style={{background:'var(--bg-2)',borderRadius:6,padding:'0.5rem 0.7rem',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'0.75rem',color:'var(--text-1)',fontWeight:700}}>{a}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginTop:2}}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Optimisation Tab ──────────────────────────────────────────────────────────
function OptimisationTab() {
  return (
    <div>
      <div className="m4-ingred-grid">
        {[
          { num:'1', name:'Language', sub:'Representation', color:'var(--cyan)',
            desc:'Defines the hypothesis space — what solutions look like. If you can\'t describe it, you can\'t model it! Mathematical equations, grammars, Gantt charts, programs, neural networks…' },
          { num:'2', name:'Model', sub:'Instantiation / Candidate Solution', color:'var(--violet)',
            desc:'One specific instance expressible in the chosen language. An hypothesis that attempts to describe how the real world works (or could work). May be executable or parameterised.' },
          { num:'3', name:'Metric', sub:'Evaluation', color:'var(--emerald)',
            desc:'A function f : H → ℝ measuring how "good" a hypothesis is. Aka cost function, fitness function, objective function, error function, loss function.' },
        ].map(i=>(
          <div key={i.num} className="m4-ingred" style={{'--ic':i.color}}>
            <div className="m4-ingred-num">INGREDIENT {i.num}</div>
            <div className="m4-ingred-name">{i.name}</div>
            <div className="m4-ingred-sub">{i.sub}</div>
            <div className="m4-ingred-desc">{i.desc}</div>
          </div>
        ))}
      </div>

      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Hypothesis Space & Metric</div>
          <div className="m4-infobox">The hypothesis space H is the set of all models expressible in the chosen language. Changing the language changes H — more expressive languages give larger spaces.</div>
          <div className="m4-flabel">Expressiveness</div>
          <Tex src="A \supset B \Rightarrow \text{Language A is more expressive than B}" block />
          <table className="m4-rule-tbl" style={{marginTop:'0.5rem'}}>
            <thead><tr><th>More expressive</th><th>Less expressive</th></tr></thead>
            <tbody>
              <tr><td>Polynomial functions</td><td>Linear functions</td></tr>
              <tr><td>Context-free grammars</td><td>Regular grammars</td></tr>
              <tr><td>First-order logic</td><td>Propositional logic</td></tr>
            </tbody>
          </table>
          <div className="m4-hr"/>
          <div className="m4-flabel">Mean Squared Error (MSE)</div>
          <Tex src="\text{MSE} = \frac{1}{N}\sum_{i=1}^{N}(f(x_i) - y_i)^2" block />
          <VarTable vars={[
            ['N', 'Total number of data samples (training examples)'],
            ['x_i', 'The i-th input (feature vector or scalar)'],
            ['f(x_i)', "The model's predicted output for input x_i"],
            ['y_i', 'The actual (target) output for input x_i'],
            ['(f(x_i)-y_i)^2', 'Squared error for sample i — squaring makes all errors positive and penalises large errors more'],
          ]} />
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            MSE is a "bowl" function — the friendliest hypothesis space. Gradient methods are guaranteed to converge to the global minimum!
          </div>
        </div>

        <div className="m4-card">
          <div className="m4-card-h">Optimisation — Formal Definitions</div>
          <div className="m4-flabel">Ideal Definition</div>
          <Tex src="\hat{h} = \underset{h \in H}{\arg\min}\;f(h)" block />
          <VarTable vars={[
            ['\\hat{h}', 'The best hypothesis found — the one that minimises the metric f'],
            ['h', 'A candidate hypothesis (one specific model / candidate solution)'],
            ['H', 'The hypothesis space — all possible models expressible in the chosen language'],
            ['f(h)', 'The metric evaluated on h — measures how far h is from the target (lower = better)'],
            ['\\arg\\min', 'Argument of the minimum — returns the h that makes f(h) smallest, not the value of f itself'],
          ]} />
          <div style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.75rem'}}>Find a model within the hypothesis space that is <em>closest</em> (minimal error) to the target.</div>
          <div className="m4-flabel">Practical Definition (compute-bounded)</div>
          <Tex src="\hat{h} = \underset{h \in H}{\arg\min}\;f(h) \quad \text{s.t. compute} \leq C_{\max}" block />
          <VarTable vars={[
            ['C_{\\max}', 'Maximum allowed compute budget (time, memory, or number of evaluations)'],
            ['\\text{s.t.}', '"Subject to" — an additional constraint that limits the search to what is computationally feasible'],
          ]} />
          <div style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.75rem'}}>Find a model that is <em>as close as possible</em> within a specified amount of compute.</div>
          <div className="m4-hr"/>
          <div className="m4-flabel">Chomsky Hierarchy (language expressiveness)</div>
          <Tex src="\text{Regular} \subset \text{Context-Free} \subset \text{Context-Sensitive} \subset \text{Recursively Enumerable}" block />
          <div className="m4-hr"/>
          <div className="m4-flabel">Online vs Offline</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
            <div className="m4-strat" style={{'--sc':'var(--cyan)'}}>
              <div className="m4-strat-h">Online</div>
              <div className="m4-strat-d">Decisions made in real time as items arrive. Cannot look ahead. E.g. First Fit on conveyor belt.</div>
            </div>
            <div className="m4-strat" style={{'--sc':'var(--violet)'}}>
              <div className="m4-strat-h">Offline</div>
              <div className="m4-strat-d">All data known upfront. Better result justifies time cost. E.g. FFD pre-sorts all items.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vector Add/Sub Visualizer ─────────────────────────────────────────────────
function VectorAddSubViz() {
  const [ax, setAx] = useState(3);
  const [ay, setAy] = useState(1);
  const [bx, setBx] = useState(1);
  const [by, setBy] = useState(2);
  const [mode, setMode] = useState('add');
  const canRef = useRef(null);

  useEffect(() => {
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 480;
    const H = canvas.height = 260;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const RANGE = 6;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / (RANGE * 2 + 2);
    const toX = x => cx + x * scale;
    const toY = y => cy - y * scale;

    ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
    for (let i = -RANGE; i <= RANGE; i++) {
      ctx.beginPath(); ctx.moveTo(toX(i), toY(-RANGE)); ctx.lineTo(toX(i), toY(RANGE)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(-RANGE), toY(i)); ctx.lineTo(toX(RANGE), toY(i)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.22)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toX(-RANGE), toY(0)); ctx.lineTo(toX(RANGE), toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), toY(-RANGE)); ctx.lineTo(toX(0), toY(RANGE)); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let i = -RANGE; i <= RANGE; i += 2) {
      if (i !== 0) {
        ctx.fillText(i, toX(i), toY(0) + 12);
        ctx.textAlign = 'right'; ctx.fillText(i, toX(0) - 4, toY(i) + 3); ctx.textAlign = 'center';
      }
    }

    const drawArrow = (ox, oy, ex, ey, color, width, label) => {
      const px = toX(ox), py = toY(oy), qx = toX(ex), qy = toY(ey);
      const angle = Math.atan2(qy - py, qx - px);
      if (Math.hypot(qx - px, qy - py) < 2) return;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
      const hLen = 10, hAng = 0.42;
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.lineTo(qx - hLen * Math.cos(angle - hAng), qy - hLen * Math.sin(angle - hAng));
      ctx.lineTo(qx - hLen * Math.cos(angle + hAng), qy - hLen * Math.sin(angle + hAng));
      ctx.closePath(); ctx.fill();
      if (label) {
        const perp = angle + Math.PI / 2;
        ctx.fillStyle = color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText(label, (px + qx) / 2 + 14 * Math.cos(perp), (py + qy) / 2 + 14 * Math.sin(perp));
      }
    };

    const rx = mode === 'add' ? ax + bx : ax - bx;
    const ry = mode === 'add' ? ay + by : ay - by;
    const bEffX = mode === 'add' ? bx : -bx;
    const bEffY = mode === 'add' ? by : -by;

    if (mode === 'add') {
      ctx.strokeStyle = 'rgba(148,163,184,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(toX(ax), toY(ay)); ctx.lineTo(toX(rx), toY(ry)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(bx), toY(by)); ctx.lineTo(toX(rx), toY(ry)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.3;
      drawArrow(0, 0, bx, by, '#22d3ee', 1.5, null);
      ctx.globalAlpha = 1;
    }
    drawArrow(0, 0, ax, ay, '#a78bfa', 2.5, 'a');
    drawArrow(ax, ay, ax + bEffX, ay + bEffY, '#22d3ee', 2, mode === 'add' ? 'b' : '−b');
    drawArrow(0, 0, rx, ry, '#34d399', 2.5, mode === 'add' ? 'a+b' : 'a−b');
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.beginPath(); ctx.arc(toX(0), toY(0), 3, 0, Math.PI * 2); ctx.fill();
  }, [ax, ay, bx, by, mode]);

  const rx = mode === 'add' ? ax + bx : ax - bx;
  const ry = mode === 'add' ? ay + by : ay - by;

  return (
    <div className="m4-card">
      <div className="m4-card-h">Vector Addition &amp; Subtraction</div>
      <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
        Vectors combine <strong>component-wise</strong>. Geometrically: place b's tail at a's tip — the result spans from the origin to b's new tip (<em>head-to-tail</em> method).
      </div>
      <Tex src="\vec{a} \pm \vec{b} = \begin{bmatrix}a_1 \pm b_1 \\ a_2 \pm b_2 \\ \vdots \\ a_n \pm b_n\end{bmatrix}" block />
      <div className="m4-radio-row" style={{marginTop:'0.5rem'}}>
        {[['add','a + b'],['sub','a − b']].map(([m, lbl]) => (
          <label key={m} className={`m4-rpill ${mode === m ? 'm4-rpill--on' : ''}`}>
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} style={{display:'none'}}/>
            {lbl}
          </label>
        ))}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem 1rem', margin:'0.5rem 0'}}>
        {[['a.x', ax, setAx, '#a78bfa'],['a.y', ay, setAy, '#a78bfa'],
          ['b.x', bx, setBx, '#22d3ee'],['b.y', by, setBy, '#22d3ee']].map(([lbl, val, setter, col]) => (
          <div key={lbl} className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span style={{color:col}}>{lbl}</span><span className="m4-ctrl-val">{val}</span></div>
            <input type="range" min={-5} max={5} step={1} value={val} onChange={e => setter(+e.target.value)}/>
          </div>
        ))}
      </div>
      <canvas ref={canRef} className="m4-canvas" height="260"/>
      <div className="m4-stats-row" style={{marginTop:'0.5rem'}}>
        <div className="m4-stat"><span className="m4-stat-l" style={{color:'#a78bfa'}}>a</span><span className="m4-stat-v">({ax}, {ay})</span></div>
        <div className="m4-stat"><span className="m4-stat-l" style={{color:'#22d3ee'}}>b</span><span className="m4-stat-v">({bx}, {by})</span></div>
        <div className="m4-stat"><span className="m4-stat-l" style={{color:'#34d399'}}>{mode === 'add' ? 'a+b' : 'a−b'}</span><span className="m4-stat-v">({rx}, {ry})</span></div>
      </div>
      <div className="m4-infobox" style={{fontSize:'0.78rem', marginTop:'0.5rem'}}>
        <strong>Subtraction</strong> a − b = a + (−b): flip b's direction, then add. The dashed parallelogram lines show both vectors from the origin completing to the result.
      </div>
    </div>
  );
}

// ── Vector Products Visualizer ─────────────────────────────────────────────────
function VectorProductViz() {
  const [vx, setVx] = useState(3);
  const [vy, setVy] = useState(1);
  const [wx, setWx] = useState(1);
  const [wy, setWy] = useState(3);
  const [tab, setTab] = useState('dot');
  const canRef = useRef(null);

  const dot = vx * wx + vy * wy;
  const vNorm = Math.hypot(vx, vy);
  const wNorm = Math.hypot(wx, wy);
  const cosTheta = vNorm > 0 && wNorm > 0 ? dot / (vNorm * wNorm) : 0;
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  const outer = [[vx * wx, vx * wy], [vy * wx, vy * wy]];
  const had = [vx * wx, vy * wy];

  const cellBg = (val, sc = 16) => {
    const t = Math.max(-1, Math.min(1, val / sc));
    if (t > 0) return `rgba(52,211,153,${(t * 0.75 + 0.1).toFixed(2)})`;
    if (t < 0) return `rgba(251,113,133,${(Math.abs(t) * 0.75 + 0.1).toFixed(2)})`;
    return 'rgba(100,116,139,0.15)';
  };

  useEffect(() => {
    if (tab !== 'dot') return;
    const canvas = canRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth || 420;
    const H = canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const RANGE = 5;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / (RANGE * 2 + 2);
    const toX = x => cx + x * scale;
    const toY = y => cy - y * scale;

    ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
    for (let i = -RANGE; i <= RANGE; i++) {
      ctx.beginPath(); ctx.moveTo(toX(i), toY(-RANGE)); ctx.lineTo(toX(i), toY(RANGE)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(-RANGE), toY(i)); ctx.lineTo(toX(RANGE), toY(i)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.22)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toX(-RANGE), toY(0)); ctx.lineTo(toX(RANGE), toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), toY(-RANGE)); ctx.lineTo(toX(0), toY(RANGE)); ctx.stroke();

    const drawArrow = (ox, oy, ex, ey, color, width, label) => {
      const px = toX(ox), py = toY(oy), qx = toX(ex), qy = toY(ey);
      const angle = Math.atan2(qy - py, qx - px);
      if (Math.hypot(qx - px, qy - py) < 2) return;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
      const hLen = 10, hAng = 0.42;
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.lineTo(qx - hLen * Math.cos(angle - hAng), qy - hLen * Math.sin(angle - hAng));
      ctx.lineTo(qx - hLen * Math.cos(angle + hAng), qy - hLen * Math.sin(angle + hAng));
      ctx.closePath(); ctx.fill();
      if (label) {
        const perp = angle + Math.PI / 2;
        ctx.fillStyle = color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText(label, (px + qx) / 2 + 14 * Math.cos(perp), (py + qy) / 2 + 14 * Math.sin(perp));
      }
    };

    // Projection of w onto v
    const vLen2 = vx * vx + vy * vy;
    const projS = vLen2 > 0 ? dot / vLen2 : 0;
    const projX = projS * vx, projY = projS * vy;
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(toX(projX), toY(projY)); ctx.lineTo(toX(wx), toY(wy)); ctx.stroke();
    ctx.setLineDash([]);

    // Angle arc
    const vA = Math.atan2(-vy, vx);
    const wA = Math.atan2(-wy, wx);
    let sweep = wA - vA;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(toX(0), toY(0), 28, vA, vA + sweep, sweep < 0); ctx.stroke();
    const midA = vA + sweep / 2;
    ctx.fillStyle = '#fbbf24'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('θ', toX(0) + 40 * Math.cos(midA), toY(0) + 40 * Math.sin(midA));

    if (Math.abs(projS) > 0.05) drawArrow(0, 0, projX, projY, '#fb7185', 2, 'proj');
    drawArrow(0, 0, vx, vy, '#a78bfa', 2.5, 'v');
    drawArrow(0, 0, wx, wy, '#22d3ee', 2.5, 'w');
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.beginPath(); ctx.arc(toX(0), toY(0), 3, 0, Math.PI * 2); ctx.fill();
  }, [tab, vx, vy, wx, wy, dot]);

  const cStyle = val => ({
    padding:'8px 14px', textAlign:'center', background:cellBg(val),
    borderRadius:4, color:'var(--text-1)', fontWeight:600,
    border:'1px solid rgba(148,163,184,0.1)', fontFamily:'var(--font-mono)', fontSize:'0.85rem',
  });

  return (
    <div className="m4-card">
      <div className="m4-card-h">Vector Products — Visual</div>
      <div className="m4-radio-row">
        {[['dot','Dot Product (·)'],['outer','Tensor Product (⊗)'],['had','Hadamard (⊙)']].map(([k, lbl]) => (
          <label key={k} className={`m4-rpill ${tab === k ? 'm4-rpill--on' : ''}`}>
            <input type="radio" checked={tab === k} onChange={() => setTab(k)} style={{display:'none'}}/>
            {lbl}
          </label>
        ))}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem 1rem', margin:'0.5rem 0'}}>
        {[['v.x', vx, setVx, '#a78bfa'],['v.y', vy, setVy, '#a78bfa'],
          ['w.x', wx, setWx, '#22d3ee'],['w.y', wy, setWy, '#22d3ee']].map(([lbl, val, setter, col]) => (
          <div key={lbl} className="m4-ctrl">
            <div className="m4-ctrl-lbl"><span style={{color:col}}>{lbl}</span><span className="m4-ctrl-val">{val}</span></div>
            <input type="range" min={-4} max={4} step={1} value={val} onChange={e => setter(+e.target.value)}/>
          </div>
        ))}
      </div>

      {tab === 'dot' && (
        <>
          <canvas ref={canRef} className="m4-canvas" height="220"/>
          <div className="m4-stats-row" style={{marginTop:'0.5rem'}}>
            <div className="m4-stat"><span className="m4-stat-l">v · w</span><span className="m4-stat-v" style={{color:'#34d399'}}>{dot.toFixed(2)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">|v|</span><span className="m4-stat-v" style={{color:'#a78bfa'}}>{vNorm.toFixed(2)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">|w|</span><span className="m4-stat-v" style={{color:'#22d3ee'}}>{wNorm.toFixed(2)}</span></div>
            <div className="m4-stat"><span className="m4-stat-l">θ</span><span className="m4-stat-v" style={{color:'#fbbf24'}}>{(theta * 180 / Math.PI).toFixed(1)}°</span></div>
          </div>
          <div className="m4-infobox" style={{fontSize:'0.78rem', marginTop:'0.5rem'}}>
            <strong>v·w = |v||w|cos(θ).</strong> Zero when perpendicular (θ=90°). The <span style={{color:'#fb7185'}}>pink arrow</span> is the projection of <strong>w</strong> onto <strong>v</strong> — how much of w "points along" v. Used in similarity, loss functions, and gradient convergence checks.
          </div>
        </>
      )}

      {tab === 'outer' && (
        <>
          <div style={{fontSize:'0.79rem', color:'var(--text-2)', margin:'0.5rem 0'}}>
            <strong>v ⊗ w = v wᵀ</strong> — each cell (i,j) = vᵢ × wⱼ. Produces a <em>matrix</em> (rank-1 tensor). <span style={{color:'#34d399'}}>Green</span> = positive, <span style={{color:'#fb7185'}}>red</span> = negative.
          </div>
          <div style={{overflowX:'auto', display:'flex', justifyContent:'center'}}>
            <table style={{borderCollapse:'separate', borderSpacing:4, fontFamily:'var(--font-mono)'}}>
              <thead>
                <tr>
                  <th style={{padding:'4px 8px', color:'rgba(148,163,184,0.4)', fontSize:'0.7rem'}}></th>
                  <th style={{padding:'4px 14px', color:'#22d3ee', fontWeight:700}}>w₁={wx}</th>
                  <th style={{padding:'4px 14px', color:'#22d3ee', fontWeight:700}}>w₂={wy}</th>
                </tr>
              </thead>
              <tbody>
                {outer.map((row, i) => (
                  <tr key={i}>
                    <td style={{padding:'4px 8px', color:'#a78bfa', fontWeight:700}}>v{i+1}={[vx,vy][i]}</td>
                    {row.map((val, j) => <td key={j} style={cStyle(val)}>{val}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="m4-infobox" style={{fontSize:'0.78rem', marginTop:'0.75rem'}}>
            <strong>Tensor product:</strong> Dot product compresses two vectors into 1 scalar (loses structure). Outer product <em>expands</em> them into a matrix, preserving all pairwise interactions. Shape: (n,) ⊗ (m,) → (n×m). Used in: neural network weight updates (δW = activationᵀ × gradient), covariance matrices, and attention score computation.
          </div>
          <div style={{fontSize:'0.79rem', color:'var(--text-2)', marginTop:'0.25rem'}}>
            <strong>Rank-1 note:</strong> Every row is a scalar multiple of w — this matrix always has rank 1. Full-rank matrices are sums of many such outer products.
          </div>
        </>
      )}

      {tab === 'had' && (
        <>
          <div style={{fontSize:'0.79rem', color:'var(--text-2)', margin:'0.5rem 0'}}>
            <strong>v ⊙ w</strong> — element-wise product. Same shape as inputs. No summation — contrast with dot product.
          </div>
          <div style={{display:'flex', gap:'0.75rem', alignItems:'center', justifyContent:'center', padding:'0.5rem 0', fontFamily:'var(--font-mono)'}}>
            <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'center'}}>
              <div style={{fontSize:'0.7rem', color:'rgba(148,163,184,0.5)'}}>v</div>
              {[vx, vy].map((val, i) => (
                <div key={i} style={{width:52, height:36, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(167,139,250,0.15)', borderRadius:4, border:'1px solid rgba(167,139,250,0.35)', color:'#a78bfa', fontWeight:700}}>{val}</div>
              ))}
            </div>
            <div style={{fontSize:'1.5rem', color:'var(--text-2)', paddingTop:'1.4rem'}}>⊙</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'center'}}>
              <div style={{fontSize:'0.7rem', color:'rgba(148,163,184,0.5)'}}>w</div>
              {[wx, wy].map((val, i) => (
                <div key={i} style={{width:52, height:36, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,211,238,0.15)', borderRadius:4, border:'1px solid rgba(34,211,238,0.35)', color:'#22d3ee', fontWeight:700}}>{val}</div>
              ))}
            </div>
            <div style={{fontSize:'1.5rem', color:'var(--text-2)', paddingTop:'1.4rem'}}>=</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'center'}}>
              <div style={{fontSize:'0.7rem', color:'rgba(148,163,184,0.5)'}}>v ⊙ w</div>
              {had.map((val, i) => (
                <div key={i} style={{width:52, height:36, display:'flex', alignItems:'center', justifyContent:'center', background:cellBg(val), borderRadius:4, border:'1px solid rgba(148,163,184,0.2)', color:'var(--text-1)', fontWeight:700}}>{val}</div>
              ))}
            </div>
          </div>
          <div style={{fontSize:'0.75rem', color:'rgba(148,163,184,0.55)', textAlign:'center', marginTop:'0.2rem'}}>
            ({vx}×{wx} = {had[0]},&nbsp;&nbsp;{vy}×{wy} = {had[1]})
          </div>
          <div className="m4-infobox" style={{fontSize:'0.78rem', marginTop:'0.75rem'}}>
            <strong>Not a dot product</strong> — no summation, result is still a vector. Used in: LSTM/GRU gates (mask which memory to keep), attention masking, element-wise feature scaling, and dropout (multiply activations by a 0/1 mask vector).
          </div>
        </>
      )}
    </div>
  );
}

// ── Calculus Tab ──────────────────────────────────────────────────────────────
function CalculusTab() {
  return (
    <div>
      <DerivativeViz />
      <div className="m4-two-col" style={{marginTop:'1.5rem'}}>
        <div className="m4-card">
          <div className="m4-card-h">Partial Derivatives</div>
          <div className="m4-infobox">Derivative with respect to one variable, holding all others fixed.</div>
          <div className="m4-flabel">Example: f(x₁, x₂) = x₁² + x₂²  (the "bowl")</div>
          <Tex src="\frac{\partial}{\partial x_1}(x_1^2 + x_2^2) = 2x_1" block />
          <Tex src="\frac{\partial}{\partial x_2}(x_1^2 + x_2^2) = 2x_2" block />
          <div className="m4-hr"/>
          <div className="m4-flabel">The Gradient Vector</div>
          <Tex src="\nabla f(\vec{x}) = \begin{bmatrix} \dfrac{\partial f}{\partial x_1} \\[8pt] \dfrac{\partial f}{\partial x_2} \\[4pt] \vdots \\[4pt] \dfrac{\partial f}{\partial x_n} \end{bmatrix}" block />
          <VarTable vars={[
            ['\\nabla f', 'Gradient of f (read "del f" or "nabla f") — a vector of all partial derivatives'],
            ['\\vec{x}', 'Input vector (x₁, x₂, …, xₙ) — a point in the n-dimensional search space'],
            ['\\partial f / \\partial x_i', 'Partial derivative of f with respect to xᵢ — rate of change in dimension i, all other variables held fixed'],
            ['n', 'Number of dimensions (number of parameters in the model)'],
          ]} />
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            The gradient is a <strong>vector field</strong> that points in the direction of steepest ascent at every point. Gradient descent moves in the <em>opposite</em> direction (−∇f).
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">Example: Gradient of bowl function</div>
          <Tex src="f(x_1, x_2) = x_1^2 + x_2^2 \;\Rightarrow\; \nabla f = \begin{bmatrix}2x_1 \\ 2x_2\end{bmatrix}" block />
        </div>

        <div className="m4-card">
          <div className="m4-card-h">Vector Products</div>
          <div className="m4-flabel">Euclidean Norm (L² norm)</div>
          <Tex src="\|\vec{v}\| = \sqrt{v_1^2 + v_2^2 + \cdots + v_n^2}" block />
          <VarTable vars={[
            ['\\|\\vec{v}\\|', 'Euclidean norm (length/magnitude) of vector v'],
            ['v_i', 'The i-th component of vector v'],
          ]} />
          <div className="m4-hr"/>
          <div className="m4-flabel">Dot Product (scalar result)</div>
          <Tex src="\vec{v} \cdot \vec{w} = \sum_{i=1}^n v_i w_i = \vec{v}^\top \vec{w}" block />
          <VarTable vars={[
            ['\\vec{v} \\cdot \\vec{w}', 'Dot product — multiplies corresponding elements and sums them, producing a single scalar'],
            ['\\vec{v}^\\top \\vec{w}', 'Matrix notation: v transposed (row vector) times w (column vector) — same result'],
          ]} />
          <div className="m4-hr"/>
          <div className="m4-flabel">Outer Product (tensor product)</div>
          <Tex src="\vec{v} \otimes \vec{w} = \vec{v}\,\vec{w}^\top \quad \text{(gives a matrix)}" block />
          <div className="m4-hr"/>
          <div className="m4-flabel">Hadamard Product (element-wise)</div>
          <Tex src="(\vec{v} \odot \vec{w})_i = v_i w_i" block />
          <div className="m4-hr"/>
          <div className="m4-flabel">Gradient Convergence Check</div>
          <Tex src="\|\nabla f(\vec{x})\| < \epsilon \quad \Rightarrow \quad \text{converged}" block />
          <VarTable vars={[
            ['\\|\\nabla f(\\vec{x})\\|', 'Norm of the gradient — how large (steep) the gradient vector is; near zero means we\'re near a stationary point'],
            ['\\epsilon', 'Epsilon — a small tolerance threshold (e.g., 0.001); once gradient norm drops below this, we declare convergence'],
          ]} />
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            In practice we stop when the gradient norm is small (below tolerance ε), not exactly zero. This handles floating-point and near-flat regions.
          </div>
        </div>
      </div>
      <div className="m4-two-col" style={{marginTop:'1rem'}}>
        <VectorAddSubViz />
        <VectorProductViz />
      </div>
    </div>
  );
}

// ── JSSP Summary Components ──────────────────────────────────────────────────

function SolutionSpaceCalc() {
  const [n, setN] = useState(4);
  const [m, setM] = useState(3);
  const fact = x => { let r=1; for(let i=2;i<=x;i++) r*=i; return r; };
  const size = Math.pow(fact(n), m);
  const log10 = size > 0 ? Math.log10(size) : 0;
  const getScale = () => {
    if(log10 < 5) return {label:'Feasible ✓',col:'#34d399'};
    if(log10 < 15) return {label:'Hard',col:'#fbbf24'};
    if(log10 < 40) return {label:'Intractable ✗',col:'#fb7185'};
    return {label:'Astronomical',col:'#fb7185'};
  };
  const sc = getScale();
  const fmt = s => {
    if(s < 1e6) return s.toLocaleString();
    const exp = Math.floor(Math.log10(s));
    return `${(s/Math.pow(10,exp)).toFixed(2)} × 10^${exp}`;
  };
  const comps = [
    {label:'Grains of sand on Earth', clog: Math.log10(7.5e18)},
    {label:'Seconds since Big Bang',  clog: Math.log10(4.3e17)},
    {label:'Atoms in universe',       clog: 80},
  ];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Solution Space Explosion <span className="m4-algo-card-badge">interactive</span></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
        <div>
          {[{key:'n',label:'Jobs (n)',min:2,max:9,val:n,set:setN},{key:'m',label:'Machines (m)',min:2,max:7,val:m,set:setM}].map(({key,label,min,max,val,set})=>(
            <div className="m4-ctrl" key={key}>
              <div className="m4-ctrl-lbl"><span>{label}</span><span className="m4-ctrl-val">{val}</span></div>
              <input type="range" min={min} max={max} value={val} onChange={e=>set(+e.target.value)}/>
            </div>
          ))}
          <div style={{marginTop:'0.7rem',padding:'0.7rem',background:'var(--bg-2)',borderRadius:8,border:`1px solid ${sc.col}44`}}>
            <div style={{fontSize:'0.66rem',color:'var(--text-2)',fontFamily:'monospace',marginBottom:'0.25rem'}}>|H| ≤ ({n}!)^{m} = {fact(n)}^{m}</div>
            <div style={{fontSize:'1.25rem',fontWeight:800,color:sc.col,fontFamily:'monospace',wordBreak:'break-all',lineHeight:1.2}}>{fmt(size)}</div>
            <div style={{marginTop:'0.4rem',display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <span style={{fontSize:'0.68rem',fontWeight:700,color:sc.col,background:`${sc.col}22`,padding:'2px 8px',borderRadius:4}}>{sc.label}</span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>log₁₀ ≈ {log10.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div>
          <div style={{fontSize:'0.7rem',color:'var(--text-2)',marginBottom:'0.5rem'}}>Scale vs known quantities</div>
          {comps.map(({label,clog})=>{
            const bigger = log10 > clog;
            const pct = Math.min(100,(Math.min(log10,clog)/Math.max(log10,clog,1))*100);
            return (
              <div key={label} style={{marginBottom:'0.4rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.67rem',marginBottom:2}}>
                  <span style={{color:'var(--text-2)'}}>{label}</span>
                  <span style={{color:bigger?'#fb7185':'#34d399',fontFamily:'monospace',fontWeight:700,fontSize:'0.65rem'}}>{bigger?'EXCEEDS ▲':'Below ▼'}</span>
                </div>
                <div style={{height:6,background:'var(--bg-3)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:bigger?'#fb7185':'#34d399',transition:'width 0.3s',borderRadius:3}}/>
                </div>
              </div>
            );
          })}
          <div className="m4-infobox" style={{marginTop:'0.6rem',fontSize:'0.7rem'}}>
            <strong>FT10</strong> (10×10): (10!)^10 ≈ 3.6×10^65. Unsolved 26 years!
          </div>
        </div>
      </div>
    </div>
  );
}

function JSSPFlipCards() {
  const [flipped, setFlipped] = useState({});
  const CARDS = [
    {icon:'📐',front:'JSSP Definition',  fq:'Formal components of the problem?',back:'n jobs × m machines. Each job has m ops in fixed order. Op O(i,j) on machine μ(i,j) for p(i,j) time. No preemption. Minimise makespan C_max.'},
    {icon:'⏱', front:'Makespan C_max',  fq:'How do we measure quality?',        back:'C_max = max_i C_i — when the LAST job finishes. Must satisfy all constraints. This is the single objective to minimise.'},
    {icon:'⛓', front:'Two Constraints', fq:'What constrains a valid schedule?', back:'1. PRECEDENCE: ops within a job run in fixed order.\n2. DISJUNCTIVE: each machine handles ≤ 1 op at a time (no overlap).'},
    {icon:'🔴', front:'Critical Path',   fq:'Why does the critical path matter?',back:'Longest path s→t in disjunctive graph G=(V, C∪D). Its length = C_max. Fixing D arc directions gives a DAG; minimising C_max = shortening this path.'},
    {icon:'🔄', front:'N1 Neighbourhood',fq:'What is an N1 local search move?', back:'Swap 2 ADJACENT ops on the critical path that share the same machine. ONLY these swaps can reduce C_max — all other swaps are wasted compute.'},
    {icon:'📊', front:'RPD Metric',       fq:'How do we compare algorithms?',    back:'RPD = (C_max^obtained − C_max^BKS) / C_max^BKS × 100%.\n0% = matches Best Known Solution.\nLower = better quality algorithm.'},
  ];
  const toggle = i => setFlipped(f=>({...f,[i]:!f[i]}));
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem'}}>
        {CARDS.map((c,i)=>(
          <div key={i} onClick={()=>toggle(i)} style={{cursor:'pointer',perspective:700,height:120}}>
            <div style={{position:'relative',width:'100%',height:'100%',transformStyle:'preserve-3d',transition:'transform 0.42s cubic-bezier(0.4,0,0.2,1)',transform:flipped[i]?'rotateY(180deg)':'rotateY(0deg)'}}>
              <div style={{position:'absolute',inset:0,backfaceVisibility:'hidden',WebkitBackfaceVisibility:'hidden',background:'var(--bg-2)',borderRadius:9,border:'1px solid rgba(167,139,250,0.22)',padding:'0.5rem',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                <div style={{fontSize:'0.61rem',fontWeight:700,color:'var(--violet)',textTransform:'uppercase',letterSpacing:'0.07em'}}>{c.front}</div>
                <div style={{fontSize:'1.35rem',textAlign:'center'}}>{c.icon}</div>
                <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.35}}>{c.fq}</div>
                <div style={{fontSize:'0.56rem',color:'var(--text-3)',textAlign:'right'}}>tap →</div>
              </div>
              <div style={{position:'absolute',inset:0,backfaceVisibility:'hidden',WebkitBackfaceVisibility:'hidden',transform:'rotateY(180deg)',background:'rgba(167,139,250,0.09)',borderRadius:9,border:'1px solid rgba(167,139,250,0.35)',padding:'0.5rem',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{fontSize:'0.67rem',color:'var(--text-1)',lineHeight:1.5,whiteSpace:'pre-line'}}>{c.back}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:'0.62rem',color:'var(--text-3)',textAlign:'center',marginTop:'0.3rem'}}>{Object.values(flipped).filter(Boolean).length}/{CARDS.length} revealed — click any card to flip</div>
    </div>
  );
}

function CriticalPathGantt() {
  const cvRef = useRef(null);
  const [showCrit, setShowCrit] = useState(true);
  // Valid 3×3 schedule: M0 order J0,J1,J2 | M1 order J1,J0,J2 | M2 order J2,J0,J1
  // J0:(M0,3)→(M1,2)→(M2,2) | J1:(M1,4)→(M0,1)→(M2,3) | J2:(M2,2)→(M1,3)→(M0,2)
  const OPS = [
    {job:0,mach:0,s:0,d:3,id:'J0-M0'},{job:0,mach:1,s:4,d:2,id:'J0-M1'},{job:0,mach:2,s:6,d:2,id:'J0-M2'},
    {job:1,mach:1,s:0,d:4,id:'J1-M1'},{job:1,mach:0,s:4,d:1,id:'J1-M0'},{job:1,mach:2,s:8,d:3,id:'J1-M2'},
    {job:2,mach:2,s:0,d:2,id:'J2-M2'},{job:2,mach:1,s:6,d:3,id:'J2-M1'},{job:2,mach:0,s:9,d:2,id:'J2-M0'},
  ];
  // Two parallel critical paths (both length 11):
  //   A: J1-M1→J0-M1→J0-M2→J1-M2   B: J1-M1→J0-M1→J2-M1→J2-M0
  const CRIT = new Set(['J1-M1','J0-M1','J0-M2','J1-M2','J2-M1','J2-M0']);
  const MAKESPAN = 11;
  const CP_COLS = ['#22d3ee','#a78bfa','#34d399'];
  useEffect(()=>{
    const cv = cvRef.current; if(!cv) return;
    const W = cv.width = cv.offsetWidth||480;
    const H = cv.height = 185;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const PL=42,PT=28,RH=40,BH=26;
    const TW = (W-PL-14)/MAKESPAN;
    ['M0','M1','M2'].forEach((lbl,i)=>{
      ctx.fillStyle='rgba(148,163,184,0.65)';ctx.font='11px monospace';ctx.textAlign='right';
      ctx.fillText(lbl,PL-5,PT+i*RH+BH/2+4);
    });
    for(let t=0;t<=MAKESPAN;t++){
      const x=PL+t*TW;
      ctx.fillStyle='rgba(100,116,139,0.15)';ctx.fillRect(x,PT-4,1,3*RH+4);
      if(t%2===0||t===MAKESPAN){
        ctx.fillStyle='rgba(148,163,184,0.5)';ctx.font='8px monospace';ctx.textAlign='center';
        ctx.fillText(t,x,PT+3*RH+13);
      }
    }
    const msX=PL+MAKESPAN*TW;
    ctx.strokeStyle='rgba(251,113,133,0.7)';ctx.setLineDash([3,3]);ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(msX,PT-10);ctx.lineTo(msX,PT+3*RH+5);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(251,113,133,0.9)';ctx.font='bold 9px monospace';ctx.textAlign='center';
    ctx.fillText('C_max='+MAKESPAN,msX,PT-14);
    OPS.forEach(({job,mach,s,d,id})=>{
      const x=PL+s*TW+1,y=PT+mach*RH+(RH-BH)/2,w=d*TW-2;
      const isCrit=showCrit&&CRIT.has(id);
      const col=CP_COLS[job];
      ctx.fillStyle=isCrit?col:col+'55';
      ctx.beginPath();ctx.rect(x,y,w,BH);ctx.fill();
      if(isCrit){ctx.strokeStyle='#fb7185';ctx.lineWidth=2;ctx.beginPath();ctx.rect(x+1,y+1,w-2,BH-2);ctx.stroke();}
      if(w>16){
        ctx.fillStyle=isCrit?'#fff':'rgba(255,255,255,0.65)';
        ctx.font=`${isCrit?'bold ':''}9px monospace`;ctx.textAlign='center';
        ctx.fillText('J'+job,x+w/2,y+BH/2+3);
      }
    });
    if(showCrit){
      ctx.fillStyle='rgba(251,113,133,0.75)';ctx.font='bold 8px monospace';ctx.textAlign='left';
      ctx.fillText('▶ critical path (highlighted)',PL,PT-4);
    }
  },[showCrit]);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Critical Path Gantt Chart</div>
      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.4rem',flexWrap:'wrap'}}>
        <button className="m4-preset-btn"
          style={showCrit?{background:'rgba(251,113,133,0.12)',borderColor:'rgba(251,113,133,0.5)',color:'#fb7185'}:{}}
          onClick={()=>setShowCrit(v=>!v)}>
          {showCrit?'🔴 Critical path ON':'⬜ Show critical path'}
        </button>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {['J0','J1','J2'].map((j,i)=>(
            <div key={j} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.67rem',color:'var(--text-2)'}}>
              <div style={{width:10,height:10,borderRadius:2,background:CP_COLS[i]}}/>
              {j}
            </div>
          ))}
        </div>
      </div>
      <canvas ref={cvRef} className="m4-canvas" height="185" style={{width:'100%'}}/>
      <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.72rem'}}>
        <strong>N1 Rule:</strong> Only swap adjacent ops on the <span style={{color:'#fb7185',fontWeight:700}}>critical path</span> sharing a machine. Highlighted = bottleneck ops. Swapping elsewhere cannot improve C_max.
      </div>
    </div>
  );
}

function DispatchingViz() {
  const [rule,setRule] = useState('SPT');
  const JOBS = [
    {id:'J1',pt:5,dd:10,arr:0,rem:8, col:'#22d3ee'},
    {id:'J2',pt:2,dd:4, arr:1,rem:12,col:'#a78bfa'},
    {id:'J3',pt:8,dd:15,arr:0,rem:5, col:'#34d399'},
    {id:'J4',pt:1,dd:8, arr:2,rem:3, col:'#fb7185'},
  ];
  const RULES = {
    SPT: {label:'Shortest Processing Time',fn:j=>j.pt,   asc:true},
    LPT: {label:'Longest Processing Time', fn:j=>j.pt,   asc:false},
    EDD: {label:'Earliest Due Date',       fn:j=>j.dd,   asc:true},
    FIFO:{label:'First In, First Out',     fn:j=>j.arr,  asc:true},
    MWKR:{label:'Most Work Remaining',    fn:j=>j.rem,  asc:false},
    CR:  {label:'Critical Ratio (dd/pt)',  fn:j=>(j.dd/(j.pt||1)),asc:true},
  };
  const {label,fn,asc} = RULES[rule];
  const sorted = [...JOBS].sort((a,b)=>asc?fn(a)-fn(b):fn(b)-fn(a));
  return (
    <div className="m4-card">
      <div className="m4-card-h">Dispatching Rules Visualizer</div>
      <div className="m4-preset-row" style={{flexWrap:'wrap',gap:'0.3rem',marginBottom:'0.5rem'}}>
        {Object.keys(RULES).map(r=>(
          <button key={r} className="m4-preset-btn"
            style={rule===r?{background:'rgba(167,139,250,0.18)',borderColor:'var(--violet)',color:'var(--violet)'}:{}}
            onClick={()=>setRule(r)}>{r}</button>
        ))}
      </div>
      <div style={{fontSize:'0.71rem',color:'var(--text-2)',marginBottom:'0.55rem'}}>
        <strong style={{color:'var(--violet)'}}>{rule}:</strong> {label} — {asc?'ascending ↑ (smallest first)':'descending ↓ (largest first)'}
      </div>
      <div style={{display:'flex',gap:'0.4rem'}}>
        {sorted.map((j,pos)=>(
          <div key={j.id} style={{flex:1,background:`${j.col}18`,border:`2px solid ${j.col}88`,borderRadius:8,padding:'0.45rem 0.15rem',textAlign:'center',transition:'all 0.3s'}}>
            <div style={{fontSize:'0.82rem',fontWeight:800,color:j.col,fontFamily:'monospace'}}>{j.id}</div>
            <div style={{fontSize:'0.57rem',color:'var(--text-3)',marginTop:2}}>pt={j.pt} dd={j.dd}</div>
            <div style={{fontSize:'0.57rem',color:'var(--text-3)'}}>rem={j.rem}</div>
            <div style={{fontSize:'0.63rem',fontWeight:700,color:'var(--text-1)',background:'var(--bg-3)',borderRadius:4,padding:'1px 3px',marginTop:3}}>
              {(()=>{const v=fn(j);return typeof v==='number'&&v%1!==0?v.toFixed(1):v;})()}
            </div>
            {pos===0&&<div style={{width:6,height:6,borderRadius:'50%',background:j.col,margin:'3px auto 0',boxShadow:`0 0 7px ${j.col}`}}/>}
          </div>
        ))}
      </div>
      <div style={{fontSize:'0.62rem',color:'var(--text-3)',marginTop:'0.4rem',textAlign:'center'}}>
        Left = dispatched first. Number = priority key for <strong>{rule}</strong>. Glowing dot = highest priority.
      </div>
    </div>
  );
}

function JSSPSummaryPanel() {
  return (
    <div>
      {/* Quick-reference banner */}
      <div style={{background:'linear-gradient(135deg,rgba(251,113,133,0.07) 0%,rgba(167,139,250,0.07) 100%)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
        {[['NP-hard','Even 2 machines is hard','#fb7185'],['(n!)^m','Solution space size','#fbbf24'],['C_max','max_i C_i = makespan','#22d3ee'],['Disjunctive Graph','G = (V, C∪D)','#a78bfa'],['N1 Move','Swap on critical path','#34d399'],['RPD','0% = matches BKS','#06b6d4']].map(([k,v,col])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
            <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
            <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Row 1: Solution space calc + flip cards */}
      <div className="m4-two-col">
        <SolutionSpaceCalc />
        <div className="m4-card">
          <div className="m4-card-h">Concept Flashcards <span className="m4-algo-card-badge">flip to reveal</span></div>
          <JSSPFlipCards />
        </div>
      </div>

      {/* Row 2: Critical path Gantt + dispatching viz */}
      <div className="m4-two-col" style={{marginTop:'1rem'}}>
        <CriticalPathGantt />
        <DispatchingViz />
      </div>

      {/* Row 3: Cheat sheet */}
      <div className="m4-card" style={{marginTop:'1rem'}}>
        <div className="m4-card-h">JSSP Cheat Sheet — Exam Ready</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.55rem'}}>
          {[
            {title:'Setup',    col:'#fb7185',items:['n jobs, m machines','Fixed op order per job','Op = (machine, duration)','No preemption allowed']},
            {title:'Constraints',col:'#fbbf24',items:['Precedence: ops in job ordered','Disjunctive: machine ≤1 op/time','Start time s_ij ≥ 0','Completion = start + dur']},
            {title:'Objective', col:'#22d3ee',items:['Minimise C_max = max_i C_i','|H| ≤ (n!)^m schedules','C_max = critical path length','NP-hard for m ≥ 2']},
            {title:'Solving',   col:'#a78bfa',items:['Exact: B&B (tiny instances)','Greedy: SPT/LPT/EDD/MWKR','Local search: N1 on crit path','Meta: SA/Tabu/GA (large)']},
          ].map(({title,col,items})=>(
            <div key={title} style={{background:'var(--bg-2)',borderRadius:8,padding:'0.55rem',border:`1px solid ${col}33`}}>
              <div style={{fontSize:'0.66rem',fontWeight:700,color:col,marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{title}</div>
              {items.map((item,i)=>(
                <div key={i} style={{display:'flex',gap:'0.3rem',marginBottom:'0.22rem',alignItems:'flex-start'}}>
                  <span style={{color:col,fontSize:'0.58rem',flexShrink:0,marginTop:'0.14rem'}}>▸</span>
                  <span style={{fontSize:'0.68rem',color:'var(--text-2)',lineHeight:1.4}}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Job Shop Tab ──────────────────────────────────────────────────────────────
function JobShopTab() {
  const [view, setView] = useState('summary');
  return (
    <div>
      <div className="m4-algo-tabs" style={{marginBottom:'1.25rem'}}>
        {[['summary','⚡ Quick Summary'],['full','📖 Full Notes']].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${view===v?'m4-algo-tab--on':''}`} onClick={()=>setView(v)}>{l}</button>
        ))}
      </div>
      {view === 'summary' && <JSSPSummaryPanel />}
      {view === 'full' && <div>
      {/* Problem Definition */}
      <div className="m4-two-col">
        <div className="m4-card">
          <div className="m4-card-h">Problem Definition</div>
          <div className="m4-infobox">
            The <strong>Job Shop Scheduling Problem (JSSP)</strong> is one of the most studied combinatorial optimisation problems. It is an NP-hard problem that appears in manufacturing, cloud computing, and project planning.
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">Formal Setup</div>
          <ul className="m4-bullets">
            <li><strong>n jobs</strong> — each job is an ordered sequence of operations</li>
            <li><strong>m machines</strong> — each operation runs on a specific machine for a fixed duration</li>
            <li><strong>Precedence constraint:</strong> operations within a job must run in order</li>
            <li><strong>Disjunctive constraint:</strong> each machine handles at most one operation at a time</li>
          </ul>
          <div className="m4-hr"/>
          <div className="m4-flabel">Makespan (Objective)</div>
          <Tex src="C_{\max} = \max_i C_i" block />
          <VarTable vars={[
            ['C_{\\max}', 'Makespan — the total time from start to when the last operation finishes; this is what we want to minimise'],
            ['C_i', 'Completion time of job i — when its final operation finishes'],
            ['\\max_i C_i', 'Maximum over all jobs — the schedule is only complete when every job is done'],
          ]} />
          <div className="m4-hr"/>
          <div className="m4-flabel">Solution Space Explosion</div>
          <Tex src="|H| \leq (n!)^m" block />
          <VarTable vars={[
            ['|H|', 'Size of the hypothesis (solution) space — number of possible schedules to consider'],
            ['n!', 'Factorial of number of jobs — one machine can order n jobs in n! ways'],
            ['m', 'Number of machines — each machine independently orders all jobs, so we raise n! to the power m'],
          ]} />
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            <strong>Example:</strong> n=6, m=6 → (6!)⁶ = 720⁶ ≈ 1.4 × 10¹⁷ possible schedules. Exhaustive search is infeasible — we need heuristics!
          </div>
        </div>

        <div className="m4-card">
          <div className="m4-card-h">Three Ingredients Applied to JSSP</div>
          <div className="m4-algo-card" style={{'--ac':'var(--cyan)'}}>
            <div className="m4-algo-card-h">Language (Representation)</div>
            <div className="m4-algo-card-desc">
              A <strong>permutation</strong> of jobs for each machine. Each machine has its own ordering of n jobs, defining which job goes first, second, etc. An alternative representation: operation lists (single permutation of all n×m operations).
            </div>
          </div>
          <div className="m4-algo-card" style={{'--ac':'var(--violet)'}}>
            <div className="m4-algo-card-h">Model (Hypothesis)</div>
            <div className="m4-algo-card-desc">
              A <strong>schedule</strong> — start times for every operation on every machine, respecting both precedence (job order) and disjunctive (machine capacity) constraints. Represented as a Gantt chart.
            </div>
          </div>
          <div className="m4-algo-card" style={{'--ac':'var(--emerald)'}}>
            <div className="m4-algo-card-h">Metric (Objective)</div>
            <div className="m4-algo-card-desc">
              <strong>Minimise makespan C_max</strong> — the time at which the last operation completes. Sometimes secondary objectives: total tardiness, machine utilisation.
            </div>
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">NP-Hardness</div>
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            JSSP is NP-hard even for 2 machines (except trivial cases). The classic 10×10 benchmark FT10 (Fisher & Thompson, 1963) remained unsolved for 26 years — solved exactly in 1989 by Carlier &amp; Pinson. This motivates the use of metaheuristic (approximate) algorithms.
          </div>
        </div>
      </div>

      {/* Dispatching Rules */}
      <div className="m4-card" style={{marginTop:'1rem'}}>
        <div className="m4-card-h">Dispatching Rules <span className="m4-algo-card-badge">greedy heuristics</span></div>
        <div className="m4-infobox" style={{fontSize:'0.8rem',marginBottom:'0.75rem'}}>
          Dispatching rules decide <em>which ready operation to schedule next</em> on a free machine. They are fast (O(n log n)) but give no optimality guarantee.
        </div>
        <table className="m4-dispatch-tbl">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Full Name</th>
              <th>Priority Criterion</th>
              <th>Bias / Use Case</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['SPT','var(--cyan)', 'Shortest Processing Time', 'Smallest operation duration first', 'Exploitation — finishes short jobs quickly, minimises average completion time'],
              ['LPT','var(--violet)', 'Longest Processing Time', 'Largest operation duration first', 'Gets long ops on machines early — can reduce idle time'],
              ['EDD','var(--emerald)', 'Earliest Due Date', 'Job with earliest deadline first', 'Minimises tardiness (not makespan directly)'],
              ['FIFO','var(--amber)', 'First In, First Out', 'Job that arrived (was released) first', 'Fair; easy to implement; common in queuing'],
              ['LIFO','var(--rose)', 'Last In, First Out', 'Job that arrived last', 'Low-latency for newest arrivals (e.g. stack-based systems)'],
              ['CR','var(--cyan)', 'Critical Ratio', '(Due date − now) / remaining processing time', 'Balances urgency and workload; CR < 1 means already late'],
              ['MWKR','var(--violet)', 'Most Work Remaining', 'Job with most total remaining processing time', 'Prioritises "heavy" jobs to prevent idle machines at end'],
            ].map(([rule, col, name, criterion, bias]) => (
              <tr key={rule}>
                <td style={{color:col, fontFamily:'var(--font-mono)', fontWeight:700}}>{rule}</td>
                <td>{name}</td>
                <td>{criterion}</td>
                <td style={{fontSize:'0.73rem'}}>{bias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disjunctive Graph & Local Search */}
      <div className="m4-two-col" style={{marginTop:'1rem'}}>
        <div className="m4-card">
          <div className="m4-card-h">Disjunctive Graph Model</div>
          <div className="m4-infobox">
            A JSSP instance can be modelled as a directed graph to reason about schedules mathematically.
          </div>
          <Tex src="G = (V,\; C \cup D)" block />
          <VarTable vars={[
            ['G', 'The disjunctive graph representing the JSSP instance'],
            ['V', 'Vertices — one node per operation, plus a source (s) and sink (t) node'],
            ['C', 'Conjunctive arcs — directed edges encoding job precedence (operation A must finish before B within the same job); arc weight = processing time of the source operation'],
            ['D', 'Disjunctive arcs — undirected edges between operations competing for the same machine; choosing a direction fixes the machine order'],
          ]} />
          <div className="m4-hr"/>
          <div className="m4-flabel">Makespan as Longest Path</div>
          <Tex src="C_{\max} = \text{longest path from } s \text{ to } t \text{ in } G" block />
          <div style={{fontSize:'0.79rem',color:'var(--text-2)'}}>
            Fixing all disjunctive arc directions gives a DAG. The critical path (longest path) determines C_max. Minimising C_max = finding the orientation of D that minimises the longest path.
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">N1 Neighbourhood (Local Search)</div>
          <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
            <strong>Critical path:</strong> The longest path from s to t. Operations on the critical path are the bottleneck — they directly determine C_max.<br/><br/>
            <strong>N1 move:</strong> Swap two adjacent operations on the critical path that share the same machine. This is the smallest change that could reduce the critical path length. Only critical-path swaps matter — non-critical swaps cannot improve C_max.
          </div>
        </div>

        <div className="m4-card">
          <div className="m4-card-h">Benchmark Instances &amp; RPD Metric</div>
          <table className="m4-rule-tbl">
            <thead>
              <tr><th>Instance</th><th>Size (n×m)</th><th>BKS C_max</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td style={{color:'var(--cyan)'}}>FT06</td><td>6×6</td><td>55</td><td>Classic, solved optimally</td></tr>
              <tr><td style={{color:'var(--cyan)'}}>FT10</td><td>10×10</td><td>930</td><td>Unsolved 26 yrs; solved 1989</td></tr>
              <tr><td style={{color:'var(--cyan)'}}>FT20</td><td>20×5</td><td>1165</td><td>Fisher &amp; Thompson, 1963</td></tr>
              <tr><td style={{color:'var(--violet)'}}>LA01–LA40</td><td>10×5 to 30×10</td><td>varies</td><td>Lawrence, 1984</td></tr>
              <tr><td style={{color:'var(--emerald)'}}>ORB01–ORB10</td><td>10×10</td><td>varies</td><td>Applegate &amp; Cook, 1991</td></tr>
              <tr><td style={{color:'var(--amber)'}}>TA01–TA80</td><td>15×15 to 100×20</td><td>varies</td><td>Taillard, 1993; hardest set</td></tr>
            </tbody>
          </table>
          <div className="m4-hr"/>
          <div className="m4-flabel">Relative Percentage Deviation (RPD)</div>
          <Tex src="\text{RPD} = \frac{C_{\max}^{\text{obtained}} - C_{\max}^{\text{BKS}}}{C_{\max}^{\text{BKS}}} \times 100\%" block />
          <VarTable vars={[
            ['\\text{RPD}', 'Relative Percentage Deviation — measures how much worse your solution is compared to the best known; lower is better (0% = matches BKS)'],
            ['C_{\\max}^{\\text{obtained}}', 'Makespan produced by your algorithm on this instance'],
            ['C_{\\max}^{\\text{BKS}}', 'Best Known Solution makespan — the best makespan ever found (may not be provably optimal)'],
          ]} />
          <div className="m4-hr"/>
          <div className="m4-flabel">Exact vs Approximate Methods</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.4rem'}}>
            <div className="m4-strat" style={{'--sc':'var(--cyan)'}}>
              <div className="m4-strat-h">Exact (Branch &amp; Bound)</div>
              <div className="m4-strat-d">Guarantees optimal. Feasible only for small instances (n,m ≤ ~10). Exponential worst-case time.</div>
            </div>
            <div className="m4-strat" style={{'--sc':'var(--violet)'}}>
              <div className="m4-strat-h">Approximate (Metaheuristics)</div>
              <div className="m4-strat-d">No optimality guarantee but fast. SA, Tabu, GA, ILS all applied to JSSP. Practical for large instances.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Embed the interactive JSSP lab */}
      <div className="m4-sec-hdr" style={{marginTop:'1.5rem'}}>
        <h2 className="m4-sec-title">Interactive JSSP Scheduler <span className="m4-badge">Lab</span></h2>
        <p className="m4-sec-sub">Edit the instance, run a greedy dispatching schedule, and inspect the Gantt chart.</p>
      </div>
      <JSSPViz />
      </div>}
    </div>
  );
}

// ── Stochastic Summary Components ─────────────────────────────────────────────

function SAProbCalc() {
  const [dQ, setDQ] = useState(-5);
  const [temp, setTemp] = useState(10);
  const P = Math.exp(dQ / temp);
  const regime = temp >= 30 ? {label:'Exploration (hot)',col:'#fb7185'} : temp >= 8 ? {label:'Balanced',col:'#fbbf24'} : {label:'Exploitation (cold)',col:'#34d399'};
  return (
    <div className="m4-card">
      <div className="m4-card-h">SA Acceptance Probability <span className="m4-algo-card-badge">interactive</span></div>
      <div style={{textAlign:'center',marginBottom:'0.5rem'}}>
        <Tex src={`P = e^{\\Delta Q/t} = e^{${dQ}/${temp}} \\approx ${P.toFixed(4)}`} block />
      </div>
      <div className="m4-ctrl">
        <div className="m4-ctrl-lbl"><span>ΔQ — quality gap (negative = worse solution)</span><span className="m4-ctrl-val">{dQ}</span></div>
        <input type="range" min={-30} max={-1} value={dQ} onChange={e=>setDQ(+e.target.value)}/>
      </div>
      <div className="m4-ctrl">
        <div className="m4-ctrl-lbl"><span>Temperature t (cooling decreases this)</span><span className="m4-ctrl-val">{temp}</span></div>
        <input type="range" min={1} max={50} value={temp} onChange={e=>setTemp(+e.target.value)}/>
      </div>
      <div style={{background:'var(--bg-2)',borderRadius:8,padding:'0.6rem',border:`1px solid rgba(167,139,250,0.2)`,marginTop:'0.4rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.3rem'}}>
          <span style={{fontSize:'0.7rem',color:'var(--text-2)'}}>Acceptance probability P</span>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <span style={{fontSize:'0.68rem',color:regime.col,fontWeight:700}}>{regime.label}</span>
            <span style={{fontSize:'0.82rem',fontWeight:800,color:'var(--violet)',fontFamily:'monospace'}}>{(P*100).toFixed(1)}%</span>
          </div>
        </div>
        <div style={{height:14,background:'var(--bg-3)',borderRadius:7,overflow:'hidden',position:'relative'}}>
          <div style={{height:'100%',width:`${Math.min(100,P*100)}%`,background:`linear-gradient(90deg,#34d399,#fbbf24,#fb7185)`,borderRadius:7,transition:'width 0.15s'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.63rem',color:'var(--text-3)',marginTop:4}}>
          <span>0% — never accept</span><span>100% — always accept</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',marginTop:'0.5rem'}}>
        <div className="m4-infobox" style={{fontSize:'0.7rem'}}>t → 0: P → 0 → <strong>pure hill climb</strong></div>
        <div className="m4-infobox" style={{fontSize:'0.7rem'}}>t → ∞: P → 1 → <strong>random walk</strong></div>
      </div>
    </div>
  );
}

function AlgoCompMatrix() {
  const ALGOS = [
    {code:'HC',  col:'#22d3ee',name:'Hill Climbing',       worse:'✗ Never',     mem:'✗',    restart:'✗',   insight:'Greedy uphill only — gets trapped at local optima'},
    {code:'SA',  col:'#fbbf24',name:'Simulated Annealing', worse:'✓ P=e^(ΔQ/t)',mem:'✗',    restart:'✗',   insight:'Temperature controls acceptance of worse solutions'},
    {code:'TS',  col:'#a78bfa',name:'Tabu Search',         worse:'✓ (forced)',  mem:'✓ FIFO',restart:'✗',   insight:'Forbidden list prevents revisiting recent solutions'},
    {code:'ILS', col:'#34d399',name:'Iterated Local Search',worse:'✗',          mem:'✓ home',restart:'✓ smart','insight':'HC of HCs — perturb from best local opt'},
  ];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Algorithm Comparison Matrix</div>
      <div style={{overflowX:'auto'}}>
        <table className="m4-rule-tbl" style={{minWidth:460}}>
          <thead>
            <tr>
              <th>Algorithm</th><th>Accept worse?</th><th>Memory?</th><th>Restarts?</th><th>Key insight</th>
            </tr>
          </thead>
          <tbody>
            {ALGOS.map(a=>(
              <tr key={a.code}>
                <td style={{color:a.col,fontFamily:'var(--font-mono)',fontWeight:700}}>{a.code}</td>
                <td style={{color:a.worse.startsWith('✓')?'#34d399':'#fb7185',fontSize:'0.72rem'}}>{a.worse}</td>
                <td style={{color:a.mem.startsWith('✓')?'#34d399':'#fb7185',fontSize:'0.72rem'}}>{a.mem}</td>
                <td style={{color:a.restart.startsWith('✓')?'#34d399':'#fb7185',fontSize:'0.72rem'}}>{a.restart}</td>
                <td style={{fontSize:'0.7rem',color:'var(--text-2)'}}>{a.insight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="m4-warnbox" style={{marginTop:'0.75rem',fontSize:'0.72rem'}}>
        <strong>No Free Lunch (NFL)</strong> — Wolpert &amp; Macready 1997: Averaged across ALL problems, every algorithm performs equally. Gain on one class = loss on another. Choose by domain knowledge.
      </div>
    </div>
  );
}

function StochasticSummaryPanel() {
  return (
    <div>
      {/* Quick-reference banner */}
      <div style={{background:'linear-gradient(135deg,rgba(34,211,238,0.07) 0%,rgba(167,139,250,0.07) 100%)',border:'1px solid rgba(34,211,238,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
        {[['HC (1+1)','Greedy hill climb','#22d3ee'],['SA','P=e^(ΔQ/t)','#fbbf24'],['Tabu','FIFO forbidden list','#a78bfa'],['ILS','HC of HCs','#34d399'],['Tweak','Perturbation op','#06b6d4'],['NFL','No free lunch','#fb7185']].map(([k,v,col])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
            <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
            <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Row 1: SA probability calc + comparison matrix */}
      <div className="m4-two-col">
        <SAProbCalc />
        <AlgoCompMatrix />
      </div>

      {/* Why stochastic? intro */}
      <div className="m4-card" style={{marginTop:'1rem',background:'linear-gradient(135deg,rgba(34,211,238,0.05) 0%,rgba(167,139,250,0.05) 100%)'}}>
        <div className="m4-card-h">Why do we even need these algorithms?</div>
        <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.7}}>
          <p style={{marginBottom:'0.6rem'}}>Imagine you're trying to find the tallest mountain in a huge mountain range, but there's thick fog — you can only see a few metres around you. You can't look at a map (there's no formula telling you which direction is globally best). All you can do is <strong>take steps and measure your height</strong>.</p>
          <p style={{marginBottom:'0.6rem'}}>That's every hard real-world optimisation problem: too many possible solutions to check them all, no gradient to follow, and lots of "local peaks" that look great until you realise there's a bigger mountain somewhere else. These algorithms are strategies for exploring a foggy landscape.</p>
          <p style={{marginBottom:'0.5rem'}}><strong>This course covers exactly 4 stochastic single-state methods</strong> (HC, SA, Tabu, ILS). Each makes a different trade-off across three tensions:</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.45rem'}}>
            {[['Explore vs. Exploit','Wander to find new peaks (explore) vs. climb the known best (exploit)','#22d3ee'],['Accept worse moves?','Sometimes you must walk downhill to reach a taller mountain on the other side','#fbbf24'],['Use memory?','Remembering where you have been stops you going in circles','#a78bfa']].map(([t,d,col])=>(
              <div key={t} style={{background:`${col}11`,border:`1px solid ${col}33`,borderRadius:8,padding:'0.55rem'}}>
                <div style={{fontSize:'0.68rem',fontWeight:700,color:col,marginBottom:'0.25rem'}}>{t}</div>
                <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.5}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Algorithm concept cards — expanded */}
      <div style={{marginTop:'0.75rem',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem'}}>

        {/* HC */}
        <div style={{background:'var(--bg-2)',borderRadius:10,padding:'0.9rem',border:'1px solid #22d3ee33'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem',alignItems:'center'}}>
            <span style={{fontSize:'0.85rem',fontWeight:800,color:'#22d3ee',fontFamily:'monospace'}}>HC — Hill Climbing</span>
            <span style={{fontSize:'0.62rem',color:'#22d3ee',background:'#22d3ee18',padding:'2px 7px',borderRadius:5}}>simplest</span>
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.55rem'}}>
            <strong>The idea in plain English:</strong> You are blindfolded on a mountain range trying to find the peak. You take one random step. If you are now higher than before, stay there. If you are lower, step back. Repeat indefinitely.
          </div>
          <div style={{background:'#22d3ee0d',borderRadius:7,padding:'0.5rem 0.65rem',marginBottom:'0.55rem'}}>
            <div style={{fontSize:'0.67rem',fontWeight:700,color:'#22d3ee',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Real-world analogy</div>
            <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55}}>You are tuning a car engine by turning knobs one at a time. Make a small adjustment, test it, and only keep the change if the engine runs better. You never deliberately make it worse — that means you get stuck the moment you reach any local peak.</div>
          </div>
          <div style={{background:'var(--bg-3)',borderRadius:6,padding:'0.4rem 0.55rem',fontFamily:'monospace',fontSize:'0.64rem',color:'var(--text-2)',whiteSpace:'pre-line',marginBottom:'0.5rem'}}>{'Variants:\n(1+1)  — 1 tweak, keep if better            [basic]\n(1+n)  — try n tweaks, keep the single best  [more deliberate]\n(1,n)  — try n tweaks, always replace S      [more exploratory]'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}}>
            <div style={{background:'#22d3ee0d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#22d3ee',marginBottom:'0.2rem'}}>When it works well</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>Problems where any improvement genuinely is a step toward the global best — no "must get worse first" traps.</div>
            </div>
            <div style={{background:'#fb71850d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#fb7185',marginBottom:'0.2rem'}}>Fatal flaw</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>Gets permanently stuck on the first local peak it finds — a hill that looks locally best, but may be nowhere near the global best.</div>
            </div>
          </div>
        </div>

        {/* SA */}
        <div style={{background:'var(--bg-2)',borderRadius:10,padding:'0.9rem',border:'1px solid #fbbf2433'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem',alignItems:'center'}}>
            <span style={{fontSize:'0.85rem',fontWeight:800,color:'#fbbf24',fontFamily:'monospace'}}>SA — Simulated Annealing</span>
            <span style={{fontSize:'0.62rem',color:'#fbbf24',background:'#fbbf2418',padding:'2px 7px',borderRadius:5}}>accepts worse</span>
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.55rem'}}>
            <strong>The idea in plain English:</strong> Like Hill Climbing, but early on you are allowed to take steps downhill. Over time you become more and more picky, accepting fewer and fewer bad moves. By the end it behaves almost like a normal hill climber.
          </div>
          <div style={{background:'#fbbf240d',borderRadius:7,padding:'0.5rem 0.65rem',marginBottom:'0.55rem'}}>
            <div style={{fontSize:'0.67rem',fontWeight:700,color:'#fbbf24',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Where the name comes from</div>
            <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55}}>When you heat metal and slowly cool it, atoms start out moving wildly (exploring every arrangement) and gradually settle into a stable crystal structure. Hot = chaotic exploration. Cold = locked-in exploitation. The algorithm mirrors this: "temperature" t starts high and is slowly reduced by a cooling schedule.</div>
          </div>
          <div style={{background:'var(--bg-3)',borderRadius:6,padding:'0.4rem 0.55rem',fontFamily:'monospace',fontSize:'0.64rem',color:'var(--text-2)',whiteSpace:'pre-line',marginBottom:'0.5rem'}}>{'Acceptance rule  P = e^(ΔQ / t):\n  Better solution  → always accept (P = 1)\n  Worse solution   → accept with probability P\n  High t (hot)     → P stays near 1  → accept almost anything\n  Low t (cold)     → P → 0           → only accept improvements'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}}>
            <div style={{background:'#fbbf240d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#fbbf24',marginBottom:'0.2rem'}}>Why this beats HC</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>By accepting worse solutions early, it can walk down off a local peak and find a path to a much taller mountain on the other side.</div>
            </div>
            <div style={{background:'#fb71850d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#fb7185',marginBottom:'0.2rem'}}>Fatal flaw</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>You must carefully design the cooling schedule — cool too fast and it behaves like HC; too slow and it wastes time randomly wandering with no progress.</div>
            </div>
          </div>
        </div>

        {/* TS */}
        <div style={{background:'var(--bg-2)',borderRadius:10,padding:'0.9rem',border:'1px solid #a78bfa33'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem',alignItems:'center'}}>
            <span style={{fontSize:'0.85rem',fontWeight:800,color:'#a78bfa',fontFamily:'monospace'}}>TS — Tabu Search</span>
            <span style={{fontSize:'0.62rem',color:'#a78bfa',background:'#a78bfa18',padding:'2px 7px',borderRadius:5}}>uses memory</span>
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.55rem'}}>
            <strong>The idea in plain English:</strong> Like Hill Climbing, but you keep a short "banned list" of places you have recently visited. You always move to the best available neighbour — even if it is worse than where you currently are — as long as it is not on the banned list.
          </div>
          <div style={{background:'#a78bfa0d',borderRadius:7,padding:'0.5rem 0.65rem',marginBottom:'0.55rem'}}>
            <div style={{fontSize:'0.67rem',fontWeight:700,color:'#a78bfa',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Real-world analogy</div>
            <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55}}>You are solving a maze. Basic hill climbing keeps walking back and forth between the same two dead ends forever. Tabu Search says: "I just came from that cell — it is temporarily banned." This forces you to keep moving forward instead of oscillating in circles. After enough steps the ban lifts and you could revisit, but by then you have already moved on.</div>
          </div>
          <div style={{background:'var(--bg-3)',borderRadius:6,padding:'0.4rem 0.55rem',fontFamily:'monospace',fontSize:'0.64rem',color:'var(--text-2)',whiteSpace:'pre-line',marginBottom:'0.5rem'}}>{'FIFO banned list of length l:\n  Always move to best non-tabu neighbour\n  Even if that neighbour is worse than current position\n  After l steps, oldest entry expires and is forgotten\n  l controls memory depth: large l = safer but slower'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}}>
            <div style={{background:'#a78bfa0d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#a78bfa',marginBottom:'0.2rem'}}>Why this beats HC</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>Memory prevents cycling — the algorithm is guaranteed to escape any local optimum because it literally cannot revisit recent states.</div>
            </div>
            <div style={{background:'#fb71850d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#fb7185',marginBottom:'0.2rem'}}>Fatal flaw</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>You need to pick the right list length l. Too short: still cycles. Too long: bans good solutions unnecessarily, wasting time avoiding places that would have been fine.</div>
            </div>
          </div>
        </div>

        {/* ILS */}
        <div style={{background:'var(--bg-2)',borderRadius:10,padding:'0.9rem',border:'1px solid #34d39933'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem',alignItems:'center'}}>
            <span style={{fontSize:'0.85rem',fontWeight:800,color:'#34d399',fontFamily:'monospace'}}>ILS — Iterated Local Search</span>
            <span style={{fontSize:'0.62rem',color:'#34d399',background:'#34d39918',padding:'2px 7px',borderRadius:5}}>HC of HCs</span>
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.55rem'}}>
            <strong>The idea in plain English:</strong> Run Hill Climbing until you get stuck at a local peak. Remember where you ended up (your "home base"). Jump to a new nearby starting point and hill-climb from there. If the new peak is better than home base, it becomes the new home base. Repeat.
          </div>
          <div style={{background:'#34d3990d',borderRadius:7,padding:'0.5rem 0.65rem',marginBottom:'0.55rem'}}>
            <div style={{fontSize:'0.67rem',fontWeight:700,color:'#34d399',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Real-world analogy</div>
            <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55}}>You are a hiking expedition leader. You climb to the nearest peak and mark it on your map (home base). Then you fly a helicopter to a new drop-off point that is somewhat near your home base — not random, not the same place, but strategically different. You climb again. If you found a better peak, that becomes the new home base for the next expedition. This is smarter than pure random restarts because each expedition begins near known-good territory.</div>
          </div>
          <div style={{background:'var(--bg-3)',borderRadius:6,padding:'0.4rem 0.55rem',fontFamily:'monospace',fontSize:'0.64rem',color:'var(--text-2)',whiteSpace:'pre-line',marginBottom:'0.5rem'}}>{'H = current home base (best local optimum found so far)\nLoop:\n  R ← Perturb(H)         // jump near H but to a different region\n  S ← HillClimb(R)       // climb to local optimum from R\n  H ← NewHomeBase(H, S)  // keep whichever of H or S is better'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}}>
            <div style={{background:'#34d3990d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#34d399',marginBottom:'0.2rem'}}>Why this beats random restarts</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>Each new start is guided by your current best — you explore the neighbourhood of good solutions rather than starting completely blind every time.</div>
            </div>
            <div style={{background:'#fb71850d',borderRadius:6,padding:'0.38rem 0.5rem'}}>
              <div style={{fontSize:'0.64rem',fontWeight:700,color:'#fb7185',marginBottom:'0.2rem'}}>Fatal flaw</div>
              <div style={{fontSize:'0.67rem',color:'var(--text-2)',lineHeight:1.45}}>The perturbation step is critical and hard to design — too small and you re-find the same peak; too large and you are effectively just doing random restarts.</div>
            </div>
          </div>
        </div>

      </div>

      {/* Stochastic cheat sheet */}
      <div className="m4-card" style={{marginTop:'1rem'}}>
        <div className="m4-card-h">Stochastic Methods Cheat Sheet</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.55rem'}}>
          {[
            {title:'Core Idea',col:'#22d3ee',items:['Start from a candidate solution S','Tweak S to get R (perturbation)','Keep R if better (or maybe if worse)','Repeat until time/quality budget hit']},
            {title:'Key Formulas',col:'#a78bfa',items:['SA acceptance: P = e^(ΔQ/t)','Gaussian tweak: v_i += N(0,σ²)','ILS: NewHomeBase = max(H,S)','Tabu: keep FIFO list of length l']},
            {title:'Exploration vs Exploit',col:'#34d399',items:['Large σ / high t → exploration','Small σ / low t → exploitation','SA cools over time (both phases)','ILS: perturb=explore, HC=exploit']},
          ].map(({title,col,items})=>(
            <div key={title} style={{background:'var(--bg-2)',borderRadius:8,padding:'0.55rem',border:`1px solid ${col}33`}}>
              <div style={{fontSize:'0.66rem',fontWeight:700,color:col,marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{title}</div>
              {items.map((item,i)=>(
                <div key={i} style={{display:'flex',gap:'0.3rem',marginBottom:'0.22rem',alignItems:'flex-start'}}>
                  <span style={{color:col,fontSize:'0.58rem',flexShrink:0,marginTop:'0.14rem'}}>▸</span>
                  <span style={{fontSize:'0.68rem',color:'var(--text-2)',lineHeight:1.4}}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Algorithms Tab ────────────────────────────────────────────────────────────
function AlgorithmsTab() {
  const [sec, setSec] = useState('gradient');
  const [stoView, setStoView] = useState('summary');

  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['gradient', 'Gradient Methods'],
          ['direct', 'Direct Methods'],
          ['stochastic', 'Stochastic Methods'],
        ].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {/* ── GRADIENT METHODS ── */}
      {sec === 'gradient' && (
        <div>
          <GradientDescentViz />
          <div className="m4-two-col" style={{marginTop:'1.5rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Gradient Descent with Restarts</div>
              <div className="m4-pseudocode">
                <span className="kw">Algorithm</span>: Gradient Ascent with Restarts{'\n'}
                <span className="num"> 1:</span> 𝐱  ← random initial value{'\n'}
                <span className="num"> 2:</span> 𝐱* ← 𝐱  <span className="cm">▷ best so far</span>{'\n'}
                <span className="num"> 3:</span> <span className="kw">repeat</span>{'\n'}
                <span className="num"> 4:</span>   <span className="kw">repeat</span>{'\n'}
                <span className="num"> 5:</span>     𝐱 ← 𝐱 + α∇f(𝐱){'\n'}
                <span className="num"> 6:</span>   <span className="kw">until</span> ‖∇f(𝐱)‖ {"<"} ε{'\n'}
                <span className="num"> 7:</span>   <span className="kw">if</span> f(𝐱) {">"} f(𝐱*) <span className="kw">then</span> 𝐱* ← 𝐱{'\n'}
                <span className="num"> 8:</span>   𝐱 ← random value{'\n'}
                <span className="num"> 9:</span> <span className="kw">until</span> time exhausted{'\n'}
                <span className="num">10:</span> <span className="kw">return</span> 𝐱*
              </div>
              <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
                <strong>Why restarts?</strong> Gradient methods get stuck in local optima. Multiple random restarts explore different regions. Under bounded space + finite optima, this <em>eventually</em> finds the global optimum.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Pathological cases</div>
              <ul className="m4-bullets">
                <li><strong>Too small α:</strong> Slow convergence — tiny steps take forever</li>
                <li><strong>Too large α:</strong> Overshoot — oscillates around minimum, may diverge</li>
                <li><strong>Flat regions:</strong> f'(x) = 0 everywhere — no slope to follow</li>
                <li><strong>Rayleigh-like:</strong> Steps grow approaching optimum — pathological!</li>
              </ul>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Newton-Raphson Deep Dive</div>
              <div className="m4-flabel">Root-finding form</div>
              <Tex src="x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}" block />
              <div className="m4-flabel">Optimisation form (zeros of f')</div>
              <Tex src="x_{n+1} = x_n - \frac{f'(x_n)}{f''(x_n)}" block />
              <VarTable vars={[
                ['x_{n+1}', 'Next iterate — the improved estimate of the root/optimum after one N-R step'],
                ['x_n', 'Current iterate — where we are right now'],
                ['f(x_n)', 'Function value at current point (root-finding form: we want this to equal zero)'],
                ["f'(x_n)", 'First derivative (slope) at current point — direction of the tangent line'],
                ["f''(x_n)", 'Second derivative (curvature) at current point — used in optimisation form to auto-scale the step'],
                ["f'(x_n)/f''(x_n)", 'Newton step — dividing slope by curvature automatically gives the right step size; large curvature → small step, flat region → large step'],
              ]} />
              <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
                <strong>Geometric intuition:</strong> Uses the tangent <em>line</em> to approximate f' — equivalent to fitting a local <em>quadratic</em> to f. Matches both value and curvature at the current point. Solves quadratics in exactly <strong>one step</strong>.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Gradient Ascent (general n-D)</div>
              <Tex src="\vec{x} \leftarrow \vec{x} + \alpha \begin{bmatrix}\partial f/\partial x_1 \\ \vdots \\ \partial f/\partial x_n\end{bmatrix}" block />
              <VarTable vars={[
                ['\\vec{x}', 'Current position in the n-dimensional search space (a vector of n coordinates)'],
                ['\\alpha', 'Learning rate (step size) — scales how far we move each iteration; use + for ascent, − for descent'],
                ['\\partial f/\\partial x_i', 'Partial derivative with respect to dimension i — rate of change of f when only x_i varies'],
                ['\\begin{bmatrix}\\partial f/\\partial x_1 \\\\ \\vdots \\\\ \\partial f/\\partial x_n\\end{bmatrix}', 'The gradient vector ∇f — each entry is the partial derivative in one dimension; points in the direction of steepest ascent'],
              ]} />
              <div className="m4-hr"/>
              <div className="m4-warnbox">
                <strong>Local optima problem:</strong> Gradient methods get stuck. No general algorithm guarantees finding the global optimum in non-finite domains. This motivates all the methods that follow!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DIRECT METHODS ── */}
      {sec === 'direct' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">What are Direct Methods?</div>
              <div className="m4-infobox">
                Gradient methods require derivatives — not always available! Direct methods rely solely on the <strong>objective function</strong> f(x). Used when the search space is a black box, non-differentiable, or not continuous.
              </div>
              <div className="m4-hr"/>
              <div className="m4-algo-card" style={{'--ac':'var(--cyan)'}}>
                <div className="m4-algo-card-h">Cyclic Coordinate Search (CCS) <span className="m4-algo-card-badge">taxicab search</span></div>
                <div className="m4-algo-card-desc">Optimise one variable at a time, cycling through all dimensions. Each step: line search in direction of current basis vector eᵢ.</div>
                <Tex src="\vec{x}^{k+1} = \arg\min_{x_i}\, f(\ldots, x_i, \ldots)" block />
                <VarTable vars={[
                  ['\\vec{x}^{k+1}', 'New position after this step — only the one coordinate xᵢ changes; all others stay fixed'],
                  ['k', 'Step counter — increments each time one coordinate is searched'],
                  ['x_i', 'The single coordinate being optimised this step (e.g. x₁, then x₂, then back to x₁ …)'],
                  ['f(\\ldots, x_i, \\ldots)', 'Objective function evaluated while xᵢ varies and every other xⱼ is locked'],
                  ['\\arg\\min_{x_i}', '"The value of xᵢ that gives the lowest f" — found by a line search along that axis'],
                ]} />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Stops when improvement per full cycle {"<"} ε. Can fail to find local optimum (diagonal valley problem).</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--violet)'}}>
                <div className="m4-algo-card-h">CCS with Acceleration Step</div>
                <div className="m4-algo-card-desc">After one full cycle, take an additional line search in the net progress direction:</div>
                <Tex src="\vec{u} = \vec{x}^n - \vec{x}^0 \quad \text{(net direction)}" block />
                <VarTable vars={[
                  ['\\vec{u}', 'Net displacement — the actual diagonal direction CCS traveled across the whole cycle'],
                  ['\\vec{x}^0', 'Start-of-cycle position — recorded before the first coordinate search of this cycle'],
                  ['\\vec{x}^n', 'End-of-cycle position — after all n coordinate line searches have been completed'],
                  ['n', 'Number of dimensions (= 2 for 2D, 3 for 3D, etc.)'],
                ]} />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Faster traversal of diagonal valleys/ridges.</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--emerald)'}}>
                <div className="m4-algo-card-h">Powell's Method</div>
                <div className="m4-algo-card-desc">Extends CCS by maintaining an adaptive queue of search directions, updated each cycle:</div>
                <Tex src="\vec{u}_{n+1} = \vec{x}^n - \vec{x}^0 \;\;\text{replaces oldest direction}" block />
                <VarTable vars={[
                  ['\\vec{u}_{n+1}', 'New search direction added to the queue — the net progress direction from this cycle'],
                  ['\\vec{x}^0', 'Start-of-cycle position (same as in the acceleration step)'],
                  ['\\vec{x}^n', 'End-of-cycle position — the direction they span is more aligned with the landscape than the original axes'],
                ]} />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Risk: directions can become linearly dependent, losing span of ℝⁿ.</div>
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Pattern Search & Simplex</div>
              <div className="m4-algo-card" style={{'--ac':'var(--amber)'}}>
                <div className="m4-algo-card-h">Hooke-Jeeves (H-J)</div>
                <div className="m4-algo-card-desc">Samples f(x ± α·eᵢ) in each dimension — directly approximating the slope. Requires 2n evaluations per step.</div>
                <Tex src="\vec{x}^* = \arg\min\{f(\vec{x} \pm \alpha\vec{e}_i)\}" block />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>If no improvement: shrink step α ← γα. Converges to local minimum.</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--rose)'}}>
                <div className="m4-algo-card-h">Generalised Pattern Search (GPS)</div>
                <div className="m4-algo-card-desc">Requires D to be a positive spanning set — guarantees at least one descent direction from any non-optimal point. Can use n+1 directions (vs H-J's 2n).</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--cyan)'}}>
                <div className="m4-algo-card-h">Nelder-Mead Simplex <span className="m4-algo-card-badge">population!</span></div>
                <div className="m4-algo-card-desc">Maintains n+1 vertices forming a simplex. "Rolls downhill" via four operations:</div>
                <Tex src="\text{Reflect:}\;\vec{x}_r = \bar{\vec{x}} + \alpha(\bar{\vec{x}} - \vec{x}_h)" block />
                <Tex src="\text{Expand:}\;\vec{x}_e = \bar{\vec{x}} + \beta(\vec{x}_r - \bar{\vec{x}})" block />
                <Tex src="\text{Contract:}\;\vec{x}_c = \bar{\vec{x}} + \gamma(\vec{x}_h - \bar{\vec{x}})" block />
                <Tex src="\text{Shrink:}\;\vec{x}_i \leftarrow \vec{x}_l + \sigma(\vec{x}_i - \vec{x}_l)" block />
                <VarTable vars={[
                  ['\\bar{\\vec{x}}', 'Centroid of all simplex vertices except the worst (x_h) — the "centre of gravity" of the good points'],
                  ['\\vec{x}_h', 'Worst vertex (highest value in minimisation) — the one being replaced or shrunk away from'],
                  ['\\vec{x}_l', 'Best vertex (lowest value in minimisation) — the anchor for the shrink operation'],
                  ['\\vec{x}_r', 'Reflected point — mirrors x_h through the centroid; tests the opposite side'],
                  ['\\vec{x}_e', 'Expanded point — pushes further past the reflected point if reflection was good'],
                  ['\\vec{x}_c', 'Contracted point — pulls back toward the centroid when reflection was bad'],
                  ['\\alpha', 'Reflection coefficient (typically 1) — how far to reflect past the centroid'],
                  ['\\beta', 'Expansion coefficient (typically 2) — how far to expand beyond the reflection'],
                  ['\\gamma', 'Contraction coefficient (typically 0.5) — how far to contract toward the centroid'],
                  ['\\sigma', 'Shrink coefficient (typically 0.5) — how much each vertex moves toward the best vertex x_l'],
                ]} />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Typical: α=1, β=2, γ=0.5, σ=0.5. Convergence: variance of vertex values {"<"} ε.</div>
              </div>
              <div className="m4-warnbox" style={{marginTop:'0.5rem'}}>
                <strong>Collective intelligence:</strong> Nelder-Mead maintains a <em>population</em> of candidates — no single point drives the search. This foreshadows population-based stochastic methods!
              </div>
            </div>
          </div>
          <div className="m4-sec-hdr" style={{marginTop:'1.5rem'}}>
            <h2 className="m4-sec-title">Nelder-Mead Simplex <span className="m4-badge">Interactive</span></h2>
            <p className="m4-sec-sub">Watch the simplex triangle morph and roll toward the minimum. Step through each operation manually or run automatically.</p>
          </div>
          <NelderMeadViz />
          <div className="m4-sec-hdr" style={{marginTop:'1.5rem'}}>
            <h2 className="m4-sec-title">CCS: Diagonal Valley Problem <span className="m4-badge">Interactive</span></h2>
            <p className="m4-sec-sub">Step through CCS on a real diagonal valley. Watch the staircase form, then toggle the acceleration step to see how u = xⁿ − x⁰ escapes it.</p>
          </div>
          <CCSViz />
        </div>
      )}

      {/* ── STOCHASTIC METHODS ── */}
      {sec === 'stochastic' && (
        <div>
          <div className="m4-algo-tabs" style={{marginBottom:'1.25rem'}}>
            {[['summary','⚡ Quick Summary'],['full','📖 Full Notes']].map(([v,l])=>(
              <button key={v} className={`m4-algo-tab ${stoView===v?'m4-algo-tab--on':''}`} onClick={()=>setStoView(v)}>{l}</button>
            ))}
          </div>
          {stoView === 'summary' && <StochasticSummaryPanel />}
          {stoView === 'full' && <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Hill Climbing Family</div>
              <div className="m4-infobox">
                <strong>The Tweak heuristic:</strong> "It's easier to find a good solution by modifying a good-ish one you've already found by a small amount than by starting from scratch." — Luke (2016)
              </div>
              <div className="m4-pseudocode">
                <span className="kw">Algorithm</span>: Hill Climbing (1+1){'\n'}
                <span className="num">1:</span> S ← initial candidate{'\n'}
                <span className="num">2:</span> <span className="kw">repeat</span>{'\n'}
                <span className="num">3:</span>   R ← Tweak(Copy(S)){'\n'}
                <span className="num">4:</span>   <span className="kw">if</span> Quality(R) {">"} Quality(S){'\n'}
                <span className="num">5:</span>     S ← R{'\n'}
                <span className="num">6:</span> <span className="kw">until</span> ideal or time up{'\n'}
                <span className="num">7:</span> <span className="kw">return</span> S
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Nomenclature</div>
              <table className="m4-rule-tbl">
                <thead><tr><th>Algorithm</th><th>Notation</th><th>Select from</th></tr></thead>
                <tbody>
                  <tr><td>Hill Climbing</td><td>(1+1)</td><td>1 existing + 1 modified</td></tr>
                  <tr><td>Steepest Ascent HC</td><td>(1+n)</td><td>1 existing + n modified</td></tr>
                  <tr><td>SA HC w/ Replacement</td><td>(1,n)</td><td>n modified only</td></tr>
                </tbody>
              </table>
              <div className="m4-hr"/>
              <div className="m4-flabel">Gaussian Tweak (non-uniform)</div>
              <Tex src="n \sim \mathcal{N}(0, \sigma^2) \quad v_i \leftarrow v_i + n" block />
              <VarTable vars={[
                ['n', 'Random noise sample drawn from a Gaussian distribution with mean 0 and variance σ²'],
                ['\\mathcal{N}(0, \\sigma^2)', 'Normal (Gaussian) distribution with mean μ=0 and variance σ²'],
                ['\\sigma^2', 'Variance — controls the spread/size of noise; tuning this controls the exploration rate'],
                ['\\sigma', 'Standard deviation — direct "exploration knob": large σ → big jumps (explore); small σ → tiny tweaks (exploit)'],
                ['v_i', 'The i-th element of the candidate solution vector being perturbed'],
              ]} />
              <div style={{fontSize:'0.79rem',color:'var(--text-2)'}}>σ directly controls exploration rate: large σ → more exploration; small σ → exploitation. Unlike bounded uniform, Gaussian allows arbitrarily large (but rare) jumps.</div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Exploration vs Exploitation</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.4rem'}}>
                <div className="m4-strat" style={{'--sc':'var(--cyan)'}}>
                  <div className="m4-strat-h">Exploitation (small step)</div>
                  <div className="m4-strat-d">Tiptoeing up the hill. Converges cleanly. Less likely to escape local optima.</div>
                </div>
                <div className="m4-strat" style={{'--sc':'var(--violet)'}}>
                  <div className="m4-strat-h">Exploration (large step)</div>
                  <div className="m4-strat-d">Leaps and bounds. Faster ascent. May overshoot. Can jump to better peaks.</div>
                </div>
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Simulated Annealing & Tabu</div>
              <div className="m4-flabel">SA Acceptance Probability</div>
              <Tex src="P = e^{\,\dfrac{\text{Quality}(R) - \text{Quality}(S)}{t}}" block />
              <VarTable vars={[
                ['P', 'Acceptance probability — likelihood of replacing S with the worse candidate R'],
                ['\\text{Quality}(R)', 'Quality (fitness) of the tweaked candidate R; less than Quality(S) when R is worse'],
                ['\\text{Quality}(S)', 'Quality of the current solution S'],
                ['\\text{Quality}(R) - \\text{Quality}(S)', 'Quality gap — negative when R is worse; larger (more negative) gap → smaller P'],
                ['t', 'Temperature — a positive number that decreases over time (the "cooling schedule"); high t → accept almost anything; t→0 → pure hill climb'],
                ['e', 'Euler\'s number (≈2.718); the natural exponential function ensures P is always between 0 and 1'],
              ]} />
              <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
                When Q(R) {"<"} Q(S): exponent is negative → 0 {"<"} P {"<"} 1. Higher temperature t → higher P (accept worse). As t → 0: pure hill climb. As t → ∞: random walk. Temperature decreases over time: <Tex src="t = \beta e^{-\alpha T}" />
              </div>
              <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>
                <span className="kw">Algorithm</span>: Simulated Annealing{'\n'}
                <span className="num"> 1:</span> t ← high initial temperature; S ← init{'\n'}
                <span className="num"> 2:</span> <span className="kw">repeat</span>{'\n'}
                <span className="num"> 3:</span>   R ← Tweak(Copy(S)){'\n'}
                <span className="num"> 4:</span>   <span className="kw">if</span> Q(R){">"} Q(S) <span className="kw">or</span> rand {"<"} e^((Q(R)-Q(S))/t){'\n'}
                <span className="num"> 5:</span>     S ← R{'\n'}
                <span className="num"> 6:</span>   Decrease t; update Best{'\n'}
                <span className="num"> 7:</span> <span className="kw">until</span> time up or t ≤ 0{'\n'}
                <span className="num"> 8:</span> <span className="kw">return</span> Best
              </div>
              <div className="m4-hr"/>
              <div className="m4-algo-card" style={{'--ac':'var(--amber)'}}>
                <div className="m4-algo-card-h">Tabu Search <span className="m4-algo-card-badge">Glover, 1986</span></div>
                <div className="m4-algo-card-desc">Maintains a FIFO queue of recently visited candidates (length l). Forbids revisiting — eventually escapes any local optimum. Trade-off: large l = better memory but slower lookup.</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--emerald)'}}>
                <div className="m4-algo-card-h">Iterated Local Search (ILS)</div>
                <div className="m4-algo-card-desc">
                  Clever restarts using a "home base" local optimum. <strong>Perturb(H)</strong> generates new start near home base. <strong>NewHomeBase(H,S)</strong> decides whether to adopt the new local optimum.
                </div>
                <Tex src="\text{NewHomeBase}(H,S) = \begin{cases} S & Q(S) \geq Q(H) \\ H & \text{otherwise} \end{cases}" block />
                <VarTable vars={[
                  ['H', 'Home base — the local optimum whose neighbourhood we are exploring for better optima'],
                  ['S', 'The newly found local optimum after the latest hill-climbing run'],
                  ['Q(S)', 'Quality of the new local optimum S'],
                  ['Q(H)', 'Quality of the current home base H'],
                  ['\\text{NewHomeBase}(H,S)', 'Returns the new home base: adopt S if it\'s at least as good, otherwise stay at H ("hill climb of hill climbs")'],
                ]} />
              </div>
              <div className="m4-hr"/>
              <div className="m4-warnbox">
                <strong>No Free Lunch Theorem</strong> (Wolpert &amp; Macready, 1997): Averaged across all possible problems, no algorithm outperforms any other. Performance gains on one class trade off against losses on another. Always choose algorithms informed by domain knowledge.
              </div>
            </div>
          </div>
          <div className="m4-sec-hdr" style={{marginTop:'1.5rem'}}>
            <h2 className="m4-sec-title">Simulated Annealing <span className="m4-badge">Interactive</span></h2>
            <p className="m4-sec-sub">Drag the temperature slider to see how P = e^(ΔQ/t) changes, then run SA on a multimodal landscape and watch it escape local optima.</p>
          </div>
          <SAViz />
          <div className="m4-card" style={{marginTop:'1.5rem'}}>
            <div className="m4-card-h">HC Family Comparison</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.6rem',marginTop:'0.4rem'}}>
              {[
                {label:'(1+1) Hill Climbing',col:'var(--cyan)',desc:'Generate 1 tweak. Accept only if better. Simple but greedy — follows first improvement.'},
                {label:'(1+n) Steepest Ascent',col:'var(--violet)',desc:'Generate n tweaks, take best. More compute per step but more deliberate direction. Approximates gradient.'},
                {label:'(1,n) SA w/ Replacement',col:'var(--amber)',desc:'Generate n tweaks, take best, always replace S. No memory of old S — more exploratory but can lose progress.'},
                {label:'ILS: Clever Restarts',col:'var(--emerald)',desc:'Keep a "home base" H. Perturb from H → hill-climb → compare to H. "Hill climb of hill climbs." Smarter than random restarts.'},
                {label:'Tabu Search',col:'var(--rose)',desc:'FIFO tabu list of length l forbids revisiting recent solutions. Always moves to best non-tabu neighbour — eventually escapes any local optimum.'},
                {label:'SA: Annealing',col:'var(--cyan)',desc:'Accept worse solutions with P = e^(ΔQ/t). High t = exploration. t→0 = pure HC. The cooling schedule controls the transition.'},
              ].map(({label,col,desc})=>(
                <div key={label} style={{background:'var(--bg-2)',borderRadius:7,padding:'0.6rem 0.75rem',border:`1px solid ${col}33`}}>
                  <div style={{fontSize:'0.75rem',fontWeight:700,color:col,marginBottom:'0.3rem',fontFamily:'monospace'}}>{label}</div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
          </div>}
        </div>
      )}
    </div>
  );
}

// ── Practice Exam Data ────────────────────────────────────────────────────────
const PRACTICE_QUESTIONS = [
  // ── From practice-ques.md ────────────────────────────────────────────────────
  {
    id: 1,
    topic: 'Grammar & Hypothesis Space',
    source: 'Practice Exam Q1',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Define "hypothesis space" and "model (hypothesis)" in the context of an optimisation framework that uses a grammar-based language.' },
      { label: 'b', prompt: 'Nymeria\'s trading grammar generates "Buy" signals using filters (sma, lma, ema), comparators (<, =, >), and logic operators (∧, ∨). Give one valid expression in the hypothesis space and one that is NOT in it. Justify each.' },
      { label: 'c', prompt: 'Is the hypothesis space defined by this grammar finite or infinite? Justify your answer.' },
      { label: 'd', prompt: 'Write a "Golden Cross" expression in this grammar: the 10-day EMA has just crossed above the 20-day SMA at time i. Is it in the hypothesis space?' },
    ],
    solution: [
      { label: 'a', answer: 'Hypothesis space: the complete set of all valid expressions (models/programs/rules) generatable by the chosen language — i.e., all syntactically valid "Buy" signals under the grammar. A model (hypothesis): one specific instance from that space; a single trading rule that maps filter outputs to a Buy signal.' },
      { label: 'b', answer: 'In the space: sma(10, i) > sma(50, i) — buy when 10-day SMA is above 50-day SMA. Valid because it matches Comp_expr → Filter Comparator Filter with sma as Fname, 10/50 as N, i as T, and > as Comparator.\n\nNot in the space: sma(10, i) − sma(50, i) > 0. This uses arithmetic on filter outputs, which the grammar does not support. Comp_expr only allows Filter Comparator Filter, not arithmetic expressions.' },
      { label: 'c', answer: 'Infinite. N is an unbounded integer (1, 2, 3, …), so there are infinitely many possible filters like sma(1,i), sma(2,i), sma(3,i), … The grammar can also produce arbitrarily long conjunctions/disjunctions via Buy → Comp_expr Logic_op Buy.' },
      { label: 'd', answer: 'ema(10, i) > sma(20, i) ∧ ema(10, i−1) < sma(20, i−1)\n\nThis captures: currently 10-EMA is above 20-SMA (crossed above), but at i−1 it was below (just crossed). Yes, it is in the hypothesis space — both conjuncts are valid Comp_expr terms joined by ∧ (Logic_op), matching Buy → Comp_expr Logic_op Buy.' },
    ],
  },
  {
    id: 2,
    topic: 'Hill Climbing & Search',
    source: 'Practice Exam Q2',
    time: '10–12 min',
    parts: [
      { label: 'a', prompt: 'How would you evaluate the quality (fitness) of a trading rule model generated by Nymeria\'s grammar? What metric would you use?' },
      { label: 'b', prompt: 'Is Nymeria\'s search space "well-behaved"? Which of the following are applicable: gradient descent, direct methods (e.g. Nelder-Mead), stochastic single-state methods (e.g. hill climbing)? Justify each.' },
      { label: 'c', prompt: 'Write pseudocode for the basic Hill Climbing algorithm (the (1+1) variant).' },
      { label: 'd', prompt: 'List four valid "Tweak" operations for Nymeria\'s models. Do they stay within the hypothesis space?' },
      { label: 'e', prompt: 'Compare Hill Climbing and Steepest Ascent Hill Climbing. What is the computational trade-off?' },
    ],
    solution: [
      { label: 'a', answer: 'Backtest the model on historical price data and measure a fitness metric such as total return, Sharpe ratio, win rate, or profit factor. Fitness = how well the Buy signal would have performed over a historical window.' },
      { label: 'b', answer: 'The space is NOT smooth — it mixes discrete structural choices (grammar rules, comparators, filter types) and integer parameters (N values).\n\n• Gradient descent: ❌ Mostly no. Space is largely discrete/symbolic; gradients are undefined for structural choices.\n• Direct methods (e.g. Nelder-Mead): ⚠️ Partially. Could work on numeric parameters (N values) if structure is fixed, but Nelder-Mead requires a continuous vector space.\n• Stochastic single-state (hill climbing, SA): ✅ Yes. Handle discrete/combinatorial spaces naturally via grammar-aware Tweak operators.' },
      { label: 'c', answer: 'function HillClimb(evaluate, tweak, initial):\n  current ← initial\n  loop:\n    candidate ← tweak(current)\n    if evaluate(candidate) ≥ evaluate(current):\n      current ← candidate\n  until termination condition met\n  return current' },
      { label: 'd', answer: '1. Change parameter N — e.g., sma(10, i) → sma(12, i) ✅ always valid\n2. Change filter type — e.g., sma → ema ✅ always valid\n3. Change time point T — i → i−1 ✅ always valid\n4. Change comparator — < → > or = ✅ always valid\n5. Add/remove a conjunct or disjunct — ⚠️ need grammar-aware tweak to ensure valid structure\n6. Swap a sub-expression — ⚠️ same, requires care' },
      { label: 'e', answer: 'Hill Climbing (1+1): generates one tweak, accepts if improvement → fast per iteration but may take suboptimal direction.\n\nSteepest Ascent HC (1+n): generates n tweaks, picks the BEST one → more deliberate path but evaluates n candidates per step.\n\nTrade-off: Steepest Ascent uses n× more compute per step but takes a locally better direction. For Nymeria\'s large N-valued neighbourhood, this could be very expensive.' },
    ],
  },
  {
    id: 3,
    topic: 'Search Space Theory & Randomness',
    source: 'Practice Exam Q3',
    time: '6–8 min',
    parts: [
      { label: 'a', prompt: 'For each of the following search space types, state whether we can guarantee finding the global optimum and explain why: (i) finite and enumerable, (ii) infinite but enumerable, (iii) infinite and non-enumerable.' },
      { label: 'b', prompt: 'List four reasons why randomness is important in optimisation algorithms.' },
    ],
    solution: [
      { label: 'a', answer: '(i) Finite & enumerable: ✅ Yes. We can evaluate every candidate in finite time — exhaustive search guarantees finding the optimum.\n\n(ii) Infinite but enumerable: ❌ No, in general. We can list candidates in order (e.g., N = 1, 2, 3, …) but may never reach the optimum in finite time.\n\n(iii) Infinite & non-enumerable: ❌ No. We cannot even systematically list all candidates; exhaustive search is fundamentally impossible.' },
      { label: 'b', answer: '1. Escaping local optima — deterministic methods get stuck; randomness allows jumps to new regions.\n2. Exploration vs. exploitation — randomness drives exploration of unseen search space.\n3. Avoiding bias — removes systematic blind spots in search direction.\n4. Random restarts — lets hill climbing sample multiple basins of attraction.\n5. Stochastic acceptance (e.g. SA) — probabilistically accepting worse solutions prevents premature convergence.' },
    ],
  },
  // ── Lecture-derived questions ────────────────────────────────────────────────
  {
    id: 4,
    topic: 'Optimisation Framework',
    source: 'Lecture 3',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Name and briefly describe the three key ingredients of any optimisation problem.' },
      { label: 'b', prompt: 'Write the practical definition of optimisation as a mathematical formula. Distinguish between the "ideal" and "practical" definitions.' },
      { label: 'c', prompt: 'Language A is "more expressive" than language B. Formally define this, and give two examples: one from formal grammars (Chomsky hierarchy) and one from mathematical functions.' },
    ],
    solution: [
      { label: 'a', answer: '1. Language (Representation) — defines the hypothesis space; what solutions look like. If you can\'t describe it, you can\'t model it.\n2. Model (Hypothesis/Candidate Solution) — one specific instance expressible in the chosen language; an approximation/abstraction of the real world.\n3. Metric (Evaluation) — a function f : H → ℝ measuring how good a hypothesis is. Also called: error function, cost function, fitness function, objective function.' },
      { label: 'b', answer: 'Ideal: ĥ = argmin_{h∈H} f(h) — find the hypothesis in H with minimum error to the target.\n\nPractical: ĥ = argmin_{h∈H} f(h) subject to compute ≤ C_max — find as good a hypothesis as possible within a specified compute budget. In complex problems it may be too expensive or impossible to find the true minimum.' },
      { label: 'c', answer: 'A is more expressive than B if: (1) everything describable in B can also be described in A (A ⊇ B), AND (2) something can be described in A that cannot be described in B (A ⊄ B). Written: A ⊃ B.\n\nFormal grammar example: Context-free languages (Type-2) are more expressive than regular languages (Type-3). CFGs can describe a^n b^n; no regular grammar can.\n\nMathematical functions: The class of polynomial functions is more expressive than linear functions — every linear function y = ax + b is also a polynomial, but y = x² is polynomial but not linear.' },
    ],
  },
  {
    id: 5,
    topic: 'Intelligence & AI History',
    source: 'Lectures 1–2',
    time: '6–8 min',
    parts: [
      { label: 'a', prompt: 'Draw and describe Russell & Norvig\'s four-quadrant model of AI. Give one example system in each quadrant.' },
      { label: 'b', prompt: 'Compare "symbolic" and "sub-symbolic" AI. Give two examples of each. Why is this called the "religious wars" of AI?' },
      { label: 'c', prompt: 'Using the Morris et al. (2024) AGI levels table, classify: ChatGPT, AlphaGo, AlphaFold, and Grammarly. Justify each.' },
    ],
    solution: [
      { label: 'a', answer: 'Two axes: Thinking ↔ Acting (rows), Humanly ↔ Rationally (columns).\n\nTop-left (Think humanly): Cognitive modelling systems, e.g. the General Problem Solver (Newell & Simon). "The study of mental faculties through computational models."\n\nTop-right (Think rationally): Logic-based AI, e.g. Prolog theorem provers. "The study of ideal intelligent behaviour in artifacts."\n\nBottom-left (Act humanly): Systems designed to be indistinguishable from humans, e.g. a Turing Test chatbot.\n\nBottom-right (Act rationally): Rational agent systems that maximise utility, e.g. AlphaGo, self-driving cars. "AI is concerned with intelligent behaviour in artifacts." (Nilsson)' },
      { label: 'b', answer: 'Symbolic AI: uses explicit symbols, rules, and logic. Designed or learnt, more human-interpretable. Examples: expert systems, logic programming (Prolog), grammar-based NLP.\n\nSub-symbolic AI: uses weights/parameters in networks, learnt or evolved, less interpretable. Examples: neural networks (CNNs, LLMs), Bayesian networks, SVMs.\n\n"Religious wars" because advocates of each camp historically argued theirs was the "true" path to AI — a deep philosophical and technical divide that continues today.' },
      { label: 'c', answer: 'ChatGPT: Emerging AGI (Level 1, General) — roughly equal to unskilled human on a wide range of non-physical tasks.\n\nAlphaGo: Virtuoso Narrow AI (Level 4, Narrow) — beats 99th percentile of humans at Go, but only at Go.\n\nAlphaFold: Superhuman Narrow AI (Level 5, Narrow) — outperforms 100% of humans at protein structure prediction.\n\nGrammarly: Expert Narrow AI (Level 3, Narrow) — at least 90th percentile of skilled adults at spelling/grammar checking.' },
    ],
  },
  {
    id: 6,
    topic: 'Adaptation in Nature',
    source: 'Lecture 2',
    time: '5–6 min',
    parts: [
      { label: 'a', prompt: 'Describe the two axes used to classify mechanisms of adaptation in nature. Give one example per quadrant.' },
      { label: 'b', prompt: 'The course claims AI = optimisation. Explain this claim in 3–4 sentences, relating optimisation to adaptive systems.' },
    ],
    solution: [
      { label: 'a', answer: 'Axis 1 — Timespan: short term (individual lifespan) ↔ long term (species/millennia)\nAxis 2 — Scope: individual ↔ population\n\nExamples:\n• Short term, individual: learning (acquiring new skills), physical adaptation (training)\n• Short term, population: division of labour, coordinated behaviour (pilots flying in formation)\n• Long term, individual: physical changes within a lifespan from environmental pressure\n• Long term, population: evolution (genetic change across generations, e.g. antifreeze proteins in Antarctic fish); also collective social behaviour (bees, ants) that outlives individuals' },
      { label: 'b', answer: 'Optimisation is the engine of AI — the mechanism by which adaptive systems improve. Every learning algorithm, every evolutionary process, and every neural network training loop is fundamentally searching for the best hypothesis in some space. The three ingredients (language, model, metric) define this search precisely. Adaptive systems are those that use search/optimisation to respond to their environment over time.' },
    ],
  },
  {
    id: 7,
    topic: 'Calculus: Derivatives & Critical Points',
    source: 'Lecture 5',
    time: '10–12 min',
    parts: [
      { label: 'a', prompt: 'Using the limit definition, derive the derivative of f(x) = x².' },
      { label: 'b', prompt: 'Find all critical points of f(x) = x³ − 6x² + 9x + 1, and classify each as a local min, local max, or saddle point using the second derivative test.' },
      { label: 'c', prompt: 'State the chain rule. Use it to differentiate g(x) = (x⁴ − 3x)⁷.' },
      { label: 'd', prompt: 'Why are derivatives so useful for optimisation? What does f\'(c) = 0 guarantee, and what additional check is needed?' },
    ],
    solution: [
      { label: 'a', answer: 'f\'(x) = lim_{Δx→0} [f(x+Δx) − f(x)] / Δx\n= lim_{Δx→0} [(x+Δx)² − x²] / Δx\n= lim_{Δx→0} [x² + 2xΔx + (Δx)² − x²] / Δx\n= lim_{Δx→0} [2x + Δx]\n= 2x' },
      { label: 'b', answer: 'f\'(x) = 3x² − 12x + 9 = 3(x² − 4x + 3) = 3(x−1)(x−3)\nCritical points: x = 1 and x = 3.\n\nf\'\'(x) = 6x − 12\n\nAt x = 1: f\'\'(1) = 6(1) − 12 = −6 < 0 → local MAXIMUM\nAt x = 3: f\'\'(3) = 6(3) − 12 = 6 > 0 → local MINIMUM' },
      { label: 'c', answer: 'Chain rule: d/dx f(g(x)) = f\'(g(x)) · g\'(x), or equivalently dy/dx = (dy/du)(du/dx) where u = g(x).\n\nFor g(x) = (x⁴ − 3x)⁷: let u = x⁴ − 3x, y = u⁷\ndy/du = 7u⁶ = 7(x⁴ − 3x)⁶\ndu/dx = 4x³ − 3\n\ng\'(x) = 7(x⁴ − 3x)⁶ · (4x³ − 3)' },
      { label: 'd', answer: 'At critical points f\'(c) = 0 — the function is neither increasing nor decreasing; these are candidates for local extrema. However f\'(c) = 0 only guarantees a stationary point — it could be a maximum, minimum, or saddle point.\n\nAdditional check (Second Derivative Test):\n• f\'\'(c) > 0 → concave up → local minimum\n• f\'\'(c) < 0 → concave down → local maximum\n• f\'\'(c) = 0 → test inconclusive; examine f\' either side of c' },
    ],
  },
  {
    id: 8,
    topic: 'Gradient Descent & Newton-Raphson',
    source: 'Lecture 6',
    time: '10–12 min',
    parts: [
      { label: 'a', prompt: 'Write out the 1D Gradient Descent algorithm with stopping criteria. What role does α play? What happens when α is too small or too large?' },
      { label: 'b', prompt: 'Write the Newton-Raphson update rule for optimisation. Why does it automatically choose a good step size? For a quadratic f(x) = ax² + b, how many NR steps does it take? Show this.' },
      { label: 'c', prompt: 'Write the Gradient Ascent with Restarts algorithm. Under what conditions can it eventually find the global optimum?' },
      { label: 'd', prompt: 'Write the multivariate gradient descent update rule using ∇f. What is ∇f for f(x₁, x₂) = 3x₁² + x₂²?' },
    ],
    solution: [
      { label: 'a', answer: 'Algorithm: 1D Gradient Descent\n1: x ← random initial value\n2: repeat\n3:   x ← x − α f\'(x)\n4: until |f\'(x)| < ε or iteration limit reached\n5: return x\n\nRole of α (learning rate): scales the step size. The sign of f\'(x) gives direction; α scales magnitude.\n\nToo small α: slow convergence — many iterations to reach minimum.\nToo large α: overshoot — oscillates around minimum, may never converge.\n\nIdeal for quadratics: steps naturally shrink as we approach minimum (f\'(x) → 0).' },
      { label: 'b', answer: 'NR for optimisation: x_{n+1} = x_n − f\'(x_n) / f\'\'(x_n)\n\nWhy it auto-scales: divides slope by curvature. Large curvature → small step (needed near tight bends). Flat region → large step. Approximates f with a local quadratic, matching both value and curvature at x_n.\n\nFor f(x) = ax² + b:\nf\'(x) = 2ax, f\'\'(x) = 2a\nx_{n+1} = x_n − 2ax_n / 2a = x_n − x_n = 0\n\nOne step! NR finds the exact minimum of a quadratic in a single iteration.' },
      { label: 'c', answer: 'Algorithm: Gradient Ascent with Restarts\n1: 𝐱 ← random initial value; 𝐱* ← 𝐱\n2: repeat\n3:   repeat\n4:     𝐱 ← 𝐱 + α∇f(𝐱)\n5:   until ‖∇f(𝐱)‖ < ε\n6:   if f(𝐱) > f(𝐱*) then 𝐱* ← 𝐱\n7:   𝐱 ← random value\n8: until time exhausted\n9: return 𝐱*\n\nCan find global optimum eventually if: (1) search space is bounded AND (2) number of local optima is finite. No guarantees in general for infinite/non-enumerable spaces.' },
      { label: 'd', answer: 'Multivariate update: 𝐱 ← 𝐱 − α∇f(𝐱)\n\nFor f(x₁, x₂) = 3x₁² + x₂²:\n∂f/∂x₁ = 6x₁\n∂f/∂x₂ = 2x₂\n\n∇f(x₁, x₂) = [6x₁, 2x₂]ᵀ\n\nUpdate: [x₁, x₂] ← [x₁ − 6αx₁, x₂ − 2αx₂]' },
    ],
  },
  {
    id: 9,
    topic: 'Direct Methods',
    source: 'Lecture 7',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'What distinguishes "direct methods" from gradient methods? Give two situations where direct methods must be used.' },
      { label: 'b', prompt: 'Describe Cyclic Coordinate Search (CCS). What is the "diagonal valley" problem? How does the acceleration step address it?' },
      { label: 'c', prompt: 'Explain the five operations of the Nelder-Mead simplex method (Reflect, Expand, Contract outside, Contract inside, Shrink). What are the typical parameter values?' },
      { label: 'd', prompt: 'Why does Nelder-Mead "foreshadow population-based methods"? In what sense is it doing collective intelligence?' },
    ],
    solution: [
      { label: 'a', answer: 'Direct methods rely solely on evaluating the objective function f(x) — no derivatives needed.\n\nSituations requiring direct methods:\n1. Search space is non-differentiable (e.g. discrete combinatorial spaces like JSSP Gantt charts)\n2. Function is a black box — we can evaluate quality but don\'t know the mathematical form\n3. Space is discontinuous or not continuous' },
      { label: 'b', answer: 'CCS (Coordinate Descent): optimises one variable at a time while holding all others fixed — a series of 1D line searches along each basis vector eᵢ in sequence. Repeats cycles until improvement < ε.\n\nDiagonal valley problem: if the optimal direction is diagonal (e.g. 45°), CCS takes a "staircase" path requiring many iterations — it can\'t move diagonally because it\'s restricted to axis-aligned steps.\n\nAcceleration step: after a full cycle, compute the net progress vector u = x^n − x^0 and do one extra line search in that direction. This moves diagonally along the valley, much faster traversal.' },
      { label: 'c', answer: 'Let x̄ = centroid of all vertices except the worst (x_h).\n\nReflect: x_r = x̄ + α(x̄ − x_h), α=1. Mirrors x_h through the centroid.\nExpand: x_e = x̄ + β(x_r − x̄), β=2. Pushes further if reflection was very good.\nContract (outside): x_c = x̄ + γ(x̄ − x_h), γ=0.5. Pulls back slightly if reflection was mediocre.\nContract (inside): x_c = x̄ + γ(x_h − x̄), γ=0.5. When reflection was worse than x_h — try the other side.\nShrink: x_i ← x_l + σ(x_i − x_l), σ=0.5. Collapses simplex toward the best vertex.\n\nTypical values: α=1, β=2, γ=0.5, σ=0.5.' },
      { label: 'd', answer: 'Nelder-Mead maintains n+1 candidate solutions simultaneously (the simplex vertices). No single candidate drives the search — decisions are made based on the relationships between all vertices (centroid, best, worst). Each iteration, the entire group\'s information informs the next move.\n\nThis is collective intelligence: the group\'s combined knowledge determines search direction, not any individual candidate. This directly foreshadows genetic algorithms and swarm methods, which also maintain and evolve a population of candidates.' },
    ],
  },
  {
    id: 10,
    topic: 'Hill Climbing Variants & Exploration/Exploitation',
    source: 'Lecture 8',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Explain the (1+1), (1+n), and (1,n) notation for hill climbing variants. Write pseudocode for Steepest Ascent HC with Replacement (1,n).' },
      { label: 'b', prompt: 'Define the exploration vs. exploitation trade-off in optimisation. How do the following hyper-parameters each control this trade-off: (i) σ in Gaussian convolution, (ii) n in Steepest Ascent HC, (iii) step-size r in bounded uniform convolution.' },
      { label: 'c', prompt: 'Describe the Bounded Uniform Convolution tweak (Algorithm 8). What are its hyper-parameters p and r, and what does each control?' },
    ],
    solution: [
      { label: 'a', answer: '(1+1): select winner from 1 existing + 1 tweaked. Basic hill climbing.\n(1+n): select winner from 1 existing + n tweaked candidates. Steepest Ascent HC.\n(1,n): select winner from n tweaked candidates only (existing S is replaced regardless). SA HC with Replacement.\n\nAlgorithm: Steepest Ascent HC with Replacement (1,n)\n1: n ← number of tweaks; S ← init; Best ← S\n2: repeat\n3:   R ← Tweak(Copy(S))\n4:   for n−1 times:\n5:     W ← Tweak(Copy(S))\n6:     if Quality(W) > Quality(R): R ← W\n7:   S ← R  [always replace]\n8:   if Quality(S) > Quality(Best): Best ← S\n9: until ideal or time up\n10: return Best' },
      { label: 'b', answer: 'Exploration: searching broadly across the space — trying many different regions, risking missing the local optimum.\nExploitation: focusing locally — refining the current best solution, risk of being stuck in a local optimum.\n\n(i) σ in Gaussian convolution: large σ → large (but rare) jumps → more exploration. Small σ → tiny tweaks → exploitation. Direct exploration knob.\n\n(ii) n in Steepest Ascent HC: large n → evaluates more candidates → more selective pressure → suppresses extreme choices from a large σ → effectively less exploration. The interaction is subtle: depends on problem landscape.\n\n(iii) r in bounded uniform convolution: r is the half-range of uniform noise. Large r → large possible tweaks → more exploration. Small r → small tweaks → exploitation. Unlike Gaussian, no "long tail" — cannot make arbitrarily large jumps.' },
      { label: 'c', answer: 'Bounded Uniform Convolution:\nFor each element v_i with probability p:\n  sample n uniformly from [−r, r]\n  if min ≤ v_i + n ≤ max: v_i ← v_i + n\n  (repeat until within bounds)\n\np (probability): controls how many elements are tweaked each iteration. p = 1 → all elements tweaked. p = 0.5 → roughly half tweaked on average.\n\nr (half-range): controls the maximum size of each tweak. Small r → "local" search (exploitation). Large r → larger jumps possible (exploration). Key difference from Gaussian: no probability of arbitrarily large steps — bounded by r.' },
    ],
  },
  {
    id: 11,
    topic: 'Simulated Annealing',
    source: 'Lecture 9',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Explain the metallurgical analogy behind Simulated Annealing. How does this translate to the optimisation algorithm?' },
      { label: 'b', prompt: 'Write the Simulated Annealing acceptance probability formula. Analyse what happens as: (i) t → ∞, (ii) t → 0, (iii) the quality gap |Q(R) − Q(S)| increases.' },
      { label: 'c', prompt: 'Write the full SA algorithm (Algorithm 13). What is the role of the "cooling schedule"? Give an example cooling schedule.' },
    ],
    solution: [
      { label: 'a', answer: 'Metallurgical analogy: when metal is annealed, it is heated to a high temperature (atoms become mobile, can rearrange) then slowly cooled. Rapid cooling traps atoms in suboptimal configurations (hard, brittle); slow cooling allows atoms to settle into low-energy crystal structures (ideal arrangement).\n\nOptimisation translation: high temperature → system has lots of "energy" → can jump away from local optima freely (exploration). Temperature decreases over time → jumps become less likely → algorithm settles into a good solution (exploitation). The cooling rate controls how smoothly the transition from exploration to exploitation occurs.' },
      { label: 'b', answer: 'P(t, R, S) = e^{(Quality(R) − Quality(S)) / t}, for Quality(R) < Quality(S) (R is worse).\n\n(i) t → ∞: exponent → 0, so P → e^0 = 1. Almost any candidate accepted — pure random walk (maximum exploration).\n\n(ii) t → 0: exponent → −∞, so P → 0. Worse candidates almost never accepted — pure hill climb (maximum exploitation).\n\n(iii) Larger quality gap |Q(R) − Q(S)|: exponent becomes more negative → P decreases. Mildly worse solutions have higher chance of acceptance than drastically worse ones — a sensible grading of risk.' },
      { label: 'c', answer: 'Algorithm: Simulated Annealing\n1: t ← high initial temperature\n2: S ← initial candidate; Best ← S\n3: repeat\n4:   R ← Tweak(Copy(S))\n5:   if Q(R) > Q(S) or rand[0,1] < e^{(Q(R)−Q(S))/t}:\n6:     S ← R\n7:   Decrease t  [cooling step]\n8:   if Q(S) > Q(Best): Best ← S\n9: until time up or t ≤ 0\n10: return Best\n\nCooling schedule: determines how t decreases over time. Must balance exploration (high t) and exploitation (low t).\n\nExample: geometric cooling t ← β · e^{−αT} where T is elapsed time, α controls rate of decrease, β is initial temperature scale.' },
    ],
  },
  {
    id: 12,
    topic: 'Tabu Search & ILS',
    source: 'Lecture 9',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Explain the mechanism of Tabu Search. What data structure stores the tabu list? What trade-off does list length l create?' },
      { label: 'b', prompt: 'Explain Iterated Local Search (ILS). What is the "home base" H? Write out the two design functions NewHomeBase(H, S) for "hill climb of hill climbs" and "random walk of hill climbs".' },
      { label: 'c', prompt: 'Tabu Search works directly in "discrete" spaces. What modifications would you need for a continuous (real-valued) space?' },
    ],
    solution: [
      { label: 'a', answer: 'Tabu Search heuristic: "don\'t go back where you\'ve already been." Maintains a FIFO queue L (tabu list) of recently visited candidate solutions. When generating tweaks, candidates that appear in L are rejected — forced to move to new regions. This guarantees eventual escape from any local optimum.\n\nData structure: first-in, first-out (FIFO) queue of maximum length l. Oldest entries "fall off" when the list is full.\n\nTrade-off with l: large l → longer memory, less revisiting, but O(l) lookup time per candidate — expensive. Small l → faster lookup, but solutions "come back" from tabu sooner — less effective escape.' },
      { label: 'b', answer: 'ILS heuristic: "better local optima can be found near the local optimum you\'re already in." Runs hill climbing repeatedly, but instead of random restarts, perturbs the current local optimum H and restarts from near it.\n\nNewHomeBase for "hill climb of hill climbs": H ← S only if Q(S) ≥ Q(H) — always move to a better or equal home base, never downhill. Conservative, exploitative.\n\nNewHomeBase for "random walk of hill climbs": H ← S always — adopt every new local optimum as home base. Exploratory.\n\nPerturb(H): generates a new start near H. "Big enough to escape the current basin, not too big to lose all proximity." Choosing this is called a "black art" — depends heavily on the problem space.' },
      { label: 'c', answer: 'In continuous spaces, exact equality checks for tabu (is x in L?) are almost never satisfied — candidates are almost never exactly revisited.\n\nModifications:\n1. Define "sufficiently similar" (proximity threshold): reject candidate if it is within distance ε of any element in L.\n2. Tabu list of recent changes: instead of storing full candidates, store recent feature changes made to the solution. A candidate is tabu if it would undo a recent change.\n\nChallenges: defining the threshold ε is non-trivial; checking proximity can be expensive in high-dimensional spaces.' },
    ],
  },
  {
    id: 13,
    topic: 'No Free Lunch Theorem',
    source: 'Lecture 8',
    time: '5–6 min',
    parts: [
      { label: 'a', prompt: 'State the No Free Lunch (NFL) Theorem (Wolpert & Macready, 1997) in your own words.' },
      { label: 'b', prompt: 'What practical implications does the NFL theorem have for choosing an optimisation algorithm?' },
      { label: 'c', prompt: 'Describe three types of "landscape" (fitness landscape) types from the course. For each, state which algorithm strategy is best suited.' },
    ],
    solution: [
      { label: 'a', answer: '"Averaged across all possible problems, no algorithm outperforms any other."\n\nMore precisely: for any two algorithms A and B, when we sum their performance over all possible problem functions, both produce identical total performance. Any advantage algorithm A has over B on some class of problems is exactly cancelled by B\'s advantage on other problems. There is no universally best algorithm.' },
      { label: 'b', answer: '1. No "silver bullet": cannot pick one algorithm and apply it everywhere — must choose based on problem knowledge.\n2. Domain knowledge matters: the best algorithm exploits specific structure of the target problem (e.g. continuity, modality, constraints).\n3. Benchmark carefully: performance on benchmark problems does not guarantee performance on your specific problem.\n4. Justify algorithm choice: "we chose SA because the space has many local optima and we can estimate the right temperature schedule" — not just "SA is good."' },
      { label: 'c', answer: 'Unimodal landscape: single smooth peak. Best suited for: gradient descent / local hill climbing. One basin of attraction — no need for global search.\n\nNoisy/Rocky landscape: many local optima of similar height. Best suited for: simulated annealing, ILS with restarts, tabu search. Need to escape local optima frequently.\n\nDeceptive landscape: gradient points away from global optimum — easy to be lured to a bad local optimum. Best suited for: population-based methods (genetic algorithms), random restarts. Single-state methods are easily fooled.\n\n(Also: Needle in a Haystack — single narrow peak; extremely hard for any deterministic method. Random search may actually compete here.)' },
    ],
  },
  {
    id: 14,
    topic: 'Job Shop Scheduling Problem',
    source: 'Lecture 4',
    time: '10–12 min',
    parts: [
      { label: 'a', prompt: 'Formally define the Job Shop Scheduling Problem (JSSP). What are the three key ingredients in terms of Language, Model, and Metric?' },
      { label: 'b', prompt: 'Given the following 3×3 JSSP instance, calculate the makespan C_max for the schedule where operations are assigned in the order given (no preemption, satisfy all constraints):\n\nJ1: (M1,3) → (M2,3) → (M3,3)\nJ2: (M1,2) → (M3,3) → (M2,4)\nJ3: (M2,3) → (M1,2) → (M3,2)\n\nAssume the following priority ordering on each machine: M1: J1, J2, J3; M2: J1, J3, J2; M3: J2, J1, J3.' },
      { label: 'c', prompt: 'What is the size of the hypothesis space for a JSSP with n=5 jobs and m=4 machines? Why is JSSP NP-hard?' },
      { label: 'd', prompt: 'Describe the N1 neighbourhood (van Laarhoven) for local search on JSSP. Why does swapping on the critical path improve makespan?' },
    ],
    solution: [
      { label: 'a', answer: 'JSSP: n jobs, m machines. Each job has a fixed sequence of operations, each on a specific machine for a fixed duration. Machines can process one operation at a time; operations within a job must respect precedence order. Goal: assign start times to minimise makespan C_max = max_i C_i.\n\nLanguage (Representation): a permutation of operations on each machine; equivalently a Gantt chart or start-time matrix S = [s_ij]. Hypothesis space size ≤ (n!)^m.\n\nModel (Candidate Solution): one specific feasible schedule — an assignment of start times satisfying machine constraints (no overlap) and precedence constraints (operation order within each job).\n\nMetric: Makespan C_max = max_i C_i (latest completion time). Other metrics: total completion time Σ C_i, maximum lateness L_max, number of tardy jobs.' },
      { label: 'b', answer: 'Processing each job in operation order, respecting machine availability and precedence:\n\nM1 sequence: J1(t=0–3), J2(t=3–5), J3(t=5–7)\nM2 sequence: J1 starts after J1 finishes M1 at t=3, so J1 on M2(t=3–6); J3 starts after J3 finishes M1 at t=7 → M2 free from t=6, so J3(t=7–10); J2 must wait for both M2 free (t=10) and J2 to finish M3 → check below.\nM3 sequence: J2 must finish M1(t=5), so J2 on M3(t=5–8); J1 must finish M2(t=6), so J1 on M3(t=8–11); J3 must finish M2(t=10) and M3 free(t=11) → J3(t=11–13).\nJ2 on M2: J2 finished M3 at t=8, M2 free at t=10, so J2 on M2(t=10–14).\n\nC_max = max(C_J1, C_J2, C_J3) = max(11, 14, 13) = 14.' },
      { label: 'c', answer: 'Hypothesis space size: (n!)^m = (5!)^4 = 120^4 = 207,360,000 ≈ 2.07 × 10^8.\n\nNP-hardness: JSSP is NP-hard even for 2 machines and 3 jobs in some formulations. The solution space grows super-exponentially as (n!)^m. For even modest sizes (n=10, m=10: ≈3.63×10^65) exhaustive search is computationally infeasible. This motivates heuristic and metaheuristic approaches.' },
      { label: 'd', answer: 'N1 neighbourhood (van Laarhoven):\n1. Identify the critical path — the longest path from start to finish that determines C_max.\n2. A move = swap two adjacent operations on the critical path that belong to different jobs on the same machine.\nN(s) = {s\' : s\' obtained by one adjacent critical-path swap}\n\nWhy this improves makespan: the critical path is the bottleneck determining C_max. Any reduction in C_max must shorten the critical path. Swapping adjacent operations on the critical path (on the same machine) is the minimal perturbation that can reduce the longest path length — it reorders the machine processing sequence locally without disrupting other constraints.' },
    ],
  },
  {
    id: 15,
    topic: 'Dispatching Rules & JSP Heuristics',
    source: 'Lecture 4',
    time: '6–8 min',
    parts: [
      { label: 'a', prompt: 'List five dispatching rules for JSP. For each, give: the rule name, priority function (how it orders jobs), and a scenario where it is preferred.' },
      { label: 'b', prompt: 'Define the RPD (Relative Percentage Deviation) metric used to compare JSP solutions to the best known solution (BKS). Why is this metric used instead of raw makespan?' },
    ],
    solution: [
      { label: 'a', answer: '1. SPT (Shortest Processing Time): priority = p_i ascending. Best when minimising average completion time or throughput.\n\n2. LPT (Longest Processing Time): priority = p_i descending. Can reduce total weighted completion time in some settings.\n\n3. EDD (Earliest Due Date): priority = d_i ascending. Best when minimising maximum lateness or tardiness.\n\n4. FIFO (First In, First Out): priority = arrival order. Fair/simple; baseline when no other info available.\n\n5. CR (Critical Ratio): priority = (d_i − t) / p_i ascending. Balances urgency and remaining work; dynamic — recalculates as time progresses.\n\n6. MWKR (Most Work Remaining): priority = Σ remaining p_ik descending. Keeps machines busy with complex jobs.' },
      { label: 'b', answer: 'RPD = (C_max^obtained − C_max^BKS) / C_max^BKS × 100%\n\nWhere C_max^BKS is the best known makespan for that benchmark instance.\n\nWhy RPD instead of raw makespan: different benchmark instances have different natural scales of makespan (a 6×6 instance will have a much smaller makespan than a 20×20 instance). RPD normalises performance to the best known solution, allowing fair comparison across different instances and algorithms. RPD = 0% means optimal (or ties with BKS); higher RPD = worse.' },
    ],
  },
  {
    id: 16,
    topic: 'Partial Derivatives & Gradient Vector',
    source: 'Lecture 5',
    time: '8–10 min',
    parts: [
      { label: 'a', prompt: 'Define a partial derivative. Compute ∂f/∂x₁ and ∂f/∂x₂ for f(x₁, x₂) = x₁³ + 2x₁x₂ + x₂².' },
      { label: 'b', prompt: 'Write the general definition of the gradient ∇f for f : ℝⁿ → ℝ as a column vector. Compute ∇f at the point (1, 2) for f from part (a).' },
      { label: 'c', prompt: 'In the gradient ascent/descent algorithm, why does moving in the direction of +∇f maximise the function? In what direction should you move to minimise?' },
    ],
    solution: [
      { label: 'a', answer: 'Partial derivative: derivative of a multivariable function with respect to one variable, treating all other variables as constants.\n\nFor f(x₁, x₂) = x₁³ + 2x₁x₂ + x₂²:\n∂f/∂x₁ = 3x₁² + 2x₂ (differentiate w.r.t. x₁, hold x₂ constant)\n∂f/∂x₂ = 2x₁ + 2x₂ (differentiate w.r.t. x₂, hold x₁ constant)' },
      { label: 'b', answer: '∇f(x) = [∂f/∂x₁, ∂f/∂x₂, ..., ∂f/∂xₙ]ᵀ (column vector of all partial derivatives)\n\nAt (x₁, x₂) = (1, 2):\n∂f/∂x₁ = 3(1)² + 2(2) = 3 + 4 = 7\n∂f/∂x₂ = 2(1) + 2(2) = 2 + 4 = 6\n\n∇f(1,2) = [7, 6]ᵀ' },
      { label: 'c', answer: 'The gradient ∇f at any point is a vector that points in the direction of steepest ascent — the direction in which f increases most rapidly. This follows from the definition: the gradient is constructed from the partial derivatives, each measuring rate of change in one coordinate direction; the vector sum points in the overall steepest direction.\n\nTo maximise: move in direction +∇f (gradient ascent): 𝐱 ← 𝐱 + α∇f(𝐱)\nTo minimise: move in direction −∇f (gradient descent): 𝐱 ← 𝐱 − α∇f(𝐱)' },
    ],
  },
  {
    id: 17,
    topic: 'Smoothness Classes & Algorithm Applicability',
    source: 'Lectures 6–7',
    time: '6–8 min',
    parts: [
      { label: 'a', prompt: 'Define the smoothness classes C⁰, C¹, C², C∞. For each optimisation algorithm below, state the minimum smoothness class required: (i) gradient descent, (ii) Newton-Raphson, (iii) Nelder-Mead simplex, (iv) hill climbing.' },
      { label: 'b', prompt: 'A colleague proposes using gradient descent on the JSSP. Explain why this is not directly applicable, and suggest two better alternatives with justification.' },
    ],
    solution: [
      { label: 'a', answer: 'C⁰: continuous functions (no breaks/jumps)\nC¹: continuously differentiable (smooth, first derivative exists and is continuous)\nC²: twice differentiable (second derivative exists and is continuous)\nC∞: infinitely differentiable (all derivatives exist)\n\nMinimum class required:\n(i) Gradient descent: C¹ — needs f\'(x) or ∇f(x) to exist and be continuous.\n(ii) Newton-Raphson: C² — needs f\'(x) and f\'\'(x) to exist and be continuous.\n(iii) Nelder-Mead simplex: C⁰ — only evaluates f(x), no derivatives needed. Works on any evaluable function.\n(iv) Hill climbing: C⁰ (or even discontinuous) — only evaluates Quality(S), no derivative.' },
      { label: 'b', answer: 'Gradient descent is not applicable to JSSP because:\n1. JSSP solution space is discrete/combinatorial (permutations of operations) — there is no notion of a gradient in a discrete space. Derivatives are undefined.\n2. The objective function (makespan) is not continuous — small changes in operation order can cause step changes in makespan.\n\nBetter alternatives:\n1. Hill climbing with grammar-aware Tweak: e.g. swap adjacent operations on a machine. No derivative needed — only evaluates makespan. Natural fit for combinatorial spaces.\n2. Simulated Annealing: same tweak operation, but accepts worse solutions probabilistically, allowing escape from local optima. Well-established for JSSP with the N1 neighbourhood.' },
    ],
  },
  {
    id: 18,
    topic: 'Putting It All Together: Algorithm Design',
    source: 'Lectures 3–9',
    time: '12–15 min',
    parts: [
      { label: 'a', prompt: 'You are asked to optimise a robot arm controller with 12 continuous joint angles. The objective is to minimise a smooth convex energy function. Which algorithm is most appropriate? Justify using the three key ingredients and the smoothness class of the space.' },
      { label: 'b', prompt: 'Now the energy function is changed to a non-differentiable, multimodal function with many local optima. Redesign your approach. Which algorithm(s) would you choose and why?' },
      { label: 'c', prompt: 'Explain what hyper-parameters are and why they are important. Give four specific examples of hyper-parameters from different algorithms in this course, and describe the trade-off each one makes.' },
    ],
    solution: [
      { label: 'a', answer: 'Language: 12-dimensional real-valued vector (joint angles). Hypothesis space: ℝ¹² (or bounded subset). Model: one specific joint configuration [θ₁, ..., θ₁₂]. Metric: smooth convex energy function — C² (twice differentiable), single global minimum.\n\nBest algorithm: Newton-Raphson (or gradient descent). Because: (1) function is C² — second derivatives available; (2) convex → single global optimum, gradient methods guaranteed to converge; (3) N-R uses curvature to auto-scale steps → very efficient convergence. No need for stochastic methods since there is only one optimum.' },
      { label: 'b', answer: 'Problem: non-differentiable → gradient methods inapplicable. Multimodal → single-state methods may get trapped.\n\nRecommended approach:\n1. Primary: Simulated Annealing with Gaussian tweak. SA handles non-differentiable spaces (only evaluates f), and the temperature schedule allows escape from local optima. Gaussian tweak provides a natural locality heuristic.\n2. Alternative: ILS with hill climbing restarts. Each restart finds a local optimum; home-base mechanism guides restarts toward promising regions.\n3. Consider also: Nelder-Mead simplex (no derivatives, population of candidates, shape-changing exploration) — effective if function is at least evaluable.\n\nAlgorithm choice informed by: non-differentiable → no gradient methods; multimodal → need exploration mechanism (SA temperature or restarts); continuous space → tabu search less natural.' },
      { label: 'c', answer: 'Hyper-parameters: parameters that operate "above" or "outside" the model — they control the algorithm\'s behaviour, not the solution being optimised.\n\nFour examples:\n\n1. α (learning rate) in gradient descent: x ← x − α f\'(x). Trade-off: small α → slow convergence (safe but slow); large α → fast but risks overshoot/oscillation. Must be tuned to the problem\'s curvature.\n\n2. σ (standard deviation) in Gaussian convolution: n ~ N(0,σ²). Trade-off: large σ → more exploration (can jump to better peaks); small σ → exploitation (converges locally). Direct "exploration knob."\n\n3. n (sample count) in Steepest Ascent HC: evaluates n tweaks per step. Trade-off: large n → better estimate of steepest direction (like gradient) but n× more evaluations per step. A computational budget trade-off.\n\n4. t (temperature) in Simulated Annealing and its cooling rate α. Trade-off: high t → exploration (accepts worse solutions freely); low t → exploitation. Cooling rate controls how quickly this shifts — too fast → gets stuck; too slow → wastes compute on exploration.' },
    ],
  },
];

// ── All Possible Questions ────────────────────────────────────────────────────
const EXAM_ATLAS = [
  {
    lec: 'L1–2', title: 'Intelligence & Adaptation', color: 'var(--cyan)',
    know: [
      'Four quadrants of AI (Russell & Norvig): Think/Act × Humanly/Rationally — give one example per quadrant',
      'Turing Test: definition, modern relevance (LLMs), limitations ("internal consistency" argument)',
      'Symbolic vs sub-symbolic AI — 2 examples each; why called "religious wars"',
      'Morris et al. AGI levels (0–5): classify ChatGPT, AlphaGo, AlphaFold, Grammarly',
      'Why the real world needs adaptive AI — traditional AI requirements vs real-world messiness',
      'Nature\'s adaptation: short/long term × individual/population — 1 example each quadrant',
      'Computational intelligence taxonomy: neural nets, evolutionary, swarm, fuzzy logic',
    ],
    qs: ['Define and classify AI systems into the four-quadrant model', 'Compare symbolic and sub-symbolic AI', 'Classify given systems in the AGI table', 'Explain AI = optimisation claim'],
    formula: null,
  },
  {
    lec: 'L3', title: 'Optimisation Framework', color: 'var(--violet)',
    know: [
      'Three ingredients: Language (representation), Model (hypothesis), Metric (evaluation/fitness/cost/loss)',
      'Ideal definition: ĥ = argmin_{h∈H} f(h)',
      'Practical definition: add compute constraint ≤ C_max',
      'Expressiveness: A ⊃ B means A is more expressive — Chomsky hierarchy example + function example',
      'Hypothesis space H: all valid models in the chosen language',
      'MSE formula and why it creates a "bowl" (convex) — guaranteed global minimum',
      'Online vs offline: online = immediate placement, offline = all data known upfront (e.g. FFD)',
      'argmin vs argmax: argmin returns the h, not the value f(h)',
    ],
    qs: ['Name and describe the three ingredients', 'Write the ideal and practical optimisation definitions', 'Define expressiveness and give examples from Chomsky hierarchy and functions', 'Derive MSE and explain its properties'],
    formula: '\\hat{h} = \\underset{h \\in H}{\\arg\\min}\\, f(h)',
  },
  {
    lec: 'L4', title: 'Job Shop Scheduling (JSSP)', color: 'var(--rose)',
    know: [
      'JSSP: n jobs, m machines, fixed operation order per job, minimise makespan C_max',
      'Solution space: |H| ≤ (n!)^m — calculate for given n, m',
      'Dispatching rules: SPT, LPT, EDD, FIFO, CR, MWKR — criterion + use case for each',
      'Disjunctive graph G = (V, C ∪ D): C = conjunctive (job precedence), D = disjunctive (machine competition)',
      'C_max = longest path from s to t in G',
      'N1 neighbourhood: swap adjacent operations on the critical path on the same machine',
      'RPD = (C_obtained − C_BKS) / C_BKS × 100% — why used instead of raw makespan',
      'Benchmark instances: FT06, FT10 (unsolved 26 years), FT20, LA, ORB, TA series',
      'Exact (B&B) vs approximate (metaheuristics): exact only feasible for small instances',
    ],
    qs: ['Define JSSP and compute solution space size for given n, m', 'List dispatching rules with criteria', 'Explain the disjunctive graph model', 'Define RPD and explain why it\'s used', 'Describe N1 neighbourhood and why only critical-path swaps matter'],
    formula: 'C_{\\max} = \\max_i C_i \\quad |H| \\leq (n!)^m',
  },
  {
    lec: 'L5', title: 'Vector Calculus', color: 'var(--emerald)',
    know: [
      'Limit definition of derivative: f\'(x) = lim_{Δx→0} [f(x+Δx)−f(x)]/Δx — apply to f(x)=x²',
      'Derivative rules: power, constant multiple, sum, product, chain',
      'Second derivative test: f\'\'(c)>0 → local min, f\'\'(c)<0 → local max, f\'\'(c)=0 → inconclusive',
      'Partial derivative: differentiate w.r.t. one variable, hold others constant',
      'Gradient ∇f = [∂f/∂x₁, ..., ∂f/∂xₙ]ᵀ — direction of steepest ascent',
      'Gradient convergence: ‖∇f‖ < ε → stationary point',
      'Dot product: v·w = Σvᵢwᵢ = |v||w|cos(θ) — measures similarity/alignment',
      'Outer product: v⊗w = vwᵀ — produces matrix, rank-1',
      'Hadamard product: v⊙w — element-wise, same shape, no sum',
      'Euclidean norm: ‖v‖ = √(Σvᵢ²)',
    ],
    qs: ['Derive derivative from limit definition', 'Find and classify critical points of a given polynomial', 'Apply chain rule', 'Compute gradient of a given multivariate function', 'Explain gradient direction for ascent vs descent'],
    formula: '\\nabla f(\\vec{x}) = \\begin{bmatrix}\\partial f/\\partial x_1\\\\ \\vdots\\\\ \\partial f/\\partial x_n\\end{bmatrix}',
  },
  {
    lec: 'L6', title: 'Gradient Methods', color: 'var(--amber)',
    know: [
      'Gradient descent update: x ← x − α f\'(x); ascent: x ← x + α f\'(x)',
      'α (learning rate): too small → slow convergence; too large → overshoot/oscillate',
      'Convergence criterion: |f\'(x)| < ε',
      'Newton-Raphson (optimisation): x_{n+1} = x_n − f\'(x_n)/f\'\'(x_n)',
      'N-R auto-scales step: large curvature → small step; flat region → large step',
      'N-R solves quadratics in ONE step — show this for f(x) = ax²+b',
      'N-R requires C² smoothness; gradient descent requires C¹',
      'Gradient ascent with restarts: guarantees global optimum only for bounded space + finite optima',
      'Smoothness classes: C⁰ (continuous), C¹ (differentiable), C² (twice differentiable), C∞',
    ],
    qs: ['Write gradient descent with stopping criteria; analyse role of α', 'Derive N-R update; show it solves a quadratic in one step', 'Write gradient ascent with restarts; state conditions for global optimum guarantee', 'Write multivariate gradient update using ∇f; compute ∇f for a given function'],
    formula: 'x_{n+1} = x_n - \\frac{f\'(x_n)}{f\'\'(x_n)}',
  },
  {
    lec: 'L7', title: 'Direct Methods', color: 'var(--violet)',
    know: [
      'When to use direct methods: non-differentiable, black-box, discontinuous spaces',
      'CCS: optimise one variable at a time; staircase problem in diagonal valleys',
      'CCS acceleration step: u = x^n − x^0; extra line search in diagonal direction',
      'Powell\'s method: replaces oldest direction with net displacement; risk of linear dependence',
      'Hooke-Jeeves: sample f(x±αeᵢ) in all 2n directions; shrink α if no improvement',
      'Nelder-Mead: maintain n+1 vertices (simplex); Reflect, Expand, Contract, Shrink',
      'NM parameters: α=1, β=2, γ=0.5, σ=0.5; convergence when variance of f values < ε',
      'NM "foreshadows populations" — group\'s combined state drives search, not one candidate',
    ],
    qs: ['Distinguish direct from gradient methods; give 2 situations requiring direct methods', 'Describe CCS and the diagonal valley problem; explain acceleration step', 'Explain all 5 NM operations with formulas and when each triggers', 'Why does NM "foreshadow population-based methods"?'],
    formula: '\\vec{x}_r = \\bar{x} + \\alpha(\\bar{x} - \\vec{x}_W)',
  },
  {
    lec: 'L8', title: 'Stochastic Methods & PRNGs', color: 'var(--rose)',
    know: [
      'HC (1+1): Tweak(Copy(S)), accept if better',
      'Nomenclature: (1+n) steepest ascent, (1,n) SA with replacement',
      'Gaussian tweak: n~N(0,σ²); σ = exploration knob; allows arbitrarily large (rare) jumps',
      'Bounded uniform convolution: parameters p (which elements to tweak) and r (max tweak size)',
      'Exploration vs exploitation trade-off — how α, σ, n, r each control it',
      'LCG: X_{n+1} = (aXₙ + c) mod m',
      'Hull-Dobell full-period theorem: period = m iff gcd(c,m)=1, (a−1) divisible by all prime factors of m',
      'Mersenne primes: m = 2^n − 1; why ideal (few factors → long period)',
      'No Free Lunch Theorem: no algorithm universally outperforms all others; choose based on domain knowledge',
      'Bin packing: NF O(n), FF/BF O(n²), FFD O(n log n); FF/NF/BF are online, FFD is offline',
    ],
    qs: ['Write HC pseudocode; explain (1+1), (1+n), (1,n) notation', 'Describe Gaussian vs bounded uniform tweak; how does σ vs r control exploration?', 'State No Free Lunch theorem and its implications', 'Apply LCG formula; check full-period conditions'],
    formula: 'X_{n+1} = (a \\cdot X_n + c) \\bmod m',
  },
  {
    lec: 'L9', title: 'Global Optimisation: SA, Tabu, ILS', color: 'var(--cyan)',
    know: [
      'SA acceptance: P = e^((Q(R)−Q(S))/t) — derive what happens at t→∞, t→0, large gap',
      'Cooling schedule: t = β·e^{-αT}; controls exploration→exploitation transition',
      'SA pseudocode (Algorithm 13): maintain Best separately from current S',
      'Tabu search: FIFO list length l; forbids revisiting — always escapes local optima',
      'Tabu trade-off: large l = better memory but slower lookup; small l = may revisit',
      'ILS: home base H + Perturb(H) + NewHomeBase(H,S)',
      'NewHomeBase: adopt S if Q(S)≥Q(H), otherwise stay at H ("hill climb of hill climbs")',
      'Random walk of hill climbs: always adopt S regardless of quality (wider exploration)',
    ],
    qs: ['Write and analyse SA acceptance probability at extreme temperatures and large gap', 'Write full SA algorithm; what is the role of the cooling schedule?', 'Explain Tabu search mechanism; what trade-off does list length create?', 'Explain ILS; write NewHomeBase for hill climb vs random walk variants'],
    formula: 'P = e^{\\,(Q(R)-Q(S))\\,/\\,t}',
  },
];

function AllPossibleQuestions() {
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState('');

  const filtered = EXAM_ATLAS.filter(t =>
    !filter || t.title.toLowerCase().includes(filter.toLowerCase()) ||
    t.know.some(k=>k.toLowerCase().includes(filter.toLowerCase())) ||
    t.qs.some(q=>q.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div>
      <div className="m4-infobox" style={{marginBottom:'1rem'}}>
        <strong>Exam Topic Atlas</strong> — every topic that could appear on a test, organised by lecture. Click any card for full "Know how to" breakdown and typical question patterns.
      </div>
      <div style={{marginBottom:'1rem'}}>
        <input
          type="text"
          placeholder="Search topics, formulas, or keywords…"
          value={filter}
          onChange={e=>setFilter(e.target.value)}
          style={{
            width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)',
            color:'var(--text-0)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem',
            fontSize:'0.85rem', fontFamily:'inherit', outline:'none',
          }}
        />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'0.85rem'}}>
        {filtered.map(t=>{
          const isOpen = active===t.lec;
          return (
            <div key={t.lec}
              style={{
                background:'var(--bg-1)',borderRadius:10,border:`1px solid ${t.color}44`,
                cursor:'pointer',transition:'border-color 0.15s',
                borderColor: isOpen ? t.color : `${t.color}44`,
              }}
              onClick={()=>setActive(isOpen?null:t.lec)}
            >
              <div style={{padding:'0.75rem 1rem',borderBottom:isOpen?`1px solid ${t.color}33`:'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.3rem'}}>
                  <span style={{fontSize:'0.68rem',fontWeight:700,fontFamily:'monospace',color:t.color,
                    background:`${t.color}18`,border:`1px solid ${t.color}33`,borderRadius:4,padding:'0.1rem 0.4rem'}}>
                    {t.lec}
                  </span>
                  <span style={{fontSize:'0.72rem',color:'rgba(148,163,184,0.4)'}}>{isOpen?'▲':'▼'}</span>
                </div>
                <div style={{fontSize:'0.92rem',fontWeight:700,color:'var(--text-0)',marginBottom:'0.25rem'}}>{t.title}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text-2)'}}>{t.know.length} key points · {t.qs.length} question types</div>
              </div>

              {isOpen && (
                <div style={{padding:'0.75rem 1rem'}}>
                  {t.formula && (
                    <div style={{marginBottom:'0.6rem',textAlign:'center'}}>
                      <Tex src={t.formula} block />
                    </div>
                  )}
                  <div style={{fontSize:'0.72rem',fontWeight:700,color:t.color,letterSpacing:'0.07em',marginBottom:'0.4rem'}}>KNOW HOW TO / DEFINE:</div>
                  <ul style={{margin:0,padding:'0 0 0 1rem',display:'grid',gap:'0.3rem'}}>
                    {t.know.map((k,i)=>(
                      <li key={i} style={{fontSize:'0.78rem',color:'var(--text-2)',lineHeight:1.55}}>{k}</li>
                    ))}
                  </ul>
                  <div style={{height:'1px',background:'var(--border)',margin:'0.65rem 0'}}/>
                  <div style={{fontSize:'0.72rem',fontWeight:700,color:'rgba(148,163,184,0.5)',letterSpacing:'0.07em',marginBottom:'0.4rem'}}>TYPICAL QUESTION PATTERNS:</div>
                  {t.qs.map((q,i)=>(
                    <div key={i} style={{
                      display:'flex',gap:'0.5rem',alignItems:'flex-start',marginBottom:'0.3rem',
                      fontSize:'0.77rem',color:'var(--text-1)',
                    }}>
                      <span style={{color:t.color,fontWeight:700,fontFamily:'monospace',marginTop:1}}>Q{i+1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length===0 && (
        <div style={{textAlign:'center',color:'var(--text-2)',padding:'2rem',fontSize:'0.85rem'}}>
          No topics match "{filter}"
        </div>
      )}
    </div>
  );
}

// ── Practice Exam Tab ─────────────────────────────────────────────────────────
function PracticeExamTab() {
  const [open, setOpen] = useState({});
  const toggleSolution = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const [subTab, setSubTab] = useState('questions');

  return (
    <div>
      <div className="m4-algo-tabs" style={{marginBottom:'1.25rem'}}>
        {[['questions','Practice Questions'],['atlas','All Possible Questions']].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${subTab===v?'m4-algo-tab--on':''}`} onClick={()=>setSubTab(v)}>{l}</button>
        ))}
      </div>

      {subTab === 'atlas' && <AllPossibleQuestions />}

      {subTab === 'questions' && <>
      <div className="m4-infobox" style={{ marginBottom: '1.5rem' }}>
        <strong>How to use:</strong> Read each question and write your answer on paper or in a text editor — then click <strong>Show Solution</strong> to compare. Estimated times are per question; total ≈ 2.5–3 hrs for all 18 questions (full exam simulation).
      </div>

      {PRACTICE_QUESTIONS.map((q) => (
        <div key={q.id} className="m4-card" style={{ marginBottom: '1.25rem', borderLeft: '3px solid var(--cyan)' }}>
          {/* Question header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <span className="m4-badge" style={{ marginRight: '0.5rem', background: 'rgba(34,211,238,0.12)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.3)' }}>
                Q{q.id}
              </span>
              <span className="m4-card-h" style={{ display: 'inline', fontSize: '1rem' }}>{q.topic}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--violet)',
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '0.3rem',
                padding: '0.1rem 0.45rem',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}>{q.source}</span>
              <span className="m4-badge" style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.72rem' }}>
                {'\u23f1'} {q.time}
              </span>
            </div>
          </div>

          {/* Question parts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {q.parts.map((part) => (
              <div key={part.label} style={{ background: 'rgba(15,23,42,0.45)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                <span style={{ color: 'var(--cyan)', fontWeight: 700, marginRight: '0.5rem', fontFamily: 'monospace' }}>({part.label})</span>
                <span style={{ color: 'var(--text-1)', fontSize: '0.88rem', lineHeight: 1.6 }}>{part.prompt}</span>
              </div>
            ))}
          </div>

          {/* Solution toggle */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => toggleSolution(q.id)}
              style={{
                background: open[q.id] ? 'rgba(34,211,238,0.15)' : 'rgba(34,211,238,0.07)',
                border: '1px solid rgba(34,211,238,0.3)',
                color: 'var(--cyan)',
                borderRadius: '0.4rem',
                padding: '0.4rem 1rem',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              {open[q.id] ? '\u25b2 Hide Solution' : '\u25bc Show Solution'}
            </button>

            {open[q.id] && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {q.solution.map((sol) => (
                  <div key={sol.label} style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--emerald)', fontWeight: 700, fontFamily: 'monospace', marginRight: '0.5rem' }}>({sol.label})</span>
                      <span style={{ color: 'var(--emerald)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solution</span>
                    </div>
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.82rem',
                      color: 'var(--text-1)',
                      fontFamily: 'inherit',
                      lineHeight: 1.65,
                    }}>
                      {sol.answer}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      </>}
    </div>
  );
}

// ── Group Project Tab ─────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-19');
const D1_DATE = new Date('2026-04-24');
const D2_DATE = new Date('2026-05-24');
const PROJECT_START = new Date('2026-03-01');

function daysUntil(date) {
  return Math.ceil((date - TODAY) / 86400000);
}
function timelinePercent(date) {
  const total = D2_DATE - PROJECT_START;
  return Math.min(100, Math.max(0, ((date - PROJECT_START) / total) * 100));
}

const TASK_KEY = 'cits4404_project_tasks';
const DEFAULT_TASKS = [
  { id:1, part:1, label:'Choose algorithm for synopsis', done:false },
  { id:2, part:1, label:'Read & annotate algorithm paper', done:false },
  { id:3, part:1, label:'Write synopsis — Q1: What problem does this solve?', done:false },
  { id:4, part:1, label:'Write synopsis — Q2: Why did previous approaches fail?', done:false },
  { id:5, part:1, label:'Write synopsis — Q3: What is the novel idea?', done:false },
  { id:6, part:1, label:'Write synopsis — Q4: How is it demonstrated?', done:false },
  { id:7, part:1, label:'Write synopsis — Q5: What are the results?', done:false },
  { id:8, part:1, label:'Write synopsis — Q6: Your personal assessment', done:false },
  { id:9, part:1, label:'Team comparative conclusion drafted (1–2 pages)', done:false },
  { id:10, part:1, label:'Deliverable 1 submitted by Fri 24 Apr 11:59pm', done:false },
  { id:11, part:2, label:'Download BTC/USDT OHLCV dataset (Kaggle)', done:false },
  { id:12, part:2, label:'Implement pad() and wma() convolution framework', done:false },
  { id:13, part:2, label:'Implement sma_filter, lma_filter, ema_filter', done:false },
  { id:14, part:2, label:'Implement crossover signal & sign-change detection', done:false },
  { id:15, part:2, label:'Implement back-tester (fitness = final cash balance)', done:false },
  { id:16, part:2, label:'Implement chosen nature-inspired algorithm(s)', done:false },
  { id:17, part:2, label:'Run optimisation on training data (pre-2020)', done:false },
  { id:18, part:2, label:'Evaluate on held-out test set (2020 onwards)', done:false },
  { id:19, part:2, label:'Compare algorithms — vary population size, report findings', done:false },
  { id:20, part:2, label:'Record & edit video presentation (≤25 min)', done:false },
  { id:21, part:2, label:'Write report (≤3,000 words, PDF, IEEE refs)', done:false },
  { id:22, part:2, label:'Clean Jupyter notebook + README with run instructions', done:false },
  { id:23, part:2, label:'Deliverable 2 submitted by Sun 24 May 11:59pm', done:false },
];

const GP_VIEWS = ['Tracker', 'Part 1 — Synopses', 'Bot Signals', 'Optimisation & Eval', 'Deliverables', 'Course Links'];

function GroupProjectTab({ setTab }) {
  const [view, setView] = useState('Tracker');
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(TASK_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch { return DEFAULT_TASKS; }
  });

  function toggleTask(id) {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      localStorage.setItem(TASK_KEY, JSON.stringify(next));
      return next;
    });
  }

  const p1Tasks = tasks.filter(t => t.part === 1);
  const p2Tasks = tasks.filter(t => t.part === 2);
  const d1Days = daysUntil(D1_DATE);
  const d2Days = daysUntil(D2_DATE);
  const nowPct = timelinePercent(TODAY);
  const d1Pct  = timelinePercent(D1_DATE);
  const d2Pct  = timelinePercent(D2_DATE);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

      {/* ── Sub-nav ── */}
      <div className="m4-labtabs">
        {GP_VIEWS.map(v => (
          <button key={v} className={`m4-labtab ${view===v?'m4-labtab--on':''}`} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      {/* ════════════════ TRACKER ════════════════ */}
      {view === 'Tracker' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

          {/* Timeline */}
          <div className="m4-card" style={{padding:'1.5rem'}}>
            <div className="m4-card-h" style={{marginBottom:'1.25rem'}}>Project Timeline</div>
            <div style={{position:'relative',height:'60px',marginBottom:'0.5rem'}}>
              <div style={{position:'absolute',top:'30px',left:'0',right:'0',height:'4px',background:'rgba(255,255,255,0.08)',borderRadius:'2px'}} />
              <div style={{position:'absolute',top:'30px',left:'0',width:`${nowPct}%`,height:'4px',background:'linear-gradient(90deg,var(--violet),var(--cyan))',borderRadius:'2px'}} />
              {/* Today */}
              <div style={{position:'absolute',left:`${nowPct}%`,top:'18px',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:'12px',height:'12px',borderRadius:'50%',background:'var(--cyan)',boxShadow:'0 0 10px var(--cyan)',border:'2px solid var(--bg)'}} />
                <div style={{fontSize:'0.62rem',color:'var(--cyan)',marginTop:'4px',whiteSpace:'nowrap',fontWeight:700}}>Today</div>
              </div>
              {/* D1 */}
              <div style={{position:'absolute',left:`${d1Pct}%`,top:'8px',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{fontSize:'0.6rem',color:d1Days<=3?'var(--rose)':'var(--amber)',whiteSpace:'nowrap',marginBottom:'2px',fontWeight:700}}>
                  {d1Days > 0 ? `${d1Days}d` : d1Days === 0 ? 'TODAY' : 'LATE'}
                </div>
                <div style={{width:'13px',height:'13px',borderRadius:'3px',background:d1Days<=3?'var(--rose)':'var(--amber)',border:'2px solid var(--bg)',transform:'rotate(45deg)'}} />
                <div style={{fontSize:'0.58rem',color:'var(--fg-dim)',marginTop:'5px',whiteSpace:'nowrap'}}>D1 Apr 24</div>
              </div>
              {/* D2 */}
              <div style={{position:'absolute',left:`${d2Pct}%`,top:'8px',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{fontSize:'0.6rem',color:'var(--violet)',whiteSpace:'nowrap',marginBottom:'2px',fontWeight:700}}>{d2Days}d</div>
                <div style={{width:'13px',height:'13px',borderRadius:'3px',background:'var(--violet)',border:'2px solid var(--bg)',transform:'rotate(45deg)'}} />
                <div style={{fontSize:'0.58rem',color:'var(--fg-dim)',marginTop:'5px',whiteSpace:'nowrap'}}>D2 May 24</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginTop:'1rem'}}>
              {[
                { label:'Deliverable 1 — Synopses', date:'Fri 24 Apr, 11:59pm AWST', days:d1Days, color:d1Days<=3?'var(--rose)':d1Days<=7?'var(--amber)':'var(--emerald)', detail:'1–1.5 page synopsis per member + 1–2 page comparative conclusion' },
                { label:'Deliverable 2 — Full Project', date:'Sun 24 May, 11:59pm AWST', days:d2Days, color:d2Days<=7?'var(--amber)':'var(--violet)', detail:'Video (≤25 min) + Report (≤3,000 words) + Jupyter notebook' },
              ].map(d => (
                <div key={d.label} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${d.color}44`,borderRadius:'8px',padding:'1rem'}}>
                  <div style={{fontSize:'0.68rem',color:d.color,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.35rem'}}>{d.label}</div>
                  <div style={{fontSize:'1.7rem',fontWeight:800,color:d.color,lineHeight:1}}>{d.days > 0 ? d.days : '!!'} <span style={{fontSize:'0.72rem',fontWeight:500,color:'var(--fg-dim)'}}>days</span></div>
                  <div style={{fontSize:'0.68rem',color:'var(--fg-dim)',marginTop:'0.4rem'}}>{d.date}</div>
                  <div style={{fontSize:'0.66rem',color:'var(--fg-dim)',marginTop:'0.35rem',lineHeight:1.4}}>{d.detail}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:'0.75rem',fontSize:'0.66rem',color:'rgba(255,255,255,0.25)'}}>
              Late penalty: 5% per day after 48-hour grace period. Not accepted after 7 days.
            </div>
          </div>

          {/* Checklists */}
          <div className="m4-two-col">
            {[
              { label:'Part 1 — Literature Review', color:'var(--amber)', tasks:p1Tasks, note:'One synopsis per team member. Answer 6 structured questions. Comparative conclusion.' },
              { label:'Part 2 — AI Trading Bot', color:'var(--violet)', tasks:p2Tasks, note:'Build & back-test a WMA crossover bot. Optimise with nature-inspired algorithm(s).' },
            ].map(sec => {
              const done = sec.tasks.filter(t => t.done).length;
              const total = sec.tasks.length;
              return (
                <div key={sec.label} className="m4-card" style={{padding:'1.25rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.75rem'}}>
                    <div className="m4-card-h" style={{color:sec.color,margin:0}}>{sec.label}</div>
                    <span className="m4-badge" style={{background:`${sec.color}22`,color:sec.color,border:`1px solid ${sec.color}44`,flexShrink:0}}>{done}/{total}</span>
                  </div>
                  <div style={{height:'3px',background:'rgba(255,255,255,0.08)',borderRadius:'2px',marginBottom:'0.85rem'}}>
                    <div style={{height:'3px',width:`${(done/total)*100}%`,background:sec.color,borderRadius:'2px',transition:'width 0.3s'}} />
                  </div>
                  <p style={{fontSize:'0.71rem',color:'var(--fg-dim)',marginBottom:'0.85rem',lineHeight:1.5}}>{sec.note}</p>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                    {sec.tasks.map(t => (
                      <label key={t.id} style={{display:'flex',alignItems:'center',gap:'0.55rem',cursor:'pointer',padding:'0.35rem 0.45rem',borderRadius:'5px',background:t.done?'rgba(52,211,153,0.06)':'transparent',transition:'background 0.15s'}}>
                        <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)}
                          style={{accentColor:sec.color,width:'14px',height:'14px',flexShrink:0,cursor:'pointer'}} />
                        <span style={{fontSize:'0.76rem',color:t.done?'var(--fg-dim)':'var(--fg)',textDecoration:t.done?'line-through':'none',transition:'all 0.15s',lineHeight:1.4}}>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════ PART 1 — SYNOPSES ════════════════ */}
      {view === 'Part 1 — Synopses' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
          <div className="m4-infobox">
            <strong>Goal:</strong> Each team member writes a <strong>1–1.5 page synopsis</strong> covering a different population-based nature-inspired optimisation algorithm (not ML/neural networks). Then the team writes a <strong>1–2 page comparative conclusion</strong>.
            Source: Tzanetos et al. Mendeley Data repository (~300 algorithms as of Jan 2021).
          </div>

          {/* Algorithm constraints */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'1rem'}}>Algorithm Selection Constraints</div>
            <div className="m4-two-col">
              <div>
                <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--emerald)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.6rem'}}>Must Be</div>
                <ul className="m4-bullets">
                  <li><strong>Optimisation algorithm</strong> — not a learning/classification algorithm</li>
                  <li><strong>Population-based</strong> — maintains a collection of candidate solutions simultaneously (not a single-state method)</li>
                  <li><strong>Nature-inspired</strong> — draws metaphor from biology, physics, or natural systems</li>
                  <li>From the Tzanetos et al. Mendeley Data repository</li>
                </ul>
              </div>
              <div>
                <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--rose)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.6rem'}}>Must Not Be</div>
                <ul className="m4-bullets">
                  <li>Neural networks or deep learning</li>
                  <li>Any form of ML model (SVM, decision tree, etc.)</li>
                  <li>Single-state methods (hill climbing, SA alone — these can appear as a <em>baseline</em> in Part 2 only)</li>
                </ul>
                <div className="m4-warnbox" style={{marginTop:'0.75rem'}}>
                  When comparing single-state vs population-based in Part 2, fix the <strong>number of evaluations</strong> (not generations) as the budget.
                </div>
              </div>
            </div>
          </div>

          {/* 6 questions */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'1rem'}}>The 6 Synopsis Questions — Answer All of These</div>
            <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              {[
                { q:'Q1', col:'var(--cyan)', title:'What problem with existing algorithms does this new algorithm solve?',
                  hint:'Identify the specific gap or limitation in the prior art that motivated this new algorithm. Be precise — "existing algorithms are slow" is not enough; name the specific failure mode.' },
                { q:'Q2', col:'var(--violet)', title:'Why have previous approaches failed — what deficiency motivated this work?',
                  hint:'Dig deeper than Q1. What is the underlying theoretical or practical reason the old approaches fall short? Is it premature convergence, poor diversity, high parameter sensitivity, scalability?' },
                { q:'Q3', col:'var(--emerald)', title:'What is the novel idea presented in the paper?',
                  hint:'Describe the core mechanism. What is the metaphor? How does it explore the search space differently? Be specific about the operators (e.g., "uses a levy-flight step instead of Gaussian perturbation").' },
                { q:'Q4', col:'var(--amber)', title:'How is the approach demonstrated — implementation, proof, user studies?',
                  hint:'What benchmark functions or problems were used? Was it tested on CEC benchmark suites, engineering problems, real datasets? Was there a theoretical proof of convergence?' },
                { q:'Q5', col:'var(--rose)', title:'What are the results, and how are they validated/benchmarked?',
                  hint:'Report the key quantitative findings. What comparison algorithms were used? Were results statistically significant? Does the paper use standard benchmarks (e.g., 100-Digit Challenge)?' },
                { q:'Q6', col:'var(--cyan)', title:'What is your assessment — are the conclusions justified? Would you choose this algorithm?',
                  hint:'This is your opinion. Is the paper well-structured? Are the claims supported by evidence? Are there obvious weaknesses or biases in the evaluation? Would you use this for the trading bot — why or why not?' },
              ].map(({q,col,title,hint}) => (
                <div key={q} style={{background:'rgba(255,255,255,0.02)',border:`1px solid rgba(255,255,255,0.07)`,borderLeft:`3px solid ${col}`,borderRadius:'0 6px 6px 0',padding:'0.85rem 1rem'}}>
                  <div style={{display:'flex',gap:'0.75rem',alignItems:'flex-start',marginBottom:'0.4rem'}}>
                    <span style={{flexShrink:0,fontSize:'0.7rem',fontWeight:800,color:col,background:`${col}22`,border:`1px solid ${col}44`,borderRadius:'4px',padding:'0.15rem 0.45rem'}}>{q}</span>
                    <span style={{fontSize:'0.82rem',color:'var(--fg)',fontWeight:600,lineHeight:1.4}}>{title}</span>
                  </div>
                  <div style={{fontSize:'0.75rem',color:'var(--fg-dim)',lineHeight:1.55,paddingLeft:'2.2rem'}}>{hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparative conclusion */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'1rem'}}>Comparative Conclusion (1–2 pages — team effort)</div>
            <ul className="m4-bullets">
              <li>Which algorithms were chosen by each team member, and why those specifically?</li>
              <li>Are they variants on a theme (same Category in the taxonomy) or from very different categories?</li>
              <li>Is there a relevant chronology — did one algorithm inspire the next?</li>
              <li>Is there a meaningful taxonomy — swarm intelligence vs evolutionary vs physics-inspired?</li>
              <li>Diagrams are <strong>encouraged</strong> — a taxonomy tree or timeline is ideal here.</li>
            </ul>
            <div className="m4-infobox" style={{marginTop:'0.75rem'}}>
              Think of this as the "meta-analysis" of all your synopses. A reader who has read all four synopses separately should read the conclusion and understand how the algorithms relate to each other and to the field.
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ BOT SIGNALS ════════════════ */}
      {view === 'Bot Signals' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
          <div className="m4-infobox">
            All bots are built from <strong>Weighted Moving Average (WMA) filter units</strong> applied via convolution to a price time-series. Technical Analysis (TA) uses price/volume history — not fundamentals — to predict direction.
          </div>

          {/* OHLCV */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>OHLCV Data — What Each Candle Contains</div>
            <div style={{overflowX:'auto'}}>
              <table className="m4-ptable" style={{width:'100%'}}>
                <thead><tr><th>Field</th><th>Meaning</th><th>Notes</th></tr></thead>
                <tbody>
                  {[
                    ['O','Open price','Price at start of the time period'],
                    ['H','High price','Intra-period maximum'],
                    ['L','Low price','Intra-period minimum'],
                    ['C','Close price','Price at end of the time period — typically used as P'],
                    ['V','Volume','Number/value of transactions in the period'],
                  ].map(([f,m,n])=>(
                    <tr key={f}><td style={{color:'var(--cyan)',fontWeight:700,fontFamily:'monospace'}}>{f}</td><td>{m}</td><td style={{color:'var(--fg-dim)',fontSize:'0.75rem'}}>{n}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:'0.75rem',fontSize:'0.75rem',color:'var(--fg-dim)'}}>
              Data source: Kaggle Bitcoin Historical Dataset. Daily (~2,652 pts), hourly, or per-minute (~600k pts/year). Live data: Kraken exchange via <code style={{color:'var(--cyan)'}}>ccxt</code> library. Training split: <strong>pre-2020</strong>. Test (held-out): <strong>2020 onwards</strong>.
            </div>
          </div>

          {/* Convolution framework */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Core Convolution Framework</div>
            <p style={{fontSize:'0.78rem',color:'var(--fg-dim)',marginBottom:'0.75rem',lineHeight:1.6}}>
              All WMA filters are implemented the same way — as a kernel (weight array) convolved with the price series. The <code style={{color:'var(--cyan)'}}>pad()</code> function flip-pads the signal so the window is fully populated at t=0.
            </p>
            <div className="m4-pseudocode">{
`def pad(P, N):
    padding = -np.flip(P[1:N])    # mirror the opening values
    return np.append(padding, P)

def wma(P, N, kernel):
    return np.convolve(pad(P, N), kernel, 'valid')

# Usage:  wma(P, N, some_filter(N))`
            }</div>
            <div className="m4-infobox">
              The <strong>kernel</strong> (filter) defines how much weight each past price gets. Swap the kernel to switch between SMA, LMA, EMA, or any custom filter — the <code>wma()</code> function stays the same.
            </div>
          </div>

          {/* Three filters */}
          <div className="m4-two-col">
            {/* SMA */}
            <div className="m4-card" style={{padding:'1.25rem'}}>
              <div className="m4-card-h">Simple Moving Average (SMA)</div>
              <div className="m4-flabel">Definition</div>
              <Tex src="\text{SMA}_n = \frac{1}{N}\sum_{k=0}^{N-1} p_{n-k}" block />
              <div className="m4-flabel">Kernel (boxcar)</div>
              <Tex src="K_\text{SMA}[k] = \frac{1}{N}, \quad 0 \le k < N" block />
              <div className="m4-pseudocode">{`def sma_filter(N):
    return np.ones(N) / N`}</div>
              <VarTable vars={[
                ['N','Window size — number of past prices averaged'],
                ['p_{n-k}','Price k periods ago (k=0 is most recent)'],
              ]} />
              <ul className="m4-bullets">
                <li>Uniform weights across the entire window</li>
                <li>Most smoothing, most lag</li>
                <li>Lag grows linearly with N</li>
              </ul>
            </div>
            {/* LMA */}
            <div className="m4-card" style={{padding:'1.25rem'}}>
              <div className="m4-card-h">Linear-Weighted MA (LMA)</div>
              <div className="m4-flabel">Kernel (triangular)</div>
              <Tex src="K_\text{LMA}[k] = \frac{2}{N+1}\!\left(1 - \frac{k}{N}\right),\; 0 \le k < N" block />
              <div className="m4-pseudocode">{`def lma_filter(N):
    weights = np.array([1 - k/N for k in range(N)])
    return weights * (2 / (N + 1))`}</div>
              <VarTable vars={[
                ['k','Lag index — 0 = most recent, N-1 = oldest'],
                ['\\frac{2}{N+1}','Normalisation so all weights sum to 1'],
              ]} />
              <ul className="m4-bullets">
                <li>Linearly decaying weights — recent prices weighted more</li>
                <li>Faster response and less smoothing than SMA</li>
                <li>Medium lag</li>
              </ul>
            </div>
          </div>

          {/* EMA */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h">Exponential Moving Average (EMA)</div>
            <div className="m4-two-col">
              <div>
                <div className="m4-flabel">Kernel (exponential decay)</div>
                <Tex src="K_\text{EMA}[k] = \alpha(1-\alpha)^k, \quad 0 \le k < N" block />
                <Tex src="\text{Normalise: } K \leftarrow K\,/\,\sum K" block />
                <div className="m4-pseudocode">{`def ema_filter(N, alpha):
    weights = np.array(
        [alpha * (1-alpha)**k for k in range(N)])
    return weights / weights.sum()`}</div>
              </div>
              <div>
                <VarTable vars={[
                  ['\\alpha','Smoothing factor / decay rate (0 < α < 1). Higher α = more weight on recent prices.'],
                  ['N','Window size — truncates the infinite EMA series'],
                  ['(1-\\alpha)^k','Weight of price k periods ago decays exponentially'],
                ]} />
                <ul className="m4-bullets">
                  <li>Two tunable parameters: N and α — more expressive than SMA/LMA</li>
                  <li>Fastest response, least lag</li>
                  <li>Approximates the true infinite-horizon EMA over a fixed window</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Filter comparison */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Filter Comparison</div>
            <table className="m4-ptable" style={{width:'100%'}}>
              <thead><tr><th>Filter</th><th>Recency Bias</th><th>Smoothing</th><th>Lag</th><th>Extra Params</th></tr></thead>
              <tbody>
                <tr><td style={{color:'var(--cyan)',fontWeight:600}}>SMA</td><td>None (uniform)</td><td style={{color:'var(--rose)'}}>Most</td><td style={{color:'var(--rose)'}}>Most</td><td>—</td></tr>
                <tr><td style={{color:'var(--violet)',fontWeight:600}}>LMA</td><td>Linear</td><td style={{color:'var(--amber)'}}>Medium</td><td style={{color:'var(--amber)'}}>Medium</td><td>—</td></tr>
                <tr><td style={{color:'var(--emerald)',fontWeight:600}}>EMA</td><td>Exponential</td><td style={{color:'var(--emerald)'}}>Least</td><td style={{color:'var(--emerald)'}}>Least</td><td>α (decay rate)</td></tr>
              </tbody>
            </table>
            <div style={{marginTop:'0.75rem',fontSize:'0.75rem',color:'var(--fg-dim)'}}>
              <strong style={{color:'var(--fg)'}}>Tunable for all filters:</strong> window size N (responsiveness vs. smoothing tradeoff) and timeframe (minutes/hours/days — also optimisable).
            </div>
          </div>

          {/* Custom filters */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Custom / Free-Weight Filters</div>
            <Tex src="\text{WMA}_n = \frac{\sum_{k=0}^{N-1} w_k \cdot p_{n-k}}{\sum_{k=0}^{N-1} w_k}" block />
            <div className="m4-warnbox">
              Free weights = <strong>N free parameters per filter</strong>. Maximum expressiveness, but greatly enlarges the hypothesis space. This is a design choice for your optimiser — more parameters means harder search.
            </div>
          </div>

          {/* Crossover signals */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Crossover Strategy — Core Trading Logic</div>
            <div className="m4-two-col">
              <div>
                <p style={{fontSize:'0.78rem',color:'var(--fg-dim)',lineHeight:1.6,marginBottom:'0.75rem'}}>
                  Use <strong>two WMA signals</strong> of different frequencies. When the faster (short-term) WMA crosses the slower (long-term) WMA, a trade is triggered.
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'0.75rem'}}>
                  <div style={{padding:'0.6rem 0.85rem',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:'6px',fontSize:'0.78rem'}}>
                    <span style={{color:'var(--emerald)',fontWeight:700}}>Golden Cross</span> — short-term WMA crosses <em>above</em> long-term → <strong style={{color:'var(--emerald)'}}>BUY</strong>
                  </div>
                  <div style={{padding:'0.6rem 0.85rem',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.3)',borderRadius:'6px',fontSize:'0.78rem'}}>
                    <span style={{color:'var(--rose)',fontWeight:700}}>Death Cross</span> — short-term WMA crosses <em>below</em> long-term → <strong style={{color:'var(--rose)'}}>SELL</strong>
                  </div>
                </div>
                <div style={{fontSize:'0.72rem',color:'var(--fg-dim)',lineHeight:1.5}}>
                  Two approaches: (1) same filter type, different window sizes; (2) different filter types (e.g. EMA short, SMA long).
                </div>
              </div>
              <div>
                <div className="m4-flabel">Difference signal</div>
                <div className="m4-pseudocode">{`diff = short_wma - long_wma
# positive → hold/buy zone
# negative → sell zone`}</div>
                <div className="m4-flabel">Sign-change detection kernel</div>
                <Tex src="K_\text{cross} = \tfrac{1}{2}[1,\,-1]" block />
                <div className="m4-pseudocode">{`def crossover_filter():
    return np.array([0.5, -0.5])

signs = wma(np.sign(diff), 2, crossover_filter())
buy  = signs >  0.5   # positive zero-crossing
sell = signs < -0.5   # negative zero-crossing`}</div>
              </div>
            </div>
          </div>

          {/* MACD */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>MACD — More Elaborate Signal</div>
            <p style={{fontSize:'0.78rem',color:'var(--fg-dim)',lineHeight:1.6,marginBottom:'0.75rem'}}>
              Standard MACD(12, 26, 9): a difference of two EMAs, then a moving average of that difference. This introduces a third WMA layer. Two trigger options: MACD-vs-Signal crossover, or MACD-vs-zero crossover.
            </p>
            <div className="m4-two-col">
              <div>
                <div className="m4-flabel">MACD computation</div>
                <div className="m4-pseudocode">{`macd_line   = EMA(12) − EMA(26)
signal_line = EMA(9) of MACD line
diff        = macd_line − signal_line

# Buy  → macd crosses above signal
# Sell → macd crosses below signal`}</div>
              </div>
              <div>
                <div className="m4-flabel">In code</div>
                <div className="m4-pseudocode">{`macd = (wma(P, 12, ema_filter(12, α))
      - wma(P, 26, ema_filter(26, α)))
sig  = wma(macd, 9, ema_filter(9, α))
diff = macd - sig`}</div>
                <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.75rem'}}>
                  MACD pushes the search space to <strong>21-D</strong> (3 signal components × 7 params each). More expressive but much harder to optimise.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ OPTIMISATION & EVAL ════════════════ */}
      {view === 'Optimisation & Eval' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

          {/* Generalised bot */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Generalised Bot — Parameterised Signal Components</div>
            <p style={{fontSize:'0.78rem',color:'var(--fg-dim)',lineHeight:1.6,marginBottom:'0.75rem'}}>
              Instead of a single fixed filter, replace each signal component with a <strong>weighted combination</strong> of all three filter types. The optimiser then decides how much of each filter to use.
            </p>
            <Tex src="\text{HIGH} = \frac{w_1 \cdot \text{SMA}(d_1) + w_2 \cdot \text{LMA}(d_2) + w_3 \cdot \text{EMA}(d_3,\,\alpha_3)}{\sum_i w_i}" block />
            <VarTable vars={[
              ['w_1, w_2, w_3','Mixing weights — how much of each filter type to include'],
              ['d_1, d_2, d_3','Window sizes for SMA, LMA, EMA respectively'],
              ['\\alpha_3','EMA smoothing/decay rate'],
            ]} />
          </div>

          {/* Search space */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Search Space Dimensionality</div>
            <table className="m4-ptable" style={{width:'100%'}}>
              <thead><tr><th>Configuration</th><th>Parameters</th><th>Dimensions</th></tr></thead>
              <tbody>
                {[
                  ['Single HIGH signal','[w₁, w₂, w₃, d₁, d₂, d₃, α₃]','7-D','var(--emerald)'],
                  ['HIGH + LOW signals','above × 2','14-D','var(--amber)'],
                  ['MACD (+ smoothing signal)','above × 3','21-D','var(--rose)'],
                  ['Free filter weights (N per filter)','N per WMA component','N × (num filters)-D','var(--violet)'],
                ].map(([cfg,params,dim,col])=>(
                  <tr key={cfg}>
                    <td>{cfg}</td>
                    <td style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--fg-dim)'}}>{params}</td>
                    <td style={{color:col,fontWeight:700,fontFamily:'monospace'}}>{dim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="m4-infobox" style={{marginTop:'0.75rem'}}>
              <strong>Key tension:</strong> More parameters = richer hypothesis space = potentially better solutions, but also a harder search problem. This trade-off is the central question of the project.
            </div>
            <div style={{marginTop:'0.75rem',fontSize:'0.75rem',color:'var(--fg-dim)',lineHeight:1.6}}>
              <strong style={{color:'var(--fg)'}}>Design space options:</strong> (1) tune WMA parameters N/w/α; (2) choose filter type combinations; (3) free per-tap weights; (4) structural optimisation — which components to include (introduces discontinuities in the fitness landscape).
            </div>
          </div>

          {/* Back-testing */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Back-Testing Setup — Fitness Evaluation</div>
            <div className="m4-two-col">
              <div>
                <table className="m4-ptable" style={{width:'100%'}}>
                  <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
                  <tbody>
                    {[
                      ['Starting capital','$1,000 USD'],
                      ['Starting BTC','0 BTC'],
                      ['Transaction fee','3% per trade'],
                      ['Buy rule','Spend all cash (minus fee) on BTC at current price'],
                      ['Sell rule','Sell all BTC for cash (minus fee) at current price'],
                      ['End condition','Sell any remaining BTC at final price'],
                      ['Fitness','Final cash balance (maximise this)'],
                    ].map(([p,v])=>(
                      <tr key={p}><td>{p}</td><td style={{color:'var(--cyan)',fontWeight:600}}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--violet)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.5rem'}}>Data Split</div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'0.75rem'}}>
                  <div style={{padding:'0.6rem 0.85rem',background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:'6px',fontSize:'0.78rem'}}>
                    <div style={{color:'var(--violet)',fontWeight:700,marginBottom:'0.2rem'}}>Training Set</div>
                    <div style={{color:'var(--fg-dim)'}}>All data <strong>before 2020</strong> — use this to optimise bot parameters</div>
                  </div>
                  <div style={{padding:'0.6rem 0.85rem',background:'rgba(34,211,238,0.08)',border:'1px solid rgba(34,211,238,0.25)',borderRadius:'6px',fontSize:'0.78rem'}}>
                    <div style={{color:'var(--cyan)',fontWeight:700,marginBottom:'0.2rem'}}>Test Set (held-out)</div>
                    <div style={{color:'var(--fg-dim)'}}>Data from <strong>2020 onwards</strong> — treat as "future" data; only evaluate here at the very end</div>
                  </div>
                </div>
                <div className="m4-warnbox">
                  Evaluation is <strong>deterministic</strong> — same parameters always produce the same fitness. Never optimise on the test set. "Treat the project as if it is the start of 2020."
                </div>
              </div>
            </div>
          </div>

          {/* Algorithm requirements */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Algorithm Requirements for Part 2</div>
            <div className="m4-two-col">
              <div>
                <ul className="m4-bullets">
                  <li>Use <strong>one or more nature-inspired algorithms</strong> from your Part 1 review</li>
                  <li>Algorithms must be <strong>population-based</strong></li>
                  <li>Optionally add a <strong>single-state baseline</strong> (e.g., stochastic hill-climbing) for comparison</li>
                  <li>When comparing single-state vs population, fix the <strong>number of evaluations</strong> as budget (not generations)</li>
                </ul>
              </div>
              <div>
                <div className="m4-flabel">What to compare and report</div>
                <ul className="m4-bullets">
                  <li>Convergence curves — how fast does fitness improve?</li>
                  <li>Solution quality — final fitness on training vs test</li>
                  <li>Robustness — does varying population size change results significantly?</li>
                  <li>Look for meaningful differences, not just "algorithm X got a higher number"</li>
                </ul>
              </div>
            </div>
            <div className="m4-infobox" style={{marginTop:'0.75rem'}}>
              <strong>Rules of engagement:</strong> No external bot code — all bot logic must be written by the team. No optimisation libraries — implement the algorithms yourselves. You <em>may</em> adapt published algorithm code but must acknowledge the source.
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ DELIVERABLES ════════════════ */}
      {view === 'Deliverables' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
          <div className="m4-two-col">
            {/* D1 */}
            <div className="m4-card" style={{padding:'1.25rem',borderColor:d1Days<=5?'rgba(251,191,36,0.4)':'undefined'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                <div className="m4-card-h" style={{margin:0}}>Deliverable 1 — Synopses</div>
                <span className="m4-badge" style={{background:'rgba(251,191,36,0.15)',color:'var(--amber)',border:'1px solid rgba(251,191,36,0.3)'}}>
                  {d1Days > 0 ? `${d1Days}d left` : 'DUE'}
                </span>
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--amber)',fontWeight:700,marginBottom:'0.85rem'}}>Fri 24 Apr 2026, 11:59pm AWST</div>
              <ul className="m4-bullets">
                <li><strong>One synopsis per team member</strong> — 1 to 1.5 pages each</li>
                <li>Answers all 6 structured questions for their chosen algorithm</li>
                <li><strong>One comparative conclusion</strong> — 1 to 2 pages, written as a team</li>
                <li>Covers taxonomy, chronology, algorithm selection rationale</li>
                <li>Diagrams encouraged in the conclusion</li>
              </ul>
              <div className="m4-warnbox" style={{marginTop:'0.75rem'}}>
                Late penalty: 5% per day after a 48-hour grace period. Not accepted after 7 days late.
              </div>
            </div>
            {/* D2 */}
            <div className="m4-card" style={{padding:'1.25rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                <div className="m4-card-h" style={{margin:0}}>Deliverable 2 — Full Project</div>
                <span className="m4-badge" style={{background:'rgba(167,139,250,0.15)',color:'var(--violet)',border:'1px solid rgba(167,139,250,0.3)'}}>
                  {d2Days}d left
                </span>
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--violet)',fontWeight:700,marginBottom:'0.85rem'}}>Sun 24 May 2026, 11:59pm AWST</div>
              <ul className="m4-bullets">
                <li><strong>Video presentation</strong> — ≤25 minutes (see sections below)</li>
                <li><strong>Written report</strong> — ≤3,000 words excluding diagrams and references</li>
                <li><strong>Code repository</strong> — Jupyter notebook (.ipynb) + README</li>
              </ul>
            </div>
          </div>

          {/* Video sections */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'1rem'}}>Video Presentation — Required Sections (≤25 min)</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
              {[
                ['1','Algorithms Investigated','var(--cyan)','Overview, categorisation, distinguishing features of each algorithm reviewed in Part 1'],
                ['2','Bot Design & Parameterisation','var(--violet)','Configuration choices made, hypothesis space, dimensionality — how many parameters and why'],
                ['3','Algorithm Selection','var(--emerald)','Rationale for choosing which algorithm(s) to optimise with. High-level explanation + pseudocode/diagrams'],
                ['4','Experiments & Evaluation','var(--amber)','Testing regime, data used, trade-offs considered. How were parameters varied?'],
                ['5','Results','var(--rose)','Visual representations preferred — charts, tables, animations. Show convergence curves.'],
                ['6','Conclusions','var(--cyan)','What was learnt, not just whether the bot "won". Limitations, surprising findings, what you would do differently.'],
              ].map(([n,title,col,desc])=>(
                <div key={n} style={{display:'flex',gap:'0.75rem',alignItems:'flex-start',padding:'0.65rem 0.85rem',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderLeft:`3px solid ${col}`,borderRadius:'0 6px 6px 0'}}>
                  <span style={{flexShrink:0,fontWeight:800,color:col,fontSize:'0.8rem',minWidth:'1.2rem'}}>{n}.</span>
                  <div>
                    <div style={{fontSize:'0.8rem',fontWeight:700,color:'var(--fg)',marginBottom:'0.2rem'}}>{title}</div>
                    <div style={{fontSize:'0.74rem',color:'var(--fg-dim)',lineHeight:1.5}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:'0.75rem',fontSize:'0.72rem',color:'var(--fg-dim)'}}>
              Format: MP4, or link to YouTube/Google Drive (set to "Anyone with the link can view").
            </div>
          </div>

          {/* Report */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Written Report — Requirements</div>
            <div className="m4-two-col">
              <ul className="m4-bullets">
                <li>≤3,000 words — excluding diagrams and references</li>
                <li>Submit as <strong>PDF</strong></li>
                <li><strong>IEEE referencing style</strong></li>
                <li>Title page: word count, team number, names and student IDs</li>
                <li>Complements the video — does not repeat it</li>
              </ul>
              <ul className="m4-bullets">
                <li>May include additional results, references, pseudocode</li>
                <li><strong>Must not</strong> include source code — refer to repo instead</li>
                <li>Does <strong>not</strong> need to re-explain the project spec or standard TA/lecture concepts</li>
                <li>Focus on your specific design decisions and findings</li>
              </ul>
            </div>
          </div>

          {/* Code */}
          <div className="m4-card" style={{padding:'1.25rem'}}>
            <div className="m4-card-h" style={{marginBottom:'0.75rem'}}>Code Repository</div>
            <ul className="m4-bullets">
              <li>Submit as <strong>.ipynb</strong> (Jupyter Notebook)</li>
              <li>Must reproduce all results reported in the video and report</li>
              <li>Include a <strong>README</strong> with brief run instructions</li>
              <li>Code is not directly marked, but results must be reproducible</li>
            </ul>
            <div className="m4-infobox" style={{marginTop:'0.75rem'}}>
              One member submits on behalf of the group. Submission = declaration that all work is the team's own (except as referenced).
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ COURSE LINKS ════════════════ */}
      {view === 'Course Links' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
          <div className="m4-infobox">
            Each card below links directly to the relevant section of this interactive learning hub. Click any card to navigate there.
          </div>
          <div className="m4-topic-grid">
            {[
              { title:'Nature-Inspired Algorithms', color:'var(--violet)', tab:'Algorithms', badge:'L6–9',
                desc:'Population-based metaheuristics (hill-climbing, SA, Tabu, ILS and more) are the core of Part 1 and the optimisation engine for Part 2. The Stochastic Methods section is most directly relevant.',
                why:'You need to understand these deeply to write your synopsis and implement one for Part 2.' },
              { title:'Optimisation Framework', color:'var(--cyan)', tab:'Optimisation', badge:'L3',
                desc:'The 3-ingredient framework — representation language, hypothesis space, evaluation metric — maps directly to your bot: the encoding is the WMA parameter vector; the metric is final cash balance.',
                why:'Defines how to think about your bot as an optimisation problem.' },
              { title:'Solution Space Analysis', color:'var(--rose)', tab:'Labs', badge:'Labs 4–5',
                desc:'Understand the combinatorial explosion before choosing your configuration. A 14-D or 21-D continuous search space is a very different beast from a discrete JSSP space.',
                why:'Motivates why gradient descent fails here and why population-based search is needed.' },
              { title:'Stochastic Methods & PRNG', color:'var(--amber)', tab:'Labs', badge:'Lab 1',
                desc:'All population-based algorithms need reliable random number generation. Understanding LCG properties, period length, and seed selection is essential for reproducible experiments.',
                why:'Reproducibility is required — same seed must produce same results for marker verification.' },
              { title:'Job Shop Scheduling', color:'var(--emerald)', tab:'Job Shop', badge:'L4',
                desc:'JSSP is the canonical hard combinatorial problem used throughout the course. The same GA, SA, and Tabu algorithms you apply to bot optimisation were originally studied on scheduling. Use it to build intuition.',
                why:'Builds intuition for how metaheuristics navigate large search spaces.' },
              { title:'Vector Calculus & Gradients', color:'var(--cyan)', tab:'Calculus', badge:'L5',
                desc:'Gradient-based methods are not applicable to this project (noisy, discrete, non-differentiable fitness landscape). Understanding why gradient descent fails here clarifies why population search is the right choice.',
                why:'Negative reason — understanding what NOT to use and why is exam-relevant and report-worthy.' },
            ].map(c => (
              <div key={c.title} className="m4-tcard" style={{'--tc':c.color}} onClick={() => setTab(c.tab)}>
                <div className="m4-tcard-code">{c.badge}</div>
                <div className="m4-tcard-title">{c.title}</div>
                <div className="m4-tcard-desc">{c.desc}</div>
                <div style={{fontSize:'0.7rem',color:c.color,marginTop:'0.4rem',fontStyle:'italic',lineHeight:1.4}}>Why: {c.why}</div>
                <div className="m4-tcard-cta">Go to {c.tab} →</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Population-based Methods Tab ──────────────────────────────────────────────
function PopulationTab() {
  const [sec, setSec] = useState('overview');

  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview',        'Overview'],
          ['evolution',       'Evolution & EC'],
          ['algorithms',      'ES Algorithms'],
          ['mutation',        'Adaptive Mutation'],
          ['generalisations', 'Generalisations'],
        ].map(([v,l]) => (
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={() => setSec(v)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {sec === 'overview' && (
        <div>
          {/* Quick-reference banner */}
          <div style={{background:'linear-gradient(135deg,rgba(34,211,238,0.07) 0%,rgba(167,139,250,0.07) 100%)',border:'1px solid rgba(34,211,238,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['Population','Many candidates at once','#22d3ee'],['Fitness','Quality function','#34d399'],['Selection','Pick the fittest','#a78bfa'],['Mutation','Tweak individuals','#fbbf24'],['Recombination','Crossover parents','#fb7185'],['Diversity','Avoid premature conv.','#06b6d4']].map(([k,v,col]) => (
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Roadmap + Key Question */}
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Where Population Methods Fit</div>
              <div className="m4-pseudocode">
                {'Optimisation\n├── Deterministic\n│   └── (...)\n└── Stochastic  ← global\n    ├── Single-state\n    │   ├── Hill climbing with restarts\n    │   ├── Simulated Annealing\n    │   ├── Tabu Search\n    │   └── ILS\n    └── Population-based  ◄── THIS MODULE\n            └── Evolutionary Strategies\n                Genetic Algorithms\n                Swarm Intelligence\n                ...'}
              </div>
              <div className="m4-infobox" style={{marginTop:'0.75rem',fontSize:'0.78rem'}}>
                <strong>Why population-based?</strong> Single-state methods maintain one candidate and move it around the space. Population methods maintain <em>many</em> candidates simultaneously — the collection carries information about the landscape that no individual point could provide alone.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">The Core Problem</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.7,marginBottom:'0.65rem'}}>
                We face search spaces that are:
              </div>
              <ul className="m4-bullets">
                <li><strong>Highly modal</strong> — enormous numbers of local optima (e.g. Rastrigin function). Hill climbing fails catastrophically.</li>
                <li><strong>Black-box</strong> — no gradient, no formula, just an input-output oracle.</li>
                <li><strong>High-dimensional</strong> — brute-force grid search is infeasible.</li>
                <li><strong>Expensive to evaluate</strong> — each sample may require a full simulation (e.g. tuning a numerical weather model with dozens of parameters).</li>
              </ul>
              <div className="m4-hr"/>
              <div style={{background:'rgba(34,211,238,0.08)',borderRadius:8,padding:'0.65rem',border:'1px solid rgba(34,211,238,0.25)',fontSize:'0.78rem',lineHeight:1.65}}>
                <strong style={{color:'#22d3ee'}}>The fundamental question:</strong><br/>
                Can a <em>collection</em> of points tell us more together than each individual on its own? Can the whole tell you more than the sum of the parts?
              </div>
              <div className="m4-warnbox" style={{marginTop:'0.65rem',fontSize:'0.75rem'}}>
                <strong>Every evaluation is precious.</strong> We want to extract maximum information from each sample — what does the space look like? Where should we look next?
              </div>
            </div>
          </div>

          {/* Why it works — plain English */}
          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(34,211,238,0.05) 0%,rgba(167,139,250,0.05) 100%)'}}>
            <div className="m4-card-h">Why Population Methods Beat Single-State — Plain English</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.55rem',marginTop:'0.5rem'}}>
              {[
                ['Spatial Coverage','#22d3ee','A single search point is like sending one scout into unknown terrain. A population is like sending fifty scouts in different directions at once — you learn about the whole landscape in parallel, not just one path.'],
                ['Collective Learning','#a78bfa','When scouts report back, you can compare their findings. A region with three scouts all doing well is far more informative than any single report — the population collectively "votes" on where the good regions are.'],
                ['Diversity → Convergence','#34d399',"Early on, spread candidates wide to explore. Over time, let fitter individuals dominate to exploit good regions. This is the explore/exploit trade-off managed naturally — you start broad and converge, rather than getting stuck immediately."],
              ].map(([t,col,desc]) => (
                <div key={t} style={{background:`${col}11`,border:`1px solid ${col}33`,borderRadius:8,padding:'0.6rem'}}>
                  <div style={{fontSize:'0.68rem',fontWeight:700,color:col,marginBottom:'0.3rem'}}>{t}</div>
                  <div style={{fontSize:'0.68rem',color:'var(--text-2)',lineHeight:1.5}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Connection to single-state */}
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Population Methods Generalise Single-State Methods</div>
            <p style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.65rem'}}>Single-state methods are just degenerate cases of population-based ES — they use a population of size 1:</p>
            <table className="m4-ptable">
              <thead><tr><th>Single-State Method</th><th>ES Equivalent</th><th>Interpretation</th></tr></thead>
              <tbody>
                <tr><td>Hill Climb (basic)</td><td className="pk">(1+1)</td><td>1 parent, 1 child; keep the better one</td></tr>
                <tr><td>Steepest Ascent Hill Climb</td><td className="pk">(1+n)</td><td>1 parent, n children; keep the single best across both</td></tr>
                <tr><td>Steepest Ascent with Replacement</td><td className="pk">(1, n)</td><td>1 parent, n children; best child always replaces parent</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EVOLUTION & EC ── */}
      {sec === 'evolution' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Inspiration — Why Biology?</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                What other system do we know of that: optimises performance within some environment using many trials? <strong>Natural/biological systems!</strong> Evolution is perhaps the most fundamental mechanism.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Why evolution is a great algorithm</div>
              <table className="m4-ptable">
                <tbody>
                  <tr><td className="pk">General</td><td>Works in vastly different environments — no problem-specific assumptions required</td></tr>
                  <tr><td className="pk">Population</td><td>Maintains many candidate solutions simultaneously — natural parallelism</td></tr>
                  <tr><td className="pk">Fitness</td><td>Seeks to optimise performance — fitness-driven selection pressure</td></tr>
                  <tr><td className="pk">Iterative</td><td>Improves solutions across generations — each cycle exploits prior information</td></tr>
                  <tr><td className="pk">Meta-learning</td><td>Collectively "learns" about the environment — capabilities stored in the genome</td></tr>
                  <tr><td className="pk">Sharing</td><td>Information passes within generations (social) and between generations (heredity)</td></tr>
                </tbody>
              </table>
              <div className="m4-hr"/>
              <div className="m4-warnbox" style={{fontSize:'0.75rem'}}>
                <strong>Important:</strong> Algorithmic "evolution" does not need to follow biological evolution precisely — we borrow inspiration, not a blueprint. There is no strict agreement on algorithm names or terminology in this field.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Lamarck vs Darwin vs Epigenetics</div>
              <table className="m4-ptable" style={{marginBottom:'0.75rem'}}>
                <thead><tr><th>Theorist</th><th>Year</th><th>Proposal</th></tr></thead>
                <tbody>
                  <tr><td className="pk">Lamarck</td><td>1809</td><td>Adaptations acquired during an individual's lifetime <em>can be passed on</em> to offspring</td></tr>
                  <tr><td className="pk">Darwin</td><td>1858–59</td><td>Natural selection is the primary mechanism. But Darwin did not fully rule out Lamarckism (pangenesis: gemmules carry environmental info to germ cells)</td></tr>
                  <tr><td className="pk">Weismann</td><td>1892</td><td>Germ-plasm theory: information flows one way — germ cells → somatic cells, never back. The "Weismann barrier". Cut off mice tails 19 generations: offspring still had tails → Lamarckism "refuted".</td></tr>
                </tbody>
              </table>
              <div style={{background:'rgba(167,139,250,0.08)',borderRadius:8,padding:'0.6rem',border:'1px solid rgba(167,139,250,0.25)',fontSize:'0.75rem',lineHeight:1.65}}>
                <strong style={{color:'#a78bfa'}}>Lamarck's Last Laugh — Epigenetics:</strong><br/>
                Signals from the environment can alter <em>gene expression</em> via the epigenome (epigenetic tags) without changing DNA. About <strong>1% of genes escape epigenetic reprogramming</strong> through imprinting — passed to the next generation. A partial vindication of Lamarck.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Relevance to EC algorithms</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-2)',lineHeight:1.6}}>
                In EC we are free to implement Lamarckian-style learning — an individual's locally learned improvements can be encoded directly into its genome before breeding. This is called a <strong>Memetic Algorithm</strong> and can significantly accelerate convergence.
              </div>
            </div>
          </div>

          {/* EC Terminology */}
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Evolutionary Computation — Common Terms (Luke, 2016)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.45rem',marginTop:'0.5rem'}}>
              {[
                ['individual','A single candidate solution in the population'],
                ['population','The full set of current candidate solutions'],
                ['fitness','Quality of an individual — computed by the fitness assessment function'],
                ['fitness landscape','The quality function viewed as a surface over the search space'],
                ['selection','Choosing individuals based on their fitness to act as parents'],
                ['mutation','Tweaking an individual — "asexual" breeding; produces one child from one parent'],
                ['recombination / crossover','Combining two parents, swapping sections to produce (usually two) children — "sexual" breeding'],
                ['breeding','Producing children from a population via iterated selection and tweaking'],
                ['genotype / genome','An individual\'s data structure as used during breeding (what is stored and manipulated)'],
                ['chromosome','A genotype in the form of a fixed-length vector'],
                ['gene','A particular slot position in a chromosome'],
                ['allele','A particular setting (value) of a gene'],
                ['phenotype','How the individual behaves during fitness assessment — may differ from genotype'],
                ['generation','One full cycle: fitness assessment → breeding → population re-assembly'],
                ['parent / child','Parent: the individual being copied and tweaked. Child: the resulting tweaked copy'],
              ].map(([term, def]) => (
                <div key={term} style={{display:'flex',gap:'0.5rem',padding:'0.35rem 0.5rem',background:'var(--bg-2)',borderRadius:6,alignItems:'flex-start'}}>
                  <span style={{fontFamily:'monospace',fontSize:'0.69rem',fontWeight:700,color:'#22d3ee',flexShrink:0,minWidth:'9rem'}}>{term}</span>
                  <span style={{fontSize:'0.69rem',color:'var(--text-2)',lineHeight:1.45}}>{def}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Abstract EA */}
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Abstract Generational Evolutionary Algorithm (Algorithm 17)</div>
            <div className="m4-two-col">
              <div>
                <div className="m4-pseudocode">
                  <span className="kw">Algorithm</span> 17: Abstract Generational EA{'\n'}
                  {' '}P ← BuildInitialPopulation(){'\n'}
                  {' '}Best ← ∅              <span className="cm">▷ nobody yet</span>{'\n'}
                  {' '}<span className="kw">repeat</span>{'\n'}
                  {' '}  AssessFitness(P){'\n'}
                  {' '}  <span className="kw">for each</span> Pᵢ ∈ P <span className="kw">do</span>{'\n'}
                  {' '}    <span className="kw">if</span> Best = ∅ <span className="kw">or</span> Fitness(Pᵢ) {'>'} Fitness(Best){'\n'}
                  {' '}      Best ← Pᵢ{'\n'}
                  {' '}  P ← Join(P, Breed(P)){'\n'}
                  {' '}<span className="kw">until</span> ideal or time exhausted{'\n'}
                  {' '}<span className="kw">return</span> Best
                </div>
              </div>
              <div>
                <div className="m4-flabel">Notes on each step</div>
                <ul className="m4-bullets">
                  <li><strong>AssessFitness()</strong> — involves evaluation; can be very expensive. This is the bottleneck.</li>
                  <li><strong>Breed()</strong> — typically selection + mutation and/or recombination</li>
                  <li><strong>Join()</strong> — replace parents entirely, OR keep fitter parents (elitism)</li>
                  <li><strong>BuildInitialPopulation()</strong> — random (uniform or Gaussian) or biased. Biased gives a head start but risks narrowing the initial search.</li>
                </ul>
                <div className="m4-warnbox" style={{fontSize:'0.74rem'}}>
                  Gaussian initialisation: where do you centre it? Does that bias the results? Uniform requires a bounded space.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ES ALGORITHMS ── */}
      {sec === 'algorithms' && (
        <div>
          {/* (μ, λ) */}
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">The (μ, λ) Evolution Strategy</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                Dates back to <strong>Rechenberg and Schwefel, 1960s</strong>. Uses <strong>truncation selection</strong> — keep only the μ fittest — and <strong>mutation</strong> as the primary tweak operator.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Steps</div>
              <ol style={{paddingLeft:'1.2rem',fontSize:'0.77rem',color:'var(--text-1)',lineHeight:1.75,marginBottom:'0.65rem'}}>
                <li>Randomly initialise <strong>λ</strong> individuals</li>
                <li>Evaluate and keep the <strong>μ</strong> fittest (truncation selection)</li>
                <li>Mutate each of the μ parents <strong>λ/μ times</strong> to produce λ children</li>
                <li>Replace parents with children — repeat</li>
              </ol>
              <div className="m4-flabel">Parameters</div>
              <VarTable vars={[
                ['\\mu', 'Number of parents selected (survivors) — controls selectivity; low μ → high exploitation'],
                ['\\lambda', 'Total offspring produced each generation — larger λ → better coverage but more evaluations'],
                ['\\lambda / \\mu', 'Children per parent — each surviving parent spawns this many mutated copies'],
              ]} />
              <div className="m4-pseudocode" style={{marginTop:'0.65rem'}}>
                <span className="kw">Algorithm</span> 18: (μ, λ) ES{'\n'}
                {' '}P ← {} {'\n'}
                {' '}<span className="kw">for</span> λ times: P ← P ∪ {'{'}random individual{'}'}{'\n'}
                {' '}Best ← ∅{'\n'}
                {' '}<span className="kw">repeat</span>{'\n'}
                {' '}  AssessFitness(P){'\n'}
                {' '}  <span className="kw">for each</span> Pᵢ: update Best{'\n'}
                {' '}  Q ← μ individuals with greatest Fitness()   <span className="cm">▷ truncation</span>{'\n'}
                {' '}  P ← {'{}'}{'\n'}
                {' '}  <span className="kw">for each</span> Qⱼ: <span className="kw">for</span> λ/μ times: P ← P ∪ {'{'}Mutate(Copy(Qⱼ)){'}'}{'\n'}
                {' '}<span className="kw">until</span> ideal or time exhausted{'\n'}
                {' '}<span className="kw">return</span> Best
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">The (μ + λ) Evolution Strategy</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                <strong>Only one difference from (μ, λ):</strong> in Join(), <em>offspring compete with parents</em> for a place in the next generation. A good parent can survive indefinitely.
              </div>
              <div className="m4-hr"/>
              <div className="m4-pseudocode">
                <span className="kw">Algorithm</span> 19: (μ + λ) ES{'\n'}
                {' '}<span className="cm">▷ same initialisation as (μ,λ) ...</span>{'\n'}
                {' '}<span className="kw">repeat</span>{'\n'}
                {' '}  AssessFitness(P){'\n'}
                {' '}  <span className="kw">for each</span> Pᵢ: update Best{'\n'}
                {' '}  Q ← μ best from P{'\n'}
                {' '}  P ← Q              <span className="cm">▷ KEY: parents survive into P</span>{'\n'}
                {' '}  <span className="kw">for each</span> Qⱼ: <span className="kw">for</span> λ/μ times: P ← P ∪ {'{'}Mutate(Copy(Qⱼ)){'}'}{'\n'}
                {' '}<span className="kw">until</span> ideal or time exhausted{'\n'}
                {' '}<span className="kw">return</span> Best
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Comparison</div>
              <table className="m4-ptable">
                <thead><tr><th>Property</th><th>(μ, λ)</th><th>(μ + λ)</th></tr></thead>
                <tbody>
                  <tr><td>Parents compete with offspring?</td><td>No</td><td className="pk">Yes</td></tr>
                  <tr><td>Exploitation tendency</td><td>Moderate</td><td className="pk">Higher</td></tr>
                  <tr><td>Risk of losing good solutions</td><td className="pk">Higher</td><td>Lower</td></tr>
                  <tr><td>Risk of premature convergence</td><td>Lower</td><td className="pk">Higher</td></tr>
                </tbody>
              </table>
              <div className="m4-warnbox" style={{fontSize:'0.74rem',marginTop:'0.65rem'}}>
                <strong>Premature convergence</strong> = too much loss of diversity too soon. The population collapses onto a local optimum before adequately exploring the space. Cf. SA's cooling schedule — the same exploration/exploitation tension in a different form.
              </div>
            </div>
          </div>

          {/* Tuning knobs + visualisation */}
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Tuning Knobs of (μ, λ)</div>
            <div className="m4-two-col">
              <table className="m4-ptable">
                <thead><tr><th>Parameter</th><th>Role</th><th>Effect</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="pk">λ</td>
                    <td>Population / sampling size — analogous to n in steepest ascent</td>
                    <td>Bigger λ → better coverage; λ → ∞ → random search (pure exploration)</td>
                  </tr>
                  <tr>
                    <td className="pk">μ</td>
                    <td>Selectivity — how many parents survive</td>
                    <td>Low μ → strong selection pressure → more exploitation</td>
                  </tr>
                  <tr>
                    <td className="pk">Mutate()</td>
                    <td>Probability and degree of mutation</td>
                    <td>Governs the exploration/exploitation balance on each generation</td>
                  </tr>
                </tbody>
              </table>
              <div>
                <div className="m4-flabel">ES Variants — Visualised</div>
                <div style={{fontFamily:'monospace',fontSize:'0.71rem',color:'var(--text-1)',lineHeight:2.1,background:'var(--bg-2)',borderRadius:8,padding:'0.65rem 0.85rem',border:'1px solid rgba(34,211,238,0.15)'}}>
                  <div><span style={{color:'#22d3ee'}}>(1, 2) ES</span>{'  '}● ──► ◇ ◇{'  '}<span style={{color:'var(--text-3)',fontSize:'0.65rem'}}>1 parent → 2 children; parent discarded</span></div>
                  <div><span style={{color:'#a78bfa'}}>(1, 8) ES</span>{'  '}● ──► ◇ ◇ ◇ ◇ ◇ ◇ ◇ ◇{'  '}<span style={{color:'var(--text-3)',fontSize:'0.65rem'}}>1 parent → 8 children; wider exploration</span></div>
                  <div><span style={{color:'#34d399'}}>(4, 8) ES</span>{'  '}<span style={{color:'#34d399'}}>● ● ● ●</span>{' ──► '}◇ ◇ ◇ ◇ ◇ ◇ ◇ ◇{'  '}<span style={{color:'var(--text-3)',fontSize:'0.65rem'}}>4 survive, each produces 2 children</span></div>
                  <div style={{marginTop:'0.4rem',fontSize:'0.67rem',color:'var(--text-3)'}}>
                    Legend: <span style={{color:'#34d399'}}>●</span> = selected to breed{'  '}◇ = not selected (offspring pool)
                  </div>
                </div>
                <div className="m4-infobox" style={{marginTop:'0.65rem',fontSize:'0.75rem'}}>
                  <strong>Q:</strong> What does (4,8) give you that 4 restarts of a single-state method would not?<br/>
                  <strong>A:</strong> The 4 surviving parents carry spatial information about <em>different regions</em> simultaneously. Their relative fitness reveals landscape structure — independent restarts cannot exploit this collective knowledge.
                </div>
                <div style={{fontSize:'0.72rem',color:'var(--text-2)',lineHeight:1.55,marginTop:'0.5rem'}}>
                  <strong>Note:</strong> Parameters are not independent — highly random mutation with small μ is still effectively a random walk.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADAPTIVE MUTATION ── */}
      {sec === 'mutation' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Adaptive Mutation Rate</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                Typical ES: fixed-length real-valued chromosome, mutation via <strong>Gaussian Convolution</strong>, controlled by σ² (the mutation rate / step size). How should we choose σ²?
              </div>
              <div className="m4-hr"/>
              <table className="m4-ptable" style={{marginBottom:'0.75rem'}}>
                <thead><tr><th>Strategy</th><th>Notes</th></tr></thead>
                <tbody>
                  <tr><td>Guess</td><td>Simple but unlikely to be optimal for the specific problem</td></tr>
                  <tr><td>Run experiments</td><td>Find a good value — works but expensive and problem-specific</td></tr>
                  <tr><td>Meta-optimisation</td><td>Run an optimiser <em>over</em> the mutation rate itself</td></tr>
                  <tr><td>Decrease over time</td><td>Analogous to SA's cooling schedule</td></tr>
                  <tr><td className="pk">Adaptive</td><td><strong>Change based on runtime statistics of the system — most principled</strong></td></tr>
                </tbody>
              </table>
              <div className="m4-flabel">Rechenberg's One-Fifth Rule</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-2)',lineHeight:1.65,marginBottom:'0.55rem'}}>
                Let <em>p</em><sub>s</sub> = fraction of children that are fitter than their parent:
              </div>
              <Tex src="p_s > \tfrac{1}{5} \;\Rightarrow\; \text{increase } \sigma^2 \quad\text{(exploiting local region — explore more)}" block />
              <Tex src="p_s < \tfrac{1}{5} \;\Rightarrow\; \text{decrease } \sigma^2 \quad\text{(exploring too much — exploit more)}" block />
              <Tex src="p_s = \tfrac{1}{5} \;\Rightarrow\; \sigma^2 \text{ unchanged}" block />
              <div className="m4-warnbox" style={{marginTop:'0.65rem',fontSize:'0.74rem'}}>
                Derived on simple test problems — your problem may have a very different ideal ratio. Treat as a heuristic starting point, not a law.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Self-Adaptive Mutation</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                Takes adaptive mutation one step further: different regions of the search space have different characteristics. Settings optimal for one region may be suboptimal for another.
              </div>
              <div className="m4-hr"/>
              <div style={{background:'rgba(167,139,250,0.08)',borderRadius:8,padding:'0.65rem',border:'1px solid rgba(167,139,250,0.25)',marginBottom:'0.65rem'}}>
                <div style={{fontSize:'0.7rem',fontWeight:700,color:'#a78bfa',marginBottom:'0.3rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Key Idea</div>
                <div style={{fontSize:'0.77rem',color:'var(--text-1)',lineHeight:1.65}}>
                  Each individual carries its own σ (or full covariance matrix <strong>Σ</strong>) as part of its genome. The mutation operator itself can mutate — σ evolves alongside the solution.
                </div>
              </div>
              <Tex src="\text{Genome: } (\vec{x},\, \sigma) \;\text{ or }\; (\vec{x},\, \boldsymbol{\Sigma})" block />
              <div className="m4-flabel" style={{marginTop:'0.65rem'}}>Design principles</div>
              <ul className="m4-bullets">
                <li>Your imagination is the limit — but choices <strong>must be justified</strong></li>
                <li>Occam's Razor: complexity for its own sake is poor practice</li>
                <li>Must <strong>empirically demonstrate</strong> that the added complexity actually helps</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Motivating example — Rosenbrock's function</div>
              <div style={{background:'var(--bg-3)',borderRadius:6,padding:'0.45rem 0.6rem',fontFamily:'monospace',fontSize:'0.68rem',color:'var(--text-2)',marginBottom:'0.5rem'}}>
                {'f(x,y) = (1−x)² + 100(y−x²)²\nGlobal minimum at (1,1) with f=0\nNarrow, curved parabolic valley — fixed σ is inefficient\nOptimal step direction and scale change across the space'}
              </div>
              <div style={{fontSize:'0.73rem',color:'var(--text-2)',lineHeight:1.6}}>
                A fixed σ that works well in the flat outer region is far too large for navigating the narrow valley — and vice versa. Self-adaptive σ lets the genome "learn" the local scale automatically.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GENERALISATIONS ── */}
      {sec === 'generalisations' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Evolutionary Programming — Beyond Real Vectors</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                ES ideas generalise beyond real-valued chromosomes to <strong>any</strong> representation. The core loop (breed → assess → select) is representation-agnostic.
              </div>
              <div className="m4-hr"/>
              <table className="m4-ptable">
                <thead><tr><th>Representation</th><th>Application</th></tr></thead>
                <tbody>
                  <tr><td>Real-valued vectors</td><td>Continuous optimisation — the classic ES</td></tr>
                  <tr><td className="pk">Finite-state automata</td><td>Fogel (1964) — original Evolutionary Programming</td></tr>
                  <tr><td>Trees</td><td>Symbolic regression, rule systems — Genetic Programming</td></tr>
                  <tr><td>Graphs</td><td>Network topology optimisation</td></tr>
                  <tr><td>Programs</td><td>Genetic Programming (GP)</td></tr>
                  <tr><td>Neural network structure</td><td>Neuroevolution — e.g. NEAT algorithm</td></tr>
                  <tr><td>Permutations</td><td>TSP, job shop scheduling — requires order-preserving crossover</td></tr>
                </tbody>
              </table>
              <div className="m4-warnbox" style={{marginTop:'0.65rem',fontSize:'0.74rem'}}>
                Extra constraints are often needed to ensure individuals remain <strong>viable solutions</strong> after mutation/crossover — e.g. trees must remain syntactically valid programs; permutations must remain valid permutations.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">The EC Family — Key Sub-fields</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'0.45rem',marginTop:'0.25rem'}}>
                {[
                  ['Genetic Algorithms (GA)','#22d3ee','Binary/integer chromosomes, emphasise crossover as the primary operator. Introduced by Holland (1975).'],
                  ['Evolution Strategies (ES)','#a78bfa','Real-valued vectors, emphasise mutation (Gaussian convolution). Rechenberg & Schwefel (1960s).'],
                  ['Genetic Programming (GP)','#34d399','Evolve programs / expression trees. Koza (1992). Representation is a tree; crossover swaps subtrees.'],
                  ['Swarm Intelligence','#fbbf24','Inspired by collective behaviour of social insects (ants, bees) or birds (PSO). No explicit individual fitness — emergent optimisation from local rules.'],
                  ['Ant Colony Optimisation','#fb7185','Ants deposit pheromone trails; paths with higher fitness get reinforced — positive feedback loop for graph problems.'],
                  ['Memetic Algorithms','#06b6d4','Hybrid: local search (Lamarckian learning) applied to each individual before breeding. Best of single-state and population methods.'],
                  ['Co-evolution','#ec4899','Multiple interacting populations that provide each other\'s fitness function — no fixed target, fitness is relative.'],
                ].map(([name,col,desc]) => (
                  <div key={name} style={{background:`${col}0d`,border:`1px solid ${col}28`,borderRadius:7,padding:'0.45rem 0.6rem',display:'flex',gap:'0.5rem',alignItems:'flex-start'}}>
                    <span style={{fontFamily:'monospace',fontSize:'0.68rem',fontWeight:700,color:col,minWidth:'11rem',flexShrink:0,lineHeight:1.5}}>{name}</span>
                    <span style={{fontSize:'0.68rem',color:'var(--text-2)',lineHeight:1.5}}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(34,211,238,0.05) 0%,rgba(167,139,250,0.05) 100%)'}}>
            <div className="m4-card-h">Population Methods — Lecture Summary</div>
            <div style={{fontFamily:'monospace',fontSize:'0.73rem',color:'var(--text-1)',lineHeight:1.9,whiteSpace:'pre-wrap',background:'var(--bg-2)',borderRadius:8,padding:'0.75rem 1rem',border:'1px solid rgba(34,211,238,0.15)'}}>
              {`Population-based Methods
│
├── Core Idea: maintain multiple candidate solutions simultaneously
│             to extract collective information about the search space
│
├── Key Concepts
│   ├── Fitness (quality), Selection, Mutation, Recombination
│   ├── Exploration vs Exploitation trade-off
│   └── Diversity maintenance vs Convergence
│
├── Evolutionary Strategies
│   ├── (μ, λ) — offspring only; parents always replaced
│   └── (μ+λ) — offspring compete with parents (more exploitative)
│
├── Adaptive / Self-Adaptive Mutation
│   ├── One-Fifth Rule (Rechenberg): pₛ > 1/5 → increase σ²
│   └── Per-individual σ (or Σ) that itself evolves with the solution
│
└── Generalisations
    ├── Single-state ≡ degenerate ES: HC=(1+1), SA≈(1+1) with acceptance
    └── Representations: vectors, trees, graphs, programs, FSAs, NNs`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dragonfly Algorithm Tab ───────────────────────────────────────────────────

const LEVY_SIGMA = 0.6966;

function ackley2D(x, y) {
  return -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y)))
       - Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)))
       + Math.E + 20;
}

function levyStep() {
  const r1 = Math.random() + 1e-9;
  const r2 = Math.random() + 1e-9;
  return 0.01 * (r1 * LEVY_SIGMA) / Math.pow(Math.abs(r2), 1 / 1.5);
}

function initDASim(n) {
  const agents = Array.from({ length: n }, () => {
    const pos = [-5 + Math.random() * 10, -5 + Math.random() * 10];
    return { pos, vel: [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5], trail: [], fitness: 0 };
  });
  agents.forEach(a => { a.fitness = ackley2D(a.pos[0], a.pos[1]); });
  let fi = 0, ei = 0;
  agents.forEach((a, i) => {
    if (a.fitness < agents[fi].fitness) fi = i;
    if (a.fitness > agents[ei].fitness) ei = i;
  });
  return { agents, iter: 0, foodIdx: fi, enemyIdx: ei, divHist: [], fitHist: [], r: 0.5 };
}

function stepDA(sim) {
  const { agents } = sim;
  const n = agents.length;
  const t = sim.iter;
  const r = 0.5 + (t / 200) * 4.5;
  const w = 0.9 - 0.7 * (t / 200);
  const a = 0.1 + 0.3 * (t / 200);
  const c = 0.7 - 0.4 * (t / 200);
  const food = agents[sim.foodIdx].pos;
  const enemy = agents[sim.enemyIdx].pos;

  const next = agents.map((ag, i) => {
    const nbrs = agents.filter((o, j) => {
      if (i === j) return false;
      const dx = o.pos[0] - ag.pos[0], dy = o.pos[1] - ag.pos[1];
      return Math.sqrt(dx * dx + dy * dy) <= r;
    });
    if (nbrs.length > 0) {
      const N = nbrs.length;
      const S = nbrs.reduce((acc, o) => [acc[0] - (ag.pos[0] - o.pos[0]), acc[1] - (ag.pos[1] - o.pos[1])], [0, 0]);
      const A = nbrs.reduce((acc, o) => [acc[0] + o.vel[0], acc[1] + o.vel[1]], [0, 0]).map(v => v / N);
      const C = [nbrs.reduce((s, o) => s + o.pos[0], 0) / N - ag.pos[0], nbrs.reduce((s, o) => s + o.pos[1], 0) / N - ag.pos[1]];
      const F = [food[0] - ag.pos[0], food[1] - ag.pos[1]];
      const E = [enemy[0] + ag.pos[0], enemy[1] + ag.pos[1]];
      const clamp = v => Math.max(-0.5, Math.min(0.5, v));
      const nv = [clamp(0.1*S[0]+a*A[0]+c*C[0]+F[0]+E[0]+w*ag.vel[0]), clamp(0.1*S[1]+a*A[1]+c*C[1]+F[1]+E[1]+w*ag.vel[1])];
      const np = [ag.pos[0]+nv[0], ag.pos[1]+nv[1]].map(v => Math.max(-5, Math.min(5, v)));
      return { pos: np, vel: nv };
    } else {
      const lx = levyStep(), ly = levyStep();
      const np = [ag.pos[0] + lx * ag.pos[0], ag.pos[1] + ly * ag.pos[1]].map(v => Math.max(-5, Math.min(5, v)));
      return { pos: np, vel: [lx * ag.pos[0], ly * ag.pos[1]] };
    }
  });

  agents.forEach((ag, i) => {
    ag.trail.push([...ag.pos]);
    if (ag.trail.length > 10) ag.trail.shift();
    ag.pos = next[i].pos;
    ag.vel = next[i].vel;
    ag.fitness = ackley2D(ag.pos[0], ag.pos[1]);
  });

  let fi = 0, ei = 0;
  agents.forEach((ag, i) => {
    if (ag.fitness < agents[fi].fitness) fi = i;
    if (ag.fitness > agents[ei].fitness) ei = i;
  });
  sim.foodIdx = fi; sim.enemyIdx = ei; sim.r = r; sim.iter++;

  let tot = 0, pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = agents[i].pos[0] - agents[j].pos[0], dy = agents[i].pos[1] - agents[j].pos[1];
    tot += Math.sqrt(dx * dx + dy * dy); pairs++;
  }
  sim.divHist.push(pairs > 0 ? tot / pairs : 0);
  sim.fitHist.push(agents[fi].fitness);
  return { w, s: 0.1, a, c, f: 1, e: 1, r };
}

function DragonflySimPanel() {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const chartRef = useRef(null);
  const simRef = useRef(null);
  const animRef = useRef(null);
  const lastTRef = useRef(0);
  const runRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [popSize, setPopSize] = useState(20);
  const [speed, setSpeed] = useState(120);
  const [exEx, setExEx] = useState(0.0);
  const [info, setInfo] = useState({ iter:0, bestFit:null, worstFit:null, bestPos:null, r:0.5, w:0.9, s:0.1, a:0.1, c:0.7, f:1, e:1 });

  runRef.current = running;

  const CW = 560, CH = 380;

  const drawBg = useCallback(() => {
    const canvas = bgRef.current;
    if (!canvas) return;
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(CW, CH);
    let minV = Infinity, maxV = -Infinity;
    const grid = new Float32Array(CW * CH);
    for (let py = 0; py < CH; py++) {
      for (let px = 0; px < CW; px++) {
        const x = -5 + (px / CW) * 10;
        const y = 5 - (py / CH) * 10;
        const v = ackley2D(x, y);
        grid[py * CW + px] = v;
        if (v < minV) minV = v; if (v > maxV) maxV = v;
      }
    }
    const range = maxV - minV;
    for (let i = 0; i < grid.length; i++) {
      const t = (grid[i] - minV) / range;
      img.data[i*4]   = Math.round(10 + t * 100);
      img.data[i*4+1] = Math.round((1-t) * 25);
      img.data[i*4+2] = Math.round(30 + (1-t) * 60);
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [CW, CH]);

  const drawFg = useCallback(() => {
    const canvas = fgRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    const { agents, foodIdx, enemyIdx, r } = sim;
    const toC = (x, y) => [(x + 5) / 10 * CW, (5 - y) / 10 * CH];
    const rPx = r / 10 * CW;

    ctx.strokeStyle = 'rgba(148,163,184,0.05)'; ctx.lineWidth = 1;
    agents.forEach(ag => {
      const [cx, cy] = toC(ag.pos[0], ag.pos[1]);
      ctx.beginPath(); ctx.arc(cx, cy, rPx, 0, Math.PI * 2); ctx.stroke();
    });

    agents.forEach((ag, i) => {
      const col = CYBER_COLS[i % CYBER_COLS.length];
      for (let ti = 1; ti < ag.trail.length; ti++) {
        const alpha = Math.round((ti / ag.trail.length) * 55).toString(16).padStart(2,'0');
        const [x0, y0] = toC(ag.trail[ti-1][0], ag.trail[ti-1][1]);
        const [x1, y1] = toC(ag.trail[ti][0], ag.trail[ti][1]);
        ctx.strokeStyle = col + alpha; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    });

    const [fx, fy] = toC(agents[foodIdx].pos[0], agents[foodIdx].pos[1]);
    const p1 = 2 * Math.sin(Date.now() / 380);
    ctx.save(); ctx.shadowColor = '#4caf50'; ctx.shadowBlur = 12 + p1;
    ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('F', fx, fy + 3);

    const [ex2, ey] = toC(agents[enemyIdx].pos[0], agents[enemyIdx].pos[1]);
    const p2 = 2 * Math.sin(Date.now() / 380 + Math.PI);
    ctx.save(); ctx.shadowColor = '#e57373'; ctx.shadowBlur = 12 + p2;
    ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.arc(ex2, ey, 7, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('E', ex2, ey + 3);

    agents.forEach((ag, i) => {
      if (i === foodIdx || i === enemyIdx) return;
      const [cx, cy] = toC(ag.pos[0], ag.pos[1]);
      const ang = Math.atan2(-ag.vel[1], ag.vel[0]);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = CYBER_COLS[i % CYBER_COLS.length];
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 4); ctx.lineTo(-3, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }, [CW, CH]);

  const drawChart = useCallback(() => {
    const canvas = chartRef.current;
    const sim = simRef.current;
    if (!canvas || !sim || sim.divHist.length < 2) return;
    const W = canvas.width = canvas.offsetWidth || 560;
    const H = canvas.height = 90;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const PAD = { l: 30, r: 10, t: 6, b: 20 };
    const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
    ctx.strokeStyle = 'rgba(148,163,184,0.06)'; ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const y = PAD.t + g/3 * iH;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l+iW, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(148,163,184,0.4)'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText('0', PAD.l, PAD.t+iH+12); ctx.fillText('200', PAD.l+iW, PAD.t+iH+12);
    const plotLine = (data, maxV, col) => {
      if (data.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      data.forEach((v, i) => {
        const x = PAD.l + (i / 199) * iW, y = PAD.t + (1 - Math.min(v/maxV,1)) * iH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    const maxD = Math.max(...sim.divHist, 0.001);
    const maxF = Math.max(...sim.fitHist, 0.001);
    plotLine(sim.divHist, maxD, '#6c8ebf');
    plotLine(sim.fitHist, maxF, '#fbbf24');
  }, []);

  const doStep = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.iter >= 200) return;
    const wts = stepDA(sim);
    drawFg(); drawChart();
    setInfo({
      iter: sim.iter, bestFit: sim.agents[sim.foodIdx].fitness,
      worstFit: sim.agents[sim.enemyIdx].fitness,
      bestPos: [...sim.agents[sim.foodIdx].pos],
      r: wts.r, w: wts.w, s: wts.s, a: wts.a, c: wts.c, f: wts.f, e: wts.e,
    });
  }, [drawFg, drawChart]);

  const animate = useCallback(() => {
    if (!runRef.current) return;
    const now = Date.now();
    if (now - lastTRef.current >= speed) {
      const sim = simRef.current;
      if (sim && sim.iter < 200) { doStep(); lastTRef.current = now; }
      else { setRunning(false); }
    }
    animRef.current = requestAnimationFrame(animate);
  }, [speed, doStep]);

  useEffect(() => {
    if (running) {
      lastTRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [running, animate]);

  const doReset = useCallback((n) => {
    setRunning(false);
    runRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    simRef.current = initDASim(n ?? popSize);
    setInfo({ iter:0, bestFit:null, worstFit:null, bestPos:null, r:0.5, w:0.9, s:0.1, a:0.1, c:0.7, f:1, e:1 });
    requestAnimationFrame(() => { drawFg(); drawChart(); });
  }, [popSize, drawFg, drawChart]);

  useEffect(() => {
    if (fgRef.current) { fgRef.current.width = CW; fgRef.current.height = CH; }
    drawBg();
    doReset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aEff = (0.1 + exEx * 0.3).toFixed(2);
  const cEff = (0.7 - exEx * 0.4).toFixed(2);

  return (
    <div>
      <div className="m4-card" style={{marginBottom:'1rem'}}>
        <div className="m4-card-h">EXPLORATION ←→ EXPLOITATION WEIGHT VISUALISER</div>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.4rem'}}>
          <span style={{fontSize:'0.72rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>← Exploration</span>
          <input type="range" min={0} max={1} step={0.01} value={exEx} onChange={e=>setExEx(+e.target.value)} style={{flex:1}} />
          <span style={{fontSize:'0.72rem',color:'var(--text-2)',whiteSpace:'nowrap'}}>Exploitation →</span>
        </div>
        <div style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text-1)',background:'rgba(34,211,238,0.05)',border:'1px solid rgba(34,211,238,0.15)',borderRadius:4,padding:'0.45rem 0.75rem',lineHeight:2.1}}>
          ΔX(t+1) = (<span style={{color:'#e57373'}}>0.10</span>·Sᵢ + <span style={{color:'#6c8ebf',fontWeight:700}}>{aEff}</span>·Aᵢ + <span style={{color:'#a78bfa',fontWeight:700}}>{cEff}</span>·Cᵢ + <span style={{color:'#4caf50'}}>1.00</span>·Fᵢ + <span style={{color:'#fbbf24'}}>1.00</span>·Eᵢ) + w·ΔX(t)
          <br/>
          <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>
            alignment a={aEff} {exEx < 0.5 ? '(low — fragmented exploration, static swarm mode)' : '(higher — coordinated movement, dynamic swarm mode)'}
            &nbsp;·&nbsp;cohesion c={cEff} {exEx < 0.5 ? '(high — stays grouped over local area)' : '(lower — spreads toward optimum)'}
          </span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 210px',gap:'1rem',alignItems:'start',marginBottom:'1rem'}}>
        <div>
          <div style={{position:'relative',lineHeight:0,borderRadius:8,overflow:'hidden',border:'1px solid rgba(34,211,238,0.15)'}}>
            <canvas ref={bgRef} style={{display:'block'}} />
            <canvas ref={fgRef} style={{position:'absolute',top:0,left:0}} width={CW} height={CH} />
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.6rem',alignItems:'center'}}>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>setRunning(r=>!r)}>
              {running ? '⏸ Pause' : '▶ Run'}
            </button>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>doReset()}>↺ Reset</button>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>{if(!running)doStep();}}>⏭ Step</button>
            <span style={{marginLeft:'auto',fontFamily:'monospace',fontSize:'0.72rem',color:'var(--text-2)'}}>
              Iter: <span style={{color:'var(--cyan)'}}>{info.iter}</span> / 200
            </span>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.4rem',alignItems:'center'}}>
            <span style={{fontSize:'0.7rem',color:'var(--text-2)'}}>Speed:</span>
            <input type="range" min={30} max={500} value={speed} onChange={e=>setSpeed(+e.target.value)} style={{width:90}} />
            <span style={{fontSize:'0.7rem',color:'var(--text-2)',fontFamily:'monospace',minWidth:55}}>{speed}ms/step</span>
            <span style={{fontSize:'0.7rem',color:'var(--text-2)',marginLeft:'0.5rem'}}>Pop:</span>
            <input type="range" min={5} max={40} value={popSize} onChange={e=>{const n=+e.target.value;setPopSize(n);doReset(n);}} style={{width:70}} />
            <span style={{fontSize:'0.7rem',color:'var(--cyan)',fontFamily:'monospace'}}>{popSize}</span>
          </div>
        </div>

        <div className="m4-card" style={{margin:0,padding:'0.85rem',fontSize:'0.72rem'}}>
          <div className="m4-card-h" style={{fontSize:'0.64rem',marginBottom:'0.55rem'}}>LIVE STATE</div>
          {[['Best fitness', info.bestFit!=null?info.bestFit.toFixed(4):'—','var(--emerald)'],
            ['Worst fitness', info.worstFit!=null?info.worstFit.toFixed(4):'—','var(--rose)'],
            ['Best (x,y)', info.bestPos?`${info.bestPos[0].toFixed(2)},${info.bestPos[1].toFixed(2)}`:'—','var(--cyan)'],
            ['Radius r', info.r.toFixed(3),'var(--violet)'],
          ].map(([l,v,col])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:'0.3rem',gap:'0.25rem'}}>
              <span style={{color:'var(--text-2)',fontSize:'0.67rem'}}>{l}</span>
              <span style={{color:col,fontFamily:'monospace',fontSize:'0.67rem'}}>{v}</span>
            </div>
          ))}
          <div style={{borderTop:'1px solid var(--border)',marginTop:'0.5rem',paddingTop:'0.45rem'}}>
            <div style={{fontSize:'0.62rem',color:'var(--text-2)',fontFamily:'monospace',letterSpacing:'0.09em',marginBottom:'0.3rem'}}>WEIGHTS</div>
            {[['w (inertia)',info.w,'var(--text-1)'],['s (sep)',info.s,'#e57373'],['a (align)',info.a,'#6c8ebf'],['c (cohes)',info.c,'#a78bfa'],['f (food)',info.f,'#4caf50'],['e (enemy)',info.e,'#fbbf24']].map(([l,v,col])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:'0.2rem'}}>
                <span style={{color:'var(--text-2)',fontSize:'0.63rem'}}>{l}</span>
                <span style={{color:col,fontFamily:'monospace',fontSize:'0.63rem'}}>{v!=null?v.toFixed(3):'—'}</span>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid var(--border)',marginTop:'0.5rem',paddingTop:'0.45rem',display:'flex',flexDirection:'column',gap:'0.18rem'}}>
            <span style={{fontSize:'0.63rem',color:'#4caf50'}}>● Food — global best</span>
            <span style={{fontSize:'0.63rem',color:'#e57373'}}>● Enemy — global worst</span>
            <span style={{fontSize:'0.63rem',color:'rgba(34,211,238,0.7)'}}>▶ Dragonfly agents</span>
            <span style={{fontSize:'0.63rem',color:'rgba(148,163,184,0.4)'}}>○ Neighbourhood r</span>
            <span style={{fontSize:'0.63rem',color:'rgba(148,163,184,0.3)'}}>━ Trail (last 10 steps)</span>
          </div>
        </div>
      </div>

      <div className="m4-card">
        <div className="m4-card-h">DIVERSITY VS CONVERGENCE OVER TIME</div>
        <div style={{display:'flex',gap:'1.25rem',marginBottom:'0.3rem',fontSize:'0.7rem'}}>
          <span style={{color:'#6c8ebf'}}>■ Avg agent spread (diversity)</span>
          <span style={{color:'#fbbf24'}}>■ Best fitness (convergence)</span>
        </div>
        <canvas ref={chartRef} className="m4-canvas" height="90" />
      </div>
    </div>
  );
}

function DragonflyTab() {
  const [sec, setSec] = useState('explainer');

  return (
    <div>
      <div className="m4-algo-tabs">
        {[['explainer','How It Works'],['simulation','Live Simulation'],['qa','Synopsis Q&A'],['paper','Paper Structure']].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'explainer' && (
        <div>
          <div className="m4-card">
            <div className="m4-card-h">BIOLOGICAL INSPIRATION — TWO SWARMING MODES</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'0.9rem'}}>
              <div style={{background:'rgba(108,142,191,0.08)',border:'1px solid rgba(108,142,191,0.25)',borderRadius:8,padding:'0.85rem'}}>
                <div style={{fontSize:'0.72rem',fontFamily:'monospace',color:'#6c8ebf',fontWeight:700,letterSpacing:'0.1em',marginBottom:'0.4rem'}}>STATIC SWARM — Hunting</div>
                <div style={{fontFamily:'monospace',fontSize:'0.88rem',color:'rgba(148,163,184,0.5)',lineHeight:1.85,marginBottom:'0.5rem',whiteSpace:'pre'}}>{'  ✦    ✦\n✦   ✦    ✦\n  ✦    ✦\n✦   ✦    ✦'}</div>
                <div style={{fontSize:'0.76rem',color:'var(--text-1)',marginBottom:'0.4rem'}}>Small groups flying back-and-forth over a small area to hunt prey</div>
                <div style={{fontSize:'0.72rem',color:'#6c8ebf',fontWeight:600}}>→ Maps to EXPLORATION in optimisation</div>
              </div>
              <div style={{background:'rgba(76,175,80,0.08)',border:'1px solid rgba(76,175,80,0.25)',borderRadius:8,padding:'0.85rem'}}>
                <div style={{fontSize:'0.72rem',fontFamily:'monospace',color:'#4caf50',fontWeight:700,letterSpacing:'0.1em',marginBottom:'0.4rem'}}>DYNAMIC SWARM — Migration</div>
                <div style={{fontFamily:'monospace',fontSize:'0.88rem',color:'rgba(148,163,184,0.5)',lineHeight:1.85,marginBottom:'0.5rem',whiteSpace:'pre'}}>{'✦ ✦ ✦ ✦ ✦ ✦ →\n ✦ ✦ ✦ ✦ ✦  →\n✦ ✦ ✦ ✦ ✦ ✦ →'}</div>
                <div style={{fontSize:'0.76rem',color:'var(--text-1)',marginBottom:'0.4rem'}}>Massive group flying in one direction over long distances</div>
                <div style={{fontSize:'0.72rem',color:'#4caf50',fontWeight:600}}>→ Maps to EXPLOITATION in optimisation</div>
              </div>
            </div>
            <div className="m4-infobox">
              Unlike PSO which blurs these phases, DA explicitly switches between them by adjusting <strong>alignment weight</strong> (high → more coordinated, exploitation) and <strong>cohesion weight</strong> (high → tighter grouping) as the neighbourhood radius grows over iterations.
            </div>
          </div>

          <div className="m4-card">
            <div className="m4-card-h">THE FIVE BEHAVIOURAL OPERATORS</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.65rem',marginBottom:'0.85rem'}}>
              {[
                {n:'1',name:'Separation',col:'#e57373',formula:'Sᵢ = −∑(X − Xⱼ)',plain:'Push away from neighbours to avoid crowding',role:'Maintains diversity'},
                {n:'2',name:'Alignment',col:'#6c8ebf',formula:'Aᵢ = (∑Vⱼ) / N',plain:'Match the velocity of nearby dragonflies',role:'Coordinates movement'},
                {n:'3',name:'Cohesion',col:'#a78bfa',formula:'Cᵢ = (∑Xⱼ)/N − X',plain:'Move toward the neighbourhood centre of mass',role:'Groups the swarm'},
                {n:'4',name:'Food Attraction',col:'#4caf50',formula:'Fᵢ = X⁺ − X',plain:'Steer toward the best solution found so far',role:'Exploitation pull'},
                {n:'5',name:'Enemy Distraction',col:'#fbbf24',formula:'Eᵢ = X⁻ + X',plain:'Steer away from the worst solution found so far',role:'Avoids bad regions'},
              ].map(op=>(
                <div key={op.n} style={{background:'var(--bg-2)',border:`1px solid ${op.col}33`,borderRadius:7,padding:'0.75rem',borderLeft:`3px solid ${op.col}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginBottom:'0.35rem'}}>
                    <span style={{fontFamily:'monospace',fontSize:'0.65rem',fontWeight:700,color:op.col,background:`${op.col}22`,borderRadius:12,padding:'1px 6px'}}>{op.n}</span>
                    <span style={{fontWeight:700,fontSize:'0.78rem',color:'var(--text-0)'}}>{op.name}</span>
                  </div>
                  <div style={{fontFamily:'monospace',fontSize:'0.73rem',color:op.col,marginBottom:'0.35rem',background:`${op.col}0f`,padding:'3px 6px',borderRadius:3}}>{op.formula}</div>
                  <div style={{fontSize:'0.73rem',color:'var(--text-1)',marginBottom:'0.3rem'}}>{op.plain}</div>
                  <div style={{fontSize:'0.67rem',color:'var(--text-2)',fontStyle:'italic'}}>Role: {op.role}</div>
                </div>
              ))}
            </div>
            <div style={{background:'rgba(34,211,238,0.05)',border:'1px solid rgba(34,211,238,0.18)',borderRadius:5,padding:'0.65rem 0.9rem',fontFamily:'monospace',fontSize:'0.76rem',color:'var(--text-1)',lineHeight:2}}>
              <span style={{color:'var(--text-2)'}}>{'// Combined step update (Eq. 3.6 / 3.7):'}</span><br/>
              ΔX(t+1) = (<span style={{color:'#e57373'}}>s</span>·Sᵢ + <span style={{color:'#6c8ebf'}}>a</span>·Aᵢ + <span style={{color:'#a78bfa'}}>c</span>·Cᵢ + <span style={{color:'#4caf50'}}>f</span>·Fᵢ + <span style={{color:'#fbbf24'}}>e</span>·Eᵢ) + <span style={{color:'var(--cyan)'}}>w</span>·ΔX(t)<br/>
              X(t+1) = X(t) + ΔX(t+1)<br/>
              <span style={{fontSize:'0.68rem',color:'var(--text-2)'}}>w decays 0.9→0.2 over iterations &nbsp;|&nbsp; Isolated agents: X(t+1) = X(t) + Lévy(d)·X(t)</span>
            </div>
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">ADAPTIVE WEIGHT SCHEDULE</div>
              <div style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text-1)',lineHeight:2.1,background:'rgba(34,211,238,0.04)',borderRadius:5,padding:'0.6rem 0.9rem',border:'1px solid rgba(34,211,238,0.12)'}}>
                <span style={{color:'var(--text-2)'}}>{'// Linear schedules, t ∈ [0, 200]'}</span><br/>
                <span style={{color:'var(--cyan)'}}>w</span> = 0.9 − 0.7·(t/200) <span style={{color:'var(--text-2)'}}>→ 0.9→0.2</span><br/>
                <span style={{color:'#6c8ebf'}}>a</span> = 0.1 + 0.3·(t/200) <span style={{color:'var(--text-2)'}}>→ 0.1→0.4 (alignment)</span><br/>
                <span style={{color:'#a78bfa'}}>c</span> = 0.7 − 0.4·(t/200) <span style={{color:'var(--text-2)'}}>→ 0.7→0.3 (cohesion)</span><br/>
                <span style={{color:'#e57373'}}>s</span> = 0.1 <span style={{color:'var(--text-2)'}}>constant (separation)</span><br/>
                <span style={{color:'#4caf50'}}>f</span> = 1.0 <span style={{color:'var(--text-2)'}}>constant (food)</span><br/>
                <span style={{color:'#fbbf24'}}>e</span> = 1.0 <span style={{color:'var(--text-2)'}}>constant (enemy)</span>
              </div>
              <div className="m4-infobox" style={{marginTop:'0.75rem',fontSize:'0.77rem'}}>
                Neighbourhood radius grows 0.5→5.0 simultaneously, transitioning the swarm from fragmented local search to cohesive convergence toward the global optimum.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">ALGORITHM PSEUDOCODE</div>
              <div className="m4-pseudocode">{`Initialize X_i, ΔX_i (i = 1..N)

while iter < max_iter:
  Evaluate fitness(X_i) for all i
  Update food (best) and enemy (worst)
  Update w, s, a, c, f, e
  Update neighbourhood radius r

  for each dragonfly i:
    Find neighbours within radius r

    if neighbours ≥ 1:
      Compute S, A, C, F, E
      ΔX ← s·S + a·A + c·C + f·F + e·E + w·ΔX
      X  ← X + ΔX
    else:
      X  ← X + Levy(d)·X   [random walk]

    Clamp X to [lower, upper]`}</div>
            </div>
          </div>

          <div className="m4-card">
            <div className="m4-card-h">VARIANTS</div>
            {[
              {title:'Binary DA (BDA)', col:'#6c8ebf', body:<div style={{fontSize:'0.77rem',color:'var(--text-1)',lineHeight:1.75}}>
                <p><strong>Problem:</strong> Positions can only be 0 or 1 — step vectors cannot be added directly.</p>
                <p><strong>Solution:</strong> V-shaped transfer function converts step value → flip probability:</p>
                <div style={{fontFamily:'monospace',fontSize:'0.75rem',color:'#6c8ebf',background:'rgba(108,142,191,0.08)',padding:'0.35rem 0.65rem',borderRadius:4,margin:'0.35rem 0'}}>T(Δx) = |Δx / √(Δx² + 1)|</div>
                <p>V-shaped (not S-shaped) avoids forcing convergence to 0 or 1 extremes. <em style={{color:'var(--text-2)'}}>Use case: feature selection, binary combinatorial problems.</em></p>
              </div>},
              {title:'Multi-Objective DA (MODA)', col:'#4caf50', body:<div style={{fontSize:'0.77rem',color:'var(--text-1)',lineHeight:1.75}}>
                <p><strong>Problem:</strong> Multiple conflicting objectives → Pareto front needed instead of a single best.</p>
                <p><strong>Addition:</strong> Pareto archive stores all non-dominated solutions. A hypersphere grid partitions objective space:</p>
                <ul style={{paddingLeft:'1.2rem',margin:'0.3rem 0'}}>
                  <li>Food selected from <em>least populated</em> segment → improves Pareto front coverage</li>
                  <li>Enemy selected from <em>most populated</em> segment → avoids revisiting dense regions</li>
                </ul>
                <p style={{color:'var(--text-2)',fontSize:'0.73rem'}}>Outperforms NSGA-II; applied to 20-variable submarine propeller design (61 Pareto solutions).</p>
              </div>},
              {title:'Lévy Flight', col:'#fbbf24', body:<div style={{fontSize:'0.77rem',color:'var(--text-1)',lineHeight:1.75}}>
                <p><strong>Purpose:</strong> Isolated dragonflies (no neighbours) use a heavy-tailed random walk instead of swarm rules.</p>
                <div style={{fontFamily:'monospace',fontSize:'0.74rem',color:'#fbbf24',background:'rgba(251,191,36,0.08)',padding:'0.35rem 0.65rem',borderRadius:4,margin:'0.35rem 0'}}>
                  Levy(λ) = 0.01 × r₁·σ / |r₂|^(1/β) &nbsp; β=1.5, σ=0.6966
                </div>
                <p>Heavy tails → occasional large jumps prevent stagnation during early fragmented exploration when neighbourhood radius is still small.</p>
              </div>},
            ].map(v=>(
              <details key={v.title} style={{borderBottom:'1px solid var(--border)',paddingBottom:'0.4rem',marginBottom:'0.35rem'}}>
                <summary style={{cursor:'pointer',fontWeight:700,fontSize:'0.79rem',color:v.col,padding:'0.45rem 0',userSelect:'none'}}>▶ {v.title}</summary>
                <div style={{paddingTop:'0.4rem',paddingLeft:'0.5rem'}}>{v.body}</div>
              </details>
            ))}
          </div>
        </div>
      )}

      {sec === 'simulation' && (
        <div>
          <div className="m4-sec-hdr" style={{marginBottom:'1rem'}}>
            <h2 className="m4-sec-title" style={{fontSize:'1rem'}}>Live 2D Simulation <span className="m4-badge">Ackley Function Landscape</span></h2>
            <p className="m4-sec-sub">20 dragonflies searching the Ackley function (global minimum at origin). Dark = low fitness (good). Watch the swarm transition from fragmented exploration to cohesive convergence as the neighbourhood radius grows.</p>
          </div>
          <DragonflySimPanel />
        </div>
      )}

      {sec === 'qa' && (
        <div>
          <div className="m4-card" style={{background:'rgba(108,142,191,0.06)',border:'1px solid rgba(108,142,191,0.2)',marginBottom:'1rem'}}>
            <div style={{fontSize:'0.78rem',color:'var(--text-2)'}}>Six standard review questions from the CITS4404 Part 1 assignment synopsis, answered with reference to the paper. Each answer is drawn directly from the paper content.</div>
          </div>
          {[
            {n:'1',col:'#6c8ebf',q:'What problem with existing algorithms is the new algorithm attempting to solve?',
             a:`The Dragonfly Algorithm targets continuous, binary, and multi-objective optimisation. Its motivation is twofold. First, despite an extensive body of SI research (PSO, ACO, ABC), the swarming behaviour of dragonflies had never been computationally modelled — a gap in the literature representing a potential source of novel algorithmic behaviour. Second, the No Free Lunch theorem guarantees that no single algorithm is universally optimal, so a genuinely distinct algorithm can outperform existing ones on classes of problems where they are weak. The paper positions DA not as a replacement for PSO but as a complementary tool in the optimisation toolkit.`,
             ref:'Section 1 (Introduction) and Section 1.3 (Motivation for the Dragonfly Algorithm)'},
            {n:'2',col:'#8e6cbf',q:'Why, or in what respect, have previous attempts failed?',
             a:`Existing SI algorithms each capture only a subset of the behavioural repertoire relevant to swarm survival. PSO tracks only personal and global bests (analogous to food attraction and a weak form of cohesion). Several improved PSO variants added separation, alignment, or cohesion operators individually but none unified all five survival behaviours. More critically, no prior algorithm formally distinguished between the two qualitatively different modes of dragonfly swarming: static hunting swarms (small, back-and-forth — mapping to exploration) and dynamic migratory swarms (large, unidirectional — mapping to exploitation). This distinction allows DA to adapt its exploration/exploitation balance more explicitly than PSO's single velocity update rule permits. The absence of an enemy mechanism in standard PSO also means agents are pulled toward good regions but never explicitly pushed away from bad ones.`,
             ref:'Section 1.1 (Existing SI Algorithms) and Section 1.2 (Advantages of SI-based Algorithms)'},
            {n:'3',col:'#4caf50',q:'What is the new idea presented in this paper?',
             a:`DA introduces five behavioural operators — separation, alignment, cohesion, food attraction, and enemy distraction — combined into a single step vector update. The key novelties are: (1) the explicit enemy operator that steers agents away from the current worst solution, which has no direct equivalent in PSO; (2) the distinction between static and dynamic swarming modes, implemented by adaptively tuning alignment weight (high → exploitation) and cohesion weight while growing the neighbourhood radius over time; and (3) Lévy flight as a fallback for isolated agents, giving heavy-tailed random steps to avoid stagnation. Two variants extend DA: the Binary DA (BDA) uses a v-shaped transfer function to handle binary search spaces, and the Multi-Objective DA (MODA) adds a Pareto archive with a hypersphere grid selection mechanism that balances convergence and coverage.`,
             ref:'Section 2 (Inspiration), Section 3.1–3.5 (Mathematical models), Section 3.7 (BDA), Section 3.8 (MODA)'},
            {n:'4',col:'#ff9800',q:'How is the new approach demonstrated?',
             a:`The paper demonstrates DA through three experiment sets. For the continuous DA, 19 benchmark functions are used: 7 unimodal (testing convergence/exploitation), 6 multimodal (testing exploration/local-optima avoidance), and 6 composite (shifted, rotated, combined functions that mimic real search spaces). Each is evaluated with 30 agents over 500 iterations, repeated 30 times, with PSO and GA as baselines. Statistical significance is assessed via the Wilcoxon rank-sum test. For BDA, the same 13 functions are encoded into 75 binary variables and compared against BPSO and BGSA. For MODA, five ZDT benchmark functions plus a real 20-variable submarine propeller design problem are solved and compared against MOPSO and NSGA-II using Inverse Generalised Distance (IGD). The paper provides full pseudocode, parameter values, and benchmark definitions in appendices, and source code is publicly available — sufficient for replication.`,
             ref:'Section 4.1 (DA results setup), Section 4.2 (BDA setup), Section 4.3 (MODA setup), Section 4.4 (propeller case study), Appendices 1–2'},
            {n:'5',col:'#e57373',q:'What are the results or outcomes and how are they validated?',
             a:`DA achieves the best or joint-best result on 13 of 19 single-objective benchmark functions. Against GA, differences are statistically significant on nearly all functions. Against PSO, DA is superior on most unimodal functions but the advantage is not significant on several multimodal cases, suggesting comparable exploration ability. A notable exception is TF8 (Schwefel function) where PSO strongly outperforms DA — the only systematic weakness identified. On composite functions the advantage over PSO is inconsistent. BDA outperforms BPSO and BGSA on 11 of 13 binary functions with strong statistical significance. MODA consistently beats NSGA-II by a large margin and outperforms MOPSO on ZDT3 and the three-objective test case. The submarine propeller problem yielded 61 well-distributed Pareto optimal solutions. Four behavioural diagnostics (search history, trajectory, average fitness, convergence curve) provide qualitative confirmation of the algorithm's convergence properties.`,
             ref:'Section 4.1 (Tables 1–2), Section 4.2 (Tables 3–4), Section 4.3 (Tables 5–9), Section 4.4 (propeller results)'},
            {n:'6',col:'#78909c',q:'What is your assessment of the conclusions?',
             a:`The core claims — that DA is a competitive single-objective optimiser and that BDA and MODA outperform their respective comparators — are largely substantiated. The methodology is sound: multiple runs, statistical testing, and diverse benchmark coverage all follow standard practice. However, three caveats limit the strength of the claims. First, the comparison set is narrow: only PSO and GA are used as single-objective baselines, omitting contemporary algorithms like Differential Evolution or Grey Wolf Optimiser. Second, DA's advantage over PSO on composite functions is modest and statistically insignificant in several cases, which matters given that composite functions best resemble real-world landscapes. Third, the propeller design case study cannot be verified against a known Pareto front. Overall the conclusions are justified within the scope of the experiments, but the paper would benefit from a wider baseline comparison. For this assignment, DA is a strong candidate for Part 2: the explicit food/enemy mechanism and five-operator framework translate naturally to continuous parameter search, and the algorithm is straightforward to implement from the pseudocode.`,
             ref:'Section 4 (Discussion throughout), Section 5 (Conclusion), Section 1.3 (NFL motivation)'},
          ].map(card=>(
            <details key={card.n} open style={{marginBottom:'0.75rem',background:'var(--surface)',border:`1px solid ${card.col}33`,borderRadius:8,overflow:'hidden',borderLeft:`4px solid ${card.col}`}}>
              <summary style={{cursor:'pointer',padding:'0.85rem 1.1rem',display:'flex',alignItems:'flex-start',gap:'0.65rem',userSelect:'none'}}>
                <span style={{flexShrink:0,width:22,height:22,borderRadius:'50%',background:card.col,color:'#fff',fontFamily:'monospace',fontWeight:700,fontSize:'0.72rem',display:'flex',alignItems:'center',justifyContent:'center'}}>{card.n}</span>
                <span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--text-0)',lineHeight:1.4}}>{card.q}</span>
              </summary>
              <div style={{padding:'0 1.1rem 1rem 1.1rem'}}>
                <p style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.75,margin:'0 0 0.65rem 0'}}>{card.a}</p>
                <div style={{fontSize:'0.69rem',color:card.col,fontFamily:'monospace',background:`${card.col}12`,display:'inline-block',padding:'2px 8px',borderRadius:4}}>📄 {card.ref}</div>
              </div>
            </details>
          ))}
        </div>
      )}

      {sec === 'paper' && (
        <div>
          <div className="m4-card">
            <div className="m4-card-h">PAPER STRUCTURE MAP</div>
            <div style={{fontSize:'0.76rem',color:'var(--text-2)',marginBottom:'0.85rem'}}>
              Mirjalili, S. (2016). Dragonfly algorithm: a new meta-heuristic optimization technique. <em>Neural Computing and Applications</em>, 27, 1053–1073. DOI: 10.1007/s00521-015-1920-1
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="m4-rule-tbl" style={{fontSize:'0.75rem',width:'100%'}}>
                <thead>
                  <tr><th style={{width:'14%'}}>Section</th><th style={{width:'24%'}}>Title</th><th>Contents</th></tr>
                </thead>
                <tbody>
                  {[
                    ['1','Introduction','Motivation, existing SI algorithms (ACO, PSO, ABC), No Free Lunch theorem'],
                    ['2','Inspiration','Dragonfly biology, static vs dynamic swarming, mapping to exploration/exploitation'],
                    ['3.1–3.5','DA — Operators','Five operators (S,A,C,F,E), step/position equations, adaptive weights, Lévy flight'],
                    ['3.6','DA Pseudocode','Full algorithm with neighbourhood radius logic and boundary clamping'],
                    ['3.7','Binary DA (BDA)','V-shaped transfer function, binary position update rule, neighbourhood handling'],
                    ['3.8','MODA','Pareto archive, hypersphere grid, food/enemy selection probabilities, archive management rules'],
                    ['4.1','DA Results','19 benchmark functions (7 unimodal + 6 multimodal + 6 composite) vs PSO and GA'],
                    ['4.2','BDA Results','13 binary benchmark functions vs BPSO and BGSA — Wilcoxon rank-sum test'],
                    ['4.3','MODA Results','5 ZDT functions vs MOPSO and NSGA-II — IGD metric, qualitative Pareto fronts'],
                    ['4.4','Real Case Study','Submarine propeller design: 20 variables, 2 objectives, 61 Pareto solutions'],
                    ['5','Conclusions','Summary of findings, convergence observations, future research directions'],
                    ['App. 1','Benchmark Definitions','Formulas for all 19 single-objective test functions'],
                    ['App. 2','ZDT Definitions','Formulas for all 5 multi-objective ZDT test functions'],
                  ].map(([s,t,c])=>(
                    <tr key={s}>
                      <td><span style={{fontFamily:'monospace',color:'var(--cyan)',fontWeight:600}}>{s}</span></td>
                      <td style={{fontWeight:600,color:'var(--text-0)'}}>{t}</td>
                      <td style={{color:'var(--text-2)'}}>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">BENCHMARK RESULTS SUMMARY</div>
              <table className="m4-rule-tbl" style={{fontSize:'0.74rem',width:'100%'}}>
                <thead><tr><th>Setting</th><th>Comparators</th><th>DA Outcome</th></tr></thead>
                <tbody>
                  <tr><td>Continuous (19 fns)</td><td>PSO, GA</td><td style={{color:'var(--emerald)'}}>Best on 13 / 19</td></tr>
                  <tr><td>Binary (13 fns)</td><td>BPSO, BGSA</td><td style={{color:'var(--emerald)'}}>Best on 11 / 13</td></tr>
                  <tr><td>Multi-objective (5 ZDT)</td><td>MOPSO, NSGA-II</td><td style={{color:'var(--emerald)'}}>Beats NSGA-II; comp. vs MOPSO</td></tr>
                  <tr><td>Propeller design</td><td>—</td><td style={{color:'var(--cyan)'}}>61 Pareto solutions</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.75rem',fontSize:'0.76rem'}}>
                <strong>Notable exception:</strong> TF8 (Schwefel function) — PSO strongly outperforms DA. The only systematic weakness, consistent with the No Free Lunch theorem.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">CRITICAL ASSESSMENT</div>
              <ul className="m4-bullets">
                <li><strong>Strengths:</strong> Sound methodology — 30 runs, Wilcoxon testing, diverse benchmarks, public source code, three fully developed variants.</li>
                <li><strong>Limitation 1:</strong> Narrow baseline — only PSO and GA for continuous DA; no Differential Evolution or Grey Wolf Optimiser.</li>
                <li><strong>Limitation 2:</strong> Composite function advantage over PSO is modest and often statistically insignificant.</li>
                <li><strong>Limitation 3:</strong> Propeller design has no known true Pareto front for independent verification.</li>
                <li><strong>Verdict:</strong> Claims justified within experimental scope. Strong Part 2 candidate — food/enemy mechanism translates naturally to trading bot weight optimisation.</li>
              </ul>
            </div>
          </div>

          <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:6,padding:'0.7rem 1rem',fontSize:'0.71rem',color:'var(--text-2)',fontFamily:'monospace',lineHeight:2}}>
            Paper: Mirjalili, S. (2016). Dragonfly algorithm. Neural Computing and Applications, 27, 1053–1073.<br/>
            Source code: http://www.alimirjalili.com/DA.html &nbsp;|&nbsp; Built for CITS4404 — University of Western Australia, 2026
          </div>
        </div>
      )}
    </div>
  );
}

// ── Genetic Algorithms (Lecture 11) ───────────────────────────────────────────

function randBits(n) {
  return Array.from({ length: n }, () => Math.random() < 0.5 ? 1 : 0);
}

function CrossoverCell({ v, swapped, parent }) {
  return (
    <div style={{
      width: 22, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700,
      color: swapped ? (parent === 'A' ? '#22d3ee' : '#fb7185') : 'var(--text-1)',
      background: swapped ? (parent === 'A' ? 'rgba(34,211,238,0.18)' : 'rgba(251,113,133,0.18)') : 'var(--bg-2)',
      border: `1px solid ${swapped ? (parent === 'A' ? 'rgba(34,211,238,0.5)' : 'rgba(251,113,133,0.5)') : 'rgba(148,163,184,0.18)'}`,
      borderRadius: 4, margin: 1,
    }}>{v}</div>
  );
}

function CrossoverRow({ label, bits, mask, parent, color }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.4rem'}}>
      <span style={{fontFamily:'monospace',fontSize:'0.7rem',color,minWidth:60,fontWeight:700}}>{label}</span>
      <div style={{display:'flex'}}>
        {bits.map((v, i) => <CrossoverCell key={i} v={v} swapped={mask[i]} parent={parent} />)}
      </div>
    </div>
  );
}

function CrossoverViz() {
  const L = 16;
  const [type, setType] = useState('one');
  const [c, setC] = useState(6);
  const [d, setD] = useState(12);
  const [pUnif, setPUnif] = useState(0.5);
  const [a, setA] = useState(() => Array(L).fill(1));
  const [b, setB] = useState(() => Array(L).fill(0));
  const [tick, setTick] = useState(0);

  const swapMask = (() => {
    const m = Array(L).fill(false);
    if (type === 'one') {
      for (let i = c; i < L; i++) m[i] = true;
    } else if (type === 'two') {
      const lo = Math.min(c, d), hi = Math.max(c, d);
      for (let i = lo; i < hi; i++) m[i] = true;
    } else {
      const seed = tick;
      let r = seed * 9301 + 49297;
      for (let i = 0; i < L; i++) {
        r = (r * 9301 + 49297) % 233280;
        m[i] = (r / 233280) < pUnif;
      }
    }
    return m;
  })();

  const childA = a.map((v, i) => swapMask[i] ? b[i] : v);
  const childB = b.map((v, i) => swapMask[i] ? a[i] : v);

  return (
    <div className="m4-card">
      <div className="m4-card-h">CROSSOVER VISUALISER — Algorithms 23, 24, 25</div>
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.7rem',flexWrap:'wrap'}}>
        {[['one','One-Point'],['two','Two-Point'],['unif','Uniform']].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${type===v?'m4-algo-tab--on':''}`} onClick={()=>setType(v)} style={{padding:'4px 14px'}}>{l}</button>
        ))}
        <button className="m4-algo-tab" style={{padding:'4px 14px',marginLeft:'auto'}} onClick={()=>{setA(randBits(L));setB(randBits(L));setTick(t=>t+1);}}>↺ Randomise Parents</button>
      </div>

      {type === 'one' && (
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.7rem'}}>
          <span style={{fontSize:'0.72rem',color:'var(--text-2)'}}>Cut point c:</span>
          <input type="range" min={1} max={L-1} value={c} onChange={e=>setC(+e.target.value)} style={{flex:1}} />
          <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--cyan)',minWidth:30}}>{c}</span>
        </div>
      )}
      {type === 'two' && (
        <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',marginBottom:'0.7rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
            <span style={{fontSize:'0.72rem',color:'var(--text-2)',minWidth:60}}>Cut c:</span>
            <input type="range" min={1} max={L-1} value={c} onChange={e=>setC(+e.target.value)} style={{flex:1}} />
            <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--cyan)',minWidth:30}}>{c}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
            <span style={{fontSize:'0.72rem',color:'var(--text-2)',minWidth:60}}>Cut d:</span>
            <input type="range" min={1} max={L-1} value={d} onChange={e=>setD(+e.target.value)} style={{flex:1}} />
            <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--violet)',minWidth:30}}>{d}</span>
          </div>
        </div>
      )}
      {type === 'unif' && (
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.7rem'}}>
          <span style={{fontSize:'0.72rem',color:'var(--text-2)'}}>Swap prob p:</span>
          <input type="range" min={0} max={0.5} step={0.05} value={pUnif} onChange={e=>setPUnif(+e.target.value)} style={{flex:1}} />
          <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--emerald)',minWidth:36}}>{pUnif.toFixed(2)}</span>
          <button className="m4-algo-tab" style={{padding:'2px 10px',fontSize:'0.7rem'}} onClick={()=>setTick(t=>t+1)}>Re-roll</button>
        </div>
      )}

      <div style={{background:'var(--bg-2)',borderRadius:6,padding:'0.7rem',border:'1px solid rgba(148,163,184,0.12)'}}>
        <CrossoverRow label="Parent A" bits={a} mask={Array(L).fill(false)} parent="A" color="#22d3ee" />
        <CrossoverRow label="Parent B" bits={b} mask={Array(L).fill(false)} parent="B" color="#fb7185" />
        <div style={{height:1,background:'rgba(148,163,184,0.2)',margin:'0.55rem 0'}} />
        <CrossoverRow label="Child A'" bits={childA} mask={swapMask} parent="B" color="var(--text-0)" />
        <CrossoverRow label="Child B'" bits={childB} mask={swapMask} parent="A" color="var(--text-0)" />
      </div>

      <div className="m4-infobox" style={{marginTop:'0.7rem',fontSize:'0.74rem'}}>
        {type === 'one' && <>
          <strong>One-Point disadvantage:</strong> v₁ and v_L are separated with probability <Tex src="(L-1)/L" />.
          Adjacent genes survive together with probability <Tex src="1/L" />. Linkage favours nearby genes.
        </>}
        {type === 'two' && <>
          <strong>Two-Point intuition (ring view):</strong> equivalent to swapping the outside arc when the chromosome is drawn as a ring — v₁ and v_L become "adjacent" again, removing position-specific bias.
        </>}
        {type === 'unif' && <>
          <strong>Uniform crossover:</strong> each gene independently swapped with probability p. Distance-independent — but disrupts building blocks more aggressively. Typically <Tex src="p \le 0.5" />.
        </>}
      </div>
    </div>
  );
}

function SelectionViz() {
  const [mode, setMode] = useState('roulette');
  const [tSize, setTSize] = useState(3);
  const [pop, setPop] = useState(() => Array.from({length:8},(_,i)=>({id:i+1,fit:Math.round((Math.random()*0.85+0.1)*100)/100})));
  const [highlight, setHighlight] = useState([]);
  const [history, setHistory] = useState([]);

  const total = pop.reduce((s,p)=>s+p.fit,0);
  const cdf = pop.reduce((acc,p)=>{ acc.push((acc.length?acc[acc.length-1]:0)+p.fit); return acc; }, []);

  const doSelect = () => {
    if (mode === 'roulette') {
      const r = Math.random() * total;
      const idx = cdf.findIndex(c => r <= c);
      setHighlight([idx]);
      setHistory(h => [{ mode:'Roulette', winners:[pop[idx].id], detail:`r=${r.toFixed(2)} hit slot ${idx+1}` }, ...h].slice(0,6));
    } else if (mode === 'sus') {
      const n = 4;
      const stride = total / n;
      const start = Math.random() * stride;
      const winners = [];
      for (let i = 0; i < n; i++) {
        const target = start + i * stride;
        const idx = cdf.findIndex(c => target <= c);
        winners.push(idx);
      }
      setHighlight(winners);
      setHistory(h => [{ mode:'SUS (n=4)', winners:winners.map(i=>pop[i].id), detail:`stride=${stride.toFixed(2)}, start=${start.toFixed(2)}` }, ...h].slice(0,6));
    } else {
      const picks = Array.from({length:tSize},()=>Math.floor(Math.random()*pop.length));
      let best = picks[0];
      for (const p of picks) if (pop[p].fit > pop[best].fit) best = p;
      setHighlight([best]);
      setHistory(h => [{ mode:`Tournament t=${tSize}`, winners:[pop[best].id], detail:`competitors: ${picks.map(p=>pop[p].id).join(',')}` }, ...h].slice(0,6));
    }
  };

  const maxFit = Math.max(...pop.map(p=>p.fit));

  return (
    <div className="m4-card">
      <div className="m4-card-h">SELECTION MECHANISM — Algorithms 30, 31, 32</div>
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.75rem',flexWrap:'wrap'}}>
        {[['roulette','Fitness-Proportionate (Roulette)'],['sus','Stochastic Universal Sampling'],['tour','Tournament']].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${mode===v?'m4-algo-tab--on':''}`} onClick={()=>{setMode(v);setHighlight([]);}} style={{padding:'4px 12px'}}>{l}</button>
        ))}
      </div>

      {mode === 'tour' && (
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.7rem'}}>
          <span style={{fontSize:'0.72rem',color:'var(--text-2)'}}>Tournament size t:</span>
          <input type="range" min={1} max={pop.length} value={tSize} onChange={e=>setTSize(+e.target.value)} style={{flex:1}} />
          <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--amber)',minWidth:24}}>{tSize}</span>
        </div>
      )}

      <div style={{background:'var(--bg-2)',borderRadius:6,padding:'0.7rem',border:'1px solid rgba(148,163,184,0.12)',marginBottom:'0.7rem'}}>
        <div style={{fontSize:'0.7rem',color:'var(--text-2)',marginBottom:'0.45rem',fontFamily:'monospace'}}>Population — fitness bars (sum = {total.toFixed(2)})</div>
        {pop.map((p, i) => (
          <div key={p.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}>
            <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--text-2)',width:28}}>P{p.id}</span>
            <div style={{flex:1,height:14,background:'rgba(15,23,42,0.6)',borderRadius:3,overflow:'hidden',position:'relative'}}>
              <div style={{
                width:`${(p.fit/maxFit)*100}%`,height:'100%',
                background: highlight.includes(i) ? 'linear-gradient(90deg,#34d399,#22d3ee)' : 'rgba(167,139,250,0.55)',
                transition:'background 0.3s, width 0.2s',
                boxShadow: highlight.includes(i) ? '0 0 12px rgba(52,211,153,0.6)' : 'none',
              }} />
            </div>
            <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:highlight.includes(i)?'var(--emerald)':'var(--text-1)',width:42,textAlign:'right'}}>{p.fit.toFixed(2)}</span>
          </div>
        ))}
        {(mode === 'roulette' || mode === 'sus') && (
          <div style={{marginTop:'0.65rem'}}>
            <div style={{fontSize:'0.66rem',color:'var(--text-2)',fontFamily:'monospace',marginBottom:'0.2rem'}}>Stacked CDF — wheel slots</div>
            <div style={{display:'flex',height:18,borderRadius:3,overflow:'hidden'}}>
              {pop.map((p,i)=>(
                <div key={p.id} title={`P${p.id}: ${p.fit}`} style={{
                  width:`${(p.fit/total)*100}%`,
                  background: highlight.includes(i) ? '#34d399' : CYBER_COLS[i%CYBER_COLS.length]+'88',
                  borderRight:'1px solid rgba(2,8,23,0.4)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontFamily:'monospace',fontSize:'0.6rem',color:'#fff',fontWeight:700,
                }}>P{p.id}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.7rem'}}>
        <button className="m4-algo-tab" style={{padding:'5px 16px'}} onClick={doSelect}>▶ Run Selection</button>
        <button className="m4-algo-tab" style={{padding:'5px 16px'}} onClick={()=>{
          setPop(p=>p.map(x=>({...x,fit:Math.round((Math.random()*0.85+0.1)*100)/100})));
          setHighlight([]); setHistory([]);
        }}>↺ New Population</button>
      </div>

      <div style={{maxHeight:120,overflowY:'auto'}}>
        {history.length === 0 && <div style={{fontSize:'0.7rem',color:'var(--text-2)',fontStyle:'italic'}}>Run selection — last 6 outcomes will appear here.</div>}
        {history.map((h,i)=>(
          <div key={i} style={{fontFamily:'monospace',fontSize:'0.69rem',color:'var(--text-1)',padding:'2px 0'}}>
            <span style={{color:'var(--violet)'}}>[{h.mode}]</span> winners: <span style={{color:'var(--emerald)'}}>{h.winners.map(w=>'P'+w).join(', ')}</span> <span style={{color:'var(--text-2)'}}>— {h.detail}</span>
          </div>
        ))}
      </div>

      <div className="m4-infobox" style={{marginTop:'0.7rem',fontSize:'0.74rem'}}>
        {mode === 'roulette' && <>Roulette samples one r ∈ [0, s] and finds the slot it lands in. <strong>Issue:</strong> requires meaningful absolute fitness; near-equal fitnesses → near-uniform random.</>}
        {mode === 'sus' && <>SUS draws n equally-spaced pointers from one shared start. <strong>Property:</strong> any individual with fitness ≥ s/n is guaranteed to be chosen. Lower variance than n independent roulette spins.</>}
        {mode === 'tour' && <>Tournament picks t individuals uniformly at random and returns the fittest. <strong>Tuneable:</strong> t=1 → random; t≫popsize → truncation. Non-parametric: ignores fitness magnitudes — only ranks matter.</>}
      </div>
    </div>
  );
}

const GA_TARGET = 'GENETIC';
const GA_L = GA_TARGET.length;
const GA_ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function gaFitness(s) {
  let f = 0;
  for (let i = 0; i < GA_L; i++) if (s[i] === GA_TARGET[i]) f++;
  return f;
}
function gaRandIndividual() {
  return Array.from({length:GA_L},()=>GA_ALPHABET[Math.floor(Math.random()*GA_ALPHABET.length)]).join('');
}
function gaInitPop(n) {
  return Array.from({length:n},()=>{ const g = gaRandIndividual(); return { g, f: gaFitness(g) }; });
}
function gaCrossover(a, b, xType) {
  const av = a.split(''), bv = b.split('');
  if (xType === 'one') {
    const c = 1 + Math.floor(Math.random()*(GA_L-1));
    return [av.slice(0,c).concat(bv.slice(c)).join(''), bv.slice(0,c).concat(av.slice(c)).join('')];
  } else if (xType === 'two') {
    let c = Math.floor(Math.random()*GA_L), d = Math.floor(Math.random()*GA_L);
    if (c > d) [c,d] = [d,c];
    const ca = av.slice(0,c).concat(bv.slice(c,d), av.slice(d)).join('');
    const cb = bv.slice(0,c).concat(av.slice(c,d), bv.slice(d)).join('');
    return [ca, cb];
  } else {
    const ca = []; const cb = [];
    for (let i = 0; i < GA_L; i++) {
      if (Math.random() < 0.5) { ca.push(av[i]); cb.push(bv[i]); }
      else { ca.push(bv[i]); cb.push(av[i]); }
    }
    return [ca.join(''), cb.join('')];
  }
}
function gaMutate(s, pMut) {
  return s.split('').map(c => Math.random() < pMut ? GA_ALPHABET[Math.floor(Math.random()*GA_ALPHABET.length)] : c).join('');
}
function gaSelectOne(p, selMode, tSize) {
  if (selMode === 'tour') {
    let best = p[Math.floor(Math.random()*p.length)];
    for (let k = 1; k < tSize; k++) {
      const c = p[Math.floor(Math.random()*p.length)];
      if (c.f > best.f) best = c;
    }
    return best;
  }
  const total = p.reduce((s,x)=>s+x.f,0) || p.length;
  let r = Math.random() * total;
  for (const x of p) { r -= (x.f || 1); if (r <= 0) return x; }
  return p[p.length-1];
}

function GAEvolutionSim() {
  const [popSize, setPopSize] = useState(40);
  const [pMut, setPMut] = useState(0.05);
  const [xType, setXType] = useState('one');
  const [selMode, setSelMode] = useState('tour');
  const [tSize, setTSize] = useState(3);
  const [elite, setElite] = useState(2);
  const [running, setRunning] = useState(false);
  const [gen, setGen] = useState(0);
  const [pop, setPop] = useState(() => gaInitPop(40));
  const [hist, setHist] = useState([]);
  const runRef = useRef(false);
  runRef.current = running;

  const step = useCallback(() => {
    setPop(curr => {
      const sorted = [...curr].sort((a,b)=>b.f-a.f);
      const newPop = sorted.slice(0, elite).map(x => ({...x}));
      while (newPop.length < curr.length) {
        const pa = gaSelectOne(curr, selMode, tSize).g;
        const pb = gaSelectOne(curr, selMode, tSize).g;
        const [ca, cb] = gaCrossover(pa, pb, xType);
        const ma = gaMutate(ca, pMut), mb = gaMutate(cb, pMut);
        newPop.push({ g: ma, f: gaFitness(ma) });
        if (newPop.length < curr.length) newPop.push({ g: mb, f: gaFitness(mb) });
      }
      const best = newPop.reduce((b,x)=>x.f>b.f?x:b, newPop[0]);
      const avg = newPop.reduce((s,x)=>s+x.f,0)/newPop.length;
      setHist(h => [...h, { gen: h.length, best: best.f, avg }].slice(-120));
      return newPop;
    });
    setGen(g => g + 1);
  }, [elite, pMut, xType, selMode, tSize]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!runRef.current) return;
      step();
    }, 80);
    return () => clearInterval(id);
  }, [running, step]);

  const reset = () => {
    setRunning(false); setGen(0); setHist([]); setPop(gaInitPop(popSize));
  };

  const best = pop.reduce((b,x)=>x.f>b.f?x:b, pop[0] || {g:'',f:0});
  const top = [...pop].sort((a,b)=>b.f-a.f).slice(0,6);
  const found = best.g === GA_TARGET;

  const chartRef = useRef(null);
  useEffect(() => {
    const c = chartRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 400; const H = c.height = 110;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    if (hist.length < 2) return;
    const PAD = {l:24,r:8,t:6,b:14}; const iW = W-PAD.l-PAD.r; const iH = H-PAD.t-PAD.b;
    ctx.strokeStyle='rgba(148,163,184,0.08)';
    for (let g=0; g<=4; g++) { const y=PAD.t+g/4*iH; ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(PAD.l+iW,y); ctx.stroke(); }
    const draw = (key, col) => {
      ctx.beginPath(); ctx.strokeStyle=col; ctx.lineWidth=1.6;
      hist.forEach((h,i)=>{
        const x = PAD.l + (i/(hist.length-1))*iW;
        const y = PAD.t + (1 - h[key]/GA_L)*iH;
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.stroke();
    };
    draw('best', '#34d399');
    draw('avg', '#a78bfa');
    ctx.fillStyle='rgba(148,163,184,0.6)'; ctx.font='8px monospace';
    ctx.fillText(`${GA_L}`, 4, PAD.t+6); ctx.fillText('0', 4, PAD.t+iH);
  }, [hist]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">EVOLVE A STRING — Full GA with elitism (Algorithm 33)</div>
      <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.7rem'}}>
        Target: <span style={{fontFamily:'monospace',color:'var(--cyan)',fontWeight:700,letterSpacing:'0.2em'}}>{GA_TARGET}</span> &middot; Alphabet: 27 chars (A–Z + space) &middot; Fitness = correct positions ∈ [0, {GA_L}]
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:'0.55rem',marginBottom:'0.75rem'}}>
        <div>
          <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Population</div>
          <input type="range" min={10} max={120} step={10} value={popSize} onChange={e=>{setPopSize(+e.target.value);}} style={{width:'100%'}} />
          <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--cyan)'}}>{popSize}</span>
        </div>
        <div>
          <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Mutation prob</div>
          <input type="range" min={0} max={0.3} step={0.01} value={pMut} onChange={e=>setPMut(+e.target.value)} style={{width:'100%'}} />
          <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--amber)'}}>{pMut.toFixed(2)}</span>
        </div>
        <div>
          <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Elites</div>
          <input type="range" min={0} max={10} value={elite} onChange={e=>setElite(+e.target.value)} style={{width:'100%'}} />
          <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--emerald)'}}>{elite}</span>
        </div>
        <div>
          <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Crossover</div>
          <select value={xType} onChange={e=>setXType(e.target.value)} style={{width:'100%',background:'var(--bg-2)',color:'var(--text-1)',border:'1px solid var(--border)',padding:'2px',fontSize:'0.7rem',fontFamily:'monospace'}}>
            <option value="one">One-Point</option>
            <option value="two">Two-Point</option>
            <option value="unif">Uniform</option>
          </select>
        </div>
        <div>
          <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Selection</div>
          <select value={selMode} onChange={e=>setSelMode(e.target.value)} style={{width:'100%',background:'var(--bg-2)',color:'var(--text-1)',border:'1px solid var(--border)',padding:'2px',fontSize:'0.7rem',fontFamily:'monospace'}}>
            <option value="tour">Tournament</option>
            <option value="rou">Roulette</option>
          </select>
        </div>
        {selMode === 'tour' && (
          <div>
            <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:2}}>Tour size</div>
            <input type="range" min={1} max={8} value={tSize} onChange={e=>setTSize(+e.target.value)} style={{width:'100%'}} />
            <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--violet)'}}>{tSize}</span>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:'0.4rem',alignItems:'center',marginBottom:'0.7rem',flexWrap:'wrap'}}>
        <button className="m4-algo-tab" style={{padding:'4px 14px'}} onClick={()=>setRunning(r=>!r)}>{running ? '⏸ Pause' : '▶ Run'}</button>
        <button className="m4-algo-tab" style={{padding:'4px 14px'}} onClick={step} disabled={running}>⏭ Step</button>
        <button className="m4-algo-tab" style={{padding:'4px 14px'}} onClick={reset}>↺ Reset</button>
        <span style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--text-2)',marginLeft:'auto'}}>Generation <span style={{color:'var(--cyan)'}}>{gen}</span></span>
      </div>

      <div style={{background:'var(--bg-2)',borderRadius:6,padding:'0.7rem',border:'1px solid rgba(148,163,184,0.12)',marginBottom:'0.6rem'}}>
        <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:'0.3rem',fontFamily:'monospace'}}>BEST INDIVIDUAL</div>
        <div style={{fontFamily:'monospace',fontSize:'1.05rem',letterSpacing:'0.3em',color:found?'var(--emerald)':'var(--text-0)',marginBottom:'0.4rem',textShadow:found?'0 0 8px rgba(52,211,153,0.5)':'none'}}>
          {(best.g||'').split('').map((c,i)=>(
            <span key={i} style={{color:c===GA_TARGET[i]?'var(--emerald)':'var(--rose)'}}>{c}</span>
          ))}
        </div>
        <div style={{fontSize:'0.7rem',color:'var(--text-2)'}}>Fitness <span style={{color:'var(--cyan)',fontWeight:700}}>{best.f}/{GA_L}</span> {found && <span style={{color:'var(--emerald)'}}>· ★ TARGET REACHED ★</span>}</div>
      </div>

      <div className="m4-two-col" style={{gap:'0.7rem'}}>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:'0.3rem',fontFamily:'monospace'}}>TOP 6 OF POPULATION</div>
          <div style={{background:'var(--bg-2)',borderRadius:5,padding:'0.4rem',border:'1px solid rgba(148,163,184,0.1)'}}>
            {top.map((x,i)=>(
              <div key={i} style={{fontFamily:'monospace',fontSize:'0.72rem',padding:'1px 0',display:'flex',justifyContent:'space-between'}}>
                <span style={{letterSpacing:'0.15em'}}>{x.g.split('').map((c,k)=>(
                  <span key={k} style={{color:c===GA_TARGET[k]?'var(--emerald)':'var(--text-2)'}}>{c}</span>
                ))}</span>
                <span style={{color:'var(--cyan)'}}>{x.f}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:'0.3rem',fontFamily:'monospace'}}>FITNESS OVER GENERATIONS</div>
          <canvas ref={chartRef} className="m4-canvas" height="110" />
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginTop:'0.3rem'}}>
            <span style={{color:'#34d399'}}>━ Best</span> &nbsp; <span style={{color:'#a78bfa'}}>━ Average</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneticAlgorithmsTab() {
  const [sec, setSec] = useState('overview');
  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview','Overview & GA Loop'],
          ['crossover','Crossover'],
          ['selection','Selection'],
          ['elitism','Elitism & Convergence'],
          ['simulator','GA Simulator'],
          ['gp','Genetic Programming'],
        ].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'overview' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(167,139,250,0.07) 0%,rgba(34,211,238,0.07) 100%)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['Holland 1970s','Origin','#22d3ee'],['Chromosome','Binary genome','#a78bfa'],['Crossover','Primary operator','#34d399'],['Mutation','Bit-flip','#fbbf24'],['Selection','Many flavours','#fb7185'],['Building blocks','Schema theory','#06b6d4']].map(([k,v,col])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">GA vs (μ, λ) Evolution Strategy</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                Genetic Algorithms (Holland, 1970s) emerged in parallel with ES but with different emphases. Same evolutionary skeleton — different choices on every dial.
              </div>
              <div className="m4-hr"/>
              <table className="m4-ptable">
                <thead><tr><th>Aspect</th><th>(μ, λ) ES</th><th>GA</th></tr></thead>
                <tbody>
                  <tr><td className="pk">Encoding</td><td>Real-valued vector</td><td>Binary chromosome (traditionally)</td></tr>
                  <tr><td className="pk">Primary tweak</td><td>Gaussian mutation</td><td>Crossover (recombination)</td></tr>
                  <tr><td className="pk">Selection</td><td>Truncation (top μ)</td><td>Roulette / SUS / Tournament</td></tr>
                  <tr><td className="pk">Mutation rate</td><td>Often σ (adaptive)</td><td>Per-bit p ≈ 1/L</td></tr>
                  <tr><td className="pk">Inspiration</td><td>Engineering optimisation</td><td>Darwin + Mendelian genetics</td></tr>
                </tbody>
              </table>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 20 — The Genetic Algorithm</div>
              <div className="m4-pseudocode">{`popsize ← desired population size      ▷ make it even
P ← {}
for popsize times:
  P ← P ∪ {new random individual}
Best ← ∅
repeat
  for each Pᵢ ∈ P:
    AssessFitness(Pᵢ)
    if Best=∅ or Fitness(Pᵢ)>Fitness(Best):
      Best ← Pᵢ
  Q ← {}                              ▷ deviation from (μ,λ)
  for popsize/2 times:
    Pₐ ← SelectWithReplacement(P)
    P_b ← SelectWithReplacement(P)
    Cₐ, C_b ← Crossover(Copy(Pₐ), Copy(P_b))
    Q ← Q ∪ {Mutate(Cₐ), Mutate(C_b)}
  P ← Q
until ideal or out of time
return Best`}</div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Why Crossover? The Building-Block Hypothesis</div>
            <div className="m4-two-col">
              <div>
                <ul className="m4-bullets">
                  <li>Highly fit individuals tend to share <strong>common traits</strong> (substrings).</li>
                  <li>These traits — <em>building blocks</em> — get spread through the population by crossover.</li>
                  <li>Theoretical formalisation: <strong>schema theory</strong> (Holland). Complex and not entirely satisfactory, but motivating.</li>
                  <li>Effectiveness depends on <strong>epistasis</strong> (gene interaction) and <strong>linkage</strong> (probability genes survive crossover together).</li>
                </ul>
              </div>
              <div className="m4-warnbox" style={{fontSize:'0.76rem'}}>
                <strong>Crossover ≠ global mutation.</strong> If every individual shares a gene value, the population sits on one face of the binary hypercube. Crossover can only produce children inside that hypercube — it can <em>never</em> restore lost diversity. Once collapsed, that dimension is gone forever (cf. premature convergence). Only mutation can climb out.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Many Faces of Evolution — Theorists Compared</div>
            <table className="m4-ptable">
              <thead><tr><th>Theorist</th><th>Mechanism</th><th>EC analogue</th></tr></thead>
              <tbody>
                <tr><td className="pk">Lamarck</td><td>Use/disuse → adaptive inherited change. Acquired traits pass on.</td><td>Memetic algorithms — local search "writes back" into the genome.</td></tr>
                <tr><td className="pk">Baldwin</td><td>Learning shifts the selection landscape over generations.</td><td>Hybrid: lifetime improvement affects fitness only, not genome.</td></tr>
                <tr><td className="pk">Waddington</td><td>Environmental shock → genetic assimilation.</td><td>Stress-driven mutation rate spikes.</td></tr>
                <tr><td className="pk">Darwin</td><td>Existing variation + natural selection.</td><td>The standard GA loop: mutation supplies variation, selection filters.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'crossover' && (
        <div>
          <CrossoverViz />
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Linkage — Why Position Matters</div>
            <div className="m4-two-col">
              <div>
                <div className="m4-flabel">Probability genes are separated</div>
                <table className="m4-ptable">
                  <thead><tr><th>Operator</th><th>v₁ &amp; v_L</th><th>vᵢ &amp; vᵢ₊₁</th><th>vᵢ &amp; vᵢ₊_L/₂</th></tr></thead>
                  <tbody>
                    <tr><td className="pk">One-Point</td><td><Tex src="\tfrac{L-1}{L}" /></td><td><Tex src="\tfrac{1}{L}" /></td><td><Tex src="\approx \tfrac{1}{2}" /></td></tr>
                    <tr><td className="pk">Two-Point</td><td><Tex src="\tfrac{2}{L}" /></td><td><Tex src="\tfrac{2}{L}" /></td><td><Tex src="\approx \tfrac{1}{2}" /></td></tr>
                    <tr><td className="pk">Uniform</td><td>2p(1−p)</td><td>2p(1−p)</td><td>2p(1−p)</td></tr>
                  </tbody>
                </table>
                <div className="m4-infobox" style={{marginTop:'0.65rem',fontSize:'0.74rem'}}>
                  Two-point crossover is best understood by drawing the chromosome as a <strong>ring</strong>: cuts c and d split the ring into two arcs; one arc gets swapped. v₁ and v_L become topologically adjacent — distance, not position, determines linkage.
                </div>
              </div>
              <div>
                <div className="m4-flabel">Bit-Flip Mutation (Algorithm 22)</div>
                <div className="m4-pseudocode">{`p ← prob of flipping a bit  ▷ often 1/L
𝐯 ← boolean vector to mutate
for i from 1 to L:
  if p ≥ U(0,1):
    v_i ← ¬v_i
return 𝐯`}</div>
                <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.5rem',lineHeight:1.65}}>
                  With <Tex src="p = 1/L" />, the expected number of flips per individual is exactly 1 — the canonical balance between disturbing and preserving the genome.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'selection' && (
        <div>
          <SelectionViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 30 — Fitness-Proportionate (Roulette)</div>
              <div className="m4-pseudocode">{`Once per generation:
  global 𝐩 ← population
  global 𝐟 ← fitnesses (≥ 0)
  if all zero: set all to 1
  for i from 2 to L: f_i ← f_i + f_{i-1}   ▷ CDF

Each call:
  n ← U(0, f_L)
  for i from 2 to L:
    if f_{i-1} < n ≤ f_i: return p_i
  return p_1`}</div>
              <div className="m4-warnbox" style={{fontSize:'0.74rem',marginTop:'0.5rem'}}>
                Assumes <strong>absolute</strong> fitness is meaningful. Many fitness measures (MSE, RSS) are only relatively comparable.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 32 — Tournament Selection</div>
              <div className="m4-pseudocode">{`P ← population
t ← tournament size, t ≥ 1

Best ← random pick from P
for i from 2 to t:
  Next ← random pick from P
  if Fitness(Next) > Fitness(Best):
    Best ← Next
return Best`}</div>
              <ul className="m4-bullets" style={{marginTop:'0.5rem'}}>
                <li><strong>Non-parametric:</strong> only rank order matters — fitness magnitudes are irrelevant.</li>
                <li><strong>Tuneable</strong> via t: t=1 → uniform random; t≫popsize → truncation.</li>
                <li>Trivially parallel — each tournament is independent.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {sec === 'elitism' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Elitism — Preserve the Fittest</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                The n fittest individuals are <strong>copied unchanged</strong> into the next generation — the <em>elite group</em>. Equivalent in spirit to (μ + λ): once you find a great solution, you don't lose it.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Trade-offs</div>
              <table className="m4-ptable">
                <tbody>
                  <tr><td className="pk">Pro</td><td>Best solution monotonically improves — never goes backwards.</td></tr>
                  <tr><td className="pk">Con</td><td>Risks <strong>premature convergence</strong> — elites flood the gene pool.</td></tr>
                  <tr><td className="pk">Mitigation</td><td>Increase mutation rate; breed external diversity in; reduce elite count.</td></tr>
                </tbody>
              </table>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 33 — GA with Elitism</div>
              <div className="m4-pseudocode">{`popsize ← desired pop size
n ← number of elite           ▷ popsize − n must be even

P ← {popsize random individuals}
Best ← ∅
repeat
  for each Pᵢ: AssessFitness; update Best
  Q ← n fittest in P (ties broken at random)
  for (popsize − n)/2 times:
    Pₐ ← Select(P);  P_b ← Select(P)
    Cₐ, C_b ← Crossover(Copy(Pₐ), Copy(P_b))
    Q ← Q ∪ {Mutate(Cₐ), Mutate(C_b)}
  P ← Q
until ideal or out of time
return Best`}</div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Hypercube View — Why Diversity Cannot Recover</div>
            <div className="m4-two-col">
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.7}}>
                <p>Binary vectors of length L sit on the corners of an L-dimensional hypercube. Crossover only produces children on corners of the <strong>same</strong> hypercube — it cannot invent a new value at any position.</p>
                <p>If every parent shares the same value at gene i, the hypercube <strong>collapses</strong> in dimension i — and crossover can never restore it. Only mutation can.</p>
              </div>
              <div style={{background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.15)',borderRadius:8,padding:'0.7rem',fontFamily:'monospace',fontSize:'0.7rem',color:'var(--text-1)',lineHeight:1.7}}>
                <div style={{color:'var(--text-2)'}}>{'// All parents agree on gene 3:'}</div>
                <div>P1: 1 0 1 <span style={{color:'var(--rose)'}}>0</span> 1 1</div>
                <div>P2: 0 1 0 <span style={{color:'var(--rose)'}}>0</span> 1 0</div>
                <div>P3: 1 1 1 <span style={{color:'var(--rose)'}}>0</span> 0 1</div>
                <div>P4: 0 0 0 <span style={{color:'var(--rose)'}}>0</span> 1 1</div>
                <div style={{color:'var(--text-2)',marginTop:'0.4rem'}}>Any child will also have 0 at position 3.</div>
                <div style={{color:'var(--emerald)',marginTop:'0.4rem'}}>{'→ dimension collapsed; only mutation can re-open it.'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'simulator' && (
        <div>
          <GAEvolutionSim />
          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(34,211,238,0.05) 0%,rgba(167,139,250,0.05) 100%)'}}>
            <div className="m4-card-h">Things to Try</div>
            <ul className="m4-bullets" style={{fontSize:'0.78rem'}}>
              <li>Set <strong>elites = 0</strong> and watch fitness occasionally <em>drop</em> between generations — the best can be lost.</li>
              <li>Push <strong>mutation</strong> to 0.30 — the GA becomes a random walk, can't lock in good solutions.</li>
              <li>Set <strong>mutation = 0</strong> and selection to roulette — early diversity is everything; the run usually stalls before reaching the target.</li>
              <li>Compare <strong>tournament t=1</strong> (random — drift) vs <strong>t=8</strong> (truncation — premature convergence).</li>
              <li>Try <strong>uniform crossover</strong> with low mutation — disrupts building blocks aggressively but explores broadly.</li>
            </ul>
          </div>
        </div>
      )}

      {sec === 'gp' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Tree-Style Genetic Programming</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                Evolve <strong>computer programs</strong> instead of bit strings. Individuals are expression trees built from operators (+, ·, sin, cos, √) and operands (variables, constants).
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Operators on trees</div>
              <ul className="m4-bullets">
                <li><strong>Mutation:</strong> replace a subtree with a freshly-generated subtree (e.g. constant 0.981 → expression x + y).</li>
                <li><strong>Crossover:</strong> swap subtrees between two parent program trees.</li>
                <li>Constraint: children must remain syntactically valid programs — type-aware operators or grammar-guided GP.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Tree Crossover — Worked Example</div>
              <div style={{fontFamily:'monospace',fontSize:'0.74rem',color:'var(--text-1)',background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.15)',borderRadius:8,padding:'0.75rem',lineHeight:1.7}}>
                <div style={{color:'var(--text-2)'}}>// Parent A: f(x,y) = (x + y) · sin(x)</div>
                <div>{'      ·'}</div>
                <div>{'     / \\'}</div>
                <div>{'    +   sin'}</div>
                <div>{'   / \\   |'}</div>
                <div>{'  x   y  x'}</div>
                <div style={{marginTop:'0.5rem',color:'var(--text-2)'}}>// Parent B: g(x) = √(x² + 1)</div>
                <div>{'      √'}</div>
                <div>{'      |'}</div>
                <div>{'      +'}</div>
                <div>{'     / \\'}</div>
                <div>{'    ²   1'}</div>
                <div>{'    |'}</div>
                <div>{'    x'}</div>
                <div style={{marginTop:'0.5rem',color:'var(--emerald)'}}>{'→ Swap subtree (x+y) with (x²+1):'}</div>
                <div style={{color:'var(--cyan)'}}>{'   Child: ((x²+1)) · sin(x)'}</div>
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Representation Beyond Bit Strings</div>
            <table className="m4-ptable">
              <thead><tr><th>Representation</th><th>Domain</th><th>Operator constraint</th></tr></thead>
              <tbody>
                <tr><td className="pk">Bit vectors</td><td>Boolean functions, feature selection</td><td>Free — any flip/swap is valid</td></tr>
                <tr><td className="pk">Real vectors</td><td>Continuous optimisation (ES territory)</td><td>None — Gaussian convolution natural</td></tr>
                <tr><td className="pk">Trees</td><td>Symbolic regression, controllers (GP)</td><td>Syntactic validity (type-checking)</td></tr>
                <tr><td className="pk">Permutations</td><td>TSP, JSSP scheduling</td><td>Must remain a valid permutation — special crossovers (PMX, OX, CX)</td></tr>
                <tr><td className="pk">Graphs</td><td>NN topology (NEAT)</td><td>Connectivity constraints, no orphan nodes</td></tr>
                <tr><td className="pk">Molecules</td><td>Drug design</td><td>Chemical valence, stability</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emergent Behaviour & Hybrid Algorithms (Lecture 12) ───────────────────────

function PSOSimPanel() {
  const W = 480, H = 320;
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(20);
  const [alpha, setAlpha] = useState(0.6);
  const [beta, setBeta] = useState(1.5);
  const [gamma, setGamma] = useState(0.0);
  const [delta, setDelta] = useState(1.5);
  const [eps, setEps] = useState(0.7);
  const [iter, setIter] = useState(0);
  const [bestFit, setBestFit] = useState(null);
  const simRef = useRef(null);
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const animRef = useRef(null);
  const runRef = useRef(false);
  runRef.current = running;

  const eval2D = (x, y) => -20 * Math.exp(-0.2*Math.sqrt(0.5*(x*x+y*y)))
                          - Math.exp(0.5*(Math.cos(2*Math.PI*x)+Math.cos(2*Math.PI*y)))
                          + Math.E + 20;

  const init = useCallback((cnt) => {
    const particles = Array.from({length:cnt}, () => {
      const pos = [(Math.random()-0.5)*8, (Math.random()-0.5)*8];
      return { pos, vel:[(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5], best:[...pos], bestFit:eval2D(pos[0],pos[1]), trail:[] };
    });
    let gBest = particles[0].best.slice();
    let gBestFit = particles[0].bestFit;
    particles.forEach(p => { if (p.bestFit < gBestFit) { gBest = p.best.slice(); gBestFit = p.bestFit; } });
    return { particles, gBest, gBestFit };
  }, []);

  const drawBg = useCallback(() => {
    const c = bgRef.current; if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W,H);
    let mn=Infinity,mx=-Infinity; const grid = new Float32Array(W*H);
    for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
      const x = -5 + (px/W)*10, y = 5 - (py/H)*10;
      const v = eval2D(x,y); grid[py*W+px]=v;
      if (v<mn) mn=v; if (v>mx) mx=v;
    }
    const rng = mx-mn;
    for (let i=0;i<grid.length;i++) {
      const t = (grid[i]-mn)/rng;
      img.data[i*4]   = Math.round(15 + t*90);
      img.data[i*4+1] = Math.round((1-t)*30);
      img.data[i*4+2] = Math.round(40 + (1-t)*70);
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img,0,0);
  }, []);

  const drawFg = useCallback(() => {
    const c = fgRef.current; const sim = simRef.current;
    if (!c || !sim) return;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const toC = (x,y) => [(x+5)/10*W, (5-y)/10*H];
    sim.particles.forEach((p,i)=>{
      const col = CYBER_COLS[i%CYBER_COLS.length];
      for (let ti=1; ti<p.trail.length; ti++) {
        const a = Math.round((ti/p.trail.length)*60).toString(16).padStart(2,'0');
        const [x0,y0] = toC(p.trail[ti-1][0],p.trail[ti-1][1]);
        const [x1,y1] = toC(p.trail[ti][0],p.trail[ti][1]);
        ctx.strokeStyle = col+a; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
      }
    });
    sim.particles.forEach((p,i)=>{
      const [cx,cy] = toC(p.pos[0],p.pos[1]);
      ctx.fillStyle = CYBER_COLS[i%CYBER_COLS.length];
      ctx.beginPath(); ctx.arc(cx,cy,3.5,0,Math.PI*2); ctx.fill();
    });
    const [gx,gy] = toC(sim.gBest[0], sim.gBest[1]);
    ctx.save(); ctx.shadowColor='#34d399'; ctx.shadowBlur=14;
    ctx.strokeStyle='#34d399'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(gx-7,gy); ctx.lineTo(gx+7,gy); ctx.moveTo(gx,gy-7); ctx.lineTo(gx,gy+7); ctx.stroke();
    ctx.restore();
  }, []);

  const step = useCallback(() => {
    const sim = simRef.current; if (!sim) return;
    sim.particles.forEach(p => {
      for (let i = 0; i < 2; i++) {
        const b = Math.random()*beta, d = Math.random()*delta;
        p.vel[i] = alpha*p.vel[i] + b*(p.best[i]-p.pos[i]) + d*(sim.gBest[i]-p.pos[i]);
      }
    });
    sim.particles.forEach(p => {
      p.trail.push([p.pos[0], p.pos[1]]); if (p.trail.length > 16) p.trail.shift();
      p.pos[0] = Math.max(-5, Math.min(5, p.pos[0] + eps*p.vel[0]));
      p.pos[1] = Math.max(-5, Math.min(5, p.pos[1] + eps*p.vel[1]));
      const f = eval2D(p.pos[0],p.pos[1]);
      if (f < p.bestFit) { p.bestFit = f; p.best = [p.pos[0], p.pos[1]]; }
      if (f < sim.gBestFit) { sim.gBestFit = f; sim.gBest = [p.pos[0], p.pos[1]]; }
    });
    sim.iter++;
    setIter(sim.iter); setBestFit(sim.gBestFit);
    drawFg();
  }, [alpha, beta, delta, eps, drawFg]);

  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || !runRef.current) return;
      stepRef.current();
      animRef.current = setTimeout(tick, 80);
    };
    tick();
    return () => { cancelled = true; if (animRef.current) clearTimeout(animRef.current); };
  }, [running]);

  const reset = (cnt) => {
    setRunning(false); runRef.current = false;
    const s = init(cnt ?? n);
    s.iter = 0;
    simRef.current = s;
    setIter(0); setBestFit(s.gBestFit);
    requestAnimationFrame(drawFg);
  };

  useEffect(() => { drawBg(); reset(n); }, []); // eslint-disable-line

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:'1rem',alignItems:'start',marginBottom:'0.75rem'}}>
        <div>
          <div style={{position:'relative',lineHeight:0,borderRadius:8,overflow:'hidden',border:'1px solid rgba(34,211,238,0.18)'}}>
            <canvas ref={bgRef} style={{display:'block',width:W,height:H}} />
            <canvas ref={fgRef} style={{position:'absolute',top:0,left:0,width:W,height:H}} width={W} height={H} />
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.5rem',alignItems:'center'}}>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>setRunning(r=>!r)}>{running ? '⏸ Pause' : '▶ Run'}</button>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>{if(!running)step();}}>⏭ Step</button>
            <button className="m4-algo-tab" style={{padding:'3px 12px'}} onClick={()=>reset()}>↺ Reset</button>
            <span style={{marginLeft:'auto',fontFamily:'monospace',fontSize:'0.71rem',color:'var(--text-2)'}}>iter <span style={{color:'var(--cyan)'}}>{iter}</span></span>
          </div>
        </div>
        <div className="m4-card" style={{margin:0,padding:'0.7rem',fontSize:'0.7rem'}}>
          <div className="m4-card-h" style={{fontSize:'0.62rem',marginBottom:'0.5rem'}}>HYPER-PARAMETERS</div>
          {[
            ['α inertia', alpha, 0, 1, 0.05, setAlpha, '#22d3ee'],
            ['β cognitive (x*)', beta, 0, 3, 0.1, setBeta, '#a78bfa'],
            ['γ informants (x⁺)', gamma, 0, 3, 0.1, setGamma, '#34d399'],
            ['δ social (x!)', delta, 0, 3, 0.1, setDelta, '#fbbf24'],
            ['ε step', eps, 0, 1.5, 0.05, setEps, '#fb7185'],
          ].map(([l,v,mn,mx,st,fn,col])=>(
            <div key={l} style={{marginBottom:'0.4rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:1}}>
                <span style={{color:'var(--text-2)',fontSize:'0.65rem'}}>{l}</span>
                <span style={{fontFamily:'monospace',fontSize:'0.65rem',color:col}}>{v.toFixed(2)}</span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v} onChange={e=>fn(+e.target.value)} style={{width:'100%'}} />
            </div>
          ))}
          <div style={{borderTop:'1px solid var(--border)',marginTop:'0.4rem',paddingTop:'0.4rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:1}}>
              <span style={{color:'var(--text-2)',fontSize:'0.65rem'}}>swarm size</span>
              <span style={{fontFamily:'monospace',fontSize:'0.65rem',color:'var(--cyan)'}}>{n}</span>
            </div>
            <input type="range" min={5} max={50} value={n} onChange={e=>{setN(+e.target.value); reset(+e.target.value);}} style={{width:'100%'}} />
            <div style={{marginTop:'0.45rem',fontFamily:'monospace',fontSize:'0.65rem',color:'var(--emerald)'}}>best f = {bestFit!=null?bestFit.toFixed(4):'—'}</div>
            <div style={{marginTop:'0.3rem',fontSize:'0.62rem',color:'var(--text-2)'}}><span style={{color:'#34d399'}}>+</span> global best (target = origin)</div>
          </div>
        </div>
      </div>
      <div className="m4-infobox" style={{fontSize:'0.74rem'}}>
        <strong>Try:</strong> set α high and δ=0 → pure inertia, particles drift past optima. Set α=0, δ high → particles snap to global best instantly (premature convergence). Balance both for the classic spiral-and-converge behaviour.
      </div>
    </div>
  );
}

function DEMutationViz() {
  const [pts, setPts] = useState(() => Array.from({length:6},()=>[Math.random()*8-4, Math.random()*8-4]));
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [c, setC] = useState(2);
  const [F, setF] = useState(1.0);
  const canvasRef = useRef(null);

  const child = useMemo(
    () => [pts[a][0] + F*(pts[b][0]-pts[c][0]), pts[a][1] + F*(pts[b][1]-pts[c][1])],
    [pts, a, b, c, F]
  );

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const W = cv.width = cv.offsetWidth || 420; const H = cv.height = 280;
    const ctx = cv.getContext('2d'); ctx.clearRect(0,0,W,H);
    const PAD = 26;
    const toC = (x,y) => [PAD + (x+5)/10*(W-2*PAD), H-PAD - (y+5)/10*(H-2*PAD)];

    ctx.fillStyle = '#0d1a30'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'; ctx.lineWidth = 1;
    for (let g=-5; g<=5; g++) {
      const [gx0,gy0] = toC(g,-5), [gx1,gy1] = toC(g,5);
      const [hx0,hy0] = toC(-5,g), [hx1,hy1] = toC(5,g);
      ctx.beginPath(); ctx.moveTo(gx0,gy0); ctx.lineTo(gx1,gy1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx0,hy0); ctx.lineTo(hx1,hy1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    const [ox0,oy0] = toC(-5,0), [ox1,oy1] = toC(5,0);
    const [ax0,ay0] = toC(0,-5), [ax1,ay1] = toC(0,5);
    ctx.beginPath(); ctx.moveTo(ox0,oy0); ctx.lineTo(ox1,oy1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax0,ay0); ctx.lineTo(ax1,ay1); ctx.stroke();

    pts.forEach((p,i) => {
      const [px,py] = toC(p[0],p[1]);
      ctx.fillStyle = (i===a||i===b||i===c) ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.7)';
      ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='var(--text-2)'; ctx.font='9px monospace';
      ctx.fillText(`#${i+1}`, px+6, py-6);
    });

    const drawArrow = (from, to, col, label) => {
      const [fx,fy] = toC(from[0], from[1]);
      const [tx,ty] = toC(to[0], to[1]);
      ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(tx,ty); ctx.stroke();
      const ang = Math.atan2(ty-fy, tx-fx);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 8*Math.cos(ang-0.4), ty - 8*Math.sin(ang-0.4));
      ctx.lineTo(tx - 8*Math.cos(ang+0.4), ty - 8*Math.sin(ang+0.4));
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      if (label) {
        ctx.fillStyle = col; ctx.font = '10px monospace';
        ctx.fillText(label, (fx+tx)/2 + 6, (fy+ty)/2 - 4);
      }
    };

    drawArrow(pts[c], pts[b], '#a78bfa', 'B − C');

    const stagedTo = [pts[a][0] + (pts[b][0]-pts[c][0]), pts[a][1] + (pts[b][1]-pts[c][1])];
    drawArrow(pts[a], child, '#34d399', `+ F·(B−C)`);

    [['A',pts[a],'#22d3ee'],['B',pts[b],'#fb7185'],['C',pts[c],'#fbbf24']].forEach(([l,p,col])=>{
      const [px,py] = toC(p[0],p[1]);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText(l, px, py+3); ctx.textAlign='left';
    });
    void stagedTo;

    const [chx,chy] = toC(child[0], child[1]);
    ctx.save(); ctx.shadowColor='#34d399'; ctx.shadowBlur=12;
    ctx.fillStyle='#34d399';
    ctx.beginPath(); ctx.arc(chx,chy,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#0d1a30'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
    ctx.fillText('★', chx, chy+3); ctx.textAlign='left';
    ctx.restore();
  }, [pts, a, b, c, F, child]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">DIFFERENTIAL EVOLUTION — Mutation Operator</div>
      <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.6rem'}}>
        Pick three distinct individuals A, B, C from the population. The child is <Tex src="\text{child} = A + F\cdot(B - C)" />. The bigger the population spread, the bigger the step — <strong>adaptive mutation</strong> for free.
      </div>
      <canvas ref={canvasRef} style={{width:'100%',height:280,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.5rem',marginTop:'0.7rem'}}>
        {[['A',a,setA,'#22d3ee'],['B',b,setB,'#fb7185'],['C',c,setC,'#fbbf24']].map(([l,v,fn,col])=>(
          <div key={l}>
            <div style={{fontSize:'0.65rem',color:col,fontFamily:'monospace',fontWeight:700}}>Pick {l}</div>
            <select value={v} onChange={e=>fn(+e.target.value)} style={{width:'100%',background:'var(--bg-2)',color:'var(--text-1)',border:`1px solid ${col}55`,padding:'2px',fontFamily:'monospace',fontSize:'0.7rem'}}>
              {pts.map((_,i)=><option key={i} value={i} disabled={i!==v && [a,b,c].includes(i)}>#{i+1}</option>)}
            </select>
          </div>
        ))}
        <div>
          <div style={{fontSize:'0.65rem',color:'#34d399',fontFamily:'monospace',fontWeight:700}}>F (scale)</div>
          <input type="range" min={0.1} max={2} step={0.1} value={F} onChange={e=>setF(+e.target.value)} style={{width:'100%'}} />
          <span style={{fontFamily:'monospace',fontSize:'0.7rem',color:'#34d399'}}>{F.toFixed(1)}</span>
        </div>
        <div style={{display:'flex',alignItems:'flex-end'}}>
          <button className="m4-algo-tab" style={{padding:'4px 14px',fontSize:'0.7rem'}} onClick={()=>setPts(Array.from({length:6},()=>[Math.random()*8-4, Math.random()*8-4]))}>↺ New population</button>
        </div>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.7rem',fontSize:'0.74rem'}}>
        <strong>Self-tuning step:</strong> when the population is spread out (early), B−C is large and steps are big. As individuals converge, B−C shrinks and steps shrink with them — automatic exploitation. Closely related to Nelder-Mead reflection moves.
      </div>
    </div>
  );
}

function EmergentTab() {
  const [sec, setSec] = useState('overview');
  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview','Overview'],
          ['pso','Particle Swarm'],
          ['de','Differential Evolution'],
          ['hybrid','Hybrid & Memetic'],
          ['roadmap','Roadmap'],
        ].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'overview' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(52,211,153,0.07) 0%,rgba(34,211,238,0.07) 100%)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['Emergence','Whole > sum of parts','#22d3ee'],['PSO','Swarm intelligence','#a78bfa'],['DE','Adaptive vector mutation','#34d399'],['Hybrid','Local + global','#fbbf24'],['Memetic','Lamarckian learning','#fb7185'],['Co-evolution','Relative fitness','#06b6d4']].map(([k,v,col])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Emergent Behaviour — The Idea</div>
              <div className="m4-infobox" style={{fontSize:'0.78rem'}}>
                A flock of seagulls fishing — each bird makes a private decision (where I caught fish, where the biggest catch is, where most birds are diving). Globally, the flock <em>converges</em> on the best feeding ground. Nobody planned it.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Each individual chooses among</div>
              <ul className="m4-bullets">
                <li>Where <strong>I</strong> have found fish so far (personal best).</li>
                <li>Where the <strong>biggest catch</strong> has been seen by anyone (global best).</li>
                <li>Where my <strong>nearest neighbours</strong> are doing well (informants' best).</li>
                <li>Some random <strong>combination</strong> of all of the above.</li>
              </ul>
              <div style={{background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:8,padding:'0.6rem',marginTop:'0.5rem',fontSize:'0.76rem',lineHeight:1.6}}>
                <strong style={{color:'#34d399'}}>Collective behaviour</strong> drives <em>exploitation</em> — particles converge on the best.<br/>
                <strong style={{color:'#22d3ee'}}>Individual momentum</strong> drives <em>exploration</em> — particles overshoot and find new regions.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Laws of Motion — Physical Analogy</div>
              <table className="m4-ptable">
                <thead><tr><th>Force</th><th>Effect</th><th>Tendency</th></tr></thead>
                <tbody>
                  <tr><td className="pk">Momentum</td><td>Particle keeps moving in its current direction</td><td style={{color:'var(--cyan)'}}>Exploration</td></tr>
                  <tr><td className="pk">Personal pull</td><td>Gravitational pull to <Tex src="\vec{x}^*" /> (own best)</td><td style={{color:'var(--emerald)'}}>Exploitation</td></tr>
                  <tr><td className="pk">Local pull</td><td>Pull to <Tex src="\vec{x}^+" /> (informants' best)</td><td style={{color:'var(--emerald)'}}>Exploitation</td></tr>
                  <tr><td className="pk">Global pull</td><td>Pull to <Tex src="\vec{x}^!" /> (anyone's best ever)</td><td style={{color:'var(--emerald)'}}>Exploitation</td></tr>
                  <tr><td className="pk">Friction (α)</td><td>Decays velocity over time</td><td style={{color:'var(--emerald)'}}>Exploitation</td></tr>
                </tbody>
              </table>
              <div className="m4-hr"/>
              <div className="m4-flabel">Velocity update</div>
              <Tex src="v_i \leftarrow \alpha\, v_i + b(x_i^* - x_i) + c(x_i^+ - x_i) + d(x_i^! - x_i)" block />
              <Tex src="x_i \leftarrow x_i + \varepsilon\, v_i" block />
            </div>
          </div>
        </div>
      )}

      {sec === 'pso' && (
        <div>
          <div className="m4-card">
            <div className="m4-card-h">PARTICLE SWARM OPTIMISATION — Live Simulation (Ackley)</div>
            <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.6rem'}}>
              Particles search the Ackley function (global minimum at the origin, marked +). Adjust hyper-parameters and watch how the balance of momentum and pulls shifts the exploration/exploitation behaviour.
            </div>
            <PSOSimPanel />
          </div>

          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 39 — PSO</div>
              <div className="m4-pseudocode">{`swarmsize, α, β, γ, δ, ε ← chosen
P ← {swarmsize random particles
     each with random initial velocity}
Best ← ∅

repeat
  for each x ∈ P:
    AssessFitness(x)
    update Best

  for each x ∈ P:
    x*  ← own previous best
    x⁺  ← informants' best (incl. self)
    x!  ← global best ever
    for each dimension i:
      b ← U(0, β)
      c ← U(0, γ)
      d ← U(0, δ)
      v_i ← α·v_i
            + b·(x_i* − x_i)
            + c·(x_i⁺ − x_i)
            + d·(x_i! − x_i)

  for each x ∈ P:
    x ← x + ε·v
until ideal or out of time
return Best`}</div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Hyper-parameters &amp; Their Effects</div>
              <table className="m4-ptable">
                <thead><tr><th>Symbol</th><th>Meaning</th><th>Push toward</th></tr></thead>
                <tbody>
                  <tr><td className="pk">α</td><td>Inertia / momentum retention</td><td>Exploration</td></tr>
                  <tr><td className="pk">β</td><td>Pull toward personal best <Tex src="\vec{x}^*" /></td><td>Mild exploitation</td></tr>
                  <tr><td className="pk">γ</td><td>Pull toward informants' best <Tex src="\vec{x}^+" /></td><td>Local exploitation</td></tr>
                  <tr><td className="pk">δ</td><td>Pull toward global best <Tex src="\vec{x}^!" /></td><td>Strong exploitation</td></tr>
                  <tr><td className="pk">ε</td><td>Step-size scalar (cf. learning rate)</td><td>Both — bigger jumps</td></tr>
                </tbody>
              </table>
              <div className="m4-hr"/>
              <div className="m4-flabel">Two equivalent decompositions</div>
              <div style={{background:'var(--bg-2)',padding:'0.55rem 0.7rem',borderRadius:5,fontSize:'0.74rem',lineHeight:1.7,fontFamily:'monospace',color:'var(--text-1)'}}>
                <span style={{color:'var(--text-2)'}}>{'// Personal vs Social'}</span><br/>
                v ← <span style={{color:'#22d3ee'}}>v</span> + <span style={{color:'#a78bfa'}}>c₁r₁(pBest − x)</span> + <span style={{color:'#34d399'}}>c₂r₂(gBest − x)</span><br/>
                <span style={{color:'var(--text-2)'}}>{'// Cognitive vs Social (same eq.)'}</span>
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Definitions Recap</div>
            <table className="m4-ptable">
              <tbody>
                <tr><td className="pk"><Tex src="\vec{x} = (x_1,\, x_2, \dots)" /></td><td>Particle's location in search space</td></tr>
                <tr><td className="pk"><Tex src="\vec{v}" /></td><td>Particle's velocity vector</td></tr>
                <tr><td className="pk"><Tex src="\vec{v}^t = \vec{x}^t - \vec{x}^{t-1}" /></td><td>Discretised "velocity" between iterations</td></tr>
                <tr><td className="pk"><Tex src="\vec{a}^t = \vec{v}^t - \vec{v}^{t-1}" /></td><td>Discretised "acceleration"</td></tr>
                <tr><td className="pk"><Tex src="\vec{x}^*" /></td><td>Fittest location <em>this</em> particle has visited</td></tr>
                <tr><td className="pk"><Tex src="\vec{x}^+" /></td><td>Fittest location among the particle's <em>informants</em></td></tr>
                <tr><td className="pk"><Tex src="\vec{x}^!" /></td><td>Fittest location <em>any</em> particle has discovered</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'de' && (
        <div>
          <DEMutationViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Differential Evolution — Properties</div>
              <ul className="m4-bullets">
                <li>Primarily for <strong>multi-dimensional real-valued</strong> spaces (like PSO).</li>
                <li>Children compete <strong>directly against their immediate parent</strong> — only fitter children survive (one-to-one tournament).</li>
                <li>Step size is set by the current population spread — <strong>adaptive mutation</strong> with no separate learning-rate parameter.</li>
                <li>Reminiscent of <strong>Nelder-Mead</strong> simplex moves: reflection, expansion, contraction. Population is a kind of distributed simplex.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-warnbox" style={{fontSize:'0.74rem'}}>
                When the population converges, B − C → 0 and so do the steps. Diversity loss is irreversible without an explicit re-injection mechanism — same trap as crossover-only GAs.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">DE Step (sketch)</div>
              <div className="m4-pseudocode">{`for each individual A in population:
  pick B, C ≠ A, B ≠ C uniformly
  trial ← A + F·(B − C)         ▷ mutate
  trial ← Crossover(A, trial)   ▷ optional
  if Fitness(trial) > Fitness(A):
    replace A with trial
end for`}</div>
              <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.5rem',lineHeight:1.6}}>
                Typical scale factor <Tex src="F \in [0.4, 1.0]" />. The "DE/rand/1/bin" naming convention encodes the mutation base, number of difference vectors, and crossover scheme.
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'hybrid' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Why Hybridise?</div>
              <table className="m4-ptable">
                <tbody>
                  <tr><td className="pk">Single-state</td><td>Hill climb, SA → very efficient at <strong>local</strong> optima</td></tr>
                  <tr><td className="pk">Population</td><td>EA, GA, PSO → much better at <strong>global</strong> exploration</td></tr>
                  <tr><td className="pk" style={{color:'var(--emerald)'}}>Hybrid</td><td>EA discovers promising regions; HC polishes each candidate to its local best</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.76rem'}}>
                Simplest hybrid strategy: <strong>after each generation, hill-climb every individual for t steps</strong> before breeding. Replace the population members with their improved versions.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Algorithm 36 — Hybrid EA + Hill-Climb</div>
              <div className="m4-pseudocode">{`t ← number of HC iterations per individual

P ← BuildInitialPopulation()
Best ← ∅
repeat
  AssessFitness(P)
  for each Pᵢ ∈ P:
    Pᵢ ← HillClimb(Pᵢ) for t iterations
    if Best=∅ or Fit(Pᵢ) > Fit(Best):
      Best ← Pᵢ
  P ← Join(P, Breed(P))
until ideal or out of time
return Best`}</div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Memetic Algorithms — Lamarck's Last Laugh</div>
            <div className="m4-two-col">
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.7}}>
                <p>A <strong>meme</strong> is the social analogue of a gene — a unit of behaviour that spreads, replicates, and influences fitness. Memes propagate <em>within</em> a generation through learning.</p>
                <p>In a memetic algorithm, the <strong>improvement found by hill-climbing is written back into the genome</strong> — the individual that breeds is the post-HC version. This is genuine Lamarckian inheritance: acquired improvements are passed to offspring.</p>
                <p>It works because algorithms aren't bound by biology. The Weismann barrier is a physical constraint on cells, not on data structures.</p>
              </div>
              <div style={{background:'rgba(167,139,250,0.06)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:8,padding:'0.7rem',fontSize:'0.74rem',lineHeight:1.65}}>
                <strong style={{color:'#a78bfa'}}>Open question (Luke):</strong> can memes be passed <em>between</em> generations as well as within? In algorithms, this is just <strong>caching</strong> a population's lifetime improvements as the seed for the next round. Easy. In biology — that's the epigenetics question.
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'roadmap' && (
        <div>
          <div className="m4-card">
            <div className="m4-card-h">Optimisation Roadmap — The Whole Course in One Tree</div>
            <div className="m4-pseudocode" style={{fontSize:'0.72rem'}}>{`Optimisation
├── Deterministic
│   ├── Gradient methods (Lec 6)
│   │   ├── Gradient descent / ascent
│   │   └── Newton-Raphson
│   └── Direct methods (Lec 7)
│       ├── CCS / Powell / Hooke-Jeeves
│       └── Nelder-Mead simplex
└── Stochastic
    ├── Single-state (Lec 9)
    │   ├── Hill Climbing + restarts
    │   ├── Simulated Annealing
    │   ├── Tabu Search
    │   └── Iterated Local Search
    └── Population-based (Lec 10–12)
        ├── EA / ES / EC / EP   ◄── Lec 10
        ├── Genetic Algorithms  ◄── Lec 11
        │   ├── Crossover (1pt, 2pt, uniform)
        │   ├── Selection (roulette, SUS, tournament)
        │   ├── Elitism
        │   └── Genetic Programming (trees)
        └── Emergent / Swarm    ◄── Lec 12
            ├── Particle Swarm Optimisation
            ├── Differential Evolution
            ├── Ant Colony, Dragonfly
            └── Hybrid / Memetic
                (single-state ⇄ population)`}</div>
          </div>
          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(34,211,238,0.05) 0%,rgba(167,139,250,0.05) 100%)'}}>
            <div className="m4-card-h">The Three Big Tensions</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.55rem',marginTop:'0.4rem'}}>
              {[
                ['Exploration ⇄ Exploitation','#22d3ee','Every algorithm tunes this. SA cools temperature; ES tunes σ; PSO balances α vs δ; GA balances mutation vs elitism.'],
                ['Diversity ⇄ Convergence','#a78bfa','Diversity is the fuel for finding global optima. Once lost, only mutation can rebuild it. Memetic algorithms accelerate convergence at the cost of diversity.'],
                ['Information ⇄ Noise','#34d399','More candidates give more landscape information per generation, but each evaluation costs the same. The art is extracting the most information per evaluation.'],
              ].map(([t,col,d])=>(
                <div key={t} style={{background:`${col}11`,border:`1px solid ${col}33`,borderRadius:8,padding:'0.6rem'}}>
                  <div style={{fontSize:'0.72rem',fontWeight:700,color:col,marginBottom:'0.3rem'}}>{t}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-2)',lineHeight:1.55}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Perceptrons & 1-D Classifiers (Lecture 13) ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const ESC_VELS = [1, 5, 3, 2, 2.5, 2.2];
const ESC_YS   = [0, 1, 1, 0, 1, 0];
const TRUE_ESC_VEL = 2.38;

function sig(z) { return 1 / (1 + Math.exp(-z)); }

// === Step Function vs Logistic Sigmoid playground ============================
function StepVsSigmoidViz() {
  const [w, setW] = useState(2.0);
  const [b, setB] = useState(-5.0);
  const [showDeriv, setShowDeriv] = useState(true);
  const [showStep, setShowStep] = useState(true);
  const canRef = useRef(null);

  useEffect(() => {
    const c = canRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 520;
    const H = c.height = 320;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const xMin = -1, xMax = 7;
    const PAD_L = 36, PAD_R = 16, PAD_T = 16, PAD_B = 32;
    const toX = x => PAD_L + (x-xMin)/(xMax-xMin)*(W-PAD_L-PAD_R);
    const toY = y => H-PAD_B - y*(H-PAD_T-PAD_B);

    ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
    for (let g=xMin; g<=xMax; g++) {
      ctx.beginPath(); ctx.moveTo(toX(g),PAD_T); ctx.lineTo(toX(g),H-PAD_B); ctx.stroke();
    }
    for (let g=0; g<=1; g+=0.25) {
      ctx.beginPath(); ctx.moveTo(PAD_L,toY(g)); ctx.lineTo(W-PAD_R,toY(g)); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.setLineDash([5,5]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD_L,toY(0.5)); ctx.lineTo(W-PAD_R,toY(0.5)); ctx.stroke();
    ctx.setLineDash([]);

    const bdry = -b/w;
    if (bdry >= xMin && bdry <= xMax) {
      ctx.strokeStyle='rgba(52,211,153,0.55)'; ctx.setLineDash([3,6]); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(toX(bdry),PAD_T); ctx.lineTo(toX(bdry),H-PAD_B); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (showStep) {
      ctx.strokeStyle='#fb7185'; ctx.lineWidth=2; ctx.beginPath();
      ctx.moveTo(toX(xMin),toY(w>0?0:1));
      ctx.lineTo(toX(bdry),toY(w>0?0:1));
      ctx.moveTo(toX(bdry),toY(w>0?1:0));
      ctx.lineTo(toX(xMax),toY(w>0?1:0));
      ctx.stroke();
    }

    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=2.6; ctx.beginPath();
    for (let i=0;i<=400;i++) {
      const x = xMin + i/400*(xMax-xMin);
      const y = sig(w*x + b);
      i===0?ctx.moveTo(toX(x),toY(y)):ctx.lineTo(toX(x),toY(y));
    }
    ctx.stroke();

    if (showDeriv) {
      ctx.strokeStyle='rgba(167,139,250,0.75)'; ctx.lineWidth=1.6; ctx.setLineDash([4,4]);
      ctx.beginPath();
      const peak = Math.abs(w)*0.25;
      for (let i=0;i<=400;i++) {
        const x = xMin + i/400*(xMax-xMin);
        const s = sig(w*x + b);
        const ds = Math.abs(w) * s * (1-s) / Math.max(peak, 0.1);
        i===0?ctx.moveTo(toX(x),toY(ds)):ctx.lineTo(toX(x),toY(ds));
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    ESC_VELS.forEach((vel,i) => {
      if (vel < xMin || vel > xMax) return;
      const y = ESC_YS[i];
      ctx.fillStyle = y===1 ? '#34d399' : '#fb7185';
      ctx.beginPath(); ctx.arc(toX(vel), toY(y), 6.5, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.4; ctx.stroke();
      ctx.fillStyle='rgba(13,26,48,0.95)'; ctx.font='bold 8.5px monospace'; ctx.textAlign='center';
      ctx.fillText(y===1?'YES':'no', toX(vel), toY(y)+3);
    });

    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='9.5px monospace'; ctx.textAlign='right';
    [0,0.25,0.5,0.75,1].forEach(v => ctx.fillText(v.toFixed(2), PAD_L-4, toY(v)+3));
    ctx.textAlign='center';
    for (let g=xMin; g<=xMax; g++) ctx.fillText(g.toString(), toX(g), H-PAD_B+14);

    ctx.fillStyle='#fbbf24'; ctx.font='10.5px monospace'; ctx.textAlign='left';
    ctx.fillText('decision = 0.5', toX(xMin)+6, toY(0.5)-5);
    if (bdry >= xMin && bdry <= xMax) {
      ctx.fillStyle='#34d399';
      ctx.fillText(`x = ${bdry.toFixed(2)}`, toX(bdry)+4, PAD_T+14);
    }

    ctx.fillStyle='rgba(34,211,238,0.9)'; ctx.fillText('— sigmoid σ(wx+b)', W-150, PAD_T+12);
    if (showStep) { ctx.fillStyle='rgba(251,113,133,0.9)'; ctx.fillText('— step', W-150, PAD_T+26); }
    if (showDeriv) { ctx.fillStyle='rgba(167,139,250,0.9)'; ctx.fillText('---- σ′ (norm.)', W-150, PAD_T+40); }
  }, [w, b, showDeriv, showStep]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Step Function vs Logistic Sigmoid — Live</div>
      <div style={{fontSize:'0.76rem',color:'var(--text-2)',marginBottom:'0.6rem',lineHeight:1.6}}>
        Scrub <strong style={{color:'#22d3ee'}}>w</strong> (steepness) and <strong style={{color:'#fbbf24'}}>b</strong> (bias). The sigmoid approaches a perfect step as <Tex src="w \to \infty" />. The decision boundary sits at <Tex src="x = -b/w" />.
      </div>
      <canvas ref={canRef} style={{width:'100%',height:320,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginTop:'0.65rem'}}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem'}}>
            <span style={{color:'var(--text-2)'}}>weight w</span>
            <span style={{fontFamily:'monospace',color:'#22d3ee'}}>{w.toFixed(2)}</span>
          </div>
          <input type="range" min={0.1} max={20} step={0.1} value={w} onChange={e=>setW(+e.target.value)} style={{width:'100%'}} />
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem'}}>
            <span style={{color:'var(--text-2)'}}>bias b</span>
            <span style={{fontFamily:'monospace',color:'#fbbf24'}}>{b.toFixed(2)}</span>
          </div>
          <input type="range" min={-15} max={5} step={0.05} value={b} onChange={e=>setB(+e.target.value)} style={{width:'100%'}} />
        </div>
      </div>
      <div style={{display:'flex',gap:'0.55rem',marginTop:'0.55rem',flexWrap:'wrap'}}>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setShowStep(s=>!s)}>{showStep?'☑':'☐'} step</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setShowDeriv(s=>!s)}>{showDeriv?'☑':'☐'} σ′ derivative</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>{setW(20); setB(-50);}}>Approach step</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>{setW(2); setB(-5);}}>Gentle σ</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>{setW(1.745); setB(-4.339);}}>Trained (Lec 13)</button>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.7rem',fontSize:'0.74rem'}}>
        <strong>Memorise:</strong> &nbsp;σ(z) = 1/(1+e<sup>-z</sup>) &nbsp;|&nbsp; σ&#x2032;(z) = σ(z)(1−σ(z)) &nbsp;|&nbsp; max σ&#x2032; = 0.25 at z=0 &nbsp;|&nbsp; bounded in (0,1).
      </div>
    </div>
  );
}

// === Live 1-D Gradient Descent on Escape Velocity ============================
function GradientDescent1DLive() {
  const [b, setB] = useState(-5);
  const [alpha, setAlpha] = useState(10);
  const [running, setRunning] = useState(false);
  const [iter, setIter] = useState(0);
  const [hist, setHist] = useState([]);
  const runRef = useRef(false);
  const bRef = useRef(b);
  bRef.current = b;
  runRef.current = running;
  const canA = useRef(null);
  const canB = useRef(null);

  const cost = useCallback((bv) => {
    let s = 0;
    for (let i = 0; i < ESC_VELS.length; i++) {
      const a = sig(ESC_VELS[i] + bv);
      const r = ESC_YS[i] - a;
      s += r*r;
    }
    return s / (2*ESC_VELS.length);
  }, []);

  const dC = useCallback((bv) => {
    let s = 0;
    for (let i = 0; i < ESC_VELS.length; i++) {
      const a = sig(ESC_VELS[i] + bv);
      s += (ESC_YS[i] - a) * a * (1-a);
    }
    return -s / ESC_VELS.length;
  }, []);

  const drawCostCurve = useCallback(() => {
    const c = canA.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 250;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const bMin = -8, bMax = 1;
    const cMax = 0.18, cMin = 0;
    const PAD = 32;
    const toX = bv => PAD + (bv-bMin)/(bMax-bMin)*(W-PAD-12);
    const toY = cv => H-PAD - (cv-cMin)/(cMax-cMin)*(H-PAD-12);

    ctx.strokeStyle='rgba(148,163,184,0.07)'; ctx.lineWidth=1;
    for (let g=bMin; g<=bMax; g++) {
      ctx.beginPath(); ctx.moveTo(toX(g),12); ctx.lineTo(toX(g),H-PAD); ctx.stroke();
    }
    for (let g=0; g<=cMax; g+=0.04) {
      ctx.beginPath(); ctx.moveTo(PAD,toY(g)); ctx.lineTo(W-12,toY(g)); ctx.stroke();
    }

    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=2; ctx.beginPath();
    for (let i=0;i<=200;i++) {
      const bv = bMin + i/200*(bMax-bMin);
      const cv = cost(bv);
      i===0?ctx.moveTo(toX(bv),toY(cv)):ctx.lineTo(toX(bv),toY(cv));
    }
    ctx.stroke();

    if (hist.length > 1) {
      ctx.strokeStyle='rgba(251,191,36,0.55)'; ctx.lineWidth=1.4;
      ctx.beginPath();
      hist.forEach((h,i)=>{
        i===0?ctx.moveTo(toX(h.b),toY(h.c)):ctx.lineTo(toX(h.b),toY(h.c));
      });
      ctx.stroke();
    }
    hist.forEach((h,i) => {
      const last = i === hist.length-1;
      ctx.fillStyle = last ? '#fb7185' : 'rgba(251,191,36,0.6)';
      ctx.beginPath(); ctx.arc(toX(h.b), toY(h.c), last?5:2.8, 0, 2*Math.PI); ctx.fill();
    });

    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='9.5px monospace'; ctx.textAlign='right';
    [0,0.04,0.08,0.12,0.16].forEach(v=>ctx.fillText(v.toFixed(2), PAD-3, toY(v)+3));
    ctx.textAlign='center';
    for (let g=bMin; g<=bMax; g+=1) ctx.fillText(g.toString(), toX(g), H-PAD+14);

    ctx.fillStyle='var(--text-2)'; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText('b', W/2, H-6);
    ctx.save(); ctx.translate(10, H/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('C(b)', 0, 0); ctx.restore();
  }, [hist, cost]);

  const drawDataFit = useCallback(() => {
    const c = canB.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 250;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const xMin = -1, xMax = 7;
    const PAD = 30;
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-12);
    const toY = y => H-PAD - y*(H-PAD-12);

    ctx.strokeStyle='rgba(148,163,184,0.07)';
    for (let g=xMin; g<=xMax; g++) { ctx.beginPath(); ctx.moveTo(toX(g),12); ctx.lineTo(toX(g),H-PAD); ctx.stroke(); }
    for (let g=0; g<=1; g+=0.25) { ctx.beginPath(); ctx.moveTo(PAD,toY(g)); ctx.lineTo(W-12,toY(g)); ctx.stroke(); }

    ctx.strokeStyle='rgba(251,191,36,0.4)'; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD,toY(0.5)); ctx.lineTo(W-12,toY(0.5)); ctx.stroke(); ctx.setLineDash([]);

    const bdry = -b;
    if (bdry >= xMin && bdry <= xMax) {
      ctx.strokeStyle='#34d399'; ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(toX(bdry),12); ctx.lineTo(toX(bdry),H-PAD); ctx.stroke(); ctx.setLineDash([]);
    }

    const trueB = toX(TRUE_ESC_VEL);
    ctx.strokeStyle='rgba(167,139,250,0.6)'; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(trueB,12); ctx.lineTo(trueB,H-PAD); ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=2.4; ctx.beginPath();
    for (let i=0;i<=300;i++) {
      const x = xMin + i/300*(xMax-xMin);
      const y = sig(x + b);
      i===0?ctx.moveTo(toX(x),toY(y)):ctx.lineTo(toX(x),toY(y));
    }
    ctx.stroke();

    ESC_VELS.forEach((vel,i) => {
      const y = ESC_YS[i];
      const a = sig(vel + b);
      const correct = (a > 0.5) === (y === 1);
      ctx.strokeStyle = correct ? 'rgba(52,211,153,0.5)' : 'rgba(251,113,133,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(toX(vel), toY(y)); ctx.lineTo(toX(vel), toY(a)); ctx.stroke();
      ctx.fillStyle = y===1 ? '#34d399' : '#fb7185';
      ctx.beginPath(); ctx.arc(toX(vel), toY(y), 5.5, 0, 2*Math.PI); ctx.fill();
    });

    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='9.5px monospace'; ctx.textAlign='right';
    [0,0.5,1].forEach(v=>ctx.fillText(v.toFixed(1), PAD-3, toY(v)+3));
    ctx.textAlign='center';
    for (let g=xMin; g<=xMax; g++) ctx.fillText(g.toString(), toX(g), H-PAD+14);

    ctx.fillStyle='#a78bfa'; ctx.font='9.5px monospace'; ctx.textAlign='left';
    ctx.fillText('true (2.38)', trueB+3, 24);
    if (bdry >= xMin && bdry <= xMax) {
      ctx.fillStyle='#34d399';
      ctx.fillText(`learned: ${bdry.toFixed(2)}`, toX(bdry)+3, 38);
    }
  }, [b]);

  useEffect(()=>{ drawCostCurve(); drawDataFit(); }, [b, hist, drawCostCurve, drawDataFit]);

  const reset = useCallback((nb) => {
    runRef.current = false; setRunning(false);
    const initB = nb !== undefined ? nb : -10 * Math.random();
    setB(initB);
    setIter(0);
    setHist([{b: initB, c: cost(initB)}]);
  }, [cost]);

  useEffect(()=>{ reset(-5); }, []); // eslint-disable-line

  const step = useCallback(() => {
    const cur = bRef.current;
    const grad = dC(cur);
    const next = cur - alpha * grad;
    setB(next);
    setIter(it => it+1);
    setHist(h => {
      const nh = [...h, {b:next, c:cost(next)}];
      return nh.length > 200 ? nh.slice(-200) : nh;
    });
    return next;
  }, [alpha, cost, dC]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let last = bRef.current;
    const tick = () => {
      if (cancelled || !runRef.current) return;
      const nxt = step();
      if (Math.abs(nxt - last) < 1e-7) { runRef.current=false; setRunning(false); return; }
      last = nxt;
      setTimeout(tick, 50);
    };
    tick();
    return () => { cancelled = true; };
  }, [running, step]);

  const grad = dC(b);
  const correct = ESC_VELS.filter((v,i)=>(sig(v+b)>0.5)===(ESC_YS[i]===1)).length;

  return (
    <div className="m4-card">
      <div className="m4-card-h">1-D Gradient Descent — Live on Escape Velocity</div>
      <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.6}}>
        Optimise <strong>only b</strong> in <Tex src="a(b,x) = \sigma(x+b)" />. The model has <strong>one degree of freedom</strong> — the threshold. Watch how the cost rolls toward its minimum near b ≈ −2.50.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}}>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:3,fontFamily:'monospace'}}>Cost surface C(b) — orange = trail, red = current</div>
          <canvas ref={canA} style={{width:'100%',height:250,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
        </div>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:3,fontFamily:'monospace'}}>Data + sigmoid fit — residuals shown vertically</div>
          <canvas ref={canB} style={{width:'100%',height:250,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.55rem',marginTop:'0.55rem'}}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem'}}>
            <span style={{color:'var(--text-2)'}}>learning rate α</span>
            <span style={{fontFamily:'monospace',color:'#22d3ee'}}>{alpha.toFixed(1)}</span>
          </div>
          <input type="range" min={0.1} max={50} step={0.1} value={alpha} onChange={e=>setAlpha(+e.target.value)} style={{width:'100%'}} />
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem'}}>
            <span style={{color:'var(--text-2)'}}>current b</span>
            <span style={{fontFamily:'monospace',color:'#fbbf24'}}>{b.toFixed(4)}</span>
          </div>
          <input type="range" min={-10} max={1} step={0.01} value={b} onChange={e=>{
            const nb = +e.target.value;
            setB(nb); setIter(0); setHist([{b:nb, c:cost(nb)}]);
          }} style={{width:'100%'}} />
        </div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.55rem'}}>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>setRunning(r=>!r)}>{running?'⏸ Pause':'▶ Run'}</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>{if(!running) step();}}>⏭ Step</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset()}>↺ Random restart</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset(-9)}>b=-9</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset(0)}>b=0</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.4rem',marginTop:'0.55rem',fontFamily:'monospace',fontSize:'0.72rem'}}>
        <div style={{background:'rgba(34,211,238,0.08)',border:'1px solid rgba(34,211,238,0.25)',borderRadius:6,padding:'0.35rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.62rem'}}>iter</div>
          <div style={{color:'#22d3ee'}}>{iter}</div>
        </div>
        <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:6,padding:'0.35rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.62rem'}}>cost C(b)</div>
          <div style={{color:'#fbbf24'}}>{cost(b).toFixed(5)}</div>
        </div>
        <div style={{background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:6,padding:'0.35rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.62rem'}}>gradient dC/db</div>
          <div style={{color:'#a78bfa'}}>{grad.toFixed(5)}</div>
        </div>
        <div style={{background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:6,padding:'0.35rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.62rem'}}>correct / 6</div>
          <div style={{color:'#34d399'}}>{correct}/6</div>
        </div>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
        Convergence reliably finds <strong>b ≈ −2.5028</strong> → decision boundary x ≈ 2.50 km/s. True moon escape velocity is 2.38 km/s — the sample at x=2.5 is misclassified because the 1-parameter model <em>cannot</em> resolve it.
      </div>
    </div>
  );
}

// === Live 2-D Gradient Descent with Divergence Demo ==========================
function GradientDescent2DLive() {
  const [w, setW] = useState(0.8);
  const [b, setB] = useState(-1.8);
  const [alpha, setAlpha] = useState(8);
  const [running, setRunning] = useState(false);
  const [iter, setIter] = useState(0);
  const [trace, setTrace] = useState([]);
  const [autoStop, setAutoStop] = useState(true);
  const runRef = useRef(false);
  const stateRef = useRef({w:0.8, b:-1.8});
  stateRef.current = {w, b};
  runRef.current = running;
  const canRef = useRef(null);
  const traceRef = useRef(null);

  const cost = useCallback((wv, bv) => {
    let s = 0;
    for (let i = 0; i < ESC_VELS.length; i++) {
      const a = sig(wv*ESC_VELS[i] + bv);
      const r = ESC_YS[i] - a;
      s += r*r;
    }
    return s / (2*ESC_VELS.length);
  }, []);

  const grad = useCallback((wv, bv) => {
    let dw=0, db=0;
    for (let i = 0; i < ESC_VELS.length; i++) {
      const x = ESC_VELS[i];
      const a = sig(wv*x + bv);
      const e = (ESC_YS[i] - a) * a * (1-a);
      dw += x * e;
      db += e;
    }
    return [-dw/ESC_VELS.length, -db/ESC_VELS.length];
  }, []);

  const drawFit = useCallback(() => {
    const c = canRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 230;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const xMin = -1, xMax = 7;
    const PAD = 30;
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-12);
    const toY = y => H-PAD - y*(H-PAD-12);

    ctx.strokeStyle='rgba(148,163,184,0.07)';
    for (let g=xMin; g<=xMax; g++) { ctx.beginPath(); ctx.moveTo(toX(g),12); ctx.lineTo(toX(g),H-PAD); ctx.stroke(); }
    for (let g=0; g<=1; g+=0.25) { ctx.beginPath(); ctx.moveTo(PAD,toY(g)); ctx.lineTo(W-12,toY(g)); ctx.stroke(); }

    ctx.strokeStyle='rgba(251,191,36,0.4)'; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD,toY(0.5)); ctx.lineTo(W-12,toY(0.5)); ctx.stroke(); ctx.setLineDash([]);

    const bdry = -b/w;
    if (bdry >= xMin && bdry <= xMax) {
      ctx.strokeStyle='#34d399'; ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(toX(bdry),12); ctx.lineTo(toX(bdry),H-PAD); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle='rgba(167,139,250,0.6)'; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(toX(TRUE_ESC_VEL),12); ctx.lineTo(toX(TRUE_ESC_VEL),H-PAD); ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle='#22d3ee'; ctx.lineWidth=2.4; ctx.beginPath();
    for (let i=0;i<=300;i++) {
      const x = xMin + i/300*(xMax-xMin);
      const y = sig(w*x + b);
      i===0?ctx.moveTo(toX(x),toY(y)):ctx.lineTo(toX(x),toY(y));
    }
    ctx.stroke();

    ESC_VELS.forEach((vel,i) => {
      const y = ESC_YS[i];
      const a = sig(w*vel + b);
      const correct = (a > 0.5) === (y === 1);
      ctx.strokeStyle = correct ? 'rgba(52,211,153,0.4)' : 'rgba(251,113,133,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(toX(vel), toY(y)); ctx.lineTo(toX(vel), toY(a)); ctx.stroke();
      ctx.fillStyle = y===1 ? '#34d399' : '#fb7185';
      ctx.beginPath(); ctx.arc(toX(vel), toY(y), 5.5, 0, 2*Math.PI); ctx.fill();
    });

    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='9px monospace'; ctx.textAlign='right';
    [0,0.5,1].forEach(v=>ctx.fillText(v.toFixed(1), PAD-3, toY(v)+3));
    ctx.textAlign='center';
    for (let g=xMin; g<=xMax; g++) ctx.fillText(g.toString(), toX(g), H-PAD+12);
  }, [w, b]);

  const drawTrace = useCallback(() => {
    const c = traceRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 230;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const wMin = -1, wMax = Math.max(8, ...trace.map(t=>t.w), w) + 1;
    const bMin = Math.min(-10, ...trace.map(t=>t.b), b) - 1;
    const bMax = 2;
    const PAD = 30;
    const toX = wv => PAD + (wv-wMin)/(wMax-wMin)*(W-PAD-12);
    const toY = bv => H-PAD - (bv-bMin)/(bMax-bMin)*(H-PAD-12);

    ctx.strokeStyle='rgba(148,163,184,0.05)';
    for (let g=0; g<Math.ceil(wMax); g++) { ctx.beginPath(); ctx.moveTo(toX(g),12); ctx.lineTo(toX(g),H-PAD); ctx.stroke(); }
    for (let g=Math.ceil(bMin); g<=bMax; g++) { ctx.beginPath(); ctx.moveTo(PAD,toY(g)); ctx.lineTo(W-12,toY(g)); ctx.stroke(); }

    const NX = 80, NY = 50;
    let mn=Infinity, mx=-Infinity;
    const grid = new Float32Array(NX*NY);
    for (let yi=0; yi<NY; yi++) for (let xi=0; xi<NX; xi++) {
      const wv = wMin + (xi/(NX-1))*(wMax-wMin);
      const bv = bMin + (yi/(NY-1))*(bMax-bMin);
      const v = cost(wv, bv); grid[yi*NX+xi]=v;
      if (v<mn) mn=v; if (v>mx) mx=v;
    }
    const cellW = (W-PAD-12)/NX, cellH = (H-PAD-12)/NY;
    for (let yi=0; yi<NY; yi++) for (let xi=0; xi<NX; xi++) {
      const t = (grid[yi*NX+xi] - mn)/Math.max(1e-6, mx-mn);
      const r = Math.round(15 + t*60);
      const g = Math.round((1-t)*100 + 20);
      const b2 = Math.round(40 + (1-t)*70);
      ctx.fillStyle = `rgba(${r},${g},${b2},0.65)`;
      ctx.fillRect(PAD + xi*cellW, H-PAD - (yi+1)*cellH, cellW+0.5, cellH+0.5);
    }

    if (trace.length > 1) {
      ctx.strokeStyle='#fbbf24'; ctx.lineWidth=1.6;
      ctx.beginPath();
      trace.forEach((t,i)=>{
        i===0?ctx.moveTo(toX(t.w),toY(t.b)):ctx.lineTo(toX(t.w),toY(t.b));
      });
      ctx.stroke();
    }
    if (trace.length > 0) {
      ctx.fillStyle='#fb7185';
      ctx.beginPath(); ctx.arc(toX(w),toY(b), 4.5, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1; ctx.stroke();
    }

    ctx.fillStyle='rgba(148,163,184,0.7)'; ctx.font='9px monospace';
    ctx.textAlign='right';
    for (let g=Math.ceil(bMin); g<=bMax; g+=2) ctx.fillText(g.toString(), PAD-3, toY(g)+3);
    ctx.textAlign='center';
    for (let g=0; g<Math.ceil(wMax); g+=2) ctx.fillText(g.toString(), toX(g), H-PAD+12);
    ctx.fillStyle='var(--text-2)'; ctx.textAlign='center';
    ctx.fillText('w →', W/2, H-4);
    ctx.save(); ctx.translate(10, H/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('b →', 0, 0); ctx.restore();
  }, [trace, w, b, cost]);

  useEffect(()=>{ drawFit(); drawTrace(); }, [w, b, trace, drawFit, drawTrace]);

  const reset = useCallback((preset) => {
    runRef.current=false; setRunning(false); setIter(0);
    let nw, nb;
    if (preset === 'a') { nw=1.7457; nb=-4.3394; }
    else if (preset === 'b') { nw=2.0014; nb=-4.8778; }
    else if (preset === 'c') { nw=0.6797; nb=-1.4958; }
    else if (preset === 'happy') { nw=1.5886; nb=-1.6249; }
    else if (preset === 'plateau') { nw=4; nb=-1; }
    else { nw=2*Math.random(); nb=-8*Math.random(); }
    setW(nw); setB(nb);
    setTrace([{w:nw, b:nb}]);
  }, []);

  useEffect(()=>{ reset('happy'); }, []); // eslint-disable-line

  const step = useCallback(() => {
    const {w:cw, b:cb} = stateRef.current;
    const [dw, db] = grad(cw, cb);
    const nw = cw - alpha*dw;
    const nb = cb - alpha*db;
    setW(nw); setB(nb); setIter(it=>it+1);
    setTrace(tr => {
      const nt = [...tr, {w:nw, b:nb}];
      return nt.length > 2000 ? nt.slice(-2000) : nt;
    });
    return {nw, nb};
  }, [alpha, grad]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || !runRef.current) return;
      const {nw, nb} = step();
      const allRight = ESC_VELS.every((v,i)=>(sig(nw*v+nb)>0.5)===(ESC_YS[i]===1));
      if (autoStop && allRight && Math.abs(stateRef.current.w) > 0.1) {
        runRef.current=false; setRunning(false); return;
      }
      setTimeout(tick, 30);
    };
    tick();
    return () => { cancelled = true; };
  }, [running, step, autoStop]);

  const correct = ESC_VELS.filter((v,i)=>(sig(w*v+b)>0.5)===(ESC_YS[i]===1)).length;
  const bdry = -b/w;

  return (
    <div className="m4-card">
      <div className="m4-card-h">2-D Gradient Descent — w and b together</div>
      <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.6}}>
        Adds a weight: <Tex src="a(w,b,x) = \sigma(wx + b)" />. Cost surface is now over (w, b). Watch the trajectory wind down to a basin near w≈1.7, b≈−4.3. Disable auto-stop and run forever to see the <strong>hidden divergence</strong>: w → ∞ and b → −∞.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}}>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:3,fontFamily:'monospace'}}>Data + fitted sigmoid σ(wx+b)</div>
          <canvas ref={canRef} style={{width:'100%',height:230,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
        </div>
        <div>
          <div style={{fontSize:'0.66rem',color:'var(--text-2)',marginBottom:3,fontFamily:'monospace'}}>(w,b) trajectory on cost landscape</div>
          <canvas ref={traceRef} style={{width:'100%',height:230,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem',marginTop:'0.55rem'}}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem'}}><span style={{color:'var(--text-2)'}}>α</span><span style={{fontFamily:'monospace',color:'#22d3ee'}}>{alpha.toFixed(1)}</span></div>
          <input type="range" min={0.5} max={30} step={0.5} value={alpha} onChange={e=>setAlpha(+e.target.value)} style={{width:'100%'}} />
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem'}}><span style={{color:'var(--text-2)'}}>w</span><span style={{fontFamily:'monospace',color:'#fbbf24'}}>{w.toFixed(3)}</span></div>
          <input type="range" min={-2} max={10} step={0.01} value={w} onChange={e=>{const nw=+e.target.value; setW(nw); setIter(0); setTrace([{w:nw,b}]);}} style={{width:'100%'}} />
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem'}}><span style={{color:'var(--text-2)'}}>b</span><span style={{fontFamily:'monospace',color:'#a78bfa'}}>{b.toFixed(3)}</span></div>
          <input type="range" min={-20} max={2} step={0.01} value={b} onChange={e=>{const nb=+e.target.value; setB(nb); setIter(0); setTrace([{w,b:nb}]);}} style={{width:'100%'}} />
        </div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginTop:'0.5rem'}}>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setRunning(r=>!r)}>{running?'⏸ Pause':'▶ Run'}</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>step()}>⏭ Step</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>reset()}>↺ Random</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>reset('happy')}>Happy</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>reset('plateau')}>Plateau</button>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setAutoStop(a=>!a)}>{autoStop?'☑':'☐'} auto-stop when correct</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.4rem',marginTop:'0.55rem',fontFamily:'monospace',fontSize:'0.7rem'}}>
        <div style={{background:'rgba(34,211,238,0.08)',border:'1px solid rgba(34,211,238,0.25)',borderRadius:6,padding:'0.3rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.6rem'}}>iter</div><div style={{color:'#22d3ee'}}>{iter}</div>
        </div>
        <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:6,padding:'0.3rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.6rem'}}>cost</div><div style={{color:'#fbbf24'}}>{cost(w,b).toFixed(5)}</div>
        </div>
        <div style={{background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:6,padding:'0.3rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.6rem'}}>−b/w</div><div style={{color:'#a78bfa'}}>{isFinite(bdry)?bdry.toFixed(3):'∞'}</div>
        </div>
        <div style={{background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:6,padding:'0.3rem 0.5rem'}}>
          <div style={{color:'var(--text-2)',fontSize:'0.6rem'}}>correct</div><div style={{color:'#34d399'}}>{correct}/6</div>
        </div>
      </div>
      <div className="m4-warnbox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
        <strong>Try "Plateau" then disable auto-stop and run for 1000+ iterations:</strong> w and b appear stable for ~80 iters, then collapse to opposite infinities. The ratio −b/w stays near 2.4 (correct decision boundary), but the parameters never converge. Cause: MSE with a logistic is minimised by an arbitrarily steep sigmoid.
      </div>
    </div>
  );
}

// === Chain Rule Derivation (step-by-step reveal) =============================
function ChainRuleDerivation() {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title:'1. Start: the cost function',
      tex:'C(b) = \\frac{1}{2n}\\sum_x \\big(y(x) - a(b,x)\\big)^2',
      note:'Mean squared error between target y(x) and predicted activation a(b,x). The 1/2 is a notational convenience — it cancels with the chain-rule "2" that appears in the next step.',
    },
    {
      title:'2. Sigmoid activation',
      tex:'a(b,x) = \\sigma(x+b) = \\frac{1}{1+e^{-(x+b)}}',
      note:'Choosing the logistic sigmoid as our continuously-differentiable replacement for the step function.',
    },
    {
      title:'3. Outer derivative — apply chain rule to the squared residual',
      tex:'\\frac{d}{db}\\,\\tfrac{1}{2}\\big(y - a\\big)^2 = -\\big(y - a\\big)\\cdot \\frac{d a}{d b}',
      note:'The 2 from the square cancels with the 1/2 from the cost. The minus sign appears because da/d(y−a) = −da/da.',
    },
    {
      title:'4. Compute da/db directly',
      tex:'\\frac{d a}{d b} = \\frac{e^{-(x+b)}}{\\big(1+e^{-(x+b)}\\big)^{2}}',
      note:'Quotient rule on 1/(1+e^{-(x+b)}), or recognise it as the derivative of the sigmoid in z evaluated at z = x+b.',
    },
    {
      title:'5. Recognise the sigmoid identity',
      tex:'\\sigma′(z) = \\sigma(z)\\,\\big(1 - \\sigma(z)\\big)',
      note:'Beautiful: the derivative of σ is expressible in terms of σ itself. No new evaluations needed during back-prop later.',
    },
    {
      title:'6. Substitute — full per-example gradient',
      tex:'-\\big(y - a\\big)\\cdot a\\cdot(1-a)',
      note:'Compact form. Three factors: (i) signed residual, (ii) sigmoid output, (iii) one minus sigmoid output.',
    },
    {
      title:'7. Average over n samples — final result',
      tex:'\\boxed{\\;\\frac{d}{db}C(b) = -\\frac{1}{n}\\sum_x \\big(y(x) - a(b,x)\\big)\\cdot a(b,x)\\cdot \\big(1 - a(b,x)\\big)\\;}',
      note:'This is the gradient used by 1-D gradient descent above. It is also the foundation of every back-propagation step in modern neural networks.',
    },
  ];
  const cur = steps[step];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Chain Rule Derivation — Step Through</div>
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.6rem',flexWrap:'wrap'}}>
        {steps.map((_,i)=>(
          <button key={i} className="m4-algo-tab" style={{padding:'2px 11px',fontSize:'0.7rem',background:step===i?'rgba(34,211,238,0.18)':'',borderColor:step===i?'var(--cyan)':''}} onClick={()=>setStep(i)}>{i+1}</button>
        ))}
        <button className="m4-algo-tab" style={{padding:'2px 11px',fontSize:'0.7rem'}} onClick={()=>setStep(s=>(s+1)%steps.length)}>Next →</button>
      </div>
      <div style={{background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.15)',borderRadius:8,padding:'1rem',marginBottom:'0.6rem'}}>
        <div style={{fontSize:'0.85rem',color:'var(--cyan)',marginBottom:'0.6rem',fontWeight:600}}>{cur.title}</div>
        <div style={{textAlign:'center',padding:'0.5rem 0'}}>
          <Tex src={cur.tex} block />
        </div>
        <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.55rem',lineHeight:1.6}}>{cur.note}</div>
      </div>
    </div>
  );
}

function PerceptronTab() {
  const [sec, setSec] = useState('overview');
  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview','Overview & Concept'],
          ['sigmoid','Step → Sigmoid'],
          ['math','Chain Rule Math'],
          ['1d','1-D Live Trainer'],
          ['2d','2-D Live Trainer'],
          ['code','Python Code'],
          ['discuss','Discussion & Limits'],
        ].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'overview' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(34,211,238,0.07) 0%,rgba(167,139,250,0.07) 100%)',border:'1px solid rgba(34,211,238,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['Classifier','f: x → {0,1}','#22d3ee'],['Bias trick','threshold T → b','#a78bfa'],['σ','logistic activation','#34d399'],['MSE','cost function','#fbbf24'],['1 param','only b','#fb7185'],['Chain rule','for dC/db','#06b6d4']].map(([k,v,col])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">The Moon Escape Velocity Problem</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
                <strong>Goal:</strong> learn — by trial and error — the speed at which a rocket can leave the moon's surface. Train a binary classifier f(x) that returns 1 (leave) or 0 (stay).
              </div>
              <div className="m4-hr"/>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>Trial</th><th>Speed (km/s) = x</th><th>Success</th><th>y</th></tr></thead>
                <tbody>
                  <tr><td className="pk">1</td><td>1</td><td>no</td><td>0</td></tr>
                  <tr><td className="pk">2</td><td>5</td><td>yes</td><td>1</td></tr>
                  <tr><td className="pk">3</td><td>3</td><td>yes</td><td>1</td></tr>
                  <tr><td className="pk">4</td><td>2</td><td>no</td><td>0</td></tr>
                  <tr><td className="pk">5</td><td>2.5</td><td>yes</td><td>1</td></tr>
                  <tr><td className="pk">6</td><td>2.2</td><td>no</td><td>0</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.74rem'}}>
                True escape velocity of the moon = <strong>2.38 km/s</strong>. The trial at x=2.5 (y=1) lies <em>very</em> close to the boundary — keep it in mind, the 1-parameter model can't resolve it.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">From Perceptron to Logistic Neuron</div>
              <div className="m4-flabel">Perceptron — threshold T</div>
              <Tex src="f(x) = \begin{cases} 1, & x > T \\ 0, & x \leq T \end{cases}" block />
              <div className="m4-flabel" style={{marginTop:'0.5rem'}}>Bias trick: let b = −T</div>
              <Tex src="f(b,x) = \begin{cases} 1, & x + b > 0 \\ 0, & x + b \leq 0 \end{cases}" block />
              <div className="m4-flabel" style={{marginTop:'0.5rem'}}>Replace step with logistic</div>
              <Tex src="a(b,x) = \sigma(x+b) = \dfrac{1}{1+e^{-(x+b)}}" block />
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.73rem'}}>
                Both perceptron and logistic neuron <strong>classify identically</strong> (a &gt; 0.5). The difference: the logistic is differentiable, so we can train it with gradient methods.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">The Three Choices We Made</div>
            <table className="m4-ptable">
              <thead><tr><th>Component</th><th>Choice</th><th>Why</th></tr></thead>
              <tbody>
                <tr><td className="pk">Language</td><td>logistic σ with parameter b (later +w)</td><td>Smooth, differentiable, bounded in (0,1), good probabilistic interpretation</td></tr>
                <tr><td className="pk">Error metric</td><td>Mean squared error, <Tex src="C(b) = \tfrac{1}{2n}\sum_x (y - a)^2" /></td><td>Differentiable, classical regression metric</td></tr>
                <tr><td className="pk">Algorithm</td><td>Gradient descent on b (later (w,b))</td><td>1st-order, generic, works on any differentiable f</td></tr>
              </tbody>
            </table>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Biological Analogy — Neuron Anatomy</div>
            <table className="m4-ptable">
              <thead><tr><th>Biological term</th><th>Artificial-neuron analogue</th></tr></thead>
              <tbody>
                <tr><td className="pk">Dendrites</td><td>Input signal x (multiple in higher-dim case)</td></tr>
                <tr><td className="pk">Synapse</td><td>Weight w on each input</td></tr>
                <tr><td className="pk">Cell body</td><td>Summing junction + activation σ(·)</td></tr>
                <tr><td className="pk">Action potential</td><td>Step output crossing 0.5 threshold</td></tr>
                <tr><td className="pk">Resting threshold</td><td>Bias b</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'sigmoid' && (
        <div>
          <StepVsSigmoidViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Properties of Sigmoids</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li>Monotonically increasing — never bends back.</li>
                <li>Bounded by two horizontal asymptotes (here 0 and 1).</li>
                <li>First derivative is <strong>bell-shaped</strong> (a "squished" probability density).</li>
                <li>Continuously differentiable to all orders → safe for gradient methods.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Common sigmoid functions</div>
              <ul style={{listStyle:'none',padding:0,margin:0,fontSize:'0.76rem',lineHeight:2}}>
                <li><Tex src="\tfrac{x}{\sqrt{1+x^2}}" /> — algebraic</li>
                <li><Tex src="\tanh(x)" /> — hyperbolic, ranges (−1,1)</li>
                <li><Tex src="\tfrac{2}{\pi}\arctan\!\left(\tfrac{\pi}{2}x\right)" /></li>
                <li><Tex src="\operatorname{erf}\!\left(\tfrac{\sqrt{\pi}}{2}x\right)" /> — Gauss error fn</li>
                <li><strong style={{color:'var(--cyan)'}}>Logistic σ(z) = 1/(1+e<sup>−z</sup>)</strong> — the canonical choice</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Why The Logistic Wins</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li><strong>Self-derivative identity</strong>: σ′(z) = σ(z)(1 − σ(z)) — once you know σ, the gradient is free.</li>
                <li>Output already lives in (0,1) → readable as a probability.</li>
                <li>Bounded → no exploding outputs even for extreme z.</li>
                <li>Symmetric about 0.5 → natural decision threshold.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">σ′ derivative — the gradient envelope</div>
              <div className="m4-pseudocode">{`σ(0) = 0.5    max derivative
σ(±2) ≈ 0.12 (deriv ≈ 0.105)
σ(±5) ≈ 0.007 (deriv ≈ 0.007)
σ(±10) ≈ 0   (vanishing gradient zone)`}</div>
              <div className="m4-warnbox" style={{marginTop:'0.5rem',fontSize:'0.72rem'}}>
                <strong>Saturation:</strong> when |z| is large, σ′ ≈ 0 → gradients vanish → learning stalls. This is the classic motivation for ReLU in deep networks.
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'math' && (
        <div>
          <ChainRuleDerivation />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Verbal Recipe — Remember This</div>
              <ol style={{paddingLeft:'1.1rem',margin:0,fontSize:'0.78rem',lineHeight:1.85,color:'var(--text-1)'}}>
                <li>Take the <em>signed</em> residual <Tex src="(y - a)" />.</li>
                <li>Multiply by the sigmoid output <Tex src="a" />.</li>
                <li>Multiply by <Tex src="(1-a)" />.</li>
                <li>Average over all <Tex src="n" /> training examples.</li>
                <li>Negate (because cost is being minimised).</li>
              </ol>
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.73rem'}}>
                For the <strong>2-D</strong> version with weight w, add an extra factor of x:<br/>
                <Tex src="\partial C/\partial w = -\tfrac{1}{n}\sum x\,(y-a)\,a\,(1-a)" />
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Why The Sigmoid Identity Matters</div>
              <Tex src="\sigma′(z) = \sigma(z)\,(1 - \sigma(z))" block />
              <ul className="m4-bullets" style={{fontSize:'0.75rem',marginTop:'0.5rem'}}>
                <li>Computing σ during the <strong>forward pass</strong> automatically gives you the derivative for the <strong>backward pass</strong>.</li>
                <li>No extra exponentials in the gradient computation — purely arithmetic.</li>
                <li>Forms the basis of efficient back-propagation in multi-layer networks.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Quick proof</div>
              <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>{`σ(z) = 1/(1+e^-z)
σ'(z) = e^-z / (1+e^-z)²
     = (1/(1+e^-z)) · (e^-z/(1+e^-z))
     = σ(z) · (1 − σ(z))   ▢`}</div>
            </div>
          </div>
        </div>
      )}

      {sec === '1d' && (
        <div>
          <GradientDescent1DLive />
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Algorithm 1 — 1-D Gradient Descent</div>
            <div className="m4-pseudocode">{`1: b ← random initial value (uniform in [-10, 0])
2: c ← cost(b)
3: last_c ← ∞
4: while |c − last_c| > ε do
5:     b ← b − α · dC/db
6:     last_c ← c
7:     c ← cost(b)
8: return b`}</div>
            <div className="m4-two-col" style={{marginTop:'0.6rem'}}>
              <div>
                <div className="m4-flabel">Convergence (multiple runs)</div>
                <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                  <thead><tr><th>Trial</th><th>Final b</th><th>Final cost</th></tr></thead>
                  <tbody>
                    <tr><td className="pk">1</td><td>−2.5028</td><td>0.06293</td></tr>
                    <tr><td className="pk">2</td><td>−2.5028</td><td>0.06293</td></tr>
                    <tr><td className="pk">3</td><td>−2.5028</td><td>0.06293</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div className="m4-flabel">Classification result</div>
                <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                  <thead><tr><th>x</th><th>y</th><th>OK?</th></tr></thead>
                  <tbody>
                    <tr><td>1</td><td>0</td><td style={{color:'#34d399'}}>✔</td></tr>
                    <tr><td>2</td><td>0</td><td style={{color:'#34d399'}}>✔</td></tr>
                    <tr><td>2.2</td><td>0</td><td style={{color:'#34d399'}}>✔</td></tr>
                    <tr><td>2.5</td><td>1</td><td style={{color:'#fb7185'}}>✘</td></tr>
                    <tr><td>3</td><td>1</td><td style={{color:'#34d399'}}>✔</td></tr>
                    <tr><td>5</td><td>1</td><td style={{color:'#34d399'}}>✔</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="m4-warnbox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
              <strong>Question:</strong> Is the model "wrong"? <em>No</em> — gradient descent found the global minimum of <Tex src="C(b)" />. The hypothesis space (single threshold parameter) is just not <em>expressive enough</em> to perfectly separate this dataset. The fix is to add a degree of freedom (w).
            </div>
          </div>
        </div>
      )}

      {sec === '2d' && (
        <div>
          <GradientDescent2DLive />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Intuitive Effects of w</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li>Acts as a <strong>scaling/transformation on the x-axis</strong> — multiplies the slope of σ at the boundary.</li>
                <li>Increasing w → steeper sigmoid → closer to a perfect step function.</li>
                <li>w controls <strong>sharpness</strong>; b controls <strong>position</strong>; decision boundary at <Tex src="x = -b/w" />.</li>
                <li>Very large w makes the model brittle — saturated outputs, vanishing gradients elsewhere.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Partial derivatives (memorise)</div>
              <Tex src="\partial C/\partial w = -\tfrac{1}{n}\sum_x x\,(y-a)\,a\,(1-a)" block/>
              <Tex src="\partial C/\partial b = -\tfrac{1}{n}\sum_x (y-a)\,a\,(1-a)" block/>
              <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginTop:'0.3rem'}}>
                Difference: ∂/∂w has an extra factor of x (the input).
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Sample 2-D Results from Lecture</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>Run</th><th>[w, b]</th><th>−b/w</th><th>Cost</th></tr></thead>
                <tbody>
                  <tr><td className="pk">A</td><td>[1.7457, −4.3394]</td><td>2.486</td><td>0.0471</td></tr>
                  <tr><td className="pk">B</td><td>[2.0014, −4.8778]</td><td>2.437</td><td>0.0430</td></tr>
                  <tr><td className="pk">C</td><td>[0.6797, −1.4958]</td><td>2.201</td><td>0.0762</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.72rem'}}>
                All three find a boundary in the neighbourhood of <strong>2.38 km/s</strong>. Steeper sigmoids (larger w) give boundaries closer to the truth. <strong>All 6 training points are now classified correctly.</strong>
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Dual stopping criterion</div>
              <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>{`while  |cost − last_cost| > ε
   AND  not all_correctly_classified`}</div>
              <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginTop:'0.3rem',lineHeight:1.55}}>
                Cost-change alone is insufficient — without the correctness check, gradient descent keeps refining forever (see Divergence demo).
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'code' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">1-D Python Implementation</div>
              <div className="m4-pseudocode" style={{fontSize:'0.72rem'}}>{`import numpy as np
rng = np.random.default_rng()

def logistic(z):
    return 1 / (1 + np.exp(-z))

def activation(b, xs):
    return logistic(xs + b)

def residuals(b, xs, ys):
    return np.abs(ys - activation(b, xs))

def cost(b, xs, ys):
    return 0.5 * np.mean(np.square(
        residuals(b, xs, ys)))

def d_C(b, xs, ys):
    a = activation(b, xs)
    return -np.mean(
        (ys - a) * a * (1 - a))

def gradient_descent(alpha, epsilon, xs, ys):
    b = -10 * rng.random()   # random in [-10, 0]
    c = cost(b, xs, ys)
    last_c = np.inf
    while np.abs(c - last_c) > epsilon:
        b = b - alpha * d_C(b, xs, ys)
        last_c = c
        c = cost(b, xs, ys)
    return b

Velocities = np.array([1, 5, 3, 2, 2.5, 2.2])
Escape     = np.array([0, 1, 1, 0, 1, 0])
gradient_descent(10, 1e-9, Velocities, Escape)
# → b ≈ -2.5028, cost ≈ 0.0629`}</div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">2-D Python Implementation</div>
              <div className="m4-pseudocode" style={{fontSize:'0.72rem'}}>{`def activation_2d(params, xs):
    # params = [w, b]
    return logistic(params[0]*xs + params[1])

def cost_2d(params, xs, ys):
    return 0.5 * np.mean(np.square(
        np.abs(ys - activation_2d(params, xs))))

def d_C_2d(params, xs, ys):
    a = activation_2d(params, xs)
    d_Cw = -np.mean(xs * (ys - a) * a * (1 - a))
    d_Cb = -np.mean(     (ys - a) * a * (1 - a))
    return np.array([d_Cw, d_Cb]).T

def gradient_descent_2d(alpha, epsilon, xs, ys):
    b = -8 * rng.random()    # in [-8, 0]
    w =  2 * rng.random()    # in [0, 2]
    params = np.array([w, b]).T
    c = cost_2d(params, xs, ys)
    last_c = np.inf
    while (np.abs(c - last_c) > epsilon
       and not np.allclose(
           np.round(activation_2d(params, xs)),
           ys)):
        params = params - alpha * d_C_2d(params, xs, ys)
        last_c = c
        c = cost_2d(params, xs, ys)
    return params

# → params ≈ [1.7457, -4.3394]
# boundary ≈ 2.486 km/s
# all 6 correctly classified`}</div>
            </div>
          </div>
          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Generic Multi-D Gradient Descent</div>
            <div className="m4-pseudocode" style={{fontSize:'0.72rem'}}>{`Algorithm — Gradient Descent
1: 𝐱 ← random initial vector
2: repeat
3:     𝐱 ← 𝐱 − α · ∇f(𝐱)
4: until stopping criterion reached
5: return 𝐱

∇f = [ ∂f/∂x₁,  ∂f/∂x₂,  …,  ∂f/∂xₙ ]ᵀ`}</div>
          </div>
        </div>
      )}

      {sec === 'discuss' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Why The Divergence Happens</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li>The logistic only asymptotically reaches 0 and 1 — never <em>exactly</em>.</li>
                <li>To drive MSE all the way to zero, the network keeps <strong>sharpening the sigmoid</strong> by growing |w|.</li>
                <li>As w → ∞, σ approaches a perfect step → residuals shrink toward 0 → cost shrinks toward 0.</li>
                <li>Ratio −b/w stays roughly constant (decision boundary in the right place); only magnitudes diverge.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Is The Divergence A Problem?</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <tbody>
                  <tr><td className="pk">Classification</td><td>Still correct — boundary stable</td></tr>
                  <tr><td className="pk">Numerical stability</td><td>Overflow, NaN, exp(−1000)</td></tr>
                  <tr><td className="pk">Saturation</td><td>σ′ → 0 everywhere except at boundary → vanishing gradients</td></tr>
                  <tr><td className="pk">Generalisation</td><td>Brittle — tiny noise pushes near-boundary points to wrong side</td></tr>
                  <tr><td className="pk">Composition</td><td>Saturated neurons stop teaching downstream layers</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Fixes (Preview of Real Networks)</div>
            <table className="m4-ptable">
              <thead><tr><th>Idea</th><th>What it does</th></tr></thead>
              <tbody>
                <tr><td className="pk">Dual stopping criterion</td><td>Halt when all examples classified correctly (no further refinement)</td></tr>
                <tr><td className="pk">Weight regularisation (L2)</td><td>Add λ||w||² to cost → penalises large weights → boundary stays at finite w</td></tr>
                <tr><td className="pk">Cross-entropy loss</td><td>Replace MSE — gradient does not vanish when σ saturates correctly</td></tr>
                <tr><td className="pk">Number-correctly-classified</td><td>Perfect stopping signal but <strong>non-differentiable</strong>, piecewise-constant — incompatible with gradient descent</td></tr>
                <tr><td className="pk">More parameters</td><td>Add a second neuron / layer — the path to Lecture 14 (Neuron Logic) and beyond</td></tr>
              </tbody>
            </table>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Five Discussion Questions From The Lecture</div>
            <ol style={{paddingLeft:'1.1rem',margin:0,fontSize:'0.78rem',lineHeight:1.9,color:'var(--text-1)'}}>
              <li>Why does 1-D gradient descent always stop at b ≈ −2.5027?</li>
              <li>Is the model "wrong"?</li>
              <li>How could this be improved without new data?</li>
              <li>What is the trade-off between expressiveness and over-fit?</li>
              <li>Does this reveal limits of the <strong>expressiveness of the hypothesis space</strong>?</li>
            </ol>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(34,211,238,0.06) 0%,rgba(167,139,250,0.06) 100%)'}}>
            <div className="m4-card-h">Bridge to Lecture 14</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
              The 1-D classifier splits the real line at <Tex src="x = -b/w" />. A 2-input neuron splits the plane with a <strong>line</strong>; a 3-input neuron splits 3-D space with a <strong>plane</strong>. In general, an n-input neuron splits <Tex src="\mathbb{R}^n" /> with a <strong>hyperplane</strong> — but a single such partition cannot solve every problem (preview: XOR). That's where Lecture 14 begins.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Neurons to Logic: n-d Classifiers (Lecture 14) ────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const SEG_DIGITS = {
  0: [1,1,1,1,1,1,0],
  1: [0,1,1,0,0,0,0],
  2: [1,1,0,1,1,0,1],
  3: [1,1,1,1,0,0,1],
  4: [0,1,1,0,0,1,1],
  5: [1,0,1,1,0,1,1],
  6: [1,0,1,1,1,1,1],
  7: [1,1,1,0,0,0,0],
  8: [1,1,1,1,1,1,1],
  9: [1,1,1,1,0,1,1],
};

// === 7-Segment Digit Renderer ================================================
function SevenSegDigit({ segs, size = 60, glow = false }) {
  const W = size, H = size * 1.6;
  const t = size * 0.13;
  const off = '#1f2937';
  const on  = glow ? '#34d399' : '#fbbf24';
  const onShadow = glow ? 'drop-shadow(0 0 6px #34d399)' : 'drop-shadow(0 0 4px #fbbf24)';
  const seg = (active, points) => (
    <polygon points={points} fill={active ? on : off} style={{filter: active ? onShadow : 'none', transition:'fill 0.25s'}} />
  );
  const pad = t/2;
  const x0 = pad, x1 = W-pad;
  const y0 = pad, yMid = H/2, y1 = H-pad;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      {/* a — top */}
      {seg(segs[0], `${x0+t},${y0} ${x1-t},${y0} ${x1-t-t/2},${y0+t} ${x0+t+t/2},${y0+t}`)}
      {/* b — top right */}
      {seg(segs[1], `${x1},${y0+t} ${x1},${yMid-t/2} ${x1-t},${yMid-t} ${x1-t},${y0+t+t/2}`)}
      {/* c — bottom right */}
      {seg(segs[2], `${x1},${yMid+t/2} ${x1},${y1-t} ${x1-t},${y1-t-t/2} ${x1-t},${yMid+t}`)}
      {/* d — bottom */}
      {seg(segs[3], `${x0+t},${y1} ${x1-t},${y1} ${x1-t-t/2},${y1-t} ${x0+t+t/2},${y1-t}`)}
      {/* e — bottom left */}
      {seg(segs[4], `${x0},${yMid+t/2} ${x0},${y1-t} ${x0+t},${y1-t-t/2} ${x0+t},${yMid+t}`)}
      {/* f — top left */}
      {seg(segs[5], `${x0},${y0+t} ${x0},${yMid-t/2} ${x0+t},${yMid-t} ${x0+t},${y0+t+t/2}`)}
      {/* g — middle */}
      {seg(segs[6], `${x0+t+t/2},${yMid-t/2} ${x1-t-t/2},${yMid-t/2} ${x1-t},${yMid} ${x1-t-t/2},${yMid+t/2} ${x0+t+t/2},${yMid+t/2} ${x0+t},${yMid}`)}
    </svg>
  );
}

// === 7-Segment Trainer =======================================================
function SevenSegmentTrainer() {
  const [target, setTarget] = useState(1);
  const [weights, setWeights] = useState(() => Array(7).fill(0).map(()=>Math.random()*0.6-0.3));
  const [bias, setBias] = useState(()=>Math.random()*0.6-0.3);
  const [alpha, setAlpha] = useState(2.0);
  const [iter, setIter] = useState(0);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);
  runRef.current = running;
  const stateRef = useRef({weights, bias});
  stateRef.current = {weights, bias};

  const ys = useMemo(() => Object.keys(SEG_DIGITS).map(k => +k === target ? 1 : 0), [target]);
  const xs = useMemo(() => Object.keys(SEG_DIGITS).map(k => SEG_DIGITS[k]), []);

  const activations = useMemo(() => {
    return xs.map(x => {
      let s = bias;
      for (let i = 0; i < 7; i++) s += weights[i] * x[i];
      return sig(s);
    });
  }, [xs, weights, bias]);

  const cost = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 10; i++) {
      const r = ys[i] - activations[i];
      s += r*r;
    }
    return s / 20;
  }, [ys, activations]);

  const correct = useMemo(() => {
    return activations.filter((a,i)=>(a>0.5)===(ys[i]===1)).length;
  }, [activations, ys]);

  const reset = useCallback((preset) => {
    runRef.current=false; setRunning(false); setIter(0);
    if (preset === 'hit') {
      const w = SEG_DIGITS[target].map(s => s ? 1 : -1);
      const onCount = SEG_DIGITS[target].reduce((a,b)=>a+b,0);
      setWeights(w);
      setBias(-(onCount - 0.5));
    } else if (preset === 'zero') {
      setWeights(Array(7).fill(0));
      setBias(0);
    } else {
      setWeights(Array(7).fill(0).map(()=>Math.random()*0.6-0.3));
      setBias(Math.random()*0.6-0.3);
    }
  }, [target]);

  const step = useCallback(() => {
    const {weights: w, bias: bv} = stateRef.current;
    let dB = 0;
    const dW = Array(7).fill(0);
    for (let i = 0; i < 10; i++) {
      const x = xs[i];
      let z = bv;
      for (let j = 0; j < 7; j++) z += w[j] * x[j];
      const a = sig(z);
      const e = (ys[i] - a) * a * (1-a);
      dB += e;
      for (let j = 0; j < 7; j++) dW[j] += x[j] * e;
    }
    const nw = w.map((wj,j) => wj + alpha * dW[j] / 10);
    const nb = bv + alpha * dB / 10;
    setWeights(nw); setBias(nb); setIter(it=>it+1);
  }, [xs, ys, alpha]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || !runRef.current) return;
      step();
      setTimeout(tick, 25);
    };
    tick();
    return () => { cancelled = true; };
  }, [running, step]);

  useEffect(()=>{ reset(); }, [target]); // eslint-disable-line

  const labels = ['a','b','c','d','e','f','g'];

  return (
    <div className="m4-card">
      <div className="m4-card-h">7-Segment Digit Classifier — Train A Single Neuron</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.6rem',lineHeight:1.6}}>
        Pick a target digit. Train one neuron (7 inputs + bias) to output &gt; 0.5 <em>only</em> for that digit. Easy digits like '1' converge fast; '7' is famously hard.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:'0.35rem',marginBottom:'0.6rem'}}>
        {Object.keys(SEG_DIGITS).map(k => {
          const isTarget = +k === target;
          const segs = SEG_DIGITS[+k];
          const a = activations[+k];
          const correctHere = (a > 0.5) === (+k === target);
          return (
            <button key={k} onClick={()=>setTarget(+k)}
              style={{background:isTarget?'rgba(34,211,238,0.18)':'rgba(15,23,42,0.6)',
                      border:`1px solid ${isTarget?'#22d3ee':correctHere?'rgba(52,211,153,0.4)':'rgba(251,113,133,0.4)'}`,
                      borderRadius:8,padding:'0.5rem 0.3rem',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'center'}}>
                <SevenSegDigit segs={segs} size={32} glow={isTarget} />
              </div>
              <div style={{fontFamily:'monospace',fontSize:'0.62rem',color:isTarget?'#22d3ee':'var(--text-2)',marginTop:'0.3rem',textAlign:'center'}}>
                a={a.toFixed(2)}
              </div>
              <div style={{fontSize:'0.55rem',color:correctHere?'#34d399':'#fb7185',textAlign:'center'}}>
                {correctHere?'✓':'✗'} {(+k===target)?'TARGET':'reject'}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr) 1.2fr',gap:'0.3rem',marginBottom:'0.5rem'}}>
        {labels.map((lab,i) => (
          <div key={lab} style={{background:'rgba(167,139,250,0.07)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:6,padding:'0.35rem'}}>
            <div style={{fontSize:'0.6rem',color:'var(--text-2)',textAlign:'center',fontFamily:'monospace'}}>w<sub>{lab}</sub></div>
            <div style={{fontSize:'0.7rem',color:weights[i]>0?'#34d399':weights[i]<0?'#fb7185':'var(--text-2)',textAlign:'center',fontFamily:'monospace',fontWeight:700}}>
              {weights[i].toFixed(2)}
            </div>
            <input type="range" min={-3} max={3} step={0.01} value={weights[i]}
              onChange={e=>{const nw=[...weights]; nw[i]=+e.target.value; setWeights(nw);}}
              style={{width:'100%'}} />
          </div>
        ))}
        <div style={{background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:6,padding:'0.35rem'}}>
          <div style={{fontSize:'0.6rem',color:'var(--text-2)',textAlign:'center',fontFamily:'monospace'}}>bias b</div>
          <div style={{fontSize:'0.7rem',color:'#fbbf24',textAlign:'center',fontFamily:'monospace',fontWeight:700}}>{bias.toFixed(2)}</div>
          <input type="range" min={-5} max={2} step={0.01} value={bias} onChange={e=>setBias(+e.target.value)} style={{width:'100%'}} />
        </div>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.5rem',alignItems:'center'}}>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>setRunning(r=>!r)}>{running?'⏸ Pause':'▶ Train'}</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>step()}>⏭ Step</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset()}>↺ Random</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset('hit')}>Hit-counting solution</button>
        <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.72rem'}} onClick={()=>reset('zero')}>Zero weights</button>
        <span style={{marginLeft:'auto',fontFamily:'monospace',fontSize:'0.7rem',display:'flex',gap:'0.7rem'}}>
          <span>α=<span style={{color:'#22d3ee'}}>{alpha.toFixed(1)}</span></span>
          <span>iter <span style={{color:'#22d3ee'}}>{iter}</span></span>
          <span>cost <span style={{color:'#fbbf24'}}>{cost.toFixed(4)}</span></span>
          <span>correct <span style={{color:correct===10?'#34d399':'#fb7185'}}>{correct}/10</span></span>
        </span>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem'}}><span style={{color:'var(--text-2)'}}>learning rate α</span></div>
        <input type="range" min={0.1} max={10} step={0.1} value={alpha} onChange={e=>setAlpha(+e.target.value)} style={{width:'100%'}} />
      </div>

      <div className="m4-warnbox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
        <strong>Try target=1 first</strong> (converges in ~20 iter). <strong>Then try target=7</strong> — often gets stuck near cost 0.04, '7' activation plateaus ≈ 0.4 (a local minimum). Why? '1's segments {`{b,c}`} ⊂ '7's segments {`{a,b,c}`}.
        <br/><strong>Hit-counting solution</strong> manually constructs w<sub>i</sub> = +1 if segment is on, −1 if off, b = −(on count − 0.5). Works for <em>any</em> single digit.
      </div>
    </div>
  );
}

// === Hyperplane Visualizer (2-D neuron) ======================================
function Hyperplane2DViz() {
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [b, setB] = useState(-1.5);
  const [pts, setPts] = useState([
    {x:0,y:0,label:0,name:'A'},
    {x:1,y:0,label:0,name:'B'},
    {x:0,y:1,label:0,name:'C'},
    {x:1,y:1,label:1,name:'D'},
  ]);
  const canRef = useRef(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    const c = canRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 340;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const xMin = -0.5, xMax = 1.5;
    const PAD = 36;
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-12);
    const toY = y => H-PAD - (y-xMin)/(xMax-xMin)*(H-PAD-12);

    const NX = 60, NY = 60;
    const cellW = (W-PAD-12)/NX, cellH = (H-PAD-12)/NY;
    for (let yi=0; yi<NY; yi++) for (let xi=0; xi<NX; xi++) {
      const x = xMin + (xi/(NX-1))*(xMax-xMin);
      const y = xMin + (yi/(NY-1))*(xMax-xMin);
      const a = sig(w1*x + w2*y + b);
      const r = Math.round(a*150 + 20);
      const g = Math.round((1-a)*100 + 30);
      const bb= Math.round((1-a)*70 + 50);
      ctx.fillStyle = `rgba(${r},${g},${bb},0.45)`;
      ctx.fillRect(PAD + xi*cellW, H-PAD - (yi+1)*cellH, cellW+0.5, cellH+0.5);
    }

    if (Math.abs(w2) > 1e-6) {
      const slope = -w1/w2;
      const yint = -b/w2;
      const xMinV = xMin, xMaxV = xMax;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(toX(xMinV), toY(slope*xMinV + yint));
      ctx.lineTo(toX(xMaxV), toY(slope*xMaxV + yint));
      ctx.stroke();
    } else if (Math.abs(w1) > 1e-6) {
      const xv = -b/w1;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(toX(xv), toY(xMin)); ctx.lineTo(toX(xv), toY(xMax)); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(toX(xMin), toY(0)); ctx.lineTo(toX(xMax), toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), toY(xMin)); ctx.lineTo(toX(0), toY(xMax)); ctx.stroke();

    pts.forEach((p) => {
      const px = toX(p.x), py = toY(p.y);
      const a = sig(w1*p.x + w2*p.y + b);
      const predict = a > 0.5 ? 1 : 0;
      const correct = predict === p.label;
      ctx.fillStyle = p.label === 1 ? '#34d399' : '#fb7185';
      ctx.beginPath(); ctx.arc(px, py, 11, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle = correct ? 'rgba(255,255,255,0.85)' : '#ec4899'; ctx.lineWidth = correct ? 1.3 : 2.5;
      ctx.stroke();
      ctx.fillStyle = '#0d1a30'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(p.name, px, py+4);
      ctx.fillStyle = 'rgba(148,163,184,0.85)'; ctx.font = '9.5px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`(${p.x},${p.y}) a=${a.toFixed(2)}`, px+14, py-7);
    });

    ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.font = '9.5px monospace'; ctx.textAlign = 'right';
    [0,1].forEach(v=>ctx.fillText(v.toString(), PAD-3, toY(v)+3));
    ctx.textAlign='center';
    [0,1].forEach(v=>ctx.fillText(v.toString(), toX(v), H-PAD+12));
    ctx.fillStyle='var(--text-2)'; ctx.textAlign='center';
    ctx.fillText('x₁', W/2, H-4);
    ctx.save(); ctx.translate(10, H/2); ctx.rotate(-Math.PI/2); ctx.fillText('x₂', 0, 0); ctx.restore();
  }, [w1, w2, b, pts]);

  const handleMouseDown = (e) => {
    const c = canRef.current; const rect = c.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const PAD = 36, W = c.width, H = c.height;
    const xMin = -0.5, xMax = 1.5;
    const fromX = px => xMin + (px-PAD)/(W-PAD-12)*(xMax-xMin);
    const fromY = py => xMin + (H-PAD-py)/(H-PAD-12)*(xMax-xMin);
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-12);
    const toY = y => H-PAD - (y-xMin)/(xMax-xMin)*(H-PAD-12);
    let nearest = null, minD = 18;
    pts.forEach((p,i) => {
      const d = Math.hypot(toX(p.x)-cx, toY(p.y)-cy);
      if (d < minD) { minD = d; nearest = i; }
    });
    if (nearest != null) setDrag({i:nearest, fromX, fromY});
  };
  const handleMouseMove = (e) => {
    if (!drag) return;
    const rect = canRef.current.getBoundingClientRect();
    const nx = drag.fromX(e.clientX - rect.left);
    const ny = drag.fromY(e.clientY - rect.top);
    setPts(ps => ps.map((p,i) => i===drag.i ? {...p, x:Math.round(nx), y:Math.round(ny)} : p));
  };
  const handleMouseUp = () => setDrag(null);
  const toggleLabel = (i) => setPts(ps => ps.map((p,j) => j===i ? {...p, label:1-p.label} : p));

  return (
    <div className="m4-card">
      <div className="m4-card-h">2-Input Neuron — Hyperplane Visualiser</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.5rem',lineHeight:1.55}}>
        A 2-input neuron splits the plane along a <strong>line</strong>: <Tex src="w_1 x_1 + w_2 x_2 + b = 0" />. Drag corner points; click a point's label below to flip its class.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:'0.7rem'}}>
        <canvas ref={canRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{width:'100%',height:340,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)',cursor:drag?'grabbing':'grab'}} />
        <div className="m4-card" style={{margin:0,padding:'0.6rem'}}>
          <div className="m4-card-h" style={{fontSize:'0.62rem',marginBottom:'0.5rem'}}>PARAMETERS</div>
          {[['w₁',w1,setW1,'#22d3ee',-5,5],['w₂',w2,setW2,'#a78bfa',-5,5],['b',b,setB,'#fbbf24',-5,5]].map(([lab,v,fn,col,mn,mx]) => (
            <div key={lab} style={{marginBottom:'0.5rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.66rem'}}>
                <span style={{color:'var(--text-2)'}}>{lab}</span><span style={{fontFamily:'monospace',color:col}}>{v.toFixed(2)}</span>
              </div>
              <input type="range" min={mn} max={mx} step={0.05} value={v} onChange={e=>fn(+e.target.value)} style={{width:'100%'}} />
            </div>
          ))}
          <div style={{borderTop:'1px solid rgba(148,163,184,0.15)',marginTop:'0.5rem',paddingTop:'0.5rem'}}>
            <div className="m4-card-h" style={{fontSize:'0.62rem',marginBottom:'0.4rem'}}>FLIP POINT LABEL</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.3rem'}}>
              {pts.map((p,i)=>(
                <button key={p.name} onClick={()=>toggleLabel(i)} style={{
                  background: p.label===1?'rgba(52,211,153,0.15)':'rgba(251,113,133,0.15)',
                  border: `1px solid ${p.label===1?'#34d399':'#fb7185'}`,
                  color:'var(--text-1)', borderRadius:6, fontSize:'0.65rem',
                  padding:'3px 4px', cursor:'pointer', fontFamily:'monospace'}}>
                  {p.name}=({p.x},{p.y})→{p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.6rem',fontSize:'0.72rem'}}>
        <strong>Threshold line equation:</strong>{' '}<Tex src="x_2 = -\tfrac{w_1}{w_2}x_1 - \tfrac{b}{w_2}" />.{' '}
        Intercepts: <Tex src="-b/w_1" /> on x₁ axis, <Tex src="-b/w_2" /> on x₂ axis. Try setting up <strong>XOR</strong> (D=A=label 1; B=C=label 0) — no line can separate them. That's the lesson of Lecture 14.
      </div>
    </div>
  );
}

// === Logic Gate Playground (2-input neuron, presets, truth table) ============
function LogicGatePlayground() {
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [b, setB] = useState(-1.5);

  const truth = [[0,0],[0,1],[1,0],[1,1]].map(([x1,x2]) => {
    const a = sig(w1*x1 + w2*x2 + b);
    return {x1,x2,a,bit:a>0.5?1:0};
  });

  const identify = () => {
    const bits = truth.map(t=>t.bit).join('');
    const gates = {
      '0001':'AND','0111':'OR','1110':'NAND','1000':'NOR','0110':'XOR','1001':'XNOR',
      '0011':'x₂ (pass-through)','0101':'x₁ (pass-through)','1100':'¬x₂','1010':'¬x₁',
      '0000':'FALSE','1111':'TRUE',
    };
    return gates[bits] || 'mixed';
  };

  const presets = {
    AND:  [1, 1, -1.5],
    OR:   [1, 1, -0.5],
    NAND: [-1, -1, 1.5],
    NOR:  [-1, -1, 0.5],
    'NOT x₁': [-1, 0, 0.5],
    'NOT x₂': [0, -1, 0.5],
    'XOR — fail!': [1, 1, -0.5],
  };

  return (
    <div className="m4-card">
      <div className="m4-card-h">Neuron as a Logic Gate — Live Truth Table</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.55}}>
        A 2-input neuron with the right weights and bias implements an entire logic gate. Set the sliders or click a preset.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem',alignItems:'start'}}>
        <div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem',marginBottom:'0.55rem'}}>
            {Object.keys(presets).map(g => (
              <button key={g} className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}}
                onClick={()=>{const [a,b2,c]=presets[g]; setW1(a); setW2(b2); setB(c);}}>{g}</button>
            ))}
          </div>
          {[['w₁',w1,setW1,'#22d3ee'],['w₂',w2,setW2,'#a78bfa'],['b',b,setB,'#fbbf24']].map(([lab,v,fn,col])=>(
            <div key={lab} style={{marginBottom:'0.45rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem'}}>
                <span style={{color:'var(--text-2)'}}>{lab}</span><span style={{fontFamily:'monospace',color:col}}>{v.toFixed(2)}</span>
              </div>
              <input type="range" min={-3} max={3} step={0.05} value={v} onChange={e=>fn(+e.target.value)} style={{width:'100%'}} />
            </div>
          ))}
          <div style={{textAlign:'center',marginTop:'0.6rem',padding:'0.6rem',background:'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(167,139,250,0.08))',border:'1px solid rgba(34,211,238,0.3)',borderRadius:8}}>
            <div style={{fontSize:'0.65rem',color:'var(--text-2)',marginBottom:3,letterSpacing:'0.05em'}}>IDENTIFIED GATE</div>
            <div style={{fontSize:'1.2rem',fontWeight:700,color:'#22d3ee',fontFamily:'monospace'}}>{identify()}</div>
          </div>
        </div>
        <div>
          <table className="m4-ptable" style={{fontSize:'0.78rem'}}>
            <thead><tr><th>x₁</th><th>x₂</th><th>z = w·x + b</th><th>σ(z)</th><th>bit</th></tr></thead>
            <tbody>
              {truth.map((r,i) => {
                const z = w1*r.x1 + w2*r.x2 + b;
                return (
                  <tr key={i}>
                    <td className="pk">{r.x1}</td>
                    <td className="pk">{r.x2}</td>
                    <td style={{fontFamily:'monospace'}}>{z.toFixed(2)}</td>
                    <td style={{fontFamily:'monospace',color:r.bit?'#34d399':'#fb7185'}}>{r.a.toFixed(3)}</td>
                    <td style={{fontWeight:700,color:r.bit?'#34d399':'#fb7185'}}>{r.bit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="m4-infobox" style={{marginTop:'0.6rem',fontSize:'0.72rem'}}>
            <strong>Exercise:</strong> Find weights for NOR and NAND yourself before clicking the presets! The pattern is <em>flip the signs</em>.
          </div>
        </div>
      </div>
    </div>
  );
}

// === XOR Problem Visualizer ==================================================
function XORProblemViz() {
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [b, setB] = useState(-0.5);
  const [showAttempts, setShowAttempts] = useState(false);
  const canRef = useRef(null);

  const pts = [
    {x:0,y:0,label:0,name:'(0,0)'},
    {x:1,y:0,label:1,name:'(1,0)'},
    {x:0,y:1,label:1,name:'(0,1)'},
    {x:1,y:1,label:0,name:'(1,1)'},
  ];

  useEffect(() => {
    const c = canRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 380;
    const H = c.height = 340;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);
    const xMin = -0.5, xMax = 1.5;
    const PAD = 36;
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-12);
    const toY = y => H-PAD - (y-xMin)/(xMax-xMin)*(H-PAD-12);

    const NX = 80, NY = 80;
    const cellW = (W-PAD-12)/NX, cellH = (H-PAD-12)/NY;
    for (let yi=0; yi<NY; yi++) for (let xi=0; xi<NX; xi++) {
      const x = xMin + (xi/(NX-1))*(xMax-xMin);
      const y = xMin + (yi/(NY-1))*(xMax-xMin);
      const a = sig(w1*x + w2*y + b);
      const r = Math.round(a*180);
      const g = Math.round((1-a)*120);
      const bb = Math.round(60);
      ctx.fillStyle = `rgba(${r},${g},${bb},0.4)`;
      ctx.fillRect(PAD + xi*cellW, H-PAD - (yi+1)*cellH, cellW+0.5, cellH+0.5);
    }

    if (showAttempts) {
      const tries = [
        [1, 1, -0.5, '#fb7185'],
        [-1, -1, 1.5, '#a78bfa'],
        [1, -1, -0.3, '#fbbf24'],
        [-1, 1, -0.3, '#06b6d4'],
      ];
      tries.forEach(([wa,wb,ba,col]) => {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]);
        if (Math.abs(wb) > 1e-6) {
          const slope = -wa/wb, yint = -ba/wb;
          ctx.beginPath();
          ctx.moveTo(toX(xMin), toY(slope*xMin + yint));
          ctx.lineTo(toX(xMax), toY(slope*xMax + yint));
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);
    }

    if (Math.abs(w2) > 1e-6) {
      const slope = -w1/w2, yint = -b/w2;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(toX(xMin), toY(slope*xMin + yint));
      ctx.lineTo(toX(xMax), toY(slope*xMax + yint));
      ctx.stroke();
    }

    pts.forEach(p => {
      const px = toX(p.x), py = toY(p.y);
      const a = sig(w1*p.x + w2*p.y + b);
      const ok = (a>0.5) === (p.label===1);
      ctx.fillStyle = p.label === 1 ? '#34d399' : '#fb7185';
      ctx.beginPath(); ctx.arc(px, py, 14, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle = ok ? 'rgba(255,255,255,0.85)' : '#ec4899';
      ctx.lineWidth = ok ? 1.5 : 3; ctx.stroke();
      ctx.fillStyle = '#0d1a30'; ctx.font = 'bold 11px monospace'; ctx.textAlign='center';
      ctx.fillText(p.label, px, py+4);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font='10px monospace';
      ctx.textAlign = p.x===0?'right':'left';
      ctx.fillText(`${p.name} → ${p.label}`, px + (p.x===0?-18:18), py+4);
    });

    ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.font = '9.5px monospace'; ctx.textAlign = 'right';
    [0,1].forEach(v=>ctx.fillText(v.toString(), PAD-3, toY(v)+3));
    ctx.textAlign='center';
    [0,1].forEach(v=>ctx.fillText(v.toString(), toX(v), H-PAD+12));
    ctx.fillStyle='var(--text-2)';
    ctx.fillText('x₁', W/2, H-4);
    ctx.save(); ctx.translate(10, H/2); ctx.rotate(-Math.PI/2); ctx.fillText('x₂', 0, 0); ctx.restore();
  }, [w1, w2, b, showAttempts, pts]);

  const correct = pts.filter(p => (sig(w1*p.x + w2*p.y + b) > 0.5) === (p.label === 1)).length;

  return (
    <div className="m4-card">
      <div className="m4-card-h">The XOR Problem — Why A Single Neuron Fails</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.55}}>
        <strong>Try to separate</strong> the green points (XOR = 1) from the red ones (XOR = 0) with a single line. You can't — they sit on opposite diagonals.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:'0.7rem'}}>
        <canvas ref={canRef} style={{width:'100%',height:340,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
        <div className="m4-card" style={{margin:0,padding:'0.6rem'}}>
          <div className="m4-card-h" style={{fontSize:'0.62rem',marginBottom:'0.5rem'}}>YOUR ATTEMPT</div>
          {[['w₁',w1,setW1,'#22d3ee'],['w₂',w2,setW2,'#a78bfa'],['b',b,setB,'#fbbf24']].map(([lab,v,fn,col]) => (
            <div key={lab} style={{marginBottom:'0.45rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.66rem'}}>
                <span style={{color:'var(--text-2)'}}>{lab}</span><span style={{fontFamily:'monospace',color:col}}>{v.toFixed(2)}</span>
              </div>
              <input type="range" min={-3} max={3} step={0.05} value={v} onChange={e=>fn(+e.target.value)} style={{width:'100%'}} />
            </div>
          ))}
          <button className="m4-algo-tab" style={{padding:'3px 12px',fontSize:'0.7rem',width:'100%',marginTop:'0.4rem'}}
            onClick={()=>setShowAttempts(s=>!s)}>{showAttempts?'☑':'☐'} Show many failed lines</button>
          <div style={{textAlign:'center',marginTop:'0.5rem',padding:'0.5rem',background:correct===4?'rgba(52,211,153,0.12)':'rgba(251,113,133,0.1)',border:`1px solid ${correct===4?'#34d399':'#fb7185'}`,borderRadius:6}}>
            <div style={{fontSize:'0.6rem',color:'var(--text-2)'}}>SCORE (max 4)</div>
            <div style={{fontSize:'1.1rem',fontWeight:700,color:correct===4?'#34d399':'#fb7185',fontFamily:'monospace'}}>{correct}/4</div>
            {correct<4 && <div style={{fontSize:'0.62rem',color:'#fb7185',marginTop:3}}>impossible with one line</div>}
          </div>
        </div>
      </div>
      <div className="m4-warnbox" style={{marginTop:'0.6rem',fontSize:'0.72rem'}}>
        <strong>Historical impact:</strong> Minsky &amp; Papert's 1969 book <em>Perceptrons</em> highlighted this limitation. Combined with limited compute, it contributed to the funding decline known as the "AI Winter".
      </div>
    </div>
  );
}

// === Multi-Layer XOR Solution =================================================
function MultiLayerXORViz() {
  const [x1, setX1] = useState(0);
  const [x2, setX2] = useState(0);

  // Hidden layer
  const z1 = -1*x1 + -1*x2 + 1.5;
  const a1 = sig(8*z1); // sharpen
  const z2 = 1*x1 + 1*x2 - 0.5;
  const a2 = sig(8*z2);
  // Output layer
  const z3 = 1*a1 + 1*a2 - 1.5;
  const a3 = sig(8*z3);

  const expected = x1 ^ x2;
  const got = a3 > 0.5 ? 1 : 0;
  const correct = got === expected;

  return (
    <div className="m4-card">
      <div className="m4-card-h">XOR via Two-Layer Network — Live Flow</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.55}}>
        Network: <strong>NAND</strong> + <strong>OR</strong> → feed both into <strong>AND</strong>. The first layer creates a new feature space in which XOR becomes linearly separable.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',alignItems:'center'}}>
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginBottom:'0.7rem'}}>
            {[['x₁',x1,setX1,'#22d3ee'],['x₂',x2,setX2,'#a78bfa']].map(([lab,v,fn,col]) => (
              <div key={lab} style={{textAlign:'center'}}>
                <div style={{fontSize:'0.68rem',color:'var(--text-2)'}}>{lab}</div>
                <div style={{display:'flex',gap:'0.3rem',justifyContent:'center',margin:'0.3rem 0'}}>
                  {[0,1].map(b => (
                    <button key={b} onClick={()=>fn(b)} style={{
                      background:v===b?col:'rgba(148,163,184,0.1)',
                      border:`1px solid ${col}`, color:v===b?'#0d1a30':col,
                      borderRadius:6, padding:'4px 12px', fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}>{b}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.15)',borderRadius:8,padding:'0.75rem',fontFamily:'monospace',fontSize:'0.74rem',lineHeight:1.85,color:'var(--text-1)'}}>
            <div style={{color:'#fb7185',fontWeight:700,marginBottom:'0.3rem'}}>// Hidden neuron 1 — NAND</div>
            <div>z₁ = −1·{x1} + −1·{x2} + 1.5 = <span style={{color:'#22d3ee'}}>{z1.toFixed(2)}</span></div>
            <div>a₁ = σ(z₁) ≈ <span style={{color:a1>0.5?'#34d399':'#fb7185',fontWeight:700}}>{a1.toFixed(3)}</span> → <span style={{color:a1>0.5?'#34d399':'#fb7185',fontWeight:700}}>{a1>0.5?'1':'0'}</span></div>
            <div style={{color:'#a78bfa',fontWeight:700,marginTop:'0.5rem'}}>// Hidden neuron 2 — OR</div>
            <div>z₂ = 1·{x1} + 1·{x2} − 0.5 = <span style={{color:'#22d3ee'}}>{z2.toFixed(2)}</span></div>
            <div>a₂ = σ(z₂) ≈ <span style={{color:a2>0.5?'#34d399':'#fb7185',fontWeight:700}}>{a2.toFixed(3)}</span> → <span style={{color:a2>0.5?'#34d399':'#fb7185',fontWeight:700}}>{a2>0.5?'1':'0'}</span></div>
            <div style={{color:'#fbbf24',fontWeight:700,marginTop:'0.5rem'}}>// Output neuron — AND</div>
            <div>z₃ = 1·a₁ + 1·a₂ − 1.5 = <span style={{color:'#22d3ee'}}>{z3.toFixed(2)}</span></div>
            <div>a₃ = σ(z₃) ≈ <span style={{color:a3>0.5?'#34d399':'#fb7185',fontWeight:700}}>{a3.toFixed(3)}</span> → <span style={{color:a3>0.5?'#34d399':'#fb7185',fontWeight:700,fontSize:'1.1em'}}>{a3>0.5?'1':'0'}</span></div>
            <div style={{marginTop:'0.6rem',padding:'0.5rem',background:correct?'rgba(52,211,153,0.12)':'rgba(251,113,133,0.12)',borderRadius:6}}>
              expected XOR({x1},{x2}) = <span style={{fontWeight:700,color:correct?'#34d399':'#fb7185'}}>{expected}</span> · got <span style={{fontWeight:700,color:correct?'#34d399':'#fb7185'}}>{got}</span> {correct?'✓':'✗'}
            </div>
          </div>
        </div>

        <div>
          <svg viewBox="0 0 460 320" style={{width:'100%',height:'auto',background:'rgba(15,23,42,0.5)',border:'1px solid rgba(148,163,184,0.15)',borderRadius:8}}>
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <polygon points="0,0 6,3 0,6" fill="#94a3b8"/>
              </marker>
            </defs>
            <text x="20" y="30" fill="#22d3ee" fontFamily="monospace" fontSize="11">INPUT</text>
            <text x="170" y="30" fill="#a78bfa" fontFamily="monospace" fontSize="11">HIDDEN</text>
            <text x="340" y="30" fill="#fbbf24" fontFamily="monospace" fontSize="11">OUTPUT</text>

            <circle cx="50" cy="100" r="22" fill={x1?'rgba(34,211,238,0.4)':'rgba(34,211,238,0.1)'} stroke="#22d3ee" strokeWidth="1.5"/>
            <text x="50" y="105" textAnchor="middle" fill="#22d3ee" fontFamily="monospace" fontWeight="700" fontSize="14">{x1}</text>
            <text x="50" y="135" textAnchor="middle" fill="#22d3ee" fontFamily="monospace" fontSize="10">x₁</text>

            <circle cx="50" cy="220" r="22" fill={x2?'rgba(167,139,250,0.4)':'rgba(167,139,250,0.1)'} stroke="#a78bfa" strokeWidth="1.5"/>
            <text x="50" y="225" textAnchor="middle" fill="#a78bfa" fontFamily="monospace" fontWeight="700" fontSize="14">{x2}</text>
            <text x="50" y="255" textAnchor="middle" fill="#a78bfa" fontFamily="monospace" fontSize="10">x₂</text>

            <circle cx="225" cy="100" r="28" fill={a1>0.5?'rgba(251,113,133,0.4)':'rgba(251,113,133,0.1)'} stroke="#fb7185" strokeWidth="1.8"/>
            <text x="225" y="98" textAnchor="middle" fill="#fb7185" fontFamily="monospace" fontWeight="700" fontSize="11">NAND</text>
            <text x="225" y="112" textAnchor="middle" fill={a1>0.5?'#34d399':'#fb7185'} fontFamily="monospace" fontSize="11">{a1.toFixed(2)}</text>

            <circle cx="225" cy="220" r="28" fill={a2>0.5?'rgba(34,211,238,0.4)':'rgba(34,211,238,0.1)'} stroke="#22d3ee" strokeWidth="1.8"/>
            <text x="225" y="218" textAnchor="middle" fill="#22d3ee" fontFamily="monospace" fontWeight="700" fontSize="11">OR</text>
            <text x="225" y="232" textAnchor="middle" fill={a2>0.5?'#34d399':'#fb7185'} fontFamily="monospace" fontSize="11">{a2.toFixed(2)}</text>

            <circle cx="395" cy="160" r="30" fill={a3>0.5?'rgba(251,191,36,0.4)':'rgba(251,191,36,0.1)'} stroke="#fbbf24" strokeWidth="2"/>
            <text x="395" y="158" textAnchor="middle" fill="#fbbf24" fontFamily="monospace" fontWeight="700" fontSize="11">AND</text>
            <text x="395" y="172" textAnchor="middle" fill={a3>0.5?'#34d399':'#fb7185'} fontFamily="monospace" fontWeight="700" fontSize="12">{a3.toFixed(2)}</text>
            <text x="395" y="210" textAnchor="middle" fill="#fbbf24" fontFamily="monospace" fontSize="10">XOR out</text>

            {[[72,100,197,100,'-1'],[72,100,197,220,'1'],[72,220,197,100,'-1'],[72,220,197,220,'1']].map(([x1c,y1c,x2c,y2c,w],i) => (
              <g key={i}>
                <line x1={x1c} y1={y1c} x2={x2c-3} y2={y2c} stroke="#94a3b8" strokeWidth="1.1" opacity="0.6" markerEnd="url(#arr)"/>
                <text x={(x1c+x2c)/2} y={(y1c+y2c)/2-3} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">{w}</text>
              </g>
            ))}
            {[[253,100,365,160,'1'],[253,220,365,160,'1']].map(([x1c,y1c,x2c,y2c,w],i) => (
              <g key={i}>
                <line x1={x1c} y1={y1c} x2={x2c-3} y2={y2c} stroke="#94a3b8" strokeWidth="1.4" opacity="0.7" markerEnd="url(#arr)"/>
                <text x={(x1c+x2c)/2} y={(y1c+y2c)/2-3} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle">{w}</text>
              </g>
            ))}
            <text x="225" y="160" textAnchor="middle" fill="#94a3b8" fontFamily="monospace" fontSize="9">b₁=1.5  ·  b₂=−0.5</text>
            <text x="395" y="225" textAnchor="middle" fill="#94a3b8" fontFamily="monospace" fontSize="9">b₃=−1.5</text>
          </svg>
          <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
            Cycle through all four inputs (0,0), (0,1), (1,0), (1,1) and watch the XOR output flip.
          </div>
        </div>
      </div>
    </div>
  );
}

// === Hypercube Visualizer (digits on 7-D unit cube projection) ===============
function HypercubeViz() {
  const [highlight, setHighlight] = useState(7);
  const canRef = useRef(null);

  useEffect(() => {
    const c = canRef.current; if (!c) return;
    const W = c.width = c.offsetWidth || 540;
    const H = c.height = 360;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,W,H);

    // Generate all 128 binary 7-tuples and project to 2D using sum of popcount-weighted layers
    // Approach: position by bit positions on a force layout
    // We'll use: x = sum of cosines, y = sum of sines, with each segment i at angle 2πi/7 and radius determined by bit value
    const verts = [];
    for (let v = 0; v < 128; v++) {
      let x = 0, y = 0;
      let pop = 0;
      for (let i = 0; i < 7; i++) {
        const bit = (v >> i) & 1;
        if (bit) {
          const ang = 2*Math.PI * (i / 7) - Math.PI/2;
          x += Math.cos(ang);
          y += Math.sin(ang);
          pop++;
        }
      }
      // jitter slightly by index for separation
      x += (Math.sin(v*3.7) - 0.5) * 0.08;
      y += (Math.cos(v*4.1) - 0.5) * 0.08;
      verts.push({v, x, y, pop});
    }
    const xMin = Math.min(...verts.map(p=>p.x))-0.5, xMax = Math.max(...verts.map(p=>p.x))+0.5;
    const yMin = Math.min(...verts.map(p=>p.y))-0.5, yMax = Math.max(...verts.map(p=>p.y))+0.5;
    const PAD = 24;
    const toX = x => PAD + (x-xMin)/(xMax-xMin)*(W-PAD-PAD);
    const toY = y => H-PAD - (y-yMin)/(yMax-yMin)*(H-PAD-PAD);

    // Build digit lookup
    const digitVerts = {};
    Object.keys(SEG_DIGITS).forEach(k => {
      const segs = SEG_DIGITS[+k];
      let v = 0;
      for (let i = 0; i < 7; i++) if (segs[i]) v |= (1 << i);
      digitVerts[+k] = v;
    });
    const digitV = digitVerts[highlight];

    // Draw edges (Hamming distance 1) — only between digit-like vertices to keep it readable
    ctx.strokeStyle = 'rgba(148,163,184,0.05)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 128; i++) {
      for (let bit = 0; bit < 7; bit++) {
        const j = i ^ (1 << bit);
        if (j > i) {
          const a = verts[i], b = verts[j];
          ctx.beginPath(); ctx.moveTo(toX(a.x), toY(a.y)); ctx.lineTo(toX(b.x), toY(b.y)); ctx.stroke();
        }
      }
    }

    // Draw all 128 vertices
    verts.forEach(p => {
      const isDigit = Object.values(digitVerts).includes(p.v);
      const isHighlight = p.v === digitV;
      ctx.fillStyle = isHighlight ? '#22d3ee' : (isDigit ? 'rgba(251,191,36,0.85)' : 'rgba(148,163,184,0.18)');
      ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), isHighlight?7:isDigit?4.5:1.8, 0, 2*Math.PI); ctx.fill();
      if (isHighlight) {
        ctx.strokeStyle='#fff'; ctx.lineWidth=1.3; ctx.stroke();
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor='#22d3ee';
        ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 7, 0, 2*Math.PI); ctx.fill();
        ctx.restore();
      }
    });

    // Label digits
    Object.keys(digitVerts).forEach(k => {
      const v = digitVerts[+k];
      const p = verts[v];
      const isH = v === digitV;
      ctx.fillStyle = isH ? '#22d3ee' : 'rgba(251,191,36,0.9)';
      ctx.font = `bold ${isH?14:10}px monospace`; ctx.textAlign='center';
      ctx.fillText(k, toX(p.x), toY(p.y)-10);
    });

    ctx.fillStyle = 'var(--text-2)'; ctx.font='10px monospace'; ctx.textAlign='left';
    ctx.fillText('128 vertices of 7-D unit hypercube', 10, 18);
    ctx.fillStyle = 'rgba(251,191,36,0.9)'; ctx.fillText('• digit vertex', 10, 32);
    ctx.fillStyle = '#22d3ee'; ctx.fillText('• highlighted', 10, 46);
    ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.fillText('• non-digit vertex', 10, 60);
  }, [highlight]);

  return (
    <div className="m4-card">
      <div className="m4-card-h">Geometric View — The 7-D Digit Hypercube</div>
      <div style={{fontSize:'0.75rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.55}}>
        Each digit is a vertex of the unit 7-cube (2<sup>7</sup> = 128 vertices total). Any <strong>single vertex</strong> can always be "sliced off" by a hyperplane → single-digit classifiers <em>always</em> exist in the single-neuron hypothesis space.
      </div>
      <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap',marginBottom:'0.5rem'}}>
        {Object.keys(SEG_DIGITS).map(k => (
          <button key={k} onClick={()=>setHighlight(+k)} className="m4-algo-tab" style={{padding:'2px 11px',fontSize:'0.72rem',background:highlight===+k?'rgba(34,211,238,0.2)':'',borderColor:highlight===+k?'#22d3ee':''}}>
            {k}
          </button>
        ))}
      </div>
      <canvas ref={canRef} style={{width:'100%',height:360,borderRadius:8,border:'1px solid rgba(148,163,184,0.15)'}} />
      <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
        <strong>Vertices are positioned</strong> by summing the unit vectors of each segment that is "on" (segments fixed at 2π·i/7 around the unit circle). Edges connect vertices at Hamming distance 1.
      </div>
    </div>
  );
}

function NeuronLogicTab() {
  const [sec, setSec] = useState('overview');
  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview','Overview'],
          ['geometry','Hyperplane Geometry'],
          ['seven','7-Segment Trainer'],
          ['gates','Logic Gates'],
          ['xor','XOR Problem'],
          ['mlp','Multi-Layer XOR'],
          ['hypercube','Digit Hypercube'],
          ['summary','Key Takeaways'],
        ].map(([v,l])=>(
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'overview' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(251,191,36,0.07) 0%,rgba(34,211,238,0.07) 100%)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['7-segment','Decoder problem','#fbbf24'],['Hyperplane','n-D linear classifier','#22d3ee'],['Logic gate','Neuron-as-gate','#a78bfa'],['XOR','Not lin. separable','#fb7185'],['Hypercube','Hypothesis space','#34d399'],['MLP','Multi-layer fix','#06b6d4']].map(([k,v,col])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">The 7-Segment Decoder Problem</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
                Older displays use 7 LED segments controlled by 7 bits (8th = decimal point). Standard ICs (e.g., 4056) <strong>encode</strong> a binary digit → segment pattern.
                <br/><br/>
                Our problem reverses that: <strong>decode</strong> the digit from the segment pattern — a computer-vision style classification.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Input/output dimensions</div>
              <ul className="m4-bullets" style={{fontSize:'0.74rem'}}>
                <li>Input: n = 7 segment bits (+ a bias)</li>
                <li>Output: binary — "is this a <em>k</em>? y/n"</li>
                <li>One neuron per target digit</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Segment Activation Table — Digit → Segments</div>
              <table className="m4-ptable" style={{fontSize:'0.72rem'}}>
                <thead><tr><th>Digit</th><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>g</th></tr></thead>
                <tbody>
                  {[0,1,2,3,4,5,6,7,8,9].map(d => {
                    const segs = SEG_DIGITS[d];
                    return (
                      <tr key={d}>
                        <td className="pk" style={{fontWeight:700}}>{d}</td>
                        {segs.map((s,i)=>(
                          <td key={i} style={{textAlign:'center',color:s?'#fbbf24':'rgba(148,163,184,0.3)'}}>{s?'▉':'·'}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Multi-Input Neurons — Biological Reality</div>
            <div className="m4-two-col">
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.7}}>
                Real neurons can have <strong>thousands</strong> of inputs:
                <ul className="m4-bullets" style={{fontSize:'0.75rem',marginTop:'0.4rem'}}>
                  <li>Purkinje cells (cerebellum): &gt; 1,000 dendritic branches, tens of thousands of synapses</li>
                  <li>Human brain: ~86 billion neurons</li>
                  <li>Average synaptic connections per neuron: ~7,000</li>
                  <li>3-year-old child: ~10<sup>15</sup> total synapses</li>
                </ul>
              </div>
              <div className="m4-infobox" style={{fontSize:'0.74rem'}}>
                <strong>Composability is the key.</strong> A single biological neuron is the building block; intelligence emerges from arranging many in layers and circuits — exactly the lesson at the end of this lecture (NAND universality + multi-layer perceptron).
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">From 1 Input to n Inputs — The Geometry Grows</div>
            <table className="m4-ptable">
              <thead><tr><th>Inputs</th><th>Activation</th><th>Decision boundary</th><th>Splits</th></tr></thead>
              <tbody>
                <tr><td className="pk">1</td><td><Tex src="a = \sigma(wx + b)" /></td><td>point <Tex src="x = -b/w" /></td><td>real line</td></tr>
                <tr><td className="pk">2</td><td><Tex src="a = \sigma(w_1 x_1 + w_2 x_2 + b)" /></td><td>1-D line</td><td>2-D plane</td></tr>
                <tr><td className="pk">3</td><td><Tex src="a = \sigma(w_1 x_1 + w_2 x_2 + w_3 x_3 + b)" /></td><td>2-D plane</td><td>3-D space</td></tr>
                <tr><td className="pk">n</td><td><Tex src="a = \sigma(\vec{w}\cdot\vec{x} + b)" /></td><td>(n−1)-D hyperplane</td><td>n-D space</td></tr>
              </tbody>
            </table>
            <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.74rem'}}>
              <strong>Key insight:</strong> a neuron with n inputs partitions <Tex src="\mathbb{R}^n" /> by the hyperplane <Tex src="\vec{w}\cdot\vec{x} + b = 0" />. Everything past that is just bookkeeping.
            </div>
          </div>
        </div>
      )}

      {sec === 'geometry' && (
        <div>
          <Hyperplane2DViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Threshold-Line Algebra</div>
              <div className="m4-flabel">Activation</div>
              <Tex src="a = \sigma(w_1 x_1 + w_2 x_2 + b)" block />
              <div className="m4-flabel" style={{marginTop:'0.4rem'}}>Decision rule a &gt; 0.5  ⟺  z &gt; 0</div>
              <Tex src="w_1 x_1 + w_2 x_2 + b = 0 \;\Rightarrow\; x_2 = -\tfrac{w_1}{w_2}x_1 - \tfrac{b}{w_2}" block />
              <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.4rem',lineHeight:1.6}}>
                A linear equation <Tex src="y = c_1 x + c_0" />, i.e. a <strong>line</strong>.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Intercepts (memorise)</div>
              <ul className="m4-bullets" style={{fontSize:'0.75rem'}}>
                <li><Tex src="-b/w_1" /> on the x₁ axis</li>
                <li><Tex src="-b/w_2" /> on the x₂ axis</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">n-Dimensional Generalisation</div>
              <Tex src="a(\vec{w}, b, \vec{x}) = \sigma\!\left(\sum_{i=1}^n w_i x_i + b\right) = \sigma(\vec{w}\cdot\vec{x} + b)" block/>
              <div className="m4-flabel" style={{marginTop:'0.6rem'}}>Hyperplane equation</div>
              <Tex src="\vec{w}\cdot\vec{x} + b = 0" block/>
              <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.73rem'}}>
                For n inputs, the decision boundary is an <strong>(n−1)-dimensional hyperplane</strong>. Geometrically: a flat surface that divides n-D space into two half-spaces.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">NumPy implementation (n-D)</div>
              <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>{`# Returns 1 × s array of activations
def activation_nd(weights, b, inputs):
    return logistic(np.dot(weights, inputs) + b)

# Shapes: weights (1, n),  inputs (n, s)  →  out (1, s)
# numpy auto-broadcasts for batch evaluation`}</div>
            </div>
          </div>
        </div>
      )}

      {sec === 'seven' && (
        <div>
          <SevenSegmentTrainer />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Training Data Setup (NumPy)</div>
              <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>{`DIGITS = {
  0: [0,1,2,4,5,6],
  1: [2,5],
  2: [0,2,3,4,6],
  3: [0,2,3,5,6],
  4: [1,2,3,5],
  5: [0,1,3,5,6],
  6: [0,1,3,4,5,6],
  7: [0,2,5],
  8: [0,1,2,3,4,5,6],
  9: [0,1,2,3,5]
}

inputs = np.zeros((10, 7), dtype=int)
for k in DIGITS:
    inputs[k][DIGITS[k]] = 1
inputs = inputs.T          # shape: (7, 10)

# Target: "is a 1?"
one = np.array([[0,1,0,0,0,0,0,0,0,0]])`}</div>
              <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginTop:'0.4rem'}}>
                <strong>Shapes:</strong> inputs (7, 10) — 7 parameters × 10 trials. Target (1, 10).
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Training Observations</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>Target</th><th>Outcome</th></tr></thead>
                <tbody>
                  <tr><td className="pk">1 (easy)</td><td>Cost drops fast (~20 iter); class-1 activation crosses 0.5 at iter ~450; <strong>regularly succeeds</strong> regardless of initialisation</td></tr>
                  <tr><td className="pk">7 (hard)</td><td>Often plateaus with class-7 activation ≈ 0.4. Sensitive to initialisation. Smaller ε / more iterations don't reliably help. Looks like a <strong>local minimum</strong></td></tr>
                </tbody>
              </table>
              <div className="m4-warnbox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
                <strong>Why is '7' hard?</strong> {`{b, c}`} ⊂ {`{a, b, c}`} — the segments of '1' are a subset of '7'. The decision boundary has to thread <em>between</em> '1' and '7', not just isolate '7' against everything else.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Solution 2 — Hit-Counting Construction (Always Works)</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65,marginBottom:'0.5rem'}}>
              Manually construct a neuron that detects an exact pattern by giving each segment a weight of <strong>+1</strong> (must be on) or <strong>−1</strong> (must be off), and setting bias to <Tex src="b = -(K - 0.5)" /> where K is the number of "on" segments.
            </div>
            <div className="m4-pseudocode" style={{fontSize:'0.7rem'}}>{`Example — digit '7' has segments {a, b, c} on (K = 3):
weights = [+1, +1, +1, -1, -1, -1, -1]   # a,b,c=+1; d,e,f,g=-1
bias    = -(3 - 0.5) = -2.5

For input pattern 1010010 (digit '7'):
  z = 1·1 + 1·1 + 1·1 + (-1)·0 + (-1)·0 + (-1)·0 + (-1)·0 + (-2.5)
    = 3 - 2.5 = 0.5  →  σ(0.5) ≈ 0.62  →  fires!

For any other digit: z < 0 → σ(z) < 0.5 → does not fire.`}</div>
            <div className="m4-infobox" style={{marginTop:'0.5rem',fontSize:'0.72rem'}}>
              <strong>Click "Hit-counting solution"</strong> in the trainer above to lock in these exact weights and confirm by inspection — score should jump straight to 10/10.
            </div>
          </div>
        </div>
      )}

      {sec === 'gates' && (
        <div>
          <LogicGatePlayground />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Canonical Logic Gates — Lecture Values</div>
              <table className="m4-ptable" style={{fontSize:'0.76rem'}}>
                <thead><tr><th>Gate</th><th>w₁</th><th>w₂</th><th>b</th></tr></thead>
                <tbody>
                  <tr><td className="pk">AND</td><td>1</td><td>1</td><td>−1.5</td></tr>
                  <tr><td className="pk">OR</td><td>1</td><td>1</td><td>−0.5</td></tr>
                  <tr><td className="pk">NAND</td><td>−1</td><td>−1</td><td>1.5</td></tr>
                  <tr><td className="pk">NOR</td><td>−1</td><td>−1</td><td>0.5</td></tr>
                  <tr><td className="pk">¬x₁</td><td>−1</td><td>0</td><td>0.5</td></tr>
                  <tr><td className="pk">¬x₂</td><td>0</td><td>−1</td><td>0.5</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
                Pattern: <strong>flip all signs</strong> to turn a gate into its negation.
              </div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Perceptron vs Logistic Neuron</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li><strong>Perceptron</strong> uses the step activation — gives clean 0/1.</li>
                <li><strong>Sigmoid neuron</strong> outputs continuous values; a &gt; 0.5 is the threshold.</li>
                <li>By scaling weights up (large w), a sigmoid neuron approaches a perceptron <strong>arbitrarily closely</strong> (Minsky &amp; Papert, 1969).</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">NAND universality</div>
              <div style={{fontSize:'0.74rem',color:'var(--text-1)',lineHeight:1.6}}>
                <strong>Any Boolean function</strong> of n inputs can be expressed using only NAND gates. Therefore any Boolean function can be realised by some <em>composition</em> of sigmoid neurons. The architecture below the gate table is exactly what NAND-universality gives you.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Logic Decoder Construction</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
              Treating 1/0 inputs as True/False, a neuron can implement any Boolean function of n inputs. For example, the truth-table for "is a 7" reads:
            </div>
            <Tex src="f([\bar{i}_0, \bar{i}_1, i_2, \bar{i}_3, \bar{i}_4, i_5, \bar{i}_6]) = \text{True}" block />
            <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.4rem'}}>
              Bar (¯) denotes negation. The single ANDed product term picks out one vertex of the 7-cube — the digit '7' pattern.
            </div>
          </div>
        </div>
      )}

      {sec === 'xor' && (
        <div>
          <XORProblemViz />

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">'4 or 7' → Reduces to XOR</div>
            <div className="m4-two-col">
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
                The class {`{4, 7}`} is separable from {`{0..9}`} <em>only if</em> {`{4, 7}`} is separable from {`{1, 4, 7, 9}`}.
                Bits b, c, d, e (indices 2, 4, 5, 6) carry no discriminative value over this subset.
                <br/><br/>Reduce to 3-D (i₀, i₁, i₂ = segments a, f, g). Columns i₀ and i₁ are identical → collapse to 2-D.
              </div>
              <table className="m4-ptable" style={{fontSize:'0.76rem'}}>
                <thead><tr><th>Digit</th><th>i₀ (a)</th><th>i₂ (g)</th><th>out</th></tr></thead>
                <tbody>
                  <tr><td className="pk">1</td><td>0</td><td>0</td><td style={{color:'#fb7185',fontWeight:700}}>0</td></tr>
                  <tr><td className="pk">4</td><td>1</td><td>0</td><td style={{color:'#34d399',fontWeight:700}}>1</td></tr>
                  <tr><td className="pk">7</td><td>0</td><td>1</td><td style={{color:'#34d399',fontWeight:700}}>1</td></tr>
                  <tr><td className="pk">9</td><td>1</td><td>1</td><td style={{color:'#fb7185',fontWeight:700}}>0</td></tr>
                </tbody>
              </table>
            </div>
            <Tex src="\text{out} = i_0 \oplus i_2" block />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Implications for Hypothesis Space</div>
            <ul className="m4-bullets" style={{fontSize:'0.78rem'}}>
              <li><strong>Expressive enough</strong> to solve any <em>single-digit</em> 7-segment classifier (provable via hypercube).</li>
              <li><strong>Not expressive enough</strong> to solve <em>two-digit</em> classifiers in general — specifically '4 or 7' which reduces to XOR.</li>
              <li>Distinction between "does a solution exist in our hypothesis space?" and "can our algorithm find it?" <strong>matters</strong>.</li>
              <li><strong>Minsky &amp; Papert (1969)</strong>, <em>Perceptrons: An Introduction to Computational Geometry</em> — highlighted exactly this limitation. Contributed to the AI Winter.</li>
            </ul>
          </div>
        </div>
      )}

      {sec === 'mlp' && (
        <div>
          <MultiLayerXORViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Architecture (Modares, 2012)</div>
              <table className="m4-ptable" style={{fontSize:'0.75rem'}}>
                <thead><tr><th>Neuron</th><th>w₁</th><th>w₂</th><th>b</th><th>Gate</th></tr></thead>
                <tbody>
                  <tr><td className="pk">Hidden 1</td><td>−1</td><td>−1</td><td>1.5</td><td>NAND</td></tr>
                  <tr><td className="pk">Hidden 2</td><td>1</td><td>1</td><td>−0.5</td><td>OR</td></tr>
                  <tr><td className="pk">Output</td><td>1</td><td>1</td><td>−1.5</td><td>AND</td></tr>
                </tbody>
              </table>
              <Tex src="\text{XOR}(A, B) = \text{AND}(\text{NAND}(A,B),\ \text{OR}(A,B))" block />
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Geometric Interpretation</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
                Hidden neurons 1 &amp; 2 each draw a separating line in the original (x₁, x₂) plane. Their activations (a₁, a₂) define a <strong>new 2-D feature space</strong> in which the four input points become linearly separable. The output neuron then partitions <em>that</em> space with a single hyperplane.
              </div>
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
                <strong>This is the key insight</strong> — hidden layers compute new <em>features</em>. The output is just a linear classifier on those features. Modern deep networks do the same idea with many more layers and learned (not hand-crafted) weights.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem',background:'linear-gradient(135deg,rgba(52,211,153,0.06) 0%,rgba(34,211,238,0.06) 100%)'}}>
            <div className="m4-card-h">NAND Universality — Why This Matters</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
              Every Boolean function can be expressed using only NAND gates (a well-known result from digital logic).
              Therefore every Boolean function can be realised by a network of sigmoid neurons.
              The <strong>2-layer architecture is universal</strong> — any classifier you can describe in logic can be built this way.
              Modern neural networks generalise this to real-valued inputs and outputs with the <em>universal approximation theorem</em>.
            </div>
          </div>
        </div>
      )}

      {sec === 'hypercube' && (
        <div>
          <HypercubeViz />
          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Solution 1 — Hypercube Geometry</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
                <li>Each digit's segment pattern is a point in <Tex src="\{0,1\}^7" /> — i.e. a <strong>vertex of the 7-cube</strong>.</li>
                <li>The cube has 2<sup>7</sup> = <strong>128</strong> vertices; 10 of them are digits 0–9.</li>
                <li><strong>Any single vertex</strong> of a hypercube can be sliced off by a single hyperplane → single-digit classifier always exists.</li>
                <li><strong>Adjacent vertices</strong> (Hamming distance 1) can be jointly sliced off — e.g. '1' = `0010010`, '7' = `1010010` differ in one bit, so {`{1,7}`} is separable from the rest.</li>
                <li><strong>Opposite vertices</strong> of an embedded square (XOR-like) cannot — that's exactly what '4 or 7' becomes.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Reduction Exercises</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>Pair</th><th>Min bits needed</th></tr></thead>
                <tbody>
                  <tr><td className="pk">5 vs 6</td><td>1 bit (segment e)</td></tr>
                  <tr><td className="pk">7 vs 8</td><td>fewer than 7</td></tr>
                  <tr><td className="pk">(8 or 9) vs (1 or 2)</td><td>small subset</td></tr>
                  <tr><td className="pk">7 vs (1 or 2)</td><td>small subset</td></tr>
                  <tr><td className="pk">1 or 7</td><td>reduces to 2 inputs (single vertex)</td></tr>
                </tbody>
              </table>
              <div className="m4-infobox" style={{marginTop:'0.55rem',fontSize:'0.72rem'}}>
                <strong>Strategy:</strong> drop bits that are identical across the subset of digits being classified — they carry zero information. What remains is the effective hypercube the classifier operates on.
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'summary' && (
        <div>
          <div className="m4-card" style={{background:'linear-gradient(135deg,rgba(34,211,238,0.06) 0%,rgba(167,139,250,0.06) 100%)'}}>
            <div className="m4-card-h">Key Takeaways — Memorise These</div>
            <ol style={{paddingLeft:'1.2rem',margin:0,fontSize:'0.84rem',lineHeight:2,color:'var(--text-1)'}}>
              <li>An n-input neuron is a <strong>linear classifier</strong> in <Tex src="\mathbb{R}^n" /> — it partitions space with an (n−1)-dimensional <strong>hyperplane</strong> defined by <Tex src="\vec{w}\cdot\vec{x} + b = 0" />.</li>
              <li>For the 7-segment problem, <strong>every single-digit classifier exists</strong> in the single-neuron hypothesis space — provable by hypercube geometry <em>and</em> by explicit hit-counting construction.</li>
              <li><strong>Multi-digit classifiers</strong> (e.g., '4 or 7') reduce to XOR-like patterns, which are <strong>not linearly separable</strong> — a single neuron fails.</li>
              <li>The fix is to <strong>stack neurons into layers</strong> (multi-layer perceptron). Any Boolean function is realisable because NAND is universal.</li>
              <li>The existence of a solution in the hypothesis space is <em>independent</em> of whether gradient descent (or any algorithm) can find it. <strong>GIGO</strong> — answer both questions explicitly.</li>
              <li>Hidden layers compute <strong>new features</strong>. The output is a linear classifier on those features. This is the entire intuition behind deep learning.</li>
            </ol>
          </div>

          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">The Three Solutions From The Lecture</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>#</th><th>Approach</th><th>What it shows</th></tr></thead>
                <tbody>
                  <tr><td className="pk">1</td><td>Hypercube geometry</td><td>Any single vertex can be sliced off → existence proof</td></tr>
                  <tr><td className="pk">2</td><td>Hit-counting</td><td>Constructive: ±1 weights + bias = −(K − 0.5)</td></tr>
                  <tr><td className="pk">3</td><td>Neurons as logic gates</td><td>AND/OR/NAND/NOR with hand-set weights — NAND universality</td></tr>
                </tbody>
              </table>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Historical Timeline</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <tbody>
                  <tr><td className="pk">1957</td><td>Rosenblatt's <strong>Perceptron</strong> — adaptive linear classifier</td></tr>
                  <tr><td className="pk">1969</td><td>Minsky &amp; Papert, <em>Perceptrons</em> — XOR limitation. <strong>AI Winter</strong> follows</td></tr>
                  <tr><td className="pk">1986</td><td>Rumelhart et al. — back-propagation revives MLPs</td></tr>
                  <tr><td className="pk">2012+</td><td>Modern deep learning takes over</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Bridge to the Rest of CITS4404</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.65}}>
              <strong>Why this lecture matters for the trading-bot project:</strong>{' '}
              You won't necessarily build an MLP, but you <em>will</em> use the same <strong>"language → model → metric"</strong> framework, the same gradient/stochastic search, and you'll encounter the same trade-offs — hypothesis-space expressiveness vs. algorithm reachability vs. over-fit. The discipline of separating "does a solution exist?" from "can my algorithm find it?" is exactly what disciplined experimental design looks like.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ALGORITHM ATLAS — Memorisation Journey ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Six "stages" arranged into a learning journey
const ATLAS_GROUPS = [
  { id:'gradient', name:'Gradient Methods',          color:'#22d3ee', icon:'∇', subtitle:'Smooth, differentiable spaces — follow the slope', lecture:'Lec 6' },
  { id:'direct',   name:'Direct Methods',            color:'#a78bfa', icon:'◇', subtitle:'No derivatives — sample your way around', lecture:'Lec 7' },
  { id:'single',   name:'Single-State Stochastic',   color:'#fbbf24', icon:'★', subtitle:'One candidate + randomness escapes local optima', lecture:'Lec 9' },
  { id:'evol',     name:'Evolutionary Strategies',   color:'#34d399', icon:'μ', subtitle:'Many candidates evolving — (μ, λ) and (μ + λ)', lecture:'Lec 10' },
  { id:'ga',       name:'Genetic Algorithms',        color:'#fb7185', icon:'☷', subtitle:'Crossover, selection, mutation — Holland’s playbook', lecture:'Lec 11' },
  { id:'emergent', name:'Emergent & Hybrid',         color:'#06b6d4', icon:'∞', subtitle:'PSO, DE, memetic — collective intelligence', lecture:'Lec 12' },
];

// Each algorithm uses {n} markers as fill-in-the-blank slots.
// `blanks[n]` is the matching answer object.
const ATLAS_ALGOS = [
  // ── GRADIENT ──────────────────────────────────────────────────────────────
  {
    id:'ga-1d', group:'gradient', name:'1-D Gradient Ascent', lecture:'Lec 6',
    intuition:'Climb in the direction of the gradient — uphill — to find a maximum.',
    notes:[
      'Sign of f′(x) gives the direction of step.',
      'Magnitude of f′(x) gives the size of the step.',
      'α is the learning rate (tuning parameter) that scales the step.',
      'Ideal hypothesis space: continuously differentiable (C¹).',
    ],
    pseudo:`1: x ← random initial value
2: repeat
3:     x ← x {0} α {1}
4: until stopping criterion reached
5: return x`,
    blanks:[
      {answer:'+', options:['+','−','·','/'], explain:'Ascent moves in the direction of the gradient → add.'},
      {answer:'f′(x)', options:['x','f(x)','f′(x)','f′′(x)'], explain:'Gradient ascent uses the first derivative.'},
    ],
  },
  {
    id:'gd-1d', group:'gradient', name:'1-D Gradient Descent', lecture:'Lec 6',
    intuition:'Move opposite to the gradient — downhill — to find a minimum.',
    notes:[
      'Sign of f′(x) gives the direction; magnitude gives the size.',
      'α (learning rate): too small = slow, too large = overshoot & oscillation.',
      'Naturally slows down near a minimum for a suitable α.',
      'Stopping: f′(x)=0, |f′(x)|<ε, iter cap, or time cap.',
    ],
    pseudo:`1: x ← random initial value
2: repeat
3:     x ← x {0} α f′(x)
4: until stopping criterion reached
5: return x`,
    blanks:[
      {answer:'−', options:['+','−','·','/'], explain:'Descent moves opposite to the gradient → subtract.'},
    ],
  },
  {
    id:'nr', group:'gradient', name:'Newton-Raphson (1-D Optimisation)', lecture:'Lec 6',
    intuition:'Approximate f locally with a quadratic by using the curvature — the optimal step naturally scales with f′′.',
    notes:[
      'Use N-R on f′ (zeros of f′ = optima of f).',
      'Solves a quadratic of the form ax²+b in ONE step.',
      'Hypothesis space: twice differentiable (C²).',
      '"Best" step size: rise / slope = f′(x) / f′′(x).',
    ],
    pseudo:`1: x ← random initial value
2: repeat
3:     x ← x − {0} / {1}
4: until stopping criterion reached
5: return x`,
    blanks:[
      {answer:'f′(x)', options:['f(x)','f′(x)','f′′(x)','α'], explain:'Optima of f are zeros of f′ → numerator is f′(x).'},
      {answer:'f′′(x)', options:['f(x)','f′(x)','f′′(x)','α'], explain:'Dividing by curvature f′′(x) auto-tunes the step.'},
    ],
  },
  {
    id:'gd-nd', group:'gradient', name:'Multi-dim Gradient Ascent', lecture:'Lec 6',
    intuition:'Same recipe in n dimensions — gradient ∇f is the vector of partial derivatives, pointing in the direction of steepest ascent.',
    notes:[
      '∇f is a vector of partial derivatives ∂f/∂xᵢ.',
      'Pure linear-algebra operation — GPU-friendly.',
      'Limitation: still gets stuck in local optima on multi-modal surfaces.',
    ],
    pseudo:`1: 𝐱 ← random initial vector
2: repeat
3:     𝐱 ← 𝐱 {0} α {1}
4: until stopping criterion reached
5: return 𝐱`,
    blanks:[
      {answer:'+', options:['+','−','·','/'], explain:'Ascent.'},
      {answer:'∇f(𝐱)', options:['f(𝐱)','∇f(𝐱)','∇²f(𝐱)','𝐱'], explain:'Gradient is the n-D analogue of f′.'},
    ],
  },
  {
    id:'ga-restart', group:'gradient', name:'Gradient Ascent with Restarts', algNum:'Algorithm 3', lecture:'Lec 6',
    intuition:'Climb to a peak, remember the best, then teleport to a new random starting point and try again — the simplest escape from local optima.',
    notes:[
      'Inner loop = gradient climb to a local max.',
      'Outer loop = restart at a new random point.',
      '𝐱* always holds the best ever found.',
      'Inner stopping uses ||∇f(𝐱)|| < ε in practice.',
    ],
    pseudo:`1:  𝐱 ← random initial value
2:  𝐱* ← 𝐱                        ▷ 𝐱* will hold our best discovery so far
3:  repeat
4:      repeat
5:          𝐱 ← 𝐱 + α∇f(𝐱)        ▷ In one dimension: x ← x + αf′(x)
6:      until {0}                       ▷ In one dimension: until f′(x) = 0
7:      if {1} then                     ▷ Found a new best result!
8:          𝐱* ← 𝐱
9:      𝐱 ← random value
10: until we have run out of time
11: return 𝐱*`,
    blanks:[
      {answer:'||∇f(𝐱)|| = 0', options:['||∇f(𝐱)|| = 0','f(𝐱) > f(𝐱*)','𝐱 = 𝐱*','time is up'], explain:'Inner loop ends when gradient vanishes.'},
      {answer:'f(𝐱) > f(𝐱*)', options:['f(𝐱) > f(𝐱*)','𝐱 = 𝐱*','f(𝐱) = 0','α < ε'], explain:'Update best only when we beat the previous best.'},
    ],
  },

  // ── DIRECT METHODS ────────────────────────────────────────────────────────
  {
    id:'ccs', group:'direct', name:'Cyclic Coordinate Search', lecture:'Lec 7',
    intuition:'Optimise one coordinate at a time, cycling through all dimensions — "taxicab" search. Will either improve or stay the same.',
    notes:[
      'Series of 1-D line searches along each basis direction.',
      'Stops when one full cycle yields norm change ≤ ε.',
      'Can fail to find local optimum on diagonal valleys/ridges.',
    ],
    pseudo:`function cyclic_coordinate_descent(f, x, ε)
    Δ, n = Inf, length(x)
    while abs(Δ) > ε
        x′ = copy(x)
        for i in 1 : n
            d = {0}
            x = {1}
        end
        Δ = norm(x - x′)
    end
    return x
end`,
    blanks:[
      {answer:'basis(i, n)', options:['basis(i, n)','rand(n)','∇f(x)','x - x′'], explain:'Search direction = basis vector eᵢ.'},
      {answer:'line_search(f, x, d)', options:['line_search(f, x, d)','x + α d','line_search(∇f, x, d)','f(x) + d'], explain:'Each step is a 1-D line search along d.'},
    ],
  },
  {
    id:'ccs-a', group:'direct', name:'CCS with Acceleration Step', lecture:'Lec 7',
    intuition:'After one full cycle, the net displacement (xⁿ − x⁰) points in a promising direction — take an extra line search along it. Speeds up diagonal valleys.',
    notes:[
      'Identical to CCS plus one extra line search after the inner loop.',
      'The extra direction is x − x′ (net cycle displacement).',
      'Helps with diagonal ridges and curved valleys.',
    ],
    pseudo:`function cyclic_coordinate_descent_with_acceleration_step(f, x, ε)
    Δ, n = Inf, length(x)
    while abs(Δ) > ε
        x′ = copy(x)
        for i in 1 : n
            d = basis(i, n)
            x = line_search(f, x, d)
        end
        x = line_search(f, x, {0})  # acceleration step
        Δ = norm(x - x′)
    end
    return x
end`,
    blanks:[
      {answer:'x - x′', options:['x - x′','basis(1, n)','∇f(x)','Δ'], explain:'Net cycle displacement = x − x′.'},
    ],
  },
  {
    id:'powell', group:'direct', name:'Powell’s Method', lecture:'Lec 7',
    intuition:'Like CCS but the directions adapt: keep a queue of n unit directions, replace the oldest with the latest "promising" direction (xⁿ − x⁰).',
    notes:[
      'Start with the n basis vectors in the queue.',
      'After each cycle: enqueue (x′ − x), dequeue the oldest.',
      'Risk: directions can become linearly dependent (loses full span).',
    ],
    pseudo:`function powell(f, x, ε)
    n = length(x)
    U = [basis(i,n) for i in 1 : n]
    Δ = Inf
    while Δ > ε
        x′ = x
        for i in 1 : n
            d = U[i]
            x′ = line_search(f, x′, d)
        end
        for i in 1 : n-1
            U[i] = U[i+1]
        end
        U[n] = d = {0}
        x′ = line_search(f, x′, d)
        Δ = norm(x′ - x)
        x = x′
    end
    return x
end`,
    blanks:[
      {answer:'x′ - x', options:['x′ - x','x - x′','basis(n, n)','∇f(x′)'], explain:'The new direction is the cycle’s net progress vector.'},
    ],
  },
  {
    id:'hj', group:'direct', name:'Hooke-Jeeves Method', lecture:'Lec 7',
    intuition:'Sample f(x ± α eᵢ) in every dimension. If any sample improves, jump to the best; if none do, shrink α.',
    notes:[
      'Requires 2n evaluations per step.',
      'Step shrinks by factor γ (typically 0.5) when no improvement.',
      'A type of pattern search — like sliding & shrinking an n-cube.',
    ],
    pseudo:`function hooke_jeeves(f, x, α, ε, γ=0.5)
    y, n = f(x), length(x)
    while α > ε
        improved = false
        x_best, y_best = x, y
        for i in 1 : n
            for sgn in (-1, 1)
                x′ = x + sgn·α·basis(i, n)
                y′ = f(x′)
                if y′ < y_best
                    x_best, y_best, improved = x′, y′, true
                end
            end
        end
        x, y = x_best, y_best
        if !improved
            α *= {0}
        end
    end
    return x
end`,
    blanks:[
      {answer:'γ', options:['γ','α','ε','n'], explain:'No-improvement → shrink step size by decay factor γ.'},
    ],
  },
  {
    id:'gps', group:'direct', name:'Generalised Pattern Search', lecture:'Lec 7',
    intuition:'Like Hooke-Jeeves but the direction set D is a positive spanning set — fewer than 2n directions can still cover ℝⁿ.',
    notes:[
      'D must be a positive spanning set (e.g., n+1 vectors).',
      'Opportunistic: accept the first improving direction.',
      'Dynamic ordering: push the successful direction to the front.',
    ],
    pseudo:`function generalized_pattern_search(f, x, α, D, ε, γ=0.5)
    y, n = f(x), length(x)
    while α > ε
        improved = false
        for (i, d) in enumerate(D)
            x′ = x + α·d
            y′ = f(x′)
            if {0}
                x, y, improved = x′, y′, true
                D = pushfirst!(deleteat!(D, i), d)
                break
            end
        end
        if !improved
            α *= γ
        end
    end
    return x
end`,
    blanks:[
      {answer:'y′ < y', options:['y′ < y','y′ > y','α > ε','d == 0'], explain:'Accept if the candidate improves the objective.'},
    ],
  },
  {
    id:'nm', group:'direct', name:'Nelder-Mead Simplex', lecture:'Lec 7',
    intuition:'Maintain an n+1 vertex simplex. Reflect the worst point through the centroid; if it’s great expand, if it’s bad contract, if all fails shrink.',
    notes:[
      'Typical defaults: α=1, β=2, γ=0.5, σ=0.5.',
      'Sort low→high; xl, xs, xh = lowest, second-highest, highest.',
      'Stopping: variance of vertex values · √(1/(n+1)) < ε.',
      'Shape adapts: reflection, expansion, contraction, shrinkage.',
    ],
    pseudo:`function nelder_mead(f, S, ε; α=1.0, β=2.0, γ=0.5)
    Δ, y_arr = Inf, f.(S)
    while Δ > ε
        p = sortperm(y_arr)               # sort lowest to highest
        S, y_arr = S[p], y_arr[p]
        xl, yl = S[1], y_arr[1]           # lowest
        xh, yh = S[end], y_arr[end]       # highest
        xs, ys = S[end-1], y_arr[end-1]   # second-highest
        xm = mean(S[1:end-1])             # centroid
        xr = xm + α*(xm - xh)            # {0}
        yr = f(xr)
        if yr < yl
            xe = xm + {1}*(xr - xm)        # expansion point
            ye = f(xe)
            S[end], y_arr[end] = ye < yr ? (xe, ye) : (xr, yr)
        elseif yr ≥ ys
            if yr < yh
                xh, yh, S[end], y_arr[end] = xr, yr, xr, yr
            end
            xc = xm + γ*(xh - xm)        # contraction point
            yc = f(xc)
            if yc > yh
                for i in 2 : length(y_arr)
                    S[i] = (S[i] + xl)/2
                    y_arr[i] = f(S[i])
                end
            else
                S[end], y_arr[end] = xc, yc
            end
        else
            S[end], y_arr[end] = xr, yr
        end
        Δ = std(y_arr, corrected=false)
    end
    return S[argmin(y_arr)]
end`,
    blanks:[
      {answer:'reflection point', options:['reflection point','expansion point','shrinkage point','centroid'], explain:'xr is the reflection of xh through xm.'},
      {answer:'β', options:['α','β','γ','σ'], explain:'Expansion uses β (typically 2).'},
    ],
  },

  // ── SINGLE-STATE STOCHASTIC ────────────────────────────────────────────────
  {
    id:'hc-restart', group:'single', name:'Hill-Climbing with Random Restarts', algNum:'Algorithm 10', lecture:'Lec 9',
    intuition:'Tweak the candidate, keep it if it’s better; periodically jump to a brand-new random candidate. Short time intervals → exploration; long → exploitation.',
    notes:[
      'T is the distribution of intervals between restarts.',
      'Best tracks the best solution across all restarts.',
      'Pure tweak-accept hill climb inside; jump randomly outside.',
    ],
    pseudo:`1:  T ← distribution of possible time intervals
2:  S ← some initial random candidate solution
3:  Best ← S
4:  repeat
5:      time ← random time in the near future, chosen from T
6:      repeat
7:          R ← Tweak(Copy(S))
8:          if {0} then
9:              S ← R
10:     until S is the ideal solution, or time is up, or we have run out of total time
11:     if Quality(S) > Quality(Best) then
12:         Best ← S
13:     S ← {1}
14: until Best is the ideal solution or we have run out of total time
15: return Best`,
    blanks:[
      {answer:'Quality(R) > Quality(S)', options:['Quality(R) > Quality(S)','Quality(R) < Quality(S)','R = S','R ∈ L'], explain:'Greedy accept — keep R if it’s strictly better.'},
      {answer:'some random candidate solution', options:['some random candidate solution','Best','Tweak(S)','∅'], explain:'Restart → jump to a brand-new random candidate.'},
    ],
  },
  {
    id:'gauss', group:'single', name:'Gaussian Convolution', algNum:'Algorithm 11', lecture:'Lec 9',
    intuition:'Add normal-distributed noise to each element. Most jumps are small (locality); occasionally large jumps. σ directly tunes exploration.',
    notes:[
      'Jumps can be any size; large ones are rare.',
      'σ (or σ²) is the very direct exploration knob.',
      'Resamples noise if vi+n falls outside [min, max].',
    ],
    pseudo:`1:  𝐯 ← vector ⟨v1, v2, ...vl⟩ to be convolved
2:  p ← probability of adding noise to an element      ▷ Often p = 1
3:  σ² ← variance of Normal distribution to convolve with   ▷ Normal = Gaussian
4:  min ← minimum desired vector element value
5:  max ← maximum desired vector element value         ▷ may be (-∞, ∞)
6:  for i from 1 to l do
7:      if p ≥ random number chosen uniformly from 0.0 to 1.0 then
8:          repeat
9:              n ← random number chosen from the Normal distribution {0}
10:         until min ≤ vi + n ≤ max
11:         vi ← vi {1} n
12: return 𝐯`,
    blanks:[
      {answer:'N(0, σ²)', options:['N(0, σ²)','N(vi, σ²)','U(min, max)','N(μ, 1)'], explain:'Mean 0, variance σ² — the convolution is unbiased.'},
      {answer:'+', options:['+','−','·','='], explain:'Add the noise to the current value.'},
    ],
  },
  {
    id:'sa', group:'single', name:'Simulated Annealing', algNum:'Algorithm 13', lecture:'Lec 9',
    intuition:'Hill climb but occasionally accept a worse R, with probability that shrinks as temperature t cools. t=∞ → random walk; t=0 → pure hill climb.',
    notes:[
      't is temperature, decreased over time on some schedule.',
      'Acceptance probability of a worse R = e^((Q(R)-Q(S))/t).',
      'Works on combinatorial spaces too (e.g., TSP).',
    ],
    pseudo:`1:  t ← temperature, initially a high number
2:  S ← some initial candidate solution
3:  Best ← S
4:  repeat
5:      R ← Tweak(Copy(S))
6:      if Quality(R) > Quality(S) or if a random number chosen from 0 to 1
            < {0}  then
7:          S ← R
8:      {1}
9:      if Quality(S) > Quality(Best) then
10:         Best ← S
11: until Best is the ideal solution, we have run out of time, or t ≤ 0
12: return Best`,
    blanks:[
      {answer:'e^((Quality(R) - Quality(S)) / t)', options:['e^((Quality(R) - Quality(S)) / t)','e^((Quality(S) - Quality(R)) / t)','1 / t','Quality(R) / Quality(S)'], explain:'Boltzmann-style acceptance probability.'},
      {answer:'Decrease t', options:['Decrease t','Increase t','Reset t','Set t ← 0'], explain:'Temperature decreases over time per the cooling schedule.'},
    ],
  },
  {
    id:'tabu', group:'single', name:'Tabu Search', algNum:'Algorithm 14', lecture:'Lec 9',
    intuition:'Don’t go back where you’ve already been. Maintain a FIFO list L of recently visited solutions; sample n tweaks per step, reject candidates in L.',
    notes:[
      'L has maximum length l; oldest entries fall off.',
      'Each step samples n tweaks; pick the best that’s not in L.',
      'Real-valued spaces need a "sufficiently close" notion.',
    ],
    pseudo:`1:  l ← desired maximum tabu list length
2:  n ← number of tweaks desired to sample the gradient
3:  S ← some initial candidate solution
4:  Best ← S
5:  L ← {} a tabu list of maximum length l    ▷ First-in, first-out queue
6:  Enqueue S into L
7:  repeat
8:      if Length(L) > l then
9:          Remove oldest element from L
10:     R ← Tweak(Copy(S))
11:     for n − 1 times do
12:         W ← Tweak(Copy(S))
13:         if W ∉ L and (Quality(W) > Quality(R) or R ∈ L) then
14:             R ← W
15:     if {0} then
16:         S ← R
17:         Enqueue R into L
18:     if Quality(S) > Quality(Best) then
19:         Best ← S
20: until Best is the ideal solution or we have run out of time
21: return Best`,
    blanks:[
      {answer:'R ∉ L', options:['R ∉ L','R ∈ L','Quality(R) > Quality(S)','Length(L) > l'], explain:'Only adopt R if it is not tabu (not on the recent-visit list).'},
    ],
  },
  {
    id:'ils', group:'single', name:'Iterated Local Search (ILS)', algNum:'Algorithm 16', lecture:'Lec 9',
    intuition:'Better local optima are usually near the one you’re in. Hill-climb to a peak, perturb home base, repeat.',
    notes:[
      'H = current "home base" local optimum.',
      'NewHomeBase(H, S): decide whether to retain or replace.',
      'Perturb(H): jump big enough to escape, small enough to stay nearby.',
      '"Hill climb of hill climbs" vs "random walk of hill climbs".',
    ],
    pseudo:`1:  T ← distribution of possible time intervals
2:  S ← some initial random candidate solution
3:  H ← S                              ▷ The current "home base" local optimum
4:  Best ← S
5:  repeat
6:      time ← random time in the near future, chosen from T
7:      repeat
8:          R ← Tweak(Copy(S))
9:          if Quality(R) > Quality(S) then
10:             S ← R
11:     until S is the ideal solution, or time is up, or we have run out of total time
12:     if Quality(S) > Quality(Best) then
13:         Best ← S
14:     H ← {0}
15:     S ← {1}
16: until Best is the ideal solution or we have run out of total time
17: return Best`,
    blanks:[
      {answer:'NewHomeBase(H, S)', options:['NewHomeBase(H, S)','Perturb(H)','S','Best'], explain:'Update home base via the chosen heuristic.'},
      {answer:'Perturb(H)', options:['NewHomeBase(H, S)','Perturb(H)','random value','S'], explain:'Perturb home base to seed the next inner climb.'},
    ],
  },

  // ── EVOLUTIONARY STRATEGIES ─────────────────────────────────────────────────
  {
    id:'ea-abstract', group:'evol', name:'Abstract Generational EA', algNum:'Algorithm 17', lecture:'Lec 10',
    intuition:'The skeleton every EA fits: assess fitness, track best, breed offspring, join into next generation.',
    notes:[
      'AssessFitness — can be expensive.',
      'Breed — selection + tweaking (mutation and/or recombination).',
      'Join — replace, or keep some fitter parents.',
    ],
    pseudo:`P ← BuildInitialPopulation()
Best ← ∅                           // ∅ means "nobody yet"
repeat
    AssessFitness(P)
    for each individual Pᵢ ∈ P do
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ              // Fitness is just Quality
    P ← {0}
until Best is the ideal solution or we have run out of time
return Best`,
    blanks:[
      {answer:'Join(P, Breed(P))', options:['Join(P, Breed(P))','Breed(P)','Mutate(P)','SelectWithReplacement(P)'], explain:'Children come from Breed; the next generation is Join(parents, children).'},
    ],
  },
  {
    id:'mu-lambda', group:'evol', name:'(μ, λ) Evolution Strategy', algNum:'Algorithm 18', lecture:'Lec 10',
    intuition:'Keep the top μ parents, mutate each λ/μ times to make λ children, then REPLACE the parents with the children.',
    notes:[
      'μ = parents kept (truncation selection).',
      'λ = number of children produced.',
      'Children REPLACE parents — no parent persists.',
      'Lower premature-convergence risk than (μ + λ).',
    ],
    pseudo:`μ ← number of parents selected
λ ← number of children generated by the parents

P ← {}
for λ times do                                   ▷ Build Initial Population
    P ← P ∪ {new random individual}

Best ← ∅
repeat
    for each individual Pᵢ ∈ P do
        AssessFitness(Pᵢ)
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ
    Q ← the μ individuals in P with greatest Fitness()   ▷ Truncation Selection
    P ← {0}                                              ▷ Join = {1}
    for each individual Qⱼ ∈ Q do
        for λ/μ times do
            P ← P ∪ {Mutate(Copy(Qⱼ))}
until Best is the ideal solution or we have run out of time
return Best`,
    blanks:[
      {answer:'{}', options:['{}','Q','P','Q ∪ P'], explain:'Children replace parents — start with empty P.'},
      {answer:'replace P with children', options:['replace P with children','keep parents in P','union of P and Q','union of children and best'], explain:'(μ, λ): offspring-only — parents do NOT survive.'},
    ],
  },
  {
    id:'mu-plus-lambda', group:'evol', name:'(μ + λ) Evolution Strategy', algNum:'Algorithm 19', lecture:'Lec 10',
    intuition:'Like (μ, λ) but the top μ parents COMPETE with their children for the next generation — more exploitative.',
    notes:[
      'Only line that changes: P ← Q (keep parents) instead of P ← {}.',
      'Risk: premature convergence — a great parent never dies.',
      'Equivalent in spirit to GA elitism.',
    ],
    pseudo:`μ ← number of parents selected
λ ← number of children generated by the parents

P ← {}
for λ times do                         ▷ Or perhaps λ + μ — see Luke footnote 18
    P ← P ∪ {new random individual}

Best ← ∅
repeat
    for each individual Pᵢ ∈ P do
        AssessFitness(Pᵢ)
        if Best = ∅ or Fitness(Pᵢ) > Fitness(Best) then
            Best ← Pᵢ
    Q ← the μ individuals in P with greatest Fitness()
    P ← {0}                             ▷ KEY DIFFERENCE: Join keeps parents in P
    for each individual Qⱼ ∈ Q do
        for λ/μ times do
            P ← P ∪ {Mutate(Copy(Qⱼ))}
until Best is the ideal solution or we have run out of time
return Best`,
    blanks:[
      {answer:'Q', options:['Q','{}','P','{}∩Q'], explain:'(μ + λ): parents (Q) stay; offspring are added to them.'},
    ],
  },

  // ── GENETIC ALGORITHMS ───────────────────────────────────────────────────────
  {
    id:'ga', group:'ga', name:'The Genetic Algorithm', algNum:'Algorithm 20', lecture:'Lec 11',
    intuition:'Holland’s playbook: select two parents with replacement, crossover, mutate both children, repeat popsize/2 times. Crossover is the primary operator.',
    notes:[
      'popsize must be even.',
      'SelectWithReplacement may pick the same individual twice.',
      'Children = Mutate(Crossover(Copy(Pa), Copy(Pb))).',
    ],
    pseudo:`1:  popsize ← desired population size       ▷ Basically λ. Make it even.
2:  P ← {}
3:  for popsize times do
4:      P ← P ∪ {new random individual}
5:  Best ← □
6:  repeat
7:      for each individual Pᵢ ∈ P do
8:          AssessFitness(Pᵢ)
9:          if Best = □ or Fitness(Pᵢ) > Fitness(Best) then
10:             Best ← Pᵢ
11:     Q ← {}                             ▷ Begin deviation from (μ, λ)
12:     for popsize/2 times do
13:         Parent P_a ← {0}
14:         Parent P_b ← {0}
15:         Children C_a, C_b ← Crossover({1})
16:         Q ← Q ∪ {Mutate(C_a), Mutate(C_b)}
17:     P ← Q                              ▷ End of deviation
18: until Best is the ideal solution or we have run out of time
19: return Best`,
    blanks:[
      {answer:'SelectWithReplacement(P)', options:['SelectWithReplacement(P)','Truncation(P, μ)','Mutate(P)','Tabu(P)'], explain:'Two parents are independently selected (with replacement).'},
      {answer:'Copy(P_a), Copy(P_b)', options:['Copy(P_a), Copy(P_b)','P_a, P_b','Mutate(P_a), Mutate(P_b)','Q, P'], explain:'Crossover works on COPIES — originals stay intact for re-selection.'},
    ],
  },
  {
    id:'rand-bitvec', group:'ga', name:'Generate a Random Bit-Vector', algNum:'Algorithm 21', lecture:'Lec 11',
    intuition:'Each gene is independently true with probability 0.5.',
    notes:[
      'Simplest unbiased initialisation.',
      'Generalises to other alphabets and representations.',
    ],
    pseudo:`1:  𝐯 ← a new vector ⟨v_1, v_2, ..., v_l⟩
2:  for i from 1 to l do
3:      if {0} > a random number chosen uniformly between 0.0 and 1.0 inclusive then
4:          v_i ← true
5:      else
6:          v_i ← false
7:  return 𝐯`,
    blanks:[
      {answer:'0.5', options:['0.5','1/l','p','σ'], explain:'Fair coin → 0.5.'},
    ],
  },
  {
    id:'bit-flip', group:'ga', name:'Bit-Flip Mutation', algNum:'Algorithm 22', lecture:'Lec 11',
    intuition:'For each bit, with small probability p (often 1/l), flip it. Expected number of flips per individual = p·l.',
    notes:[
      'Often p = 1/l → expected 1 flip per individual.',
      'Maintains diversity; can re-open hypercube dimensions that crossover has collapsed.',
    ],
    pseudo:`1:  p ← probability of flipping a bit              ▷ Often p is set to {0}
2:  𝐯 ← boolean vector ⟨v_1, v_2, ..., v_l⟩ to be mutated

3:  for i from 1 to l do
4:      if p ≥ random number chosen uniformly from 0.0 to 1.0 inclusive then
5:          v_i ← {1}
6:  return 𝐯`,
    blanks:[
      {answer:'1/l', options:['1/l','0.5','1','0'], explain:'Canonical choice: one expected flip per individual.'},
      {answer:'¬(v_i)', options:['¬(v_i)','v_i','true','false'], explain:'Flip = logical NOT.'},
    ],
  },
  {
    id:'1pt', group:'ga', name:'One-Point Crossover', algNum:'Algorithm 23', lecture:'Lec 11',
    intuition:'Pick a cut point c uniformly in [1, l]; swap everything from c onwards. v₁ and v_l have a high (l−1)/l chance of being separated.',
    notes:[
      'Worst linkage for v₁ and v_l.',
      'Best linkage for adjacent vᵢ and vᵢ₊₁.',
    ],
    pseudo:`1:  𝐯 ← first vector ⟨v_1, v_2, ..., v_l⟩ to be crossed over
2:  𝐰 ← second vector ⟨w_1, w_2, ..., w_l⟩ to be crossed over

3:  c ← random integer chosen uniformly from 1 to l inclusive
4:  if c ≠ 1 then
5:      for i from {0} to {1} do
6:          Swap the values of v_i and w_i
7:  return 𝐯 and 𝐰`,
    blanks:[
      {answer:'c', options:['1','c','c+1','l-c'], explain:'Swap region begins at c.'},
      {answer:'l', options:['l-1','l','c+1','l/2'], explain:'Swap region ends at l.'},
    ],
  },
  {
    id:'2pt', group:'ga', name:'Two-Point Crossover', algNum:'Algorithm 24', lecture:'Lec 11',
    intuition:'Pick two cut points c < d; swap the interior segment. Best visualised as cutting a ring — distance, not position, governs linkage.',
    notes:[
      'P(v₁ and v_l separated) = 2/l (same as adjacent genes).',
      'Distant-but-not-endpoint genes still vulnerable.',
    ],
    pseudo:`1:  𝐯 ← first vector ⟨v_1, v_2, ..., v_l⟩ to be crossed over
2:  𝐰 ← second vector ⟨w_1, w_2, ..., w_l⟩ to be crossed over

3:  c ← random integer chosen uniformly from 1 to l inclusive
4:  d ← random integer chosen uniformly from 1 to l inclusive
5:  if c > d then
6:      {0}
7:  if c ≠ d then
8:      for i from c to {1} do
9:          Swap the values of v_i and w_i
10: return 𝐯 and 𝐰`,
    blanks:[
      {answer:'Swap c and d', options:['Swap c and d','Set d = c','Return','Continue'], explain:'Ensure c ≤ d before iterating.'},
      {answer:'d - 1', options:['d - 1','d','d + 1','l'], explain:'Swap from c up to (but not including) d.'},
    ],
  },
  {
    id:'uniform-x', group:'ga', name:'Uniform Crossover', algNum:'Algorithm 25', lecture:'Lec 11',
    intuition:'For each index independently, swap with probability p (≤0.5). Equal linkage across all gene pairs.',
    notes:[
      'P(separation) for any two genes = 2p(1−p).',
      'Disrupts building blocks aggressively if p is large.',
    ],
    pseudo:`1:  p ← probability of swapping an index            ▷ Often p = 1/l. At any rate, p ≤ 0.5
2:  𝐯 ← first vector ⟨v_1, v_2, ..., v_l⟩ to be crossed over
3:  𝐰 ← second vector ⟨w_1, w_2, ..., w_l⟩ to be crossed over

4:  for i from 1 to l do
5:      if {0} then
6:          Swap the values of v_i and w_i
7:  return 𝐯 and 𝐰`,
    blanks:[
      {answer:'p ≥ random number chosen uniformly from 0.0 to 1.0 inclusive', options:['p ≥ random number chosen uniformly from 0.0 to 1.0 inclusive','p ≤ 0.5','i = c','random < 0.5'], explain:'Each index swap is independent with probability p.'},
    ],
  },
  {
    id:'roulette', group:'ga', name:'Fitness-Proportionate (Roulette) Selection', algNum:'Algorithm 30', lecture:'Lec 11',
    intuition:'Stack fitnesses into a CDF; pick a uniform random point on the stack and return whichever individual’s slice contains it.',
    notes:[
      'Assumes fitness is absolute (not just relative).',
      'Build CDF once per generation; lookup is each call.',
      'Vulnerable to flat-fitness landscapes (all picks ~uniform).',
    ],
    pseudo:`Perform once per generation                         ▷ Or whenever any fitnesses change
1:  global 𝐩 ← population copied into a vector of individuals ⟨p_1, p_2, ..., p_l⟩
3:  global 𝐟 ← ⟨f_1, f_2, ..., f_l⟩ fitnesses of individuals in 𝐩  ▷ Must all be ≥ 0
4:  if 𝐟 is all 0.0s then                          ▷ Deal with all 0 fitnesses gracefully
5:      Convert 𝐟 to all 1.0s
6:  for i from 2 to l do                            ▷ Convert 𝐟 to a CDF; f_l = s
7:      f_i ← {0}

Perform each time
9:   n ← random number from 0 to f_l inclusive
10:  for i from 2 to l do                           ▷ Could use binary search
11:      if {1} then
12:          return p_i
13:  return p_1`,
    blanks:[
      {answer:'f_i + f_{i-1}', options:['f_i + f_{i-1}','f_i · f_{i-1}','f_i / s','f_l - f_i'], explain:'Build the CDF by cumulative addition.'},
      {answer:'f_{i-1} < n ≤ f_i', options:['f_{i-1} < n ≤ f_i','n = f_i','n > f_l','n < f_1'], explain:'Find the slice (f_{i-1}, f_i] containing the random point n.'},
    ],
  },
  {
    id:'sus', group:'ga', name:'Stochastic Universal Sampling', algNum:'Algorithm 31', lecture:'Lec 11',
    intuition:'Like roulette but with n equally-spaced pointers on a single random offset — low-variance resampling that guarantees fair representation.',
    notes:[
      'Any individual with f_i ≥ s/n gets chosen at least once.',
      'O(n) complexity; single random number per generation.',
      'Variance much lower than vanilla roulette.',
    ],
    pseudo:`Perform once per n individuals produced            ▷ Usually n = l (once per generation)
1:  global 𝐩 ← copy of population ⟨p_1, p_2, ..., p_l⟩, shuffled randomly
3:  global 𝐟 ← ⟨f_1, f_2, ..., f_l⟩ fitnesses in same order as 𝐩   ▷ All must be ≥ 0
4:  global index ← 0
5:  if 𝐟 is all 0.0s then
6:      Convert 𝐟 to all 1.0s
7:  for i from 2 to l do                            ▷ Convert 𝐟 to a CDF; f_l = s
8:      f_i ← f_i + f_{i-1}
9:  global value ← random number from 0 to {0} inclusive

Perform each time
11: while f_{index} < value do
12:     index ← index + 1
13: value ← value + {1}
14: return p_{index}`,
    blanks:[
      {answer:'f_l/n', options:['f_l/n','f_l','1/n','s'], explain:'Random offset within ONE slice of size s/n.'},
      {answer:'f_l / n', options:['f_l / n','1 / n','f_l','s / l'], explain:'Advance by exactly one slice each call.'},
    ],
  },
  {
    id:'tournament', group:'ga', name:'Tournament Selection', algNum:'Algorithm 32', lecture:'Lec 11',
    intuition:'Pick t individuals at random; return the fittest. t=1 → random; t≫popsize → truncation. Non-parametric and trivially parallel.',
    notes:[
      'Only the RANK ORDER of fitnesses matters — magnitudes are irrelevant.',
      'Tuneable via tournament size t.',
      'Most popular selection method for GAs.',
    ],
    pseudo:`1:  P ← population
2:  t ← tournament size, t ≥ 1

3:  Best ← individual picked at random from P with replacement
4:  for i from 2 to t do
5:      Next ← individual picked at random from P with replacement
6:      if {0} then
7:          Best ← Next
8:  return Best`,
    blanks:[
      {answer:'Fitness(Next) > Fitness(Best)', options:['Fitness(Next) > Fitness(Best)','Fitness(Next) < Fitness(Best)','Next ∈ P','i = t'], explain:'Keep the strictly fitter of the two.'},
    ],
  },
  {
    id:'ga-elitism', group:'ga', name:'GA with Elitism', algNum:'Algorithm 33', lecture:'Lec 11',
    intuition:'Carry forward the n fittest individuals UNCHANGED, then fill the rest of the next generation with normal GA breeding.',
    notes:[
      '(popsize − n) must be even.',
      'Best monotonically improves — never goes backwards.',
      'Risk: elites flood the gene pool → premature convergence.',
    ],
    pseudo:`1:  popsize ← desired population size
2:  n ← desired number of elite individuals       ▷ popsize - n should be even

3:  P ← {}
4:  for popsize times do
5:      P ← P ∪ {new random individual}
6:  Best ← □
7:  repeat
8:      for each individual Pᵢ ∈ P do
9:          AssessFitness(Pᵢ)
10:         if Best = □ or Fitness(Pᵢ) > Fitness(Best) then
11:             Best ← Pᵢ
12:     Q ← {0}
13:     for (popsize − n)/2 times do
14:         Parent P_a ← SelectWithReplacement(P)
15:         Parent P_b ← SelectWithReplacement(P)
16:         Children C_a, C_b ← Crossover(Copy(P_a), Copy(P_b))
17:         Q ← Q ∪ {Mutate(C_a), Mutate(C_b)}
18:     P ← Q
19: until Best is the ideal solution or we have run out of time
20: return Best`,
    blanks:[
      {answer:'{the n fittest individuals in P, breaking ties at random}', options:['{the n fittest individuals in P, breaking ties at random}','{}','{Best}','SelectWithReplacement(P)'], explain:'Seed Q with the elite group BEFORE breeding the rest.'},
    ],
  },

  // ── EMERGENT & HYBRID ───────────────────────────────────────────────────────
  {
    id:'pso', group:'emergent', name:'Particle Swarm Optimisation (PSO)', algNum:'Algorithm 39', lecture:'Lec 12',
    intuition:'Each particle has a velocity blending its inertia (α) with attractions to personal best (β), informants’ best (γ), and global best (δ). ε scales the step.',
    notes:[
      'x* = particle’s own historical best.',
      'x⁺ = best in the particle’s neighbourhood/informants.',
      'x! = global best across the swarm.',
      'α → exploration; δ → exploitation toward best.',
    ],
    pseudo:`1:  swarmsize ← desired swarm size
2:  α ← proportion of velocity to be retained
3:  β ← proportion of personal best to be retained
4:  γ ← proportion of the informants’ best to be retained
5:  δ ← proportion of global best to be retained
6:  ε ← jump size of a particle

7:  P ← {}
8:  for swarmsize times do
9:      P ← P ∪ {new random particle x with a random initial velocity v}
10: Best ← □
11: repeat
12:     for each particle x ∈ P with velocity v do
13:         AssessFitness(x)
14:         if Best = □ or Fitness(x) > Fitness(Best) then
15:             Best ← x
16:     for each particle x ∈ P with velocity v do      ▷ Determine how to Mutate
17:         x*  ← previous fittest location of x
18:         x+  ← previous fittest location of informants of x   ▷ (including x itself)
19:         x!  ← previous fittest location any particle
20:         for each dimension i do
21:             b ← random number from 0.0 to β inclusive
22:             c ← random number from 0.0 to γ inclusive
23:             d ← random number from 0.0 to δ inclusive
24:             v_i ← {0}
25:     for each particle x ∈ P with velocity v do      ▷ Mutate
26:         x ← {1}
27: until Best is the ideal solution or we have run out of time
28: return Best`,
    blanks:[
      {answer:'α·v_i + b(x_i* − x_i) + c(x_i+ − x_i) + d(x_i! − x_i)', options:['α·v_i + b(x_i* − x_i) + c(x_i+ − x_i) + d(x_i! − x_i)','α·v_i + b·x_i*','v_i + α·∇f(x)','β(x_i! − x_i)'], explain:'Velocity is a weighted blend of inertia + 3 attractors.'},
      {answer:'x + ε·v', options:['x + ε·v','x − ε·v','v + ε·x','ε(x* + v)'], explain:'Position update: integrate velocity by step size ε.'},
    ],
  },
  {
    id:'hybrid', group:'emergent', name:'Abstract Hybrid EA + Hill-Climb', algNum:'Algorithm 36', lecture:'Lec 12',
    intuition:'Each evaluation in an EA is followed by t iterations of hill-climbing on that individual — combine global exploration of EA with local exploitation of HC.',
    notes:[
      'Hill-Climb runs for t iterations PER individual.',
      'Hill-climbed individuals REPLACE the originals in P.',
      'Also called "memetic" algorithms (memes ~ genes).',
    ],
    pseudo:`1:  t ← number of iterations to Hill-Climb

2:  P ← Build Initial Population
3:  Best ← □
4:  repeat
5:      AssessFitness(P)
6:      for each individual Pᵢ ∈ P do
7:          Pᵢ ← {0}          ▷ Replace Pᵢ in P
8:          if Best = □ or Fitness(Pᵢ) > Fitness(Best) then
9:              Best ← Pᵢ
10:     P ← Join(P, Breed(P))
11: until Best is the ideal solution or we have run out of time
12: return Best`,
    blanks:[
      {answer:'Hill-Climb(Pᵢ) for t iterations', options:['Hill-Climb(Pᵢ) for t iterations','Mutate(Pᵢ)','Crossover(Pᵢ, P_j)','Copy(Pᵢ)'], explain:'Replace each individual with its locally-improved version.'},
    ],
  },
  {
    id:'de', group:'emergent', name:'Differential Evolution — Mutation Operator', lecture:'Lec 12',
    intuition:'Pick three distinct individuals A, B, C. The child = A + F·(B − C). Step size auto-scales with population spread.',
    notes:[
      'Reminiscent of Nelder-Mead reflection.',
      'Mutation magnitude shrinks naturally as the population converges.',
      'F is a scale parameter (typically 0.5–1.0).',
    ],
    pseudo:`Pick three distinct individuals A, B, C from the population.
The child is formed by vector addition:

    child ← A {0} F·({1} − {2})

The bigger the population spread, the bigger the step.
Children compete directly against their immediate parents.`,
    blanks:[
      {answer:'+', options:['+','−','·','/'], explain:'Add the scaled difference vector to A.'},
      {answer:'B', options:['A','B','C','child'], explain:'B and C define the difference vector.'},
      {answer:'C', options:['A','B','C','child'], explain:'B − C is the difference.'},
    ],
  },
];

// ── Boss quizzes per stage ──────────────────────────────────────────────────────
const ATLAS_QUIZZES = {
  gradient: [
    {q:'What does α control in gradient descent?', opts:['Stopping tolerance','Step size (learning rate)','Direction of descent','Curvature'], ans:1, expl:'α scales the magnitude of each step. Sign of f′ already gives direction.'},
    {q:'Newton-Raphson for optimisation uses which update?', opts:['x ← x − α f′(x)','x ← x − f(x)/f′(x)','x ← x − f′(x)/f′′(x)','x ← x + α ∇f(x)'], ans:2, expl:'N-R for optima: divide first derivative by second derivative.'},
    {q:'N-R requires which smoothness class?', opts:['C⁰','C¹','C²','C∞'], ans:2, expl:'Twice differentiable — we need f′′.'},
    {q:'In Gradient Ascent with Restarts, when do you update the best 𝐱*?', opts:['Every iteration','When the inner loop converges and f(𝐱) > f(𝐱*)','Only at the very end','After every restart, unconditionally'], ans:1, expl:'After each climb, check whether the new local optimum beats the recorded best.'},
  ],
  direct: [
    {q:'Hooke-Jeeves does HOW many evaluations per step in n dimensions?', opts:['n','n+1','2n','2ⁿ'], ans:2, expl:'Two directions (±) per dimension → 2n samples.'},
    {q:'Powell’s Method differs from CCS by:', opts:['Using gradients','Maintaining an adaptive QUEUE of search directions','Shrinking step size each cycle','Doubling the simplex'], ans:1, expl:'Powell keeps a queue of n directions; the oldest is replaced by the latest xⁿ − x⁰.'},
    {q:'In Nelder-Mead, what is xm?', opts:['The highest vertex','The lowest vertex','The centroid of all vertices except xh','The reflection of xh'], ans:2, expl:'Centroid = mean of all vertices except the highest (worst).'},
    {q:'A "positive spanning set" in GPS guarantees what?', opts:['Linear independence','At least one descent direction from any point','Convergence in n+1 steps','Constant-time evaluation'], ans:1, expl:'Any non-stationary point has at least one direction in D pointing downhill.'},
  ],
  single: [
    {q:'In Hill-Climbing with Random Restarts, short time intervals favour:', opts:['Exploitation','Exploration','Convergence','Pure greedy'], ans:1, expl:'Short intervals → frequent restarts → more exploration.'},
    {q:'The Simulated Annealing acceptance probability for a worse R equals:', opts:['1/t','e^((Q(R) − Q(S))/t)','e^((Q(S) − Q(R))/t)','Q(R)/Q(S)'], ans:1, expl:'Boltzmann — with Q(R)<Q(S) the exponent is negative.'},
    {q:'Tabu Search’s tabu list is implemented as:', opts:['A stack (LIFO)','A FIFO queue with bounded length','A binary tree','A hash set with no capacity'], ans:1, expl:'Oldest visited solutions fall off the end as new ones arrive.'},
    {q:'Iterated Local Search uses which heuristic for restarts?', opts:['Restart uniformly at random','Restart near the previous local optimum','Restart at the best','Restart at a fixed grid'], ans:1, expl:'Assume better optima are NEAR the current one; perturb home base.'},
    {q:'σ (or σ²) in Gaussian Convolution directly tunes:', opts:['Stopping tolerance','Mutation probability','Rate of exploration','Number of restarts'], ans:2, expl:'Larger σ → bigger typical jumps → more exploration.'},
  ],
  evol: [
    {q:'In (μ, λ), where do the parents end up in the next generation?', opts:['Mixed with offspring','REPLACED by offspring','Kept only if elite','Discarded only on plateau'], ans:1, expl:'Comma scheme — offspring-only.'},
    {q:'(μ + λ) differs from (μ, λ) on exactly which line?', opts:['Build initial population','Truncation step','P ← {} vs P ← Q','for λ/μ times'], ans:2, expl:'Plus scheme keeps parents (P ← Q) instead of starting empty.'},
    {q:'How many children does each parent produce in (μ, λ)?', opts:['1','λ','λ/μ','μ'], ans:2, expl:'Total λ offspring spread across μ parents.'},
    {q:'Rechenberg’s One-Fifth Rule says: if p_s > 1/5, you should:', opts:['Decrease σ²','Increase σ²','Reset population','Keep σ² fixed'], ans:1, expl:'Too many improvements → over-exploiting; jump bigger.'},
  ],
  ga: [
    {q:'In Algorithm 20, how many children are produced per crossover call?', opts:['1','2','popsize/2','popsize'], ans:1, expl:'Each Crossover returns C_a and C_b — two children.'},
    {q:'Bit-Flip Mutation at p = 1/l gives an expected flip count per individual of:', opts:['0','1','l','l/2'], ans:1, expl:'Expectation = p·l = 1.'},
    {q:'Two-Point Crossover’s probability of separating v₁ and v_l is:', opts:['1/l','(l−1)/l','2/l','2p(1−p)'], ans:2, expl:'Like any adjacent pair on the ring — just 2 cut points around them.'},
    {q:'Tournament selection with t = 1 is equivalent to:', opts:['Truncation selection','Uniform random selection','Roulette','Elitism'], ans:1, expl:'Just one random pick — no comparison.'},
    {q:'Crossover ALONE cannot:', opts:['Spread good substrings','Restore a collapsed dimension of the hypercube','Produce identical children','Operate on real-valued vectors'], ans:1, expl:'If all parents share a gene, crossover preserves that value — only mutation can reopen it.'},
    {q:'GA with Elitism risks:', opts:['Loss of best','Premature convergence','Slow fitness improvement','Linear time complexity'], ans:1, expl:'Elites flood the gene pool.'},
  ],
  emergent: [
    {q:'In PSO, x⁺ represents:', opts:['Particle’s own historical best','Best in particle’s informants','Global best','Latest velocity'], ans:1, expl:'Star=personal, plus=neighbourhood, bang=global.'},
    {q:'The PSO position update is:', opts:['x ← x + α·v','x ← x + ε·v','x ← v + ε·x','x ← α·x + ε·v'], ans:1, expl:'ε scales velocity to a step.'},
    {q:'Differential Evolution’s child = ?', opts:['A + F·B','A + F·(B − C)','(A + B + C)/3','F·∇f(A)'], ans:1, expl:'A perturbed by the scaled difference of B and C.'},
    {q:'Hybrid / memetic algorithms typically combine:', opts:['Two crossover operators','Local search + population-based search','Two GAs in parallel','PSO and DE'], ans:1, expl:'Exploit + explore = best of both worlds.'},
  ],
};

const ATLAS_KEY = 'cits4404_atlas_progress_v1';

function loadAtlasProgress() {
  try {
    const raw = localStorage.getItem(ATLAS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mastery:{}, quizzes:{}, streak:0, lastDate:null };
}
function saveAtlasProgress(p) {
  try { localStorage.setItem(ATLAS_KEY, JSON.stringify(p)); } catch {}
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// === Pseudo renderer with optional blanks =====================================
function PseudoRender({ algo, mode, blankState, onBlankPick, revealAll }) {
  // Parse template: split by /{n}/g where n is digit
  const lines = algo.pseudo.split('\n');
  return (
    <div style={{background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.18)',borderRadius:8,padding:'0.9rem 1rem',fontFamily:'monospace',fontSize:'0.78rem',lineHeight:1.85,color:'var(--text-1)',whiteSpace:'pre-wrap',overflowX:'auto'}}>
      {lines.map((line, li) => {
        const parts = [];
        let lastIdx = 0;
        const re = /\{(\d+)\}/g;
        let m;
        let key = 0;
        while ((m = re.exec(line)) !== null) {
          if (m.index > lastIdx) parts.push(<span key={key++}>{renderVecText(line.slice(lastIdx, m.index), `t${li}-${key}`)}</span>);
          const bn = +m[1];
          const blank = algo.blanks[bn];
          const state = blankState && blankState[bn];
          if (mode === 'study' || revealAll) {
            parts.push(
              <span key={key++} style={{background:'rgba(34,211,238,0.15)',padding:'0 4px',borderRadius:4,color:'#22d3ee',fontWeight:600,border:'1px dashed rgba(34,211,238,0.4)'}}>
                {renderVecText(blank?.answer ?? '?', `ans${li}-${key}`)}
              </span>
            );
          } else if (mode === 'blanks') {
            if (state?.locked) {
              const isRight = state.pick === blank.answer;
              parts.push(
                <span key={key++} style={{background:isRight?'rgba(52,211,153,0.18)':'rgba(251,113,133,0.18)',padding:'0 4px',borderRadius:4,color:isRight?'#34d399':'#fb7185',fontWeight:700,border:`1px solid ${isRight?'#34d399':'#fb7185'}`}}>
                  {renderVecText(state.pick, `pk${li}-${key}`)}{isRight ? ' ✓' : <> ✘ (→ {renderVecText(blank.answer, `ba${li}-${key}`)})</>}
                </span>
              );
            } else {
              parts.push(
                <select key={key++} value={state?.pick ?? ''} onChange={e=>onBlankPick(bn, e.target.value)}
                  style={{background:'rgba(167,139,250,0.12)',border:'1px solid #a78bfa',borderRadius:4,color:'#a78bfa',padding:'1px 4px',fontFamily:'monospace',fontSize:'0.76rem',fontWeight:600}}>
                  <option value="">_____</option>
                  {blank.options.map(o => <option key={o} value={o}>{vecPlainText(o)}</option>)}
                </select>
              );
            }
          }
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < line.length) parts.push(<span key={key++}>{renderVecText(line.slice(lastIdx), `tl${li}-${key}`)}</span>);
        return <div key={li}>{parts.length ? parts : (line ? renderVecText(line, `ln${li}`) : ' ')}</div>;
      })}
    </div>
  );
}

// === Single Algorithm Card with mode tabs =====================================
function AlgorithmCard({ algo, progress, setProgress, onBack }) {
  const group = ATLAS_GROUPS.find(g => g.id === algo.group);
  const [mode, setMode] = useState('study');
  const [blankState, setBlankState] = useState({});
  const [orderState, setOrderState] = useState(() => shuffleArr(algo.pseudo.split('\n').map((line,i)=>({line, origIdx:i}))));
  const [revealOrder, setRevealOrder] = useState(false);

  useEffect(() => {
    setBlankState({});
    setOrderState(shuffleArr(algo.pseudo.split('\n').map((line,i)=>({line, origIdx:i}))));
    setRevealOrder(false);
  }, [algo.id]);

  const onBlankPick = (n, val) => {
    if (!val) return;
    setBlankState(s => ({...s, [n]: { pick:val, locked:true } }));
  };

  const blankScore = useMemo(() => {
    const total = algo.blanks.length;
    let right = 0;
    for (let i = 0; i < total; i++) {
      const st = blankState[i];
      if (st?.locked && st.pick === algo.blanks[i].answer) right++;
    }
    return { right, total, done: Object.keys(blankState).length === total };
  }, [blankState, algo.blanks]);

  const orderRight = useMemo(() => {
    return orderState.every((it, i) => it.origIdx === i);
  }, [orderState]);

  const recordMastery = useCallback((field, value) => {
    setProgress(p => {
      const np = {...p, mastery:{...p.mastery}};
      const m = np.mastery[algo.id] || {};
      np.mastery[algo.id] = {...m, [field]:value, ts:Date.now()};
      saveAtlasProgress(np);
      return np;
    });
  }, [algo.id, setProgress]);

  const moveUp = (i) => {
    if (i === 0) return;
    setOrderState(s => { const ns=[...s]; [ns[i-1],ns[i]]=[ns[i],ns[i-1]]; return ns; });
  };
  const moveDown = (i) => {
    if (i === orderState.length-1) return;
    setOrderState(s => { const ns=[...s]; [ns[i+1],ns[i]]=[ns[i],ns[i+1]]; return ns; });
  };

  const masteryBadge = (field) => {
    const m = progress.mastery[algo.id];
    if (m?.[field]) {
      const c = field==='recall' ? '#34d399' : '#22d3ee';
      return <span style={{marginLeft:4,fontSize:'0.62rem',color:c,fontFamily:'monospace'}}>✓</span>;
    }
    return null;
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.65rem',flexWrap:'wrap'}}>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.72rem'}} onClick={onBack}>← Map</button>
        <span style={{padding:'2px 9px',background:`${group.color}22`,border:`1px solid ${group.color}55`,borderRadius:6,color:group.color,fontSize:'0.65rem',fontFamily:'monospace',letterSpacing:'0.05em',fontWeight:700}}>{group.icon} {group.name.toUpperCase()}</span>
        <span style={{fontSize:'0.65rem',color:'var(--text-2)',fontFamily:'monospace'}}>{algo.lecture}{algo.algNum?` · ${algo.algNum}`:''}</span>
      </div>

      <div style={{background:`linear-gradient(135deg,${group.color}10 0%,rgba(15,23,42,0.4) 100%)`,border:`1px solid ${group.color}44`,borderRadius:12,padding:'0.85rem 1rem',marginBottom:'0.7rem'}}>
        <h3 style={{margin:'0 0 0.3rem 0',color:group.color,fontSize:'1.15rem'}}>{algo.name}</h3>
        <div style={{fontSize:'0.78rem',color:'var(--text-1)',lineHeight:1.6}}>{algo.intuition}</div>
      </div>

      <div className="m4-algo-tabs" style={{marginBottom:'0.7rem'}}>
        {[
          ['study','§ Study'],
          ['blanks','✏ Blanks'],
          ['order','↕ Order'],
          ['recall','★ Recall'],
        ].map(([v,l]) => (
          <button key={v} className={`m4-algo-tab ${mode===v?'m4-algo-tab--on':''}`} onClick={()=>setMode(v)}>
            {l}{masteryBadge(v)}
          </button>
        ))}
      </div>

      {mode === 'study' && (
        <div className="m4-two-col">
          <div>
            <PseudoRender algo={algo} mode="study" />
            <div style={{display:'flex',gap:'0.4rem',marginTop:'0.55rem',justifyContent:'flex-end'}}>
              <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>recordMastery('study', true)}>I’ve studied this → next mode</button>
            </div>
          </div>
          <div className="m4-card" style={{margin:0}}>
            <div className="m4-card-h">Memory Pegs</div>
            <ul className="m4-bullets" style={{fontSize:'0.76rem'}}>
              {algo.notes.map((n,i) => <li key={i}>{renderVecText(n, `note${i}`)}</li>)}
            </ul>
            <div className="m4-hr"/>
            <div className="m4-flabel">Mode legend</div>
            <ul style={{listStyle:'none',padding:0,margin:0,fontSize:'0.72rem',lineHeight:1.7,color:'var(--text-2)'}}>
              <li><strong style={{color:'#22d3ee'}}>§ Study</strong> — read the exact pseudocode + pegs</li>
              <li><strong style={{color:'#a78bfa'}}>✏ Blanks</strong> — fill the missing tokens</li>
              <li><strong style={{color:'#fbbf24'}}>↕ Order</strong> — unscramble the steps</li>
              <li><strong style={{color:'#34d399'}}>★ Recall</strong> — rate your confidence; tracked for review</li>
            </ul>
          </div>
        </div>
      )}

      {mode === 'blanks' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem',gap:'0.5rem',flexWrap:'wrap'}}>
            <div style={{fontSize:'0.78rem',color:'var(--text-2)',lineHeight:1.55}}>
              Pick the missing token from each dropdown. {algo.blanks.length} blank{algo.blanks.length===1?'':'s'} total.
            </div>
            <div style={{fontFamily:'monospace',fontSize:'0.78rem'}}>
              <span style={{color:'var(--text-2)'}}>score: </span>
              <span style={{color:blankScore.right===blankScore.total?'#34d399':'#fbbf24'}}>{blankScore.right}/{blankScore.total}</span>
            </div>
          </div>
          <PseudoRender algo={algo} mode="blanks" blankState={blankState} onBlankPick={onBlankPick} />
          {blankScore.done && (
            <div style={{marginTop:'0.7rem',padding:'0.7rem',background:'rgba(15,23,42,0.5)',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8}}>
              <div style={{fontSize:'0.74rem',color:'#a78bfa',fontWeight:700,marginBottom:'0.3rem'}}>Explanations</div>
              {algo.blanks.map((b,i) => {
                const correct = blankState[i]?.pick === b.answer;
                return (
                  <div key={i} style={{fontSize:'0.74rem',color:correct?'#34d399':'#fb7185',marginBottom:3,lineHeight:1.55}}>
                    <strong>{i+1}.</strong> {renderVecText(b.explain, `expl${i}`)} <span style={{color:'var(--text-2)'}}>(answer: <code style={{color:'#22d3ee'}}>{renderVecText(b.answer, `bansw${i}`)}</code>)</span>
                  </div>
                );
              })}
              <div style={{display:'flex',gap:'0.4rem',marginTop:'0.6rem'}}>
                <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setBlankState({})}>↻ Try again</button>
                {blankScore.right === blankScore.total && (
                  <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem',background:'rgba(52,211,153,0.15)',borderColor:'#34d399',color:'#34d399'}} onClick={()=>{recordMastery('blanks', true); setMode('order');}}>✓ Mastered → Order mode</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'order' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.55rem',flexWrap:'wrap',gap:'0.5rem'}}>
            <div style={{fontSize:'0.78rem',color:'var(--text-2)'}}>
              Reorder the lines into the algorithm’s correct sequence. Use the ▲ / ▼ buttons.
            </div>
            <div style={{display:'flex',gap:'0.4rem'}}>
              <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>{setOrderState(shuffleArr(algo.pseudo.split('\n').map((line,i)=>({line, origIdx:i})))); setRevealOrder(false);}}>⚃ Reshuffle</button>
              <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem'}} onClick={()=>setRevealOrder(r=>!r)}>{revealOrder?'▲ Hide answer':'▼ Reveal answer'}</button>
            </div>
          </div>
          <div style={{background:'var(--bg-2)',border:'1px solid rgba(148,163,184,0.18)',borderRadius:8,padding:'0.55rem',fontFamily:'monospace',fontSize:'0.74rem'}}>
            {orderState.map((it, i) => {
              const correct = it.origIdx === i;
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.4rem',padding:'2px 4px',background:revealOrder?(correct?'rgba(52,211,153,0.08)':'rgba(251,113,133,0.08)'):'transparent',borderRadius:4,marginBottom:1}}>
                  <span style={{display:'inline-flex',gap:1}}>
                    <button onClick={()=>moveUp(i)} disabled={i===0} style={{background:'rgba(34,211,238,0.12)',border:'1px solid rgba(34,211,238,0.3)',color:'#22d3ee',borderRadius:3,padding:'0px 6px',cursor:i===0?'not-allowed':'pointer',fontSize:'0.7rem',opacity:i===0?0.4:1}}>▲</button>
                    <button onClick={()=>moveDown(i)} disabled={i===orderState.length-1} style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.3)',color:'#a78bfa',borderRadius:3,padding:'0px 6px',cursor:i===orderState.length-1?'not-allowed':'pointer',fontSize:'0.7rem',opacity:i===orderState.length-1?0.4:1}}>▼</button>
                  </span>
                  <span style={{color:revealOrder?(correct?'#34d399':'#fb7185'):'var(--text-1)',whiteSpace:'pre',flex:1}}>{it.line ? renderVecText(it.line, `oline${i}`) : ' '}</span>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:'0.55rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
            <span style={{fontFamily:'monospace',fontSize:'0.74rem',color:orderRight?'#34d399':'var(--text-2)'}}>
              {orderRight ? '✓ Perfect order!' : 'Keep rearranging…'}
            </span>
            {orderRight && (
              <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.7rem',background:'rgba(52,211,153,0.15)',borderColor:'#34d399',color:'#34d399'}} onClick={()=>{recordMastery('order', true); setMode('recall');}}>✓ Mastered → Recall mode</button>
            )}
          </div>
        </div>
      )}

      {mode === 'recall' && (
        <div>
          <div style={{background:'rgba(15,23,42,0.4)',border:'1px solid rgba(148,163,184,0.18)',borderRadius:8,padding:'1rem',marginBottom:'0.7rem'}}>
            <div style={{fontSize:'0.78rem',color:'var(--text-2)',marginBottom:'0.5rem'}}>
              <strong style={{color:'#fbbf24'}}>Without looking</strong>, recite the algorithm in your head (or out loud, or on paper). Then click <em>Show</em> to compare and rate your confidence.
            </div>
            <details style={{marginTop:'0.4rem'}}>
              <summary style={{cursor:'pointer',color:'#22d3ee',fontSize:'0.78rem',fontWeight:600,padding:'0.3rem 0'}}>▶ Show algorithm</summary>
              <div style={{marginTop:'0.5rem'}}>
                <PseudoRender algo={algo} mode="study" />
              </div>
            </details>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem'}}>
            {[
              ['hard', '✘ Hard', '#fb7185', 'Review me again soon'],
              ['good', '◍ Good', '#fbbf24', 'I mostly knew it'],
              ['easy', '★ Easy', '#34d399', 'Locked in'],
            ].map(([v,l,c,d]) => (
              <button key={v} onClick={()=>recordMastery('recall', v)}
                style={{background:progress.mastery[algo.id]?.recall===v?`${c}22`:'rgba(15,23,42,0.5)',border:`1px solid ${c}55`,color:c,borderRadius:8,padding:'0.7rem',cursor:'pointer',textAlign:'center'}}>
                <div style={{fontSize:'0.9rem',fontWeight:700,marginBottom:3}}>{l}</div>
                <div style={{fontSize:'0.66rem',color:'var(--text-2)'}}>{d}</div>
              </button>
            ))}
          </div>
          {progress.mastery[algo.id]?.recall && (
            <div style={{marginTop:'0.55rem',padding:'0.5rem',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:6,fontSize:'0.72rem',color:'#34d399'}}>
              Saved. Algorithms rated <em>Hard</em> bubble up to the top of your review queue.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Boss Quiz ================================================================
function BossQuiz({ groupId, progress, setProgress, onDone }) {
  const group = ATLAS_GROUPS.find(g => g.id === groupId);
  const questions = ATLAS_QUIZZES[groupId] || [];
  const [order] = useState(() => shuffleArr(questions.map((_,i)=>i)));
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState({});
  const [done, setDone] = useState(false);
  const cur = questions[order[step]];

  const pick = (i) => {
    setPicks(p => ({...p, [step]: i }));
  };

  const finish = () => {
    let right = 0;
    for (let i = 0; i < order.length; i++) {
      if (picks[i] === questions[order[i]].ans) right++;
    }
    setProgress(p => {
      const np = {...p, quizzes:{...p.quizzes}};
      const prev = np.quizzes[groupId] || { best:0, attempts:0 };
      np.quizzes[groupId] = { best:Math.max(prev.best, right), attempts:prev.attempts+1, last:right, total:order.length };
      saveAtlasProgress(np);
      return np;
    });
    setDone(true);
  };

  if (done) {
    let right = 0;
    for (let i = 0; i < order.length; i++) if (picks[i] === questions[order[i]].ans) right++;
    const pct = Math.round((right/order.length)*100);
    return (
      <div className="m4-card" style={{borderLeft:`3px solid ${group.color}`}}>
        <div className="m4-card-h">{group.icon} {group.name} — Boss Quiz Result</div>
        <div style={{textAlign:'center',padding:'1.25rem'}}>
          <div style={{fontSize:'2.5rem',fontWeight:700,color:pct>=80?'#34d399':pct>=60?'#fbbf24':'#fb7185',fontFamily:'monospace'}}>{right}/{order.length}</div>
          <div style={{fontSize:'0.9rem',color:'var(--text-2)',marginTop:'0.3rem'}}>{pct}%  ·  {pct>=80?'Stage mastered!':pct>=60?'Solid — review the misses.':'Time for another pass.'}</div>
        </div>
        <div style={{maxHeight:300,overflow:'auto',marginBottom:'0.7rem'}}>
          {order.map((qi,i) => {
            const q = questions[qi];
            const correct = picks[i] === q.ans;
            return (
              <div key={i} style={{padding:'0.5rem',marginBottom:'0.3rem',background:correct?'rgba(52,211,153,0.08)':'rgba(251,113,133,0.08)',border:`1px solid ${correct?'#34d399':'#fb7185'}55`,borderRadius:6,fontSize:'0.74rem'}}>
                <div style={{color:correct?'#34d399':'#fb7185',fontWeight:700,marginBottom:3}}>Q{i+1}: {renderVecText(q.q, `bqq${i}`)}</div>
                <div style={{color:'var(--text-2)',marginLeft:'0.5rem'}}>You: <span style={{color:correct?'#34d399':'#fb7185'}}>{picks[i]===undefined ? '(no answer)' : renderVecText(q.opts[picks[i]], `bqu${i}`)}</span></div>
                <div style={{color:'var(--text-2)',marginLeft:'0.5rem'}}>Correct: <span style={{color:'#22d3ee'}}>{renderVecText(q.opts[q.ans], `bqc${i}`)}</span></div>
                <div style={{color:'var(--text-1)',marginLeft:'0.5rem',marginTop:3,fontStyle:'italic'}}>{renderVecText(q.expl, `bqe${i}`)}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:'flex',gap:'0.4rem'}}>
          <button className="m4-algo-tab" style={{padding:'4px 14px',fontSize:'0.74rem'}} onClick={()=>{setStep(0); setPicks({}); setDone(false);}}>↻ Retake</button>
          <button className="m4-algo-tab" style={{padding:'4px 14px',fontSize:'0.74rem'}} onClick={onDone}>← Back to map</button>
        </div>
      </div>
    );
  }

  return (
    <div className="m4-card" style={{borderLeft:`3px solid ${group.color}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.7rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <div className="m4-card-h" style={{marginBottom:0}}>{group.icon} {group.name} — Boss Quiz</div>
        <span style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text-2)'}}>Q{step+1} / {order.length}</span>
      </div>
      <div style={{padding:'0.7rem 0.9rem',background:'rgba(15,23,42,0.4)',border:'1px solid rgba(148,163,184,0.18)',borderRadius:8,marginBottom:'0.55rem'}}>
        <div style={{fontSize:'0.88rem',color:'var(--text-1)',marginBottom:'0.55rem',lineHeight:1.55}}>{renderVecText(cur.q, `curq${step}`)}</div>
        {cur.opts.map((o, i) => {
          const selected = picks[step] === i;
          return (
            <button key={i} onClick={()=>pick(i)} style={{
              display:'block',width:'100%',textAlign:'left',padding:'0.4rem 0.7rem',marginBottom:3,
              background:selected?`${group.color}22`:'rgba(15,23,42,0.3)',
              border:`1px solid ${selected?group.color:'rgba(148,163,184,0.2)'}`,
              color:selected?group.color:'var(--text-1)',borderRadius:6,cursor:'pointer',fontSize:'0.78rem',fontFamily:'inherit'}}>
              <span style={{fontFamily:'monospace',marginRight:8,color:'var(--text-2)'}}>{String.fromCharCode(65+i)}.</span>{renderVecText(o, `opt${step}-${i}`)}
            </button>
          );
        })}
      </div>
      <div style={{display:'flex',gap:'0.4rem'}}>
        <button className="m4-algo-tab" style={{padding:'3px 14px',fontSize:'0.74rem'}} disabled={step===0} onClick={()=>setStep(s=>s-1)}>← Prev</button>
        {step < order.length-1 && (
          <button className="m4-algo-tab" style={{padding:'3px 14px',fontSize:'0.74rem'}} disabled={picks[step]===undefined} onClick={()=>setStep(s=>s+1)}>Next →</button>
        )}
        {step === order.length-1 && (
          <button className="m4-algo-tab" style={{padding:'3px 14px',fontSize:'0.74rem',background:'rgba(52,211,153,0.15)',borderColor:'#34d399',color:'#34d399'}} disabled={picks[step]===undefined} onClick={finish}>✓ Submit</button>
        )}
        <button className="m4-algo-tab" style={{padding:'3px 14px',fontSize:'0.74rem',marginLeft:'auto'}} onClick={onDone}>✕ Exit</button>
      </div>
    </div>
  );
}

// === Compare panel (μ,λ vs μ+λ etc.) ==========================================
const COMPARE_PAIRS = [
  {
    id:'cmp-mu',
    title:'(μ, λ)  vs  (μ + λ)',
    color:'#34d399',
    rows:[
      ['Parents survive into next gen?', 'No — children only', 'Yes — they compete with children'],
      ['Diff. on which algo line?',     'P ← {}',                'P ← Q'],
      ['Exploitation tendency',          'Moderate',                  'Higher'],
      ['Premature convergence risk',     'Lower',                     'Higher'],
      ['Best monotonically improves?',   'Not guaranteed',            'Yes'],
    ],
  },
  {
    id:'cmp-crossover',
    title:'One-Point  vs  Two-Point  vs  Uniform Crossover',
    color:'#fb7185',
    rows:[
      ['Cuts',                            '1 random point c',                       '2 random points c, d',                'None — per-index swap'],
      ['P(v₁ and v_l separated)',     '(l−1)/l',                          '2/l',                                  '2p(1−p)'],
      ['P(vᵢ and vᵢ₊₁)',     '1/l',                                    '2/l',                                  '2p(1−p)'],
      ['Best mental model',               'Cut a string',                          'Cut a ring',                          'Coin flip per gene'],
      ['Disrupts building blocks?',       'Moderately',                            'Less',                                'Strongly (if p large)'],
    ],
  },
  {
    id:'cmp-selection',
    title:'Roulette  vs  SUS  vs  Tournament',
    color:'#a78bfa',
    rows:[
      ['Needs absolute fitness?',         'Yes',                                   'Yes',                                 'No — rank only'],
      ['Variance',                        'High',                                  'Low (regular intervals)',             'Tuneable via t'],
      ['Complexity',                      'O(log l) with BS, else O(l)',          'O(n)',                                'O(t)'],
      ['Tuning knob',                     '—',                                'n (number drawn)',                    't (tournament size)'],
      ['Trivially parallel?',             'No',                                    'Hard',                                'Yes'],
    ],
  },
  {
    id:'cmp-stochastic',
    title:'SA  vs  Tabu  vs  ILS',
    color:'#fbbf24',
    rows:[
      ['Escape strategy',                 'Probabilistic accept of worse',         'Forbid recent solutions',             'Perturb home base and re-climb'],
      ['Memory of past?',                 'None (only current S, Best)',           'FIFO list L',                         'Single home base H'],
      ['Hyper-parameters',                't, cooling schedule',                   'l (list size), n (tweak samples)',    'NewHomeBase, Perturb'],
      ['Discrete vs continuous',          'Both (with care)',                      'Discrete (workarounds for cont.)',    'Both'],
      ['Greedy at t=0?',                  'Yes — collapses to HC',            'Still avoids tabu',                   'Inner loop is HC'],
    ],
  },
  {
    id:'cmp-pso-de',
    title:'PSO  vs  Differential Evolution',
    color:'#06b6d4',
    rows:[
      ['Has velocity?',                   'Yes',                                   'No — vector arithmetic on candidates'],
      ['Mutation operator',               'αv + b(x*−x) + c(x⁺−x) + d(x!−x)', 'child = A + F·(B − C)'],
      ['Step size scales with…',     'ε (fixed)',                        'Spread of B, C (adaptive)'],
      ['Children vs parents',             'Replaces particle',                     'Compete directly with parent'],
      ['Best mental model',               'Flock of seagulls',                     'Nelder-Mead reflection'],
    ],
  },
];

function ComparePanel({ pair, onBack }) {
  const cols = pair.rows[0].length - 1;
  const headers = pair.title.split('  vs  ');
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.7rem'}}>
        <button className="m4-algo-tab" style={{padding:'3px 11px',fontSize:'0.72rem'}} onClick={onBack}>← Map</button>
        <span style={{padding:'2px 9px',background:`${pair.color}22`,border:`1px solid ${pair.color}55`,borderRadius:6,color:pair.color,fontSize:'0.65rem',fontFamily:'monospace',letterSpacing:'0.05em',fontWeight:700}}>COMPARE</span>
      </div>
      <div style={{background:`linear-gradient(135deg,${pair.color}10 0%,rgba(15,23,42,0.4) 100%)`,border:`1px solid ${pair.color}44`,borderRadius:12,padding:'0.85rem 1rem',marginBottom:'0.7rem'}}>
        <h3 style={{margin:0,color:pair.color,fontSize:'1.15rem'}}>{pair.title}</h3>
        <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginTop:'0.25rem'}}>Side-by-side — the differences are where the exam questions live.</div>
      </div>
      <table className="m4-ptable" style={{fontSize:'0.78rem'}}>
        <thead>
          <tr>
            <th style={{width:'25%'}}>Aspect</th>
            {headers.map((h,i) => <th key={h} style={{color:pair.color}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {pair.rows.map((r,i) => (
            <tr key={i}>
              <td className="pk">{r[0]}</td>
              {Array.from({length:cols}).map((_,j) => <td key={j}>{r[j+1]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Random Strike — picks a random algo + random mode ========================
function RandomStrike({ progress, setProgress, onSelect }) {
  const draw = () => {
    const algo = ATLAS_ALGOS[Math.floor(Math.random() * ATLAS_ALGOS.length)];
    const modes = ['blanks','order','recall'];
    const mode = modes[Math.floor(Math.random()*modes.length)];
    onSelect(algo, mode);
  };
  return (
    <button onClick={draw} style={{
      background:'linear-gradient(135deg,rgba(251,113,133,0.16),rgba(167,139,250,0.16))',
      border:'1px solid rgba(251,113,133,0.4)',color:'#fb7185',borderRadius:8,
      padding:'0.55rem 1rem',cursor:'pointer',fontFamily:'monospace',fontWeight:700,fontSize:'0.78rem',
      width:'100%',letterSpacing:'0.05em'}}>
      ⚡ RANDOM STRIKE — surprise me
    </button>
  );
}

// === Atlas Map ================================================================
function AtlasMap({ progress, onPickAlgo, onPickQuiz, onPickCompare }) {
  const algoMastery = (algo) => {
    const m = progress.mastery[algo.id] || {};
    let s = 0;
    if (m.study) s++;
    if (m.blanks) s++;
    if (m.order) s++;
    if (m.recall) s++;
    return s; // out of 4
  };
  const groupMastery = (gid) => {
    const algs = ATLAS_ALGOS.filter(a => a.group === gid);
    let sum = 0;
    algs.forEach(a => { sum += algoMastery(a); });
    const total = algs.length * 4;
    const quiz = progress.quizzes[gid];
    const quizPart = quiz ? Math.min(1, quiz.best / quiz.total) : 0;
    return { sum, total, quizPart, quizBest: quiz?.best, quizTotal: quiz?.total };
  };

  const totalAlgos = ATLAS_ALGOS.length;
  const studied = ATLAS_ALGOS.filter(a => algoMastery(a) > 0).length;
  const mastered = ATLAS_ALGOS.filter(a => algoMastery(a) === 4).length;
  const totalBosses = ATLAS_GROUPS.length;
  const bossesBeaten = ATLAS_GROUPS.filter(g => {
    const q = progress.quizzes[g.id];
    return q && q.best/q.total >= 0.8;
  }).length;

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(251,113,133,0.08))',border:'1px solid rgba(34,211,238,0.25)',borderRadius:12,padding:'0.85rem 1rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.7rem'}}>
          <div>
            <div style={{fontSize:'0.65rem',color:'var(--text-2)',letterSpacing:'0.05em',marginBottom:3}}>YOUR PROGRESS</div>
            <div style={{fontSize:'0.85rem',color:'var(--text-1)'}}>
              <span style={{color:'#22d3ee',fontFamily:'monospace',fontWeight:700,fontSize:'1.1rem'}}>{studied}/{totalAlgos}</span> opened &nbsp;·&nbsp;
              <span style={{color:'#34d399',fontFamily:'monospace',fontWeight:700,fontSize:'1.1rem'}}>{mastered}/{totalAlgos}</span> mastered &nbsp;·&nbsp;
              <span style={{color:'#fbbf24',fontFamily:'monospace',fontWeight:700,fontSize:'1.1rem'}}>{bossesBeaten}/{totalBosses}</span> bosses beaten
            </div>
          </div>
          <div style={{minWidth:220}}>
            <RandomStrike progress={progress} setProgress={()=>{}} onSelect={onPickAlgo} />
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(380px,1fr))',gap:'0.85rem',marginBottom:'1rem'}}>
        {ATLAS_GROUPS.map((g, gi) => {
          const algs = ATLAS_ALGOS.filter(a => a.group === g.id);
          const stats = groupMastery(g.id);
          const pct = Math.round((stats.sum / stats.total) * 100);
          const bossUnlocked = stats.sum >= Math.floor(stats.total * 0.5);
          return (
            <div key={g.id} style={{position:'relative',background:`linear-gradient(135deg,${g.color}08,rgba(15,23,42,0.4))`,border:`1px solid ${g.color}55`,borderRadius:12,padding:'0.85rem 1rem'}}>
              <div style={{position:'absolute',top:8,right:10,fontSize:'0.6rem',color:g.color,fontFamily:'monospace',letterSpacing:'0.05em',opacity:0.6}}>STAGE {gi+1}</div>
              <div style={{display:'flex',alignItems:'center',gap:'0.55rem',marginBottom:'0.35rem'}}>
                <span style={{fontSize:'1.5rem',color:g.color,fontWeight:700,fontFamily:'monospace',width:28,textAlign:'center'}}>{g.icon}</span>
                <div>
                  <h3 style={{margin:0,color:g.color,fontSize:'1.05rem'}}>{g.name}</h3>
                  <div style={{fontSize:'0.65rem',color:'var(--text-2)',fontFamily:'monospace'}}>{g.lecture}</div>
                </div>
              </div>
              <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginBottom:'0.55rem',lineHeight:1.5}}>{g.subtitle}</div>

              {/* progress bar */}
              <div style={{height:6,background:'rgba(15,23,42,0.6)',borderRadius:4,overflow:'hidden',marginBottom:'0.5rem'}}>
                <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg, ${g.color}, ${g.color}99)`,transition:'width 0.3s'}}/>
              </div>
              <div style={{fontSize:'0.65rem',color:'var(--text-2)',fontFamily:'monospace',marginBottom:'0.6rem',display:'flex',justifyContent:'space-between'}}>
                <span>mastery {stats.sum}/{stats.total} ({pct}%)</span>
                {stats.quizBest != null && <span style={{color:g.color}}>boss best: {stats.quizBest}/{stats.quizTotal}</span>}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                {algs.map(a => {
                  const m = algoMastery(a);
                  return (
                    <button key={a.id} onClick={()=>onPickAlgo(a)} style={{
                      display:'flex',justifyContent:'space-between',alignItems:'center',
                      background:m>0?'rgba(15,23,42,0.55)':'rgba(15,23,42,0.3)',
                      border:`1px solid ${m===4?'#34d399':m>0?g.color+'44':'rgba(148,163,184,0.15)'}`,
                      color:'var(--text-1)',borderRadius:6,padding:'4px 9px',cursor:'pointer',fontSize:'0.74rem',textAlign:'left',fontFamily:'inherit'}}>
                      <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</span>
                      <span style={{fontFamily:'monospace',fontSize:'0.62rem',color:m===4?'#34d399':m>0?'#fbbf24':'var(--text-2)',marginLeft:6}}>
                        {'★'.repeat(m)}{'☆'.repeat(4-m)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button onClick={()=>onPickQuiz(g.id)} disabled={!bossUnlocked} style={{
                marginTop:'0.7rem',width:'100%',
                background:bossUnlocked?`${g.color}1f`:'rgba(15,23,42,0.4)',
                border:`1px solid ${bossUnlocked?g.color:'rgba(148,163,184,0.2)'}`,
                color:bossUnlocked?g.color:'var(--text-2)',
                borderRadius:6,padding:'0.45rem',cursor:bossUnlocked?'pointer':'not-allowed',fontSize:'0.74rem',fontWeight:700,fontFamily:'monospace',letterSpacing:'0.05em'}}>
                {bossUnlocked ? `♔ BOSS QUIZ — ${(ATLAS_QUIZZES[g.id]||[]).length} questions` : `⛔ Locked — study 50% of algorithms to unlock`}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{background:'linear-gradient(135deg,rgba(167,139,250,0.08),rgba(34,211,238,0.08))',border:'1px solid rgba(167,139,250,0.25)',borderRadius:12,padding:'0.85rem 1rem',marginBottom:'1rem'}}>
        <div style={{fontSize:'0.65rem',color:'var(--text-2)',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>COMPARE-AND-CONTRAST CARDS</div>
        <div style={{fontSize:'0.74rem',color:'var(--text-2)',marginBottom:'0.6rem',lineHeight:1.55}}>
          The exam loves comparison questions. Click a card to see two-or-three algorithms placed side-by-side on the dimensions that matter.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.5rem'}}>
          {COMPARE_PAIRS.map(p => (
            <button key={p.id} onClick={()=>onPickCompare(p.id)} style={{
              background:`${p.color}11`,border:`1px solid ${p.color}55`,
              color:p.color,borderRadius:8,padding:'0.55rem 0.7rem',cursor:'pointer',fontSize:'0.78rem',fontWeight:600,textAlign:'left',fontFamily:'inherit'}}>
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <div className="m4-warnbox" style={{fontSize:'0.74rem'}}>
        <strong>How to use this atlas for maximum recall:</strong> first <em>Study</em> an algorithm, then <em>Blanks</em>, then <em>Order</em> (this is where the structure sticks), then <em>Recall</em> (rate yourself honestly — Hard items resurface). Beat the boss quiz at 80%+ to mark the stage clear. Re-visit anything you rated <em>Hard</em> in the days before the exam.
      </div>
    </div>
  );
}

// === Top-level tab ============================================================
function AlgorithmAtlasTab() {
  const [progress, setProgress] = useState(() => loadAtlasProgress());
  const [view, setView] = useState({ kind:'map' });

  const pickAlgo = (algo, _mode) => setView({ kind:'algo', algo });
  const pickQuiz = (gid) => setView({ kind:'quiz', groupId:gid });
  const pickCompare = (pid) => setView({ kind:'compare', pairId:pid });
  const backToMap = () => setView({ kind:'map' });

  const reset = () => {
    if (window.confirm('Reset all Algorithm Atlas progress? This cannot be undone.')) {
      const fresh = { mastery:{}, quizzes:{}, streak:0, lastDate:null };
      setProgress(fresh); saveAtlasProgress(fresh);
    }
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
        <div style={{fontSize:'0.73rem',color:'var(--text-2)',lineHeight:1.6,flex:'1 1 320px'}}>
          A self-paced memorisation journey across every algorithm in the unit — written EXACTLY as in the lectures. Pseudocode is preserved verbatim; explanations are mine.
        </div>
        <button onClick={reset} style={{background:'rgba(251,113,133,0.1)',border:'1px solid rgba(251,113,133,0.3)',color:'#fb7185',borderRadius:6,padding:'4px 11px',cursor:'pointer',fontSize:'0.7rem',fontFamily:'monospace'}}>↻ Reset progress</button>
      </div>

      {view.kind === 'map' && <AtlasMap progress={progress} onPickAlgo={pickAlgo} onPickQuiz={pickQuiz} onPickCompare={pickCompare} />}
      {view.kind === 'algo' && <AlgorithmCard algo={view.algo} progress={progress} setProgress={setProgress} onBack={backToMap} />}
      {view.kind === 'quiz' && <BossQuiz groupId={view.groupId} progress={progress} setProgress={setProgress} onDone={backToMap} />}
      {view.kind === 'compare' && <ComparePanel pair={COMPARE_PAIRS.find(p=>p.id===view.pairId)} onBack={backToMap} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MEMORY COSMOS — Brainstorm of Must-Memorise Facts ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Designed for retention. Three views:
//   1. Cosmos     — constellation map (spatial memory + dual coding)
//   2. Lightning  — rapid-fire flashcards (active recall + spaced repetition)
//   3. Mnemonics  — memorable phrases (chunking + storytelling)

const COSMOS_CSS = `
@keyframes mc-twinkle { 0%,100%{opacity:0.35} 50%{opacity:1} }
@keyframes mc-pulse   { 0%,100%{filter:drop-shadow(0 0 4px var(--cw))} 50%{filter:drop-shadow(0 0 14px var(--cw))} }
@keyframes mc-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes mc-float   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
@keyframes mc-shimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes mc-fadein  { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
.mc-bg {
  position:relative;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(167,139,250,0.18) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 70%, rgba(251,113,133,0.15) 0%, transparent 45%),
    radial-gradient(ellipse at 50% 100%, rgba(34,211,238,0.18) 0%, transparent 50%),
    linear-gradient(180deg, #050818 0%, #0a0e27 50%, #1a0535 100%);
  border-radius: 16px;
  overflow:hidden;
  border: 1px solid rgba(167,139,250,0.25);
}
.mc-star-dot {
  cursor: pointer;
  transition: transform 0.18s ease-out;
  transform-origin: 0 0;
  transform-box: view-box;
}
.mc-star-dot:hover { transform: scale(1.45); }
.mc-twinkle { animation: mc-twinkle 3.2s ease-in-out infinite; }
.mc-pulse   { animation: mc-pulse 2.4s ease-in-out infinite; }
.mc-float   { animation: mc-float 4s ease-in-out infinite; }
.mc-fadein  { animation: mc-fadein 0.28s ease-out; }
.mc-shimmer-text {
  background: linear-gradient(90deg, #22d3ee, #a78bfa, #fb7185, #fbbf24, #22d3ee);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: mc-shimmer 6s linear infinite;
  font-weight: 800;
}
.mc-card-glow {
  box-shadow: 0 0 0 1px var(--cw), 0 0 24px -2px var(--cw), inset 0 0 40px -10px var(--cw);
}
.mc-modal-bg {
  background: radial-gradient(ellipse at center, rgba(15,23,42,0.94) 0%, rgba(5,8,24,0.98) 100%);
  backdrop-filter: blur(8px);
}
.mc-flip {
  perspective: 1200px;
}
.mc-flip-inner {
  position: relative;
  transition: transform 0.5s;
  transform-style: preserve-3d;
}
.mc-flip-inner.mc-flipped { transform: rotateY(180deg); }
.mc-flip-front, .mc-flip-back {
  position:absolute; inset:0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.mc-flip-back { transform: rotateY(180deg); }
`;

function useCosmosStyles() {
  useEffect(() => {
    if (document.getElementById('mc-cosmos-style')) return;
    const tag = document.createElement('style');
    tag.id = 'mc-cosmos-style';
    tag.textContent = COSMOS_CSS;
    document.head.appendChild(tag);
  }, []);
}

// Stars per constellation. (cx, cy) are normalised positions on a 1000×600 SVG canvas.
const COSMOS_DATA = [
  {
    id:'origins', name:'THE ORIGINS', lecture:'L1–2', color:'#22d3ee', icon:'⊙',
    cx:120, cy:90, vibe:'Foundations of intelligence',
    stars:[
      {x:0,y:0,label:'4 Quadrants',
        mnemonic:'THINK vs ACT × HUMAN vs RATIONAL — Russell & Norvig’s map.',
        facts:[
          'Two axes: Thinking ↔ Acting and Humanly ↔ Rationally',
          '4 quadrants: thinking-humanly, thinking-rationally, acting-humanly, acting-rationally',
          'Acting-humanly = Turing-test style operational definition',
          'Acting-rationally = Nilsson — intelligent behaviour in artefacts',
        ],
        q:'The "4 Quadrants" of AI are defined by which two axes?',
        opts:['Symbolic ↔ Connectionist  ·  Soft ↔ Hard','Thinking ↔ Acting  ·  Humanly ↔ Rationally','Deterministic ↔ Stochastic  ·  Online ↔ Offline','Discrete ↔ Continuous  ·  Greedy ↔ Optimal'],
        ans:1},
      {x:60,y:-32,label:'Turing Test',
        mnemonic:'INDISTINGUISHABLE = INTELLIGENT (operational, not philosophical).',
        facts:[
          '1950 — Alan Turing’s "Imitation Game"',
          'Operational test: an interrogator chats with both human and machine',
          'Passes if interrogator cannot reliably tell which is which',
          'Side-steps "what IS intelligence?" by testing what it DOES',
        ],
        q:'What does the Turing Test deliberately avoid?',
        opts:['Defining intelligence philosophically','Using language as a medium','Asking trick questions','Comparing to humans'],
        ans:0},
      {x:110,y:18,label:'AI Winter',
        mnemonic:'1969 — Minsky & Papert showed perceptrons cannot XOR → funding froze.',
        facts:[
          'Triggered by Minsky & Papert’s 1969 book *Perceptrons*',
          'Showed a single perceptron cannot represent XOR',
          'Funding bodies pulled back from neural-net research',
          'Revived 1986 with back-propagation (Rumelhart, Hinton, Williams)',
        ],
        q:'Which classic limitation triggered the first AI Winter?',
        opts:['Halting problem','Single perceptrons cannot represent XOR','Lack of FLOPS','Bayesian intractability'],
        ans:1},
      {x:50,y:60,label:'Real World = Messy',
        mnemonic:'BLACK BOX — noisy, dirty, multi-objective, partial info.',
        facts:[
          'Search spaces: huge, non-smooth, deceptive',
          'Objectives often conflict — multi-criteria',
          'Information is partial, noisy, dynamic',
          'Motivates heuristic / metaheuristic methods',
        ],
        q:'Why prefer heuristics over closed-form optima in the "real world"?',
        opts:['Heuristics are always faster','Real-world problems are large, non-smooth, partial-info — exact methods can’t cope','Heuristics give global optimum guarantees','Heuristics need no compute'],
        ans:1},
    ],
    edges:[[0,1],[0,3],[1,2],[2,3]],
  },
  {
    id:'triad', name:'THE TRIAD', lecture:'L3', color:'#a78bfa', icon:'△',
    cx:300, cy:80, vibe:'Three ingredients of every optimisation',
    stars:[
      {x:0,y:0,label:'Language',
        mnemonic:'IF YOU CAN’T DESCRIBE IT, YOU CAN’T MODEL IT.',
        facts:[
          'Representation = the descriptive vocabulary',
          'Defines the hypothesis space H',
          'Examples: equations, grammars, programs, Gantt charts, trees, bit-vectors',
          'Wrong language → no good solution exists → can never be found',
        ],
        q:'In the optimisation triad, "Language" specifies:',
        opts:['The stopping criterion','The candidate solution','The hypothesis space H','The error metric'],
        ans:2},
      {x:60,y:-30,label:'Model',
        mnemonic:'AN INSTANTIATION — one specific candidate, drawn from H.',
        facts:[
          'A model = one element of H',
          'Also called a "candidate solution" or "hypothesis"',
          'Instantiation step: pick parameter values',
          'Optimisation = search over models',
        ],
        q:'A "Model" in the L3 triad is best described as:',
        opts:['The set of all possible solutions','One specific candidate solution drawn from H','The cost function','The dataset'],
        ans:1},
      {x:30,y:50,label:'Metric',
        mnemonic:'f : H → ℝ  —  argmin or argmax this.',
        facts:[
          'Maps each h ∈ H to a real number',
          'Also called: error / cost / loss / fitness / objective',
          'Optimisation = argmin f(h) or argmax f(h)',
          'MSE example: (1/n) Σ (yᵢ − ŷᵢ)²',
        ],
        q:'The optimisation metric f : H → ℝ measures:',
        opts:['Size of the hypothesis space','Distance between models','Quality of a candidate hypothesis','Compute cost'],
        ans:2},
      {x:90,y:30,label:'argmin / argmax',
        mnemonic:'argmin = the WHO, not the WHAT.',
        facts:[
          'argmin returns the h, not f(h)',
          'Distinguishes "best value" from "best candidate"',
          'Min vs max chosen by problem framing',
          'Many algorithms only need rank order — non-parametric',
        ],
        q:'What does argmin_h f(h) return?',
        opts:['The smallest f value','The candidate h achieving that f value','The mean of all f values','The gradient of f'],
        ans:1},
    ],
    edges:[[0,1],[1,2],[2,3],[3,0],[0,2]],
  },
  {
    id:'factory', name:'THE FACTORY', lecture:'L4', color:'#fb7185', icon:'⚙',
    cx:480, cy:90, vibe:'Job Shop Scheduling — classic combinatorial',
    stars:[
      {x:0,y:0,label:'JSSP Setup',
        mnemonic:'n JOBS × m MACHINES — each op fixed on a machine, fixed time.',
        facts:[
          'n jobs, m machines',
          'Each job = ordered sequence of operations',
          'Operations have a fixed machine + duration',
          'Each machine handles ≤1 op at a time',
        ],
        q:'In the JSSP, the precedence constraints apply:',
        opts:['Between different jobs','Between operations within the same job','Between machines','Between time slots'],
        ans:1},
      {x:60,y:-40,label:'(n!)ᵐ space',
        mnemonic:'EACH OF m MACHINES INDEPENDENTLY ORDERS n JOBS.',
        facts:[
          'Solution space size |H| ≤ (n!)ᵐ',
          'For n=4, m=3 → (4!)³ = 13,824',
          'Astronomical even at modest sizes → NP-hard',
          'Motivates heuristic search',
        ],
        q:'For n=4 jobs and m=3 machines, the solution-space size is:',
        opts:['64','1,728','13,824','24'],
        ans:2},
      {x:50,y:60,label:'Makespan Cₘₐₓ',
        mnemonic:'TIME TO FINISH THE LAST JOB.',
        facts:[
          'Cₘₐₓ = max_i Cᵢ (latest completion)',
          'Most common JSSP objective',
          'Length of the longest Gantt bar',
          'Minimise it = pack the schedule tighter',
        ],
        q:'The makespan Cₘₐₓ is:',
        opts:['Average job completion time','The time of the latest job completion','Total processing time summed','Number of operations'],
        ans:1},
      {x:110,y:25,label:'Dispatching Rules',
        mnemonic:'SPT / LPT / FCFS / EDD — cheap & cheerful priority rules.',
        facts:[
          'SPT = shortest processing time first',
          'LPT = longest processing time first',
          'FCFS = first come first served',
          'EDD = earliest due date first',
        ],
        q:'SPT dispatching prioritises the operation with:',
        opts:['Earliest due date','Shortest processing time','Most remaining work','Largest job index'],
        ans:1},
      {x:-20,y:55,label:'N1 Neighborhood',
        mnemonic:'SWAP ADJACENT OPS ON THE SAME MACHINE.',
        facts:[
          'Used in local search over schedules',
          'Swap two adjacent operations on one machine',
          'Most basic JSSP neighbourhood',
          'Combine with simulated annealing or tabu',
        ],
        q:'N1 neighbourhood for JSSP local search is:',
        opts:['Swap operations between machines','Swap two adjacent ops on the same machine','Reverse an entire job','Insert a new dummy op'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[0,3],[3,4],[1,2]],
  },
  {
    id:'slopes', name:'SLOPES & CURVES', lecture:'L5', color:'#34d399', icon:'∂',
    cx:680, cy:95, vibe:'The calculus refresh',
    stars:[
      {x:0,y:0,label:'Derivative Limit',
        mnemonic:'RISE OVER RUN AS RUN → 0.',
        facts:[
          'f′(x) = lim_{h→0} (f(x+h) − f(x)) / h',
          'Slope of tangent line at x',
          'Exists ⇒ function is differentiable there',
        ],
        q:'The derivative f′(x) is defined as the limit of:',
        opts:['(f(x+h)−f(x)) / h as h→0','(f(x)−f(x−h)) · h as h→∞','f(x)/x as x→0','f(x+h)·f(x) as h→0'],
        ans:0},
      {x:55,y:-35,label:'Chain Rule',
        mnemonic:'OUTSIDE × INSIDE — peel the onion.',
        facts:[
          '(f∘g)′(x) = f′(g(x)) · g′(x)',
          'The backbone of back-propagation',
          'Combines with product/quotient rules',
        ],
        q:'Chain rule: d/dx[f(g(x))] equals:',
        opts:["f′(g(x)) · g′(x)","f′(x) · g′(x)","f(g(x)) · g′(x)","f′(g(x)) · g(x)"],
        ans:0},
      {x:80,y:35,label:'Gradient ∇f',
        mnemonic:'VECTOR OF PARTIALS — direction of STEEPEST ASCENT.',
        facts:[
          '∇f = [∂f/∂x₁, …, ∂f/∂xₙ]ᵀ',
          'Always points uphill',
          'Move along −∇f for descent',
        ],
        q:'∇f(𝐱) for a scalar function f : ℝⁿ → ℝ is:',
        opts:['A scalar','A matrix of second derivatives','A vector of partial derivatives','Always zero'],
        ans:2},
      {x:25,y:55,label:'2nd-Deriv Test',
        mnemonic:'f″ > 0 = SMILE (min) · f″ < 0 = FROWN (max).',
        facts:[
          'At critical point (f′ = 0)',
          'f″ > 0 → local minimum (concave up)',
          'f″ < 0 → local maximum (concave down)',
          'f″ = 0 → inconclusive',
        ],
        q:'If f′(x*) = 0 and f″(x*) > 0, then x* is:',
        opts:['Saddle point','Local maximum','Local minimum','Boundary point'],
        ans:2},
      {x:-30,y:35,label:'Smoothness C^k',
        mnemonic:'C⁰ continuous · C¹ has f′ · C² has f″ · C^∞ smooth forever.',
        facts:[
          'C⁰ — continuous',
          'C¹ — continuously differentiable',
          'C² — twice differentiable (N-R needs this)',
          'C^∞ — infinitely differentiable',
        ],
        q:'Newton-Raphson requires which smoothness class?',
        opts:['C⁰','C¹','C²','C^∞'],
        ans:2},
    ],
    edges:[[0,1],[1,2],[2,3],[3,4],[4,0]],
  },
  {
    id:'descent', name:'THE DESCENT', lecture:'L6', color:'#fbbf24', icon:'↘',
    cx:870, cy:90, vibe:'Gradient methods — follow the slope',
    stars:[
      {x:0,y:0,label:'GD Update',
        mnemonic:'x ← x − α · f′(x). MINUS FOR DOWN.',
        facts:[
          '1-D descent: x ← x − α f′(x)',
          '1-D ascent: x ← x + α f′(x)',
          'N-D: 𝐱 ← 𝐱 − α ∇f',
          'Naturally slows near a minimum',
        ],
        q:'1-D gradient descent update is:',
        opts:['x ← x + α f′(x)','x ← x − α f′(x)','x ← x − f(x) / f′(x)','x ← x − f′(x) / f″(x)'],
        ans:1},
      {x:65,y:-30,label:'Learning Rate α',
        mnemonic:'TOO SMALL = CRAWL · TOO LARGE = OSCILLATE.',
        facts:[
          'Scales step size',
          'Small α → slow but stable',
          'Large α → overshoot, oscillation, divergence',
          'Adaptive schemes (Adam) tune α per parameter',
        ],
        q:'A learning rate α that is too large will typically:',
        opts:['Converge faster always','Cause overshoot and oscillation','Get stuck in a saddle point','Never affect convergence'],
        ans:1},
      {x:80,y:35,label:'Newton-Raphson',
        mnemonic:'f′ OVER f″ — curvature picks the step.',
        facts:[
          'For optima: x ← x − f′(x) / f″(x)',
          'Solves quadratic ax²+b in ONE step',
          'Requires C² (twice differentiable)',
          'Best step size — auto-tuned by curvature',
        ],
        q:'Newton-Raphson’s key advantage over plain gradient descent:',
        opts:['Always finds global optimum','Uses curvature to auto-scale the step','Needs no derivatives','Adds randomness'],
        ans:1},
      {x:-25,y:55,label:'Local Optima',
        mnemonic:'GRADIENT METHODS = MYOPIC. They stop at the nearest valley.',
        facts:[
          'Gradient methods are local',
          'Multimodal surfaces → get stuck',
          'Mitigation: random restarts',
          '"No general algorithm finds the global optimum on non-enumerable spaces"',
        ],
        q:'Plain gradient descent is guaranteed to find:',
        opts:['Global minimum','A local minimum (under smoothness)','The saddle nearest to start','Nothing'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[0,3],[1,2]],
  },
  {
    id:'sea', name:'SAMPLE SEA', lecture:'L7', color:'#14b8a6', icon:'◇',
    cx:130, cy:240, vibe:'Direct methods — no derivatives needed',
    stars:[
      {x:0,y:0,label:'No-Derivative Need',
        mnemonic:'BLACK BOX OK — just need to evaluate f.',
        facts:[
          'Only the objective function is needed',
          'Each evaluation = info gained',
          'Useful when f is non-differentiable or unknown',
        ],
        q:'Direct methods differ from gradient methods because:',
        opts:['They use second derivatives','They need no derivative, only evaluations','They never converge','They use crossover'],
        ans:1},
      {x:55,y:-30,label:'CCS',
        mnemonic:'TAXICAB — line-search one coord at a time.',
        facts:[
          'Cyclic Coordinate Search',
          'Line search along each basis direction in turn',
          'Stops when full cycle gives norm-change < ε',
          'Acceleration variant adds an extra step in net direction',
        ],
        q:'Cyclic Coordinate Search optimises:',
        opts:['All coordinates simultaneously','One coordinate at a time','Random directions','Gradient directions'],
        ans:1},
      {x:30,y:50,label:'Hooke-Jeeves',
        mnemonic:'PROBE ±α IN EACH DIM — shrink α on no-improve.',
        facts:[
          'Samples f at x ± α·eᵢ — 2n evaluations',
          'Move to best improving direction',
          'Shrink α by γ (often 0.5) on stall',
          'A pattern search — like sliding an n-cube',
        ],
        q:'Hooke-Jeeves does HOW many evaluations per step in n-D?',
        opts:['n','n+1','2n','2ⁿ'],
        ans:2},
      {x:80,y:35,label:'Nelder-Mead',
        mnemonic:'SIMPLEX = TRIANGLE-LIKE BLOB. Reflect / Expand / Contract / Shrink.',
        facts:[
          'Maintains n+1 vertex simplex',
          'Operations: reflection (α), expansion (β), contraction (γ), shrinkage (σ)',
          'Defaults α=1, β=2, γ=0.5, σ=0.5',
          'Adapts shape and shrinks toward optimum',
        ],
        q:'Nelder-Mead’s simplex in n dimensions has how many vertices?',
        opts:['n','n+1','2n','2ⁿ'],
        ans:1},
      {x:-30,y:40,label:'Powell',
        mnemonic:'QUEUE OF DIRECTIONS — replace the oldest each cycle.',
        facts:[
          'Adapts the search directions',
          'Queue starts as basis vectors',
          'After cycle: enqueue (x′−x), dequeue oldest',
          'Risk: directions can become linearly dependent',
        ],
        q:'Powell’s Method differs from CCS by:',
        opts:['Using gradients','Maintaining an adaptive queue of search directions','Shrinking α each cycle','Sampling random directions'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[0,3],[0,4]],
  },
  {
    id:'chaos', name:'CHAOS SEED', lecture:'L8 + Labs', color:'#6366f1', icon:'※',
    cx:330, cy:230, vibe:'Randomness, PRNGs, online heuristics',
    stars:[
      {x:0,y:0,label:'LCG',
        mnemonic:'LINEAR CONGRUENTIAL — Xₙ₊₁ = (aXₙ + c) mod m.',
        facts:[
          'Xₙ₊₁ = (a·Xₙ + c) mod m',
          'Three params: multiplier a, increment c, modulus m',
          'Deterministic but mimics randomness',
          'Full-period theorem: cycles through all m values under specific conditions',
        ],
        q:'For LCG with X₀=1, a=3, c=1, m=7, X₁ equals:',
        opts:['3','4','7','1'],
        ans:1},
      {x:55,y:-35,label:'Bin Packing',
        mnemonic:'FF · NF · BF · FFD — online vs offline.',
        facts:[
          'FF — first fit (first bin that fits)',
          'NF — next fit (only current bin)',
          'BF — best fit (tightest fit)',
          'FFD — first-fit decreasing (offline; needs sort)',
        ],
        q:'Which bin-packing heuristic is OFFLINE (requires all items in advance)?',
        opts:['FF','NF','BF','FFD'],
        ans:3},
      {x:25,y:55,label:'No Free Lunch',
        mnemonic:'AVERAGED OVER ALL PROBLEMS, NO ALGORITHM WINS.',
        facts:[
          'Wolpert & Macready, 1997',
          'No universal best optimisation algorithm',
          'Gains on one class ⇔ losses on another',
          'Implication: domain knowledge is essential',
        ],
        q:'The No Free Lunch theorem states:',
        opts:['Gradient descent always wins','No algorithm outperforms others averaged across ALL problems','Stochastic always beats deterministic','Randomness is useless'],
        ans:1},
      {x:80,y:30,label:'Mersenne Primes',
        mnemonic:'2^p − 1 PRIMES — make great LCG moduli.',
        facts:[
          'M_p = 2^p − 1',
          'Mersenne Twister uses M19937 = 2^19937 − 1',
          'Long-period generators built on them',
          'Used widely in scientific RNGs',
        ],
        q:'A Mersenne prime has the form:',
        opts:['p² − 1','2^p + 1','2^p − 1','p! + 1'],
        ans:2},
    ],
    edges:[[0,1],[0,3],[0,2],[2,3]],
  },
  {
    id:'wanderers', name:'LONE WANDERERS', lecture:'L9', color:'#f97316', icon:'⚝',
    cx:520, cy:230, vibe:'Single-state stochastic search',
    stars:[
      {x:0,y:0,label:'HC + Restarts',
        mnemonic:'CLIMB → REMEMBER BEST → TELEPORT → REPEAT.',
        facts:[
          'Inner: tweak + accept if Quality(R)>Quality(S)',
          'Outer: time-based random restart',
          'Best tracked across all restarts',
          'Short intervals → exploration; long → exploitation',
        ],
        q:'In HC with restarts, SHORT time intervals favour:',
        opts:['Exploitation','Exploration','Pure greedy','Convergence'],
        ans:1},
      {x:60,y:-30,label:'Simulated Annealing',
        mnemonic:'e^(ΔQ/t) — HOT JUMPS, COOL CLINGS.',
        facts:[
          'Accept worse R with prob e^((Q(R)−Q(S))/t)',
          't=∞: random walk · t=0: pure hill climb',
          'Temperature decreased on a cooling schedule',
          'Works on combinatorial spaces (e.g. TSP)',
        ],
        q:'In Simulated Annealing, P(accept worse R) at high temperature t is:',
        opts:['Near 0','Near 0.5','Near 1','Exactly 0'],
        ans:2},
      {x:80,y:35,label:'Tabu Search',
        mnemonic:'DON’T GO BACK WHERE YOU’VE BEEN. (FIFO list)',
        facts:[
          'Maintain FIFO list L of recent solutions',
          'Reject tweaks that match L (the tabu)',
          'Eventually escapes any local optimum',
          'Discrete spaces; "close enough" needed for continuous',
        ],
        q:'Tabu Search’s memory of recent solutions is implemented as:',
        opts:['A stack (LIFO)','A FIFO queue with max length','A hash set with no bound','A binary tree'],
        ans:1},
      {x:30,y:55,label:'ILS',
        mnemonic:'BETTER OPTIMA LIVE NEAR THIS ONE — perturb home base.',
        facts:[
          'H = current "home base" local optimum',
          'Inner: climb from S',
          'Update H via NewHomeBase(H, S)',
          'Perturb(H) seeds the next climb',
        ],
        q:'ILS assumes which heuristic about the search space?',
        opts:['Restarts should be uniform','Better local optima are near existing ones','All optima are global','Cost surfaces are convex'],
        ans:1},
    ],
    edges:[[0,1],[1,2],[2,3],[3,0]],
  },
  {
    id:'swarm', name:'SWARM GARDEN', lecture:'L10', color:'#84cc16', icon:'μ',
    cx:710, cy:230, vibe:'Population-based evolution strategies',
    stars:[
      {x:0,y:0,label:'(μ, λ) ES',
        mnemonic:'COMMA = CHILDREN ONLY. Parents disappear.',
        facts:[
          'μ parents picked by truncation',
          'λ children produced — λ/μ each',
          'P ← {} → only offspring survive',
          'Lower premature-convergence risk',
        ],
        q:'In (μ, λ), the next generation contains:',
        opts:['μ parents + λ children','λ children only','μ best across both','Random sample of size μ'],
        ans:1},
      {x:55,y:-35,label:'(μ + λ) ES',
        mnemonic:'PLUS = PARENTS PERSIST. P ← Q (keep parents).',
        facts:[
          'Same skeleton as (μ, λ)',
          'KEY change: P ← Q (parents kept) instead of P ← {}',
          'Higher exploitation, higher premature-convergence risk',
          'Akin to GA elitism',
        ],
        q:'(μ + λ) differs from (μ, λ) on exactly which line?',
        opts:['Build initial population','Truncation step','P ← {} vs P ← Q','for λ/μ times'],
        ans:2},
      {x:30,y:55,label:'1/5 Rule',
        mnemonic:'p_s > 1/5 → INCREASE σ². Children winning → JUMP BIGGER.',
        facts:[
          'Rechenberg’s adaptive rule',
          'p_s = fraction of children fitter than parents',
          'p_s > 1/5 → increase σ² (explore more)',
          'p_s < 1/5 → decrease σ² (exploit more)',
        ],
        q:'Rechenberg’s One-Fifth Rule: if p_s > 1/5, you should:',
        opts:['Decrease σ²','Increase σ²','Reset population','Switch to (μ + λ)'],
        ans:1},
      {x:90,y:30,label:'EA Skeleton',
        mnemonic:'ASSESS → SELECT → BREED → JOIN.',
        facts:[
          'BuildInitialPopulation()',
          'AssessFitness(P)',
          'Breed(P) — selection + mutation/crossover',
          'Join(P, Breed(P)) — merge into next gen',
        ],
        q:'The "Join" step in an EA does:',
        opts:['Generates initial population','Evaluates fitness','Combines parents and offspring into next generation','Selects parents'],
        ans:2},
    ],
    edges:[[0,1],[1,3],[0,2],[2,3],[0,3]],
  },
  {
    id:'genome', name:'GENOME LAB', lecture:'L11', color:'#ec4899', icon:'☷',
    cx:130, cy:400, vibe:'Genetic Algorithms — crossover is king',
    stars:[
      {x:0,y:0,label:'GA Loop',
        mnemonic:'SELECT 2 → CROSSOVER → MUTATE → repeat popsize/2 times.',
        facts:[
          'popsize must be even',
          'Each iteration: SelectWithReplacement × 2 → Crossover → Mutate both children',
          'Returns Best individual seen',
          'Differs from (μ,λ): crossover is core',
        ],
        q:'A GA produces HOW many children per crossover call?',
        opts:['1','2','popsize/2','popsize'],
        ans:1},
      {x:60,y:-30,label:'Bit-Flip',
        mnemonic:'p = 1/l → EXPECTED 1 FLIP PER INDIVIDUAL.',
        facts:[
          'For each bit, flip with probability p',
          'Often p = 1/l (length of vector)',
          'Maintains diversity',
          'Can reopen collapsed hypercube dimensions',
        ],
        q:'With bit-flip mutation at p=1/l, expected flips per individual:',
        opts:['0','1','l/2','l'],
        ans:1},
      {x:80,y:35,label:'Crossover Trio',
        mnemonic:'1pt = CUT STRING · 2pt = CUT RING · UNIFORM = COIN FLIP.',
        facts:[
          '1pt: P(separate v₁,v_l) = (l−1)/l',
          '2pt: P(separate any pair) ≈ 2/l (think ring)',
          'Uniform: P = 2p(1−p) for any pair',
          'Linkage = distance between genes',
        ],
        q:'Two-point crossover is best mental-modelled as cutting:',
        opts:['A line at one point','A ring at two points','Random rectangles','A spiral'],
        ans:1},
      {x:25,y:55,label:'Selection Trio',
        mnemonic:'ROULETTE (CDF) · SUS (LOW VAR) · TOURNAMENT (RANK).',
        facts:[
          'Roulette: pick by fitness-proportional CDF',
          'SUS: n equally-spaced pointers — low variance',
          'Tournament: pick t at random, return fittest',
          'Tournament is non-parametric (rank only)',
        ],
        q:'Tournament Selection with t=1 is equivalent to:',
        opts:['Truncation','Random selection','Roulette','Elitism'],
        ans:1},
      {x:-30,y:40,label:'Elitism',
        mnemonic:'CARRY n FITTEST UNCHANGED — best monotonically improves.',
        facts:[
          'n elites copied unchanged',
          'Remaining (popsize−n)/2 pairs bred normally',
          'Pro: best never goes backwards',
          'Con: risk of premature convergence',
        ],
        q:'GA Elitism’s main risk:',
        opts:['Slow improvement','Premature convergence','Loss of best','Memory overhead'],
        ans:1},
      {x:115,y:-15,label:'Hypercube Collapse',
        mnemonic:'IF ALL PARENTS AGREE ON A BIT — crossover can NEVER reopen it.',
        facts:[
          'Binary chromosomes live on hypercube corners',
          'Crossover produces children on the SAME hypercube',
          'Lost diversity at a gene → dimension collapsed',
          'Only mutation can climb back out',
        ],
        q:'When all parents share the same allele at a gene, crossover:',
        opts:['Restores diversity randomly','Can never produce a different value at that gene','Increases mutation rate','Doubles the population'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[0,3],[3,4],[2,5],[0,5]],
  },
  {
    id:'hive', name:'HIVE MIND', lecture:'L12', color:'#0ea5e9', icon:'∞',
    cx:340, cy:400, vibe:'PSO, DE, hybrid/memetic',
    stars:[
      {x:0,y:0,label:'PSO Velocity',
        mnemonic:'α INERTIA + β PERSONAL + γ INFORMANTS + δ GLOBAL — ε scales step.',
        facts:[
          'v ← α·v + b(x*−x) + c(x⁺−x) + d(x!−x)',
          'x*: personal best · x⁺: informants · x!: global',
          'b, c, d ∈ U(0, β/γ/δ)',
          'Then x ← x + ε·v',
        ],
        q:'In PSO, x! denotes:',
        opts:['Personal best','Informants’ best','Global best across the swarm','Velocity'],
        ans:2},
      {x:55,y:-35,label:'DE Mutation',
        mnemonic:'child = A + F·(B − C). Step scales with population spread.',
        facts:[
          'Pick three distinct A, B, C',
          'Adaptive step — large spread → large step',
          'Children compete directly with parents',
          'Reminiscent of Nelder-Mead reflection',
        ],
        q:'Differential Evolution’s child formula:',
        opts:['A · F · B · C','A + F · (B − C)','(A + B + C)/3','F · ∇f(A)'],
        ans:1},
      {x:80,y:30,label:'Memetic / Hybrid',
        mnemonic:'EXPLORE WITH POPULATION · EXPLOIT WITH HILL-CLIMB.',
        facts:[
          'Hybrid = local-search step inside EA loop',
          'Hill-Climb each individual t times',
          'Replace original with locally improved',
          'Lamarck wink — improvement persists in P',
        ],
        q:'A memetic algorithm typically combines:',
        opts:['Two GAs','Local search + population-based search','SA + Tabu','Roulette + SUS'],
        ans:1},
      {x:-30,y:40,label:'Emergent Behaviour',
        mnemonic:'WHOLE > SUM OF PARTS. Collective info > any individual.',
        facts:[
          'Swarm > individual seagull',
          'Diversity carries landscape information',
          'Premature convergence loses this',
          'Foundational EC question of Lecture 10',
        ],
        q:'Emergent behaviour in swarm methods means:',
        opts:['Particles act identically','Group dynamics exhibit useful properties beyond any individual','Particles randomly diverge','No information is shared'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[2,3],[1,2],[0,3]],
  },
  {
    id:'threshold', name:'THE THRESHOLD', lecture:'L13', color:'#a855f7', icon:'σ',
    cx:540, cy:400, vibe:'Perceptron → logistic neuron',
    stars:[
      {x:0,y:0,label:'Sigmoid σ',
        mnemonic:'1 / (1 + e^−z) — squished S, bounded in (0,1).',
        facts:[
          'σ(z) = 1/(1+e^−z)',
          'Monotonic, smooth, bounded (0,1)',
          'Replaces non-differentiable step',
          'Decision boundary at σ(z)=0.5 ⇔ z=0',
        ],
        q:'The logistic sigmoid σ(z) equals:',
        opts:['e^z / e^−z','1 / (1 + e^−z)','tanh(z)','1 − e^−z'],
        ans:1},
      {x:60,y:-30,label:'σ′ Identity',
        mnemonic:'σ′(z) = σ(z) · (1 − σ(z)). FREE GRADIENT.',
        facts:[
          'σ′(z) = σ(z)(1−σ(z))',
          'Maximum derivative = 0.25 at z=0',
          'Forward pass gives backward pass for free',
          'Foundational to back-propagation',
        ],
        q:'σ′(z) equals:',
        opts:['σ(z)','σ(z)·(1−σ(z))','σ(z)²','e^z'],
        ans:1},
      {x:80,y:35,label:'Bias Trick',
        mnemonic:'T → b = −T. Threshold becomes a LEARNABLE INPUT.',
        facts:[
          'Replace x > T with x + b > 0 (b = −T)',
          'Lets us learn the threshold via gradient methods',
          'Bias is just another weight, on input "1"',
        ],
        q:'The bias trick reinterprets the threshold T as:',
        opts:['A hyperparameter','A constant input of value T','A learnable input with weight b = −T','A second activation function'],
        ans:2},
      {x:30,y:55,label:'MSE Divergence',
        mnemonic:'w → ∞ to MAKE σ A PERFECT STEP. Cost shrinks, weights explode.',
        facts:[
          'MSE drives w larger to sharpen σ',
          '−b/w (boundary) stays correct',
          'Parameter magnitudes diverge to ±∞',
          'Fix: regularisation, cross-entropy, classification-correct stop',
        ],
        q:'In 2-D classification with MSE + sigmoid, parameters diverge because:',
        opts:['The data is noisy','σ only asymptotically reaches 0/1 — bigger w shrinks residuals','The learning rate is too high','Gradients vanish prematurely'],
        ans:1},
      {x:-30,y:40,label:'Chain Rule for dC/db',
        mnemonic:'−(y − a) · a · (1 − a). MEMORISE THIS.',
        facts:[
          'dC/db = −(1/n) Σ (y − a) · a · (1 − a)',
          'Three factors: residual × σ × (1−σ)',
          'For ∂/∂w: extra factor of x',
          'Pattern reused throughout deep learning',
        ],
        q:'The per-sample gradient dC/db for logistic regression has the form:',
        opts:['(y − a)²','−(y − a) · a · (1 − a)','a · log(y)','y − a'],
        ans:1},
    ],
    edges:[[0,1],[0,2],[2,3],[3,4],[1,4]],
  },
  {
    id:'forge', name:'LOGIC FORGE', lecture:'L14', color:'#eab308', icon:'⌬',
    cx:740, cy:400, vibe:'Neurons → logic gates → MLPs',
    stars:[
      {x:0,y:0,label:'Hyperplane',
        mnemonic:'n INPUTS → (n−1)-D HYPERPLANE divides ℝⁿ.',
        facts:[
          'σ(𝐰·𝐱 + b) > 0.5 ⇔ 𝐰·𝐱 + b > 0',
          '1 input: point · 2 inputs: line · 3 inputs: plane',
          'In general: (n−1)-dimensional hyperplane',
          'Decision boundary is always linear',
        ],
        q:'A neuron with 3 inputs partitions 3-D space using:',
        opts:['A point','A 1-D line','A 2-D plane','A 3-D cube'],
        ans:2},
      {x:55,y:-35,label:'AND Gate',
        mnemonic:'w₁=w₂=1, b=−1.5 → only (1,1) fires.',
        facts:[
          'Logical AND',
          'Sum z = x₁+x₂−1.5',
          'Only z>0 when both inputs are 1',
        ],
        q:'Weights/bias for AND: w₁=w₂=1, b=?',
        opts:['−0.5','−1.5','+1.5','+0.5'],
        ans:1},
      {x:80,y:30,label:'OR Gate',
        mnemonic:'w₁=w₂=1, b=−0.5 → any 1 fires.',
        facts:[
          'Logical OR',
          'Sum z = x₁+x₂−0.5',
          'Fires when at least one input is 1',
        ],
        q:'Weights/bias for OR: w₁=w₂=1, b=?',
        opts:['−1.5','−0.5','+0.5','0'],
        ans:1},
      {x:30,y:55,label:'NAND / NOR',
        mnemonic:'FLIP ALL SIGNS OF AND/OR.',
        facts:[
          'NAND: w₁=w₂=−1, b=1.5',
          'NOR: w₁=w₂=−1, b=0.5',
          'Pattern: negate to negate gate',
        ],
        q:'NAND weights/bias are:',
        opts:['w=1,1, b=−1.5','w=−1,−1, b=1.5','w=−1,1, b=0','w=1,−1, b=−0.5'],
        ans:1},
      {x:-30,y:40,label:'XOR Wall',
        mnemonic:'DIAGONAL DOOM — (0,1),(1,0) vs (0,0),(1,1). NO LINE WORKS.',
        facts:[
          'XOR not linearly separable',
          'Solve with 2-layer net: NAND + OR → AND',
          'NAND alone is universal for Boolean logic',
          'Multi-layer perceptrons = NAND universal ⇒ universal classifiers',
        ],
        q:'XOR is not linearly separable because the positive class:',
        opts:['Occupies one corner','Occupies opposite diagonal corners','Is empty','Equals the negative class'],
        ans:1},
      {x:115,y:-15,label:'Hit-Counting',
        mnemonic:'wᵢ = +1 / −1 · b = −(K − 0.5). Always exists for one digit.',
        facts:[
          'Constructive proof — single digit',
          'wᵢ = +1 if segment i is ON, −1 if OFF',
          'b = −(K − 0.5) where K = #segments ON',
          'Always classifies one digit pattern correctly',
        ],
        q:'In hit-counting, the bias b is set to:',
        opts:['K + 1','K · 0.5','−(K − 0.5)','−2K'],
        ans:2},
    ],
    edges:[[0,1],[0,2],[1,2],[1,3],[2,3],[3,4],[0,5]],
  },
];

// ── 13 standalone mnemonics — the "exam mantras" =================================
const MNEMONICS = [
  { color:'#22d3ee', topic:'L3 Triad',         line:'Language → Model → Metric.  Describe → Instantiate → Evaluate.' },
  { color:'#fb7185', topic:'L4 JSSP',          line:'Solution space (n!)ᵐ.  Makespan = time the LAST job finishes.' },
  { color:'#34d399', topic:'L5 Calc',          line:'f″ smiles for min · f″ frowns for max.' },
  { color:'#fbbf24', topic:'L6 GD',            line:'x ← x − α f′(x).  Minus for down, plus for up.' },
  { color:'#fbbf24', topic:'L6 N-R',           line:'f′ over f″ — curvature picks the perfect step.' },
  { color:'#14b8a6', topic:'L7 Direct',        line:'CCS taxi · H-J probe ±α · NM reflect-expand-contract-shrink.' },
  { color:'#6366f1', topic:'L8 LCG',           line:'Xₙ₊₁ = (a·Xₙ + c) mod m.  Three knobs: a, c, m.' },
  { color:'#6366f1', topic:'L8 NFL',           line:'Averaged over all problems, no algorithm beats another.' },
  { color:'#f97316', topic:'L9 SA',            line:'e^(ΔQ/t).  Hot jumps, cool clings.' },
  { color:'#f97316', topic:'L9 Tabu',          line:'Don’t go back where you’ve been (FIFO list).' },
  { color:'#84cc16', topic:'L10 (μ,λ)',        line:'COMMA = Children Only.  PLUS = Parents Persist.' },
  { color:'#84cc16', topic:'L10 1/5',          line:'p_s > 1/5 → grow σ² · p_s < 1/5 → shrink σ².' },
  { color:'#ec4899', topic:'L11 Crossover',    line:'1pt cuts string · 2pt cuts ring · uniform flips coins.' },
  { color:'#ec4899', topic:'L11 Selection',    line:'Roulette CDF · SUS regular spacing · Tournament rank-only.' },
  { color:'#0ea5e9', topic:'L12 PSO',          line:'α inertia + β personal + γ informants + δ global · ε step.' },
  { color:'#0ea5e9', topic:'L12 DE',           line:'child = A + F·(B − C).  Spread scales the step.' },
  { color:'#a855f7', topic:'L13 σ',            line:'σ(z) = 1 / (1 + e^−z) ·  σ′ = σ(1 − σ).' },
  { color:'#a855f7', topic:'L13 dC/db',        line:'−(y − a) · a · (1 − a).  Residual times σ times (1−σ).' },
  { color:'#eab308', topic:'L14 Gates',        line:'AND b=−1.5 · OR b=−0.5 · NAND/NOR: flip all signs.' },
  { color:'#eab308', topic:'L14 XOR',          line:'Diagonal Doom — opposite corners, one line WILL NOT WORK.' },
];

// ── Memory Cosmos main component ===============================================
function MemoryCosmosTab() {
  useCosmosStyles();
  const [view, setView] = useState('cosmos');
  const [active, setActive] = useState(null);
  const [picks, setPicks] = useState({});
  const [visited, setVisited] = useState(() => {
    try {
      const raw = localStorage.getItem('cits4404_cosmos_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });
  const markVisited = useCallback((id) => {
    setVisited(v => {
      const nv = {...v, [id]:true};
      try { localStorage.setItem('cits4404_cosmos_v1', JSON.stringify(nv)); } catch {}
      return nv;
    });
  }, []);

  const allStars = useMemo(() => {
    const out = [];
    COSMOS_DATA.forEach(c => c.stars.forEach((s, i) => out.push({ ...s, conId:c.id, conColor:c.color, conName:c.name, conLecture:c.lecture, idx:i, id:`${c.id}:${i}` })));
    return out;
  }, []);

  const visitedCount = Object.keys(visited).filter(k => visited[k]).length;
  const total = allStars.length;
  const pct = Math.round((visitedCount/total)*100);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.7rem',flexWrap:'wrap',marginBottom:'0.8rem'}}>
        <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
          {[['cosmos','✦ Cosmos'],['lightning','⚡ Lightning'],['mnemonics','♦ Mnemonics']].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{
              background: view===v ? 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(34,211,238,0.25))' : 'rgba(15,23,42,0.5)',
              border:`1px solid ${view===v?'#a78bfa':'rgba(148,163,184,0.25)'}`,
              color:view===v?'#fff':'var(--text-2)',
              borderRadius:8, padding:'0.45rem 1rem', cursor:'pointer',
              fontFamily:'monospace', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.05em'}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{fontFamily:'monospace',fontSize:'0.78rem'}}>
          <span style={{color:'var(--text-2)'}}>visited </span>
          <span style={{color:'#22d3ee'}}>{visitedCount}</span>
          <span style={{color:'var(--text-2)'}}> / {total}</span>
          <span style={{color:'#a78bfa',marginLeft:8}}>({pct}%)</span>
        </div>
      </div>

      {view === 'cosmos' && (
        <CosmosView
          allStars={allStars}
          visited={visited}
          markVisited={markVisited}
          active={active}
          setActive={setActive}
          picks={picks}
          setPicks={setPicks}
        />
      )}

      {view === 'lightning' && (
        <LightningRound
          allStars={allStars}
          visited={visited}
          markVisited={markVisited}
        />
      )}

      {view === 'mnemonics' && (
        <MnemonicsChain />
      )}
    </div>
  );
}

// ── Cosmos View ==================================================================
function CosmosView({ allStars, visited, markVisited, active, setActive, picks, setPicks }) {
  // Big canvas (constellation cx/cy values are scaled by S to spread them out)
  const S = 2.2;
  const W = 2200, H = 1100;
  const INITIAL = { x:0, y:0, w:W, h:H };
  const MIN_W = 380, MAX_W = W * 1.6;

  const [view, setView] = useState(INITIAL);
  const panRef = useRef(null);          // {startClientX, startClientY, vx, vy} while panning
  const [panning, setPanning] = useState(false);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);

  // Background twinkle stars (decorative — distributed across the larger canvas)
  const bgStars = useMemo(() => Array.from({length:240}, (_,i) => ({
    x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.4 + 0.4, d: Math.random()*3 + 1
  })), []);

  // Wheel zoom — must attach manually to allow preventDefault (React passive default)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      setView(v => {
        const mx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const my = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
        const factor = e.deltaY > 0 ? 1.18 : 0.85;
        let nw = Math.max(MIN_W, Math.min(MAX_W, v.w * factor));
        let nh = nw * (H / W);
        const nx = mx - (mx - v.x) * (nw / v.w);
        const ny = my - (my - v.y) * (nh / v.h);
        return { x: nx, y: ny, w: nw, h: nh };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line

  // Track pan via document listeners so the drag survives the cursor leaving the SVG
  useEffect(() => {
    if (!panning) return;
    const onMove = (e) => {
      const p = panRef.current; if (!p) return;
      const rect = svgRef.current.getBoundingClientRect();
      setView(v => {
        const scaleX = v.w / rect.width;
        const scaleY = v.h / rect.height;
        const dx = (e.clientX - p.startClientX) * scaleX;
        const dy = (e.clientY - p.startClientY) * scaleY;
        return { ...v, x: p.vx - dx, y: p.vy - dy };
      });
    };
    const onUp = () => { panRef.current = null; setPanning(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  const startPan = (e) => {
    // Skip pan if user grabbed a star
    let t = e.target;
    while (t && t !== e.currentTarget) {
      if (t.classList && t.classList.contains('mc-star-dot')) return;
      t = t.parentNode;
    }
    panRef.current = { startClientX: e.clientX, startClientY: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
    e.preventDefault();
  };

  // Zoom helpers — keep the canvas centre fixed
  const zoomBy = (factor) => setView(v => {
    let nw = Math.max(MIN_W, Math.min(MAX_W, v.w * factor));
    const nh = nw * (H / W);
    const cx = v.x + v.w/2, cy = v.y + v.h/2;
    return { x: cx - nw/2, y: cy - nh/2, w: nw, h: nh };
  });
  const resetView = () => setView(INITIAL);
  const zoomPct = Math.round((W / view.w) * 100);

  // Helper: jump to a constellation
  const jumpTo = (c) => setView({ x: c.cx*S - 350, y: c.cy*S - 250, w: 700, h: 500 });

  return (
    <div>
      {/* Constellation quick-jump chips */}
      <div style={{display:'flex', flexWrap:'wrap', gap:5, marginBottom:'0.6rem', alignItems:'center'}}>
        <span style={{fontSize:'0.66rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.08em', marginRight:6}}>JUMP TO →</span>
        {COSMOS_DATA.map(c => (
          <button key={c.id} onClick={()=>jumpTo(c)} style={{
            background:`${c.color}14`, border:`1px solid ${c.color}55`, color:c.color,
            borderRadius:6, padding:'2px 9px', cursor:'pointer',
            fontFamily:'monospace', fontSize:'0.66rem', fontWeight:700, letterSpacing:'0.04em'}}>
            {c.icon} {c.name.replace(/^THE /,'')}
          </button>
        ))}
      </div>

      <div ref={wrapRef} className="mc-bg" style={{
        padding:'0', minHeight: 700, position:'relative',
        cursor: panning ? 'grabbing' : 'grab',
        touchAction:'none', userSelect:'none',
      }}
      onMouseDown={startPan}>

        {/* Floating controls (top-right) */}
        <div style={{position:'absolute', top:10, right:10, zIndex:10, display:'flex', flexDirection:'column', gap:5}}>
          {[
            ['+', 'Zoom in', () => zoomBy(0.8)],
            ['−', 'Zoom out', () => zoomBy(1.25)],
            ['⊙', 'Reset view', resetView],
          ].map(([label, title, fn]) => (
            <button key={label} title={title} onClick={fn} style={{
              width:34, height:34, borderRadius:8,
              background:'rgba(15,23,42,0.78)',
              border:'1px solid rgba(167,139,250,0.35)',
              color:'#a78bfa', cursor:'pointer',
              fontFamily:'monospace', fontWeight:700, fontSize:'1rem',
              display:'flex', alignItems:'center', justifyContent:'center',
              backdropFilter:'blur(6px)',
            }}>{label}</button>
          ))}
        </div>

        {/* Floating zoom % indicator (bottom-right) */}
        <div style={{position:'absolute', bottom:10, right:10, zIndex:10,
          background:'rgba(15,23,42,0.78)',
          border:'1px solid rgba(167,139,250,0.35)',
          borderRadius:6, padding:'3px 9px',
          fontFamily:'monospace', fontSize:'0.7rem', color:'#a78bfa',
          backdropFilter:'blur(6px)', letterSpacing:'0.06em',
        }}>{zoomPct}%</div>

        {/* Hint banner (top-left) */}
        <div style={{position:'absolute', top:10, left:10, zIndex:10,
          background:'rgba(15,23,42,0.78)',
          border:'1px solid rgba(167,139,250,0.35)',
          borderRadius:6, padding:'3px 9px',
          fontFamily:'monospace', fontSize:'0.66rem', color:'var(--text-2)',
          backdropFilter:'blur(6px)', letterSpacing:'0.04em', pointerEvents:'none',
        }}>
          drag · scroll to zoom · click a ✦ for the card
        </div>

        <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          style={{width:'100%', height:'auto', display:'block', minHeight:700}}>
          {/* Background twinkles */}
          {bgStars.map((s,i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff"
              style={{opacity:0.55, animation:`mc-twinkle ${s.d}s ease-in-out infinite`, animationDelay:`${i*0.05}s`}} />
          ))}
          <defs>
            {COSMOS_DATA.map(c => (
              <radialGradient key={c.id} id={`grad-${c.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={c.color} stopOpacity="0.55"/>
                <stop offset="100%" stopColor={c.color} stopOpacity="0"/>
              </radialGradient>
            ))}
          </defs>

          {/* Constellation nebula glows */}
          {COSMOS_DATA.map(c => (
            <ellipse key={c.id} cx={c.cx*S + 40} cy={c.cy*S + 15} rx="180" ry="120"
              fill={`url(#grad-${c.id})`} opacity="0.55" pointerEvents="none" />
          ))}

          {/* Constellations */}
          {COSMOS_DATA.map(c => {
            const ccx = c.cx*S, ccy = c.cy*S;
            return (
              <g key={c.id}>
                {/* Edges */}
                {c.edges.map(([a,b],ei) => {
                  const sa = c.stars[a], sb = c.stars[b];
                  return <line key={ei}
                    x1={ccx + sa.x} y1={ccy + sa.y}
                    x2={ccx + sb.x} y2={ccy + sb.y}
                    stroke={c.color} strokeWidth="1.2" strokeOpacity="0.45" strokeDasharray="3 3"
                    pointerEvents="none" />;
                })}
                {/* Title — moved further up to clear stars */}
                <text x={ccx + 40} y={ccy - 80} fill={c.color} fontFamily="monospace" fontWeight="700" fontSize="15" textAnchor="middle"
                  style={{filter:`drop-shadow(0 0 6px ${c.color})`, letterSpacing:'0.1em'}}
                  pointerEvents="none">
                  {c.icon} {c.name}
                </text>
                <text x={ccx + 40} y={ccy - 62} fill={c.color} opacity="0.75" fontFamily="monospace" fontSize="11" textAnchor="middle"
                  pointerEvents="none">
                  {c.lecture} · {c.vibe}
                </text>

                {/* Stars */}
                {c.stars.map((s, si) => {
                  const id = `${c.id}:${si}`;
                  const isVisited = !!visited[id];
                  const cx = ccx + s.x, cy = ccy + s.y;
                  return (
                    <g key={si} transform={`translate(${cx} ${cy})`}>
                      <g className="mc-star-dot" onClick={(e)=>{e.stopPropagation(); setActive(id);}}>
                        <circle cx="0" cy="0" r="16" fill="transparent" />
                        {isVisited && (
                          <circle cx="0" cy="0" r="14" fill="none" stroke={c.color} strokeWidth="1" strokeOpacity="0.55"
                            style={{animation:'mc-pulse 2.5s ease-in-out infinite', '--cw':c.color}} />
                        )}
                        <circle cx="0" cy="0" r={isVisited?7.5:6} fill={isVisited?c.color:'#fff'} stroke={c.color} strokeWidth="1.5"
                          style={{filter:`drop-shadow(0 0 ${isVisited?10:6}px ${c.color})`, animation: isVisited ? 'none' : `mc-twinkle ${2+si*0.3}s ease-in-out infinite`}}/>
                      </g>
                      <text x="0" y="22" fill={isVisited?c.color:'#fff'} fontFamily="monospace" fontSize="11"
                        textAnchor="middle" opacity={isVisited?1:0.85} pointerEvents="none"
                        style={{textShadow:'0 0 4px #000'}}>{s.label}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{marginTop:'0.8rem',background:'rgba(15,23,42,0.5)',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,padding:'0.55rem 0.9rem',fontSize:'0.73rem',color:'var(--text-2)',lineHeight:1.55}}>
        <strong style={{color:'#a78bfa'}}>How to use the Cosmos:</strong> <em>drag</em> to pan, <em>scroll</em> (or use + / −) to zoom, <em>click a chip</em> at the top to fly to a constellation, <em>click a ✦</em> to open its fact card and quick quiz. Visited stars pulse — your memory map literally lights up as you go.
      </div>

      {active && (() => {
        const star = allStars.find(s => s.id === active);
        if (!star) return null;
        return <StarModal star={star} onClose={()=>setActive(null)} markVisited={markVisited} picks={picks} setPicks={setPicks} />;
      })()}
    </div>
  );
}

// ── Star Modal ===================================================================
function StarModal({ star, onClose, markVisited, picks, setPicks }) {
  const pick = picks[star.id];
  const isCorrect = pick === star.ans;
  const submit = (i) => setPicks(p => ({...p, [star.id]: i}));

  return (
    <div onClick={onClose} className="mc-modal-bg" style={{
      position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
    }}>
      <div onClick={e=>e.stopPropagation()} className="mc-fadein" style={{
        background:`linear-gradient(135deg, ${star.conColor}10 0%, rgba(5,8,24,0.96) 100%)`,
        border:`1px solid ${star.conColor}`,
        borderRadius:14, maxWidth:560, width:'100%', maxHeight:'90vh', overflow:'auto',
        boxShadow:`0 0 60px -10px ${star.conColor}`,
        '--cw': star.conColor,
      }}>
        <div style={{padding:'1.1rem 1.3rem', borderBottom:`1px solid ${star.conColor}33`, position:'sticky', top:0, background:'rgba(5,8,24,0.94)', backdropFilter:'blur(6px)', zIndex:2}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.5rem'}}>
            <div>
              <div style={{fontSize:'0.62rem',color:star.conColor,letterSpacing:'0.08em',fontFamily:'monospace',fontWeight:700,marginBottom:3}}>
                {star.conName} · {star.conLecture}
              </div>
              <h3 style={{margin:0,color:'#fff',fontSize:'1.3rem',letterSpacing:'-0.01em'}}>{star.label}</h3>
            </div>
            <button onClick={onClose} style={{background:'rgba(148,163,184,0.1)',border:'1px solid rgba(148,163,184,0.3)',color:'var(--text-2)',borderRadius:6,padding:'4px 11px',cursor:'pointer',fontFamily:'monospace',fontSize:'0.8rem'}}>✕</button>
          </div>
        </div>

        <div style={{padding:'1.1rem 1.3rem'}}>
          {/* Mnemonic banner */}
          <div style={{
            background:`linear-gradient(135deg, ${star.conColor}1f, rgba(167,139,250,0.12))`,
            border:`1px dashed ${star.conColor}`,
            borderRadius:10, padding:'0.7rem 0.9rem', marginBottom:'0.85rem',
          }}>
            <div style={{fontSize:'0.6rem',color:star.conColor,fontFamily:'monospace',letterSpacing:'0.1em',marginBottom:4,fontWeight:700}}>★ MNEMONIC</div>
            <div style={{color:'#fff',fontSize:'0.92rem',fontWeight:600,lineHeight:1.45,letterSpacing:'0.01em'}}>{star.mnemonic}</div>
          </div>

          {/* Facts */}
          <div style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.6rem',color:'#22d3ee',fontFamily:'monospace',letterSpacing:'0.1em',marginBottom:5,fontWeight:700}}>◆ KEY FACTS</div>
            <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:6}}>
              {star.facts.map((f,i) => (
                <li key={i} style={{
                  display:'flex',alignItems:'flex-start',gap:'0.55rem',
                  background:'rgba(15,23,42,0.55)',
                  border:'1px solid rgba(148,163,184,0.15)',
                  borderRadius:8, padding:'0.5rem 0.7rem',
                  fontSize:'0.83rem', color:'var(--text-1)', lineHeight:1.5,
                }}>
                  <span style={{color:star.conColor,fontFamily:'monospace',fontWeight:700,minWidth:14}}>{String(i+1).padStart(2,'0')}</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quiz */}
          <div style={{
            background:'rgba(167,139,250,0.06)',
            border:'1px solid rgba(167,139,250,0.3)',
            borderRadius:10, padding:'0.85rem',
          }}>
            <div style={{fontSize:'0.6rem',color:'#a78bfa',fontFamily:'monospace',letterSpacing:'0.1em',marginBottom:5,fontWeight:700}}>⚡ QUICK CHECK</div>
            <div style={{color:'#fff',fontSize:'0.88rem',marginBottom:'0.55rem',lineHeight:1.5}}>{star.q}</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {star.opts.map((o,i) => {
                const isPick = pick === i;
                const reveal = pick !== undefined;
                const correct = i === star.ans;
                let bg = 'rgba(15,23,42,0.5)', border = 'rgba(148,163,184,0.2)', color = 'var(--text-1)';
                if (reveal && correct) { bg = 'rgba(52,211,153,0.18)'; border = '#34d399'; color = '#34d399'; }
                else if (reveal && isPick && !correct) { bg = 'rgba(251,113,133,0.18)'; border = '#fb7185'; color = '#fb7185'; }
                else if (isPick) { bg = `${star.conColor}22`; border = star.conColor; color = '#fff'; }
                return (
                  <button key={i} disabled={pick !== undefined} onClick={()=>submit(i)} style={{
                    display:'flex', alignItems:'flex-start', gap:'0.55rem', textAlign:'left',
                    background:bg, border:`1px solid ${border}`, color, borderRadius:7,
                    padding:'0.45rem 0.7rem', cursor:pick !== undefined ? 'default':'pointer',
                    fontSize:'0.8rem', fontFamily:'inherit', lineHeight:1.45,
                  }}>
                    <span style={{fontFamily:'monospace',color:'var(--text-2)'}}>{String.fromCharCode(65+i)}.</span>
                    <span style={{flex:1}}>{o}</span>
                    {reveal && correct && <span>✓</span>}
                    {reveal && isPick && !correct && <span>✘</span>}
                  </button>
                );
              })}
            </div>
            {pick !== undefined && (
              <div style={{marginTop:'0.7rem',padding:'0.55rem 0.75rem',background:isCorrect?'rgba(52,211,153,0.1)':'rgba(251,191,36,0.1)',border:`1px solid ${isCorrect?'#34d399':'#fbbf24'}55`,borderRadius:7,fontSize:'0.78rem',color:isCorrect?'#34d399':'#fbbf24'}}>
                {isCorrect ? '★ Correct — locked in.' : `Hint: re-read fact ${star.facts.length} and the mnemonic above, then click "Mark visited" once it clicks.`}
              </div>
            )}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',gap:'0.5rem',marginTop:'0.9rem'}}>
            <button onClick={onClose} style={{background:'rgba(148,163,184,0.1)',border:'1px solid rgba(148,163,184,0.3)',color:'var(--text-2)',borderRadius:8,padding:'0.45rem 0.95rem',cursor:'pointer',fontFamily:'monospace',fontSize:'0.78rem'}}>← Back to Cosmos</button>
            <button onClick={()=>{markVisited(star.id); onClose();}} style={{
              background:`linear-gradient(135deg, ${star.conColor}, ${star.conColor}99)`,
              border:'none', color:'#0a0e27', borderRadius:8,
              padding:'0.45rem 1.1rem', cursor:'pointer', fontFamily:'monospace', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.05em'}}>
              ✓ MARK VISITED
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lightning Round (flashcards) =================================================
function LightningRound({ allStars, markVisited }) {
  const [order, setOrder] = useState(() => shuffleArr(allStars.map((_,i)=>i)));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pick, setPick] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const cur = allStars[order[idx]];

  const next = useCallback(() => {
    setFlipped(false); setPick(null);
    setIdx(i => (i+1) % order.length);
  }, [order.length]);

  const submit = (i) => {
    setPick(i);
    if (i === cur.ans) {
      setStreak(s => {
        const ns = s+1;
        setBestStreak(b => Math.max(b, ns));
        return ns;
      });
      markVisited(cur.id);
    } else {
      setStreak(0);
    }
  };

  return (
    <div className="mc-bg" style={{minHeight:560, padding:'1.5rem', display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem'}}>
      <div style={{display:'flex',gap:'1rem',marginBottom:'0.3rem'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'0.6rem',color:'rgba(148,163,184,0.7)',letterSpacing:'0.1em',fontFamily:'monospace'}}>CARD</div>
          <div style={{fontSize:'1.4rem',color:'#fff',fontFamily:'monospace',fontWeight:700}}>{idx+1}<span style={{color:'rgba(148,163,184,0.5)',fontSize:'0.85rem'}}> / {order.length}</span></div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'0.6rem',color:'rgba(251,113,133,0.8)',letterSpacing:'0.1em',fontFamily:'monospace'}}>STREAK 🔥</div>
          <div style={{fontSize:'1.4rem',color:'#fb7185',fontFamily:'monospace',fontWeight:700}}>{streak}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'0.6rem',color:'rgba(251,191,36,0.8)',letterSpacing:'0.1em',fontFamily:'monospace'}}>BEST</div>
          <div style={{fontSize:'1.4rem',color:'#fbbf24',fontFamily:'monospace',fontWeight:700}}>{bestStreak}</div>
        </div>
      </div>

      <div style={{maxWidth:540, width:'100%', position:'relative', perspective:'1200px'}}>
        <div style={{
          position:'relative', minHeight:380, transition:'transform 0.5s',
          transformStyle:'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front */}
          <div style={{
            position:'absolute', inset:0, backfaceVisibility:'hidden',
            background:`linear-gradient(135deg, ${cur.conColor}18, rgba(5,8,24,0.95))`,
            border:`1px solid ${cur.conColor}`, borderRadius:14,
            padding:'1.5rem', display:'flex',flexDirection:'column',gap:'0.8rem',
            boxShadow:`0 0 40px -10px ${cur.conColor}`,
          }}>
            <div style={{fontSize:'0.6rem',color:cur.conColor,letterSpacing:'0.12em',fontFamily:'monospace',fontWeight:700}}>{cur.conName} · {cur.conLecture}</div>
            <h2 style={{margin:0, color:'#fff', fontSize:'1.9rem', letterSpacing:'-0.01em', lineHeight:1.1}}>{cur.label}</h2>
            <div style={{
              background:'rgba(167,139,250,0.1)', border:'1px dashed #a78bfa55',
              borderRadius:10, padding:'0.7rem 0.85rem',
            }}>
              <div style={{fontSize:'0.58rem',color:'#a78bfa',fontFamily:'monospace',letterSpacing:'0.1em',marginBottom:4,fontWeight:700}}>★ MNEMONIC</div>
              <div style={{color:'#fff',fontSize:'0.93rem',fontWeight:600,lineHeight:1.4}}>{cur.mnemonic}</div>
            </div>
            <button onClick={()=>setFlipped(true)} style={{
              marginTop:'auto', padding:'0.55rem 1rem',
              background:`linear-gradient(135deg, ${cur.conColor}, ${cur.conColor}88)`,
              border:'none', borderRadius:8, color:'#0a0e27',
              cursor:'pointer', fontWeight:700, fontFamily:'monospace', letterSpacing:'0.05em',
            }}>↻ FLIP — TEST ME</button>
          </div>
          {/* Back */}
          <div style={{
            position:'absolute', inset:0, backfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
            background:`linear-gradient(135deg, rgba(15,23,42,0.97), ${cur.conColor}18)`,
            border:`1px solid ${cur.conColor}`, borderRadius:14,
            padding:'1.25rem', display:'flex',flexDirection:'column',gap:'0.6rem',
            boxShadow:`0 0 40px -10px ${cur.conColor}`,
          }}>
            <div style={{fontSize:'0.58rem',color:cur.conColor,letterSpacing:'0.12em',fontFamily:'monospace',fontWeight:700}}>QUICK QUIZ</div>
            <div style={{color:'#fff',fontSize:'1rem',fontWeight:600,lineHeight:1.4}}>{cur.q}</div>
            <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:'0.3rem'}}>
              {cur.opts.map((o,i) => {
                const isPick = pick === i;
                const reveal = pick !== null;
                const correct = i === cur.ans;
                let bg = 'rgba(15,23,42,0.5)', border = 'rgba(148,163,184,0.2)', color = 'var(--text-1)';
                if (reveal && correct) { bg = 'rgba(52,211,153,0.18)'; border = '#34d399'; color = '#34d399'; }
                else if (reveal && isPick && !correct) { bg = 'rgba(251,113,133,0.18)'; border = '#fb7185'; color = '#fb7185'; }
                return (
                  <button key={i} disabled={pick !== null} onClick={()=>submit(i)} style={{
                    textAlign:'left', background:bg, border:`1px solid ${border}`, color, borderRadius:7,
                    padding:'0.5rem 0.7rem', cursor:pick !== null ? 'default':'pointer',
                    fontSize:'0.85rem', fontFamily:'inherit', lineHeight:1.4,
                  }}>
                    <span style={{fontFamily:'monospace',color:'var(--text-2)',marginRight:7}}>{String.fromCharCode(65+i)}.</span>
                    {o}
                  </button>
                );
              })}
            </div>
            {pick !== null && (
              <button onClick={next} style={{
                marginTop:'auto', padding:'0.55rem 1rem',
                background:'linear-gradient(135deg, #22d3ee, #a78bfa)',
                border:'none', borderRadius:8, color:'#0a0e27',
                cursor:'pointer', fontWeight:700, fontFamily:'monospace', letterSpacing:'0.05em',
              }}>NEXT CARD →</button>
            )}
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
        <button onClick={()=>{setOrder(shuffleArr(allStars.map((_,i)=>i))); setIdx(0); setFlipped(false); setPick(null); setStreak(0);}}
          style={{background:'rgba(15,23,42,0.6)',border:'1px solid rgba(148,163,184,0.3)',color:'var(--text-1)',borderRadius:8,padding:'0.4rem 0.95rem',cursor:'pointer',fontFamily:'monospace',fontSize:'0.74rem'}}>
          ⚃ Reshuffle
        </button>
        <button onClick={()=>{setIdx(i => (i-1+order.length)%order.length); setFlipped(false); setPick(null);}}
          style={{background:'rgba(15,23,42,0.6)',border:'1px solid rgba(148,163,184,0.3)',color:'var(--text-1)',borderRadius:8,padding:'0.4rem 0.95rem',cursor:'pointer',fontFamily:'monospace',fontSize:'0.74rem'}}>
          ← Prev
        </button>
        <button onClick={next}
          style={{background:'rgba(15,23,42,0.6)',border:'1px solid rgba(148,163,184,0.3)',color:'var(--text-1)',borderRadius:8,padding:'0.4rem 0.95rem',cursor:'pointer',fontFamily:'monospace',fontSize:'0.74rem'}}>
          Skip →
        </button>
      </div>
    </div>
  );
}

// ── Mnemonics Chain ==============================================================
function MnemonicsChain() {
  const [hover, setHover] = useState(null);
  return (
    <div className="mc-bg" style={{padding:'1.5rem 1.25rem', minHeight:560}}>
      <div style={{textAlign:'center', marginBottom:'1.3rem'}}>
        <div className="mc-shimmer-text" style={{fontSize:'2rem', letterSpacing:'-0.01em'}}>THE EXAM MANTRAS</div>
        <div style={{color:'var(--text-2)', fontSize:'0.85rem', marginTop:'0.3rem'}}>{MNEMONICS.length} one-line spells. Hover for the full mnemonic to glow up.</div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'0.65rem'}}>
        {MNEMONICS.map((m, i) => {
          const isHover = hover === i;
          return (
            <div key={i}
              onMouseEnter={()=>setHover(i)}
              onMouseLeave={()=>setHover(null)}
              style={{
                position:'relative',
                background: isHover
                  ? `linear-gradient(135deg, ${m.color}22, rgba(5,8,24,0.85))`
                  : `linear-gradient(135deg, ${m.color}0e, rgba(5,8,24,0.6))`,
                border: `1px solid ${isHover?m.color:m.color+'55'}`,
                borderRadius:10, padding:'0.7rem 0.9rem',
                transition:'all 0.18s',
                transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHover ? `0 0 24px -6px ${m.color}` : 'none',
                cursor:'default',
              }}>
              <div style={{
                fontSize:'0.55rem', fontFamily:'monospace', letterSpacing:'0.12em',
                color: m.color, fontWeight:700, marginBottom:4,
              }}>
                {m.topic}
              </div>
              <div style={{color:isHover?'#fff':'var(--text-1)', fontSize:'0.86rem', lineHeight:1.45, fontWeight:isHover?600:500}}>
                {m.line}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop:'1.4rem',
        background:'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(251,113,133,0.08))',
        border:'1px solid rgba(167,139,250,0.3)',
        borderRadius:10, padding:'0.85rem 1rem',
      }}>
        <div style={{fontSize:'0.6rem', color:'#a78bfa', fontFamily:'monospace', letterSpacing:'0.1em', fontWeight:700, marginBottom:'0.4rem'}}>
          💡 THE WAY TO USE MNEMONICS FOR MEMORY
        </div>
        <ul style={{listStyle:'none', padding:0, margin:0, fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.7}}>
          <li><strong style={{color:'#22d3ee'}}>1.</strong> Read each line aloud (audition strengthens recall).</li>
          <li><strong style={{color:'#a78bfa'}}>2.</strong> Make a silly mental image of the phrase — sillier = more memorable.</li>
          <li><strong style={{color:'#fb7185'}}>3.</strong> Connect to its colour — colour is a retrieval cue.</li>
          <li><strong style={{color:'#34d399'}}>4.</strong> Recall the mnemonic before re-reading the lecture — active retrieval &gt;&gt; passive review.</li>
          <li><strong style={{color:'#fbbf24'}}>5.</strong> Repeat with spacing: day 1, day 3, day 7. <em>Spaced repetition crystallises memory.</em></li>
        </ul>
      </div>
    </div>
  );
}

// ─── NEURAL NETWORKS TAB (Lecture 15) ─────────────────────────────────────────

function NNNetworkCanvas({ layers, height=240, activeLayer=-1, activeNode=null, activeWeight=null, activeFlow=null }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = c.width = c.offsetWidth || 420;
    const H = c.height = height;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const xPad = 30;
    const layerX = layers.map((_, li) => xPad + (W - 2*xPad) * (li / Math.max(1, layers.length-1)));
    const pos = layers.map((n, li) => {
      const dy = (H - 50) / Math.max(1, n);
      return Array.from({length:n}, (_, ni) => ({ x: layerX[li], y: 25 + dy * (ni + 0.5) }));
    });
    for (let l = 0; l < layers.length - 1; l++) {
      for (let j = 0; j < layers[l+1]; j++) {
        for (let k = 0; k < layers[l]; k++) {
          const a = pos[l][k], b = pos[l+1][j];
          const isAW = activeWeight && activeWeight.l === l+1 && activeWeight.j === j && activeWeight.k === k;
          const flowActive = activeFlow && (
            (activeFlow.dir === 'forward' && activeFlow.upTo >= l+1) ||
            (activeFlow.dir === 'backward' && activeFlow.downTo <= l+1)
          );
          ctx.strokeStyle = isAW ? '#fbbf24' : (flowActive ? (activeFlow.dir === 'forward' ? 'rgba(34,211,238,0.7)' : 'rgba(251,113,133,0.7)') : 'rgba(148,163,184,0.18)');
          ctx.lineWidth = isAW ? 2.5 : (flowActive ? 1.4 : 0.5);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    pos.forEach((layer, li) => {
      const base = li === 0 ? '#22d3ee' : li === pos.length - 1 ? '#fb7185' : '#a78bfa';
      layer.forEach((p, ni) => {
        const isActive = activeLayer === li && (activeNode === null || activeNode === ni);
        ctx.fillStyle = isActive ? '#fbbf24' : base;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1; ctx.stroke();
      });
    });
    ctx.fillStyle = 'rgba(226,232,240,0.55)';
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    layers.forEach((n, li) => {
      const label = li === 0 ? 'INPUT' : li === layers.length-1 ? 'OUTPUT' : `HIDDEN ${li}`;
      ctx.fillText(label, layerX[li], H - 8);
    });
  }, [layers, activeLayer, activeNode, activeWeight, activeFlow, height]);
  return <canvas ref={ref} style={{width:'100%', height, display:'block', borderRadius:8, background:'rgba(15,23,42,0.4)'}} />;
}

function NNArchitectureBuilder() {
  const [input, setInput] = useState(4);
  const [hidden, setHidden] = useState([6, 6]);
  const [output, setOutput] = useState(2);
  const layers = [input, ...hidden, output];
  const totalW = layers.slice(1).reduce((acc, n, i) => acc + n * layers[i], 0);
  const totalB = layers.slice(1).reduce((acc, n) => acc + n, 0);
  const addLayer = () => hidden.length < 4 && setHidden([...hidden, 6]);
  const removeLayer = () => hidden.length > 1 && setHidden(hidden.slice(0, -1));
  const setLayerSize = (idx, val) => setHidden(hidden.map((h, i) => i === idx ? val : h));
  return (
    <div className="m4-card">
      <div className="m4-card-h">Feedforward Architecture Builder</div>
      <NNNetworkCanvas layers={layers} height={260} />
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'0.6rem', marginTop:'0.7rem'}}>
        <div>
          <div className="m4-flabel" style={{color:'#22d3ee'}}>Input: {input}</div>
          <input type="range" min={1} max={10} value={input} onChange={e=>setInput(+e.target.value)} style={{width:'100%'}}/>
        </div>
        {hidden.map((h, i) => (
          <div key={i}>
            <div className="m4-flabel" style={{color:'#a78bfa'}}>Hidden {i+1}: {h}</div>
            <input type="range" min={1} max={12} value={h} onChange={e=>setLayerSize(i, +e.target.value)} style={{width:'100%'}}/>
          </div>
        ))}
        <div>
          <div className="m4-flabel" style={{color:'#fb7185'}}>Output: {output}</div>
          <input type="range" min={1} max={10} value={output} onChange={e=>setOutput(+e.target.value)} style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{display:'flex', gap:'0.5rem', marginTop:'0.6rem', flexWrap:'wrap'}}>
        <button onClick={addLayer} className="m4-preset-btn" disabled={hidden.length >= 4}>+ Hidden Layer</button>
        <button onClick={removeLayer} className="m4-preset-btn" disabled={hidden.length <= 1}>− Hidden Layer</button>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.6rem', fontSize:'0.76rem'}}>
        <strong>Trainable parameters:</strong> {(totalW+totalB).toLocaleString()} ({totalW.toLocaleString()} weights + {totalB.toLocaleString()} biases). <strong>Architecture string:</strong> {layers.join(' → ')}.
        <br/><em style={{fontSize:'0.72rem'}}>Hidden layers are a "dark art" — no hard rule for count or width. Deeper ⇒ more expressive but harder to train.</em>
      </div>
    </div>
  );
}

function NNBackpropWalker() {
  const layers = [3, 4, 2];
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const steps = [
    { t:'Step 1 · Initialise', d:'Set the input activation a¹ = x. Pick random initial weights & biases. The network starts cold.', activeLayer:0, flow:null, eqn:'a^{1} = x', col:'#22d3ee' },
    { t:'Step 2 · Forward (layer 1 → 2)', d:'For each neuron j in layer 2: zⱼ² = Σₖ wⱼₖ² aₖ¹ + bⱼ². Then aⱼ² = σ(zⱼ²).', activeLayer:1, flow:{dir:'forward', upTo:1}, eqn:'z^{2} = w^{2}a^{1} + b^{2}, \\quad a^{2} = \\sigma(z^{2})', col:'#22d3ee' },
    { t:'Step 3 · Forward (layer 2 → 3)', d:'Repeat for the output layer L = 3. This is the entire feedforward pass.', activeLayer:2, flow:{dir:'forward', upTo:2}, eqn:'z^{3} = w^{3}a^{2} + b^{3}, \\quad a^{3} = \\sigma(z^{3})', col:'#22d3ee' },
    { t:'Step 4 · Output Error δᴸ (BP-1)', d:'δᴸ = ∇ₐ C ⊙ σ′(zᴸ). With MSE: ∇ₐ C = (aᴸ − y), so δᴸ = (aᴸ − y) ⊙ σ′(zᴸ).', activeLayer:2, flow:{dir:'backward', downTo:3}, eqn:'\\delta^{L} = \\nabla_{a} C \\odot \\sigma\'(z^{L})', col:'#fb7185' },
    { t:'Step 5 · Backpropagate (BP-2)', d:'δˡ = ((wˡ⁺¹)ᵀ δˡ⁺¹) ⊙ σ′(zˡ). The error at layer ℓ is the error at ℓ+1, pulled back through the transposed weights, then gated by σ′.', activeLayer:1, flow:{dir:'backward', downTo:2}, eqn:'\\delta^{l} = \\bigl((w^{l+1})^{T}\\delta^{l+1}\\bigr) \\odot \\sigma\'(z^{l})', col:'#fb7185' },
    { t:'Step 6 · Bias gradient (BP-3)', d:'∂C/∂bˡⱼ = δˡⱼ. Each bias gradient is just the local error itself — no extra work.', activeLayer:-1, flow:null, eqn:'\\frac{\\partial C}{\\partial b^{l}_{j}} = \\delta^{l}_{j}', col:'#fbbf24' },
    { t:'Step 7 · Weight gradient (BP-4)', d:'∂C/∂wˡⱼₖ = aˡ⁻¹ₖ · δˡⱼ. Weight blame = (pre-layer activation) × (post-layer error).', activeLayer:-1, flow:null, eqn:'\\frac{\\partial C}{\\partial w^{l}_{jk}} = a^{l-1}_{k}\\,\\delta^{l}_{j}', col:'#fbbf24' },
    { t:'Step 8 · Update', d:'Apply one gradient-descent step: wˡ ← wˡ − α · ∂C/∂wˡ (same for b). Then repeat from Step 2.', activeLayer:-1, flow:null, eqn:'w \\leftarrow w - \\alpha\\,\\nabla_{w} C, \\quad b \\leftarrow b - \\alpha\\,\\nabla_{b} C', col:'#34d399' },
  ];
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setStep(s => (s+1) % steps.length), 1600);
    return () => clearInterval(id);
  }, [auto, steps.length]);
  const s = steps[step];
  return (
    <div className="m4-card">
      <div className="m4-card-h">Backpropagation Step-Walker (3 → 4 → 2)</div>
      <NNNetworkCanvas layers={layers} height={240} activeLayer={s.activeLayer} activeFlow={s.flow} />
      <div style={{marginTop:'0.6rem', padding:'0.65rem 0.85rem', background:`${s.col}11`, border:`1px solid ${s.col}55`, borderRadius:8}}>
        <div style={{fontSize:'0.7rem', color:s.col, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.08em'}}>{step+1} / {steps.length}</div>
        <div style={{fontSize:'0.95rem', color:'#fff', fontWeight:700, marginTop:'0.2rem'}}>{s.t}</div>
        <div style={{marginTop:'0.45rem'}}><Tex src={s.eqn} block /></div>
        <div style={{fontSize:'0.78rem', color:'var(--text-1)', marginTop:'0.35rem', lineHeight:1.55}}>{s.d}</div>
      </div>
      <div style={{display:'flex', gap:'0.5rem', marginTop:'0.55rem', justifyContent:'space-between', flexWrap:'wrap'}}>
        <button className="m4-preset-btn" onClick={()=>setStep(Math.max(0, step-1))} disabled={step===0}>← Prev</button>
        <button className="m4-preset-btn" onClick={()=>setAuto(a=>!a)}>{auto?'⏸ Pause':'▶ Auto'}</button>
        <button className="m4-preset-btn" onClick={()=>setStep(Math.min(steps.length-1, step+1))} disabled={step===steps.length-1}>Next →</button>
        <button className="m4-preset-btn" onClick={()=>{setStep(0); setAuto(false);}}>Restart</button>
      </div>
    </div>
  );
}

function NNCostContour() {
  const [trail, setTrail] = useState([]);
  const [running, setRunning] = useState(false);
  const [w, setW] = useState(-3);
  const [b, setB] = useState(2.5);
  const [lr, setLr] = useState(0.1);
  const cost = useCallback((w, b) => 0.5*Math.pow(w - 2.5, 2) + 0.5*Math.pow(b + 1, 2) + 0.1, []);
  const grad = useCallback((w, b) => [w - 2.5, b + 1], []);
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = c.width = c.offsetWidth || 420;
    const H = c.height = 320;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const toX = (w) => ((w + 5) / 10) * W;
    const toY = (b) => H - ((b + 5) / 10) * H;
    const res = 60;
    const cellW = W / res, cellH = H / res;
    let maxC = 0, minC = Infinity;
    const cs = [];
    for (let i = 0; i < res; i++) {
      const row = [];
      for (let j = 0; j < res; j++) {
        const ww = -5 + 10 * (i / res), bb = -5 + 10 * (j / res);
        const cc = cost(ww, bb);
        row.push(cc);
        if (cc > maxC) maxC = cc;
        if (cc < minC) minC = cc;
      }
      cs.push(row);
    }
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        const v = (cs[i][j] - minC) / (maxC - minC + 1e-9);
        ctx.fillStyle = `hsl(${235 - v * 200}, 65%, ${20 + (1-v)*45}%)`;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(i * cellW, H - (j+1) * cellH, cellW + 1, cellH + 1);
      }
    }
    ctx.globalAlpha = 1;
    if (trail.length > 1) {
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach(([ww, bb], i) => {
        if (i === 0) ctx.moveTo(toX(ww), toY(bb));
        else ctx.lineTo(toX(ww), toY(bb));
      });
      ctx.stroke();
      trail.forEach(([ww, bb]) => {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(toX(ww), toY(bb), 2.5, 0, Math.PI*2); ctx.fill();
      });
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(toX(w), toY(b), 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(toX(2.5), toY(-1), 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
    ctx.fillText('min', toX(2.5) + 9, toY(-1) - 5);
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
    ctx.fillText('w →', W - 26, H - 5);
    ctx.save(); ctx.translate(8, 16); ctx.fillText('b ↑', 0, 0); ctx.restore();
  }, [w, b, trail, cost]);
  const step = useCallback(() => {
    const [gw, gb] = grad(w, b);
    setTrail(t => [...t.slice(-80), [w, b]]);
    setW(w - lr * gw); setB(b - lr * gb);
  }, [w, b, lr, grad]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, 90);
    return () => clearInterval(id);
  }, [running, step]);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Cost Surface C(w, b) — Gradient Descent in 2-D</div>
      <canvas ref={ref} style={{width:'100%', height:320, display:'block', borderRadius:8}}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', marginTop:'0.6rem'}}>
        <div>
          <div className="m4-flabel">w = {w.toFixed(2)}</div>
          <input type="range" min={-5} max={5} step={0.1} value={w} onChange={e=>{setW(+e.target.value); setTrail([]);}} style={{width:'100%'}}/>
        </div>
        <div>
          <div className="m4-flabel">b = {b.toFixed(2)}</div>
          <input type="range" min={-5} max={5} step={0.1} value={b} onChange={e=>{setB(+e.target.value); setTrail([]);}} style={{width:'100%'}}/>
        </div>
        <div>
          <div className="m4-flabel">α = {lr.toFixed(3)}</div>
          <input type="range" min={0.005} max={0.6} step={0.005} value={lr} onChange={e=>setLr(+e.target.value)} style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem', justifyContent:'center'}}>
        <button className="m4-preset-btn" onClick={()=>setRunning(r=>!r)}>{running ? '⏸ Pause' : '▶ Run GD'}</button>
        <button className="m4-preset-btn" onClick={step}>Step</button>
        <button className="m4-preset-btn" onClick={()=>{setW(-3); setB(2.5); setTrail([]); setRunning(false);}}>Reset</button>
        <button className="m4-preset-btn" onClick={()=>{setW(-4+Math.random()*8); setB(-4+Math.random()*8); setTrail([]);}}>Random start</button>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
        Current C(w, b) = <strong style={{color:'#fbbf24'}}>{cost(w, b).toFixed(3)}</strong>. True minimum at (2.5, −1). Each step: (w, b) ← (w, b) − α · ∇C. A real network has <em>millions</em> of dimensions instead of 2.
      </div>
    </div>
  );
}

function NNUniversalApprox() {
  const [target, setTarget] = useState('sin');
  const [n, setN] = useState(8);
  const ref = useRef(null);
  const targetFn = useCallback((x) => {
    if (target === 'sin') return Math.sin(x * 2);
    if (target === 'gauss') return Math.exp(-2*x*x);
    if (target === 'step') return x > 0 ? 0.8 : -0.5;
    if (target === 'parab') return -0.3 * x*x + 0.5;
    if (target === 'wiggle') return 0.4*Math.sin(3*x) + 0.3*Math.cos(5*x);
    return 0;
  }, [target]);
  const params = useMemo(() => {
    const xs = []; const ys = [];
    for (let i = 0; i < 120; i++) {
      const x = -2 + 4 * (i/119);
      xs.push(x); ys.push(targetFn(x));
    }
    const basis = Array.from({length:n}, (_, i) => {
      const center = -2 + 4 * (i + 0.5) / n;
      return { center, slope: 7 + (i % 4) * 0.7 };
    });
    const Phi = xs.map(x => [1, ...basis.map(b => 1/(1+Math.exp(-b.slope*(x-b.center))))]);
    const k = n + 1;
    const A = Array.from({length:k}, () => Array(k).fill(0));
    const v = Array(k).fill(0);
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < k; j++) {
        v[j] += Phi[i][j] * ys[i];
        for (let l = 0; l < k; l++) A[j][l] += Phi[i][j] * Phi[i][l];
      }
    }
    for (let i = 0; i < k; i++) A[i][i] += 1e-3;
    for (let i = 0; i < k; i++) {
      let piv = i;
      for (let j = i+1; j < k; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      [A[i], A[piv]] = [A[piv], A[i]];
      [v[i], v[piv]] = [v[piv], v[i]];
      for (let j = 0; j < k; j++) {
        if (j === i) continue;
        const f = A[j][i] / A[i][i];
        for (let l = i; l < k; l++) A[j][l] -= f * A[i][l];
        v[j] -= f * v[i];
      }
    }
    const coef = Array(k);
    for (let i = 0; i < k; i++) coef[i] = v[i] / A[i][i];
    return { basis, coef };
  }, [n, targetFn]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = cv.width = cv.offsetWidth || 420;
    const H = cv.height = 250;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const toX = (x) => ((x + 2) / 4) * W;
    const toY = (y) => H/2 - y * (H * 0.4);
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 240; i++) {
      const x = -2 + 4*(i/239);
      const y = targetFn(x);
      if (i === 0) ctx.moveTo(toX(x), toY(y)); else ctx.lineTo(toX(x), toY(y));
    }
    ctx.stroke();
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.beginPath();
    let mse = 0;
    for (let i = 0; i < 240; i++) {
      const x = -2 + 4*(i/239);
      let y = params.coef[0];
      params.basis.forEach((b, j) => {
        y += params.coef[j+1] * 1/(1+Math.exp(-b.slope*(x-b.center)));
      });
      mse += Math.pow(y - targetFn(x), 2);
      if (i === 0) ctx.moveTo(toX(x), toY(y)); else ctx.lineTo(toX(x), toY(y));
    }
    ctx.stroke();
    ctx.font = '11px monospace';
    ctx.fillStyle = '#fb7185'; ctx.fillRect(10, 10, 18, 3); ctx.fillStyle = '#fff'; ctx.fillText('target f(x)', 32, 14);
    ctx.fillStyle = '#22d3ee'; ctx.fillRect(10, 22, 18, 3); ctx.fillStyle = '#fff'; ctx.fillText(`NN g(x), n=${n} hidden`, 32, 26);
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(`MSE = ${(mse/240).toFixed(4)}`, 32, 40);
  }, [params, target, n, targetFn]);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Universal Function Approximator — One Hidden Layer</div>
      <canvas ref={ref} style={{width:'100%', height:250, display:'block', borderRadius:8}}/>
      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:'0.5rem', marginTop:'0.6rem'}}>
        <div>
          <div className="m4-flabel">Target function</div>
          <div style={{display:'flex', gap:'0.35rem', flexWrap:'wrap'}}>
            {[['sin','sin(2x)'],['gauss','Gaussian'],['step','Step'],['parab','Parabola'],['wiggle','Wiggle']].map(([k,l]) => (
              <button key={k} className="m4-preset-btn" onClick={()=>setTarget(k)} style={target===k?{background:'rgba(34,211,238,0.25)',borderColor:'#22d3ee'}:{}}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="m4-flabel">Hidden neurons: {n}</div>
          <input type="range" min={1} max={30} value={n} onChange={e=>setN(+e.target.value)} style={{width:'100%'}}/>
        </div>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.75rem'}}>
        <strong>Universal approximation theorem:</strong> for any continuous f(x) and any ε &gt; 0, there exists a single-hidden-layer NN g(x) with |g(x) − f(x)| &lt; ε. Slide n up to watch the cyan curve hug the rose target. More accuracy ⇒ more hidden nodes.
      </div>
    </div>
  );
}

function NNFlashcards() {
  const cards = useMemo(() => ([
    { q: 'Why are neural networks needed?', a: 'A single neuron can only divide space with a hyperplane (linearly separable patterns) — it cannot implement XOR. Networks compose complex regions from simpler ones.' },
    { q: 'Universal approximation theorem (informal)', a: 'For any continuous target f(x) and any desired precision ε > 0, there exists a neural network g(x) such that |g(x) − f(x)| < ε for all x. One hidden layer is enough.' },
    { q: 'Define δˡⱼ', a: 'δˡⱼ ≡ ∂C/∂zˡⱼ — the partial derivative of the cost with respect to the weighted input of neuron j in layer l. The "error" attributable to that neuron.' },
    { q: 'BP equation 1 (output error)', a: 'δᴸ = ∇ₐ C ⊙ σ′(zᴸ) — element-wise (cost gradient) × (activation slope) at the output layer.' },
    { q: 'BP equation 2 (back-propagate)', a: 'δˡ = ((wˡ⁺¹)ᵀ δˡ⁺¹) ⊙ σ′(zˡ) — pull error backward through transposed weights, then gate by σ′.' },
    { q: 'BP equation 3 (bias gradient)', a: '∂C/∂bˡⱼ = δˡⱼ. Each bias gradient is just the local error itself.' },
    { q: 'BP equation 4 (weight gradient)', a: '∂C/∂wˡⱼₖ = aˡ⁻¹ₖ · δˡⱼ. Weight blame = pre-activation × post-error.' },
    { q: 'Quadratic cost function C(w, b)', a: 'C(w, b) ≡ (1/2n) Σₓ ||y(x) − a||² — half-mean-squared error. The ½ cancels the 2 from differentiation; doesn\'t move the minimum.' },
    { q: 'Vectorised forward pass', a: 'aˡ = σ(wˡ aˡ⁻¹ + bˡ) where wˡ is a weight matrix and σ is applied element-wise. zˡ = wˡ aˡ⁻¹ + bˡ separates the linear part.' },
    { q: 'Notation: wˡⱼₖ', a: 'Weight from the k-th neuron in layer (l−1) to the j-th neuron in layer l. The j,k ordering is "reversed" so wˡ is a clean matrix to multiply with aˡ⁻¹.' },
    { q: 'MNIST dimensions', a: 'Input: 784-D (28×28 pixel-grey vector, scaled 0–1). Output: 10-D one-hot for digits 0–9. 60k training images, 10k testing — distinct.' },
    { q: 'When is the output layer linear?', a: 'When the task is regression / "accumulation". Linear lets outputs leave (0,1). f(w,b,x) = w·x + b — no σ.' },
    { q: 'Why is training = minimisation?', a: 'Pick w, b to minimise C(w, b). Could be millions of parameters → no analytic solution → gradient descent.' },
    { q: 'Three layer types of an FFN', a: '(1) Input "layer" — just numbers, not really a layer. (2) Hidden layers — no I/O, where the "magic" happens. (3) Output layer — often single node, sometimes different activation.' },
    { q: 'NN learning intuition', a: 'Weights & biases are control sliders. Cost C measures how wrong. Gradient ∇C tells which sliders, how far, and in which direction to move.' },
    { q: 'Mark I Perceptron (Rosenblatt 1958)', a: '400 cadmium sulfide photocells. 20×20 pixel image. Random connections to neurons. Potentiometers encoded adaptive weights — the first image-recognition NN.' },
    { q: 'V1 — primary visual cortex', a: '140 million neurons, tens of billions of connections. Detects primitive features: edges, orientation, spatial frequency, colour. "Tuned by evolution over hundreds of millions of years".' },
    { q: 'Symbolic vs sub-symbolic', a: 'Symbolic = rule-based, brittle, breaks on exceptions ("7 has a line across the top"). Sub-symbolic = vector of real numbers, "degree of 4-ness", graceful degradation.' },
    { q: 'Network is only ever as good as…', a: '…the data it is trained with. Even if f(x) ≈ y(x) on every training sample, generalisation outside that set is not guaranteed.' },
    { q: 'Hidden layers — "dark art"', a: 'No hard rule for layer count or width. Deeper ⇒ more expressive but harder to train. Active research uses neuro-evolution to design topology automatically.' },
  ]), []);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(() => new Set());
  const next = () => { setSeen(s => new Set([...s, idx])); setFlipped(false); setIdx((idx+1) % cards.length); };
  const prev = () => { setFlipped(false); setIdx((idx-1+cards.length) % cards.length); };
  const shuffle = () => { setFlipped(false); setIdx(Math.floor(Math.random()*cards.length)); };
  return (
    <div className="m4-card">
      <div className="m4-card-h">Recall Flashcards — Click to flip ({seen.size}/{cards.length} seen)</div>
      <div onClick={()=>setFlipped(f=>!f)} style={{
        background: flipped ? 'linear-gradient(135deg, rgba(52,211,153,0.14), rgba(34,211,238,0.14))' : 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(251,113,133,0.14))',
        border: `2px solid ${flipped ? 'rgba(52,211,153,0.5)' : 'rgba(167,139,250,0.5)'}`,
        borderRadius:14, padding:'1.3rem 1.2rem', minHeight:170, cursor:'pointer',
        display:'flex', flexDirection:'column', justifyContent:'center',
        transition:'all 0.25s', userSelect:'none'
      }}>
        <div style={{fontSize:'0.66rem', color:flipped?'#34d399':'#a78bfa', fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em', marginBottom:'0.55rem'}}>
          {flipped ? '◆ ANSWER' : '◇ QUESTION'} · {idx+1}/{cards.length}
        </div>
        <div style={{fontSize: flipped?'0.9rem':'1.1rem', color:'#fff', lineHeight:1.55, fontWeight: flipped?500:600}}>
          {flipped ? cards[idx].a : cards[idx].q}
        </div>
        <div style={{fontSize:'0.65rem', color:'var(--text-2)', marginTop:'0.85rem', fontStyle:'italic', textAlign:'right'}}>
          (click card to {flipped?'see question':'reveal answer'})
        </div>
      </div>
      <div style={{display:'flex', gap:'0.5rem', marginTop:'0.6rem', justifyContent:'space-between', flexWrap:'wrap'}}>
        <button className="m4-preset-btn" onClick={prev}>← Prev</button>
        <button className="m4-preset-btn" onClick={shuffle}>🔀 Shuffle</button>
        <button className="m4-preset-btn" onClick={()=>{setSeen(new Set()); setIdx(0); setFlipped(false);}}>Reset progress</button>
        <button className="m4-preset-btn" onClick={next}>Next →</button>
      </div>
    </div>
  );
}

function NNArchitectureZoo() {
  const zoo = [
    {k:'P',     n:'Perceptron',              c:'#22d3ee', d:'Single neuron, step activation. Rosenblatt 1958. The grand-parent of every NN architecture.'},
    {k:'FF',    n:'Feed Forward',            c:'#22d3ee', d:'Information flows one way only — no cycles. Input → hidden → output. The canonical "vanilla" NN.'},
    {k:'RBF',   n:'Radial Basis Network',    c:'#a78bfa', d:'Hidden units are radial basis functions centred on prototypes. Local activation around centres.'},
    {k:'DFF',   n:'Deep Feed Forward',       c:'#22d3ee', d:'FFN with many hidden layers. Modern MLP. Deeper ⇒ more expressive but harder to train.'},
    {k:'RNN',   n:'Recurrent NN',            c:'#fbbf24', d:'Hidden state feeds back into itself across time. Designed for sequences.'},
    {k:'LSTM',  n:'Long/Short-Term Memory',  c:'#fbbf24', d:'Gated RNN with a cell-state highway — fixes the vanishing-gradient problem in long sequences.'},
    {k:'GRU',   n:'Gated Recurrent Unit',    c:'#fbbf24', d:'Lighter LSTM variant. Just a reset gate and an update gate.'},
    {k:'AE',    n:'Auto Encoder',            c:'#34d399', d:'Compress through a bottleneck, then reconstruct. Unsupervised representation learning.'},
    {k:'VAE',   n:'Variational AE',          c:'#34d399', d:'AE with a stochastic Gaussian latent — generative; you can sample new points.'},
    {k:'DAE',   n:'Denoising AE',            c:'#34d399', d:'AE trained to reconstruct clean input from a corrupted version — learns robust features.'},
    {k:'SAE',   n:'Sparse AE',               c:'#34d399', d:'AE with a sparsity penalty on hidden activations — few-but-strong representations.'},
    {k:'MC',    n:'Markov Chain',            c:'#fb7185', d:'Stateful with memoryless transition probabilities. Foundational for HMMs.'},
    {k:'HN',    n:'Hopfield Network',        c:'#fb7185', d:'Fully-connected recurrent associative memory. Stable states = stored patterns.'},
    {k:'BM',    n:'Boltzmann Machine',       c:'#fb7185', d:'Stochastic recurrent net of visible + hidden binary units. Trained via energy minimisation.'},
    {k:'RBM',   n:'Restricted BM',           c:'#fb7185', d:'Bipartite BM (no intra-layer connections) — fast training via contrastive divergence.'},
    {k:'DBN',   n:'Deep Belief Network',     c:'#fb7185', d:'Stack of RBMs trained layer-by-layer. Pioneered modern deep-learning pre-training.'},
    {k:'DCN',   n:'Deep Convolutional Net',  c:'#06b6d4', d:'Convolution + pool + dense. The image-recognition workhorse (e.g. AlexNet, VGG, ResNet).'},
    {k:'DN',    n:'Deconvolutional Network', c:'#06b6d4', d:'Inverts convolutions to upsample features — image generation and segmentation.'},
    {k:'DCIGN', n:'Deep Conv Inverse Graphics Net', c:'#06b6d4', d:'Variational AE with convolutional encoder and deconvolutional decoder.'},
  ];
  const [open, setOpen] = useState(null);
  return (
    <div className="m4-card">
      <div className="m4-card-h">The Neural Network Zoo (van Veen & Leijnen, 2019)</div>
      <div style={{fontSize:'0.74rem', color:'var(--text-2)', marginBottom:'0.65rem', lineHeight:1.55}}>
        Click any architecture to read its specialism. Family colours: <span style={{color:'#22d3ee'}}>feedforward</span> · <span style={{color:'#a78bfa'}}>basis</span> · <span style={{color:'#fbbf24'}}>recurrent</span> · <span style={{color:'#34d399'}}>autoencoder</span> · <span style={{color:'#fb7185'}}>energy-based</span> · <span style={{color:'#06b6d4'}}>convolutional</span>.
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(90px, 1fr))', gap:'0.45rem'}}>
        {zoo.map(z => (
          <button key={z.k} onClick={()=>setOpen(open===z.k?null:z.k)} style={{
            background: open===z.k ? `${z.c}33` : 'rgba(15,23,42,0.45)',
            border: `1.5px solid ${open===z.k?z.c:'rgba(148,163,184,0.2)'}`,
            borderRadius:10, padding:'0.55rem 0.4rem', textAlign:'center', cursor:'pointer',
            transition:'all 0.15s', fontFamily:'inherit'
          }}>
            <div style={{fontSize:'0.95rem', fontWeight:700, color:z.c, fontFamily:'monospace'}}>{z.k}</div>
            <div style={{fontSize:'0.6rem', color:'var(--text-2)', marginTop:'0.2rem', lineHeight:1.2}}>{z.n}</div>
          </button>
        ))}
      </div>
      {open && (
        <div style={{marginTop:'0.65rem', padding:'0.75rem 0.95rem', background:`${zoo.find(z=>z.k===open).c}11`, border:`1px solid ${zoo.find(z=>z.k===open).c}66`, borderRadius:8}}>
          <div style={{fontSize:'0.88rem', color:zoo.find(z=>z.k===open).c, fontWeight:700, marginBottom:'0.35rem'}}>
            {zoo.find(z=>z.k===open).k} · {zoo.find(z=>z.k===open).n}
          </div>
          <div style={{fontSize:'0.8rem', color:'var(--text-1)', lineHeight:1.6}}>
            {zoo.find(z=>z.k===open).d}
          </div>
        </div>
      )}
    </div>
  );
}

function NNVisualCortex() {
  const layers = [
    {k:'V1',  n:'Primary Visual Cortex', d:'140 million neurons. Tens of billions of connections. Detects edges, orientations, spatial frequency, colour.', c:'#22d3ee', feature:'Edges & orientation'},
    {k:'V2',  n:'V2',  d:'Contours and simple textures. Continuity of patterns.', c:'#a78bfa', feature:'Contours'},
    {k:'V3',  n:'V3',  d:'Motion direction and depth-from-motion cues.', c:'#34d399', feature:'Motion + depth'},
    {k:'V4',  n:'V4',  d:'Complex shapes, curvature, colour combinations.', c:'#fbbf24', feature:'Shape + colour'},
    {k:'V5',  n:'V5 (MT)', d:'Coherent motion of complete object features. Object-level tracking.', c:'#fb7185', feature:'Object motion'},
    {k:'IT',  n:'Inferotemporal',  d:'Faces, places, full object recognition. Top of the ventral-stream hierarchy.', c:'#ec4899', feature:'Faces / objects'},
  ];
  const [sel, setSel] = useState(0);
  return (
    <div className="m4-card">
      <div className="m4-card-h">Visual Cortex Hierarchy → ANN Layers</div>
      <div style={{fontSize:'0.76rem', color:'var(--text-2)', lineHeight:1.6, marginBottom:'0.65rem'}}>
        Animal visual cortex shows evidence of <strong style={{color:'#22d3ee'}}>hierarchical feature abstraction</strong>: simple features (edges) → complex features (faces). Click each region.
      </div>
      <div style={{display:'flex', gap:'0.35rem', flexWrap:'wrap', marginBottom:'0.65rem'}}>
        {layers.map((l, i) => (
          <button key={l.k} onClick={()=>setSel(i)} style={{
            flex:'1 1 85px',
            background: sel===i ? `${l.c}33` : 'rgba(15,23,42,0.45)',
            border: `1.5px solid ${sel===i?l.c:'rgba(148,163,184,0.25)'}`,
            borderRadius:8, padding:'0.6rem 0.4rem', cursor:'pointer',
            transition:'all 0.15s', fontFamily:'inherit'
          }}>
            <div style={{fontSize:'1.1rem', fontWeight:800, color:l.c, fontFamily:'monospace'}}>{l.k}</div>
            <div style={{fontSize:'0.6rem', color:'var(--text-2)', marginTop:'0.2rem'}}>{l.feature}</div>
          </button>
        ))}
      </div>
      <div style={{padding:'0.75rem 0.95rem', background:`${layers[sel].c}11`, border:`1px solid ${layers[sel].c}66`, borderRadius:8}}>
        <div style={{fontSize:'0.88rem', color:layers[sel].c, fontWeight:700, marginBottom:'0.3rem'}}>{layers[sel].k} · {layers[sel].n}</div>
        <div style={{fontSize:'0.8rem', color:'var(--text-1)', lineHeight:1.55}}>{layers[sel].d}</div>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.65rem', fontSize:'0.74rem'}}>
        <strong>Conjecture for ANN's:</strong> deeper layers do more abstract processing. Lower layers learn Gabor-like edge filters; deeper layers learn parts (eyes, wheels, wings) and finally whole objects. <em>Principle of increasing abstraction.</em> Source: Riesenhuber &amp; Poggio (1999); Lee et al. (2009).
      </div>
    </div>
  );
}

function NNDigitSketcher() {
  const SIZE = 14;
  const [grid, setGrid] = useState(() => Array(SIZE*SIZE).fill(0));
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const ref = useRef(null);
  const cellSize = 14;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = SIZE * cellSize; c.height = SIZE * cellSize;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = grid[y*SIZE + x];
        ctx.fillStyle = v > 0 ? `rgba(34,211,238,${0.3 + 0.7*v})` : 'rgba(15,23,42,0.6)';
        ctx.fillRect(x*cellSize+0.5, y*cellSize+0.5, cellSize-1, cellSize-1);
      }
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    for (let i = 0; i <= SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i*cellSize, 0); ctx.lineTo(i*cellSize, c.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*cellSize); ctx.lineTo(c.width, i*cellSize); ctx.stroke();
    }
  }, [grid]);
  const paint = (e, force) => {
    if (!drawing && !force) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / cellSize);
    const cy = Math.floor((e.clientY - rect.top) / cellSize);
    if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) return;
    setGrid(g => {
      const ng = [...g];
      const v = erasing ? 0 : 1;
      ng[cy*SIZE + cx] = v;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
        const nx = cx+dx, ny = cy+dy;
        if (nx>=0 && ny>=0 && nx<SIZE && ny<SIZE) {
          ng[ny*SIZE+nx] = erasing ? Math.min(ng[ny*SIZE+nx], 0.2) : Math.max(ng[ny*SIZE+nx], 0.5);
        }
      });
      return ng;
    });
  };
  const totalLit = grid.filter(v => v > 0).length;
  return (
    <div className="m4-card">
      <div className="m4-card-h">Hand-Sketch a Digit → See the Input Vector</div>
      <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'0.85rem', alignItems:'start'}}>
        <div>
          <canvas
            ref={ref}
            onMouseDown={(e) => { setDrawing(true); paint(e, true); }}
            onMouseUp={() => setDrawing(false)}
            onMouseMove={paint}
            onMouseLeave={() => setDrawing(false)}
            style={{cursor: erasing?'cell':'crosshair', borderRadius:6, display:'block', border:'1px solid rgba(34,211,238,0.3)'}}
          />
          <div style={{display:'flex', gap:'0.4rem', marginTop:'0.45rem'}}>
            <button className="m4-preset-btn" onClick={()=>setErasing(e=>!e)} style={erasing?{background:'rgba(251,113,133,0.2)',borderColor:'#fb7185'}:{}}>{erasing?'✏ Draw':'🧹 Erase'}</button>
            <button className="m4-preset-btn" onClick={()=>setGrid(Array(SIZE*SIZE).fill(0))}>Clear</button>
          </div>
        </div>
        <div>
          <div className="m4-flabel">Input vector <Tex src={`x \\in \\mathbb{R}^{${SIZE*SIZE}}`} /> (mini MNIST has 784)</div>
          <div style={{fontSize:'0.7rem', color:'var(--text-2)', fontFamily:'monospace', maxHeight:120, overflow:'auto', background:'rgba(15,23,42,0.55)', padding:'0.5rem 0.65rem', borderRadius:6, lineHeight:1.5, border:'1px solid rgba(34,211,238,0.15)'}}>
            x = [{grid.slice(0, 28).map(v => v.toFixed(1)).join(', ')}, …<br/>      … {SIZE*SIZE-28} more values]
          </div>
          <div style={{marginTop:'0.65rem', fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.55}}>
            <div><strong style={{color:'#22d3ee'}}>Pixels lit:</strong> {totalLit} / {SIZE*SIZE}</div>
            <div><strong style={{color:'#a78bfa'}}>Sparsity:</strong> {(100*(1-totalLit/(SIZE*SIZE))).toFixed(1)}%</div>
            <div style={{marginTop:'0.45rem', color:'var(--text-2)', fontSize:'0.72rem'}}>
              Each pixel becomes one input neuron. The full MNIST setup feeds a <strong>784-D vector</strong> into the first layer, then maps to a <strong>10-D one-hot</strong> output (digit identity). Each connection between layers is a weight to learn.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NNNotationExplorer() {
  const [hover, setHover] = useState(null);
  const layers = [3, 4, 4, 2];
  const examples = {
    w: {
      sym: 'w^{l}_{jk}',
      highlight: { l:3, j:1, k:2 },
      desc: (
        <>
          Weight of the connection from the <strong>k-th</strong> neuron in layer <Tex src="(l-1)" /> to the <strong>j-th</strong> neuron in layer <Tex src="l" />. The j,k ordering looks reversed but makes <Tex src="a^{l} = \sigma(w^{l} a^{l-1} + b^{l})" /> a clean matrix product.
        </>
      ),
    },
    a: {
      sym: 'a^{l}_{j}',
      highlight: { layer:2, node:0 },
      desc: (
        <>
          Activation of the j-th neuron in layer <Tex src="l" />. Layer 1 activation <Tex src="a^{1}" /> is the raw input itself.
        </>
      ),
    },
    b: {
      sym: 'b^{l}_{j}',
      highlight: { layer:1, node:2 },
      desc: (
        <>
          Bias of the j-th neuron in layer <Tex src="l" />. Shifts the pre-activation sum before the activation function.
        </>
      ),
    },
    z: {
      sym: 'z^{l}_{j}',
      highlight: { layer:2, node:1 },
      desc: (
        <>
          Weighted input (pre-activation) of neuron j in layer <Tex src="l" />: <Tex src="z^{l} = w^{l} a^{l-1} + b^{l}" />, then <Tex src="a^{l} = \sigma(z^{l})" />.
        </>
      ),
    },
    delta: {
      sym: '\\delta^{l}_{j}',
      highlight: { layer:3, node:0 },
      desc: (
        <>
          Local error <Tex src="\delta^{l}_{j} \equiv \partial C / \partial z^{l}_{j}" />. How much "blame" neuron j in layer <Tex src="l" /> bears for the cost. Large <Tex src="|\delta|" /> ⇒ big opportunity to improve.
        </>
      ),
    },
    sigma: {
      sym: '\\sigma(z)',
      highlight: null,
      desc: (
        <>
          The logistic activation <Tex src="\sigma(z) = \dfrac{1}{1+e^{-z}}" />. Continuously differentiable to all orders — safe for gradient methods. <Tex src="\sigma'(z) = \sigma(z)\bigl(1 - \sigma(z)\bigr)" />.
        </>
      ),
    },
  };
  const active = hover ? examples[hover] : null;
  const aw = active?.highlight && 'l' in active.highlight ? active.highlight : null;
  const an = active?.highlight && 'layer' in active.highlight ? active.highlight : null;
  return (
    <div className="m4-card">
      <div className="m4-card-h">Notation Explorer — Hover or Click Each Symbol</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:'0.85rem', alignItems:'start'}}>
        <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
          {Object.keys(examples).map(k => (
            <div
              key={k}
              onMouseEnter={()=>setHover(k)}
              onMouseLeave={()=>setHover(null)}
              onClick={()=>setHover(hover===k?null:k)}
              style={{
                padding:'0.6rem 0.85rem',
                background: hover===k ? 'rgba(251,191,36,0.14)' : 'rgba(15,23,42,0.5)',
                border:`1.5px solid ${hover===k?'#fbbf24':'rgba(148,163,184,0.22)'}`,
                borderRadius:8, cursor:'pointer', transition:'all 0.15s'
              }}>
              <div style={{fontSize:'1rem', marginBottom:'0.35rem'}}><Tex src={examples[k].sym} /></div>
              <div style={{fontSize:'0.74rem', color:'var(--text-2)', lineHeight:1.6}}>{examples[k].desc}</div>
            </div>
          ))}
        </div>
        <div>
          <NNNetworkCanvas
            layers={layers}
            height={280}
            activeLayer={an?.layer ?? -1}
            activeNode={an?.node ?? null}
            activeWeight={aw}
          />
          <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
            <strong>j vs k:</strong> j indexes the destination row in <Tex src="w^{l}" />; k indexes the source column. Read <Tex src="w^{l}_{jk}" /> as "weight TO j FROM k in layer l".
          </div>
        </div>
      </div>
    </div>
  );
}

const NN_SIGMA = z => 1 / (1 + Math.exp(-z));
const NN_SIGMA_PRIME = z => { const s = NN_SIGMA(z); return s * (1 - s); };

function NNSigmoidProperties() {
  const [z, setZ] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = c.width = c.offsetWidth || 420;
    const H = c.height = 210;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const toX = z => ((z + 8) / 16) * W;
    const toY = y => H - y * H * 0.8 - 20;
    ctx.strokeStyle = 'rgba(148,163,184,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0, toY(0.5)); ctx.lineTo(W, toY(0.5)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const zz = -8 + 16*(i/200);
      if (i === 0) ctx.moveTo(toX(zz), toY(NN_SIGMA(zz))); else ctx.lineTo(toX(zz), toY(NN_SIGMA(zz)));
    }
    ctx.stroke();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const zz = -8 + 16*(i/200);
      if (i === 0) ctx.moveTo(toX(zz), toY(NN_SIGMA_PRIME(zz)*4)); else ctx.lineTo(toX(zz), toY(NN_SIGMA_PRIME(zz)*4));
    }
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(toX(z), toY(NN_SIGMA(z)), 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(toX(z), toY(NN_SIGMA_PRIME(z)*4), 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
    ctx.fillStyle = '#22d3ee'; ctx.fillRect(10, 8, 18, 3); ctx.fillStyle = '#fff'; ctx.fillText('σ(z) — activation', 32, 12);
    ctx.fillStyle = '#a78bfa'; ctx.fillRect(10, 22, 18, 3); ctx.fillStyle = '#fff'; ctx.fillText('σ′(z) × 4 — gradient', 32, 26);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`z=${z.toFixed(2)}   σ(z)=${NN_SIGMA(z).toFixed(3)}   σ′(z)=${NN_SIGMA_PRIME(z).toFixed(3)}`, 10, 44);
  }, [z]);
  return (
    <div className="m4-card">
      <div className="m4-card-h">σ(z) and σ′(z) — Drag the slider to move the marker</div>
      <canvas ref={ref} style={{width:'100%', height:210, display:'block', borderRadius:8, background:'rgba(15,23,42,0.4)'}}/>
      <div style={{marginTop:'0.55rem'}}>
        <div className="m4-flabel">z = {z.toFixed(2)}</div>
        <input type="range" min={-8} max={8} step={0.1} value={z} onChange={e=>setZ(+e.target.value)} style={{width:'100%'}}/>
      </div>
      <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.75rem'}}>
        Self-derivative identity: <Tex src="\sigma'(z) = \sigma(z)\bigl(1 - \sigma(z)\bigr)" />. Once you have a = σ(z), the gradient is free — this is why the logistic dominates as the canonical NN activation. σ′ is bell-shaped, peaks at z = 0 with σ′(0) = 0.25.
      </div>
    </div>
  );
}

function NNQuiz() {
  const qs = useMemo(() => ([
    {q:'What property makes the logistic σ the activation of choice over a step function?', opts:['Bounded in [0,1]', 'Easy to compute', 'Differentiable to all orders → safe for gradient methods', 'Output is monotonic'], a:2, expl:'σ is continuously differentiable, so chain-rule based methods (backpropagation) work. The step function is not differentiable at the threshold — gradient descent stalls.'},
    {q:'A neural network with one hidden layer can…', opts:['only model linear functions', 'approximate any continuous function to arbitrary precision', 'always train to zero error', 'only do classification, not regression'], a:1, expl:'Universal approximation theorem — one hidden layer suffices for arbitrary precision, though potentially with very many neurons.'},
    {q:'What is δˡⱼ in the backprop equations?', opts:['Output activation of neuron j in layer l', '∂C/∂zˡⱼ — the local error', 'Bias of neuron j in layer l', 'Layer-wise learning rate'], a:1, expl:'δˡⱼ ≡ ∂C/∂zˡⱼ. It captures how much that neuron is "to blame" for the cost.'},
    {q:'Backprop equation 4 (weight gradient) is…', opts:['∂C/∂wˡⱼₖ = δˡⱼ', '∂C/∂wˡⱼₖ = aˡ⁻¹ₖ · δˡⱼ', '∂C/∂wˡⱼₖ = aˡⱼ · δˡ⁻¹ₖ', '∂C/∂wˡⱼₖ = σ′(zˡⱼ)'], a:1, expl:'∂C/∂wˡⱼₖ = aˡ⁻¹ₖ · δˡⱼ. Pre-layer activation × post-layer error.'},
    {q:'Why is the constant ½ added in the quadratic cost?', opts:['To normalise into [0,1]', 'To cancel the 2 that appears when differentiating x²', 'It is required for convexity', 'No reason — convention'], a:1, expl:'Differentiating ½x² gives x — much cleaner than 2x. The factor does not affect the location of the minimum.'},
    {q:'Vectorised forward pass at layer l is…', opts:['aˡ = wˡ aˡ⁻¹ + bˡ', 'aˡ = σ(wˡ aˡ⁻¹) + bˡ', 'aˡ = σ(wˡ aˡ⁻¹ + bˡ)', 'aˡ = σ((wˡ)ᵀ aˡ⁻¹ + bˡ)'], a:2, expl:'Linear part first: zˡ = wˡ aˡ⁻¹ + bˡ. Then σ applied element-wise: aˡ = σ(zˡ).'},
    {q:'For MNIST what are x and y dimensions?', opts:['x: 28-D, y: 10-D', 'x: 784-D, y: 10-D', 'x: 784-D, y: 1-D', 'x: 28×28-D, y: 28×28-D'], a:1, expl:'28×28 = 784 input pixels (greyscale, normalised). One-hot 10-D output for digits 0–9.'},
    {q:'In the formula wˡⱼₖ, what does j index?', opts:['Source neuron in layer l−1', 'Destination neuron in layer l', 'Layer index', 'Sample index'], a:1, expl:'j = destination (layer l, row of weight matrix), k = source (layer l−1, column). So wˡ has shape (|layer l|, |layer l−1|).'},
    {q:'BP equation 1 (output layer error) is…', opts:['δᴸ = (aᴸ − y)', 'δᴸ = ∇ₐC ⊙ σ′(zᴸ)', 'δᴸ = (wᴸ)ᵀδᴸ⁻¹', 'δᴸ = σ′(aᴸ)'], a:1, expl:'δᴸ = ∇ₐC ⊙ σ′(zᴸ). For MSE this becomes (aᴸ − y) ⊙ σ′(zᴸ).'},
    {q:'Why are hidden layers called "hidden"?', opts:['They are kept secret in production', 'They are inactive during training', 'They have no direct input or output to the outside world', 'They use a different activation'], a:2, expl:'No I/O. They sit between input and output — we can examine them in research but they don\'t drive outputs directly.'},
    {q:'What does the Universal Approximation Theorem NOT guarantee?', opts:['Existence of an approximating NN', 'That the NN has one hidden layer', 'That a practical training procedure will find it', 'Arbitrary precision'], a:2, expl:'The theorem is existential — it says g(x) exists but says nothing about how to find it via training. In practice, finding it might need huge networks or fail entirely.'},
    {q:'What is the relationship between Lecture 14 (one neuron) and Lecture 15 (network)?', opts:['Networks replace neurons entirely', 'A network composes many neurons to overcome the linear-separability limit (e.g. XOR)', 'Networks are slower and rarely used', 'They are unrelated'], a:1, expl:'A single neuron is limited to linearly separable patterns. Composing neurons into layers escapes that limit and gives universal approximation.'},
  ]), []);
  const [picked, setPicked] = useState({});
  const [showAll, setShowAll] = useState(false);
  const score = Object.keys(picked).filter(i => picked[i] === qs[i].a).length;
  const answered = Object.keys(picked).length;
  return (
    <div className="m4-card">
      <div className="m4-card-h">Lecture 15 Quiz — 12 Questions</div>
      <div style={{display:'flex', gap:'0.7rem', alignItems:'center', marginBottom:'0.7rem', flexWrap:'wrap'}}>
        <div style={{fontSize:'0.78rem', color:'var(--text-2)'}}>Answered: <strong style={{color:'#22d3ee'}}>{answered}/{qs.length}</strong></div>
        <div style={{fontSize:'0.78rem', color:'var(--text-2)'}}>Correct: <strong style={{color:'#34d399'}}>{score}</strong></div>
        {answered === qs.length && (
          <div style={{fontSize:'0.78rem', padding:'0.18rem 0.55rem', background:score===qs.length?'rgba(52,211,153,0.18)':'rgba(251,191,36,0.18)', border:`1px solid ${score===qs.length?'#34d399':'#fbbf24'}`, borderRadius:6, color:score===qs.length?'#34d399':'#fbbf24', fontWeight:700}}>
            {score === qs.length ? '🏆 Perfect!' : `${Math.round(100*score/qs.length)}%`}
          </div>
        )}
        <button className="m4-preset-btn" onClick={()=>{setPicked({}); setShowAll(false);}}>Reset</button>
        <button className="m4-preset-btn" onClick={()=>setShowAll(s=>!s)}>{showAll?'Hide all':'Reveal all'}</button>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:'0.6rem'}}>
        {qs.map((q, i) => (
          <div key={i} style={{background:'rgba(15,23,42,0.5)', border:'1px solid rgba(148,163,184,0.2)', borderRadius:8, padding:'0.7rem 0.85rem'}}>
            <div style={{fontSize:'0.84rem', color:'#fff', fontWeight:600, marginBottom:'0.5rem', lineHeight:1.5}}>
              <span style={{color:'#a78bfa', marginRight:'0.4rem'}}>Q{i+1}.</span>{q.q}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'0.3rem'}}>
              {q.opts.map((o, oi) => {
                const isPicked = picked[i] === oi;
                const isCorrect = oi === q.a;
                const shouldShow = (i in picked) || showAll;
                return (
                  <button
                    key={oi}
                    onClick={() => setPicked(p => ({...p, [i]: oi}))}
                    style={{
                      textAlign:'left', padding:'0.45rem 0.75rem',
                      background: shouldShow ? (isCorrect ? 'rgba(52,211,153,0.18)' : isPicked ? 'rgba(251,113,133,0.18)' : 'rgba(15,23,42,0.4)') : (isPicked ? 'rgba(34,211,238,0.15)' : 'rgba(15,23,42,0.4)'),
                      border: `1px solid ${shouldShow ? (isCorrect ? '#34d399' : isPicked ? '#fb7185' : 'rgba(148,163,184,0.2)') : (isPicked ? '#22d3ee' : 'rgba(148,163,184,0.2)')}`,
                      borderRadius:6, cursor:'pointer',
                      color: shouldShow && isCorrect ? '#34d399' : 'var(--text-1)',
                      fontSize:'0.78rem', fontFamily:'inherit', lineHeight:1.45
                    }}>
                    {shouldShow && isCorrect ? '✓ ' : shouldShow && isPicked ? '✗ ' : ''}{o}
                  </button>
                );
              })}
            </div>
            {((i in picked) || showAll) && (
              <div style={{marginTop:'0.5rem', padding:'0.5rem 0.75rem', background:'rgba(34,211,238,0.08)', borderLeft:'2px solid #22d3ee', borderRadius:'0 6px 6px 0', fontSize:'0.74rem', color:'var(--text-1)', lineHeight:1.5}}>
                <strong style={{color:'#22d3ee'}}>Why:</strong> {q.expl}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NeuralNetworksTab() {
  const [sec, setSec] = useState('overview');
  return (
    <div>
      <div className="m4-algo-tabs">
        {[
          ['overview', 'Overview'],
          ['biology', 'Biological Roots'],
          ['mnist', 'MNIST Case'],
          ['arch', 'Architectures'],
          ['training', 'Training & Cost'],
          ['notation', 'Notation'],
          ['backprop', 'Backpropagation'],
          ['universal', 'Universal Approx.'],
          ['memorise', 'Memorise'],
        ].map(([v,l]) => (
          <button key={v} className={`m4-algo-tab ${sec===v?'m4-algo-tab--on':''}`} onClick={()=>setSec(v)}>{l}</button>
        ))}
      </div>

      {sec === 'overview' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(167,139,250,0.08) 0%,rgba(34,211,238,0.08) 100%)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',flexWrap:'wrap',gap:'0.45rem'}}>
            {[['XOR','Need >1 neuron','#fb7185'],['Layers','Input + hidden + output','#22d3ee'],['σ','Differentiable activation','#34d399'],['MSE','Quadratic cost','#fbbf24'],['∇C','Gradient descent','#a78bfa'],['Backprop','BP-1 to BP-4','#06b6d4'],['Universal','Approx. any continuous f','#ec4899']].map(([k,v,col])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:'0.4rem',background:`${col}11`,border:`1px solid ${col}33`,borderRadius:6,padding:'3px 9px'}}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:col,fontFamily:'monospace'}}>{k}</span>
                <span style={{fontSize:'0.67rem',color:'var(--text-2)'}}>{v}</span>
              </div>
            ))}
          </div>

          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Why Neural Networks?</div>
              <ul className="m4-bullets" style={{fontSize:'0.78rem', lineHeight:1.65}}>
                <li>A <strong>single neuron</strong> can only divide space with a hyperplane — <em>linearly separable</em> patterns only.</li>
                <li>It cannot implement <strong>XOR</strong> (or anything that reduces to XOR).</li>
                <li>A <strong>network of neurons</strong> composes more complex regions from these linearly separable ones.</li>
                <li>In fact, neural networks can approximate <strong>any continuous function</strong>! (Universal approximation theorem)</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Two essential design dials</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <tbody>
                  <tr><td className="pk">Topology</td><td>How many layers? How many nodes per layer? (the "hardware")</td></tr>
                  <tr><td className="pk">Parameters</td><td>What are the weights and biases? (the "software")</td></tr>
                </tbody>
              </table>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">The Promise — Universal Function Approximation</div>
              <div style={{fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65}}>
                For any target function f(x) and desired precision ε &gt; 0, there exists a neural network with output g(x) such that:
              </div>
              <Tex src="|g(x) - f(x)| < \epsilon \quad \text{for all } x" block />
              <div className="m4-infobox" style={{marginTop:'0.5rem', fontSize:'0.74rem'}}>
                <strong>Holds with just one hidden layer!</strong> But "exists" ≠ "easy to train". More precision typically needs <em>many more nodes</em>.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Conceptually</div>
              <div style={{fontSize:'0.74rem', color:'var(--text-2)', lineHeight:1.6}}>
                A NN is just a 7-segment display with a lot more segments (now called pixels) and graded input (vs binary).
              </div>
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNArchitectureBuilder />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">The Big Themes of Lecture 15</div>
            <table className="m4-ptable" style={{fontSize:'0.76rem'}}>
              <thead><tr><th>Theme</th><th>Question it answers</th></tr></thead>
              <tbody>
                <tr><td className="pk">Biological inspiration</td><td>Where does the architecture come from? — V1, V2, hierarchies, Allen Atlas.</td></tr>
                <tr><td className="pk">Case study</td><td>How does a real classification task (MNIST) shape input, output, and topology?</td></tr>
                <tr><td className="pk">Architecture</td><td>What variants exist? — the Neural Network Zoo.</td></tr>
                <tr><td className="pk">Cost</td><td>How do we measure how wrong the network is? — MSE / quadratic cost.</td></tr>
                <tr><td className="pk">Training</td><td>How do we find good weights? — Gradient descent on ∇C(w, b).</td></tr>
                <tr><td className="pk">Backpropagation</td><td>How do we compute every partial derivative? — Four equations + an algorithm.</td></tr>
                <tr><td className="pk">Universal approx.</td><td>What can a NN actually represent? — Any continuous function.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'biology' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Inspiration — Biological Brains</div>
              <div style={{fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65}}>
                The <strong>Allen Mouse Brain Connectivity Atlas</strong> (Oh et al., <em>Nature</em>, 2014) was the first detailed map of any mammal's neural network.
              </div>
              <ul className="m4-bullets" style={{fontSize:'0.74rem', marginTop:'0.5rem'}}>
                <li>Dense multi-coloured network of neural connections, mapped in 3D.</li>
                <li>Fibrous branching structures form the overall brain shape.</li>
                <li>Demonstrates the topological complexity ANNs try to capture.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Mark I Perceptron (Rosenblatt, 1958)</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                <li><strong>400 cadmium sulfide photocells</strong></li>
                <li><strong>20 × 20 pixel</strong> image input</li>
                <li><strong>Randomly connected</strong> to neurons</li>
                <li><strong>Potentiometers</strong> encode the adaptive weights</li>
              </ul>
              <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
                Rosenblatt's original Mk I was designed for <strong>image recognition</strong>. Architecture: Mosaic of Sensory Points → Projection Area → Association System → Response Units (R₁, R₂, …, Rₙ) with feedback circuits running backward. The very first NN!
              </div>
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNVisualCortex />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Hierarchical Models of Object Recognition (Riesenhuber &amp; Poggio, 1999)</div>
            <div style={{fontSize:'0.76rem', color:'var(--text-1)', lineHeight:1.6, marginBottom:'0.5rem'}}>
              <em>Some</em> biological evidence suggests animal visual cortices operate in a hierarchy — from simple features (edge orientation) to complex features (faces).
            </div>
            <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
              <thead><tr><th>Layer</th><th>Operation</th><th>Output</th></tr></thead>
              <tbody>
                <tr><td className="pk">Input image</td><td>—</td><td>Raw pixels</td></tr>
                <tr><td className="pk">Simple cells (S1)</td><td><strong>Weighted sum</strong></td><td>Edge orientation detectors (−, /, |, \)</td></tr>
                <tr><td className="pk">Complex cells (C1)</td><td><strong>MAX</strong> (pool)</td><td>Pooled over orientations</td></tr>
                <tr><td className="pk">Composite feature cells (S2)</td><td><strong>Weighted sum</strong></td><td>Combine multiple C1 outputs</td></tr>
                <tr><td className="pk">Complex composite cells (C2)</td><td><strong>MAX</strong> (pool)</td><td>Higher-level combinations</td></tr>
                <tr><td className="pk">View-tuned cells</td><td>—</td><td>Top-level object / view representations</td></tr>
              </tbody>
            </table>
            <div style={{fontSize:'0.72rem', color:'var(--text-2)', marginTop:'0.5rem', lineHeight:1.55}}>
              <strong>Convention:</strong> solid arrows = weighted sum operations. Dashed arrows = MAX (pooling) operations. This alternating "filter / pool" pattern is the direct ancestor of convolutional neural networks.
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Layers in ANN's — The Conjecture</div>
            <div className="m4-two-col">
              <div>
                <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                  <li>ANN's likely do something <em>analogous</em> to human vision.</li>
                  <li>Deeper layers do more abstract processing — <strong>principle of increasing abstraction</strong>.</li>
                  <li>Doesn't just apply to vision (language, audio, robotics too).</li>
                  <li>However, deeper networks are generally <strong>harder to train</strong>.</li>
                  <li><strong>More expressive ⇒ harder to find solution.</strong></li>
                </ul>
              </div>
              <div className="m4-infobox" style={{fontSize:'0.74rem'}}>
                <strong>Empirical evidence</strong> from Lee et al. (ICML 2009): A deep convolutional belief network trained on faces, cars, airplanes, motorbikes shows:
                <ul style={{margin:'0.4rem 0 0 0', paddingLeft:'1rem'}}>
                  <li><strong>Lower layers:</strong> edge-like / Gabor-style patches.</li>
                  <li><strong>Higher layers:</strong> recognisable parts — eyes, wheels, wings.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {sec === 'mnist' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Recognising Hand-Written Digits — Why It Matters</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                <li>Classic neural network success story (Nielsen, 2019).</li>
                <li><strong>Recognition uses:</strong> postal services, digitising old manuscripts, accessibility for the visually impaired.</li>
                <li><strong>Search uses:</strong> handwriting → text conversion, news/sentiment analysis on scanned content.</li>
                <li>Most freehand-annotation drawing apps now have handwriting search.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Why Is It Hard for Traditional Computers?</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                <li>Over <strong>7 billion people</strong> in the world, each with unique handwriting.</li>
                <li>Variable quality of writing, media, contrast, lighting.</li>
                <li>Positioning on the page (e.g. postcode squares).</li>
                <li>Security and trust (election ballots, signatures).</li>
              </ul>
              <div className="m4-warnbox" style={{marginTop:'0.55rem', fontSize:'0.73rem'}}>
                <strong>Rule-based techniques are too brittle.</strong> The problem requires <em>approximation, judgement, and graceful degradation</em> — exactly what neural networks provide.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Symbolic vs Sub-Symbolic Approaches</div>
            <table className="m4-ptable" style={{fontSize:'0.76rem'}}>
              <thead><tr><th></th><th>Symbolic ("rule-based")</th><th>Sub-symbolic</th></tr></thead>
              <tbody>
                <tr><td className="pk">Style</td><td>"7 has a line across the top, 4 comes to a point at the top…"</td><td>Vector of real numbers — "degree of 4-ness"</td></tr>
                <tr><td className="pk">Failure mode</td><td>Many exceptions, no consistency — <strong>brittle</strong></td><td><strong>Graceful degradation</strong> — values shift smoothly</td></tr>
                <tr><td className="pk">Interpretability</td><td>Very high (rules in plain English)</td><td>Low — may not be intuitively meaningful</td></tr>
                <tr><td className="pk">Examples</td><td>Expert systems, decision trees</td><td>Neural networks (values at hidden nodes)</td></tr>
              </tbody>
            </table>
            <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              ANN's <strong>learn</strong> their own sub-symbolic values from many examples — 1,000s, 1,000,000s, or even 1,000,000,000s depending on difficulty. Made possible by the exponential growth in computing power.
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNDigitSketcher />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">The MNIST Dataset</div>
            <div className="m4-two-col">
              <div>
                <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                  <li>Created in <strong>1998</strong> from US Census Bureau employees + US high school students <em>(bias?)</em>.</li>
                  <li>Normalised to <strong>28 × 28 pixels</strong>.</li>
                  <li><strong>60,000 training</strong> images + <strong>10,000 testing</strong> — distinct sets.</li>
                  <li>Original: National Institute of Standards and Technology — LeCun, Cortes, Burges.</li>
                  <li>Many replicas exist (Kaggle, scikit-learn, etc.).</li>
                </ul>
              </div>
              <div>
                <div className="m4-flabel">Input/output dimensions for MNIST</div>
                <Tex src="\vec{x} \in \mathbb{R}^{784} \quad \text{(28×28 pixels)}" block />
                <Tex src="\vec{y} \in \mathbb{R}^{10} \quad \text{(one-hot digit)}" block />
                <div style={{fontSize:'0.74rem', color:'var(--text-2)', marginTop:'0.45rem', lineHeight:1.55}}>
                  For example: <Tex src="\vec{y} = [0,0,0,0,0,0,1,0,0,0]^T" /> for a '6'. The functional representation is <Tex src="y(\vec{x}) = \vec{y}" />.
                </div>
              </div>
            </div>
            <div className="m4-hr"/>
            <div className="m4-flabel">Training goal</div>
            <div className="m4-two-col">
              <div className="m4-infobox" style={{background:'rgba(34,211,238,0.08)'}}>
                <div style={{fontSize:'0.74rem', color:'#22d3ee', fontWeight:700, marginBottom:'0.3rem'}}>IDEAL</div>
                <Tex src="f(\vec{x}) = y(\vec{x}) \text{ for all } \vec{x}" block/>
              </div>
              <div className="m4-warnbox" style={{background:'rgba(251,191,36,0.08)'}}>
                <div style={{fontSize:'0.74rem', color:'#fbbf24', fontWeight:700, marginBottom:'0.3rem'}}>REALITY</div>
                <Tex src="f(\vec{x}) \approx y(\vec{x}) \text{ for all samples } \vec{x}" block/>
              </div>
            </div>
            <div style={{fontSize:'0.74rem', color:'var(--text-2)', marginTop:'0.55rem', textAlign:'center', fontStyle:'italic'}}>
              ➡ A network is only ever as good as the data it is trained with.
            </div>
          </div>
        </div>
      )}

      {sec === 'arch' && (
        <div>
          <NNArchitectureZoo />

          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">Feed-Forward Networks (FFNN) — The Workhorse</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                <li>Many variants of ANNs exist — most are based on the FFNN.</li>
                <li><strong>Input "layer"</strong> — not really a layer, just numbers passed in.</li>
                <li>One or more <strong>hidden layers</strong> — where the "magic" happens.</li>
                <li><strong>Output layer</strong> — often a single node (binary classifier), and often a different activation.</li>
                <li>Biases are typically <em>not shown</em> in diagrams (but they are there!).</li>
                <li>Each neuron has only <strong>one output</strong>, replicated across destination connections.</li>
              </ul>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">The Three Layer Types</div>
              <table className="m4-ptable" style={{fontSize:'0.75rem'}}>
                <thead><tr><th>Layer</th><th>Role</th></tr></thead>
                <tbody>
                  <tr><td className="pk" style={{color:'#22d3ee'}}>Input</td><td>Just numbers passed in (not really a layer). Dimensions set by the problem.</td></tr>
                  <tr><td className="pk" style={{color:'#a78bfa'}}>Hidden</td><td>"Hidden" in the sense of no I/O. We can examine values in research, but they don't drive any outputs. <strong>Where most of the work happens.</strong></td></tr>
                  <tr><td className="pk" style={{color:'#fb7185'}}>Output</td><td>Often a single node (e.g. binary classifier). Often has a <strong>different activation</strong> — e.g. linear ("accumulation") with no [0,1] restriction.</td></tr>
                </tbody>
              </table>
              <div className="m4-hr"/>
              <div className="m4-flabel">Linear output node (regression)</div>
              <Tex src="f(\vec{w}, b, \vec{x}) = \vec{w}\cdot\vec{x} + b" block />
              <div style={{fontSize:'0.72rem', color:'var(--text-2)', marginTop:'0.35rem'}}>
                No σ — output can be any real number.
              </div>
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNArchitectureBuilder />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Design — Choosing the Architecture</div>
            <table className="m4-ptable" style={{fontSize:'0.76rem'}}>
              <thead><tr><th>Decision</th><th>Driver</th></tr></thead>
              <tbody>
                <tr><td className="pk">Input layer size</td><td>Problem representation. Example: 64×64 greyscale → 4,096 input neurons; pixel values 0–255 scaled to 0–1.</td></tr>
                <tr><td className="pk">Output layer size</td><td>Problem representation. Example: binary classifier "is this a 9?" → 1 output; multi-class → one neuron per class.</td></tr>
                <tr><td className="pk">Output threshold</td><td>For binary classification: &lt; 0.5 → "not a 9", &gt; 0.5 → "is a 9".</td></tr>
                <tr><td className="pk">Hidden layers — count</td><td><strong>"Dark art."</strong> No hard and fast rules. Lots of research on heuristics and trade-offs.</td></tr>
                <tr><td className="pk">Hidden layers — width</td><td>Same. Some empirical precedents, but mostly experimentation.</td></tr>
              </tbody>
            </table>
            <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              <strong>Neuro-evolution:</strong> active research uses <em>adaptive algorithms</em> to design the NN configuration / topology, as well as the weights. Analogous to the "hardware" (topology) and the "software" (weights).
            </div>
          </div>
        </div>
      )}

      {sec === 'training' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Supervised Learning — Recap</div>
              <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                <li>Set of sample inputs with answers — the <strong>training set</strong>.</li>
                <li>The teacher ("supervisor") provides the answers.</li>
                <li>Goal: find parameters that match the answers as closely as possible.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Toy example — moon escape velocity</div>
              <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
                <thead><tr><th>Trial</th><th>x (km/s)</th><th>y</th></tr></thead>
                <tbody>
                  <tr><td className="pk">1</td><td>1</td><td>0 (no)</td></tr>
                  <tr><td className="pk">2</td><td>5</td><td>1 (yes)</td></tr>
                  <tr><td className="pk">3</td><td>3</td><td>1</td></tr>
                  <tr><td className="pk">4</td><td>2</td><td>0</td></tr>
                  <tr><td className="pk">5</td><td>2.5</td><td>1</td></tr>
                  <tr><td className="pk">6</td><td>2.2</td><td>0</td></tr>
                </tbody>
              </table>
              <div style={{fontSize:'0.72rem', color:'var(--text-2)', marginTop:'0.35rem'}}>Single input, single output — same shape as the data we used to train a single neuron.</div>
            </div>
            <div className="m4-card">
              <div className="m4-card-h">Cost Function — Many Names, One Idea</div>
              <div style={{fontSize:'0.76rem', color:'var(--text-1)', lineHeight:1.65}}>
                We need a measure of the <strong>distance</strong> between network estimates and "teacher" answers.
              </div>
              <div className="m4-flabel" style={{marginTop:'0.5rem'}}>Also called…</div>
              <div style={{display:'flex', gap:'0.3rem', flexWrap:'wrap'}}>
                {['Cost', 'Objective', 'Loss', 'Fitness', 'Error'].map(t => (
                  <span key={t} style={{fontSize:'0.7rem', padding:'2px 8px', background:'rgba(34,211,238,0.12)', border:'1px solid rgba(34,211,238,0.3)', borderRadius:6, color:'#22d3ee'}}>{t} function</span>
                ))}
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Vector-space view</div>
              <div style={{fontSize:'0.74rem', color:'var(--text-2)', lineHeight:1.6}}>
                A network with M inputs and N outputs is a function <Tex src="f : \mathbb{R}^M \to \mathbb{R}^N" />. Given <Tex src="x" />, compare <Tex src="f(x)" /> and <Tex src="y(x)" /> — both points in <Tex src="\mathbb{R}^{N}" />. The "distance" between them is the distance from the origin to:
              </div>
              <Tex src="\vec{v} = f(\vec{x}) - y(\vec{x})" block />
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Norms — How We Measure "Distance"</div>
            <div className="m4-two-col">
              <div>
                <div className="m4-flabel">Absolute value norm (1-D)</div>
                <Tex src="\|v\| = |v|" block />
                <div style={{fontSize:'0.72rem', color:'var(--text-2)', marginTop:'0.3rem'}}>Simplest case, single dimension.</div>
              </div>
              <div>
                <div className="m4-flabel">Euclidean / L² norm (n-D)</div>
                <Tex src="\|\vec{v}\|_2 = \sqrt{v_1^2 + \cdots + v_n^2}" block />
                <div style={{fontSize:'0.72rem', color:'var(--text-2)', marginTop:'0.3rem'}}>The most familiar norm on ℝⁿ — from Pythagoras.</div>
              </div>
            </div>
            <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              A <strong>norm</strong> is a function from a vector space to non-negative real numbers that behaves like a distance — equivalently, the "length" of a difference vector.
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Mean Squared Error (MSE / Least Squares / Quadratic Cost)</div>
            <div className="m4-flabel">Multi-sample MSE</div>
            <Tex src="MSE \equiv \frac{1}{n} \sum_{s=1}^{S} \bigl(\|f(\vec{x_s}) - y(\vec{x_s})\|_2\bigr)^2" block />
            <div style={{fontSize:'0.73rem', color:'var(--text-2)', marginTop:'0.35rem'}}>No need to take the square root — L² norm is already squared.</div>
            <div className="m4-hr"/>
            <div className="m4-flabel">Nielsen's notation — quadratic cost</div>
            <Tex src="C(w, b) \equiv \frac{1}{2n} \sum_{\vec{x}} \bigl(\|y(\vec{x}) - a\|_2\bigr)^2" block />
            <VarTable vars={[
              ['w', 'The collection of all weights in the network'],
              ['b', 'The collection of all biases'],
              ['n', 'Number of training samples'],
              ['a', 'Network outputs (activations); a function of w, b, x'],
              ['\\frac{1}{2}', 'Conveniently cancels the 2 from differentiation — doesn\'t affect the result'],
            ]} />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Training = Minimisation</div>
            <div style={{fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65, marginBottom:'0.45rem'}}>
              <strong>Goal:</strong> find weights and biases that minimise C(w, b).
            </div>
            <Tex src="C(w, b) \equiv \frac{1}{2n} \sum_{\vec{x}} \bigl(\|y(\vec{x}) - a\|_2\bigr)^2" block />
            <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.65, marginTop:'0.45rem'}}>
              <li>Could be <strong>millions</strong> of weights and biases.</li>
              <li>Can't solve analytically.</li>
              <li>But we can use <strong>gradient descent!</strong></li>
            </ul>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Gradient Descent in n Dimensions — Recall</div>
            <div className="m4-two-col">
              <div>
                <div className="m4-flabel">Algorithm</div>
                <div className="m4-pseudocode" style={{fontSize:'0.74rem'}}>{`1. 𝐱 ← random initial vector
2. repeat:
3.    𝐱 ← 𝐱 − α · ∇f(𝐱)
4. until stopping criterion reached
5. return 𝐱`}</div>
              </div>
              <div>
                <div className="m4-flabel">Gradient of cost</div>
                <Tex src="\nabla C = \begin{bmatrix} \partial C/\partial w_1 \\ \vdots \\ \partial C/\partial w_p \\ \partial C/\partial b_1 \\ \vdots \\ \partial C/\partial b_q \end{bmatrix}" block />
              </div>
            </div>
            <div className="m4-warnbox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              <strong>Problem:</strong> how do we calculate all these partial derivatives efficiently? <strong>Next:</strong> the secret sauce — <span style={{color:'#fbbf24', fontWeight:700}}>backpropagation!</span>
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNCostContour />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">What Does NN Learning Look Like? — Intuition</div>
            <div style={{fontSize:'0.76rem', color:'var(--text-1)', lineHeight:1.7}}>
              Imagine controlling a process using a <strong>panel of sliders</strong>:
            </div>
            <ul className="m4-bullets" style={{fontSize:'0.75rem', lineHeight:1.7, marginTop:'0.4rem'}}>
              <li>Weights and biases are <strong>parameters</strong> — the sliders.</li>
              <li>We want to minimise the cost C — how wrong the network is.</li>
              <li>We want to reduce C by changing the weights and biases.</li>
              <li>But <strong>some sliders have more effect than others</strong>.</li>
              <li><em>How do we decide how far, and in which direction, to move each one?</em></li>
            </ul>
            <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.75rem'}}>
              Answer: <strong>gradient descent</strong>. If we know ∇C(w, b) — i.e. ∂C/∂w for every w and ∂C/∂b for every b — we can take a step downhill on the cost surface.
            </div>
          </div>
        </div>
      )}

      {sec === 'notation' && (
        <div>
          <NNNotationExplorer />

          <div className="m4-two-col" style={{marginTop:'0.75rem'}}>
            <div className="m4-card">
              <div className="m4-card-h">From Nets to Matrices — Activation Equation</div>
              <div className="m4-flabel">Component form</div>
              <Tex src="a^l_j = \sigma\!\left(\sum_k w^l_{jk}\, a^{l-1}_k + b^l_j\right)" block />
              <VarTable vars={[
                ['\\sigma', 'Logistic activation, applied element-wise'],
                ['a^{l-1}_k', 'Previous-layer activation (input k)'],
                ['w^l_{jk}', 'This-layer weight (from neuron k in layer l−1 to neuron j in layer l)'],
                ['b^l_j', 'This-layer bias for neuron j'],
              ]} />
              <div className="m4-hr"/>
              <div className="m4-flabel">Beautiful and compact matrix form</div>
              <Tex src="\boxed{a^l = \sigma(w^l a^{l-1} + b^l)}" block />
              <div style={{fontSize:'0.73rem', color:'var(--text-2)', marginTop:'0.35rem'}}>
                Let <Tex src="w^{l}" /> be a matrix of weights for layer <Tex src="l" />, with <Tex src="w_{jk}" /> in row <Tex src="j" /> and column <Tex src="k" />. Define <Tex src="a^{l}" /> and <Tex src="b^{l}" /> as you'd expect. <Tex src="\sigma" /> is applied element-wise.
              </div>
            </div>

            <div className="m4-card">
              <div className="m4-card-h">Separate the Linear Part — Define zˡ</div>
              <Tex src="\boxed{a^l = \sigma(z^l), \quad z^l = w^l a^{l-1} + b^l}" block />
              <div className="m4-flabel" style={{marginTop:'0.5rem'}}>Component form</div>
              <Tex src="z^l_j = \sum_k w^l_{jk}\, a^{l-1}_k + b^l_j" block />
              <div style={{fontSize:'0.73rem', color:'var(--text-2)', marginTop:'0.35rem'}}>
                <Tex src="z^{l}_{j}" /> is the <strong>weighted input</strong> to the activation function for neuron <Tex src="j" /> in layer <Tex src="l" />.
              </div>
              <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
                Splitting linear from non-linear is convenient for backpropagation — many derivatives are expressed in terms of z rather than a.
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Single-Neuron Schematic — The Building Block</div>
            <div className="m4-two-col">
              <div>
                <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
                  <li>Inputs x₁, x₂, …, xₙ enter via weights w₁, w₂, …, wₙ.</li>
                  <li>The summing junction (⊕) computes z = ∑ wᵢxᵢ + b.</li>
                  <li>Then σ produces a = σ(z), shown as an S-curve in the activation box.</li>
                  <li>Threshold check: a &gt; 0.5? — classification verdict.</li>
                </ul>
              </div>
              <div>
                <NNSigmoidProperties />
              </div>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Notation Cheat Sheet</div>
            <table className="m4-ptable" style={{fontSize:'0.74rem'}}>
              <thead><tr><th>Symbol</th><th>Meaning</th><th>Shape (typ.)</th></tr></thead>
              <tbody>
                <tr><td className="pk"><Tex src="w^l_{jk}"/></td><td>Weight from neuron k (layer l−1) to neuron j (layer l)</td><td>scalar</td></tr>
                <tr><td className="pk"><Tex src="w^l"/></td><td>Weight matrix at layer l</td><td>(|l|, |l−1|)</td></tr>
                <tr><td className="pk"><Tex src="b^l_j"/></td><td>Bias of neuron j in layer l</td><td>scalar</td></tr>
                <tr><td className="pk"><Tex src="b^l"/></td><td>Bias vector at layer l</td><td>(|l|, 1)</td></tr>
                <tr><td className="pk"><Tex src="a^l_j"/></td><td>Activation of neuron j in layer l</td><td>scalar</td></tr>
                <tr><td className="pk"><Tex src="a^l"/></td><td>Activation vector at layer l</td><td>(|l|, 1)</td></tr>
                <tr><td className="pk"><Tex src="z^l_j"/></td><td>Weighted input (pre-activation) of neuron j in layer l</td><td>scalar</td></tr>
                <tr><td className="pk"><Tex src="z^l"/></td><td>Pre-activation vector at layer l</td><td>(|l|, 1)</td></tr>
                <tr><td className="pk"><Tex src="\delta^l_j"/></td><td>Local error of neuron j in layer l — <Tex src="\partial C / \partial z^{l}_{j}" /></td><td>scalar</td></tr>
                <tr><td className="pk"><Tex src="L"/></td><td>Index of the output layer</td><td>integer</td></tr>
                <tr><td className="pk"><Tex src="\odot"/></td><td>Hadamard (element-wise) product</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'backprop' && (
        <div>
          <div className="m4-two-col">
            <div className="m4-card">
              <div className="m4-card-h">Stepping Down Hill — Per-Neuron Error</div>
              <div style={{fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65}}>
                What is the contribution to the error at each <Tex src="z^l_j"/>?
              </div>
              <ul className="m4-bullets" style={{fontSize:'0.74rem', lineHeight:1.7, marginTop:'0.4rem'}}>
                <li>If <Tex src="\partial C/\partial z^l_j"/> is <strong>large</strong>, there is an opportunity to make a significant change to C.</li>
                <li>If <Tex src="\partial C/\partial z^l_j"/> is <strong>small</strong>, there is little opportunity.</li>
                <li>It gives us an indication of how much "error" can be attributed to that neuron.</li>
              </ul>
              <div className="m4-hr"/>
              <div className="m4-flabel">Definition — local error</div>
              <Tex src="\boxed{\delta^l_j \equiv \frac{\partial C}{\partial z^l_j}}" block />
            </div>
            <div className="m4-card">
              <div className="m4-card-h">The Goal — What We Want</div>
              <div style={{fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65}}>
                Compute the partial derivatives (vector components of the direction of maximum slope) <Tex src="\partial C/\partial w"/> and <Tex src="\partial C/\partial b"/> of the cost function C with respect to all weights w and biases b.
              </div>
              <div className="m4-hr"/>
              <div className="m4-flabel">Why it's hard</div>
              <ul className="m4-bullets" style={{fontSize:'0.74rem'}}>
                <li>A modern network has millions or billions of weights.</li>
                <li>Cost depends on <em>every</em> weight via deeply nested compositions.</li>
                <li>Naive chain-rule application is intractable — need to share work.</li>
              </ul>
              <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.73rem'}}>
                <strong>Backpropagation</strong> reuses computation: the error at layer ℓ feeds the error at layer ℓ−1, etc. O(network size) per training example.
              </div>
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNBackpropWalker />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">The Four Backpropagation Equations — Memorise These</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'0.55rem'}}>
              {[
                {n:'BP-1', t:'Output-layer error', eq:'\\delta^L = \\nabla_a C \\odot \\sigma\'(z^L)', d:'Change at output layer in terms of change in cost.', col:'#fb7185'},
                {n:'BP-2', t:'Back-propagate', eq:'\\delta^l = \\bigl((w^{l+1})^T \\delta^{l+1}\\bigr) \\odot \\sigma\'(z^l)', d:'Change at hidden node in terms of change at next layer!', col:'#a78bfa'},
                {n:'BP-3', t:'Bias gradient', eq:'\\frac{\\partial C}{\\partial b^l_j} = \\delta^l_j', d:'Change in bias in terms of change at layer.', col:'#fbbf24'},
                {n:'BP-4', t:'Weight gradient', eq:'\\frac{\\partial C}{\\partial w^l_{jk}} = a^{l-1}_k\\, \\delta^l_j', d:'Change in weight in terms of change at layer.', col:'#34d399'},
              ].map(b => (
                <div key={b.n} style={{padding:'0.7rem 0.85rem', background:`${b.col}11`, border:`1px solid ${b.col}55`, borderRadius:8}}>
                  <div style={{fontSize:'0.72rem', color:b.col, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.08em'}}>{b.n} · {b.t}</div>
                  <div style={{margin:'0.45rem 0'}}><Tex src={b.eq} block/></div>
                  <div style={{fontSize:'0.74rem', color:'var(--text-2)', lineHeight:1.55, fontStyle:'italic'}}>{b.d}</div>
                </div>
              ))}
            </div>
            <div className="m4-infobox" style={{marginTop:'0.65rem', fontSize:'0.75rem'}}>
              We now know how to calculate ∇C(w, b)!
              <Tex src="\nabla C = \begin{bmatrix} \partial C/\partial w_1 \\ \vdots \\ \partial C/\partial w_p \\ \partial C/\partial b_1 \\ \vdots \\ \partial C/\partial b_q \end{bmatrix}" block/>
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">The Backpropagation Algorithm — Step by Step</div>
            <div style={{fontSize:'0.74rem', color:'var(--text-1)', lineHeight:1.7}}>
              <div style={{marginBottom:'0.5rem'}}>
                <strong style={{color:'#22d3ee'}}>1. Input x.</strong> Set the corresponding activation a¹ for the input layer.
              </div>
              <div style={{marginBottom:'0.5rem'}}>
                <strong style={{color:'#22d3ee'}}>2. Feedforward.</strong> For each l = 2, 3, …, L compute:
                <Tex src="z^l = w^l a^{l-1} + b^l \quad \text{and} \quad a^l = \sigma(z^l)" block />
              </div>
              <div style={{marginBottom:'0.5rem'}}>
                <strong style={{color:'#fb7185'}}>3. Output error δᴸ.</strong> Compute:
                <Tex src="\delta^L = \nabla_a C \odot \sigma'(z^L)" block />
              </div>
              <div style={{marginBottom:'0.5rem'}}>
                <strong style={{color:'#fb7185'}}>4. Backpropagate the error.</strong> For each l = L−1, L−2, …, 2 compute:
                <Tex src="\delta^l = \bigl((w^{l+1})^T \delta^{l+1}\bigr) \odot \sigma'(z^l)" block />
              </div>
              <div>
                <strong style={{color:'#34d399'}}>5. Output.</strong> The gradient of the cost function is given by:
                <Tex src="\frac{\partial C}{\partial w^l_{jk}} = a^{l-1}_k\, \delta^l_j \quad \text{and} \quad \frac{\partial C}{\partial b^l_j} = \delta^l_j" block />
              </div>
            </div>
            <div className="m4-warnbox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              <strong>Note the direction.</strong> Feedforward goes l = 2 → L (low to high). Backprop goes l = L−1 → 2 (high to low). The pre-computed a^l and z^l from feedforward are reused on the way back down.
            </div>
          </div>
        </div>
      )}

      {sec === 'universal' && (
        <div>
          <div className="m4-card">
            <div className="m4-card-h">Universal Function Approximation</div>
            <ul className="m4-bullets" style={{fontSize:'0.78rem', lineHeight:1.7}}>
              <li>We've talked a lot about <strong>expressiveness</strong> of a representation.</li>
              <li>Success of neural nets comes from their <em>incredible</em> expressiveness.</li>
              <li>➡ Neural networks can compute <strong>any continuous function</strong>, to <strong>any required precision</strong>.</li>
              <li>➡ <strong>Universal function approximators.</strong></li>
            </ul>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Formal Statement</div>
            <div style={{fontSize:'0.77rem', color:'var(--text-1)', lineHeight:1.65}}>
              For any target function <Tex src="f(x)"/> and desired accuracy <Tex src="\epsilon"/>, there exists a neural network with output <Tex src="g(x)"/> such that:
            </div>
            <Tex src="|g(x) - f(x)| < \epsilon \quad \text{for all } x" block />
            <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7, marginTop:'0.5rem'}}>
              <li>Holds for <strong>multiple inputs and multiple outputs</strong>.</li>
              <li>Holds even with <strong>just one hidden layer!</strong></li>
              <li>Not necessarily a <em>practical</em> approach.</li>
              <li>More accuracy required ⇒ more nodes in the hidden layer.</li>
            </ul>
            <div className="m4-infobox" style={{marginTop:'0.55rem', fontSize:'0.75rem'}}>
              See Nielsen's brilliant interactive proof — <em>"A visual proof that neural nets can compute any function"</em> (neuralnetworksanddeeplearning.com/chap4.html).
            </div>
          </div>

          <div style={{marginTop:'0.75rem'}}>
            <NNUniversalApprox />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">What the Theorem Does &amp; Doesn't Promise</div>
            <table className="m4-ptable" style={{fontSize:'0.75rem'}}>
              <thead><tr><th>Does promise</th><th>Doesn't promise</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{verticalAlign:'top', color:'#34d399'}}>
                    <ul style={{margin:0, paddingLeft:'1rem'}}>
                      <li>g(x) <strong>exists</strong></li>
                      <li>Arbitrary precision is achievable</li>
                      <li>Even one hidden layer suffices</li>
                      <li>Works for multi-input / multi-output</li>
                    </ul>
                  </td>
                  <td style={{verticalAlign:'top', color:'#fb7185'}}>
                    <ul style={{margin:0, paddingLeft:'1rem'}}>
                      <li>That training will <em>find</em> g(x)</li>
                      <li>That g(x) is small or efficient</li>
                      <li>That gradient descent converges</li>
                      <li>That ε can be reached in finite time</li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="m4-warnbox" style={{marginTop:'0.55rem', fontSize:'0.74rem'}}>
              <strong>Existential, not constructive.</strong> The theorem says "such a network exists somewhere in parameter space" — finding it is what training (gradient descent + backprop) is for.
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Putting It All Together — The Full Pipeline</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'0.5rem', justifyContent:'space-between', alignItems:'center'}}>
              {[
                {n:'1', t:'Architecture', c:'#22d3ee', d:'Pick layers'},
                {n:'2', t:'Random init', c:'#a78bfa', d:'w, b'},
                {n:'3', t:'Forward', c:'#34d399', d:'a^l = σ(z^l)'},
                {n:'4', t:'Cost C(w,b)', c:'#fbbf24', d:'MSE'},
                {n:'5', t:'Backprop', c:'#fb7185', d:'BP-1..4'},
                {n:'6', t:'GD update', c:'#06b6d4', d:'w ← w − α∇C'},
                {n:'7', t:'Repeat 3-6', c:'#ec4899', d:'Until converged'},
              ].map((s, i, arr) => (
                <div key={s.n} style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
                  <div style={{padding:'0.6rem 0.75rem', background:`${s.c}14`, border:`1.5px solid ${s.c}66`, borderRadius:8, minWidth:80, textAlign:'center'}}>
                    <div style={{fontSize:'0.7rem', color:s.c, fontFamily:'monospace', fontWeight:700}}>{s.n}</div>
                    <div style={{fontSize:'0.72rem', color:'#fff', fontWeight:600, marginTop:'0.2rem'}}>{s.t}</div>
                    <div style={{fontSize:'0.62rem', color:'var(--text-2)', marginTop:'0.15rem'}}>{s.d}</div>
                  </div>
                  {i < arr.length-1 && <span style={{color:'rgba(148,163,184,0.5)', fontSize:'1rem'}}>→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sec === 'memorise' && (
        <div>
          <div style={{background:'linear-gradient(135deg,rgba(52,211,153,0.08) 0%,rgba(167,139,250,0.08) 100%)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:12,padding:'0.75rem 1rem',marginBottom:'0.85rem'}}>
            <div style={{fontSize:'0.66rem', color:'#34d399', fontFamily:'monospace', letterSpacing:'0.1em', fontWeight:700, marginBottom:'0.35rem'}}>✦ MEMORISATION HUB</div>
            <div style={{fontSize:'1rem', color:'#fff', fontWeight:700, marginBottom:'0.3rem'}}>Active recall, not passive review</div>
            <div style={{fontSize:'0.76rem', color:'var(--text-2)', lineHeight:1.6}}>
              Flip flashcards before peeking. Take the quiz. Repeat after 1 day, 3 days, 7 days — spaced repetition crystallises memory. Top up with the Memory Cosmos tab for spatial cues.
            </div>
          </div>

          <NNFlashcards />

          <div style={{marginTop:'0.75rem'}}>
            <NNQuiz />
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">Exam Mantras — Memorise Verbatim</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'0.5rem'}}>
              {[
                {col:'#fb7185', t:'BP-1 (output error)', m:'"Cost gradient times sigma prime, at the output layer."', eq:'\\delta^L = \\nabla_a C \\odot \\sigma\'(z^L)'},
                {col:'#a78bfa', t:'BP-2 (back-prop)', m:'"Transposed weights, times next-layer delta, gated by sigma prime."', eq:'\\delta^l = ((w^{l+1})^T \\delta^{l+1}) \\odot \\sigma\'(z^l)'},
                {col:'#fbbf24', t:'BP-3 (bias gradient)', m:'"Bias gradient equals delta. Same neuron."', eq:'\\partial C/\\partial b^l_j = \\delta^l_j'},
                {col:'#34d399', t:'BP-4 (weight gradient)', m:'"Pre-activation times post-error."', eq:'\\partial C/\\partial w^l_{jk} = a^{l-1}_k \\delta^l_j'},
                {col:'#22d3ee', t:'Forward pass', m:'"Linear-then-sigma. Sigma element-wise."', eq:'a^l = \\sigma(w^l a^{l-1} + b^l)'},
                {col:'#06b6d4', t:'Cost (quadratic)', m:'"Half mean squared error — the half kills the 2."', eq:'C(w,b) = \\frac{1}{2n}\\sum_x \\|y(x) - a\\|^2'},
                {col:'#ec4899', t:'Universal approx.', m:'"For any continuous f and any epsilon, a NN g exists with |g − f| &lt; ε, even with one hidden layer."', eq:'|g(x) - f(x)| < \\epsilon'},
                {col:'#fb7185', t:'σ self-derivative', m:'"Sigmoid prime equals sigmoid times one-minus-sigmoid. The gradient is free."', eq:'\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))'},
              ].map(m => (
                <div key={m.t} style={{padding:'0.7rem 0.85rem', background:`${m.col}10`, border:`1px solid ${m.col}55`, borderRadius:8}}>
                  <div style={{fontSize:'0.72rem', color:m.col, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.06em'}}>{m.t}</div>
                  <div style={{margin:'0.45rem 0'}}><Tex src={m.eq} block /></div>
                  <div style={{fontSize:'0.74rem', color:'var(--text-1)', lineHeight:1.55, fontStyle:'italic'}}>{m.m}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="m4-card" style={{marginTop:'0.75rem'}}>
            <div className="m4-card-h">5-Step Memorisation Protocol</div>
            <ul className="m4-bullets" style={{fontSize:'0.76rem', lineHeight:1.7}}>
              <li><strong style={{color:'#22d3ee'}}>1.</strong> Read each equation aloud. Sound activates auditory + verbal memory.</li>
              <li><strong style={{color:'#a78bfa'}}>2.</strong> Re-draw the network diagram from memory. Spatial encoding is sticky.</li>
              <li><strong style={{color:'#34d399'}}>3.</strong> Connect each BP equation to its mantra — colour and metaphor anchor recall.</li>
              <li><strong style={{color:'#fbbf24'}}>4.</strong> Run the Backprop Walker without peeking. Active retrieval &gt;&gt; passive review.</li>
              <li><strong style={{color:'#fb7185'}}>5.</strong> Repeat with spacing — day 1, day 3, day 7. Spaced repetition crystallises memory.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ── EXAM VAULT — Themed Multi-Part Questions with Cone of Recall ──────────────
// ════════════════════════════════════════════════════════════════════════════════
// Each question models the official short-answer style: a real-world scenario,
// then 3–4 sub-parts. Every sub-part exposes five progressively-revealed hint
// layers (the "Cone of Recall") so the learner can self-pace from gentle nudge
// to full model answer.

const HINT_TYPES = [
  { key:'concept',  icon:'🧭', label:'Compass',  color:'#22d3ee', sub:'Which topic is in play' },
  { key:'term',     icon:'🔑', label:'Key Term', color:'#a78bfa', sub:'The specific concept name' },
  { key:'formula',  icon:'📐', label:'Diagram',  color:'#34d399', sub:'Relevant formula / picture' },
  { key:'approach', icon:'🛠',  label:'Forge',    color:'#fbbf24', sub:'How to structure the answer' },
  { key:'answer',   icon:'✓',  label:'Vault',    color:'#fb7185', sub:'Full model answer' },
];

const EXAM_QUESTIONS = [
  {
    id:'q1-karri-trading', title:'Trading Bot & Evolutionary Strategies',
    lectures:['L3','L7','L10'], accent:'#22d3ee', icon:'₿', source:'Practice 2026 · Q1',
    scenario:'Suppose Karri decides to build a trading bot that seeks to identify a trend from the previous 10 closing prices of an asset. In order to avoid any inherent bias on what constitutes a good trend, she decides to do this by optimising a nonlinear weighted average over a window of the previous 10 price signals to decide whether to buy.',
    formula:'\\text{TREND}_t = \\frac{\\sum_{i=0}^{9} w_i\\, p_{t-i}}{\\sum_{i=0}^{9} w_i}',
    setup:'Karri plans to optimise the bot using a historical data sequence. The bot starts with $100. Each day: if TREND > 0 the bot buys $10 of the asset; if TREND ≤ 0 the bot sells $10 (assuming it has at least $10 remaining).',
    parts:[
      { label:'a',
        q:'What do we mean by a candidate solution for this problem? Is the hypothesis space finite or infinite? What is the dimension of the hypothesis space?',
        hints:{
          concept:'Lecture 3 — the Optimisation Framework. Three ingredients: Language (representation), Model (a candidate solution / hypothesis), and Metric. You are being asked about the Model side and the geometry of the space it lives in.',
          term:'A "candidate solution" is the same thing as a "hypothesis" — a single point in the hypothesis space H. The dimension of H is the number of free parameters defining one hypothesis.',
          formula:'H = \\{(w_0, w_1, \\ldots, w_9) : w_i \\in \\mathbb{R}\\} \\subseteq \\mathbb{R}^{10}',
          approach:'(1) Spot what is being optimised → the weights w_0..w_9.  (2) State a candidate solution is one assignment of those ten numbers.  (3) Each w_i is a real number → uncountably infinite.  (4) Count parameters → dimension is 10.',
          answer:'A candidate solution is a specific assignment of the ten weights (w_0, w_1, …, w_9) defining the weighted-average filter. Since each weight is a real number, the hypothesis space is INFINITE (in fact uncountable). Its DIMENSION is 10 — one degree of freedom per weight.'
        }},
      { label:'b',
        q:'Suppose Karri wishes to use an evolutionary strategy to optimise the bot. Briefly describe three decisions that must be made as part of the implementation.',
        hints:{
          concept:'Lecture 10 — Evolution Strategies. ES has many tunable knobs: how many parents/offspring, what mutation distribution, what selection rule, what stopping condition, etc.',
          term:'Common ES choices: parent count μ; offspring count λ; whether parents survive ((μ,λ) vs (μ+λ)); mutation operator (typically Gaussian, std σ); fitness function; termination criterion; initialisation distribution.',
          formula:'(1)\\ \\mu, \\lambda \\quad (2)\\ \\sigma\\ \\text{(mutation std)}\\quad (3)\\ \\text{fitness} = \\text{final portfolio value}',
          approach:'Pick any three from: (a) μ/λ population sizes, (b) (μ,λ) vs (μ+λ), (c) mutation σ (possibly adapted via One-Fifth Rule), (d) fitness/cost definition, (e) stopping criterion, (f) initial population.',
          answer:'Three decisions: (1) Population sizes μ (parents) and λ (offspring). (2) Mutation operator — typically Gaussian with std σ, often adapted at runtime by the One-Fifth Rule. (3) Selection scheme — (μ, λ) where parents are discarded, or (μ + λ) where parents compete with offspring. (Other valid choices: fitness function, termination criterion, initial distribution.)'
        }},
      { label:'c',
        q:'Briefly explain the difference between a (μ, λ) evolutionary strategy and a (μ + λ) strategy.',
        hints:{
          concept:'Lecture 10. Both produce λ children from μ parents. The difference is in WHO is allowed to survive into the next generation.',
          term:'(μ, λ): parents are DISCARDED. Only the λ children compete; the top μ children form the next generation. (μ + λ): parents and children are MERGED into one pool; the top μ of the (μ + λ) survive.',
          formula:'(\\mu, \\lambda):\\ P_{next} = \\text{best } \\mu \\text{ of } \\lambda \\text{ children}\\\\ (\\mu + \\lambda):\\ P_{next} = \\text{best } \\mu \\text{ of } (\\lambda \\text{ children} \\cup \\mu \\text{ parents})',
          approach:'State which pool selection draws from in each scheme. Mention the trade-off: (μ,λ) is more exploratory (the elite always dies), (μ+λ) is more exploitative (elites persist) but risks premature convergence.',
          answer:'In (μ, λ): only the λ offspring form the candidate pool for the next generation; all μ parents are unconditionally discarded. In (μ + λ): parents and offspring compete together; the best μ of the merged (μ + λ) survive. Effect: (μ, λ) is more exploratory because elites die each generation — useful for noisy or dynamic fitness landscapes. (μ + λ) is more exploitative because the best-ever solution is always preserved — faster convergence but higher risk of getting stuck.'
        }},
      { label:'d',
        q:'Assuming the dimensionality of the space is d, briefly explain the key differences between (i) a Hooke-Jeeves search, (ii) a steepest ascent hill climb with sample size n=2d, (iii) a steepest ascent hill climb with replacement where n=2d, (iv) a (1, 2d) evolutionary strategy, (v) a (1 + 2d) evolutionary strategy.',
        hints:{
          concept:'Lectures 7 (direct methods) and 10 (ES). Compare on three axes: HOW neighbours are sampled, WHETHER the parent can survive, WHETHER worse moves are ever accepted.',
          term:'HJ = direct method with PATTERN moves combining recent successes. SAHC = sample n neighbours and take the best. With replacement = always move (no improvement check). (1, λ) = no parent survival. (1 + λ) = parent competes with offspring.',
          formula:'\\text{HJ: axes-aligned explore + pattern moves combining wins.}\\\\ \\text{SAHC: best of 2d samples; move only if better.}\\\\ \\text{SAHC-R: best of 2d samples; always move.}\\\\ (1, 2d):\\ \\text{parent discarded; best child survives.}\\\\ (1 + 2d):\\ \\text{best of (parent, 2d children) survives.}',
          approach:'For each method give: (1) how neighbours are generated, (2) is parent kept, (3) are worse moves accepted. The five methods sit on a spectrum from deterministic & elitist (HJ) to stochastic & non-elitist ((1, 2d)).',
          answer:'(i) Hooke-Jeeves: deterministic; alternates axis-aligned exploratory moves with PATTERN moves that combine recent successes. (ii) Steepest-ascent HC (n=2d): samples 2d random neighbours, picks the best, accepts ONLY IF better than current. (iii) SAHC with replacement: same as (ii) but always accepts the best of the 2d samples — even if worse — making it pure random walk biased by sampling. (iv) (1, 2d) ES: parent produces 2d children by Gaussian mutation; parent is unconditionally discarded; best child becomes next parent (can be worse). (v) (1 + 2d) ES: parent competes with 2d children; best of all 2d+1 survives — current best is always preserved (elitist).'
        }},
    ]
  },
  {
    id:'q2-sigmoid-graceful', title:'Sigmoid Activation & Graceful Degradation',
    lectures:['L1','L13'], accent:'#a78bfa', icon:'σ', source:'Practice 2026 · Q2',
    scenario:'Karri is now interested in a different problem — designing the activation function for a single neuron in a perceptron-style classifier.',
    setup:'She wants the neuron to handle noisy or partially-corrupted inputs gracefully, rather than failing abruptly when an input drifts past a threshold.',
    parts:[
      { label:'a',
        q:'One of the goals of soft computing is graceful degradation. What do we mean by graceful degradation? Give a practical example where graceful degradation is important. Using your example, why might you expect a network of neurons with sigmoid activation functions to provide better degradation properties than perceptrons with step functions?',
        hints:{
          concept:'Lecture 1–2 — soft computing aims to mimic biological systems whose performance degrades smoothly under stress. Lecture 13 — comparing step vs sigmoid as activation functions.',
          term:'Graceful degradation = performance drops smoothly with damage/noise rather than catastrophically. Step function = discontinuous (binary output). Sigmoid = smooth, bounded in (0,1), differentiable everywhere.',
          formula:'\\text{Step}(z) = \\begin{cases}1 & z > 0 \\\\ 0 & z \\le 0\\end{cases} \\qquad \\sigma(z) = \\frac{1}{1+e^{-z}}',
          approach:'(1) Define graceful degradation. (2) Pick a concrete example (handwriting OCR, faulty sensor, biological neural damage). (3) Explain that a small input perturbation barely changes a sigmoid output near the bulk of the curve, but flips a step function entirely at the threshold.',
          answer:'Graceful degradation means a system\'s performance declines SMOOTHLY rather than catastrophically when conditions deteriorate (noise, damage, missing data). Example: handwritten digit recognition — a slightly smudged "7" should still be recognised as a 7 (perhaps with lower confidence), not abruptly misclassified. With a STEP function, a tiny perturbation that pushes z across the threshold causes the output to flip from 0 to 1 — a catastrophic change. With a SIGMOID, a tiny perturbation changes σ(z) only slightly (its derivative is bounded by 0.25), so the output decays smoothly and downstream layers can integrate this small change. Differentiability also lets us train via gradient descent.'
        }},
      { label:'b',
        q:'Consider a neuron that uses the sigmoid activation function a(z) = z / (1 + |z|). Assume you wish the neuron to have an acceptance region for all values z > T for some threshold T. What values of a(z) might you use to indicate that a sample z_0 is accepted? Draw the activation function, indicating the acceptance region.',
        hints:{
          concept:'Lecture 13 — the activation outputs a "confidence". An acceptance region is the set of outputs corresponding to "yes, accept" — usually defined by a threshold on a(z).',
          term:'Algebraic sigmoid a(z) = z/(1+|z|): ranges over (−1, 1), is monotonic increasing, with a(0) = 0. Acceptance region in OUTPUT space = a(z) > a(T).',
          formula:'a(z) = \\frac{z}{1+|z|} \\in (-1, 1),\\quad a(T) = \\frac{T}{1+|T|}\\\\ \\text{Accept iff } a(z) > a(T) \\Leftrightarrow z > T.',
          approach:'(1) Evaluate a(T). (2) State the rule "accept iff a(z) > a(T)". (3) Sketch a(z): S-curve through origin with asymptotes y = ±1; mark vertical line z = T and horizontal a(T); shade the region z > T (equivalently a(z) > a(T)).',
          answer:'Accept the sample iff a(z_0) > a(T), where a(T) = T/(1+|T|). Since a is strictly monotonic increasing, this is equivalent to z_0 > T. Diagram: an S-shaped algebraic sigmoid passing through the origin, with horizontal asymptotes at y = +1 and y = −1. Mark the point (T, a(T)) on the curve; draw a vertical dashed line at z = T and a horizontal dashed line at a(T); shade the region to the RIGHT of z = T (equivalently ABOVE a(T)) — that is the acceptance region.'
        }},
      { label:'c',
        q:'Suppose you wish to use a bias input to move the threshold to the origin, so that the acceptance region is z > 0. What activation function would you use? Draw a diagram depicting the neuron.',
        hints:{
          concept:'Lecture 13 — the "bias trick": adding a fixed bias term b = −T shifts the activation horizontally so the decision boundary sits at the origin.',
          term:'Bias trick: feed an extra "constant 1" input with weight b = −T. The pre-activation becomes z + b = z − T, so the sigmoid is centred at z = T.',
          formula:'a\'(z) = a(z - T) = \\frac{z - T}{1 + |z - T|}\\\\ \\text{Acceptance: } a\'(z) > 0 \\iff z > T.',
          approach:'(1) Define the new activation a\'(z) = (z−T)/(1+|z−T|). (2) Draw the neuron: input z; constant input 1 weighted by b = −T; summing node Σ producing z\' = z + b; activation a\'(·); output. (3) Note acceptance now corresponds to z\' > 0, equivalent to original z > T.',
          answer:'Use the shifted activation a\'(z) = a(z − T) = (z − T)/(1 + |z − T|). Diagram of the neuron: input z (top); a constant input of 1 (bottom) multiplied by a bias weight b = −T; both feed into a summation node Σ which computes z\' = z − T; the sum passes through the activation a\'(·); the result is the output. Acceptance region: a\'(z) > 0 ⇔ z\' > 0 ⇔ z > T — the threshold has been shifted to the origin.'
        }},
    ]
  },
  {
    id:'q3-liam-hyperparams', title:'Hyperparameter Tuning & Stochastic Search',
    lectures:['L3','L6','L9'], accent:'#fbbf24', icon:'⚙', source:'Author · Q3',
    scenario:'Liam is tuning a recommendation engine that exposes four continuous hyperparameters — learning rate η, dropout p, regularisation λ, and embedding dimension scale s. Each combination must be evaluated by retraining the model overnight and measuring click-through rate (CTR) on a held-out validation set, which takes ~6 hours per evaluation.',
    setup:'Liam can run roughly 20 evaluations per week. CTR appears to be a noisy, multi-modal function of the hyperparameters with no analytic form.',
    parts:[
      { label:'a',
        q:'Identify the three ingredients of the optimisation framework as they apply to Liam\'s problem. Briefly state each one.',
        hints:{
          concept:'Lecture 3 — every optimisation problem has the same three ingredients. Map them onto Liam\'s setting.',
          term:'Language (representation of hypotheses), Model (a single candidate hypothesis), Metric (evaluation function f : H → ℝ).',
          formula:'\\text{Language: } H \\subseteq \\mathbb{R}^4 \\quad \\text{Model: } (\\eta, p, \\lambda, s) \\in H \\quad \\text{Metric: } f(\\cdot) = \\text{CTR}',
          approach:'For each ingredient, name it AND tie it to Liam\'s problem. Language → 4-D real hypothesis space. Model → a specific (η, p, λ, s) tuple. Metric → measured CTR on validation.',
          answer:'Language: a 4-dimensional real-valued hypothesis space H ⊆ ℝ⁴ — every point is a candidate configuration. Model: a specific instance (η, p, λ, s) ∈ H — one set of hyperparameters Liam might try. Metric: the validation CTR after training with that configuration; f : H → ℝ, where higher is better. Liam wants argmax of f.'
        }},
      { label:'b',
        q:'Briefly explain why Liam cannot directly use gradient descent to find the best hyperparameter setting.',
        hints:{
          concept:'Lecture 6 — gradient descent requires ∇f at every query point. Lecture 3 — Liam\'s metric is a black-box evaluation, not a closed-form function.',
          term:'Gradient descent requires the function to be (a) differentiable and (b) cheap to query its gradient. Black-box / simulator-based fitness has neither.',
          formula:'\\nabla f = \\bigl[\\partial f/\\partial \\eta, \\partial f/\\partial p, \\partial f/\\partial \\lambda, \\partial f/\\partial s\\bigr]^T \\quad \\text{(unavailable)}',
          approach:'List the reasons gradient descent fails: (1) no analytic form for f, so no symbolic gradient; (2) approximating ∇f by finite differences requires 2d extra evaluations per step (≥ 8) — way too expensive; (3) CTR appears multi-modal so even a successful gradient would only find a local optimum; (4) noise in CTR measurement makes finite-difference estimates unreliable.',
          answer:'Gradient descent assumes f is differentiable and ∇f is cheap to compute. Liam\'s f (CTR after a 6-hour training run) has NO analytic form — gradients must be approximated by finite differences, requiring 2d = 8 extra evaluations per step (48 hours per gradient estimate). Worse: CTR is noisy and multi-modal, so even an accurate gradient would only find a local maximum, and finite-difference estimates would be drowned in noise. A derivative-free method (HC, SA, ILS, ES) is required.'
        }},
      { label:'c',
        q:'Briefly compare Hill Climbing with Random Restarts to Simulated Annealing as alternatives for Liam\'s problem.',
        hints:{
          concept:'Lecture 9 — single-state stochastic global optimisation. Both maintain ONE candidate solution but differ in how they escape local optima.',
          term:'HC with restarts: do local HC to convergence, jump to a random new point, repeat. SA: HC variant that PROBABILISTICALLY accepts worse moves with probability exp(ΔQ / t), where t decreases over time.',
          formula:'\\text{HC+R: inner HC loop + outer random-restart loop.}\\\\ \\text{SA: } P(\\text{accept worse } R) = \\exp\\bigl((Q(R) - Q(S))/t\\bigr)\\\\ \\text{cooling: } t \\to 0 \\text{ over iterations.}',
          approach:'Compare on: (1) memory — both use one state; (2) escape mechanism — HC+R restarts globally, SA accepts bad moves locally; (3) parameter tuning — HC+R needs restart count, SA needs cooling schedule; (4) exploration vs exploitation profile over time.',
          answer:'Hill Climbing with Random Restarts: runs a vanilla hill climb until convergence (gradient zero or no improvement), records the best, then teleports to a fresh random starting point and repeats. Pure exploration is global (random restart) but no exploration once inside a basin. Simulated Annealing: at each step, generate a neighbour R; if R is better accept it; if R is worse accept with probability P = exp((Q(R) − Q(S))/t). The temperature t starts high (mostly random walk — explores) and decreases towards 0 (mostly hill climb — exploits). Difference: HC+R exploration is discontinuous (jumps), SA exploration is local but continuous (probabilistic accept). For Liam — with only 20 evals/week — SA may make better use of each evaluation; HC+R risks wasting samples re-exploring already-mapped basins.'
        }},
      { label:'d',
        q:'In Simulated Annealing, describe the role of the cooling schedule.',
        hints:{
          concept:'Lecture 9 — the temperature t controls the exploration/exploitation trade-off; the cooling schedule is how t decreases over time.',
          term:'Cooling schedule = function t(n) mapping iteration n → temperature. Geometric: t_{n+1} = α t_n (0 < α < 1). Logarithmic: t_n = T_0 / log(n+1) (theoretical guarantees but slow).',
          formula:'P(\\text{accept worse}) = e^{(Q(R) - Q(S))/t}\\\\ t \\to \\infty: P \\to 1 \\text{ (random walk)}\\\\ t \\to 0: P \\to 0 \\text{ (pure HC)}',
          approach:'Explain that (1) high t early = exploration; (2) low t late = exploitation; (3) too fast cooling = local optima trap; (4) too slow = wasted iterations; (5) the schedule is the chief design choice in SA.',
          answer:'The cooling schedule t(n) controls how the acceptance probability of worse moves decreases over time. Early on (high t) the algorithm accepts nearly any move — heavy EXPLORATION, escaping local optima. Late (low t) only improving moves are accepted — pure EXPLOITATION, refining the current candidate. If cooling is too FAST the algorithm freezes into the first local optimum it finds; if too SLOW it wastes evaluations on random search. Common schedules: geometric (t_{n+1} = α t_n with α ≈ 0.95) — fast and simple; logarithmic — provides theoretical convergence to global optimum but is far too slow in practice.'
        }},
    ]
  },
  {
    id:'q4-mira-jobshop', title:'Job Shop Scheduling',
    lectures:['L4'], accent:'#fb7185', icon:'⚙', source:'Author · Q4',
    scenario:'Mira manages a print shop with 5 jobs and 3 machines: a cutter, a printer, and a binder. Each job has a fixed sequence (e.g. cut → print → bind, or print → cut → bind depending on the product) and a known processing time on each machine.',
    setup:'Mira wants to minimise the MAKESPAN — the total time from the start of the first operation to the completion of the last operation across all jobs.',
    parts:[
      { label:'a',
        q:'How large is the solution space for Mira\'s problem? Express your answer in terms of n (number of jobs) and m (number of machines), then evaluate it for her instance. Comment on tractability.',
        hints:{
          concept:'Lecture 4 — Job Shop Scheduling has a famously combinatorial solution space.',
          term:'For n jobs and m machines, each machine has its own permutation of n jobs → n! orderings per machine, independent → (n!)^m total.',
          formula:'|H| = (n!)^m\\\\ \\text{Mira: } n=5,\\ m=3 \\Rightarrow (5!)^3 = 120^3 = 1{,}728{,}000',
          approach:'(1) State the formula (n!)^m. (2) Substitute. (3) Compute. (4) Discuss whether exhaustive enumeration is feasible — for small n maybe, but JSSP is NP-hard in general.',
          answer:'The solution space has size (n!)^m — each of the m machines independently orders n jobs. For Mira: (5!)^3 = 120^3 = 1,728,000 candidate schedules. Exhaustive enumeration is just about tractable here (under 2 million), but the formula grows EXPLOSIVELY: 7 jobs on 5 machines is already ≈ 10^17. JSSP is NP-hard in general — heuristic search (dispatching rules, local search, metaheuristics) is required for realistic instances.'
        }},
      { label:'b',
        q:'Briefly describe two dispatching rules Mira could use to construct a feasible schedule quickly, and the situation in which each is most appropriate.',
        hints:{
          concept:'Lecture 4 — dispatching rules are GREEDY constructive heuristics that pick the next job for an idle machine based on a simple priority.',
          term:'Common rules: SPT (Shortest Processing Time first), LPT (Longest first), EDD (Earliest Due Date), FIFO (First In First Out), MWKR (Most Work Remaining), CR (Critical Ratio).',
          formula:'\\text{SPT: pick job with smallest } pt\\\\ \\text{EDD: pick job with smallest } dd\\\\ \\text{MWKR: pick job with largest remaining work}',
          approach:'Pick any TWO rules. For each: (a) state the priority, (b) say when it works best (SPT minimises mean flow time; EDD minimises maximum lateness; MWKR is often good for makespan).',
          answer:'Two examples: SPT (Shortest Processing Time) — whenever a machine becomes idle, pick the ready job with the smallest processing time on that machine. SPT minimises the AVERAGE flow time and works well when total throughput matters more than meeting individual deadlines. EDD (Earliest Due Date) — pick the ready job with the earliest due date. EDD minimises the MAXIMUM LATENESS and is appropriate when missing deadlines carries a penalty. Other valid pairs: FIFO + MWKR, LPT + CR, etc.'
        }},
      { label:'c',
        q:'Briefly explain what the disjunctive graph model represents, and why it is useful for JSSP.',
        hints:{
          concept:'Lecture 4 — the disjunctive graph is a standard way to encode a JSSP instance as a combinatorial graph problem.',
          term:'Nodes = operations (one per job–machine pair). Conjunctive arcs (fixed direction) = precedence within a job. Disjunctive arcs (undirected pairs) = conflicts between operations sharing the same machine. A SCHEDULE = an orientation of all disjunctive arcs.',
          formula:'G = (V, A \\cup E)\\\\ A: \\text{conjunctive (job precedence)}\\\\ E: \\text{disjunctive (machine conflicts)}\\\\ \\text{Makespan} = \\text{longest path in oriented } G',
          approach:'(1) Describe the graph components. (2) Explain that orienting disjunctive arcs = choosing job order on each machine. (3) State that makespan = longest path. (4) Note this lets us use graph algorithms (longest-path eval, neighbourhood moves) for JSSP.',
          answer:'The disjunctive graph G = (V, A ∪ E) represents a JSSP instance: nodes V are individual operations (one per job-machine pair); conjunctive arcs A (fixed direction) encode the within-job precedence; disjunctive arc pairs E (initially undirected) connect every pair of operations that compete for the same machine. A complete SCHEDULE corresponds to orienting every disjunctive arc — i.e. choosing the processing order on each machine. The MAKESPAN equals the longest path through the resulting directed graph. The model is useful because (1) it cleanly captures both job precedence and machine conflicts, (2) it lets us compute makespan via longest-path algorithms, and (3) standard local-search neighbourhoods (e.g. N1 — swap adjacent operations on a critical path) are natural to define on the graph.'
        }},
      { label:'d',
        q:'Mira benchmarks two heuristics against the known optimum of a small instance. Explain what the Relative Percentage Deviation (RPD) measures and why it is preferred over the raw makespan difference.',
        hints:{
          concept:'Lecture 4 — RPD is a normalised quality metric for comparing schedulers across instances of different sizes.',
          term:'RPD = 100 × (Cmax_heuristic − Cmax_optimum) / Cmax_optimum.',
          formula:'\\text{RPD} = 100 \\times \\frac{C_{\\max}^{\\text{heur}} - C_{\\max}^{\\text{opt}}}{C_{\\max}^{\\text{opt}}}\\ \\%',
          approach:'(1) Give the formula. (2) Explain it normalises by the optimum so values are comparable across instances of different scale. (3) RPD = 0 ⇒ optimal; RPD = 10 ⇒ 10% above optimum. (4) Raw differences cannot be averaged sensibly across instances of different scales.',
          answer:'RPD measures how much a heuristic\'s makespan exceeds the known optimum, as a PERCENTAGE of the optimum: RPD = 100 × (Cmax_heur − Cmax_opt) / Cmax_opt. It is preferred over the raw difference because raw differences cannot be sensibly aggregated across instances of different scales — a 10-unit gap on a 50-unit instance is a 20% miss, while the same 10-unit gap on a 1000-unit instance is only 1%. Reporting RPD lets us average performance over a benchmark set; RPD = 0 means the heuristic matched the optimum.'
        }},
    ]
  },
  {
    id:'q5-aroha-genetic', title:'Genetic Algorithm for a Game AI',
    lectures:['L11'], accent:'#34d399', icon:'☷', source:'Author · Q5',
    scenario:'Aroha is evolving the decision policy of a fighting-game AI. Each candidate is encoded as a 24-bit binary chromosome controlling thresholds for "attack", "block", "dodge" priorities. Fitness is measured by win-rate over 50 matches against a fixed opponent.',
    setup:'She runs a generational GA with population size 100 and runs for 200 generations.',
    parts:[
      { label:'a',
        q:'Explain why Aroha\'s problem is a good candidate for a Genetic Algorithm rather than a gradient method.',
        hints:{
          concept:'Lecture 11 — GAs handle discrete and combinatorial spaces where gradients do not exist.',
          term:'GA fits because: (1) representation is BINARY (discrete) so no gradient; (2) fitness comes from a stochastic SIMULATION (50 matches) so noisy and black-box; (3) the search space (2^24 ≈ 16.7M) is too large for exhaustive enumeration.',
          formula:'|H| = 2^{24} \\approx 1.68 \\times 10^7 \\quad \\text{fitness: noisy black-box}',
          approach:'List the disqualifiers for gradient methods (no gradient, discrete) and the matching strengths of GA (population diversity, crossover combines partial solutions, mutation explores).',
          answer:'Three reasons: (1) The chromosome is BINARY — there is no continuous gradient ∇f to follow. (2) Fitness is determined by a noisy STOCHASTIC simulation (50 matches), so finite-difference gradient estimates would be drowned in noise. (3) The space has 2^24 ≈ 16.7 million candidates — too large to enumerate but small enough that population-based crossover/mutation can effectively recombine successful "building blocks". GAs handle all three: they need only fitness evaluations (black-box), they work on discrete genomes, and they recombine partial solutions through crossover.'
        }},
      { label:'b',
        q:'Briefly compare one-point crossover, two-point crossover, and uniform crossover. Which would you recommend for Aroha\'s 24-bit chromosome and why?',
        hints:{
          concept:'Lecture 11 — crossover operators differ in their POSITIONAL BIAS: how strongly they preserve adjacent gene blocks ("schemata").',
          term:'1-point: pick one crossover point c, swap tails. 2-point: pick c, d; swap the middle segment. Uniform: independent per-gene coin flip (swap or not).',
          formula:'1\\text{pt: } v\' = v_{1..c}\\,w_{c+1..L},\\ w\' = w_{1..c}\\,v_{c+1..L}\\\\ 2\\text{pt: ring view; cut at c,d; swap middle arc}\\\\ \\text{Uniform: } v\'_i = v_i \\text{ or } w_i \\text{ w.p. } 1/2',
          approach:'For each operator describe: (1) the mechanic, (2) the positional bias (which adjacent genes tend to stay together). Recommend based on whether Aroha\'s genes have meaningful adjacency (probably not — 24 bits encoding 3 thresholds).',
          answer:'1-point: choose c ∈ [1, L−1]; child v\' takes v[1..c] then w[c+1..L]. Strong positional bias — genes at opposite ends are almost always separated. 2-point: choose c < d; swap the middle segment. Visualised as a ring, every gene is "equidistant" — reduces positional bias. Uniform: per-bit coin flip selects from v or w independently; NO positional bias. For Aroha: the 24 bits are split into 3 logical sub-fields of 8 bits each, so adjacency MATTERS within a sub-field. I would recommend TWO-POINT crossover — it preserves contiguous blocks better than uniform but avoids the strong endpoint bias of one-point.'
        }},
      { label:'c',
        q:'Briefly compare fitness-proportionate (roulette) selection with tournament selection. Which is more robust when fitness values are noisy?',
        hints:{
          concept:'Lecture 11 — selection schemes differ in how strongly they discriminate by fitness, and how robust they are to noisy fitness estimates.',
          term:'Roulette: P(pick i) = f_i / Σ f_j — sensitive to scale, dominated by super-individuals. Tournament: pick k random individuals, return the best — depends only on RANK, not absolute values.',
          formula:'\\text{Roulette: } P_i = \\frac{f_i}{\\sum_j f_j}\\\\ \\text{Tournament}(k=2): \\text{pick 2 random, return better}',
          approach:'(1) Describe each operator. (2) For noise robustness: tournament uses only RANK (relative comparison), so absolute scale of noise doesn\'t bias selection pressure as long as the better individual is correctly identified more than 50% of the time.',
          answer:'Roulette: probability of selection proportional to absolute fitness, P_i = f_i / Σ_j f_j. Very sensitive to fitness scale and to "super-individuals" (one outlier can dominate the spinner). Tournament: pick k random individuals (typically k = 2) and return the one with the best fitness. Depends only on RANK comparisons, not absolute values. For NOISY fitness (Aroha\'s 50-match win-rate): tournament is more robust because (a) it does not amplify a single noisy high estimate, (b) selection pressure is controlled by k and is independent of the fitness scale, and (c) as long as the better candidate beats the noise threshold more than 50% of the time, tournament still selects correctly on average.'
        }},
      { label:'d',
        q:'Aroha is considering whether to use elitism. What is elitism, and what is the trade-off?',
        hints:{
          concept:'Lecture 11 — elitism unconditionally copies the top-k individuals from one generation to the next.',
          term:'Elitism: the best e ≥ 1 individuals survive verbatim; the remaining popsize − e slots are filled by selection + crossover + mutation as usual.',
          formula:'P_{next} = \\text{top-}e(P_{cur}) \\cup \\text{(popsize}-e\\text{ children)}\\\\ \\text{Guarantees: best fitness is monotone non-decreasing.}',
          approach:'(1) Define elitism. (2) Pro: guarantees the best-so-far never gets lost; monotone improvement. (3) Con: reduces diversity → premature convergence on multi-modal landscapes. (4) Tuning e: small (1–5) usually best.',
          answer:'Elitism: at each generation, the top e ≥ 1 individuals (by fitness) are copied UNCHANGED into the next generation; the remaining popsize − e slots are filled by ordinary selection + crossover + mutation. Pro: guarantees the best-ever fitness is MONOTONE non-decreasing — you can never lose your best solution to bad luck during mutation. Con: reduces effective diversity (the same elite occupies several slots in the breeding pool), which can cause premature convergence on a local optimum. Typical compromise: small e (1–5 out of 100) gives the safety net without crushing diversity.'
        }},
    ]
  },
  {
    id:'q6-tane-swarm', title:'Particle Swarm vs Differential Evolution',
    lectures:['L12'], accent:'#06b6d4', icon:'∞', source:'Author · Q6',
    scenario:'Tane is optimising an aerospace wing-profile design with 8 continuous parameters. The cost function is a CFD (computational fluid dynamics) simulation that takes 20 minutes per evaluation and is known to be multi-modal with several basins of attraction.',
    setup:'He has heard that Particle Swarm Optimisation and Differential Evolution are both well-suited to continuous, multi-modal problems and wants to choose between them.',
    parts:[
      { label:'a',
        q:'Briefly explain why a population-based method is preferable to a single-state method (e.g. SA) for Tane\'s problem.',
        hints:{
          concept:'Lecture 12 — population-based methods maintain DIVERSITY explicitly, which helps multi-modal landscapes and parallel evaluation.',
          term:'Single-state = one candidate at a time. Population-based = many candidates. Diversity = candidates spread across different regions of H.',
          formula:'\\text{Single-state at any moment: } |S| = 1\\\\ \\text{Population: } |P| = N \\gg 1',
          approach:'List the advantages: (1) implicit diversity covers multiple basins; (2) parallel CFD evaluation cuts wall-clock time; (3) social/cooperative info-sharing (PSO global best, DE difference vectors) does not exist for single-state; (4) avoids the cooling-schedule fragility of SA.',
          answer:'A population maintains DIVERSITY of candidates — they sit in many basins of attraction at once, so the algorithm can explore multiple promising regions in parallel. For Tane\'s multi-modal landscape this dramatically reduces the chance of getting trapped in a bad basin. Practical bonus: each generation\'s N CFD evaluations are INDEPENDENT and can be run in parallel on a cluster, slashing wall-clock time. Finally, both PSO and DE leverage information across the population (global best, difference vectors) that simply does not exist in a single-state method.'
        }},
      { label:'b',
        q:'State the velocity-update rule used in Particle Swarm Optimisation, and briefly explain each term.',
        hints:{
          concept:'Lecture 12 — PSO updates each particle\'s velocity using three components: inertia, cognitive (own best), and social (swarm best).',
          term:'v_{i,t+1} = α·v_{i,t} + β·r_1·(p_i − x_i) + γ·r_2·(g − x_i). Then x_{i,t+1} = x_{i,t} + v_{i,t+1}.',
          formula:'\\vec{v}_i^{\\,t+1} = \\alpha\\,\\vec{v}_i^{\\,t} + \\beta\\,r_1\\,(\\vec{p}_i - \\vec{x}_i^{\\,t}) + \\gamma\\,r_2\\,(\\vec{g} - \\vec{x}_i^{\\,t})\\\\ \\vec{x}_i^{\\,t+1} = \\vec{x}_i^{\\,t} + \\vec{v}_i^{\\,t+1}',
          approach:'Write the equation, then label each term: inertia (α — keep going), cognitive (β — pulled to own best p_i), social (γ — pulled to swarm best g). r_1, r_2 ∈ U(0,1) add stochasticity.',
          answer:'Velocity update: v_i^{t+1} = α v_i^{t} + β r_1 (p_i − x_i^{t}) + γ r_2 (g − x_i^{t}); position update: x_i^{t+1} = x_i^{t} + v_i^{t+1}. Terms: α v_i^t — INERTIA, retains previous direction (exploration). β r_1 (p_i − x_i) — COGNITIVE component, pulls the particle towards its OWN best position p_i seen so far. γ r_2 (g − x_i) — SOCIAL component, pulls towards the GLOBAL best g of the entire swarm. r_1, r_2 are independent U(0,1) random numbers per update, providing stochasticity. Constants α, β, γ trade off exploration (α high) vs convergence (β, γ high).'
        }},
      { label:'b2',
        q:'Briefly explain the Differential Evolution mutation operator.',
        hints:{
          concept:'Lecture 12 — DE creates a trial vector by adding the SCALED DIFFERENCE of two randomly chosen population members to a third.',
          term:'DE/rand/1: v = a + F · (b − c) where a, b, c are distinct random individuals from the population. F ∈ (0, 2] is the scaling factor.',
          formula:'\\vec{v}_i = \\vec{a} + F\\,(\\vec{b} - \\vec{c})\\\\ a, b, c \\in P,\\ a \\ne b \\ne c \\ne \\vec{x}_i\\\\ F \\in (0, 2]',
          approach:'(1) State the formula. (2) Explain the geometric intuition: (b − c) is a vector drawn from the population\'s own DISTRIBUTION, so the step scale adapts to current diversity. (3) Mention the optional binomial crossover with the parent x_i.',
          answer:'For each parent x_i pick three DISTINCT random population members a, b, c (none equal to x_i). Form the mutant vector v_i = a + F · (b − c) where F is a user-set scaling factor (commonly F ≈ 0.5–1.0). Intuition: the difference (b − c) is a vector sampled FROM the population\'s own current spread, so the step size automatically ADAPTS to remaining diversity — large when the population is spread out, small as it converges. After mutation, DE typically applies a per-coordinate binomial crossover with x_i to produce the trial child, which then competes 1-to-1 against x_i for a slot in the next generation.'
        }},
      { label:'c',
        q:'Briefly state one situation in which you would prefer PSO over DE, and one situation in which you would prefer DE over PSO.',
        hints:{
          concept:'Lecture 12 — both are excellent on continuous landscapes; they differ in how they balance exploration/exploitation and respond to landscape geometry.',
          term:'PSO converges quickly when the swarm can identify a single global best; struggles on rugged, deceptive landscapes. DE\'s adaptive step (b − c) is robust on rugged and multi-modal surfaces.',
          formula:'\\text{PSO: fast on unimodal / single-attractor}\\\\ \\text{DE: robust on multi-modal / rugged}',
          approach:'Pick contrasting characteristics: PSO wins when global best is informative (unimodal-ish), DE wins on rugged multi-modal. Mention tuning sensitivity, convergence speed.',
          answer:'Prefer PSO when the landscape is largely UNIMODAL or has a single dominant basin — the swarm rapidly converges towards the global best g, giving fast wall-clock progress. Prefer DE when the landscape is RUGGED and MULTI-MODAL — DE\'s mutation (b − c) draws step sizes from the population\'s own current spread, so it automatically maintains useful step sizes as the population evolves, and it does not collapse into a single attractor as easily as PSO. For Tane\'s known-multi-modal CFD problem, DE is the safer default.'
        }},
    ]
  },
  {
    id:'q7-sione-neuralnet', title:'Neural Network for MNIST',
    lectures:['L15'], accent:'#ec4899', icon:'⟦⟧', source:'Author · Q7',
    scenario:'Sione is training a fully-connected feed-forward neural network to classify 28×28 grayscale MNIST digits. He plans to use the standard architecture: 784 inputs → two hidden layers (each with 30 sigmoid neurons) → 10 sigmoid outputs.',
    setup:'He intends to train using mini-batch gradient descent on the mean squared error.',
    parts:[
      { label:'a',
        q:'State the dimensions of Sione\'s input vector x and target vector y for a single training example, and write down the quadratic cost function he will minimise (across n training examples).',
        hints:{
          concept:'Lecture 15 — MNIST setup: 784 input pixels (normalised 0–1), 10-D one-hot targets.',
          term:'Input dim: 28·28 = 784. Output dim: 10 (one neuron per digit class). Cost: quadratic (½ MSE).',
          formula:'\\vec{x} \\in \\mathbb{R}^{784},\\ \\vec{y} \\in \\{0,1\\}^{10}\\\\ C(w, b) = \\frac{1}{2n}\\sum_{\\vec{x}}\\|\\vec{y}(\\vec{x}) - \\vec{a}\\|_2^2',
          approach:'(1) State x dim from 28×28 = 784. (2) State y dim = 10 (one-hot). (3) Write quadratic cost formula with ½ factor explained as cancelling the 2 from differentiation.',
          answer:'Input x ∈ ℝ^{784} (the flattened 28×28 grayscale pixels, normalised to [0,1]). Target y ∈ {0,1}^{10} is one-hot — e.g. y = [0,0,0,0,0,0,1,0,0,0]^T denotes a "6". Quadratic cost across n training examples: C(w, b) = (1/2n) Σ_x ||y(x) − a(x)||_2^2, where a(x) is the network output (the activation at the output layer) for input x. The ½ is a convenience: it cancels the 2 that drops out when we differentiate the squared norm, leaving cleaner gradient formulas.'
        }},
      { label:'b',
        q:'Briefly explain the role of the backpropagation algorithm. Write down the four backpropagation equations.',
        hints:{
          concept:'Lecture 15 — backprop computes ALL the partial derivatives ∂C/∂w and ∂C/∂b efficiently by reusing intermediate quantities.',
          term:'Local error δ^l_j = ∂C/∂z^l_j. Forward pass computes z^l, a^l; backward pass propagates δ from output to input.',
          formula:'\\delta^L = \\nabla_a C \\odot \\sigma\'(z^L) \\quad (\\text{BP-1})\\\\ \\delta^l = ((w^{l+1})^T \\delta^{l+1}) \\odot \\sigma\'(z^l) \\quad (\\text{BP-2})\\\\ \\partial C / \\partial b^l_j = \\delta^l_j \\quad (\\text{BP-3})\\\\ \\partial C / \\partial w^l_{jk} = a^{l-1}_k \\delta^l_j \\quad (\\text{BP-4})',
          approach:'(1) State the goal: compute ∇C(w, b) for gradient descent. (2) Define δ^l. (3) Write the four equations in order (BP-1 output error, BP-2 propagate, BP-3 bias gradient, BP-4 weight gradient).',
          answer:'Role: backpropagation computes the gradient of the cost C with respect to EVERY weight and bias in the network in O(network size) per training example — using the chain rule efficiently by sharing intermediate quantities. Without it, naive numerical differentiation would require one forward pass per parameter (millions). Define the local error δ^l_j ≡ ∂C/∂z^l_j. The four BP equations: (BP-1) Output error: δ^L = ∇_a C ⊙ σ\'(z^L). (BP-2) Backpropagation: δ^l = ((w^{l+1})^T δ^{l+1}) ⊙ σ\'(z^l). (BP-3) Bias gradient: ∂C/∂b^l_j = δ^l_j. (BP-4) Weight gradient: ∂C/∂w^l_{jk} = a^{l-1}_k δ^l_j.'
        }},
      { label:'c',
        q:'Briefly explain why Sione uses sigmoid activations rather than step functions in the hidden layers.',
        hints:{
          concept:'Lecture 13/15 — the step function is non-differentiable; gradient methods need a smooth activation.',
          term:'σ is continuously differentiable; σ\'(z) = σ(z)(1 − σ(z)) is its self-derivative identity. Step function has zero gradient almost everywhere and is undefined at the threshold.',
          formula:'\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z)) \\quad \\text{(self-derivative)}\\\\ \\text{Step}\'(z) = 0 \\text{ a.e., undefined at } z=0',
          approach:'Two reasons: (1) differentiability — needed for backprop; (2) graceful response — small input perturbations cause small output changes (cf. Q2 graceful degradation).',
          answer:'Two reasons. (1) Differentiability: backpropagation requires ∂C/∂w via the chain rule, which in turn requires σ\'(z). The sigmoid is continuously differentiable everywhere with a clean self-derivative identity σ\'(z) = σ(z)(1 − σ(z)) — so once we have the forward activation a = σ(z), the gradient is essentially free. The step function has gradient zero almost everywhere and is undefined at the threshold, so it kills the gradient signal during backprop. (2) Graceful response: sigmoids let small input perturbations produce small output changes, supporting graceful degradation and stable training.'
        }},
      { label:'d',
        q:'State the Universal Approximation Theorem (informally) and one practical caveat.',
        hints:{
          concept:'Lecture 15 — UAT establishes the EXPRESSIVENESS of feed-forward networks. The caveat is about EXISTENCE vs FINDABILITY.',
          term:'UAT: for any continuous target f and any ε > 0, there exists a feed-forward NN with one hidden layer such that |g(x) − f(x)| < ε for all x.',
          formula:'\\forall \\epsilon > 0\\ \\exists g\\ (\\text{one hidden layer})\\ :\\ |g(\\vec{x}) - f(\\vec{x})| < \\epsilon\\ \\forall \\vec{x}',
          approach:'(1) State the theorem informally. (2) Stress "exists" not "easy to find". (3) Note that approximation may require MANY hidden units, and gradient descent may not actually converge to the optimal g.',
          answer:'Universal Approximation Theorem (informal): for any continuous target function f and any desired precision ε > 0, there exists a feed-forward neural network with ONE hidden layer whose output g satisfies |g(x) − f(x)| < ε for all x. The theorem holds with sigmoid activation and arbitrary input/output dimensions. Caveat: the theorem is EXISTENTIAL only — it does NOT promise (a) that backpropagation will FIND such a network, (b) that the network is small or efficient, or (c) that the required number of hidden units is bounded. In practice, achieving ε precision may need impractically many neurons, and training may get stuck in local minima.'
        }},
    ]
  },
  {
    id:'q8-lina-calculus', title:'Vector Calculus Refresher',
    lectures:['L5'], accent:'#34d399', icon:'∂', source:'Author · Q8',
    scenario:'Lina is studying a smooth loss function f : ℝ^3 → ℝ that arises in a regression problem.',
    setup:'She wants to characterise its critical points and use the gradient to design an iterative optimiser.',
    parts:[
      { label:'a',
        q:'Define the partial derivative ∂f/∂x_i at a point and give a one-sentence geometric interpretation.',
        hints:{
          concept:'Lecture 5 — partial derivative = the rate of change of f along ONE coordinate direction, holding others fixed.',
          term:'∂f/∂x_i = lim_{h→0} (f(x + h e_i) − f(x)) / h, where e_i is the i-th unit vector.',
          formula:'\\frac{\\partial f}{\\partial x_i}(\\vec{x}) = \\lim_{h \\to 0} \\frac{f(\\vec{x} + h\\,\\vec{e}_i) - f(\\vec{x})}{h}',
          approach:'(1) Give the limit definition. (2) State that geometrically it is the slope of the curve obtained by cutting the graph of f with the plane through x parallel to the x_i-axis.',
          answer:'∂f/∂x_i(x) = lim_{h→0} (f(x + h e_i) − f(x)) / h, where e_i is the i-th standard basis vector. Geometrically: it is the SLOPE of the curve obtained by holding every coordinate except x_i fixed and walking along the x_i-axis — the rate of change of f in the i-th coordinate direction at the point x.'
        }},
      { label:'b',
        q:'Write down the gradient ∇f(x) of a scalar function f : ℝ^n → ℝ and explain why it points in the direction of steepest ascent.',
        hints:{
          concept:'Lecture 5 — the gradient is a VECTOR of partial derivatives; its direction maximises the directional derivative ∂f/∂u.',
          term:'∇f(x) = (∂f/∂x_1, …, ∂f/∂x_n)^T. Directional derivative ∂f/∂u = ∇f · u (for unit u).',
          formula:'\\nabla f(\\vec{x}) = \\begin{bmatrix}\\partial f / \\partial x_1 \\\\ \\vdots \\\\ \\partial f / \\partial x_n\\end{bmatrix}\\\\ \\partial f/\\partial \\vec{u} = \\nabla f \\cdot \\vec{u} \\le \\|\\nabla f\\|',
          approach:'(1) State the gradient vector. (2) Show ∂f/∂u = ∇f · u for unit u. (3) Maximised when u is parallel to ∇f, giving max rate ||∇f||.',
          answer:'∇f(x) = (∂f/∂x_1, ∂f/∂x_2, …, ∂f/∂x_n)^T — the vector of partial derivatives. For any UNIT direction u the directional derivative ∂f/∂u = ∇f(x) · u (Cauchy–Schwarz). This dot product is maximised when u is parallel to ∇f, giving the maximum rate of change ||∇f(x)||. Hence ∇f points in the direction of STEEPEST ASCENT at x; −∇f points in the direction of steepest descent (used by gradient descent).'
        }},
      { label:'c',
        q:'Lina finds a point x* at which ∇f(x*) = 0. Briefly explain how she can decide whether x* is a local minimum, local maximum, or saddle point.',
        hints:{
          concept:'Lecture 5 — second derivative test using the Hessian matrix.',
          term:'Hessian H_{ij} = ∂²f/(∂x_i ∂x_j). H positive-definite ⇒ local min; H negative-definite ⇒ local max; indefinite ⇒ saddle.',
          formula:'H(\\vec{x}^*) = \\bigl[\\partial^2 f/\\partial x_i \\partial x_j\\bigr]_{ij}\\\\ \\text{PD: all eigenvalues } > 0 \\Rightarrow \\text{min}\\\\ \\text{ND: all eigenvalues } < 0 \\Rightarrow \\text{max}\\\\ \\text{indefinite: mixed signs} \\Rightarrow \\text{saddle}',
          approach:'(1) Compute the Hessian H. (2) Inspect eigenvalues (or apply Sylvester\'s criterion). (3) Classify: PD = min, ND = max, mixed signs = saddle, semi-definite needs further analysis.',
          answer:'∇f(x*) = 0 only tells us x* is a CRITICAL POINT. To classify it, compute the Hessian H(x*) = [∂²f/(∂x_i ∂x_j)]. The classification depends on the eigenvalues of H(x*): all eigenvalues POSITIVE ⇒ H is positive-definite ⇒ x* is a LOCAL MINIMUM. All eigenvalues NEGATIVE ⇒ negative-definite ⇒ LOCAL MAXIMUM. MIXED signs ⇒ indefinite ⇒ SADDLE POINT. If any eigenvalue is zero the test is inconclusive and higher-order terms must be examined.'
        }},
      { label:'d',
        q:'State the chain rule for h(x) = f(g(x)) where x is a scalar and f, g are differentiable, and one for a composition involving a scalar function of multiple variables.',
        hints:{
          concept:'Lecture 5 — the chain rule is the backbone of backpropagation in NNs.',
          term:'Scalar chain rule: dh/dx = f\'(g(x)) · g\'(x). Multivariate: if h(x_1, …, x_n) = f(g(x_1, …, x_n)), then ∂h/∂x_i = f\'(g) · ∂g/∂x_i.',
          formula:'\\frac{dh}{dx} = f\'(g(x))\\,g\'(x)\\\\ \\frac{\\partial h}{\\partial x_i} = f\'(g)\\,\\frac{\\partial g}{\\partial x_i}',
          approach:'Write the simple version, then show how it extends partial-by-partial when g maps multiple variables. Mention this is what makes backpropagation tick.',
          answer:'Scalar: if h(x) = f(g(x)) then dh/dx = f\'(g(x)) · g\'(x). Multivariate (scalar valued): if h(x_1,…,x_n) = f(g(x_1,…,x_n)) where f : ℝ → ℝ and g : ℝ^n → ℝ, then ∂h/∂x_i = f\'(g(x)) · ∂g/∂x_i for each i. The general matrix-vector chain rule (Jacobians composed by multiplication) is exactly what backpropagation in a neural network applies layer by layer.'
        }},
    ]
  },
  {
    id:'q9-hemi-xor', title:'XOR & The Single-Neuron Limit',
    lectures:['L14'], accent:'#fbbf24', icon:'⊕', source:'Author · Q9',
    scenario:'Hemi is studying binary classification with a single sigmoid neuron. He attempts to learn the XOR function on inputs (x_1, x_2) ∈ {0,1}^2 with target y = x_1 ⊕ x_2.',
    setup:'After thousands of gradient-descent iterations the cost plateaus at a non-zero value; the neuron cannot reach near-zero training error.',
    parts:[
      { label:'a',
        q:'Explain in 2–3 sentences why a single sigmoid neuron cannot exactly learn the XOR function.',
        hints:{
          concept:'Lecture 14 — a single neuron implements a LINEAR decision boundary (hyperplane). XOR\'s positive class lies on a diagonal that cannot be separated by any straight line.',
          term:'Linear separability: a dataset is linearly separable iff there exists a hyperplane that perfectly separates the two classes. XOR is NOT linearly separable.',
          formula:'\\text{Neuron: } a > 0.5 \\iff w_1 x_1 + w_2 x_2 + b > 0\\\\ \\text{XOR truth: } (0,0)\\!\\to\\!0,\\ (0,1)\\!\\to\\!1,\\ (1,0)\\!\\to\\!1,\\ (1,1)\\!\\to\\!0',
          approach:'(1) A single neuron with sigmoid + threshold 0.5 partitions input space with a LINE w_1x_1 + w_2x_2 + b = 0. (2) XOR\'s "1"-class points are (0,1) and (1,0); the "0"-class points are (0,0) and (1,1). (3) These cannot be separated by any single line — opposite corners of the unit square.',
          answer:'A single sigmoid neuron classifies (a > 0.5) on the linear half-plane w_1 x_1 + w_2 x_2 + b > 0 — a HYPERPLANE in input space. The XOR positive class consists of (0,1) and (1,0), and the negative class consists of (0,0) and (1,1). These two classes occupy OPPOSITE diagonals of the unit square and cannot be separated by any straight line — XOR is not linearly separable, so no choice of (w_1, w_2, b) lets a single neuron implement it exactly.'
        }},
      { label:'b',
        q:'Describe a two-layer network architecture (with how many neurons in each layer) that can implement XOR. State the role of each hidden neuron.',
        hints:{
          concept:'Lecture 14 — two hidden neurons can build OR and (NOT AND), and the output neuron AND-combines them: XOR = OR AND NAND.',
          term:'XOR = (x_1 OR x_2) AND NOT(x_1 AND x_2). One hidden neuron implements OR, another implements NAND, output AND.',
          formula:'h_1 = \\sigma(x_1 + x_2 - 0.5)\\ (\\text{OR})\\\\ h_2 = \\sigma(-x_1 - x_2 + 1.5)\\ (\\text{NAND})\\\\ y = \\sigma(h_1 + h_2 - 1.5)\\ (\\text{AND})',
          approach:'(1) Network: 2 inputs → 2 hidden neurons → 1 output. (2) Set hidden 1 = OR, hidden 2 = NAND. (3) Output AND of the two. (4) Verify on each of the four XOR cases.',
          answer:'Architecture: 2 inputs → 2 hidden sigmoid neurons → 1 sigmoid output. Hidden neuron 1 implements OR (weights (1, 1), bias −0.5): h_1 = σ(x_1 + x_2 − 0.5). Hidden neuron 2 implements NAND (weights (−1, −1), bias +1.5): h_2 = σ(−x_1 − x_2 + 1.5). Output neuron implements AND of (h_1, h_2) (weights (1, 1), bias −1.5): y = σ(h_1 + h_2 − 1.5). Then y > 0.5 iff (x_1 OR x_2) AND NOT(x_1 AND x_2) — exactly XOR.'
        }},
      { label:'c',
        q:'Describe the hyperplane decision boundary of a neuron with n inputs. State the dimension of the boundary and the dimension of the space it divides.',
        hints:{
          concept:'Lecture 14 — for n inputs, the decision boundary {x : w·x + b = 0} is a hyperplane of co-dimension 1 in ℝ^n.',
          term:'Hyperplane: an (n−1)-dimensional affine subspace of ℝ^n that divides the space into two half-spaces.',
          formula:'\\{\\vec{x} \\in \\mathbb{R}^n : \\vec{w} \\cdot \\vec{x} + b = 0\\}\\\\ \\dim = n - 1',
          approach:'State n inputs ⇒ (n−1)-D hyperplane in n-D space. Examples: n=1 point on line; n=2 line in plane; n=3 plane in space; n=n flat hyperplane.',
          answer:'A neuron with n inputs and weights w ∈ ℝ^n, bias b, decides by the sign of w·x + b. Its decision boundary is the set {x ∈ ℝ^n : w·x + b = 0} — an (n−1)-dimensional HYPERPLANE that divides ℝ^n into two half-spaces. Concrete examples: n=1, boundary is a POINT on the real line; n=2, a LINE in the plane; n=3, a PLANE in 3-D space; n=n, a (n−1)-D flat in n-D space.'
        }},
      { label:'d',
        q:'Briefly state the principle of NAND universality and explain its implication for neural networks.',
        hints:{
          concept:'Lecture 14 — NAND (NOT AND) gates can implement ANY Boolean function. Since a single neuron can implement NAND, networks of neurons can compute any Boolean function.',
          term:'NAND universality: AND, OR, NOT, XOR, MUX… can all be built from NAND gates only. A neuron with weights (−1,−1) and bias 1.5 is a NAND.',
          formula:'\\text{NAND}(a, b) = \\neg(a \\wedge b)\\\\ \\text{NAND-only } \\Rightarrow \\text{any Boolean function}\\\\ \\text{Neuron: } \\sigma(-x_1 - x_2 + 1.5) \\approx \\text{NAND}',
          approach:'(1) State NAND universality. (2) Show one neuron implements NAND. (3) Conclude: neural networks (universal Boolean gates + composability) can in principle compute any Boolean function, and via UAT any continuous function.',
          answer:'NAND universality: the NAND gate is functionally COMPLETE — any Boolean function (AND, OR, NOT, XOR, MUX, adders, multipliers, full CPUs) can be constructed from NAND gates alone. A single sigmoid neuron with weights (−1, −1) and bias +1.5 implements NAND (σ(−x_1 − x_2 + 1.5) > 0.5 iff NOT(x_1 AND x_2)). Implication: by COMPOSING enough neurons we can implement any Boolean circuit, and — via the Universal Approximation Theorem — any continuous function. The key practical step is COMPOSABILITY: a single neuron is the building block, and the magic of intelligence emerges from arranging them in layers and circuits.'
        }},
    ]
  },
  {
    id:'q10-ngaire-stochastic', title:'LCG, Hull–Dobell & No Free Lunch',
    lectures:['L8'], accent:'#6366f1', icon:'※', source:'Author · Q10',
    scenario:'Ngaire works on an embedded control system that must generate pseudo-random numbers for a Monte Carlo simulation. Memory is constrained, so she implements a Linear Congruential Generator (LCG).',
    setup:'She also wants to choose an OPTIMISATION ALGORITHM and is aware of the No Free Lunch theorem.',
    parts:[
      { label:'a',
        q:'Write down the LCG recurrence and define each parameter. State why a Mersenne prime is a desirable choice for the modulus m.',
        hints:{
          concept:'Lecture 8 — LCG produces a deterministic sequence approximating uniform randomness. Choice of m, a, c critically affects period and equidistribution.',
          term:'Recurrence X_{n+1} = (a X_n + c) mod m. Mersenne primes m = 2^p − 1 (with p prime) have very few factors → long full periods are easier to achieve.',
          formula:'X_{n+1} = (a\\,X_n + c)\\bmod m\\\\ \\text{Mersenne: } m = 2^p - 1,\\ p\\ \\text{prime},\\ m\\ \\text{prime}',
          approach:'(1) Write recurrence. (2) Identify X_0 (seed), a (multiplier), c (increment), m (modulus). (3) Note period ≤ m. (4) Many small factors ⇒ short sub-cycles. Mersenne primes have very few factors ⇒ long period is easier to guarantee.',
          answer:'Recurrence: X_{n+1} = (a · X_n + c) mod m. Parameters: X_0 (seed — initial value), a (multiplier), c (increment / additive constant), m (modulus — sets the output range [0, m−1]). The period is at most m. A modulus with many divisors (e.g. m = 12 = 2²·3) tends to produce short cycles and poor equidistribution. A MERSENNE PRIME m = 2^p − 1 (where p is itself prime, e.g. p = 3, 5, 7, 13, 17 …) is prime by construction and has very few factors, making it easy to satisfy the conditions for a full-period LCG of length m.'
        }},
      { label:'b',
        q:'Briefly state the Hull–Dobell theorem (the three conditions for a full-period LCG).',
        hints:{
          concept:'Lecture 8 — Hull–Dobell gives necessary and sufficient conditions for the LCG period to equal the modulus m.',
          term:'Three conditions: (1) gcd(c, m) = 1, (2) (a − 1) is divisible by every prime factor of m, (3) if 4 | m then 4 | (a − 1).',
          formula:'\\text{Period} = m \\iff \\begin{cases}\\gcd(c, m) = 1 \\\\ p \\mid m \\Rightarrow p \\mid (a-1)\\ \\forall \\text{ prime } p \\\\ 4 \\mid m \\Rightarrow 4 \\mid (a-1)\\end{cases}',
          approach:'List the three conditions and add the conclusion: when all three hold, the LCG visits every value in {0, 1, …, m−1} exactly once per period.',
          answer:'Hull–Dobell: the LCG attains its maximum possible period m if and only if all three of the following hold: (1) gcd(c, m) = 1 — the increment is coprime with the modulus. (2) For every prime p dividing m, p also divides (a − 1). (3) If 4 divides m then 4 divides (a − 1). When all three conditions are satisfied, the sequence cycles through every value in {0, 1, …, m − 1} exactly once before repeating.'
        }},
      { label:'c',
        q:'State the No Free Lunch theorem (Wolpert & Macready, 1997).',
        hints:{
          concept:'Lecture 8 — NFL is a deep result about algorithm selection: there is no universal champion across the space of all possible objective functions.',
          term:'NFL: averaged over the set of ALL possible objective functions, every search algorithm has identical performance. Any gain on one class of problems is balanced by a loss on another.',
          formula:'\\sum_f \\text{Perf}(A_1, f) = \\sum_f \\text{Perf}(A_2, f) \\quad \\forall A_1, A_2',
          approach:'(1) State the average-over-all-functions equivalence. (2) Stress the practical takeaway — algorithm selection must use DOMAIN KNOWLEDGE about the specific problem class.',
          answer:'No Free Lunch (Wolpert & Macready, 1997): averaged over the set of ALL possible objective functions, every search algorithm has identical expected performance. Equivalently, any performance advantage that an algorithm enjoys on one class of problems is exactly counter-balanced by an equal disadvantage on some other class. Practical consequence: there is no UNIVERSALLY OPTIMAL optimisation algorithm. Algorithm selection must be informed by DOMAIN KNOWLEDGE about the specific problem class — its smoothness, modality, separability, noise, etc.'
        }},
      { label:'d',
        q:'Briefly explain why the No Free Lunch theorem does NOT mean "random search is just as good as any other algorithm" in practice.',
        hints:{
          concept:'Lecture 8 — NFL averages over ALL functions, including bizarre/pathological ones. Real-world problems are not drawn uniformly from this set.',
          term:'Real-world functions have STRUCTURE — locality, smoothness, low-frequency components, hierarchical decomposition. NFL\'s "all functions" includes random-noise functions that lack any structure to exploit.',
          formula:'\\text{Real problems} \\subsetneq \\text{All possible problems}\\\\ \\text{Structure} \\to \\text{Exploitable} \\to \\text{Better-than-random}',
          approach:'(1) NFL averages over uniform distribution on functions. (2) Real problems are a TINY, STRUCTURED subset. (3) Structure can be exploited (gradient on smooth problems, building blocks for GA, etc.).',
          answer:'NFL averages performance over the set of ALL possible objective functions — including, in equal weight, completely structureless random-noise functions on which no algorithm can do better than random search. Real-world problems are NOT uniformly distributed over that set: they have rich STRUCTURE (smoothness, locality, low-frequency components, hierarchical decomposability). Algorithms that EXPLOIT a particular kind of structure (gradient descent → smooth + differentiable; GA → recombinable building blocks; SA → metastable basins) outperform random search on the small structured subset of problems that matters in practice. NFL is a warning against believing in a UNIVERSAL champion, not an endorsement of randomness on real problems.'
        }},
    ]
  },
  {
    id:'q11-pippa-intelligence', title:'Defining Intelligence & Soft Computing',
    lectures:['L1','L2'], accent:'#ec4899', icon:'⊙', source:'Author · Q11',
    scenario:'Pippa is preparing a one-page brief for an AI-safety committee. She is asked to explain what AI researchers mean by "intelligence" and why the field needs SOFT computing techniques (as opposed to classical symbolic AI).',
    setup:'She must keep her language precise but accessible to non-specialists.',
    parts:[
      { label:'a',
        q:'Briefly describe the four "quadrants" of definitions of AI as catalogued by Russell & Norvig. Indicate which quadrant the Turing Test belongs to.',
        hints:{
          concept:'Lecture 1 — Russell & Norvig\'s 2 × 2 grid: thinking vs acting, humanly vs rationally.',
          term:'Four quadrants: Thinking Humanly (cognitive modelling), Thinking Rationally (logic), Acting Humanly (Turing Test), Acting Rationally (rational agents).',
          formula:'\\begin{array}{c|cc} & \\text{Humanly} & \\text{Rationally} \\\\ \\hline \\text{Think} & \\text{Cognitive modelling} & \\text{Laws of thought} \\\\ \\text{Act}   & \\text{Turing Test}        & \\text{Rational agent} \\end{array}',
          approach:'(1) Lay out the 2 × 2 grid (think vs act, humanly vs rationally). (2) One sentence per quadrant. (3) Locate the Turing Test in "Acting Humanly".',
          answer:'Four quadrants (2 axes × 2 values): Thinking Humanly — building systems that REASON like humans do (cognitive modelling). Thinking Rationally — systems that follow the LAWS OF THOUGHT (logic, deduction). Acting Humanly — systems that BEHAVE indistinguishably from a human (the Turing Test belongs here). Acting Rationally — systems that, given goals and beliefs, take actions that MAXIMISE expected utility (rational agents — currently the dominant AI definition).'
        }},
      { label:'b',
        q:'Briefly explain the Turing Test and state one common critique of it.',
        hints:{
          concept:'Lecture 1 — Turing\'s 1950 Imitation Game proposed behavioural indistinguishability as a sufficient criterion for machine intelligence.',
          term:'Turing Test: a human judge converses (via text) with both a human and a machine. If the judge cannot reliably tell which is which, the machine "passes".',
          formula:'\\text{Pass} \\iff P(\\text{judge correctly identifies}) \\approx 0.5',
          approach:'(1) Describe the setup (text-only conversation, blind judge). (2) Provide a critique: Searle\'s Chinese Room (behaviour ≠ understanding), or that it tests imitation rather than reasoning, or that modern LLMs can pass without "intelligence" in any robust sense.',
          answer:'A human judge holds an unrestricted text-only conversation with two unseen participants — one human, one machine. If the judge cannot reliably distinguish the machine from the human, the machine "passes" the Turing Test. Common critique: behavioural indistinguishability is not the same as UNDERSTANDING (Searle\'s Chinese Room — a system that produces the right Chinese outputs need not understand Chinese). Modern LLMs routinely fool casual judges without anyone claiming they "think"; the test confuses imitation with cognition.'
        }},
      { label:'c',
        q:'Compare symbolic and sub-symbolic AI. Give one strength and one weakness of each.',
        hints:{
          concept:'Lecture 2 — symbolic (rules, knowledge bases) vs sub-symbolic (neural networks, statistical learning).',
          term:'Symbolic: explicit logical representation, IF–THEN rules. Sub-symbolic: distributed numerical encoding, learned from data.',
          formula:'\\text{Symbolic: } \\text{IF } 7\\text{-segments include}\\{a,b,c\\} \\text{ THEN } 7\\\\ \\text{Sub-symbolic: vector of activations}',
          approach:'For each paradigm: (1) describe; (2) one strength; (3) one weakness. Symbolic: + interpretable / − brittle. Sub-symbolic: + graceful degradation / − opaque.',
          answer:'Symbolic AI: knowledge is represented by EXPLICIT LOGICAL STRUCTURES (rules, facts, ontologies). Strength: highly INTERPRETABLE — a human can read the rules and verify the reasoning. Weakness: BRITTLE — small input perturbations or unforeseen cases break the rules; coping with noise is hard. Sub-symbolic AI: knowledge is represented as a DISTRIBUTED PATTERN OF ACTIVATIONS (weights in a neural network). Strength: GRACEFUL DEGRADATION — handles noise, partial inputs, and novel cases robustly; learns from data. Weakness: OPAQUE — it is difficult to extract a human-readable explanation of why the system produced a particular output.'
        }},
      { label:'d',
        q:'Briefly explain why we cannot in general expect a classical optimisation problem (with full mathematical specification) to capture every real-world decision problem. Mention one feature of the real world that motivates SOFT computing.',
        hints:{
          concept:'Lecture 2 — classical optimisation assumes a closed, well-specified model. The real world is messy: incomplete information, noise, dynamic environments.',
          term:'Soft computing features: tolerance for imprecision, ability to handle noisy / partial / missing data, adaptation to changing conditions.',
          formula:'\\text{Classical: } \\min f(\\vec{x})\\ \\text{s.t.}\\ g(\\vec{x}) = 0\\\\ \\text{Real: noisy, dynamic, partial, sometimes-non-stationary}',
          approach:'List real-world features classical models can\'t capture: (1) noise / measurement error; (2) incomplete information; (3) non-stationarity; (4) qualitative trade-offs without numerical metric; (5) emergence and feedback. Argue these motivate adaptive, learning-based, "soft" approaches.',
          answer:'Classical optimisation assumes a closed, fully-specified model: a complete cost function f, a complete constraint set, and full information about the environment. The real world is not closed: it has NOISE (sensor and measurement error), MISSING DATA, NON-STATIONARITY (the cost surface shifts over time as the environment changes), and qualitative trade-offs (fairness, aesthetics, ethics) that cannot be reduced to a single numerical metric. Soft computing techniques — neural networks, evolutionary algorithms, fuzzy logic, probabilistic reasoning — tolerate imprecision and noise, adapt to changing conditions, and degrade gracefully when their assumptions are violated. They are the right tool for problems whose specification is itself partial.'
        }},
    ]
  },
];

// ── Progress persistence ──────────────────────────────────────────────────────
const EXAM_VAULT_KEY = 'cits4404_examvault_v1';
function loadVaultProgress() {
  try {
    const raw = localStorage.getItem(EXAM_VAULT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { hintsRevealed: {}, partRating: {}, lastOpened: null };
}
function saveVaultProgress(p) {
  try { localStorage.setItem(EXAM_VAULT_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// Aggregate stats helpers
function partKey(qid, label) { return `${qid}|${label}`; }
function partRating(progress, qid, label) {
  return progress.partRating?.[partKey(qid, label)] || null;
}
function questionStatus(progress, q) {
  const ratings = q.parts.map(p => partRating(progress, q.id, p.label));
  const rated   = ratings.filter(r => r !== null);
  if (rated.length === 0) return { kind:'fresh', label:'untouched' };
  if (rated.length < q.parts.length) return { kind:'progress', label:`${rated.length}/${q.parts.length} attempted` };
  const allEasy = rated.every(r => r === 'easy');
  if (allEasy) return { kind:'mastered', label:'mastered' };
  const anyHard = rated.some(r => r === 'hard');
  if (anyHard) return { kind:'review', label:'needs review' };
  return { kind:'attempted', label:'attempted' };
}

// ── Hint reveal — one button per layer ────────────────────────────────────────
function HintReveal({ type, content, isOpen, onToggle }) {
  return (
    <div style={{marginBottom:'0.45rem'}}>
      <button
        onClick={onToggle}
        style={{
          width:'100%',
          textAlign:'left',
          background: isOpen ? `${type.color}1a` : 'rgba(15,23,42,0.45)',
          border: `1px solid ${isOpen ? type.color : 'rgba(148,163,184,0.22)'}`,
          borderRadius:8,
          padding:'0.55rem 0.85rem',
          cursor:'pointer',
          display:'flex',
          alignItems:'center',
          gap:'0.65rem',
          fontFamily:'inherit',
          color: isOpen ? type.color : 'var(--text-1)',
          transition:'all 0.18s',
        }}>
        <span style={{fontSize:'1.15rem'}}>{type.icon}</span>
        <span style={{display:'flex', flexDirection:'column', alignItems:'flex-start', flex:1}}>
          <span style={{fontSize:'0.78rem', fontWeight:700, letterSpacing:'0.02em'}}>{type.label}</span>
          <span style={{fontSize:'0.66rem', color:'var(--text-2)', marginTop:1}}>{type.sub}</span>
        </span>
        <span style={{fontSize:'0.7rem', color:isOpen ? type.color : 'var(--text-2)', fontFamily:'monospace'}}>{isOpen ? '▼ open' : '▶ peel'}</span>
      </button>
      {isOpen && (
        <div style={{
          marginTop:6,
          padding:'0.65rem 0.85rem 0.7rem 1.1rem',
          background:`${type.color}0d`,
          borderLeft:`3px solid ${type.color}`,
          borderRadius:'0 8px 8px 0',
          fontSize: type.key === 'formula' ? '0.85rem' : '0.8rem',
          color:'var(--text-1)',
          lineHeight:1.65,
        }}>
          {type.key === 'formula' ? <Tex src={content} block /> : content}
        </div>
      )}
    </div>
  );
}

// ── Single part (a, b, c, …) ──────────────────────────────────────────────────
function PartCard({ qid, part, progress, setProgress, accent }) {
  const key = partKey(qid, part.label);
  const revealed = progress.hintsRevealed[key] || [];
  const rating   = progress.partRating[key] || null;

  const toggleHint = (hintKey) => {
    setProgress(p => {
      const cur = p.hintsRevealed[key] || [];
      const next = cur.includes(hintKey) ? cur.filter(k => k !== hintKey) : [...cur, hintKey];
      const np = { ...p, hintsRevealed:{ ...p.hintsRevealed, [key]: next } };
      saveVaultProgress(np);
      return np;
    });
  };
  const setRating = (val) => {
    setProgress(p => {
      const np = { ...p, partRating:{ ...p.partRating, [key]: val } };
      saveVaultProgress(np);
      return np;
    });
  };
  const resetPart = () => {
    setProgress(p => {
      const np = { ...p,
        hintsRevealed:{ ...p.hintsRevealed, [key]: [] },
        partRating:{ ...p.partRating, [key]: null }
      };
      saveVaultProgress(np);
      return np;
    });
  };

  return (
    <div style={{
      background:'rgba(15,23,42,0.55)',
      border:`1px solid ${accent}33`,
      borderLeft:`3px solid ${accent}`,
      borderRadius:10,
      padding:'0.95rem 1.05rem',
      marginBottom:'0.95rem',
    }}>
      <div style={{display:'flex', alignItems:'baseline', gap:'0.6rem', marginBottom:'0.65rem', flexWrap:'wrap'}}>
        <span style={{fontFamily:'monospace', fontSize:'1.05rem', fontWeight:800, color:accent}}>({part.label})</span>
        <span style={{fontSize:'0.88rem', color:'var(--text-1)', lineHeight:1.55, flex:1}}>{part.q}</span>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.55rem'}}>
        <span style={{fontSize:'0.66rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.06em'}}>CONE OF RECALL</span>
        <span style={{flex:1, height:1, background:'linear-gradient(90deg, rgba(148,163,184,0.3), transparent)'}}/>
        <span style={{fontSize:'0.66rem', color:'var(--text-2)', fontFamily:'monospace'}}>{revealed.length}/{HINT_TYPES.length} peeled</span>
      </div>

      {HINT_TYPES.map(type => (
        <HintReveal
          key={type.key}
          type={type}
          content={part.hints[type.key]}
          isOpen={revealed.includes(type.key)}
          onToggle={() => toggleHint(type.key)}
        />
      ))}

      <div style={{
        marginTop:'0.7rem',
        padding:'0.55rem 0.7rem',
        background:'rgba(15,23,42,0.45)',
        border:'1px dashed rgba(148,163,184,0.25)',
        borderRadius:8,
        display:'flex',
        flexWrap:'wrap',
        alignItems:'center',
        gap:'0.55rem',
      }}>
        <span style={{fontSize:'0.7rem', color:'var(--text-2)', fontFamily:'monospace'}}>Self-rate (after attempting):</span>
        {[
          { v:'hard', l:'✘ Hard', c:'#fb7185', d:'Need to revisit' },
          { v:'ok',   l:'◍ OK',   c:'#fbbf24', d:'Got most of it' },
          { v:'easy', l:'★ Easy', c:'#34d399', d:'Locked in' },
        ].map(opt => (
          <button key={opt.v}
            onClick={() => setRating(opt.v)}
            title={opt.d}
            style={{
              background: rating === opt.v ? `${opt.c}26` : 'rgba(15,23,42,0.55)',
              border: `1px solid ${rating === opt.v ? opt.c : 'rgba(148,163,184,0.22)'}`,
              color: rating === opt.v ? opt.c : 'var(--text-1)',
              borderRadius:6,
              padding:'0.25rem 0.7rem',
              cursor:'pointer',
              fontSize:'0.72rem',
              fontWeight:600,
              fontFamily:'inherit',
            }}>{opt.l}</button>
        ))}
        <span style={{flex:1}}/>
        <button onClick={resetPart}
          style={{background:'rgba(15,23,42,0.6)', border:'1px solid rgba(148,163,184,0.2)', color:'var(--text-2)', borderRadius:6, padding:'0.22rem 0.6rem', cursor:'pointer', fontSize:'0.7rem', fontFamily:'monospace'}}>↻ reset</button>
      </div>
    </div>
  );
}

// ── Question detail panel ─────────────────────────────────────────────────────
function QuestionPanel({ q, progress, setProgress, onBack }) {
  const status = questionStatus(progress, q);
  const totalHints = q.parts.reduce((acc, p) => acc + (progress.hintsRevealed[partKey(q.id, p.label)]?.length || 0), 0);
  const maxHints = q.parts.length * HINT_TYPES.length;

  const peelAll = () => {
    setProgress(p => {
      const np = { ...p, hintsRevealed:{ ...p.hintsRevealed } };
      q.parts.forEach(part => { np.hintsRevealed[partKey(q.id, part.label)] = HINT_TYPES.map(t => t.key); });
      saveVaultProgress(np);
      return np;
    });
  };
  const resetQuestion = () => {
    if (!window.confirm(`Reset all hints and ratings for "${q.title}"?`)) return;
    setProgress(p => {
      const np = { ...p, hintsRevealed:{ ...p.hintsRevealed }, partRating:{ ...p.partRating } };
      q.parts.forEach(part => {
        np.hintsRevealed[partKey(q.id, part.label)] = [];
        np.partRating[partKey(q.id, part.label)] = null;
      });
      saveVaultProgress(np);
      return np;
    });
  };

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.85rem', flexWrap:'wrap'}}>
        <button onClick={onBack} className="m4-algo-tab" style={{padding:'3px 11px', fontSize:'0.72rem'}}>← Vault</button>
        <span style={{padding:'2px 9px', background:`${q.accent}22`, border:`1px solid ${q.accent}55`, borderRadius:6, color:q.accent, fontSize:'0.65rem', fontFamily:'monospace', letterSpacing:'0.05em', fontWeight:700}}>{q.icon} {q.title.toUpperCase()}</span>
        <span style={{fontSize:'0.65rem', color:'var(--text-2)', fontFamily:'monospace'}}>{q.lectures.join(' · ')} · {q.source}</span>
        <span style={{flex:1}}/>
        <span style={{fontSize:'0.66rem', color:'var(--text-2)', fontFamily:'monospace'}}>hints {totalHints}/{maxHints}</span>
      </div>

      <div style={{
        background:`linear-gradient(135deg, ${q.accent}14 0%, rgba(15,23,42,0.5) 100%)`,
        border:`1px solid ${q.accent}55`,
        borderRadius:14,
        padding:'1.05rem 1.2rem',
        marginBottom:'1rem',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.55rem'}}>
          <span style={{fontSize:'1.8rem', color:q.accent, fontWeight:800, fontFamily:'monospace'}}>{q.icon}</span>
          <div>
            <div style={{fontSize:'1.18rem', color:'#fff', fontWeight:700, lineHeight:1.3}}>{q.title}</div>
            <div style={{fontSize:'0.7rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.05em'}}>STATUS · {status.label}</div>
          </div>
        </div>
        <div style={{fontSize:'0.85rem', color:'var(--text-1)', lineHeight:1.65, marginTop:'0.5rem'}}>{q.scenario}</div>
        {q.formula && (
          <div style={{margin:'0.7rem 0 0.4rem', padding:'0.6rem 0.9rem', background:'rgba(15,23,42,0.55)', borderLeft:`2px solid ${q.accent}`, borderRadius:'0 8px 8px 0'}}>
            <Tex src={q.formula} block />
          </div>
        )}
        {q.setup && <div style={{fontSize:'0.82rem', color:'var(--text-2)', lineHeight:1.6, marginTop:'0.4rem', fontStyle:'italic'}}>{q.setup}</div>}
      </div>

      <div style={{display:'flex', gap:'0.4rem', marginBottom:'0.7rem', flexWrap:'wrap'}}>
        <button onClick={peelAll} className="m4-algo-tab" style={{padding:'3px 11px', fontSize:'0.7rem'}}>↯ Peel every hint</button>
        <button onClick={resetQuestion} className="m4-algo-tab" style={{padding:'3px 11px', fontSize:'0.7rem'}}>↻ Reset question</button>
      </div>

      {q.parts.map(part => (
        <PartCard key={part.label} qid={q.id} part={part} progress={progress} setProgress={setProgress} accent={q.accent} />
      ))}

      <div style={{display:'flex', justifyContent:'center', marginTop:'0.85rem'}}>
        <button onClick={onBack} className="m4-algo-tab" style={{padding:'5px 18px', fontSize:'0.78rem'}}>← Back to vault</button>
      </div>
    </div>
  );
}

// ── Question grid card ────────────────────────────────────────────────────────
function QuestionDoor({ q, progress, onOpen }) {
  const status = questionStatus(progress, q);
  const ringColor = {
    fresh:    'rgba(148,163,184,0.28)',
    progress: '#fbbf24',
    review:   '#fb7185',
    attempted:'#a78bfa',
    mastered: '#34d399',
  }[status.kind] || 'rgba(148,163,184,0.28)';
  const ratings = q.parts.map(p => partRating(progress, q.id, p.label));
  return (
    <button onClick={onOpen} style={{
      textAlign:'left',
      cursor:'pointer',
      background:`linear-gradient(135deg, ${q.accent}12 0%, rgba(15,23,42,0.55) 100%)`,
      border:`1.5px solid ${ringColor}`,
      borderRadius:14,
      padding:'1rem 1.05rem',
      transition:'transform 0.15s, box-shadow 0.15s',
      fontFamily:'inherit',
      color:'inherit',
      width:'100%',
      display:'flex',
      flexDirection:'column',
      gap:'0.45rem',
      position:'relative',
      overflow:'hidden',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 12px 28px ${q.accent}22`;}}
    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
      <div style={{display:'flex', alignItems:'center', gap:'0.55rem'}}>
        <span style={{fontSize:'1.8rem', color:q.accent, fontWeight:800, fontFamily:'monospace', textShadow:`0 0 14px ${q.accent}55`}}>{q.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:'0.62rem', color:q.accent, fontFamily:'monospace', letterSpacing:'0.08em', fontWeight:700}}>{q.lectures.join(' · ')}</div>
          <div style={{fontSize:'0.95rem', color:'#fff', fontWeight:700, lineHeight:1.25, marginTop:2}}>{q.title}</div>
        </div>
      </div>
      <div style={{fontSize:'0.74rem', color:'var(--text-2)', lineHeight:1.55, maxHeight:'4.5em', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical'}}>{q.scenario}</div>
      <div style={{display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem'}}>
        <span style={{fontSize:'0.66rem', color:'var(--text-2)', fontFamily:'monospace'}}>parts</span>
        {q.parts.map((p, i) => {
          const r = ratings[i];
          const c = r === 'easy' ? '#34d399' : r === 'ok' ? '#fbbf24' : r === 'hard' ? '#fb7185' : 'rgba(148,163,184,0.4)';
          return (
            <span key={p.label} title={r ? `${p.label}: ${r}` : `${p.label}: untouched`}
              style={{width:18, height:18, borderRadius:5, background:`${c}28`, border:`1px solid ${c}`, color:c, fontSize:'0.65rem', fontWeight:700, fontFamily:'monospace', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>{p.label}</span>
          );
        })}
        <span style={{flex:1}}/>
        <span style={{fontSize:'0.65rem', color:ringColor, fontFamily:'monospace', letterSpacing:'0.04em', fontWeight:700, textTransform:'uppercase'}}>{status.label}</span>
      </div>
    </button>
  );
}

// ── Vault grid view ───────────────────────────────────────────────────────────
function VaultGrid({ progress, onOpen, onReset }) {
  const [lectureFilter, setLectureFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Build the lecture filter list dynamically from question metadata.
  const allLectures = useMemo(() => {
    const s = new Set();
    EXAM_QUESTIONS.forEach(q => q.lectures.forEach(l => s.add(l)));
    return ['all', ...Array.from(s).sort((a,b) => {
      const na = parseInt(a.replace('L',''),10), nb = parseInt(b.replace('L',''),10);
      return na - nb;
    })];
  }, []);

  const filtered = useMemo(() => {
    return EXAM_QUESTIONS.filter(q => {
      if (lectureFilter !== 'all' && !q.lectures.includes(lectureFilter)) return false;
      if (statusFilter !== 'all') {
        const st = questionStatus(progress, q).kind;
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [lectureFilter, statusFilter, progress]);

  const tally = useMemo(() => {
    let fresh = 0, progressing = 0, review = 0, attempted = 0, mastered = 0;
    EXAM_QUESTIONS.forEach(q => {
      const k = questionStatus(progress, q).kind;
      if (k === 'fresh') fresh++;
      else if (k === 'progress') progressing++;
      else if (k === 'review') review++;
      else if (k === 'attempted') attempted++;
      else if (k === 'mastered') mastered++;
    });
    return { fresh, progressing, review, attempted, mastered };
  }, [progress]);

  const openRandom = () => {
    const pool = filtered.length ? filtered : EXAM_QUESTIONS;
    onOpen(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div>
      {/* Stats banner */}
      <div style={{
        background:'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(52,211,153,0.07) 100%)',
        border:'1px solid rgba(251,191,36,0.25)',
        borderRadius:12,
        padding:'0.85rem 1.05rem',
        marginBottom:'0.9rem',
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))',
        gap:'0.5rem',
      }}>
        {[
          { l:'TOTAL',     v:EXAM_QUESTIONS.length, c:'#fbbf24' },
          { l:'untouched', v:tally.fresh,           c:'rgba(148,163,184,0.7)' },
          { l:'in progress', v:tally.progressing,   c:'#fbbf24' },
          { l:'attempted', v:tally.attempted,       c:'#a78bfa' },
          { l:'review',    v:tally.review,          c:'#fb7185' },
          { l:'mastered',  v:tally.mastered,        c:'#34d399' },
        ].map(s => (
          <div key={s.l} style={{textAlign:'center'}}>
            <div style={{fontSize:'1.4rem', fontWeight:800, fontFamily:'monospace', color:s.c}}>{s.v}</div>
            <div style={{fontSize:'0.6rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.08em', textTransform:'uppercase'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.7rem', flexWrap:'wrap'}}>
        <span style={{fontSize:'0.7rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.06em'}}>LECTURE</span>
        <div style={{display:'flex', gap:'0.3rem', flexWrap:'wrap'}}>
          {allLectures.map(L => (
            <button key={L} onClick={()=>setLectureFilter(L)}
              style={{
                background: lectureFilter === L ? 'rgba(251,191,36,0.2)' : 'rgba(15,23,42,0.5)',
                border: `1px solid ${lectureFilter === L ? '#fbbf24' : 'rgba(148,163,184,0.22)'}`,
                color: lectureFilter === L ? '#fbbf24' : 'var(--text-1)',
                borderRadius:6, padding:'2px 9px', cursor:'pointer', fontSize:'0.7rem', fontFamily:'monospace', fontWeight:600
              }}>{L === 'all' ? 'all' : L}</button>
          ))}
        </div>
        <span style={{flex:1}}/>
        <button onClick={openRandom} className="m4-algo-tab" style={{padding:'3px 11px', fontSize:'0.7rem'}}>🎲 Random</button>
        <button onClick={onReset} className="m4-algo-tab" style={{padding:'3px 11px', fontSize:'0.7rem'}}>↻ Reset all</button>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.9rem', flexWrap:'wrap'}}>
        <span style={{fontSize:'0.7rem', color:'var(--text-2)', fontFamily:'monospace', letterSpacing:'0.06em'}}>STATUS</span>
        <div style={{display:'flex', gap:'0.3rem', flexWrap:'wrap'}}>
          {[
            { k:'all',       l:'all',         c:'#fbbf24' },
            { k:'fresh',     l:'untouched',   c:'rgba(148,163,184,0.7)' },
            { k:'progress',  l:'in progress', c:'#fbbf24' },
            { k:'attempted', l:'attempted',   c:'#a78bfa' },
            { k:'review',    l:'review',      c:'#fb7185' },
            { k:'mastered',  l:'mastered',    c:'#34d399' },
          ].map(s => (
            <button key={s.k} onClick={()=>setStatusFilter(s.k)}
              style={{
                background: statusFilter === s.k ? `${s.c}22` : 'rgba(15,23,42,0.5)',
                border: `1px solid ${statusFilter === s.k ? s.c : 'rgba(148,163,184,0.22)'}`,
                color: statusFilter === s.k ? s.c : 'var(--text-1)',
                borderRadius:6, padding:'2px 9px', cursor:'pointer', fontSize:'0.7rem', fontFamily:'monospace', fontWeight:600
              }}>{s.l}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap:'0.7rem'}}>
        {filtered.map(q => <QuestionDoor key={q.id} q={q} progress={progress} onOpen={() => onOpen(q)} />)}
      </div>
      {filtered.length === 0 && (
        <div style={{padding:'1.5rem', textAlign:'center', color:'var(--text-2)', fontSize:'0.85rem'}}>
          No questions match the current filters.
        </div>
      )}

      {/* Mode-of-use guide */}
      <div className="m4-card" style={{marginTop:'1rem'}}>
        <div className="m4-card-h">How to use the Exam Vault</div>
        <ol style={{paddingLeft:'1.2rem', fontSize:'0.78rem', color:'var(--text-1)', lineHeight:1.65, margin:0}}>
          <li><strong style={{color:'#fbbf24'}}>Open</strong> a question — read the scenario.</li>
          <li>For each part: <strong>write your answer on paper FIRST</strong>. Resist peeking.</li>
          <li>If stuck, peel back the Cone of Recall in order — Compass → Key Term → Diagram → Forge → Vault. Most parts should be answerable by the Forge stage.</li>
          <li>Self-rate <strong style={{color:'#fb7185'}}>Hard</strong>, <strong style={{color:'#fbbf24'}}>OK</strong>, or <strong style={{color:'#34d399'}}>Easy</strong>. Hard cards bubble up in the Review filter.</li>
          <li>Progress saves automatically. Revisit Reviews after 1, 3, 7 days for spaced repetition.</li>
        </ol>
        <div className="m4-hr"/>
        <div className="m4-flabel">The five hint types — at a glance</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:'0.45rem'}}>
          {HINT_TYPES.map(t => (
            <div key={t.key} style={{padding:'0.5rem 0.7rem', background:`${t.color}10`, border:`1px solid ${t.color}55`, borderRadius:8}}>
              <div style={{fontSize:'1rem', color:t.color, fontWeight:700, marginBottom:2}}>{t.icon} {t.label}</div>
              <div style={{fontSize:'0.7rem', color:'var(--text-2)', lineHeight:1.5}}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ExamVault ────────────────────────────────────────────────────────────
function ExamVault() {
  const [progress, setProgress] = useState(() => loadVaultProgress());
  const [view, setView] = useState({ kind:'list' });

  const open = (q) => {
    setProgress(p => {
      const np = { ...p, lastOpened: q.id };
      saveVaultProgress(np);
      return np;
    });
    setView({ kind:'question', qid: q.id });
  };
  const back = () => setView({ kind:'list' });

  const resetAll = () => {
    if (!window.confirm('Reset ALL Exam Vault progress? This wipes every revealed hint and rating.')) return;
    const fresh = { hintsRevealed:{}, partRating:{}, lastOpened: null };
    setProgress(fresh);
    saveVaultProgress(fresh);
  };

  if (view.kind === 'question') {
    const q = EXAM_QUESTIONS.find(x => x.id === view.qid);
    if (!q) return <div>Question not found.</div>;
    return <QuestionPanel q={q} progress={progress} setProgress={setProgress} onBack={back} />;
  }

  return <VaultGrid progress={progress} onOpen={open} onReset={resetAll} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview','Algorithm Atlas','Memory Cosmos','Exam Vault','Intelligence','Adaptation','Job Shop','Optimisation','Calculus','Algorithms','Population','Genetic Algorithms','Emergent','Perceptron','Neuron Logic','Neural Networks','Labs','Quiz','Practice Exam','Group Project','Dragonfly Algorithm'];
const LAB_TABS  = ['PRNG & LCG','Bin Packing','Job Shop (JSSP)','Solution Space'];

export default function CITS4404() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [labTab, setLabTab] = useState('PRNG & LCG');

  useEffect(() => {
    document.title = 'CITS4404 — Learning Hub';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  return (
    <div className="m4-root">
      <header className="m4-header">
        <div className="m4-header-inner">
          <div className="m4-header-top">
            <button className="umod__back" onClick={() => navigate('/hub')}>← Hub</button>
            <div className="m4-htitle">
              <span className="m4-hcode">CITS4404</span>
              <span className="m4-hname">AI &amp; Adaptive Systems</span>
            </div>
          </div>
          <nav className="m4-tabs">
            {MAIN_TABS.map(t => (
              <button key={t} className={`m4-tab ${tab===t?'m4-tab--on':''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="m4-main">

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <div>
            <div className="m4-hero">
              <div className="m4-hero-lbl">// CITS4404 · UWA · Sem 1, 2025</div>
              <h1 className="m4-hero-title"><span style={{color:'var(--cyan)'}}>AI</span> &amp; Adaptive Systems</h1>
              <p className="m4-hero-sub">Nature-inspired computing. From the definition of intelligence to calculus, gradient descent, and stochastic optimisation — building the full picture of how adaptive systems work.</p>
            </div>
            {/* Memory Cosmos hero banner */}
            <div onClick={() => setTab('Memory Cosmos')} style={{
              cursor:'pointer',
              background:`
                radial-gradient(ellipse at 20% 30%, rgba(167,139,250,0.25) 0%, transparent 45%),
                radial-gradient(ellipse at 80% 70%, rgba(251,113,133,0.22) 0%, transparent 45%),
                radial-gradient(ellipse at 50% 100%, rgba(34,211,238,0.18) 0%, transparent 50%),
                linear-gradient(135deg, #0a0e27 0%, #1a0535 100%)
              `,
              border:'1px solid rgba(167,139,250,0.45)',
              borderRadius:14,
              padding:'1.1rem 1.3rem',
              marginBottom:'0.95rem',
              display:'grid',
              gridTemplateColumns:'1fr auto',
              alignItems:'center',
              gap:'1rem',
              transition:'transform 0.15s, box-shadow 0.15s',
              position:'relative',
              overflow:'hidden',
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 36px rgba(167,139,250,0.25)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
              <div style={{position:'relative', zIndex:1}}>
                <div style={{fontSize:'0.65rem',color:'#a78bfa',fontFamily:'monospace',letterSpacing:'0.1em',fontWeight:700,marginBottom:'0.35rem'}}>✦  MEMORY COSMOS · NEW</div>
                <div style={{fontSize:'1.3rem',color:'#fff',fontWeight:700,marginBottom:'0.3rem',letterSpacing:'-0.01em'}}>Every must-memorise fact as a star · click your way through the universe</div>
                <div style={{fontSize:'0.82rem',color:'rgba(226,232,240,0.78)',lineHeight:1.55}}>
                  A spatial brainstorm of <strong style={{color:'#22d3ee'}}>13 constellations</strong> — one per topic — with every key fact as a star. Click a star for its mnemonic, key points, and a one-question quick check. Lightning Round mode flips through all <strong style={{color:'#fb7185'}}>~60 cards</strong> with a streak counter, and Mnemonics view collects every "exam mantra" in one shimmering wall.
                </div>
              </div>
              <div style={{textAlign:'center',padding:'0 0.5rem', position:'relative', zIndex:1}}>
                <div style={{fontSize:'2.1rem',fontFamily:'monospace',fontWeight:700,color:'#a78bfa',textShadow:'0 0 20px rgba(167,139,250,0.6)'}}>✦</div>
                <div style={{fontSize:'0.66rem',color:'#a78bfa',fontFamily:'monospace',letterSpacing:'0.06em'}}>ENTER COSMOS</div>
              </div>
            </div>

            {/* Exam Vault banner */}
            <div onClick={() => setTab('Exam Vault')} style={{
              cursor:'pointer',
              background:`
                radial-gradient(ellipse at 25% 50%, rgba(251,191,36,0.22) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 50%, rgba(52,211,153,0.18) 0%, transparent 55%),
                linear-gradient(135deg, #1a1408 0%, #0a1a14 100%)
              `,
              border:'1px solid rgba(251,191,36,0.45)',
              borderRadius:14,
              padding:'1.1rem 1.3rem',
              marginBottom:'0.95rem',
              display:'grid',
              gridTemplateColumns:'1fr auto',
              alignItems:'center',
              gap:'1rem',
              transition:'transform 0.15s, box-shadow 0.15s',
              position:'relative',
              overflow:'hidden',
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 36px rgba(251,191,36,0.25)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
              <div style={{position:'relative', zIndex:1}}>
                <div style={{fontSize:'0.65rem',color:'#fbbf24',fontFamily:'monospace',letterSpacing:'0.1em',fontWeight:700,marginBottom:'0.35rem'}}>🗝  EXAM VAULT · NEW</div>
                <div style={{fontSize:'1.3rem',color:'#fff',fontWeight:700,marginBottom:'0.3rem',letterSpacing:'-0.01em'}}>Themed multi-part exam questions with progressive hint reveals</div>
                <div style={{fontSize:'0.82rem',color:'rgba(226,232,240,0.78)',lineHeight:1.55}}>
                  Eleven exam-style scenarios in the official short-answer format. Each part offers the <strong style={{color:'#fbbf24'}}>Cone of Recall</strong> — five hint layers from concept hint → key term → formula → solution approach → model answer. Attempt on paper, peel back hints only when stuck. Covers every lecture L1–L15.
                </div>
              </div>
              <div style={{textAlign:'center',padding:'0 0.5rem', position:'relative', zIndex:1}}>
                <div style={{fontSize:'2.1rem',fontFamily:'monospace',fontWeight:700,color:'#fbbf24',textShadow:'0 0 20px rgba(251,191,36,0.6)'}}>🗝</div>
                <div style={{fontSize:'0.66rem',color:'#fbbf24',fontFamily:'monospace',letterSpacing:'0.06em'}}>OPEN VAULT</div>
              </div>
            </div>

            {/* Algorithm Atlas highlight banner */}
            <div onClick={() => setTab('Algorithm Atlas')} style={{
              cursor:'pointer',
              background:'linear-gradient(135deg, rgba(251,113,133,0.14) 0%, rgba(167,139,250,0.14) 50%, rgba(34,211,238,0.14) 100%)',
              border:'1px solid rgba(251,113,133,0.4)',
              borderRadius:14,
              padding:'1rem 1.25rem',
              marginBottom:'1.2rem',
              display:'grid',
              gridTemplateColumns:'1fr auto',
              alignItems:'center',
              gap:'1rem',
              transition:'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(251,113,133,0.18)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
              <div>
                <div style={{fontSize:'0.65rem',color:'#fb7185',fontFamily:'monospace',letterSpacing:'0.08em',fontWeight:700,marginBottom:'0.35rem'}}>🏛  ALGORITHM ATLAS · NEW</div>
                <div style={{fontSize:'1.3rem',color:'var(--text-1)',fontWeight:700,marginBottom:'0.3rem',letterSpacing:'-0.01em'}}>Memorise every algorithm — the way the exam wants it</div>
                <div style={{fontSize:'0.82rem',color:'var(--text-2)',lineHeight:1.55}}>
                  A self-paced learning journey across <strong style={{color:'#22d3ee'}}>all {ATLAS_ALGOS.length}</strong> lecture algorithms — gradient methods, direct, single-state stochastic, evolutionary, GA, swarm/hybrid. Each algorithm has four study modes (read · fill blanks · reorder steps · rate recall) plus a boss quiz at the end of every stage. Progress saves automatically.
                </div>
              </div>
              <div style={{textAlign:'center',padding:'0 0.5rem'}}>
                <div style={{fontSize:'2rem',fontFamily:'monospace',fontWeight:700,background:'linear-gradient(135deg,#fb7185,#a78bfa,#22d3ee)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>→</div>
                <div style={{fontSize:'0.66rem',color:'#fb7185',fontFamily:'monospace',letterSpacing:'0.06em'}}>BEGIN QUEST</div>
              </div>
            </div>

            <div className="m4-topic-grid">
              {[
                {code:'L1–2', title:'Intelligence & Adaptation', color:'var(--cyan)', desc:'Four quadrants of AI, Turing Test, history from Symbolic AI to LLMs. Why the real world is messy and how nature adapts.', go:'Intelligence'},
                {code:'L3', title:'Optimisation Framework', color:'var(--violet)', desc:'Three ingredients: Language (representation), Model (hypothesis), Metric (evaluation). Hypothesis spaces, MSE, argmin, online vs offline.', go:'Optimisation'},
                {code:'L5', title:'Vector Calculus', color:'var(--emerald)', desc:'Limit definition of derivatives, power/chain/product rules, partial derivatives, gradient vector ∇f, second derivative test.', go:'Calculus'},
                {code:'L6–9', title:'Optimisation Algorithms', color:'var(--amber)', desc:'Gradient descent/ascent, Newton-Raphson, direct methods (CCS, Powell, H-J, Nelder-Mead), stochastic methods (HC, SA, Tabu, ILS), No Free Lunch.', go:'Algorithms'},
                {code:'L4', title:'Job Shop Scheduling', color:'var(--rose)', desc:'JSSP formulation, makespan minimisation (n!)ᵐ solution space, dispatching rules, disjunctive graph, N1 local search, benchmark instances, RPD metric.', go:'Job Shop'},
                {code:'Labs 1–2', title:'PRNG & Bin Packing', color:'var(--violet)', desc:'LCG recurrence, Mersenne primes, full-period theorem. Bin packing heuristics: FF, NF, BF, FFD. Online vs offline algorithms.', go:'Labs'},
                {code:'L11', title:'Genetic Algorithms', color:'var(--emerald)', desc:'Holland\'s GA: binary chromosomes, crossover (1pt/2pt/uniform), selection (roulette, SUS, tournament), elitism. Live crossover & selection visualisers plus a full GA simulator that evolves a target string.', go:'Genetic Algorithms'},
                {code:'L12', title:'Emergent & Hybrid', color:'var(--cyan)', desc:'Particle Swarm Optimisation, Differential Evolution, hybrid/memetic algorithms. Live PSO simulation on the Ackley landscape and an interactive DE mutation visualiser.', go:'Emergent'},
                {code:'L13', title:'Perceptrons & 1-D Classifiers', color:'var(--cyan)', desc:'Step function → logistic sigmoid, bias trick, MSE cost, full chain-rule derivation. Live 1-D and 2-D gradient-descent trainers on the moon-escape problem — including the divergence trap.', go:'Perceptron'},
                {code:'L14', title:'Neurons to Logic — n-D', color:'var(--amber)', desc:'Hyperplane geometry, 7-segment digit trainer, neuron-as-logic-gate, the XOR problem, multi-layer fix. From single neuron to multi-layer perceptron + NAND universality.', go:'Neuron Logic'},
                {code:'Paper', title:'Dragonfly Algorithm', color:'var(--cyan)', desc:'Swarm intelligence metaheuristic (Mirjalili, 2016). Five behavioural operators, live 2D simulation on Ackley function, literature review Q&A with paper references.', go:'Dragonfly Algorithm'},
              ].map(item => (
                <div key={item.code} className="m4-tcard" style={{'--tc':item.color}} onClick={() => setTab(item.go)}>
                  <div className="m4-tcard-code">{item.code}</div>
                  <div className="m4-tcard-title">{item.title}</div>
                  <div className="m4-tcard-desc">{item.desc}</div>
                  <div className="m4-tcard-cta">Explore →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTELLIGENCE ── */}
        {tab === 'Intelligence' && <IntelligenceTab />}

        {/* ── ADAPTATION ── */}
        {tab === 'Adaptation' && <AdaptationTab />}

        {/* ── JOB SHOP ── */}
        {tab === 'Job Shop' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Job Shop Scheduling <span className="m4-badge" style={{background:'var(--rose-dim)',color:'var(--rose)',border:'1px solid rgba(251,113,133,0.3)'}}>Lecture 4</span></h2>
              <p className="m4-sec-sub">From formal problem definition to NP-hardness, dispatching rules, the disjunctive graph model, and local search. One of the most studied combinatorial optimisation problems in CS.</p>
            </div>
            <JobShopTab />
          </>
        )}

        {/* ── OPTIMISATION ── */}
        {tab === 'Optimisation' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Optimisation Framework <span className="m4-badge">Lecture 3</span></h2>
              <p className="m4-sec-sub">Three key ingredients underpin every optimisation problem: the language defining the hypothesis space, a model instantiating a candidate solution, and a metric evaluating quality.</p>
            </div>
            <OptimisationTab />
          </>
        )}

        {/* ── CALCULUS ── */}
        {tab === 'Calculus' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Vector Calculus Refresher <span className="m4-badge">Lecture 5</span></h2>
              <p className="m4-sec-sub">The mathematical foundation for gradient methods. Drag the slider to explore how the tangent line (derivative) changes across any function.</p>
            </div>
            <CalculusTab />
          </>
        )}

        {/* ── ALGORITHMS ── */}
        {tab === 'Algorithms' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Optimisation Algorithms <span className="m4-badge">Lectures 6–9</span></h2>
              <p className="m4-sec-sub">From gradient descent to Newton-Raphson, direct methods, and stochastic search. Each approach handles a different class of hypothesis space.</p>
            </div>
            <AlgorithmsTab />
          </>
        )}

        {/* ── POPULATION ── */}
        {tab === 'Population' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Population-based Methods <span className="m4-badge">Lecture 10</span></h2>
              <p className="m4-sec-sub">Maintain many candidate solutions simultaneously. Evolution Strategies, adaptive mutation, and the full Evolutionary Computation family — from (μ,λ) ES to Genetic Programming and Swarm Intelligence.</p>
            </div>
            <PopulationTab />
          </>
        )}

        {/* ── GENETIC ALGORITHMS ── */}
        {tab === 'Genetic Algorithms' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Genetic Algorithms <span className="m4-badge" style={{background:'var(--emerald-dim)',color:'var(--emerald)',border:'1px solid rgba(52,211,153,0.3)'}}>Lecture 11</span></h2>
              <p className="m4-sec-sub">Holland's evolutionary computing classic. Binary chromosomes, crossover as the primary operator, multiple selection strategies, and elitism. Interact with crossover and selection mechanics, then evolve a target string with the full GA simulator.</p>
            </div>
            <GeneticAlgorithmsTab />
          </>
        )}

        {/* ── EMERGENT ── */}
        {tab === 'Emergent' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Emergent Behaviour &amp; Hybrid Algorithms <span className="m4-badge" style={{background:'rgba(34,211,238,0.12)',color:'var(--cyan)',border:'1px solid rgba(34,211,238,0.3)'}}>Lecture 12</span></h2>
              <p className="m4-sec-sub">When the whole becomes greater than the sum of the parts. Particle Swarm Optimisation and Differential Evolution as continuous-space metaheuristics, and the bridge to memetic / hybrid algorithms that combine local and global search.</p>
            </div>
            <EmergentTab />
          </>
        )}

        {/* ── PERCEPTRON ── */}
        {tab === 'Perceptron' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Perceptrons &amp; 1-D Classifiers <span className="m4-badge" style={{background:'rgba(34,211,238,0.12)',color:'var(--cyan)',border:'1px solid rgba(34,211,238,0.3)'}}>Lecture 13</span></h2>
              <p className="m4-sec-sub">The classification problem. Step functions, the logistic sigmoid, the bias trick, MSE cost surfaces, and the chain-rule derivation of dC/db. Live 1-D and 2-D gradient-descent trainers on the moon-escape-velocity dataset — including the hidden divergence trap.</p>
            </div>
            <PerceptronTab />
          </>
        )}

        {/* ── MEMORY COSMOS ── */}
        {tab === 'Memory Cosmos' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Memory Cosmos <span className="m4-badge" style={{background:'rgba(167,139,250,0.12)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.3)'}}>Brainstorm · Visual</span></h2>
              <p className="m4-sec-sub">A constellation map of every must-memorise fact from the unit. Three complementary views — Cosmos (spatial map), Lightning (rapid flashcards with streak counter), and Mnemonics (the exam mantras). Designed using dual coding, spaced repetition, and active recall — the three best-known principles for long-term retention.</p>
            </div>
            <MemoryCosmosTab />
          </>
        )}

        {/* ── ALGORITHM ATLAS ── */}
        {tab === 'Algorithm Atlas' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Algorithm Atlas <span className="m4-badge" style={{background:'rgba(251,113,133,0.12)',color:'#fb7185',border:'1px solid rgba(251,113,133,0.3)'}}>Memorisation Journey</span></h2>
              <p className="m4-sec-sub">Every algorithm in the unit, written exactly as in the lectures. Study → fill blanks → reorder steps → rate your recall. Beat the boss quiz at the end of each stage. Progress is saved locally and persists between visits.</p>
            </div>
            <AlgorithmAtlasTab />
          </>
        )}

        {/* ── NEURON LOGIC ── */}
        {tab === 'Neuron Logic' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Neurons to Logic — n-D Classifiers <span className="m4-badge" style={{background:'rgba(251,191,36,0.12)',color:'var(--amber)',border:'1px solid rgba(251,191,36,0.3)'}}>Lecture 14</span></h2>
              <p className="m4-sec-sub">From a single neuron to logic gates and multi-layer perceptrons. Interactive 7-segment digit trainer, hyperplane geometry, neuron-as-gate playground, the XOR problem you can't solve with one neuron, and the multi-layer fix.</p>
            </div>
            <NeuronLogicTab />
          </>
        )}

        {/* ── NEURAL NETWORKS ── */}
        {tab === 'Neural Networks' && (
          <>
            <div className="m4-sec-hdr">
              <h2 className="m4-sec-title">Neural Networks &amp; Function Representation <span className="m4-badge" style={{background:'rgba(167,139,250,0.12)',color:'var(--violet)',border:'1px solid rgba(167,139,250,0.3)'}}>Lecture 15</span></h2>
              <p className="m4-sec-sub">From single neurons to multi-layer networks. Biological inspiration, MNIST and the visual cortex hierarchy, feed-forward architecture, training as minimisation, the backpropagation algorithm, and the universal approximation theorem. Every key fact rendered as an interactive widget.</p>
            </div>
            <NeuralNetworksTab />
          </>
        )}

        {/* ── LABS ── */}
        {tab === 'Labs' && (
          <div>
            <div className="m4-labtabs">
              {LAB_TABS.map(lt => (
                <button key={lt} className={`m4-labtab ${labTab===lt?'m4-labtab--on':''}`} onClick={() => setLabTab(lt)}>{lt}</button>
              ))}
            </div>

            {labTab === 'PRNG & LCG' && (<>
              <div className="m4-sec-hdr">
                <h2 className="m4-sec-title">Pseudo-Random Number Generation <span className="m4-badge">Lab 1</span></h2>
                <p className="m4-sec-sub">Explore how the LCG produces deterministic sequences that mimic randomness, and why parameter choice is critical.</p>
              </div>
              <LCGVisualizer />
            </>)}

            {labTab === 'Bin Packing' && (<>
              <div className="m4-sec-hdr">
                <h2 className="m4-sec-title">Bin Packing Heuristics <span className="m4-badge" style={{background:'var(--amber-dim)',color:'var(--amber)',border:'1px solid rgba(251,191,36,0.3)'}}>Lab 2</span></h2>
                <p className="m4-sec-sub">Compare four packing strategies on the Crest Packing Problem. Items arrive sequentially and must be placed immediately.</p>
              </div>
              <BinPackingViz />
            </>)}

            {labTab === 'Job Shop (JSSP)' && (<>
              <div className="m4-sec-hdr">
                <h2 className="m4-sec-title">Job Shop Scheduling <span className="m4-badge" style={{background:'var(--violet-dim)',color:'var(--violet)',border:'1px solid rgba(167,139,250,0.3)'}}>Labs 3–5</span></h2>
                <p className="m4-sec-sub">Edit the instance, compute a greedy schedule, and inspect the Gantt chart. Understand feasibility constraints.</p>
              </div>
              <JSSPViz />
            </>)}

            {labTab === 'Solution Space' && (<>
              <div className="m4-sec-hdr">
                <h2 className="m4-sec-title">Solution Space Analysis <span className="m4-badge" style={{background:'var(--rose-dim)',color:'var(--rose)',border:'1px solid rgba(251,113,133,0.3)'}}>Labs 4–5</span></h2>
                <p className="m4-sec-sub">Visualise the combinatorial explosion that makes exhaustive enumeration infeasible and motivates heuristic search.</p>
              </div>
              <SolutionSpaceViz />
            </>)}
          </div>
        )}

        {/* ── QUIZ ── */}
        {tab === 'Quiz' && (<>
          <div className="m4-sec-hdr">
            <h2 className="m4-sec-title">Knowledge Check <span className="m4-badge">10 Questions</span></h2>
            <p className="m4-sec-sub">Covering all lectures: LCG, Bin Packing, JSSP, Optimisation Framework, Calculus & Gradients, Algorithms. Detailed feedback on every answer.</p>
          </div>
          <QuizSection />
        </>)}

        {/* ── PRACTICE EXAM ── */}
        {tab === 'Practice Exam' && (<>
          <div className="m4-sec-hdr">
            <h2 className="m4-sec-title">Practice Exam <span className="m4-badge" style={{background:'rgba(34,211,238,0.12)',color:'var(--cyan)',border:'1px solid rgba(34,211,238,0.3)'}}>18 Questions</span></h2>
            <p className="m4-sec-sub">Full exam-style questions covering every topic. Write your answer before revealing the solution. Includes 3 questions from the 2026 practice exam and 15 questions derived from lecture content.</p>
          </div>
          <PracticeExamTab />
        </>)}

        {/* ── EXAM VAULT ── */}
        {tab === 'Exam Vault' && (<>
          <div className="m4-sec-hdr">
            <h2 className="m4-sec-title">Exam Vault <span className="m4-badge" style={{background:'rgba(251,191,36,0.12)',color:'var(--amber)',border:'1px solid rgba(251,191,36,0.3)'}}>Themed Exam Prep</span></h2>
            <p className="m4-sec-sub">A locker of <strong>11 themed multi-part questions</strong> written in the official short-answer style. Each part exposes the <em>Cone of Recall</em> — five progressive hint layers (Concept → Term → Formula → Approach → Model answer). Crack one open, attempt on paper, then peel back hints as needed.</p>
          </div>
          <ExamVault />
        </>)}

        {/* ── GROUP PROJECT ── */}
        {tab === 'Group Project' && (<>
          <div className="m4-sec-hdr">
            <h2 className="m4-sec-title">Group Project <span className="m4-badge" style={{background:'rgba(167,139,250,0.12)',color:'var(--violet)',border:'1px solid rgba(167,139,250,0.3)'}}>BTC Trading Bot</span></h2>
            <p className="m4-sec-sub">Build and optimise an AI trading bot for Bitcoin using nature-inspired metaheuristics. Track deadlines, manage tasks, and navigate directly to the relevant course content.</p>
          </div>
          <GroupProjectTab setTab={setTab} />
        </>)}

        {/* ── DRAGONFLY ALGORITHM ── */}
        {tab === 'Dragonfly Algorithm' && (<>
          <div className="m4-sec-hdr">
            <h2 className="m4-sec-title">Dragonfly Algorithm <span className="m4-badge" style={{background:'rgba(34,211,238,0.12)',color:'var(--cyan)',border:'1px solid rgba(34,211,238,0.3)'}}>Mirjalili, 2016</span></h2>
            <p className="m4-sec-sub">A swarm intelligence metaheuristic inspired by dragonfly swarming behaviour. Combines five behavioural operators with an adaptive neighbourhood radius to balance exploration and exploitation. Includes a live 2D simulation and literature review synopsis.</p>
          </div>
          <DragonflyTab />
        </>)}

      </main>
    </div>
  );
}
