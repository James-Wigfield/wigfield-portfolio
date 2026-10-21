import { useMemo, useState } from 'react';
import { Lab, Chips, Range, Stat } from '../ui';
import { SEQ_A, SEQ_B } from '../slideData';
import { X3, RUN } from '../aeRun';
import { encode, decode, decoderPlane, mse, fmt } from '../ae';
import './labsCodings.css';

/* ============================================================================
   LECTURE 5 STUDY — LABS FOR §2
     SequenceLab  slide 5's two sequences, kept either number by number or as
                  a pattern of three numbers (start, step, length) and rebuilt
                  from it — the page's illustration of an efficient
                  representation and a reconstruction loss
     Fig171Lab    Figure 17-1's 3 → 2 → 3 autoencoder with this page's
                  trained weights (§3's run): pick an input, see its two
                  codings, its reconstruction and the reconstruction loss;
                  push the input off the learned plane, or widen the code to 3
   ========================================================================== */

/* ── slide 5 · two sequences ─────────────────────────────────────────────── */
// The best straight-line pattern for a sequence (least squares on the
// position), as the three numbers you'd keep: start, step, length.
function linePattern(seq) {
  const n = seq.length;
  const mi = (n - 1) / 2;
  const my = seq.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  seq.forEach((v, i) => {
    num += (i - mi) * (v - my);
    den += (i - mi) ** 2;
  });
  const step = num / den;
  const start = my - step * mi;
  return { start, step, length: n };
}

const SEQS = { a: { l: 'first: 40, 27, 25, …', seq: SEQ_A }, b: { l: 'second: 50, 48, 46, …', seq: SEQ_B } };

export function SequenceLab() {
  const [which, setWhich] = useState('b');
  const [mode, setMode] = useState('pattern');
  const seq = SEQS[which].seq;
  const pat = useMemo(() => linePattern(seq), [seq]);
  const recon = mode === 'raw' ? seq.slice() : seq.map((_, i) => Math.round(pat.start + pat.step * i));
  const wrong = recon.filter((v, i) => v !== seq[i]).length;
  const meanAbs = recon.reduce((s, v, i) => s + Math.abs(v - seq[i]), 0) / seq.length;
  const kept = mode === 'raw' ? seq.length : 3;
  const r1 = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2));
  return (
    <Lab
      title="Remember the numbers, or the pattern?"
      slides="slide 5"
      tryThis="predict which sequence a three-number pattern can rebuild exactly. Switch sequences with “keep a pattern” on, and notice how many numbers you keep and what the rebuild gets wrong."
    >
      <div className="dl-lab__controls">
        <Chips label="sequence" value={which} options={Object.entries(SEQS).map(([v, s]) => ({ v, l: s.l }))} onChange={setWhich} />
        <Chips label="what you keep" value={mode} options={[{ v: 'raw', l: 'every number' }, { v: 'pattern', l: 'a pattern: start, step, length' }]} onChange={setMode} />
      </div>
      <div className="dl5s-seq" role="group" aria-label="Sequence, what is kept, and the rebuilt sequence">
        <p className="dl5s-stagehead">The sequence ({seq.length} numbers)</p>
        <ol className="dl5s-seq__row">
          {seq.map((v, i) => <li key={i}>{v}</li>)}
        </ol>
        <p className="dl5s-stagehead">What you keep ({kept} number{kept === 1 ? '' : 's'})</p>
        {mode === 'raw' ? (
          <ol className="dl5s-seq__row dl5s-seq__row--code">{seq.map((v, i) => <li key={i}>{v}</li>)}</ol>
        ) : (
          <ol className="dl5s-seq__row dl5s-seq__row--code">
            <li><span>start</span>{r1(pat.start)}</li>
            <li><span>step</span>{r1(pat.step)}</li>
            <li><span>length</span>{pat.length}</li>
          </ol>
        )}
        <p className="dl5s-stagehead">Rebuilt from what you kept</p>
        <ol className="dl5s-seq__row">
          {recon.map((v, i) => <li key={i} className={v !== seq[i] ? 'dl5s-seq__bad' : undefined} title={v !== seq[i] ? `should be ${seq[i]}` : undefined}>{v}</li>)}
        </ol>
      </div>
      <div className="dl5s-stats dl5s-stats--tight">
        <Stat k="numbers kept" v={`${kept} of ${seq.length}`} />
        <Stat k="rebuilt wrong" v={`${wrong} of ${seq.length}`} tone={wrong ? undefined : 'accent'} />
        <Stat k="mean miss" v={fmt(meanAbs, 1)} sub="average |rebuilt − original|" />
      </div>
      <p className="dl5s-cap">
        This page’s illustration of slide 5’s point, not a trained model: the “pattern” is the best straight line through the numbers. The second
        sequence (decreasing even numbers from 50 to 14) fits a pattern exactly, so 3 numbers rebuild all 19. The first has no such pattern: kept
        as a pattern it comes back wrong, so it has to be kept number by number. An autoencoder looks for patterns like this in its inputs, keeps them
        as codings, and is scored by how well it rebuilds the inputs (the reconstruction loss).
      </p>
    </Lab>
  );
}

/* ── Figure 17-1 · the 3 → 2 → 3 autoencoder, live ──────────────────────── */
const NODE = { x: [110, 220, 330], h: [165, 275], yIn: 236, yEnc: 168, yDec: 96, yOut: 26 };

function Net({ x, z, y, wide, ae }) {
  const enc = wide ? NODE.x : NODE.h;
  const edge = (w) => ({ className: `dl5s-f171__w ${w >= 0 ? 'dl5s-f171__w--pos' : 'dl5s-f171__w--neg'}`, strokeWidth: 0.6 + Math.min(3, Math.abs(w) * 2.2) });
  return (
    <svg viewBox="0 0 470 262" className="dl5s-svg dl5s-f171" role="img" aria-label={`Figure 17-1 right: inputs x1 to x3 feed ${wide ? 'three' : 'two'} encoder neurons, which feed three decoder neurons whose outputs are the reconstructions x′1 to x′3`}>
      {/* edges */}
      {NODE.x.map((xi, i) => enc.map((xe, k) => {
        const w = wide ? (i === k ? 1 : 0) : ae.W1[i][k];
        return wide && i !== k ? null : <line key={`a${i}${k}`} x1={xi} y1={NODE.yIn - 12} x2={xe} y2={NODE.yEnc + 15} {...edge(w)} />;
      }))}
      {enc.map((xe, k) => NODE.x.map((xo, j) => {
        const w = wide ? (k === j ? 1 : 0) : ae.W2[k][j];
        return wide && k !== j ? null : <line key={`b${k}${j}`} x1={xe} y1={NODE.yEnc - 15} x2={xo} y2={NODE.yDec + 15} {...edge(w)} />;
      }))}
      {/* inputs */}
      {NODE.x.map((xi, i) => (
        <g key={`in${i}`}>
          <text x={xi} y={NODE.yIn + 4} textAnchor="middle" className="dl5s-svg__label dl5s-svg__label--ink">x{['₁', '₂', '₃'][i]} = {fmt(x[i], 2)}</text>
        </g>
      ))}
      {/* encoder neurons */}
      {enc.map((xe, k) => (
        <g key={`e${k}`}>
          <circle cx={xe} cy={NODE.yEnc} r={15} className="dl5s-f171__n dl5s-f171__n--code" />
          <text x={xe} y={NODE.yEnc + 4} textAnchor="middle" className="dl5s-f171__v">{fmt(z[k], 2)}</text>
        </g>
      ))}
      {/* decoder neurons */}
      {NODE.x.map((xo, j) => (
        <g key={`d${j}`}>
          <circle cx={xo} cy={NODE.yDec} r={15} className="dl5s-f171__n" />
          <line x1={xo} y1={NODE.yDec - 15} x2={xo} y2={NODE.yOut + 8} className="dl5s-f171__w" />
          <text x={xo} y={NODE.yOut + 2} textAnchor="middle" className="dl5s-svg__label dl5s-svg__label--ink">x′{['₁', '₂', '₃'][j]} = {fmt(y[j], 2)}</text>
        </g>
      ))}
      {/* braces */}
      <path d={`M402 ${NODE.yEnc - 20} q8 0 8 8 v6 q0 6 6 6 q-6 0 -6 6 v6 q0 8 -8 8`} className="dl5s-f171__brace" />
      <text x={422} y={NODE.yEnc + 4} className="dl5s-svg__label">Encoder</text>
      <path d={`M402 ${NODE.yDec - 20} q8 0 8 8 v6 q0 6 6 6 q-6 0 -6 6 v6 q0 8 -8 8`} className="dl5s-f171__brace" />
      <text x={422} y={NODE.yDec + 4} className="dl5s-svg__label">Decoder</text>
      <text x={12} y={NODE.yEnc + 4} className="dl5s-svg__label">codings</text>
      <text x={12} y={NODE.yIn + 4} className="dl5s-svg__label">inputs</text>
      <text x={12} y={NODE.yOut + 2} className="dl5s-svg__label">outputs</text>
    </svg>
  );
}

export function Fig171Lab() {
  const [idx, setIdx] = useState(0);
  const [lift, setLift] = useState(0);
  const [width, setWidth] = useState(2);
  const ae = RUN.ae;
  const n = decoderPlane(ae).normal;
  const x = X3[idx].map((v, j) => v + lift * n[j]);
  const wide = width === 3;
  const z = wide ? x.slice() : encode(ae, x);
  const y = wide ? x.slice() : decode(ae, z);
  const loss = mse([x], [y]);
  const trainLoss = RUN.history[RUN.history.length - 1];
  return (
    <Lab
      title="Figure 17-1, live: inputs → codings → reconstructions"
      slides="slides 6–7"
      tryThis="predict what happens to the reconstruction loss as you push the input off the plane. Then widen the code to 3 numbers and notice that the loss goes to zero for any input: a code that wide can simply copy."
    >
      <div className="dl-lab__controls">
        <Range label="input: training point" value={idx} min={0} max={X3.length - 1} onChange={setIdx} fmt={(v) => `#${v + 1} of ${X3.length}`} />
        <Range label="push it off the learned plane by" value={lift} min={-1} max={1} step={0.05} onChange={setLift} fmt={(v) => fmt(v, 2)} />
        <Chips
          label="codings"
          value={width}
          options={[{ v: 2, l: '2 numbers (undercomplete, as Figure 17-1)' }, { v: 3, l: '3 numbers (as wide as the input)' }]}
          onChange={setWidth}
        />
      </div>
      <div className="dl5s-f171__grid">
        <div className="dl5s-wide"><Net x={x} z={z} y={y} wide={wide} ae={ae} /></div>
        <div className="dl5s-stats dl5s-stats--col">
          <Stat k="codings (the latent representation)" v={`[${z.map((v) => fmt(v, 2)).join(', ')}]`} sub={`${z.length} numbers for a ${x.length}-number input`} />
          <Stat k="reconstruction loss (MSE)" v={fmt(loss, 4)} tone={loss < 1e-9 ? 'accent' : undefined} sub="mean of (x′ − x)² over the 3 outputs" />
          <Stat k="parameters" v={wide ? '—' : '8 + 9 = 17'} sub={wide ? 'the copy needs no learning' : 'encoder 3×2 weights + 2 biases · decoder 2×3 weights + 3 biases'} />
        </div>
      </div>
      <p className="dl5s-cap">
        <span className="dl5s-own">this page’s own run</span> The weights are the linear autoencoder this page trains in §3 on its own 60 points
        (slide 9’s settings: SGD, learning rate 0.5, 500 epochs). Its mean training loss is {fmt(trainLoss, 4)}. The 2-number code can only describe points on
        one plane, so a point pushed off that plane comes back on the plane, and the gap is the loss. Edge thickness shows each weight’s size; orange is
        positive, blue is negative. With 3 numbers the page simply wires each input straight through: a perfect copy that has learned nothing.
      </p>
    </Lab>
  );
}
