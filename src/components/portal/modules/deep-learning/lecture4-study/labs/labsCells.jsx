import { useMemo, useState } from 'react';
import { Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { lstmStep, gruStep, zeros, tanh, lstmParams, gruParams, denseParams, fmtInt } from '../rnn';
import { Arrowhead } from './parts';
import './labsCells.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §13 AND §14
     LstmCellLab  Figure 15-12 live: one LSTM unit with hand-set weights runs
                  a short sequence holding one important input. Watch the
                  input gate store it in c, the forget gate keep it, and the
                  output gate release it on cue — slide 47's summary, made
                  visible. The forget gate can be overridden.
     LstmMathLab  slide 47's six equations evaluated with the current step's
                  numbers, every matrix labelled with its shape; and the
                  parameter count of slide 43's lstm_model (685)
     GruLab       the same sequence through a GRU (Figure 15-13, slide 49):
                  one state, z doing forget + input, r inside g, no output
                  gate; side by side with the LSTM; gru_model's 1,401
   The toy weights are this page's own, hand-set so each gate's job is easy to
   see; they are not trained. Inputs are x(t) = [signal, read].
   ========================================================================== */

// ── this page's hand-set toy cells (1 unit, 2 inputs: signal, read) ─────────
const LSTM_W = {
  Wxi: [[8], [0]], Whi: [[0]], bi: [-4], // input gate opens on a signal
  Wxf: [[0], [0]], Whf: [[0]], bf: [5], // forget gate stays open (keep)
  Wxo: [[0], [8]], Who: [[0]], bo: [-4], // output gate opens on "read"
  Wxg: [[3], [0]], Whg: [[0]], bg: [0], // main layer: the signal's value
};
const GRU_W = {
  Wxz: [[-8], [0]], Whz: [[0]], bz: [4], // z ≈ 1 keeps the old state; a signal drops z to ≈ 0
  Wxr: [[0], [0]], Whr: [[0]], br: [4], // r ≈ 1: g sees the whole old state
  Wxg: [[3], [0]], Whg: [[1]], bg: [0],
};
const T = 8;
const DEFAULT_SIGNAL = [0, 1, 0, 0, 0, 0, 0, 0];
const DEFAULT_READ = [0, 0, 0, 0, 0, 0, 1, 0];
const FORGET = { learned: null, half: 0.5, closed: 0 };

function runLstm(xs, fOverride) {
  let h = zeros(1);
  let c = zeros(1);
  return xs.map((x) => {
    const s = lstmStep(x, h, c, LSTM_W);
    if (fOverride != null) {
      s.f = [fOverride];
      s.keep = [fOverride * c[0]];
      s.c = [s.keep[0] + s.add[0]];
      s.tc = [tanh(s.c[0])];
      s.h = [s.o[0] * s.tc[0]];
    }
    const row = { x, hPrev: h, cPrev: c, ...s };
    h = s.h;
    c = s.c;
    return row;
  });
}
function runGru(xs) {
  let h = zeros(1);
  return xs.map((x) => {
    const s = gruStep(x, h, GRU_W);
    const row = { x, hPrev: h, ...s };
    h = s.h;
    return row;
  });
}

const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3));

// the sequence editor + timeline, shared by the three labs
function useSequence() {
  const [signal, setSignal] = useState(DEFAULT_SIGNAL);
  const [read, setRead] = useState(DEFAULT_READ);
  const xs = useMemo(() => signal.map((s, t) => [s, read[t]]), [signal, read]);
  const flip = (which, t) => (which === 'signal' ? setSignal : setRead)((a) => a.map((v, k) => (k === t ? 1 - v : v)));
  const reset = () => { setSignal(DEFAULT_SIGNAL); setRead(DEFAULT_READ); };
  const isDefault = signal.every((v, k) => v === DEFAULT_SIGNAL[k]) && read.every((v, k) => v === DEFAULT_READ[k]);
  return { signal, read, xs, flip, reset, isDefault };
}

function SeqRow({ label, vals, onFlip, cur, kind }) {
  return (
    <div className="dl4s-tl4__row">
      <span className={`dl4s-tl4__lab dl4s-tl4__lab--${kind}`}>{label}</span>
      {vals.map((v, t) => (
        <button key={t} type="button" className={`dl4s-tl4__bit${v ? ' dl4s-tl4__bit--on' : ''}${t === cur ? ' dl4s-tl4__cell--cur' : ''}`} aria-pressed={!!v} aria-label={`${label} at t = ${t}: ${v}`} onClick={() => onFlip(t)}>{v}</button>
      ))}
    </div>
  );
}

function BarRow({ label, vals, cur, kind, onPick, signed = false }) {
  return (
    <div className="dl4s-tl4__row">
      <span className={`dl4s-tl4__lab dl4s-tl4__lab--${kind}`}>{label}</span>
      {vals.map((v, t) => (
        <button key={t} type="button" className={`dl4s-tl4__bar dl4s-tl4__bar--${kind}${t === cur ? ' dl4s-tl4__cell--cur' : ''}`} onClick={() => onPick(t)} aria-label={`${label} at t = ${t}: ${f3(v)}`}>
          <i style={{ height: `${Math.min(1, Math.abs(v)) * 100}%` }} className={signed && v < 0 ? 'neg' : ''} />
          <span>{Math.abs(v) < 0.0005 ? '0' : Math.abs(v) >= 0.995 ? v.toFixed(2) : v.toFixed(2).replace(/^(-?)0\./, '$1.')}</span>
        </button>
      ))}
    </div>
  );
}

function TimeHead({ cur, onPick }) {
  return (
    <div className="dl4s-tl4__row dl4s-tl4__row--head">
      <span className="dl4s-tl4__lab">t</span>
      {Array.from({ length: T }, (_, t) => (
        <button key={t} type="button" className={`dl4s-tl4__t${t === cur ? ' dl4s-tl4__cell--cur' : ''}`} aria-pressed={t === cur} onClick={() => onPick(t)}>{t}</button>
      ))}
    </div>
  );
}

/* ── Figure 15-12, live ──────────────────────────────────────────────────── */
function LstmFigure({ s, t }) {
  const fc = [
    { k: 'f', cx: 160, v: s.f[0], band: 'logistic' },
    { k: 'g', cx: 250, v: s.g[0], band: 'tanh' },
    { k: 'i', cx: 340, v: s.i[0], band: 'logistic' },
    { k: 'o', cx: 460, v: s.o[0], band: 'logistic' },
  ];
  return (
    <div className="dl4s-wide">
      <svg viewBox="0 0 640 300" className="dl4s-svg dl4s-lstm" role="img" aria-label={`LSTM cell at t = ${t}: forget gate ${f3(s.f[0])}, input gate ${f3(s.i[0])}, main layer ${f3(s.g[0])}, output gate ${f3(s.o[0])}; long-term state ${f3(s.cPrev[0])} becomes ${f3(s.c[0])}; output ${f3(s.h[0])}`}>
        <rect x={92} y={42} width={438} height={212} rx={12} className="dl4s-lstm__cell" />
        <text x={520} y={244} textAnchor="end" className="dl4s-lstm__name">LSTM cell</text>
        {/* long-term state */}
        <line x1={18} y1={72} x2={616} y2={72} className="dl4s-wire dl4s-wire--c" />
        <Arrowhead x={618} y={72} dir="right" s={6} className="dl4s-ah dl4s-ah--c" />
        <text x={20} y={62} className="dl4s-svg__label dl4s-svg__label--c">c(t−1) = {f3(s.cPrev[0])}</text>
        <text x={590} y={62} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--c">c(t) = {f3(s.c[0])}</text>
        <g className="dl4s-op"><circle cx={160} cy={72} r={10} /><path d="M154 66 L166 78 M166 66 L154 78" /></g>
        <text x={160} y={52} textAnchor="middle" className="dl4s-tick">Forget gate</text>
        <g className="dl4s-op"><circle cx={340} cy={72} r={10} /><path d="M334 72 H346 M340 66 V78" /></g>
        {/* FC layers */}
        {fc.map((b) => (
          <g key={b.k}>
            <rect x={b.cx - 24} y={182} width={48} height={28} rx={3} className="dl4s-lstm__fc" />
            <rect x={b.cx - 24} y={182} width={48} height={6} className={`dl4s-lstm__band dl4s-lstm__band--${b.band}`} />
            <text x={b.cx} y={203} textAnchor="middle" className="dl4s-tick">FC</text>
            <text x={b.cx - 6} y={176} textAnchor="end" className="dl4s-lstm__val"><tspan className="dl4s-lstm__k">{b.k}(t)</tspan>={f3(b.v)}</text>
          </g>
        ))}
        {/* f → forget gate */}
        <line x1={160} y1={182} x2={160} y2={84} className="dl4s-wire dl4s-lstm__gate" style={{ '--g': s.f[0] }} />
        <Arrowhead x={160} y={83} s={5} />
        {/* g and i → input gate → + */}
        <path d="M250 182 V142 H330" className="dl4s-wire" />
        <Arrowhead x={331} y={142} dir="right" s={5} />
        <g className="dl4s-op"><circle cx={340} cy={142} r={10} /><path d="M334 136 L346 148 M346 136 L334 148" /></g>
        <text x={326} y={128} textAnchor="end" className="dl4s-tick">Input gate</text>
        <line x1={340} y1={182} x2={340} y2={153} className="dl4s-wire dl4s-lstm__gate" style={{ '--g': s.i[0] }} />
        <Arrowhead x={340} y={152} s={5} />
        <line x1={340} y1={131} x2={340} y2={83} className="dl4s-wire" />
        <Arrowhead x={340} y={83} s={5} />
        <text x={334} y={108} textAnchor="end" className="dl4s-lstm__val">+ {f3(s.add[0])}</text>
        {/* tanh → output gate → h */}
        <line x1={392} y1={72} x2={392} y2={96} className="dl4s-wire dl4s-wire--c" />
        <rect x={386} y={96} width={12} height={30} className="dl4s-lstm__band dl4s-lstm__band--tanh" />
        <text x={404} y={114} className="dl4s-lstm__val">tanh → {f3(s.tc[0])}</text>
        <path d="M392 126 V142 H449" className="dl4s-wire" />
        <Arrowhead x={450} y={142} dir="right" s={5} />
        <g className="dl4s-op"><circle cx={460} cy={142} r={10} /><path d="M454 136 L466 148 M466 136 L454 148" /></g>
        <text x={452} y={162} textAnchor="end" className="dl4s-tick">Output gate</text>
        <line x1={460} y1={182} x2={460} y2={153} className="dl4s-wire dl4s-lstm__gate" style={{ '--g': s.o[0] }} />
        <Arrowhead x={460} y={152} s={5} />
        <line x1={471} y1={142} x2={616} y2={142} className="dl4s-wire dl4s-wire--h" />
        <Arrowhead x={618} y={142} dir="right" s={6} className="dl4s-ah dl4s-ah--h" />
        <text x={590} y={134} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--h">h(t) = {f3(s.h[0])}</text>
        <line x1={602} y1={142} x2={602} y2={22} className="dl4s-wire dl4s-wire--y" />
        <Arrowhead x={602} y={21} s={6} className="dl4s-ah dl4s-ah--y" />
        <text x={594} y={24} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--y">ŷ(t) = h(t)</text>
        {/* inputs fan into every FC layer */}
        <line x1={18} y1={236} x2={112} y2={236} className="dl4s-wire dl4s-wire--h" />
        <text x={20} y={228} className="dl4s-svg__label dl4s-svg__label--h">h(t−1) = {f3(s.hPrev[0])}</text>
        {fc.map((b) => <line key={`h${b.k}`} x1={112} y1={236} x2={b.cx - 8} y2={211} className="dl4s-fan4 dl4s-fan4--h" />)}
        <line x1={300} y1={290} x2={300} y2={250} className="dl4s-wire dl4s-wire--x" />
        <text x={308} y={288} className="dl4s-svg__label dl4s-svg__label--x">x(t) = [{s.x[0]}, {s.x[1]}] (signal, read)</text>
        {fc.map((b) => <line key={`x${b.k}`} x1={300} y1={250} x2={b.cx + 8} y2={211} className="dl4s-fan4 dl4s-fan4--x" />)}
        {/* legend, as the figure's */}
        <g className="dl4s-lstm__legend">
          <rect x={538} y={196} width={10} height={5} className="dl4s-lstm__band dl4s-lstm__band--logistic" /><text x={552} y={202} className="dl4s-tick">Logistic</text>
          <rect x={538} y={212} width={10} height={5} className="dl4s-lstm__band dl4s-lstm__band--tanh" /><text x={552} y={218} className="dl4s-tick">Tanh</text>
          <text x={538} y={234} className="dl4s-tick">⊗ element-wise ×</text>
          <text x={538} y={248} className="dl4s-tick">⊕ addition</text>
        </g>
      </svg>
    </div>
  );
}

export function LstmCellLab() {
  const seq = useSequence();
  const [t, setT] = useState(1);
  const [forget, setForget] = useState('learned');
  const run = useMemo(() => runLstm(seq.xs, FORGET[forget]), [seq.xs, forget]);
  const s = run[t];
  const sigAt = seq.signal.indexOf(1);
  const readAt = seq.read.indexOf(1);

  return (
    <Lab
      title="Figure 15-12 live · store, keep, release"
      slides="slides 44–47"
      tryThis="step from t = 1 to t = 6, predicting each time whether the signal is in c, in h, or both. Then close the forget gate and predict what reaches the output at the read step."
    >
      <div className="dl-lab__controls">
        <Chips label="forget gate" value={forget} options={[{ v: 'learned', l: 'as the toy weights set it (≈ 0.99)' }, { v: 'half', l: 'forced to 0.5' }, { v: 'closed', l: 'forced to 0 (forget)' }]} onChange={setForget} />
        <div className="dl4s-stepper" role="group" aria-label="Time step">
          {Array.from({ length: T }, (_, k) => (
            <button key={k} type="button" className={`dl-chip${k === t ? ' dl-chip--on' : ''}`} aria-pressed={k === t} onClick={() => setT(k)}>t = {k}</button>
          ))}
        </div>
      </div>
      <LstmFigure s={s} t={t} />
      <div className="dl4s-tl4" role="group" aria-label="The sequence over time; click a column to show that step">
        <TimeHead cur={t} onPick={setT} />
        <SeqRow label="signal" vals={seq.signal} onFlip={(k) => seq.flip('signal', k)} cur={t} kind="x" />
        <SeqRow label="read" vals={seq.read} onFlip={(k) => seq.flip('read', k)} cur={t} kind="x" />
        <BarRow label="i (input gate)" vals={run.map((r) => r.i[0])} cur={t} kind="gate" onPick={setT} />
        <BarRow label="f (forget gate)" vals={run.map((r) => r.f[0])} cur={t} kind="gate" onPick={setT} />
        <BarRow label="o (output gate)" vals={run.map((r) => r.o[0])} cur={t} kind="gate" onPick={setT} />
        <BarRow label="c (long-term)" vals={run.map((r) => r.c[0])} cur={t} kind="c" onPick={setT} signed />
        <BarRow label="h = ŷ (output)" vals={run.map((r) => r.h[0])} cur={t} kind="h" onPick={setT} signed />
        {!seq.isDefault && <button type="button" className="dl4s-link" onClick={seq.reset}>back to the default sequence</button>}
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="stored" v={sigAt >= 0 ? `t = ${sigAt}` : 'no signal'} sub={sigAt >= 0 ? `input gate ${f3(run[sigAt].i[0])} lets g = ${f3(run[sigAt].g[0])} into c` : 'toggle a signal bit'} />
        <Stat k="kept until the read" v={readAt > sigAt && sigAt >= 0 ? `c = ${f3(run[readAt].cPrev[0])}` : '—'} sub={forget === 'learned' ? `forget gate ${f3(run[1].f[0])} each step` : `forget gate forced to ${FORGET[forget]}`} />
        <Stat k="released" v={readAt >= 0 ? `h = ${f3(run[readAt].h[0])}` : 'no read'} tone="accent" sub={readAt >= 0 ? `at t = ${readAt}, output gate ${f3(run[readAt].o[0])}` : 'toggle a read bit'} />
      </div>
      <p className="dl4s-cap">
        This page’s hand-set weights, not trained ones: the input gate opens on a signal bit, the output gate on a read bit, and the forget gate stays near 1.
        Click the bits to make your own sequence.
      </p>
    </Lab>
  );
}

/* ── slide 47's equations with this step's numbers ───────────────────────── */
const vec = (a) => `\\begin{bmatrix}${a.join(' & ')}\\end{bmatrix}`;
const col = (W) => `\\begin{bmatrix}${W.map((r) => r[0]).join(' \\\\ ')}\\end{bmatrix}`;
const num = (v) => (Math.abs(v) < 0.0005 ? '0' : Number(v.toFixed(3)).toString());

export function LstmMathLab() {
  const seq = useSequence();
  const [t, setT] = useState(1);
  const [units, setUnits] = useState(12);
  const [inputs, setInputs] = useState(1);
  const run = useMemo(() => runLstm(seq.xs, null), [seq.xs]);
  const s = run[t];
  const x = vec(s.x);
  const hp = `[${num(s.hPrev[0])}]`;
  const gate = (k, act) => {
    const a = s.pre[k][0];
    return `\\mathbf{${k}}^{\\top}_{(${t})} = ${act}\\Big(${x}${col(LSTM_W[`Wx${k}`])} + ${hp}\\,[${LSTM_W[`Wh${k}`][0][0]}] + [${LSTM_W[`b${k}`][0]}]\\Big) = ${act}(${num(a)}) = ${num(s[k][0])}`;
  };
  const p1 = units * inputs + units * units + units;
  const lstmP = lstmParams(units, inputs);
  const dP = denseParams(units, 1);
  const isSlide = units === 12 && inputs === 1;

  return (
    <Lab
      title="Slide 47 · the six equations, with this step’s numbers"
      slides="slides 46–47"
      tryThis="pick t = 6, the read step: before reading the lines, predict which gate is near 1 and which are near 0. Then rebuild slide 43’s count — predict the size of one FC layer for LSTM(12) on 1 input before reading 168."
    >
      <div className="dl-lab__controls">
        <div className="dl4s-stepper" role="group" aria-label="Time step">
          {Array.from({ length: T }, (_, k) => (
            <button key={k} type="button" className={`dl-chip${k === t ? ' dl-chip--on' : ''}`} aria-pressed={k === t} onClick={() => setT(k)}>t = {k}{seq.signal[k] ? ' · signal' : ''}{seq.read[k] ? ' · read' : ''}</button>
          ))}
        </div>
      </div>
      <div className="dl4s-shapes4" aria-label="Shapes in this toy cell">
        <span><Tex src="\mathbf{x}^{\top}_{(t)} \in \mathbb{R}^{1\times 2}" /> (signal, read)</span>
        <span><Tex src="\mathbf{W}_{x\cdot} \in \mathbb{R}^{2\times 1}" /></span>
        <span><Tex src="\mathbf{W}_{h\cdot} \in \mathbb{R}^{1\times 1}" /></span>
        <span><Tex src="\mathbf{b}_{\cdot} \in \mathbb{R}^{1}" /></span>
        <span className="dl4s-mini">one unit, two inputs — this page’s toy</span>
      </div>
      <ol className="dl4s-eq6">
        <li><span className="dl4s-eq6__tag">input gate</span><Tex block src={gate('i', '\\sigma')} /></li>
        <li><span className="dl4s-eq6__tag">forget gate</span><Tex block src={gate('f', '\\sigma')} /></li>
        <li><span className="dl4s-eq6__tag">output gate</span><Tex block src={gate('o', '\\sigma')} /></li>
        <li><span className="dl4s-eq6__tag">main layer</span><Tex block src={gate('g', '\\tanh')} /></li>
        <li><span className="dl4s-eq6__tag">long-term state</span><Tex block src={`\\mathbf{c}_{(${t})} = ${num(s.f[0])} \\otimes ${num(s.cPrev[0])} + ${num(s.i[0])} \\otimes ${num(s.g[0])} = ${num(s.c[0])}`} /></li>
        <li><span className="dl4s-eq6__tag">output</span><Tex block src={`\\mathbf{y}_{(${t})} = \\mathbf{h}_{(${t})} = ${num(s.o[0])} \\otimes \\tanh(${num(s.c[0])}) = ${num(s.o[0])} \\times ${num(s.tc[0])} = ${num(s.h[0])}`} /></li>
      </ol>
      <div className="dl4s-count4">
        <p className="dl4s-stagehead">lstm_model’s parameters (slide 43)</p>
        <div className="dl-lab__controls">
          <div className="dl-sliders"><Range label="LSTM units" value={units} min={1} max={32} onChange={setUnits} fmt={(v) => `${v}${v === 12 ? ' (slide 43)' : ''}`} /></div>
          <Chips label="input features" value={inputs} options={[{ v: 1, l: '1 · rail (slide 43)' }, { v: 5, l: '5 · the slide-50 exercise' }]} onChange={setInputs} />
        </div>
        <p className="dl4s-total">
          one FC layer: {inputs}×{units} + {units}×{units} + {units} = <b>{fmtInt(p1)}</b> · four of them (f, g, i, o): <b>{fmtInt(lstmP)}</b> · Dense(1): {units} + 1 = <b>{dP}</b> · total <b>{fmtInt(lstmP + dP)}</b>
        </p>
        <p className="dl4s-cap">
          {isSlide ? <><span className="dl4s-dot dl4s-dot--y" />= slide 43’s “# Number of trainable parameters: 685”. </> : 'This page’s count for your settings. '}
          The toy cell above has 4 × (2×1 + 1×1 + 1) = 16.
        </p>
      </div>
    </Lab>
  );
}

/* ── §14 · the GRU, side by side with the LSTM ───────────────────────────── */
function GruFigure({ s, t }) {
  return (
    <div className="dl4s-wide">
      <svg viewBox="0 0 640 290" className="dl4s-svg dl4s-lstm" role="img" aria-label={`GRU cell at t = ${t}: gate controller z ${f3(s.z[0])}, gate r ${f3(s.r[0])}, main layer g ${f3(s.g[0])}; state ${f3(s.hPrev[0])} becomes ${f3(s.h[0])}`}>
        <rect x={92} y={42} width={438} height={204} rx={12} className="dl4s-lstm__cell" />
        <text x={520} y={236} textAnchor="end" className="dl4s-lstm__name">GRU cell</text>
        <line x1={18} y1={72} x2={616} y2={72} className="dl4s-wire dl4s-wire--h" />
        <Arrowhead x={618} y={72} dir="right" s={6} className="dl4s-ah dl4s-ah--h" />
        <text x={20} y={62} className="dl4s-svg__label dl4s-svg__label--h">h(t−1) = {f3(s.hPrev[0])}</text>
        <text x={536} y={90} className="dl4s-svg__label dl4s-svg__label--h">h(t) = {f3(s.h[0])}</text>
        <line x1={594} y1={72} x2={594} y2={22} className="dl4s-wire dl4s-wire--y" />
        <Arrowhead x={594} y={21} s={6} className="dl4s-ah dl4s-ah--y" />
        <text x={586} y={24} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--y">ŷ(t) = h(t)</text>
        {/* z ⊗ h(t−1) on the top line */}
        <g className="dl4s-op"><circle cx={250} cy={72} r={10} /><path d="M244 66 L256 78 M256 66 L244 78" /></g>
        <text x={262} y={94} className="dl4s-lstm__val">keep {f3(s.keep[0])}</text>
        <g className="dl4s-op"><circle cx={440} cy={72} r={10} /><path d="M434 72 H446 M440 66 V78" /></g>
        {/* r gate on h(t−1) into the g layer */}
        <path d="M110 72 V226 H250" className="dl4s-wire dl4s-wire--h" />
        <path d="M110 140 H150" className="dl4s-wire dl4s-wire--h" />
        <g className="dl4s-op"><circle cx={160} cy={140} r={10} /><path d="M154 134 L166 146 M166 134 L154 146" /></g>
        <rect x={136} y={182} width={48} height={28} rx={3} className="dl4s-lstm__fc" />
        <rect x={136} y={182} width={48} height={6} className="dl4s-lstm__band dl4s-lstm__band--logistic" />
        <text x={160} y={203} textAnchor="middle" className="dl4s-tick">FC</text>
        <text x={132} y={176} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--ink">r(t)</text>
        <text x={164} y={176} className="dl4s-lstm__val">{f3(s.r[0])}</text>
        <line x1={160} y1={182} x2={160} y2={151} className="dl4s-wire dl4s-lstm__gate" style={{ '--g': s.r[0] }} />
        <Arrowhead x={160} y={151} s={5} />
        <path d="M171 140 H400 V164 H414" className="dl4s-wire" />
        <Arrowhead x={415} y={164} dir="right" s={5} />
        <text x={182} y={132} className="dl4s-lstm__val">r ⊗ h(t−1) = {f3(s.rh[0])}</text>
        {/* z gate */}
        <rect x={226} y={182} width={48} height={28} rx={3} className="dl4s-lstm__fc" />
        <rect x={226} y={182} width={48} height={6} className="dl4s-lstm__band dl4s-lstm__band--logistic" />
        <text x={250} y={203} textAnchor="middle" className="dl4s-tick">FC</text>
        <text x={222} y={176} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--ink">z(t)</text>
        <text x={254} y={176} className="dl4s-lstm__val">{f3(s.z[0])}</text>
        <line x1={250} y1={182} x2={250} y2={83} className="dl4s-wire dl4s-lstm__gate" style={{ '--g': s.z[0] }} />
        <Arrowhead x={250} y={83} s={5} />
        <path d="M250 110 H290" className="dl4s-wire" />
        <rect x={290} y={98} width={92} height={24} rx={4} className="dl4s-lstm__one" />
        <text x={336} y={114} textAnchor="middle" className="dl4s-tick">1 − z = {f3(1 - s.z[0])}</text>
        <path d="M382 110 H430" className="dl4s-wire" />
        <Arrowhead x={430} y={110} dir="right" s={5} />
        <g className="dl4s-op"><circle cx={440} cy={110} r={10} /><path d="M434 104 L446 116 M446 104 L434 116" /></g>
        <line x1={440} y1={99} x2={440} y2={84} className="dl4s-wire" />
        <Arrowhead x={440} y={83} s={5} />
        <text x={452} y={94} className="dl4s-lstm__val">add {f3(s.add[0])}</text>
        {/* g layer */}
        <rect x={416} y={150} width={48} height={28} rx={3} className="dl4s-lstm__fc" />
        <rect x={416} y={150} width={48} height={6} className="dl4s-lstm__band dl4s-lstm__band--tanh" />
        <text x={440} y={171} textAnchor="middle" className="dl4s-tick">FC</text>
        <text x={470} y={170} className="dl4s-svg__label dl4s-svg__label--ink">g(t) {f3(s.g[0])}</text>
        <line x1={440} y1={150} x2={440} y2={121} className="dl4s-wire" />
        <Arrowhead x={440} y={121} s={5} />
        {/* x(t) into the three FC layers */}
        <line x1={330} y1={282} x2={330} y2={236} className="dl4s-wire dl4s-wire--x" />
        <text x={338} y={280} className="dl4s-svg__label dl4s-svg__label--x">x(t) = [{s.x[0]}, {s.x[1]}]</text>
        {[160, 250, 440].map((cx, k) => <line key={k} x1={330} y1={236} x2={cx + 8} y2={k === 2 ? 178 : 211} className="dl4s-fan4 dl4s-fan4--x" />)}
        {[160, 250].map((cx) => <line key={`h${cx}`} x1={250} y1={226} x2={cx - 8} y2={211} className="dl4s-fan4 dl4s-fan4--h" />)}
      </svg>
    </div>
  );
}

export function GruLab() {
  const seq = useSequence();
  const [t, setT] = useState(1);
  const [units, setUnits] = useState(20);
  const [resetAfter, setResetAfter] = useState(true);
  const gru = useMemo(() => runGru(seq.xs), [seq.xs]);
  const lstm = useMemo(() => runLstm(seq.xs, null), [seq.xs]);
  const s = gru[t];
  const slideOrder = s.rh[0] * GRU_W.Whg[0][0]; // (r ⊗ h) W_hg — Figure 15-13's order
  const typedOrder = s.r[0] * GRU_W.Whg[0][0] * s.hPrev[0]; // (r W_hg) ⊗ h — slide 49 as typeset
  const gP = gruParams(units, 1, resetAfter);
  const dP = denseParams(units, 1);
  const isSlide = units === 20 && resetAfter;

  return (
    <Lab
      title="Figure 15-13 live · the GRU, next to the LSTM"
      slides="slides 48–49"
      tryThis="run the same sequence: before looking at the GRU’s output row, predict whether the stored signal shows up before the read step — with no output gate, the full state is output every step. Then switch reset_after off and predict the parameter count."
    >
      <div className="dl-lab__controls">
        <div className="dl4s-stepper" role="group" aria-label="Time step">
          {Array.from({ length: T }, (_, k) => (
            <button key={k} type="button" className={`dl-chip${k === t ? ' dl-chip--on' : ''}`} aria-pressed={k === t} onClick={() => setT(k)}>t = {k}</button>
          ))}
        </div>
      </div>
      <GruFigure s={s} t={t} />
      <div className="dl4s-tl4" role="group" aria-label="The same sequence through the GRU and the LSTM">
        <TimeHead cur={t} onPick={setT} />
        <SeqRow label="signal" vals={seq.signal} onFlip={(k) => seq.flip('signal', k)} cur={t} kind="x" />
        <SeqRow label="read" vals={seq.read} onFlip={(k) => seq.flip('read', k)} cur={t} kind="x" />
        <BarRow label="GRU z (keep)" vals={gru.map((r) => r.z[0])} cur={t} kind="gate" onPick={setT} />
        <BarRow label="GRU h = ŷ" vals={gru.map((r) => r.h[0])} cur={t} kind="h" onPick={setT} signed />
        <BarRow label="LSTM c" vals={lstm.map((r) => r.c[0])} cur={t} kind="c" onPick={setT} signed />
        <BarRow label="LSTM h = ŷ" vals={lstm.map((r) => r.h[0])} cur={t} kind="h" onPick={setT} signed />
      </div>
      <div className="dl4s-gruorder">
        <p className="dl4s-stagehead">The g line at t = {t}</p>
        <Tex block src={`\\text{Figure 15-13: } \\big(\\mathbf{r}_{(t)} \\otimes \\mathbf{h}_{(t-1)}\\big)^{\\top}\\mathbf{W}_{hg} = (${num(s.r[0])} \\times ${num(s.hPrev[0])}) \\times ${GRU_W.Whg[0][0]} = ${num(slideOrder)}`} />
        <Tex block src={`\\text{slide 49, read left to right: } \\mathbf{r}^{\\top}_{(t)}\\mathbf{W}_{hg} \\otimes \\mathbf{h}^{\\top}_{(t-1)} = (${num(s.r[0])} \\times ${GRU_W.Whg[0][0]}) \\times ${num(s.hPrev[0])} = ${num(typedOrder)}`} />
        <p className="dl4s-cap">With one unit these are the same number — order doesn’t matter for scalars. With n units they differ, because W_hg mixes the units before (slide) or after (figure) the gate is applied; see the Slide check above. This lab computes the figure’s order.</p>
      </div>
      <table className="dl-table dl4s-vs">
        <thead><tr><th /><th>LSTM (slides 42–47)</th><th>GRU (slides 48–49)</th></tr></thead>
        <tbody>
          <tr><td>state vectors</td><td>two: h (short-term), c (long-term)</td><td>one: h</td></tr>
          <tr><td>FC layers</td><td>four: f, i, o (σ) and g (tanh)</td><td>three: z, r (σ) and g (tanh)</td></tr>
          <tr><td>forget / input</td><td>two gates, f and i</td><td>one controller, z (1 − z for the input)</td></tr>
          <tr><td>output gate</td><td>yes, o</td><td>no — the full state is output every step</td></tr>
          <tr><td>slide model</td><td><code>LSTM(12)</code> + Dense(1): 685 · MAE 30,262</td><td><code>GRU(20)</code> + Dense(1): 1,401 · MAE 26,497</td></tr>
        </tbody>
      </table>
      <div className="dl4s-count4">
        <div className="dl-lab__controls">
          <div className="dl-sliders"><Range label="GRU units" value={units} min={1} max={40} onChange={setUnits} fmt={(v) => `${v}${v === 20 ? ' (slide 49)' : ''}`} /></div>
          <Chips label="biases per FC layer" value={resetAfter} options={[{ v: true, l: 'two — Keras default, reset_after=True (it also applies r after h·W_hg)' }, { v: false, l: 'one — as slide 49’s equations' }]} onChange={setResetAfter} />
        </div>
        <p className="dl4s-total">
          3 × ({units}×1 + {units}×{units} + {resetAfter ? `2×${units}` : units}) = <b>{fmtInt(gP)}</b> · Dense(1): <b>{dP}</b> · total <b>{fmtInt(gP + dP)}</b>
        </p>
        <p className="dl4s-cap">
          {isSlide ? <><span className="dl4s-dot dl4s-dot--y" />= slide 49’s “# Number of trainable parameters: 1401”. </> : 'This page’s count. '}
          The two-bias detail is Keras’s, not the slides’ — an aside that explains how 1,401 is reached.
        </p>
      </div>
    </Lab>
  );
}
