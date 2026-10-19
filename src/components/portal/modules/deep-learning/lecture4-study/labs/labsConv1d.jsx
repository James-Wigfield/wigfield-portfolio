import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { useReducedMotion } from '../hooks';
import { RIDERSHIP } from '../data/ridership';
import { CNN_GRU_CODE, SLIDE_PARAMS, MULVAR_COLUMNS } from '../slideData';
import { conv1d, conv1dLen, conv1dParams, gruParams, denseParams, relu, fmtInt, fmtSigned, signClass, dayIndex, isoAt, mulberry32 } from '../rnn';
import { Arrowhead } from './parts';
import './labsConv1d.css';

/* ============================================================================
   LECTURE 4 STUDY — LAB FOR §15 (slide 50)
     Conv1DLab   two parts behind a switch:
       A  one Conv1D layer stepped window by window over 14 real days of
          rail ridership: kernel_size 3, strides 1 or 2, "valid" padding,
          ReLU. Each window shows its three products, + bias, ReLU. 1–10
          filters stack into a time × filters grid — slide 50's "10 1D
          sequences … or a single 10D sequence".
       B  cnn_gru_model's shape flow and parameter counts for any sequence
          length (56 = slide 20's seq_length), 1 or 5 input features (the
          slide's exercise), and the GRU bias question that makes 1,283.
   Slide 50 prints only the TOTAL (1283), the layer arguments and the prose.
   Every per-layer count, length and shape here is this page's computation;
   the filter weights in A are this page's own (a trained layer learns its).
   ========================================================================== */

const K = 3; // kernel_size of both Conv1D layers on slide 50
const DAYS = 14;
const FROM = '2019-04-01'; // a Monday inside slide 20's validation months
const I0 = dayIndex(RIDERSHIP.start, FROM);
// ÷ 1e6 as slide 20 scales the series, then rounded to 2 decimals so that
// every product and sum below is exact at 3 decimals
const SEQ = Array.from({ length: DAYS }, (_, k) => {
  const iso = isoAt(RIDERSHIP.start, I0 + k);
  return { iso, label: dayLabel(iso), v: Math.round(RIDERSHIP.rail[I0 + k] / 1e4) / 100 };
});
const XS = SEQ.map((d) => d.v);
const MAX_F = 10;
const DEFAULT_FILTERS = filterBank(MAX_F, 5017);

/* ── the lab ──────────────────────────────────────────────────────────────── */
export function Conv1DLab() {
  const seeB = () => document.getElementById('dl4s-c1d-b')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return (
    <Lab
      title="Slide 50 live · one Conv1D layer, window by window"
      slides="slide 50"
      tryThis="before switching strides from 1 to 2, predict the output length for 14 inputs, then check it against ⌊(n − k)/s⌋ + 1."
    >
      <PartA active onSeeB={seeB} />
    </Lab>
  );
}

export function CnnGruLab() {
  return (
    <div id="dl4s-c1d-b" className="dl4s-c1d-anchor">
      <Lab
        title="Slide 50 · cnn_gru_model, shape by shape"
        slides="slide 50 · n = 56 from slide 20"
        tryThis="predict cnn_gru_model’s sequence length after both Conv1D layers for a 56-day input; then drag n and notice which numbers never move."
      >
        <PartB active />
      </Lab>
    </div>
  );
}

/* ── A · one Conv1D layer, window by window ──────────────────────────────── */
// SVG geometry (viewBox units)
const W = 640;
const LX = 76; // left gutter for the row labels
const CW = 39; // one input day
const cxOf = (k) => LX + (k + 0.5) * CW;
const VMAX = Math.max(...XS) * 1.08;
const BASE = 70; // baseline of the input bars
const OY = 182; // top of the output cells

function PartA({ active, onSeeB }) {
  const reduced = useReducedMotion();
  const [stride, setStride] = useState(1);
  const [nF, setNF] = useState(8); // slide 50’s first Conv1D has filters=8
  const [pick, setPick] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const L = conv1dLen(DAYS, K, stride);
  const cur = Math.min(pos, L - 1);
  const f = Math.min(pick, nF - 1);
  const F = filters[f];
  const map = useMemo(() => convMap(XS, filters.slice(0, nF), stride), [filters, nF, stride]);
  const yMax = Math.max(1e-9, ...map.flat().map((o) => o.y));
  const st = cur * stride; // the window's first day
  const terms = F.w.map((w, j) => ({ w, x: XS[st + j], p: round3(w * XS[st + j]) }));
  const out = map[f][cur];

  // play: one window per tick. Reduced motion → no timer at all (the play
  // button jumps straight to the last window instead).
  const running = playing && active && !reduced;
  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => {
      if (cur >= L - 1) setPlaying(false);
      else setPos(cur + 1);
    }, 750);
    return () => clearTimeout(id);
  }, [running, cur, L]);

  // narrow widths: the drawing and the grid scroll sideways inside the lab,
  // so keep the window and the current column in view (DOM scroll only)
  const stageRef = useRef(null);
  const fmapRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const behavior = reduced ? 'auto' : 'smooth';
    const stage = stageRef.current;
    if (stage && stage.scrollWidth > stage.clientWidth + 1) {
      const k = stage.scrollWidth / W; // px per viewBox unit
      const mid = (LX + (cur * stride + 1.5) * CW) * k;
      stage.scrollTo({ left: Math.max(0, mid - stage.clientWidth / 2), behavior });
    }
    const fm = fmapRef.current;
    const col = fm?.querySelector('[aria-pressed="true"]');
    if (fm && col && fm.scrollWidth > fm.clientWidth + 1) {
      fm.scrollTo({ left: Math.max(0, col.offsetLeft - fm.clientWidth / 2 + col.offsetWidth / 2), behavior });
    }
  }, [active, cur, stride, reduced]);

  const stop = () => setPlaying(false);
  const onPlay = () => {
    if (reduced) { setPos(L - 1); return; }
    if (running) { setPlaying(false); return; }
    if (cur >= L - 1) setPos(0);
    setPlaying(true);
  };
  const nudge = (j, d) => {
    setFilters((all) => all.map((g, i) => {
      if (i !== f) return g;
      if (j === 3) return { ...g, b: clamp2(round1(g.b + d / 10)), edited: true };
      return { ...g, w: g.w.map((v, k) => (k === j ? clamp2(round1(v + d / 10)) : v)), edited: true };
    }));
  };
  const resetF = () => setFilters((all) => all.map((g, i) => (i === f ? DEFAULT_FILTERS[i] : g)));

  const params = conv1dParams(nF, K, 1);
  const midX = cxOf(st + 1);
  const sumLeft = st + 1 > 8; // put the "Σ + b → ReLU" note left of the arrow near the right edge

  return (
    <div className="dl4s-c1d" hidden={!active}>
      <div className="dl-lab__controls">
        <Chips label="strides" value={stride} options={[{ v: 1, l: 'strides=1 (slide 50’s first Conv1D)' }, { v: 2, l: 'strides=2 (its second)' }]} onChange={(v) => { setStride(v); setPos(0); stop(); }} />
        <div className="dl-sliders">
          <Range label="filters (kernels)" value={nF} min={1} max={MAX_F} onChange={(v) => { setNF(v); stop(); }} fmt={(v) => (v === 8 ? '8 (slide 50’s first Conv1D)' : v === 10 ? '10 (slide 50’s example)' : String(v))} width="16rem" />
        </div>
        <Chips label="step filter" value={f} options={Array.from({ length: nF }, (_, i) => ({ v: i, l: String(i + 1) }))} onChange={setPick} />
        <div className="dl-ctl dl4s-ctl" role="group" aria-label={`Filter ${f + 1}'s weights and bias`}>
          <span className="dl-ctl__label">filter {f + 1} weights</span>
          <div className="dl4s-c1d-wedit">
            {['w₁', 'w₂', 'w₃', 'b'].map((lab, j) => {
              const v = j === 3 ? F.b : F.w[j];
              return (
                <span key={lab} className="dl4s-c1d-wedit__cell">
                  <small>{lab}</small>
                  <button type="button" onClick={() => nudge(j, -1)} aria-label={`Lower ${lab === 'b' ? 'the bias' : `weight ${j + 1}`} of filter ${f + 1}`}>−</button>
                  <b className={signClass(v)}>{fmtSigned(v, 1)}</b>
                  <button type="button" onClick={() => nudge(j, 1)} aria-label={`Raise ${lab === 'b' ? 'the bias' : `weight ${j + 1}`} of filter ${f + 1}`}>+</button>
                </span>
              );
            })}
            <button type="button" className="dl-btn" onClick={resetF} disabled={!F.edited}>reset</button>
          </div>
        </div>
        <p className="dl4s-c1d-static">
          kernel_size=3 · padding=&quot;valid&quot; (Keras’s default — slide 50’s layers set no padding, so the window never leaves the sequence) · activation=&quot;relu&quot;
        </p>
      </div>

      <p className="dl4s-stagehead">
        Input · real rail riders, Mon 1 – Sun 14 Apr 2019 (validation months), ÷ 1e6 as on slide 20, rounded to 2 dp
      </p>
      <div className="dl4s-c1d-stage" ref={stageRef}>
        <svg
          viewBox={`0 0 ${W} 228`}
          className="dl4s-svg"
          role="img"
          aria-label={`A kernel of size 3 on window ${cur} (days ${st} to ${st + 2}), stride ${stride}: filter ${f + 1} gives ${fmtSigned(out.z, 3)} before ReLU and ${out.y.toFixed(3)} after. ${L} outputs in all.`}
        >
          {/* row labels */}
          <text x={LX - 8} y={84} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--x">rail ÷ 1e6</text>
          <text x={LX - 8} y={97} textAnchor="end" className="dl4s-svg__label">Apr 2019</text>
          <text x={LX - 8} y={110} textAnchor="end" className="dl4s-svg__label">input</text>
          <text x={LX - 8} y={134} textAnchor="end" className="dl4s-svg__label">w (filter {f + 1})</text>
          <text x={LX - 8} y={150} textAnchor="end" className="dl4s-svg__label">w × x</text>
          <text x={LX - 8} y={197} textAnchor="end" className="dl4s-svg__label dl4s-c1d-lab--fm">feature map</text>
          <text x={LX - 8} y={219} textAnchor="end" className="dl4s-svg__label">after ReLU</text>

          {/* the input sequence */}
          <line x1={LX} y1={BASE} x2={LX + DAYS * CW} y2={BASE} className="dl4s-axis" />
          {SEQ.map((d, k) => {
            const inWin = k >= st && k < st + K;
            const h = (d.v / VMAX) * 58;
            return (
              <g key={d.iso}>
                <rect x={cxOf(k) - CW / 2 + 6} y={BASE - h} width={CW - 12} height={h} className={`dl4s-c1d-bar${inWin ? ' dl4s-c1d-bar--in' : ''}`} />
                <text x={cxOf(k)} y={84} textAnchor="middle" className={`dl4s-tick${inWin ? ' dl4s-c1d-val--in' : ''}`}>{d.v.toFixed(2)}</text>
                <text x={cxOf(k)} y={97} textAnchor="middle" className="dl4s-tick">{d.label}</text>
                <text x={cxOf(k)} y={110} textAnchor="middle" className="dl4s-c1d-xi">x({k})</text>
              </g>
            );
          })}
          <rect x={LX + st * CW + 1} y={3} width={K * CW - 2} height={113} rx={3} className="dl4s-win" />

          {/* the kernel under the window: weights, products, then Σ + b → ReLU */}
          {terms.map((t, j) => (
            <g key={j}>
              <text x={cxOf(st + j)} y={134} textAnchor="middle" className={`dl4s-c1d-w ${signClass(t.w)}`}>{fmtSigned(t.w, 1)}</text>
              <text x={cxOf(st + j)} y={150} textAnchor="middle" className={`dl4s-tick ${signClass(t.p)}`}>{fmtSigned(t.p, 3)}</text>
              <path d={`M${cxOf(st + j)} 156 L${midX} 165`} className="dl4s-c1d-brace" />
            </g>
          ))}
          <line x1={midX} y1={165} x2={midX} y2={OY - 2} className="dl4s-c1d-brace" />
          <Arrowhead x={midX} y={OY - 1} dir="down" s={4} className="dl4s-ah" />
          <text x={sumLeft ? midX - 8 : midX + 8} y={177} textAnchor={sumLeft ? 'end' : 'start'} className="dl4s-tick">Σ + b = {fmtSigned(out.z, 3)} → ReLU</text>

          {/* the outputs, each under the centre of its window */}
          {map[f].map((o, i) => {
            const x = cxOf(i * stride + 1);
            const done = i <= cur;
            return (
              <g key={i}>
                <rect
                  x={x - CW / 2 + 2}
                  y={OY}
                  width={CW - 4}
                  height={22}
                  rx={3}
                  className={`dl4s-c1d-ocell${done ? '' : ' dl4s-c1d-ocell--todo'}${i === cur ? ' dl4s-c1d-ocell--cur' : ''}`}
                  style={{ '--v': done ? o.y / yMax : 0 }}
                />
                <text x={x} y={OY + 15} textAnchor="middle" className={`dl4s-tick${i === cur ? ' dl4s-c1d-val--in' : ''}`}>{done ? o.y.toFixed(3) : '?'}</text>
                <text x={x} y={219} textAnchor="middle" className="dl4s-c1d-yi">y({i})</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dl4s-c1d-run">
        <div className="dl4s-stepper" role="group" aria-label="Window position">
          <button type="button" className="dl-btn" onClick={() => { stop(); setPos(0); }} aria-label="Back to the first window"><Icon name="skipBack" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { stop(); setPos(Math.max(0, cur - 1)); }} disabled={cur === 0} aria-label="Previous window"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className="dl-btn" onClick={onPlay} aria-label={reduced ? 'Show every window' : running ? 'Pause' : 'Slide the kernel along the sequence'}>
            <Icon name={running ? 'pause' : 'play'} size={14} />
          </button>
          <button type="button" className="dl-btn" onClick={() => { stop(); setPos(Math.min(L - 1, cur + 1)); }} disabled={cur >= L - 1} aria-label="Next window"><Icon name="arrowRight" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => { stop(); setPos(L - 1); }} disabled={cur >= L - 1} aria-label="Jump to the last window"><Icon name="skipForward" size={14} /></button>
          <span className="dl4s-stepper__t">window <b>{cur}</b> of {L - 1} · days {st}–{st + 2}</span>
        </div>
      </div>

      <div className="dl4s-readout dl4s-mono dl4s-c1d-eq" aria-live="polite">
        <span>y({cur}) = ReLU(w₁·x({st}) + w₂·x({st + 1}) + w₃·x({st + 2}) + b)  ·  {SEQ[st].label} – {SEQ[st + 2].label} Apr</span>
        <span>      = ReLU({terms.map((t) => `(${fmtSigned(t.w, 1)})(${t.x.toFixed(2)})`).join(' + ')} + ({fmtSigned(F.b, 1)}))</span>
        <span>      = ReLU({terms.map((t) => fmtSigned(t.p, 3)).join(' + ')} + ({fmtSigned(F.b, 1)})) = ReLU(<b className={signClass(out.z)}>{fmtSigned(out.z, 3)}</b>) = <b>{out.y.toFixed(3)}</b></span>
      </div>
      <p className="dl4s-cap">
        Filter {f + 1}: {F.edited ? 'your own weights' : F.what}. {out.z < 0 ? 'This window’s sum is negative, so ReLU outputs 0.' : 'ReLU passes a positive sum unchanged.'}
      </p>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="output length" v={L} tone="accent" sub={`⌊(n − k)/s⌋ + 1 = ⌊(${DAYS} − ${K})/${stride}⌋ + 1 = ${L}`} />
        <Stat k="output shape" v={`(None, ${L}, ${nF})`} sub={`batch, time steps, filters: ${L} steps of ${nF} value${nF > 1 ? 's' : ''} each`} />
        <Stat
          k="this layer’s parameters"
          v={params}
          sub={(
            <>
              3·1·{nF} + {nF}: one 3-weight kernel and one bias per filter (this page’s count). With 8 filters: 32, slide 50’s first Conv1D — see{' '}
              <button type="button" className="dl4s-link" onClick={onSeeB}>part B</button>.
            </>
          )}
        />
      </div>

      <div className="dl4s-c1d-out">
        <p className="dl4s-stagehead">
          Output · {nF} feature map{nF > 1 ? 's' : ''} of length {L} = one sequence of {L} vectors of {nF}
        </p>
        <div className="dl4s-c1d-fmap" ref={fmapRef}>
          <div className="dl4s-c1d-fmap__grid" style={{ gridTemplateColumns: `4.4rem repeat(${L}, minmax(2.6rem, 1fr))` }} role="group" aria-label={`Feature maps: ${nF} rows (one per filter) by ${L} time steps; columns up to ${cur} computed`}>
            <span className="dl4s-c1d-fmap__corner">filter ↓ step →</span>
            {Array.from({ length: L }, (_, i) => (
              <button key={`h${i}`} type="button" className={`dl4s-c1d-fmap__ch${i === cur ? ' dl4s-c1d-fmap__ch--on' : ''}`} onClick={() => { stop(); setPos(i); }} aria-label={`Go to window ${i}`} aria-pressed={i === cur}>
                y({i})
              </button>
            ))}
            {map.map((row, r) => (
              <FmapRow key={r} r={r} row={row} on={r === f} cur={cur} yMax={yMax} />
            ))}
          </div>
        </div>
        <p className="dl4s-cap">
          Read across: one 1D feature map per kernel, {nF} sequence{nF > 1 ? 's' : ''} all of length {L}. Read down a column: one time step’s {nF}-number vector, so the same
          output is a single {nF}D sequence — stored as ({L}, {nF}), steps × filters.
          {nF === MAX_F && ' This is slide 50’s example: “If you use 10 kernels, then the layer’s output will be composed of 10 1D sequences (all of the same length), or equivalently you can view this output as a single 10D sequence.”'}
        </p>
      </div>
    </div>
  );
}

function FmapRow({ r, row, on, cur, yMax }) {
  return (
    <>
      <span className={`dl4s-c1d-fmap__rh${on ? ' dl4s-c1d-fmap__rh--on' : ''}`}>filter {r + 1}</span>
      {row.map((o, i) => {
        const done = i <= cur;
        return (
          <i
            key={i}
            className={`dl4s-c1d-fmap__cell${done ? '' : ' dl4s-c1d-fmap__cell--todo'}${i === cur ? ' dl4s-c1d-fmap__cell--col' : ''}${on ? ' dl4s-c1d-fmap__cell--row' : ''}`}
            style={{ '--v': done ? o.y / yMax : 0 }}
            title={done ? `filter ${r + 1}, y(${i}): ReLU(${o.z.toFixed(3)}) = ${o.y.toFixed(3)}` : undefined}
          >
            {done ? o.y.toFixed(3) : '·'}
          </i>
        );
      })}
    </>
  );
}

/* ── B · cnn_gru_model, shape by shape ───────────────────────────────────── */
const TW = 250; // tensor drawing width (viewBox units); 2 units per time step
const ROLE_NAME = { x: 'input', fm: 'feature maps', h: 'GRU state', y: 'prediction' };

function PartB({ active }) {
  const [n, setN] = useState(56); // slide 20's seq_length
  const [cIn, setCIn] = useState(1);
  const [resetAfter, setResetAfter] = useState(true);
  const [sel, setSel] = useState('c1');

  const M = useMemo(() => cnnGruLayers(n, cIn, resetAfter), [n, cIn, resetAfter]);
  const kerasTotal = useMemo(() => cnnGruLayers(n, cIn, true).total, [n, cIn]);
  const code = cIn === 1 ? CNN_GRU_CODE : exerciseCode(CNN_GRU_CODE, cIn, kerasTotal);
  const hl = [lineOf(code, sel === 'total' ? '# Number' : M.layers.find((l) => l.id === sel)?.needle ?? '')].filter(Boolean);
  const matches = cIn === 1 && M.total === SLIDE_PARAMS.cnnGru;
  const [c1, c2, gru] = M.layers.slice(1);

  const work = {
    in: <>InputLayer(shape=[None, {cIn}]) has no weights. shape=[None, {cIn}] gives (time steps, dimensionality): None leaves the number of time steps open. Keras adds the batch axis in front, so the output is (None, {n}, {cIn}) — None now the batch, {n} this window’s length — matching [batch size, time steps, dimensionality] (slide 24).</>,
    c1: <>length ⌊({n} − 3)/1⌋ + 1 = <b>{M.L1}</b> (“valid”: no padding) · parameters 3·{cIn}·8 + 8 = <b>{c1.params}</b> — each of the 8 kernels is 3 steps × {cIn} channel{cIn > 1 ? 's' : ''}, plus one bias each.</>,
    c2: <>length ⌊({M.L1} − 3)/2⌋ + 1 = <b>{M.L2}</b> · parameters 3·8·16 + 16 = <b>{c2.params}</b> — each of the 16 kernels spans 3 steps × the 8 feature maps coming in, plus one bias each.</>,
    gru: <>reads {M.L2} steps of 16 values and, without return_sequences=True (slide 29 uses it to keep every step), outputs only its last state: (None, 10). Parameters {gru.sum} = <b>{gru.params}</b> † — three gate groups z, r, g (slide 49), each with a 16 × 10 W_x, a 10 × 10 W_h and {resetAfter ? 'two bias vectors' : 'one bias vector'}.</>,
    dense: <>10 weights + 1 bias = <b>11</b> → one number: the next day’s rail riders (÷ 1e6), the 57th day, i.e. the day right after the 56-day window.</>,
    total: <>{M.layers.slice(1).map((l) => l.params).join(' + ')} = <b>{fmtInt(M.total)}</b>{matches ? ' — the number slide 50 prints: “# Number of trainable parameters: 1283”.' : cIn === 1 ? ' — not slide 50’s printed 1283.' : ' — this page’s count for the exercise; the slide gives none.'}</>,
  };
  const selLabel = sel === 'total' ? 'total' : M.layers.find((l) => l.id === sel)?.name;

  return (
    <div className="dl4s-c1d" hidden={!active}>
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="sequence length n" value={n} min={5} max={120} onChange={setN} fmt={(v) => (v === 56 ? '56 (seq_length, slide 20)' : String(v))} width="16rem" />
          {n !== 56 && <button type="button" className="dl-btn" onClick={() => setN(56)}>back to 56</button>}
        </div>
        <Chips label="input features" value={cIn} options={[{ v: 1, l: '1 · rail only (slide 50)' }, { v: 5, l: '5 · the exercise' }]} onChange={setCIn} />
        <Chips
          label="GRU biases"
          value={resetAfter}
          options={[{ v: true, l: 'two per gate group (Keras’s default)' }, { v: false, l: 'one per gate (slide 49’s equations)' }]}
          onChange={setResetAfter}
        />
      </div>

      <Code code={code} label="cnn_gru_model.py" meta={cIn === 1 ? 'slide 50' : 'slide 50, edited for the exercise · count = this page’s'} hl={hl} />

      <div className="dl4s-c1d-layers" role="group" aria-label="cnn_gru_model's layers: point at or focus one to highlight its line of code">
        <div className="dl4s-c1d-lrow dl4s-c1d-lrow--head" aria-hidden="true">
          <span className="dl4s-c1d-lrow__name">layer (slide 50’s code)</span>
          <span className="dl4s-c1d-lrow__draw">output, drawn to scale (2 units a step)</span>
          <span className="dl4s-c1d-lrow__shape">output shape</span>
          <span className="dl4s-c1d-lrow__p">parameters*</span>
        </div>
        {M.layers.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`dl4s-c1d-lrow${sel === l.id ? ' dl4s-c1d-lrow--on' : ''}`}
            aria-pressed={sel === l.id}
            aria-label={`${l.name}: output ${l.shape}, ${l.params} parameters`}
            onClick={() => setSel(l.id)}
            onFocus={() => setSel(l.id)}
            onMouseEnter={() => setSel(l.id)}
          >
            <span className="dl4s-c1d-lrow__name">{l.name}</span>
            <span className="dl4s-c1d-lrow__draw"><Tensor l={l} /></span>
            <span className="dl4s-c1d-lrow__shape">{l.shape}</span>
            <span className="dl4s-c1d-lrow__p">{fmtInt(l.params)}{l.id === 'gru' ? ' †' : ''}</span>
          </button>
        ))}
        <button
          type="button"
          className={`dl4s-c1d-lrow dl4s-c1d-lrow--total${sel === 'total' ? ' dl4s-c1d-lrow--on' : ''}`}
          aria-pressed={sel === 'total'}
          aria-label={`Total: ${M.total} parameters`}
          onClick={() => setSel('total')}
          onFocus={() => setSel('total')}
          onMouseEnter={() => setSel('total')}
        >
          <span className="dl4s-c1d-lrow__name">total</span>
          <span className="dl4s-c1d-lrow__draw dl4s-c1d-lrow__sum">{M.layers.slice(1).map((l) => fmtInt(l.params)).join(' + ')}</span>
          <span className="dl4s-c1d-lrow__shape dl4s-c1d-verdict">
            {matches ? <><Icon name="check" size={13} /> slide 50: 1283</> : cIn === 1 ? <>≠ slide 50’s 1283</> : <>the exercise (this page’s)</>}
          </span>
          <span className="dl4s-c1d-lrow__p">{fmtInt(M.total)}</span>
        </button>
      </div>
      <p className="dl4s-readout dl4s-c1d-why" aria-live="polite">
        <code className="dl4s-c1d-sel">{selLabel}</code> · {work[sel]}
      </p>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat
          k="trainable parameters"
          v={fmtInt(M.total)}
          tone="accent"
          sub={
            matches
              ? 'this page’s sum, equal to the 1283 printed on slide 50'
              : cIn === 1
                ? 'one GRU bias per gate misses slide 50’s printed 1283 by 30'
                : resetAfter
                  ? `the exercise’s model (this page’s count); first Conv1D 3·5·8 + 8 = ${c1.params}`
                  : `the exercise’s model with one GRU bias per gate (this page’s count); Keras’s default gives ${fmtInt(kerasTotal)}`
          }
        />
        <Stat k="steps the GRU runs over" v={M.L2} sub={`${n} → ${M.L1} → ${M.L2} after the two Conv1D layers`} />
        <Stat k="does n change the count?" v="no" sub={`n = 5 or 120 gives the same ${fmtInt(M.total)}: each kernel and the GRU’s weights are reused at every step; only the lengths move`} />
      </div>

      <p className="dl4s-cap">

        * Slide 50 prints only the total; the per-layer counts, lengths and shapes are this page’s. † The GRU count uses Keras’s default reset_after=True (two biases per gate group) — beyond the slides; see §14.

      </p>

      <div className="dl4s-c1d-home">
        <p className="dl4s-c1d-home__k"><span className="dl4s-dot dl4s-dot--x" />Try this at home · slide 50’s exercise</p>
        <p className="dl4s-c1d-home__q">
          “The lstm_model, gru_model, and cnn_gru_model above use only the #rail riders as input and predict the #rail riders on the 57th day. Modify the codes to take in
          5-feature input and train the model.”
        </p>
        <p className="dl4s-cap">
          Switch input features to 5 (e.g. slide 30’s {MULVAR_COLUMNS.join(', ')}): only the InputLayer’s shape and the first Conv1D change — 3·5·8 + 8 = 128 — so the total becomes
          1,379. This page’s computation; the slide gives no number for it.
        </p>
      </div>
    </div>
  );
}

function Tensor({ l }) {
  const H = 46;
  const timeAxis = l.len != null;
  const w = timeAxis ? Math.max(2, l.len * 2) : 4;
  const h = Math.max(3, l.ch * 2.5);
  const y = (H - h) / 2;
  const label = timeAxis ? `${l.len} time steps by ${l.ch} channel${l.ch > 1 ? 's' : ''}` : `${l.ch} number${l.ch > 1 ? 's' : ''}, no time axis`;
  return (
    <svg viewBox={`0 0 ${TW} ${H}`} className={`dl4s-svg dl4s-c1d-tensor dl4s-c1d-tensor--${l.role}`} role="img" aria-label={`${ROLE_NAME[l.role]}: ${label}`}>
      <rect x={2} y={y} width={w} height={h} rx={1} className="dl4s-c1d-tensor__box" />
      {!timeAxis && <text x={14} y={H / 2 + 3.5} className="dl4s-tick">{label}</text>}
    </svg>
  );
}

// ── maths (to move into rnn.js) ──────────────────────────────────────────────
// "Mon 1" for an ISO date (UTC, like isoAt). Called while the module loads,
// so no module-level constants in here (they would not exist yet).
function dayLabel(iso) {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `${dow} ${Number(iso.slice(8, 10))}`;
}
function round1(v) { return Math.round(v * 10) / 10; }
function round3(v) { return Math.round(v * 1000) / 1000; }
function clamp2(v) { return Math.max(-2, Math.min(2, v)); }

// This page's filter bank: four hand-set kernels, the rest seeded random
// (weights in ±1, bias in ±0.3, one decimal each).
function filterBank(count, seed) {
  const hand = [
    { w: [-1, 0, 1], b: 0, what: 'this page’s hand-set weights, which respond to a rise from the window’s first day to its third' },
    { w: [1, 0, -1], b: 0, what: 'this page’s hand-set weights, which respond to a fall from the first day to the third' },
    { w: [0.4, 0.4, 0.4], b: -0.7, what: 'this page’s hand-set weights, 0.4 × the 3-day sum less 0.7, which respond to busy weekday stretches' },
    { w: [0.5, -1, 0.5], b: 0, what: 'this page’s hand-set weights, which respond to a quiet middle day between busier neighbours' },
  ];
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => hand[i] ?? {
    w: [0, 1, 2].map(() => round1(rnd() * 2 - 1)),
    b: Math.round((rnd() * 2 - 1) * 3) / 10,
    what: 'this page’s seeded random weights (a trained layer learns its own)',
  });
}

// One Conv1D layer ("valid", kernel_size = filter length) over a 1-channel
// sequence: per filter, the pre-activation z and ReLU(z) at every window.
function convMap(xs, filters, stride) {
  return filters.map((F) => conv1d(xs, F.w, stride, F.b).map((o) => {
    const z = round3(o.value);
    return { start: o.start, z, y: relu(z) };
  }));
}

// slide 50's cnn_gru_model, layer by layer, for a window of n steps with cIn
// features. resetAfter = Keras's GRU default (two bias vectors per gate group).
function cnnGruLayers(n, cIn, resetAfter) {
  const L1 = conv1dLen(n, 3, 1);
  const L2 = conv1dLen(L1, 3, 2);
  const layers = [
    { id: 'in', needle: 'InputLayer', name: `InputLayer(shape=[None, ${cIn}])`, role: 'x', len: n, ch: cIn, shape: `(None, ${n}, ${cIn})`, params: 0 },
    { id: 'c1', needle: 'filters=8', name: 'Conv1D(filters=8, kernel_size=3, strides=1, activation="relu")', role: 'fm', len: L1, ch: 8, shape: `(None, ${L1}, 8)`, params: conv1dParams(8, 3, cIn) },
    { id: 'c2', needle: 'filters=16', name: 'Conv1D(filters=16, kernel_size=3, strides=2, activation="relu")', role: 'fm', len: L2, ch: 16, shape: `(None, ${L2}, 16)`, params: conv1dParams(16, 3, 8) },
    { id: 'gru', needle: 'GRU(', name: 'GRU(10)', role: 'h', len: null, ch: 10, shape: '(None, 10)', params: gruParams(10, 16, resetAfter), sum: `3·(10·16 + 10·10 + ${resetAfter ? '2·10' : '10'})` },
    { id: 'dense', needle: 'Dense(', name: 'Dense(1)', role: 'y', len: null, ch: 1, shape: '(None, 1)', params: denseParams(10, 1) },
  ];
  return { L1, L2, layers, total: layers.reduce((a, l) => a + l.params, 0) };
}

// slide 50's listing with the exercise's input width (and that model's count)
function exerciseCode(code, cIn, total) {
  return code
    .replace('shape=[None, 1]', `shape=[None, ${cIn}]`)
    .replace(/# Number of trainable parameters: \d+/, `# Number of trainable parameters: ${total}  (this page's count)`);
}

// 1-based line number of the first line containing `needle` (0 if none)
function lineOf(code, needle) {
  if (!needle) return 0;
  return code.split('\n').findIndex((ln) => ln.includes(needle)) + 1;
}
