import { useMemo, useState } from 'react';
import { Code, Tex } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { RIDERSHIP } from '../data/ridership';
import { DEEP_CODE, RNN1_CODE, MULVAR_HEAD, MULVAR_COLUMNS, MULVAR_MODEL_CODE, MULTASK_RUNS, SLIDE_PARAMS, SPLITS } from '../slideData';
import { timeseriesDataset, fitLinear, predictLinear, mae, monthRange, isoAt, fmtInt, simpleRnnParams, denseParams, tanh } from '../rnn';
import { Arrowhead } from './parts';
import './labsModels.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §8, §9 AND §10
     LinearLab       slide 23's linear model as what it is — a 57-number dot
                     product over the 56-day window — with this page's own
                     least-squares weights fitted on rail_train
     TanhCeilingLab  slides 24–27: why SimpleRNN(1) fails (3 parameters; tanh
                     can't go above 1, the real series does) and the fix,
                     univar_model, counted parameter by parameter
     DeepStackLab    slides 28–29 / Figure 15-10: build the stack, toggle
                     return_sequences, see every layer's output shape and
                     count, and the failure when an inner layer drops time
     FeatureLab      slides 30–33: bus, rail and tomorrow's day type →
                     one-hot → 5 columns, rebuilt from the real data; Dense(1)
                     vs Dense(2) targets; slide 33's two runs
   ========================================================================== */

const R = RIDERSHIP;
const railM = R.rail.map((v) => v / 1e6);
const busM = R.bus.map((v) => v / 1e6);

// rail_train / rail_valid exactly as slide 20 slices them
function splitRange(from, to) {
  const [a, b] = monthRange(R.start, from, to);
  return { a, b, vals: railM.slice(a, b + 1) };
}

/* ── §8 · the linear model as a dot product ──────────────────────────────── */
export function LinearLab() {
  const SEQ = SPLITS.seqLength;
  const fit = useMemo(() => {
    const tr = splitRange(SPLITS.train.from, SPLITS.train.to);
    const va = splitRange(SPLITS.valid.from, SPLITS.valid.to);
    const ds = timeseriesDataset(tr.vals, tr.vals.slice(SEQ), { sequence_length: SEQ, batch_size: 32 });
    const w = fitLinear(ds.windows.map((d) => d.x), ds.windows.map((d) => d.y));
    const vds = timeseriesDataset(va.vals, va.vals.slice(SEQ), { sequence_length: SEQ, batch_size: 32 });
    const err = vds.windows.map((d) => predictLinear(w, d.x) - d.y);
    return { w, tr, va, vds, validMae: mae(err) * 1e6, n: ds.windows.length };
  }, [SEQ]);
  const [pick, setPick] = useState(52); // a window of the validation period
  const win = fit.vds.windows[Math.min(pick, fit.vds.windows.length - 1)];
  const pred = predictLinear(fit.w, win.x);
  const prods = win.x.map((v, i) => v * fit.w[i]);
  const maxW = Math.max(...fit.w.slice(0, SEQ).map(Math.abs));
  const firstDay = isoAt(R.start, fit.va.a + win.start);
  const targetDay = isoAt(R.start, fit.va.a + win.start + SEQ);

  const W = 620;
  const bx = (i) => 44 + i * ((W - 60) / SEQ);
  const bw = (W - 60) / SEQ - 1.5;

  return (
    <Lab
      title="Slide 23 · the linear model is a 57-number dot product"
      slides="slide 23"
      tryThis="before looking at the weights, predict which past days matter most for tomorrow’s rail count; notice the biggest bar is yesterday, then bars at whole weeks back (−7, −14, −28, −35) — the weekly seasonality, learned. Then slide through windows and compare the forecast with the truth."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="validation window" value={pick} min={0} max={fit.vds.windows.length - 1} onChange={setPick} fmt={() => `${firstDay} … → ${targetDay}`} width="22rem" />
        </div>
      </div>
      <div className="dl4s-wide">
        <svg viewBox={`0 0 ${W} 250`} className="dl4s-svg dl4s-lin" role="img" aria-label={`The 56 weights of this page's linear model and the window ending before ${targetDay}; the prediction is the sum of input times weight plus the bias`}>
          <text x={8} y={16} className="dl4s-svg__label dl4s-svg__label--ink">56 weights (one per day of the window) + 1 bias = 57 parameters</text>
          <line x1={40} y1={70} x2={W - 12} y2={70} className="dl4s-axis" />
          {fit.w.slice(0, SEQ).map((v, i) => (
            <rect key={`w${i}`} x={bx(i)} y={v >= 0 ? 70 - (v / maxW) * 44 : 70} width={bw} height={(Math.abs(v) / maxW) * 44} className={v >= 0 ? 'dl4s-lin__w dl4s-lin__w--pos' : 'dl4s-lin__w dl4s-lin__w--neg'}>
              <title>{`weight for day ${i} of the window: ${v.toFixed(4)}`}</title>
            </rect>
          ))}
          {[7, 14, 21, 28, 35, 42, 49, 56].map((lag) => (
            <text key={lag} x={bx(SEQ - lag) + bw / 2} y={128} textAnchor="middle" className="dl4s-tick">−{lag}</text>
          ))}
          <text x={W - 12} y={142} textAnchor="end" className="dl4s-tick">days before the target</text>
          <text x={8} y={152} className="dl4s-svg__label">the window (rail, ÷ 1e6)</text>
          {win.x.map((v, i) => (
            <rect key={`x${i}`} x={bx(i)} y={234 - v * 70} width={bw} height={v * 70} className="dl4s-lin__x">
              <title>{`${isoAt(R.start, fit.va.a + win.start + i)}: ${v.toFixed(3)}`}</title>
            </rect>
          ))}
          <line x1={40} y1={234} x2={W - 12} y2={234} className="dl4s-axis" />
        </svg>
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="forecast for the next day" v={fmtInt(pred * 1e6)} tone="accent" sub={`Σ input × weight (${fmtInt(prods.reduce((a, v) => a + v, 0) * 1e6)}) + bias (${fmtInt(fit.w[SEQ] * 1e6)})`} />
        <Stat k={`true value on ${targetDay}`} v={fmtInt(win.y * 1e6)} sub={`error ${fmtInt(Math.abs(pred - win.y) * 1e6)} riders`} />
        <Stat k="this page’s validation MAE" v={fmtInt(fit.validMae)} sub={`over ${fit.vds.windows.length} validation windows — not the slide’s number`} />
        <Stat k="slide 23’s model" v="about 38,245" sub="SGD + Huber + early stopping (“your mileage may vary”)" />
      </div>
      <p className="dl4s-cap">
        The weights here are this page’s own: a (lightly regularised) least-squares fit on the {fmtInt(fit.n)} training windows of rail_train (2016-01 → 2018-12, ÷ 1e6), not
        slide 23’s SGD-trained model, so its MAE differs from the slide’s. The model is the same shape — Dense(1) on 56 inputs: 56 weights + 1 bias = 57.
      </p>
    </Lab>
  );
}

/* ── §8 · why SimpleRNN(1) failed, and univar_model ──────────────────────── */
export function TanhCeilingLab() {
  const [a, setA] = useState(1.2);
  const [units, setUnits] = useState(32);
  const [dense, setDense] = useState(true);
  const tr = useMemo(() => splitRange(SPLITS.train.from, SPLITS.train.to), []);
  const maxV = Math.max(...tr.vals);
  const maxDay = isoAt(R.start, tr.a + tr.vals.indexOf(maxV));
  const above = tr.vals.filter((v) => v > 1).length;

  const rnnP = simpleRnnParams(units, 1);
  const denseP = dense ? denseParams(units, 1) : 0;
  const isSlide = units === 32 && dense;
  const isRnn1 = units === 1 && !dense;

  // plot the training series against tanh's ceiling
  const W = 620;
  const H = 190;
  const n = tr.vals.length;
  const px = (i) => 40 + (i / (n - 1)) * (W - 56);
  const py = (v) => 16 + (1.25 - v) * ((H - 40) / 1.35);
  const line = tr.vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join('');
  const mi = tr.vals.indexOf(maxV);

  const code = `univar_model = tf.keras.Sequential([
   tf.keras.layers.InputLayer(shape=[None, 1]),
   tf.keras.layers.SimpleRNN(${units}),${dense ? '\n   tf.keras.layers.Dense(1) # no activation function by default' : ''}
])`;

  return (
    <Lab
      title="Slides 24–27 · two reasons SimpleRNN(1) failed, and the fix"
      slides="slides 24–27"
      tryThis="push the tanh input as high as you like — predict whether the output ever passes 1.0; it can’t, but the real series does. Then rebuild univar_model: predict SimpleRNN(32)’s count before reading 1,088, and watch what Dense(1) adds."
    >
      <div className="dl4s-tanh">
        <svg viewBox={`0 0 ${W} ${H}`} className="dl4s-svg" role="img" aria-label={`rail_train from 2016 to 2018 divided by one million; tanh outputs are limited to plus or minus 1; the series peaks at ${maxV.toFixed(3)} on ${maxDay}`}>
          <rect x={40} y={py(1)} width={W - 56} height={py(-0.1) - py(1)} className="dl4s-tanh__band" />
          <line x1={40} y1={py(1)} x2={W - 16} y2={py(1)} className="dl4s-tanh__ceil" />
          <text x={W - 18} y={py(1) - 5} textAnchor="end" className="dl4s-svg__label dl4s-svg__label--ink">tanh ceiling: +1</text>
          <path d={line} className="dl4s-tanh__line" />
          {[0, 0.5, 1].map((v) => (
            <text key={v} x={34} y={py(v) + 3} textAnchor="end" className="dl4s-tick">{v}</text>
          ))}
          {['2016', '2017', '2018'].map((y, k) => (
            <text key={y} x={px((k * n) / 3) + 4} y={H - 4} className="dl4s-tick">{y}</text>
          ))}
          <circle cx={px(mi)} cy={py(maxV)} r={4.5} className="dl4s-tanh__max" />
          <text x={px(mi) + 8} y={py(maxV) + 4} className="dl4s-svg__label dl4s-svg__label--ink">{maxV.toFixed(3)} ({maxDay})</text>
        </svg>
        <div className="dl4s-tanh__side">
          <Range label="pre-activation a" value={a} min={-4} max={6} step={0.1} onChange={setA} fmt={(v) => v.toFixed(1)} />
          <p className="dl4s-total">tanh({a.toFixed(1)}) = <b>{tanh(a).toFixed(4)}</b></p>
          <p className="dl4s-cap">
            However large a gets, tanh stays below +1 — so <code>SimpleRNN(1)</code> on its own can never output the {above} training day{above === 1 ? '' : 's'} above 1.0.
          </p>
        </div>
      </div>

      <div className="dl4s-params">
        <div className="dl-lab__controls">
          <Chips label="recurrent units" value={units} options={[{ v: 1, l: '1 (slide 24)' }, 8, 16, { v: 32, l: '32 (univar_model)' }, 64]} onChange={setUnits} />
          <Chips label="output layer" value={dense} options={[{ v: false, l: 'none (slide 24)' }, { v: true, l: 'Dense(1), no activation' }]} onChange={setDense} />
        </div>
        <table className="dl-table dl4s-params__table">
          <thead><tr><th>Layer (type)</th><th>Output Shape</th><th>Param #</th><th>where it comes from</th></tr></thead>
          <tbody>
            <tr>
              <td><code>SimpleRNN({units})</code></td><td>(None, {units})</td><td><b>{fmtInt(rnnP)}</b></td>
              <td><Tex src={`\\underbrace{1 \\times ${units}}_{\\mathbf{W}_x} + \\underbrace{${units} \\times ${units}}_{\\mathbf{W}_h} + \\underbrace{${units}}_{\\mathbf{b}_h}`} /></td>
            </tr>
            {dense && (
              <tr><td><code>Dense(1)</code></td><td>(None, 1)</td><td><b>{fmtInt(denseP)}</b></td><td><Tex src={`${units} \\text{ weights} + 1 \\text{ bias}`} /></td></tr>
            )}
          </tbody>
          <tfoot><tr><td colSpan={2}>Total params</td><td><b>{fmtInt(rnnP + denseP)}</b></td><td>{isSlide ? <span><span className="dl4s-dot dl4s-dot--y" />= slide 27’s 1,088 + 33 = 1,121</span> : isRnn1 ? <span><span className="dl4s-dot dl4s-dot--y" />= slide 25’s 3</span> : 'this page’s count'}</td></tr></tfoot>
        </table>
        <Code code={isRnn1 ? RNN1_CODE : code} label={isRnn1 ? 'simple_rnn.py' : 'univar_model.py'} meta={isSlide ? 'slide 27' : isRnn1 ? 'slide 24' : 'edited'} />
        {!dense && units > 1 && <p className="dl4s-cap">Without the Dense layer the model outputs its last state only — {units} numbers, (None, {units}) — and each is still a tanh, still capped at +1.</p>}
      </div>
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="reason 1 · memory" v={`${fmtInt(rnnP + denseP)} parameters`} sub={isRnn1 ? 'one neuron: only the current input and its own last output (slide 25)' : 'more neurons, more memory'} />
        <Stat k="reason 2 · the ceiling" v={dense ? 'removed' : 'tanh ≤ +1'} sub={dense ? 'Dense(1) has no activation, so it can output any value (slide 26)' : `the series reaches ${maxV.toFixed(3)} in training`} tone={dense ? 'accent' : undefined} />
      </div>
      <p className="dl4s-cap">Series: the real rail_train (2016-01 → 2018-12, ÷ 1e6) from slide 15’s data. Validation MAEs from the slides: SimpleRNN(1) over 100,000; univar_model around 27,703.</p>
    </Lab>
  );
}

/* ── §9 · build the deep RNN (slides 28–29, Figure 15-10) ────────────────── */
const SLIDE_STACK = [
  { units: 32, rs: true },
  { units: 32, rs: true },
  { units: 32, rs: false },
];

export function DeepStackLab() {
  const [stack, setStack] = useState(SLIDE_STACK);
  const set = (k, patch) => setStack((s) => s.map((l, i) => (i === k ? { ...l, ...patch } : l)));
  const add = () => setStack((s) => [...s.slice(0, -1), { units: 32, rs: true }, s[s.length - 1]]);
  const remove = (k) => setStack((s) => (s.length > 1 ? s.filter((_, i) => i !== k) : s));

  // walk the stack: each layer's input shape, output shape, params, errors
  const rows = [];
  let inDim = 1;
  let timeAxis = true;
  let broken = -1;
  stack.forEach((l, k) => {
    const ok = timeAxis;
    if (!ok && broken < 0) broken = k;
    const p = simpleRnnParams(l.units, inDim);
    rows.push({ ...l, k, inDim, ok, p, out: l.rs ? `(None, None, ${l.units})` : `(None, ${l.units})` });
    inDim = l.units;
    timeAxis = l.rs;
  });
  const denseP = denseParams(inDim, 1);
  const denseOut = timeAxis ? '(None, None, 1)' : '(None, 1)';
  const total = rows.reduce((a, r) => a + r.p, 0) + denseP;
  const isSlide = stack.length === 3 && stack.every((l, k) => l.units === 32 && l.rs === SLIDE_STACK[k].rs);

  const code = [
    'deep_model = tf.keras.Sequential([',
    '  tf.keras.layers.InputLayer(shape=[None, 1]),',
    ...rows.map((r) => {
      const call = `  tf.keras.layers.SimpleRNN(${r.units}${r.rs ? ', return_sequences=True' : ''}),`;
      return `${call.padEnd(57)}# ${fmtInt(r.p).padStart(5)} params`;
    }),
    `${'  tf.keras.layers.Dense(1)'.padEnd(57)}# ${fmtInt(denseP).padStart(5)} params`,
    '])',
  ].join('\n');

  // the unrolled picture: layers bottom → top, 4 time steps
  const T = 4;
  const W = 420;
  const colX = (t) => 124 + t * 76;
  const rowY = (k) => 196 - k * 40;
  const topY = rowY(stack.length - 1);

  return (
    <Lab
      title="Figure 15-10 / slide 29 · build the deep RNN"
      slides="slides 28–29"
      tryThis="before switching off return_sequences on the middle layer, predict what the layer above will receive; notice the stack break. Then add a fourth layer and predict its count — 2,080 again, because every inner layer reads 32 inputs."
    >
      <div className="dl4s-deep">
        <div className="dl4s-deep__layers" role="group" aria-label="The layers of deep_model, bottom to top">
          <div className="dl4s-deep__row dl4s-deep__row--io"><code>InputLayer(shape=[None, 1])</code><span className="dl4s-shape">(None, None, 1)</span></div>
          {rows.map((r) => (
            <div key={r.k} className={`dl4s-deep__row${r.ok ? '' : ' dl4s-deep__row--bad'}`}>
              <span className="dl4s-deep__name">SimpleRNN</span>
              <Chips label="units" value={r.units} options={[8, 16, 32]} onChange={(v) => set(r.k, { units: v })} compact />
              <label className="dl-check"><input type="checkbox" checked={r.rs} onChange={(e) => set(r.k, { rs: e.target.checked })} /> return_sequences</label>
              <span className="dl4s-shape">{r.out}</span>
              <span className="dl4s-deep__p">{fmtInt(r.p)}</span>
              <button type="button" className="dl4s-link" onClick={() => remove(r.k)} disabled={stack.length <= 1} aria-label={`Remove layer ${r.k + 1}`}>remove</button>
              {!r.ok && <span className="dl4s-deep__err"><span className="dl4s-dot dl4s-dot--warn" />receives (None, {r.inDim}) — no time axis, but a recurrent layer expects 3D input [batch size, time steps, dimensionality] (slide 24): this stack won’t build</span>}
            </div>
          ))}
          <div className="dl4s-deep__row dl4s-deep__row--io">
            <code>Dense(1)</code><span className="dl4s-shape">{denseOut}</span><span className="dl4s-deep__p">{fmtInt(denseP)}</span>
            {timeAxis && broken < 0 && <span className="dl4s-deep__err"><span className="dl4s-dot dl4s-dot--warn" />the last recurrent layer kept its time axis, so Dense(1) gives one value per time step, not one forecast</span>}
          </div>
          <div className="dl4s-btnrow">
            <button type="button" className="dl-btn" onClick={add} disabled={stack.length >= 5}>+ add a SimpleRNN layer</button>
            <button type="button" className="dl-btn" onClick={() => setStack(SLIDE_STACK)} disabled={isSlide}>back to slide 29’s deep_model</button>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} 240`} className="dl4s-svg dl4s-deep__svg" role="img" aria-label="The stack unrolled over four time steps; layers with return_sequences pass every step up, the others only the last">
          {stack.map((l, k) => Array.from({ length: T }, (_, t) => {
            const passUp = l.rs || t === T - 1;
            return (
              <g key={`${k}.${t}`}>
                <rect x={colX(t) - 20} y={rowY(k) - 11} width={40} height={22} rx={5} className={`dl4s-deep__cell${rows[k].ok ? '' : ' dl4s-deep__cell--bad'}`} />
                {t < T - 1 && <line x1={colX(t) + 20} y1={rowY(k)} x2={colX(t + 1) - 22} y2={rowY(k)} className={`dl4s-wire dl4s-wire--h${t === 1 ? ' dl4s-wire--dash' : ''}`} />}
                {t < T - 1 && <Arrowhead x={colX(t + 1) - 21} y={rowY(k)} dir="right" s={4} className="dl4s-ah dl4s-ah--h" />}
                <line x1={colX(t)} y1={rowY(k) - 11} x2={colX(t)} y2={rowY(k) - 26} className={`dl4s-wire${passUp ? '' : ' dl4s-deep__dead'}`} />
                {passUp && <Arrowhead x={colX(t)} y={rowY(k) - 27} s={4} />}
              </g>
            );
          }))}
          {Array.from({ length: T }, (_, t) => (
            <g key={`x${t}`}>
              <line x1={colX(t)} y1={226} x2={colX(t)} y2={rowY(0) + 12} className="dl4s-wire dl4s-wire--x" />
              <Arrowhead x={colX(t)} y={rowY(0) + 12} s={4} className="dl4s-ah dl4s-ah--x" />
              <text x={colX(t)} y={238} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--x">{['X(0)', 'X(1)', 'X(t−1)', 'X(t)'][t]}</text>
            </g>
          ))}
          {stack.map((l, k) => (
            <text key={`l${k}`} x={8} y={rowY(k) + 4} className="dl4s-tick">{l.rs ? 'all steps ↑' : 'last step ↑'}</text>
          ))}
          <text x={colX(T - 1)} y={topY - 34} textAnchor="middle" className="dl4s-svg__label dl4s-svg__label--y">→ Dense(1)</text>
        </svg>
      </div>
      <Code code={isSlide ? DEEP_CODE : code} label="deep_model.py" meta={isSlide ? 'slide 29' : 'edited'} />
      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="trainable parameters" v={fmtInt(total)} tone="accent" sub={isSlide ? `= slide 29’s ${fmtInt(SLIDE_PARAMS.deep.total)}` : 'this page’s count for your stack'} />
        <Stat k="validation MAE (slide 29)" v="about 29,672" sub="worse than univar_model’s 27,703 — a bit too large for the task" />
      </div>
    </Lab>
  );
}

/* ── §10 · the five input columns, rebuilt from the data ─────────────────── */
const DAY_TYPES = ['A', 'U', 'W'];

export function FeatureLab() {
  const [from, setFrom] = useState(0); // 2016-01-01, slide 30's head()
  const [head, setHead] = useState('one');
  const rows = useMemo(() => Array.from({ length: 5 }, (_, k) => {
    const i = from + k;
    const next = i + 1 < R.length ? R.dayType[i + 1] : R.dayTypeAfterEnd;
    return { date: isoAt(R.start, i), type: R.dayType[i], next, bus: busM[i], rail: railM[i], hot: DAY_TYPES.map((t) => (t === next ? 1 : 0)) };
  }), [from]);
  const matchesSlide = from === 0 && rows.every((r, k) => Math.abs(r.bus - MULVAR_HEAD[k].row[0]) < 5e-7 && Math.abs(r.rail - MULVAR_HEAD[k].row[1]) < 5e-7 && r.hot.every((h, j) => h === MULVAR_HEAD[k].row[2 + j]));
  const rnnP = simpleRnnParams(32, 5);
  const outs = head === 'one' ? 1 : 2;
  const dP = denseParams(32, outs);

  return (
    <Lab
      title="Slides 30–33 · from df to five input columns, and one or two outputs"
      slides="slides 30–33"
      tryThis="find a Friday: predict which next_day_type column holds the 1 before looking (tomorrow is a Saturday, so A). Then switch the head to Dense(2) and predict the target shape for a batch of 32."
    >
      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <Range label="first row" value={from} min={0} max={R.length - 6} onChange={setFrom} fmt={() => isoAt(R.start, from)} width="18rem" />
        </div>
      </div>
      <div className="dl4s-feat">
        <div className="dl-tablewrap">
          <table className="dl-table dl4s-feat__table">
            <thead>
              <tr><th>date</th><th>day_type</th><th>→ next_day_type</th>{MULVAR_COLUMNS.map((c) => <th key={c} className="dl4s-feat__col"><code>{c}</code></th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td className="dl4s-mono">{r.type}</td>
                  <td className="dl4s-mono">{r.next}</td>
                  <td className="dl4s-mono">{r.bus.toFixed(6)}</td>
                  <td className="dl4s-mono">{r.rail.toFixed(6)}</td>
                  {r.hot.map((h, j) => <td key={j} className={`dl4s-mono${h ? ' dl4s-feat__hot' : ''}`}>{h}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dl4s-cap">
          {matchesSlide ? (
            <><span className="dl4s-dot dl4s-dot--y" />These five rows match slide 30’s <code>mulvar_train.head()</code> exactly. </>
          ) : 'Rebuilt from the real data with slide 30’s code. '}
          bus and rail are ÷ 1e6; <code>shift(-1)</code> puts tomorrow’s day type on today’s row, and <code>pd.get_dummies</code> one-hot encodes it (shown as 1/0, as the slide prints).
          The codes are the dataset’s own: W weekday, A Saturday, U Sunday or holiday (from the data’s documentation, not the slides).
        </p>
      </div>

      <div className="dl4s-feat__model">
        <Chips label="output layer" value={head} options={[{ v: 'one', l: 'Dense(1) · mulvar_model (slide 31)' }, { v: 'two', l: 'Dense(2) · multask_model (slide 32)' }]} onChange={setHead} />
        <div className="dl4s-feat__flow" aria-label="Shapes through the model for one batch of 32 windows">
          <span><b>inputs</b> (32, 56, 5)</span>
          <span aria-hidden="true">→</span>
          <span><code>InputLayer(shape=[None, 5])</code></span>
          <span aria-hidden="true">→</span>
          <span><code>SimpleRNN(32)</code> (32, 32)</span>
          <span aria-hidden="true">→</span>
          <span><code>Dense({outs})</code> (32, {outs === 1 ? '1' : '2'})</span>
          <span aria-hidden="true">vs</span>
          <span><b>targets</b> {outs === 1 ? '(32,) — rail' : '(32, 2) — bus, rail'}</span>
        </div>
        {head === 'one' ? <Code code={MULVAR_MODEL_CODE} label="mulvar_model.py" meta="slide 31" /> : (
          <div className="dl-tablewrap">
            <table className="dl-table">
              <thead><tr><th>slide 33</th><th>both outputs</th><th>bus</th><th>rail</th></tr></thead>
              <tbody>{MULTASK_RUNS.map((r) => <tr key={r.run}><td>{r.run}</td><td>{fmtInt(r.total)}</td><td>{fmtInt(r.bus)}</td><td>{fmtInt(r.rail)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="dl4s-stats dl4s-stats--tight">
          <Stat k="validation MAE" v={head === 'one' ? '22,062' : '27,855'} tone="accent" sub={head === 'one' ? 'mulvar_model, rail (slide 31) — the best so far' : 'multask_model, both outputs together (slide 33)'} />
          <Stat k="parameters (this page’s count)" v={fmtInt(rnnP + dP)} sub={`SimpleRNN(32) on 5 inputs ${fmtInt(rnnP)} + Dense(${outs}) ${dP} — not printed on the slides`} />
        </div>
      </div>
    </Lab>
  );
}
