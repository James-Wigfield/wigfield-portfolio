import { useState, useEffect, useRef, useCallback } from 'react';
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

// ── Job Shop Tab ──────────────────────────────────────────────────────────────
function JobShopTab() {
  return (
    <div>
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
    </div>
  );
}

// ── Algorithms Tab ────────────────────────────────────────────────────────────
function AlgorithmsTab() {
  const [sec, setSec] = useState('gradient');

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
                <span className="num"> 1:</span> x⃗  ← random initial value{'\n'}
                <span className="num"> 2:</span> x⃗* ← x⃗  <span className="cm">▷ best so far</span>{'\n'}
                <span className="num"> 3:</span> <span className="kw">repeat</span>{'\n'}
                <span className="num"> 4:</span>   <span className="kw">repeat</span>{'\n'}
                <span className="num"> 5:</span>     x⃗ ← x⃗ + α∇f(x⃗){'\n'}
                <span className="num"> 6:</span>   <span className="kw">until</span> ‖∇f(x⃗)‖ {"<"} ε{'\n'}
                <span className="num"> 7:</span>   <span className="kw">if</span> f(x⃗) {">"} f(x⃗*) <span className="kw">then</span> x⃗* ← x⃗{'\n'}
                <span className="num"> 8:</span>   x⃗ ← random value{'\n'}
                <span className="num"> 9:</span> <span className="kw">until</span> time exhausted{'\n'}
                <span className="num">10:</span> <span className="kw">return</span> x⃗*
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
      { label: 'c', answer: 'Algorithm: Gradient Ascent with Restarts\n1: x⃗ ← random initial value; x⃗* ← x⃗\n2: repeat\n3:   repeat\n4:     x⃗ ← x⃗ + α∇f(x⃗)\n5:   until ‖∇f(x⃗)‖ < ε\n6:   if f(x⃗) > f(x⃗*) then x⃗* ← x⃗\n7:   x⃗ ← random value\n8: until time exhausted\n9: return x⃗*\n\nCan find global optimum eventually if: (1) search space is bounded AND (2) number of local optima is finite. No guarantees in general for infinite/non-enumerable spaces.' },
      { label: 'd', answer: 'Multivariate update: x⃗ ← x⃗ − α∇f(x⃗)\n\nFor f(x₁, x₂) = 3x₁² + x₂²:\n∂f/∂x₁ = 6x₁\n∂f/∂x₂ = 2x₂\n\n∇f(x₁, x₂) = [6x₁, 2x₂]ᵀ\n\nUpdate: [x₁, x₂] ← [x₁ − 6αx₁, x₂ − 2αx₂]' },
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
      { label: 'c', answer: 'The gradient ∇f at any point is a vector that points in the direction of steepest ascent — the direction in which f increases most rapidly. This follows from the definition: the gradient is constructed from the partial derivatives, each measuring rate of change in one coordinate direction; the vector sum points in the overall steepest direction.\n\nTo maximise: move in direction +∇f (gradient ascent): x⃗ ← x⃗ + α∇f(x⃗)\nTo minimise: move in direction −∇f (gradient descent): x⃗ ← x⃗ − α∇f(x⃗)' },
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

// ── Main ──────────────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview','Intelligence','Adaptation','Job Shop','Optimisation','Calculus','Algorithms','Labs','Quiz','Practice Exam'];
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
            <div className="m4-topic-grid">
              {[
                {code:'L1–2', title:'Intelligence & Adaptation', color:'var(--cyan)', desc:'Four quadrants of AI, Turing Test, history from Symbolic AI to LLMs. Why the real world is messy and how nature adapts.', go:'Intelligence'},
                {code:'L3', title:'Optimisation Framework', color:'var(--violet)', desc:'Three ingredients: Language (representation), Model (hypothesis), Metric (evaluation). Hypothesis spaces, MSE, argmin, online vs offline.', go:'Optimisation'},
                {code:'L5', title:'Vector Calculus', color:'var(--emerald)', desc:'Limit definition of derivatives, power/chain/product rules, partial derivatives, gradient vector ∇f, second derivative test.', go:'Calculus'},
                {code:'L6–9', title:'Optimisation Algorithms', color:'var(--amber)', desc:'Gradient descent/ascent, Newton-Raphson, direct methods (CCS, Powell, H-J, Nelder-Mead), stochastic methods (HC, SA, Tabu, ILS), No Free Lunch.', go:'Algorithms'},
                {code:'L4', title:'Job Shop Scheduling', color:'var(--rose)', desc:'JSSP formulation, makespan minimisation (n!)ᵐ solution space, dispatching rules, disjunctive graph, N1 local search, benchmark instances, RPD metric.', go:'Job Shop'},
                {code:'Labs 1–2', title:'PRNG & Bin Packing', color:'var(--violet)', desc:'LCG recurrence, Mersenne primes, full-period theorem. Bin packing heuristics: FF, NF, BF, FFD. Online vs offline algorithms.', go:'Labs'},
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

      </main>
    </div>
  );
}
