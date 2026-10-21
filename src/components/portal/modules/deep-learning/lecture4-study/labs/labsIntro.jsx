import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { Lab, Chips, Range, Stat } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { ROADMAP } from '../slideData';
import { ACT, randMatrix, rnnForward, fmtSigned, signClass as valClass } from '../rnn';
import { Neuron, Arrowhead } from './parts';
import { useReducedMotion } from '../hooks';
import './labsIntro.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §0 AND §1
     RoadmapLab   slide 3's ten topics, wired to the sections that teach them
     NeuronLab    Figure 15-1 live: one recurrent neuron with its three
                  weights, stepped through an input sequence, rolled ↔
                  unrolled, any length — the same three weights every step
     LayerLab     Figure 15-2 live: a layer of recurrent neurons, where every
                  neuron sees the whole input vector and the whole previous
                  output vector; unrolled over three steps with real values
   The weights in these labs are this page's own small numbers (the slides
   give none); everything shown is computed from them live.
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

/* ── §0 · the roadmap ─────────────────────────────────────────────────────── */
export function RoadmapLab() {
  const { stats, jumpTo } = useStudy();
  return (
    <Lab
      title="Slide 3’s roadmap, mapped onto this page"
      slides="slide 3"
      tryThis="click a section chip to jump to it — the bar beside each topic fills as you tick off that topic’s notebook lines."
    >
      <ol className="dl4s-road">
        {ROADMAP.map((t, i) => {
          const done = t.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = t.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={t.topic} className="dl4s-road__item">
              <span className="dl4s-road__no" aria-hidden="true">{i + 1}</span>
              <span className="dl4s-road__topic">{t.topic}</span>
              <span className="dl4s-road__prog" aria-label={`${done} of ${total} notebook lines copied`}>
                <span className="dl4s-road__track"><span className="dl4s-road__fill" style={{ width: `${pct}%` }} /></span>
                <span className="dl4s-road__pct">{done}/{total}</span>
              </span>
              <span className="dl4s-road__secs">
                {t.secs.filter((id) => SEC[id]).map((id) => (
                  <button key={id} type="button" className="dl4s-secchip" onClick={() => jumpTo(id)}>
                    <b>§{SEC[id].no}</b> {SEC[id].short}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="dl4s-cap">
        Not on slide 3: <button type="button" className="dl4s-link" onClick={() => jumpTo('s14')}>§14 GRU cells</button> (slides 48–49, listed above with the LSTM it simplifies), the forecasting thread’s <button type="button" className="dl4s-link" onClick={() => jumpTo('s15')}>§15 1D convolutions</button> (slide 50), and{' '}
        <button type="button" className="dl4s-link" onClick={() => jumpTo('s16')}>§16 Summary</button> (slides 51–52). The title says “RNNs and CNNs”; the CNN part is that one slide.
      </p>
    </Lab>
  );
}

/* ── §1 · one recurrent neuron (Figure 15-1) ─────────────────────────────── */
const X_PRESETS = {
  pulse: { l: 'one pulse at t = 0', f: (t) => (t === 0 ? 1 : 0) },
  steady: { l: 'steady 0.5', f: () => 0.5 },
  zigzag: { l: 'alternating ±1', f: (t) => (t % 2 ? -1 : 1) },
};
const X_STEPS = [-1, -0.5, 0, 0.5, 1];

export function NeuronLab() {
  const reduced = useReducedMotion();
  const { printing } = useStudy();
  const [T, setT] = useState(4); // Figure 15-1 unrolls x(0)…x(3)
  const [preset, setPreset] = useState('pulse');
  const [xs, setXs] = useState(() => Array.from({ length: 8 }, (_, t) => X_PRESETS.pulse.f(t)));
  const [wx, setWx] = useState(0.8);
  const [wy, setWy] = useState(0.6);
  const [b, setB] = useState(0);
  const [act, setAct] = useState('tanh');
  const [view, setView] = useState('unrolled');
  const [t, setT0] = useState(0); // the step being computed
  const [playing, setPlaying] = useState(false);

  const steps = useMemo(() => {
    const out = [];
    let prev = 0;
    for (let k = 0; k < T; k++) {
      const a = wx * xs[k] + wy * prev + b;
      const y = ACT[act](a);
      out.push({ x: xs[k], prev, a, y });
      prev = y;
    }
    return out;
  }, [T, xs, wx, wy, b, act]);
  const at = Math.min(t, T - 1);
  // printed at its last step: every output computed
  const cur = printing ? T - 1 : at;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setTimeout(() => {
      if (at >= T - 1) setPlaying(false);
      else setT0(at + 1);
    }, reduced ? 80 : 650);
    return () => clearTimeout(id);
  }, [playing, at, T, reduced]);

  const pickPreset = (p) => {
    setPreset(p);
    setXs(Array.from({ length: 8 }, (_, k) => X_PRESETS[p].f(k)));
  };
  const nudge = (k, dir) => {
    setPreset('custom');
    setXs((prev) => prev.map((v, i) => {
      if (i !== k) return v;
      const at = X_STEPS.indexOf(v);
      return X_STEPS[Math.max(0, Math.min(X_STEPS.length - 1, (at < 0 ? 2 : at) + dir))];
    }));
  };

  // ── geometry
  const W = 560;
  const gap = Math.min(118, (W - 120) / Math.max(T, 1));
  const x0 = 78;
  const cy = 112;
  const cxOf = (k) => x0 + k * gap;
  const s = steps[cur];

  return (
    <Lab
      title="Figure 15-1 live · one recurrent neuron"
      slides="slide 5"
      tryThis="with the default single pulse, predict ŷ(1) before stepping — x(1) is 0, so is ŷ(1)? Step through and notice the neuron still carries x(0) forward through its own output; then drag the length to 8: the same three weights do every step."
    >
      <div className="dl-lab__controls">
        <Chips label="view" value={view} options={[{ v: 'unrolled', l: 'unrolled through time' }, { v: 'rolled', l: 'rolled (the loop)' }]} onChange={setView} />
        <Chips label="input sequence" value={preset} options={[...Object.entries(X_PRESETS).map(([v, o]) => ({ v, l: o.l })), ...(preset === 'custom' ? [{ v: 'custom', l: 'your own' }] : [])]} onChange={(p) => (p === 'custom' ? null : pickPreset(p))} />
        <Chips label="activation φ" value={act} options={[{ v: 'tanh', l: 'tanh' }, { v: 'relu', l: 'ReLU' }]} onChange={setAct} />
        <div className="dl-sliders">
          <Range label="length (time steps)" value={T} min={1} max={8} onChange={(v) => { setT(v); setT0((x) => Math.min(x, v - 1)); }} />
          <Range label="w_x (input weight)" value={wx} min={-1.5} max={1.5} step={0.1} onChange={setWx} fmt={(v) => v.toFixed(1)} />
          <Range label="w_ŷ (fed-back weight)" value={wy} min={-1.5} max={1.5} step={0.1} onChange={setWy} fmt={(v) => v.toFixed(1)} />
          <Range label="b (bias)" value={b} min={-1} max={1} step={0.1} onChange={setB} fmt={(v) => v.toFixed(1)} />
        </div>
      </div>

      <div className="dl4s-neuron__stage dl4s-wide">
        {view === 'unrolled' ? (
          <svg viewBox={`0 0 ${W} 232`} className="dl4s-svg" role="img" aria-label={`One recurrent neuron unrolled over ${T} time steps; step ${cur} is being computed`}>
            {/* the initial 0 */}
            <text x={22} y={cy + 52} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--ink">0</text>
            <path d={`M30 ${cy + 48} C${cxOf(0) - 34} ${cy + 48} ${cxOf(0) - 14} ${cy + 48} ${cxOf(0) - 8} ${cy + 19}`} className="dl4s-wire" />
            <Arrowhead x={cxOf(0) - 8} y={cy + 18} />
            {steps.map((st, k) => {
              const cx = cxOf(k);
              const state = k < cur ? 'done' : k === cur ? 'on' : 'off';
              return (
                <g key={k} className={`dl4s-step dl4s-step--${state}`}>
                  {/* input below */}
                  <line x1={cx + 6} y1={cy + 62} x2={cx + 6} y2={cy + 19} className="dl4s-wire dl4s-wire--x" />
                  <Arrowhead x={cx + 6} y={cy + 18} className="dl4s-ah dl4s-ah--x" />
                  <text x={cx + 6} y={cy + 80} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">x({k})</text>
                  <text x={cx + 6} y={cy + 95} textAnchor="middle" className={`dl4s-tick ${valClass(st.x)}`}>{fmtSigned(st.x, 1)}</text>
                  {/* output above */}
                  <line x1={cx} y1={cy - 18} x2={cx} y2={cy - 62} className="dl4s-wire dl4s-wire--y" />
                  <Arrowhead x={cx} y={cy - 63} className="dl4s-ah dl4s-ah--y" />
                  <text x={cx} y={cy - 84} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--y">ŷ({k})</text>
                  <text x={cx} y={cy - 70} textAnchor="middle" className={`dl4s-tick ${k <= cur ? valClass(st.y) : ''}`}>{k <= cur ? fmtSigned(st.y, 3) : '?'}</text>
                  {/* fed back into the next copy */}
                  {k < T - 1 ? (
                    <>
                      <path d={`M${cx + 4} ${cy - 18} C${cx + 4} ${cy - 46} ${cx + gap * 0.5} ${cy - 46} ${cx + gap * 0.5} ${cy} S${cx + gap - 8} ${cy + 48} ${cx + gap - 8} ${cy + 19}`} className="dl4s-wire dl4s-wire--loop" />
                      <Arrowhead x={cx + gap - 8} y={cy + 18} className="dl4s-ah dl4s-ah--loop" />
                    </>
                  ) : (
                    <path d={`M${cx + 4} ${cy - 18} C${cx + 4} ${cy - 46} ${cx + 40} ${cy - 46} ${cx + 40} ${cy}`} className="dl4s-wire dl4s-wire--loop dl4s-wire--dash" />
                  )}
                  <Neuron cx={cx} cy={cy} act={act} state={state} />
                </g>
              );
            })}
            {/* the time axis */}
            <line x1={x0 - 30} y1={222} x2={cxOf(T - 1) + 46} y2={222} className="dl4s-time" />
            <Arrowhead x={cxOf(T - 1) + 48} y={222} dir="right" s={6} className="dl4s-time__head" />
            <text x={cxOf(T - 1) + 54} y={226} className="dl4s-svg__label dl4s-svg__label--ink">Time</text>
          </svg>
        ) : (
          <svg viewBox="0 0 560 232" className="dl4s-svg" role="img" aria-label={`The rolled neuron at time step ${cur}: input ${s.x}, fed-back output ${s.prev.toFixed(3)}, output ${s.y.toFixed(3)}`}>
            <line x1={240} y1={196} x2={240} y2={134} className="dl4s-wire dl4s-wire--x" />
            <Arrowhead x={240} y={133} className="dl4s-ah dl4s-ah--x" />
            <text x={240} y={214} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">x = x({cur}) = {fmtSigned(s.x, 1)}</text>
            <line x1={232} y1={78} x2={232} y2={26} className="dl4s-wire dl4s-wire--y" />
            <Arrowhead x={232} y={25} className="dl4s-ah dl4s-ah--y" />
            <text x={222} y={22} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--y">ŷ = ŷ({cur}) = {fmtSigned(s.y, 3)}</text>
            <path d="M246 78 C246 44 330 44 330 104 S288 176 252 134" className="dl4s-wire dl4s-wire--loop" />
            <Arrowhead x={252} y={133} className="dl4s-ah dl4s-ah--loop" />
            <text x={338} y={108} className="dl4s-svg__label dl4s-svg__label--loop">fed back: ŷ({cur - 1 < 0 ? '−1' : cur - 1}) = {fmtSigned(s.prev, 3)}</text>
            <Neuron cx={236} cy={106} r={27} act={act} />
          </svg>
        )}
      </div>

      <div className="dl4s-neuron__run">
        <div className="dl4s-stepper" role="group" aria-label="Time step">
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setT0(0); }} aria-label="Back to t = 0"><Icon name="skipBack" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setT0((v) => Math.max(0, v - 1)); }} disabled={cur === 0} aria-label="Previous step"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { if (reduced) { setT0(T - 1); return; } if (cur >= T - 1) setT0(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play through the sequence'}><Icon name={playing ? 'pause' : 'play'} size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { setPlaying(false); setT0((v) => Math.min(T - 1, v + 1)); }} disabled={cur >= T - 1} aria-label="Next step"><Icon name="arrowRight" size={14} /></button>
          <span className="dl4s-stepper__t">t = <b>{cur}</b> of {T - 1}</span>
        </div>
        <div className="dl4s-xedit" role="group" aria-label="Edit the inputs">
          {Array.from({ length: T }, (_, k) => (
            <span key={k} className={`dl4s-xedit__cell${k === cur ? ' dl4s-xedit__cell--on' : ''}`}>
              <button type="button" onClick={() => nudge(k, 1)} aria-label={`Raise x(${k})`}>+</button>
              <b className={valClass(xs[k])}>{fmtSigned(xs[k], 1)}</b>
              <button type="button" onClick={() => nudge(k, -1)} aria-label={`Lower x(${k})`}>−</button>
              <small>x({k})</small>
            </span>
          ))}
        </div>
      </div>

      <p className="dl4s-readout dl4s-mono" aria-live="polite">
        ŷ({cur}) = {act}(w_x·x({cur}) + w_ŷ·ŷ({cur - 1 < 0 ? '−1' : cur - 1}) + b) = {act}({wx.toFixed(1)} × {fmtSigned(s.x, 1)} + {wy.toFixed(1)} × {fmtSigned(s.prev, 3)}
        {' + '}{b.toFixed(1)}) = {act}({fmtSigned(s.a, 3)}) = <b>{fmtSigned(s.y, 3)}</b>
      </p>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="parameters" v="3" sub="w_x, w_ŷ and b — reused at every step" tone="accent" />
        <Stat k="time steps" v={T} sub={`${T} copies drawn, still 3 parameters`} />
        <Stat k={`ŷ(${T - 1}), the last output`} v={fmtSigned(steps[T - 1].y, 3)} sub="depends on every input before it" />
      </div>
      <p className="dl4s-cap">
        This page’s own weights, not trained ones — the slides draw the neuron but give no numbers. Each copy in the unrolled view is the same neuron at a
        later time step: its output goes up as ŷ(t) and over into the next copy, and the first copy is fed 0.
      </p>
    </Lab>
  );
}

/* ── §1 · a layer of recurrent neurons (Figure 15-2) ─────────────────────── */
const LAYER_SEED = 4155;
const XS3 = [
  [0.9, -0.2, 0.4, 0.1],
  [0.1, 0.7, -0.5, 0.3],
  [-0.4, 0.2, 0.8, -0.6],
];

export function LayerLab() {
  const [nIn, setNIn] = useState(4);
  const [nN, setNN] = useState(5); // Figure 15-2 draws five neurons
  const [pick, setPick] = useState(2);
  const sel = Math.min(pick, nN - 1);

  const params = useMemo(() => ({
    Wx: randMatrix(nIn, nN, LAYER_SEED + nIn * 13 + nN, 0.9),
    Wh: randMatrix(nN, nN, LAYER_SEED + 7 + nN, 0.6),
    bh: Array.from({ length: nN }, () => 0),
    phi: 'tanh',
  }), [nIn, nN]);
  const xs = useMemo(() => XS3.map((r) => r.slice(0, nIn)), [nIn]);
  const run = useMemo(() => rnnForward(xs, params), [xs, params]);

  // left: the rolled layer
  const LW = 300;
  const span = LW - 70;
  const nx = (j) => 35 + (span * (j + 0.5)) / nN;
  const xx = (i) => 35 + (span * (i + 0.5)) / nIn;
  const r = Math.min(17, span / nN / 2.4);

  return (
    <Lab
      title="Figure 15-2 live · a layer of recurrent neurons"
      slides="slide 6"
      tryThis="click a neuron: it is wired to every input and to every previous output. Predict how many weights that is before reading the count, then change the input size and watch only one part of the count move."
    >
      <div className="dl-lab__controls">
        <Chips label="input size" value={nIn} options={[1, 2, 3, 4]} onChange={setNIn} />
        <Chips label="neurons" value={nN} options={[{ v: 1, l: '1 (output is a scalar)' }, 3, { v: 5, l: '5 (Figure 15-2)' }]} onChange={setNN} />
      </div>

      <div className="dl4s-layer">
        <svg viewBox={`0 0 ${LW} 250`} className="dl4s-svg dl4s-layer__rolled" role="img" aria-label={`A layer of ${nN} recurrent neurons; neuron ${sel + 1} receives ${nIn} inputs and ${nN} previous outputs`}>
          <rect x={18} y={84} width={span + 34} height={64} rx={8} className="dl4s-layer__box" />
          {/* feedback: ŷ goes round the right-hand side and back into every neuron */}
          <path d={`M${LW / 2} 46 H${LW - 14} V196 H${nx(nN - 1) + 30}`} className="dl4s-wire dl4s-wire--loop" />
          {Array.from({ length: nN }, (_, j) => (
            <line key={`fb${j}`} x1={nx(nN - 1) + 30} y1={196} x2={nx(j) + r * 0.45} y2={116 + r} className={`dl4s-fan dl4s-fan--y${j === sel ? ' dl4s-fan--on' : ''}`} />
          ))}
          {Array.from({ length: nIn }, (_, i) =>
            Array.from({ length: nN }, (_, j) => (
              <line key={`x${i}${j}`} x1={xx(i)} y1={222} x2={nx(j) - r * 0.45} y2={116 + r} className={`dl4s-fan dl4s-fan--x${j === sel ? ' dl4s-fan--on' : ''}`} />
            )),
          )}
          {Array.from({ length: nN }, (_, j) => (
            <g key={j} className="dl4s-layer__pick" onClick={() => setPick(j)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(j); } }} tabIndex={0} role="button" aria-pressed={j === sel} aria-label={`Neuron ${j + 1}`}>
              <line x1={nx(j)} y1={116 - r} x2={nx(j)} y2={62} className="dl4s-wire" />
              <Neuron cx={nx(j)} cy={116} r={r} state={j === sel ? 'on' : 'done'} />
            </g>
          ))}
          <line x1={nx(0)} y1={62} x2={nx(nN - 1)} y2={62} className="dl4s-wire" />
          <line x1={LW / 2} y1={62} x2={LW / 2} y2={30} className="dl4s-wire dl4s-wire--y" />
          <Arrowhead x={LW / 2} y={29} className="dl4s-ah dl4s-ah--y" />
          <text x={LW / 2 + 8} y={26} className="dl4s-svg__label dl4s-svg__label--y">ŷ ({nN === 1 ? 'a scalar' : `a vector of ${nN}`})</text>
          {Array.from({ length: nIn }, (_, i) => <circle key={i} cx={xx(i)} cy={226} r={3.4} className="dl4s-xdot" />)}
          <text x={LW / 2} y={246} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">x ({nIn === 1 ? 'a scalar' : `a vector of ${nIn}`})</text>
        </svg>

        <div className="dl4s-layer__side">
          <p className="dl4s-stagehead">Neuron {sel + 1}’s connections</p>
          <ul className="dl4s-layer__count">
            <li><span className="dl4s-dot dl4s-dot--x" /> {nIn} input weight{nIn > 1 ? 's' : ''} — one per entry of x(t)</li>
            <li><span className="dl4s-dot dl4s-dot--h" /> {nN} recurrent weight{nN > 1 ? 's' : ''} — one per entry of ŷ(t−1)</li>
            <li><span className="dl4s-dot" /> 1 bias</li>
          </ul>
          <p className="dl4s-total">per neuron: <b>{nIn + nN + 1}</b> · whole layer: {nN} × {nIn + nN + 1} = <b>{nN * (nIn + nN + 1)}</b></p>
          <p className="dl4s-stagehead">Unrolled over 3 steps — real values</p>
          <div className="dl4s-layer__unroll" role="img" aria-label="The layer's output vector at time steps 0, 1 and 2">
            {run.map((st, k) => (
              <div key={k} className="dl4s-layer__t">
                <span className="dl4s-layer__lab">ŷ({k})</span>
                <span className="dl4s-vec">
                  {st.h.map((v, j) => (
                    <i key={j} className={j === sel ? 'dl4s-vec__on' : ''} style={{ '--v': v }} title={v.toFixed(3)}>{v.toFixed(2)}</i>
                  ))}
                </span>
                <span className="dl4s-layer__lab dl4s-layer__lab--x">x({k})</span>
                <span className="dl4s-vec dl4s-vec--x">
                  {st.x.map((v, i) => <i key={i} style={{ '--v': v }}>{v.toFixed(1)}</i>)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="dl4s-cap">
        Every neuron receives the whole input vector x(t) and the whole previous output vector (slide 6 writes y(t−1); Figure 15-2 labels the output ŷ), with this page’s own small weights and tanh.
        Step 0 is fed a zero vector as its previous output, as in the figure.
      </p>
    </Lab>
  );
}

