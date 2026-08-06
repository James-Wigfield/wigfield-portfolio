import { useMemo, useState } from 'react';
import { Tex, Fnote, Unfold } from '../kit';
import { FnPlot } from '../plots';
import { ACT_FNS, sigmoid, softplus } from '../mathfns';

/* ============================================================================
   DEEP LEARNING — LECTURE 1 LABS (part 2 · MLPs, activations, heads)
   ----------------------------------------------------------------------------
     BackpropTour       slide 19 — the four phases of backprop, animated on a
                        little 2-3-2 network
     ActivationGallery  slides 20–22 — Figure 10-8 live: four activations and
                        their derivatives, plus the σ′ margin derivation
     LinearityDemo      slide 23 — chain two linear layers → still a line;
                        drop a ReLU between them → not any more
     HeadPicker         slides 24, 27, 29, 31 — match the output layer + loss
                        to the task
     SoftmaxLab         slide 29 — three logits, live probabilities, Σ = 1
     LossLab            slides 25, 27–28 — abs/squared, Huber (drag δ),
                        ReLU vs softplus
   ========================================================================== */

const heaviside = (z) => (z >= 0 ? 1 : 0);

/* ── Slide 19 · backprop in four phases ──────────────────────────────────── */
const BP_PHASES = [
  { title: 'Forward pass', cap: 'Feed the training instance in and compute the output of every neuron, layer by layer.' },
  { title: 'Measure the error', cap: 'Compare the network’s output with the desired output — the difference is the error.' },
  { title: 'Reverse pass', cap: 'Walk back through each layer in reverse order, measuring the error contribution from each connection, all the way to the input layer.' },
  { title: 'Gradient Descent step', cap: 'Slightly tweak every connection weight to reduce the error. Repeat.' },
];

const BP_IN = [[60, 95], [60, 205]];
const BP_HID = [[230, 55], [230, 150], [230, 245]];
const BP_OUT = [[400, 105], [400, 195]];
const BP_E1 = BP_IN.flatMap((a) => BP_HID.map((b) => [a, b]));
const BP_E2 = BP_HID.flatMap((a) => BP_OUT.map((b) => [a, b]));

export function BackpropTour() {
  const [phase, setPhase] = useState(0);

  const edgeClass = () => {
    if (phase === 0) return ' dl1-bpedge--f';
    if (phase === 2) return ' dl1-bpedge--r';
    if (phase === 3) return ' dl1-bpedge--u';
    return '';
  };

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Backpropagation · Gradient Descent using reverse-mode autodiff<Fnote n={2} /></span>
        <div className="dl-stepper">
          <button type="button" className="dl-btn" onClick={() => setPhase(Math.max(0, phase - 1))} disabled={phase === 0}>← prev</button>
          <span className="dl-stepper__pips" aria-hidden="true">
            {BP_PHASES.map((_, i) => <span key={i} className={`dl-pip${i === phase ? ' dl-pip--on' : ''}`} />)}
          </span>
          <button type="button" className="dl-btn" onClick={() => setPhase(Math.min(BP_PHASES.length - 1, phase + 1))} disabled={phase === BP_PHASES.length - 1}>next →</button>
        </div>
      </div>

      <p className="dl-steptitle">
        <span className="dl-steptitle__no">phase {phase + 1}/4</span> <strong>{BP_PHASES[phase].title}</strong> — {BP_PHASES[phase].cap}
      </p>

      <svg viewBox="0 0 470 300" className="dl1-bpsvg" aria-label="A small network showing the current backprop phase">
        {[...BP_E1, ...BP_E2].map(([[x1, y1], [x2, y2]], i) => (
          <line key={i} x1={x1 + 18} y1={y1} x2={x2 - 18} y2={y2} className={`dl1-bpedge${edgeClass()}`} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />
        ))}
        {BP_IN.map(([x, y], i) => (
          <g key={`i${i}`}>
            <circle cx={x} cy={y} r={17} className="dl1-node dl1-node--input" />
            <text x={x} y={y + 4} textAnchor="middle" className="dl1-node__k">x{i + 1}</text>
          </g>
        ))}
        {BP_HID.map(([x, y], i) => (
          <circle key={`h${i}`} cx={x} cy={y} r={17} className={`dl1-node dl1-node--tlu${phase === 0 || phase === 2 ? ' dl1-node--fire' : ''}`} />
        ))}
        {BP_OUT.map(([x, y], i) => (
          <g key={`o${i}`}>
            <circle cx={x} cy={y} r={17} className={`dl1-node dl1-node--tlu${phase >= 1 ? ' dl1-node--fire' : ''}`} />
            {phase >= 1 && <text x={x + 32} y={y + 4} textAnchor="middle" className={`dl1-err${phase === 1 ? ' dl1-err--hot' : ''}`}>ε{i + 1}</text>}
          </g>
        ))}
        {phase === 3 && [...BP_E1.slice(1, 4), ...BP_E2.slice(2, 4)].map(([[x1, y1], [x2, y2]], i) => (
          <text key={i} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" className="dl1-dw">−ηΔw</text>
        ))}
        <text x={60} y={285} textAnchor="middle" className="dl-plot__tick">input</text>
        <text x={230} y={285} textAnchor="middle" className="dl-plot__tick">hidden</text>
        <text x={400} y={285} textAnchor="middle" className="dl-plot__tick">output</text>
      </svg>
    </div>
  );
}

/* ── Slides 20–22 · Figure 10-8, live ────────────────────────────────────── */
const GALLERY = [
  { id: 'heaviside', label: 'Heaviside', color: 'var(--dlv-red)', f: heaviside, df: (z) => 0 * z },
  { id: 'sigmoid', label: 'Sigmoid', color: 'var(--dlv-blue)', dash: '7 5', f: (z) => sigmoid(z), df: (z) => sigmoid(z) * (1 - sigmoid(z)) },
  { id: 'tanh', label: 'Tanh', color: 'var(--dlv-aqua)', f: (z) => Math.tanh(z), df: (z) => 1 - Math.tanh(z) ** 2 },
  { id: 'relu', label: 'ReLU', color: 'var(--dlv-orange)', dash: '10 4 2 4', f: (z) => ACT_FNS.relu(z), df: (z) => (z < 0 ? 0 : 1) },
];

export function ActivationGallery() {
  const [mode, setMode] = useState('fn');
  const series = useMemo(
    () => GALLERY.map((g) => ({ id: g.id, label: mode === 'fn' ? g.label : `${g.label} ′`, color: g.color, dash: g.dash, f: mode === 'fn' ? g.f : g.df })),
    [mode],
  );
  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 10-8 · the classic four</span>
        <div className="dl-chips">
          <button type="button" className={`dl-chip${mode === 'fn' ? ' dl-chip--on' : ''}`} onClick={() => setMode('fn')} aria-pressed={mode === 'fn'}>activation functions</button>
          <button type="button" className={`dl-chip${mode === 'deriv' ? ' dl-chip--on' : ''}`} onClick={() => setMode('deriv')} aria-pressed={mode === 'deriv'}>their derivatives</button>
        </div>
      </div>
      <FnPlot
        series={series}
        xmin={-4.5} xmax={4.5}
        ymin={mode === 'fn' ? -1.3 : -0.2} ymax={mode === 'fn' ? 2.1 : 1.25}
        height={310}
        caption={
          mode === 'fn'
            ? 'Heaviside jumps, sigmoid and tanh curve smoothly (ranges (0,1) and (−1,1)), ReLU never tops out.'
            : 'The punchline: heaviside′ is 0 everywhere (undefined at the jump) — nothing for Gradient Descent to use. σ′ peaks at 0.25, tanh′ at 1.0, ReLU′ snaps 0 → 1 (undefined exactly at 0).'
        }
      />
      <Unfold label="σ′(z) = σ(z)(1 − σ(z)) — the two-line derivation (slide 20)">
        <Tex block src="\sigma'(z) = \frac{e^{-z}}{(1+e^{-z})^2} = \frac{1+e^{-z}-1}{(1+e^{-z})^2} = \frac{1}{1+e^{-z}} - \frac{1}{(1+e^{-z})^2}" />
        <Tex block src="= \sigma(z) - \sigma^2(z) = \sigma(z)\big(1-\sigma(z)\big)" />
      </Unfold>
    </div>
  );
}

/* ── Slide 23 · why nonlinearity ─────────────────────────────────────────── */
export function LinearityDemo() {
  const [a, setA] = useState(5);
  const [b, setB] = useState(-1);
  const [c, setC] = useState(2);
  const [d, setD] = useState(3);
  const [withRelu, setWithRelu] = useState(false);

  const g = (z) => a * z + b;
  const f = (z) => c * z + d;
  const series = useMemo(() => {
    const out = [
      { id: 'g', label: `g(z) = ${a}z ${b < 0 ? '−' : '+'} ${Math.abs(b)}`, color: 'var(--text-faint)', dash: '6 5', f: g },
      withRelu
        ? { id: 'fg', label: 'f(ReLU(g(z)))', color: 'var(--dlv-violet)', f: (z) => f(Math.max(0, g(z))) }
        : { id: 'fg', label: `f(g(z)) = ${a * c}z ${c * b + d < 0 ? '−' : '+'} ${Math.abs(c * b + d)}`, color: 'var(--dlv-blue)', f: (z) => f(g(z)) },
    ];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, c, d, withRelu]);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Slide 23 · chain two “layers” f(z) = {c}z+{d} and g(z) = {a}z{b < 0 ? '' : '+'}{b}</span>
        <label className="dl-check">
          <input type="checkbox" checked={withRelu} onChange={(e) => setWithRelu(e.target.checked)} />
          insert a ReLU between the layers
        </label>
      </div>
      <div className="dl-sliders">
        <label className="dl-slider"><span>g slope a = {a}</span><input type="range" min="-8" max="8" step="0.5" value={a} onChange={(e) => setA(Number(e.target.value))} /></label>
        <label className="dl-slider"><span>g intercept b = {b}</span><input type="range" min="-3" max="3" step="0.5" value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
        <label className="dl-slider"><span>f slope c = {c}</span><input type="range" min="-8" max="8" step="0.5" value={c} onChange={(e) => setC(Number(e.target.value))} /></label>
        <label className="dl-slider"><span>f intercept d = {d}</span><input type="range" min="-3" max="3" step="0.5" value={d} onChange={(e) => setD(Number(e.target.value))} /></label>
      </div>
      <FnPlot
        series={series}
        xmin={-3} xmax={3} ymin={-18} ymax={18} height={300}
        caption={
          withRelu
            ? 'One tiny nonlinearity and the composition finally BENDS — now stacking layers buys expressive power.'
            : `Whatever you set, f(g(z)) = ${a * c}z ${c * b + d < 0 ? '−' : '+'} ${Math.abs(c * b + d)} — a straight line. Without nonlinearity between layers, a deep stack collapses to a single layer.`
        }
      />
    </div>
  );
}

/* ── Slides 24 / 27 / 29 / 31 · pick the output head ─────────────────────── */
const HEADS = [
  { id: 'reg', label: 'Regression · any value', n: '1 per prediction dimension', act: 'none', loss: 'MSE — MAE if outliers, Huber for both', note: 'e.g. predicting a house price: one output neuron, no activation.' },
  { id: 'regpos', label: 'Regression · positive only', n: '1 per prediction dimension', act: 'ReLU or softplus', loss: 'MSE / MAE / Huber', note: 'softplus(z) = log(1 + eᶻ) keeps outputs strictly positive and smooth.' },
  { id: 'regbnd', label: 'Regression · bounded range', n: '1 per prediction dimension', act: 'sigmoid or tanh', loss: 'MSE / MAE / Huber', note: 'then scale the (0,1) or (−1,1) output to the required range.' },
  { id: 'bin', label: 'Binary classification', n: '1', act: 'sigmoid', loss: 'cross-entropy', note: 'one logistic output neuron is sufficient.' },
  { id: 'multilabel', label: 'Multilabel classification', n: '1 per binary label', act: 'sigmoid', loss: 'cross-entropy', note: 'each output answers its own yes/no independently.' },
  { id: 'multiclass', label: 'Multiclass classification', n: '1 per class', act: 'softmax', loss: 'cross-entropy', note: 'outputs become probabilities that sum to 1 — K = 10 for MNIST.' },
];

export function HeadPicker() {
  const [head, setHead] = useState('multiclass');
  const cur = HEADS.find((h) => h.id === head);
  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Output-head picker · slides 24, 27, 29, 31</span></div>
      <div className="dl-chips">
        {HEADS.map((h) => (
          <button key={h.id} type="button" className={`dl-chip${head === h.id ? ' dl-chip--on' : ''}`} onClick={() => setHead(h.id)} aria-pressed={head === h.id}>
            {h.label}
          </button>
        ))}
      </div>
      <div className="dl1-head" key={head}>
        <div className="dl1-head__row">
          <div className="dl1-head__cell"><p className="dl1-head__k">output neurons</p><p className="dl1-head__v">{cur.n}</p></div>
          <div className="dl1-head__cell"><p className="dl1-head__k">output activation</p><p className="dl1-head__v">{cur.act}</p></div>
          <div className="dl1-head__cell"><p className="dl1-head__k">loss</p><p className="dl1-head__v">{cur.loss}</p></div>
        </div>
        <p className="dl-plot__cap">{cur.note}</p>
      </div>
      <p className="dl1-head__shared">
        Every head sits on the same body: <b>1–5 hidden layers</b>, <b>10–100 neurons each</b>,
        hidden activation <b>ReLU</b> (slides 27 &amp; 31).
      </p>
    </div>
  );
}

/* ── Slide 29 · softmax, live ────────────────────────────────────────────── */
const SM_COLORS = ['var(--dlv-blue)', 'var(--dlv-orange)', 'var(--dlv-aqua)'];

export function SoftmaxLab() {
  const [z, setZ] = useState([2.0, 0.5, -1.0]);
  const [k, setK] = useState(0);
  const exps = z.map((v) => Math.exp(v));
  const sum = exps.reduce((s, e) => s + e, 0);
  const p = exps.map((e) => e / sum);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar"><span className="dl-lab__name">Softmax · three logits in, one probability distribution out</span></div>
      <div className="dl1-smgrid">
        <div className="dl-sliders" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {z.map((v, i) => (
            <label key={i} className="dl-slider">
              <span>z{i + 1} = {v.toFixed(1)}</span>
              <input type="range" min="-4" max="4" step="0.1" value={v} onChange={(e) => setZ(z.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
            </label>
          ))}
        </div>
        <div className="dl1-smbars">
          {p.map((pi, i) => (
            <div key={i} className="dl-errbar">
              <span className="dl-errbar__k">p̂{i + 1}{k === i ? ' (true)' : ''}</span>
              <span className="dl-errbar__track">
                <span className="dl-errbar__fill" style={{ width: `${pi * 100}%`, background: SM_COLORS[i] }} />
              </span>
              <span className="dl-errbar__v">{(pi * 100).toFixed(1)}%</span>
            </div>
          ))}
          <p className="dl1-smsum">Σ p̂ = {(p[0] + p[1] + p[2]).toFixed(2)} — always. That’s the point of softmax.</p>
        </div>
      </div>
      <div className="dl-ctl">
        <span className="dl-ctl__label">True class</span>
        <div className="dl-chips">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" className={`dl-chip${k === i ? ' dl-chip--on' : ''}`} onClick={() => setK(i)} aria-pressed={k === i}>class {i + 1}</button>
          ))}
        </div>
        <span className="dl1-smloss">cross-entropy for this instance: −log p̂{k + 1} = <b>{(-Math.log(p[k])).toFixed(3)}</b></span>
      </div>
      <Tex block src="J(\boldsymbol{\theta}) = -\frac{1}{m}\sum_{i=1}^{m}\sum_{k=1}^{K} y_k^{(i)} \log\big(\hat{p}_k^{(i)}\big)" />
      <p className="dl-plot__cap">
        Predicting probability distributions → cross-entropy (log loss) is generally the right
        choice. Push the true class’s logit down and watch its −log p̂ blow up.
      </p>
    </div>
  );
}

/* ── Slides 25, 27–28 · losses ───────────────────────────────────────────── */
const huber = (z, delta) => (Math.abs(z) <= delta ? 0.5 * z * z : delta * (Math.abs(z) - 0.5 * delta));

export function LossLab() {
  const [mode, setMode] = useState('err');
  const [delta, setDelta] = useState(1);

  const series = useMemo(() => {
    if (mode === 'err') {
      return [
        { id: 'abs', label: 'abs. error', color: 'var(--dlv-green)', dash: '7 5', f: (z) => Math.abs(z) },
        { id: 'sq', label: 'sq. error', color: 'var(--dlv-blue)', f: (z) => z * z },
      ];
    }
    if (mode === 'huber') {
      return [
        { id: 'abs', label: 'abs.', color: 'var(--text-faint)', dash: '3 4', width: 1.4, f: (z) => Math.abs(z) },
        { id: 'sq', label: 'sq.', color: 'var(--text-faint)', dash: '7 5', width: 1.4, f: (z) => z * z },
        { id: 'huber', label: `Huber (δ=${delta.toFixed(1)})`, color: 'var(--dlv-red)', f: (z) => huber(z, delta) },
      ];
    }
    return [
      { id: 'relu', label: 'ReLU(z)', color: 'var(--dlv-orange)', dash: '10 4 2 4', f: (z) => Math.max(0, z) },
      { id: 'softplus', label: 'softplus(z)', color: 'var(--dlv-blue)', f: (z) => softplus(z) },
    ];
  }, [mode, delta]);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Loss &amp; friends · figures from slides 25 and 28</span>
        <div className="dl-chips">
          <button type="button" className={`dl-chip${mode === 'err' ? ' dl-chip--on' : ''}`} onClick={() => setMode('err')} aria-pressed={mode === 'err'}>abs vs squared</button>
          <button type="button" className={`dl-chip${mode === 'huber' ? ' dl-chip--on' : ''}`} onClick={() => setMode('huber')} aria-pressed={mode === 'huber'}>Huber</button>
          <button type="button" className={`dl-chip${mode === 'softplus' ? ' dl-chip--on' : ''}`} onClick={() => setMode('softplus')} aria-pressed={mode === 'softplus'}>ReLU vs softplus</button>
        </div>
      </div>
      {mode === 'huber' && (
        <label className="dl-slider" style={{ maxWidth: 240 }}>
          <span>δ = {delta.toFixed(1)}</span>
          <input type="range" min="0.5" max="3" step="0.1" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
        </label>
      )}
      <FnPlot
        series={series}
        xmin={mode === 'softplus' ? -5 : -4.4} xmax={mode === 'softplus' ? 5 : 4.4}
        ymin={mode === 'softplus' ? -1 : 0} ymax={mode === 'softplus' ? 6 : 10}
        height={300}
        caption={
          mode === 'err'
            ? 'MSE punishes outliers quadratically; MAE is more robust against them (slide 27).'
            : mode === 'huber'
              ? 'Huber = squared error near 0, absolute error beyond ±δ — the best of both. Drag δ to widen the quadratic bowl.'
              : 'softplus(z) = log(1 + eᶻ): exactly ReLU’s shape, but smooth at the origin (slide 25).'
        }
      />
      {mode === 'huber' && (
        <Tex block src="\text{Huber}_\delta(z) = \begin{cases} \frac{1}{2}z^2 & |z| \le \delta \\ \delta\big(|z| - \frac{1}{2}\delta\big) & \text{otherwise} \end{cases}" />
      )}
    </div>
  );
}
