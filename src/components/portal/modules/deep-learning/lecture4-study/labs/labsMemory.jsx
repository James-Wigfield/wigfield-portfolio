import { useMemo, useState } from 'react';
import { Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { randMatrix, rnnForward, rnnStep, rnnOut, rowTimes, fmtSigned, signClass } from '../rnn';
import { Arrowhead } from './parts';
import './labsMemory.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §2 AND §3
     DependencyLab  slide 7 + Figure 15-3: pick an output and light up every
                    input it depends on; nudge x(0) and watch the change ride
                    the hidden state through time; h(t) and ŷ(t) drawn apart
     StateEqLab     slide 9's two equations evaluated term by term, every
                    matrix labelled with its shape; "next step" feeds h(t)
                    back in as h(t−1)
     ShapeLab       slides 10–11: the weather RNN's shapes, one instance or a
                    minibatch of m, with the discarded outputs and h(0) = 0
   Weights are this page's own seeded numbers (the slides give none).
   ========================================================================== */

/* ── §2 · who influenced ŷ(t)? ───────────────────────────────────────────── */
const DEP_T = 5;
const DEP_X = [0.8, -0.3, 0.5, 0.1, -0.6];
const DEP_N = 3;

export function DependencyLab() {
  const [pick, setPick] = useState(3);
  const [nudge, setNudge] = useState(0.5);
  const [mem, setMem] = useState(1);

  const base = useMemo(() => {
    const Wh = randMatrix(DEP_N, DEP_N, 721, 0.7).map((r) => r.map((v) => v * mem));
    return { Wx: randMatrix(1, DEP_N, 733, 1), Wh, bh: [0, 0, 0], Wy: randMatrix(DEP_N, 1, 745, 1), by: [0], phi: 'tanh', phiY: 'linear' };
  }, [mem]);
  const run = useMemo(() => rnnForward(DEP_X.map((v) => [v]), base), [base]);
  const runN = useMemo(() => rnnForward(DEP_X.map((v, t) => [t === 0 ? v + nudge : v]), base), [base, nudge]);
  const dY = run.map((s, t) => runN[t].y[0] - s.y[0]);
  const maxD = Math.max(0.05, ...dY.map(Math.abs));

  const W = 600;
  const gap = 110;
  const x0 = 62;
  const cx = (t) => x0 + t * gap;
  const cy = 196;
  const zero = 54; // baseline of the Δ bars

  return (
    <Lab
      title="Who influenced ŷ(t)? · slide 7 and Figure 15-3"
      slides="slides 7–8"
      tryThis="click ŷ(3): which inputs light up? Then nudge x(0) and predict whether ŷ(4) moves at all — it does, because x(0) rides along in h. Lower the memory slider and notice the effect fading faster."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="nudge x(0) by" value={nudge} min={-1} max={1} step={0.1} onChange={setNudge} fmt={(v) => fmtSigned(v, 1)} />
          <Range label="memory (scale of W_h)" value={mem} min={0} max={1.5} step={0.1} onChange={setMem} fmt={(v) => `×${v.toFixed(1)}`} />
        </div>
      </div>
      <div className="dl4s-wide">
        <svg viewBox={`0 0 ${W} 318`} className="dl4s-svg dl4s-dep" role="img" aria-label={`Five time steps; ŷ(${pick}) depends on inputs x(0) to x(${pick})`}>
          {run.map((s, t) => {
            const lit = t <= pick;
            return (
              <g key={t} className={lit ? 'dl4s-dep__lit' : 'dl4s-dep__dim'}>
                {/* input */}
                <line x1={cx(t)} y1={cy + 64} x2={cx(t)} y2={cy + 22} className="dl4s-wire dl4s-wire--x" />
                <Arrowhead x={cx(t)} y={cy + 21} className="dl4s-ah dl4s-ah--x" />
                <text x={cx(t)} y={cy + 80} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">x({t})</text>
                <text x={cx(t)} y={cy + 94} textAnchor="middle" className="dl4s-tick">{fmtSigned(DEP_X[t] + (t === 0 ? nudge : 0), 1)}{t === 0 && nudge !== 0 ? ' *' : ''}</text>
                {/* the cell */}
                <rect x={cx(t) - 26} y={cy - 20} width={52} height={40} rx={7} className={`dl4s-cell${t === pick ? ' dl4s-cell--pick' : ''}`} />
                <text x={cx(t)} y={cy + 4} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--ink">cell</text>
                {/* output */}
                <line x1={cx(t)} y1={cy - 22} x2={cx(t)} y2={cy - 58} className="dl4s-wire dl4s-wire--y" />
                <Arrowhead x={cx(t)} y={cy - 59} className="dl4s-ah dl4s-ah--y" />
                <g className="dl4s-dep__out" tabIndex={0} role="button" aria-pressed={t === pick} aria-label={`Pick ŷ(${t})`} onClick={() => setPick(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(t); } }}>
                  <rect x={cx(t) - 30} y={cy - 98} width={60} height={34} rx={5} className={`dl4s-dep__obox${t === pick ? ' dl4s-dep__obox--on' : ''}`} />
                  <text x={cx(t)} y={cy - 84} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--y">ŷ({t})</text>
                  <text x={cx(t)} y={cy - 70} textAnchor="middle" className={`dl4s-tick ${signClass(s.y[0])}`}>{fmtSigned(s.y[0], 3)}</text>
                </g>
                {/* the change caused by nudging x(0) */}
                <rect x={cx(t) - 6} y={dY[t] >= 0 ? zero - (Math.abs(dY[t]) / maxD) * 24 : zero} width={12} height={(Math.abs(dY[t]) / maxD) * 24} className={dY[t] >= 0 ? 'dl4s-dep__bar dl4s-dep__bar--pos' : 'dl4s-dep__bar dl4s-dep__bar--neg'} />
                <text x={cx(t) + 10} y={zero - 4} className="dl4s-tick">Δ {fmtSigned(dY[t], 3)}</text>
                {/* the hidden state passed on */}
                {t < DEP_T - 1 && (
                  <g>
                    <line x1={cx(t) + 27} y1={cy} x2={cx(t + 1) - 28} y2={cy} className={`dl4s-wire dl4s-wire--h${t < pick ? ' dl4s-wire--hot' : ''}`} />
                    <Arrowhead x={cx(t + 1) - 27} y={cy} dir="right" className="dl4s-ah dl4s-ah--h" />
                    <text x={(cx(t) + cx(t + 1)) / 2} y={cy - 6} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--h">h({t})</text>
                    {s.h.map((v, k) => (
                      <rect key={k} x={(cx(t) + cx(t + 1)) / 2 - 21 + k * 14} y={cy + 7} width={12} height={12} rx={2} className="dl4s-dep__hcell" style={{ '--v': Math.max(-1, Math.min(1, v)) }}>
                        <title>{`h(${t})[${k + 1}] = ${v.toFixed(3)}`}</title>
                      </rect>
                    ))}
                  </g>
                )}
              </g>
            );
          })}
          <line x1={28} y1={zero} x2={W - 20} y2={zero} className="dl4s-axis" />
          <text x={8} y={14} className="dl4s-svg__label">change in ŷ(t) after nudging x(0)</text>
          <text x={W - 20} y={14} textAnchor="end" className="dl4s-tick">h(t): a vector of 3 (colour = value)</text>
          <line x1={x0 - 30} y1={308} x2={cx(DEP_T - 1) + 40} y2={308} className="dl4s-time" />
          <Arrowhead x={cx(DEP_T - 1) + 42} y={308} dir="right" s={6} className="dl4s-time__head" />
        </svg>
      </div>
      <p className="dl4s-readout" aria-live="polite">
        ŷ({pick}) depends on <b>{Array.from({ length: pick + 1 }, (_, k) => `x(${k})`).join(', ')}</b> — every input since t = 0 (slide 7). Nudging x(0) by {fmtSigned(nudge, 1)} still moves ŷ({pick}) by{' '}
        <b className={signClass(dY[pick])}>{fmtSigned(dY[pick], 3)}</b>: that is the cell’s memory.
      </p>
      <p className="dl4s-cap">
        Figure 15-3’s point is visible here: the state h(t) passed sideways is a vector of 3, the output ŷ(t) going up is a single number — a cell’s hidden
        state and its output may be different. This page’s own weights; tanh state, linear output.
      </p>
    </Lab>
  );
}

/* ── §2 · slide 9, term by term ──────────────────────────────────────────── */
function Mat({ m, label, shape, hlCol = -1, kind = '' }) {
  const cols = m[0]?.length ?? 0;
  return (
    <figure className={`dl4s-mat dl4s-mat--${kind}`}>
      <figcaption>
        <Tex src={label} /> <span className="dl4s-shape"><Tex src={shape} /></span>
      </figcaption>
      <div className="dl4s-mat__grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.3rem, auto))` }}>
        {m.map((row, i) => row.map((v, j) => (
          <i key={`${i}.${j}`} className={j === hlCol ? 'dl4s-mat__hl' : ''} style={{ '--v': Math.max(-1, Math.min(1, v)) }}>{fmtSigned(v, 2)}</i>
        )))}
      </div>
    </figure>
  );
}

const XSEQ = [
  [0.6, -0.4, 0.9, 0.2],
  [-0.2, 0.5, 0.1, -0.7],
  [0.8, 0.3, -0.5, 0.4],
  [0.1, -0.9, 0.6, 0.3],
];

export function StateEqLab() {
  const [nIn, setNIn] = useState(4); // slide 10's example: 4 inputs …
  const [nN, setNN] = useState(5); // … 5 neurons …
  const [nOut, setNOut] = useState(2); // … 2 outputs
  const [phi, setPhi] = useState('tanh');
  const [phiY, setPhiY] = useState('linear');
  const [t, setT] = useState(1);
  const [col, setCol] = useState(0);
  const j = Math.min(col, nN - 1);

  const P = useMemo(() => ({
    Wh: randMatrix(nN, nN, 901 + nN, 0.5),
    Wx: randMatrix(nIn, nN, 913 + nIn * 7 + nN, 0.8),
    bh: randMatrix(1, nN, 927 + nN, 0.3)[0],
    Wy: randMatrix(nN, nOut, 939 + nN * 3 + nOut, 0.8),
    by: randMatrix(1, nOut, 951 + nOut, 0.3)[0],
  }), [nIn, nN, nOut]);

  // run from h(0) = 0 up to step t, so "next step" really feeds h(t) back in
  const steps = useMemo(() => {
    const out = [];
    let h = new Array(nN).fill(0);
    for (let k = 0; k <= 3; k++) {
      const x = XSEQ[k].slice(0, nIn);
      const s = rnnStep(h, x, { ...P, phi });
      out.push({ hPrev: h, x, a: s.a, h: s.h, y: rnnOut(s.h, { ...P, phiY }) });
      h = s.h;
    }
    return out;
  }, [P, nIn, nN, phi, phiY]);
  const s = steps[t];
  const t1 = rowTimes(s.hPrev, P.Wh);
  const t2 = rowTimes(s.x, P.Wx);

  const dot = (vec, M) => vec.map((v, k) => `${fmtSigned(v, 2)}·${fmtSigned(M[k][j], 2)}`).join(' + ');

  return (
    <Lab
      title="Slide 9 term by term · every matrix with its shape"
      slides="slide 9"
      tryThis="before reading the result, predict the shape of h(t−1)ᵀW_h and of xᵀ(t)W_x — then check they match bᵀ_h so the three can be added. Click a neuron column to see its sum written out, then press next step: h(t) becomes the next h(t−1)."
    >
      <div className="dl-lab__controls">
        <Chips label="n_inputs" value={nIn} options={[1, 2, 3, { v: 4, l: '4 (slide 10)' }]} onChange={setNIn} />
        <Chips label="n_neurons" value={nN} options={[1, 2, 3, { v: 5, l: '5 (slide 10)' }]} onChange={setNN} />
        <Chips label="n_outputs" value={nOut} options={[1, { v: 2, l: '2 (slide 10)' }, 3]} onChange={setNOut} />
        <Chips label="φ_h · φ_y" value={`${phi}|${phiY}`} options={[{ v: 'tanh|linear', l: 'tanh · none (this page’s default)' }, { v: 'relu|linear', l: 'ReLU · none' }, { v: 'tanh|sigmoid', l: 'tanh · sigmoid' }]} onChange={(v) => { const [a, b] = v.split('|'); setPhi(a); setPhiY(b); }} />
        <div className="dl4s-stepper" role="group" aria-label="Time step">
          {[0, 1, 2, 3].map((k) => (
            <button key={k} type="button" className={`dl-chip${k === t ? ' dl-chip--on' : ''}`} aria-pressed={k === t} onClick={() => setT(k)}>t = {k}</button>
          ))}
          <button type="button" className="dl-btn" onClick={() => setT((v) => Math.min(3, v + 1))} disabled={t >= 3}>next step →</button>
        </div>
      </div>

      <div className="dl4s-eqrows">
        <div className="dl4s-eqrow">
          <Mat m={[s.hPrev]} label={t === 0 ? '\\mathbf{h}^{\\top}_{\\text{start}} = \\mathbf{0}' : `\\mathbf{h}^{\\top}_{(${t - 1})}`} shape={`1 \\times ${nN}`} kind="h" />
          <span className="dl4s-op">×</span>
          <Mat m={P.Wh} label="\mathbf{W}_h" shape={`${nN} \\times ${nN}`} hlCol={j} />
          <span className="dl4s-op">=</span>
          <Mat m={[t1]} label="\mathbf{h}^{\top}_{(t-1)}\mathbf{W}_h" shape={`1 \\times ${nN}`} hlCol={j} />
        </div>
        <div className="dl4s-eqrow">
          <Mat m={[s.x]} label={`\\mathbf{x}^{\\top}_{(${t})}`} shape={`1 \\times ${nIn}`} kind="x" />
          <span className="dl4s-op">×</span>
          <Mat m={P.Wx} label="\mathbf{W}_x" shape={`${nIn} \\times ${nN}`} hlCol={j} />
          <span className="dl4s-op">=</span>
          <Mat m={[t2]} label="\mathbf{x}^{\top}_{(t)}\mathbf{W}_x" shape={`1 \\times ${nN}`} hlCol={j} />
        </div>
        <div className="dl4s-eqrow">
          <span className="dl4s-op">+</span>
          <Mat m={[P.bh]} label="\mathbf{b}^{\top}_h" shape={`1 \\times ${nN}`} hlCol={j} />
          <span className="dl4s-op">→ {phi === 'relu' ? 'ReLU' : 'tanh'}( sum ) =</span>
          <Mat m={[s.h]} label={`\\mathbf{h}^{\\top}_{(${t})}`} shape={`1 \\times ${nN}`} hlCol={j} kind="h" />
        </div>
        <div className="dl4s-eqrow">
          <Mat m={[s.h]} label={`\\mathbf{h}^{\\top}_{(${t})}`} shape={`1 \\times ${nN}`} kind="h" />
          <span className="dl4s-op">×</span>
          <Mat m={P.Wy} label="\mathbf{W}_y" shape={`${nN} \\times ${nOut}`} />
          <span className="dl4s-op">+</span>
          <Mat m={[P.by]} label="\mathbf{b}^{\top}_y" shape={`1 \\times ${nOut}`} />
          <span className="dl4s-op">→ {phiY === 'sigmoid' ? 'σ' : 'no activation'} →</span>
          <Mat m={[s.y]} label={`\\mathbf{y}^{\\top}_{(${t})}`} shape={`1 \\times ${nOut}`} kind="y" />
        </div>
      </div>

      <div className="dl4s-colpick" role="group" aria-label="Neuron (column) to expand">
        <span className="dl-ctl__label">expand neuron</span>
        {Array.from({ length: nN }, (_, k) => (
          <button key={k} type="button" className={`dl-chip${k === j ? ' dl-chip--on' : ''}`} aria-pressed={k === j} onClick={() => setCol(k)}>{k + 1}</button>
        ))}
      </div>
      <p className="dl4s-readout dl4s-mono" aria-live="polite">
        h({t})[{j + 1}] = {phi}( [{dot(s.hPrev, P.Wh)}] + [{dot(s.x, P.Wx)}] + {fmtSigned(P.bh[j], 2)} ) = {phi}({fmtSigned(s.a[j], 3)}) = <b>{fmtSigned(s.h[j], 3)}</b>
      </p>
      <p className="dl4s-cap">
        Row vectors times matrices, exactly as slide 9 writes them: column {j + 1} of W_h and of W_x is everything neuron {j + 1} weighs. At t = 0 the previous state is the
        zero vector. Numbers are this page’s own seeded weights.
      </p>
    </Lab>
  );
}

/* ── §3 · the weather RNN's shapes (slides 10–11) ────────────────────────── */
export function ShapeLab() {
  const [nIn, setNIn] = useState(4);
  const [nN, setNN] = useState(5);
  const [nOut, setNOut] = useState(2);
  const [steps, setSteps] = useState(3);
  const [batch, setBatch] = useState('one');
  const [m, setM] = useState(32);
  const mini = batch === 'mini';
  const rows = mini ? 'm' : '1';
  const mm = mini ? 'm \\times ' : '1 \\times ';
  const shapeTex = (cols) => (mini ? `\\mathbb{R}^{m\\times ${cols}}` : `\\mathbb{R}^{${cols}}`);
  const params = nN * nN + nIn * nN + nN + nN * nOut + nOut;

  const W = 600;
  const gap = Math.min(170, (W - 120) / steps);
  const cx = (k) => 96 + k * gap;
  const cy = 112;
  const H = mini ? '\\mathbf{H}' : '\\mathbf{h}^{\\top}';
  const X = mini ? '\\mathbf{X}' : '\\mathbf{x}^{\\top}';
  const Y = mini ? '\\hat{\\mathbf{Y}}' : '\\hat{\\mathbf{y}}^{\\top}';

  return (
    <Lab
      title="Slides 10–11 · the weather RNN, shape by shape"
      slides="slides 10–11"
      tryThis="switch to a minibatch: predict what happens to every shape before you look — only the leading 1 becomes m, the weights don’t change. Then add a fourth day and notice the parameter count stays at 62."
    >
      <div className="dl-lab__controls">
        <Chips label="view" value={batch} options={[{ v: 'one', l: 'one instance (slide 10)' }, { v: 'mini', l: 'a minibatch of m (slide 11)' }]} onChange={setBatch} />
        <Chips label="days in" value={steps} options={[1, 2, { v: 3, l: '3 (slide 10)' }, 4]} onChange={setSteps} />
        <Chips label="n_inputs" value={nIn} options={[1, 2, 3, { v: 4, l: '4 (slide 10)' }]} onChange={setNIn} />
        <Chips label="n_neurons" value={nN} options={[2, 3, { v: 5, l: '5 (slide 10)' }, 8]} onChange={setNN} />
        <Chips label="n_outputs" value={nOut} options={[1, { v: 2, l: '2 (slide 10)' }]} onChange={setNOut} />
        {mini && <div className="dl-sliders"><Range label="m (minibatch size)" value={m} min={1} max={64} onChange={setM} /></div>}
      </div>

      <div className="dl4s-wide">
        <svg viewBox={`0 0 ${W} 232`} className="dl4s-svg dl4s-shapes" role="img" aria-label={`${steps} RNN cells; only the last output is used, the others are discarded`}>
          <line x1={14} y1={cy} x2={cx(0) - 46} y2={cy} className="dl4s-wire dl4s-wire--h" />
          <Arrowhead x={cx(0) - 45} y={cy} dir="right" className="dl4s-ah dl4s-ah--h" />
          <foreignObject x={0} y={cy - 66} width={112} height={40}><div className="dl4s-fo"><Tex src={`${H}_{(0)} = \\mathbf{0}`} /></div></foreignObject>
          {Array.from({ length: steps }, (_, k) => {
            const last = k === steps - 1;
            return (
              <g key={k}>
                <rect x={cx(k) - 44} y={cy - 22} width={88} height={44} rx={8} className="dl4s-cell" />
                <text x={cx(k)} y={cy - 3} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--ink">RNN cell</text>
                <text x={cx(k)} y={cy + 12} textAnchor="middle" className="dl4s-tick">({nN} neurons)</text>
                <line x1={cx(k)} y1={cy + 68} x2={cx(k)} y2={cy + 24} className="dl4s-wire dl4s-wire--x" />
                <Arrowhead x={cx(k)} y={cy + 23} className="dl4s-ah dl4s-ah--x" />
                <foreignObject x={cx(k) - 70} y={cy + 70} width={140} height={40}><div className="dl4s-fo dl4s-fo--top"><Tex src={`${X}_{(${k})} \\in ${shapeTex(nIn)}`} /></div></foreignObject>
                <line x1={cx(k)} y1={cy - 24} x2={cx(k)} y2={cy - 58} className={`dl4s-wire dl4s-wire--y${last ? '' : ' dl4s-wire--ghost'}`} />
                <Arrowhead x={cx(k)} y={cy - 59} className={`dl4s-ah dl4s-ah--y${last ? '' : ' dl4s-wire--ghost'}`} />
                <foreignObject x={cx(k) - 70} y={cy - 96} width={140} height={40}>
                  <div className={`dl4s-fo${last ? '' : ' dl4s-fo--ghost'}`}>
                    {!last && <span className="dl4s-fo__tag">(Discarded)</span>}
                    <Tex src={`${Y}_{(${k + 1})} \\in ${shapeTex(nOut)}`} />
                  </div>
                </foreignObject>
                {!last && (
                  <g>
                    <line x1={cx(k) + 45} y1={cy} x2={cx(k + 1) - 46} y2={cy} className="dl4s-wire dl4s-wire--h" />
                    <Arrowhead x={cx(k + 1) - 45} y={cy} dir="right" className="dl4s-ah dl4s-ah--h" />
                    <foreignObject x={(cx(k) + cx(k + 1)) / 2 - 40} y={cy - 44} width={80} height={40}><div className="dl4s-fo"><Tex src={`${H}_{(${k + 1})}`} /></div></foreignObject>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dl4s-shapegrid">
        <table className="dl-table dl4s-shapetable">
          <thead><tr><th>symbol</th><th>shape</th>{mini && <th>with m = {m}</th>}<th>what it is</th></tr></thead>
          <tbody>
            <tr><td><Tex src={`${X}_{(t)}`} /></td><td><Tex src={`${rows === 'm' ? 'm' : '1'} \\times ${nIn}`} /></td>{mini && <td>{m} × {nIn}</td>}<td>the {nIn} input features at step t{mini ? ', one row per instance' : ''}</td></tr>
            <tr><td><Tex src={`${H}_{(t)}`} /></td><td><Tex src={`${rows === 'm' ? 'm' : '1'} \\times ${nN}`} /></td>{mini && <td>{m} × {nN}</td>}<td>the state of the {nN} neurons</td></tr>
            <tr><td><Tex src={`${Y}_{(t)}`} /></td><td><Tex src={`${rows === 'm' ? 'm' : '1'} \\times ${nOut}`} /></td>{mini && <td>{m} × {nOut}</td>}<td>the {nOut} predicted values</td></tr>
            <tr><td><Tex src="\mathbf{W}_h" /></td><td><Tex src={`${nN} \\times ${nN}`} /></td>{mini && <td>{nN} × {nN}</td>}<td>state → state</td></tr>
            <tr><td><Tex src="\mathbf{W}_x" /></td><td><Tex src={`${nIn} \\times ${nN}`} /></td>{mini && <td>{nIn} × {nN}</td>}<td>input → state</td></tr>
            <tr><td><Tex src="\mathbf{W}_y" /></td><td><Tex src={`${nN} \\times ${nOut}`} /></td>{mini && <td>{nN} × {nOut}</td>}<td>state → output</td></tr>
            <tr><td><Tex src={mini ? '\\mathbf{B}_h,\\ \\mathbf{B}_y' : '\\mathbf{b}^{\\top}_h,\\ \\mathbf{b}^{\\top}_y'} /></td><td><Tex src={`${mm}${nN},\\ ${mm}${nOut}`} /></td>{mini && <td>{m} × {nN}, {m} × {nOut}</td>}<td>{mini ? 'the bias rows, stacked m times' : 'the biases'}</td></tr>
          </tbody>
        </table>
        <div className="dl4s-tensor" aria-label={`The training set as a 3D tensor N by ${steps} by ${nIn}`}>
          <svg viewBox="0 0 220 172" className="dl4s-svg">
            {[3, 2, 1, 0].map((k) => (
              <rect key={k} x={40 + k * 12} y={30 + (3 - k) * 10} width={110} height={90} className="dl4s-tensor__sheet" />
            ))}
            <text x={95} y={160} textAnchor="middle" className="dl4s-svg__label">{steps} time steps × {nIn} features</text>
            <text x={30} y={95} textAnchor="end" className="dl4s-svg__label">N</text>
            <text x={110} y={18} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--ink">one sheet per instance</text>
          </svg>
          <p className="dl4s-total"><Tex src={`\\mathbf{X} \\in \\mathbb{R}^{N\\times ${steps}\\times ${nIn}}, \\quad \\mathbf{Y} \\in \\mathbb{R}^{N\\times ${nOut}}`} /></p>
        </div>
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="weights to learn" v={params} tone="accent" sub={`${nN}·${nN} + ${nIn}·${nN} + ${nN} + ${nN}·${nOut} + ${nOut} — shared by all ${steps} cells (this page’s count; the slides give none)`} />
        <Stat k="outputs used in the loss" v={`1 of ${steps}`} sub={`only the last, compared with y(${steps}) (e.g. average MSE)`} />
        <Stat k="initial state" v="zero vector" sub={`h(0) for every training instance${mini ? ` — so H(0) is ${m} × ${nN} zeros` : ''}`} />
      </div>
    </Lab>
  );
}
