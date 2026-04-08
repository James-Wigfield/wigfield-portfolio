import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Utilities ─────────────────────────────────────────────────────────────────
function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

const CYBER_COLS = [
  '#22d3ee','#a78bfa','#34d399','#fb7185','#fbbf24',
  '#6366f1','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#a855f7','#eab308','#d946ef','#0ea5e9',
];

// ── Quiz Data ─────────────────────────────────────────────────────────────────
const QUIZ_DATA = [
  {
    q: 'Given an LCG with seed X₀=1, multiplier a=3, increment c=1, modulus m=7 — what is X₁?',
    opts: ['X₁ = 3', 'X₁ = 4', 'X₁ = 7', 'X₁ = 1'],
    ans: 1,
    ok: 'Apply X₁ = (a·X₀ + c) mod m = (3×1 + 1) mod 7 = 4 mod 7 = 4. Always: multiply → add → modulo.',
    ng: 'Formula: Xₙ₊₁ = (a·Xₙ + c) mod m. So X₁ = (3×1+1) mod 7 = 4. Multiply first, add increment, then modulo.',
  },
  {
    q: 'Why is a modulus of 12 described as a "particularly poor" choice for an LCG?',
    opts: [
      '12 is even, producing only even outputs',
      '12 > 6 (number of die sides)',
      '12 has many factors (1,2,3,4,6,12), causing the LCG to cycle through far fewer than m distinct values',
      'Mersenne primes must be < 10',
    ],
    ans: 2,
    ok: 'Correct! Many factors → short cycles, poor equidistribution. Mersenne primes like 7 (2³−1) and 31 (2⁵−1) have very few factors, maximising the period.',
    ng: 'Modulus 12 has many factors: 1,2,3,4,6,12. Shared factors with the multiplier cause short cycles. Mersenne primes have very few factors, which is why they are preferred.',
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
    ok: 'Correct! FFD pre-sorts all items in decreasing order — requires knowing every size before the first placement. On the Lab 2 conveyor, items arrive one-by-one and cannot be reordered.',
    ng: 'Key distinction is when sizes are known. FFD must see every item first (offline). Online algorithms (FF, NF, BF) place items immediately upon arrival — perfect for the conveyor.',
  },
  {
    q: 'A JSSP solution passes consistent() but fails satisfies(instance). What best explains this?',
    opts: [
      'Two operations on the same machine overlap in time',
      'The schedule has negative start times',
      'Operations are scheduled without time overlaps, but job precedence is violated',
      'The schedule has no internal overlaps, but an operation is assigned to the wrong machine',
    ],
    ans: 3,
    ok: 'Correct! consistent() checks no time overlaps. satisfies(instance) additionally checks machine assignments match the spec. Passing consistent + failing satisfies = internally valid, wrong machine assignment.',
    ng: 'consistent() checks: (1) no overlapping ops on same machine, (2) no overlapping ops within a job. satisfies() additionally verifies machine assignments against the instance. A schedule can be internally consistent yet use wrong machines.',
  },
  {
    q: 'For JSSP with n=4 jobs and m=3 machines, what is the solution space size (n!)ᵐ?',
    opts: ['64  (4³)', '13,824  ((4!)³)', '1,728  (12³)', '24  (4!)'],
    ans: 1,
    ok: 'Correct! (n!)ᵐ = (4!)³ = 24³ = 13,824. Each of the 3 machines independently orders 4 jobs (4!=24 ways each).',
    ng: 'Solution space = (n!)ᵐ. With n=4, m=3: (4!)³ = 24³ = 13,824. Each machine independently orders all n jobs.',
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
        <div className="m4-formula">X(n+1) = (a · Xn + c) mod m</div>
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
        <div className="m4-formula">m = 2ⁿ − 1 &nbsp; n ∈ &#123;3, 5, 7, 13, 17, …&#125;</div>
        <div className="m4-infobox">
          <strong>Why Mersenne primes?</strong> A modulus with many factors (e.g. 12 = 2²×3) causes the LCG to cycle through only a subset of values — poor <em>equidistribution</em>. Mersenne primes like 7 and 31 have very few factors, maximising the period.
        </div>
        <div className="m4-hr"/>
        <div className="m4-flabel">Hull–Dobell Full-Period Theorem</div>
        <div className="m4-formula" style={{fontSize:'0.75rem'}}>
          Period = m ⟺ gcd(c,m)=1 AND (a−1) divisible by all prime factors of m
        </div>
        <div className="m4-hr"/>
        <div className="m4-flabel">PCG-64 (NumPy default)</div>
        <div className="m4-infobox" style={{fontSize:'0.8rem'}}>
          Permuted Congruential Generator: LCG core (2⁶⁴ modulus) + output permutation function. Retains LCG speed while dramatically improving statistical quality.
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
        <div style={{fontSize:'0.72rem',color:'var(--text-2)',marginBottom:'0.4rem',display:'flex',gap:'0.75rem'}}>
          <span><span style={{display:'inline-block',width:9,height:9,background:'var(--cyan)',borderRadius:2,marginRight:3}}/>seed</span>
          <span><span style={{display:'inline-block',width:9,height:9,background:'#fb7185',borderRadius:2,marginRight:3}}/>period restart</span>
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
        <div className="m4-formula">Σ sᵢ ≤ C = 1.0 &nbsp; ∀ box k</div>
        <div className="m4-flabel" style={{marginTop:'0.75rem'}}>Sorted Insertion</div>
        <div className="m4-formula" style={{fontSize:'0.75rem'}}>bisect.insort(L, x) → O(log n) search + O(n) insert</div>
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
    setRes(r);
    requestAnimationFrame(() => drawGantt(r, DEFAULT_JOBS[0].length));
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
        <div className="m4-infobox"><strong>JSSP:</strong> Given n jobs and m machines, each job requires m operations in a fixed sequence. Each operation O(j,k) must run on machine μ(j,k) for p(j,k) time units. Minimise total completion time.</div>
        <div className="m4-flabel">Objective — Minimise Makespan</div>
        <div className="m4-formula">Cmax = max(j,k) (S(j,k) + p(j,k))</div>
        <div className="m4-hr"/>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--text-1)',marginBottom:'0.5rem'}}>Feasibility Constraints</div>
        <ol style={{fontSize:'0.79rem',color:'var(--text-2)',paddingLeft:'1.2rem',display:'grid',gap:'0.35rem'}}>
          <li><strong style={{color:'var(--text-1)'}}>Machine capacity:</strong> No two ops on same machine overlap</li>
          <li><strong style={{color:'var(--text-1)'}}>Precedence:</strong> S(j,k+1) ≥ S(j,k) + p(j,k)</li>
          <li><strong style={{color:'var(--text-1)'}}>Assignment:</strong> Op O(j,k) must run on machine μ(j,k)</li>
          <li><strong style={{color:'var(--text-1)'}}>Non-negativity:</strong> S(j,k) ≥ 0</li>
        </ol>
        <div className="m4-hr"/>
        <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
          <strong>consistent():</strong> Checks no time overlaps on machines and within jobs.<br/><br/>
          <strong>satisfies(instance):</strong> Also verifies machine assignments and job-level precedence match the instance specification.
        </div>
        <div className="m4-hr"/>
        <div className="m4-flabel">Complexity</div>
        <div className="m4-formula">JSSP ∈ NP-hard &nbsp; (even for n=3, m=3)</div>
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
        <div className="m4-formula">|S| = (n!)ᵐ</div>
        <div className="m4-infobox"><strong>Lab 4 key insight:</strong> Each of the m machines independently orders n jobs → n! orderings per machine. Across m machines: (n!)ᵐ total candidates. For ft10 (10 jobs, 10 machines): (10!)¹⁰ ≈ 3.6×10⁶⁵.</div>
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
        <div className="m4-formula">P(find optimal) ≈ 1 / (n!)ᵐ</div>
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
        <div className="m4-infobox" style={{fontSize:'0.79rem'}}>
          <strong>Unit-time JSSP (Lab 5):</strong> p(j,k)=1 for all ops, making small instances tractable. Lower bound: Cmax ≥ n. For 3×3 unit-time: minimum possible makespan is 3.
        </div>
        <div className="m4-hr"/>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--text-1)',marginBottom:'0.5rem'}}>Beyond Exhaustive Search</div>
        {[['Greedy','Shortest/longest processing time heuristics'],['Local Search','Swap adjacent ops on critical path'],['Evolutionary','Crossover & mutation over permutations'],['Branch & Bound','Prune provably suboptimal subtrees'],['Tabu Search','Neighbourhood search with short-term memory']].map(([n,d])=>(
          <div key={n} style={{fontSize:'0.79rem',color:'var(--text-2)',marginBottom:'0.3rem'}}>
            → <strong style={{color:'var(--text-1)'}}>{n}:</strong> {d}
          </div>
        ))}
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
  const msgs = [
    'Keep at it — revisit the LCG and JSSP sections.',
    'A solid start. Review the theory panels and redo the visualizers.',
    'Not bad! A couple more passes will cement these concepts.',
    'Great work — just one slip. Nearly exam-ready!',
    'Outstanding! Firm grasp of every core concept.',
  ];

  return (
    <div className="m4-quiz">
      {QUIZ_DATA.map((q,qi)=>{
        const ans=answers[qi];
        return(
          <div key={qi} className="m4-qcard">
            <div className="m4-qhead">
              <div className="m4-qnum">Question {qi+1} / {QUIZ_DATA.length}</div>
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
          <div className="m4-score-ring" style={{color:score>=4?'var(--emerald)':score>=3?'var(--amber)':'var(--rose)'}}>{score}/5</div>
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
          <div className="m4-card-h">The Turing Test</div>
          <div className="m4-infobox">Alan Turing (1950): If a machine can engage in conversation indistinguishable from a human, it is intelligent. The ultimate <em>performative</em> test.</div>
          <ul className="m4-bullets">
            <li>Most famous test for intelligence — but not the only one (chess, translation, driving)</li>
            <li>Modern LLMs arguably pass conversational Turing tests</li>
            <li>But: is "passing for human" the right bar for intelligence?</li>
            <li>McCarthy: "We relate intelligence to the ability to do certain things, independently of whether it is human, Martian, or a mechanism"</li>
          </ul>
          <div className="m4-warnbox">
            <strong>Think:</strong> Are CNNs actually "neural"? Do they use "convolution"? LLMs — closer to glorified predictive text, or genuine reasoning? Is <em>internal consistency</em> a test for intelligence?
          </div>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">A Short History of AI</div>
          {[
            {yr:'1950', c:'var(--cyan)', ev:'Turing proposes the Imitation Game. Computing begins as a field.'},
            {yr:'1956', c:'var(--violet)', ev:'Dartmouth Workshop — birth of "Artificial Intelligence". Symbolic AI & logic begin.'},
            {yr:'1960s–70s', c:'var(--emerald)', ev:'Logical Theorist, symbolic reasoning. Herb Simon: "We solved the mind-body problem." (Spoiler: they didn\'t.)'},
            {yr:'1980s', c:'var(--amber)', ev:'Expert Systems boom. Purportedly saved companies millions. Were set to change the white-collar workplace. (Sound familiar?)'},
            {yr:'1990s', c:'var(--rose)', ev:'AI Winter thaws. Probabilistic methods. "Teaching computers to get better at learning from their experiences."'},
            {yr:'2012+', c:'var(--cyan)', ev:'Deep Learning revolution (ImageNet). "Brute force + data = apparent intelligence." — Google.'},
            {yr:'2022+', c:'var(--violet)', ev:'LLMs, GenAI. GPT-4, Claude, Gemini. Never been a more interesting time in AI from a public consciousness perspective!'},
          ].map(({yr,c,ev})=>(
            <div key={yr} style={{display:'flex',gap:'0.7rem',marginBottom:'0.7rem'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:c,fontWeight:700,minWidth:'60px',paddingTop:2}}>{yr}</div>
              <div style={{fontSize:'0.8rem',color:'var(--text-2)',borderLeft:`2px solid ${c}`,paddingLeft:'0.7rem'}}>{ev}</div>
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
            <div className="m4-strat-d">Well-described states · well-defined actions · goal state · utility function · deterministic search. Works great in games worlds, Shakey's world…</div>
          </div>
          <div className="m4-strat" style={{'--sc':'var(--emerald)','marginTop':'0.5rem'}}>
            <div className="m4-strat-h">But the real world has:</div>
            <div className="m4-strat-d">Uncertainty · ambiguity · unknowns · a changing environment · approximation · need for resilience · graceful degradation</div>
          </div>
          <div className="m4-hr"/>
          <div className="m4-flabel">The Engineering View</div>
          <p style={{fontSize:'0.82rem',color:'var(--text-2)'}}>
            This unit takes an <em>engineering view</em>: the goal is to enable computers to do more things that are useful, beyond existing capabilities, and — importantly — really cool.
          </p>
          <div className="m4-hr"/>
          <p style={{fontSize:'0.82rem',color:'var(--text-2)',fontStyle:'italic'}}>
            "Programming for intelligence refocused again, inventing ways to deal with the probabilities in the messy uncertain real world, and teaching computers to get much better at learning from their experiences."
          </p>
        </div>
        <div className="m4-card">
          <div className="m4-card-h">Inspiration from Nature</div>
          <div className="m4-infobox">
            <strong>Nature is very good</strong> at handling uncertainty, ambiguity, change, and approximation. Key trait: the ability to <strong>adapt</strong> to a changing, emergent environment.
          </div>
          <div className="m4-hr"/>
          {[
            { title:'Short-term (individual lifespan)', color:'var(--cyan)',
              items:['Learning — acquisition of knowledge and skills within a lifetime','Physical adaptation — body responds to diet, training, environment','Humans extend learning beyond lifespans via language, writing, books, computers'] },
            { title:'Long-term (population/species)', color:'var(--violet)',
              items:['Evolution — genetic variation + natural selection over generations','Gradual adaptation across populations, not just individuals','Speciation when environments diverge significantly'] },
          ].map(({title,color,items})=>(
            <div key={title} style={{marginBottom:'1.25rem'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color,fontWeight:700,letterSpacing:'0.08em',marginBottom:'0.4rem'}}>{title}</div>
              <ul className="m4-bullets">{items.map(i=><li key={i}>{i}</li>)}</ul>
            </div>
          ))}
          <div className="m4-hr"/>
          <div className="m4-flabel">Nature's Adaptation Examples</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.4rem'}}>
            {[
              ['Antarctic fish','Antifreeze proteins in blood — genetic evolution'],
              ['Cuttlefish','Real-time skin colour/texture camouflage — neural'],
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

// ── Main ──────────────────────────────────────────────────────────────────────
const MAIN_TABS = ['Overview','Intelligence','Adaptation','Labs','Quiz'];
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
              <p className="m4-hero-sub">Nature-inspired computing. How do we enable computers to handle the <em>messy</em> real world? Taking lessons from adaptation, evolution, and learning — and bringing them into computation.</p>
            </div>
            <div className="m4-topic-grid">
              {[
                {code:'L2', title:'What is Intelligence?', color:'var(--cyan)', desc:'Four quadrants of AI, Turing Test, history from Symbolic AI to LLMs, and the ongoing debate about what "intelligent" means.', go:'Intelligence'},
                {code:'L3', title:'Adaptation & Nature', color:'var(--violet)', desc:'Why traditional AI fails in the real world. How nature handles uncertainty via learning, physical adaptation, and evolution.', go:'Adaptation'},
                {code:'LAB 1', title:'PRNG & LCG', color:'var(--emerald)', desc:'Pseudo-random number generation. The Linear Congruential Generator, Mersenne primes, equidistribution, and PCG-64.', go:'Labs'},
                {code:'LAB 2', title:'Bin Packing', color:'var(--amber)', desc:'Heuristic strategies: First Fit, Next Fit, Best Fit, FFD. Online vs offline algorithms. The Crest Packing Problem.', go:'Labs'},
                {code:'LAB 3–5', title:'Job Shop Scheduling', color:'var(--rose)', desc:'JSSP formulation, makespan minimisation, Gantt charts, feasibility checking (consistent vs satisfies), NP-hardness.', go:'Labs'},
                {code:'LAB 4–5', title:'Solution Space', color:'var(--violet)', desc:'Combinatorial explosion: (n!)ᵐ. Why exhaustive search is infeasible and what motivates heuristic approaches.', go:'Labs'},
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
            <h2 className="m4-sec-title">Knowledge Check <span className="m4-badge">5 Questions</span></h2>
            <p className="m4-sec-sub">Test your understanding of LCG, Bin Packing, JSSP, and Solution Space concepts. Detailed feedback on every answer.</p>
          </div>
          <QuizSection />
        </>)}

      </main>
    </div>
  );
}
