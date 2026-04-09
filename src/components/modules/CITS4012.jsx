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
    q: 'Given an LCG with seed X₀=1, multiplier a=3, increment c=1, modulus m=7 — what is X₁?',
    opts: ['X₁ = 3', 'X₁ = 4', 'X₁ = 7', 'X₁ = 1'],
    ans: 1,
    ok: 'Apply X₁ = (a·X₀ + c) mod m = (3×1 + 1) mod 7 = 4 mod 7 = 4.',
    ng: 'Formula: Xₙ₊₁ = (a·Xₙ + c) mod m. So X₁ = (3×1+1) mod 7 = 4. Multiply first, add increment, then modulo.',
  },
  {
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
    q: 'For JSSP with n=4 jobs and m=3 machines, what is the solution space size (n!)ᵐ?',
    opts: ['64  (4³)', '13,824  ((4!)³)', '1,728  (12³)', '24  (4!)'],
    ans: 1,
    ok: 'Correct! (n!)ᵐ = (4!)³ = 24³ = 13,824. Each of the 3 machines independently orders 4 jobs.',
    ng: 'Solution space = (n!)ᵐ. With n=4, m=3: (4!)³ = 24³ = 13,824.',
  },
  {
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
              <div className="m4-qnum">Question {qi+1} / {total}</div>
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
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Stops when improvement per full cycle {"<"} ε. Can fail to find local optimum (diagonal valley problem).</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--violet)'}}>
                <div className="m4-algo-card-h">CCS with Acceleration Step</div>
                <div className="m4-algo-card-desc">After one full cycle, take an additional line search in the net progress direction:</div>
                <Tex src="\vec{u} = \vec{x}^n - \vec{x}^0 \quad \text{(net direction)}" block />
                <div style={{fontSize:'0.74rem',color:'var(--text-2)'}}>Faster traversal of diagonal valleys/ridges.</div>
              </div>
              <div className="m4-algo-card" style={{'--ac':'var(--emerald)'}}>
                <div className="m4-algo-card-h">Powell's Method</div>
                <div className="m4-algo-card-desc">Extends CCS by maintaining an adaptive queue of search directions, updated each cycle:</div>
                <Tex src="\vec{u}_{n+1} = \vec{x}^n - \vec{x}^0 \;\;\text{replaces oldest direction}" block />
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
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview','Intelligence','Adaptation','Job Shop','Optimisation','Calculus','Algorithms','Labs','Quiz'];
const LAB_TABS  = ['PRNG & LCG','Bin Packing','Job Shop (JSSP)','Solution Space'];

export default function CITS4012() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [labTab, setLabTab] = useState('PRNG & LCG');

  useEffect(() => {
    document.title = 'CITS4012 — Learning Hub';
    return () => { document.title = 'James Wigfield'; };
  }, []);

  return (
    <div className="m4-root">
      <header className="m4-header">
        <div className="m4-header-inner">
          <div className="m4-header-top">
            <button className="umod__back" onClick={() => navigate('/hub')}>← Hub</button>
            <div className="m4-htitle">
              <span className="m4-hcode">CITS4012</span>
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
              <div className="m4-hero-lbl">// CITS4012 · UWA · Sem 1, 2025</div>
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

      </main>
    </div>
  );
}
